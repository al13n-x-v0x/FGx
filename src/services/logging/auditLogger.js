'use strict';

/*
 * Copyright © 2026 FGx.
 * All rights reserved.
 */

const { EmbedBuilder } = require('discord.js');
const { BRAND } = require('../../config/constants');
const { guildConfigRepo } = require('../../database/repos/guildConfig');
const { moderationLogRepo } = require('../../database/repos/moderation');
const { logger } = require('../../utils/logger');

const ACTION_COLORS = {
  warn: 0xf0a500,
  timeout: 0xf0a500,
  kick: 0xb91c1c,
  ban: 0xb91c1c,
  unban: 0x2fbf71,
  purge: 0x23272a,
  slowmode: 0x23272a,
  lock: 0x23272a,
  unlock: 0x23272a,
  nick: 0x23272a,
  role: 0x23272a,
  join: 0x2fbf71,
  leave: 0x23272a,
  message_delete: 0xb91c1c,
  message_edit: 0xf0a500,
  role_change: 0x23272a,
  channel_change: 0x23272a,
  security: 0xb91c1c,
  ai: 0xdc143c,
  ticket: 0x23272a,
  verification: 0x2fbf71,
  tryout: 0xdc143c,
  roster: 0xdc143c,
  match: 0xdc143c,
};

/**
 * Write a structured entry to the moderation log (database) and, if configured,
 * post a clean embed to the guild's log channel. Never throws.
 */
async function logAudit(client, guild, { action, target, moderator, reason, details = {}, color }) {
  try {
    moderationLogRepo.log({
      guildId: guild.id,
      userId: target?.id,
      moderatorId: moderator?.id,
      action,
      reason,
      details,
    });

    const config = guildConfigRepo.get(guild.id);
    const channelId = config.logChannel || config.modLogChannel;
    if (!channelId) return;

    const channel = guild.channels.cache.get(channelId) ?? (await guild.channels.fetch(channelId).catch(() => null));
    if (!channel || !channel.isTextBased?.()) return;

    const embed = new EmbedBuilder()
      .setColor(color ?? ACTION_COLORS[action] ?? BRAND.colors.primary)
      .setAuthor({ name: action.toUpperCase().replace('_', ' ') })
      .setTimestamp(new Date())
      .setFooter({ text: BRAND.footer });

    const fields = [];
    if (target) fields.push({ name: 'User', value: `${target} (\`${target.id}\`)`, inline: true });
    if (moderator) fields.push({ name: 'Moderator', value: `${moderator} (\`${moderator.id}\`)`, inline: true });
    for (const [key, value] of Object.entries(details)) {
      if (value !== undefined && value !== null && value !== '') {
        fields.push({ name: String(key).slice(0, 256), value: String(value).slice(0, 1024), inline: true });
      }
    }
    if (reason) fields.push({ name: 'Reason', value: String(reason).slice(0, 1024) });
    if (fields.length > 0) embed.addFields(fields);

    await channel.send({ embeds: [embed] }).catch(() => {});
  } catch (err) {
    logger.warn('audit log failed', { action, guildId: guild.id, error: err.message });
  }
}

module.exports = { logAudit };
