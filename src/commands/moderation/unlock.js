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
    .setName('unlock')
    .setDescription('Unlock a channel (allow @everyone to send again).')
    .addChannelOption((o) => o.setName('channel').setDescription('Channel (default: this one)')),
  async execute(interaction) {
    requirePerms(interaction.member, [PermissionsBitField.Flags.ManageChannels]);
    const channel = interaction.options.getChannel('channel') ?? interaction.channel;
    await moderationService.setLock(interaction.client, interaction, { channel, locked: false });
  },
};
