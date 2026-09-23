# Open-source readiness checklist

The repo is functional, but there are a few items to address before running it as a healthy open
**source** and open **deployment**. This page documents them as actionable issues — nothing here
changes the code automatically. Each item maps to a recommended GitHub issue.

> **Why these matter:** AI Canva has paid AI backends (Ollama / fal.ai / Stitch) and a Firebase
> backend with auth and shared boards. Left as-is, a public instance could let anyone burn your
> API quota, read other users' boards, or write to your storage bucket.

---

## 🔴 1. Firestore rules allow any signed-in user to read/update any board

**File:** `firestore.rules`

Current state:

```
match /boards/{boardId} {
  // TEMPORARY: allow any authenticated user to read/update for debugging
  allow read, update: if request.auth != null;
  ...
}
```

This means **every logged-in user can read and edit every board** — including boards they were
never shared with. It's marked "TEMPORARY" in the file, likely left over from debugging
real-time sync.

**Recommended replacement** — ownership + collaborator gating (board creators can edit; users
invited by email as collaborators can edit; presence is self-scoped):

```c
rules_version = '2';

service cloud.firestore {
  match /databases/{database}/documents {
    match /boards/{boardId} {
      // Owner or an invited collaborator can read/update.
      allow read: if request.auth != null &&
        (request.auth.uid == resource.data.ownerId ||
         request.auth.token.email in (resource.data.collaborators || []));
      allow create: if request.auth != null &&
        request.auth.uid == request.resource.data.ownerId;
      allow update: if request.auth != null &&
        (request.auth.uid == resource.data.ownerId ||
         request.auth.token.email in (resource.data.collaborators || []));
      // Only the owner can delete.
      allow delete: if request.auth != null &&
        request.auth.uid == resource.data.ownerId;

      match /presence/{userId} {
        allow read: if request.auth != null;
        allow create, update, delete: if request.auth != null &&
          request.auth.uid == userId;
      }
    }
  }
}
```

> Note: a collaborator must be a **Firebase-authenticated** user whose email matches a value in
> `collaborators`. Because Google sign-in is used, `request.auth.token.email` will be populated.
> Test carefully — collaborators are matched by email, and the app writes `ownerEmail` for the
> owner.

**Issues to file:** "Harden Firestore security rules to enforce board ownership + collaborators".

---

## 🔴 2. Hardcoded Firebase configuration in the client

**File:** `client/src/lib/firebase.ts`

`firebaseConfig` is hardcoded to a real project (`carbondocs`), including its web API key. While
Firebase **web API keys are public identifiers** (not secrets), hardcoding a specific project
means every fork runs against the original author's Firebase project, and it's not configurable
per-deployment.

**Recommended change:** read the config from environment variables at build time
(`VITE_FIREBASE_API_KEY`, `VITE_FIREBASE_AUTH_DOMAIN`, etc.) via Vite's `import.meta.env`, with
documented fallbacks. Update [DEPLOYMENT.md](DEPLOYMENT.md) accordingly.

**Issues to file:** "Make Firebase client config env-driven (VITE_FIREBASE_* vars)"

---

## 🟠 3. API endpoints are unauthenticated and not rate-limited

**Files:** `server/src/index.ts`, `functions/src/index.ts`, `docs/API.md`

`/api/generate`, `/api/generate-image`, and `/api/stitch-generate` are open to anyone who can
reach the server/function. Each call costs money (Ollama usage, fal.ai credits, Stitch quota).
There's no auth, no quota, and no rate limiting.

**Action:** For any public deployment, add (at minimum) API-key auth or user-ID checks plus rate
limiting before exposing the API.

**Issues to file:** "Authenticate + rate-limit AI generation endpoints"

---

## 🟠 4. Board file storage: public reads + open sign endpoint

**Files:** `server/src/r2.ts` / `functions/src/r2.ts`, `POST /api/storage/sign`

Board images and documents live in a **Cloudflare R2** bucket. Two properties to be aware of
before a public deploy:

- **Reads are public** via the bucket's r2.dev URL (the durable link stored in Firestore).
  Anyone who obtains a URL can fetch that file — the same effective model as the old Firebase
  download-token URLs. If you need private files, switch to short-lived signed GET URLs and
  store object keys instead of URLs.
- **Writes require a Firebase ID token** on `POST /api/storage/sign`, but the sign endpoint is
  otherwise unauthenticated in the same way the rest of the API is (see §3): it validates the
  `key` path strictly, yet does not yet check board membership. Tighten to "caller must be a
  board owner/collaborator" if you deploy publicly.

**Issues to file:** "Restrict storage sign to board collaborators; consider private R2 reads"

---

## 🟡 5. Version metadata and project identity

- `package.json` version is `0.1.0`; the CHANGELOG uses `[Unreleased]`. The project has never
  made a tagged release.
- The `.firebaserc` default project (`carbondocs`) is a personal project. A published fork should
  either remove it or make it clearly a placeholder.
- Consider a `repository` / `homepage` / `bugs` field in `package.json` so npm badges and
  contributor flows resolve correctly.

**Issues to file:** "Prepare first tagged release + package metadata"

---

## 🟡 6. No automated tests, linter, or CI

There is currently no test suite, ESLint, Prettier, or CI workflow. For a healthy OSS project,
add at least a basic CI (e.g. GitHub Actions) that type-checks and builds `client`, `server`, and
`functions`.

**Issues to file:** "Add CI (typecheck + build), linter, and initial tests"

---

## ✅ Already good for OSS

- `.env` files and secrets are git-ignored; `.env.example` templates are committed.
- `.gitignore` excludes `node_modules/`, `dist/`, `.server-port`, `.DS_Store`, `.firebase/`.
- Sensitive default prompts and box metadata are centralized and documented.
- README + docs now describe the current architecture, box types, and deployment.

---

## Suggested issue labels

- `security` — items 1–4
- `good first issue` — item 6
- `documentation` — item 5

File these as GitHub issues and track them as you prepare the first public release.
