'use strict';

/* Copyright © 2026 FGx. All rights reserved. */

process.env.DISCORD_TOKEN = 'test-token';

const test = require('node:test');
const assert = require('node:assert/strict');

const {
  OVERVIEW,
  ROLES,
  BUY_SITUATIONS,
  UTILITY,
  ECONOMY,
  TEAMPLAY,
  systemPromptSection,
} = require('../src/data/bloxstrike');

test('knowledge base sections are populated', () => {
  assert.ok(OVERVIEW.length > 50);
  assert.ok(ROLES.length >= 5);
  assert.ok(BUY_SITUATIONS.length >= 4);
  assert.ok(UTILITY.length >= 3);
  assert.ok(ECONOMY.length >= 3);
  assert.ok(TEAMPLAY.length >= 3);
});

test('every role and buy situation has a loadout/plan', () => {
  for (const r of ROLES) {
    assert.ok(r.role && r.loadout && r.tips, `role missing fields: ${JSON.stringify(r)}`);
  }
  for (const b of BUY_SITUATIONS) {
    assert.ok(b.situation && b.plan, `buy situation missing fields: ${JSON.stringify(b)}`);
  }
});

test('systemPromptSection covers loadouts, roles, economy, and utility', () => {
  const section = systemPromptSection();
  assert.ok(section.includes('Entry Fragger'));
  assert.ok(section.includes('Full buy'));
  assert.ok(section.includes('Smoke'));
  assert.ok(section.includes('Economy'));
  assert.ok(section.toLowerCase().includes('credits'));
  assert.ok(section.length < 4000, 'keep the system prompt compact');
});
