# Deployment

You can run relay three ways:

1. **Local development** — Vite + the local Express server (see the [README](../README.md)).
2. **Current production: Render + Firebase Hosting** — API as a Render Web Service, client on
   Firebase Hosting (Spark/free Firebase; **no Cloud Functions / Blaze plan**).
3. **Legacy/optional: Firebase Functions** — Hosting + Cloud Functions (**requires Blaze**). This
   path is not used by the current deployment.

This guide covers the current Render path first, then shared Firebase setup and the legacy
Functions path, then self-hosting.

> **Render quick path:**
> 1. Create a Render **Web Service** from this repo (Blueprint picks up `render.yaml`, root `server/`).
> 2. Set the env vars listed in `render.yaml` (Ollama + `R2_*` at minimum).
> 3. Deploy the client: `bash scripts/deploy-hosting.sh https://<your-render-service>.onrender.com`
> 4. For automated deploys, add the GitHub Actions secrets/variables in
>    [CI/CD with GitHub Actions](#cicd-with-github-actions).
>
> The client build embeds `VITE_API_BASE` so the browser calls Render directly (server CORS is open).

---

## Production on Render (current)

| Piece | Where |
|-------|--------|
| API (`server/`) | Render Web Service (`render.yaml`) |
| Client | Firebase Hosting (`scripts/deploy-hosting.sh`) |
| Auth + Firestore | Firebase (Spark free tier) |
| File blobs | Cloudflare R2 (unchanged) |

### 1. Create the Render service

- Render Dashboard → **New → Blueprint** → connect the GitHub repo → uses `render.yaml`, **or**
- **New → Web Service** → root directory `server` → build `npm ci && npm run build` → start `npm start`.

Copy the service URL (this repo's live API is `https://ai-canva-22-nbn.onrender.com`).

### 2. Set Render environment variables

From `render.yaml` / `server/.env.example` — at least:

- `OLLAMA_API_KEY` (required)
- `R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_BUCKET`, `R2_PUBLIC_BASE_URL`
- Optional: `OLLAMA_MODEL`, `OLLAMA_TEMPERATURE`, `FAL_KEY`, `STITCH_API_KEY`, `HERENOW_API_KEY`
- `FIREBASE_PROJECT_ID` defaults correctly for this repo (`ai-canva-22-nbn-fee4b`)

### 3. Deploy the client

```bash
bash scripts/deploy-hosting.sh https://ai-canva-22-nbn.onrender.com
```

Builds with `VITE_API_BASE=https://your-service.onrender.com/api` and runs
`firebase deploy --only hosting,firestore:rules` (no functions). This is also the command the
GitHub Actions deploy workflow runs after CI passes.

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

### CI/CD with GitHub Actions

The repo ships two workflows:

- **`ci.yml`** runs on every pull request and on pushes to `main`. It installs the root, server
  and client lockfiles with `npm ci`, builds both packages, runs all Vitest suites, then starts
  the real dev app and runs `client/markers-check.mjs` + `client/ui-smoke.mjs`. Those browser
  checks use the fake dev user and mocked `/api/generate`, so they need no Ollama key and no
  Firebase login.
- **`deploy.yml`** runs only after `CI` succeeds on `main` (or from a manual dispatch on `main`).
  It triggers the Render deploy hook pinned to the exact commit CI tested, waits for the new API
  deploy to be live (or falls back to the health endpoint), deploys Firebase Hosting + Firestore
  rules through `scripts/deploy-hosting.sh`, then smoke-tests the API and Hosting URLs. Google
  Cloud authentication uses Workload Identity Federation, so no service-account key is needed.

`render.yaml` sets `autoDeployTrigger: off` so the API is deployed exactly once, by the gated
workflow. Sync the Blueprint in Render after changing it so the setting takes effect. Use the
Render dashboard's **Manual Deploy** button (or the deploy hook) if you need an emergency deploy
outside CI.

Configure these in **GitHub → Settings → Secrets and variables → Actions**:

| Kind | Name | Required | Purpose |
|------|------|----------|---------|
| Variable | `PROD_API_URL` | Recommended | Render API base URL, e.g. `https://ai-canva-22-nbn.onrender.com`. Defaults to the live URL in the workflows. |
| Variable | `WEB_URL` | Recommended | Firebase Hosting URL, e.g. `https://ai-canva-22-nbn-fee4b.web.app`. Defaults to the live URL. |
| Variable | `FIREBASE_PROJECT_ID` | Optional | Firebase project to deploy; defaults to `ai-canva-22-nbn-fee4b`. |
| Variable | `RENDER_SERVICE_ID` | Optional | Render service id (`srv-...`); enables precise deploy-status polling. |
| Secret | `RENDER_DEPLOY_HOOK_URL` | **Yes** | Render → service → Settings → Deploy Hook. |
| Secret | `RENDER_API_KEY` | Optional | Render API key; with `RENDER_SERVICE_ID`, waits for the exact new deploy to be `live`. |
| Variable | `GCP_WORKLOAD_IDENTITY_PROVIDER` | **WIF auth** | Full Workload Identity Federation provider resource (see below). |
| Variable | `GCP_SERVICE_ACCOUNT_EMAIL` | **WIF auth** | Deploy service-account email, e.g. `github-deploy@ai-canva-22-nbn-fee4b.iam.gserviceaccount.com`. |
| Secret | `FIREBASE_SERVICE_ACCOUNT` | **JSON fallback** | Service-account JSON. Only use this if your organisation allows key creation. |

Use **one** Google Cloud authentication method:

#### Workload Identity Federation (recommended; no service-account key)

This is the path to use when the organisation policy blocks service-account key creation. The
service account still exists, but GitHub gets short-lived credentials through OIDC instead of a
downloadable JSON key.

Run these commands with a Google Cloud account that can create service accounts and set IAM
policy (replace `OWNER/REPO` with the GitHub repository, e.g.
`Alex-D-4089452/ai-canva-22-nbn`):

```bash
gcloud auth login
gcloud config set project ai-canva-22-nbn-fee4b

PROJECT_ID=ai-canva-22-nbn-fee4b
PROJECT_NUMBER=$(gcloud projects describe "$PROJECT_ID" --format='value(projectNumber)')
REPO=OWNER/REPO
SA=github-deploy@$PROJECT_ID.iam.gserviceaccount.com

gcloud services enable iamcredentials.googleapis.com sts.googleapis.com \
  --project="$PROJECT_ID"

gcloud iam service-accounts create github-deploy \
  --project="$PROJECT_ID" \
  --display-name="GitHub Actions deploy"

gcloud projects add-iam-policy-binding "$PROJECT_ID" \
  --member="serviceAccount:$SA" \
  --role="roles/firebasehosting.admin"
gcloud projects add-iam-policy-binding "$PROJECT_ID" \
  --member="serviceAccount:$SA" \
  --role="roles/firebaserules.admin"
# Optional if the CLI needs project read access:
gcloud projects add-iam-policy-binding "$PROJECT_ID" \
  --member="serviceAccount:$SA" \
  --role="roles/firebase.viewer"

gcloud iam workload-identity-pools create github \
  --project="$PROJECT_ID" \
  --location=global \
  --display-name="GitHub Actions"

gcloud iam workload-identity-pools providers create-oidc github \
  --project="$PROJECT_ID" \
  --location=global \
  --workload-identity-pool=github \
  --display-name="GitHub OIDC" \
  --issuer-uri="https://token.actions.githubusercontent.com" \
  --attribute-mapping="google.subject=assertion.sub,attribute.repository=assertion.repository,attribute.ref=assertion.ref" \
  --attribute-condition="assertion.repository=='$REPO' && assertion.ref=='refs/heads/main'"

gcloud iam service-accounts add-iam-policy-binding "$SA" \
  --project="$PROJECT_ID" \
  --role="roles/iam.workloadIdentityUser" \
  --member="principalSet://iam.googleapis.com/projects/$PROJECT_NUMBER/locations/global/workloadIdentityPools/github/attribute.repository/$REPO"
```

Then add these GitHub **variables**:

- `GCP_WORKLOAD_IDENTITY_PROVIDER` =
  `projects/$PROJECT_NUMBER/locations/global/workloadIdentityPools/github/providers/github`
- `GCP_SERVICE_ACCOUNT_EMAIL` =
  `github-deploy@ai-canva-22-nbn-fee4b.iam.gserviceaccount.com`

The deploy workflow already requests `id-token: write` and uses these values automatically.

#### Service-account JSON (fallback only)

If key creation is allowed, create a JSON key for the same service account and store the entire
file contents as the `FIREBASE_SERVICE_ACCOUNT` secret. The service account needs Firebase Hosting
Admin + Firebase Rules Admin (and project read access). Do not commit the JSON.

**Not in CI yet:** the full E2E (`client/e2e.mjs`) needs real Firebase Auth/Firestore, a real
Ollama call, and a `firebase-tools` admin token from the developer machine. Run it locally or add
it as a separately configured nightly workflow after moving those credentials into CI.

### Render limitations (same as local server)

- **Workshop join / admin roles / admin stats** need a service account or a proxy:
  set `WORKSHOP_PROXY_URL` (or future `WORKSHOP_SERVICE_ACCOUNT`) on Render — otherwise those routes return **501**.
- Free instances **spin down** when idle → first request after idle is slow (cold start).
- In-memory Stitch job store is per-instance (fine for a single free instance).

---

## Firebase project setup (shared)

### Prerequisites

- A [Firebase](https://console.firebase.google.com) project.
- The [Firebase CLI](https://firebase.google.com/docs/cli) installed and logged in:
  ```bash
  npm install -g firebase-tools
  firebase login
  ```
- Real API keys (Ollama, and optionally fal.ai + Google Stitch).

### Enable Firebase services

1. **Authentication** — Console → Authentication → Sign-in method → **Google** → Enable.
2. **Firestore** — Console → Firestore Database → Create database (start in production mode).
3. **Hosting** — no console step needed; enabled by the deploy config.
4. **Cloudflare R2** (file blobs, replaces Firebase Storage) — create a bucket at
   [dash.cloudflare.com](https://dash.cloudflare.com) → R2, enable its **Public Development URL**,
   and create an API token with Object Read & Write. Put `R2_ACCOUNT_ID`,
   `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_BUCKET`, `R2_PUBLIC_BASE_URL` in
   `server/.env` for local dev and in the **Render dashboard** for production (see the Render
   section above).

### Point the app at your Firebase project

The client config lives in `client/src/lib/firebase.ts`. Replace the hardcoded `firebaseConfig`
with your own project's web app config:

```
Console → Project Settings → Your apps → Web app → SDK setup and configuration
```

Copy the `apiKey`, `authDomain`, `projectId`, `messagingSenderId`, and `appId`
into `firebaseConfig` (no `storageBucket` — file storage is Cloudflare R2).

> **For open hosting:** prefer reading these from environment variables (`VITE_FIREBASE_*`) at
> build time rather than hardcoding them. See [OSS_READINESS.md](OSS_READINESS.md).

### Publish security rules

Deploy the rules that ship in the repo:

```bash
firebase deploy --only firestore:rules
```

> **Important:** `firestore.rules` currently contains a **permissive placeholder** (any signed-in
> user can read/update any board). Before deploying to the public, replace it with the
> ownership/collaborator rules in [OSS_READINESS.md](OSS_READINESS.md).

### Configure the API environment

Create `server/.env` from `server/.env.example` for local development, and set the same variables
in the Render dashboard for production:

```bash
cp server/.env.example server/.env
# OLLAMA_API_KEY=your-ollama-api-key
# OLLAMA_MODEL=deepseek-v4.1-flash
# FAL_KEY=...
# STITCH_API_KEY=...
```

> `server/.env` is git-ignored. Never commit real keys.
> For the legacy Functions path, mirror the values into `functions/.env`.

### Set the deploy target project

The repo's `.firebaserc` defaults to `ai-canva-22-nbn-fee4b`. To use your own project:

```bash
firebase use <your-project-id>
```

## Deploy the client (current path)

```bash
bash scripts/deploy-hosting.sh https://<your-render-service>.onrender.com
```

This builds the client with `VITE_API_BASE` pointing at Render and deploys Hosting + Firestore
rules only.

### Legacy: deploy the Firebase Functions path (optional)

> This path requires the **Blaze** plan and is **not used by the current deployment**.

```bash
cd client && npm run build && cd ..
firebase deploy --only hosting,functions,firestore:rules
```

The current `firebase.json` rewrites all routes to `index.html` and does **not** proxy `/api/**`;
it is configured for the Render path. To use the legacy Functions path, add a Hosting rewrite
from `/api/**` to the `api` function. The `api` function is configured for `maxInstances: 5`,
`timeoutSeconds: 120`, `memory: 512MiB`.

After deploy, open your Hosting URL. Sign in with Google to get cloud save and collaboration.

---

## Self-hosting the Express API

The Render service is the supported production host, but you can also run the Express server
directly:

```bash
cd server
npm run build && npm start
```

Set `PORT` in `server/.env` if needed. In this mode the client still needs Firebase for auth and
persistence. Build the client with `VITE_API_BASE` pointing at your server, or put a reverse
proxy / CDN in front and forward `/api` to it.

---

## Troubleshooting

| Problem | Check |
|---------|-------|
| `OLLAMA_API_KEY is not configured` / request fails | The key is missing from the Render environment or `server/.env`. |
| Boards don't sync | Auth is enabled + rules permit access; the user is signed in. |
| `404` on `/api/*` in prod | `VITE_API_BASE` points at the Render URL and the Render service is healthy. |
| `501` from admin/workshop/R2 routes | Configure the Admin SDK proxy or R2 environment variables (see the Render limitations above). |
| Deploy fails on rules | Replace the placeholder rules with the strict ones from OSS_READINESS. |
