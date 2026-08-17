'use strict';

/*
 * Copyright © 2026 FGx.
 * All rights reserved.
 */

const crypto = require('node:crypto');
const db = require('../index');

/** Generate a short, readable ticket ID like "FGX-7K2Q". */
function ticketId() {
  return `FGX-${crypto.randomBytes(3).toString('hex').toUpperCase()}`;
}

const ticketsRepo = {
  newId: ticketId,
  create({ id, guildId, channelId, ownerId, type }) {
    db.run(
      `INSERT INTO tickets (id, guild_id, channel_id, owner_id, type, status)
       VALUES (?, ?, ?, ?, ?, 'open')`,
      id,
      guildId,
      channelId,
      ownerId,
      type,
    );
    return this.get(guildId, id);
  },
  get(guildId, id) {
    return db.get('SELECT * FROM tickets WHERE guild_id = ? AND id = ?', guildId, id);
  },
  getByChannel(guildId, channelId) {
    return db.get(
      'SELECT * FROM tickets WHERE guild_id = ? AND channel_id = ?',
      guildId,
      channelId,
    );
  },
  openFor(guildId, ownerId, type) {
    return db.get(
      "SELECT * FROM tickets WHERE guild_id = ? AND owner_id = ? AND type = ? AND status = 'open'",
      guildId,
      ownerId,
      type,
    );
  },
  claim(guildId, id, staffId) {
    db.run(
      'UPDATE tickets SET claimed_by = ? WHERE guild_id = ? AND id = ?',
      staffId,
      guildId,
      id,
    );
    return this.get(guildId, id);
  },
  close(guildId, id, transcriptPath) {
    db.run(
      `UPDATE tickets SET status = 'closed', closed_at = datetime('now'), transcript = ?
       WHERE guild_id = ? AND id = ?`,
      transcriptPath,
      guildId,
      id,
    );
    return this.get(guildId, id);
  },
  list(guildId, status = null) {
    if (status) {
      return db.all(
        'SELECT * FROM tickets WHERE guild_id = ? AND status = ? ORDER BY created_at DESC',
        guildId,
        status,
      );
    }
    return db.all('SELECT * FROM tickets WHERE guild_id = ? ORDER BY created_at DESC', guildId);
  },
};

const tryoutsRepo = {
  create(guildId, userId, data) {
    const result = db.run(
      "INSERT INTO tryouts (guild_id, user_id, status, data) VALUES (?, ?, 'pending', ?)",
      guildId,
      userId,
      JSON.stringify(data),
    );
    return this.get(Number(result.lastInsertRowid));
  },
  get(id) {
    return db.get('SELECT * FROM tryouts WHERE id = ?', id);
  },
  list(guildId, status = null) {
    if (status) {
      return db.all(
        'SELECT * FROM tryouts WHERE guild_id = ? AND status = ? ORDER BY created_at DESC',
        guildId,
        status,
      );
    }
    return db.all(
      'SELECT * FROM tryouts WHERE guild_id = ? ORDER BY created_at DESC',
      guildId,
    );
  },
  pendingCount(guildId) {
    const row = db.get(
      "SELECT COUNT(*) AS c FROM tryouts WHERE guild_id = ? AND status IN ('pending','info_requested')",
      guildId,
    );
    return row.c;
  },
  decide(id, status, staffId, { notes } = {}) {
    db.run(
      'UPDATE tryouts SET status = ?, decided_by = ?, decided_at = datetime(\'now\'), notes = COALESCE(?, notes) WHERE id = ?',
      status,
      staffId,
      notes ?? null,
      id,
    );
    return this.get(id);
  },
};

const evaluationsRepo = {
  create(guildId, playerId, evaluatorId, scores, overall, recommendation) {
    const result = db.run(
      `INSERT INTO evaluations (guild_id, player_id, evaluator_id, scores, overall, recommendation)
       VALUES (?, ?, ?, ?, ?, ?)`,
      guildId,
      playerId,
      evaluatorId,
      JSON.stringify(scores),
      overall,
      recommendation ?? null,
    );
    return Number(result.lastInsertRowid);
  },
  latestFor(guildId, playerId, limit = 1) {
    return db.all(
      'SELECT * FROM evaluations WHERE guild_id = ? AND player_id = ? ORDER BY created_at DESC, id DESC LIMIT ?',
      guildId,
      playerId,
      limit,
    );
  },
  recent(guildId, limit = 25) {
    return db.all(
      'SELECT * FROM evaluations WHERE guild_id = ? ORDER BY created_at DESC, id DESC LIMIT ?',
      guildId,
      limit,
    );
  },
};

module.exports = { ticketsRepo, tryoutsRepo, evaluationsRepo };
