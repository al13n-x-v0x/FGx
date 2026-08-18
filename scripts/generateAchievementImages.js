'use strict';

/*
 * Copyright © 2026 FGx.
 * All rights reserved.
 */

/**
 * Generates achievement badge PNGs (assets/achievements/<code>.png) and the
 * FGx guild icon (assets/fgx-icon.png) used for private servers.
 *
 * Pure Node — no native deps. Run: npm run assets
 * Output is deterministic and committed so the bot never needs to generate
 * images at runtime.
 */

const fs = require('node:fs');
const path = require('node:path');
const { renderPng, radialFill, fillCircle, strokeRing, fillPoly, thickLine, drawText } = require('../src/utils/pngEncoder');

const OUT_DIR = path.join(__dirname, '..', 'assets', 'achievements');
const ICON_PATH = path.join(__dirname, '..', 'assets', 'fgx-icon.png');

const SIZE = 256;

const C = {
  gold: [255, 200, 60],
  silver: [205, 212, 220],
  bronze: [208, 132, 62],
  crimson: [220, 60, 80],
  orange: [255, 140, 40],
  red: [235, 70, 70],
  cyan: [90, 185, 255],
  white: [255, 255, 255],
  dark: [20, 24, 28],
  gray: [120, 130, 140],
};

/** 5-point star centered at (cx, cy) with outer radius r. */
function starPoints(cx, cy, r) {
  const pts = [];
  for (let i = 0; i < 10; i += 1) {
    const rad = i % 2 === 0 ? r : r * 0.45;
    const angle = -Math.PI / 2 + (i * Math.PI) / 5;
    pts.push([cx + rad * Math.cos(angle), cy + rad * Math.sin(angle)]);
  }
  return pts;
}

/** Common badge background + FGx wordmark + name text. */
function base(canvas, w, h, accent, name, nameScale = 3) {
  radialFill(canvas, 28, 34, 41, 8, 10, 13);
  strokeRing(canvas, w / 2, h / 2, w / 2 - 4, w / 2 - 11, accent[0], accent[1], accent[2], 255);
  strokeRing(canvas, w / 2, h / 2, w / 2 - 16, w / 2 - 17, 60, 66, 74, 255);

  // FGx wordmark top.
  const fgxWidth = drawText(canvas, 'FGx', 0, 0, 2, C.gray[0], C.gray[1], C.gray[2]);
  drawText(canvas, 'FGx', (w - fgxWidth) / 2, 26, 2, C.gray[0], C.gray[1], C.gray[2]);

  // Achievement name bottom.
  const nameWidth = drawText(canvas, name, 0, 0, nameScale, C.white[0], C.white[1], C.white[2]);
  drawText(canvas, name, (w - nameWidth) / 2, h - 52, nameScale, C.white[0], C.white[1], C.white[2]);
}

