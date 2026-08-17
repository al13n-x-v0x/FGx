'use strict';

/*
 * Copyright © 2026 FGx.
 * All rights reserved.
 */

const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { BRAND } = require('../../config/constants');
const { guildConfigRepo } = require('../../database/repos/guildConfig');
const rosterService = require('../../services/clan/rosterService');
const analysisService = require('../../services/clan/analysisService');
const { kdRatio, winRate, formatDate } = require('../../utils/format');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('analysis')
    .setDescription('Staff-only analysis from FGx-recorded data.')
    .addSubcommand((s) =>
      s
        .setName('player')
        .setDescription('Analyze a player')
        .addUserOption((o) => o.setName('user').setDescription('Player').setRequired(true)),
    )
    .addSubcommand((s) => s.setName('team').setDescription('Analyze FGx team performance'))
    .addSubcommand((s) =>
      s
        .setName('match')
        .setDescription('Analyze a recorded match')
        .addIntegerOption((o) => o.setName('id').setDescription('Match ID').setRequired(true)),
    ),
  async execute(interaction) {
    const sub = interaction.options.getSubcommand();
    const config = guildConfigRepo.get(interaction.guild.id);
    rosterService.requireStaff(interaction.member, config);

    if (sub === 'team') {
      const team = analysisService.analyzeTeam(interaction.guild.id);
      const embed = new EmbedBuilder()
        .setColor(BRAND.colors.primary)
        .setTitle('FGx PERFORMANCE ANALYSIS — Team')
        .setDescription(
          `**Recent form:** ${team.totalMatches === 0 ? 'No data' : team.recent.count === 0 ? 'No recent matches' : team.trend}\n` +
            `**Win rate:** ${winRate(team.record?.wins ?? 0, team.record?.matches ?? 0)}\n` +
            `**Record:** ${team.record?.wins ?? 0}W ${team.record?.losses ?? 0}L ${team.record?.draws ?? 0}D\n` +
            `**Sample size:** ${team.totalMatches} recorded matches\n\n` +
            `_Internal FGx metric — not an official BloxStrike ranking._`,
        )
        .setFooter({ text: BRAND.footer });
      return interaction.reply({ embeds: [embed], ephemeral: true });
    }

    if (sub === 'match') {
      const result = analysisService.analyzeMatch(interaction.guild.id, interaction.options.getInteger('id', true));
      if (!result) {
        return interaction.reply({ content: 'Match not found.', ephemeral: true });
      }
      const { match, players } = result;
      const lines = players.map(
        (p) => `<@${p.user_id}> — ${p.kills ?? 0} kills / ${p.deaths ?? 0} deaths (${kdRatio(p.kills ?? 0, p.deaths ?? 0)} K/D)`,
      );
      const embed = new EmbedBuilder()
        .setColor(BRAND.colors.primary)
        .setTitle(`Match #${match.id} — vs ${match.opponent}`)
        .setDescription(
          `**Score:** ${match.our_score}–${match.opp_score} (**${match.winner.toUpperCase()}**)\n` +
            `**Date:** ${formatDate(new Date(match.played_at + (match.played_at.endsWith('Z') ? '' : 'Z')))}\n` +
            (match.notes ? `**Notes:** ${match.notes}\n` : '') +
            `\n**Lineup**\n${lines.join('\n') || '—'}`,
        )
        .setFooter({ text: BRAND.footer });
      return interaction.reply({ embeds: [embed], ephemeral: true });
    }

    // player
    const user = interaction.options.getUser('user', true);
    const analysis = analysisService.analyzePlayer(interaction.guild.id, user.id);
    const embed = new EmbedBuilder()
      .setColor(BRAND.colors.primary)
      .setTitle('FGx PERFORMANCE ANALYSIS')
      .setDescription(
        `Player: <@${user.id}>\n\n` +
          `**Record:** ${analysis.overall.record}\n` +
          `**Win rate:** ${analysis.overall.winRate}\n` +
          `**K/D:** ${analysis.overall.kd}\n` +
          `**Recent form (last ${analysis.recent.count}):** ${analysis.recent.count === 0 ? 'no matches' : `${analysis.recent.wins}W ${analysis.recent.count - analysis.recent.wins}L (${analysis.recent.winRate})`}\n` +
          `**Recent trend:** ${analysis.recent.count >= 3 ? (analysis.recent.wins / analysis.recent.count >= 0.5 ? 'Improving' : 'Needs work') : 'Not enough data'}\n` +
          `**Strength:** ${analysis.strength}\n` +
          `**Potential weakness:** ${analysis.weakness}\n` +
          `**Sample size:** ${analysis.sampleSize} recorded matches\n\n` +
          `_Internal FGx metric — not an official BloxStrike ranking._`,
      )
      .setFooter({ text: BRAND.footer });
    return interaction.reply({ embeds: [embed], ephemeral: true });
  },
};
