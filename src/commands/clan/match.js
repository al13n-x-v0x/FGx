'use strict';

/*
 * Copyright © 2026 FGx.
 * All rights reserved.
 */

const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { BRAND } = require('../../config/constants');
const { guildConfigRepo } = require('../../database/repos/guildConfig');
const { matchesRepo } = require('../../database/repos/competitive');
const rosterService = require('../../services/clan/rosterService');
const matchService = require('../../services/clan/matchService');
const economy = require('../../services/community/economyService');
const { ValidationError } = require('../../utils/errors');
const { formatDate } = require('../../utils/format');

/** Parse a lineup string: "userID:kills:deaths,userID:kills:deaths". */
function parseLineup(input) {
  if (!input) return [];
  const players = [];
  const seen = new Set();
  for (const part of String(input).split(',')) {
    const bits = part.split(':').map((s) => s.trim());
    if (bits.length < 2 || !/^\d{15,21}$/.test(bits[0])) {
      throw new ValidationError(
        'Lineup format: `userId:kills:deaths,userId:kills:deaths` with valid Discord IDs. Example: `123456789012345678:10:5`',
      );
    }
    const userId = bits[0];
    if (seen.has(userId)) continue;
    seen.add(userId);
    const kills = Math.max(0, Math.min(999, Number(bits[1]) || 0));
    const deaths = Math.max(0, Math.min(999, Number(bits[2]) || 0));
    players.push({ userId, kills, deaths });
  }
  return players;
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName('match')
    .setDescription('FGx match results.')
    .addSubcommand((s) =>
      s
        .setName('result')
        .setDescription('Record an official match result (staff)')
        .addStringOption((o) => o.setName('opponent').setDescription('Opponent').setRequired(true))
        .addIntegerOption((o) => o.setName('our_score').setDescription('FGx score').setMinValue(0).setRequired(true))
        .addIntegerOption((o) => o.setName('opp_score').setDescription('Opponent score').setMinValue(0).setRequired(true))
        .addStringOption((o) => o.setName('lineup').setDescription('Lineup: userId:kills:deaths,userId:kills:deaths'))
        .addStringOption((o) => o.setName('notes').setDescription('Notes (use "[clan war]" or "[tournament]" to tag)').setMaxLength(500)),
    )
    .addSubcommand((s) => s.setName('list').setDescription('Recent match results')),
  async execute(interaction) {
    const sub = interaction.options.getSubcommand();

    if (sub === 'list') {
      const list = matchesRepo.list(interaction.guild.id, 15);
      const embed = new EmbedBuilder()
        .setColor(BRAND.colors.primary)
        .setTitle('FGx Recent Matches')
        .setDescription(
          list.length === 0
            ? 'No matches recorded yet.'
            : list
                .map(
                  (m) =>
                    `**${formatDate(new Date(m.played_at + (m.played_at.endsWith('Z') ? '' : 'Z')))}** — vs ${m.opponent} ` +
                    `**${m.our_score}–${m.opp_score}** (${m.winner === 'fgx' ? 'W' : m.winner === 'opponent' ? 'L' : 'D'})`,
                )
                .join('\n'),
        )
        .setFooter({ text: BRAND.footer });
      return interaction.reply({ embeds: [embed] });
    }

    // Staff-only.
    const config = guildConfigRepo.get(interaction.guild.id);
    rosterService.requireStaff(interaction.member, config);

    const opponent = interaction.options.getString('opponent', true);
    const ourScore = interaction.options.getInteger('our_score', true);
    const oppScore = interaction.options.getInteger('opp_score', true);
    const lineup = parseLineup(interaction.options.getString('lineup'));
    const notes = interaction.options.getString('notes');

    const { match, updates, coins } = await matchService.recordMatch(interaction.client, interaction.guild, {
      opponent,
      ourScore,
      oppScore,
      players: lineup,
      notes,
      recordedBy: interaction.user,
    });

    const unlocked = updates.flatMap((u) => u.unlocked.map((a) => `<@${u.userId}> — ${a.icon} ${a.name}`));
    const coinLine =
      coins.rewarded > 0
        ? `\n**Coin reward:** 💰 ${economy.format(coins.totalPaid)} paid out (${economy.format(coins.amount)} × ${coins.rewarded} players)`
        : '';

    const embed = new EmbedBuilder()
      .setColor(BRAND.colors.success)
      .setTitle(`Match recorded — vs ${opponent}`)
      .setDescription(
        `**Score:** ${ourScore}–${oppScore} (**${match.winner === 'fgx' ? 'WIN' : match.winner === 'opponent' ? 'LOSS' : 'DRAW'}**)\n` +
          `**Players recorded:** ${updates.length}\n` +
          `**Match ID:** ${match.id}` +
          `${coinLine}` +
          (unlocked.length > 0 ? `\n\n**Achievements unlocked:**\n${unlocked.join('\n')}` : ''),
      )
      .setFooter({ text: `${BRAND.footer} • Staff-recorded official stats` });

    await interaction.reply({ embeds: [embed] });
  },
};
