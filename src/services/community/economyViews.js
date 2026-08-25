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
  const newTag = result.isNew ? ' 🆕 NEW!' : '';
  return {
    color: BRAND.colors.success,
    title: `🏹 Hunt successful!`,
    description:
      `You found a **${result.animal.emoji} ${result.animal.name}**${newTag}!\n\n` +
      `**+${economy.format(result.amount)}** — new balance **${economy.format(result.balance)}**.\n` +
      `**Collection:** ${result.count} × ${result.animal.name}`, 
    footer: { text: `${BRAND.footer} • Hunt again in 60s` },
  };
}

function prayEmbed(result) {
  return {
    color: BRAND.colors.success,
    title: '🙏 Prayer answered',
    description:
      `The FGx gods bless you with **${economy.format(result.amount)}**.\n\n` +
      `**New balance:** ${economy.format(result.balance)}.`,
    footer: { text: `${BRAND.footer} • Pray again in 2h` },
  };
}

function crateEmbed(result) {
  const newTag = result.isNew ? ' 🆕 NEW!' : '';
  return {
    color: BRAND.colors.primary,
    title: '📦 Crate opened',
    description:
      `You open the crate and find a **${result.animal.emoji} ${result.animal.name}**${newTag}!\n` +
      `Plus **${economy.format(result.bonus)}** bonus coins.\n\n` +
      `**Collection:** ${result.count} × ${result.animal.name} • **Balance:** ${economy.format(result.balance)}.`,
    footer: { text: `${BRAND.footer} • Crate cost: ${economy.format(minigamesCost())}` },
  };
}

