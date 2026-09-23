#!/usr/bin/env bash
#
# Deploy AI Canva to Firebase (Hosting + Cloud Functions + Firestore rules).
#
# This script encodes the deployment know-how for this repo so a deploy is one
# deterministic command for humans, CI, and AI agents. It handles the gotchas:
#   - builds the client from the client/ dir (Vite needs cwd = client/ for index.html)
#   - cleans functions/dist so stale provider files (e.g. an old claude.js) never ship
#   - copies OLLAMA_API_KEY and R2_* from server/.env into functions/.env (never echoes them)
#   - deploys the project, then you can verify via the URLs printed at the end
#
# Prereqs:
#   - firebase CLI installed and logged in (firebase login)
#   - server/.env populated with OLLAMA_API_KEY (+ FAL_KEY / STITCH_API_KEY as needed)
#   - R2_* keys in server/.env for board image/document uploads (Cloudflare R2)
#   - functions/.env with your keys (this script ensures OLLAMA_API_KEY + R2_* are present)
#
# Usage:
#   bash scripts/deploy.sh                 # deploy to default project (ai-canva-22-nbn-fee4b)
#   FIREBASE_PROJECT=my-proj bash scripts/deploy.sh

set -euo pipefail

# Target project. Defaults to the value in .firebaserc (ai-canva-22-nbn-fee4b).
PROJECT="${FIREBASE_PROJECT:-ai-canva-22-nbn-fee4b}"

# Resolve the repo root regardless of where the script is invoked from.
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

echo "==> Deploy target project: $PROJECT"
firebase use "$PROJECT"

echo "==> Checking server/.env has OLLAMA_API_KEY"
if [ ! -f server/.env ]; then
  echo "ERROR: server/.env not found. Copy server/.env.example to server/.env and add keys." >&2
  exit 1
fi
if ! grep -q '^OLLAMA_API_KEY=' server/.env; then
  echo "ERROR: server/.env has no OLLAMA_API_KEY. Set it first." >&2
  exit 1
fi

echo "==> Ensuring OLLAMA_API_KEY is present in functions/.env"
touch functions/.env
if ! grep -q '^OLLAMA_API_KEY=' functions/.env; then
  grep '^OLLAMA_API_KEY=' server/.env | head -1 >> functions/.env
  echo "   copied OLLAMA_API_KEY into functions/.env (value not echoed)"
fi

echo "==> Ensuring R2_* storage keys are present in functions/.env"
for KEY in R2_ACCOUNT_ID R2_ACCESS_KEY_ID R2_SECRET_ACCESS_KEY R2_BUCKET R2_PUBLIC_BASE_URL; do
  if grep -q "^${KEY}=" server/.env && ! grep -q "^${KEY}=" functions/.env; then
    grep "^${KEY}=" server/.env | head -1 >> functions/.env
    echo "   copied ${KEY} into functions/.env (value not echoed)"
  fi
done
if ! grep -q '^R2_ACCOUNT_ID=' functions/.env; then
  echo "   WARNING: no R2_* keys found — board image/document uploads will return 501."
fi

echo "==> Building client (from client/)"
( cd client && npm run build )

echo "==> Building functions (cleaning dist to drop stale provider files)"
rm -rf functions/dist
( cd functions && npm run build )

echo "==> Deploying to $PROJECT (hosting + functions + firestore rules)"
firebase deploy --project "$PROJECT"

echo
echo "==> Deploy complete."
echo "   Hosting URL:  https://$PROJECT.web.app"
echo "   Verify with:"
echo "     curl -s https://$PROJECT.web.app/"
echo "     curl -s https://$PROJECT.web.app/api/health"
echo "     curl -s -X POST https://$PROJECT.web.app/api/generate -H 'Content-Type: application/json' -d '{\"userPrompt\":\"Say hi\"}'"
