'use strict';

/* Copyright (c) 2026 FGx. All rights reserved. */

const { env, aiConfigured, aiTimeoutMs, resolveProvider, fallbackProviders, keyList, modelList } = require('../../config/env');
const { logger } = require('../../utils/logger');

class AIUnavailableError extends Error {
  constructor(message = 'AI is not configured on this server.') {
    super(message);
    this.name = 'AIUnavailableError';
    this.safe = true;
  }
}

async function callOpenAiCompatible(baseUrl, apiKey, model, { system, messages, maxTokens, temperature }) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), aiTimeoutMs());
  try {
    const response = await fetch(`${baseUrl}/chat/completions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({
        model,
        messages: [...(system ? [{ role: 'system', content: system }] : []), ...messages],
        temperature,
        max_tokens: maxTokens,
      }),
      signal: controller.signal,
    });
    const rawBody = await response.json();
    if (!response.ok) throw providerHttpError(response.status, rawBody);
    const content = rawBody?.choices?.[0]?.message?.content;
    if (typeof content !== 'string' || content.length === 0) {
      throw new AIUnavailableError(`Empty response from ${model}${rawBody?.error ? ': ' + rawBody.error : ''}`);
    }
    return content;
  } finally {
    clearTimeout(timer);
  }
}

async function callHuggingFace(apiKey, model, { system, messages, maxTokens, temperature }) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), Math.max(aiTimeoutMs(), 45000));
  try {
    // Build a single prompt string since not all HF models support chat completions
    let prompt = '';
    if (system) prompt += system + '\n\n';
    for (const m of messages) {
      prompt += (m.role === 'assistant' ? 'Assistant: ' : 'User: ') + m.content + '\n';
    }
    prompt += 'Assistant:';

    const response = await fetch(
      `https://api-inference.huggingface.co/models/${encodeURIComponent(model)}`,
      {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          inputs: prompt,
          parameters: {
            max_new_tokens: maxTokens,
            temperature: temperature,
            return_full_text: false,
          },
        }),
        signal: controller.signal,
      }
    );

    const rawBody = await response.json();

    // 503 = model is loading (cold start)
    if (response.status === 503) {
      const msg = rawBody?.error || rawBody?.estimated_time ? `Model loading (~${Math.round(rawBody.estimated_time)}s)` : 'Model loading';
      throw new AIUnavailableError(`HuggingFace: ${msg}`);
    }

    if (!response.ok) throw providerHttpError(response.status, rawBody);

    // HF inference API returns { generated_text: "..." } or [{ generated_text: "..." }]
    let text;
    if (Array.isArray(rawBody)) {
      text = rawBody.map(r => r.generated_text || '').join('');
    } else if (rawBody?.generated_text) {
      text = rawBody.generated_text;
    } else if (rawBody?.[0]?.generated_text) {
      text = rawBody[0].generated_text;
    } else {
      text = JSON.stringify(rawBody);
    }

    if (!text || text.trim().length === 0) {
      throw new AIUnavailableError('HuggingFace returned an empty response.');
    }
    return text.trim();
  } finally {
    clearTimeout(timer);
  }
}

