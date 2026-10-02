# Box types reference

This document describes every box type. Metadata lives in `client/src/types/boxes/` (one file per
box, assembled into `BOX_TYPES` by `client/src/types/boxTypes.ts`), rendering in
`client/src/components/BoxNode.tsx`, and the "run" behavior in
`client/src/store/boardStore.ts` (`runBox`).

Boxes fall into three categories:

- **Input boxes** (`category: "input"`) — no AI. They seed data into a pipeline.
- **Worker boxes** (`category: "worker"`) — run an AI step (Ollama, fal.ai, or Google Stitch).
- **Collaboration boxes** (`category: "collab"`) — standalone team tools and annotations with no AI,
  no Run button, no settings panel, and no connection handles.

> A fourth `custom` category holds the user's own saved box templates (see "Custom boxes").

---

## Input boxes

### 💡 Idea — `idea`

Free-text input. No AI. The seed of most pipelines. Its content becomes the output sent to
downstream boxes.

- **Inputs:** none (no target handle).
- **Outputs:** its text content.
- **Settings:** none (input box).

### 🖼️ Image — `image`

Upload an image. It's auto-resized to ≤1024px, compressed to JPEG, and uploaded to Cloudflare R2
(if a board is loaded) so it syncs to collaborators. Downstream boxes receive a fetchable
URL.

- **Inputs:** none (no target handle).
- **Outputs:** an image URL as `imageData`. Cartoon boxes use it as image-to-image input;
  text AI boxes receive a labeled `{{inputs}}` entry (`[image: <url>]`, or a local-only note
  when the upload did not reach storage) so `{{inputs}}` / `{{Box Name}}` resolve and the
  model knows an image is connected (the text model cannot *view* pixels — only Cartoon /
  image-generation paths send the actual image).
- **Settings:** none (input box).

### 📎 Documents — `documents`

