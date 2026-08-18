'use strict';

/*
 * Copyright © 2026 FGx.
 * All rights reserved.
 */

const db = require('../index');

/**
 * Animal collection (OwO-style zoo). Hunted animals stack as counts;
 * first sighting of a species is flagged so the UI can celebrate it.
 */

const animalsRepo = {
  /** Add one of an animal. Returns { isNew, count }. */
  add(guildId, userId, animalId) {
    const existing = this.get(guildId, userId, animalId);
    const isNew = !existing;
    db.run(
      `INSERT INTO animals (guild_id, user_id, animal_id, count)
       VALUES (?, ?, ?, 1)
       ON CONFLICT(guild_id, user_id, animal_id) DO UPDATE SET
         count = animals.count + 1,
         updated_at = datetime('now')`,
      guildId,
      userId,
      animalId,
    );
    return { isNew, count: (existing?.count ?? 0) + 1 };
  },

  get(guildId, userId, animalId) {
    return db.get(
      'SELECT * FROM animals WHERE guild_id = ? AND user_id = ? AND animal_id = ?',
      guildId,
      userId,
      animalId,
    );
  },

  /** Remove `n` of an animal (row deleted at 0). Returns removed count. */
  remove(guildId, userId, animalId, n = 1) {
    const row = this.get(guildId, userId, animalId);
    if (!row) return 0;
    const removed = Math.min(n, row.count);
    const left = row.count - removed;
    if (left <= 0) {
      db.run('DELETE FROM animals WHERE guild_id = ? AND user_id = ? AND animal_id = ?', guildId, userId, animalId);
    } else {
      db.run(
        'UPDATE animals SET count = ?, updated_at = datetime(\'now\') WHERE guild_id = ? AND user_id = ? AND animal_id = ?',
        left,
        guildId,
        userId,
        animalId,
      );
    }
    return removed;
  },

  list(guildId, userId) {
    return db.all(
      'SELECT * FROM animals WHERE guild_id = ? AND user_id = ? ORDER BY first_found_at ASC, animal_id ASC',
      guildId,
      userId,
    );
  },

  totalCount(guildId, userId) {
    const row = db.get(
      'SELECT COALESCE(SUM(count), 0) AS n FROM animals WHERE guild_id = ? AND user_id = ?',
      guildId,
      userId,
    );
    return row ? row.n : 0;
  },

  speciesCount(guildId, userId) {
    const row = db.get(
      'SELECT COUNT(*) AS n FROM animals WHERE guild_id = ? AND user_id = ?',
      guildId,
      userId,
    );
    return row ? row.n : 0;
  },
};

module.exports = { animalsRepo };
