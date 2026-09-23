# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Changed

- **File storage moved from Firebase Storage to Cloudflare R2** — board images and Documents-box
  originals upload via a new authenticated `POST /api/storage/sign` endpoint (presigned PUT) to an
  R2 bucket with public r2.dev reads and zero egress fees. Firestore/Auth/Hosting unchanged;
  `storage.rules` removed. Missing `R2_*` env vars degrade gracefully (document text kept, image
  upload fails like signed-out mode). Admin storage stats now read from R2.

### Added

- **Stitch UI box** — Google Stitch SDK integration for production-quality UI generation.
- **UI Design box** — generates polished React UIs with Tailwind CSS + Google Fonts
  (production-quality, Google Stitch style).
- **Dev Plan box** — transforms a PRD into a short, prototype-focused development plan
  (components, state, functions, build order) to feed the Code box.
- **Named box inputs** — editable box names in the header, `{{Box Name}}` prompt variables,
  and click-to-insert in settings. Backward compatible with `{{input_N}}`.
- **Streamlined Dev Plan prompt** — shorter and prototype-focused.
- **Firebase Cloud Functions** backend (`functions/`) mirroring the local Express server.

### Changed

- **Switched AI text generation from Claude/Anthropic to Ollama.** Text boxes now call
  Ollama's `/api/chat` against **Ollama Cloud** (`https://ollama.com`) using `OLLAMA_API_KEY`
  (configurable model via `OLLAMA_MODEL`, host via `OLLAMA_HOST`). The `@anthropic-ai/sdk`
  dependency and `claude.ts` provider files were removed from `server/` and `functions/`.

### Collaboration

- **Multi-user collaboration** — share boards by email, live cursors with colors + initials,
  real-time Firestore sync, presence tracking, ShareModal, and `?board=<id>` URL board loading.
- **Board sharing & presence** — live cursor presence with 30s staleness filter and presence
  cleanup on page close.

### Persistence & storage

- **Image uploads moved to Firebase Storage** — images upload to Storage instead of base64,
  so they sync to all collaborators via Firestore.

### Fixes

- Fixed real-time sync always calling `loadBoardFromFirestore` on login so `onSnapshot` is set
  up even when `currentBoardId` came from localStorage.
- Fixed auto-subscribe via `useEffect` on `currentBoardId` change (board switching,
  `createNewBoard`, etc.).
- Fixed host subscription reading `currentBoardId` directly from the store (avoided a stale
  closure from the persist middleware).
- Fixed bidirectional sync by comparing `updatedAt` instead of using a time-based echo guard
  (which was blocking guest updates while the owner was editing).
- Fixed stripping **all** `undefined` values from `boxData` (not just `imageData`) and corrected
  collaborator handling on load.
- Collaborators are no longer overwritten during save — only `shareBoard`/`unshareBoard` manage
  the list.
- Deleted `imageData` key instead of setting it to `undefined` (`updateDoc` rejects `undefined`).
- Guest saves use `updateBoardData` (no `ownerId` overwrite) + added `onSnapshot` error handlers
  and sync logging.
- Stripped base64 `imageData` from Firestore saves to stay under the 1 MB document limit;
  generated image URLs persist correctly.
- Added `.DS_Store` and `.firebase` to `.gitignore`.

---

## [0.1.0] — 2024

- Initial working version of the visual AI pipeline canvas.
- Core box types: Idea, Research, Summarize, Image, Cartoon Profile, Slides, Code, PRD.
- Express backend API proxy for the LLM provider (Ollama) and fal.ai image generation.
- Zustand store with localStorage persistence and debounced save.
- Automatic port detection and `.server-port` coordination between client and server.
