# Commands

FGx exposes the following slash commands. Staff-only commands require the
relevant Discord permission or a clan staff rank (Captain+, configured via
`/config clan` rank roles).

## Moderation

| Command | Description | Permission |
| --- | --- | --- |
| `/warn <user> <reason>` | Warn a member; DM + log | Moderate Members |
| `/warnings <user>` | List active warnings | Moderate Members |
| `/timeout <user> <duration> [reason]` | Timeout (e.g. `30m`, `2h`, `1d`) | Moderate Members |
| `/kick <user> [reason]` | Kick a member | Kick Members |
| `/ban <user> [reason] [delete_days]` | Ban a member | Ban Members |
| `/unban <user_id> [reason]` | Unban by ID | Ban Members |
| `/purge <amount> [channel]` | Bulk-delete up to 100 messages | Manage Messages |
| `/slowmode <seconds> [channel]` | Set/remove slowmode | Manage Channels |
| `/lock [channel] [reason]` | Deny send for @everyone | Manage Channels |
| `/unlock [channel]` | Restore send for @everyone | Manage Channels |
| `/nick <user> [nickname]` | Change nickname | Manage Nicknames |
| `/role <user> <role> [remove]` | Add/remove a role | Manage Roles |

## Security

| Command | Description | Access |
| --- | --- | --- |
| `/security status` | Protection state, thresholds, lockdown | Anyone |
| `/security enable` | Enable anti-raid + anti-nuke | Admin |
| `/security disable` | Disable protection + unlock channels | Admin |
| `/security lockdown [roles]` | Manual lockdown | Admin |
| `/automod view` | Show automod configuration | Admin |
| `/automod set <category> <key> <value>` | Change one setting | Admin |

## Community

| Command | Description |
| --- | --- |
| `/profile [user]` | FGx player profile (stats, rank, rating) |
| `/player [user]` | Alias of `/profile` |
| `/link submit <username>` | Link your BloxStrike username (pending staff verification) |
| `/link verify <user>` | Verify a member's link (staff: Manage Messages / Manage Guild, or Captain+) |
| `/link list` | List pending verifications (staff) |
| `/unlink` | Remove your BloxStrike link |
| `/roblox verify <username>` | Bloxlink-style Roblox verification (code goes in your Roblox About) |
| `/roblox status` | Show your Roblox verification status |
| `/roblox unlink [user]` | Remove your Roblox link — or any member's as staff |
| `/roblox leaderboard [page]` | First members to verify Roblox (👑 = first 50 Pioneers) |
| `/roblox list [page]` | Paginated list of verified Roblox members (staff) |
| `/roblox panel` | Create the Roblox verification panel (staff) |
| `/fgxcoin wallet [user]` | Your (or a member's) FGx balance, lifetime earned, daily streak | Anyone |
| `/fgxcoin daily` | Claim the daily FGx reward — streak grows +25/day up to 500 | Anyone |
| `/fgxcoin weekly` | Claim the weekly FGx reward | Anyone |
| `/fgxcoin transfer <user> <amount>` | Send FGx to a member (5% tax) | Anyone |
| `/fgxcoin gamble <amount>` | 50/50 coinflip — double or lose it | Anyone |
| `/level [user]` / `/rank [user]` | Community XP and level |
| `/leaderboard <category>` | Rating / kills / K-D / streak / wins / matches (paginated) |
| `/achievements [user]` | Achievement catalog with unlock state |
| `/verify setup` | Create the verification panel (admin) |
| `/welcome setup|disable` | Configure the welcome system (admin) |

## Tickets

| Command | Description | Access |
| --- | --- | --- |
| `/ticket setup` | Create the ticket panel | Admin |
| `/ticket list` | List open tickets | Anyone |
| `/ticket close <id>` | Close a ticket | Manage Channels |
| `/ticket transcript <id>` | Download a transcript | Anyone |

Buttons inside tickets: **Claim**, **Close** (saves a transcript), and
**Delete channel** after closing.

## BloxStrike competitive

| Command | Description | Access |
| --- | --- | --- |
| `/bloxstrike` | Interactive hub (select menu, incl. loadout guide) | Anyone |
| `/fgx` | FGx control panel (profile, roster, private server, AI, security…) | Anyone |
| `/private create <mode> [hours]` | Temporary branded server for 1v1–6v6 / practice (Roblox-verified or staff) | Verified |
| `/private info` | List active private servers + invites | Anyone |
| `/private end [id]` | Delete a private server | Owner/Staff |
| `/loadout` | Instant BloxStrike loadout guide (buys, roles, economy) | Anyone |
| `/shuffle players <players> [team_size] [team_count]` | Shuffle any player list into even teams | Anyone |
| `/shuffle scrim <id> [team_size]` | Shuffle a scrim roster (uses the format, e.g. 5v5) | Anyone |
| `/shuffle event <id> [team_size]` | Shuffle an event participant list | Anyone |
| `/clan info|members|apply|stats` | Clan info and membership | Anyone |
| `/roster view` | Full roster | Anyone |
| `/roster add|remove|promote|demote|inactive` | Roster management | Staff |
| `/tryout apply` | Two-part application (modal) | Anyone |
| `/tryout status` | Your application status | Anyone |
| `/tryout review <id>` / `/tryout list [status]` | Staff review | Staff |
| `/evaluate record|view` | Trial evaluations (private) | Staff |
| `/scrim create|info|join|leave|result|cancel` | Scrim management | Staff for create/result/cancel |
| `/match result` | Record official result + lineup | Staff |
| `/match list` | Recent results | Anyone |
| `/event create|list|join|leave|start|end` | Events | Staff for create/start/end |
| `/clanwar create|accept|decline|result|history` | Clan wars | Staff |
| `/training schedule|list|join|cancel` | Training sessions | Staff for schedule/cancel |
| `/analysis player|team|match` | Performance analysis | Staff |
| `/bloxai <question>` | BloxStrike assistant | Anyone |

## AI assistant

| Command | Description |
| --- | --- |
| `/ask <question>` | FGx community assistant (incl. BloxStrike knowledge base) |
| `/ai <question>` | Alias of `/ask` |
| `/bloxai <question>` | BloxStrike-focused assistant (knowledge base + no-fabrication guardrails) |

## System

| Command | Description |
| --- | --- |
| `/status` | Latency, uptime, guilds, users, AI/DB/security status |
| `/help` | Command guide |
| `/ping` | Latency check |
| `/setup` | One-command full setup: channels, roles, welcome, verification, tickets, logs (admin) |
| `/config menu|view|welcome|moderation|security|ai|logs` | Configuration dashboard (admin) |
