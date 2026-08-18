'use strict';

/*
 * Copyright © 2026 FGx.
 * All rights reserved.
 */

const { ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder } = require('discord.js');
const { BRAND } = require('../../config/constants');
const { guildConfigRepo } = require('../../database/repos/guildConfig');
const { logAudit } = require('../logging/auditLogger');
const { Cooldown } = require('../../utils/cooldown');
const { logger } = require('../../utils/logger');

/**
 * Button-based verification.
 * Join → welcome → verify button → verified role → access.
 * Prevents repeated attempts and supports a configurable cooldown.
 */

const cooldown = new Cooldown();

/** Create (or refresh) the verification panel in the configured channel. */
async function createPanel(guild) {
  const config = guildConfigRepo.get(guild.id);
  const verification = config.verification;
  if (!verification.enabled || !verification.channel) {
    throw new Error('Verification is not configured. Use /config verification to enable it first.');
  }

  const channel = guild.channels.cache.get(verification.channel);
  if (!channel?.isTextBased?.()) throw new Error('The configured verification channel no longer exists.');

  const embed = new EmbedBuilder()
    .setColor(BRAND.colors.primary)
    .setTitle('Server Verification')
    .setDescription(
      'Welcome to FGx.\n\n' +
        'Click **Verify** below to gain access to the community.\n\n' +
        '• No personal data is collected\n' +
        '• Staff can review any verification',
    )
    .setFooter({ text: BRAND.footer });

  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId('verify:click').setStyle(ButtonStyle.Success).setLabel('Verify'),
  );

  const message = await channel.send({ embeds: [embed], components: [row] });

  // Keep track of the panel so re-running the command replaces it.
  if (verification.panelChannelId && verification.panelMessageId) {
    const oldChannel = guild.channels.cache.get(verification.panelChannelId);
    const oldMessage = oldChannel?.messages?.cache?.get(verification.panelMessageId);
    if (oldMessage) await oldMessage.delete().catch(() => {});
  }

  guildConfigRepo.update(guild.id, {
    verification: { panelChannelId: channel.id, panelMessageId: message.id },
  });
  return message;
}

/** Handle a verification button click. */
async function handleVerify(interaction) {
  const config = guildConfigRepo.get(interaction.guild.id);
  const verification = config.verification;
  if (!verification.enabled || !verification.roleId) {
    return interaction.reply({
      content: 'Verification is not configured for this server yet.',
      ephemeral: true,
    });
  }

  const member = interaction.member;
  const role = interaction.guild.roles.cache.get(verification.roleId);
  if (!role) {
    return interaction.reply({
      content: 'The verified role no longer exists. Contact staff.',
      ephemeral: true,
    });
  }

  // Prevent repeated verification attempts.
  if (member.roles.cache.has(role.id)) {
    return interaction.reply({
      content: 'You are already verified. Welcome back.',
      ephemeral: true,
    });
  }

  // Optional cooldown between attempts.
  if (verification.cooldownMinutes > 0) {
    const key = `verify:${interaction.guild.id}:${interaction.user.id}`;
    if (cooldown.has(key)) {
      return interaction.reply({
        content: `Please wait before verifying again.`,
        ephemeral: true,
      });
    }
    cooldown.set(key, verification.cooldownMinutes * 60_000);
  }

  try {
    // Role assignment + audit-log writes can exceed Discord's 3s window.
    await interaction.deferReply({ ephemeral: true });
    await member.roles.add(role, 'FGx verification');
    await logAudit(interaction.client, interaction.guild, {
      action: 'verification',
      target: interaction.user,
      moderator: null,
      details: { role: role.name },
    });
    await interaction.editReply({
      content: `Verified. Welcome to FGx.`,
    });
  } catch (err) {
    logger.warn('verification failed', { guildId: interaction.guild.id, error: err.message });
    if (interaction.deferred) {
      await interaction.editReply({
        content: 'Verification failed. Contact staff for help.',
      });
    } else {
      await interaction.reply({
        content: 'Verification failed. Contact staff for help.',
        ephemeral: true,
      });
    }
  }
}

module.exports = { createPanel, handleVerify };
