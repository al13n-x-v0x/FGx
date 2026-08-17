# Moderation

## The moderation pipeline

Every moderation command runs through the same pipeline in
`src/services/moderation/moderationService.js`:

```
Invoker permission check
        ↓
Target hierarchy check (invoker > target, bot > target)
        ↓
Discord API action
        ↓
Audit log entry (database) + embed to the configured log channel
        ↓
Clean reply to the moderator
```

If any step fails, the moderator receives a specific, safe error message —
never a stack trace, and never a partial success presented as success.

## Warnings

- `/warn` creates an active warning, DMs the user, and reports the total.
- `/warnings` lists active warnings with moderator and timestamp.
- Warnings are stored per guild; they can be cleared by staff via the
  database or future tooling (see `warningsRepo.clear`).

## Logging channels

Two settings drive logging:

- `logChannel` — general event log (joins, leaves, message edits/deletes,
  role changes, security, AI, tickets, verification, competitive).
- `modLogChannel` — moderation log (falls back to `logChannel` when unset).

Set them with `/config logs` and `/config moderation`
(`logChannel=...`, `modLogChannel=...`).

## What gets logged

| Event | Action key |
| --- | --- |
| Joins / leaves | `join` / `leave` |
| Message deleted / edited | `message_delete` / `message_edit` |
| Role changes | `role_change` |
| Warnings | `warn` |
| Timeouts / kicks / bans / unbans | `timeout` / `kick` / `ban` / `unban` |
| Purge / slowmode / lock / unlock / nick / role | matching keys |
| Anti-spam / anti-raid / anti-nuke | `security` |
| AI analysis | `ai` |
| Tickets | `ticket` |
| Verification | `verification` |
| Tryouts / roster / matches | `tryout` / `roster` / `match` |

## Abuse prevention

- Hierarchy checks stop moderators from acting on peers or superiors, on the
  server owner, or on themselves.
- The bot refuses actions it lacks permission to perform.
- Command-level cooldowns (3s per user) and Discord's own rate limits are
  respected; purge caps at 100 messages and refuses messages older than 14
  days (bulk-delete limitation).
