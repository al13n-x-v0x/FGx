'use strict';

/*
 * Copyright © 2026 FGx.
 * All rights reserved.
 */

const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { BRAND } = require('../../config/constants');
const { guildConfigRepo } = require('../../database/repos/guildConfig');
const { evaluationsRepo } = require('../../database/repos/community');
const rosterService = require('../../services/clan/rosterService');
const { logAudit } = require('../../services/logging/auditLogger');
const { integer } = require('../../utils/validate');

const METRICS = [
  ['aim', 'Aim'],
  ['movement', 'Movement'],
  ['game_sense', 'Game Sense'],
  ['mechanics', 'Mechanics'],
  ['communication', 'Communication'],
  ['teamwork', 'Teamwork'],
  ['consistency', 'Consistency'],
];

function reportEmbed(evaluation, _guild) {
  const scores = safeParse(evaluation.scores, {});
  const lines = METRICS.map(([key, label]) => `${label.padEnd(14)}${' '.repeat(2)}${scores[key] ?? 0}/10`);
  const overall = evaluation.overall ?? 0;

  const embed = new EmbedBuilder()
    .setColor(BRAND.colors.primary)
    .setTitle('FGx TRIAL REPORT')
    .setDescription(
      `━━━━━━━━━━━━━━━━\n\n` +
        `Player: <@${evaluation.player_id}>\n\n` +
        `\`\`\`\n${lines.join('\n')}\n\nOverall      ${overall.toFixed(1)}/10\n\`\`\`` +
        (evaluation.recommendation ? `**Recommendation:** ${evaluation.recommendation}\n` : '') +
        `\nEvaluated by <@${evaluation.evaluator_id}> • ${evaluation.created_at}`,
    )
    .setFooter({ text: `${BRAND.footer} • Private — staff only` });
  return embed;
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName('evaluate')
    .setDescription('Record a trial evaluation (staff).')
    .addSubcommand((s) =>
      s
        .setName('record')
        .setDescription('Record scores for a player (1-10)')
        .addUserOption((o) => o.setName('player').setDescription('Player being evaluated').setRequired(true))
        .addNumberOption((o) => o.setName('aim').setDescription('Aim (1-10)').setMinValue(1).setMaxValue(10))
        .addNumberOption((o) => o.setName('movement').setDescription('Movement (1-10)').setMinValue(1).setMaxValue(10))
        .addNumberOption((o) => o.setName('game_sense').setDescription('Game sense (1-10)').setMinValue(1).setMaxValue(10))
        .addNumberOption((o) => o.setName('mechanics').setDescription('Mechanics (1-10)').setMinValue(1).setMaxValue(10))
        .addNumberOption((o) => o.setName('communication').setDescription('Communication (1-10)').setMinValue(1).setMaxValue(10))
        .addNumberOption((o) => o.setName('teamwork').setDescription('Teamwork (1-10)').setMinValue(1).setMaxValue(10))
        .addNumberOption((o) => o.setName('consistency').setDescription('Consistency (1-10)').setMinValue(1).setMaxValue(10))
        .addStringOption((o) => o.setName('recommendation').setDescription('e.g. TRIAL → MEMBER, REJECT')),
    )
    .addSubcommand((s) =>
      s
        .setName('view')
        .setDescription('View the latest evaluation for a player (staff)')
        .addUserOption((o) => o.setName('player').setDescription('Player').setRequired(true)),
    ),
  async execute(interaction) {
    const sub = interaction.options.getSubcommand();
    const config = guildConfigRepo.get(interaction.guild.id);
    rosterService.requireStaff(interaction.member, config);

    if (sub === 'view') {
      const player = interaction.options.getUser('player', true);
      const latest = evaluationsRepo.latestFor(interaction.guild.id, player.id, 1)[0];
      if (!latest) {
        return interaction.reply({ content: 'No evaluations recorded for that player yet.', ephemeral: true });
      }
      return interaction.reply({ embeds: [reportEmbed(latest, interaction.guild)], ephemeral: true });
    }

    // record
    const player = interaction.options.getUser('player', true);
    const scores = {};
    for (const [key] of METRICS) {
      const value = interaction.options.getNumber(key);
      if (value !== null) scores[key] = integer(value, { min: 1, max: 10, label: key });
    }
    if (Object.keys(scores).length === 0) {
      return interaction.reply({ content: 'Provide at least one metric score.', ephemeral: true });
    }
    const provided = METRICS.filter(([key]) => scores[key] !== undefined).length;
    const overall = Math.round((METRICS.reduce((sum, [key]) => sum + (scores[key] ?? 0), 0) / (provided * 10)) * 10) / 10;
    const recommendation = interaction.options.getString('recommendation') ?? null;

    const id = evaluationsRepo.create(
      interaction.guild.id,
      player.id,
      interaction.user.id,
      scores,
      overall,
      recommendation,
    );
    const evaluation = { id, guild_id: interaction.guild.id, player_id: player.id, evaluator_id: interaction.user.id, scores: JSON.stringify(scores), overall, recommendation, created_at: new Date().toISOString() };

    await logAudit(interaction.client, interaction.guild, {
      action: 'tryout',
      target: player,
      moderator: interaction.user,
      reason: `Trial evaluation recorded (${overall}/10)`,
    });

    await interaction.reply({ embeds: [reportEmbed(evaluation, interaction.guild)], ephemeral: true });
  },
};

function safeParse(value, fallback) {
  try {
    return JSON.parse(value);
  } catch {
    return fallback;
  }
}