Upload one or more documents (click or drag & drop; PDF, DOCX, TXT, MD, CSV, JSON). Text is
extracted **in the browser** — plain-text formats are read directly, PDFs via pdf.js and Word
files via mammoth (both loaded on demand, so they don't slow down the app until needed). The
combined, filename-labeled text becomes the box's output, so any connected AI box can use it via
`{{inputs}}`, `{{Box Name}}`, or `{{input_N}}` — e.g. connect Documents → Summarise to condense a
report, or Documents → PRD to turn a spec into a product doc.

- **Inputs:** none (no target handle).
- **Outputs:** every document's extracted text, each labeled `=== filename ===`. Extraction is
  capped at 100k chars per file and 400k chars per box (oversized files are marked *truncated*)
  so boards stay within Firestore's 1MB document limit.
- **Persistence:** the extracted text lives in the board itself (syncs to collaborators and
  survives reloads). The original file is also uploaded to Cloudflare R2 when signed in
  ("Open original ↗" link); when signed out (or R2 is unconfigured), only the text is kept.
- **Settings:** none (input box).

---

## Worker boxes

### 🤖 Agent — `agent`

Give the agent a **task** (typed in its box) and click Run: it autonomously completes the task
by using the board as its workspace. Each turn the model returns one structured action —
`add_box` (create a new AI box with a task-specific prompt), `connect` (wire two boxes),
`run_box` (run a box through the normal pipeline and read its output back), or `finish`
(write the final Markdown answer into the box). The step-by-step transcript is shown live in
the box (and synced to collaborators); the boxes it creates are ordinary boxes you can inspect,
rerun, and take over. Runs entirely client-side on top of the regular boxes/`runBox` machinery
— no backend endpoints were added.

- **AI:** Ollama, multiple controller turns (default system prompt = the JSON action protocol).
- **Budget:** 12 controller turns (`MAX_AGENT_TURNS` in `client/src/lib/agent.ts`); the final
  turn forces a wrap-up. Unparseable replies are coached and retried (2×), then the raw reply is
  kept as the answer so the run never hangs. ⏹ Stop halts the loop between turns.
- **Can create:** `idea`, `research`, `summarise`, `prd`, `slides`, `ui` —
  never upload boxes (Image/Documents), `cartoon`/`stitch` (image/async paths), other agents,
  or itself.
- **Inputs:** connected boxes flow into the agent's context (like `{{inputs}}`); its `content`
  field is the task.
- **Output:** the final Markdown answer (also usable by downstream boxes).
- **Settings:** "Extra guidance for the agent" (the prompt field) + the protocol system prompt
  (advanced). The step transcript persists in `boxData.agentSteps`.
- **Code:** parsing/inventory/layout in `client/src/lib/agent.ts` (unit-tested); the loop in
  `boardStore.ts` (`runAgentLoop`); UI in `BoxNode.tsx` (the `isAgent` branch).
- **Caveat:** the controller is only as good as the model behind `/api/generate` — strict-JSON
  adherence varies by local model, which is why the loop is defensive (retry → coach → salvage).

### 🔍 Research — `research`

Runs an AI prompt over connected inputs and returns structured research findings.

- **AI:** Ollama (text).
- **Inputs:** any connected box; defaults to `{{input_1}}`.
- **Output:** Markdown text.

### 📋 Summarise — `summarise`

Combines multiple upstream inputs into a concise AI summary.

- **AI:** Ollama (text).
- **Inputs:** multiple; defaults to `{{inputs}}`.
- **Output:** Markdown text.

### 📄 PRD — `prd`

Generates a Product Requirements Document — product overview, problem statement, target users,
core features with priorities, user stories, UI/UX guidelines, technical requirements, and
success metrics. Ideal input for the UI Design box.

- **AI:** Ollama (text).
- **Inputs:** typically Research; defaults to `{{inputs}}`.
- **Output:** Markdown document.

### Deploying a box

Any box that contains code can be published to a live URL — **UI Design** and **Stitch UI**.
Press **🚀 Deploy** in the box (or the button in the 🌐 Live site strip) and the
backend publishes it to **here.now**:

- what gets published: UI Design → a self-contained `index.html` (the same CDN-wrapped page the box
  previews) **plus `App.jsx`** with the source; Stitch UI → its HTML as-is;
- the first deploy **creates** the Site and later ones **update the same one**, sending its live
  version back — so a Site that changed elsewhere (the here.now editor, another agent) is refused
  with a message naming that version instead of being silently replaced;
- the box records the slug, URL, version, file count and byte count, and shows the live link;
- `HERENOW_API_KEY` (see `docs/API.md`) is optional. Without it the Site is **anonymous: it expires
  in 24 hours** and can only be updated with the claim token — which here.now returns **exactly
  once**, so the box keeps it and shows the claim link behind a 🔑 toggle (a modified claim link
  will not work). With a key the Site is permanent and belongs to the account;
- nothing is verified for you: deploying publishes the code, it does not run it.

### 🎨 Cartoon Profile — `cartoon`

Generates a cartoon avatar via fal.ai.

- **AI:** fal.ai (image).
- **Inputs:**
  - An **Image** box connected → image-to-image (`fal-ai/qwen-image-edit`).
  - Otherwise, an **Idea** box → text-to-image fallback (`fal-ai/flux/schnell`).
- **Output:** a generated image URL (`outputImage`).
- **Settings:** a "Prompt Template (text-to-image fallback)" — only used when no image is
  connected. No system prompt.

### 📊 Slides — `slides`

Generates a visual pitch deck. Ollama returns a JSON array; the app parses it into navigable
slides with prev/next and speaker notes.

- **AI:** Ollama (text).
- **Inputs:** `{{inputs}}`.
- **Output:** slides parsed from a JSON array of
  `{ title, bullets: string[], notes? }`.
- **Settings:** the prompt defines the slide structure; the model must output only a valid JSON
  array.

### ✨ UI Design — `ui`

Generates polished, production-quality React UIs using **Tailwind CSS classes** + Google Fonts
(production-quality, Google Stitch style). Previewed in an iframe with Tailwind loaded.

- **AI:** Ollama (text).
- **Inputs:** `{{inputs}}`.
- **Output:** `code` (Tailwind-based JSX) + preview.
- **Settings:** the prompt describes what to build; the system prompt emphasizes visual polish.
- **Change requests + versions:** the "Request a change…" field, ✏️ Apply change, 🔀 diff and 🕘
  version history with ↩ Revert (`client/src/components/CodeChangePanel.tsx`).

### 🧵 Stitch UI — `stitch`

Generates a UI screen using **Google Stitch** and returns polished, production-quality HTML
directly.

- **AI:** Google Stitch.
- **Inputs:** `{{inputs}}`.
- **Output:** `output` + `code` (the raw HTML), previewed directly in the iframe.

---

## Collaboration boxes

Standalone team tools shown in the sidebar's "Collaboration" section. They have **no AI, no Run
button, no ⚙ settings panel, and no connection handles** — they never join a pipeline.
`runBox` early-returns for them as a guard. Their content lives in the regular `boxData` and syncs
to every viewer through the board document snapshot, like all boxes.

### 🗒️ Note — `note`

A post-it style note for team communication. Anyone can write; everyone on the board sees edits
live. Notes render as **annotation paper, not a box card** — no header bar or border chrome, just
a slightly rotated yellow sticky with a hover/selected ✕ delete button.

- **Fields:** `content` (the note text), `authorEmail` / `authorName` (captured once at creation,
  shown under the note).
- **Interaction:** type in the note; edits save through the normal debounced board save.

### 🏷️ Label — `label`

A small colored text pill for annotating areas of the board. Labels render as a **floating chip
with no card frame at all** — the pill *is* the node, with a hover/selected ✕ delete button.

- **Fields:** `content` (label text), `labelColor` (one of `LABEL_COLORS` in `types/boxes/label.ts`).
- **Interaction:** click the pill to edit the text; select the box to reveal five color dots.

### ⏱️ Timer — `timer`

A shared countdown clock. Anyone can start/pause/stop/reset it; every viewer sees the same time.

- **Fields:** `timerDurationMs`, `timerStatus` (`idle` / `running` / `paused` / `stopped`),
  `timerStartedAt` (epoch ms), `timerRemainingMs` (frozen on pause/stop), `timerStartedBy`.
- **Sync design (important):** only state *transitions* write to the store. While running, every
  viewer locally computes `remaining = timerRemainingMs − (now − timerStartedAt)` on a 250ms
  interval — there are **zero Firestore writes per tick**. The pure logic lives in
  `client/src/lib/timer.ts` (`parseDurationInput`, `formatTimer`, `computeRemainingMs`,
  `isTimerFinished`) and is unit-tested in `timer.test.ts`.
- **At zero:** the digits turn red and pulse with a "⏰ Time's up" banner (visual only — no sound).

### ✅ Checklist — `checklist`

A **shared team to-do list**. Anyone on the board can add, assign, rename, reorder, tick off and
delete tasks — everyone sees the same list, live (last-write-wins between simultaneous users,
exactly like a Note). The box uses the standard card (title, delete ✕, resizable) and renders its
own panel body: a progress bar (`3 of 7 done`), an add field, and the task rows.

- **Fields:** `checklistItems` — an array of `ChecklistItem`, each with `id`, `text`, `done`,
  `assignee` (email, `""` = unassigned), `createdBy` / `createdAt` and `doneBy` / `doneAt`.
  Every field of every item is **always defined** (Firestore rejects `undefined` nested inside a
  value) and the array is created empty-but-defined at box creation.
- **Attribution:** the list is edited by the whole team, so each task records who added it and who
  ticked it off (shown as `✓ alice` on a finished row).
- **Adding tasks:** type one and press Enter. Pasting **multiple lines** appends them all at once —
  Markdown task lists (`- [ ]` / `- [x]`, the done state is kept), bullets, numbered lists and bare
  lines are all accepted, and the bullet/number markers are stripped. 📋 Copy exports the list as a
  Markdown checklist; 🧹 Clear done removes only finished tasks.
- **Assignment:** the row's picker lists the people on the board (owner, collaborators and whoever
  is currently present), plus the current user.
