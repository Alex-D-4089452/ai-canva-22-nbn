#!/usr/bin/env bash
#
# Deploy the CLIENT ONLY to Firebase Hosting (Spark plan — no Cloud Functions / Blaze).
# The API runs on Render (see render.yaml); the client calls it via VITE_API_BASE.
#
# Prereqs:
#   - Firebase CLI available; locally logged in, or in CI authenticated with a
#     service account (GOOGLE_APPLICATION_CREDENTIALS)
#   - .firebaserc -> ai-canva-22-nbn-fee4b
#   - RENDER_API_URL set (or passed as $1), e.g. https://ai-canva-22-nbn.onrender.com
#   - Firestore rules already deployed (or deploy them here too)
#
# Usage:
#   bash scripts/deploy-hosting.sh https://ai-canva-22-nbn.onrender.com
#   RENDER_API_URL=https://... bash scripts/deploy-hosting.sh

set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

API_URL="${1:-${RENDER_API_URL:-}}"
if [ -z "$API_URL" ]; then
  echo "ERROR: pass the Render service URL, e.g. bash scripts/deploy-hosting.sh https://ai-canva-22-nbn.onrender.com" >&2
  exit 1
fi
# Client appends path segments: ${API_BASE}/generate → …/api/generate
API_URL="${API_URL%/}"
case "$API_URL" in
  */api) ;;
  *) API_URL="$API_URL/api" ;;
esac

PROJECT="${FIREBASE_PROJECT:-ai-canva-22-nbn-fee4b}"

echo "==> Deploy target project: $PROJECT"
echo "==> VITE_API_BASE: $API_URL"
# In CI the Firebase CLI is authenticated with a service account and the
# explicit --project below is enough; `firebase use` is only for local DX.
if [ -z "${CI:-}" ]; then
  firebase use "$PROJECT"
fi

echo "==> Building client"
# On Windows, a bash env-prefix on `npm run build` does not reach Vite —
# write .env.production instead (Vite loads it for `vite build`).
printf 'VITE_API_BASE=%s\n' "$API_URL" > client/.env.production
trap 'rm -f client/.env.production' EXIT
( cd client && npm run build )

echo "==> Deploying hosting + firestore rules (no functions)"
firebase deploy --project "$PROJECT" --only hosting,firestore:rules --non-interactive

echo
echo "==> Deploy complete."
echo "   Hosting URL:  https://$PROJECT.web.app"
echo "   Verify:"
echo "     curl -s https://$PROJECT.web.app/"
echo "     curl -s $API_URL/health"
