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
  AI_API_KEY: '',
  AI_BASE_URL: 'https://api.openai.com/v1',
  AI_MODEL: 'gpt-4o-mini',
  GEMINI_API_KEY: '',
  GEMINI_MODEL: 'gemini-3.6-flash',
  GROQ_API_KEY: '',
  GROQ_MODEL: 'groq/compound',
  AI_TIMEOUT_MS: '15000',
  AI_ACTION_MODE: 'LOG',
  WEBHOOK_PORT: '3000',
  LOG_LEVEL: 'info',
  NODE_ENV: 'production',
  // Discord gateway intents: 'full' (privileged intents; needs Developer Portal
  // toggles) or 'basic' (runs without them, degrades welcome/raid/AI-on-content).
  DISCORD_INTENTS: 'full',
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

const AI_PROVIDERS = ['openai', 'gemini', 'groq'];

/** Discord gateway intents: 'full' requires privileged intents enabled in the Developer Portal. */
const DISCORD_INTENTS_MODES = ['full', 'basic'];
if (!DISCORD_INTENTS_MODES.includes(env.DISCORD_INTENTS.toLowerCase())) {
  throw new Error(`DISCORD_INTENTS must be one of: ${DISCORD_INTENTS_MODES.join(', ')}. Got: ${env.DISCORD_INTENTS}`);
}

/**
 * Resolve which AI provider is configured.
 * Explicit AI_PROVIDER wins; otherwise the first available key is used.
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
  if (env.AI_API_KEY) return 'openai';
  if (env.GROQ_API_KEY) return 'groq';
  if (env.GEMINI_API_KEY) return 'gemini';
  return null;
}

/** True when any AI provider key is configured. */
function aiConfigured() {
  return resolveProvider() !== null;
}

/** Human label for /status, e.g. "Gemini". */
function providerLabel() {
  const provider = resolveProvider();
  if (!provider) return 'not configured';
  return provider === 'openai' ? 'OpenAI' : provider === 'gemini' ? 'Gemini' : 'Groq';
}

/** The model name for the resolved provider. */
function resolvedModel() {
  const provider = resolveProvider();
  if (provider === 'gemini') return env.GEMINI_MODEL;
  if (provider === 'groq') return env.GROQ_MODEL;
  return env.AI_MODEL;
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
  AI_PROVIDERS,
  DISCORD_INTENTS_MODES,
  resolveProvider,
  providerLabel,
  resolvedModel,
};
