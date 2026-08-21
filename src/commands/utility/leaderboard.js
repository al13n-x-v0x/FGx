'use strict';

/* Copyright © 2026 FGx. All rights reserved. */

const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { BRAND } = require('../../config/constants');
const { profilesRepo } = require('../../database/repos/profiles');
const { economyRepo } = require('../../database/repos/economy');
const { socialRepo } = require('../../database/repos/social');
const { paginate } = require('../../utils/pagination');
const { kdRatio, ratingTierIcon } = require('../../utils/format');

const SOCIAL_KINDS = ['slap', 'hug', 'kiss', 'pat', 'punch', 'poke', 'dance', 'highfive', 'bite'];

const CATEGORIES = {
  rating: { label: '🏆 Rating', field: 'rating' },
  kills: { label: '⚔️ Kills', field: 'kills' },
  kd: { label: '💀 K/D', field: 'kd' },
  streak: { label: '🔥 Win Streak', field: 'streak' },
  wins: { label: '🏅 Wins', field: 'wins' },
  matches: { label: '🎯 Matches', field: 'matches' },
  coins: { label: '💰 FGx Coins', field: 'coins' },
  social: { label: '🤝 Social Score', field: 'social' },
  slaps: { label: '👋 Top Slappers', field: 'slap' },
  hugs: { label: '🫂 Top Huggers', field: 'hug' },
  kisses: { label: '💋 Top Kissers', field: 'kiss' },
  pats: { label: '🤗 Top Patters', field: 'pat' },
  punches: { label: '👊 Top Punchers', field: 'punch' },
};

function formatLine(category, row, index) {
  const medal = index < 3 ? ['🥇', '🥈', '🥉'][index] : `**${index + 1}**`;
  switch (category) {
    case 'rating':
      return `${medal} <@${row.user_id}> — ${row.rating} ${ratingTierIcon(row.rating)}`;
    case 'kills':
      return `${medal} <@${row.user_id}> — ${row.kills} kills`;
    case 'kd':
      return `${medal} <@${row.user_id}> — ${kdRatio(row.kills ?? 0, row.deaths ?? 0)} K/D`;
    case 'streak':
      return `${medal} <@${row.user_id}> — 🔥 ${row.current_streak} win streak`;
    case 'wins':
      return `${medal} <@${row.user_id}> — ${row.wins} wins`;
    case 'matches':
      return `${medal} <@${row.user_id}> — ${row.matches} matches`;
    case 'coins':
      return `${medal} <@${row.user_id}> — 💰 ${(row.balance ?? 0).toLocaleString('en-US')} ₣ԠＸ`;
    case 'social':
      return `${medal} <@${row.actor_id ?? row.user_id}> — 🤝 ${row.total ?? row.count ?? 0} interactions`;
    default:
      if (SOCIAL_KINDS.includes(category)) {
        return `${medal} <@${row.actor_id}> — ${row.total} ${category}s`;
      }
      return '';
  }
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName('leaderboard')
    .setDescription('FGx competitive and social leaderboards.')
    .addStringOption((o) =>
      o
        .setName('category')
        .setDescription('Leaderboard category')
        .setRequired(true)
        .addChoices(...Object.entries(CATEGORIES).map(([value, c]) => ({ name: c.label, value }))),
    ),
  async execute(interaction) {
    const category = interaction.options.getString('category', true);
    let rows;

    if (SOCIAL_KINDS.includes(category)) {
      rows = socialRepo.top(interaction.guild.id, category, 100);
    } else if (category === 'coins') {
      rows = economyRepo.leaderboard(interaction.guild.id, 100);
    } else {
      rows = profilesRepo.leaderboard(interaction.guild.id, category, 100);
    }

    const perPage = 10;
    const pages = [];
    for (let i = 0; i < rows.length; i += perPage) {
      const slice = rows.slice(i, i + perPage);
      const embed = new EmbedBuilder()
        .setColor(BRAND.colors.primary)
        .setTitle(`${CATEGORIES[category].label} — FGx Leaderboard`)
        .setDescription(
          slice.length > 0
            ? slice.map((row, j) => formatLine(category, row, i + j)).join('\n')
            : 'No data yet. Be the first!',
        )
        .setFooter({ text: BRAND.footer });
      pages.push(embed);
    }

    if (pages.length === 0) {
      pages.push(
        new EmbedBuilder()
          .setColor(BRAND.colors.primary)
          .setTitle(`${CATEGORIES[category].label} — FGx Leaderboard`)
          .setDescription('No data yet. Start interacting!')
          .setFooter({ text: BRAND.footer }),
      );
    }

    await paginate(interaction, pages, { customIdPrefix: 'lb' });
  },
};
