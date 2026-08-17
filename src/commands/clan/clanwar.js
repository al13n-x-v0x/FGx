'use strict';

/*
 * Copyright © 2026 FGx.
 * All rights reserved.
 */

const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { BRAND } = require('../../config/constants');
const { guildConfigRepo } = require('../../database/repos/guildConfig');
const { clanWarsRepo } = require('../../database/repos/competitive');
const rosterService = require('../../services/clan/rosterService');
const matchService = require('../../services/clan/matchService');
const { logAudit } = require('../../services/logging/auditLogger');
const { ValidationError } = require('../../utils/errors');
const { formatDate } = require('../../utils/format');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('clanwar')
    .setDescription('FGx clan war tracking.')
    .addSubcommand((s) =>
      s
        .setName('create')
        .setDescription('Challenge another clan (staff)')
        .addStringOption((o) => o.setName('opponent').setDescription('Opponent clan').setRequired(true))
        .addStringOption((o) => o.setName('format').setDescription('Format, e.g. 5v5').setMaxLength(40))
        .addStringOption((o) => o.setName('date').setDescription('War date, e.g. 2026-08-25')),
    )
    .addSubcommand((s) => s.setName('accept').setDescription('Accept a challenge (staff)').addIntegerOption((o) => o.setName('id').setDescription('War ID').setRequired(true)))
    .addSubcommand((s) => s.setName('decline').setDescription('Decline a challenge (staff)').addIntegerOption((o) => o.setName('id').setDescription('War ID').setRequired(true)))
    .addSubcommand((s) =>
      s
        .setName('result')
        .setDescription('Record the war result (staff)')
        .addIntegerOption((o) => o.setName('id').setDescription('War ID').setRequired(true))
        .addIntegerOption((o) => o.setName('our_score').setDescription('FGx score').setMinValue(0).setRequired(true))
        .addIntegerOption((o) => o.setName('opp_score').setDescription('Opponent score').setMinValue(0).setRequired(true))
        .addStringOption((o) => o.setName('lineup').setDescription('Lineup: userId:kills:deaths,userId:kills:deaths')),
    )
    .addSubcommand((s) => s.setName('history').setDescription('Clan war history')),
  async execute(interaction) {
    const sub = interaction.options.getSubcommand();
    const config = guildConfigRepo.get(interaction.guild.id);

    if (sub === 'history') {
      const wars = clanWarsRepo.list(interaction.guild.id, 20);
      const record = clanWarsRepo.record(interaction.guild.id);
      const embed = new EmbedBuilder()
        .setColor(BRAND.colors.primary)
        .setTitle('⚔️ FGx Clan War History')
        .setDescription(
          `Record: **${record?.wins ?? 0}W ${record?.losses ?? 0}L ${record?.draws ?? 0}D** (${record?.wars ?? 0} wars)\n\n` +
            (wars.length === 0
              ? 'No wars recorded yet.'
              : wars
                  .map(
                    (w) =>
                      `**#${w.id}** vs ${w.opponent} — ${w.status}` +
                      (w.winner ? ` — **${w.our_score}–${w.opp_score}** (${w.winner})` : '') +
                      (w.war_date ? ` • ${formatDate(new Date(w.war_date))}` : ''),
                  )
                  .join('\n')),
        )
        .setFooter({ text: BRAND.footer });
      return interaction.reply({ embeds: [embed] });
    }

    rosterService.requireStaff(interaction.member, config);

    if (sub === 'create') {
      const war = clanWarsRepo.create({
        guildId: interaction.guild.id,
        opponent: interaction.options.getString('opponent', true),
        format: interaction.options.getString('format') ?? '5v5',
        warDate: interaction.options.getString('date'),
        createdBy: interaction.user.id,
      });
      await logAudit(interaction.client, interaction.guild, {
        action: 'match',
        target: null,
        moderator: interaction.user,
        reason: `Clan war challenged vs ${war.opponent}`,
        details: { id: war.id },
      });
      return interaction.reply({
        embeds: [
          {
            color: BRAND.colors.primary,
            title: '⚔️ Clan war challenge',
            description: `**FGx vs ${war.opponent}**\nFormat: ${war.format}\nStatus: **${war.status.toUpperCase()}**\n\n` +
              `Use \`/clanwar accept ${war.id}\` or \`/clanwar decline ${war.id}\` when the opponent responds.`,
          },
        ],
      });
    }

    const id = interaction.options.getInteger('id', true);
    const war = clanWarsRepo.get(id);
    if (!war || String(war.guild_id) !== String(interaction.guild.id)) {
      throw new ValidationError('War not found in this server.');
    }

    if (sub === 'accept' || sub === 'decline') {
      const status = sub === 'accept' ? 'accepted' : 'declined';
      clanWarsRepo.update(id, { status });
      await logAudit(interaction.client, interaction.guild, {
        action: 'match',
        target: null,
        moderator: interaction.user,
        reason: `Clan war vs ${war.opponent} ${status}`,
      });
      return interaction.reply({ content: `War vs **${war.opponent}** marked as **${status}**.`, ephemeral: true });
    }

    if (sub === 'result') {
      const ourScore = interaction.options.getInteger('our_score', true);
      const oppScore = interaction.options.getInteger('opp_score', true);
      const winner = ourScore > oppScore ? 'fgx' : oppScore > ourScore ? 'opponent' : 'draw';
      clanWarsRepo.update(id, { status: 'completed', our_score: ourScore, opp_score: oppScore, winner });

      // Also record the war in the official match log (tagged) so records and
      // achievements include clan wars.
      const lineup = parseLineup(interaction.options.getString('lineup'));
      await matchService.recordMatch(interaction.client, interaction.guild, {
        opponent: war.opponent,
        ourScore,
        oppScore,
        players: lineup,
        notes: `[clan war] vs ${war.opponent}`,
        recordedBy: interaction.user,
      });

      await logAudit(interaction.client, interaction.guild, {
        action: 'match',
        target: null,
        moderator: interaction.user,
        reason: `Clan war result vs ${war.opponent}: ${ourScore}–${oppScore} (${winner})`,
      });

      return interaction.reply({
        embeds: [
          {
            color: BRAND.colors.success,
            title: 'War result recorded',
            description: `**FGx ${ourScore} – ${oppScore} ${war.opponent}**\nWinner: **${winner.toUpperCase()}**`,
          },
        ],
      });
    }
  },
};

function parseLineup(input) {
  if (!input) return [];
  const players = [];
  const seen = new Set();
  for (const part of String(input).split(',')) {
    const bits = part.split(':').map((s) => s.trim());
    if (bits.length < 2 || !/^\d{15,21}$/.test(bits[0])) continue;
    const userId = bits[0];
    if (seen.has(userId)) continue;
    seen.add(userId);
    players.push({ userId, kills: Number(bits[1]) || 0, deaths: Number(bits[2]) || 0 });
  }
  return players;
}
