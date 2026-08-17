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
    .setName('warn')
    .setDescription('Warn a member. Logs the warning and notifies them.')
    .addUserOption((o) => o.setName('user').setDescription('Member to warn').setRequired(true))
    .addStringOption((o) => o.setName('reason').setDescription('Reason for the warning').setRequired(true)),
  async execute(interaction) {
    requirePerms(interaction.member, [PermissionsBitField.Flags.ModerateMembers]);
    const target = interaction.options.getUser('user', true);
    const reason = interaction.options.getString('reason', true);
    await moderationService.warn(interaction.client, interaction, { target, reason });
  },
};
