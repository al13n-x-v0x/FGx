'use strict';

/**
 * Environment configuration with validation.
 * All values are read from process.env (loaded from .env by dotenv).
 * No secret values are ever logged or exposed by this module.
 */

const dotenv = require('dotenv');

dotenv.config();

const REQUIRED = ['DISCORD_TOKEN'];

const OPTIONAL_DEFAULTS = {
  CLIENT_ID: '',
  GUILD_ID: '',
  DATABASE_PATH: 'data/fgx.db',
  // AI provider: '' (auto-detect) | 'openai' | 'gemini' | 'groq'
  AI_PROVIDER: '',
  // Single-key vars (kept for compatibility) plus comma-separated key/model
  // lists for key shuffling and model shuffling.
  AI_API_KEY: '',
  AI_KEYS: '',
  AI_BASE_URL: 'https://api.openai.com/v1',
  AI_MODEL: 'gpt-4o-mini',
  AI_MODELS: '',
  GEMINI_API_KEY: '',
  GEMINI_KEYS: '',
  GEMINI_MODEL: 'gemini-3.5-flash-lite',
  GEMINI_VISION_MODEL: 'gemini-3.5-flash-lite',
  GEMINI_MODELS: '',
  GROQ_API_KEY: '',
  GROQ_KEYS: '',
  GROQ_MODEL: 'groq/compound',
  GROQ_MODELS: '',
  // failover (default) | roundrobin | shuffle
  AI_FAILOVER_MODE: 'failover',
  AI_TIMEOUT_MS: '30000',
  AI_ACTION_MODE: 'LOG',
  WEBHOOK_PORT: '3000',
  LOG_LEVEL: 'info',
  NODE_ENV: 'production',
  // Discord gateway intents: 'full' (privileged intents; needs Developer Portal
  // toggles) or 'basic' (runs without them, degrades welcome/raid/AI-on-content).
  DISCORD_INTENTS: 'full',
  // Minecraft server config (standard MC query protocol)
  MC_SERVER_HOST: 'FGxx.aternos.me',
  MC_SERVER_PORT: '25565',
  // Aternos account for auto-start (optional — only needed for /minecraft start)
  ATERNOS_USERNAME: '',
  ATERNOS_PASSWORD: '',
  // Server display name for embeds
  MC_SERVER_NAME: 'FGxx Aternos Server',
  // HuggingFace (Meta Llama, etc.) — OpenAI-compatible API
  HF_API_KEY: '',
  HF_MODEL: 'meta-llama/Meta-Llama-3-8B-Instruct',
};

/** @type {Record<string, string>} */
const env = {};

for (const key of REQUIRED) {
  const value = process.env[key];
  if (!value || !value.trim()) {
    throw new Error(
      `Missing required environment variable: ${key}. Copy .env.example to .env and fill it in.`,
    );
  }
  env[key] = value.trim();
}

for (const [key, fallback] of Object.entries(OPTIONAL_DEFAULTS)) {
  const value = process.env[key];
  env[key] = value && value.trim() ? value.trim() : fallback;
}

/** Validate AI failover mode. */
const AI_FAILOVER_MODES = ['failover', 'roundrobin', 'shuffle'];
if (!AI_FAILOVER_MODES.includes(env.AI_FAILOVER_MODE)) {
  throw new Error(
    `AI_FAILOVER_MODE must be one of: ${AI_FAILOVER_MODES.join(', ')}. Got: ${env.AI_FAILOVER_MODE}`,
  );
}

/** Validate AI action mode is one of the allowed values. */
const AI_ACTION_MODES = ['LOG', 'RECOMMEND', 'MODERATE'];
if (!AI_ACTION_MODES.includes(env.AI_ACTION_MODE)) {
  throw new Error(
    `AI_ACTION_MODE must be one of: ${AI_ACTION_MODES.join(', ')}. Got: ${env.AI_ACTION_MODE}`,
  );
}

/** Validate the AI timeout is a positive number. */
const aiTimeout = Number(env.AI_TIMEOUT_MS);
if (!Number.isFinite(aiTimeout) || aiTimeout <= 0) {
  throw new Error(`AI_TIMEOUT_MS must be a positive number. Got: ${env.AI_TIMEOUT_MS}`);
}
env.AI_TIMEOUT_MS = String(aiTimeout);

const webhookPort = Number(env.WEBHOOK_PORT);
if (!Number.isInteger(webhookPort) || webhookPort < 1 || webhookPort > 65535) {
  throw new Error(`WEBHOOK_PORT must be a valid port number. Got: ${env.WEBHOOK_PORT}`);
}
env.WEBHOOK_PORT = String(webhookPort);

const AI_PROVIDERS = ['openai', 'gemini', 'groq', 'huggingface'];

