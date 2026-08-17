'use strict';

/*
 * Copyright © 2026 FGx.
 * All rights reserved.
 */

/**
 * Database connection using Node's built-in SQLite (node:sqlite).
 * Zero native dependencies — works on any Node >= 22.5 host, ideal for cloud deploys.
 *
 * Exposes a small synchronous API plus a `transaction` helper.
 * Credentials are never stored in code; only a local file path is used.
 */

const fs = require('node:fs');
const path = require('node:path');
const { DatabaseSync } = require('node:sqlite');
const { env } = require('../config/env');
const { MIGRATIONS } = require('./schema');
const { logger } = require('../utils/logger');

let db = null;

function open() {
  // ':memory:' is used by tests — never resolve it to a file path.
  const isMemory = env.DATABASE_PATH === ':memory:';
  const filePath = isMemory ? ':memory:' : path.resolve(env.DATABASE_PATH);
  if (!isMemory) fs.mkdirSync(path.dirname(filePath), { recursive: true });

  db = new DatabaseSync(filePath);
  db.exec('PRAGMA journal_mode = WAL');
  db.exec('PRAGMA foreign_keys = ON');
  db.exec('PRAGMA busy_timeout = 5000');
  return db;
}

function migrate() {
  const current = db.prepare('PRAGMA user_version').get().user_version;
  if (current > MIGRATIONS.length) {
    throw new Error(
      `Database schema version ${current} is newer than the code supports (${MIGRATIONS.length}). ` +
        'Update the bot before continuing.',
    );
  }
  for (let i = current; i < MIGRATIONS.length; i += 1) {
    const version = i + 1;
    transaction(() => {
      db.exec(MIGRATIONS[i]);
      db.exec(`PRAGMA user_version = ${version}`);
    });
    logger.info(`database: applied migration ${version}`);
  }
  if (current === 0 && MIGRATIONS.length > 0) {
    logger.info(`database: initialized schema (version ${MIGRATIONS.length})`);
  }
  return MIGRATIONS.length;
}

/** Run statements inside a transaction; rolls back on error. */
function transaction(fn) {
  db.exec('BEGIN');
  try {
    const result = fn();
    db.exec('COMMIT');
    return result;
  } catch (err) {
    try {
      db.exec('ROLLBACK');
    } catch {
      /* connection may be closed */
    }
    throw err;
  }
}

function get(sql, ...params) {
  return db.prepare(sql).get(...params);
}

function all(sql, ...params) {
  return db.prepare(sql).all(...params);
}

function run(sql, ...params) {
  return db.prepare(sql).run(...params);
}

/** Verify the database is reachable (used by /status). */
function healthCheck() {
  try {
    const row = db.prepare('SELECT 1 AS ok').get();
    return row && row.ok === 1;
  } catch {
    return false;
  }
}

function close() {
  if (db) {
    try {
      db.close();
    } catch {
      /* already closed */
    }
    db = null;
  }
}

/** Initialize: open, migrate, and report the schema version. */
function init() {
  open();
  const version = migrate();
  logger.info(`database: connected at ${env.DATABASE_PATH} (schema v${version})`);
  return db;
}

module.exports = { init, get, all, run, transaction, healthCheck, close, migrate, open };
