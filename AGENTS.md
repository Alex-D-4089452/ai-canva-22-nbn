# relay — Project Memory

This file is auto-loaded into the AI agent's context at the start of every session (DeepSeek
Harness reads `AGENTS.md` / `CLAUDE.md` from the project root). It captures durable project
knowledge so it survives across sessions. Keep it current — it is the first thing an agent reads.

**Session bootstrap:** after this file, read `docs/DEVLOG.md` (newest entries first) to pick up
the current in-flight state without re-exploring the codebase. When you finish a unit of work,
append a short entry there — and a new session should be able to cold-start from these two files
alone.

## What this project is

**relay** is a collaborative, AI-powered whiteboard for building visual AI pipelines. Users
place "boxes" on a React Flow canvas, connect them, and run AI prompts that flow content from box
to box — from an Idea, through Research, to PRD / Slides / Code / UI Design / Stitch UI.

**Display name:** the product is branded **relay** (lowercase) in the UI — landing nav/footer,
in-app header, and page title. The wordmark is `client/src/components/ui/RelayLogo.tsx`
(brand-blue `l` + theme-neutral `re`/`ay`); the blue `r` tile is `client/public/relay-mark.svg`,
which is also the favicon. Repository slug, package names, Firebase project IDs, API URLs and
localStorage keys intentionally remain `ai-canva-22-nbn` / `ai-canva-*`; do not rename those for
a UI rebrand. Course handouts under `docs/course/` and historical DEVLOG entries still use the
old name; update them only if explicitly asked.

- **Client:** React + Vite + React Flow canvas, Zustand store, Tailwind CSS.
- **Backend:** Node/Express. It runs locally and as the production **Render Web Service**.
  `functions/` is a legacy, optional Firebase Cloud Functions copy; it requires the Blaze plan
  and is **not deployed** in the current architecture.
- **AI providers:** Ollama (LLM text), fal.ai (image generation), Google Stitch (UI screens).
- **Persistence & collaboration:** Firebase — Google Auth, Firestore (boards, presence, live
  cursors). **File blobs (board images/documents) live in Cloudflare R2** (free tier, zero
  egress), signed via `POST /api/storage/sign`. localStorage is an offline cache.

## Repository layout

| Path | Purpose |
|------|---------|
| `client/` | React + Vite frontend. Entry `client/src/`, store at `client/src/store/boardStore.ts`. |
| `server/` | Express API, run locally and as the production Render Web Service (`/api/generate`, `/api/generate-image`, `/api/stitch-generate`, `/api/storage/sign`, `/api/health`). |
| `functions/` | Legacy/optional Firebase Cloud Functions copy (`onRequest`; requires Blaze; not deployed). Also hosts `src/stitchJobs.ts` (the async Stitch Cloud Task worker). |
| `scripts/deploy.sh` | Legacy Firebase deploy (build client, build Functions, deploy Hosting + Functions + rules; needs Blaze). Current production uses Render + `scripts/deploy-hosting.sh`. |
| `docs/` | Guides: `OVERVIEW`, `ONBOARDING`, `ARCHITECTURE`, `BOX_TYPES`, `API`, `MODELS`, `DEPLOYMENT`, `OSS_READINESS`, plus `docs/course/` teaching materials. `docs/DEVLOG.md` is the session journal (read at session start, append after finishing work). |
| `firebase.json`, `firestore.rules` | Firebase Hosting + Firestore config and security rules (static client; no `/api` rewrite; file storage is Cloudflare R2, not Firebase Storage). |
| `dsh-plugins/` | Out-of-tree plugins for the DeepSeek Harness Web GUI (not part of the app). See "dsh GUI plugins" below. |

## Key commands

```bash
npm run dev            # run server + client together (concurrently)
npm run dev:server     # local Express backend only
npm run dev:client     # Vite client only
npm run install:all    # npm install in both server/ and client/
npm test               # run server + client unit tests (Vitest)
npm run test:watch    # watch mode for both server and client tests
npm run deploy         # legacy Firebase Hosting + Functions deploy (needs Blaze; not current path)
# Current production (no Blaze): API on Render from render.yaml (root server/), client on Hosting:
#   bash scripts/deploy-hosting.sh https://ai-canva-22-nbn.onrender.com
#   (writes client/.env.production for VITE_API_BASE — bash env-prefix does NOT reach Vite on Windows)
```

## Architecture notes

- **Two API copies; Render is production.** `server/` is the deployed Express API (local dev and
  Render). `functions/` is a legacy, optional Firebase Functions copy (requires Blaze; not
  deployed). Both use the same SDKs; keep them in sync when changing the optional path.
- **Single Zustand store** (`client/src/store/boardStore.ts`) owns the whole board: `nodes`/`edges`
  (React Flow graph), `boxData` (per-box content/prompts/status/output — kept separate from the
  graph objects so it serializes cleanly to Firestore), and board/collaboration metadata.
- **Box definitions live one file per box** under `client/src/types/`: `core.ts` (the `BoxType`
  union, `BoxData`, `BoxTypeMeta`, shared shapes, `AREA_COLORS`), `boxes/<type>.ts` (each box's
  metadata — box-specific constants ride along: `AGENT_CONTROLLER_SYSTEM_PROMPT` in `agent.ts`,
  `CODE_CHANGE_PROMPT` in `ui.ts`, `LABEL_COLORS` in `label.ts`), `boxTypes.ts` (the `BOX_TYPES`
  record — **insertion order is the palette order**), and `index.ts` (the public surface; modules
  import `../types/index.js`). The `Record<BoxType, BoxTypeMeta>` keeps union and table in
  lockstep, so adding a box touches `core.ts` + a new `boxes/<type>.ts` + `boxTypes.ts`.
- **`runBox(id)`** is the orchestrator: gathers upstream inputs from incoming edges, builds
  `NamedInput[]` for prompt templating, then branches by box type (cartoon → fal.ai, stitch →
  Google Stitch, slides → Ollama + JSON parsing, ui → Ollama + code extraction, else Ollama
  text).
- **Stitch is asynchronous.** Stitch generation is slow (40s+) and exceeded the ~60s Firebase
  Hosting rewrite timeout on the legacy Functions path, so a synchronous request reported "Request
  failed" even though the screen was created in Stitch. `POST /api/stitch-generate` returns a
  `jobId` immediately; the client polls `GET /api/stitch-status/:jobId` until the job is
  `done`/`error`. The client-side `generateStitchUI(prompt)` in `client/src/lib/api.ts` hides this
  (start + poll). Local dev and Render use the in-memory job store in `server/src/app.ts`; the
  legacy Functions path uses Firestore (`stitchJobs/{jobId}`, no client access) plus a Cloud Task
  worker `processStitchJob` in `functions/src/stitchJobs.ts`.
  `stitch.ts` caps prompt length (6000), creates a fresh `StitchToolClient` per call
  (avoids an SDK v0.3.5 bug where the MCP transport reference goes stale after errors),
  and only sends required params (`projectId` + `prompt`)
  Keep the two backends' stitch endpoints in sync.
- **Local server is split for testability.** `server/src/app.ts` exports `createApp()` (the Express
  app + all routes + the in-memory stitch job store) with **no side effects at import**;
  `server/src/index.ts` is the bootstrap that calls `createApp()`, finds a port, writes
  `.server-port`, and listens. Write route tests against `createApp()` via supertest instead of
  starting the server.
- **Client pure logic lives in `client/src/lib/`** and is unit-tested: prompt templating
  (`prompts.ts`), code/HTML wrapping (`code.ts`), slides JSON parsing (`slides.ts`), Firestore
  save serialization (`serialization.ts`), Documents-box text handling (`documents.ts`), the
  Agent box action protocol (`agent.ts`), input gathering (`inputs.ts` — `collectInputs`
  walks edges into `NamedInput[]` + first `inputImage`; **image-only sources contribute a
  labeled named input** so `{{inputs}}` resolves), the line-diff engine (`diff.ts`), the stale
  modifier-key detector (`modifiers.ts`), and here.now deploy payloads (`deploy.ts`).
  `boardStore.ts` imports these rather than inlining them.
- **Prompt templating** references connected inputs by name: `{{Box Name}}`, `{{input_1}}`,
  `{{inputs}}`.
