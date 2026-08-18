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
      (kind === 'daily' && result.streak > 1
        ? `\n**Streak:** ${result.streak} days (+${(result.streak - 1) * economy.DAILY_STREAK_BONUS} bonus)`
        : ''),
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

function coinflipEmbed(result) {
  const pickLine = result.pick
    ? `You picked **${result.pick.toUpperCase()}** — the coin landed **${result.side.toUpperCase()}**.\n\n`
    : `The coin landed **${result.side.toUpperCase()}**.\n\n`;
  return {
    color: result.won ? BRAND.colors.success : BRAND.colors.danger,
    title: result.won ? `🪙 ${result.side.toUpperCase()}! You won!` : `🪙 ${result.side.toUpperCase()}! You lost.`,
    description:
      `${pickLine}` +
      (result.won
        ? `**+${economy.format(result.amount)}** — new balance **${economy.format(result.balance)}**.`
        : `**-${economy.format(result.amount)}** — new balance **${economy.format(result.balance)}**.`),
    footer: { text: `${BRAND.footer} • 50/50 odds` },
  };
}

function huntEmbed(result) {
  return {
    color: BRAND.colors.success,
    title: `🏹 Hunt successful!`,
    description:
      `You found a **${result.animal.emoji} ${result.animal.name}**!\n\n` +
      `**+${economy.format(result.amount)}** — new balance **${economy.format(result.balance)}**.`,
    footer: { text: `${BRAND.footer} • Hunt again in 60s` },
  };
}

function battleEmbed(result) {
  return {
    color: result.won ? BRAND.colors.success : BRAND.colors.danger,
    title: result.won
      ? `⚔️ You defeated the ${result.enemy.emoji} ${result.enemy.name}!`
      : `💀 The ${result.enemy.emoji} ${result.enemy.name} defeated you…`,
    description: result.won
      ? `**+${economy.format(result.amount)}** — new balance **${economy.format(result.balance)}**.`
      : `You lost **${economy.format(-result.amount)}** — new balance **${economy.format(result.balance)}**.`,
    footer: { text: `${BRAND.footer} • Battle again in 120s` },
  };
}

function warnEmbed(title, description) {
  return { color: BRAND.colors.warn, title, description, footer: { text: BRAND.footer } };
}

module.exports = {
  walletEmbed,
  claimEmbed,
  transferEmbed,
  gambleEmbed,
  coinflipEmbed,
  huntEmbed,
  battleEmbed,
  warnEmbed,
};
