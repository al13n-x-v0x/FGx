'use strict';

/*
 * Copyright © 2026 FGx.
 * All rights reserved.
 */

const { SlashCommandBuilder } = require('discord.js');
const { BRAND } = require('../../config/constants');
const economy = require('../../services/community/economyService');

/**
 * /fgxcoin — FGx economy (OwO-style).
 * wallet: balance + lifetime earned.  daily/weekly: claim rewards.
 * transfer: send FGx (5% tax).  gamble: 50/50 double-or-nothing.
 */

module.exports = {
  data: new SlashCommandBuilder()
    .setName('fgxcoin')
    .setDescription('FGx economy — earn, transfer and gamble FGx coins.')
    .addSubcommand((s) =>
      s
        .setName('wallet')
        .setDescription('Show your (or a member\'s) FGx balance')
        .addUserOption((o) => o.setName('user').setDescription('Member (default: you)').setRequired(false)),
    )
    .addSubcommand((s) => s.setName('daily').setDescription('Claim your daily FGx reward (streak bonus!)'))
    .addSubcommand((s) => s.setName('weekly').setDescription('Claim your weekly FGx reward'))
    .addSubcommand((s) =>
      s
        .setName('transfer')
        .setDescription('Send FGx to another member (5% tax)')
        .addUserOption((o) => o.setName('user').setDescription('Recipient').setRequired(true))
        .addIntegerOption((o) => o.setName('amount').setDescription('Amount of FGx').setMinValue(1).setRequired(true)),
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
      const rank = economyRepoRank(guildId, target.id);
      const embed = {
        color: BRAND.colors.primary,
        title: `💰 FGx Wallet — ${target.username}`,
        description:
          `**Balance:** ${economy.format(row.balance ?? 0)}\\n` +
          `**Lifetime earned:** ${economy.format(row.lifetime ?? 0)}\\n` +
          `**Daily streak:** ${row.daily_streak ?? 0} day${(row.daily_streak ?? 0) === 1 ? '' : 's'}\\n` +
          `**Rank:** #${rank}`,
        footer: { text: `${BRAND.footer} • Earn with /fgxcoin daily` },
      };
      return interaction.reply({ embeds: [embed] });
    }

    if (sub === 'daily' || sub === 'weekly') {
      try {
        const result = await economy[sub](guildId, userId);
        const embed = {
          color: BRAND.colors.success,
          title: sub === 'daily' ? '📆 Daily reward claimed' : '🗓️ Weekly reward claimed',
          description:
            `You received **${economy.format(result.amount)}**.\\n\\n` +
            `**New balance:** ${economy.format(result.balance)}` +
            (sub === 'daily' && result.streak > 1 ? `\\n**Streak:** ${result.streak} days (+${(result.streak - 1) * 25} bonus)` : ''),
          footer: { text: BRAND.footer },
        };
        return interaction.reply({ embeds: [embed] });
      } catch (err) {
        if (err.code === 'ALREADY_CLAIMED') {
          return interaction.reply({
            embeds: [{ color: BRAND.colors.warn, title: 'Already claimed', description: err.message, footer: { text: BRAND.footer } }],
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
        const embed = {
          color: BRAND.colors.success,
          title: '💸 FGx transferred',
          description:
            `Sent **${economy.format(result.received)}** to **${target.username}** (${economy.format(result.tax)} tax).\\n` +
            `**Your balance:** ${economy.format(result.balance)}`,
          footer: { text: `${BRAND.footer} • 5% transfer tax` },
        };
        return interaction.editReply({ embeds: [embed] });
      } catch (err) {
        if (['INVALID_AMOUNT', 'SELF_TRANSFER', 'INSUFFICIENT'].includes(err.code)) {
          return interaction.editReply({
            embeds: [{ color: BRAND.colors.warn, title: 'Transfer failed', description: err.message, footer: { text: BRAND.footer } }],
          });
        }
        throw err;
      }
    }

    // gamble
    const amount = interaction.options.getInteger('amount', true);
    try {
      const result = await economy.gamble(guildId, userId, amount);
      const embed = {
        color: result.won ? BRAND.colors.success : BRAND.colors.danger,
        title: result.won ? '🟢 You won the coinflip!' : '🔴 You lost the coinflip',
        description: result.won
          ? `**+${economy.format(result.amount)}** — new balance **${economy.format(result.balance)}**.`
          : `**-${economy.format(result.amount)}** — new balance **${economy.format(result.balance)}**.`,
        footer: { text: `${BRAND.footer} • 50/50 odds` },
      };
      return interaction.reply({ embeds: [embed] });
    } catch (err) {
      if (['INVALID_AMOUNT', 'RATE_LIMITED'].includes(err.code)) {
        return interaction.reply({
          embeds: [{ color: BRAND.colors.warn, title: 'Gamble rejected', description: err.message, footer: { text: BRAND.footer } }],
          ephemeral: true,
        });
      }
      throw err;
    }
  },
};

/** Rank lookup with a fresh-account fallback. */
function economyRepoRank(guildId, userId) {
  try {
    return require('../../database/repos/economy').economyRepo.rank(guildId, userId);
  } catch {
    return 1;
  }
}
