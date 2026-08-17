'use strict';

/*
 * Copyright © 2026 FGx.
 * All rights reserved.
 */

const { SlashCommandBuilder } = require('discord.js');
const verificationService = require('../../services/community/verificationService');
const { guildConfigRepo } = require('../../database/repos/guildConfig');
const { requireAdmin } = require('../../utils/permissions');
const { guildChannel, guildRole } = require('../../utils/validate');
const { BRAND } = require('../../config/constants');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('verify')
    .setDescription('Set up the verification system (admin).')
    .addSubcommand((s) =>
      s
        .setName('setup')
        .setDescription('Create the verification panel')
        .addChannelOption((o) => o.setName('channel').setDescription('Channel for the panel').setRequired(true))
        .addRoleOption((o) => o.setName('role').setDescription('Role granted on verification').setRequired(true))
        .addIntegerOption((o) => o.setName('cooldown_minutes').setDescription('Cooldown between attempts (0 = none)').setMinValue(0).setMaxValue(1440)),
    ),
  async execute(interaction) {
    const sub = interaction.options.getSubcommand();
    requireAdmin(interaction.member);

    if (sub === 'setup') {
      const channel = guildChannel(interaction.guild, interaction.options.getChannel('channel', true).id, 'channel');
      const role = guildRole(interaction.guild, interaction.options.getRole('role', true).id, 'role');
      const cooldownMinutes = interaction.options.getInteger('cooldown_minutes') ?? 0;

      guildConfigRepo.update(interaction.guild.id, {
        verification: {
          enabled: true,
          channel: channel.id,
          roleId: role.id,
          cooldownMinutes,
        },
      });

      const message = await verificationService.createPanel(interaction.guild);
      return interaction.reply({
        embeds: [
          {
            color: BRAND.colors.success,
            title: 'Verification configured',
            description: `Panel sent to ${message.channel}. Role: ${role.name}${cooldownMinutes > 0 ? ` • cooldown ${cooldownMinutes}m` : ''}`,
          },
        ],
        ephemeral: true,
      });
    }
  },
};
