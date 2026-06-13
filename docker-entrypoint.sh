#!/bin/sh
set -e

API_PORT="${API_PORT:-3001}"
FRONTEND_PORT="${FRONTEND_PORT:-8080}"

cd /app/backend
npm run start &
BACKEND_PID=$!

cd /app/frontend
npm run serve -- --host 0.0.0.0 --port "$FRONTEND_PORT" &
FRONTEND_PID=$!

trap 'kill "$BACKEND_PID" "$FRONTEND_PID" 2>/dev/null; wait "$BACKEND_PID" "$FRONTEND_PID" 2>/dev/null; exit 0' TERM INT

wait "$BACKEND_PID" "$FRONTEND_PID"
