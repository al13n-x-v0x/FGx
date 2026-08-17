'use strict';

/*
 * Copyright © 2026 FGx.
 * All rights reserved.
 */

const db = require('../index');

const warningsRepo = {
  add(guildId, userId, moderatorId, reason) {
    const result = db.run(
      'INSERT INTO warnings (guild_id, user_id, moderator_id, reason) VALUES (?, ?, ?, ?)',
      guildId,
      userId,
      moderatorId,
      reason,
    );
    return { id: Number(result.lastInsertRowid), guildId, userId, moderatorId, reason };
  },
  listFor(guildId, userId) {
    return db.all(
      'SELECT * FROM warnings WHERE guild_id = ? AND user_id = ? AND active = 1 ORDER BY created_at DESC',
      guildId,
      userId,
    );
  },
  countFor(guildId, userId) {
    const row = db.get(
      'SELECT COUNT(*) AS c FROM warnings WHERE guild_id = ? AND user_id = ? AND active = 1',
      guildId,
      userId,
    );
    return row.c;
  },
  /** Mark a warning inactive; returns true if anything changed. */
  clear(guildId, userId, warningId = null) {
    if (warningId) {
      const result = db.run(
        'UPDATE warnings SET active = 0 WHERE id = ? AND guild_id = ?',
        warningId,
        guildId,
      );
      return result.changes > 0;
    }
    const result = db.run(
      'UPDATE warnings SET active = 0 WHERE guild_id = ? AND user_id = ?',
      guildId,
      userId,
    );
    return result.changes > 0;
  },
};

const moderationLogRepo = {
  log({ guildId, userId, moderatorId, action, reason, details = {} }) {
    const result = db.run(
      `INSERT INTO moderation_log (guild_id, user_id, moderator_id, action, reason, details)
       VALUES (?, ?, ?, ?, ?, ?)`,
      guildId,
      userId ?? null,
      moderatorId ?? null,
      action,
      reason ?? null,
      JSON.stringify(details),
    );
    return Number(result.lastInsertRowid);
  },
  recent(guildId, { limit = 25, action = null } = {}) {
    if (action) {
      return db.all(
        'SELECT * FROM moderation_log WHERE guild_id = ? AND action = ? ORDER BY created_at DESC, id DESC LIMIT ?',
        guildId,
        action,
        limit,
      );
    }
    return db.all(
      'SELECT * FROM moderation_log WHERE guild_id = ? ORDER BY created_at DESC, id DESC LIMIT ?',
      guildId,
      limit,
    );
  },
};

const commandUsageRepo = {
  record(guildId, userId, command) {
    db.run(
      'INSERT INTO command_usage (guild_id, user_id, command) VALUES (?, ?, ?)',
      guildId,
      userId,
      command,
    );
  },
  count() {
    const row = db.get('SELECT COUNT(*) AS c FROM command_usage');
    return row.c;
  },
};

module.exports = { warningsRepo, moderationLogRepo, commandUsageRepo };
