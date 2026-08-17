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
    .setName('unban')
    .setDescription('Unban a user by ID.')
    .addStringOption((o) => o.setName('user_id').setDescription('Discord ID of the banned user').setRequired(true))
    .addStringOption((o) => o.setName('reason').setDescription('Reason for the unban')),
  async execute(interaction) {
    requirePerms(interaction.member, [PermissionsBitField.Flags.BanMembers]);
    const userId = interaction.options.getString('user_id', true);
    const target = { id: userId, username: userId };
    const reason = interaction.options.getString('reason') ?? null;
    await moderationService.unban(interaction.client, interaction, { target, reason });
  },
};
