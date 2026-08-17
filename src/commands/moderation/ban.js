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
    .setName('ban')
    .setDescription('Ban a member from the server.')
    .addUserOption((o) => o.setName('user').setDescription('Member to ban').setRequired(true))
    .addStringOption((o) => o.setName('reason').setDescription('Reason for the ban'))
    .addIntegerOption((o) =>
      o.setName('delete_days').setDescription('Days of message history to delete (0-7)').setMinValue(0).setMaxValue(7),
    ),
  async execute(interaction) {
    requirePerms(interaction.member, [PermissionsBitField.Flags.BanMembers]);
    const target = interaction.options.getUser('user', true);
    const reason = interaction.options.getString('reason') ?? null;
    const deleteDays = interaction.options.getInteger('delete_days') ?? 0;
    await moderationService.ban(interaction.client, interaction, { target, reason, deleteDays });
  },
};
