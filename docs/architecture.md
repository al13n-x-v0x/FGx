# Architecture

FGx is a modular Node.js Discord bot. Every subsystem is a separate module
with a single responsibility; command files stay thin and delegate to
services.

## Runtime

- **Node.js >= 22.5** — uses the built-in `node:sqlite` module (`DatabaseSync`),
  so there are **no native dependencies** and installs work on any platform.
- **discord.js v14** — gateway, interactions, embeds, components.
- **SQLite (built-in)** — all persistence. Synchronous access, WAL mode,
  automatic migrations via `PRAGMA user_version`.
- **Built-in HTTP server** — `/health` endpoint for deployment monitoring.

## Module map

```
src/index.js                  bootstrap: DB → commands → events → login → dashboard
src/config/env.js             environment validation (throws early on missing keys)
src/config/constants.js       brand, ranks, rating tiers, achievements, ticket types
src/config/guildDefaults.js   per-guild default configuration (deep-merged)
src/utils/*                   cooldowns, rate limits, validation, embeds, pagination, errors
src/database/index.js         connection + migration runner
src/database/schema.js        SQL migrations (append-only)
src/database/repos/*          data access (guildConfig, profiles, moderation, community, competitive)
src/commands/**               one file per slash command (data + execute)
src/events/**                 gateway event handlers
src/services/**               business logic (never touches interactions directly)
src/interactions/router.js    customId → handler dispatch for buttons/selects/modals
src/dashboard/server.js       health endpoint
```

## Data flow

**Slash command:** interaction → `interactionCreate.js` (cooldown, error
boundary) → `commands/<group>/<name>.js` → `services/*` → repositories → SQLite.

**Component (button/select/modal):** interaction → `interactionCreate.js` →
`interactions/router.js` (prefix match on `customId`) → service.

**Gateway event (message, join, delete):** event handler → security/service
logic → audit logger → log channel.

## Key design decisions

- **Synchronous SQLite** — avoids race conditions entirely; the workload
  (per-command reads/writes) is trivially fast.
- **JSON config blobs** — per-guild configuration is a deep-merged JSON
  document with typed defaults, which keeps the config surface simple while
  remaining per-server.
- **In-memory security state** — anti-spam/anti-raid/anti-nuke track recent
  events in bounded `Map` caches with sweep timers (no unbounded growth).
- **Progressive enforcement** — anti-spam escalates warn → delete → timeout
  per burst, capped by the configured `action` ceiling, and resets after a
  quiet period. No permanent punishment from a single message.
- **Audit-first logging** — every meaningful action writes to
  `moderation_log` and, when configured, posts a clean embed to the log
  channel. Logging failures never break the action itself.
- **Graceful degradation** — no `AI_API_KEY`? AI commands say so, the AI
  security engine skips classification, and everything else still works.

## Concurrency & performance

- One process, single-threaded event loop (standard for a Discord bot).
- Cooldowns (`Cooldown`) and sliding windows (`RateLimiter`) bound user load.
- Per-user AI analysis limiter protects the API budget.
- Cache busting is avoided — discord.js manages gateway caches; repos read
  fresh from SQLite on demand.
