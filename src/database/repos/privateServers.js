'use strict';

/*
 * Copyright © 2026 FGx.
 * All rights reserved.
 */

const db = require('../index');

/**
 * Temporary private servers created for scrims / 1v1s / 6v6s.
 * Each row maps a source guild + owner to the Discord server the bot created.
 */

const privateServersRepo = {
  create({ guildId, serverId, ownerId, mode, expiresAt }) {
    db.run(
      `INSERT INTO private_servers (guild_id, server_id, owner_id, mode, status, expires_at)
       VALUES (?, ?, ?, ?, 'active', ?)`,
      guildId,
      serverId,
      ownerId,
      mode,
      expiresAt ?? null,
    );
    return this.getByServer(serverId);
  },

  getByServer(serverId) {
    return db.get('SELECT * FROM private_servers WHERE server_id = ?', serverId);
  },

  getById(id) {
    return db.get('SELECT * FROM private_servers WHERE id = ?', id);
  },

  listActive(guildId) {
    return db.all(
      "SELECT * FROM private_servers WHERE guild_id = ? AND status = 'active' ORDER BY created_at DESC",
      guildId,
    );
  },

  listAllActive() {
    return db.all("SELECT * FROM private_servers WHERE status = 'active' ORDER BY created_at DESC");
  },

  countActive(guildId) {
    const row = db.get(
      "SELECT COUNT(*) AS n FROM private_servers WHERE guild_id = ? AND status = 'active'",
      guildId,
    );
    return row ? row.n : 0;
  },

  countActiveByOwner(guildId, ownerId) {
    const row = db.get(
      "SELECT COUNT(*) AS n FROM private_servers WHERE guild_id = ? AND owner_id = ? AND status = 'active'",
      guildId,
      ownerId,
    );
    return row ? row.n : 0;
  },

  setInvite(serverId, inviteCode) {
    db.run('UPDATE private_servers SET invite_code = ? WHERE server_id = ?', inviteCode, serverId);
    return this.getByServer(serverId);
  },

  end(serverId, endedAt = null) {
    db.run(
      "UPDATE private_servers SET status = 'ended', ended_at = COALESCE(?, datetime('now')) WHERE server_id = ?",
      endedAt,
      serverId,
    );
    return this.getByServer(serverId);
  },
};

module.exports = { privateServersRepo };
