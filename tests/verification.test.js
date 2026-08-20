'use strict';

/* Copyright © 2026 FGx. All rights reserved. */

process.env.DISCORD_TOKEN = 'test-token';
process.env.DATABASE_PATH = ':memory:';

const test = require('node:test');
const assert = require('node:assert/strict');

// Fresh DB for tests.
const db = require('../src/database');
db.init();

const verificationService = require('../src/services/community/verificationService');
const economy = require('../src/services/community/economyService');
const { linksRepo } = require('../src/database/repos/profiles');
const { robloxLinksRepo } = require('../src/database/repos/roblox');
const { economyRepo } = require('../src/database/repos/economy');
const { parseCommand } = require('../src/services/community/chatCommands');

function seedFull(guildId, userId, username = 'ProPlayer') {
  linksRepo.create(guildId, userId, username);
  linksRepo.setStatus(guildId, userId, 'verified');
  robloxLinksRepo.create(guildId, userId, { robloxUsername: username, robloxId: 123456, code: 'ABC' });
  robloxLinksRepo.verify(guildId, userId);
}

test('verification level starts at none', () => {
  const s = verificationService.status('g1', 'u1');
  assert.equal(s.level, 'none');
  assert.equal(s.full, false);
});

test('basic = staff-approved BloxStrike link only', () => {
  linksRepo.create('g1', 'u2', 'EntryFragger');
  const pending = verificationService.status('g1', 'u2');
  assert.equal(pending.level, 'none');
  linksRepo.setStatus('g1', 'u2', 'verified');
  const s = verificationService.status('g1', 'u2');
  assert.equal(s.level, 'basic');
  assert.equal(s.basic, true);
  assert.equal(s.full, false);
});

test('roblox = verified Roblox account only; pending does not count', () => {
  robloxLinksRepo.create('g1', 'u3', { robloxUsername: 'Sniper', robloxId: 999, code: 'XYZ' });
  assert.equal(verificationService.status('g1', 'u3').level, 'none');
  robloxLinksRepo.verify('g1', 'u3');
  const s = verificationService.status('g1', 'u3');
  assert.equal(s.level, 'roblox');
  assert.equal(s.roblox, true);
  assert.equal(s.full, false);
});

test('full = BOTH link approved and Roblox verified', () => {
  seedFull('g1', 'u4');
  const s = verificationService.status('g1', 'u4');
  assert.equal(s.level, 'full');
  assert.equal(s.full, true);
  assert.equal(s.basic && s.roblox, true);
});

test('requireFull throws VIP_LOCKED for unverified members', () => {
  assert.throws(() => verificationService.requireFull('g1', 'u1'), (err) => err.code === 'VIP_LOCKED');
  const s = verificationService.requireFull('g1', 'u4');
  assert.equal(s.full, true);
});

test('vipDaily is locked without full verification', async () => {
  await assert.rejects(() => economy.vipDaily('g1', 'u1'), (err) => err.code === 'VIP_LOCKED');
});

test('vipDaily pays 250 once per day for full members', async () => {
  const before = economy.balance('g1', 'u4').balance;
  const r = await economy.vipDaily('g1', 'u4');
  assert.equal(r.amount, 250);
  assert.equal(r.balance, before + 250);
  await assert.rejects(() => economy.vipDaily('g1', 'u4'), (err) => err.code === 'ALREADY_CLAIMED');
  const tx = economyRepo.recentTx('g1', 'u4', 5).find((t) => t.kind === 'vip');
  assert.ok(tx);
  assert.equal(tx.note, 'VIP daily bonus (fully verified)');
});

test('parseCommand recognizes vip commands', () => {
  assert.deepEqual(parseCommand('vip'), { type: 'vipStatus' });
  assert.deepEqual(parseCommand('vip daily'), { type: 'vipDaily' });
  assert.deepEqual(parseCommand('vip check @u', ['u7']), { type: 'vipCheck', targetId: 'u7' });
  assert.deepEqual(parseCommand('vip status'), { type: 'vipCheck', targetId: null });
  assert.deepEqual(parseCommand('premium'), { type: 'vipStatus' });
});

test('statusLines communicates what is done and missing', () => {
  const lines = verificationService.statusLines(verificationService.status('g1', 'u1'));
  assert.ok(lines.some((l) => l.includes('⬜') && l.includes('/link')));
  assert.ok(lines.some((l) => l.includes('⬜') && l.includes('/roblox verify')));
  const fullLines = verificationService.statusLines(verificationService.status('g1', 'u4'));
  assert.ok(fullLines.some((l) => l.includes('👑')));
});
