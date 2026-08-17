'use strict';

/* Copyright © 2026 FGx. All rights reserved. */

process.env.DISCORD_TOKEN = 'test-token';
process.env.DATABASE_PATH = ':memory:';

const test = require('node:test');
const assert = require('node:assert/strict');

// Fresh DB for tests.
const db = require('../src/database');
db.init();

const { guildConfigRepo } = require('../src/database/repos/guildConfig');
const { computeDelta, apply } = require('../src/services/clan/ratingService');

test('rating gain on a win uses the configured algorithm', () => {
  // Defaults: base 1000, winGain 25, lossLoss 20, kdFactor 15, streakBonus 5.
  const delta = computeDelta('g1', { won: 1, kills: 10, deaths: 5, streakAfter: 1 });
  // 25 + min(15 * 2, 45) = 25 + 30 = 55
  assert.equal(delta, 55);
});

test('streak bonus applies on a second consecutive win', () => {
  const delta = computeDelta('g1', { won: 1, kills: 5, deaths: 5, streakAfter: 2 });
  // 25 + min(15 * 1, 45) + 5 = 45
  assert.equal(delta, 45);
});

test('losses subtract the configured amount', () => {
  const delta = computeDelta('g1', { won: -1, kills: 5, deaths: 10, streakAfter: 0 });
  assert.equal(delta, -20);
});

test('custom rating config changes the result', () => {
  guildConfigRepo.update('g1', { clan: { rating: { winGain: 40, kdFactor: 5, streakBonus: 10 } } });
  const delta = computeDelta('g1', { won: 1, kills: 10, deaths: 5, streakAfter: 2 });
  // 40 + min(5 * 2, 15) + 10 = 60
  assert.equal(delta, 60);
});

test('rating never goes below zero', () => {
  const result = apply('g1', 5, -1, 0, 1, 0);
  assert.equal(result.rating, 0);
});

test('guild config defaults merge cleanly', () => {
  const config = guildConfigRepo.get('g1');
  assert.equal(config.clan.rating.winGain, 40); // from previous test
  assert.equal(config.antispam.maxMessages, 5); // default preserved
  assert.equal(config.ai.actionMode, 'MODERATE');
});