const ICONS = {
  // Gold medal with "1".
  first_win(canvas, w, h) {
    const cx = w / 2;
    const cy = h / 2 - 18;
    fillCircle(canvas, cx, cy, 58, C.gold[0], C.gold[1], C.gold[2]);
    strokeRing(canvas, cx, cy, 58, 48, 120, 92, 28, 255);
    const t = drawText(canvas, '1', 0, 0, 12, C.white[0], C.white[1], C.white[2]);
    drawText(canvas, '1', (w - t) / 2, cy - 42, 12, C.white[0], C.white[1], C.white[2]);
    // Ribbons.
    fillPoly(canvas, [[cx - 34, cy - 52], [cx - 58, cy - 104], [cx - 34, cy - 92]], C.crimson[0], C.crimson[1], C.crimson[2]);
    fillPoly(canvas, [[cx + 34, cy - 52], [cx + 58, cy - 104], [cx + 34, cy - 92]], C.crimson[0], C.crimson[1], C.crimson[2]);
  },

  // Silver medal with "10".
  wins_10(canvas, w, h) {
    const cx = w / 2;
    const cy = h / 2 - 18;
    fillCircle(canvas, cx, cy, 58, C.silver[0], C.silver[1], C.silver[2]);
    strokeRing(canvas, cx, cy, 58, 48, 110, 118, 128, 255);
    const t = drawText(canvas, '10', 0, 0, 9, C.dark[0], C.dark[1], C.dark[2]);
    drawText(canvas, '10', (w - t) / 2, cy - 32, 9, C.dark[0], C.dark[1], C.dark[2]);
  },

  // Bronze medal with "50".
  wins_50(canvas, w, h) {
    const cx = w / 2;
    const cy = h / 2 - 18;
    fillCircle(canvas, cx, cy, 58, C.bronze[0], C.bronze[1], C.bronze[2]);
    strokeRing(canvas, cx, cy, 58, 48, 130, 76, 30, 255);
    const t = drawText(canvas, '50', 0, 0, 9, C.white[0], C.white[1], C.white[2]);
    drawText(canvas, '50', (w - t) / 2, cy - 32, 9, C.white[0], C.white[1], C.white[2]);
  },

  // Gold trophy.
  wins_100(canvas, w, h) {
    const cx = w / 2;
    const cy = h / 2 - 22;
    // Bowl (top half circle + walls).
    fillCircle(canvas, cx, cy, 34, C.gold[0], C.gold[1], C.gold[2]);
    fillPoly(canvas, [[cx - 34, cy], [cx - 30, cy + 26], [cx + 30, cy + 26], [cx + 34, cy]], C.gold[0], C.gold[1], C.gold[2]);
    // Handles.
    thickLine(canvas, cx - 34, cy - 6, cx - 46, cy + 18, 7, C.gold[0], C.gold[1], C.gold[2]);
    thickLine(canvas, cx + 34, cy - 6, cx + 46, cy + 18, 7, C.gold[0], C.gold[1], C.gold[2]);
    // Stem + base.
    fillPoly(canvas, [[cx - 8, cy + 26], [cx + 8, cy + 26], [cx + 12, cy + 48], [cx - 12, cy + 48]], C.gold[0], C.gold[1], C.gold[2]);
    fillPoly(canvas, [[cx - 28, cy + 48], [cx + 28, cy + 48], [cx + 22, cy + 58], [cx - 22, cy + 58]], C.gold[0], C.gold[1], C.gold[2]);
    strokeRing(canvas, cx, cy, 34, 28, 150, 112, 24, 255);
  },

  // Flame.
  streak_5(canvas, w, h) {
    const cx = w / 2;
    const cy = h / 2 - 10;
    const flame = [
      [cx, cy - 56],
      [cx + 22, cy - 14],
      [cx + 10, cy - 14],
      [cx + 26, cy + 18],
      [cx + 4, cy + 50],
      [cx - 4, cy + 50],
      [cx - 26, cy + 18],
      [cx - 10, cy - 14],
      [cx - 22, cy - 14],
    ];
    fillPoly(canvas, flame, C.orange[0], C.orange[1], C.orange[2]);
    fillPoly(
      canvas,
      [[cx, cy - 34], [cx + 10, cy - 6], [cx, cy + 24], [cx - 10, cy - 6]],
      C.red[0],
      C.red[1],
      C.red[2],
    );
  },

  // Crossed swords.
  clanwar_veteran(canvas, w, h) {
    const cx = w / 2;
    const cy = h / 2 - 12;
    // Blade 1 (top-left → bottom-right), blade 2 (bottom-left → top-right).
    thickLine(canvas, cx - 58, cy + 44, cx + 58, cy - 44, 13, C.silver[0], C.silver[1], C.silver[2]);
    thickLine(canvas, cx - 58, cy - 44, cx + 58, cy + 44, 13, C.silver[0], C.silver[1], C.silver[2]);
    // Crimson center line on each blade.
    thickLine(canvas, cx - 46, cy + 36, cx + 46, cy - 36, 4, C.crimson[0], C.crimson[1], C.crimson[2]);
    thickLine(canvas, cx - 46, cy - 36, cx + 46, cy + 36, 4, C.crimson[0], C.crimson[1], C.crimson[2]);
    // Pommels.
    fillCircle(canvas, cx - 58, cy + 44, 9, C.gold[0], C.gold[1], C.gold[2]);
    fillCircle(canvas, cx - 58, cy - 44, 9, C.gold[0], C.gold[1], C.gold[2]);
    fillCircle(canvas, cx + 58, cy - 44, 9, C.gold[0], C.gold[1], C.gold[2]);
    fillCircle(canvas, cx + 58, cy + 44, 9, C.gold[0], C.gold[1], C.gold[2]);
  },

  // Crown.
  tournament_champion(canvas, w, h) {
    const cx = w / 2;
    const cy = h / 2 - 20;
    fillPoly(
      canvas,
      [
        [cx - 80, cy + 40],
        [cx - 80, cy - 8],
        [cx - 50, cy + 20],
        [cx - 24, cy - 30],
        [cx, cy + 12],
        [cx + 24, cy - 30],
        [cx + 50, cy + 20],
        [cx + 80, cy - 8],
        [cx + 80, cy + 40],
      ],
      C.gold[0],
      C.gold[1],
      C.gold[2],
    );
    fillPoly(canvas, [[cx - 80, cy + 40], [cx + 80, cy + 40], [cx + 68, cy + 56], [cx - 68, cy + 56]], C.gold[0], C.gold[1], C.gold[2]);
    fillCircle(canvas, cx - 50, cy - 8, 8, C.red[0], C.red[1], C.red[2]);
    fillCircle(canvas, cx, cy + 12, 8, C.red[0], C.red[1], C.red[2]);
    fillCircle(canvas, cx + 50, cy - 8, 8, C.red[0], C.red[1], C.red[2]);
  },

  // Crimson star.
  fgx_legend(canvas, w, h) {
    const cx = w / 2;
    const cy = h / 2 - 14;
    fillPoly(canvas, starPoints(cx, cy, 66), C.crimson[0], C.crimson[1], C.crimson[2]);
    fillPoly(canvas, starPoints(cx, cy, 40), C.gold[0], C.gold[1], C.gold[2]);
  },

  // Red square with R.
  roblox_verified(canvas, w, h) {
    const cx = w / 2;
    const cy = h / 2 - 16;
    const s = 62;
    fillPoly(canvas, [[cx - s, cy - s], [cx + s, cy - s], [cx + s, cy + s], [cx - s, cy + s]], C.red[0], C.red[1], C.red[2]);
    strokeRing(canvas, cx - s, cy - s, 10, 4, 190, 42, 42, 255);
    strokeRing(canvas, cx + s, cy - s, 10, 4, 190, 42, 42, 255);
    strokeRing(canvas, cx - s, cy + s, 10, 4, 190, 42, 42, 255);
    strokeRing(canvas, cx + s, cy + s, 10, 4, 190, 42, 42, 255);
    const t = drawText(canvas, 'R', 0, 0, 11, C.white[0], C.white[1], C.white[2]);
    drawText(canvas, 'R', (w - t) / 2, cy - 39, 11, C.white[0], C.white[1], C.white[2]);
  },

  // Rocket.
  roblox_pioneer(canvas, w, h) {
    const cx = w / 2;
    const cy = h / 2 - 8;
    // Body.
    fillCircle(canvas, cx, cy - 38, 16, C.silver[0], C.silver[1], C.silver[2]);
    fillPoly(canvas, [[cx - 16, cy - 38], [cx + 16, cy - 38], [cx + 24, cy + 40], [cx - 24, cy + 40]], C.silver[0], C.silver[1], C.silver[2]);
    // Window.
    fillCircle(canvas, cx, cy - 6, 11, C.cyan[0], C.cyan[1], C.cyan[2]);
    strokeRing(canvas, cx, cy - 6, 11, 8, 40, 90, 140, 255);
    // Fins.
    fillPoly(canvas, [[cx - 24, cy + 12], [cx - 52, cy + 46], [cx - 24, cy + 40]], C.crimson[0], C.crimson[1], C.crimson[2]);
    fillPoly(canvas, [[cx + 24, cy + 12], [cx + 52, cy + 46], [cx + 24, cy + 40]], C.crimson[0], C.crimson[1], C.crimson[2]);
    // Exhaust.
    fillPoly(canvas, [[cx - 16, cy + 40], [cx + 16, cy + 40], [cx, cy + 66]], C.orange[0], C.orange[1], C.orange[2]);
    fillPoly(canvas, [[cx - 8, cy + 42], [cx + 8, cy + 42], [cx, cy + 56]], C.red[0], C.red[1], C.red[2]);
  },
};

