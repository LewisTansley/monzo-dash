# Monzo Dash

Local-first Monzo dashboard with YTD/MTD analytics, spending projections, and category budgets — built around **pot automations**: balance-driven transfers between your main account and pots, with optional scheduled auto-runs that keep working even when the dashboard is closed.

## Automations

Pot automations are the core of Monzo Dash. You define rules that watch account and pot balances, then move money automatically or on demand.

### Rules

A **rule** is a single transfer workflow:

- **When** — one or more balance conditions on your main account or a specific pot (combined with AND or OR logic)
- **Then** — deposit to a pot (main account → pot) or withdraw from a pot (pot → main account)

Each rule can be enabled or disabled, pinned to the dashboard for quick manual runs, and optionally configured to auto-run on a schedule.

### Groups

A **group** runs multiple existing rules **in order**, top to bottom. Use groups to chain transfers — for example, fund several savings pots sequentially after payday. Groups have their own enable switch, dashboard pin, and auto-run settings, separate from the member rules.

On a live group run, execution stops on the first error. Dry-run simulates balance changes between steps so you can preview the full pipeline.

### Auto-run

The backend **scheduler** checks eligible rules and groups on a fixed interval (default: every 60 seconds). When a rule or group is due, it evaluates conditions and executes transfers via the Monzo API — no browser required.

