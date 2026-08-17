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
  warn: BRAND.colors.warn,
  timeout: BRAND.colors.warn,
  kick: BRAND.colors.danger,
  ban: BRAND.colors.danger,
  unban: BRAND.colors.success,
  purge: BRAND.colors.neutral,
  slowmode: BRAND.colors.neutral,
  lock: BRAND.colors.neutral,
  unlock: BRAND.colors.neutral,
  nick: BRAND.colors.neutral,
  role: BRAND.colors.neutral,
  join: BRAND.colors.success,
  leave: BRAND.colors.neutral,
  message_delete: BRAND.colors.danger,
  message_edit: BRAND.colors.warn,
  role_change: BRAND.colors.neutral,
  channel_change: BRAND.colors.neutral,
  security: BRAND.colors.danger,
  ai: BRAND.colors.primary,
  ticket: BRAND.colors.neutral,
  verification: BRAND.colors.success,
  tryout: BRAND.colors.primary,
  roster: BRAND.colors.primary,
  match: BRAND.colors.primary,
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
