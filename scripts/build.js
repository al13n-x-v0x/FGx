'use strict';

/*
 * Copyright © 2026 FGx.
 * All rights reserved.
 */

/**
 * Build gate for FGx.
 *
 * JavaScript has no compile step, so "build" means a full syntax gate:
 * every source/test/script file is parsed with `node --check` so a syntax
 * error can never reach production. Run with `npm run build`.
 */

const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');

const ROOTS = ['src', 'scripts', 'tests'];

/** Recursively collect every .js file under a root. */
function collect(dir, out) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) collect(full, out);
    else if (entry.name.endsWith('.js')) out.push(full);
  }
}

const files = [];
for (const root of ROOTS) {
  if (fs.existsSync(root)) collect(root, files);
}

for (const file of files) {
  execFileSync(process.execPath, ['--check', file], { stdio: 'pipe' });
}

console.log(`Build OK — ${files.length} files syntax-checked.`);
