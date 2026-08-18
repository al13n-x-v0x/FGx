'use strict';

/* Copyright © 2026 FGx. All rights reserved. */

process.env.DISCORD_TOKEN = 'test-token';
process.env.DATABASE_PATH = ':memory:';

const test = require('node:test');
const assert = require('node:assert/strict');

// Fresh DB for tests.
const db = require('../src/database');
db.init();

const { economyRepo } = require('../src/database/repos/economy');
const economy = require('../src/services/community/economyService');

test('wallet starts at zero and formats nicely', () => {
  const row = economy.balance('g1', 'u1');
  assert.equal(row.balance, 0);
  assert.equal(row.lifetime, 0);
  assert.equal(economy.format(1234), '1,234 ₣Ԡ🇽');
});

test('daily claim pays base and logs a transaction', async () => {
  const result = await economy.daily('g1', 'u1');
  assert.equal(result.amount, 100);
  assert.equal(result.streak, 1);
  assert.equal(result.balance, 100);
  assert.equal(economyRepo.get('g1', 'u1').lifetime, 100);
  assert.equal(economyRepo.recentTx('g1', 'u1', 5)[0].kind, 'daily');
});

test('daily cannot be claimed twice in the same day', async () => {
  await assert.rejects(() => economy.daily('g1', 'u1'), (err) => err.code === 'ALREADY_CLAIMED');
});

test('weekly claim pays once', async () => {
  const result = await economy.weekly('g1', 'u1');
  assert.equal(result.amount, 500);
  assert.equal(result.balance, 600);
  await assert.rejects(() => economy.weekly('g1', 'u1'), (err) => err.code === 'ALREADY_CLAIMED');
});

test('transfer applies the 5% tax and updates both wallets', async () => {
  const from = await economy.daily('g1', 'u2');
  assert.equal(from.balance, 100);
  const result = await economy.transfer('g1', 'u2', 'u3', 100);
  assert.equal(result.received, 95); // 5% tax
  assert.equal(result.tax, 5);
  assert.equal(result.balance, 0);
  assert.equal(economyRepo.get('g1', 'u3').balance, 95);
});

test('transfer rejects insufficient funds and self-transfer', async () => {
  await assert.rejects(() => economy.transfer('g1', 'u3', 'u2', 500), (err) => err.code === 'INSUFFICIENT');
  await assert.rejects(() => economy.transfer('g1', 'u2', 'u2', 10), (err) => err.code === 'SELF_TRANSFER');
});

test('gamble doubles on a win and halves on a loss (injected RNG)', async () => {
  const realRng = Math.random;
  try {
    economy._setRng(() => 0.1); // win
    const win = await economy.gamble('g1', 'u1', 50);
    assert.equal(win.won, true);
    assert.equal(win.balance, 650);
    economy._setRng(() => 0.9); // loss
    const loss = await economy.gamble('g1', 'u1', 100);
    assert.equal(loss.won, false);
    assert.equal(loss.balance, 550);
  } finally {
    economy._setRng(realRng);
  }
});

test('gamble rejects amounts above the balance', async () => {
  await assert.rejects(() => economy.gamble('g1', 'u1', 999999), (err) => err.code === 'INVALID_AMOUNT');
});

test('economy leaderboard orders by balance', async () => {
  const rows = economy.leaderboard('g1', 10);
  assert.ok(rows.length >= 2);
  assert.ok(rows[0].balance >= rows[1].balance);
  assert.ok(rows.some((r) => r.user_id === 'u1'));
});
