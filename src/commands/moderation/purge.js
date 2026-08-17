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
    .setName('purge')
    .setDescription('Bulk-delete recent messages (max 100).')
    .addIntegerOption((o) => o.setName('amount').setDescription('Messages to delete (1-100)').setMinValue(1).setMaxValue(100).setRequired(true))
    .addChannelOption((o) => o.setName('channel').setDescription('Channel to purge (default: this one)')),
  async execute(interaction) {
    requirePerms(interaction.member, [PermissionsBitField.Flags.ManageMessages]);
    const channel = interaction.options.getChannel('channel') ?? interaction.channel;
    const count = interaction.options.getInteger('amount', true);
    await moderationService.purge(interaction.client, interaction, { channel, count });
  },
};
