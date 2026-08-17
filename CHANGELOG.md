# Changelog

All notable changes to FGx are documented here, following
[Semantic Versioning](https://semver.org/).

## [Unreleased]

### Added
- `/setup` — one-command full server setup: creates/reuses channels, roles,
  and categories; configures welcome, verification, tickets, logging, and
  clan roles; posts the verification + ticket panels and a welcome preview
- Multi-provider AI: Google Gemini and Groq in addition to OpenAI-compatible
  endpoints; select with `AI_PROVIDER` or auto-detect from `GEMINI_API_KEY` /
  `GROQ_API_KEY` / `AI_API_KEY`; `/status` shows the active provider
- `/shuffle` — random even team splits for player lists, scrim rosters
  (honors formats like `5v5`), and event participants; shuffle button on
  scrim announcements

## [1.0.0] - 2026

### Added

**Moderation**
- Full moderation suite: `/warn`, `/warnings`, `/timeout`, `/kick`, `/ban`,
  `/unban`, `/purge`, `/slowmode`, `/lock`, `/unlock`, `/nick`, `/role`
- Permission + hierarchy checks on every action, structured moderation log,
  configurable log channel

**Security**
- Anti-spam engine: flood, duplicate, mention, emoji, caps, invite,
  suspicious-link, and advertisement detection with progressive enforcement
- Anti-raid protection: join velocity, new-account and profile-similarity
  signals, automatic protection mode
- Anti-nuke protection: channel/role creation+deletion, bans, kicks, webhook
  abuse, and permission escalation limits
- AI security engine (LOG / RECOMMEND / MODERATE modes) with confidence
  thresholds — never punishes on uncertain classifications

**AI**
- FGx community assistant: `/ask`, `/ai` with per-guild system prompt,
  verified-context answers, and rate limiting
- BloxStrike assistant: `/bloxai` with strict no-fabrication guardrails

**Community**
- Welcome system with configurable channel, message template, auto-role
- Button-based verification with cooldown and duplicate protection
- Ticket system: 5 types, private channels, claim/close, transcripts, logs
- Community XP/levels: `/level`, `/rank`, `/leaderboard` with anti-spam XP

**BloxStrike competitive core**
- Player profiles: `/profile`, `/player`, FGx-recorded stats, K/D, win rate,
  streaks, FGx Competitive Rating (Bronze → FGx Legend)
- BloxStrike identity linking: `/link`, `/unlink` with duplicate protection
- Roster: `/roster` add/remove/promote/demote/inactive with configurable ranks
- Tryouts: two-part private application, staff review buttons, decisions
- Trial evaluations: 7 metrics + overall score, private reports
- Scrims, match results, clan wars, events, training with announcements
- Leaderboards (rating/kills/K-D/streak/wins/matches) with pagination
- Achievements with unlock evaluation on recorded matches
- Staff-only analysis: `/analysis player|team|match`
- `/bloxstrike` interactive hub

**Platform**
- Per-guild configuration dashboard: `/config` (menu → edit modal) and `/automod`
- `/status` health panel, `/help`, `/ping`
- Built-in `/health` HTTP endpoint for deployment checks
- Graceful shutdown, global error boundaries, safe structured logging
- SQLite persistence via Node's built-in `node:sqlite` (no native deps)

### Security

- Tokens and secrets never committed; `.env` git-ignored; secret scanning in CI
- Input validation for all user input, role/channel IDs, and lineups
- Safe logging with automatic redaction of credential-like values
- Anti-fake-stats: only staff-recorded match data becomes official FGx stats

### Deployment

- `npm start` on any Node >= 22.5 host; health endpoint for uptime checks
- Documented Discord Developer Portal setup, intents, and cloud deployment
