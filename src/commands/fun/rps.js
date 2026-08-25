'use strict';

/* Copyright © 2026 FGx. All rights reserved. */

const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const { BRAND } = require('../../config/constants');

const CHOICES = {
  rock: { emoji: '🪨', name: 'Rock', beats: 'scissors' },
  paper: { emoji: '📄', name: 'Paper', beats: 'rock' },
  scissors: { emoji: '✂️', name: 'Scissors', beats: 'paper' },
};

const WIN_MESSAGES = [
  'You actually won? impressive.',
  'Lucky shot, I\'ll give you that.',
  'OK fine, you win this one.',
  'Skill? No. Pure luck.',
  'GG, you got me.',
];
const LOSE_MESSAGES = [
  'Too slow, too weak.',
  'Better luck next time.',
  'EZ.',
  'Was that supposed to be a challenge?',
  'GG, try harder next time.',
];
const TIE_MESSAGES = [
  'We think alike... or equally bad.',
  'A tie? Boring.',
  'Great minds think alike.',
  'Nobody wins. Just like in life.',
];

function pickRandom(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName('rps')
    .setDescription('Play Rock Paper Scissors against the bot!')
    .addStringOption((o) =>
      o
        .setName('choice')
        .setDescription('Your choice')
        .setRequired(true)
        .addChoices(
          { name: '🪨 Rock', value: 'rock' },
          { name: '📄 Paper', value: 'paper' },
          { name: '✂️ Scissors', value: 'scissors' },
        ),
    ),

  async execute(interaction) {
    const userChoice = interaction.options.getString('choice');
    const botChoice = Object.keys(CHOICES)[Math.floor(Math.random() * 3)];

    let result;
    let color;
    let message;

    if (userChoice === botChoice) {
      result = 'tie';
      color = BRAND.colors.warn;
      message = pickRandom(TIE_MESSAGES);
    } else if (CHOICES[userChoice].beats === botChoice) {
      result = 'win';
      color = BRAND.colors.success;
      message = pickRandom(WIN_MESSAGES);
    } else {
      result = 'lose';
      color = BRAND.colors.danger;
      message = pickRandom(LOSE_MESSAGES);
    }

    const resultText =
      result === 'win' ? '🏆 **You Win!**' :
      result === 'lose' ? '💀 **You Lose!**' :
      '🤝 **Tie!**';

    const embed = new EmbedBuilder()
      .setColor(color)
      .setTitle('✊ Rock Paper Scissors')
      .setDescription(resultText)
      .addFields(
        {
          name: 'You',
          value: `${CHOICES[userChoice].emoji} **${CHOICES[userChoice].name}**`,
          inline: true,
        },
        { name: 'vs', value: '⚡', inline: true },
        {
          name: 'Bot',
          value: `${CHOICES[botChoice].emoji} **${CHOICES[botChoice].name}**`,
          inline: true,
        },
      )
      .setFooter({ text: message })
      .setTimestamp(new Date());

    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId(`rps:rock`)
        .setStyle(ButtonStyle.Secondary)
        .setEmoji('🪨')
        .setLabel('Rock'),
      new ButtonBuilder()
        .setCustomId(`rps:paper`)
        .setStyle(ButtonStyle.Secondary)
        .setEmoji('📄')
        .setLabel('Paper'),
      new ButtonBuilder()
        .setCustomId(`rps:scissors`)
        .setStyle(ButtonStyle.Secondary)
        .setEmoji('✂️')
        .setLabel('Scissors'),
    );

    await interaction.reply({ embeds: [embed], components: [row] });
  },

  /** Handle button rematches */
  async handleButton(interaction) {
    const userChoice = interaction.customId.split(':')[1];
    const botChoice = Object.keys(CHOICES)[Math.floor(Math.random() * 3)];

    let result, color, message;
    if (userChoice === botChoice) {
      result = 'tie'; color = BRAND.colors.warn; message = pickRandom(TIE_MESSAGES);
    } else if (CHOICES[userChoice].beats === botChoice) {
      result = 'win'; color = BRAND.colors.success; message = pickRandom(WIN_MESSAGES);
    } else {
      result = 'lose'; color = BRAND.colors.danger; message = pickRandom(LOSE_MESSAGES);
    }

    const resultText =
      result === 'win' ? '🏆 **You Win!**' :
      result === 'lose' ? '💀 **You Lose!**' :
      '🤝 **Tie!**';

    const embed = new EmbedBuilder()
      .setColor(color)
      .setTitle('✊ Rock Paper Scissors')
      .setDescription(resultText)
      .addFields(
        { name: 'You', value: `${CHOICES[userChoice].emoji} **${CHOICES[userChoice].name}**`, inline: true },
        { name: 'vs', value: '⚡', inline: true },
        { name: 'Bot', value: `${CHOICES[botChoice].emoji} **${CHOICES[botChoice].name}**`, inline: true },
      )
      .setFooter({ text: message })
      .setTimestamp(new Date());

    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId('rps:rock').setStyle(ButtonStyle.Secondary).setEmoji('🪨').setLabel('Rock'),
      new ButtonBuilder().setCustomId('rps:paper').setStyle(ButtonStyle.Secondary).setEmoji('📄').setLabel('Paper'),
      new ButtonBuilder().setCustomId('rps:scissors').setStyle(ButtonStyle.Secondary).setEmoji('✂️').setLabel('Scissors'),
    );

    await interaction.update({ embeds: [embed], components: [row] });
  },
};
