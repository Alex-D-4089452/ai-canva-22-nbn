# Deployment

You can run AI Canva three ways:

1. **Local development** — Vite + the local Express server (see the [README](../README.md)).
2. **Production on Render (recommended, Spark/free Firebase)** — API as a Render Web Service,
   client on Firebase Hosting (static only — **no Cloud Functions / Blaze plan**).
3. **Production on Firebase** — Hosting + Cloud Functions (**requires Blaze**).

This guide covers the Render path first, then Firebase Functions, then self-hosting.

> **Render quick path:**
> 1. Create a Render **Web Service** from this repo (Blueprint picks up `render.yaml`, root `server/`).
> 2. Set the env vars listed in `render.yaml` (Ollama + `R2_*` at minimum).
> 3. Deploy the client: `bash scripts/deploy-hosting.sh https://<your-render-service>.onrender.com`
>
> The client build embeds `VITE_API_BASE` so the browser calls Render directly (server CORS is open).

---

## Production on Render (no Blaze)

| Piece | Where |
|-------|--------|
| API (`server/`) | Render Web Service (`render.yaml`) |
| Client | Firebase Hosting (`scripts/deploy-hosting.sh`) |
| Auth + Firestore | Firebase (Spark free tier) |
| File blobs | Cloudflare R2 (unchanged) |

### 1. Create the Render service

- Render Dashboard → **New → Blueprint** → connect the GitHub repo → uses `render.yaml`, **or**
- **New → Web Service** → root directory `server` → build `npm install && npm run build` → start `npm start`.

Copy the service URL (this repo's live API is `https://ai-canva-22-nbn.onrender.com`).

### 2. Set Render environment variables

From `render.yaml` / `server/.env.example` — at least:

- `OLLAMA_API_KEY` (required)
- `R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_BUCKET`, `R2_PUBLIC_BASE_URL`
- Optional: `OLLAMA_MODEL`, `FAL_KEY`, `STITCH_API_KEY`, `GITHUB_TOKEN`, `HERENOW_API_KEY`
- `FIREBASE_PROJECT_ID` defaults correctly for this repo (`ai-canva-22-nbn-fee4b`)

### 3. Deploy the client

```bash
bash scripts/deploy-hosting.sh https://ai-canva-22-nbn.onrender.com
```

Builds with `VITE_API_BASE=https://your-service.onrender.com/api` and runs
`firebase deploy --only hosting,firestore:rules` (no functions).

### 4. R2 CORS (browser uploads)

In the Cloudflare R2 bucket **Settings → CORS policy**, allow your Hosting origin:

```json
[
  {
    "AllowedOrigins": [
      "http://localhost:5173",
      "https://ai-canva-22-nbn-fee4b.web.app",
      "https://ai-canva-22-nbn-fee4b.firebaseapp.com"
    ],
    "AllowedMethods": ["GET", "HEAD", "PUT"],
    "AllowedHeaders": ["*"],
    "ExposeHeaders": ["ETag", "Content-Type"],
    "MaxAgeSeconds": 3600
  }
]
```

### Render limitations (same as local server)

- **Workshop join / admin role admin / admin stats** need a service account or a proxy:
  set `WORKSHOP_PROXY_URL` (or future `WORKSHOP_SERVICE_ACCOUNT`) on Render — otherwise those routes return **501**.
- Free instances **spin down** when idle → first request after idle is slow (cold start).
- In-memory Stitch job store is per-instance (fine for a single free instance).

---

## Production on Firebase (requires Blaze)

> Cloud Functions require the **Blaze (pay-as-you-go)** plan. Prefer the Render path above if you want $0.

---

## Prerequisites

- A [Firebase](https://console.firebase.google.com) project.
- The [Firebase CLI](https://firebase.google.com/docs/cli) installed and logged in:
  ```bash
  npm install -g firebase-tools
  firebase login
  ```
- Real API keys (Ollama, and optionally fal.ai + Google Stitch).

## 2. Enable Firebase services

1. **Authentication** — Console → Authentication → Sign-in method → **Google** → Enable.
2. **Firestore** — Console → Firestore Database → Create database (start in production mode).
3. **Hosting** — no console step needed; enabled by the deploy config.
4. **Cloudflare R2** (file blobs, replaces Firebase Storage) — create a bucket at
   [dash.cloudflare.com](https://dash.cloudflare.com) → R2, enable its **Public Development URL**,
   and create an API token with Object Read & Write. Put `R2_ACCOUNT_ID`,
   `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_BUCKET`, `R2_PUBLIC_BASE_URL` in
   `server/.env` (the deploy script copies them to `functions/.env`).

## 3. Point the app at your Firebase project

The client config lives in `client/src/lib/firebase.ts`. Replace the hardcoded `firebaseConfig`
with your own project's web app config:

```
Console → Project Settings → Your apps → Web app → SDK setup and configuration
```

Copy the `apiKey`, `authDomain`, `projectId`, `messagingSenderId`, and `appId`
into `firebaseConfig` (no `storageBucket` — file storage is Cloudflare R2).

> **For open hosting:** prefer reading these from environment variables (`VITE_FIREBASE_*`) at
> build time rather than hardcoding them. See [OSS_READINESS.md](OSS_READINESS.md).

## 4. Publish security rules

Deploy the rules that ship in the repo:

```bash
firebase deploy --only firestore:rules
```

> **Important:** `firestore.rules` currently contains a **permissive placeholder** (any signed-in
> user can read/update any board). Before deploying to the public, replace it with the
> ownership/collaborator rules in [OSS_READINESS.md](OSS_READINESS.md).

## 5. Configure the Cloud Function environment

Create `functions/.env` from `functions/.env.example` and set your real keys:

```bash
cp functions/.env.example functions/.env
# OLLAMA_API_KEY=your-ollama-api-key
# OLLAMA_MODEL=deepseek-v4.1-flash
# FAL_KEY=...
# STITCH_API_KEY=...
```

> `functions/.env` is git-ignored. Never commit real keys.

## 6. Set the deploy target project

The repo ships a `.firebaserc` with `carbondocs` as the default project. Set it to your project:

```bash
firebase use <your-project-id>
```

## 7. Build and deploy

```bash
# Build the client (produces client/dist)
cd client && npm run build && cd ..

# Deploy hosting + functions + rules
firebase deploy
```

This deploys:
- **Hosting** — the built client at your Firebase Hosting URL. `firebase.json` rewrites `/api/**`
  to the `api` Cloud Function and all other routes to `index.html` (SPA).
- **Functions** — the `api` Cloud Function (`onRequest`), configured for `maxInstances: 5`,
  `timeoutSeconds: 120`, `memory: 512MiB`.

After deploy, open your Hosting URL. Sign in with Google to get cloud save and collaboration.

---

## Self-hosting the server instead

If you'd rather not use Firebase Functions, you can run the Express server directly:

```bash
cd server
npm run build && npm start
```

Set `PORT` in `server/.env` if needed. In this mode the client still needs Firebase for auth and
persistence, and the Vite proxy (dev only) must point `/api` at your server — in production you'd
configure your reverse proxy / CDN to forward `/api` to the server.

---

## Troubleshooting

| Problem | Check |
|---------|-------|
| `OLLAMA_API_KEY is not configured` / request fails | The key is missing from `functions/.env` or `server/.env`. |
| Boards don't sync | Auth is enabled + rules permit access; the user is signed in. |
| `404` on `/api/*` in prod | Cloud Function named `api` exists and hosting rewrites are in `firebase.json`. |
| Deploy fails on rules | Replace the placeholder rules with the strict ones from OSS_READINESS. |
