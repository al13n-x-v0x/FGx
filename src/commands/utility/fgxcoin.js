'use strict';

/*
 * Copyright © 2026 FGx.
 * All rights reserved.
 */

const { SlashCommandBuilder } = require('discord.js');
const economy = require('../../services/community/economyService');
const views = require('../../services/community/economyViews');
const { economyRepo } = require('../../database/repos/economy');

/**
 * /fgxcoin — FGx economy (OwO-style).
 * wallet: balance + lifetime earned.  daily/weekly: claim rewards.
 * transfer: send ₣Ԡ🇽 (5% tax).  gamble: 50/50 double-or-nothing.
 * Same logic is available in chat: `fgx daily`, `fgx coinflip 50`, …
 */

module.exports = {
  data: new SlashCommandBuilder()
    .setName('fgxcoin')
    .setDescription('FGx economy — earn, transfer and gamble ₣Ԡ🇽 coins.')
    .addSubcommand((s) =>
      s
        .setName('wallet')
        .setDescription('Show your (or a member\'s) ₣Ԡ🇽 balance')
        .addUserOption((o) => o.setName('user').setDescription('Member (default: you)').setRequired(false)),
    )
    .addSubcommand((s) => s.setName('daily').setDescription('Claim your daily ₣Ԡ🇽 reward (streak bonus!)'))
    .addSubcommand((s) => s.setName('weekly').setDescription('Claim your weekly ₣Ԡ🇽 reward'))
    .addSubcommand((s) =>
      s
        .setName('transfer')
        .setDescription('Send ₣Ԡ🇽 to another member (5% tax)')
        .addUserOption((o) => o.setName('user').setDescription('Recipient').setRequired(true))
        .addIntegerOption((o) => o.setName('amount').setDescription('Amount of ₣Ԡ🇽').setMinValue(1).setRequired(true)),
    )
    .addSubcommand((s) =>
      s
        .setName('gamble')
        .setDescription('50/50 coinflip — double it or lose it')
        .addIntegerOption((o) => o.setName('amount').setDescription('Amount to gamble').setMinValue(1).setRequired(true)),
    ),
  async execute(interaction) {
    const sub = interaction.options.getSubcommand();
    const userId = interaction.user.id;
    const guildId = interaction.guild.id;

    if (sub === 'wallet') {
      const target = interaction.options.getUser('user') ?? interaction.user;
      const row = economy.balance(guildId, target.id);
      const rank = economyRepo.rank(guildId, target.id);
      return interaction.reply({ embeds: [views.walletEmbed(target, row, rank)] });
    }

    if (sub === 'daily' || sub === 'weekly') {
      try {
        const result = await economy[sub](guildId, userId);
        return interaction.reply({ embeds: [views.claimEmbed(sub, result)] });
      } catch (err) {
        if (err.code === 'ALREADY_CLAIMED') {
          return interaction.reply({
            embeds: [views.warnEmbed('Already claimed', err.message)],
            ephemeral: true,
          });
        }
        throw err;
      }
    }

    if (sub === 'transfer') {
      const target = interaction.options.getUser('user', true);
      const amount = interaction.options.getInteger('amount', true);
      await interaction.deferReply({ ephemeral: true });
      try {
        const result = await economy.transfer(guildId, userId, target.id, amount);
        return interaction.editReply({ embeds: [views.transferEmbed(target, result)] });
      } catch (err) {
        if (['INVALID_AMOUNT', 'SELF_TRANSFER', 'INSUFFICIENT'].includes(err.code)) {
          return interaction.editReply({
            embeds: [views.warnEmbed('Transfer failed', err.message)],
          });
        }
        throw err;
      }
    }

    // gamble
    const amount = interaction.options.getInteger('amount', true);
    try {
      const result = await economy.gamble(guildId, userId, amount);
      return interaction.reply({ embeds: [views.gambleEmbed(result)] });
    } catch (err) {
      if (['INVALID_AMOUNT', 'RATE_LIMITED'].includes(err.code)) {
        return interaction.reply({
          embeds: [views.warnEmbed('Gamble rejected', err.message)],
          ephemeral: true,
        });
      }
      throw err;
    }
  },
};
