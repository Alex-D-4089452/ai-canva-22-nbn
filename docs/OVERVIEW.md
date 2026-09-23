# AI Canva — Project Overview

> **What is this project?** AI Canva is an open-source, **collaborative AI whiteboard** where you
> build visual "pipelines" of AI-powered boxes. You drop boxes on a canvas, connect them, and run
> AI prompts that flow content from box to box — turning a rough idea into researched notes, a
> product spec, a pitch deck, and even a working React prototype.

This document is the **overall documentation** for AI Canva. It explains the project at a level
suitable for **students** and **instructors** using the codebase as a learning ground, and it
points to deeper, practical guides for setup, architecture, and deployment.

---

## 1. The big idea

Most AI apps are single-purpose chat boxes. AI Canva turns AI into a **visual, modular
pipeline**. Think of it as a flowchart where each node is a tool:

```
💡 Idea ──▶ 🔍 Research ──▶ 📄 PRD ──▶ 🗺️ Dev Plan ──▶ 💻 Code
```

- You write an **idea**.
- A **Research** box turns it into findings.
- A **PRD** box structures those findings into a product spec.
- A **Code** box turns the spec into a working React app you can preview.

Instead of writing one giant prompt, you **compose smaller steps** and pass each output to the
next box. This teaches a core AI principle: **breaking a hard problem into smaller steps and
chaining them** (often called "pipelining" or "agentic workflows").

---

## 2. What you can do with it

- **Build visual pipelines** — drag boxes onto a canvas and connect them; content flows box to box.
- **Generate with AI** — text (Ollama / DeepSeek), images (fal.ai), and UI screens (Google Stitch).
- **Collaborate in real time** — share a board by email, see live cursors, and edit together.
- **Keep your work** — boards auto-save to the cloud (Firestore) with an offline browser cache.

### The box types

| Box | Icon | Category | What it does |
|-----|------|----------|--------------|
| **Idea** | 💡 | Input | Free text. The seed of a pipeline. |
| **Image** | 🖼️ | Input | Upload an image for downstream boxes. |
| **Research** | 🔍 | Worker | Turns inputs into structured findings. |
| **Summarize** | 📋 | Worker | Squeezes many inputs into a concise summary. |
| **PRD** | 📄 | Worker | Writes a Product Requirements Document. |
| **Dev Plan** | 🗺️ | Worker | Turns a PRD into a build plan (components, state, steps). |
| **Cartoon Profile** | 🎨 | Worker | Generates a cartoon avatar from an image or text. |
| **Slides** | 📊 | Worker | Generates a navigable pitch deck. |
| **Code** | 💻 | Worker | Generates a working React prototype with a live preview. |
| **UI Design** | ✨ | Worker | Generates polished React UIs with Tailwind CSS. |
| **Stitch UI** | 🧵 | Worker | Generates UI screens via Google Stitch. |

**Input boxes** (no AI) start data; **worker boxes** (AI) transform it. Boxes are defined in
`client/src/types.ts` and rendered by a single component, `client/src/components/BoxNode.tsx`.

---

## 3. How it works (high level)

1. You add boxes and connect them on the canvas (**React Flow**).
2. You click **▶ Run** on a worker box.
3. The client gathers the connected boxes' outputs and fills the box's **prompt template**
   (variables like `{{input_1}}`, `{{Box Name}}`, `{{inputs}}`).
4. The client calls the backend (`/api/generate`, `/api/generate-image`, `/api/stitch-generate`).
5. The backend calls an **AI provider** (Ollama/DeepSeek for text, fal.ai for images, Stitch for UI).
6. The result is stored on the box, and the board **auto-saves** to the browser and Firebase.
7. If someone else has the board open, they see your changes **in real time**.

The heart of this logic lives in `client/src/store/boardStore.ts` (the `runBox` function) and
`client/src/lib/prompts.ts` (template filling).

---

## 4. Architecture at a glance

