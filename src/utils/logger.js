'use strict';

/*
 * Copyright © 2026 FGx.
 * All rights reserved.
 */

/**
 * Structured application logger.
 * Safe by default: never logs raw secret values (tokens, keys, passwords).
 * Use the explicit `secret` tag if a value MUST be redacted before printing.
 */

const { env } = require('../config/env');

const LEVELS = { debug: 10, info: 20, warn: 30, error: 40 };
const CONFIGURED = LEVELS[env.LOG_LEVEL] ?? LEVELS.info;

const SECRET_KEYS = [
  'token',
  'key',
  'secret',
  'password',
  'authorization',
  'cookie',
  'webhook',
];

function sanitizeValue(value) {
  if (typeof value === 'string' && value.length > 0) {
    // Redact anything that looks like a credential.
    if (SECRET_KEYS.some((k) => value.toLowerCase().includes(k))) return '[REDACTED]';
    if (/(ghp_|github_pat_|xox[baprs]-|sk-[A-Za-z0-9])/.test(value)) return '[REDACTED]';
  }
  return value;
}

function redact(obj) {
  if (obj === null || typeof obj !== 'object') return sanitizeValue(obj);
  if (Array.isArray(obj)) return obj.map(redact);
  const out = {};
  for (const [key, value] of Object.entries(obj)) {
    if (SECRET_KEYS.some((k) => key.toLowerCase().includes(k))) {
      out[key] = '[REDACTED]';
    } else if (typeof value === 'object') {
      out[key] = redact(value);
    } else {
      out[key] = sanitizeValue(value);
    }
  }
  return out;
}

function write(level, message, context) {
  if (LEVELS[level] < CONFIGURED) return;
  const entry = {
    ts: new Date().toISOString(),
    level,
    msg: message,
    ...(context ? redact(context) : {}),
  };
  const line = JSON.stringify(entry);
  if (level === 'error') process.stderr.write(`${line}\n`);
  else process.stdout.write(`${line}\n`);
}

const logger = {
  debug: (msg, ctx) => write('debug', msg, ctx),
  info: (msg, ctx) => write('info', msg, ctx),
  warn: (msg, ctx) => write('warn', msg, ctx),
  error: (msg, ctx) => write('error', msg, ctx),
};

module.exports = { logger };
