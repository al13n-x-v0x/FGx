'use strict';

/* Copyright © 2026 FGx. All rights reserved. */

process.env.DISCORD_TOKEN = 'test-token';

const test = require('node:test');
const assert = require('node:assert/strict');

const { stripPrefix, parseCommand, parseAmount } = require('../src/services/community/chatCommands');

test('stripPrefix accepts "fgx ..." (case-insensitive) and bot mentions', () => {
  assert.equal(stripPrefix('fgx daily', '123'), 'daily');
  assert.equal(stripPrefix('FGX coinflip 50', '123'), 'coinflip 50');
  assert.equal(stripPrefix('fgx   wallet', '123'), 'wallet');
  assert.equal(stripPrefix('<@123> daily', '123'), 'daily');
  assert.equal(stripPrefix('<@!123> transfer @u 5', '123'), 'transfer @u 5');
  assert.equal(stripPrefix('hello there', '123'), null);
  assert.equal(stripPrefix('', '123'), null);
});

test('parseCommand covers daily, weekly and wallet', () => {
  assert.deepEqual(parseCommand('daily'), { type: 'daily' });
  assert.deepEqual(parseCommand('weekly'), { type: 'weekly' });
  assert.deepEqual(parseCommand('wallet'), { type: 'wallet', targetId: null });
  assert.deepEqual(parseCommand('wallet', ['u9']), { type: 'wallet', targetId: 'u9' });
  assert.deepEqual(parseCommand('bal'), { type: 'wallet', targetId: null });
  assert.deepEqual(parseCommand('help'), { type: 'help' });
  assert.deepEqual(parseCommand(''), { type: 'help' });
});

test('parseCommand parses coinflip amounts and "all"', () => {
  assert.deepEqual(parseCommand('coinflip 50'), { type: 'gamble', all: false, amount: 50, raw: '50' });
  assert.deepEqual(parseCommand('cf 1,000'), { type: 'gamble', all: false, amount: 1000, raw: '1,000' });
  assert.deepEqual(parseCommand('gamble all'), { type: 'gamble', all: true, amount: null, raw: 'all' });
  assert.deepEqual(parseCommand('flip'), { type: 'gamble', all: false, amount: null, raw: '' });
  assert.deepEqual(parseCommand('coinflip abc'), { type: 'gamble', all: false, amount: null, raw: 'abc' });
});

test('parseCommand parses transfers with mentions and amounts', () => {
  assert.deepEqual(parseCommand('transfer @u 100', ['u7']), {
    type: 'transfer',
    targetId: 'u7',
    amount: 100,
    raw: '@u 100',
  });
  assert.deepEqual(parseCommand('pay @u 0', ['u7']), {
    type: 'transfer',
    targetId: 'u7',
    amount: null,
    raw: '@u 0',
  });
  assert.deepEqual(parseCommand('give 50'), { type: 'transfer', targetId: null, amount: 50, raw: '50' });
});

test('parseCommand clamps the top-count and rejects unknown commands', () => {
  assert.deepEqual(parseCommand('top'), { type: 'top', count: 10 });
  assert.deepEqual(parseCommand('top 100'), { type: 'top', count: 15 });
  assert.equal(parseCommand('hunt').type, 'unknown');
});

test('parseAmount accepts whole numbers only', () => {
  assert.equal(parseAmount('42'), 42);
  assert.equal(parseAmount('4,200'), 4200);
  assert.equal(parseAmount('0'), null);
  assert.equal(parseAmount('-5'), null);
  assert.equal(parseAmount('3.5'), null);
  assert.equal(parseAmount('banana'), null);
});
