'use strict';

/* Copyright © 2026 FGx. All rights reserved. */

process.env.DISCORD_TOKEN = 'test-token';
process.env.DATABASE_PATH = ':memory:';

const test = require('node:test');
const assert = require('node:assert/strict');

// Fresh DB for tests.
const db = require('../src/database');
db.init();

const { robloxLinksRepo } = require('../src/database/repos/roblox');
const { achievementsRepo } = require('../src/database/repos/profiles');
const robloxService = require('../src/services/community/robloxService');

test('roblox link starts pending with a code', () => {
  const link = robloxLinksRepo.create('g1', 'u1', {
    robloxUsername: 'Notch',
    robloxId: 123456,
    code: 'FGX-ABC',
  });
  assert.equal(link.status, 'pending');
  assert.equal(link.code, 'FGX-ABC');
  assert.equal(link.roblox_username, 'Notch');
});

test('verification flips status and clears the code', () => {
  const link = robloxLinksRepo.verify('g1', 'u1');
  assert.equal(link.status, 'verified');
  assert.equal(link.code, null);
  assert.ok(link.verified_at);
});

test('a Roblox account cannot be claimed by a second Discord user', () => {
  robloxLinksRepo.create('g1', 'u2', {
    robloxUsername: 'Builderman',
    robloxId: 654321,
    code: 'FGX-DEF',
  });
  // The same Roblox ID used by the first (verified) link must be rejected.
  assert.throws(
    () =>
      robloxLinksRepo.create('g1', 'u2', {
        robloxUsername: 'Notch',
        robloxId: 123456,
        code: 'FGX-GHI',
      }),
    (err) => err.code === 'DUPLICATE_ROBLOX',
  );
});

test('re-linking the same Discord user resets to pending', () => {
  const relink = robloxLinksRepo.create('g1', 'u1', {
    robloxUsername: 'Notch2',
    robloxId: 123456,
    code: 'FGX-NEW',
  });
  assert.equal(relink.status, 'pending');
  assert.equal(relink.roblox_username, 'Notch2');
});

test('unlink removes the row and verified count tracks properly', () => {
  robloxLinksRepo.verify('g1', 'u1');
  robloxLinksRepo.verify('g1', 'u2');
  assert.equal(robloxLinksRepo.countVerified('g1'), 2);
  robloxLinksRepo.remove('g1', 'u1');
  assert.equal(robloxLinksRepo.get('g1', 'u1'), undefined);
  assert.equal(robloxLinksRepo.countVerified('g1'), 1);
});

test('roblox verification is scoped per guild', () => {
  const link = robloxLinksRepo.create('g2', 'u1', {
    robloxUsername: 'Shedletsky',
    robloxId: 777777,
    code: 'FGX-OTHER',
  });
  assert.equal(link.roblox_username, 'Shedletsky');
  // Same Roblox account is fine in a different guild.
  assert.doesNotThrow(() =>
    robloxLinksRepo.create('g2', 'u9', {
      robloxUsername: 'Notch',
      robloxId: 123456,
      code: 'FGX-X',
    }),
  );
});

test('verification codes are FGx-prefixed, unambiguous, and unique-ish', () => {
  const seen = new Set();
  for (let i = 0; i < 200; i += 1) {
    const code = robloxService.generateCode();
    assert.match(code, /^FGX-[A-HJ-NP-Z2-9]{6}$/);
    seen.add(code);
  }
  assert.ok(seen.size > 190, 'codes should be effectively unique');
});

test('blurb code check is case-insensitive and ignores surrounding text', () => {
  assert.ok(robloxService.blurbHasCode('my code is fgx-k7m2qz hello', 'FGX-K7M2QZ'));
  assert.ok(robloxService.blurbHasCode('FGX-K7M2QZ', 'fgx-k7m2qz'));
  assert.equal(robloxService.blurbHasCode('my code is FGX-K7M2QY', 'FGX-K7M2QZ'), false);
  assert.equal(robloxService.blurbHasCode('', 'FGX-K7M2QZ'), false);
});

test('username resolution parses the Roblox API response (injected fetch)', async () => {
  const realFetch = globalThis.fetch;
  robloxService._setFetch(async () => ({
    ok: true,
    json: async () => ({ data: [{ id: 424242, name: 'TestUser', displayName: 'TestUser' }] }),
  }));
  try {
    const resolved = await robloxService.resolveUsername('TestUser');
    assert.equal(resolved.id, 424242);
    assert.equal(resolved.name, 'TestUser');
  } finally {
    robloxService._setFetch(realFetch);
  }
});

test('username resolution returns null for unknown accounts', async () => {
  const realFetch = globalThis.fetch;
  robloxService._setFetch(async () => ({ ok: true, json: async () => ({ data: [] }) }));
  try {
    const resolved = await robloxService.resolveUsername('Nobody_Has_This_Name');
    assert.equal(resolved, null);
  } finally {
    robloxService._setFetch(realFetch);
  }
});

test('verified list excludes pending links and orders by recency', () => {
  // g3: u1 verified first, u2 pending, u3 verified second.
  robloxLinksRepo.create('g3', 'u1', { robloxUsername: 'First', robloxId: 111, code: 'FGX-A' });
  robloxLinksRepo.create('g3', 'u2', { robloxUsername: 'Pending', robloxId: 222, code: 'FGX-B' });
  robloxLinksRepo.create('g3', 'u3', { robloxUsername: 'Second', robloxId: 333, code: 'FGX-C' });
  robloxLinksRepo.verify('g3', 'u1');
  robloxLinksRepo.verify('g3', 'u3');
  const verified = robloxLinksRepo.listVerified('g3');
  assert.equal(verified.length, 2);
  // Most recently verified first.
  assert.equal(verified[0].user_id, 'u3');
  assert.equal(verified[1].user_id, 'u1');
  assert.equal(robloxService.countVerified('g3'), 2);
});

test('pioneer achievement unlocks only for the first 50 verifiers', () => {
  for (let i = 0; i < 55; i += 1) {
    robloxLinksRepo.create('g4', `p${i}`, {
      robloxUsername: `User${i}`,
      robloxId: 2000 + i,
      code: `FGX-P${i}`,
    });
    robloxLinksRepo.verify('g4', `p${i}`);
    robloxService.unlockRobloxAchievements('g4', `p${i}`);
  }
  // Everyone gets roblox_verified; only ranks 1–50 get pioneer.
  assert.ok(achievementsRepo.has('g4', 'p0', 'roblox_verified'));
  assert.ok(achievementsRepo.has('g4', 'p54', 'roblox_verified'));
  assert.ok(achievementsRepo.has('g4', 'p0', 'roblox_pioneer'));
  assert.ok(achievementsRepo.has('g4', 'p49', 'roblox_pioneer'));
  assert.equal(achievementsRepo.has('g4', 'p50', 'roblox_pioneer'), false);
  assert.equal(achievementsRepo.has('g4', 'p54', 'roblox_pioneer'), false);
});

test('re-verification does not double-unlock achievements', () => {
  // p0 already has both achievements; unlocking again returns nothing new.
  const newly = robloxService.unlockRobloxAchievements('g4', 'p0');
  assert.deepEqual(newly, []);
});
