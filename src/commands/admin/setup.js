'use strict';

/*
 * Copyright © 2026 FGx.
 * All rights reserved.
 */

const { SlashCommandBuilder, ChannelType, EmbedBuilder } = require('discord.js');
const { BRAND } = require('../../config/constants');
const { guildConfigRepo } = require('../../database/repos/guildConfig');
const { requireAdmin } = require('../../utils/permissions');
const verificationService = require('../../services/community/verificationService');
const robloxService = require('../../services/community/robloxService');
const welcomeService = require('../../services/community/welcomeService');
const ticketService = require('../../services/tickets/ticketService');
const { logger } = require('../../utils/logger');

/**
 * /setup — one-command full server setup.
 * Creates/reuses channels, roles, and categories; writes the full per-guild
 * configuration; posts the verification + ticket panels and a welcome
 * preview. Idempotent: existing FGx channels/roles are reused, never deleted.
 */

const DEFAULT_WELCOME_MESSAGE = '🎯 Compete · 🏆 Improve · ⚔️ Represent FGx';

/** Find a text channel by name or create it under the category. */
async function ensureChannel(guild, name, { provided, parent } = {}) {
  if (provided) return provided;
  const existing = guild.channels.cache.find((c) => c.name === name && c.type === ChannelType.GuildText);
  if (existing) return existing;
  return guild.channels.create({ name, type: ChannelType.GuildText, parent: parent?.id });
}

/** Find a category by name or create it. */
async function ensureCategory(guild, name, provided) {
  if (provided) {
    if (provided.type === ChannelType.GuildCategory) return provided;
    throw new Error(`\`${provided.name}\` is not a category channel.`);
  }
  const existing = guild.channels.cache.find((c) => c.name === name && c.type === ChannelType.GuildCategory);
  if (existing) return existing;
  return guild.channels.create({ name, type: ChannelType.GuildCategory });
}

