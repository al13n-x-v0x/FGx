'use strict';

/*
 * Copyright © 2026 FGx.
 * All rights reserved.
 */

const { SlashCommandBuilder, EmbedBuilder, PermissionsBitField } = require('discord.js');
const { warningsRepo } = require('../../database/repos/moderation');
const { BRAND } = require('../../config/constants');
const { requirePerms } = require('../../utils/permissions');
const { formatDate } = require('../../utils/format');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('warnings')
    .setDescription("View a member's active warnings.")
    .addUserOption((o) => o.setName('user').setDescription('Member to check').setRequired(true)),
  async execute(interaction) {
    requirePerms(interaction.member, [PermissionsBitField.Flags.ModerateMembers]);
    const target = interaction.options.getUser('user', true);
    const list = warningsRepo.listFor(interaction.guild.id, target.id);

    const embed = new EmbedBuilder()
      .setColor(BRAND.colors.warn)
      .setTitle(`Warnings for ${target.username}`)
      .setDescription(
        list.length === 0
          ? 'No active warnings. Clean record.'
          : list
              .map((w) => `**#${w.id}** — ${w.reason}\n<@${w.moderator_id}> • ${formatDate(new Date(w.created_at + 'Z'))}`)
              .join('\n\n'),
      )
      .setFooter({ text: BRAND.footer });

    await interaction.reply({ embeds: [embed] });
  },
};
