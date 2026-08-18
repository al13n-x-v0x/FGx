'use strict';

/*
 * Copyright © 2026 FGx.
 * All rights reserved.
 */

const db = require('../index');

/**
 * Social interactions (OwO-style slap/pat/hug/kiss/tickle/poke).
 * Counters are per guild + actor + target + kind, so a pair's
 * rivalry (or friendship) is tracked and displayed.
 */

const socialRepo = {
  /** Record one interaction. Returns the new running count. */
  add(guildId, actorId, targetId, kind) {
    db.run(
      `INSERT INTO social_interactions (guild_id, actor_id, target_id, kind, count)
       VALUES (?, ?, ?, ?, 1)
       ON CONFLICT(guild_id, actor_id, target_id, kind) DO UPDATE SET
         count = social_interactions.count + 1,
         last_at = datetime('now')`,
      guildId,
      actorId,
      targetId,
      kind,
    );
    const row = db.get(
      'SELECT count FROM social_interactions WHERE guild_id = ? AND actor_id = ? AND target_id = ? AND kind = ?',
      guildId,
      actorId,
      targetId,
      kind,
    );
    return row?.count ?? 1;
  },

  /** Total a user has dealt of each kind (as actor). */
  dealt(guildId, userId) {
    return db.all('SELECT kind, COUNT(*) AS hits, SUM(count) AS total FROM social_interactions WHERE guild_id = ? AND actor_id = ? GROUP BY kind', guildId, userId);
  },

  /** Total a user has received of each kind (as target). */
  received(guildId, userId) {
    return db.all('SELECT kind, COUNT(*) AS hits, SUM(count) AS total FROM social_interactions WHERE guild_id = ? AND target_id = ? GROUP BY kind', guildId, userId);
  },

  /** Sum of all counts for a user in either role. */
  lifetime(guildId, userId) {
    const row = db.get(
      'SELECT (SELECT COALESCE(SUM(count), 0) FROM social_interactions WHERE guild_id = ? AND actor_id = ?) + (SELECT COALESCE(SUM(count), 0) FROM social_interactions WHERE guild_id = ? AND target_id = ?) AS total',
      guildId,
      userId,
      guildId,
      userId,
    );
    return row?.total ?? 0;
  },

  /** Per-kind totals between two specific users (both directions). */
  between(guildId, aId, bId, kind) {
    const rows = db.all(
      'SELECT actor_id, count FROM social_interactions WHERE guild_id = ? AND kind = ? AND ((actor_id = ? AND target_id = ?) OR (actor_id = ? AND target_id = ?))',
      guildId,
      kind,
      aId,
      bId,
      bId,
      aId,
    );
    return rows.reduce((acc, r) => {
      acc[r.actor_id] = r.count;
      return acc;
    }, {});
  },

  /** Top N members by total interactions in a guild. */
  top(guildId, kind, n = 5) {
    return db.all(
      `SELECT actor_id, SUM(count) AS total FROM social_interactions
       WHERE guild_id = ? AND kind = ?
       GROUP BY actor_id ORDER BY total DESC LIMIT ?`,
      guildId,
      kind,
      n,
    );
  },
};

module.exports = { socialRepo };
