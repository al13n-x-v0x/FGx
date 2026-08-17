# Security Policy

FGx takes security seriously. This policy covers how to report
vulnerabilities responsibly and what to expect in return.

## Supported versions

| Version | Supported |
| --- | --- |
| 1.0.x | ✅ Supported |

Only the latest minor release receives security fixes. Older versions should
be upgraded as soon as a fix is published.

## Reporting a vulnerability

**Do not open a public GitHub issue for security vulnerabilities.**

Use GitHub's private vulnerability reporting mechanism instead:

1. Go to the repository on GitHub.
2. Open **Security → Report a vulnerability**.
3. Follow the prompts. The report is visible only to maintainers.

If GitHub private reporting is not available for this repository, contact
the maintainers directly through a private channel and do not disclose the
issue publicly until it has been addressed.

### What to include

- The affected version(s)
- A clear description of the vulnerability
- Steps to reproduce (minimal, sanitized)
- Impact assessment (what an attacker could do)
- Any suggested fix, if you have one

**Never include live credentials, tokens, or keys in a report.** If you
believe a secret has been exposed (e.g. a bot token was committed), treat
it as compromised, stop using it, rotate it immediately, and mention that
rotation was performed rather than pasting the secret itself.

## Responsible disclosure

- Give maintainers a reasonable window (typically 90 days) to fix and
  release a patch before publishing details.
- Do not exploit a vulnerability beyond what is needed to demonstrate it.
- Do not access, modify, or delete data you are not authorized to touch.

## Scope

In scope:

- The FGx source code in this repository
- Misuse of FGx bot commands that could damage a Discord server or its data
- Credential handling and secret exposure

Out of scope:

- Discord Inc. services, Discord API rate limits, and Discord client issues
- BloxStrike game servers or BloxStrike accounts
- Third-party libraries (report those to their maintainers)

## Security commitments

FGx will:

- Never commit secrets or credentials to the repository
- Validate all user input and role/channel IDs
- Never execute arbitrary user-provided code
- Log errors without exposing secrets or stack traces to users
- Apply security fixes to the supported version promptly
