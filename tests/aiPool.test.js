'use strict';

/* Copyright © 2026 FGx. All rights reserved. */

process.env.DISCORD_TOKEN = 'test-token';

const test = require('node:test');
const assert = require('node:assert/strict');

const { env, keyList, modelList, aiSummary, configuredProviders, fallbackProviders } = require('../src/config/env');
const { buildPool, candidateOrder } = require('../src/services/ai/client');

test('keyList parses comma-separated keys with fallback to single key', () => {
  const original = { ...env };
  try {
    env.GROQ_KEYS = 'k1, k2 ,k3';
    env.GROQ_API_KEY = 'ignored';
    assert.deepEqual(keyList('groq'), ['k1', 'k2', 'k3']);

    env.GROQ_KEYS = '';
    env.GROQ_API_KEY = 'single';
    assert.deepEqual(keyList('groq'), ['single']);
  } finally {
    Object.assign(env, original);
  }
});

test('modelList parses comma-separated models', () => {
  const original = { ...env };
  try {
    env.GEMINI_MODELS = 'm1,m2';
    env.GEMINI_MODEL = 'ignored';
    assert.deepEqual(modelList('gemini'), ['m1', 'm2']);

    env.GEMINI_MODELS = '';
    env.GEMINI_MODEL = 'single';
    assert.deepEqual(modelList('gemini'), ['single']);
  } finally {
    Object.assign(env, original);
  }
});

test('buildPool pairs keys with models by index', () => {
  const original = { ...env };
  try {
    env.GROQ_KEYS = 'k1,k2,k3';
    env.GROQ_MODELS = 'm1,m2';
    const pool = buildPool('groq');
    assert.equal(pool.length, 3);
    assert.deepEqual(
      pool.map((e) => `${e.key}:${e.model}`),
      ['k1:m1', 'k2:m2', 'k3:m1'], // models repeat when fewer than keys
    );
  } finally {
    Object.assign(env, original);
  }
});

test('candidateOrder failover always starts at the primary', () => {
  assert.deepEqual(candidateOrder(3, 'failover', 5), [0, 1, 2]);
});

test('candidateOrder roundrobin rotates the start', () => {
  assert.deepEqual(candidateOrder(3, 'roundrobin', 0), [0, 1, 2]);
  assert.deepEqual(candidateOrder(3, 'roundrobin', 2), [2, 0, 1]);
});

test('candidateOrder shuffle stays within bounds and covers all candidates', () => {
  const order = candidateOrder(4, 'shuffle');
  assert.equal(order.length, 4);
  assert.deepEqual([...order].sort(), [0, 1, 2, 3]);
});

test('aiSummary reflects key/model counts', () => {
  const original = { ...env };
  try {
    env.AI_PROVIDER = 'groq';
    env.GROQ_KEYS = 'k1,k2';
    env.GROQ_MODELS = 'm1,m2';
    env.AI_FAILOVER_MODE = 'shuffle';
    const summary = aiSummary();
    assert.ok(summary.includes('Groq'));
    assert.ok(summary.includes('2 models'));
    assert.ok(summary.includes('2 keys'));
    assert.ok(summary.includes('shuffle'));
  } finally {
    Object.assign(env, original);
  }
});

test('configuredProviders lists only providers with keys, in auto-detect order', () => {
  const original = { ...env };
  try {
    env.AI_PROVIDER = '';
    env.AI_KEYS = '';
    env.AI_API_KEY = '';
    env.GROQ_KEYS = 'g1';
    env.GROQ_API_KEY = '';
    env.GEMINI_KEYS = '';
    env.GEMINI_API_KEY = 'gem1';
    assert.deepEqual(configuredProviders(), ['groq', 'gemini']);
  } finally {
    Object.assign(env, original);
  }
});

test('fallbackProviders excludes the resolved primary', () => {
  const original = { ...env };
  try {
    env.AI_PROVIDER = 'gemini';
    env.GROQ_KEYS = 'g1';
    env.GROQ_API_KEY = '';
    env.GEMINI_KEYS = '';
    env.GEMINI_API_KEY = 'gem1';
    assert.deepEqual(fallbackProviders(), ['groq']);
    assert.ok(aiSummary().includes('fallback: Groq'));
  } finally {
    Object.assign(env, original);
  }
});
