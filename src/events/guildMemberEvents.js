'use strict';

/*
 * Copyright © 2026 FGx.
 * All rights reserved.
 */

const { Events } = require('discord.js');
const { guildConfigRepo } = require('../database/repos/guildConfig');
const { antiraid } = require('../services/security');
const welcomeService = require('../services/community/welcomeService');
const { logAudit } = require('../services/logging/auditLogger');
const { logger } = require('../utils/logger');

function register(client) {
  client.on(Events.GuildMemberAdd, async (member) => {
    if (member.user.bot) return;
    try {
      const config = guildConfigRepo.get(member.guild.id);
      await welcomeService.onJoin(client, member);
      const raid = antiraid.evaluate(member.guild, member, config);
      if (raid.raid && raid.signals.length > 0) {
        await antiraid.handleRaid(client, member.guild, member, config, raid.signals);
      }
    } catch (err) {
      logger.warn('guildMemberAdd handler failed', { guildId: member.guild.id, error: err.message });
    }
  });

  client.on(Events.GuildMemberRemove, async (member) => {
    try {
      await logAudit(client, member.guild, {
        action: 'leave',
        target: member.user,
        moderator: null,
        details: { memberCount: member.guild.memberCount },
      });
    } catch (err) {
      logger.warn('guildMemberRemove handler failed', { guildId: member.guild.id, error: err.message });
    }
  });
}

module.exports = { register };
