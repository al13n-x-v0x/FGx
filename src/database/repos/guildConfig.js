'use strict';

/*
 * Copyright © 2026 FGx.
 * All rights reserved.
 */

const { DEFAULT_GUILD_CONFIG } = require('../../config/guildDefaults');
const db = require('../index');

/** Deep-merge plain objects (arrays and scalars are replaced). */
function deepMerge(base, patch) {
  if (Array.isArray(patch)) return patch;
  if (patch && typeof patch === 'object') {
    const out = { ...base };
    for (const [key, value] of Object.entries(patch)) {
      if (value === undefined || value === null) continue;
      const baseValue = base && typeof base === 'object' ? base[key] : undefined;
      out[key] = deepMerge(baseValue, value);
    }
    return out;
  }
  return patch;
}

const guildConfigRepo = {
  /** Returns the full effective config for a guild (defaults + stored overrides). */
  get(guildId) {
    const row = db.get('SELECT config FROM guild_config WHERE guild_id = ?', guildId);
    let stored = {};
    if (row) {
      try {
        stored = JSON.parse(row.config);
      } catch {
        stored = {};
      }
    }
    return deepMerge(DEFAULT_GUILD_CONFIG, stored);
  },

  /** Deep-merges a patch into the stored config and returns the new config. */
  update(guildId, patch) {
    const current = this.get(guildId);
    const merged = deepMerge(current, patch);
    db.run(
      `INSERT INTO guild_config (guild_id, config, updated_at)
       VALUES (?, ?, datetime('now'))
       ON CONFLICT(guild_id) DO UPDATE SET config = excluded.config, updated_at = datetime('now')`,
      guildId,
      JSON.stringify(merged),
    );
    return merged;
  },

  /** Set a nested value using a dot path, e.g. "welcome.channel". */
  setPath(guildId, path, value) {
    const parts = path.split('.');
    const patch = {};
    let cursor = patch;
    for (let i = 0; i < parts.length - 1; i += 1) {
      cursor[parts[i]] = {};
      cursor = cursor[parts[i]];
    }
    cursor[parts[parts.length - 1]] = value;
    return this.update(guildId, patch);
  },

  /** Returns the raw stored config (no defaults) — used by /config view. */
  getRaw(guildId) {
    const row = db.get('SELECT config FROM guild_config WHERE guild_id = ?', guildId);
    if (!row) return {};
    try {
      return JSON.parse(row.config);
    } catch {
      return {};
    }
  },
};

module.exports = { guildConfigRepo, deepMerge };
