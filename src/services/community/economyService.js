'use strict';

/*
 * Copyright © 2026 FGx.
 * All rights reserved.
 */

const { economyRepo } = require('../../database/repos/economy');
const { RateLimiter } = require('../../utils/ratelimit');
const { Cooldown } = require('../../utils/cooldown');
const minigames = require('../../data/minigames');
const zoo = require('./zooService');
const verificationService = require('./verificationService');

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
const MATCH_WIN_REWARD = 250;
const MATCH_DRAW_REWARD = 50;
const WEEK_MS = 7 * 24 * 3_600_000;
const VIP_DAILY_AMOUNT = 250;

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

/** Per-user minigame cooldowns (hunt 60s, battle 120s, pray 2h). */
const minigameCooldown = new Cooldown();

function huntCooldownLeft(guildId, userId) {
  return minigameCooldown.remaining(`hunt:${guildId}:${userId}`);
}

function battleCooldownLeft(guildId, userId) {
  return minigameCooldown.remaining(`battle:${guildId}:${userId}`);
}

function prayCooldownLeft(guildId, userId) {
  return minigameCooldown.remaining(`pray:${guildId}:${userId}`);
}

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
 * VIP daily — 250 ₣Ԡ🇽 per day, ONLY for fully verified members
 * (BloxStrike link approved AND Roblox verified). Claim window is tracked
 * via the transaction log so no schema change is needed.
 */
