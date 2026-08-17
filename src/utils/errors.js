'use strict';

/*
 * Copyright © 2026 FGx.
 * All rights reserved.
 */

/**
 * Error types used across the bot.
 * Safe messages are shown to users; internal context stays in logs.
 */

class FGxError extends Error {
  /**
   * @param {string} message Safe message that can be shown to users.
   * @param {object} [options]
   * @param {string} [options.type] Error category (permission, validation, not_found, ...).
   * @param {object} [options.context] Extra log-only context (redacted by the logger).
   */
  constructor(message, { type = 'error', context } = {}) {
    super(message);
    this.name = 'FGxError';
    this.safe = true;
    this.type = type;
    this.context = context;
  }
}

/** Raised when the invoker lacks permission. */
class PermissionError extends FGxError {
  constructor(message = 'You do not have permission to do that.') {
    super(message, { type: 'permission' });
    this.name = 'PermissionError';
  }
}

/** Raised when an argument is invalid. */
class ValidationError extends FGxError {
  constructor(message, context) {
    super(message, { type: 'validation', context });
    this.name = 'ValidationError';
  }
}

/** Raised when a requested entity does not exist. */
class NotFoundError extends FGxError {
  constructor(message = 'That could not be found.') {
    super(message, { type: 'not_found' });
    this.name = 'NotFoundError';
  }
}

/** Raised when a cooldown/rate limit is active. */
class RateLimitError extends FGxError {
  constructor(message = 'You are doing that too quickly. Please wait a moment.') {
    super(message, { type: 'rate_limit' });
    this.name = 'RateLimitError';
  }
}

module.exports = { FGxError, PermissionError, ValidationError, NotFoundError, RateLimitError };
