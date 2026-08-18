'use strict';

/*
 * Copyright © 2026 FGx.
 * All rights reserved.
 */

const { BRAND } = require('../../config/constants');
const economy = require('./economyService');

/**
 * Shared embed builders for the FGx economy. Used by both the /fgxcoin
 * slash command and the OwO-style chat commands (fgx daily, fgx coinflip…)
 * so the two entry points look and behave identically.
 */

function walletEmbed(target, row, rank) {
  return {
    color: BRAND.colors.primary,
    title: `💰 ₣Ԡ🇽 Wallet — ${target.username}`,
    description:
      `**Balance:** ${economy.format(row.balance ?? 0)}\n` +
      `**Lifetime earned:** ${economy.format(row.lifetime ?? 0)}\n` +
      `**Daily streak:** ${row.daily_streak ?? 0} day${(row.daily_streak ?? 0) === 1 ? '' : 's'}\n` +
      `**Rank:** #${rank}`,
    footer: { text: `${BRAND.footer} • Earn with /fgxcoin daily` },
  };
}

function claimEmbed(kind, result) {
  return {
    color: BRAND.colors.success,
    title: kind === 'daily' ? '📆 Daily reward claimed' : '🗓️ Weekly reward claimed',
    description:
      `You received **${economy.format(result.amount)}**.\n\n` +
      `**New balance:** ${economy.format(result.balance)}` +
      (kind === 'daily' && result.streak > 1 ? `\n**Streak:** ${result.streak} days (+${(result.streak - 1) * 25} bonus)` : ''),
    footer: { text: BRAND.footer },
  };
}

function transferEmbed(target, result) {
  return {
    color: BRAND.colors.success,
    title: '💸 ₣Ԡ🇽 transferred',
    description:
      `Sent **${economy.format(result.received)}** to **${target.username}** (${economy.format(result.tax)} tax).\n` +
      `**Your balance:** ${economy.format(result.balance)}`,
    footer: { text: `${BRAND.footer} • 5% transfer tax` },
  };
}

function gambleEmbed(result) {
  return {
    color: result.won ? BRAND.colors.success : BRAND.colors.danger,
    title: result.won ? '🟢 You won the coinflip!' : '🔴 You lost the coinflip',
    description: result.won
      ? `**+${economy.format(result.amount)}** — new balance **${economy.format(result.balance)}**.`
      : `**-${economy.format(result.amount)}** — new balance **${economy.format(result.balance)}**.`,
    footer: { text: `${BRAND.footer} • 50/50 odds` },
  };
}

function warnEmbed(title, description) {
  return { color: BRAND.colors.warn, title, description, footer: { text: BRAND.footer } };
}

/** Quick guide shown by `fgx` / `fgx help` in chat. */
function chatHelpEmbed() {
  return {
    color: BRAND.colors.primary,
    title: '💰 FGx Coins — chat commands',
    description:
      'Type **`fgx <command>`** in chat — OwO style.\n\n' +
      '• `fgx daily` — claim your daily reward (streak bonus!)\n' +
      '• `fgx weekly` — claim your weekly reward\n' +
      '• `fgx wallet` / `fgx wallet @user` — check a balance\n' +
      '• `fgx transfer @user <amount>` — send ₣Ԡ🇽 (5% tax)\n' +
      '• `fgx coinflip <amount>` / `fgx coinflip all` — 50/50 gamble\n' +
      '• `fgx top` — richest members\n\n' +
      'You can also mention the bot: `@FGx daily`',
    footer: { text: `${BRAND.footer} • Slash versions: /fgxcoin` },
  };
}

module.exports = {
  walletEmbed,
  claimEmbed,
  transferEmbed,
  gambleEmbed,
  warnEmbed,
  chatHelpEmbed,
};
