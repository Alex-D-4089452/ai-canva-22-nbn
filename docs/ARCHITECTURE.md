# Architecture

This document explains how relay is structured. It is a **client-side React Flow canvas** served
as a static bundle by **Firebase Hosting**. The browser calls a **Node/Express API on Render** for
AI generation and storage signing, and uses **Firebase** for accounts and real-time board sync.
File blobs (board images/documents) live in **Cloudflare R2**. The legacy Cloud Functions copy in
`functions/` is optional and is not part of the current deployment (Cloud Functions require the
Blaze plan).

## High-level overview

```
+-------------------------------+
| Firebase Hosting              |
| serves client/dist            |
+---------------+---------------+
                | loads the static app
                v
+-------------------------------+      /api (HTTPS)      +-------------------------------+
| Browser (React client)        | ---------------------> | Render Web Service            |
| React + Vite · React Flow     |                        | server/ · Node + Express      |
| Zustand store                 |                        |                               |
+---------------+---------------+                        +---------------+---------------+
                |                                                        |
                | Firebase SDK                                           | AI provider SDKs
                v                                                        v
+-------------------------------+                        +-------------------------------+
| Firebase                      |                        | Ollama Cloud (text)           |
| Auth (Google) · Firestore     |                        | fal.ai (images)               |
| boards · presence · usage     |                        | Google Stitch (UI)            |
+-------------------------------+                        +-------------------------------+

Board images/documents:
  Browser (React client) --presigned PUT--> Cloudflare R2
  Browser --POST /api/storage/sign--> Render --signs the PUT--> Cloudflare R2
```

### API server and legacy Functions path

The API surface exists in two copies:

1. **`server/`** — the Express API. It runs locally for development and as the production
   **Render Web Service** (`render.yaml`). In production the browser calls it through
   `VITE_API_BASE`; during local dev Vite proxies `/api` to it.
2. **`functions/`** — an optional Firebase Cloud Functions packaging of the same endpoints
   (`onRequest`). It is **not deployed in the current architecture**: Cloud Functions require the
   Blaze plan, so production uses Render. The code remains for a legacy Firebase-only path.

The two copies are kept in sync when the optional Functions path changes; `server/` is the
deployed implementation. Admin-SDK-only routes (admin stats/roles, workshop join) are implemented
in `functions/`; on Render they return `501` unless a proxy or service account is configured.

---

## Client

### State management — `store/boardStore.ts`

