'use strict';

/*
 * Copyright © 2026 FGx.
 * All rights reserved.
 */

const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { BRAND, STAT_SOURCES } = require('../../config/constants');
const { profilesRepo, linksRepo, achievementsRepo } = require('../../database/repos/profiles');
const { kdRatio, winRate, ratingTierIcon, formatDate } = require('../../utils/format');

function profileEmbed(guild, user, profile, link) {
  const kd = kdRatio(profile.kills ?? 0, profile.deaths ?? 0);
  const meta = safeParse(profile.meta, {});
  const achievements = achievementsRepo.list(guild.id, user.id).length;

  const embed = new EmbedBuilder()
    .setColor(BRAND.colors.primary)
    .setAuthor({ name: user.username, iconURL: user.displayAvatarURL?.() ?? undefined })
    .setTitle('FGx Player Profile')
    .setDescription(
      `**Clan rank:** ${profile.clan_rank ?? 'Recruit'}\n` +
        `**BloxStrike:** ${link ? `${link.blox_username} (${link.status === 'verified' ? '✅ verified' : '⏳ unverified'})` : 'Not linked — use `/link`'}\n` +
        `**Joined FGx:** ${profile.join_date ? formatDate(new Date(profile.join_date)) : '—'}\n` +
        (meta.inactive ? '**Status:** ⚪ Inactive\n' : ''),
    )
    .addFields(
      { name: 'Record', value: `${profile.wins ?? 0}W / ${profile.losses ?? 0}L`, inline: true },
      { name: 'Matches', value: String(profile.matches ?? 0), inline: true },
      { name: 'Win rate', value: winRate(profile.wins ?? 0, profile.matches ?? 0), inline: true },
      { name: 'Kills', value: String(profile.kills ?? 0), inline: true },
      { name: 'Deaths', value: String(profile.deaths ?? 0), inline: true },
      { name: 'K/D', value: kd, inline: true },
      { name: 'Current streak', value: `🔥 ${profile.current_streak ?? 0}`, inline: true },
      { name: 'Best streak', value: String(profile.best_streak ?? 0), inline: true },
      { name: 'Achievements', value: String(achievements), inline: true },
    )
    .setFooter({ text: `${BRAND.footer} • FGx Competitive Rating: ${ratingTierIcon(profile.rating ?? 0)}` });

  // Anti-fake-stats transparency.
  const source = profile.stats_source ?? STAT_SOURCES.UNVERIFIED;
  const note =
    source === 'staff'
      ? 'Stats are FGx-recorded (staff-verified match data).'
      : 'No official FGx match data recorded yet. Stats shown are FGx-recorded only when available.';
  embed.setDescription(`${embed.data.description}\n\n_${note}_`);

  return embed;
}

function safeParse(value, fallback) {
  try {
    return JSON.parse(value);
  } catch {
    return fallback;
  }
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName('profile')
    .setDescription('View an FGx player profile.')
    .addUserOption((o) => o.setName('user').setDescription('Member (default: you)')),
  async execute(interaction) {
    const target = interaction.options.getUser('user') ?? interaction.user;
    const profile = profilesRepo.ensure(interaction.guild.id, target.id);
    const link = linksRepo.get(interaction.guild.id, target.id);
    const embed = profileEmbed(interaction.guild, target, profile, link);
    await interaction.reply({ embeds: [embed] });
  },
  profileEmbed,
};
