'use strict';

/* Copyright © 2026 FGx. All rights reserved. */

/**
 * Quick AI helper for fun commands (roast, compliment, insult).
 * Has a tighter timeout so commands never get stuck on "thinking...".
 */

const { chatCompletion } = require('./client');

/**
 * Quick AI call with a 15s timeout — used for fun commands.
 * Falls back to null if it fails, so the caller can use curated responses.
 */
async function quickAI(system, prompt, { maxTokens = 300, temperature = 0.8 } = {}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 15_000);

  try {
    const result = await chatCompletion({
      system,
      messages: [{ role: 'user', content: prompt }],
      maxTokens,
      temperature,
    });
    return result?.replace(/^["']|["']$/g, '').trim() || null;
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

module.exports = { quickAI };
