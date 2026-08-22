'use strict';

/* Copyright © 2026 FGx. All rights reserved. */

process.env.DISCORD_TOKEN = 'test-token';

const test = require('node:test');
const assert = require('node:assert/strict');

const { env, resolveProvider, providerLabel, aiConfigured, AI_PROVIDERS } = require('../src/config/env');

test('provider list matches the four supported providers', () => {
  assert.deepEqual(AI_PROVIDERS.sort(), ['gemini', 'groq', 'ollama', 'openai']);
});

test('explicit AI_PROVIDER wins over keys', () => {
  const original = { ...env };
  try {
    env.AI_PROVIDER = 'gemini';
    env.GROQ_API_KEY = 'gsk_test';
    assert.equal(resolveProvider(), 'gemini');
    assert.equal(providerLabel(), 'Gemini');
  } finally {
    Object.assign(env, original);
  }
});

test('auto-detect prefers the first configured key', () => {
  const original = { ...env };
  try {
    env.AI_PROVIDER = '';
    env.AI_API_KEY = '';
    env.AI_KEYS = '';
    env.GROQ_API_KEY = 'gsk_test';
    env.GROQ_KEYS = '';
    env.GEMINI_API_KEY = '';
    env.GEMINI_KEYS = '';
    assert.equal(resolveProvider(), 'groq');
    assert.equal(providerLabel(), 'Groq');

    env.GROQ_API_KEY = '';
    env.GEMINI_API_KEY = 'gem-test';
    assert.equal(resolveProvider(), 'gemini');

    env.GEMINI_API_KEY = '';
    assert.equal(resolveProvider(), null);
    assert.equal(aiConfigured(), false);
  } finally {
    Object.assign(env, original);
  }
});

test('invalid AI_PROVIDER throws', () => {
  const original = env.AI_PROVIDER;
  try {
    env.AI_PROVIDER = 'claude';
    assert.throws(() => resolveProvider(), /AI_PROVIDER/);
  } finally {
    env.AI_PROVIDER = original;
  }
});
