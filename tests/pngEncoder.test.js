'use strict';

/* Copyright © 2026 FGx. All rights reserved. */

process.env.DISCORD_TOKEN = 'test-token';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const zlib = require('node:zlib');

const { renderPng, drawText, encodePng, makeCanvas } = require('../src/utils/pngEncoder');

test('encoder produces a structurally valid PNG', () => {
  const png = renderPng(32, (canvas, w, h) => {
    for (let y = 0; y < h; y += 1) {
      for (let x = 0; x < w; x += 1) {
        canvas.set(x, y, 220, 20, 60);
      }
    }
    drawText(canvas, 'FGX', 4, 12, 2, 255, 255, 255);
  });

  // Signature.
  assert.equal(png.subarray(0, 8).toString('hex'), '89504e470d0a1a0a');
  // IHDR dimensions.
  assert.equal(png.readUInt32BE(16), 32);
  assert.equal(png.readUInt32BE(20), 32);
  // IDAT inflates to (w*4+1)*h bytes.
  let off = 8;
  const idat = [];
  while (off < png.length) {
    const len = png.readUInt32BE(off);
    const type = png.toString('ascii', off + 4, off + 8);
    if (type === 'IDAT') idat.push(png.subarray(off + 8, off + 8 + len));
    if (type === 'IEND') break;
    off += 12 + len;
  }
  assert.ok(idat.length > 0, 'IDAT chunk present');
  const raw = zlib.inflateSync(Buffer.concat(idat));
  assert.equal(raw.length, (32 * 4 + 1) * 32);
});

test('drawText returns the rendered width', () => {
  const canvas = makeCanvas(64, 64);
  const w1 = drawText(canvas, 'A', 0, 0, 1, 255, 255, 255);
  const w2 = drawText(canvas, 'AB', 0, 0, 1, 255, 255, 255);
  assert.ok(w1 > 0);
  assert.ok(w2 > w1);
});

test('achievement badge assets exist and are valid PNGs', () => {
  const dir = path.join(__dirname, '..', 'assets', 'achievements');
  const codes = [
    'first_win',
    'wins_10',
    'wins_50',
    'wins_100',
    'streak_5',
    'clanwar_veteran',
    'tournament_champion',
    'fgx_legend',
    'roblox_verified',
    'roblox_pioneer',
  ];
  for (const code of codes) {
    const file = path.join(dir, `${code}.png`);
    assert.ok(fs.existsSync(file), `${code}.png should exist`);
    const buf = fs.readFileSync(file);
    assert.equal(buf.subarray(0, 8).toString('hex'), '89504e470d0a1a0a', `${code}.png signature`);
    assert.equal(buf.readUInt32BE(16), 256, `${code}.png width`);
  }
  // The FGx guild icon used for private servers.
  assert.ok(fs.existsSync(path.join(__dirname, '..', 'assets', 'fgx-icon.png')));
});

test('encodePng round-trips a solid color', () => {
  const size = 8;
  const canvas = makeCanvas(size, size);
  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      canvas.set(x, y, 10, 20, 30);
    }
  }
  const png = encodePng(size, size, canvas.data);
  assert.equal(png.subarray(0, 8).toString('hex'), '89504e470d0a1a0a');
});