/** Discord gateway intents: 'full' requires privileged intents enabled in the Developer Portal. */
const DISCORD_INTENTS_MODES = ['full', 'basic'];
if (!DISCORD_INTENTS_MODES.includes(env.DISCORD_INTENTS.toLowerCase())) {
  throw new Error(`DISCORD_INTENTS must be one of: ${DISCORD_INTENTS_MODES.join(', ')}. Got: ${env.DISCORD_INTENTS}`);
}

/**
 * Comma-separated list of API keys for a provider (plural var wins, falls
 * back to the single-key var). Returns a non-empty array or throws.
 */
function keyList(provider) {
  const raw =
    provider === 'gemini'
      ? env.GEMINI_KEYS || env.GEMINI_API_KEY
      : provider === 'groq'
        ? env.GROQ_KEYS || env.GROQ_API_KEY
        : provider === 'huggingface'
          ? env.HF_API_KEY
          : env.AI_KEYS || env.AI_API_KEY;
  const list = (raw || '').split(',').map((s) => s.trim()).filter(Boolean);
  return list;
}

/** Comma-separated list of models for a provider (plural var wins). */
function modelList(provider) {
  const raw =
    provider === 'gemini'
      ? env.GEMINI_MODELS || env.GEMINI_MODEL
      : provider === 'groq'
        ? env.GROQ_MODELS || env.GROQ_MODEL
        : provider === 'huggingface'
          ? env.HF_MODEL
          : env.AI_MODELS || env.AI_MODEL;
  return (raw || '').split(',').map((s) => s.trim()).filter(Boolean);
}

/**
 * Resolve which AI provider is configured.
 * Explicit AI_PROVIDER wins; otherwise the first provider with a key is used.
 * Returns one of 'openai' | 'gemini' | 'groq' | null.
 */
function resolveProvider() {
  const explicit = env.AI_PROVIDER.toLowerCase();
  if (explicit) {
    if (!AI_PROVIDERS.includes(explicit)) {
      throw new Error(`AI_PROVIDER must be one of: ${AI_PROVIDERS.join(', ')}. Got: ${env.AI_PROVIDER}`);
    }
    return explicit;
  }
  if (keyList('openai').length > 0) return 'openai';
  if (keyList('groq').length > 0) return 'groq';
  if (keyList('gemini').length > 0) return 'gemini';
  return null;
}

/** True when any AI provider key is configured. */
function aiConfigured() {
  return resolveProvider() !== null;
}

/** Auto-detect priority: first provider with a key wins. */
const AUTO_DETECT_ORDER = ['openai', 'groq', 'gemini', 'huggingface'];

/** All providers that have at least one key, in auto-detect priority order. */
function configuredProviders() {
  return AUTO_DETECT_ORDER.filter((p) => keyList(p).length > 0);
}

/**
 * Providers configured with keys but not the resolved primary.
 * Used as automatic fallbacks when the primary provider's key/model pool
 * is exhausted (rate-limited, down, or empty).
 */
function fallbackProviders() {
  const primary = resolveProvider();
  return configuredProviders().filter((p) => p !== primary);
}

/** Human label for /status, e.g. "Gemini". */
function providerLabel() {
  const provider = resolveProvider();
  if (!provider) return 'not configured';
  if (provider === 'openai') return 'OpenAI';
  if (provider === 'gemini') return 'Gemini';
  if (provider === 'huggingface') return 'HuggingFace (Meta Llama)';
  return 'Groq';
}

/** The model name for the resolved provider. */
function resolvedModel() {
  const provider = resolveProvider();
  return modelList(provider)[0] ?? null;
}

/** Number of keys configured for the resolved provider. */
function keyCount() {
  const provider = resolveProvider();
  return provider ? keyList(provider).length : 0;
}

/** Short status line for /status, e.g. "Gemini • gemini-3.6-flash • 1 key • failover • fallback: Groq". */
function aiSummary() {
  const provider = resolveProvider();
  if (!provider) return 'not configured';
  const models = modelList(provider);
  const keys = keyList(provider).length;
  const model = models.length > 1 ? `${models.length} models` : models[0];
  const fb = fallbackProviders()
    .map((p) => (p === 'openai' ? 'OpenAI' : p === 'gemini' ? 'Gemini' : 'Groq'))
    .join(', ');
  const fallback = fb ? ` • fallback: ${fb}` : '';
  return `${providerLabel()} • ${model} • ${keys} key${keys === 1 ? '' : 's'} • ${env.AI_FAILOVER_MODE}${fallback}`;
}

/** Number of milliseconds to wait before aborting AI API calls. */
function aiTimeoutMs() {
  return Number(env.AI_TIMEOUT_MS);
}

module.exports = {
  env,
  aiConfigured,
  aiTimeoutMs,
  AI_ACTION_MODES,
  AI_FAILOVER_MODES,
  AI_PROVIDERS,
  DISCORD_INTENTS_MODES,
  resolveProvider,
  providerLabel,
  resolvedModel,
  keyList,
  modelList,
  keyCount,
  aiSummary,
  configuredProviders,
  fallbackProviders,
};
