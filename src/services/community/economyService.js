'use strict';

/*
 * Copyright © 2026 FGx.
 * All rights reserved.
 */

const { economyRepo } = require('../../database/repos/economy');
const { RateLimiter } = require('../../utils/ratelimit');

/**
 * FGx economy — an OwO-style server currency.
 *
 * Earning: /daily (streak bonus) and /weekly. Spending: /transfer (5% tax
 * to discourage laundering) and /gamble (50/50 double-or-nothing).
 * All income is tracked in `lifetime` for the leaderboard's tiebreak.
 */

const CURRENCY = '₣Ԡ🇽';
const DAILY_BASE = 500;
const DAILY_STREAK_BONUS = 50;
const DAILY_MAX = 1000;
const WEEKLY_AMOUNT = 500;
const TRANSFER_TAX = 0.05;
const WEEK_MS = 7 * 24 * 3_600_000;

/** Injectable RNG for tests (defaults to Math.random). */
let rng = () => Math.random();

function _setRng(fn) {
  rng = fn;
}

function format(amount) {
  return `${Math.round(amount).toLocaleString('en-US')} ${CURRENCY}`;
}

/** Per-user gamble limiter (anti-farm). */
const gambleLimiter = new RateLimiter({ max: 5, windowMs: 60_000 });

function balance(guildId, userId) {
  return economyRepo.ensure(guildId, userId);
}

function leaderboard(guildId, limit = 100) {
  return economyRepo.leaderboard(guildId, limit);
}

/** UTC day boundary helpers for daily streak math. */
function utcDayKey(iso) {
  return iso.slice(0, 10);
}

function isYesterday(lastIso, nowIso) {
  const last = new Date(lastIso);
  const now = new Date(nowIso);
  const diff = now - last;
  return diff >= 24 * 3_600_000 - 60_000 && diff < 48 * 3_600_000;
}

/** Claim the daily reward. Streak grows by 25/day up to a 500 cap. */
async function daily(guildId, userId) {
  const row = economyRepo.ensure(guildId, userId);
  const nowIso = new Date().toISOString();

  if (row.last_daily && utcDayKey(row.last_daily) === utcDayKey(nowIso)) {
    const err = new Error(`You already claimed today. Come back tomorrow — your streak is **${row.daily_streak}** days.`);
    err.code = 'ALREADY_CLAIMED';
    throw err;
  }

  const streak = row.last_daily && isYesterday(row.last_daily, nowIso) ? (row.daily_streak || 0) + 1 : 1;
  const amount = Math.min(DAILY_MAX, DAILY_BASE + (streak - 1) * DAILY_STREAK_BONUS);

  economyRepo.updateBalance(guildId, userId, amount);
  economyRepo.setLastDaily(guildId, userId, nowIso, streak);
  economyRepo.logTx(guildId, userId, 'daily', amount, `Daily claim (streak ${streak})`);
  const updated = economyRepo.get(guildId, userId);
  return { amount, streak, balance: updated.balance, row: updated };
}

/** Claim the weekly reward. */
async function weekly(guildId, userId) {
  const row = economyRepo.ensure(guildId, userId);
  const nowIso = new Date().toISOString();

  if (row.last_weekly && Date.now() - new Date(row.last_weekly).getTime() < WEEK_MS) {
    const next = new Date(new Date(row.last_weekly).getTime() + WEEK_MS);
    const err = new Error(`You already claimed this week. Next weekly opens **${next.toISOString().slice(0, 10)}**.`);
    err.code = 'ALREADY_CLAIMED';
    throw err;
  }

  economyRepo.updateBalance(guildId, userId, WEEKLY_AMOUNT);
  economyRepo.setLastWeekly(guildId, userId, nowIso);
  economyRepo.logTx(guildId, userId, 'weekly', WEEKLY_AMOUNT, 'Weekly claim');
  const updated = economyRepo.get(guildId, userId);
  return { amount: WEEKLY_AMOUNT, balance: updated.balance, row: updated };
}

/**
 * Transfer FGx to another member. A 5% tax is deducted so transfers can't
 * be used to launder farmed coins between accounts.
 */
async function transfer(guildId, fromId, toId, amount) {
  const amt = Math.floor(Number(amount));
  if (!Number.isFinite(amt) || amt < 1) {
    const err = new Error('Amount must be a whole number of at least **1** ₣Ԡ🇽.');
    err.code = 'INVALID_AMOUNT';
    throw err;
  }
  if (fromId === toId) {
    const err = new Error('You cannot transfer ₣Ԡ🇽 to yourself.');
    err.code = 'SELF_TRANSFER';
    throw err;
  }

  const from = economyRepo.ensure(guildId, fromId);
  if ((from.balance ?? 0) < amt) {
    const err = new Error(`You only have **${format(from.balance ?? 0)}** — that transfer needs ${format(amt)}.`);
    err.code = 'INSUFFICIENT';
    throw err;
  }

  const tax = Math.round(amt * TRANSFER_TAX);
  const received = amt - tax;

  economyRepo.updateBalance(guildId, fromId, -amt);
  economyRepo.updateBalance(guildId, toId, received);
  economyRepo.logTx(guildId, fromId, 'transfer_out', -amt, `Sent ${format(received)} (${format(tax)} tax)`);
  economyRepo.logTx(guildId, toId, 'transfer_in', received, `Received from <@${fromId}>`);
  const updated = economyRepo.get(guildId, fromId);
  return { amount: amt, received, tax, balance: updated.balance, row: updated };
}

/**
 * Coinflip — 50/50. With a `pick` (heads/tails) the user bets on a side
 * and doubles their money if it lands there. Without a pick it's the plain
 * double-or-nothing gamble. Validates balance, rate-limits, logs the tx.
 */
async function coinflip(guildId, userId, amount, pick = null) {
  const amt = Math.floor(Number(amount));
  const row = economyRepo.ensure(guildId, userId);
  if (!Number.isFinite(amt) || amt < 1 || amt > (row.balance ?? 0)) {
    const err = new Error(`Gamble between **1** and **${format(row.balance ?? 0)}**.`);
    err.code = 'INVALID_AMOUNT';
    throw err;
  }
  if (!gambleLimiter.allow(userId)) {
    const err = new Error('Gambling is rate-limited — wait a minute between bets.');
    err.code = 'RATE_LIMITED';
    throw err;
  }

  let side;
  let won;
  if (pick === 'heads' || pick === 'tails') {
    side = rng() < 0.5 ? 'heads' : 'tails';
    won = side === pick;
  } else {
    won = rng() < 0.5;
    side = won ? 'heads' : 'tails';
  }
  const delta = won ? amt : -amt;
  economyRepo.updateBalance(guildId, userId, delta);
  economyRepo.logTx(guildId, userId, won ? 'gamble_win' : 'gamble_loss', delta, `Coinflip ${side} ${won ? 'win' : 'loss'}`);
  const updated = economyRepo.get(guildId, userId);
  return { won, side, pick, amount: amt, delta, balance: updated.balance, row: updated };
}

/** Plain 50/50 double-or-nothing (no side picked). */
async function gamble(guildId, userId, amount) {
  return coinflip(guildId, userId, amount, null);
}

module.exports = {
  CURRENCY,
  DAILY_BASE,
  DAILY_STREAK_BONUS,
  TRANSFER_TAX,
  format,
  balance,
  leaderboard,
  daily,
  weekly,
  transfer,
  coinflip,
  gamble,
  _setRng,
};
