'use strict';

/*
 * Copyright © 2026 FGx.
 * All rights reserved.
 */

const { env, aiConfigured, aiTimeoutMs, resolveProvider, keyList, modelList } = require('../../config/env');
const { logger } = require('../../utils/logger');

/**
 * Provider-agnostic AI client (fetch-based, no SDK) with resilience.
 *
 * Supported providers (selected by AI_PROVIDER or auto-detected from keys):
 *  - openai : OpenAI-compatible /chat/completions (OpenAI, OpenRouter, Azure,
 *             local Ollama, …) via AI_BASE_URL
 *  - gemini : Google Gemini generateContent API
 *  - groq   : Groq (OpenAI-compatible)
 *
 * Key & model shuffling: each provider can have multiple API keys
 * (AI_KEYS / GEMINI_KEYS / GROQ_KEYS) and multiple models (AI_MODELS /
 * GEMINI_MODELS / GROQ_MODELS). AI_FAILOVER_MODE controls selection:
 *  - failover   (default) always try the primary first, then the next on error
 *  - roundrobin rotate the starting candidate per call
 *  - shuffle    pick a random starting candidate per call
 * On a failed candidate (network error, timeout, 4xx/5xx, empty reply) the
 * next candidate is tried automatically. Keys are never logged — only
 * provider, model, and key index.
 */

class AIUnavailableError extends Error {
  constructor(message = 'AI is not configured on this server.') {
    super(message);
    this.name = 'AIUnavailableError';
    this.safe = true;
  }
}

