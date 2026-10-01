# STRIKE//ZERO

A fast-paced multiplayer **FPS prototype for Roblox** — COD-inspired gunplay feel,
Block Strike / Rivals-style accessibility, TSB-inspired melee depth — shipped as a
single double-clickable **`strike-zero.rbxlx`** place file built by a dependency-free
Node script.

> Open `strike-zero.rbxlx` in Roblox Studio → **Play**. Two teams fight Team
> Deathmatch on an original CS2-inspired arena ("FOUNDRY"). No external asset IDs
> are used anywhere — the file cannot break on missing meshes, sounds, or textures.

## The loop

Spawn → sprint/slide through three lanes → shoot (AR / SMG / shotgun / pistol) →
run dry at **exactly 0 ammo** and **gun-butt** the enemy → swap to the tanto for a
**3-hit combo**, **heavy**, or **parry** → win the round to 30 kills → auto next round.

## Controls

| Input | Action |
| --- | --- |
| `WASD` + mouse | Move / aim (first person, locked) |
| `Shift` | Sprint |
| `Ctrl` / `C` (while sprinting) | Slide (jump cancels, keeps momentum) |
| `Space` | Jump |
| `Mouse 1` | Fire · melee light attack · **gun-butt when mag = 0** |
| `Mouse 2` | Heavy attack (knife equipped) |
| `F` (hold) | Block — press within 0.22 s of an incoming melee hit to **parry** |
| `R` | Reload |
| `1` / `2` / `3` | Primary / secondary / melee |
| `GFX` button (top-left) | LOW / MEDIUM / HIGH graphics presets |

## Repository structure

```
strike-zero/
├── build.js                 # assembles XML → strike-zero.rbxlx (+ its own test suite)
├── map.js                   # static map data (FOUNDRY): geometry, colors, materials
├── src/
│   ├── shared/              # → ReplicatedStorage/Shared   (ModuleScripts)
│   │   ├── Config.lua           teams, movement, match rules, graphics, audio hooks
│   │   ├── WeaponConfig.lua     modular weapon table + viewmodel blueprints
│   │   ├── CombatConfig.lua     melee combo/parry tuning + validation tolerances
│   │   └── Utility.lua          signals, rate limiting, helpers, audio playback
│   ├── server/              # → ServerScriptService
│   │   ├── Bootstrap.lua        # Script: requires + boots the services below
│   │   └── Services/            # ModuleScripts
│   │       ├── PlayerService.lua    teams, spawns, respawn, spawn protection
│   │       ├── WeaponService.lua    ammo/fire-rate/reload/switch (authoritative)
│   │       ├── CombatService.lua    raycasts, damage, melee, block/parry
│   │       ├── MatchService.lua     TDM scores, timer, kill feed, streaks, rounds
│   │       └── AdminService.lua     permission-checked chat commands
│   └── client/              # → StarterPlayer/StarterPlayerScripts
│       ├── ClientMain.lua        # LocalScript: hub + Notify routing, boots controllers
│       └── Controllers/          # ModuleScripts
│           ├── MovementController.lua  sprint / slide (event-driven, no loops)
│           ├── WeaponController.lua     viewmodel, recoil, firing, ammo prediction
│           ├── CombatController.lua     melee input, combos, block, gun-butt routing
│           └── UIController.lua         runtime-built HUD + graphics presets
├── strike-zero.rbxlx        # GENERATED — open this in Studio
└── README.md
```

**Why two bootstraps?** Services/Controllers are `ModuleScript`s (requireable,
testable, no hidden side effects); `Bootstrap` (server) and `ClientMain` (client)
are the only executable scripts and wire everything together. Cross-service calls
use *lazy* `require`s inside functions so the dependency graph stays acyclic.

## Server-authoritative combat

The client reports **intent only**. Every outcome is computed on the server:

| Client says | Server verifies / computes |
| --- | --- |
| "I fired along this direction" | equipped weapon, mag > 0, fire rate (±60 ms jitter tolerance), origin within 10 studs of the real head, rough facing angle, per-pellet spread, raycast, damage, headshots |
| "I swung (light/heavy/gunbutt)" | swing cooldown, combo window, cone + line-of-sight, gun-butt **requires mag == 0**, block/parry timing, knockback, hit stun |
| "I'm reloading / switching" | mag/reserve arithmetic, reload duration, slot ownership |
| never: damage, kills, scores | kill feed + score only from server death pipeline |

