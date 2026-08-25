'use strict';

/* Copyright © 2026 FGx. All rights reserved. */

const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const { BRAND } = require('../../config/constants');

const CHOICES = {
  rock: { emoji: '🪨', name: 'Rock', beats: 'scissors' },
  paper: { emoji: '📄', name: 'Paper', beats: 'rock' },
  scissors: { emoji: '✂️', name: 'Scissors', beats: 'paper' },
};

const MESSAGES = {
  win: ['You actually won? impressive.', 'Lucky shot, I\'ll give you that.', 'OK fine, you win this one.', 'GG, you got me.'],
  lose: ['Too slow, too weak.', 'Better luck next time.', 'EZ.', 'GG, try harder next time.'],
  tie: ['We think alike... or equally bad.', 'A tie? Boring.', 'Great minds think alike.'],
};

const RESULT_TEXT = { win: '🏆 **You Win!**', lose: '💀 **You Lose!**', tie: '🤝 **Tie!**' };
const RESULT_COLORS = { win: BRAND.colors.success, lose: BRAND.colors.danger, tie: BRAND.colors.warn };

function pick(arr) { return arr[Math.floor(Math.random() * arr.length)]; }

function playRps(userChoice) {
  const botChoice = Object.keys(CHOICES)[Math.floor(Math.random() * 3)];
  const result = userChoice === botChoice ? 'tie' : CHOICES[userChoice].beats === botChoice ? 'win' : 'lose';
  return { result, botChoice };
}

function buildEmbed(userChoice, botChoice, result) {
  return new EmbedBuilder()
    .setColor(RESULT_COLORS[result])
    .setTitle('✊ Rock Paper Scissors')
    .setDescription(RESULT_TEXT[result])
    .addFields(
      { name: 'You', value: `${CHOICES[userChoice].emoji} **${CHOICES[userChoice].name}**`, inline: true },
      { name: 'vs', value: '⚡', inline: true },
      { name: 'Bot', value: `${CHOICES[botChoice].emoji} **${CHOICES[botChoice].name}**`, inline: true },
    )
    .setFooter({ text: pick(MESSAGES[result]) })
    .setTimestamp(new Date());
}

function buildRow() {
  return new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId('rps:rock').setStyle(ButtonStyle.Secondary).setEmoji('🪨').setLabel('Rock'),
    new ButtonBuilder().setCustomId('rps:paper').setStyle(ButtonStyle.Secondary).setEmoji('📄').setLabel('Paper'),
    new ButtonBuilder().setCustomId('rps:scissors').setStyle(ButtonStyle.Secondary).setEmoji('✂️').setLabel('Scissors'),
  );
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName('rps')
    .setDescription('Play Rock Paper Scissors against the bot!')
    .addStringOption((o) =>
      o.setName('choice').setDescription('Your choice').setRequired(true)
        .addChoices(
          { name: '🪨 Rock', value: 'rock' },
          { name: '📄 Paper', value: 'paper' },
          { name: '✂️ Scissors', value: 'scissors' },
        ),
    ),

  async execute(interaction) {
    const { result, botChoice } = playRps(interaction.options.getString('choice'));
    await interaction.reply({ embeds: [buildEmbed(interaction.options.getString('choice'), botChoice, result)], components: [buildRow()] });
  },

  async handleButton(interaction) {
    const userChoice = interaction.customId.split(':')[1];
    const { result, botChoice } = playRps(userChoice);
    await interaction.update({ embeds: [buildEmbed(userChoice, botChoice, result)], components: [buildRow()] });
  },
};
