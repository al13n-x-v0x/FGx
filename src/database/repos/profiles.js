'use strict';

/*
 * Copyright © 2026 FGx.
 * All rights reserved.
 */

const db = require('../index');

const profilesRepo = {
  get(guildId, userId) {
    return db.get(
      'SELECT * FROM profiles WHERE guild_id = ? AND user_id = ?',
      guildId,
      userId,
    );
  },

  ensure(guildId, userId, { joinDate } = {}) {
    const existing = this.get(guildId, userId);
    if (existing) return existing;
    db.run(
      `INSERT INTO profiles (guild_id, user_id, join_date)
       VALUES (?, ?, ?)`,
      guildId,
      userId,
      joinDate ?? new Date().toISOString(),
    );
    return this.get(guildId, userId);
  },

  updateStats(guildId, userId, patch) {
    const row = this.ensure(guildId, userId);
    const allowed = [
      'blox_username',
      'clan_rank',
      'wins',
      'losses',
      'kills',
      'deaths',
      'matches',
      'rating',
      'current_streak',
      'best_streak',
      'stats_source',
    ];
    const sets = [];
    const params = [];
    for (const key of allowed) {
      if (patch[key] !== undefined) {
        sets.push(`${key} = ?`);
        params.push(patch[key]);
      }
    }
    if (patch.meta !== undefined) {
      const meta = { ...safeParse(row.meta), ...patch.meta };
      sets.push('meta = ?');
      params.push(JSON.stringify(meta));
    }
    if (sets.length === 0) return row;
    sets.push("updated_at = datetime('now')");
    params.push(guildId, userId);
    db.run(
      `UPDATE profiles SET ${sets.join(', ')} WHERE guild_id = ? AND user_id = ?`,
      ...params,
    );
    return this.get(guildId, userId);
  },

  allByRating(guildId) {
    return db.all(
      'SELECT * FROM profiles WHERE guild_id = ? AND matches > 0 ORDER BY rating DESC',
      guildId,
    );
  },

  leaderboard(guildId, field, limit = 50) {
    const allowed = {
      rating: 'rating',
      kills: 'kills',
      kd: null,
      streak: 'current_streak',
      wins: 'wins',
      matches: 'matches',
    };
    if (!allowed[field]) return [];
    if (field === 'kd') {
      return db.all(
        `SELECT *, CASE WHEN deaths > 0 THEN CAST(kills AS REAL) / deaths ELSE kills END AS kd
         FROM profiles WHERE guild_id = ? AND matches > 0
         ORDER BY kd DESC LIMIT ?`,
        guildId,
        limit,
      );
    }
    return db.all(
      `SELECT * FROM profiles WHERE guild_id = ? AND matches > 0
       ORDER BY ${allowed[field]} DESC LIMIT ?`,
      guildId,
      limit,
    );
  },
};

const linksRepo = {
  get(guildId, userId) {
    return db.get('SELECT * FROM links WHERE guild_id = ? AND user_id = ?', guildId, userId);
  },
  getByUsername(guildId, username) {
    return db.get(
      'SELECT * FROM links WHERE guild_id = ? AND blox_username = ? COLLATE NOCASE',
      guildId,
      username,
    );
  },
  /** Throws on duplicate username to prevent identity theft. */
  create(guildId, userId, username) {
    const existing = this.get(guildId, userId);
    if (existing) {
      const err = new Error('You already have a BloxStrike link in this server.');
      err.code = 'DUPLICATE_USER';
      throw err;
    }
    const taken = this.getByUsername(guildId, username);
    if (taken && taken.user_id !== userId) {
      const err = new Error(
        'That BloxStrike username is already linked to another account in this server. If this is you, contact staff to verify your identity.',
      );
      err.code = 'DUPLICATE_USERNAME';
      throw err;
    }
    db.run(
      `INSERT INTO links (guild_id, user_id, blox_username, status)
       VALUES (?, ?, ?, 'pending')
       ON CONFLICT(guild_id, user_id) DO UPDATE SET
         blox_username = excluded.blox_username,
         status = 'pending',
         updated_at = datetime('now')`,
      guildId,
      userId,
      username,
    );
    return this.get(guildId, userId);
  },
  setStatus(guildId, userId, status) {
    db.run(
      `UPDATE links SET status = ?, updated_at = datetime('now')
       WHERE guild_id = ? AND user_id = ?`,
      status,
      guildId,
      userId,
    );
    return this.get(guildId, userId);
  },
  remove(guildId, userId) {
    db.run('DELETE FROM links WHERE guild_id = ? AND user_id = ?', guildId, userId);
  },
  listVerified(guildId) {
    return db.all("SELECT * FROM links WHERE guild_id = ? AND status = 'verified'", guildId);
  },
};

const xpRepo = {
  get(guildId, userId) {
    return db.get('SELECT * FROM xp WHERE guild_id = ? AND user_id = ?', guildId, userId);
  },
  add(guildId, userId, amount) {
    db.run(
      `INSERT INTO xp (guild_id, user_id, xp, level)
       VALUES (?, ?, ?, 0)
       ON CONFLICT(guild_id, user_id) DO UPDATE SET xp = xp + excluded.xp`,
      guildId,
      userId,
      amount,
    );
    return this.get(guildId, userId);
  },
  setLevel(guildId, userId, level) {
    db.run(
      `UPDATE xp SET level = ? WHERE guild_id = ? AND user_id = ?`,
      level,
      guildId,
      userId,
    );
  },
  leaderboard(guildId, limit = 50) {
    return db.all(
      'SELECT * FROM xp WHERE guild_id = ? ORDER BY xp DESC LIMIT ?',
      guildId,
      limit,
    );
  },
};

const achievementsRepo = {
  unlock(guildId, userId, code) {
    db.run(
      `INSERT OR IGNORE INTO achievements (guild_id, user_id, code)
       VALUES (?, ?, ?)`,
      guildId,
      userId,
      code,
    );
  },
  list(guildId, userId) {
    return db.all(
      'SELECT code, unlocked_at FROM achievements WHERE guild_id = ? AND user_id = ? ORDER BY unlocked_at',
      guildId,
      userId,
    );
  },
  has(guildId, userId, code) {
    const row = db.get(
      'SELECT 1 AS ok FROM achievements WHERE guild_id = ? AND user_id = ? AND code = ?',
      guildId,
      userId,
      code,
    );
    return Boolean(row);
  },
};

function safeParse(json, fallback) {
  try {
    return JSON.parse(json);
  } catch {
    return fallback;
  }
}

module.exports = { profilesRepo, linksRepo, xpRepo, achievementsRepo };
