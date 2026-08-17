'use strict';

/*
 * Copyright © 2026 FGx.
 * All rights reserved.
 */

/**
 * Simple in-memory cooldown map with automatic expiry.
 * Used to prevent the bot from hammering users, APIs, or databases.
 */

class Cooldown {
  constructor() {
    /** @type {Map<string, number>} key -> timestamp when the cooldown expires */
    this._map = new Map();
    this._sweepTimer = setInterval(() => this.sweep(), 60_000);
    this._sweepTimer.unref?.();
  }

  /** Set a cooldown for `key` lasting `ms` milliseconds. */
  set(key, ms) {
    this._map.set(key, Date.now() + ms);
  }

  /** Returns the number of ms remaining (0 if not cooling down). */
  remaining(key) {
    const expiry = this._map.get(key);
    if (expiry === undefined) return 0;
    const left = expiry - Date.now();
    if (left <= 0) {
      this._map.delete(key);
      return 0;
    }
    return left;
  }

  /** Returns true if the key is still cooling down. */
  has(key) {
    return this.remaining(key) > 0;
  }

  /** Throws a RateLimitError if the key is cooling down. */
  assert(key, ms, message) {
    if (!this.has(key)) {
      this.set(key, ms);
      return;
    }
    const { RateLimitError } = require('./errors');
    throw new RateLimitError(message);
  }

  /** Remove expired entries to bound memory. */
  sweep() {
    const now = Date.now();
    for (const [key, expiry] of this._map) {
      if (expiry <= now) this._map.delete(key);
    }
  }

  /** Release all state (used during shutdown / tests). */
  destroy() {
    clearInterval(this._sweepTimer);
    this._map.clear();
  }
}

module.exports = { Cooldown };
