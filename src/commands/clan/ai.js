'use strict';

/*
 * Copyright © 2026 FGx.
 * All rights reserved.
 */

const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { BRAND } = require('../../config/constants');
const { ask } = require('../../services/ai/assistant');
const { AIUnavailableError } = require('../../services/ai/client');
const { boundedString } = require('../../utils/validate');

/** /ai — alias of /ask. */
module.exports = {
  data: new SlashCommandBuilder()
    .setName('ai')
    .setDescription('Ask the FGx AI assistant a question (alias of /ask).')
    .addStringOption((o) => o.setName('question').setDescription('Your question').setRequired(true).setMaxLength(2000)),
  async execute(interaction) {
    const question = boundedString(interaction.options.getString('question', true), { max: 2000, label: 'question' });
    await interaction.deferReply();
    try {
      const reply = await ask(interaction.client, interaction.guild, interaction.user.id, question);
      const embed = new EmbedBuilder()
        .setColor(BRAND.colors.primary)
        .setAuthor({ name: 'FGx Assistant', iconURL: interaction.client.user.displayAvatarURL() })
        .setDescription(reply)
        .setFooter({ text: BRAND.footer });
      await interaction.editReply({ embeds: [embed] });
    } catch (err) {
      if (err instanceof AIUnavailableError) {
        return interaction.editReply({
          embeds: [
            {
              color: BRAND.colors.danger,
              title: 'AI unavailable',
              description:
                'The AI assistant is not configured or the provider is unreachable.\nSet `AI_API_KEY`, `GROQ_API_KEY`, or `GEMINI_API_KEY` in the environment to enable it.',
            },
          ],
        });
      }
      throw err;
    }
  },
};
