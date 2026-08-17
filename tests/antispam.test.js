'use strict';

/* Copyright © 2026 FGx. All rights reserved. */

process.env.DISCORD_TOKEN = 'test-token';

const test = require('node:test');
const assert = require('node:assert/strict');

const { analyze, decideAction, getGuildState } = require('../src/services/security/antispam');

const CONFIG = {
  antispam: {
    enabled: true,
    maxMessages: 5,
    windowSeconds: 5,
    duplicateCount: 3,
    maxMentions: 10,
    maxEmojis: 15,
    capsRatio: 0.7,
    capsMinLength: 15,
    invitesEnabled: true,
    linksEnabled: true,
    linkWhitelist: [],
    purgeEnabled: true,
    action: 'DELETE',
  },
};

function message(content, { mentions = [], channelId = 'c1' } = {}) {
  return {
    content,
    channel: { id: channelId },
    author: { id: 'user-1' },
    guild: { id: 'guild-1' },
    mentions: { users: new Map(mentions.map((m) => [m, {}])) },
  };
}

test('clean message passes', () => {
  getGuildState('guild-1').delete('user-1');
  const result = analyze(message('hello world this is fine'), CONFIG);
  assert.equal(result.spammy, false);
});

test('mass mentions detected', () => {
  getGuildState('guild-1').delete('user-1');
  const mentions = Array.from({ length: 11 }, (_, i) => `u${i}`);
  const result = analyze(message('hi @everyone', { mentions }), CONFIG);
  assert.ok(result.violations.includes('mass mentions'));
});

test('invite link detected', () => {
  getGuildState('guild-1').delete('user-1');
  const result = analyze(message('join discord.gg/fgx'), CONFIG);
  assert.ok(result.violations.includes('invite link'));
});

test('excessive caps detected', () => {
  getGuildState('guild-1').delete('user-1');
  const result = analyze(message('AAAAAAAAAA BBBBBBBBBB CCCCCCCC'), CONFIG);
  assert.ok(result.violations.includes('excessive caps'));
});

test('flood detected across rapid messages', () => {
  getGuildState('guild-1').delete('user-1');
  for (let i = 0; i < 4; i += 1) analyze(message('rapid'), CONFIG);
  const fifth = analyze(message('rapid'), CONFIG);
  assert.ok(fifth.violations.includes('rapid messages'));
});

test('duplicate messages detected', () => {
  getGuildState('guild-1').delete('user-1');
  analyze(message('spam same'), CONFIG);
  analyze(message('spam same'), CONFIG);
  const third = analyze(message('spam same'), CONFIG);
  assert.ok(third.violations.includes('duplicate messages'));
});

test('progressive enforcement: warn then capped at configured ceiling (DELETE)', () => {
  getGuildState('guild-1').delete('user-1');
  const spam = { spammy: true, violations: ['flood'] };
  const d1 = decideAction('guild-1', 'user-1', spam, CONFIG);
  assert.equal(d1.action, 'warn');
  const d2 = decideAction('guild-1', 'user-1', spam, CONFIG);
  assert.equal(d2.action, 'delete');
  const d3 = decideAction('guild-1', 'user-1', spam, CONFIG);
  assert.equal(d3.action, 'delete'); // capped at DELETE ceiling
});

test('TIMEOUT ceiling unlocks the full ladder', () => {
  getGuildState('guild-1').delete('user-1');
  const config = { antispam: { ...CONFIG.antispam, action: 'TIMEOUT' } };
  const spam = { spammy: true, violations: ['flood'] };
  assert.equal(decideAction('guild-1', 'user-1', spam, config).action, 'warn');
  assert.equal(decideAction('guild-1', 'user-1', spam, config).action, 'delete');
  const third = decideAction('guild-1', 'user-1', spam, config);
  assert.equal(third.action, 'timeout');
  assert.equal(third.minutes, 10);
});

test('quiet period resets the escalation ladder', () => {
  getGuildState('guild-1').delete('user-1');
  const config = { antispam: { ...CONFIG.antispam, action: 'TIMEOUT' } };
  const spam = { spammy: true, violations: ['x'] };
  // Escalate to timeout in a burst.
  decideAction('guild-1', 'user-1', spam, config);
  decideAction('guild-1', 'user-1', spam, config);
  assert.equal(decideAction('guild-1', 'user-1', spam, config).action, 'timeout');

  // Simulate a quiet period, then the ladder restarts at warn.
  const entry = getGuildState('guild-1').get('user-1');
  entry.lastPunished = Date.now() - 120_000;
  const afterQuiet = decideAction('guild-1', 'user-1', spam, config);
  assert.equal(afterQuiet.action, 'warn');
});