const BADGES = [
  { code: 'first_win', name: 'FIRST WIN', accent: C.gold, icon: 'first_win' },
  { code: 'wins_10', name: '10 WINS', accent: C.silver, icon: 'wins_10' },
  { code: 'wins_50', name: '50 WINS', accent: C.bronze, icon: 'wins_50' },
  { code: 'wins_100', name: '100 WINS', accent: C.gold, icon: 'wins_100' },
  { code: 'streak_5', name: 'WIN STREAK', accent: C.orange, icon: 'streak_5' },
  { code: 'clanwar_veteran', name: 'CLAN WAR VETERAN', accent: C.crimson, icon: 'clanwar_veteran' },
  { code: 'tournament_champion', name: 'TOURNAMENT CHAMPION', accent: C.gold, icon: 'tournament_champion' },
  { code: 'fgx_legend', name: 'FGX LEGEND', accent: C.crimson, icon: 'fgx_legend' },
  { code: 'roblox_verified', name: 'ROBLOX VERIFIED', accent: C.red, icon: 'roblox_verified' },
  { code: 'roblox_pioneer', name: 'ROBLOX PIONEER', accent: C.cyan, icon: 'roblox_pioneer' },
];

function generate() {
  fs.mkdirSync(OUT_DIR, { recursive: true });
  let total = 0;
  for (const badge of BADGES) {
    const png = renderPng(SIZE, (canvas, w, h) => {
      base(canvas, w, h, badge.accent, badge.name);
      ICONS[badge.icon](canvas, w, h);
    });
    const filePath = path.join(OUT_DIR, `${badge.code}.png`);
    fs.writeFileSync(filePath, png);
    total += png.length;
    console.log(`generated ${path.relative(process.cwd(), filePath)} (${png.length} bytes)`);
  }

  // FGx guild icon for private servers.
  const icon = renderPng(SIZE, (canvas, w, h) => {
    radialFill(canvas, 34, 22, 28, 10, 6, 10);
    strokeRing(canvas, w / 2, h / 2, w / 2 - 6, w / 2 - 14, 220, 60, 80, 255);
    const t = drawText(canvas, 'FGX', 0, 0, 16, 240, 240, 240);
    drawText(canvas, 'FGX', (w - t) / 2, h / 2 - 56, 16, 240, 240, 240);
    const s = drawText(canvas, 'BLOXSTRIKE', 0, 0, 4, 220, 60, 80);
    drawText(canvas, 'BLOXSTRIKE', (w - s) / 2, h / 2 + 36, 4, 220, 60, 80);
  });
  fs.writeFileSync(ICON_PATH, icon);
  total += icon.length;
  console.log(`generated ${path.relative(process.cwd(), ICON_PATH)} (${icon.length} bytes)`);
  console.log(`done — ${BADGES.length + 1} images, ${total} bytes total`);
}

generate();
