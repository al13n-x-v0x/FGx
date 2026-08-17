'use strict';

/*
 * Copyright © 2026 FGx.
 * All rights reserved.
 */

const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { BRAND } = require('../../config/constants');
const { scrimsRepo, eventsRepo } = require('../../database/repos/competitive');
const shuffleService = require('../../services/clan/shuffleService');
const { ValidationError } = require('../../utils/errors');

function teamsEmbed(source, teams) {
  const embed = new EmbedBuilder()
    .setColor(BRAND.colors.primary)
    .setTitle('⚔️ FGx TEAM SHUFFLE')
    .setDescription(
      teams
        .map(
          (team, i) =>
            `**Team ${i + 1}** (${team.length})\n${team.map((id) => `<@${id}>`).join(' ')}`,
        )
        .join('\n\n'),
    )
    .setFooter({ text: `${BRAND.footer} • ${source} • Randomly generated` });
  return embed;
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName('shuffle')
    .setDescription('Randomly split players into even teams.')
    .addSubcommand((s) =>
      s
        .setName('players')
        .setDescription('Shuffle an arbitrary list of players (mentions or IDs)')
        .addStringOption((o) => o.setName('players').setDescription('Mentions or IDs, space/comma separated').setRequired(true))
        .addIntegerOption((o) => o.setName('team_size').setDescription('Players per team (default 5)').setMinValue(1).setMaxValue(50))
        .addIntegerOption((o) => o.setName('team_count').setDescription('Number of teams (used when team_size is unset)').setMinValue(1).setMaxValue(50)),
    )
    .addSubcommand((s) =>
      s
        .setName('scrim')
        .setDescription('Shuffle a scrim roster into teams')
        .addIntegerOption((o) => o.setName('id').setDescription('Scrim ID').setRequired(true))
        .addIntegerOption((o) => o.setName('team_size').setDescription('Players per team (default: from format, e.g. 5v5)').setMinValue(1).setMaxValue(50)),
    )
    .addSubcommand((s) =>
      s
        .setName('event')
        .setDescription('Shuffle an event participant list into teams')
        .addIntegerOption((o) => o.setName('id').setDescription('Event ID').setRequired(true))
        .addIntegerOption((o) => o.setName('team_size').setDescription('Players per team (default 5)').setMinValue(1).setMaxValue(50)),
    ),
  async execute(interaction) {
    const sub = interaction.options.getSubcommand();
    let players = [];
    let source = 'FGx';
    let formatSize = null;

    if (sub === 'players') {
      players = shuffleService.parsePlayerList(interaction.options.getString('players', true));
      source = 'Custom list';
    } else if (sub === 'scrim') {
      const scrim = scrimsRepo.get(interaction.options.getInteger('id', true));
      if (!scrim || String(scrim.guild_id) !== String(interaction.guild.id)) {
        throw new ValidationError('Scrim not found in this server.');
      }
      players = scrimsRepo.players(scrim.id);
      source = `Scrim vs ${scrim.opponent}`;
      formatSize = shuffleService.teamSizeFromFormat(scrim.format);
    } else if (sub === 'event') {
      const event = eventsRepo.get(interaction.options.getInteger('id', true));
      if (!event || String(event.guild_id) !== String(interaction.guild.id)) {
        throw new ValidationError('Event not found in this server.');
      }
      players = eventsRepo.participants(event.id);
      source = `Event: ${event.title}`;
    }

    if (players.length < 2) {
      throw new ValidationError('At least 2 players are needed to shuffle. Sign-ups can be added with the Join button.');
    }

    const explicitSize = interaction.options.getInteger('team_size') ?? null;
    const teamSize = explicitSize ?? formatSize;
    const teamCount = interaction.options.getInteger('team_count') ?? null;

    let teams;
    try {
      teams = shuffleService.shuffleTeams(players, { teamSize, teamCount });
    } catch (err) {
      if (err.code === 'TOO_FEW') throw new ValidationError(err.message);
      throw err;
    }

    await interaction.reply({ embeds: [teamsEmbed(source, teams)] });
  },
  teamsEmbed,
};