```
+---------------------+   /api   +---------------------+   SDK   +----------------------+
|  Client (browser)   | -------> |  Backend (Node)     | ------> |  AI providers        |
|  React 19 + Vite    |          |  Express (dev) or   |         |  Ollama (DeepSeek)   |
|  React Flow canvas  |          |  Cloud Functions    |         |  fal.ai (images)     |
|  Zustand store      |          |  (production)       |         |  Google Stitch (UI)  |
+---------------------+          +---------------------+         +----------------------+
        |  Firebase SDK
        v
   Firebase: Auth (Google) · Firestore (boards, presence) · Cloudflare R2 (images/documents)
```

Three layers worth understanding:

1. **Client (`client/`)** — the whole UI. React 19, Vite, TypeScript, Tailwind CSS, React Flow for
   the canvas, and Zustand for state. State is held in one central store.
2. **Backend (`server/` + `functions/`)** — a small Node API. The local `server/` is an Express
   app for development; `functions/` is the same API packaged as a Firebase Cloud Function for
   production. Both call the same AI providers.
3. **Firebase + Cloudflare R2** — Firebase handles **accounts** (Google sign-in), **cloud
   storage** of boards (Firestore), and **real-time collaboration** (live board + cursor sync);
   **Cloudflare R2** stores file blobs (image/document uploads).

> See [docs/ARCHITECTURE.md](ARCHITECTURE.md) for the full deep dive.

---

## 5. Tech stack & what you'll learn

| Layer | Technology | Concepts you can learn |
|-------|-----------|------------------------|
| Frontend | React 19, Vite, TypeScript | Components, hooks, TypeScript, build tooling |
| Canvas | React Flow (`@xyflow/react`) | Node/edge graphs, drag & drop, zoom/pan |
| State | Zustand | Centralized state, stores, localStorage persistence |
| Styling | Tailwind CSS | Utility-first CSS, responsive layout |
| Backend | Express, Node.js | REST APIs, JSON, environment variables |
| AI | Ollama (DeepSeek), fal.ai, Stitch | Prompt engineering, API integration, async workflows |
| Cloud | Firebase (Auth, Firestore) + Cloudflare R2 (files) | Authentication, NoSQL, real-time sync, object storage, security rules |
| Collaboration | Firestore real-time + presence | Live cursors, presence tracking, conflict/echo handling |
| DevOps | Firebase Hosting + Functions | Building, deploying, CI, environment config |
| Open source | Git + GitHub | Forking, PRs, issues, documentation, licensing |

---

## 6. AI providers (important for running it)

| Provider | Used by | Cost |
|----------|---------|------|
| **Ollama (DeepSeek)** | All text boxes (Research, PRD, Code, …) | **Free locally** (run on your machine) or paid cloud |
| **fal.ai** | Cartoon Profile box | Paid API key |
| **Google Stitch** | Stitch UI box | Free to try (API key) |

> **For students:** you can run AI **for free** by running Ollama on your own computer and
> pointing the app at `http://localhost:11434`. No paid key required for text. See the
> [Onboarding guide](ONBOARDING.md).

---

## 7. Why this is a great training project

As a student, working on AI Canva lets you touch a **real, deployed, multi-service app** — not a
toy. Depending on your focus, you can learn:

- **Frontend:** React components, hooks, a single central store, TypeScript, Tailwind.
- **AI & prompting:** prompt templates, system prompts, chaining outputs, structured output
  (parsing JSON from an LLM for slides/code).
- **Backend:** Express, REST endpoints, proxying third-party APIs, environment variables.
- **Cloud & realtime:** Firebase auth, Firestore, real-time sync, live cursors, security rules.
- **Ops:** building and deploying to Firebase Hosting + Cloud Functions.
- **Open source:** contributing to a real repo with docs, a license, and a contributing guide.

---

## 8. Where to go next

- **First-time setup:** [Onboarding & Environment Guide](ONBOARDING.md)
- **Codebase map / deep dive:** [Architecture](ARCHITECTURE.md)
- **The box system in detail:** [Box Types](BOX_TYPES.md)
- **Backend endpoints:** [API](API.md)
- **Ship it live:** [Deployment](DEPLOYMENT.md)
- **Pre-launch checks:** [Open-source readiness](OSS_READINESS.md)

Or start at the top-level [README](../README.md).