- **Budgets:** text is trimmed/single-lined and clamped to 500 chars, and a box holds at most 200
  tasks (`MAX_CHECKLIST_ITEMS`) so one list can never push the board document past Firestore's 1MB
  limit. The store skips the write entirely when a mutation changed nothing.
- **Code:** all rules are pure functions in `client/src/lib/checklist.ts` (`appendChecklistItems`,
  `parseChecklistLines`, `toggleChecklistItem`, `setChecklistItemAssignee`, `moveChecklistItem`,
  `checklistStats`, `checklistToMarkdown`, `normalizeChecklist`, …), unit-tested in
  `checklist.test.ts`. Rendering + store wiring is `components/ChecklistPanel.tsx`, and the store
  exposes one action, `setChecklistItems(id, items)`. `normalizeChecklist` repairs anything loaded
  from an older board document.
- **Not an AI box:** the agent cannot create one (`AGENT_CREATABLE_TYPES` excludes every
  collaboration box), and it produces no output for downstream boxes.

---

## Custom boxes

The `custom` type is not a built-in — it is what **user-created templates** instantiate as.
Users build their own reusable AI boxes ("✨ New Custom Box" in the sidebar): a name, emoji,
color, and the prompt/system-prompt templates (with the same `{{input_1}}` variables as the
built-ins). Definitions are saved to the user's profile (`users/{uid}/boxes/{boxId}` in
Firestore) and appear in the palette on every board.

