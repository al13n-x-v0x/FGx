'use strict';

/* Copyright © 2026 FGx. All rights reserved. */

process.env.DISCORD_TOKEN = 'test-token';
process.env.DATABASE_PATH = ':memory:';

const test = require('node:test');
const assert = require('node:assert/strict');

// Fresh DB for tests.
const db = require('../src/database');
db.init();

const { requireStaff, requireLeadership } = require('../src/services/clan/rosterService');
const privateServerService = require('../src/services/clan/privateServerService');

function memberWith(perms) {
  return { permissions: { has: (p) => perms.includes(p) } };
}

test('Manage Messages ("delete others\' messages") counts as staff', () => {
  assert.doesNotThrow(() => requireStaff(memberWith(['ManageMessages']), {}));
  assert.doesNotThrow(() => requireStaff(memberWith(['ManageGuild']), {}));
  assert.doesNotThrow(() => requireStaff(memberWith(['ManageMessages', 'KickMembers']), {}));
});

test('members without staff permissions are rejected', () => {
  assert.throws(() => requireStaff(memberWith([]), {}));
  assert.throws(() => requireStaff(memberWith(['KickMembers', 'BanMembers']), {}));
});

test('Manage Messages also unlocks leadership commands', () => {
  assert.doesNotThrow(() => requireLeadership(memberWith(['ManageMessages']), {}));
  assert.throws(() => requireLeadership(memberWith([]), {}));
});

test('private server staff bypass accepts Manage Messages holders', () => {
  assert.equal(privateServerService.isStaff(memberWith(['ManageMessages']), {}), true);
  assert.equal(privateServerService.isStaff(memberWith(['ManageGuild']), {}), true);
  assert.equal(privateServerService.isStaff(memberWith([]), {}), false);
});
