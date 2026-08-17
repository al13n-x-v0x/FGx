# Configuration

Configuration is **per Discord server** and stored in the database. There is
no global config file; defaults live in
`src/config/guildDefaults.js` and are deep-merged with per-guild overrides.

## Quick setups

| Command | What it configures |
| --- | --- |
| `/welcome setup <channel> [message] [role]` | Welcome channel, template, auto-role |
| `/verify setup <channel> <role> [cooldown_minutes]` | Verification panel + role |
| `/ticket setup` | Ticket panel (uses `tickets.categoryId` — set it first via `/config tickets`) |

## The config dashboard

`/config` opens an interactive menu. Pick a category to view its current
values, then press **Edit** and enter `key=value` lines (one per line) in
the modal. Every value is type-checked before it is stored.

Categories: `welcome`, `moderation` (anti-spam/anti-raid/anti-nuke +
mod log channel), `security` (lockdown roles), `ai`, `logs`, `verification`,
`tickets`, `clan` (rank roles + rating algorithm), `xp`, `rules`.

## Quick automation settings

`/automod set <category> <key> <value>` accepts:

- booleans: `true` / `false`
- integers: `10`
- floats: `0.85`
- choices: `LOG` / `RECOMMEND` / `MODERATE` (ai.actionMode), `WARN` /
  `DELETE` / `TIMEOUT` (antispam.action)
- comma lists: `channel1.com,channel2.com` (linkWhitelist)

## Key reference

### antispam (defaults)
| Key | Default | Meaning |
| --- | --- | --- |
| `enabled` | `true` | Master toggle |
| `maxMessages` | `5` | Flood threshold |
| `windowSeconds` | `5` | Flood window |
| `duplicateCount` | `3` | Identical messages |
| `maxMentions` | `10` | Mentions per message |
| `maxEmojis` | `15` | Emojis per message |
| `capsRatio` | `0.7` | Uppercase ratio |
| `capsMinLength` | `15` | Min length for caps check |
| `invitesEnabled` | `true` | Flag invite links |
| `linksEnabled` | `true` | Flag out-of-whitelist links |
| `linkWhitelist` | `[]` | Allowed hosts |
| `purgeEnabled` | `true` | Delete flagged messages |
| `action` | `DELETE` | Enforcement ceiling: WARN/DELETE/TIMEOUT |

### antiraid (defaults)
| Key | Default | Meaning |
| --- | --- | --- |
| `enabled` | `true` | Master toggle |
| `joinThreshold` | `8` | Joins to trigger |
| `windowSeconds` | `30` | Window |
| `newAccountHours` | `24` | Account-age threshold |
| `suspiciousThreshold` | `4` | Count for pattern signals |

### antinuke (defaults, per 60s window)
| Key | Default |
| --- | --- |
| `channelDeleteLimit` / `channelCreateLimit` | `10` / `10` |
| `roleDeleteLimit` / `roleCreateLimit` | `5` / `5` |
| `banLimit` / `kickLimit` | `10` / `10` |
| `webhookLimit` | `5` |
| `permissionChangeLimit` | `5` |

### ai (defaults)
| Key | Default | Meaning |
| --- | --- | --- |
| `securityEnabled` | `true` | AI content classification |
| `assistantEnabled` | `true` | `/ask` `/ai` `/bloxai` |
| `actionMode` | `LOG` | LOG / RECOMMEND / MODERATE |
| `securityConfidence` | `0.85` | HIGH-risk confidence for logging |
| `moderateConfidence` | `0.9` | Confidence required to act in MODERATE |
| `userRateLimit` | `5` | Assistant calls per minute per user |

### clan
| Key | Meaning |
| --- | --- |
| `ranks.<Rank>` | Discord role ID per rank (Owner → Recruit) |
| `rating.winGain` / `lossLoss` / `kdFactor` / `streakBonus` | FGx rating algorithm |

### xp
| Key | Default | Meaning |
| --- | --- | --- |
| `enabled` | `true` | XP toggle |
| `perMessage` | `1` | XP per eligible message |
| `cooldownSeconds` | `60` | Min seconds between grants |

## Validation rules

- All snowflakes must be valid Discord IDs and resolve to real roles/channels
  in the guild when applicable.
- `ai.securityConfidence` and `ai.moderateConfidence` must be 0–1.
- Never set a rank role to a role that would conflict with moderation roles
  unless you intend to.
