'use strict';

/* Copyright © 2026 FGx. All rights reserved. */

process.env.DISCORD_TOKEN = 'test-token';

const test = require('node:test');
const assert = require('node:assert/strict');

const { hasProfanity, WORDS } = require('../src/data/profanity');
const { RANKS, STAFF_RANKS, RANK_ORDER } = require('../src/config/constants');

test('profanity detector matches strong profanity', () => {
  for (const word of ['fuck', 'shit', 'bitch', 'fucking', 'bullshit', 'cunt', 'dickhead', 'shitting']) {
    assert.ok(hasProfanity(`you are a ${word}`), `should match: ${word}`);
    assert.ok(hasProfanity(word), `bare ${word} should match`);
  }
});

test('profanity detector matches leetspeak variants', () => {
  assert.ok(hasProfanity('f*ck you'));
  assert.ok(hasProfanity('sh!t happens'));
  assert.ok(hasProfanity('b*tch please'));
});

test('profanity detector ignores innocent words (no false positives)', () => {
  for (const phrase of [
    'this is a class assignment',
    'please enter your password',
    'he made a great pass',
    'green grass grows',
    'scunthorpe united',
    'I love this game',
    'the shipment arrived early',
  ]) {
    assert.equal(hasProfanity(phrase), false, `should NOT match: ${phrase}`);
  }
});

test('profanity list is non-empty and regex compiles', () => {
  assert.ok(WORDS.length > 20);
  assert.ok(/fuck/i.test(WORDS.join('|')));
});

test('Co-Owner rank sits between Leader and Owner', () => {
  assert.ok(RANKS.includes('Co-Owner'));
  assert.ok(RANKS.includes('Owner'));
  assert.ok(RANK_ORDER['leader'] < RANK_ORDER['co-owner']);
  assert.ok(RANK_ORDER['co-owner'] < RANK_ORDER['owner']);
  assert.ok(STAFF_RANKS.includes('co-owner'));
});
