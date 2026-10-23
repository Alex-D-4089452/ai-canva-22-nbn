---
name: ai-canva-deploy
description: Deploy the relay project (a React + Firebase + Ollama-powered whiteboard app) to production with the client on Firebase Hosting and the API on Render. Use when the user asks to deploy or re-deploy, when Firebase Hosting/Render deploys come up, or when verifying live hosting and API URLs. Invokes scripts/deploy-hosting.sh and the steps in docs/DEPLOYMENT.md.
---

# Deploying relay

relay is a collaborative AI whiteboard: a Vite React client, an Express API, Firebase
(Auth + Firestore) for accounts and board sync, and Cloudflare R2 for file blobs
(images/documents).

The current production deployment is:

- **Client:** static Vite build on **Firebase Hosting**
- **API:** Express `server/` on **Render** (free plan; **no Cloud Functions / Blaze**)
- **Auth + board sync:** Firebase Auth + Firestore
- **File blobs:** Cloudflare R2

The Firebase Functions copy in `functions/` and `scripts/deploy.sh` are **legacy/optional** and
require the Blaze plan. Do not use them unless the user explicitly asks for the Firebase-only path.

## Current path (Render + Firebase Hosting)

### 1. Confirm the Render API

- Render Dashboard → **New → Blueprint** → connect the GitHub repo → uses `render.yaml`, **or**
  **New → Web Service** → root directory `server` → build `npm install && npm run build` → start
  `npm start`.
- Set the env vars from `render.yaml` / `server/.env.example` in the Render dashboard:
  `OLLAMA_API_KEY` (required), the `R2_*` keys for uploads, and optionally `OLLAMA_MODEL`,
  `FAL_KEY`, `STITCH_API_KEY`, `HERENOW_API_KEY`.
- Copy the public service URL, e.g. `https://ai-canva-22-nbn.onrender.com`. Verify
  `GET <url>/api/health`.

### 2. Deploy the client

```bash
bash scripts/deploy-hosting.sh https://<your-render-service>.onrender.com
```

This writes `client/.env.production` with `VITE_API_BASE` and runs
`firebase deploy --only hosting,firestore:rules`. It does **not** deploy Cloud Functions.

### 3. R2 CORS

In the Cloudflare R2 bucket → **Settings → CORS policy**, allow the Hosting origin:
`https://ai-canva-22-nbn-fee4b.web.app` (and `http://localhost:5173` for local dev). Allow
`GET`, `HEAD`, `PUT`.

## Verify the deploy

```bash
curl -s -o /dev/null -w "%{http_code}\n" https://ai-canva-22-nbn-fee4b.web.app/   # expect 200
curl -s https://<your-render-service>.onrender.com/api/health
# expect {"status":"ok","ollamaKey":"configured",...}
curl -s -X POST https://<your-render-service>.onrender.com/api/generate \
  -H 'Content-Type: application/json' \
  -d '{"systemPrompt":"Reply with one word.","userPrompt":"hi"}'
# expect {"content":"<a word>", ...}
```

## Notes and gotchas

- **`VITE_API_BASE` is baked in at build time.** If the Render URL changes, re-run
  `scripts/deploy-hosting.sh` with the new URL.
- **Render free instances spin down when idle**, so the first request can be slow (cold start).
- **Admin-SDK routes are unavailable on Render by default:** admin stats/roles and workshop join
  return `501` unless a service account or `WORKSHOP_PROXY_URL` is configured. Normal board, AI,
  and storage flows work.
- **Stitch jobs use an in-memory store** on Render, so jobs are per-instance (fine for a single
  free instance).
- **Local server cwd matters:** run `npm run dev` from the repo root or `server/` so
  `server/.env` loads.
- **Firestore rules are permissive today.** Tighten them via `docs/OSS_READINESS.md` before a
  public launch.
- The default Firebase project is `ai-canva-22-nbn-fee4b` (`.firebaserc`, matching
  `client/src/lib/firebase.ts`).

## Legacy: Firebase Functions path

```bash
bash scripts/deploy.sh            # or: npm run deploy
```

This path requires Blaze, builds `functions/`, and deploys Hosting + Functions + rules. The
current `firebase.json` does not proxy `/api/**` to a function; it is configured for the Render
path. See `docs/DEPLOYMENT.md` for the legacy details.

## References

- Human guide: `docs/DEPLOYMENT.md`
- Architecture: `docs/ARCHITECTURE.md`
- Open-source-readiness / rules hardening: `docs/OSS_READINESS.md`
- Current client deploy script: `scripts/deploy-hosting.sh`
- Legacy Firebase deploy script: `scripts/deploy.sh`
