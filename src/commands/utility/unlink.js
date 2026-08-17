'use strict';

/*
 * Copyright © 2026 FGx.
 * All rights reserved.
 */

const { SlashCommandBuilder } = require('discord.js');
const { linksRepo, profilesRepo } = require('../../database/repos/profiles');
const { logAudit } = require('../../services/logging/auditLogger');
const { BRAND } = require('../../config/constants');

module.exports = {
  data: new SlashCommandBuilder().setName('unlink').setDescription('Remove your BloxStrike link from FGx.'),
  async execute(interaction) {
    const existing = linksRepo.get(interaction.guild.id, interaction.user.id);
    if (!existing) {
      return interaction.reply({
        embeds: [{ color: BRAND.colors.danger, title: 'Nothing to unlink', description: 'You have no BloxStrike link in this server.' }],
      });
    }
    linksRepo.remove(interaction.guild.id, interaction.user.id);
    profilesRepo.updateStats(interaction.guild.id, interaction.user.id, {
      blox_username: null,
      meta: { unlinked_at: new Date().toISOString() },
    });
    await logAudit(interaction.client, interaction.guild, {
      action: 'roster',
      target: interaction.user,
      moderator: null,
      reason: `Unlinked BloxStrike username ${existing.blox_username}`,
    });
    await interaction.reply({
      embeds: [{ color: BRAND.colors.success, title: 'Unlinked', description: `**${existing.blox_username}** is no longer linked to your account.` }],
    });
  },
};
