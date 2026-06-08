#!/bin/bash
ROOT="$(cd "$(dirname "$0")" && pwd)"
API_PORT="${API_PORT:-3001}"
export API_PORT
[ -f "$ROOT/.env" ] && { set -a; source "$ROOT/.env"; set +a; }

pids=$(ss -tlnp 2>/dev/null | grep ":$API_PORT " | sed -n 's/.*pid=\([0-9]*\).*/\1/p')
[ -z "$pids" ] && pids=$(lsof -i :"$API_PORT" 2>/dev/null | awk '/LISTEN/ {print $2}' | sort -u)
if [ -n "$pids" ]; then
  echo -e "\033[1;33mKilling server on port $API_PORT (PIDs: $pids)\033[0m"
  echo "$pids" | xargs -r kill -9 2>/dev/null
  sleep 1
fi

echo -e "\033[0;32mStarting Monzo Dash API on port $API_PORT...\033[0m"
cd "$ROOT/backend" || exit 1
exec npm run dev
