'use strict';

/*
 * Copyright © 2026 FGx.
 * All rights reserved.
 */

const { SlashCommandBuilder, PermissionsBitField } = require('discord.js');
const moderationService = require('../../services/moderation/moderationService');
const { requirePerms } = require('../../utils/permissions');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('slowmode')
    .setDescription('Set or remove slowmode on a channel.')
    .addIntegerOption((o) => o.setName('seconds').setDescription('Seconds between messages (0 to disable)').setMinValue(0).setMaxValue(21600).setRequired(true))
    .addChannelOption((o) => o.setName('channel').setDescription('Channel (default: this one)')),
  async execute(interaction) {
    requirePerms(interaction.member, [PermissionsBitField.Flags.ManageChannels]);
    const channel = interaction.options.getChannel('channel') ?? interaction.channel;
    const seconds = interaction.options.getInteger('seconds', true);
    await moderationService.setSlowmode(interaction.client, interaction, { channel, seconds });
  },
};
