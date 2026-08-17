'use strict';

/*
 * Copyright © 2026 FGx.
 * All rights reserved.
 */

/**
 * Startup validation (npm run validate).
 * Verifies environment, database, imports and command registration without
 * connecting to Discord. Used by CI and before deployment.
 */

const path = require('node:path');
const fs = require('node:fs');

let failures = 0;

function check(name, fn) {
  try {
    fn();
    console.log(`  ✔ ${name}`);
  } catch (err) {
    failures += 1;
    console.error(`  ✖ ${name}: ${err.message}`);
  }
}

console.log('FGx validation\n');

// 1. Environment (without a token, load .env.example shape only).
check('environment module loads', () => {
  delete process.env.DISCORD_TOKEN;
  // env.js requires DISCORD_TOKEN; simulate presence so the module can be
  // exercised, then assert the required-key rule separately.
  process.env.DISCORD_TOKEN = '__test__';
  const { env, aiConfigured } = require('../src/config/env');
  if (typeof aiConfigured !== 'function') throw new Error('aiConfigured missing');
  if (env.AI_ACTION_MODE !== 'LOG') throw new Error('unexpected default AI mode');
  if (env.DISCORD_TOKEN !== '__test__') throw new Error('env not loaded');
});

// 2. Database: open, migrate, round-trip, close.
check('database migration + CRUD', () => {
  // env.js snapshots process.env at load time, so mutate the env object directly.
  const dbPath = path.resolve(`.data-validate-${process.pid}`);
  fs.mkdirSync(dbPath, { recursive: true });
  const { env } = require('../src/config/env');
  env.DATABASE_PATH = path.join(dbPath, 'validate.db');
  const db = require('../src/database');
  db.init();
  db.run('INSERT INTO guild_config (guild_id, config) VALUES (?, ?)', 'g1', '{"a":1}');
  const row = db.get('SELECT config FROM guild_config WHERE guild_id = ?', 'g1');
  if (!row) throw new Error('insert/select failed');
  if (!db.healthCheck()) throw new Error('health check failed');
  db.close();
  fs.rmSync(dbPath, { recursive: true, force: true });
});

// 3. Imports: require every source file.
check('all source modules import', () => {
  const { walk } = require('../src/utils/registry');
  let count = 0;
  for (const file of walk('src')) {
    // Skip index.js (requires a real token).
    if (file.endsWith('src/index.js')) continue;
    require(path.resolve(file));
    count += 1;
  }
  console.log(`    (${count} modules loaded)`);
});

// 4. Command registration integrity.
check('commands register valid data', () => {
  const { loadCommands } = require('../src/utils/registry');
  const commands = loadCommands();
  const names = new Set();
  for (const [name, cmd] of commands) {
    if (names.has(name)) throw new Error(`duplicate command: ${name}`);
    names.add(name);
    const json = cmd.data.toJSON();
    if (!json.name || json.name !== name) throw new Error(`bad data for ${name}`);
  }
  if (commands.size < 30) throw new Error(`expected >= 30 commands, got ${commands.size}`);
});

// 5. Package scripts sanity.
check('package scripts present', () => {
  const pkg = require('../package.json');
  for (const script of ['start', 'test', 'lint', 'format', 'validate']) {
    if (!pkg.scripts[script]) throw new Error(`missing script: ${script}`);
  }
});

// 6. No secrets in tracked files.
check('no obvious secrets in source', () => {
  const { walk } = require('../src/utils/registry');
  const secretRe = /(ghp_[A-Za-z0-9]{20,}|github_pat_[A-Za-z0-9_]{20,}|sk-[A-Za-z0-9]{20,}|xox[baprs]-[A-Za-z0-9-]{10,})/;
  for (const file of walk('src')) {
    const content = fs.readFileSync(file, 'utf8');
    const match = secretRe.exec(content);
    if (match) throw new Error(`possible secret pattern in ${file}`);
  }
});

console.log(failures === 0 ? '\nValidation passed.' : `\n${failures} check(s) failed.`);
process.exit(failures === 0 ? 0 : 1);
