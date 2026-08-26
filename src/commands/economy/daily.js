'use strict';

/* Copyright © 2026 FGx. All rights reserved. */

const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { BRAND } = require('../../config/constants');
const economy = require('../../services/community/economyService');
const { getGif } = require('../../utils/gifLibrary');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('daily')
    .setDescription('Claim your daily FGx coin reward (streak bonus!)'),

  async execute(interaction) {
    const { guildId, user } = interaction;
    if (!guildId) return interaction.reply({ content: '⚠️ Use this in a server!', ephemeral: true });

    let result;
    try {
      result = await economy.daily(guildId, user.id);
    } catch (err) {
      if (err.code === 'ALREADY_CLAIMED') {
        return interaction.reply({ content: `⏰ ${err.message}`, ephemeral: true });
      }
      throw err;
    }

    const { amount, streak, balance } = result;
    const streakBonus = streak > 1 ? `\n🔥 **Streak:** ${streak} days!` : '';
    const gifUrl = getGif('celebrate');

    const embed = new EmbedBuilder()
      .setColor(BRAND.colors.primary)
      .setTitle('💰 Daily Reward Claimed!')
      .setDescription(
        `**+${amount.toLocaleString()}** ${BRAND.currency}\n` +
        streakBonus +
        `\n\n💰 **Balance:** ${balance.toLocaleString()} ${BRAND.currency}`
      )
      .setFooter({ text: `${BRAND.footer} • Come back tomorrow!` })
      .setTimestamp();

    if (gifUrl) embed.setImage(gifUrl);

    await interaction.reply({ embeds: [embed] });
  },
};
