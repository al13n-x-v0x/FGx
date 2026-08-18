'use strict';

/*
 * Copyright © 2026 FGx.
 * All rights reserved.
 */

const { BRAND } = require('../../config/constants');
const economy = require('./economyService');
const views = require('./economyViews');
const { economyRepo } = require('../../database/repos/economy');
const { RateLimiter } = require('../../utils/ratelimit');
const { logger } = require('../../utils/logger');

/**
 * OwO-style chat commands for the FGx economy.
 *
 * In chat, type:  fgx daily | fgx coinflip 50 | fgx transfer @user 100 |
 *                 fgx wallet | fgx weekly | fgx top | fgx help
 * Mentioning the bot works too:  @FGx daily
 *
 * Parsing is pure and unit-tested; execution mirrors /fgxcoin exactly
 * (same service, same embeds) so both entry points stay in sync.
 */

const CHAT_RATE_LIMIT = new RateLimiter({ max: 5, windowMs: 60_000 });

/** Strip the prefix/mention and return the command line, or null. */
function stripPrefix(content, clientId) {
  let text = String(content ?? '').trim();
  if (!text) return null;
  // @FGx mention first.
  const mentionRe = new RegExp(`^<@!?${clientId}>\\s*`, 'i');
  if (mentionRe.test(text)) {
    text = text.replace(mentionRe, '').trim();
    return text || null;
  }
  // Plain "fgx ..." prefix.
  if (/^fgx\b/i.test(text)) {
    text = text.replace(/^fgx\b/i, '').trim();
    return text || null;
  }
  return null;
}

/** Parse a whole number, or null when invalid. */
function parseAmount(raw) {
  const n = Number(String(raw ?? '').replace(/[,_]/g, '').trim());
  return Number.isFinite(n) && Number.isInteger(n) && n >= 1 ? n : null;
}

/**
 * Pure command parser.
 * @returns {{ type: string, ...args }} or { type: 'unknown' }
 */
function parseCommand(line, mentionIds = []) {
  const tokens = String(line ?? '').trim().split(/\s+/);
  const cmd = (tokens[0] ?? '').toLowerCase();
  const rest = tokens.slice(1);

  if (!cmd || cmd === 'help') return { type: 'help' };

  if (cmd === 'wallet' || cmd === 'bal' || cmd === 'balance') {
    return { type: 'wallet', targetId: mentionIds[0] ?? null };
  }
  if (cmd === 'daily') return { type: 'daily' };
  if (cmd === 'weekly') return { type: 'weekly' };

  if (cmd === 'transfer' || cmd === 'pay' || cmd === 'give') {
    const targetId = mentionIds[0] ?? null;
    // Ignore mention tokens when reading the amount (<@123> or plain @name).
    const amountText = rest.filter((t) => !/^<@!?\d+>$/.test(t) && !/^@.+/.test(t)).join(' ');
    const amount = parseAmount(amountText);
    return { type: 'transfer', targetId, amount, raw: rest.join(' ') };
  }

  if (cmd === 'coinflip' || cmd === 'gamble' || cmd === 'cf' || cmd === 'flip') {
    const raw = rest.join(' ').trim();
    const all = raw.toLowerCase() === 'all';
    return { type: 'gamble', all, amount: all ? null : parseAmount(raw), raw };
  }

  if (cmd === 'top' || cmd === 'leaderboard' || cmd === 'lb') {
    const n = parseAmount(rest[0] ?? '') ?? 10;
    return { type: 'top', count: Math.min(Math.max(n, 1), 15) };
  }

  return { type: 'unknown', raw: line };
}

/**
 * Execute a parsed chat command against the message's author.
 * Returns true when the message was handled as a command.
 */
async function handle(client, message) {
  const line = stripPrefix(message.content, client.user.id);
  if (!line) return false;

  if (!CHAT_RATE_LIMIT.allow(message.author.id)) {
    await message
      .reply({ embeds: [views.warnEmbed('Slow down', 'Chat commands are rate-limited — wait a moment.')] })
      .catch(() => {});
    return true;
  }

  const parsed = parseCommand(line, [...(message.mentions.users?.values?.() ?? [])].map((u) => u.id));
  const guildId = message.guild.id;
  const userId = message.author.id;

  try {
    switch (parsed.type) {
      case 'help':
        await message.reply({ embeds: [views.chatHelpEmbed()] });
        return true;

      case 'wallet': {
        const target = parsed.targetId ? message.mentions.users.get(parsed.targetId) ?? message.author : message.author;
        const row = economy.balance(guildId, target.id);
        const rank = economyRepo.rank(guildId, target.id);
        await message.reply({ embeds: [views.walletEmbed(target, row, rank)] });
        return true;
      }

      case 'daily':
      case 'weekly': {
        const result = await economy[parsed.type](guildId, userId);
        await message.reply({ embeds: [views.claimEmbed(parsed.type, result)] });
        return true;
      }

      case 'transfer': {
        if (!parsed.targetId) {
          await message.reply({ embeds: [views.warnEmbed('Who?', 'Mention someone: `fgx transfer @user <amount>`')] });
          return true;
        }
        if (!parsed.amount) {
          await message.reply({ embeds: [views.warnEmbed('Invalid amount', 'Use a whole number: `fgx transfer @user 100`')] });
          return true;
        }
        const target = message.mentions.users.get(parsed.targetId);
        const result = await economy.transfer(guildId, userId, target.id, parsed.amount);
        await message.reply({ embeds: [views.transferEmbed(target, result)] });
        return true;
      }

      case 'gamble': {
        const row = economy.balance(guildId, userId);
        const amount = parsed.all ? (row.balance ?? 0) : parsed.amount;
        if (!amount) {
          await message.reply({ embeds: [views.warnEmbed('Invalid amount', 'Use `fgx coinflip <amount>` or `fgx coinflip all`')] });
          return true;
        }
        const result = await economy.gamble(guildId, userId, amount);
        await message.reply({ embeds: [views.gambleEmbed(result)] });
        return true;
      }

      case 'top': {
        const rows = economy.leaderboard(guildId, parsed.count);
        const embed = {
          color: BRAND.colors.primary,
          title: '💰 ₣Ԡ🇽 Richest Members',
          description:
            rows.length > 0
              ? rows.map((r, i) => `${['🥇', '🥈', '🥉'][i] ?? `**${i + 1}.**`} <@${r.user_id}> — ${economy.format(r.balance ?? 0)}`).join('\n')
              : 'No coins in circulation yet — claim `fgx daily`!',
          footer: { text: `${BRAND.footer} • FGx economy` },
        };
        await message.reply({ embeds: [embed] });
        return true;
      }

      default:
        await message.reply({ embeds: [views.warnEmbed('Unknown command', 'Try `fgx help` — commands: daily, weekly, wallet, transfer, coinflip, top.')] });
        return true;
    }
  } catch (err) {
    const codes = ['ALREADY_CLAIMED', 'INVALID_AMOUNT', 'SELF_TRANSFER', 'INSUFFICIENT', 'RATE_LIMITED'];
    if (codes.includes(err.code)) {
      await message.reply({ embeds: [views.warnEmbed('FGx coins', err.message)] }).catch(() => {});
      return true;
    }
    logger.warn('chat command failed', { guildId, userId, error: err.message });
    return true;
  }
}

module.exports = { handle, stripPrefix, parseCommand, parseAmount, CHAT_RATE_LIMIT };
