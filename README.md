<div align="center">

# FGx

**BloxStrike Clan Discord Platform**

Modern moderation • security engines • AI assistant • clan management • competitive systems

</div>

---

FGx is a production-grade Discord bot built for a competitive **BloxStrike**
clan community. It combines modern moderation, anti-spam/anti-raid/anti-nuke
protection, an AI assistant, ticket systems, and a full competitive core —
tryouts, scrims, clan wars, match results, player ratings, and leaderboards —
in one clean, deployable codebase.

> **Independent community project.** FGx is not affiliated with, endorsed by,
> or sponsored by Discord Inc. or BloxStrike. See [COPYRIGHT.md](COPYRIGHT.md).

---

## Table of contents

1. [Overview](#overview)
2. [Features](#features)
3. [Architecture](#architecture)
4. [Security](#security)
5. [AI System](#ai-system)
6. [BloxStrike Competitive Features](#bloxstrike-competitive-features)
7. [Installation](#installation)
8. [Configuration](#configuration)
9. [Environment Variables](#environment-variables)
10. [Discord Developer Portal Setup](#discord-developer-portal-setup)
11. [Database Setup](#database-setup)
12. [Development](#development)
13. [Testing](#testing)
14. [Deployment](#deployment)
15. [GitHub Actions](#github-actions)
16. [Contributing](#contributing)
17. [Copyright](#copyright)
18. [Third-Party Dependencies](#third-party-dependencies)
19. [Support](#support)

## Overview

FGx runs as a single Node.js process. It connects to Discord, registers slash
commands automatically, and persists everything to a local SQLite database
(Node's built-in `node:sqlite` — no native compilation anywhere). A built-in
HTTP health endpoint makes it deployment-friendly on any cloud host.

```bash
npm install
npm start
```

## Features

### Moderation
`/warn` `/warnings` `/timeout` `/kick` `/ban` `/unban` `/purge` `/slowmode`
`/lock` `/unlock` `/nick` `/role` — every action checks permissions and
hierarchy, logs to a configurable channel, and returns a clean response.

### Security engines
- **Anti-spam** — flood, duplicates, mass mentions, emoji/caps abuse, invite
  spam, suspicious links, repeated advertisements. Progressive enforcement:
  warn → delete → timeout → staff alert, with quiet-period resets.
- **Anti-raid** — join velocity, new-account patterns, profile similarity.
  On detection: protection mode, staff alert, no mass bans.
- **Anti-nuke** — per-executor limits on channel/role creation+deletion,
  bans, kicks, webhook abuse, and permission escalation, with owner alerts.

### AI
- **Security engine** — classifies suspicious content (harassment, phishing,
  scams, toxicity…) with confidence thresholds. Modes: `LOG` (safest),
  `RECOMMEND`, `MODERATE`. Never punishes on uncertain classifications.
- **Community assistant** — `/ask`, `/ai`, `/bloxai` answer from a per-guild
  system prompt plus *verified* FGx data. Never reveals secrets or fabricates
  statistics. Rate-limited per user.

### Community
- Welcome messages with auto-role
- Button-based verification with cooldowns
- Ticket system (5 types) with claiming, transcripts, and logging
- XP / levels with anti-spam protection

### BloxStrike competitive core
Profiles, identity linking, roster ranks, tryouts, trial evaluations, scrims,
match results, clan wars, events, training, leaderboards, achievements,
FGx Competitive Rating, staff analysis, and an interactive `/bloxstrike` hub.

## Architecture

```
FGx/
├── src/
│   ├── index.js             # entry point, shutdown, error boundaries
│   ├── config/              # env validation, brand, per-guild defaults
│   ├── commands/            # moderation / security / utility / clan / tickets / admin
│   ├── events/              # gateway event handlers
│   ├── services/            # moderation / security / ai / tickets / logging / community / clan
│   ├── database/            # node:sqlite connection, migrations, repositories
│   ├── interactions/        # buttons, select menus, modals router
│   ├── utils/               # permissions, cooldowns, rate limits, pagination, validation
│   └── dashboard/           # built-in HTTP health endpoint
├── scripts/validate.js      # startup validation (CI + pre-deploy)
├── tests/                   # unit tests (node:test)
├── docs/                    # architecture, security, deployment, commands…
└── .github/                 # CI, secret scanning, issue/PR templates
```

See [docs/architecture.md](docs/architecture.md) for details.

## Security

- Tokens and API keys are **never** committed; `.env` is git-ignored.
- All user input, role IDs, channel IDs, and lineups are validated.
- The bot never executes arbitrary user-provided code.
- Logging redacts credential-like values automatically.
- Errors shown to users are safe; internals stay in logs.
- Anti-fake-stats: only staff-recorded match data becomes official FGx stats.
- GitHub secret scanning + push protection + CI secret check are included.

See [docs/security.md](docs/security.md) and [SECURITY.md](SECURITY.md).

## AI System

- **Providers:** OpenAI-compatible endpoints, Google Gemini, and Groq — one
  code path, selected by `AI_PROVIDER` or auto-detected from whichever key is
  set (`AI_API_KEY` / `GEMINI_API_KEY` / `GROQ_API_KEY`).
- **Without a key:** AI commands reply with a clear "not configured" message
  and the security engine falls back to heuristics only — nothing breaks.
- **Safety:** configurable system prompt, per-user rate limits, timeouts, and
  strict "no fabrication" guardrails for competitive data.

See [docs/ai.md](docs/ai.md).

## BloxStrike Competitive Features

| Area | Commands |
| --- | --- |
| Profiles | `/profile`, `/player` |
| Identity linking | `/link`, `/unlink` |
| Roster | `/roster` (view/add/remove/promote/demote/inactive) |
| Tryouts | `/tryout` (apply/status/review/list) |
| Evaluations | `/evaluate` (record/view) |
| Scrims | `/scrim` (create/info/join/leave/result/cancel) |
| Matches | `/match` (result/list) |
| Clan wars | `/clanwar` (create/accept/decline/result/history) |
| Events | `/event` (create/join/leave/start/end/list) |
| Training | `/training` (schedule/join/list/cancel) |
| Leaderboards | `/leaderboard` (rating/kills/kd/streak/wins/matches) |
| Achievements | `/achievements` |
| Analysis | `/analysis` (player/team/match) — staff only |
| Hub | `/bloxstrike` |

The **FGx Competitive Rating** is an internal metric computed from
FGx-recorded matches — it is **not** an official BloxStrike ranking, and it
is labeled as such everywhere it appears.

See [docs/bloxstrike.md](docs/bloxstrike.md).

## Installation

```bash
git clone <repository-url> FGx
cd FGx
npm install
cp .env.example .env
# edit .env with your values (see below)
npm start
```

Requires **Node.js >= 22.5** (uses the built-in `node:sqlite` module —
no native dependencies, so installs succeed on any platform including
minimal cloud images).

## Configuration

Per-server configuration lives in the database and is managed in Discord:

- `/config` — interactive menu (Welcome, Moderation, Security, AI, Logs,
  Verification, Tickets, Clan, XP, Rules) with key=value editing.
- `/automod` — quick anti-spam / anti-raid / anti-nuke / AI toggles.
- `/security` — status, enable/disable protection, manual lockdown.
- `/welcome setup`, `/verify setup`, `/ticket setup` — one-command setups.

See [docs/configuration.md](docs/configuration.md).

## Environment Variables

| Variable | Required | Description |
| --- | --- | --- |
| `DISCORD_TOKEN` | ✅ | Bot token (Developer Portal) |
| `CLIENT_ID` | ✅ | Application client ID |
| `GUILD_ID` | optional | Guild for scoped command registration (empty = global) |
| `DISCORD_INTENTS` | optional | `full` (default, needs portal toggles) or `basic` (runs without privileged intents) |
| `DATABASE_PATH` | optional | SQLite file path (default `data/fgx.db`) |
| `AI_PROVIDER` | optional | `openai` \| `gemini` \| `groq` (empty = auto-detect from keys) |
| `AI_API_KEY` | optional | OpenAI-compatible API key |
| `AI_KEYS` | optional | Comma-separated OpenAI keys for key shuffling |
| `AI_BASE_URL` | optional | API base URL (default `https://api.openai.com/v1`) |
| `AI_MODEL` | optional | OpenAI-compatible model (default `gpt-4o-mini`) |
| `AI_MODELS` | optional | Comma-separated OpenAI models for model shuffling |
| `GEMINI_API_KEY` | optional | Google Gemini API key |
| `GEMINI_KEYS` | optional | Comma-separated Gemini keys for key shuffling |
| `GEMINI_MODEL` | optional | Gemini model (default `gemini-3.6-flash`) |
| `GEMINI_MODELS` | optional | Comma-separated Gemini models for model shuffling |
| `GROQ_API_KEY` | optional | Groq API key |
| `GROQ_KEYS` | optional | Comma-separated Groq keys for key shuffling |
| `GROQ_MODEL` | optional | Groq model (default `groq/compound`) |
| `GROQ_MODELS` | optional | Comma-separated Groq models for model shuffling |
| `AI_FAILOVER_MODE` | optional | `failover` (default) \| `roundrobin` \| `shuffle` |
| `AI_TIMEOUT_MS` | optional | AI request timeout (default `30000`) |
| `AI_ACTION_MODE` | optional | `LOG` \| `RECOMMEND` \| `MODERATE` (default `LOG`) |
| `WEBHOOK_PORT` | optional | Health endpoint port (default `3000`) |
| `LOG_LEVEL` | optional | `debug` \| `info` \| `warn` \| `error` |
| `NODE_ENV` | optional | `production` \| `development` |

## Discord Developer Portal Setup

1. Create an application at <https://discord.com/developers/applications>.
2. Go to **Bot** → **Reset Token** → copy the token into `DISCORD_TOKEN`.
3. Copy the **Application ID** into `CLIENT_ID`.
4. Enable the **Message Content Intent** (required for anti-spam/AI scanning).
5. Invite the bot with the **Administrator** permission (or the specific
   moderation/manage/channel permissions you need).
6. For single-server testing, set `GUILD_ID`; for production, leave it empty
   (global commands) and run `/config` in your server.

## Database Setup

No external database server is required. FGx uses Node's built-in SQLite:

- The database file is created automatically at `DATABASE_PATH`.
- Migrations run automatically at startup (`PRAGMA user_version`).
- For cloud hosting, store `data/` on a persistent volume.
- Backups: stop the bot and copy the `.db` file (WAL mode — also copy
  `-wal`/`-shm` files or checkpoint first).

## Development

```bash
npm install
npm run dev      # auto-restart on changes
npm run lint     # zero warnings required
npm test
npm run validate
```

See [CONTRIBUTING.md](CONTRIBUTING.md).

## Testing

Unit tests use the built-in Node test runner:

```bash
npm test
```

Coverage: cooldowns/rate limiters, validation, formatting, deep-merge,
the anti-spam engine (detection + enforcement ladder), and the rating
algorithm.

## Deployment

The bot runs anywhere Node >= 22.5 is available — Railway, Render, Fly.io,
a VPS, or a container:

1. Set the environment variables (never commit them).
2. `npm install` then `npm start`.
3. Point an uptime monitor at `http://<host>:3000/health`.

See [docs/deployment.md](docs/deployment.md) for a step-by-step guide,
including updates and rollbacks.

## GitHub Actions

- `ci.yml` — install, lint, tests, startup validation, secret scan.
- `security.yml` — dependency audit + secret scanning (Gitleaks).
- `release.yml` — draft a GitHub release from tags (requires CI to pass).

See [docs/deployment.md](docs/deployment.md) and the workflows themselves.

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md). Bug reports, feature requests, and
security reports use the templates in `.github/ISSUE_TEMPLATE/`.

## Copyright

**Copyright © 2026 FGx. All rights reserved.**

This repository is proprietary unless otherwise stated. Unauthorized
redistribution, resale, or republishing of the source code is prohibited.
See [LICENSE](LICENSE), [COPYRIGHT.md](COPYRIGHT.md), and [NOTICE.md](NOTICE.md).

## Third-Party Dependencies

See [NOTICE.md](NOTICE.md) for third-party attribution. FGx does not claim
ownership of Discord, BloxStrike, discord.js, Node.js, or any AI provider.

## Roadmap

See [docs/roadmap.md](docs/roadmap.md) for the spec-to-status map and the
staged plan for PostgreSQL, the REST API, the Discord-OAuth dashboard, and
WebSockets. The PostgreSQL migration interface is detailed in
[docs/postgres.md](docs/postgres.md).

## Support

- Commands: `/help` in Discord, or [docs/commands.md](docs/commands.md).
- Issues: open a GitHub issue using the templates.
- Security: see [SECURITY.md](SECURITY.md) — never post vulnerabilities publicly.