async function callGemini(apiKey, model, { system, messages, maxTokens, temperature }) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), aiTimeoutMs());
  try {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(apiKey)}`;
    const contents = messages.map((m) => ({ role: m.role === 'assistant' ? 'model' : 'user', parts: [{ text: m.content }] }));
    const body = { contents, generationConfig: { temperature, maxOutputTokens: maxTokens } };
    if (system) body.systemInstruction = { parts: [{ text: system }] };

    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: controller.signal,
    });
    const rawBody = await response.json();
    if (!response.ok) throw providerHttpError(response.status, rawBody);
    const text = rawBody?.candidates?.[0]?.content?.parts?.map((p) => p.text ?? '').join('');
    if (typeof text !== 'string' || text.length === 0) {
      const hint = rawBody?.error?.message || '';
      throw new AIUnavailableError(`Gemini empty response${hint ? ': ' + hint : ''}`);
    }
    return text;
  } finally {
    clearTimeout(timer);
  }
}

function providerHttpError(status, body) {
  let detail = `HTTP ${status}`;
  if (status === 401) detail = 'Invalid API key';
  if (status === 403) detail = 'Access denied (check key or accept model license)';
  if (status === 404) detail = 'Model not found';
  if (status === 429) detail = 'Rate limit hit';
  if (status === 503) detail = 'Model loading on HuggingFace';
  const hint = body?.error ? `: ${body.error}` : '';
  return new AIUnavailableError(`${detail}${hint}`);
}

const roundRobinCursors = new Map();

function buildPool(provider) {
  const keys = keyList(provider);
  const models = modelList(provider);
  const pool = [];
  for (let i = 0; i < keys.length; i += 1) {
    pool.push({ key: keys[i], model: models[i % models.length] });
  }
  return pool;
}

function candidateOrder(count, mode, roundIndex = 0) {
  const start = mode === 'roundrobin' ? roundIndex % count
    : mode === 'shuffle' ? Math.floor(Math.random() * count) : 0;
  return Array.from({ length: count }, (_, i) => (start + i) % count);
}

async function chatCompletion({ system, messages, maxTokens = 800, temperature = 0.3 }) {
  if (!aiConfigured()) throw new AIUnavailableError();

  const providers = [resolveProvider(), ...fallbackProviders()];
  const mode = env.AI_FAILOVER_MODE;
  let lastError = null;

  for (const provider of providers) {
    const pool = buildPool(provider);
    if (pool.length === 0) continue;

    const cursor = roundRobinCursors.get(provider) ?? 0;
    const order = candidateOrder(pool.length, mode, cursor);
    roundRobinCursors.set(provider, cursor + 1);

    for (const idx of order) {
      const entry = pool[idx];
      const maxAttempts = provider === 'huggingface' ? 3 : 1;

      for (let attempt = 1; attempt <= maxAttempts; attempt++) {
        try {
          let result;
          if (provider === 'gemini') {
            result = await callGemini(entry.key, entry.model, { system, messages, maxTokens, temperature });
          } else if (provider === 'huggingface') {
            result = await callHuggingFace(entry.key, entry.model, { system, messages, maxTokens, temperature });
          } else {
            const base = provider === 'groq' ? 'https://api.groq.com/openai/v1' : env.AI_BASE_URL;
            result = await callOpenAiCompatible(base, entry.key, entry.model, { system, messages, maxTokens, temperature });
          }
          logger.info('ai ok', { provider, model: entry.model });
          return result;
        } catch (err) {
          lastError = err;
          const isColdStart = provider === 'huggingface' && attempt < maxAttempts && err.message.includes('loading');
          if (isColdStart) {
            logger.warn('hf model loading, retrying 10s', { model: entry.model, attempt });
            await new Promise(r => setTimeout(r, 10000));
            continue;
          }
          logger.warn('ai fail', { provider, model: entry.model, error: err.message });
          break;
        }
      }
    }
  }
  throw lastError ?? new AIUnavailableError('AI service unavailable.');
}

async function classify(content, { context = '' } = {}) {
  const system = 'You are a content safety classifier for a competitive gaming Discord server. Respond with ONLY a JSON object: {"risk":"LOW|MEDIUM|HIGH","category":"...","reason":"...","confidence":0.0-1.0,"suggestedPunishment":"NONE|DELETE|TIMEOUT|BAN"}. Be conservative.';
  const user = `${context ? context + '\n' : ''}Classify:\n"${content.slice(0, 3000)}"`;
  const raw = await chatCompletion({ system, messages: [{ role: 'user', content: user }], maxTokens: 500, temperature: 0 });
  const parsed = extractJson(raw);
  if (!parsed || typeof parsed.risk !== 'string') return null;
  return {
    risk: parsed.risk, category: parsed.category || 'unknown',
    reason: parsed.reason || '', confidence: Number(parsed.confidence) || 0,
    recommendedAction: parsed.recommendedAction || '',
    suggestedPunishment: parsed.suggestedPunishment || 'NONE',
  };
}

function extractJson(text) {
  const start = text.indexOf('{');
  if (start === -1) return null;
  let depth = 0;
  for (let i = start; i < text.length; i++) {
    if (text[i] === '{') depth++;
    else if (text[i] === '}') { depth--; if (depth === 0) { try { return JSON.parse(text.slice(start, i + 1)); } catch { return null; } } }
  }
  return null;
}

module.exports = { chatCompletion, classify, extractJson, AIUnavailableError, buildPool, candidateOrder };
