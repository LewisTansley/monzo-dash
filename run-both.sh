#!/bin/bash
echo -e "\033[0;32mStarting Monzo Dash backend and frontend...\033[0m"

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

if [ -f "$ROOT_DIR/.env" ]; then
  set -a
  # shellcheck disable=SC1090
  . "$ROOT_DIR/.env"
  set +a
fi

SKIP_PREFLIGHT=false
for arg in "$@"; do
  case "$arg" in
    --skip-preflight|-s) SKIP_PREFLIGHT=true ;;
  esac
done
if [ "${RUN_BOTH_SKIP_PREFLIGHT:-0}" = "1" ]; then
  SKIP_PREFLIGHT=true
fi

if [ "$SKIP_PREFLIGHT" = false ]; then
  echo -e "\033[0;36mInstalling dependencies...\033[0m"
  if ! npm install --prefix "$ROOT_DIR/backend" || ! npm install --prefix "$ROOT_DIR/frontend"; then
    echo -e "\033[1;31mDependency install failed. Aborting.\033[0m"
    exit 1
  fi
else
  echo -e "\033[0;33mSkipping dependency install (preflight disabled).\033[0m"
fi

API_PORT="${API_PORT:-3001}"
FRONTEND_PORT="${FRONTEND_PORT:-8080}"

kill_listener_on_port() {
  local port=$1
  local pids
  pids=$(ss -tlnp 2>/dev/null | grep ":$port " | sed -n 's/.*pid=\([0-9]*\).*/\1/p')
  if [ -z "$pids" ]; then
    pids=$(lsof -i :"$port" 2>/dev/null | awk '/LISTEN/ {print $2}' | sort -u)
  fi
  if [ -n "$pids" ]; then
    echo -e "\033[1;33mKilling server on port $port (PIDs: $pids)\033[0m"
    echo "$pids" | xargs -r kill -9 2>/dev/null
  fi
}

kill_listener_on_port "$API_PORT"
kill_listener_on_port "$FRONTEND_PORT"
sleep 1

run_in_terminal() {
  local cmd="cd \"$ROOT_DIR\" && $1; exec bash"
  if command -v kitty &>/dev/null; then
    kitty sh -c "$cmd" &
    return 0
  fi
  if command -v konsole &>/dev/null; then
    konsole -e bash -c "$cmd" &
    return 0
  fi
  if command -v gnome-terminal &>/dev/null; then
    gnome-terminal -- bash -c "$cmd" &
    return 0
  fi
  if command -v xterm &>/dev/null; then
    xterm -e "bash -c '$cmd'" &
    return 0
  fi
  if command -v x-terminal-emulator &>/dev/null; then
    x-terminal-emulator -e "bash -c '$cmd'" &
    return 0
  fi
  return 1
}

echo -e "\033[0;36mStarting backend...\033[0m"
if run_in_terminal "./run-backend.sh"; then
  :
else
  echo -e "\033[1;33mNo GUI terminal found. Starting backend in background...\033[0m"
  ./run-backend.sh &
fi
sleep 2

echo -e "\033[0;36mStarting frontend...\033[0m"
if run_in_terminal "./run-frontend.sh"; then
  :
else
  echo -e "\033[1;33mNo GUI terminal found. Starting frontend in background...\033[0m"
  ./run-frontend.sh &
fi

echo -e "\033[0;32mMonzo Dash is starting.\033[0m"
echo -e "\033[0;36mBackend:  http://localhost:${API_PORT}  (Monzo OAuth callback)\033[0m"
echo -e "\033[0;36mFrontend: http://localhost:${FRONTEND_PORT}  (open dashboard here)\033[0m"
