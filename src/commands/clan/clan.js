'use strict';

/*
 * Copyright © 2026 FGx.
 * All rights reserved.
 */

const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { BRAND, RANKS } = require('../../config/constants');
const rosterService = require('../../services/clan/rosterService');
const { matchesRepo } = require('../../database/repos/competitive');
const { winRate } = require('../../utils/format');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('clan')
    .setDescription('FGx clan information and membership.')
    .addSubcommand((s) => s.setName('info').setDescription('About the FGx clan'))
    .addSubcommand((s) => s.setName('members').setDescription('Member count and rank breakdown'))
    .addSubcommand((s) => s.setName('apply').setDescription('Open the tryout application'))
    .addSubcommand((s) => s.setName('stats').setDescription('Clan competitive statistics')),
  async execute(interaction) {
    const sub = interaction.options.getSubcommand();

    if (sub === 'info') {
      const embed = new EmbedBuilder()
        .setColor(BRAND.colors.primary)
        .setTitle('FGx — BloxStrike Clan')
        .setDescription(
          `**About**\nFGx is a competitive BloxStrike clan focused on improvement, teamwork, and representing the clan in scrims and clan wars.\n\n` +
            `**Ranks**\n${RANKS.join(' → ')}\n\n` +
            `**Join**\nUse \`/tryout apply\` to start your application.`,
        )
        .setFooter({ text: BRAND.footer });
      return interaction.reply({ embeds: [embed] });
    }

    if (sub === 'members') {
      const counts = rosterService.countByRank(interaction.guild.id);
      const total = Object.values(counts).reduce((a, b) => a + b, 0);
      const embed = new EmbedBuilder()
        .setColor(BRAND.colors.primary)
        .setTitle(`FGx Members — ${total}`)
        .setDescription(RANKS.map((r) => `**${r}:** ${counts[r]}`).join('\n'))
        .setFooter({ text: BRAND.footer });
      return interaction.reply({ embeds: [embed] });
    }

    if (sub === 'apply') {
      const tryout = require('./tryout');
      return tryout.handleApplyOpen(interaction);
    }

    if (sub === 'stats') {
      const record = matchesRepo.record(interaction.guild.id);
      const embed = new EmbedBuilder()
        .setColor(BRAND.colors.primary)
        .setTitle('FGx Competitive Statistics')
        .setDescription(
          record && record.matches > 0
            ? `**Matches:** ${record.matches}\n` +
              `**Record:** ${record.wins}W ${record.losses}L ${record.draws}D\n` +
              `**Win rate:** ${winRate(record.wins ?? 0, record.matches ?? 0)}\n` +
              `**Total score:** ${record.total_ours ?? 0} : ${record.total_opps ?? 0}\n\n` +
              '_FGx-recorded data. Not an official BloxStrike ranking._'
            : 'No recorded competitive data yet.',
        )
        .setFooter({ text: BRAND.footer });
      return interaction.reply({ embeds: [embed] });
    }
  },
};
