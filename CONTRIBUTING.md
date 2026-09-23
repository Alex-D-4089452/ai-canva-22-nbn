# Contributing to AI Canva

Thanks for your interest in contributing! 🎨 We welcome bug reports, feature ideas, documentation, and code.

## Table of contents

- [Code of Conduct](#code-of-conduct)
- [Getting started](#getting-started)
- [How to contribute](#how-to-contribute)
  - [Reporting bugs](#reporting-bugs)
  - [Suggesting features](#suggesting-features)
  - [Submitting changes](#submitting-changes)
- [Development setup](#development-setup)
- [Project layout](#project-layout)
- [Style & conventions](#style--conventions)
- [Testing](#testing)
- [Commit messages](#commit-messages)

## Code of Conduct

Everyone interacting in this project is expected to follow the [Code of Conduct](CODE_OF_CONDUCT.md). Harassment of any kind is not tolerated.

## Getting started

To build and run locally, follow the [Quick Start](README.md#-quick-start-local-development) in the README. You'll need:

- Node.js (see `engines`/`package.json`; the project targets modern Node)
- Real API keys for Ollama (required for text boxes), and optionally fal.ai and Google Stitch
- Optional: a Firebase project for cloud save, auth, and collaboration

## How to contribute

### Reporting bugs

- Search the [issue tracker](../../issues) first — it may already be reported.
- Open a new issue using the **Bug report** template. Include:
  - Steps to reproduce
  - Expected vs. actual behavior
  - Browser, OS, and Node version
  - Any relevant console output (redact API keys!)

### Suggesting features

- Open an issue using the **Feature request** template, or start a discussion if you're unsure.
- Explain the problem you're solving and how the feature would work — not just the feature name.

### Submitting changes

1. **Fork** the repo and create a branch from `main`.
   ```bash
   git checkout -b feature/your-feature-name
   ```
2. **Make your changes.** Keep them focused; one logical change per PR.
3. **Test** your changes locally (`npm run dev`). Add/adjust tests if the project has them.
4. **Keep prompts in `client/src/types.ts`** as sensible defaults — per-box prompts live there.
5. **Commit** with a clear, imperative message (see [below](#commit)).
6. **Push** and open a Pull Request against `main`. Reference any related issue in the description.

We welcome PRs of any size — a typo fix is as appreciated as a new box type.

## Development setup

```bash
npm install          # root
npm run install:all  # server + client
npm run dev          # both dev servers with hot reload
```

Open the client at `http://localhost:5173`. The dev servers auto-select free ports; the client
reads the server's actual port from `.server-port` so the `/api` proxy stays in sync.

## Project layout

```
client/     Vite + React 19 + TypeScript + Tailwind + Zustand + React Flow
server/     Express API used for local development (Ollama / fal.ai / Stitch)
functions/  Firebase Cloud Functions — the production backend (mirrors server/)
```

- **Box definitions** (labels, icons, colors, default prompts, sizes) live in
  `client/src/types.ts` (`BOX_TYPES`).
- **Canvas + node UI** in `client/src/components/` (`BoxNode.tsx` renders every box type).
- **State + run logic** in `client/src/store/boardStore.ts`.
- **AI/prompt filling** in `client/src/lib/` (`api.ts`, `prompts.ts`, `code.ts`).
- **Firebase + storage** in `client/src/lib/` (`firebase.ts`, `firestore.ts`, `storage.ts`,
  `auth.ts`) and `firestore.rules` (file blobs go to Cloudflare R2 via `server/src/r2.ts` /
  `functions/src/r2.ts`, not Firebase Storage).

## Style & conventions

- TypeScript strict mode is enabled in all packages.
- Existing code uses a consistent, readable style — follow it. We don't enforce a formatter today,
  but keep lines readable and formatting consistent with surrounding code.
- Export named functions/consts; prefer `import type { ... }` for type-only imports.
- Add meaningful `/** JSDoc */` comments on non-trivial functions.
- Don't commit `node_modules/`, build output, `.env` files, or `.server-port`.

## Testing

There is currently no automated test suite. Until tests exist:

- Manually verify the box(es) you touched in both logged-in and logged-out modes.
- Confirm boards still save/load and real-time sync still works (if you changed `boardStore` or
  the Firestore layer).

If you add tests, place them next to the code they cover.

## Commit messages

Write clear, imperative commit messages. Reference issues where relevant. Examples:

```
Add a Mind Map box type to the canvas

- Adds meta in types.ts and rendering in BoxNode.tsx
- Fixes #12
```

## Getting help

Open an issue or start a discussion. We're friendly — don't hesitate to ask.