async function vipDaily(guildId, userId) {
  verificationService.requireFull(guildId, userId);
  const today = new Date().toISOString().slice(0, 10);
  const already = economyRepo
    .recentTx(guildId, userId, 100)
    .some((t) => t.kind === 'vip' && String(t.created_at ?? '').startsWith(today));
  if (already) {
    const err = new Error('You already claimed your 👑 VIP daily today. Come back tomorrow!');
    err.code = 'ALREADY_CLAIMED';
    throw err;
  }
  economyRepo.updateBalance(guildId, userId, VIP_DAILY_AMOUNT);
  economyRepo.logTx(guildId, userId, 'vip', VIP_DAILY_AMOUNT, 'VIP daily bonus (fully verified)');
  const updated = economyRepo.get(guildId, userId);
  return { amount: VIP_DAILY_AMOUNT, balance: updated.balance, row: updated };
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

/**
 * Pray — a big coin blessing on a 2-hour cooldown.
 */
async function pray(guildId, userId) {
  const key = `pray:${guildId}:${userId}`;
  const left = minigameCooldown.remaining(key);
  if (left > 0) {
    const err = new Error(`The gods are still listening from your last prayer. Try again in **${Math.ceil(left / 60_000)}m**.`);
    err.code = 'PRAY_COOLDOWN';
    throw err;
  }
  minigameCooldown.set(key, minigames.PRAY_COOLDOWN_MS);

  const amount = minigames.range(1000, 3000, rng);
  economyRepo.updateBalance(guildId, userId, amount);
  economyRepo.logTx(guildId, userId, 'pray', amount, 'Prayer blessing');
  const updated = economyRepo.get(guildId, userId);
  return { amount, balance: updated.balance, row: updated };
}

/**
 * Crate — costs coins, opens a random animal plus bonus coins.
 */
async function crate(guildId, userId) {
  const row = economyRepo.ensure(guildId, userId);
  if ((row.balance ?? 0) < minigames.CRATE_COST) {
    const err = new Error(`A crate costs **${format(minigames.CRATE_COST)}** — you have ${format(row.balance ?? 0)}.`);
    err.code = 'INSUFFICIENT';
    throw err;
  }
  const animal = minigames.weightedPick(minigames.ANIMALS, rng);
  const bonus = minigames.range(minigames.CRATE_BONUS_MIN, minigames.CRATE_BONUS_MAX, rng);
  const { isNew, count } = zoo.addAnimal(guildId, userId, animal);
  const net = bonus - minigames.CRATE_COST;
  economyRepo.updateBalance(guildId, userId, net);
  economyRepo.logTx(guildId, userId, 'crate', net, `Crate: ${animal.name}${isNew ? ' (NEW!)' : ''} + ${bonus} bonus`);
  const updated = economyRepo.get(guildId, userId);
  return { animal, isNew, count, bonus, balance: updated.balance, row: updated };
}

/**
 * Reward the FGx players from a recorded match (or clan war).
 * Winner 'fgx' pays each lineup player MATCH_WIN_REWARD; a draw pays a
 * small MATCH_DRAW_REWARD; losses pay nothing. Returns the payout summary.
 */
function rewardMatch(guildId, userIds, winner) {
  const amount = winner === 'fgx' ? MATCH_WIN_REWARD : winner === 'draw' ? MATCH_DRAW_REWARD : 0;
  if (amount <= 0) return { rewarded: 0, amount: 0, totalPaid: 0 };

  let rewarded = 0;
  const seen = new Set();
  for (const id of userIds) {
    const userId = String(id ?? '');
    if (!userId || seen.has(userId)) continue;
    seen.add(userId);
    economyRepo.updateBalance(guildId, userId, amount);
    economyRepo.logTx(guildId, userId, winner === 'fgx' ? 'match_win' : 'match_draw', amount, 'Competitive match reward');
    rewarded += 1;
  }
  return { rewarded, amount, totalPaid: rewarded * amount };
}

/**
 * Hunt — find an animal, get paid. 60s cooldown per user.
 * Guaranteed small-ish payout; rare finds pay big.
 */
async function hunt(guildId, userId) {
  const key = `hunt:${guildId}:${userId}`;
  const left = minigameCooldown.remaining(key);
  if (left > 0) {
    const err = new Error(`You're tired from hunting. Try again in **${Math.ceil(left / 1000)}s**.`);
    err.code = 'HUNT_COOLDOWN';
    throw err;
  }
  minigameCooldown.set(key, minigames.HUNT_COOLDOWN_MS);

  const animal = minigames.weightedPick(minigames.ANIMALS, rng);
  const amount = minigames.range(animal.min, animal.max, rng);
  const { isNew, count } = zoo.addAnimal(guildId, userId, animal);
  economyRepo.updateBalance(guildId, userId, amount);
  economyRepo.logTx(guildId, userId, 'hunt', amount, `Hunted a ${animal.name}${isNew ? ' (NEW!)' : ''}`);
  const updated = economyRepo.get(guildId, userId);
  return { animal, amount, isNew, count, balance: updated.balance, row: updated };
}

/**
 * Battle — fight a random enemy. Win: coins by enemy tier. Lose: 10% of
 * balance (capped at 200). 120s cooldown per user.
 */
async function battle(guildId, userId) {
  const key = `battle:${guildId}:${userId}`;
  const left = minigameCooldown.remaining(key);
  if (left > 0) {
    const err = new Error(`You're still recovering. Try again in **${Math.ceil(left / 1000)}s**.`);
    err.code = 'BATTLE_COOLDOWN';
    throw err;
  }
  minigameCooldown.set(key, minigames.BATTLE_COOLDOWN_MS);

  const enemy = minigames.weightedPick(minigames.ENEMIES, rng);
  const won = rng() < enemy.winChance;
  const row = economyRepo.ensure(guildId, userId);
  const amount = won ? minigames.range(enemy.min, enemy.max, rng) : -Math.min(minigames.BATTLE_LOSS_CAP, Math.floor((row.balance ?? 0) * minigames.BATTLE_LOSS_FRACTION));
  economyRepo.updateBalance(guildId, userId, amount);
  economyRepo.logTx(guildId, userId, won ? 'battle_win' : 'battle_loss', amount, `Battle vs ${enemy.name}`);
  const updated = economyRepo.get(guildId, userId);
  return { enemy, won, amount, balance: updated.balance, row: updated };
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
  vipDaily,
  transfer,
  coinflip,
  gamble,
  hunt,
  battle,
  pray,
  crate,
  rewardMatch,
  MATCH_WIN_REWARD,
  MATCH_DRAW_REWARD,
  huntCooldownLeft,
  battleCooldownLeft,
  prayCooldownLeft,
  _setRng,
};
