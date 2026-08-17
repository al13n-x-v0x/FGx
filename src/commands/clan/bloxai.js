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

/**
 * /bloxai — BloxStrike-focused assistant.
 * Uses the guild system prompt plus strict competitive guardrails:
 * it never invents match results, stats, rankings, or BloxStrike facts.
 */
module.exports = {
  data: new SlashCommandBuilder()
    .setName('bloxai')
    .setDescription('Ask the FGx BloxStrike assistant about the clan, tryouts, scrims, and more.')
    .addStringOption((o) => o.setName('question').setDescription('Your question').setRequired(true).setMaxLength(2000)),
  async execute(interaction) {
    const question = boundedString(interaction.options.getString('question', true), { max: 2000, label: 'question' });

    const bloxGuard =
      'You are answering as the BloxStrike competitive assistant for FGx. ' +
      'Never invent match results, player statistics, rankings, clan-war history, or BloxStrike facts. ' +
      'Only reference data provided in the verified FGx context. Otherwise answer: "I don\'t have verified data for that."';

    await interaction.deferReply();

    try {
      const reply = await ask(interaction.client, interaction.guild, interaction.user.id, question, {
        extraSystem: bloxGuard,
      });
      const embed = new EmbedBuilder()
        .setColor(BRAND.colors.primary)
        .setAuthor({ name: 'FGx BloxStrike Assistant', iconURL: interaction.client.user.displayAvatarURL() })
        .setDescription(reply)
        .setFooter({ text: `${BRAND.footer} • FGx-recorded data only` });
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
