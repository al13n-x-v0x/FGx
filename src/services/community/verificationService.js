'use strict';

/* Copyright © 2026 FGx. All rights reserved. */

const { ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder } = require('discord.js');
const { linksRepo } = require('../../database/repos/profiles');
const { robloxLinksRepo } = require('../../database/repos/roblox');
const { guildConfigRepo } = require('../../database/repos/guildConfig');
const { BRAND } = require('../../config/constants');
const { logger } = require('../../utils/logger');

/**
 * Verification levels — the gate for FGx's VIP features.
 *
 * A member is:
 *   none    — no verification at all
 *   basic   — BloxStrike link approved by staff (/link)
 *   roblox  — Roblox account verified via About-code (/roblox verify)
 *   full    — BOTH verified → VIP features unlock ("it cooks")
 */

const LEVELS = ['none', 'basic', 'roblox', 'full'];

/** Full verification status for a member. */
function status(guildId, userId) {
  const link = linksRepo.get(guildId, userId);
  const roblox = robloxLinksRepo.get(guildId, userId);
  const basic = link?.status === 'verified';
  const robloxVerified = roblox?.status === 'verified';
  const full = basic && robloxVerified;
  return {
    basic,
    roblox: robloxVerified,
    full,
    level: full ? 'full' : robloxVerified ? 'roblox' : basic ? 'basic' : 'none',
  };
}

/** True when the member is fully verified (both normal + Roblox). */
function isFull(guildId, userId) {
  return status(guildId, userId).full;
}

/** Throw a typed VIP_LOCKED error when the member isn't fully verified. */
function requireFull(guildId, userId) {
  const s = status(guildId, userId);
  if (!s.full) {
    const err = new Error(
      '🔒 **VIP locked.** Fully verify to unlock — your BloxStrike link must be approved by staff (`/link`) **and** your Roblox account verified (`/roblox verify`).',
    );
    err.code = 'VIP_LOCKED';
    err.vipStatus = s;
    throw err;
  }
  return s;
}

/** Human-readable line describing what's done / missing. */
function statusLines(s) {
  const lines = [
    `${s.basic ? '✅' : '⬜'} BloxStrike link approved by staff — \`/link\``,
    `${s.roblox ? '✅' : '⬜'} Roblox account verified — \`/roblox verify\``,
  ];
  if (s.full) {
    lines.push('👑 **You are fully verified — VIP unlocked!**');
  } else {
    lines.push('🔒 Verify both to unlock **VIP features** (VIP daily ₣Ԡ🇽, pro loadouts, profile crown).');
  }
  return lines;
}

/**
 * Create a verification panel embed in the configured channel.
 * Called by /verify setup — shows a clickable button that reveals a member's
 * current verification status (BloxStrike + Roblox).
 */
async function createPanel(guild) {
  const config = guildConfigRepo.get(guild.id);
  const channelId = config.verification.channel;
  const channel = channelId ? (guild.channels.cache.get(channelId) ?? null) : null;
  if (!channel?.isTextBased?.()) {
    throw new Error('No verification channel configured. Run `/verify setup channel:<channel>` first.');
  }

  const embed = new EmbedBuilder()
    .setColor(BRAND.colors.primary)
    .setTitle('🔐 FGx Verification')
    .setDescription(
      'Verify your identity to unlock the full server experience.\n\n' +
      '**What you need:**\n' +
      '• **BloxStrike account** — link your username via `/link`\n' +
      '• **Roblox account** — verify with a one-time code via `/roblox verify`\n\n' +
      '**Click the button below** to check your verification status.',
    )
    .addFields(
      {
        name: '⬜ Step 1 — BloxStrike',
        value: 'Run `/link submit username:<your-name>` and wait for staff approval.',
        inline: true,
      },
      {
        name: '⬜ Step 2 — Roblox',
        value: 'Click **Verify** below, enter your Roblox username, and put the code in your About section.',
        inline: true,
      },
    )
    .setFooter({ text: `${BRAND.footer} • Both steps = 👑 VIP unlocked` })
    .setTimestamp();

  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId('verify:click')
      .setStyle(ButtonStyle.Primary)
      .setLabel('🔍 Check my verification'),
  );

  const message = await channel.send({ embeds: [embed], components: [row] });
  logger.info('Verification panel created', { guildId: guild.id, channelId: channel.id });
  return message;
}

/**
 * Handle the "Check my verification" button.
 * Shows the member their current BloxStrike + Roblox status and what's missing.
 */
async function handleVerify(interaction) {
  const s = status(interaction.guild.id, interaction.user.id);
  const lines = statusLines(s);

  const embed = new EmbedBuilder()
    .setColor(s.full ? BRAND.colors.success : BRAND.colors.warn)
    .setTitle(`🔐 Verification Status — ${interaction.user.username}`)
    .setDescription(lines.join('\n'))
    .setFooter({ text: BRAND.footer })
    .setTimestamp();

  const components = [];

  // Show action buttons for incomplete steps
  const buttons = [];
  if (!s.roblox) {
    buttons.push(
      new ButtonBuilder()
        .setCustomId('roblox:start')
        .setStyle(ButtonStyle.Primary)
        .setLabel('🟥 Verify Roblox'),
    );
  }
  if (!s.basic) {
    buttons.push(
      new ButtonBuilder()
        .setCustomId('welcome:link')
        .setStyle(ButtonStyle.Success)
        .setLabel('⚔️ Link BloxStrike'),
    );
  }
  if (buttons.length > 0) {
    components.push(new ActionRowBuilder().addComponents(...buttons));
  }

  await interaction.reply({ embeds: [embed], components, ephemeral: true });
}

module.exports = {
  status,
  isFull,
  requireFull,
  statusLines,
  LEVELS,
  createPanel,
  handleVerify,
};
