'use strict';

/*
 * Copyright © 2026 FGx.
 * All rights reserved.
 */

const db = require('../index');

/**
 * FGx economy (OwO-style server currency).
 * balance = spendable FGx, lifetime = total earned (never decreases),
 * daily_streak tracks consecutive daily claims for the streak bonus.
 */

const economyRepo = {
  get(guildId, userId) {
    return db.get('SELECT * FROM economy WHERE guild_id = ? AND user_id = ?', guildId, userId);
  },

  ensure(guildId, userId) {
    db.run(
      `INSERT OR IGNORE INTO economy (guild_id, user_id) VALUES (?, ?)`,
      guildId,
      userId,
    );
    return this.get(guildId, userId);
  },

  /**
   * Apply a signed delta to the balance (upsert). Lifetime only counts
   * positive income. Uses an upsert so recipients of transfers and other
   * first-time earners get a row automatically.
   */
  updateBalance(guildId, userId, delta) {
    db.run(
      `INSERT INTO economy (guild_id, user_id, balance, lifetime)
       VALUES (?, ?, ?, MAX(0, ?))
       ON CONFLICT(guild_id, user_id) DO UPDATE SET
         balance    = MAX(0, economy.balance + excluded.balance),
         lifetime   = economy.lifetime + excluded.lifetime,
         updated_at = datetime('now')`,
      guildId,
      userId,
      delta,
      delta,
    );
    return this.get(guildId, userId);
  },

  setLastDaily(guildId, userId, iso, streak) {
    db.run(
      'UPDATE economy SET last_daily = ?, daily_streak = ?, updated_at = datetime(\'now\') WHERE guild_id = ? AND user_id = ?',
      iso,
      streak,
      guildId,
      userId,
    );
    return this.get(guildId, userId);
  },

  setLastWeekly(guildId, userId, iso) {
    db.run(
      "UPDATE economy SET last_weekly = ?, updated_at = datetime('now') WHERE guild_id = ? AND user_id = ?",
      iso,
      guildId,
      userId,
    );
    return this.get(guildId, userId);
  },

  logTx(guildId, userId, kind, amount, note = null) {
    db.run(
      'INSERT INTO economy_tx (guild_id, user_id, kind, amount, note) VALUES (?, ?, ?, ?, ?)',
      guildId,
      userId,
      kind,
      amount,
      note,
    );
  },

  recentTx(guildId, userId, limit = 10) {
    return db.all(
      'SELECT * FROM economy_tx WHERE guild_id = ? AND user_id = ? ORDER BY created_at DESC, id DESC LIMIT ?',
      guildId,
      userId,
      limit,
    );
  },

  leaderboard(guildId, limit = 100) {
    return db.all(
      'SELECT * FROM economy WHERE guild_id = ? AND balance > 0 ORDER BY balance DESC, lifetime DESC LIMIT ?',
      guildId,
      limit,
    );
  },

  rank(guildId, userId) {
    const row = db.get(
      `SELECT COUNT(*) AS n FROM economy
       WHERE guild_id = ? AND (balance > (SELECT balance FROM economy WHERE guild_id = ? AND user_id = ?))`,
      guildId,
      guildId,
      userId,
    );
    return row ? row.n + 1 : 1;
  },

  // Inventory
  addInventoryItem(guildId, userId, itemId, itemName) {
    const existing = db.get(
      'SELECT * FROM inventory WHERE guild_id = ? AND user_id = ? AND item_id = ?',
      guildId, userId, itemId
    );
    if (existing) {
      db.run('UPDATE inventory SET quantity = quantity + 1 WHERE guild_id = ? AND user_id = ? AND item_id = ?', guildId, userId, itemId);
    } else {
      db.run('INSERT INTO inventory (guild_id, user_id, item_id, item_name) VALUES (?, ?, ?, ?)', guildId, userId, itemId, itemName);
    }
  },

  getInventory(guildId, userId) {
    return db.all(
      'SELECT * FROM inventory WHERE guild_id = ? AND user_id = ? ORDER BY purchased_at DESC',
      guildId, userId
    );
  },
};

module.exports = { economyRepo };
