# Contributing to FGx

Thanks for wanting to help build FGx. This project is maintained like a
serious software project: clean commits, tests, and no broken builds.

## Development setup

Requirements: Node.js **>= 22.5** (uses the built-in `node:sqlite` module)
and npm.

```bash
npm install
cp .env.example .env   # fill in DISCORD_TOKEN, CLIENT_ID, GUILD_ID
npm start              # run the bot (register: npm run dev for auto-restart)
```

Scripts:

| Script | Purpose |
| --- | --- |
| `npm start` | Start the bot |
| `npm run dev` | Start with file-watch (development) |
| `npm test` | Run the unit tests |
| `npm run lint` | Lint (must pass with zero warnings) |
| `npm run format` | Auto-fix lint issues |
| `npm run validate` | Startup validation (env, DB, imports, commands, secrets) |

## Branch naming

- `feat/<description>` — new features
- `fix/<description>` — bug fixes
- `security/<description>` — security hardening
- `docs/<description>` — documentation
- `ci/<description>` — CI / tooling

## Commit expectations

Use conventional, meaningful commit messages. Examples:

```text
feat: add FGx anti-raid protection
fix: prevent duplicate tickets
security: improve token handling
docs: update deployment guide
ci: add automated tests
```

Avoid meaningless messages like `update`, `test`, `stuff`. One logical
change per commit. Never commit secrets, `.env`, or generated junk.

## Testing

- Run `npm test` before pushing.
- Add or update tests when you change behavior — especially for the
  security engines (anti-spam, anti-raid, anti-nuke), validation, and the
  rating algorithm.
- Run `npm run validate` — it must pass.
- Run `npm run lint` — zero warnings required.

## Pull requests

1. Create a branch off `main` with a clear name.
2. Make focused changes with clean commits.
3. Verify: `npm run lint`, `npm test`, `npm run validate`.
4. Open a PR using the pull request template and fill in every section.

Reviewers will check security impact, permission handling, and that no
secrets are introduced.

## Security rules

- Never commit tokens, API keys, or credentials.
- Never log secrets.
- Never trust user-provided role/channel IDs without validation.
- Never execute arbitrary user-provided code.
- Sanitize user input before it reaches embeds or the database.
- Prefer the safest default for any automated moderation action.

## Code style

- CommonJS (`require` / `module.exports`), `'use strict'` at the top.
- Two-space indentation, semicolons, double quotes.
- Keep functions small and single-purpose.
- Services contain logic; command files stay thin.
- Add a short copyright header to new files:

```js
/*
 * Copyright © 2026 FGx.
 * All rights reserved.
 */
```
