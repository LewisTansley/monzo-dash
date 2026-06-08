# Monzo Dash

Local-first Monzo dashboard with YTD/MTD analytics, spending projections, category budgets, and pot automation rules.

## Prerequisites

1. [Node.js](https://nodejs.org/) 18+
2. A **Confidential** OAuth client at [developers.monzo.com](https://developers.monzo.com)
   - **Client ID** must start with `oauth2client_` (from your app — not your `user_` ID)
   - **Redirect URI** (exact match): `http://localhost:3001/api/auth/monzo/callback`
   - Use `localhost`, not `127.0.0.1` (Monzo blocks IP addresses in redirect URIs)

## Quick start

```bash
./run-both.sh
```

This installs dependencies (first run), starts the API on port 3001, and the Vue app on port 8080.

- **Dashboard:** http://localhost:8080
- **API / OAuth callback:** http://localhost:3001

### Other scripts

| Script | Purpose |
|--------|---------|
| `./run-backend.sh` | API only |
| `./run-frontend.sh` | Frontend only |
| `./run-both.sh -s` | Skip dependency install preflight |

Copy `.env.example` to `.env` to override ports or vault path.

## First-time setup

1. Open http://localhost:8080/settings
2. Create a vault with a passphrase (stored encrypted in `.vault/monzo.vault.enc` — gitignored)
3. Enter your Monzo client ID and secret
4. Click **Connect Monzo** and approve access in the Monzo app
5. Set optional category budgets in Settings and build automations on the Automations page

## Security

- Credentials and tokens are encrypted at rest (AES-256-GCM + scrypt)
- The vault file lives in `.vault/` and is never committed
- Unlock the vault each time you start the backend (session-only in memory)