Anti-spam token buckets backstop the fire/melee remotes. All state tables are
cleaned in `PlayerRemoving` (no leaks). Five `RemoteEvent`s total
(`Fire`, `Reload`, `Switch`, `Melee`, `Notify`) — everything server→client rides
one multiplexed `Notify` channel keyed by `k`, so adding feedback costs zero new
remotes.

## Weapons (modular framework)

Four guns in [WeaponConfig.lua](src/shared/WeaponConfig.lua), all data-driven —
to add weapon #5: copy an entry, set `id/slot`, tune numbers, optionally add a
viewmodel blueprint. Nothing else changes; `!giveweapon <id>` works immediately.

| id | weapon | dmg | RPM | mag | reload | spread | headshot |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `ar` | VK-7 RIFLE | 24 | 600 | 30 | 2.2 s | 0.9° | ×2.0 |
| `smg` | WASP SMG | 17 | 800 | 25 | 1.8 s | 1.5° | ×1.8 |
| `shotgun` | BREAKER-8 | 11×8 | 70 | 6 | 2.8 s | 4.0° | ×1.5 |
| `pistol` | M1 SIDEARM | 26 | 333 | 12 | 1.5 s | 1.0° | ×2.0 |

Melee (tanto + gun-butt) is tuned in [CombatConfig.lua](src/shared/CombatConfig.lua):
light chain of 3 (20/20/32, 0.7 s window), heavy (45 + knockback), gun-butt
(30, only at mag = 0), block (−75 %), parry window 0.22 s (staggers attacker 1.4 s).

## Animation & audio (zero external assets)

- **Viewmodel** is built procedurally from data blueprints and animated in camera
  space: recoil spring with recovery, aim sway, walk bob, sprint tilt, reload dip,
  knife swing arcs, gun-butt lunge, pooled muzzle flash. No animation uploads needed.
- **Audio** is placeholder hooks: `Config.Audio` categories (`gunshot`, `reload`,
  `hit`, `kill`, `melee`, `slide`, `ui`, `footstep`) — drop in your own
  `rbxassetid://` values; empty string = silent. Sounds play locally in
  `SoundService` (never replicate).
- Swapping the procedural viewmodel for real Rivals/TSB-style animation IDs later:
  keep `WeaponController.playSwing` as the single animation entry point.

## Admin system

Server-side permission gate in [AdminService.lua](src/server/AdminService.lua) —
allowed in Studio, for `Config.Admins[userId]`, and for the private-server owner;
everyone else's `!commands` are silently ignored *before parsing*.

```
!giveweapon <ar|smg|shotgun|pistol|knife> [player]   !heal [player]
!speed <multiplier> [player]      !gravity <n>       !lowgravity
!teleport <player> [target]       !announcement <text...>
!freeze <player>                  !respawn <player>
```

## Graphics presets (client-local, zero replication)

`LOW` (default): shadows off, no post-processing, fog cull at 1200 studs, map
materials flattened locally to SmoothPlastic (far fewer texture samples).
`MEDIUM`: original materials, no post. `HIGH`: + bloom/color grade, shadows on.
Switching never touches the server; response time is never traded for visuals.

## Map: FOUNDRY

Original layout inspired by competitive CS2/Bloxstrike *structure* (three lanes,
mid control, spawn plazas) — no copyrighted geometry. ~56 static anchored parts,
3 materials (Concrete/Metal/SmoothPlastic), no transparency except invisible spawn
markers, no moving objects, no physics bodies beyond characters. Two truss tower
posts, raised mid platform with ramps, modular crate cover.

## Build & verify

```bash
node --check build.js && node --check map.js   # syntax
node build.js                                  # build + self-verification
```

`build.js` fails the build unless all of these pass: Lua block/delimiter balance
for every embedded source, XML well-formedness (balanced tags + entity validation),
unique non-reserved referents, and expected instance-tree/parent assertions
(1 Script, 1 LocalScript, 13 ModuleScripts, 5 remotes, map under Workspace).

## Performance notes

- Server: one 1 Hz match-clock loop; everything else event-driven. Raycasts only
  on actual shots/swings. No NPC/humanoid simulation.
- Client: one `RenderStepped` binding (viewmodel/recoil, cheap early-outs),
  everything else hub events. UI never polls. Pooled kill-feed labels, damage
  numbers, single reused muzzle flash part.
- Replication: static map never replicates changes; feedback multiplexed on one
  remote; remotes only fire on real actions.

## Out of scope (structured to bolt on)

Armor, ADS, sounds once ids exist, more weapons (`!giveweapon` already modular),
ranked/ELO, map voting, mobile controls, monetization.
