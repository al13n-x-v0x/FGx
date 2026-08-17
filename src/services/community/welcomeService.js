'use strict';

/*
 * Copyright © 2026 FGx.
 * All rights reserved.
 */

const { EmbedBuilder } = require('discord.js');
const { BRAND } = require('../../config/constants');
const { guildConfigRepo } = require('../../database/repos/guildConfig');
const { logAudit } = require('../logging/auditLogger');
const { logger } = require('../../utils/logger');

/**
 * Welcome system.
 * Renders a branded embed with avatar, username, member count and server name,
 * using the guild's configured channel + message template + optional auto-role.
 */

const PLACEHOLDERS = {
  '{{user}}': (member) => member.user.username,
  '{{mention}}': (member) => `<@${member.id}>`,
  '{{server}}': (member) => member.guild.name,
  '{{count}}': (member) => String(member.guild.memberCount),
};

function renderMessage(template, member) {
  let out = String(template ?? '');
  for (const [key, fn] of Object.entries(PLACEHOLDERS)) {
    out = out.split(key).join(fn(member));
  }
  return out;
}

async function onJoin(client, member) {
  const config = guildConfigRepo.get(member.guild.id);
  const welcome = config.welcome;
  if (!welcome.enabled) return;

  try {
    // Optional auto-role (validated by config command; double-check it exists).
    if (welcome.autoRole) {
      const role = member.guild.roles.cache.get(welcome.autoRole);
      if (role) await member.roles.add(role, 'FGx welcome auto-role').catch(() => {});
    }

    if (!welcome.channel) return;
    const channel = member.guild.channels.cache.get(welcome.channel);
    if (!channel?.isTextBased?.()) return;

    const embed = new EmbedBuilder()
      .setColor(BRAND.colors.primary)
      .setAuthor({ name: `Welcome to ${member.guild.name}`, iconURL: member.guild.iconURL() ?? undefined })
      .setTitle('WELCOME TO FGx')
      .setDescription(
        `Welcome **${member.user.username}**\n\n` +
          `**${BRAND.clan}**\n\n` +
          `${renderMessage(welcome.message, member)}\n\n` +
          `Member **#${member.guild.memberCount}**`,
      )
      .setThumbnail(member.user.displayAvatarURL({ size: 256 }))
      .setFooter({ text: BRAND.footer })
      .setTimestamp(new Date());

    await channel.send({ embeds: [embed], content: `<@${member.id}>` });

    await logAudit(client, member.guild, {
      action: 'join',
      target: member.user,
      moderator: null,
      details: { memberCount: member.guild.memberCount },
    });
  } catch (err) {
    logger.warn('welcome message failed', { guildId: member.guild.id, error: err.message });
  }
}

module.exports = { onJoin, renderMessage };
