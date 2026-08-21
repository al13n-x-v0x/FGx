'use strict';

/*
 * Copyright © 2026 FGx.
 * All rights reserved.
 */

/**
 * Database schema. Migrations are applied in order by src/database/index.js.
 * Each entry bumps PRAGMA user_version; never edit an applied migration.
 */

const MIGRATIONS = [
  // Migration 1 — initial schema.
  `
  CREATE TABLE IF NOT EXISTS guild_config (
    guild_id    TEXT PRIMARY KEY,
    config      TEXT NOT NULL DEFAULT '{}',
    updated_at  TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS profiles (
    guild_id        TEXT NOT NULL,
    user_id         TEXT NOT NULL,
    blox_username   TEXT,
    clan_rank       TEXT NOT NULL DEFAULT 'Recruit',
    wins            INTEGER NOT NULL DEFAULT 0,
    losses          INTEGER NOT NULL DEFAULT 0,
    kills           INTEGER NOT NULL DEFAULT 0,
    deaths          INTEGER NOT NULL DEFAULT 0,
    matches         INTEGER NOT NULL DEFAULT 0,
    rating          INTEGER NOT NULL DEFAULT 0,
    current_streak  INTEGER NOT NULL DEFAULT 0,
    best_streak     INTEGER NOT NULL DEFAULT 0,
    join_date       TEXT,
    stats_source    TEXT NOT NULL DEFAULT 'unverified',
    meta            TEXT NOT NULL DEFAULT '{}',
    updated_at      TEXT NOT NULL DEFAULT (datetime('now')),
    PRIMARY KEY (guild_id, user_id)
  );

  CREATE TABLE IF NOT EXISTS links (
    guild_id      TEXT NOT NULL,
    user_id       TEXT NOT NULL,
    blox_username TEXT NOT NULL,
    status        TEXT NOT NULL DEFAULT 'pending',
    created_at    TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at    TEXT NOT NULL DEFAULT (datetime('now')),
    PRIMARY KEY (guild_id, user_id),
    UNIQUE (guild_id, blox_username)
  );

  CREATE TABLE IF NOT EXISTS warnings (
    id            INTEGER PRIMARY KEY AUTOINCREMENT,
    guild_id      TEXT NOT NULL,
    user_id       TEXT NOT NULL,
    moderator_id  TEXT NOT NULL,
    reason        TEXT NOT NULL,
    active        INTEGER NOT NULL DEFAULT 1,
    created_at    TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS moderation_log (
    id            INTEGER PRIMARY KEY AUTOINCREMENT,
    guild_id      TEXT NOT NULL,
    user_id       TEXT,
    moderator_id  TEXT,
    action        TEXT NOT NULL,
    reason        TEXT,
    details       TEXT NOT NULL DEFAULT '{}',
    created_at    TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS tickets (
    id            TEXT PRIMARY KEY,
    guild_id      TEXT NOT NULL,
    channel_id    TEXT,
    owner_id      TEXT NOT NULL,
    type          TEXT NOT NULL,
    status        TEXT NOT NULL DEFAULT 'open',
    claimed_by    TEXT,
    created_at    TEXT NOT NULL DEFAULT (datetime('now')),
    closed_at     TEXT,
    transcript    TEXT
  );

  CREATE TABLE IF NOT EXISTS tryouts (
    id            INTEGER PRIMARY KEY AUTOINCREMENT,
    guild_id      TEXT NOT NULL,
    user_id       TEXT NOT NULL,
    status        TEXT NOT NULL DEFAULT 'pending',
    data          TEXT NOT NULL DEFAULT '{}',
    notes         TEXT,
    decided_by    TEXT,
    decided_at    TEXT,
    created_at    TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS evaluations (
    id            INTEGER PRIMARY KEY AUTOINCREMENT,
    guild_id      TEXT NOT NULL,
    player_id     TEXT NOT NULL,
    evaluator_id  TEXT NOT NULL,
    scores        TEXT NOT NULL DEFAULT '{}',
    overall       REAL NOT NULL DEFAULT 0,
    recommendation TEXT,
    created_at    TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS scrims (
    id            INTEGER PRIMARY KEY AUTOINCREMENT,
    guild_id      TEXT NOT NULL,
    opponent      TEXT NOT NULL,
    scheduled_at  TEXT,
    format        TEXT NOT NULL DEFAULT '5v5',
    mode          TEXT NOT NULL DEFAULT 'Standard',
    status        TEXT NOT NULL DEFAULT 'SCHEDULED',
    players       TEXT NOT NULL DEFAULT '[]',
    result        TEXT,
    channel_id    TEXT,
    message_id    TEXT,
    created_by    TEXT,
    created_at    TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS matches (
    id            INTEGER PRIMARY KEY AUTOINCREMENT,
    guild_id      TEXT NOT NULL,
    opponent      TEXT NOT NULL,
    our_score     INTEGER NOT NULL DEFAULT 0,
    opp_score     INTEGER NOT NULL DEFAULT 0,
    winner        TEXT NOT NULL DEFAULT 'draw',
    played_at     TEXT NOT NULL DEFAULT (datetime('now')),
    notes         TEXT,
    players       TEXT NOT NULL DEFAULT '[]',
    recorded_by   TEXT,
    created_at    TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS clan_wars (
    id            INTEGER PRIMARY KEY AUTOINCREMENT,
    guild_id      TEXT NOT NULL,
    opponent      TEXT NOT NULL,
    format        TEXT NOT NULL DEFAULT '5v5',
    status        TEXT NOT NULL DEFAULT 'pending',
    our_score     INTEGER,
    opp_score     INTEGER,
    winner        TEXT,
    war_date      TEXT,
    created_by    TEXT,
    created_at    TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS events (
    id            INTEGER PRIMARY KEY AUTOINCREMENT,
    guild_id      TEXT NOT NULL,
    type          TEXT NOT NULL,
    title         TEXT NOT NULL,
    description   TEXT,
    starts_at     TEXT,
    capacity      INTEGER,
    status        TEXT NOT NULL DEFAULT 'scheduled',
    participants  TEXT NOT NULL DEFAULT '[]',
    channel_id    TEXT,
    message_id    TEXT,
    created_by    TEXT,
    created_at    TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS training (
    id            INTEGER PRIMARY KEY AUTOINCREMENT,
    guild_id      TEXT NOT NULL,
    category      TEXT NOT NULL,
    title         TEXT NOT NULL,
    scheduled_at  TEXT,
    trainer_id    TEXT,
    status        TEXT NOT NULL DEFAULT 'scheduled',
    participants  TEXT NOT NULL DEFAULT '[]',
    message_id    TEXT,
    created_at    TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS xp (
    guild_id  TEXT NOT NULL,
    user_id   TEXT NOT NULL,
    xp        INTEGER NOT NULL DEFAULT 0,
    level     INTEGER NOT NULL DEFAULT 0,
    PRIMARY KEY (guild_id, user_id)
  );

  CREATE TABLE IF NOT EXISTS achievements (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    guild_id    TEXT NOT NULL,
    user_id     TEXT NOT NULL,
    code        TEXT NOT NULL,
    unlocked_at TEXT NOT NULL DEFAULT (datetime('now')),
    UNIQUE (guild_id, user_id, code)
  );

  CREATE TABLE IF NOT EXISTS command_usage (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    guild_id   TEXT,
    user_id    TEXT,
    command    TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE INDEX IF NOT EXISTS idx_warnings_user ON warnings (guild_id, user_id);
  CREATE INDEX IF NOT EXISTS idx_modlog_guild ON moderation_log (guild_id, created_at);
  CREATE INDEX IF NOT EXISTS idx_matches_guild ON matches (guild_id, played_at);
  CREATE INDEX IF NOT EXISTS idx_tryouts_guild ON tryouts (guild_id, status);
  `,

  // Migration 2 — Bloxlink-style Roblox verification.
  // One Roblox account per guild can only be claimed by a single Discord user
  // (UNIQUE(guild_id, roblox_id)) to prevent identity impersonation.
  `
  CREATE TABLE IF NOT EXISTS roblox_links (
    guild_id       TEXT NOT NULL,
    user_id        TEXT NOT NULL,
    roblox_username TEXT NOT NULL,
    roblox_id      INTEGER NOT NULL,
    status         TEXT NOT NULL DEFAULT 'pending',
    code           TEXT,
    verified_at    TEXT,
    created_at     TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at     TEXT NOT NULL DEFAULT (datetime('now')),
    PRIMARY KEY (guild_id, user_id),
    UNIQUE (guild_id, roblox_id)
  );

  CREATE INDEX IF NOT EXISTS idx_roblox_pending ON roblox_links (guild_id, status);
  `,

  // Migration 3 — temporary private servers for scrims, 1v1s, and 6v6s.
  // Created by the bot via the Discord API and auto-deleted on expiry.
  `
  CREATE TABLE IF NOT EXISTS private_servers (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    guild_id    TEXT NOT NULL,
    server_id   TEXT NOT NULL,
    owner_id    TEXT NOT NULL,
    mode        TEXT NOT NULL DEFAULT '5v5',
    status      TEXT NOT NULL DEFAULT 'active',
    invite_code TEXT,
    created_at  TEXT NOT NULL DEFAULT (datetime('now')),
    expires_at  TEXT,
    ended_at    TEXT
  );

  CREATE INDEX IF NOT EXISTS idx_private_servers_active ON private_servers (guild_id, status);
  CREATE INDEX IF NOT EXISTS idx_private_servers_expiry ON private_servers (status, expires_at);
  `,

  // Migration 4 — FGx economy (OwO-style server currency).
  // balance = spendable FGx, lifetime = total earned (never decreases),
  // daily_streak tracks consecutive daily claims for the streak bonus.
  `
  CREATE TABLE IF NOT EXISTS economy (
    guild_id      TEXT NOT NULL,
    user_id       TEXT NOT NULL,
    balance       INTEGER NOT NULL DEFAULT 0,
    lifetime      INTEGER NOT NULL DEFAULT 0,
    last_daily    TEXT,
    daily_streak  INTEGER NOT NULL DEFAULT 0,
    last_weekly   TEXT,
    created_at    TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at    TEXT NOT NULL DEFAULT (datetime('now')),
    PRIMARY KEY (guild_id, user_id)
  );

  CREATE TABLE IF NOT EXISTS economy_tx (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    guild_id   TEXT NOT NULL,
    user_id    TEXT NOT NULL,
    kind       TEXT NOT NULL,
    amount     INTEGER NOT NULL,
    note       TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE INDEX IF NOT EXISTS idx_economy_balance ON economy (guild_id, balance DESC);
  CREATE INDEX IF NOT EXISTS idx_economy_tx_user ON economy_tx (guild_id, user_id, created_at);
  `,

  // Migration 5 — animal collection (OwO-style zoo).
  // Hunted animals are kept here; duplicates stack as counts.
  `
  CREATE TABLE IF NOT EXISTS animals (
    guild_id      TEXT NOT NULL,
    user_id       TEXT NOT NULL,
    animal_id     TEXT NOT NULL,
    count         INTEGER NOT NULL DEFAULT 1,
    first_found_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at    TEXT NOT NULL DEFAULT (datetime('now')),
    PRIMARY KEY (guild_id, user_id, animal_id)
  );

  CREATE INDEX IF NOT EXISTS idx_animals_user ON animals (guild_id, user_id);
  `,

  // Migration 6 — social interactions (OwO-style slap/pat/hug/kiss/…).
  // Per-actor→target counters; the same pair can build a long rivalry.
  `
  CREATE TABLE IF NOT EXISTS social_interactions (
    guild_id   TEXT NOT NULL,
    actor_id   TEXT NOT NULL,
    target_id  TEXT NOT NULL,
    kind       TEXT NOT NULL,
    count      INTEGER NOT NULL DEFAULT 1,
    last_at    TEXT NOT NULL DEFAULT (datetime('now')),
    PRIMARY KEY (guild_id, actor_id, target_id, kind)
  );

  CREATE INDEX IF NOT EXISTS idx_social_target ON social_interactions (guild_id, target_id, kind);
  `,

  // Migration 7 — reaction roles (real Discord reactions, not select menus).
  // Maps a message+emoji to a role. When a user reacts, they get the role;
  // when they unreact, the role is removed.
  `
  CREATE TABLE IF NOT EXISTS reaction_roles (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    guild_id    TEXT NOT NULL,
    channel_id  TEXT NOT NULL,
    message_id  TEXT NOT NULL,
    role_id     TEXT NOT NULL,
    emoji       TEXT NOT NULL,
    label       TEXT,
    created_at  TEXT NOT NULL DEFAULT (datetime('now')),
    UNIQUE (guild_id, message_id, emoji)
  );

  CREATE INDEX IF NOT EXISTS idx_rr_message ON reaction_roles (guild_id, message_id);
  `,
];

module.exports = { MIGRATIONS };