function minigamesCost() {
  // Lazy require avoids a circular import at module load.
  return require('../../data/minigames').CRATE_COST;
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

/** Transaction kind → short label + emoji for history listings. */
const TX_LABELS = {
  daily: '📆 Daily',
  weekly: '🗓️ Weekly',
  transfer_in: '📥 Received',
  transfer_out: '📤 Sent',
  gamble_win: '🟢 Coinflip win',
  gamble_loss: '🔴 Coinflip loss',
  hunt: '🏹 Hunt',
  battle_win: '⚔️ Battle win',
  battle_loss: '💀 Battle loss',
  match_win: '🏆 Match win',
  match_draw: '🤝 Match draw',
  vip: '👑 VIP daily',
};

function txLabel(kind) {
  return TX_LABELS[kind] ?? `• ${kind.replace(/_/g, ' ')}`;
}

/** Build a history embed (one field per transaction). */
function historyEmbed(targetName, rows) {
  const embed = {
    color: BRAND.colors.primary,
    title: `🧾 ₣Ԡ🇽 History — ${targetName}`,
    description: rows.length > 0 ? `Last **${rows.length}** transactions (newest first).` : 'No transactions yet — claim `fgx daily`!',
    footer: { text: `${BRAND.footer} • /fgxcoin history for more` },
  };
  if (rows.length > 0) {
    embed.fields = rows.map((r) => {
      const sign = r.amount >= 0 ? '+' : '';
      return {
        name: `${txLabel(r.kind)} — ${sign}${economy.format(r.amount)}`,
        value: `${r.note ?? ''} ${r.created_at ?? ''}`.trim(),
        inline: false,
      };
    });
  }
  return embed;
}

function zooEmbed(targetName, statsInfo, rows) {
  const embed = {
    color: BRAND.colors.primary,
    title: `🦁 Zoo — ${targetName}`,
    description:
      rows.length > 0
        ? rows
            .map((r) => {
              const rarity = require('../../data/minigames').RARITY[r.animal.rarity];
              const star = r.count > 1 ? ` ×**${r.count}**` : '';
              return `${rarity.emoji} ${r.animal.emoji} **${r.animal.name}**${star}`;
            })
            .join('\n')
        : 'Your zoo is empty — go hunting with `fgx hunt`!',
    footer: { text: `${BRAND.footer} • ${statsInfo.total} animals, ${statsInfo.species} species • Sell dupes: fgx sell <animal>` },
  };
  return embed;
}

function sellEmbed(result) {
  const left = result.remaining > 0 ? `\n**Remaining:** ${result.remaining} × ${result.animal.name}` : '\nYou sold your last one!'; 
  return {
    color: BRAND.colors.success,
    title: '💸 Sold',
    description:
      `You sold a **${result.animal.emoji} ${result.animal.name}** for **${economy.format(result.price)}**.${left}\n` +
      `**Balance:** ${economy.format(result.balance)}.`,
    footer: { text: BRAND.footer },
  };
}

function warnEmbed(title, description) {
  return { color: BRAND.colors.warn, title, description, footer: { text: BRAND.footer } };
}

function workEmbed(result) {
  const { job, failed, amount, balance } = result;
  return {
    color: failed ? BRAND.colors.danger : BRAND.colors.success,
    title: failed ? `${job.emoji} Work Failed!` : `${job.emoji} Work Complete!`,
    description: failed
      ? `You tried working as **${job.name}** but got fired!
Lost **${economy.format(Math.abs(amount))}** ₣Ԡ🇽. Balance: **${economy.format(balance)}** ₣Ԡ🇽`
      : `You worked as **${job.name}** and earned **${economy.format(amount)}** ₣Ԡ🇽!
Balance: **${economy.format(balance)}** ₣Ԡ🇽`,
    footer: { text: BRAND.footer },
  };
}

function crimeEmbed(result) {
  const { crime: c, failed, amount, balance } = result;
  return {
    color: failed ? BRAND.colors.danger : BRAND.colors.success,
    title: failed ? `${c.emoji} Busted!` : `${c.emoji} Crime Successful!`,
    description: failed
      ? `You got caught **${c.name}**! The cops fined you **${economy.format(Math.abs(amount))}** ₣Ԡ🇽.
Balance: **${economy.format(balance)}** ₣Ԡ🇽`
      : `You pulled off **${c.name}** and stole **${economy.format(amount)}** ₣Ԡ🇽!
Balance: **${economy.format(balance)}** ₣Ԡ🇽`,
    footer: { text: BRAND.footer },
  };
}

function robEmbed(result) {
  const { targetId, failed, amount, balance } = result;
  return {
    color: failed ? BRAND.colors.danger : BRAND.colors.success,
    title: failed ? '🚨 Robbery Failed!' : '💰 Robbery Successful!',
    description: failed
      ? `You tried robbing <@${targetId}> but got caught!
Lost **${economy.format(Math.abs(amount))}** ₣Ԡ🇽 as a fine.
Balance: **${economy.format(balance)}** ₣Ԡ🇽`
      : `You robbed <@${targetId}> and stole **${economy.format(amount)}** ₣Ԡ🇽!
Balance: **${economy.format(balance)}** ₣Ԡ🇽`,
    footer: { text: BRAND.footer },
  };
}

function fishEmbed(result) {
  const { fish: f, amount, balance } = result;
  const rarity = require('../../data/minigames').RARITY[f.rarity];
  return {
    color: BRAND.colors.primary,
    title: `${f.emoji} You caught a ${f.name}!`,
    description: `${rarity.emoji} **${rarity.label}** rarity
Earned **${economy.format(amount)}** ₣Ԡ🇽!
Balance: **${economy.format(balance)}** ₣Ԡ🇽`,
    footer: { text: BRAND.footer },
  };
}

module.exports = {
  walletEmbed,
  claimEmbed,
  transferEmbed,
  gambleEmbed,
  coinflipEmbed,
  huntEmbed,
  battleEmbed,
  prayEmbed,
  crateEmbed,
  zooEmbed,
  sellEmbed,
  historyEmbed,
  txLabel,
  TX_LABELS,
  warnEmbed,
  workEmbed,
  crimeEmbed,
  robEmbed,
  fishEmbed,
};
