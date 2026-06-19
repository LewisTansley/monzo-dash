#!/bin/bash
# Expose Monzo Dash frontend over Tailscale HTTPS (tailnet access from phone).
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
if [ -f "$ROOT/.env" ]; then
  set -a
  # shellcheck disable=SC1091
  source "$ROOT/.env"
  set +a
fi

FRONTEND_PORT="${FRONTEND_PORT:-8090}"
TARGET="http://127.0.0.1:${FRONTEND_PORT}"

if ! command -v tailscale >/dev/null 2>&1; then
  echo "tailscale CLI not found. Install Tailscale on this machine first." >&2
  exit 1
fi

echo "Serving Monzo Dash at https://$(tailscale status --json 2>/dev/null | sed -n 's/.*"DNSName":"\([^"]*\)".*/\1/p' | head -1 || echo '<your-machine>.<tailnet>.ts.net')/"
echo "  → proxy target: $TARGET"
echo ""
echo "Mobile UI bookmarks:"
echo "  Path:    https://<your-machine>.<tailnet>.ts.net/m/"
echo "  Subdomain (optional split DNS): https://m.<your-machine>.<tailnet>.ts.net/"
echo ""
echo "Ensure ./run-both.sh (or Docker) is running before opening the URL on your phone."
echo ""

exec tailscale serve --bg --https=443 "$TARGET"
