#!/usr/bin/env bash
# Waits until a URL answers, then exits 0. Times out (non-zero) otherwise —
# this is the file the README promised and the pipeline lacked.
set -euo pipefail

URL="${1:?usage: wait-for.sh <url> [timeout-seconds]}"
TIMEOUT="${2:-120}"
START="$(date +%s)"

timeout_ms=$((TIMEOUT * 1000))
# curl handles the fine-grained retries; the loop keeps them warm.
elapsed=0
while :; do
  if curl -fsS --max-time 5 "$URL" > /dev/null 2>&1; then
    echo "up: $URL"
    exit 0
  fi
  now="$(date +%s)"
  elapsed=$((now - START))
  if [ "$elapsed" -ge "$TIMEOUT" ]; then
    echo "wait-for.sh: timed out after ${TIMEOUT}s waiting for $URL"
    exit 1
  fi
  sleep 1
done
