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

### Railway / Render / Fly.io (examples)

1. Create a new service from this repository.
2. Set the environment variables in the dashboard (see `.env.example`).
3. Build command: `npm install` — Start command: `npm start`.
4. Add a **persistent volume** mounted at the app directory's `data/` folder
   (e.g. `/app/data`) and set `DATABASE_PATH=data/fgx.db`.
5. Deploy. Verify with a request to `http://<host>:3000/health`:

```json
{ "status": "ok", "service": "FGx", "version": "1.0.0", "database": "ok" }
```

### VPS

```bash
# as a non-root user
git clone <repo-url> /opt/fgx && cd /opt/fgx
npm ci
cp .env.example .env        # edit values; chmod 600 .env
# run with a process manager, e.g. pm2 or systemd
```

systemd unit example (`/etc/systemd/system/fgx.service`):

```ini
[Unit]
Description=FGx Discord bot
After=network.target

[Service]
User=fgx
WorkingDirectory=/opt/fgx
ExecStart=/usr/bin/node src/index.js
Restart=always
RestartSec=5
EnvironmentFile=/opt/fgx/.env

[Install]
WantedBy=multi-user.target
```

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