- **File storage is Cloudflare R2, not Firebase Storage.** Board images (Cartoon/Image boxes) and
  Documents-box originals upload to an R2 bucket; Firestore/Auth/Hosting are unchanged. The browser
  never holds R2 credentials: `client/src/lib/storage.ts` calls **`POST /api/storage/sign`**
  (both backends) with a Firebase ID token, receives a ~15-min presigned PUT URL, uploads straight
  to R2, and stores the durable public URL (`R2_PUBLIC_BASE_URL/key`, bucket's r2.dev public
  access — same effective model as Firebase download-token URLs) in Firestore. Key rules live in
  the duplicated **`server/src/r2.ts` / `functions/src/r2.ts`** (`validateStorageKey` only allows
  `boards/{boardId}/images/…` and `boards/{boardId}/documents/…`, so the sign endpoint is never a
  general bucket-write proxy; `listStorageUsage` feeds admin stats). Env:
  `R2_ACCOUNT_ID`/`R2_ACCESS_KEY_ID`/`R2_SECRET_ACCESS_KEY`/`R2_BUCKET`/`R2_PUBLIC_BASE_URL` in
  `server/.env` / the Render dashboard (and `functions/.env` only for the legacy path). Missing config → sign
  returns **501** and uploads degrade like the old signed-out mode (document text kept; the Image
  box keeps a **local base64 preview** and shows a visible error — base64 is stripped on the next
  Firestore save, so it won’t survive reload until a retry succeeds). The local server verifies ID tokens with **`server/src/auth.ts`**
  (node:crypto against Google's public securetoken certs — no service account, no firebase-admin);
  functions uses `getAuth().verifyIdToken`. `storage.rules` was removed from the repo/deploy;
  old Firebase Storage download URLs still work until that bucket is deleted.
- **Firebase project is `ai-canva-22-nbn-fee4b`** (client `lib/firebase.ts`, `.firebaserc`, deploy
  script defaults). Older boards may still live in the legacy **`carbondocs`** project — use
  Boards → **Migrate from carbondocs** (`client/src/lib/migrate.ts`, secondary Firebase app +
  Google sign-in) or Export/Import JSON. A dead `currentBoardId` (wrong project / deleted board)
  is cleared by `loadBoardFromFirestore` (returns false); App then recovers the local canvas via
  `createNewBoard(…, { preserveContent: true })` so saves don’t loop on `not-found`.
- **19 built-in box types** plus user-created custom boxes: **Input** (`media` — the unified
  input box: typed idea + uploaded documents + uploaded image in one), Agent, Idea, Image,
  Documents, Research, Summarise, PRD, Cartoon Profile,
  Slides, UI Design,
  Stitch UI, Handoff Brief, Alignment Check, Jargon Translator, four collaboration boxes (Note, Label,
  Timer, **Checklist**), and the `custom` runtime type (see
  "Custom boxes" below). Categories: `input`, `worker`,
  `collab` (standalone team tools: no AI, no Run, no handles),
  and `custom` (the user's saved templates). See `docs/BOX_TYPES.md`.

## UI design system

The app chrome follows a consistent "enterprise but modern" language: a **near-black app bar**
(`.app-bar`, `#0b0d12`, blurred) over a **pipeline strip** (`components/PipelineStrip.tsx` — the
live box-order breadcrumb under the header, with a **data-safety note** on the right: shield glyph +
"Synthetic or de-identified material only" + an **Input rules** link that opens the
`components/InputRulesPanel.tsx` right-hand slide-over (portal to `document.body`, closes on
backdrop click / Escape / ✕, focus moved to ✕), a **left icon rail** + **left "Add a box" palette
panel** on the canvas, a light **dotted** canvas with floating status pills on the box cards, and
a **dark bottom-center bar** (zoom + toast/Undo). Built on two shared primitives:

- **`client/src/components/ui/Button.tsx`** — the only button styling in the chrome.
  Variants: `primary` (indigo-600 — the general loud color), `brand` (relay blue `#1a73e8` —
  the dark-bar Run all action), `secondary` (white + 1px slate border — the default),
  `ghost` (transparent, for role-gated views), `danger`, plus **dark-surface variants**
  `onDark` (translucent white pill for the dark bar — Boards menu), `outlineLight` /
  `ghostLight` (Share, Admin/Facilitator on the dark bar; focus ring offset `#0b0d12`);
  sizes `xs/sm/md`; `active` renders the pressed state (dark). Every button gets a keyboard
  focus ring. Use it instead of hand-rolled Tailwind button class strings.
- **`client/src/components/ui/Menu.tsx`** — dropdown primitive (`Menu` + `MenuItem`
  + `MenuDivider`/`MenuLabel`). Closes on outside click + Escape; pass children as
  a function `(close) => …` so items can dismiss the menu after acting. `MenuItem`'s
  `accent` row is the brand-blue primary action (New Board). Used by the Boards menu and
  the account menu; the presence roster popover follows the same outside-click/Escape contract.

Design rules: one primary accent (indigo) over slate neutrals, with the relay brand blue
(`#1a73e8`) reserved for the logo, Run all, the New Board menu row and the Input rules link.
1px borders + layered soft shadows (no `border-2`/`shadow-lg` in the chrome); h-14 app bar
(`.app-bar`, dark + blurred, `z-40`); box cards are `.box-node` (1px type-colored border set
inline, indigo selection ring) with a faint **type-tinted `.box-header`** (`meta.color + "20"` —
the 2026-10-15 restyle briefly flattened it to white and the run-status strip below disappeared;
both restored and guarded by markers-check) and a tinted `.box-icon-tile`; `.save-dot` states map
`saveStatus`; thin scrollbars and the rounded minimap styling live
in `client/src/index.css` (React Flow's `<Controls />` is gone — the custom `CanvasBar`
owns zoom). Palette rows use a 28×28 icon tile tinted with the box
color at ~12% alpha (`color + "1F"`). **Chrome layering:** `.pipeline-strip` is `z-30`, BELOW
the header's `z-40` — header dropdowns (Boards/account menus, roster popover) are `z-50` *inside*
the header's stacking context, so a strip at ≥ 40 would clip them (later sibling wins on a tie);
markers-check hit-tests the overlap ("Boards menu paints over the pipeline strip").

**E2E palette-row contract (sharp edge):** a palette row's label must be the **last text in its
`<button>`** — the suite finds rows with `textContent.trim().endsWith(label)`. Row descriptions
and the trailing `+` / `✓ Added to the board` indicator therefore render from CSS pseudo-elements
(`data-desc`/`data-added` attributes on `.palette-main`, `::after` content on `.palette-item`
with `pointer-events: none`), never as child text nodes. Sections render expanded by default
(the suite needs the rows visible), collapsing only on user click.

**Box sizing & body text:** a new box's size comes from `defaultWidth`/`defaultHeight` in its
`client/src/types/boxes/<type>.ts` file (surfaced through `BOX_TYPES[<type>]` in
`types/boxTypes.ts`; all types scaled ×1.25 rounded-to-10 on 2026-10-03 —
e.g. Idea 400×250, Agent 500×600, Jargon Translator 450×480); **persisted nodes keep their stored
style**, so existing boards only grow when a box is added. Box text is sized centrally in
`index.css`: `.box-node` base 16px, plus the scoped rules `.box-body .text-sm` (15px, lifting the
helper/empty-state paragraphs), `.box-body .markdown-output` (18px / line-height 1.65 —
deliberately more specific than the Tailwind `text-sm` utility so it wins) and `.box-body textarea`
(16px), with markdown headings at 22/20/18 (h1/h2/h3). Prefer extending those scoped rules over
sprinkling `text-xs`/`text-sm` onto body content. The header title is 14px and its icon tile 26px.

**Box card secondary text & control sizes (readability pass, 2026-10-19):** muted copy on the
white card bottoms out at **slate-500** — header type label `text-slate-600`, token row slate-500
with the `…tok` total in slate-600, run-status "Ran at …" slate-500, empty-state/placeholder copy
in box bodies slate-500 (`BoxNode`, `ChecklistPanel`, `CodeChangePanel`, `DeployPanel`). Text on the
**dark surfaces inside a body** (timer card, code-change diff `<pre>`, editor-loading fallback)
stays slate-400 — keep light-on-dark text as-is when restyling. The destructive **header ✕** is
`text-red-500` at 28px (36px on coarse pointers), the footer **⚙** is a 36×36 square (`text-lg`),
and React Flow **connection dots are 14px** inline in `BoxNode.tsx` (both handles; 22px on coarse
pointers via `index.css`).

**`components/Header.tsx` owns its store subscriptions** (boardTitle, saveStatus,
boardList, currentBoardId) and is `memo`-ized. App must NOT subscribe to those
slices — otherwise every keystroke in the board-title input re-renders the whole
Canvas tree (this was the case before the header extraction). App passes only
stable `useCallback` handlers across the memo boundary. Destructive/rare actions
(Clear/Delete board, Sign out) live inside the header menus, not on the bar; the
visible bar is ~5 controls for a regular user (roster + ⚡ usage, Boards, Share,
**Run all**, account) plus role-gated Admin/Facilitator buttons. The **Boards menu
and Run all render even before a board opens** (a board-less state still needs
"Boards (" to open/create one — Share/roster/usage stay `currentBoardId`-gated).

**Canvas chrome (`App.tsx` layout):** header → `PipelineStrip` → a `flex-1 relative` canvas
region containing `Canvas`, `CanvasRail` (left icon rail: **Add Box** toggles the palette,
▭ Area tool + its `.area-colors` picker, Notes, Help), `Sidebar` (the `.sidebar-panel` palette:
search, role filter, collapsible sections), `Toolbar` (the "How to use" card — it shifts to
`left-[368px]` while the palette is open), and `CanvasBar` (bottom-center: zoom −/%/+, **undo /
redo** — the ↶/↷ buttons plus the Ctrl/Cmd+Z, Ctrl+Shift+Z / Ctrl+Y shortcuts — then the
toast with a single-step **Undo of the last added box**). React Flow's `<Controls />` is not
rendered. **Opening zoom is deliberately generous:** `Canvas.tsx` fits with overlay-aware padding
(84px left for the rail, 88px bottom for the CanvasBar) and never opens a content board below
**115%** (max 225%), falling back to a 115% `defaultViewport`; React Flow's `maxZoom` is raised to
**2.5** so the fit can use it. Every card grows with that zoom and the larger body type, so a fresh
board is readable without a manual zoom. **All transient chrome state lives in the non-persisted
`store/uiStore.ts`**
(`paletteOpen`, `helpOpen`, `areaTool`, `areaColorIdx`, `toast`) — `paletteOpen` and `helpOpen`
**start closed** on every load so a fresh canvas is unobstructed; the rail's Add Box and Help
buttons open them independently. Consumers subscribe themselves and **App must not** (the
6s-dismiss toast would re-render the whole canvas tree).
Shared pure logic: `lib/status.ts` `boxStatus()` drives both each card's floating `.box-pill`
and the strip's chip state; `lib/pipeline.ts` `pipelineOrder()` (Kahn topo sort, x-tiebreak,
cycle fallback) orders the strip **and** the sequential **Run all** loop in Header (skips boxes
whose `runInputBlocker` refuses instead of erroring them; the button's play glyph is an SVG, so
its text is exactly `Run all` — never `▶`, which the E2E counts per-box).

## Admin board

Admins can view system-wide usage (total users, active users, new users/boards in 7 days, storage
used) via an "Admin" button in the header.

- **Admin designation:** a doc at `admins/{uid}` marks a user as admin (add it manually via the
  Firebase console or a script). The client reads `admins/{uid}` (rules allow self-read) to show the
  Admin button; the server re-verifies.
- **User tracking:** the client writes `users/{uid}` on login (email, displayName, photoURL,
  `createdAt`, `lastActive`) and heartbeats `lastActive` every ~60s. This powers the "active now"
  metric.
- **Stats endpoint:** `GET /api/admin/stats` (see `docs/API.md`). It verifies the caller's ID token
  + admin role, then computes: total/new users from **Firebase Auth** (`listUsers`), active users
  from the `users` collection heartbeat, board counts via Firestore `count()`, and storage usage
  via the Admin SDK.
- **User management:** the admin board also lists all users and can block/unblock accounts:
  `GET /api/admin/users` (paginated) and `POST /api/admin/users/:uid/status` (`{ disabled }`),
  which call `auth.listUsers` / `auth.updateUser`. An admin cannot block their own account.
- **Admin auth helper:** `requireAdmin(req)` in `functions/src/index.ts` verifies the ID token +
  admin role for all `/api/admin/*` routes.

## Token usage tracking

The app reports per-call LLM token usage and tracks cumulative usage per user and across the system.

- **Source:** Ollama's non-streaming `/api/chat` response includes `prompt_eval_count` (input) and
  `eval_count` (output). `generateContent` in both `server/src/ollama.ts` and `functions/src/ollama.ts`
  returns `{ content, model, promptTokens, completionTokens, totalTokens }`, and `/api/generate`
  returns those counts under `usage`.
- **Per-box display:** each text AI box stores `tokens` in its `BoxData` and shows "in · out / total
  tok" in the box footer after running.
- **Persistence (client-side):** after each successful generate, the client writes a detailed
  `tokenUsage/{autoId}` doc (userId, boardId, boxId, boxType, model, prompt/completion/total,
  createdAt) and atomically bumps the user's rolling total in `usageTotals/{uid}` via Firestore
  `increment` (so concurrent calls don't lose updates).
- **Cumulative in the header:** `client/src/store/tokenStore.ts` (non-persisted) holds the logged-in
  user's session total, seeded from `usageTotals/{uid}` on login and incremented as calls run. A ⚡
  badge in the header shows it.
- **Admin aggregate:** `/api/admin/stats` sums `usageTotals` across all users and returns
  `tokens: { promptTokens, completionTokens, totalTokens }`, shown as a card in the AdminBoard
  Overview.
- **Per-user admin view:** `GET /api/admin/users` joins each user with their `usageTotals` doc and
  returns per-user `tokens`. The AdminBoard Users tab shows "Tokens ⬆" (input / `promptTokens`) and
  "Tokens ⬇" (output / `completionTokens`) columns — kept separate because they cost differently.
- **Rules:** a user can create/read their own `tokenUsage` docs and read/write their own
  `usageTotals` doc; the admin function reads aggregates via the Admin SDK.
- **Admin SDK only:** the endpoint is implemented in the legacy `functions/` copy (uses
  `firebase-admin`). `server/` (local and Render) returns `501` because it has no service account —
  an **intentional deviation** from the duplication rule. The admin board is unavailable on the
  current Render deployment unless an Admin SDK proxy is added.
- **Client files:** `client/src/lib/admin.ts` (isAdmin/profile/heartbeat/fetchAdminStats) and
  `client/src/components/AdminBoard.tsx` (the dashboard UI).

## Testing (Vitest)

- **Run all:** `npm test` (server then client). **Watch:** `npm run test:watch`.
- **Server tests** (`server/src/*.test.ts`, supertest + Vitest): hit `createApp()` from
  `server/src/app.ts` with the AI modules (`ollama`/`fal`/`stitch`) mocked via `vi.mock`; they cover
  route validation, response shaping, the stitch job flow, and `generateContent` token parsing.
  Server test files are excluded from the `tsc` build via `exclude` in `server/tsconfig.json` — do
  not remove that.
- **Client tests** (`client/src/lib/*.test.ts`): pure functions only (prompts, code, slides,
  serialization) — no DOM, no Firebase. `client/vitest.config.ts` (node env) loads instead of
  `vite.config.ts` to avoid the dev-server proxy + build chunks.
- **No functions/ tests yet** — they need the Firebase emulator / Admin SDK; keep API logic in sync
  between `server` and `functions` by hand and cover the shared logic via `server` tests.
- **E2E suite:** `client/e2e.mjs` (playwright-core + system Chrome — binary resolved
  cross-platform by `client/chrome.mjs`, shared with ui-smoke/markers-check) drives the **real dev
  app** on
  `localhost:5173` with the real backend. Part 1 (fake user via dev-only `window.__dsh` store hooks
  in `main.tsx`, `import.meta.env.DEV`-guarded, stripped from prod): landing → login → palette adds
  → note/label/timer flows → a real `/api/generate` run (Ollama) with markdown output + token badge.
  Part 2 (**real auth + real Firestore, two users in separate contexts**): real email/password
  sign-in via `createTestAccount`/`signInTestAccount` in `client/src/lib/auth.ts` (unused by the
  app UI → tree-shaken from prod), real board creation, persistence across a page reload,
  a second user opening the board via `?board=<id>`, and live cross-user sync (note edits A→B,
  timer start/stop B→A with attribution, presence). Requires the **Email/Password provider**
  enabled in Firebase Auth — done once via the Identity Toolkit admin API
  (`PATCH .../admin/v2/projects/ai-canva-22-nbn-fee4b/config?updateMask=signIn.email` with the
  firebase-tools access token from `~/.config/configstore/firebase-tools.json` — always use the
  **client's** project id from `lib/firebase.ts`; an older doc said `carbondocs`); it can be
  re-disabled in the console, but the suite needs it. Test accounts (`e2e-a@/e2e-b@test.local`)
  are auto-created and **reused** across runs (only the Part-3 guest user is deleted via
  `accounts:delete` REST); test
  boards are deleted at start and end of each run (self-cleaning). The single
  "Missing or insufficient permissions" page error from Part 1's fake user is expected noise.
  Run with `node e2e.mjs` from `client/` while `npm run dev` is up. Playwright clicks inside
  React Flow's transform can misfire (rotated post-its especially) — prefer `page.evaluate` JS
  clicks/native value setters over coordinate clicks. Part 3 (facilitator + guest): the suite
  grants the facilitator role to a test user via the Firestore admin REST API (OAuth token from
  firebase-tools), then drives the dashboard (workshop → template → team → seat codes), joins as
  a guest in a fresh context (code → profile modal → team board → own board → team board visible
  in the list), and cleans everything up. **Every admin REST call in the suite must target the
  client's Firebase project** — until 2026-10-15 the facilitator PATCH + guest delete still
  pointed at the legacy `carbondocs` project, which made TF fail deterministically (grant
  invisible to the app) and leaked guest accounts; both are fixed in `e2e.mjs`.
- **UI smoke test:** `client/ui-smoke.mjs` (playwright-core + system Chrome, same pattern as
  `e2e.mjs`) drives the **real dev app** on `localhost:5173` with `/api/generate` mocked at the
  page level (deterministic artifacts, so it needs no Ollama, no GitHub and no Firebase). It covers
  AI change requests in the UI Design box (build → versioned change → diff + revert → incomplete
  and unchanged replies refused) **and** here.now box deploys (UI publish/redeploy/conflict
  refusal, expiry + claim-link toggle, Stitch HTML-only publish). Run `node ui-smoke.mjs` from
  `client/` while `npm run dev` is up (the fake-user Firestore "Missing or insufficient
  permissions" console error is expected noise and filtered; mocks must be re-installed after a
  reload, which is why they live in `installMocks()`). Keep its assertion strings in sync when
  renaming buttons.
- **Marker check:** `client/markers-check.mjs` — fast headless (42-check) verification of **every
  text selector the full suites rely on** plus the chrome (opening zoom ≥115% + 16px body type,
  pipeline strip, status pills, left rail/palette, bottom bar with its undo/redo buttons,
  add-toast Undo, area tool + `▭ Area$`,
  `▶ Run` counting, Boards menu,
  box-card header tint + in-card run-status strip, menu-over-strip stacking). Needs only
  `npm run dev` — no Ollama model call, no Firebase sign-in, no Cloudflare. Run
  `node markers-check.mjs` from `client/` after any chrome restyle, then the full suites; it saves
  a canvas screenshot to the OS temp dir (`relay-restyle.png`) for visual review.
- **Presence probe:** `client/probe-presence.mjs` — self-cleaning sign-in probe for the roster
  path (own presence doc appears immediately on subscribe; cursor writes are checked by moving the
  mouse over the EMPTY pane — never over the help card (closed by default, but it would swallow
  the events if opened), whose events don't reach React Flow). `node probe-presence.mjs` from
  `client/`; deletes the board it creates.
- **T12 sync probe:** `client/probe-t12.mjs` — standalone, self-cleaning repro of the E2E's
  "note edit syncs A → B live" (real sign-in → note → reload → instrumented edit with synchronous
  store checks, deletes its board). `node probe-t12.mjs [delayMs]` from `client/`; delay 0 is the
  race-prone timing the `localDirty` guard must survive. See the "Board save vs. snapshot race"
  convention above.
- **Undo probe:** `client/probe-undo.mjs` — self-cleaning check of Ctrl+Z / Ctrl+Shift+Z / Ctrl+Y
  against the real dev app with the fake user (add → undo → redo, a typing burst undone as one
  step, **Ctrl+Z inside a textarea left to the browser's own text undo**, walking the stack dry,
  board-title rename undone). `node probe-undo.mjs` from `client/`; no Firebase/Ollama needed.
- **E2E environment gotchas:** (1) The firebase-tools access token
  (`~/.config/configstore/firebase-tools.json`) **expires ~hourly**; a stale token makes the
  facilitator PATCH silently 401 → the "TF facilitator button appears after grant" check FAILS.
  Refresh by running any `firebase` CLI command (e.g. `firebase projects:list`) before the suite.
  (2) **Never run the E2E while another session is editing `client/src`** — Vite HMR/full reloads
  mid-run cause scattered, different failures each run (missing buttons, empty outputs,
  `window.__dsh` undefined). Run it in a quiet window (no src writes for ~2 min). (3) Deps used
  only by the suite must be in `client/package.json` — an ad-hoc `npm install` without `--save`
  gets pruned by the next install (that silently removed `playwright-core` once).
  (4) **TG's guest join has no backend in this environment:** `server/.env`'s `WORKSHOP_PROXY_URL`
  points at `us-central1-ai-canva-22-nbn-fee4b.cloudfunctions.net/` — a function that was **never
  deployed** (`firebase functions:list` → none; the original value predates the project migration
  and was `https://carbondocs.web.app/api/workshop/join`, whose tokens are minted for the legacy
  project and can't sign into this app). The local proxy therefore 502s, the guest never gets a
  token, and **"TG guest gets the profile step" fails (30s timeout) by environment, not by code**
  — its landing-card check still passes. Fixing it needs a deployed Admin-SDK join endpoint for
  `ai-canva-22-nbn-fee4b` (stand one up, or deploy the legacy `functions/` path with Blaze) and
  repoint `WORKSHOP_PROXY_URL`; until then expect **100/101**. TF/Guest were previously masked
  entirely by the stale `carbondocs`
  project id in the suite's admin REST calls (fixed in `e2e.mjs` — see the E2E suite bullet).
- **T7 can fail spuriously under model latency:** Part 1's "research generated via real
  /api/generate" check polls at most 90s (45 × 2s) for a REAL model call to land, so a slow
  generation shows up as three failures (`output 0 chars`, `token usage recorded`, `markdown output
  rendered`) while the rest of the suite passes — **re-run before hunting a regression** (observed
  once; the immediate re-run passed in full). Its sibling check `token badge visible` is a weak assertion
  (it searches the whole page text for `tok`), so it can pass while those three fail.
- **UI text markers the E2E clicks by** (keep these EXACT strings when restyling — the suite
  finds buttons by `textContent`, not selectors): header `Boards (` and `New Board` (capital B)
  and `🧑‍🏫 Facilitator`; palette rows keep the box label as the button's trailing text
  (`textContent.trim().endsWith(label)` — a leading icon tile is fine); the help card keeps the
  text `How to use` inside a div whose class includes `rounded-xl`; canvas buttons `▶ Run`,
  `▶ Start`, `⏹ Stop`, and `▭ Area` (exact suffix match when inactive); the landing's inline
  workshop-card `Join workshop` button (`trim() === "Join workshop"`, beside the
  `input[placeholder='CODE']`), and `Join my team`;
  the roster test ids `roster-popover`/`roster-row`/`you-chip`; the idea textarea placeholder
  contains `your idea`; the box footer token text contains `tok`. All were re-verified after the
  enterprise UI makeover (76/75-equivalent behavior — header extraction kept every marker).

## Conventions & gotchas

- **Adding a new box type:** see `docs/BOX_TYPES.md` and `docs/course/05_how_to_build_a_box.md`.
- **New-box placement (no explicit position):** `addBox`/`addCustomBox` called WITHOUT a position
  (palette, canvas-rail Note, custom-box instances) drop the box in the **middle of the visible
  viewport**, then move it to the nearest free box-sized tile around that centre (right first,
  then down) so repeated adds fan out instead of stacking invisibly. Pure logic in
  `client/src/lib/placement.ts` (`viewportCenter`, `placeNewBox`, `coversAnotherBox`,
  unit-tested); `Canvas.tsx` publishes a **reader of the flow-space centre**
  (`uiStore.setViewportCenterReader` / `readViewportCenter` — a function, not a value, so
  pan/zoom never re-renders store subscribers), and `boardStore.defaultBoxPosition()` falls back
  to the old fixed top-left area when no canvas has reported a centre yet (e.g. the seeded
  starter board). Areas never count as collisions (they are background a box may sit on), and
  callers that pass an explicit `position` (agent-loop children, the seeded idea/research pair)
  are unaffected.
- **Undo / redo (Ctrl+Z):** every LOCAL board edit is undoable — `Ctrl/Cmd+Z` (undo),
  `Ctrl+Shift+Z` / `Ctrl+Y` (redo), plus ↶/↷ buttons in `CanvasBar`. Pure logic lives in
  **`client/src/lib/history.ts`** (`boardChangeKind`, `recordHistoryEntry`, `undoFrom`/
  `redoFrom`, `isTransientPatch`; unit-tested in `history.test.ts`); `boardStore.ts` keeps the
  stacks at MODULE level (`history` + `historyBaseline`, alongside `localDirty`) and exposes only
  derived `canUndo`/`canRedo` flags that `CanvasBar` subscribes to, so steps never re-render the
  tree. Sharp edges, all deliberate:
  - **Snapshot steps:** each step stores references to `{nodes, edges, boxData, boardTitle}` — the
    store is immutable, so keeping 50 steps costs nothing but references.
  - **`scheduleSave()` is the ONE recording funnel:** every local edit calls it, remote snapshots
    and presence sets never do, so a collaborator's change is never recorded as your step.
    `captureHistory()` takes the pre-edit snapshot there and classifies it (`topology` / `node` /
    `data` / `title`; a selection-only change is ignored).
  - **Coalescing:** same-kind edits within 800ms collapse into ONE step (typing burst, node
    drag) — except `topology`, where every added/removed box stays its own step.
  - **Runs are not steps of their own:** an `updateBoxData` patch touching only
    `status`/`error`/`ranAt`/`tokens` is marked transient (`isTransientPatch`) and folded into the
    step of the content change, so undoing a run takes the box back to "not run" instead of
    stranding it mid-run.
  - **Board-scoped and in-memory:** `resetHistory()` drops it on every board load / create /
    clear / delete and on `unsubscribeFromBoard`; it is never persisted (empty after reload), and
    undo steps never cross boards. Applying a step goes through `applyHistorySnapshot`
    (`historySuspended` so the restore isn't recorded) and then saves like any other edit.
  - **Editable fields keep their own undo:** the global keydown handler in `CanvasBar` ignores
    `input`/`textarea`/`select`/`[contenteditable]`/`.cm-editor` targets, so native text undo
    keeps working while typing. Behaviour is verified by `client/probe-undo.mjs`.
- **Agent box (🤖, first worker in the palette):** users type a task and Run — the LLM acts as an
  autonomous controller that manipulates the BOARD: each controller turn returns exactly ONE JSON
  action (`add_box` / `connect` / `run_box` / `finish`), executed with the regular store actions,
  so the boxes an agent creates are ordinary boxes everyone can edit afterwards. Loop lives in
  `boardStore.ts` (`runAgentLoop`, invoked from the `boxType === "agent"` branch of `runBox` — it
  manages its own status/inputs and bypasses the shared gathering); protocol/inventory/layout in
  `client/src/lib/agent.ts` (pure, unit-tested; `AGENT_CREATABLE_TYPES` whitelist = idea research
  summarise prd slides ui — never image/documents/cartoon/stitch/agent); UI (task
  textarea + live `agentSteps` timeline + ⏹ Stop so the loop halts between turns) in `BoxNode.tsx`.
  Running a box from the agent is a plain `await runBox(boxId)` — the target box's status/output is
  read back after. Budget: `MAX_AGENT_TURNS` (12) with a forced wrap-up on the last turn; 2
  consecutive unparseable replies are coached then the raw reply is salvaged as the answer, so a
  weak model degrades to "honest free text" instead of hanging. Stop is cooperative:
  `agentCancelled` module Set checked before each turn — an in-flight LLM call/run always
  completes. Steps persist in `boxData.agentSteps` (Firestore-safe: no `undefined` values —
  `detail`/`boxId` optional only when present). Token accounting reuses the standard ledger with
  `boxType: "agent"` (cumulative on the box). Multiplayer: another client sees the log grow via
  snapshots but a mid-run reload of the runner just stops the loop (run-like other boxes).
- **Collaboration boxes (note / label / timer / checklist) are standalone:** category `"collab"`,
  `hasAI: false`, and no connection handles, no Run button, no ⚙ panel — gate all of those in
  `BoxNode.tsx` on `!isUtility` and keep the `runBox` early-return guard in `boardStore.ts`. The
  generic text-output block and its "No output yet. Click Run" placeholder are gated on
  `!isUtility` too (a collab box produces no output — it used to render that placeholder under the
  timer). **Note and label render as annotations, not box cards:** BoxNode early-returns custom JSX
  for them (post-it paper `.note-node` / floating chip `.label-node`, styles in
  `client/src/index.css`, hover/selected ✕ delete instead of the header ✕). The timer and the
  **checklist** are the only collab boxes that still use the standard card. Early returns sit after
  all hooks — keep every hook above them.
  **Checklist box (✅ `checklist`) — the team's shared to-do list:** `boxData.checklistItems` is an
  array of `ChecklistItem` (id/text/done/assignee/createdBy/createdAt/doneBy/doneAt — **all fields
  always defined**, per the Firestore rule), created empty-but-defined in `defaultBoxData`, synced
  to everyone through the normal board save (last-write-wins, like a Note). **All rules are pure
  functions in `client/src/lib/checklist.ts`** (`appendChecklistItems` + `parseChecklistLines` —
  pasting a Markdown/bulleted multi-line list appends every line and keeps `- [x]`; `toggleChecklistItem`
  records who ticked it and when; `setChecklistItemAssignee`/`setChecklistItemText`/`moveChecklistItem`/
  `removeChecklistItem`/`clearDoneChecklistItems`; `checklistStats`, `checklistToMarkdown`,
  `normalizeChecklist` repairing old board data; caps `MAX_CHECKLIST_ITEMS` 200 / 500 chars per task so
  the board doc stays under Firestore's 1MB limit) — unit-tested in `checklist.test.ts`. The store
  exposes exactly ONE action, `setChecklistItems(id, items)`, which **skips the write when nothing
  changed** (reference-identical list); `components/ChecklistPanel.tsx` (rendered from BoxNode's body)
  owns its own store subscriptions — never subscribe BoxNode to `collaborators`/`activeUsers` (that
  would re-render every box on the canvas on each presence snapshot). Mutators return the same array
  when the edit is a no-op, so no-op interactions never dirty the board. It is **not** in
  `AGENT_CREATABLE_TYPES` (locked by a unit test).
  **Timer sync rule:** only state *transitions* (start/pause/resume/stop/reset) write to the
  store; the countdown display is always derived locally from `timerStartedAt`/`timerRemainingMs`
  (see `client/src/lib/timer.ts`) on a per-box 250ms interval — **never write per tick** or the
  save/snapshot machinery will flood. **Editor surfaces inside nodes** (the note textarea, label
  input, idea textarea, checklist inputs) must carry the `nodrag` (+ `nowheel` where scrollable)
  class or React Flow drags the node while the user types. **Canvas zoom vs. box scroll:** the
  `<ReactFlow>`
  in `Canvas.tsx` sets `noWheelClassName="react-flow__node"`, so React Flow treats every node as a
  no-wheel zone — trackpad scroll/pinch over a box never zooms the canvas (it would fight the
  box's own scrolling); zooming still works over empty canvas space. Keep this prop if you add
  scrollable surfaces inside nodes.
- **Board save vs. snapshot race (`localDirty`):** `boardStore.ts` keeps a module-level
  `localDirty` + `localEditGen` pair — `scheduleSave()` marks state dirty, and
  `saveToFirestore()` clears it only when no newer edit superseded the write it captured (one
  `saveTimestamp` feeds BOTH the doc's `updatedAt` and `lastSavedUpdatedAt`, so `isEcho` matches
  the optimistic pre-ack snapshot instead of missing by a `Date.now()` delta). While dirty,
  remote `onSnapshot` updates are NOT applied, and `loadBoardFromFirestore` does NOT apply its
  fetched doc when the fetched id is the *current* board (board switches still apply) —
  otherwise a late snapshot or the post-reload `getDoc` landing inside the 1s debounce reverts
  just-typed content and the queued save then persists the reverted state on every client
  (this silently broke E2E T12's note A→B sync twice before the guard existed). Diagnose with
  **`client/probe-t12.mjs`** — a self-cleaning standalone T12 repro with synchronous
  instrumentation (`node probe-t12.mjs [delayMs]`; 0 reproduces the old failure, edits after
  reload must survive).
- **Run input gates (refuse before the model call):** `runInputBlocker(boxType, nodes, edges,
  boxData, id)` in `client/src/lib/inputs.ts` returns `null` (may run) or a user-facing reason,
  and `runBox` applies it BEFORE any model call (sets `status: "error"` with the reason and
  returns; no token spent, the box never flips to "running"). Rules: **Alignment Check** needs
  two distinct connected upstream boxes that both contribute content (`alignmentRunBlocker`,
  `skipSelf` — the box's own `content` never counts; its prompt relies on `{{input_1}}` /
  `{{input_2}}`, which is why an un-run upstream must not slip through); **Cartoon Profile,
  Handoff Brief, Jargon Translator, Slides** need ≥1 connected upstream box with content
  (`UPSTREAM_INPUT_BOXES`, each with a per-type "connect …" hint in the message); **UI Design,
  Stitch UI** need a typed description (`content`) or one connected upstream box with content
  (their own text counts — no `skipSelf`); **Agent** needs a typed task (`boxData.content`);
  every other box is ungated (stock prompts are designed to run standalone). **Handoff Brief**
  has one extra rule outside `runInputBlocker` (so its Run button stays clickable): both `From`
  and `To` roles are required. `checkHandoffRoles` in `lib/inputs.ts` reports which fields are
  empty; a direct Run click highlights them red, focuses the first empty one and refuses to
  start, while `runBox` applies the same check for other callers (Run all) and shows the reason
  as the box error. `BoxNode.tsx`
  mirrors the rules (`runGateReason` → `disabled` + `title` tooltip on ▶ Run — "Connect two
  upstream boxes first" / "Connect an upstream box first" / "Type a description or connect an
  input" / "Type a task first"; alignment body shows "n of 2 connected", agent body shows the
  store error) but only counts connections — the store stays authoritative because a box UI
  never subscribes to other boxes' data. Documents and Image boxes are deliberately ungated:
  they have no Run button at all (their upload already gates downstream use). Unit-tested in
  `inputs.test.ts` (`alignmentRunBlocker` + `runInputBlocker`).
- **Run status strip ("Not run yet" → "Ran at <date, time>"):** every run-able box (worker +
  custom — the same set that gets the ▶ Run footer, gated on `!isInputBox && !isUtility`;
  inputs and collab boxes never show it) renders a thin strip above the token row in
  `BoxNode.tsx`: slate italic "Not run yet", indigo "Running…" mid-run, then a dot +
  "Ran at 3/10/2026, 14:32". The label is the pure `runStatusLabel(ranAt, hasRun)` in
  `client/src/lib/runStatus.ts` (unit-tested); `runBox` and `runAgentLoop` stamp
  `BoxData.ranAt` in their **`finally`**, so every *attempted* run counts (failed runs show
  the time next to the red error) while gate refusals — which return before the `try` —
  never stamp. While a run is in flight the **footer additionally shows an indeterminate
  progress bar** (`.run-progress` in `index.css`: a 3px slate track with a sweeping
  35%-wide segment in the box's own color, positioned against the footer's Tailwind
  `relative`, rendered only while `status === "running"` and `aria-hidden` because the
  strip already says "Running…"). Model calls expose no measurable percentage, so the bar
  animates instead of faking one, and it is absolutely positioned so it causes no layout
  shift. The Handoff Brief's "Generated:" and Alignment Check's "Ran:" banner labels
  were removed in favour of the strip: it falls back to legacy `handoffGeneratedAt` /
  `alignmentRanAt`, and a `status: "done"` box with no timestamp at all renders a bare "Ran"
  (its date predates the field). Once the box holds AI content (output / generated image / slides
  / code — `hasAiOutput`) the same strip carries the standing disclosure tag **"AI-generated,
  verify before acting"** (`.ai-disclosure` in `index.css`, amber pill, right-aligned via `ml-auto`);
  it is withheld while a run is in flight and before the first output.
- **Role filter (palette profiles):** each box type carries `roles: BoxRole[]`
  (`everyone`/`designer`/`developer`/`product` — `BoxRole` in `types/core.ts`, the tags on each
  box in `types/boxes/`); the View dropdown in
  `Sidebar.tsx` filters which boxes appear in the "Add Box" palette (the selectable profiles live in
  the `ROLES` list there — extend it AND the `localStorage` whitelist check when adding one, or the
  saved profile silently resets on reload). This is a discovery-only label — a pure UI filter, never
  a permission. Add sensible `roles` tags when adding a box; see `docs/BOX_TYPES.md`.
- **NBN cross-functional boxes (📦 Handoff Brief / ✅ Alignment Check / 🔁 Jargon Translator —
  types `handoff`/`alignment`/`jargon`, their own **"NBN" palette section directly below
  Inputs**, though they keep `category: "worker"` for pipeline/landing purposes):** generic
  text-AI boxes (they fall through `runBox`'s else
  branch) that each render a **metadata banner** above the markdown output via their own block in
  `BoxNode.tsx` (each excluded from the generic text block's guard). Shared pieces: the
  banner's **`Source:`** label is `connectedSourceLabel()` (module-level in `BoxNode.tsx`) —
  first connected upstream box, or the uploaded filename when that box is a Documents box; run-time
  metadata lands in `BoxData` (`handoffGeneratedAt`/`alignmentRanAt`/`jargonTerms`)
  written by the text branch of `runBox`. Handoff's From/To are editable inputs
  (`nodrag`) and **both are required before Run** — a click with either empty marks the empty
  input(s) red (`aria-invalid`, red ring/background), focuses the first one and does not start
  the run (`checkHandoffRoles` in `lib/inputs.ts`; the store re-checks for Run all); Alignment's
  Artefact 1/2 and Jargon's Source are inferred from edges —
  never stored. **Handoff review:** once the box is `done` with output, a shared
  `ReviewerChip` (`components/ui/ReviewerChip.tsx`, also used by the landing page's "How it
  works") sits beside the floating Done pill. It starts as a clickable **Review** chip; any
  collaborator can click it (review is a click toggle, not an edit), which stores
  `reviewedBy` + `reviewedAt` via the `reviewHandoff` store action and swaps the chip to
  "Reviewed by <name> · <time>". Clicking that reviewed chip again clears both fields and
  returns the **Review** action. `boxStatus` then reports **`Done, reviewed`**, so the pipeline
  strip reads **`Handoff Brief · Done, reviewed`**. A re-run also clears both fields — a new
  brief must be reviewed again. `jargonTerms` counts numbered items **only under the `## Terms Simplified`
  heading** so a numbered source list copied into the translated artefact can't inflate it. The
  help card's bottom tips cover these three NBN boxes (replacing the old Cartoon/Slides/Code
  tips). None of the three is in `AGENT_CREATABLE_TYPES`. (A Decision Log box existed earlier
  and was removed — don't reintroduce `"decision"`/`decisionCount` references.)
- **AI change requests in the UI Design box:** once `boxData.code` exists, the box shows a
  **"Request a change…"** field + **✏️ Apply change** (`CodeChangePanel.tsx`), backed by the
  `applyChangeRequest` store action. The model rewrites the WHOLE component (the only reliable way to
  ask for a code edit) under the non-editable `CODE_CHANGE_PROMPT` rules (return the complete file,
  keep everything the request does not mention byte-identical, no reformatting/renaming, no dropped
  features) — that template is deliberately fixed because its rules are the safeguard. Guards:
  `isCompletePrototype` (must still define App **and** mount it) and "no change" detection, so an
  incomplete or identical reply never replaces working code (`setBoxStatus(id, "error", …)` keeps the
  old code). Versions: **every** build and change appends to `boxData.codeVersions` via the shared
  `appendVersion` (`lib/code.ts`, the `ArtifactVersion` record), with `codeVersion` pointing at the
  current one; `revertCodeVersion` restores an old version **as a new version**, so history stays
  append-only. The panel shows `vN · +added −removed vs vN-1`, a 🔀 diff (reusing
  `computeLineDiff`/`lineDiff` from `lib/diff.ts`) and a 🕘 history with 👁 view + ↩ Revert. An
  upstream box's output may supply the request — read with `skipSelf: true` so the box's own build
  description is not mistaken for a change request. Stitch boxes are excluded: their `code` is HTML
  from another provider.
- **Box deploys to here.now (🚀 Deploy):** **UI Design** and **Stitch UI** boxes can publish their
  code to a live `https://{slug}.here.now/` Site. The browser never holds a
  credential — `POST /api/herenow-deploy` (route in both backends, logic in the duplicated
  `server/src/herenow.ts` + `functions/src/herenow.ts`) runs here.now's three-step flow
  (**create → PUT to presigned targets → finalize**; a Site is NOT live until finalize succeeds).
  What each box publishes comes from **`client/src/lib/deploy.ts`** (`deployFilesFor`): UI →
  `index.html` (the CDN-wrapped page the box previews) + `App.jsx`; Stitch → its HTML as-is. The run path
  is the `deployBox` store action; UI is `components/DeployPanel.tsx` (the 🌐 Live site strip with the
  live link, expiry, 🔑 claim toggle, warnings and errors) plus a footer button. Invariants:
  site-relative paths only and **`.herenow/` refused** (those are here.now config manifests — a
  generated box must never ship server-side config); caps 400 files / 8 MB per file / 25 MB total,
  mirrored client-side so the UI refuses early; **redeploys send `slug` + `baseVersionId` (+ the
  claim token)**, so a Site changed elsewhere is refused with a message naming the live version
  rather than clobbered; and because here.now returns the claim token **exactly once**, the box keeps
  it in `boxData.deploy` (all fields always defined) — an update response that omits it must not
  erase the stored one. Without `HERENOW_API_KEY` Sites are anonymous (**24h expiry**); with it they
  are permanent. `/api/health` reports `herenowKey`. Docs: `docs/API.md` (endpoint), `docs/BOX_TYPES.md`
  ("Deploying a box"). The here.now *skill* is installed at `~/.agents/skills/here-now` (a root DSH
  reads); its rule that `curl https://here.now/docs` returns a markdown summary — not the full HTML —
  is why the real contract came from `https://here.now/openapi.json`.
- **Downloading a box's outcome:** `client/src/lib/download.ts` (`outcomeText`, `outcomeFilename`,
  `slugifyFilename` pure + `downloadText` DOM) backs the `💾 Save` button in the box footer for every
  text-output box (research, summarise, prd, custom, agent, slides,
  and the NBN trio handoff/alignment/jargon — added 2026-10-17; a text box with generated
  markdown belongs in `hasDownloadableOutcome`, which is the button's only type gate).
  Filenames: the type's name otherwise (`research.md`, `summary.md`, `prd.md`,
  `handoff-brief.md`, …), and the
  slugified label for custom boxes. Slides download as a Markdown deck built from `slides[]`. The
  file is the artifact text only — version history lives in the box's own 🕘 panel (where present)
  — and every download ends with an italic disclosure on its own paragraph
  (`*This output was generated by AI.*`, constant `AI_GENERATED_NOTE` in `outcomeText`, so a file
  that leaves the app self-identifies; no content → no note and no button).
  UI/Stitch keep their own 💾 Save (HTML) and Cartoon its image download;
  Idea/Image/Documents/Note/Label/Timer/Checklist have no text outcome.
- **Documents box (📎, input category):** multi-file upload (click or drag & drop) whose extracted
  text becomes the box's output for downstream prompts. All logic lives in
  `client/src/lib/documents.ts` (unit-tested): txt/md/csv/json are read as text directly; **PDF**
  uses `pdfjs-dist` and **DOCX** uses `mammoth`, both **lazy-imported** so neither (~0.5MB each)
  touches the main bundle until that file type is uploaded. pdf.js's worker is loaded via
  `import("pdfjs-dist/build/pdf.worker.min.mjs?url")` — that needs `client/src/vite-env.d.ts`
  (`/// <reference types="vite/client" />`) for TS and works in both dev and build. **Budgets:**
  extracted text is capped at 100k chars per document and 400k chars per box (`clampDocText` /
  `remainingDocBudget`) so the board doc stays under Firestore's 1MB limit; entries that fail
  extraction are kept with an `error` message instead of being dropped. **`BoxDocument` fields are
  always defined** (no `undefined`) — Firestore rejects `undefined` nested anywhere in a value.
  The raw file is uploaded best-effort to **Cloudflare R2** at `boards/{boardId}/documents/{boxId}/…`
  (`uploadDocumentToStorage` → signed PUT via `POST /api/storage/sign`);
  the extracted text always lives in `boxData.documents`, so prompts, persistence, and cross-user
  sync work even when the upload fails (signed-out local mode). Downstream integration is one line
  in `runBox`: a source box with documents contributes `buildDocumentsOutput()` (each doc labeled
  `=== filename ===`) instead of `getBoxOutput()` — reference with `{{inputs}}`, `{{Box Name}}`, or
  `{{input_N}}` like any input. The E2E "TD" tests cover the flow, using a page-level fetch
  intercept of `/api/generate` to assert the labeled doc text reaches the connected box's prompt
  deterministically (mocked response — restore `window.fetch` afterwards so later tests hit the
  real API).
- **Landing page:** the logged-out entry is a full marketing page in
  `client/src/components/landing/` (`LandingPage.tsx` composes `LandingNav`, `LandingHero`,
  `LandingWorkshop`, `LandingValue`, `LandingHowItWorks`, `LandingFeatures` (the "AI drafts. A
  person decides." panel), `LandingBoxes`, `LandingRoles`, `LandingCTA`, `LandingFooter`). It has
  **light + dark themes**: `useTheme.ts` follows `prefers-color-scheme` by default and the nav's
  ☀️/🌙 toggle overrides it (persisted in `localStorage["landing-theme"]`), applying the `dark`
  class on the landing root — hence `darkMode: "class"` in `tailwind.config.js` (scoped to the
  landing; the app chrome stays light-only). `.landing-bg` is the only landing-specific class left
  in `index.css` (page background + the `.fade-in`/`.reveal`/`.float` animation primitives;
  `.glass-card`/`.gradient-text`/`.pipeline-arrow` were removed with the redesign). It reuses
  `BOX_TYPES` for the box showcase (all built-in types, with All/Input/Workers/Collaborate filter
  pills; the `custom` runtime type is excluded), uses a `Reveal` scroll-fade wrapper
  (`useReveal.ts`). `App.tsx` renders it when `!user` and passes the **guest workshop join state**
  down: the seat-code card is now inline in `LandingWorkshop` (`#workshop`), replacing the old
  floating "🎟️ Have a workshop code?" pill + modal; `?code=XXXX` in the URL prefills the card and
  scrolls to it, while App keeps owning the join handlers (they flip `user` on success). Two
  **data/compliance texts** live in the landing: `LandingFeatures`' bottom banner is the
  data-safety notice ("Only add synthetic or de-identified material. Never upload customer,
  service, account or network details to any box." + a "Read the input rules" link that opens the
  same `InputRulesPanel` used by the pipeline strip), and `LandingFooter` carries the
  **Acknowledgement of Country** (in the brand-blurb slot) plus the disclaimer line
  "relay for nbn® is a capstone prototype. It isn't an official nbn product." (in the old
  ©-line slot) — keep these exact strings when restyling.
- **Code editor:** the UI Design / Stitch boxes use an editable CodeMirror 6 editor
  (`client/src/components/CodeEditor.tsx`, `@uiw/react-codemirror` + `@codemirror/lang-javascript`
  + `@uiw/codemirror-theme-vscode`). It is **lazy-loaded** via `React.lazy` in `BoxNode.tsx` so
  CodeMirror (~500KB) is only fetched when a code box's Code tab opens. Edits call
  `updateBoxData(id, { code })` (Firestore save is already debounced 1s in `boardStore.ts`), so
  edits persist and the iframe preview reflects them live. A **⛶ Maximise** button on code boxes
  opens `client/src/components/CodeModal.tsx` — a full-screen split view (editable code left, live
  preview right) rendered via `createPortal` to `document.body` so it escapes React Flow's
  transformed node container. Both `CodeEditor` and `CodeModal` are lazy-loaded.
- **Real-project preview (UI box):** the `ui` box previews its generated code in a lightweight
  CDN iframe — `wrapUIInHtml` (`lib/code.ts`) wraps the JSX with React 18 UMD + Babel standalone +
  Tailwind CDN and posts `preview-ready` when it boots (stitch boxes render their raw HTML as-is);
  BoxNode/CodeModal's `srcDoc` renders it directly. `client/src/lib/project.ts` turns the single
  generated JSX into a multi-file Vite React project for **StackBlitz**: `toReactProject` (used by
  `toStackBlitzProject`) strips the `ReactDOM.createRoot` render call and adds a React import, and
  an **⚡ Open in StackBlitz** button (`@stackblitz/sdk`, `sdk.openProject`) opens the same project
  in a full IDE. `project.ts` is unit-tested in `client/src/lib/project.test.ts`. StackBlitz note:
  `toReactProject` must use **non-leading-slash** file paths (`"App.jsx"`, `"index.jsx"`, …)
  because WebContainers throws `path should be a path.relative()'d string, but got "/"` on
  leading-slash keys, which made StackBlitz open blank (code never imported).
  `CodeModal` additionally debounces the code it feeds the preview (~400ms) so typing doesn't
  re-bundle per keystroke. The preview-loading overlay in BoxNode applies to the iframe-based
  ui/stitch previews (they post "preview-ready").
- **UI box: generated code MUST end up with a default export.** The box's system prompt makes the
  model "define a component called App" but never asks for an `export`. If the generated App file
  has no default export, the StackBlitz entry's `import App from "./App"` resolves to `undefined`,
  and React reports **"Element type is invalid ... mixed up default and named imports"**.
  `ensureDefaultExport()` in `client/src/lib/project.ts` appends `export default App;` (deduped)
  in `toReactProject` so the project always resolves. Keep that guarantee when changing the
  transform.
- **Areas (drawn rectangles):** the "▭ Area" tool (floating top-left in `Canvas.tsx`) lets users
  drag a rectangle on empty canvas to create a background grouping region. Areas are React Flow
  nodes of type `"area"` (`AreaNode.tsx`, registered in `Canvas.tsx` nodeTypes) with **`zIndex: -1`
  so they render BELOW all boxes** (React Flow honors per-node zIndex; the selected node is
  elevated +1000, so a selected area's color dots stay reachable). They live in the `nodes` array
  (color in `node.data.fill/border`) — persistence and cross-user sync come free via the normal
  board save/snapshot; `deleteBox(id)` deletes them (no boxData entry). While the tool is active,
  `panOnDrag`/`nodesDraggable` are off and drags on `.react-flow__pane` become a draft rectangle
  (`lib/areas.ts` `normalizeRect`/`isValidAreaSize`, unit-tested; drags <24 units are ignored).
  The palette (`AREA_COLORS` in `types/core.ts`) is intentionally **very light** (Tailwind -100 fills,
  -200/-300 borders) so areas never compete with boxes on top; the minimap shows areas in their
  border shade. `noWheelClassName="react-flow__node"` covers area nodes too — scroll over an area
  zooms the canvas as over any node.
- **Stale React Flow modifier / selection latch:** React Flow tracks its Shift / Ctrl / Cmd
  selection keys with window `keydown`/`keyup` listeners. OS and browser shortcuts
  (**Win+Shift+S** Snipping Tool, **Cmd+Shift+5** macOS screenshot) can swallow the matching
  `keyup`, leaving selection mode latched: pane drags draw a selection box instead of panning and
  boxes/resizing stop responding until the user presses Shift again or switches tabs. `Canvas.tsx`
  reconciles the latched keys against the real modifier flags on every pointer event and
  synthesizes the missing `keyup` (pure `staleModifierKeys` in `lib/modifiers.ts`, unit-tested), so
  a real Shift-drag still works while a stale one is released before the next drag. The same effect
  clears a marquee/`paneDragging` left over from a `pointerup` outside the pane, and resets on
  window blur / hidden tab. Regression check lives in `markers-check` ("stale Shift clears before
  the next drag" + "real Shift still draws a selection box").
- **Touch / tablet (iPad) support:** everything touch-related is scoped to `@media (pointer: coarse)`
  in `client/src/index.css` — desktop is byte-for-byte unchanged. When adding UI, keep it that way:
  - **Hover-gated controls need `.touch-visible`** (opacity forced to 1 on coarse pointers) — used by
    the Documents-file ✕ (BoxNode) and the Sidebar custom-template ✕. Note/label/box delete
    ✕s are always visible + 30px on touch via their own classes.
  - **Touch-target classes:** `.box-footer button`, `.slide-nav`, `.timer-controls button`,
    `.checklist-check` / `.checklist-row-actions button` / `.checklist-assign` /
    `.checklist-add-*`, `.area-color-dot`/`.label-color-dot`, `.palette-row`,
    `.rail-btn` (46px min-height), `.bar-zoom-btn` (36px), `.area-color-swatch` (30px),
    `.help-anchor`, `.app-bar button/input`. React Flow connection handles are forced to 18px with
    `!important` (BoxNode sets 10px inline), resize handles 20px.
  - **Box bodies scroll on touch:** the standard box-card body wrapper is `box-body nodrag` +
    `touch-action: pan-y` (coarse only) so a finger scrolls long output instead of dragging the
    node. Side effect on desktop too: boxes are dragged by their header strip (consistent with the
    idea-textarea `nodrag` convention).
  - **Canvas:** empty-canvas **double-click / double-tap zooms in** ×1.6 toward the pointer via
    the app's own `onDoubleClick` on `<ReactFlow>` (`Canvas.tsx`) — target checks exclude every
    node except an Area, `button/input/textarea/select/a`, and the Minimap/CanvasBar/panels; it is
    also inert while the Area tool is active. React Flow's `zoomOnDoubleClick` deliberately stays
    `false`: its d3 listener is attached to the renderer (so it fires from inside boxes) and on
    touch screens it bypasses the event filter entirely. Canvas raises React Flow's default
    `maxZoom` from 2 to **2.5**, so repeated double-clicks clamp there. The Area tool has a native
    `touchstart`/`touchmove`/`touchend` mirror on `.react-flow__pane` (iPads never fire the
    synthesized mousedown — React Flow's touch handlers suppress it); presence cursors update via
    ReactFlow `onTouchMove`.
  - **Page level:** `index.html` viewport is `viewport-fit=cover, maximum-scale=1, user-scalable=no`
    plus apple/web-app metas (Add-to-Home-Screen = chrome-less kiosk); `.app-bar` pads with
    `env(safe-area-inset-*)`; root uses `100dvh`; `overscroll-behavior: none`; global
    `touch-action: manipulation` on buttons kills double-tap zoom; `body` is `user-select: none` on
    coarse pointers with `input`/`textarea`/`.markdown-output`/CodeMirror re-enabled.
  - Verified with the full E2E (desktop viewport; latest score in `docs/DEVLOG.md`) — keep the
    suite green when extending.
- **Custom boxes (user-created templates):** users create reusable AI box templates ("✨ New
  Custom Box" in the sidebar) — name, emoji, color, prompt template, system prompt. Definitions
  are saved per-user at `users/{uid}/boxes/{boxId}` (owner-only rules; `userBoxesStore.ts` loads
  them on login, `lib/customBoxes.ts` holds the pure validation/normalization, unit-tested).
  **Instantiation copies, not references:** `addCustomBox(def)` in `boardStore` creates a
  `custom`-type node whose `data.customLabel/customIcon/customColor` and `boxData.prompt/
  systemPrompt` are copied from the definition — so deleting a saved template never affects boxes
  already on boards, and runBox falls through to the normal text-AI branch (no special casing).
  BoxNode merges the static `BOX_TYPES.custom` fallback with the per-node overrides; the Sidebar
  excludes the static `custom` entry from the palette and renders the user's definitions instead.
  Firestore rules for the `boxes` subcollection live under `match /users/{uid}/boxes/{boxId}` —
  remember to deploy rules (`firebase deploy --only firestore:rules`) when they change; the E2E
  writes were denied until the rules were live.
- **Workshops / facilitator / guests:** `facilitators/{uid}` marker docs mirror `admins/{uid}`
  (self-read only; granted via `POST /api/admin/roles`, admin-only, functions — 501 locally).
  The Facilitator Dashboard (`FacilitatorBoard.tsx`, header button for admins+facilitators) has
  Templates / Workshops / Teams tabs: templates are ordinary boards flagged `isTemplate`
  (`listBoards` excludes them from the regular board list), workshops live at `workshops/{id}`,
  and a team is created by COPYING a template board (`buildTeamBoard` in `lib/workshop.ts`) with
  `{workshopId, boardId, facilitatorUid, maxMembers: 5}` at `teams/{id}`. Seat codes live at the
  **top-level `codes/{code}`** (`{code, teamId, workshopId, uid?, claimed?}`) — top level so the
  join endpoint fetches by id with NO query/index (a collection-group query would need an index
  you cannot create without the console). **Guests:** the landing shows "🎟️ Have a workshop
  code?" → `POST /api/workshop/join { code }` (Admin SDK required) mints a Firebase **custom token**
  for a durable uid — first use creates the auth user and claims the code, later uses return a
  token for the SAME uid (codes are effectively bearer credentials), so guests keep their
  identity/boards across devices. Guests then pick a name (email optional, never for login) via
  `GuestProfileModal`, get added to the team board via `memberUids` (new BoardDoc field;
  `listSharedBoards(email, uid)` merges the email and memberUids queries), and can create their
  own boards (guests skip the auto-"My First Board" creation — no auth email). The `server/` API
  (local and Render) PROXIES `/api/workshop/join` to `WORKSHOP_PROXY_URL` when configured
  (Admin SDK needed); otherwise it returns `501`. **Critical
  IAM gotcha:** custom-token minting failed with `iam.serviceAccounts.signBlob` denied until the
  project granted `roles/iam.serviceAccountTokenCreator` to the functions runtime service accounts
  (done once via `cloudresourcemanager setIamPolicy`; `saveBoard` must also carry
  `isTemplate`/`teamId`/`memberUids` or template flags are silently dropped).
- **Presence & the board roster:** `boards/{id}/presence/{uid}` docs power live cursors
  (`Cursors.tsx`) and the header roster (`PresenceRoster.tsx`). Cursor moves are throttled to one
  write per 200ms; presence is written **immediately when `subscribeToBoardUpdates` runs**, and a
  **heartbeat re-stamps `lastActive` every 15s** while a
  board is open (heartbeat cleared in `unsubscribeFromBoard`) so users
  who are online but idle stay listed — `subscribeToPresence` filters out entries stale for >30s,
  so without the heartbeat idle users would vanish from the roster. The immediate stamp matters:
  the cursor path only fires on real mouse movement (an idle/headless user may never move over
  the pane — note events over the help card/palette/chrome never reach React Flow's wrapper), and
  15s was long enough that a roster check could run before the first tick (E2E run #3 failed
  exactly there). Heartbeat-only users carry
  `hasCursor: false` (PresenceUser) and `Cursors.tsx` skips them, so no stray cursor renders at
  (0,0). The roster popover (`PresenceRoster.tsx`, test ids `roster-popover`/`roster-row`/
  `you-chip`) shows online users (with a "you" marker) plus board collaborators who are offline —
  grouping logic is the pure `groupRoster()` in `client/src/lib/presence.ts` (unit-tested).
- **Client Firebase config** lives in `client/src/lib/firebase.ts` (hardcoded `firebaseConfig`).
  For open hosting, prefer `VITE_FIREBASE_*` env vars at build time (see `docs/OSS_READINESS.md`).
- **Deploying:** follow `docs/DEPLOYMENT.md`. Current production is **API on Render**
  (`render.yaml`, root `server/`) + **client on Firebase Hosting** via
  `scripts/deploy-hosting.sh <render-url>` (embeds `VITE_API_BASE`; no Cloud Functions / Blaze).
  The Firebase Functions path (`scripts/deploy.sh`) requires Blaze and is legacy/optional. Also
  the `ai-canva-deploy` skill (`.dsh/skills/ai-canva-deploy/SKILL.md`). Requires Firebase CLI
  logged in and real API keys (Ollama, optionally fal.ai + Google Stitch).
- **Keep `server/` and `functions/` API logic in sync** — they are intentionally duplicated, but
  only `server/` is deployed.

## dsh GUI plugins

`dsh-plugins/` hosts out-of-tree plugins for the **DeepSeek Harness Web GUI** (the harness this
agent runs in — `dsh web`, profile at `~/.dsh/profiles/web`). These are NOT part of the relay
app; the directory just lives in this repo so the plugins stay under version control.

- **`dsh-plugins/session-monitor/`** — floating **Sessions Monitor** window (contributed into the
  harness's additive `shell.overlay` slot): live list of every open session with pulsing blue dots
  + sweeping underlines for running sessions (subagent sessions included, grouped under their
  parent — the sidebar hides those), amber pulsing dots for sessions blocked on the user
  (approval / plan review / question), green pop-in for finished-but-unopened sessions, todo
  progress bars, a completion chime + attention sound (Web Audio, armed on first click, mutable
  via the header speaker button), collapse to a status pill, and click-to-open navigation.
- **Anatomy of a client plugin** (hand-written, no build step): `package.json` with
  `dsh.client: {platform: "web", inject: [...]}` + `exports["./client"]`; `lib/index.js` = node
  half (empty `apply()` so the row exists in the host Loader); `lib/client.js` = browser bundle in
  the `window.__ModuleLoader__.load({id, factory})` classic-script format, requiring only shell
  externals (`react`, `@deepseek-ai/dsh-client-runtime/client`); zh/en dictionaries registered via
  `ctx.locale.register(<ns>, {zh, en})` and handed to the component as `t` through the slot
  register option `locale: <ns>`.
- **Installation into the web profile** (new plugins need ALL of these):
  1. symlink the package into `~/.dsh/profiles/node_modules/<pkg>` (the hoisted store the profile
     resolves from — `baseUrl` anchors at the profile dir);
  2. add a row to `~/.dsh/profiles/web/cordis.patch.yml` under `- insert:` (`id: ui-session-monitor`,
     `name: dsh-plugin-session-monitor`);
  3. **restart `dsh web`** (the launcher used here is `ollama launch dsh`, which runs
     `dsh web --patch ~/.ollama/launch/dsh/ollama.cordis.yml`) — the client-modules scan caches
     package verdicts, so plugin-set changes only take effect on restart.
- **Verify without booting:** `node scripts/smoke.mjs` from the plugin dir (registers the factory
  like the browser module loader, runs `apply()` against a fake ctx, server-renders with the real
  React from the dsh install).
- **Editing an installed plugin:** `lib/client.js` content edits hot-reload into open browsers via
  the always-on client-plugin reload chain (it stat-polls the served bundle file); a plain page
  refresh also picks it up (`/plugins/<id>/client.js` is served no-cache). Restart is only for
  adding/removing plugins or package.json/`dsh.client` changes.

## Docs to keep in mind

- `docs/DEVLOG.md` — **session journal**: newest-first dated entries of what changed, what's in
  flight, next steps. Read at session start (after this file); append an entry per finished unit
  of work. State lives here, knowledge lives in this file.
- `docs/ARCHITECTURE.md` — deep dive into client, backend, and Firebase layers.
- `docs/API.md` — backend endpoints and environment variables.
- `docs/MODELS.md` — **model registry** (single source of truth): which model serves text / Stitch
  UI / fal.ai images, the env overrides (`OLLAMA_MODEL`, `STITCH_MODEL`), how to switch, and a
  change log — **update it whenever a model changes**.
- `docs/DEPLOYMENT.md` — production deploy steps.
- `docs/course/` — teaching/learning materials (briefs + how-to guides, each also as an HTML
  handout for print/PDF).

## Maintenance rule (IMPORTANT)

**Update this file whenever a feature is implemented or the architecture/conventions change.**
This file is the durable project memory that agents load at the start of every session. When you
add, change, or remove a feature, keep this file in sync in the same change:

- Add/update the box type, endpoint, directory, or command that changed.
- Update the box-type list, architecture notes, or conventions if they changed.
- Keep the "Repository layout" and "Key commands" tables accurate.
- Append a short entry to `docs/DEVLOG.md` (Done / In flight / Next steps).

If a change is too small to warrant a doc update, at least note it here so the knowledge is not
lost. Treat this file as living documentation, not a static snapshot.
