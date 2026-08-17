'use strict';

/*
 * Copyright © 2026 FGx.
 * All rights reserved.
 */

const { Events } = require('discord.js');
const { logAudit } = require('../services/logging/auditLogger');
const { logger } = require('../utils/logger');

/** Log member role changes (added/removed). */
function register(client) {
  client.on(Events.GuildMemberUpdate, async (oldMember, newMember) => {
    try {
      if (!newMember.guild) return;
      const added = newMember.roles.cache.filter((r) => !oldMember.roles.cache.has(r.id));
      const removed = oldMember.roles.cache.filter((r) => !newMember.roles.cache.has(r.id));
      if (added.size === 0 && removed.size === 0) return;

      const parts = [];
      if (added.size > 0) parts.push(`**Added:** ${added.map((r) => r.name).join(', ')}`);
      if (removed.size > 0) parts.push(`**Removed:** ${removed.map((r) => r.name).join(', ')}`);

      await logAudit(client, newMember.guild, {
        action: 'role_change',
        target: newMember.user,
        moderator: null,
        reason: parts.join('\n'),
        details: { added: added.size, removed: removed.size },
      });
    } catch (err) {
      logger.warn('role log failed', { error: err.message });
    }
  });
}

module.exports = { register };