A single [Zustand](https://zustand-demo.pmnd.rs/) store (persisted to localStorage) owns the
entire board:

- **`nodes` / `edges`** — the React Flow graph.
- **`boxData`** — a `Record<boxId, BoxData>` holding per-box content, prompts, status, output,
  images, slides, and generated code. This is kept **separate from the React Flow node objects**
  so it can be serialized to Firestore without extra graph fields.
- **`currentBoardId`, `boardTitle`, `saveStatus`, `boardList`, `collaborators`, `activeUsers`** —
  board metadata and collaboration state.

Key behaviors:

- **`runBox(id)`** is the orchestrator. It:
  1. Gathers upstream inputs from incoming edges (text + optional image).
  2. Builds a `NamedInput[]` (name + output) for prompt templating.
  3. Branches by box type — `cartoon` → fal.ai, `stitch` → Google Stitch,
     `slides` → Ollama + JSON parsing, `code`/`ui` → Ollama + code extraction, else Ollama text.
  4. Updates the box's `status` (`idle → running → done | error`).
- **Debounced autosave**: every mutation calls `scheduleSave()`, which fires
  `saveToFirestore()` ~1s after the last change.
- **Real-time sync**: `subscribeToBoardUpdates()` sets up a Firestore `onSnapshot` on the board
  document plus a presence subcollection listener. Echo prevention compares the snapshot's
  `updatedAt` with the last locally-saved `updatedAt` to avoid re-applying your own writes.
- **Presence**: cursor moves are throttled to one write per 200ms into `boards/{id}/presence/{uid}`;
  entries older than 30s are filtered out, and presence is removed on page unload. A heartbeat
  re-stamps `lastActive` every 15s while a board is open, so online-but-idle users stay in the
  header roster (`PresenceRoster.tsx`) — a clickable avatar stack listing everyone on the board
  now, plus collaborators who are offline. Heartbeat-only users are skipped by the cursor overlay
  (`hasCursor: false`).

### Component tree

```
App.tsx                     Shell: header, board actions, sign-in, modals
├── ReactFlowProvider
│   ├── Canvas.tsx          ReactFlow graph + Background/MiniMap/Cursors
│   ├── Sidebar.tsx         "Add Box" panel grouped by category
│   └── Toolbar.tsx         In-canvas "How to use" help
├── NewBoardModal.tsx
└── ShareModal.tsx          Share link + collaborator management
```

- **`BoxNode.tsx`** is the single node component for **all** box types. It renders the header
  (icon + editable name), body (by type), footer (Run / settings / copy / save), and the
  settings panel (system prompt + prompt template + variable insertion). It uses
  `NodeResizer` for resize and React Flow `Handle`s for connections.
- **`Canvas.tsx`** also reconciles React Flow's latched selection modifier keys against real
  pointer events (`lib/modifiers.ts`, unit-tested). OS/browser shortcuts such as Win+Shift+S or
  Cmd+Shift+5 can swallow the Shift `keyup`, leaving React Flow in selection mode so pane drags
  stop panning. The canvas synthesizes the missing keyup, clears an interrupted marquee/pan on
  blur or a lost pointerup, and leaves a genuine Shift-drag untouched.
- **Opening view:** the canvas fits content with overlay-aware padding (84px left for the rail,
  88px bottom for the CanvasBar), never opens a content board below 115% (max 225%), and uses a
  115% `defaultViewport` when there is nothing to fit. React Flow's `maxZoom` is raised from 2 to
  2.5 so the fit can use the extra range; `CanvasBar` shows the resulting percentage and still owns
  −/+ zoom.

### Handoff Brief review — `components/ui/ReviewerChip.tsx`

The Handoff Brief is the only box with a human sign-off. Once its status is `done` and it has
output, the reviewer chip appears beside the box's floating status pill. Any board collaborator
can click it; the `reviewHandoff` store action stores `reviewedBy` + `reviewedAt` in `BoxData`,
and clicking the reviewed chip again clears both fields. `boxStatus` (`lib/status.ts`) then reports
`Done, reviewed`, so both the box pill and the pipeline strip reflect the sign-off. Running the
box again clears the review, because a new brief needs a new sign-off. The same component renders
the static "Reviewed by …" pill on the landing page; it is interactive only when given an
`onToggle` handler.

### Prompt templating — `lib/prompts.ts`

`fillPromptTemplate(template, inputs)` resolves variables in order:

1. `{{inputs}}` — all inputs, labeled by box name.
2. `{{input}}` — first input (backward compat).
3. `{{input_N}}` — Nth input, positional (backward compat).
4. `{{Box Name}}` — any remaining `{{...}}` matched (case-insensitive) against connected box names.

### Box definitions — `types/`

Each box type's metadata (label, icon, color, category, role tags, default prompts, default size)
lives in **its own file** under `client/src/types/boxes/` (`idea.ts`, `agent.ts`, …, `custom.ts`).
`BOX_TYPES: Record<BoxType, BoxTypeMeta>` in `client/src/types/boxTypes.ts` is the single source of
truth for every box; the `BoxType` union it is keyed by lives in `client/src/types/core.ts` (with
`BoxData` and the other shared shapes). The `Record` keeps union and table in lockstep — a member
with no entry, or an entry that is not in the union, is a compile error. Insertion order in
`boxTypes.ts` is the palette order. `client/src/types/index.ts` re-exports everything (including
box-specific constants like `AGENT_CONTROLLER_SYSTEM_PROMPT`, `CODE_CHANGE_PROMPT` and
`LABEL_COLORS`), and modules import it as `../types/index.js`. Adding a box type means adding a
union member, a `boxes/<type>.ts` file and its `BOX_TYPES` entry, registering it in `Canvas.tsx`'s
`nodeTypes`, and adding a render branch in `BoxNode.tsx`.

### Code rendering — `lib/code.ts`

Generated React code is wrapped in a self-contained HTML file that loads React 18 + Babel via CDN
(`wrapCodeInHtml`), optionally with Tailwind + Google Fonts (`wrapUIInHtml` for the UI box),
then rendered in a sandboxed iframe. `extractCode` strips markdown code fences; `downloadHtml`
and `copyToClipboard` power the Save/Copy buttons.

### Firebase layer — `lib/`

- **`firebase.ts`** — initializes the app (config is hardcoded today; see OSS_READINESS).
- **`firestore.ts`** — CRUD + real-time subscriptions + presence + sharing for the `boards`
  collection and `presence` subcollection.
- **`storage.ts`** — uploads board images/documents to Cloudflare R2 via `POST /api/storage/sign`
  (Firebase ID token → presigned PUT → durable public URL) and returns a small fetchable URL.
- **`auth.ts`** — Google sign-in via popup and an auth-state listener.

---

## Backend

### Express API (`server/`)

`server/src/index.ts` calls `createApp()` (CORS, JSON body parsing with a 10 MB limit, and all
API routes) and starts the server on a detected free port (see `findPort.ts`) for local dev.
Render runs the built app with `npm start` and supplies `PORT`. The local port is written to
`.server-port` in the project root so the Vite proxy can target it.

Provider modules are created **lazily** (not at import time) because ES-module imports are
hoisted ahead of `dotenv.config()`:

- **`ollama.ts`** — `generateContent(systemPrompt, userPrompt)` calls Ollama's `/api/chat`
  endpoint. It targets **Ollama Cloud** at `https://ollama.com` by default (Bearer auth with
  `OLLAMA_API_KEY`), but respects `OLLAMA_HOST` so a local daemon also works. The model is set by
  `OLLAMA_MODEL` (default `deepseek-v4.1-flash`).
- **`fal.ts`** — `generateCartoonImage({ prompt, imageUrl })`:
  - Image present → upload to fal storage (if base64), then `fal-ai/qwen-image-edit`
    (image-to-image).
  - No image → `fal-ai/flux/schnell` (text-to-image).
- **`stitch.ts`** — `generateStitchUI(prompt)` uses the Google Stitch SDK to create/reuse a
  project and generate a screen, then fetches and returns the HTML + screenshot URL. Prompts are
  capped (`MAX_PROMPT_CHARS`, default 6000) and use the fast `GEMINI_3_FLASH` model so real
  pipelines (large `{{inputs}}`) neither time out nor degrade into written specs.
- **Stitch job handling** — Stitch generation is slow (40s+). `server/src/app.ts` keeps an
  in-memory job store for local/Render and returns a `jobId` immediately; the legacy
  `functions/` path uses Firestore plus a Cloud Task worker (`functions/src/stitchJobs.ts`). See
  `POST /api/stitch-generate` / `GET /api/stitch-status/:jobId` below.

### Firestore data model

Collection `boards/{boardId}`:

```
{
  title: string,
  ownerId: string,        // creator's Firebase UID
  ownerEmail: string,
  collaborators: string[],// emails invited by owner
  nodes: Node[],          // React Flow nodes
  edges: Edge[],
  boxData: Record<string, BoxData>,
  createdAt: number,
  updatedAt: number
}
```

Subcollection `boards/{boardId}/presence/{uid}`:

```
{ userId, email, displayName, initials, color, cursorX, cursorY, lastActive }
```

Collection `stitchJobs/{jobId}` *(legacy Functions path only, server-side)*:

```
{ status: "queued" | "running" | "done" | "error", prompt, html?, imageUrl?, error?, createdAt, updatedAt? }
```

---

## Data flow for a "Run"

1. User clicks **▶ Run** on a box.
2. `runBox(id)` reads `edges` for incoming connections and collects `NamedInput`s (and an image,
   if an upstream Image box is connected).
3. The prompt is filled with `fillPromptTemplate`, and the request goes to the backend
   (`/api/generate`, `/api/generate-image`, or `/api/stitch-generate`).
4. The backend calls the relevant AI SDK and returns a result. **Stitch is asynchronous**: the
   server returns a `jobId` immediately, the client polls `GET /api/stitch-status/:jobId` until
   the job is `done`/`error`, then receives the HTML. (The async flow was introduced on the legacy
   Firebase Hosting → Cloud Functions path to stay under the ~60s rewrite timeout; the Render
   deployment keeps the same contract.)
5. `runBox` post-processes it (parse slides JSON, extract code, etc.) and writes it into
   `boxData` with `status: "done"`.
6. `scheduleSave()` triggers a debounced Firestore write; collaborators see it via `onSnapshot`.

### Workshops (facilitators, teams, guests)

A permission layer parallel to admins: `facilitators/{uid}` docs (granted via the admin
`/api/admin/roles` endpoint). The Facilitator Dashboard (admins + facilitators) manages
**workshops** (`workshops/{id}`), **template boards** (ordinary boards flagged `isTemplate`,
copied when a team is created), and **teams** (`teams/{id}`, max 5 seats, facilitator-created).
Each seat is a code at top-level `codes/{code}`; the `/api/workshop/join` endpoint redeems a
code for a Firebase **custom token** bound to a durable per-code guest uid — guests join without
login, pick a name, land on their team board (via the board's `memberUids`), and can create their
own boards. Minting requires the Admin SDK: the legacy `functions/` path implements it directly,
while the Render server proxies to `WORKSHOP_PROXY_URL` when configured (otherwise `501`).

