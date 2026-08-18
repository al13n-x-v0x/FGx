'use strict';

/* Copyright © 2026 FGx. All rights reserved. */

process.env.DISCORD_TOKEN = 'test-token';
process.env.DATABASE_PATH = ':memory:';

const test = require('node:test');
const assert = require('node:assert/strict');

// Fresh DB for tests.
const db = require('../src/database');
db.init();

const { privateServersRepo } = require('../src/database/repos/privateServers');
const privateServerService = require('../src/services/clan/privateServerService');

test('mode info covers 1v1 through 6v6 plus practice', () => {
  for (const mode of ['1v1', '2v2', '3v3', '4v4', '5v5', '6v6', 'practice']) {
    const info = privateServerService.modeInfo(mode);
    assert.ok(info, `mode ${mode} should exist`);
    assert.ok(info.label);
  }
  assert.equal(privateServerService.modeInfo('9v9'), null);
  assert.equal(privateServerService.modeInfo('5v5').teams, 2);
  assert.equal(privateServerService.modeInfo('practice').teams, 1);
});

test('roblox verification gate rejects unverified users', () => {
  assert.equal(privateServerService.isRobloxVerified('g1', 'u1'), false);
  const { robloxLinksRepo } = require('../src/database/repos/roblox');
  robloxLinksRepo.create('g1', 'u1', { robloxUsername: 'Gate', robloxId: 9001, code: 'FGX-G' });
  robloxLinksRepo.verify('g1', 'u1');
  assert.equal(privateServerService.isRobloxVerified('g1', 'u1'), true);
  assert.equal(privateServerService.isRobloxVerified('g1', 'u2'), false);
});

test('staff bypasses the verification gate', () => {
  const member = { permissions: { has: (p) => p === 'ManageGuild' } };
  assert.equal(privateServerService.isStaff(member, {}), true);
  assert.equal(privateServerService.isStaff(null, null), false);
});

test('repo tracks private server lifecycle', () => {
  const record = privateServersRepo.create({
    guildId: 'g1',
    serverId: 'srv1',
    ownerId: 'u1',
    mode: '6v6',
    expiresAt: '2099-01-01T00:00:00.000Z',
  });
  assert.equal(record.status, 'active');
  assert.equal(record.mode, '6v6');

  const invite = privateServersRepo.setInvite('srv1', 'abc123');
  assert.equal(invite.invite_code, 'abc123');

  assert.equal(privateServersRepo.countActive('g1'), 1);
  assert.equal(privateServersRepo.countActiveByOwner('g1', 'u1'), 1);
  assert.equal(privateServersRepo.countActiveByOwner('g1', 'u2'), 0);
  assert.equal(privateServersRepo.listActive('g1').length, 1);
  assert.equal(privateServersRepo.listAllActive().length, 1);

  privateServersRepo.end('srv1');
  assert.equal(privateServersRepo.countActive('g1'), 0);
  assert.ok(privateServersRepo.getByServer('srv1').ended_at);
});

test('per-guild and per-owner limits are enforced by the service', async () => {
  for (let i = 0; i < privateServerService.MAX_ACTIVE_PER_GUILD; i += 1) {
    privateServersRepo.create({
      guildId: 'g2',
      serverId: `g2-srv${i}`,
      ownerId: `o${i}`,
      mode: '1v1',
      expiresAt: '2099-01-01T00:00:00.000Z',
    });
  }
  // 4th active server for the same guild exceeds the limit.
  const { robloxLinksRepo } = require('../src/database/repos/roblox');
  robloxLinksRepo.create('g2', 'late', { robloxUsername: 'Late', robloxId: 9002, code: 'FGX-L' });
  robloxLinksRepo.verify('g2', 'late');
  await assert.rejects(
    () =>
      privateServerService.create({}, { id: 'g2' }, { id: 'late' }, '1v1', 3, { member: null, config: {} }),
    (err) => err.code === 'GUILD_LIMIT',
  );
});
