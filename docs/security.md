# Security

FGx treats security as a core feature. This document explains the threat
model and the specific protections in place.

## Principles

1. **Never trust user input.** Every command argument, role ID, channel ID,
   and lineup string is validated before use (`src/utils/validate.js`).
2. **Least privilege for the bot.** Moderation commands check both the
   invoker's permissions and role hierarchy; the bot refuses actions it does
   not have permission to complete.
3. **Safest default automation.** Automated punishment is progressive and
   capped; the AI engine defaults to `LOG` and never punishes on uncertain
   classifications; anti-raid never mass-bans.
4. **No secrets in the repo.** Tokens live in environment variables only.
   Logging redacts credential-like values.

## Secret handling

- `.env` and `.env.*` are git-ignored (`.env.example` is the only tracked
  template, with no real values).
- `src/utils/logger.js` redacts anything resembling tokens/keys before
  writing log lines.
- `scripts/validate.js` (runs in CI) scans all source files for common
  secret patterns.
- GitHub secret scanning + push protection are enabled on the repository;
  `security.yml` runs Gitleaks on every push/PR.

## Moderation safety

`src/services/moderation/moderationService.js` enforces, for every action:

- **Permission check** — the invoker needs the Discord permission.
- **Hierarchy check** — the invoker's highest role must outrank the target,
  the bot's role must outrank the target, and the target cannot be the
  owner or the invoker themselves.
- **Logging** — the action is recorded in `moderation_log` and posted to the
  configured log channel.
- **Safe errors** — permission/validation failures return clean messages;
  unexpected failures return a generic message, never a stack trace.

## Anti-spam

Detection signals and configurable thresholds (`/automod` or
`/config moderation`):

- Rapid messages (`maxMessages` / `windowSeconds`, default 5/5)
- Duplicates (`duplicateCount`, default 3)
- Mass mentions (`maxMentions`, default 10)
- Excessive emojis (`maxEmojis`, default 15)
- Excessive caps (ratio + minimum length)
- Invite links (toggleable)
- Suspicious links (URLs outside the whitelist are flagged for AI review)
- Repeated advertisements (same content across ≥ 3 channels)

Enforcement ladder per user: **warn → delete → timeout**, capped by the
configured ceiling (`WARN`/`DELETE`/`TIMEOUT`, default `DELETE`). The
offense counter resets after a quiet period. Staff (`ManageMessages`) are
immune.

## Anti-raid

Signals on member joins (`src/services/security/antiraid.js`):

- Join velocity (default 8 joins / 30s)
- New-account patterns (default 4 accounts younger than 24h)
- Repeated profile similarity (avatar or username patterns)

On detection: protection mode (lockdown for `@everyone`), staff alert,
full logging. **Never bans automatically** — the decision stays with staff.

## Anti-nuke

Per-executor limits within a sliding window
(`src/services/security/antinuke.js`), all configurable:

| Action | Default limit (per 60s) |
| --- | --- |
| Channel deletions / creations | 10 / 10 |
| Role deletions / creations | 5 / 5 |
| Bans / kicks | 10 / 10 |
| Webhook changes | 5 |
| Permission escalations (dangerous bits) | 5 |

On anomaly: staff alert, owner DM, protection mode, full audit log. The bot
never silently undoes staff actions.

## AI security

`src/services/ai/securityEngine.js` classifies content that passes heuristic
suspicion (invites, links, phishing patterns, all-caps). Action modes:

- **LOG** (default, safest) — analysis is logged only.
- **RECOMMEND** — logged + staff notification with the recommendation.
- **MODERATE** — deletes + timeouts only on HIGH risk with confidence above
  `moderateConfidence` (default 0.9). Everything below that is logged only.

The assistant (`/ask`, `/ai`, `/bloxai`) is rate-limited per user and its
system prompt forbids revealing tokens, environment variables, internal
configuration, moderation logs, hidden instructions, or private user data.

## Input validation highlights

- Snowflakes must match `^\d{15,21}$`.
- Role/channel IDs are resolved against the actual guild before use.
- Durations must match `^\d+[smhdw]$` and are bounded.
- Lineup strings (`userId:kills:deaths`) are parsed and bounded.
- Text lengths are clamped everywhere they reach embeds or the database.
