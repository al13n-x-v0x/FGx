'use strict';

/* Copyright © 2026 FGx. All rights reserved. */

process.env.DISCORD_TOKEN = 'test-token';

const test = require('node:test');
const assert = require('node:assert/strict');

const { shuffleTeams, parsePlayerList, teamSizeFromFormat } = require('../src/services/clan/shuffleService');

test('shuffleTeams splits into even teams by teamSize', () => {
  const players = Array.from({ length: 10 }, (_, i) => `u${i}`);
  const teams = shuffleTeams(players, { teamSize: 5 });
  assert.equal(teams.length, 2);
  assert.deepEqual(teams.map((t) => t.length), [5, 5]);

  // Every player appears exactly once.
  const flat = teams.flat().sort();
  assert.deepEqual(flat, players.sort());
});

test('shuffleTeams balances when count does not divide evenly', () => {
  const players = Array.from({ length: 10 }, (_, i) => `u${i}`);
  const teams = shuffleTeams(players, { teamCount: 4 });
  assert.equal(teams.length, 4);
  const lengths = teams.map((t) => t.length).sort((a, b) => a - b);
  assert.ok(Math.max(...lengths) - Math.min(...lengths) <= 1);
});

test('shuffleTeams defaults to ~5 per team', () => {
  const players = Array.from({ length: 7 }, (_, i) => `u${i}`);
  const teams = shuffleTeams(players, {});
  assert.deepEqual(teams.map((t) => t.length).sort((a, b) => a - b), [3, 4]);
});

test('shuffleTeams rejects fewer than 2 players', () => {
  assert.throws(() => shuffleTeams(['only-one'], {}), (err) => err.code === 'TOO_FEW');
});

test('shuffleTeams is random but deterministic in coverage', () => {
  const players = Array.from({ length: 12 }, (_, i) => `u${i}`);
  const results = new Set();
  for (let i = 0; i < 20; i += 1) {
    const teams = shuffleTeams(players, { teamSize: 4 });
    results.add(teams.map((t) => t.join(',')).join('|'));
  }
  // 20 shuffles of 12 players should produce more than one arrangement.
  assert.ok(results.size > 1);
});

test('parsePlayerList extracts mentions and raw IDs', () => {
  const ids = parsePlayerList('<@123456789012345678> 987654321098765432 <@!111111111111111111>');
  assert.deepEqual(ids.sort(), ['111111111111111111', '123456789012345678', '987654321098765432']);
});

test('parsePlayerList ignores non-ID text', () => {
  const ids = parsePlayerList('hello there, nobody here');
  assert.deepEqual(ids, []);
});

test('teamSizeFromFormat reads 5v5 style formats', () => {
  assert.equal(teamSizeFromFormat('5v5'), 5);
  assert.equal(teamSizeFromFormat('3v3 quick match'), 3);
  assert.equal(teamSizeFromFormat('custom'), null);
});
