'use strict';

/* Copyright © 2026 FGx. All rights reserved. */

const db = require('../index');

const reactionRolesRepo = {
  /** Add a reaction role mapping. */
  add(guildId, channelId, messageId, roleId, emoji, label = null) {
    db.run(
      `INSERT OR REPLACE INTO reaction_roles (guild_id, channel_id, message_id, role_id, emoji, label)
       VALUES (?, ?, ?, ?, ?, ?)`,
      guildId, channelId, messageId, roleId, emoji, label,
    );
  },

  /** Remove a reaction role mapping. */
  remove(guildId, messageId, roleId) {
    db.run(
      'DELETE FROM reaction_roles WHERE guild_id = ? AND message_id = ? AND role_id = ?',
      guildId, messageId, roleId,
    );
  },

  /** Get all reaction roles for a specific message. */
  getByMessage(guildId, messageId) {
    return db.all(
      'SELECT * FROM reaction_roles WHERE guild_id = ? AND message_id = ?',
      guildId, messageId,
    );
  },

  /** Get a specific reaction role by message + emoji. */
  getByEmoji(guildId, messageId, emoji) {
    return db.get(
      'SELECT * FROM reaction_roles WHERE guild_id = ? AND message_id = ? AND emoji = ?',
      guildId, messageId, emoji,
    );
  },

  /** Get all reaction roles for a guild. */
  getAll(guildId) {
    return db.all(
      'SELECT * FROM reaction_roles WHERE guild_id = ?',
      guildId,
    );
  },

  /** Delete all reaction roles for a message. */
  deleteMessage(guildId, messageId) {
    db.run(
      'DELETE FROM reaction_roles WHERE guild_id = ? AND message_id = ?',
      guildId, messageId,
    );
  },

  /** Delete all reaction roles for a guild. */
  deleteGuild(guildId) {
    db.run('DELETE FROM reaction_roles WHERE guild_id = ?', guildId);
  },
};

module.exports = { reactionRolesRepo };
