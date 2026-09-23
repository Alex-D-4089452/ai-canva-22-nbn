# Onboarding & Environment Setup

Welcome! 👋 This guide gets you from **nothing installed** to a **running AI Canva** on your own
machine, then shows you where to look and what to try first. It's written for students and
newcomers, so every step is spelled out. If you already know your way around, the quick checklist
at the end is all you need.

> New to the project? Read [docs/OVERVIEW.md](OVERVIEW.md) first for "what is this project."

---

## What you're setting up

Two processes plus optional cloud services:

1. **Client** — the web app (React + Vite). Runs at `http://localhost:5173`.
2. **Server** — a small Node API (Express) that talks to the AI providers. Runs at
   `http://localhost:3001` (auto-switches to another port if busy).
3. **Optional** — Firebase (accounts + cloud save + collaboration) and AI providers.

> The server and client are separate processes that the root `npm run dev` command starts
> together. The client sends `/api/*` requests to the server through a proxy.

---

## Step 0 — What you need

- **Git** (to clone and manage the repo)
- **Node.js 18+** (recommended: a recent LTS, e.g. 20 or 22). Check with `node -v`.
- A **code editor** (VS Code, etc.)
- Optional but recommended for AI: **Ollama** (free, runs locally) — see [Step 4](#step-4--ai-providers).

### Check your versions

Open a terminal and run:

```bash
git --version
node --version
npm --version
```

All three should print a version (not an error).

---

## Step 1 — Clone the repository

```bash
git clone <your-repo-url> ai-canva
cd ai-canva
```

> If you're forking on GitHub for your own work, click **Fork** first, then clone *your* fork.

---

## Step 2 — Install dependencies

```bash
npm install          # root tooling (concurrently)
npm run install:all  # installs server/ and client/ dependencies
```

This creates the `node_modules/` folders. You only run this once (or after a fresh clone).

---

## Step 3 — Configure the AI keys

The app needs an AI model for its text boxes. Copy the template file, then edit it:

```bash
cp server/.env.example server/.env
```

Open `server/.env` and set at least one text provider:

**Option A — Ollama Cloud (simplest, uses your own API key):**
```
OLLAMA_API_KEY=your-ollama-api-key
# get a key at https://ollama.com/settings/keys
```

**Option B — Ollama locally (free, no key needed):** see [Step 6](#step-6--run-ai-free-locally-recommended-for-students).

Optional keys for the image/UI boxes (`FAL_KEY`, `STITCH_API_KEY`) — you can leave these blank
and skip those boxes until you're ready.

> `.env` files are git-ignored, so your keys stay private. Never commit them.

---

## Step 4 — Run the app

```bash
npm run dev
```

Wait for the console to show both servers. Then open **http://localhost:5173** in your browser.

- Client: http://localhost:5173
- Server: http://localhost:3001 (or the next free port)

You'll know the server is up when you see `[server] Running on http://localhost:3001`.

---

## Step 5 — Sign in and try it

AI Canva uses **Google sign-in**. To actually enter the canvas you need an account.

- **Fastest:** the repo already contains a Firebase config in `client/src/lib/firebase.ts`
  pointing at a shared demo project. If that project allows your sign-in, you can log in
  immediately.
- **Recommended for your own work:** create your **own** Firebase project so you own the data.
  Follow [Step 7](#step-7--set-up-your-own-firebase-optional-but-recommended).

Once signed in, try a first pipeline:

1. Click **+ Add** (top bar) to open the box panel.
2. Add a **💡 Idea** box and type a topic.
3. Add a **🔍 Research** box.
4. Drag from the Idea box's right edge (●) to the Research box's left edge (●) to connect them.
5. Click **▶ Run** on the Research box. A few seconds later it shows findings.

> The little **?** toolbar in the corner explains the interactions too.

---

## Step 6 — Run AI for free (local Ollama)

This is the **recommended path for students** — it uses a local model on your own computer, so
**no paid API key** is needed for the text boxes.

1. **Install Ollama** from https://ollama.com/download (works on macOS, Windows, Linux).
2. **Pull a model.** In a terminal:
   ```bash
   ollama pull llama3.2
   ```
   (Any model you like; `llama3.2` is a small, easy start.)
3. **Point the app at your local Ollama.** In `server/.env`:
   ```
   OLLAMA_HOST=http://localhost:11434
   OLLAMA_MODEL=llama3.2
   ```
   (Leave `OLLAMA_API_KEY` blank — no key is sent to a local host.)
4. Keep the Ollama daemon running (it usually runs in the background after install) and
   restart `npm run dev`.

The `server/src/ollama.ts` provider automatically calls your local model because
`OLLAMA_HOST` is set and no `OLLAMA_API_KEY` is present.

> Tip: models you pull locally are downloaded once and reused, so you can experiment freely.

---

## Step 7 — Set up your own Firebase (optional but recommended)

Accounts, cloud save, real-time collaboration, and image uploads need a Firebase project. This
is also a great learning exercise.

1. Go to https://console.firebase.google.com and create a project.
2. **Authentication** → Sign-in method → **Google** → Enable.
3. **Firestore** → Create database (start in production mode).
4. **Project settings** → Your apps → **Web** → register an app → copy the config (apiKey,
   authDomain, projectId, messagingSenderId, appId — no `storageBucket`; file blobs use
   Cloudflare R2).
5. Paste those values into the `firebaseConfig` in `client/src/lib/firebase.ts`.
6. (Recommended) Deploy the security rules from `firestore.rules` in the
   repo. Note: the current `firestore.rules` are permissive (see
   [OSS_READINESS.md](OSS_READINESS.md)) — fine for testing, tighten them for a public launch.
7. (Optional) For image/document uploads, create a free **Cloudflare R2** bucket + API token and
   put the `R2_*` keys in `server/.env` (see [DEPLOYMENT.md](DEPLOYMENT.md)). Without them the
   app still works — document text is kept, image uploads stay local.

> Without Firebase you can still explore the code and the canvas logic, but login, cloud save,
> and collaboration won't work.

---

## Troubleshooting

| Symptom | Likely fix |
|---------|-----------|
| `node: command not found` | Install Node.js from https://nodejs.org and reopen the terminal. |
| `npm` install errors | Ensure you ran `npm run install:all` (both `server/` and `client/` need deps). |
| `OLLAMA_API_KEY is not configured` / no AI output | Set `OLLAMA_API_KEY` (cloud) or `OLLAMA_HOST=http://localhost:11434` (local) in `server/.env`, then restart `npm run dev`. |
| Server says a port was "switched" | That's expected; the client auto-adapts via `.server-port`. |
| Sign-in button does nothing | Firebase isn't configured / auth not enabled — see Step 7. |
| "Could not parse slides" | A Slides box got malformed JSON from the model; re-run or use a stronger model. |
| Can't sign in (Google) | The shared demo project may not allow your email — set up your own Firebase (Step 7). |
| AI is slow | Local models take time on first load; cloud requests need a network + a valid key. |

---

## Your first tasks as a student

Once it runs, try these to build confidence:

1. Build an **Idea → Research → PRD → Code** pipeline and preview the generated app.
2. Open the **⚙ settings** on a box and edit its **prompt template**. Insert `{{Box Name}}`
   and `{{inputs}}` to see how variables get filled.
3. Open a **second browser window** and share the board to watch **live cursors** and
   real-time edits.
4. In `client/src/types.ts`, change a box's **default prompt** and run it. What changes?
5. Read `client/src/store/boardStore.ts` — find `runBox`. Trace what happens on **▶ Run**.

---

## Quick start (cheat sheet)

```bash
git clone <your-repo-url> ai-canva && cd ai-canva
npm install && npm run install:all
cp server/.env.example server/.env   # then edit: OLLAMA_API_KEY or OLLAMA_HOST
npm run dev                          # open http://localhost:5173
```

---

## Learning path

- New here? [Overview](OVERVIEW.md) → [Onboarding](#onboarding--environment-setup-guide) (this page)
- Codebase map? [Architecture](ARCHITECTURE.md)
- Boxes? [Box Types](BOX_TYPES.md)
- Backend? [API](API.md)
- Deployment? [Deployment](DEPLOYMENT.md)

If you get stuck, ask in your course's channel or open an issue.
