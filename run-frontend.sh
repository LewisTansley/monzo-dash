#!/bin/bash
ROOT="$(cd "$(dirname "$0")" && pwd)"
FRONTEND_PORT="${FRONTEND_PORT:-8090}"
export FRONTEND_PORT
[ -f "$ROOT/.env" ] && { set -a; source "$ROOT/.env"; set +a; }

pids=$(ss -tlnp 2>/dev/null | grep ":$FRONTEND_PORT " | sed -n 's/.*pid=\([0-9]*\).*/\1/p')
[ -z "$pids" ] && pids=$(lsof -i :"$FRONTEND_PORT" 2>/dev/null | awk '/LISTEN/ {print $2}' | sort -u)
if [ -n "$pids" ]; then
  echo -e "\033[1;33mKilling server on port $FRONTEND_PORT (PIDs: $pids)\033[0m"
  echo "$pids" | xargs -r kill -9 2>/dev/null
  sleep 1
fi

echo -e "\033[0;32mStarting Vue.js frontend on port $FRONTEND_PORT...\033[0m"
cd "$ROOT/frontend" || exit 1
exec npm run serve -- --host 0.0.0.0 --port "$FRONTEND_PORT"
