'use strict';

/*
 * Copyright © 2026 FGx.
 * All rights reserved.
 */

const { SlashCommandBuilder, PermissionsBitField } = require('discord.js');
const moderationService = require('../../services/moderation/moderationService');
const { requirePerms } = require('../../utils/permissions');
const { duration } = require('../../utils/validate');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('timeout')
    .setDescription('Timeout a member (e.g. 30m, 2h, 1d).')
    .addUserOption((o) => o.setName('user').setDescription('Member to timeout').setRequired(true))
    .addStringOption((o) => o.setName('duration').setDescription('Duration, e.g. 30m, 2h, 1d').setRequired(true))
    .addStringOption((o) => o.setName('reason').setDescription('Reason for the timeout')),
  async execute(interaction) {
    requirePerms(interaction.member, [PermissionsBitField.Flags.ModerateMembers]);
    const target = interaction.options.getUser('user', true);
    const durationMs = duration(interaction.options.getString('duration', true), 'duration');
    if (durationMs > 28 * 86_400_000) {
      throw new (require('../../utils/errors').ValidationError)('Timeouts are limited to 28 days.');
    }
    const reason = interaction.options.getString('reason') ?? null;
    await moderationService.timeout(interaction.client, interaction, { target, durationMs, reason });
  },
};