/** Build the request for an OpenAI-compatible provider. */
async function callOpenAiCompatible(baseUrl, apiKey, model, { system, messages, maxTokens, temperature }) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), aiTimeoutMs());
  try {
    const response = await fetch(`${baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        messages: [
          ...(system ? [{ role: 'system', content: system }] : []),
          ...messages,
        ],
        temperature,
        max_tokens: maxTokens,
      }),
      signal: controller.signal,
    });

    if (!response.ok) {
      throw providerHttpError(response.status);
    }
    const data = await response.json();
    const content = data?.choices?.[0]?.message?.content;
    if (typeof content !== 'string' || content.length === 0) {
      throw new AIUnavailableError('AI returned an empty response.');
    }
    return content;
  } finally {
    clearTimeout(timer);
  }
}

/** Build the request for Google Gemini. */
async function callGemini(apiKey, model, { system, messages, maxTokens, temperature }) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), aiTimeoutMs());
  try {
    const url =
      `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(apiKey)}`;

    const contents = messages.map((m) => ({
      role: m.role === 'assistant' ? 'model' : 'user',
      parts: [{ text: m.content }],
    }));

    const body = {
      contents,
      generationConfig: { temperature, maxOutputTokens: maxTokens },
    };
    if (system) body.systemInstruction = { parts: [{ text: system }] };

    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: controller.signal,
    });

    if (!response.ok) {
      throw providerHttpError(response.status);
    }
    const data = await response.json();
    const text = data?.candidates?.[0]?.content?.parts
      ?.map((p) => p.text ?? '')
      .join('');
    if (typeof text !== 'string' || text.length === 0) {
      throw new AIUnavailableError('AI returned an empty response.');
    }
    return text;
  } finally {
    clearTimeout(timer);
  }
}

function providerHttpError(status) {
  let detail = `HTTP ${status}`;
  if (status === 401) detail = 'AI provider rejected the API key';
  if (status === 403) detail = 'AI provider denied access (check key permissions)';
  if (status === 404) detail = 'AI provider does not know that model';
  if (status === 429) detail = 'AI provider rate limit hit';
  return new AIUnavailableError(`AI request failed (${detail}).`);
}

/** Per-provider round-robin cursor. */
const roundRobinCursors = new Map();

/**
 * Build the candidate pool for a provider: key[i] paired with model[i % n].
 * A single key with several models (or several keys with one model) both work.
 */
function buildPool(provider) {
  const keys = keyList(provider);
  const models = modelList(provider);
  const pool = [];
  for (let i = 0; i < keys.length; i += 1) {
    pool.push({ key: keys[i], model: models[i % models.length] });
  }
  return pool;
}

/** Order of candidate indices to try, given the failover mode. */
function candidateOrder(count, mode, roundIndex = 0) {
  const start =
    mode === 'roundrobin'
      ? roundIndex % count
      : mode === 'shuffle'
        ? Math.floor(Math.random() * count)
        : 0; // failover: always primary first
  return Array.from({ length: count }, (_, i) => (start + i) % count);
}

/**
 * Send a chat completion request using the resolved provider, with
 * automatic key/model failover and optional rotation.
 * @param {object} options
 * @param {string} options.system System prompt.
 * @param {Array<{role: string, content: string}>} options.messages Conversation messages.
 * @param {number} [options.maxTokens]
 * @param {number} [options.temperature]
 * @returns {Promise<string>} assistant text
 */
async function chatCompletion({ system, messages, maxTokens = 800, temperature = 0.3 }) {
  if (!aiConfigured()) throw new AIUnavailableError();

  const provider = resolveProvider();
  const pool = buildPool(provider);
  if (pool.length === 0) {
    throw new AIUnavailableError(`No API keys configured for ${provider}.`);
  }

  const mode = env.AI_FAILOVER_MODE;
  const cursor = roundRobinCursors.get(provider) ?? 0;
  const order = candidateOrder(pool.length, mode, cursor);
  roundRobinCursors.set(provider, cursor + 1);

  let lastError = null;
  for (const index of order) {
    const entry = pool[index];
    try {
      const result =
        provider === 'gemini'
          ? await callGemini(entry.key, entry.model, { system, messages, maxTokens, temperature })
          : await callOpenAiCompatible(
              provider === 'groq' ? 'https://api.groq.com/openai/v1' : env.AI_BASE_URL,
              entry.key,
              entry.model,
              { system, messages, maxTokens, temperature },
            );
      logger.debug('ai request ok', { provider, model: entry.model, keyIndex: index + 1 });
      return result;
    } catch (err) {
      lastError = err;
      if (pool.length > 1) {
        logger.warn('ai candidate failed, trying next', {
          provider,
          model: entry.model,
          keyIndex: index + 1,
          error: err.message,
        });
      }
    }
  }
  throw lastError ?? new AIUnavailableError('The AI service is temporarily unavailable.');
}

/**
 * Ask the model to classify content, expecting a JSON object.
 * Returns parsed JSON or null if the response could not be parsed.
 */
async function classify(content, { context = '' } = {}) {
  const system =
    'You are a content safety classifier for a competitive gaming Discord server. ' +
    'Analyze the given message for: harassment, threats, hate-related abuse, sexual content, ' +
    'scam attempts, phishing, malicious links, severe toxicity, and advertisement spam. ' +
    'Respond with ONLY a JSON object of the form ' +
    '{"risk":"LOW|MEDIUM|HIGH","category":"...","reason":"short reason","confidence":0.0-1.0,"recommendedAction":"...",' +
    '"suggestedPunishment":"NONE|DELETE|TIMEOUT|BAN"}. ' +
    'Be conservative: assign HIGH risk only with strong evidence. Confidence is your certainty, 0-1.';

  const user = `${context ? `Context: ${context}\n` : ''}Message to classify:\n"""\n${content.slice(0, 3000)}\n"""`;

  const raw = await chatCompletion({ system, messages: [{ role: 'user', content: user }], maxTokens: 300, temperature: 0 });
  const parsed = extractJson(raw);
  if (!parsed || typeof parsed.risk !== 'string') return null;
  return {
    risk: parsed.risk,
    category: parsed.category ?? 'unknown',
    reason: parsed.reason ?? '',
    confidence: Number(parsed.confidence) || 0,
    recommendedAction: parsed.recommendedAction ?? '',
    suggestedPunishment: parsed.suggestedPunishment ?? 'NONE',
  };
}

/** Pull the first balanced JSON object out of a model response. */
function extractJson(text) {
  const start = text.indexOf('{');
  if (start === -1) return null;
  let depth = 0;
  for (let i = start; i < text.length; i += 1) {
    if (text[i] === '{') depth += 1;
    else if (text[i] === '}') {
      depth -= 1;
      if (depth === 0) {
        try {
          return JSON.parse(text.slice(start, i + 1));
        } catch {
          return null;
        }
      }
    }
  }
  return null;
}

module.exports = { chatCompletion, classify, extractJson, AIUnavailableError, buildPool, candidateOrder };