Auto-run requires an **unlocked vault**. For always-on deployments (Docker), enable **Allow automatic runs without the dashboard open** when unlocking — this persists an encrypted session on disk so the scheduler can restore the vault after a restart without storing your passphrase in `.env` (see [Headless / server deployment](#headless--server-deployment)).

#### Condition and action model

| Concept | Options |
|---------|---------|
| Condition sources | Main account or specific pot |
| Operators | `>`, `>=`, `<`, `<=`, `=` |
| Condition logic | All conditions (AND) or any condition (OR) |
| Amount modes | Fixed amount, percent of balance, remainder above/below threshold |
| Actions | Deposit (account → pot) or withdraw (pot → account) |

#### Example rules

- If main account balance is above £500, move the remainder above £500 into the Holiday pot.
- Every Friday at 09:00, top up the Emergency pot to £1,000 if it is below target.

#### Auto-trigger modes

| Mode | Behavior |
|------|----------|
| `conditions` | Run whenever balances match (subject to frequency limits) |
| `schedule` | Run on schedule regardless of conditions |
| `schedule_and_conditions` | Must be within the schedule window **and** pass conditions |

**Schedule types:** daily, weekly, monthly, or every N days.

**Frequency limits:** per calendar day or per schedule window (e.g. one run per Friday). Choose **once**, a **specific number of times**, or **unlimited** attempts within that window. When using a count, you can count either all auto-run attempts or successful transfers only.

#### Where to manage automations

- **`/automations`** — create and edit rules and groups; dry-run before executing
- **Dashboard → Quick automations** — one-click manual runs for pinned rules and groups; shows an "Auto" badge when auto-run is enabled
- Dry-run previews transfers without calling Monzo; the dashboard asks for confirmation on transfers of £50 or more

#### Important behaviors

- Auto-runs require an unlocked vault; the scheduler no-ops when locked unless a headless session is restored on startup.
- Groups run members sequentially; live runs stop on the first error.
- Standalone auto-triggers and group auto-triggers are independent — a rule that belongs to a group can still auto-run on its own if configured.
- All rules and groups are stored in your encrypted local vault (`.vault/monzo.vault.enc`), not on Monzo's servers.
- Monzo dedupe prevents accidental duplicate transfers; rules set to once per day use a daily dedupe id, while count/unlimited limits use per-window transfer slots.

## Quick start — Docker

Recommended for always-on use so the automation scheduler runs continuously.

```bash
cp .env.example .env   # optional
docker compose up --build
```

- **Dashboard:** http://localhost:8080
- **API / OAuth callback:** http://localhost:3001
- **Vault persistence:** `./.vault` on the host is bind-mounted to `/app/.vault` in the container (vault data, OAuth tokens, and optional headless session files)
- The container runs the backend (`npm run start`) and Vue dev server (`npm run serve`) via `docker-entrypoint.sh`
- `restart: unless-stopped` keeps the service running across restarts

Copy `.env.example` to `.env` to customize ports, scheduler settings, or vault path.

### Headless / server deployment

For unattended auto-runs across Docker restarts, Monzo Dash uses **on-disk session persistence**.

When you unlock with **Allow automatic runs without the dashboard open** enabled, the backend writes two files under `.vault/`:

| File | Purpose |
|------|---------|
| `headless.key` | Random 256-bit AES key, created once per vault directory |
| `headless-session.enc` | Your vault passphrase encrypted with that key (AES-256-GCM) |

On container start, if both files exist and headless runs are still enabled, the backend decrypts the session and unlocks the vault automatically so the scheduler can run.

**Setup:**

1. Create the vault and connect Monzo once via the Settings UI.
2. When unlocking, enable **Allow automatic runs without the dashboard open** (or turn it on later in Settings while unlocked).
3. Confirm Settings shows *Encrypted session saved for container restarts.*
4. Restart the container — automations run without opening the dashboard.

**Disabling:** Turn off **Allow automatic runs without the dashboard open** in Settings (while unlocked) or lock the vault — both clear `headless-session.enc`.

**Security note:** Anyone with read access to `.vault/` can decrypt the session and unlock the vault. Treat the bind-mounted `.vault/` directory like a secrets store; do not commit it or expose it on shared hosts.

### Environment variables

| Variable | Default | Purpose |
|----------|---------|---------|
| `AUTO_TRIGGER_INTERVAL_MS` | `60000` | How often the scheduler checks for eligible auto-runs |
| `AUTO_TRIGGER_TIMEZONE` | `Europe/London` | Timezone for schedule evaluation |
| `API_PORT` / `FRONTEND_PORT` | `3001` / `8080` | Host port mapping |
| `MONZO_REDIRECT_URI` | `http://localhost:3001/api/auth/monzo/callback` | Must match your Monzo OAuth app |
| `VAULT_PATH` | `.vault/monzo.vault.enc` | Encrypted vault file path |
| `FRONTEND_URL` | `http://localhost:8080` | Used for CORS and redirects |

If you change host ports, update `MONZO_REDIRECT_URI` in `.env` **and** register the same URI in your Monzo developer app.

## Quick start — Local development

```bash
./run-both.sh
```

This installs dependencies on the first run, starts the API on port 3001, and the Vue app on port 8080.

- **Dashboard:** http://localhost:8080
- **API / OAuth callback:** http://localhost:3001

### Other scripts

| Script | Purpose |
|--------|---------|
| `./run-backend.sh` | API only |
| `./run-frontend.sh` | Frontend only |
| `./run-both.sh -s` | Skip dependency install preflight |

Copy `.env.example` to `.env` to override ports or vault path.

### Docker vs local

| | Docker | Local |
|---|--------|-------|
| Best for | Always-on, auto-runs | Active development |
| Backend | `npm run start` | `npm run dev` (file watch) |
| Vault | Bind-mounted `./.vault` | `./.vault` |
| Node.js | 20 (in image) | 18+ required |

## Prerequisites

1. [Node.js](https://nodejs.org/) 18+ (local development only — Docker bundles Node 20)
2. A **Confidential** OAuth client at [developers.monzo.com](https://developers.monzo.com)
   - **Client ID** must start with `oauth2client_` (from your app — not your `user_` ID)
   - **Redirect URI** (exact match): `http://localhost:3001/api/auth/monzo/callback`
   - Use `localhost`, not `127.0.0.1` (Monzo blocks IP addresses in redirect URIs)

## First-time setup

1. Open http://localhost:8080/settings
2. Create a vault with a passphrase (stored encrypted in `.vault/monzo.vault.enc` — gitignored)
3. Enter your Monzo client ID and secret
4. Click **Connect Monzo** and approve access in the Monzo app
5. Set optional category budgets on the Dashboard spending categories panel
6. Build automations at `/automations`:
   - Create rules for individual pot transfers
   - Optionally group rules for sequential execution
   - Enable **auto-run** on rules or groups you want the scheduler to handle
   - Pin items to the dashboard with **Show on dashboard** for quick manual runs
7. For Docker / always-on use: enable **Allow automatic runs without the dashboard open** when unlocking so the encrypted session persists across restarts

## Security

- Credentials and tokens are encrypted at rest in the vault (AES-256-GCM + scrypt)
- The `.vault/` directory is gitignored and never committed
- Unlock the vault when you start the backend locally; for Docker, optionally enable headless runs to restore an encrypted on-disk session after restart
- Headless session persistence encrypts your passphrase with a local `headless.key` — it is **not** stored in `.env` or any environment variable
- Protect `.vault/` on the host: it contains your encrypted vault, OAuth tokens, and (when enabled) the headless session key material
