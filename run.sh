#!/usr/bin/env bash

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")" && pwd)"
API_PORT="${API_PORT:-4174}"
WEB_PORT="${WEB_PORT:-4173}"

cleanup() {
  if [[ -n "${API_PID:-}" ]] && kill -0 "$API_PID" 2>/dev/null; then
    kill "$API_PID" 2>/dev/null || true
  fi

  if [[ -n "${WEB_PID:-}" ]] && kill -0 "$WEB_PID" 2>/dev/null; then
    kill "$WEB_PID" 2>/dev/null || true
  fi
}

trap cleanup EXIT INT TERM

cd "$ROOT_DIR"

PORT="$API_PORT" npm run dev:api &
API_PID=$!

VITE_API_PORT="$API_PORT" npx vite --host 0.0.0.0 --port "$WEB_PORT" &
WEB_PID=$!

printf '\n'
printf 'harunecut dev servers are running\n'
printf '  web: http://localhost:%s\n' "$WEB_PORT"
printf '  api: http://localhost:%s/api/health\n' "$API_PORT"
printf '\nPress Ctrl+C to stop both processes.\n'

wait "$API_PID" "$WEB_PID"
