# AI Canva — Project Memory

This file is auto-loaded into the AI agent's context at the start of every session (DeepSeek
Harness reads `AGENTS.md` / `CLAUDE.md` from the project root). It captures durable project
knowledge so it survives across sessions. Keep it current — it is the first thing an agent reads.

**Session bootstrap:** after this file, read `docs/DEVLOG.md` (newest entries first) to pick up
the current in-flight state without re-exploring the codebase. When you finish a unit of work,
append a short entry there — and a new session should be able to cold-start from these two files
alone.

## What this project is

**AI Canva** is a collaborative, AI-powered whiteboard for building visual AI pipelines. Users
place "boxes" on a React Flow canvas, connect them, and run AI prompts that flow content from box
to box — from an Idea, through Research, to PRD / Slides / Code / UI Design / Stitch UI.

- **Client:** React + Vite + React Flow canvas, Zustand store, Tailwind CSS.
- **Backend:** Node/Express for local dev; the same API packaged as a Firebase Cloud Function for
  production.
- **AI providers:** Ollama (LLM text), fal.ai (image generation), Google Stitch (UI screens).
- **Persistence & collaboration:** Firebase — Google Auth, Firestore (boards, presence, live
  cursors). **File blobs (board images/documents) live in Cloudflare R2** (free tier, zero
  egress), signed via `POST /api/storage/sign`. localStorage is an offline cache.

## Repository layout

| Path | Purpose |
|------|---------|
| `client/` | React + Vite frontend. Entry `client/src/`, store at `client/src/store/boardStore.ts`. |
| `server/` | Local Express dev backend (`/api/generate`, `/api/generate-image`, `/api/stitch-generate`, `/api/storage/sign`, `/api/health`). |
| `functions/` | Same API as a Firebase Cloud Function (`onRequest`) for production. Also hosts `src/stitchJobs.ts` (the async Stitch Cloud Task worker). |
| `scripts/deploy.sh` | One-command production deploy (build client, build Functions, deploy Hosting + Functions + rules). |
| `docs/` | Guides: `OVERVIEW`, `ONBOARDING`, `ARCHITECTURE`, `BOX_TYPES`, `API`, `MODELS`, `DEPLOYMENT`, `OSS_READINESS`, plus `docs/course/` teaching materials. `docs/DEVLOG.md` is the session journal (read at session start, append after finishing work). |
| `firebase.json`, `firestore.rules` | Firebase config and security rules (Hosting + Functions + Firestore; file storage is Cloudflare R2, not Firebase Storage). |
| `dsh-plugins/` | Out-of-tree plugins for the DeepSeek Harness Web GUI (not part of the app). See "dsh GUI plugins" below. |

## Key commands

```bash
npm run dev            # run server + client together (concurrently)
npm run dev:server     # local Express backend only
npm run dev:client     # Vite client only
npm run install:all    # npm install in both server/ and client/
npm test               # run server + client unit tests (Vitest)
npm run test:watch    # watch mode for both server and client tests
npm run deploy         # = bash scripts/deploy.sh (Firebase Hosting + Functions — needs Blaze)
# Render path (no Blaze): create Web Service from render.yaml (root server/), then
#   bash scripts/deploy-hosting.sh https://ai-canva-22-nbn.onrender.com
#   (writes client/.env.production for VITE_API_BASE — bash env-prefix does NOT reach Vite on Windows)
```

## Architecture notes

