'use strict';

/* Copyright © 2026 FGx. All rights reserved. */

const { Events } = require('discord.js');
const { reactionRolesRepo } = require('../database/repos/reactionRoles');
const { logger } = require('../utils/logger');

/**
 * Reaction role event handlers.
 * When a user adds a reaction → give them the mapped role.
 * When a user removes a reaction → remove the mapped role.
 */
module.exports = { register(client) {
  // ─── Reaction Added ──────────────────────────────────────
  client.on(Events.MessageReactionAdd, async (reaction, user) => {
    // Ignore bot reactions
    if (user.bot) return;

    try {
      // Handle partial reactions (message not cached)
      if (reaction.partial) {
        try { await reaction.fetch(); } catch { return; }
      }
      if (reaction.message.partial) {
        try { await reaction.message.fetch(); } catch { return; }
      }

      const guildId = reaction.message.guild?.id;
      if (!guildId) return;

      // Get the emoji string — handle both Unicode and custom emojis
      const emojiStr = reaction.emoji.id
        ? `<:${reaction.emoji.name}:${reaction.emoji.id}>`
        : reaction.emoji.name;

      // Look up the reaction role mapping
      const mapping = reactionRolesRepo.getByEmoji(guildId, reaction.message.id, emojiStr);
      if (!mapping) return;

      // Get the member and assign the role
      const guild = reaction.message.guild;
      const member = await guild.members.fetch(user.id).catch(() => null);
      if (!member) return;

      // Check role hierarchy
      if (mapping.role_id >= guild.members.me.roles.highest.position) {
        logger.warn('reaction role: role too high to assign', { roleId: mapping.role_id });
        return;
      }

      await member.roles.add(mapping.role_id).catch(err => {
        logger.warn('reaction role: failed to add role', { error: err.message, userId: user.id, roleId: mapping.role_id });
      });

      logger.debug('reaction role: assigned', { userId: user.id, roleId: mapping.role_id, emoji: emojiStr });
    } catch (err) {
      logger.warn('reaction role: MessageReactionAdd error', { error: err.message });
    }
  });

  // ─── Reaction Removed ────────────────────────────────────
  client.on(Events.MessageReactionRemove, async (reaction, user) => {
    // Ignore bot reactions
    if (user.bot) return;

    try {
      // Handle partial reactions
      if (reaction.partial) {
        try { await reaction.fetch(); } catch { return; }
      }
      if (reaction.message.partial) {
        try { await reaction.message.fetch(); } catch { return; }
      }

      const guildId = reaction.message.guild?.id;
      if (!guildId) return;

      const emojiStr = reaction.emoji.id
        ? `<:${reaction.emoji.name}:${reaction.emoji.id}>`
        : reaction.emoji.name;

      const mapping = reactionRolesRepo.getByEmoji(guildId, reaction.message.id, emojiStr);
      if (!mapping) return;

      const guild = reaction.message.guild;
      const member = await guild.members.fetch(user.id).catch(() => null);
      if (!member) return;

      await member.roles.remove(mapping.role_id).catch(err => {
        logger.warn('reaction role: failed to remove role', { error: err.message, userId: user.id, roleId: mapping.role_id });
      });

      logger.debug('reaction role: removed', { userId: user.id, roleId: mapping.role_id, emoji: emojiStr });
    } catch (err) {
      logger.warn('reaction role: MessageReactionRemove error', { error: err.message });
    }
  });
} };
