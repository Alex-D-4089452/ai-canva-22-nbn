---
name: ai-canva-deploy
description: Deploy the ai-canva project (a React + Firebase + Ollama-powered whiteboard app) to production on Firebase Hosting and Cloud Functions. Use when the user asks to deploy or re-deploy the app, when a build+deploy for production is requested, when Firebase hosting/function/rules deploys come up, or when verifying live hosting and API URLs. Invokes scripts/deploy.sh and the steps in docs/DEPLOYMENT.md.
---

# Deploying AI Canva

AI Canva is a collaborative AI whiteboard: a Vite React client, an Express-style API,
Firebase (Auth + Firestore) for accounts and board sync, and Cloudflare R2 for file blobs
(images/documents). Production hosting and
the API run on Firebase. This skill is the agent-facing deployment playbook; run it when asked
to deploy.

## Quick path (recommended)

Deploy is a single deterministic command:

```bash
bash scripts/deploy.sh            # or: npm run deploy
FIREBASE_PROJECT=my-proj bash scripts/deploy.sh   # to a different project
```

The script builds the client, clean-builds the Cloud Functions, copies `OLLAMA_API_KEY` and any
`R2_*` storage keys into `functions/.env`, and runs `firebase deploy`. Always drive the
deployment through this script
rather than re-typing the steps, so the gotchas below stay encoded.

## Prerequisites

- `firebase` CLI installed and logged in (`firebase login`). Check with `firebase --version`
  and `firebase login:list`.
- `server/.env` populated with at least `OLLAMA_API_KEY` (plus `FAL_KEY`, `STITCH_API_KEY` for
  the Cartoon / Stitch boxes). The script copies the Ollama key into `functions/.env` if missing.
- `R2_*` keys in `server/.env` (Cloudflare R2) for board image/document uploads — the script
  copies them into `functions/.env` too. Without them uploads return 501 (app still runs).
- Default deploy target is `ai-canva-22-nbn-fee4b` (from `.firebaserc`), which matches the hardcoded
  Firebase config in `client/src/lib/firebase.ts`. If you deploy elsewhere, update that config
  too.

## Manual steps (what the script does)

1. **Build client** from the client dir — Vite needs cwd = `client/` to find `index.html`:
   `( cd client && npm run build )` → produces `client/dist`.
2. **Clean + rebuild functions** — a stale provider file can linger in `functions/dist` between
   builds (we saw an old `claude.js` do this). `rm -rf functions/dist` then
   `( cd functions && npm run build )`.
3. **Env**: ensure `functions/.env` has `OLLAMA_API_KEY` (copy from `server/.env`; never echo
   the value). The deploy log confirms `Loaded environment variables from functions/.env`.
4. **Deploy**: `firebase deploy --project <PROJECT>` — deploys storage rules, firestore rules,
   the `api` Cloud Function (2nd-gen `onRequest`), and hosting. `firebase.json` rewrites
   `/api/**` to the `api` function and everything else to `index.html`.

## Verify the deploy

```bash
curl -s -o /dev/null -w "%{http_code}\n" https://<PROJECT>.web.app/          # expect 200
curl -s https://<PROJECT>.web.app/api/health
# expect {"status":"ok","ollamaKey":"configured","falKey":"configured","stitchKey":"configured"}
curl -s -X POST https://<PROJECT>.web.app/api/generate \
  -H 'Content-Type: application/json' -d '{"systemPrompt":"Reply with one word.","userPrompt":"hi"}'
# expect {"content":"<a word>"}
```

## Gotchas and notes learned in production

- **cwd matters for the local server**: `server/.env` is loaded by `dotenv` from the server's
  working directory. Run the local server via `npm run dev` (cwd = `server/`) — starting it from
  the repo root makes it miss the key.
- **`functions/.env` vs `server/.env`**: production text generation needs `OLLAMA_API_KEY` in
  `functions/.env`; a copy is usually made from `server/.env`. Without it, `/api/generate`
  fails at runtime even though deploy succeeds.
- **Firestore rules are permissive today**: `firestore.rules` allow any signed-in user to
  read/edit any board (marked TEMPORARY). It deploys as-is. For a public launch, tighten to the
  ownership/collaborator rules in `docs/OSS_READINESS.md` before deploying.
- **Runtime warnings** (non-blocking): the functions runtime is Node.js 20, deprecated
  (decommission ~2026-10-30) — plan an upgrade; and `firebase-functions@^6` is outdated.
- **Auth model**: the client hardcodes the Firebase web config in `client/src/lib/firebase.ts`.
  For open-source forks, make it env-driven (`VITE_FIREBASE_*`).

## Outputs on success

- Hosting URL: `https://<PROJECT>.web.app`
- Function URL is printed by the deploy (e.g. `https://api-<id>-uc.a.run.app`)
- Firebase console: `https://console.firebase.google.com/project/<PROJECT>/overview`

## References

- Human guide: `docs/DEPLOYMENT.md`
- Open-source-readiness / rules hardening: `docs/OSS_READINESS.md`
- The deterministic script: `scripts/deploy.sh`
