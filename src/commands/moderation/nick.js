'use strict';

/*
 * Copyright © 2026 FGx.
 * All rights reserved.
 */

const { SlashCommandBuilder, PermissionsBitField } = require('discord.js');
const moderationService = require('../../services/moderation/moderationService');
const { requirePerms } = require('../../utils/permissions');
const { boundedString } = require('../../utils/validate');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('nick')
    .setDescription('Change a member’s nickname.')
    .addUserOption((o) => o.setName('user').setDescription('Member').setRequired(true))
    .addStringOption((o) => o.setName('nickname').setDescription('New nickname (empty to reset)')),
  async execute(interaction) {
    requirePerms(interaction.member, [PermissionsBitField.Flags.ManageNicknames]);
    const target = interaction.options.getUser('user', true);
    const member = await moderationService.fetchMember(interaction.guild, target.id);
    const nickname = interaction.options.getString('nickname') ?? null;
    if (nickname) boundedString(nickname, { max: 32, label: 'nickname' });
    await moderationService.setNick(interaction.client, interaction, { member, nickname });
  },
};
