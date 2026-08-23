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

/** /ask — FGx community AI assistant. */
module.exports = {
  data: new SlashCommandBuilder()
    .setName('ask')
    .setDescription('Ask the FGx AI assistant about rules, the clan, events, and more.')
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
      if (err instanceof AIUnavailableError || err.message?.includes('timeout') || err.name === 'AbortError') {
        return interaction.editReply({
          embeds: [
            {
              color: BRAND.colors.danger,
              title: 'AI unavailable',
              description:
                'The AI assistant is temporarily unavailable. It might be rate-limited or the model is too slow.\n\n**Try again in a few seconds.** If this keeps happening, check that `GEMINI_MODEL` is set to `gemini-3.5-flash-lite` in Render env vars.',
            },
          ],
        });
      }
      console.error('[ask] unexpected error:', err);
      await interaction.editReply({
        embeds: [{
          color: BRAND.colors.danger,
          title: 'Something went wrong',
          description: 'The AI hit an unexpected error. Please try again.',
        }],
      });
    }
  },
};
