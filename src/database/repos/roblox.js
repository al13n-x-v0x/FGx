'use strict';

/*
 * Copyright © 2026 FGx.
 * All rights reserved.
 */

const db = require('../index');

/**
 * Roblox account links (Bloxlink-style verification).
 * A pending row carries a code the user must place in their Roblox About
 * section; the check step confirms it via the Roblox public API.
 * UNIQUE(guild_id, roblox_id) prevents one Roblox account being claimed by
 * two Discord users in the same guild.
 */

const robloxLinksRepo = {
  get(guildId, userId) {
    return db.get(
      'SELECT * FROM roblox_links WHERE guild_id = ? AND user_id = ?',
      guildId,
      userId,
    );
  },

  getByRoblox(guildId, robloxId) {
    return db.get(
      'SELECT * FROM roblox_links WHERE guild_id = ? AND roblox_id = ?',
      guildId,
      robloxId,
    );
  },

  /** Create or reset a pending verification. Throws on impersonation. */
  create(guildId, userId, { robloxUsername, robloxId, code }) {
    const taken = this.getByRoblox(guildId, robloxId);
    if (taken && String(taken.user_id) !== String(userId)) {
      const err = new Error(
        'That Roblox account is already linked to another Discord account in this server. If this is you, contact staff to verify your identity.',
      );
      err.code = 'DUPLICATE_ROBLOX';
      throw err;
    }
    db.run(
      `INSERT INTO roblox_links (guild_id, user_id, roblox_username, roblox_id, status, code)
       VALUES (?, ?, ?, ?, 'pending', ?)
       ON CONFLICT(guild_id, user_id) DO UPDATE SET
         roblox_username = excluded.roblox_username,
         roblox_id      = excluded.roblox_id,
         status         = 'pending',
         code           = excluded.code,
         verified_at    = NULL,
         updated_at     = datetime('now')`,
      guildId,
      userId,
      robloxUsername,
      robloxId,
      code,
    );
    return this.get(guildId, userId);
  },

  verify(guildId, userId) {
    db.run(
      `UPDATE roblox_links
       SET status = 'verified', code = NULL, verified_at = datetime('now'), updated_at = datetime('now')
       WHERE guild_id = ? AND user_id = ?`,
      guildId,
      userId,
    );
    return this.get(guildId, userId);
  },

  remove(guildId, userId) {
    db.run('DELETE FROM roblox_links WHERE guild_id = ? AND user_id = ?', guildId, userId);
  },

  listVerified(guildId) {
    return db.all(
      "SELECT * FROM roblox_links WHERE guild_id = ? AND status = 'verified' ORDER BY verified_at DESC",
      guildId,
    );
  },

  countVerified(guildId) {
    const row = db.get(
      "SELECT COUNT(*) AS n FROM roblox_links WHERE guild_id = ? AND status = 'verified'",
      guildId,
    );
    return row ? row.n : 0;
  },
};

module.exports = { robloxLinksRepo };
