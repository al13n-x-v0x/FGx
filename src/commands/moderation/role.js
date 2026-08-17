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
    .setName('role')
    .setDescription('Add or remove a role on a member.')
    .addUserOption((o) => o.setName('user').setDescription('Member').setRequired(true))
    .addRoleOption((o) => o.setName('role').setDescription('Role to add/remove').setRequired(true))
    .addBooleanOption((o) => o.setName('remove').setDescription('Remove instead of add')),
  async execute(interaction) {
    requirePerms(interaction.member, [PermissionsBitField.Flags.ManageRoles]);
    const target = interaction.options.getUser('user', true);
    const member = await moderationService.fetchMember(interaction.guild, target.id);
    const role = interaction.options.getRole('role', true);
    const add = !(interaction.options.getBoolean('remove') ?? false);
    await moderationService.setRole(interaction.client, interaction, { member, role, add });
  },
};