/** Find a non-managed role by name or create it. */
async function ensureRole(guild, name, { provided, color } = {}) {
  if (provided) return provided;
  const existing = guild.roles.cache.find((r) => r.name === name && !r.managed);
  if (existing) return existing;
  return guild.roles.create({ name, color: color ?? undefined, reason: 'FGx /setup' });
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName('setup')
    .setDescription('One-command full FGx setup: welcome, verification, tickets, logs, roles (admin).')
    .addChannelOption((o) => o.setName('welcome_channel').setDescription('Welcome channel (default: create #welcome)'))
    .addChannelOption((o) => o.setName('log_channel').setDescription('Log channel (default: create #fgx-logs)'))
    .addChannelOption((o) => o.setName('ticket_category').setDescription('Ticket category (default: create FGx Tickets)'))
    .addRoleOption((o) => o.setName('verified_role').setDescription('Verified role (default: create Verified)'))
    .addRoleOption((o) => o.setName('member_role').setDescription('Clan Member role (default: create Member)')),
  async execute(interaction) {
    requireAdmin(interaction.member);
    await interaction.deferReply();

    const guild = interaction.guild;
    const results = [];
    const warnings = [];

    /** Run a setup step; record results/warnings and continue on failure. */
    async function step(label, fn) {
      try {
        const value = await fn();
        results.push(`✔ ${label}${value ? ` — ${value}` : ''}`);
        return value;
      } catch (err) {
        warnings.push(`${label}: ${err.message}`);
        return null;
      }
    }

    try {
      // 1. Category + channels.
      const category = await step('FGx category', () => ensureCategory(guild, 'FGx', null));
      const welcomeChannel = await step(
        'Welcome channel',
        () => ensureChannel(guild, 'welcome', { provided: interaction.options.getChannel('welcome_channel'), parent: category }),
      );
      const logChannel = await step(
        'Log channel',
        () => ensureChannel(guild, 'fgx-logs', { provided: interaction.options.getChannel('log_channel'), parent: category }),
      );
      const ticketChannel = await step('Ticket channel', () => ensureChannel(guild, 'tickets', { parent: category }));
      const verifyChannel = await step('Verification channel', () => ensureChannel(guild, 'verify', { parent: category }));

      // 2. Roles.
      const verifiedRole = await step(
        'Verified role',
        () => ensureRole(guild, 'Verified', { provided: interaction.options.getRole('verified_role'), color: BRAND.colors.success }),
      );
      const memberRole = await step(
        'Clan Member role',
        () => ensureRole(guild, 'Member', { provided: interaction.options.getRole('member_role'), color: BRAND.colors.primary }),
      );
      const ticketCategory = await step('Ticket category', () => ensureCategory(guild, 'FGx Tickets', interaction.options.getChannel('ticket_category')));

      // 3. Save the per-guild configuration (only for what succeeded).
      const patch = {};
      if (welcomeChannel && memberRole) {
        patch.welcome = { enabled: true, channel: welcomeChannel.id, message: DEFAULT_WELCOME_MESSAGE, autoRole: memberRole.id };
      }
      if (verifyChannel && verifiedRole) {
        patch.verification = { enabled: true, channel: verifyChannel.id, roleId: verifiedRole.id, cooldownMinutes: 0 };
        patch.roblox = { enabled: true, channel: verifyChannel.id, roleId: verifiedRole.id, codeTtlMinutes: 5 };
      }
      if (ticketChannel && ticketCategory) {
        patch.tickets = { enabled: true, categoryId: ticketCategory.id, panelChannelId: ticketChannel.id, staffRoleIds: [] };
      }
      if (logChannel) {
        patch.logChannel = logChannel.id;
        patch.modLogChannel = logChannel.id;
        patch.logging = { enabled: true };
      }
      if (memberRole) {
        patch.clan = { ranks: { Member: memberRole.id } };
      }

      if (Object.keys(patch).length > 0) {
        guildConfigRepo.update(guild.id, patch);
        results.push('✔ Configuration saved (welcome, verification, tickets, logging, clan roles)');
      } else {
        warnings.push('No configuration could be saved — check the bot has Manage Channels / Manage Roles permissions.');
      }

      // 4. Post the panels and welcome preview (best-effort).
      if (ticketChannel && ticketCategory) {
        const panel = await step('Ticket panel', () => ticketService.createPanel(guild));
        void panel;
      }
      if (verifyChannel && verifiedRole) {
        const panel = await step('Verification panel', () => verificationService.createPanel(guild));
        void panel;
        const robloxPanel = await step('Roblox verification panel', () => robloxService.createPanel(guild));
        void robloxPanel;
      }
      if (welcomeChannel) {
        const { embed, rows } = welcomeService.buildWelcomeView({
          member: {
            guild: { name: guild.name, iconURL: () => guild.iconURL() },
            user: { username: 'New Member', displayAvatarURL: ({ size }) => guild.iconURL({ size }) ?? undefined },
          },
          message: DEFAULT_WELCOME_MESSAGE,
          memberCount: guild.memberCount,
          guildName: guild.name,
          includeVerify: true,
        });
        await welcomeChannel
          .send({
            content: '**Setup preview** — this is what new members see, welcome animation included. Auto-role applies automatically.',
            embeds: [embed],
            components: rows,
            files: [{ attachment: welcomeService.WELCOME_VIDEO, name: 'welcome.mp4' }],
          })
          .then(() => results.push('✔ Welcome preview posted (with animation)'))
          .catch(() => warnings.push('Welcome preview: could not post'));
      }
    } catch (err) {
      logger.error('setup failed', { guildId: guild.id, error: err.message });
      throw err;
    }

    const embed = new EmbedBuilder()
      .setColor(BRAND.colors.success)
      .setTitle('FGx Setup Complete')
      .setDescription(
        `**${guild.name}** is ready to go.\n\n${results.join('\n')}` +
          (warnings.length > 0 ? `\n\n⚠️ **Warnings**\n${warnings.join('\n')}` : '') +
          `\n\n**Next steps**\n` +
          `• Review fine-tuning with \`/config\`\n` +
          `• Bind clan rank roles with \`/config clan\`\n` +
          `• Link Roblox accounts with \`/roblox verify\` (Bloxlink-style)\n` +
          `• Set an AI provider key for \`/ask\`, \`/bloxai\` (see .env)\n` +
          `• Shuffle scrim teams with \`/shuffle scrim\``,
      )
      .setFooter({ text: BRAND.footer });

    await interaction.editReply({ embeds: [embed] });
  },
};