- **Semantics:** adding one to a board COPIES the template's prompt, system prompt, icon, and
  color onto the box — so deleting a saved template never affects boxes already on boards.
- **Runtime:** a custom box is a normal AI text box (Run → Ollama → markdown output) with a ⚙
  settings panel for tweaking the instance's prompts.
- **Cleanup:** hover a template in the palette and press ✕ to remove it from your profile.

---

## Downloading a box's outcome

Every text-producing box can hand its **actual outcome** to the clipboard of your file system:

- **Which boxes:** Research, Summarise (`summary.md`), PRD,
  Agent (`agent-answer.md`), Slides (rendered as a Markdown deck) and custom boxes (slugified label).
- **Where:** the `💾 Save` button in the box footer, next to ⚙ — it appears once the box has an
  outcome.
- **What's in the file:** the artifact text and nothing else, so it can be pasted straight into a
  repo or a PR. Version history lives in the box's own version UI instead.
- **Not covered:** UI Design / Stitch keep their own 💾 Save (the runnable prototype as
  HTML), Cartoon keeps its image download, and Idea / Image / Documents / Note / Label / Timer /
  Checklist have no text outcome to download.
- **Code:** `client/src/lib/download.ts` (`outcomeText`, `outcomeFilename`, `slugifyFilename`,
  `downloadText` — the pure parts are unit-tested).

---

## Prompt template variables

All AI boxes support these in their prompt templates (see `lib/prompts.ts`):

| Variable | Meaning |
|----------|---------|
| `{{Box Name}}` | Output of a connected box matched by its name (case-insensitive). |
| `{{input_1}}` … `{{input_N}}` | Nth connected input, positional. |
| `{{input}}` | Alias for the first input. |
| `{{inputs}}` | All connected inputs, labeled and concatenated. |

## Role tags & the palette filter

Every box type carries `roles: BoxRole[]` (`"everyone" | "designer" | "developer" | "product"`)
used by the View dropdown in `client/src/components/Sidebar.tsx`. This is a
**discovery-only label**, not a permission:

- Boxes tagged `"everyone"` (Idea, Research, Summarise) are shared pipeline scaffolding and appear
  in every role view.
- Selecting the **Designer**, **Developer** or **Product** profile filters the palette to
  boxes tagged with that role — plus all `"everyone"` boxes.
- The selection is persisted per user in `localStorage` (`ai-canva:sidebar-role`) so it acts like a
  lightweight profile. Filtering never hides boxes already on the canvas — it only declutters which
  ones you can add.
- Give a box multiple roles when it spans personas (e.g. `slides: ["product", "designer"]`).

Tagging a box does not affect collaboration, the canvas, or `runBox` — it is purely a UI filter.

## Adding a new box type

1. Add a `BoxType` union member in `client/src/types/core.ts`, create
   `client/src/types/boxes/<type>.ts` with the metadata (including its `roles` tags and `category`
   — see above), and register it in `BOX_TYPES` in `client/src/types/boxTypes.ts` (union and table
   must match — a mismatch is a compile error).
2. Register it in `Canvas.tsx` (`nodeTypes`) and the MiniMap color map.
3. Add a render/output branch in `BoxNode.tsx`.
4. Add run behavior in `boardStore.ts` `runBox()` (or route to an existing branch — a plain text
   box needs no branch at all).
5. Add any new backend endpoint in `server/src/index.ts` **and** `functions/src/index.ts`.
6. Update the box-type tables in the README and this document.
