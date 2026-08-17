'use strict';

/*
 * Copyright © 2026 FGx.
 * All rights reserved.
 */

const { SlashCommandBuilder } = require('discord.js');
const { guildConfigRepo } = require('../../database/repos/guildConfig');
const { requireAdmin } = require('../../utils/permissions');
const { guildChannel, boundedString } = require('../../utils/validate');
const { BRAND } = require('../../config/constants');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('welcome')
    .setDescription('Configure the welcome system (admin).')
    .addSubcommand((s) =>
      s
        .setName('setup')
        .setDescription('Enable the welcome message')
        .addChannelOption((o) => o.setName('channel').setDescription('Welcome channel').setRequired(true))
        .addStringOption((o) => o.setName('message').setDescription('Welcome text (placeholders: {{user}} {{mention}} {{server}} {{count}})').setMaxLength(1000))
        .addRoleOption((o) => o.setName('role').setDescription('Auto-role on join (optional)')),
    )
    .addSubcommand((s) => s.setName('disable').setDescription('Disable the welcome system')),
  async execute(interaction) {
    const sub = interaction.options.getSubcommand();
    requireAdmin(interaction.member);

    if (sub === 'setup') {
      const channel = guildChannel(interaction.guild, interaction.options.getChannel('channel', true).id, 'channel');
      const message = interaction.options.getString('message') ?? '🎯 Compete\n🏆 Improve\n⚔️ Represent FGx';
      boundedString(message, { max: 1000, label: 'message' });
      const role = interaction.options.getRole('role');

      guildConfigRepo.update(interaction.guild.id, {
        welcome: {
          enabled: true,
          channel: channel.id,
          message,
          autoRole: role ? role.id : null,
        },
      });
      return interaction.reply({
        embeds: [
          {
            color: BRAND.colors.success,
            title: 'Welcome system configured',
            description: `Channel: ${channel}${role ? ` • Auto-role: ${role.name}` : ''}`,
          },
        ],
      });
    }

    if (sub === 'disable') {
      guildConfigRepo.update(interaction.guild.id, { welcome: { enabled: false } });
      return interaction.reply({
        embeds: [{ color: BRAND.colors.neutral, title: 'Welcome system disabled' }],
      });
    }
  },
};
