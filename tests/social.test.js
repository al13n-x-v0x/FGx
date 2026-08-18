'use strict';

/* Copyright © 2026 FGx. All rights reserved. */

process.env.DISCORD_TOKEN = 'test-token';
process.env.DATABASE_PATH = ':memory:';

const test = require('node:test');
const assert = require('node:assert/strict');

// Fresh DB for tests.
const db = require('../src/database');
db.init();

const { socialService } = require('../src/services/community/socialService');
const { socialRepo } = require('../src/database/repos/social');
const socialViews = require('../src/services/community/socialViews');
const { parseCommand } = require('../src/services/community/chatCommands');

test('interact bumps the per-pair counter for a kind', () => {
  const a = socialService.interact('g1', 'u1', 'u2', 'slap', 'Bob');
  assert.equal(a.kind, 'slap');
  assert.equal(a.count, 1);
  assert.ok(a.line.includes('Bob'));
  const b = socialService.interact('g1', 'u1', 'u2', 'slap', 'Bob');
  assert.equal(b.count, 2);
});

test('different kinds and reverse direction are tracked separately', () => {
  socialService.interact('g1', 'u1', 'u2', 'hug', 'Bob');
  socialService.interact('g1', 'u2', 'u1', 'slap', 'Alice');
  const s1 = socialService.stats('g1', 'u1');
  assert.equal(s1.dealt.hug, 1);
  assert.equal(s1.received.slap, 1);
  const s2 = socialService.stats('g1', 'u2');
  assert.equal(s2.dealt.slap, 1);
  assert.equal(s2.received.hug, 1);
});

test('lifetime counts every interaction in either role', () => {
  const before = socialService.lifetime('g1', 'u1');
  socialService.interact('g1', 'u1', 'u2', 'poke', 'Bob');
  socialService.interact('g1', 'u2', 'u1', 'poke', 'Alice');
  assert.equal(socialService.lifetime('g1', 'u1'), before + 2);
});

test('self-interaction is allowed (OwO-style)', () => {
  const r = socialService.interact('g1', 'u9', 'u9', 'pat', 'u9');
  assert.equal(r.count, 1);
  assert.equal(socialService.stats('g1', 'u9').dealt.pat, 1);
});

test('line selection is deterministic with injected rng', () => {
  const zero = socialService.interact('g1', 'u1', 'u2', 'slap', 'Bob', () => 0);
  const near = socialService.interact('g1', 'u1', 'u2', 'slap', 'Bob', () => 0.999);
  assert.notEqual(zero.line, near.line);
  assert.ok(zero.line.includes('Bob') && near.line.includes('Bob'));
});

test('unknown kinds throw a typed error', () => {
  assert.throws(() => socialService.interact('g1', 'u1', 'u2', 'yeet', 'Bob'), (err) => err.code === 'UNKNOWN_KIND');
});

test('top returns the biggest slappers', () => {
  socialService.interact('g2', 'x1', 'x2', 'slap', 'B');
  socialService.interact('g2', 'x1', 'x3', 'slap', 'B');
  socialService.interact('g2', 'x1', 'x4', 'slap', 'B');
  socialService.interact('g2', 'x2', 'x1', 'slap', 'B');
  const t = socialService.top('g2', 'slap', 2);
  assert.equal(t[0].actor_id, 'x1');
  assert.equal(t[0].total, 3);
  assert.equal(t.length, 2);
});

test('views render counts and stats', () => {
  const r = socialService.interact('g4', 'u1', 'u2', 'slap', 'Bob');
  const e = socialViews.interactionEmbed(r, 'Bob');
  assert.ok(e.description.includes('#1'));
  assert.ok(e.description.includes('Bob'));
  const s = socialViews.statsEmbed('Bob', socialService.stats('g4', 'u2'));
  assert.ok(s.description.includes('Lifetime interactions'));
});

test('parseCommand recognizes social commands', () => {
  assert.deepEqual(parseCommand('slap @u', ['u7']), { type: 'social', kind: 'slap', targetId: 'u7' });
  assert.deepEqual(parseCommand('hug @u', ['u7']), { type: 'social', kind: 'hug', targetId: 'u7' });
  assert.deepEqual(parseCommand('kiss @u', ['u7']), { type: 'social', kind: 'kiss', targetId: 'u7' });
  assert.deepEqual(parseCommand('poke'), { type: 'social', kind: 'poke', targetId: null });
  assert.deepEqual(parseCommand('social @u', ['u7']), { type: 'socialStats', targetId: 'u7' });
  assert.deepEqual(parseCommand('social'), { type: 'socialStats', targetId: null });
});

test('socialRepo between exposes pair counts both ways', () => {
  socialRepo.add('g5', 'u1', 'u2', 'slap');
  socialRepo.add('g5', 'u2', 'u1', 'slap');
  socialRepo.add('g5', 'u1', 'u2', 'slap');
  const b = socialRepo.between('g5', 'u1', 'u2', 'slap');
  assert.equal(b.u1, 2);
  assert.equal(b.u2, 1);
});
