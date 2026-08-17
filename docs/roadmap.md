# FGx production roadmap

Status of the 2026 platform target, mapped to what ships today.

## Legend

- ✅ **Done & live** — implemented, tested, deployed.
- 🧪 **Done, pending deploy** — implemented and tested; waiting on the next
  Render manual deploy (free-tier redeploys reset the SQLite DB — deploy
  in one batch with `/setup` re-run).
- 🔜 **Staged** — designed with a clean interface; not yet built.

## Status map

| Spec area | Status | Notes |
| --- | --- | --- |
| Moderation engine | ✅ | warn/warnings/timeout/kick/ban/unban/purge/slowmode/lock/unlock; hierarchy checks; persistent moderation log with case IDs; audit embeds |
| AutoMod | ✅ | spam, duplicates, flooding, mention/caps/emoji spam, invites, phishing, links; progressive warn → delete → timeout → escalation |
| Anti-raid | ✅ | join velocity, new-account bursts, suspicious patterns, lockdown; `/security` commands |
| Anti-nuke | ✅ | mass channel/role/bans/kicks/webhook/permission anomalies; owner alerts |
| AI security | 🧪 | LOG / RECOMMEND / MODERATE modes; profanity fast-path (DM + warning + 5-min timeout); never punishes uncertain cases |
| AI assistant | 🧪 | `/ask` `/ai` `/bloxai`; BloxStrike knowledge base; guardrails; 5/min rate limit |
| Profiles & linking | 🧪 | `/profile` `/player`; `/link submit|verify|list`; verified vs FGx-recorded data |
| Clan management | ✅ | ranks Owner→Recruit (incl. Co-Owner); roster add/remove/promote/demote |
| Tryouts + evaluations | ✅ | two-part modal, private review, 7-metric evaluation |
| Scrims / clan wars / matches | ✅ | full lifecycle with statuses and history |
| FGx rating + leaderboards | ✅ | configurable algorithm; paginated leaderboard |
| Events / training | ✅ | participant tracking, scheduling |
| Welcome & verification | ✅ | embed + auto-role + verification panel |
| Tickets | 🧪 | panel, claim, close, transcript, duplicate protection; now with ⚖️ Appeal category |
| XP + achievements | ✅ | anti-farm cooldowns; 8 achievements |
| `/fgx` control panel | 🧪 | central hub: profile, clan, rankings, tryouts, scrims, wars, events, loadouts, support, AI, security |
| Observability | ✅ | `/status`, `GET /health`, JSON logs, DB health |
| Repo hygiene | ✅ | README, LICENSE, COPYRIGHT, NOTICE, SECURITY, CONTRIBUTING, CHANGELOG, CI (lint/test/build/validate/secret-scan), security workflow |
| Deployment | ✅ | `render.yaml` Blueprint, `deploy/` VPS kit, docs |
| **PostgreSQL** | 🔜 | see `docs/postgres.md` — staged async migration behind `DATABASE_URL` |
| **REST API** | 🔜 | staged, below |
| **Web dashboard** | 🔜 | staged, below |
| **WebSockets** | 🔜 | only where useful, below |

## Staged: REST API (`apps/api`)

A read-mostly HTTP API for the future dashboard, exposed on the existing
dashboard server (or a separate service on `PORT_API`):

- `GET /api/status` — health, Discord, DB, AI (already available as `/health`)
- `GET /api/guilds/:id/overview` — member counts, security posture, open tickets
- `GET /api/guilds/:id/security/events` — recent incidents
- `GET /api/guilds/:id/clan` — roster, ratings, scrims, wars
- `GET /api/guilds/:id/players/:userId` — public profile fields only

Auth: Discord OAuth (see dashboard) → verify the user's Discord ID against
the guild's staff ranks (**never trust client-provided permissions**).
Rate limit per token; validate every input; no secrets in responses.

## Staged: Web dashboard (`apps/dashboard`)

Discord OAuth flow (scopes: `identify` + `guilds`; `guilds.members.read`
only for staff views — request the minimum). Route guards by Discord ID →
clan rank / admin config. Sections per the spec: Overview, Moderation,
Security, AutoMod, Welcome, Tickets, Clan, Players, Tryouts, Scrims, Clan
Wars, Events, AI, Logs, Settings.

Dashboard needs the OAuth client secret in env (`DISCORD_CLIENT_ID`,
`DISCORD_CLIENT_SECRET`, `DASHBOARD_ORIGIN`) and a redirect URI added in
the Developer Portal — a step only the Discord application owner can do.

## Staged: WebSockets

Only where they earn their keep (spec rule #27):

- Security alerts → dashboard (live incident feed)
- Scrim / clan-war status updates → dashboard

Implementation: `ws` upgrade on the dashboard server, authenticated by the
OAuth session token, topic-scoped per guild. No sockets in the bot itself —
the gateway is Discord's.

## Staged: monorepo shape

Target layout (npm workspaces) when the API and dashboard exist:

```text
FGx/
├── apps/bot/          # current bot (src/ moves here)
├── apps/api/          # REST API
├── apps/dashboard/    # web dashboard
├── packages/database/ # adapter seam (docs/postgres.md)
├── packages/config/   # env validation
├── packages/logger/   # structured JSON logging
└── packages/shared/   # constants, errors, formats
```

Until a second consumer (API/dashboard) exists, the single-app structure
is the correct one — a monorepo with one consumer is just indirection.
The `src/` layout already mirrors the package boundaries, so the move is
mechanical when the time comes.

## Deployment batch (next Render deploy)

The following are pushed but **not live** until you click
**Deploys → Manual Deploy → Deploy latest commit**, then re-run `/setup`:

- BloxStrike knowledge base + AI token-budget fix
- Profanity auto-mod (DM + warning + 5-min timeout), `/link verify`, Co-Owner
- Embed polish + interaction deferral (fixes "not responded")
- `/fgx` control panel, ⚖️ Appeal tickets, case IDs, build gate

After deploy: enable **Message Content** + **Server Members** intents in
the Developer Portal for full message scanning, then set
`DISCORD_INTENTS=full`.
