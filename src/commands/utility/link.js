'use strict';

/*
 * Copyright © 2026 FGx.
 * All rights reserved.
 */

const { SlashCommandBuilder } = require('discord.js');
const { linksRepo, profilesRepo } = require('../../database/repos/profiles');
const { bloxstrikeUsername } = require('../../utils/validate');
const { logAudit } = require('../../services/logging/auditLogger');
const { BRAND } = require('../../config/constants');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('link')
    .setDescription('Link your BloxStrike username to your FGx Discord account.')
    .addStringOption((o) => o.setName('username').setDescription('Your BloxStrike username').setRequired(true)),
  async execute(interaction) {
    const username = bloxstrikeUsername(interaction.options.getString('username', true));
    const existing = linksRepo.get(interaction.guild.id, interaction.user.id);
    try {
      const link = linksRepo.create(interaction.guild.id, interaction.user.id, username);
      profilesRepo.updateStats(interaction.guild.id, interaction.user.id, {
        blox_username: username,
        meta: { linked_at: new Date().toISOString() },
      });
      await logAudit(interaction.client, interaction.guild, {
        action: 'roster',
        target: interaction.user,
        moderator: null,
        reason: `Linked BloxStrike username ${username}`,
        details: { status: link.status },
      });
      await interaction.reply({
        embeds: [
          {
            color: BRAND.colors.success,
            title: 'BloxStrike link submitted',
            description:
              existing
                ? `Your link was updated to **${username}** and reset to **pending**.\nStaff will re-verify it.`
                : `**${username}** is now linked to your account and **pending staff verification**.\n\n` +
                  'Your link prevents others from claiming this identity. Staff can verify it to mark it **verified**.',
          },
        ],
      });
    } catch (err) {
      if (err.code === 'DUPLICATE_USERNAME' || err.code === 'DUPLICATE_USER') {
        return interaction.reply({
          embeds: [{ color: BRAND.colors.danger, title: 'Link rejected', description: err.message }],
        });
      }
      throw err;
    }
  },
};
