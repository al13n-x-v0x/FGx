'use strict';

/* Copyright © 2026 FGx. All rights reserved. */

process.env.DISCORD_TOKEN = 'test-token';
process.env.DATABASE_PATH = ':memory:';

const test = require('node:test');
const assert = require('node:assert/strict');

// Fresh DB for tests.
const db = require('../src/database');
db.init();

const minigames = require('../src/data/minigames');
const economy = require('../src/services/community/economyService');
const { parseCommand } = require('../src/services/community/chatCommands');

test('minigame tables have positive weights and sane payouts', () => {
  assert.ok(minigames.ANIMALS.length >= 8);
  assert.ok(minigames.ENEMIES.length >= 6);
  for (const a of minigames.ANIMALS) {
    assert.ok(a.weight > 0 && a.min > 0 && a.max >= a.min);
  }
  for (const e of minigames.ENEMIES) {
    assert.ok(e.weight > 0 && e.winChance > 0 && e.winChance < 1 && e.max >= e.min);
  }
});

test('weightedPick returns a table entry and range stays in bounds', () => {
  let picked = null;
  for (let i = 0; i < 200; i += 1) {
    const animal = minigames.weightedPick(minigames.ANIMALS);
    const amount = minigames.range(animal.min, animal.max);
    assert.ok(amount >= animal.min && amount <= animal.max);
    picked = animal;
  }
  assert.ok(picked);
});

test('hunt pays coins and enforces the 60s cooldown', async () => {
  const realRng = Math.random;
  try {
    economy._setRng(() => 0.5);
    const result = await economy.hunt('g1', 'hunter');
    assert.ok(result.amount >= 15, 'hunt always pays something');
    assert.ok(result.balance >= result.amount);
    assert.equal(economy.huntCooldownLeft('g1', 'hunter') > 0, true, 'cooldown starts');
    await assert.rejects(() => economy.hunt('g1', 'hunter'), (err) => err.code === 'HUNT_COOLDOWN');
  } finally {
    economy._setRng(realRng);
  }
});

test('battle wins pay coins and losses cost 10% (capped at 200)', async () => {
  const realRng = Math.random;
  try {
    // Win: rng 0.05 picks the slime (winChance 0.85) and rolls a win.
    economy._setRng(() => 0.05);
    const win = await economy.battle('g1', 'winuser');
    assert.equal(win.won, true);
    assert.ok(win.amount >= win.enemy.min);

    // Loss: rng 0.95 picks the dragon boss (winChance 0.35) and loses.
    economy._setRng(() => 0.95);
    const before = economy.balance('g1', 'lossuser').balance;
    const loss = await economy.battle('g1', 'lossuser');
    assert.equal(loss.won, false);
    const expectedLoss = Math.min(200, Math.floor(before * 0.1));
    assert.equal(before - loss.balance, expectedLoss);
  } finally {
    economy._setRng(realRng);
  }
});

test('battle cooldown blocks repeat fights', async () => {
  await assert.rejects(() => economy.battle('g1', 'lossuser'), (err) => err.code === 'BATTLE_COOLDOWN');
  assert.equal(economy.battleCooldownLeft('g1', 'lossuser') > 0, true);
});

test('chat commands parse hunt and battle', () => {
  assert.deepEqual(parseCommand('hunt'), { type: 'hunt' });
  assert.deepEqual(parseCommand('battle'), { type: 'battle' });
  assert.deepEqual(parseCommand('fight'), { type: 'battle' });
  assert.equal(parseCommand('hunt 5').type, 'hunt'); // extra args ignored
});
