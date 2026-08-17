'use strict';

/*
 * Copyright © 2026 FGx.
 * All rights reserved.
 */

const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { BRAND } = require('../../config/constants');
const { guildConfigRepo } = require('../../database/repos/guildConfig');
const { antiraid, antinuke, lockdown } = require('../../services/security');
const { requireAdmin } = require('../../utils/permissions');
const { logAudit } = require('../../services/logging/auditLogger');

function statusEmbed(guild) {
  const config = guildConfigRepo.get(guild.id);
  const embed = new EmbedBuilder()
    .setColor(BRAND.colors.primary)
    .setTitle('FGx Security Status')
    .setDescription(
      `**Protection mode:** ${config.security.lockdown ? '🟢 ACTIVE' : '⚪ Inactive'}\n` +
        `**Anti-spam:** ${config.antispam.enabled ? 'Enabled' : 'Disabled'}\n` +
        `**Anti-raid:** ${config.antiraid.enabled ? 'Enabled' : 'Disabled'} ` +
        `(join threshold ${config.antiraid.joinThreshold} / ${config.antiraid.windowSeconds}s)\n` +
        `**Anti-nuke:** ${config.antinuke.enabled ? 'Enabled' : 'Disabled'} ` +
        `(${config.antinuke.channelDeleteLimit} channel deletions / min)\n` +
        `**AI security:** ${config.ai.securityEnabled ? 'Enabled' : 'Disabled'} (mode ${config.ai.actionMode})\n` +
        `**Lockdown roles allowed:** ${config.security.lockdownRoleIds.map((r) => `<@&${r}>`).join(' ') || 'none'}`,
    )
    .setFooter({ text: `${BRAND.footer} • Raid alerts reset automatically` });
  return embed;
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName('security')
    .setDescription('Manage FGx server protection.')
    .addSubcommand((s) => s.setName('status').setDescription('Show security status'))
    .addSubcommand((s) => s.setName('enable').setDescription('Enable protection mode (anti-raid + anti-nuke)'))
    .addSubcommand((s) => s.setName('disable').setDescription('Disable protection mode and unlock channels'))
    .addSubcommand((s) =>
      s
        .setName('lockdown')
        .setDescription('Manually lock the server for everyone except staff roles')
        .addStringOption((o) => o.setName('roles').setDescription('Comma-separated role IDs allowed to speak during lockdown')),
    ),
  async execute(interaction) {
    const sub = interaction.options.getSubcommand();

    if (sub === 'status') {
      return interaction.reply({ embeds: [statusEmbed(interaction.guild)] });
    }

    requireAdmin(interaction.member);

    if (sub === 'enable') {
      guildConfigRepo.update(interaction.guild.id, {
        antiraid: { enabled: true },
        antinuke: { enabled: true },
      });
      await logAudit(interaction.client, interaction.guild, {
        action: 'security',
        target: null,
        moderator: interaction.user,
        reason: 'Protection enabled',
      });
      return interaction.reply({ embeds: [statusEmbed(interaction.guild)] });
    }

    if (sub === 'disable') {
      guildConfigRepo.update(interaction.guild.id, {
        antiraid: { enabled: false },
        antinuke: { enabled: false },
      });
      antiraid.reset(interaction.guild.id);
      antinuke.reset(interaction.guild.id);
      const unlocked = await lockdown.removeLockdown(interaction.guild);
      await logAudit(interaction.client, interaction.guild, {
        action: 'security',
        target: null,
        moderator: interaction.user,
        reason: 'Protection disabled',
        details: { unlockedChannels: unlocked },
      });
      return interaction.reply({
        embeds: [
          {
            color: BRAND.colors.success,
            title: 'Protection disabled',
            description: `Unlocked ${unlocked} channels. Raid/anti-nuke tracking reset.`,
          },
        ],
      });
    }

    if (sub === 'lockdown') {
      const roles = (interaction.options.getString('roles') ?? '')
        .split(',')
        .map((r) => r.trim())
        .filter((r) => /^\d{15,21}$/.test(r));
      const locked = await lockdown.applyLockdown(interaction.guild, { allowRoles: roles });
      await logAudit(interaction.client, interaction.guild, {
        action: 'security',
        target: null,
        moderator: interaction.user,
        reason: 'Manual lockdown',
        details: { lockedChannels: locked, allowedRoles: roles.length },
      });
      return interaction.reply({
        embeds: [
          {
            color: BRAND.colors.danger,
            title: 'Lockdown engaged',
            description: `Locked ${locked} channels for @everyone. Use \`/security disable\` to lift it.`,
          },
        ],
      });
    }
  },
};
