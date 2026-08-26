'use strict';

/* Copyright © 2026 FGx. All rights reserved. */

const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { BRAND } = require('../../config/constants');
const { quickAI } = require('../../services/ai/quick');

const CLASSIC_ANSWERS = [
  { text: 'It is certain.', color: 0x00ff00 },
  { text: 'It is decidedly so.', color: 0x00ff00 },
  { text: 'Without a doubt.', color: 0x00ff00 },
  { text: 'Yes, definitely.', color: 0x00ff00 },
  { text: 'You may rely on it.', color: 0x00ff00 },
  { text: 'As I see it, yes.', color: 0x00ff00 },
  { text: 'Most likely.', color: 0x00ff00 },
  { text: 'Outlook good.', color: 0x00ff00 },
  { text: 'Yes.', color: 0x00ff00 },
  { text: 'Signs point to yes.', color: 0x00ff00 },
  { text: 'Reply hazy, try again.', color: 0xffff00 },
  { text: 'Ask again later.', color: 0xffff00 },
  { text: 'Better not tell you now.', color: 0xffff00 },
  { text: 'Cannot predict now.', color: 0xffff00 },
  { text: 'Concentrate and ask again.', color: 0xffff00 },
  { text: 'Don\'t count on it.', color: 0xff0000 },
  { text: 'My reply is no.', color: 0xff0000 },
  { text: 'My sources say no.', color: 0xff0000 },
  { text: 'Outlook not so good.', color: 0xff0000 },
  { text: 'Very doubtful.', color: 0xff0000 },
];

module.exports = {
  data: new SlashCommandBuilder()
    .setName('8ball')
    .setDescription('Ask the magic 8-ball a question 🔮')
    .addStringOption((o) =>
      o.setName('question').setDescription('Your question for the 8-ball').setRequired(true),
    ),

  async execute(interaction) {
    const question = interaction.options.getString('question');

    // Try AI first for unique answers
    let answer;
    let color;
    try {
      const aiAnswer = await quickAI(
        'You are a magic 8-ball. Answer the user question with a short, fun response. Pick one of these vibes: positive, negative, or maybe. Keep it to one sentence max. Be dramatic and entertaining.',
        `Question: ${question}`,
        { temperature: 0.95, maxTokens: 50 },
      );
      if (aiAnswer) {
        const lower = aiAnswer.toLowerCase();
        color = lower.includes('yes') || lower.includes('certain') || lower.includes('definitely')
          ? 0x00ff00
          : lower.includes('no') || lower.includes('doubt') || lower.includes('not')
            ? 0xff0000
            : 0xffff00;
        answer = aiAnswer;
      }
    } catch {}

    if (!answer) {
      const classic = CLASSIC_ANSWERS[Math.floor(Math.random() * CLASSIC_ANSWERS.length)];
      answer = classic.text;
      color = classic.color;
    }

    const embed = new EmbedBuilder()
      .setColor(color)
      .setTitle('🎱 Magic 8-Ball')
      .addFields(
        { name: '❓ Question', value: question, inline: false },
        { name: '🔮 Answer', value: `*${answer}*`, inline: false },
      )
      .setThumbnail('https://upload.wikimedia.org/wikipedia/commons/thumb/e/e0/Magic_ball_2.png/240px-Magic_ball_2.png')
      .setFooter({ text: BRAND.footer })
      .setTimestamp();

    await interaction.reply({ embeds: [embed] });
  },
};
