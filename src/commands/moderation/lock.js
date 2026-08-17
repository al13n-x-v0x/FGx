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
    .setName('lock')
    .setDescription('Lock a channel (deny @everyone from sending).')
    .addChannelOption((o) => o.setName('channel').setDescription('Channel (default: this one)'))
    .addStringOption((o) => o.setName('reason').setDescription('Reason for locking')),
  async execute(interaction) {
    requirePerms(interaction.member, [PermissionsBitField.Flags.ManageChannels]);
    const channel = interaction.options.getChannel('channel') ?? interaction.channel;
    const reason = interaction.options.getString('reason') ?? null;
    await moderationService.setLock(interaction.client, interaction, { channel, locked: true, reason });
  },
};
