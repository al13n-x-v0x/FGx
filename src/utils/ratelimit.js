'use strict';

/*
 * Copyright © 2026 FGx.
 * All rights reserved.
 */

/**
 * Sliding-window rate limiter for command usage (e.g. AI commands).
 * Bounded: only tracks keys seen recently.
 */

class RateLimiter {
  /**
   * @param {object} options
   * @param {number} options.max Number of allowed calls per window.
   * @param {number} options.windowMs Window length in milliseconds.
   */
  constructor({ max, windowMs }) {
    this.max = max;
    this.windowMs = windowMs;
    /** @type {Map<string, number[]>} key -> array of call timestamps */
    this._calls = new Map();
    this._sweepTimer = setInterval(() => this.sweep(), 60_000);
    this._sweepTimer.unref?.();
  }

  /**
   * Record a call for `key`. Returns true if allowed, false if rate-limited.
   */
  allow(key) {
    const now = Date.now();
    const cutoff = now - this.windowMs;
    const calls = (this._calls.get(key) ?? []).filter((t) => t > cutoff);
    if (calls.length >= this.max) {
      this._calls.set(key, calls);
      return false;
    }
    calls.push(now);
    this._calls.set(key, calls);
    return true;
  }

  /** Remaining calls allowed for `key` in the current window. */
  remaining(key) {
    const now = Date.now();
    const cutoff = now - this.windowMs;
    const calls = (this._calls.get(key) ?? []).filter((t) => t > cutoff);
    return Math.max(0, this.max - calls.length);
  }

  sweep() {
    const cutoff = Date.now() - this.windowMs;
    for (const [key, calls] of this._calls) {
      const live = calls.filter((t) => t > cutoff);
      if (live.length === 0) this._calls.delete(key);
      else this._calls.set(key, live);
    }
  }

  destroy() {
    clearInterval(this._sweepTimer);
    this._calls.clear();
  }
}

module.exports = { RateLimiter };
