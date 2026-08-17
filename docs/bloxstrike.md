# BloxStrike Competitive Core

FGx's primary purpose is competitive clan management for BloxStrike. This
document describes the competitive systems and the data-integrity rules that
make them trustworthy.

## Data integrity (anti-fake-stats)

Official FGx statistics can **only** be created by:

1. **Staff-recorded match data** — `/match result` (or `/clanwar result`),
   which updates player kills, deaths, wins/losses, streaks, rating, and
   achievements in one transaction (`src/services/clan/matchService.js`).
2. **Future official API integrations** — the identity layer
   (`/link`) is designed so an official BloxStrike API can plug in later and
   mark links/stats as `verified_api` without rewriting the bot.

Users cannot edit their own stats. Player profiles display a clear
transparency note: stats are shown as **FGx-recorded** (staff-verified) or
**unverified** (linked identity pending verification).

## Identity linking

- `/link <username>` stores a pending link with a unique constraint per
  guild, so one BloxStrike username cannot be claimed by two Discord
  accounts.
- Staff verify links (status → `verified`); without an official API this is
  the identity check.
- `/unlink` removes a link.
- Profiles show `✅ verified` or `⏳ unverified` next to the username.

## Ranks

`Recruit → Trial → Member → Elite → Captain → Manager → Co-Leader → Leader →
Owner` — each rank can be bound to a Discord role via `/config clan`
(`clan.ranks.<Rank>`). Setting a rank via `/roster add|promote|demote`
applies the role and removes conflicting rank roles. Staff operations
require Captain+ (or Manage Guild).

## Tryouts

1. `/tryout apply` opens a two-part modal (Discord modals allow 5 fields):
   Part 1 — BloxStrike username, Discord username, age range, region,
   previous clan; Part 2 — main mode, experience, strengths, availability.
2. Applications are stored privately (`tryouts` table); personal details are
   never posted to public channels.
3. Staff use `/tryout review <id>` → buttons **Accept / Reject / Trial /
   Request Info**. Every decision is logged and the applicant is DM'd
   (best-effort).
4. Acceptance promotes the player to **Trial**. Evaluations follow.

## Evaluations

`/evaluate record` scores Aim, Movement, Game Sense, Mechanics,
Communication, Teamwork, Consistency (1–10) plus a recommendation, and
computes the overall. Reports are staff-only embeds (`evaluations` table),
rendered as a clean trial report.

## Scrims, matches, clan wars, events, training

- Announcements are generated from database rows (`announcements.js`) with
  join/leave buttons; participants lists update in place.
- `/match result` (staff) is the single official stats entry point; it takes
  a lineup string `userId:kills:deaths,userId:kills:deaths`, updates every
  player, and evaluates achievements.
- `/clanwar result` records the war and also creates a tagged `[clan war]`
  match entry so records and achievements include wars.

## FGx Competitive Rating

Internal rating (not an official BloxStrike ranking — labeled as such):

- Base `1000`; win `+winGain` (+ K/D bonus capped at 3× the factor, +
  streak bonus on streaks ≥ 2); loss `−lossLoss`; draw `0`.
- Tiers: Bronze → Silver → Gold → Platinum → Diamond → Master → Elite →
  FGx Legend (2100+).
- The algorithm is configurable per guild (`/config clan` →
  `clan.rating.*`).

## Leaderboards & achievements

- `/leaderboard` supports rating, kills, K-D, win streak, wins, and matches
  with pagination.
- Achievements (First Win, 10/50/100 Wins, Win Streak, Clan War Veteran,
  Tournament Champion, FGx Legend) unlock automatically from recorded data
  (`achievementsService.js`); `[clan war]` / `[tournament]` tags feed the
  war/tournament achievements.

## Analysis (staff only)

`/analysis player|team|match` summarizes only recorded data: record, win
rate, K/D, recent trend, strength/weakness heuristics, and sample size —
all clearly labeled as internal FGx metrics.

## Knowledge base (loadouts & strategy)

`src/data/bloxstrike.js` is FGx's curated BloxStrike strategy guide — the
same single source of truth feeds three surfaces:

- **`/loadout`** — instant embed: buy situations (pistol/eco/force/full
  buy/anti-eco), roles (entry, support, anchor, AWPer, IGL, lurker),
  utility, economy, and teamplay rules.
- **`/bloxstrike` hub → Loadouts** — the same guide inside the hub.
- **AI assistant (`/ask`, `/ai`, `/bloxai`)** — the guide is injected as
  verified system context, so loadout and strategy questions get real
  answers instead of "I don't have verified data for that".

Weapon advice is deliberately **class/role-based** (e.g. "AK/M4-class
rifle", "Deagle-class pistol") rather than inventing specific gun names
or stats, so it stays accurate across balance patches and never pretends
to be official game data.
