#!/usr/bin/env bash
# End-to-end smoke test. Prints SMOKE OK only when the whole stack answers
# truthfully; exits non-zero the moment anything is wrong — a smoke detector
# WITH its battery.
#
# Usage:
#   ./scripts/smoke.sh http://localhost:8000 http://localhost:3000
#   ./scripts/smoke.sh https://backend.vercel.app https://frontend.vercel.app <expected-version>
set -euo pipefail

BACKEND="${1:-http://localhost:8000}"
FRONTEND="${2:-http://localhost:3000}"
EXPECTED_VERSION="${3:-}"

echo "-> health"
health="$(curl -fsS --max-time 15 "$BACKEND/api/health")"
status="$(printf '%s' "$health" | grep -o '"status":"[^"]*"' | head -1 | cut -d'"' -f4)"
db="$(printf '%s' "$health" | grep -o '"db":"[^"]*"' | head -1 | cut -d'"' -f4)"
version="$(printf '%s' "$health" | grep -o '"version":"[^"]*"' | head -1 | cut -d'"' -f4)"
if [ "$status" != "ok" ]; then
  echo "SMOKE FAIL: health status=$status (body: $health)"
  exit 1
fi
if [ "$db" != "ok" ]; then
  echo "SMOKE FAIL: health db=$db (body: $health)"
  exit 1
fi
if [ -n "$EXPECTED_VERSION" ] && [ "$version" != "$EXPECTED_VERSION" ]; then
  echo "SMOKE FAIL: live version '$version' != expected '$EXPECTED_VERSION'"
  exit 1
fi
echo "   ok (version=$version, db=$db)"

echo "-> frontend"
curl -fsS --max-time 15 "$FRONTEND/" > /dev/null
echo "   ok"

echo "-> login"
login="$(curl -fsS --max-time 15 -X POST "$BACKEND/api/auth/login" \
  -H 'Content-Type: application/json' \
  -d '{"email":"alice@phoenix.dev","password":"phoenix123"}')"
if ! printf '%s' "$login" | grep -q 'access_token'; then
  echo "SMOKE FAIL: login did not return an access token (body: $login)"
  exit 1
fi
echo "   ok"

echo "SMOKE OK"
