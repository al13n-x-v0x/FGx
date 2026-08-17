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
    .setName('kick')
    .setDescription('Kick a member from the server.')
    .addUserOption((o) => o.setName('user').setDescription('Member to kick').setRequired(true))
    .addStringOption((o) => o.setName('reason').setDescription('Reason for the kick')),
  async execute(interaction) {
    requirePerms(interaction.member, [PermissionsBitField.Flags.KickMembers]);
    const target = interaction.options.getUser('user', true);
    const reason = interaction.options.getString('reason') ?? null;
    await moderationService.kick(interaction.client, interaction, { target, reason });
  },
};