- **Two backends, one API surface.** The API logic is duplicated in `server/` (local Express) and
  `functions/` (Cloud Function) because Cloud Functions runs in the Firebase environment while the
  local server runs in Node. Both use the same SDKs. Keep them in sync when changing endpoints.
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
  Hosting rewrite timeout, so the deployed box previously reported "Request failed" even though the
  screen was created in Stitch. `POST /api/stitch-generate` now returns a `jobId` immediately; the
  client polls `GET /api/stitch-status/:jobId` until the job is `done`/`error`. The client-side
  `generateStitchUI(prompt)` in `client/src/lib/api.ts` hides this (start + poll). Local dev uses an
  in-memory job store in `server/src/app.ts`; production uses Firestore (`stitchJobs/{jobId}`, no
  client access) plus a Cloud Task worker `processStitchJob` in `functions/src/stitchJobs.ts`.
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
  labeled named input** so `{{inputs}}` resolves), the line-diff engine (`diff.ts`), and
  here.now deploy payloads (`deploy.ts`).
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
  `server/.env` (+ `functions/.env` — `scripts/deploy.sh` copies them). Missing config → sign
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
- **18 built-in box types** plus user-created custom boxes: Agent, Idea, Image,
  Documents, Research, Summarise, PRD, Cartoon Profile,
  Slides, UI Design,
  Stitch UI, Handoff Brief, Alignment Check, Jargon Translator, four collaboration boxes (Note, Label,
  Timer, **Checklist**), and the `custom` runtime type (see
  "Custom boxes" below). Categories: `input`, `worker`,
  `collab` (standalone team tools: no AI, no Run, no handles),
  and `custom` (the user's saved templates). See `docs/BOX_TYPES.md`.

## UI design system

The app chrome (header, sidebar, canvas tools) follows a consistent "enterprise but
modern" language, built on two shared primitives:

- **`client/src/components/ui/Button.tsx`** — the only button styling in the chrome.
  Variants: `primary` (indigo-600 — the single loud color, used for Share and the
  area tool's active state), `secondary` (white + 1px slate border — the default),
  `ghost` (transparent, for role-gated views), `danger`; sizes `xs/sm/md`; `active`
  renders the pressed state (dark). Every button gets a keyboard focus ring. Use it
  instead of hand-rolled Tailwind button class strings.
- **`client/src/components/ui/Menu.tsx`** — dropdown primitive (`Menu` + `MenuItem`
  + `MenuDivider`/`MenuLabel`). Closes on outside click + Escape; pass children as
  a function `(close) => …` so items can dismiss the menu after acting. Used by the
  Boards menu and the account menu; the presence roster popover follows the same
  outside-click/Escape contract.

Design rules: one accent (indigo) over slate neutrals; 1px borders + layered soft
shadows (no `border-2`/`shadow-lg` in the chrome); h-14 app bar (`.app-bar`, blurred
white); box cards are `.box-node` (1px type-colored border set inline, indigo
selection ring); `.logo-tile` is the only gradient; `.save-dot` states map
`saveStatus`; thin scrollbars and rounded React Flow controls/minimap styling live
in `client/src/index.css`. Palette rows use a 28×28 icon tile tinted with the box
color at ~12% alpha (`color + "1F"`) instead of the old left border-rail.

**Box sizing & body text:** a new box's size comes from `defaultWidth`/`defaultHeight` in its
`client/src/types/boxes/<type>.ts` file (surfaced through `BOX_TYPES[<type>]` in
`types/boxTypes.ts`; all types scaled ×1.25 rounded-to-10 on 2026-10-03 —
e.g. Idea 400×250, Agent 500×600, Jargon Translator 450×480); **persisted nodes keep their stored
style**, so existing boards only grow when a box is added. Box text is sized centrally in
`index.css`: `.box-node` base 15px, plus the scoped rules `.box-body .markdown-output`
(16px / line-height 1.6 — deliberately more specific than the Tailwind `text-sm` utility so it
wins) and `.box-body textarea` (15px), with markdown headings at 20/18/16 (h1/h2/h3). Prefer
extending those scoped rules over sprinkling `text-xs`/`text-sm` onto body content.

**`components/Header.tsx` owns its store subscriptions** (boardTitle, saveStatus,
boardList, currentBoardId) and is `memo`-ized. App must NOT subscribe to those
slices — otherwise every keystroke in the board-title input re-renders the whole
Canvas tree (this was the case before the header extraction). App passes only
stable `useCallback` handlers across the memo boundary. Destructive/rare actions
(Clear/Delete board, Sign out) live inside the header menus, not on the bar; the
visible bar is ~5 controls for a regular user (roster, Share, + Add Box, Boards,
account) plus role-gated Admin/Facilitator buttons.

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
- **Production-only:** the endpoint is implemented in `functions/` (uses `firebase-admin`). The
  local `server/` returns `501` because it has no service account — this is an **intentional
  deviation** from the server/functions duplication rule.
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
- **E2E suite:** `client/e2e.mjs` (playwright-core + system Chrome) drives the **real dev app** on
  `localhost:5173` with the real backend. Part 1 (fake user via dev-only `window.__dsh` store hooks
  in `main.tsx`, `import.meta.env.DEV`-guarded, stripped from prod): landing → login → palette adds
  → note/label/timer flows → a real `/api/generate` run (Ollama) with markdown output + token badge.
  Part 2 (**real auth + real Firestore, two users in separate contexts**): real email/password
  sign-in via `createTestAccount`/`signInTestAccount` in `client/src/lib/auth.ts` (unused by the
  app UI → tree-shaken from prod), real board creation, persistence across a page reload,
  a second user opening the board via `?board=<id>`, and live cross-user sync (note edits A→B,
  timer start/stop B→A with attribution, presence). Requires the **Email/Password provider**
  enabled in Firebase Auth — done once via the Identity Toolkit admin API
  (`PATCH .../admin/v2/projects/carbondocs/config?updateMask=signIn.email` with the firebase-tools
  access token from `~/.config/configstore/firebase-tools.json`); it can be re-disabled in the
  console, but the suite needs it. Test accounts (`e2e-a@/e2e-b@test.local`) are auto-created
  (reused if present) and deleted afterwards via `accounts:lookup` + `accounts:delete`; test
  boards are deleted at start and end of each run (self-cleaning). The single
  "Missing or insufficient permissions" page error from Part 1's fake user is expected noise.
  Run with `node e2e.mjs` from `client/` while `npm run dev` is up. Playwright clicks inside
  React Flow's transform can misfire (rotated post-its especially) — prefer `page.evaluate` JS
  clicks/native value setters over coordinate clicks. Part 3 (facilitator + guest): the suite
  grants the facilitator role to a test user via the Firestore admin REST API (OAuth token from
  firebase-tools), then drives the dashboard (workshop → template → team → seat codes), joins as
  a guest in a fresh context (code → profile modal → team board → own board → team board visible
  in the list), and cleans everything up. Result at time of writing: **105/105 passed**
  (75 base + 5 "TD" Documents-box tests + 13 "TC" Checklist tests + 9 "T15" shared-checklist
  cross-user tests added since).
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
- **E2E environment gotchas:** (1) The firebase-tools access token
  (`~/.config/configstore/firebase-tools.json`) **expires ~hourly**; a stale token makes the
  facilitator PATCH silently 401 → the "TF facilitator button appears after grant" check FAILS.
  Refresh by running any `firebase` CLI command (e.g. `firebase projects:list`) before the suite.
  (2) **Never run the E2E while another session is editing `client/src`** — Vite HMR/full reloads
  mid-run cause scattered, different failures each run (missing buttons, empty outputs,
  `window.__dsh` undefined). Run it in a quiet window (no src writes for ~2 min). (3) Deps used
  only by the suite must be in `client/package.json` — an ad-hoc `npm install` without `--save`
  gets pruned by the next install (that silently removed `playwright-core` once).
- **T7 can fail spuriously under model latency:** Part 1's "research generated via real
  /api/generate" check polls at most 90s (45 × 2s) for a REAL model call to land, so a slow
  generation shows up as three failures (`output 0 chars`, `token usage recorded`, `markdown output
  rendered`) while the rest of the suite passes — **re-run before hunting a regression** (observed
  once, passed 105/105 on the next run). Its sibling check `token badge visible` is a weak assertion
  (it searches the whole page text for `tok`), so it can pass while those three fail.
- **UI text markers the E2E clicks by** (keep these EXACT strings when restyling — the suite
  finds buttons by `textContent`, not selectors): header `Boards (` and `New Board` (capital B)
  and `🧑‍🏫 Facilitator`; palette rows keep the box label as the button's trailing text
  (`textContent.trim().endsWith(label)` — a leading icon tile is fine); the help card keeps the
  text `How to use` inside a div whose class includes `rounded-xl`; canvas buttons `▶ Run`,
  `▶ Start`, `⏹ Stop`, and `▭ Area` (exact suffix match when inactive); the join modal's `Join`
  button (`trim() === "Join"`), the landing pill `Have a workshop code?`, and `Join my team`;
  the roster test ids `roster-popover`/`roster-row`/`you-chip`; the idea textarea placeholder
  contains `your idea`; the box footer token text contains `tok`. All were re-verified after the
  enterprise UI makeover (76/75-equivalent behavior — header extraction kept every marker).

## Conventions & gotchas

- **Adding a new box type:** see `docs/BOX_TYPES.md` and `docs/course/05_how_to_build_a_box.md`.
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
  every other box is ungated (stock prompts are designed to run standalone). `BoxNode.tsx`
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
  never stamp. The Handoff Brief's "Generated:" and Alignment Check's "Ran:" banner labels
  were removed in favour of the strip: it falls back to legacy `handoffGeneratedAt` /
  `alignmentRanAt`, and a `status: "done"` box with no timestamp at all renders a bare "Ran"
  (its date predates the field).
- **Role filter (palette profiles):** each box type carries `roles: BoxRole[]`
  (`everyone`/`designer`/`developer`/`product` — `BoxRole` in `types/core.ts`, the tags on each
  box in `types/boxes/`); the View dropdown in
  `Sidebar.tsx` filters which boxes appear in the "Add Box" palette (the selectable profiles live in
  the `ROLES` list there — extend it AND the `localStorage` whitelist check when adding one, or the
  saved profile silently resets on reload). This is a discovery-only label — a pure UI filter, never
  a permission. Add sensible `roles` tags when adding a box; see `docs/BOX_TYPES.md`.
- **NBN cross-functional boxes (📦 Handoff Brief / ✅ Alignment Check / 🔁 Jargon Translator —
  types `handoff`/`alignment`/`jargon`, palette section
  "Workers", `category: "worker"`):** generic text-AI boxes (they fall through `runBox`'s else
  branch) that each render a **metadata banner** above the markdown output via their own block in
  `BoxNode.tsx` (each excluded from the generic text block's guard). Shared pieces: the
  banner's **`Source:`** label is `connectedSourceLabel()` (module-level in `BoxNode.tsx`) —
  first connected upstream box, or the uploaded filename when that box is a Documents box; run-time
  metadata lands in `BoxData` (`handoffGeneratedAt`/`alignmentRanAt`/`jargonTerms`)
  written by the text branch of `runBox`. Handoff's From/To are editable inputs
  (`nodrag`); Alignment's Artefact 1/2 and Jargon's Source are inferred from edges —
  never stored. `jargonTerms` counts numbered items **only under the `## Terms Simplified`
  heading** so a numbered source list copied into the translated artefact can't inflate it. None
  of the three is in `AGENT_CREATABLE_TYPES`. (A Decision Log box existed earlier and was
  removed — don't reintroduce `"decision"`/`decisionCount` references.)
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
  text-output box (research, summarise, prd, custom, agent, slides).
  Filenames: the type's name otherwise (`research.md`, `summary.md`, `prd.md`, …), and the
  slugified label for custom boxes. Slides download as a Markdown deck built from `slides[]`. The
  file is the artifact text only — version history lives in the box's own 🕘 panel (where present).
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
  `LandingHowItWorks`, `LandingFeatures`, `LandingBoxes`, `LandingRoles`, `LandingCTA`,
  `LandingFooter`). It reuses `BOX_TYPES` for the box showcase, uses a `Reveal` scroll-fade wrapper
  (`useReveal.ts`), and keeps the dark indigo/cyan theme from `index.css` (`.landing-bg`,
  `.gradient-text`, `.glass-card`). `App.tsx` renders it when `!user`.
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
- **Touch / tablet (iPad) support:** everything touch-related is scoped to `@media (pointer: coarse)`
  in `client/src/index.css` — desktop is byte-for-byte unchanged. When adding UI, keep it that way:
  - **Hover-gated controls need `.touch-visible`** (opacity forced to 1 on coarse pointers) — used by
    the Documents-file ✕ (BoxNode) and the Sidebar custom-template ✕. Note/label/box delete
    ✕s are always visible + 30px on touch via their own classes.
  - **Touch-target classes:** `.box-footer button`, `.slide-nav`, `.timer-controls button`,
    `.checklist-check` / `.checklist-row-actions button` / `.checklist-assign` /
    `.checklist-add-*`, `.area-color-dot`/`.label-color-dot`, `.palette-row`, `.sidebar-tab`,
    `.help-anchor`, `.app-bar button/input`. React Flow connection handles are forced to 18px with
    `!important` (BoxNode sets 10px inline), resize handles 20px, controls 34px.
  - **Box bodies scroll on touch:** the standard box-card body wrapper is `box-body nodrag` +
    `touch-action: pan-y` (coarse only) so a finger scrolls long output instead of dragging the
    node. Side effect on desktop too: boxes are dragged by their header strip (consistent with the
    idea-textarea `nodrag` convention).
  - **Canvas:** empty-canvas **double-click / double-tap zooms in** ×1.6 toward the pointer via
    the app's own `onDoubleClick` on `<ReactFlow>` (`Canvas.tsx`) — target checks exclude every
    node except an Area, `button/input/textarea/select/a`, and the Controls/Minimap/panels; it is
    also inert while the Area tool is active. React Flow's `zoomOnDoubleClick` deliberately stays
    `false`: its d3 listener is attached to the renderer (so it fires from inside boxes) and on
    touch screens it bypasses the event filter entirely. Note React Flow v12's default
    `maxZoom` is **2** (not 4), so the step clamps there. The Area tool has a native
    `touchstart`/`touchmove`/`touchend` mirror on `.react-flow__pane` (iPads never fire the
    synthesized mousedown — React Flow's touch handlers suppress it); presence cursors update via
    ReactFlow `onTouchMove`.
  - **Page level:** `index.html` viewport is `viewport-fit=cover, maximum-scale=1, user-scalable=no`
    plus apple/web-app metas (Add-to-Home-Screen = chrome-less kiosk); `.app-bar` pads with
    `env(safe-area-inset-*)`; root uses `100dvh`; `overscroll-behavior: none`; global
    `touch-action: manipulation` on buttons kills double-tap zoom; `body` is `user-select: none` on
    coarse pointers with `input`/`textarea`/`.markdown-output`/CodeMirror re-enabled.
  - Verified with the full E2E (105/105, desktop viewport) — keep the suite green when extending.
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
  code?" → `POST /api/workshop/join { code }` (functions only) mints a Firebase **custom token**
  for a durable uid — first use creates the auth user and claims the code, later uses return a
  token for the SAME uid (codes are effectively bearer credentials), so guests keep their
  identity/boards across devices. Guests then pick a name (email optional, never for login) via
  `GuestProfileModal`, get added to the team board via `memberUids` (new BoardDoc field;
  `listSharedBoards(email, uid)` merges the email and memberUids queries), and can create their
  own boards (guests skip the auto-"My First Board" creation — no auth email). The local dev
  server PROXIES `/api/workshop/join` to the deployed function (Admin SDK needed). **Critical
  IAM gotcha:** custom-token minting failed with `iam.serviceAccounts.signBlob` denied until the
  project granted `roles/iam.serviceAccountTokenCreator` to the functions runtime service accounts
  (done once via `cloudresourcemanager setIamPolicy`; `saveBoard` must also carry
  `isTemplate`/`teamId`/`memberUids` or template flags are silently dropped).
- **Presence & the board roster:** `boards/{id}/presence/{uid}` docs power live cursors
  (`Cursors.tsx`) and the header roster (`PresenceRoster.tsx`). Cursor moves are throttled to one
  write per 200ms; a **heartbeat in `boardStore.ts` re-stamps `lastActive` every 15s** while a
  board is open (started in `subscribeToBoardUpdates`, cleared in `unsubscribeFromBoard`) so users
  who are online but idle stay listed — `subscribeToPresence` filters out entries stale for >30s,
  so without the heartbeat idle users would vanish from the roster. Heartbeat-only users carry
  `hasCursor: false` (PresenceUser) and `Cursors.tsx` skips them, so no stray cursor renders at
  (0,0). The roster popover (`PresenceRoster.tsx`, test ids `roster-popover`/`roster-row`/
  `you-chip`) shows online users (with a "you" marker) plus board collaborators who are offline —
  grouping logic is the pure `groupRoster()` in `client/src/lib/presence.ts` (unit-tested).
- **Client Firebase config** lives in `client/src/lib/firebase.ts` (hardcoded `firebaseConfig`).
  For open hosting, prefer `VITE_FIREBASE_*` env vars at build time (see `docs/OSS_READINESS.md`).
- **Deploying:** follow `docs/DEPLOYMENT.md`. Preferred free path: **API on Render**
  (`render.yaml`, root `server/`) + **client on Firebase Hosting** via
  `scripts/deploy-hosting.sh <render-url>` (embeds `VITE_API_BASE`; no Cloud Functions /
  Blaze). Full Firebase Functions path needs Blaze (`scripts/deploy.sh`). Also the
  `ai-canva-deploy` skill (`.dsh/skills/ai-canva-deploy/SKILL.md`). Requires Firebase CLI logged in and real API keys
  (Ollama, optionally fal.ai + Google Stitch).
- **Keep `server/` and `functions/` API logic in sync** — they are intentionally duplicated.

## dsh GUI plugins

`dsh-plugins/` hosts out-of-tree plugins for the **DeepSeek Harness Web GUI** (the harness this
agent runs in — `dsh web`, profile at `~/.dsh/profiles/web`). These are NOT part of the ai-canva
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
