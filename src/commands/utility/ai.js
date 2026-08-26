'use strict';

/* Copyright © 2026 FGx. All rights reserved. */

const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { BRAND } = require('../../config/constants');
const assistant = require('../../services/ai/assistant');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('ai')
    .setDescription('Ask FGx AI anything — powered by Gemini')
    .addStringOption((o) =>
      o.setName('prompt').setDescription('What do you want to ask?').setRequired(true),
    ),

  async execute(interaction) {
    const prompt = interaction.options.getString('prompt');

    await interaction.deferReply();

    try {
      const response = await assistant.chat(prompt, {
        user: interaction.user.username,
        guild: interaction.guild?.name,
      });

      const embed = new EmbedBuilder()
        .setColor(BRAND.colors.primary)
        .setTitle('🤖 FGx AI')
        .setDescription(response.length > 4000 ? response.slice(0, 4000) + '...' : response)
        .setThumbnail(interaction.user.displayAvatarURL({ size: 128 }))
        .setFooter({ text: `${BRAND.footer} • Powered by AI` })
        .setTimestamp();

      await interaction.editReply({ embeds: [embed] });
    } catch (err) {
      const content = err.safe
        ? err.message
        : '❌ AI is temporarily unavailable. Try again in a moment.';

      await interaction.editReply({
        content,
        embeds: [],
      });
    }
  },
};
