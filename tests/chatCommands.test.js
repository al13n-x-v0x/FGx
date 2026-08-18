'use strict';

/* Copyright © 2026 FGx. All rights reserved. */

process.env.DISCORD_TOKEN = 'test-token';

const test = require('node:test');
const assert = require('node:assert/strict');

const { stripPrefix, stripBangPrefix, parseCommand, parseAmount } = require('../src/services/community/chatCommands');

test('stripPrefix accepts "fgx ..." (case-insensitive) and bot mentions', () => {
  assert.equal(stripPrefix('fgx daily', '123'), 'daily');
  assert.equal(stripPrefix('FGX coinflip 50', '123'), 'coinflip 50');
  assert.equal(stripPrefix('fgx   wallet', '123'), 'wallet');
  assert.equal(stripPrefix('<@123> daily', '123'), 'daily');
  assert.equal(stripPrefix('<@!123> transfer @u 5', '123'), 'transfer @u 5');
  assert.equal(stripPrefix('hello there', '123'), null);
  assert.equal(stripPrefix('', '123'), null);
});

test('stripBangPrefix accepts OwO-style "!" commands', () => {
  assert.equal(stripBangPrefix('!bal'), 'bal');
  assert.equal(stripBangPrefix('!daily'), 'daily');
  assert.equal(stripBangPrefix('!coinflip 50 heads'), 'coinflip 50 heads');
  assert.equal(stripBangPrefix('!  daily'), 'daily');
  assert.equal(stripBangPrefix('hello'), null);
  assert.equal(stripBangPrefix('!'), null);
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

test('parseCommand parses coinflip amounts, "all" and heads/tails picks', () => {
  assert.deepEqual(parseCommand('coinflip 50'), { type: 'coinflip', all: false, pick: null, amount: 50, raw: '50' });
  assert.deepEqual(parseCommand('cf 1,000'), { type: 'coinflip', all: false, pick: null, amount: 1000, raw: '1,000' });
  assert.deepEqual(parseCommand('gamble all'), { type: 'coinflip', all: true, pick: null, amount: null, raw: 'all' });
  assert.deepEqual(parseCommand('flip'), { type: 'coinflip', all: false, pick: null, amount: null, raw: '' });
  assert.deepEqual(parseCommand('coinflip abc'), { type: 'coinflip', all: false, pick: null, amount: null, raw: 'abc' });
  assert.deepEqual(parseCommand('coinflip 50 heads'), { type: 'coinflip', all: false, pick: 'heads', amount: 50, raw: '50 heads' });
  assert.deepEqual(parseCommand('coinflip tails all'), { type: 'coinflip', all: true, pick: 'tails', amount: null, raw: 'tails all' });
  assert.deepEqual(parseCommand('cf 100 t'), { type: 'coinflip', all: false, pick: 'tails', amount: 100, raw: '100 t' });
  assert.deepEqual(parseCommand('coinflip heads'), { type: 'coinflip', all: false, pick: 'heads', amount: null, raw: 'heads' });
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
  assert.equal(parseCommand('fishing').type, 'unknown');
});

test('parseCommand maps server commands to hub sections', () => {
  assert.deepEqual(parseCommand('scrims'), { type: 'section', section: 'scrims' });
  assert.deepEqual(parseCommand('stats'), { type: 'section', section: 'stats' });
  assert.deepEqual(parseCommand('roster'), { type: 'section', section: 'roster' });
  assert.deepEqual(parseCommand('loadout'), { type: 'section', section: 'loadouts' });
  assert.deepEqual(parseCommand('wars'), { type: 'section', section: 'clanwars' });
  assert.deepEqual(parseCommand('events'), { type: 'section', section: 'events' });
  assert.deepEqual(parseCommand('roblox'), { type: 'section', section: 'roblox' });
  assert.deepEqual(parseCommand('security'), { type: 'section', section: 'security' });
  assert.deepEqual(parseCommand('tryout'), { type: 'section', section: 'tryouts' });
  assert.deepEqual(parseCommand('lb'), { type: 'section', section: 'leaderboards' });
});

test('parseCommand handles profile mentions, ping and status', () => {
  assert.deepEqual(parseCommand('profile'), { type: 'profile', targetId: null });
  assert.deepEqual(parseCommand('profile', ['u5']), { type: 'profile', targetId: 'u5' });
  assert.deepEqual(parseCommand('ping'), { type: 'ping' });
  assert.deepEqual(parseCommand('status'), { type: 'status' });
});

test('parseCommand parses history with mentions and counts', () => {
  assert.deepEqual(parseCommand('history'), { type: 'history', targetId: null, count: 10 });
  assert.deepEqual(parseCommand('history 25'), { type: 'history', targetId: null, count: 25 });
  assert.deepEqual(parseCommand('history 500'), { type: 'history', targetId: null, count: 25 }); // clamped
  assert.deepEqual(parseCommand('logs @u 15', ['u8']), { type: 'history', targetId: 'u8', count: 15 });
  assert.deepEqual(parseCommand('tx'), { type: 'history', targetId: null, count: 10 });
});

test('parseAmount accepts whole numbers only', () => {
  assert.equal(parseAmount('42'), 42);
  assert.equal(parseAmount('4,200'), 4200);
  assert.equal(parseAmount('0'), null);
  assert.equal(parseAmount('-5'), null);
  assert.equal(parseAmount('3.5'), null);
  assert.equal(parseAmount('banana'), null);
});
