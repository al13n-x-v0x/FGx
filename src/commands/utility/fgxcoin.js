'use strict';

/*
 * Copyright © 2026 FGx.
 * All rights reserved.
 */

const { SlashCommandBuilder } = require('discord.js');
const economy = require('../../services/community/economyService');
const views = require('../../services/community/economyViews');
const { economyRepo } = require('../../database/repos/economy');
const { paginate } = require('../../utils/pagination');

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
    )
    .addSubcommand((s) =>
      s
        .setName('history')
        .setDescription('Show your (or a member\'s) transaction history')
        .addUserOption((o) => o.setName('user').setDescription('Member (default: you)').setRequired(false))
        .addIntegerOption((o) => o.setName('limit').setDescription('How many transactions (max 1000, default 10)').setMinValue(1).setMaxValue(1000).setRequired(false)),
    )
    .addSubcommand((s) => s.setName('hunt').setDescription('Hunt animals — they join your zoo (60s cooldown)'))
    .addSubcommand((s) => s.setName('battle').setDescription('Fight an enemy — win big or lose 10% (120s cooldown)'))
    .addSubcommand((s) => s.setName('pray').setDescription('A big coin blessing (2h cooldown)'))
    .addSubcommand((s) => s.setName('crate').setDescription('Open a loot crate for a random animal + bonus coins (250 ₣Ԡ🇽)'))
    .addSubcommand((s) =>
      s
        .setName('zoo')
        .setDescription('View your collected animals')
        .addUserOption((o) => o.setName('user').setDescription('Member (default: you)').setRequired(false)),
    )
    .addSubcommand((s) =>
      s
        .setName('sell')
        .setDescription('Sell a duplicate animal for coins')
        .addStringOption((o) => o.setName('animal').setDescription('Animal id or name, e.g. fox').setRequired(true)),
    )
    .addSubcommand((s) => s.setName('work').setDescription('Do a job for coins (45s cooldown)'))
    .addSubcommand((s) => s.setName('crime').setDescription('Commit a crime — high risk, high reward (90s cooldown)'))
    .addSubcommand((s) =>
      s
        .setName('rob')
        .setDescription('Rob another member (3min cooldown)')
        .addUserOption((o) => o.setName('user').setDescription('Who to rob').setRequired(true)),
    )
    .addSubcommand((s) => s.setName('fish').setDescription('Go fishing for coins (30s cooldown)')),
  async execute(interaction) {
    const sub = interaction.options.getSubcommand();
    const userId = interaction.user.id;
    const guildId = interaction.guild.id;

    if (sub === 'history') {
      return module.exports.handleHistory(interaction);
    }

    if (sub === 'hunt' || sub === 'battle' || sub === 'pray' || sub === 'crate') {
      try {
        const result = await economy[sub](guildId, userId);
        const embed =
          sub === 'hunt'
            ? views.huntEmbed(result)
            : sub === 'battle'
              ? views.battleEmbed(result)
              : sub === 'pray'
                ? views.prayEmbed(result)
                : views.crateEmbed(result);
        return interaction.reply({ embeds: [embed] });
      } catch (err) {
        if (['INSUFFICIENT', 'HUNT_COOLDOWN', 'BATTLE_COOLDOWN', 'PRAY_COOLDOWN'].includes(err.code)) {
          return interaction.reply({ embeds: [views.warnEmbed('Minigame', err.message)], ephemeral: true });
        }
        throw err;
      }
    }

    if (sub === 'work' || sub === 'crime' || sub === 'fish') {
      try {
        const result = await economy[sub](guildId, userId);
        const embed = sub === 'work' ? views.workEmbed(result) : sub === 'crime' ? views.crimeEmbed(result) : views.fishEmbed(result);
        return interaction.reply({ embeds: [embed] });
      } catch (err) {
        if (['WORK_COOLDOWN', 'CRIME_COOLDOWN', 'FISH_COOLDOWN'].includes(err.code)) {
          return interaction.reply({ embeds: [views.warnEmbed('Cooldown', err.message)], ephemeral: true });
        }
        throw err;
      }
    }

    if (sub === 'rob') {
      const target = interaction.options.getUser('user', true);
      if (target.id === userId) {
        return interaction.reply({ embeds: [views.warnEmbed('Nope', 'You can\'t rob yourself.')], ephemeral: true });
      }
      try {
        const result = await economy.rob(guildId, userId, target.id);
        return interaction.reply({ embeds: [views.robEmbed(result)] });
      } catch (err) {
        if (['ROB_COOLDOWN', 'TARGET_POOR'].includes(err.code)) {
          return interaction.reply({ embeds: [views.warnEmbed('Rob Failed', err.message)], ephemeral: true });
        }
        throw err;
      }
    }

    if (sub === 'zoo') {
      const target = interaction.options.getUser('user') ?? interaction.user;
      const s = require('../../services/community/zooService').stats(guildId, target.id);
      const rows = require('../../services/community/zooService').collection(guildId, target.id);
      return interaction.reply({ embeds: [views.zooEmbed(target.username, s, rows)] });
    }

    if (sub === 'sell') {
      try {
        const result = require('../../services/community/zooService').sell(guildId, userId, interaction.options.getString('animal', true));
        return interaction.reply({ embeds: [views.sellEmbed(result)] });
      } catch (err) {
        if (['UNKNOWN_ANIMAL', 'NOT_OWNED'].includes(err.code)) {
          return interaction.reply({ embeds: [views.warnEmbed('Sell failed', err.message)], ephemeral: true });
        }
        throw err;
      }
    }

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

// history subcommand handler lives on module.exports for reuse.
module.exports.handleHistory = async function handleHistory(interaction) {
  const target = interaction.options.getUser('user') ?? interaction.user;
  const limit = Math.min(1000, Math.max(1, interaction.options.getInteger('limit') ?? 10));
  const rows = economyRepo.recentTx(interaction.guild.id, target.id, limit);

  const perPage = 10;
  const pages = [];
  for (let i = 0; i < rows.length; i += perPage) {
    pages.push(views.historyEmbed(target.username, rows.slice(i, i + perPage)));
  }
  if (pages.length === 0) pages.push(views.historyEmbed(target.username, []));

  await paginate(interaction, pages, { customIdPrefix: 'hx' });
};
