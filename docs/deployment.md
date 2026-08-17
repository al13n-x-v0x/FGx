# Deployment

FGx is designed to run 24/7 on any cloud host that provides Node.js >= 22.5.
It does not depend on your local machine.

## Requirements

- Node.js **>= 22.5** (uses built-in `node:sqlite`)
- npm
- A Discord bot token (Developer Portal)
- A persistent volume for `data/` (the SQLite database)

## Local run

```bash
npm install
cp .env.example .env        # fill in DISCORD_TOKEN, CLIENT_ID, GUILD_ID
npm start
```

The first start creates `data/fgx.db`, runs migrations, and registers slash
commands (guild-scoped if `GUILD_ID` is set, global otherwise).

## Environment variables

See [README → Environment Variables](../README.md#environment-variables).
Never commit real values; use the host's secret store.

## Discord Developer Portal

1. <https://discord.com/developers/applications> → **New Application**.
2. **Bot** → **Reset Token** → copy to `DISCORD_TOKEN`.
3. Copy the **Application ID** to `CLIENT_ID`.
4. Enable **Server Members Intent** (member tracking, welcome, anti-raid) and
   **Message Content Intent** (anti-spam and AI scanning) under
   **Privileged Gateway Intents**.
5. If the privileged intents are not (or cannot be) enabled, the bot can still
   run with `DISCORD_INTENTS=basic` — it connects immediately, and only
   real-time join events and message-content scanning degrade.
6. **OAuth2 → URL Generator** → scope `bot`, permissions `Administrator`
   (or the exact moderation/permission set you need) → invite.
7. For testing in one server, set `GUILD_ID`; for production leave it empty
   so commands are global.

## Cloud hosting

### Render (recommended free option — no credit card)

The repo ships a **Render Blueprint** ([`render.yaml`](../render.yaml)) that
pre-configures everything: Node runtime, build/start commands, health check,
env var names, and a persistent disk for the SQLite database.

1. Push the latest code (`git push origin main`).
2. Render dashboard → **New → Blueprint** → pick the **FGx** repo.
3. Render reads `render.yaml` and creates the `fgx` web service.
4. Open the service → **Environment** tab → fill the four secrets
   (`DISCORD_TOKEN`, `CLIENT_ID`, `GEMINI_KEYS`, `GROQ_KEYS`) → **Save**
   (triggers an automatic redeploy).
5. Open `https://<your-app>.onrender.com/health` — expect
   `{ "status": "ok", "service": "FGx", "database": "ok" }`.

Without the Blueprint, the manual settings are: runtime **Node**, build
`npm install`, start `npm start`, health check `/health`.

**Free tier = no persistent disk.** Render's free plan explicitly does not
support persistent disks, so the SQLite database lives on ephemeral
storage. It survives normal spin-up/spin-down cycles (see the keep-alive
below), but **every redeploy resets it** — guild configs, warnings, and
tickets start fresh (migrations rebuild the schema automatically). This is
fine for testing, not for permanent community data. For persistence, either
upgrade to a paid instance (then add a disk mounted at `/data` and set
`DATABASE_PATH=/data/fgx.db`), or move to a VPS (`deploy/` kit).

**Keep it awake:** Render's free tier spins the service down after 15 min
without inbound traffic, which would disconnect the Discord gateway. Point
[UptimeRobot](https://uptimerobot.com) (free) at
`https://<your-app>.onrender.com/health` every 5 minutes to keep it online
24/7. The bot itself is idle-tolerant: it reconnects on its own after a
brief outage, and the health pings prevent the spin-down in the first place.

### Railway / Fly.io (alternative PaaS)

1. Create a new service from this repository.
2. Set the environment variables (see `.env.example`).
3. Build command: `npm install` — Start command: `npm start`.
4. Add a **persistent volume** for the database and set `DATABASE_PATH` to a
   path on it (e.g. `/data/fgx.db`); transcripts are stored next to the
   database automatically.
5. Deploy. Verify with `GET /health`.

### VPS (Oracle Cloud free tier, any Linux VM)

The repo ships a complete deploy kit in [`deploy/`](../deploy/README.md): a
hardened systemd unit (`fgx.service`) and a one-command setup script
(`setup.sh`) that installs Node 22, creates an unprivileged `fgx` user,
installs locked deps, configures the environment file, and enables
auto-restart. Oracle Cloud's **Always Free** ARM VM (2 OCPU / 12 GB RAM) is
genuinely free forever and more than enough for FGx (~300 MB RAM).

```bash
sudo bash deploy/setup.sh /path/to/fgx-src   # copy the folder over first
sudo nano /opt/fgx/.env                      # real secrets
sudo systemctl enable --now fgx
curl localhost:3000/health
```

For a private repo, copy the code with `rsync` (see `deploy/README.md`) or
add a read-only **deploy key** and use the `git@github.com:...` URL.

Render's free tier is an alternative but **spins down after 15 min without
inbound traffic** — keep it awake by pointing UptimeRobot at `/health` every
5 minutes (details in `deploy/README.md`).

## Updating

1. Pull the new code (`git pull`).
2. `npm ci` (locked dependencies).
3. Run `npm run validate` — it checks env, database migrations, imports,
   command registration, and scans for secrets.
4. Restart the service. Migrations apply automatically at startup.

## Rollbacks

- The database schema version is checked at startup; if the code is older
  than the database, FGx refuses to start instead of corrupting data
  (`src/database/index.js`).
- To roll back: restore the previous code, then restore the previous
  `data/fgx.db` backup.

## Backups

Stop the service (or checkpoint), then copy:

```
data/fgx.db
data/fgx.db-wal   (if present)
data/fgx.db-shm   (if present)
data/transcripts/
```

## Health checks & monitoring

- `GET /health` returns status, version, uptime, guild count, and database
  health. Point your uptime monitor here.
- Logs are JSON lines to stdout/stderr (`ts`, `level`, `msg`, context).

## CI/CD

- `ci.yml` runs on every push/PR: install → lint → tests → validate → secret
  scan.
- `security.yml` runs `npm audit` and Gitleaks.
- `release.yml` drafts a release from tags; releases are only created when CI
  has passed (guarded by `needs`).
