'use strict';

/* Copyright © 2026 FGx. All rights reserved. */

process.env.DISCORD_TOKEN = 'test-token';

const test = require('node:test');
const assert = require('node:assert/strict');

const { Cooldown } = require('../src/utils/cooldown');
const { RateLimiter } = require('../src/utils/ratelimit');
const { ValidationError } = require('../src/utils/errors');
const { snowflake, duration, oneOf, integer, boundedString, bloxstrikeUsername } = require('../src/utils/validate');
const { percent, kdRatio, winRate, ratingTier, formatDuration } = require('../src/utils/format');
const { deepMerge } = require('../src/database/repos/guildConfig');

test('cooldown expires and sweeps', () => {
  const cd = new Cooldown();
  cd.set('a', 50_000);
  assert.equal(cd.has('a'), true);
  assert.ok(cd.remaining('a') > 0);
  assert.equal(cd.has('b'), false);
  cd.destroy();
});

test('rate limiter enforces the window', () => {
  const rl = new RateLimiter({ max: 2, windowMs: 60_000 });
  assert.equal(rl.allow('u'), true);
  assert.equal(rl.allow('u'), true);
  assert.equal(rl.allow('u'), false);
  assert.equal(rl.remaining('u'), 0);
  assert.equal(rl.allow('v'), true);
  rl.destroy();
});

test('validation helpers reject bad input', () => {
  assert.throws(() => snowflake('abc'), ValidationError);
  assert.equal(snowflake('123456789012345678'), '123456789012345678');
  assert.equal(duration('5m'), 300_000);
  assert.equal(duration('1h'), 3_600_000);
  assert.throws(() => duration('5x'), ValidationError);
  assert.equal(oneOf('LOG', ['LOG', 'RECOMMEND', 'MODERATE'], 'mode'), 'LOG');
  assert.throws(() => oneOf('NOPE', ['LOG'], 'mode'), ValidationError);
  assert.equal(integer('7', { max: 10 }), 7);
  assert.throws(() => integer('11', { max: 10 }), ValidationError);
  assert.equal(boundedString('hi', { min: 1, max: 5 }), 'hi');
  assert.throws(() => boundedString('', { min: 1 }), ValidationError);
  assert.equal(bloxstrikeUsername('Player_01'), 'Player_01');
  assert.throws(() => bloxstrikeUsername('no spaces ok but @'), ValidationError);
});

test('format helpers', () => {
  assert.equal(percent(0.7123), '71%');
  assert.equal(kdRatio(10, 5), '2.00');
  assert.equal(kdRatio(10, 0), '10.00');
  assert.equal(winRate(3, 4), '75%');
  assert.equal(ratingTier(0).name, 'Bronze');
  assert.equal(ratingTier(2100).name, 'FGx Legend');
  assert.equal(ratingTier(1500).name, 'Diamond');
  assert.ok(formatDuration(90_000).includes('m'));
});

test('deepMerge merges nested objects and replaces arrays', () => {
  const base = { a: 1, nested: { x: 1, y: 2 }, list: [1, 2] };
  const merged = deepMerge(base, { nested: { y: 5 }, list: [9] });
  assert.equal(merged.a, 1);
  assert.equal(merged.nested.x, 1);
  assert.equal(merged.nested.y, 5);
  assert.deepEqual(merged.list, [9]);
});
