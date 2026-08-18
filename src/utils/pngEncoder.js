'use strict';

/*
 * Copyright © 2026 FGx.
 * All rights reserved.
 */

const zlib = require('node:zlib');

/**
 * Zero-dependency PNG encoder + tiny raster canvas.
 *
 * Used to generate achievement badge assets and the FGx guild icon for
 * private servers — no native modules, works on any Node >= 22.5 host.
 *
 * Rendering is done on an RGBA buffer at any resolution; helpers include
 * circles, rings, polygons, lines, radial fills, and a 5x7 bitmap font.
 * `renderPng` optionally supersamples and box-downsamples for smooth edges.
 */

/* ── PNG encoding ──────────────────────────────────────────────────────── */

const CRC_TABLE = (() => {
  const table = new Int32Array(256);
  for (let n = 0; n < 256; n += 1) {
    let c = n;
    for (let k = 0; k < 8; k += 1) {
      c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    }
    table[n] = c;
  }
  return table;
})();

function crc32(buf) {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i += 1) {
    c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  }
  return (c ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const out = Buffer.alloc(12 + data.length);
  out.writeUInt32BE(data.length, 0);
  out.write(type, 4, 'ascii');
  data.copy(out, 8);
  out.writeUInt32BE(crc32(out.subarray(4, 8 + data.length)), 8 + data.length);
  return out;
}

/** Encode an RGBA buffer as a PNG. */
function encodePng(width, height, rgba) {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // color type RGBA
  ihdr[10] = 0;
  ihdr[11] = 0;
  ihdr[12] = 0;

  const stride = width * 4;
  const raw = Buffer.alloc((stride + 1) * height);
  for (let y = 0; y < height; y += 1) {
    raw[y * (stride + 1)] = 0; // filter: none
    rgba.copy(raw, y * (stride + 1) + 1, y * stride, y * stride + stride);
  }

  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', zlib.deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

/* ── Canvas ────────────────────────────────────────────────────────────── */

function makeCanvas(width, height) {
  const data = Buffer.alloc(width * height * 4);
  const set = (x, y, r, g, b, a = 255) => {
    if (x < 0 || y < 0 || x >= width || y >= height || a <= 0) return;
    const i = (y * width + x) * 4;
    const da = data[i + 3] / 255;
    const na = a / 255;
    const oa = na + da * (1 - na);
    if (oa <= 0) return;
    data[i] = Math.round((r * na + data[i] * da * (1 - na)) / oa);
    data[i + 1] = Math.round((g * na + data[i + 1] * da * (1 - na)) / oa);
    data[i + 2] = Math.round((b * na + data[i + 2] * da * (1 - na)) / oa);
    data[i + 3] = Math.round(oa * 255);
  };
  return { width, height, data, set };
}

/** Fill with a radial gradient from center color to edge color. */
function radialFill(canvas, centerR, centerG, centerB, edgeR, edgeG, edgeB) {
  const { width, height } = canvas;
  const cx = width / 2;
  const cy = height / 2;
  const maxR = Math.hypot(cx, cy);
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const t = Math.min(1, Math.hypot(x - cx, y - cy) / maxR);
      canvas.set(
        x,
        y,
        Math.round(centerR + (edgeR - centerR) * t),
        Math.round(centerG + (edgeG - centerG) * t),
        Math.round(centerB + (edgeB - centerB) * t),
      );
    }
  }
}

/** Filled circle. */
function fillCircle(canvas, cx, cy, radius, r, g, b, a = 255) {
  const { width, height } = canvas;
  const r2 = radius * radius;
  const x0 = Math.max(0, Math.floor(cx - radius));
  const x1 = Math.min(width - 1, Math.ceil(cx + radius));
  const y0 = Math.max(0, Math.floor(cy - radius));
  const y1 = Math.min(height - 1, Math.ceil(cy + radius));
  for (let y = y0; y <= y1; y += 1) {
    for (let x = x0; x <= x1; x += 1) {
      const dx = x - cx;
      const dy = y - cy;
      if (dx * dx + dy * dy <= r2) canvas.set(x, y, r, g, b, a);
    }
  }
}

/** Ring (thick circle outline) — draws by distance between two radii. */
function strokeRing(canvas, cx, cy, outer, inner, r, g, b, a = 255) {
  const { width, height } = canvas;
  const o2 = outer * outer;
  const i2 = inner * inner;
  const x0 = Math.max(0, Math.floor(cx - outer));
  const x1 = Math.min(width - 1, Math.ceil(cx + outer));
  const y0 = Math.max(0, Math.floor(cy - outer));
  const y1 = Math.min(height - 1, Math.ceil(cy + outer));
  for (let y = y0; y <= y1; y += 1) {
    for (let x = x0; x <= x1; x += 1) {
      const dx = x - cx;
      const dy = y - cy;
      const d2 = dx * dx + dy * dy;
      if (d2 <= o2 && d2 >= i2) canvas.set(x, y, r, g, b, a);
    }
  }
}

/** Fill a convex polygon (scanline). */
function fillPoly(canvas, points, r, g, b, a = 255) {
  const { width, height } = canvas;
  let minY = Infinity;
  let maxY = -Infinity;
  for (const p of points) {
    if (p[1] < minY) minY = p[1];
    if (p[1] > maxY) maxY = p[1];
  }
  minY = Math.max(0, Math.floor(minY));
  maxY = Math.min(height - 1, Math.ceil(maxY));
  for (let y = minY; y <= maxY; y += 1) {
    const xs = [];
    const n = points.length;
    for (let i = 0; i < n; i += 1) {
      const p1 = points[i];
      const p2 = points[(i + 1) % n];
      if ((p1[1] <= y && p2[1] > y) || (p2[1] <= y && p1[1] > y)) {
        const t = (y - p1[1]) / (p2[1] - p1[1]);
        xs.push(p1[0] + t * (p2[0] - p1[0]));
      }
    }
    xs.sort((a, b) => a - b);
    for (let i = 0; i + 1 < xs.length; i += 2) {
      const x0 = Math.max(0, Math.floor(xs[i]));
      const x1 = Math.min(width - 1, Math.ceil(xs[i + 1]));
      for (let x = x0; x <= x1; x += 1) canvas.set(x, y, r, g, b, a);
    }
  }
}

/** Thick line segment. */
function thickLine(canvas, x1, y1, x2, y2, thickness, r, g, b, a = 255) {
  const { width, height } = canvas;
  const half = thickness / 2;
  const x0 = Math.max(0, Math.floor(Math.min(x1, x2) - half));
  const xN = Math.min(width - 1, Math.ceil(Math.max(x1, x2) + half));
  const y0 = Math.max(0, Math.floor(Math.min(y1, y2) - half));
  const yN = Math.min(height - 1, Math.ceil(Math.max(y1, y2) + half));
  const dx = x2 - x1;
  const dy = y2 - y1;
  const len2 = dx * dx + dy * dy;
  for (let y = y0; y <= yN; y += 1) {
    for (let x = x0; x <= xN; x += 1) {
      let t = len2 > 0 ? ((x - x1) * dx + (y - y1) * dy) / len2 : 0;
      t = Math.max(0, Math.min(1, t));
      const px = x1 + t * dx - x;
      const py = y1 + t * dy - y;
      if (px * px + py * py <= half * half) canvas.set(x, y, r, g, b, a);
    }
  }
}

/* ── 5x7 bitmap font ───────────────────────────────────────────────────── */

const FONT = {
  A: ['01110', '10001', '10001', '11111', '10001', '10001', '10001'],
  B: ['11110', '10001', '10001', '11110', '10001', '10001', '11110'],
  C: ['01110', '10001', '10000', '10000', '10000', '10001', '01110'],
  D: ['11110', '10001', '10001', '10001', '10001', '10001', '11110'],
  E: ['11111', '10000', '10000', '11110', '10000', '10000', '11111'],
  F: ['11111', '10000', '10000', '11110', '10000', '10000', '10000'],
  G: ['01110', '10001', '10000', '10111', '10001', '10001', '01111'],
  H: ['10001', '10001', '10001', '11111', '10001', '10001', '10001'],
  I: ['01110', '00100', '00100', '00100', '00100', '00100', '01110'],
  J: ['00111', '00010', '00010', '00010', '00010', '10010', '01100'],
  K: ['10001', '10010', '10100', '11000', '10100', '10010', '10001'],
  L: ['10000', '10000', '10000', '10000', '10000', '10000', '11111'],
  M: ['10001', '11011', '10101', '10101', '10001', '10001', '10001'],
  N: ['10001', '11001', '10101', '10011', '10001', '10001', '10001'],
  O: ['01110', '10001', '10001', '10001', '10001', '10001', '01110'],
  P: ['11110', '10001', '10001', '11110', '10000', '10000', '10000'],
  Q: ['01110', '10001', '10001', '10001', '10101', '10010', '01101'],
  R: ['11110', '10001', '10001', '11110', '10100', '10010', '10001'],
  S: ['01111', '10000', '10000', '01110', '00001', '00001', '11110'],
  T: ['11111', '00100', '00100', '00100', '00100', '00100', '00100'],
  U: ['10001', '10001', '10001', '10001', '10001', '10001', '01110'],
  V: ['10001', '10001', '10001', '10001', '10001', '01010', '00100'],
  W: ['10001', '10001', '10001', '10101', '10101', '11011', '10001'],
  X: ['10001', '10001', '01010', '00100', '01010', '10001', '10001'],
  Y: ['10001', '10001', '01010', '00100', '00100', '00100', '00100'],
  Z: ['11111', '00001', '00010', '00100', '01000', '10000', '11111'],
  0: ['01110', '10001', '10011', '10101', '11001', '10001', '01110'],
  1: ['00100', '01100', '00100', '00100', '00100', '00100', '01110'],
  2: ['01110', '10001', '00001', '00010', '00100', '01000', '11111'],
  3: ['11111', '00010', '00100', '00010', '00001', '10001', '01110'],
  4: ['00010', '00110', '01010', '10010', '11111', '00010', '00010'],
  5: ['11111', '10000', '11110', '00001', '00001', '10001', '01110'],
  6: ['00110', '01000', '10000', '11110', '10001', '10001', '01110'],
  7: ['11111', '00001', '00010', '00100', '01000', '01000', '01000'],
  8: ['01110', '10001', '10001', '01110', '10001', '10001', '01110'],
  9: ['01110', '10001', '10001', '01111', '00001', '00010', '01100'],
  '!': ['00100', '00100', '00100', '00100', '00100', '00000', '00100'],
  '.': ['00000', '00000', '00000', '00000', '00000', '00000', '00100'],
  '-': ['00000', '00000', '00000', '11111', '00000', '00000', '00000'],
  ' ': ['00000', '00000', '00000', '00000', '00000', '00000', '00000'],
};

/** Draw text with the 5x7 font. Returns the rendered width in pixels. */
function drawText(canvas, text, x, y, scale, r, g, b, a = 255) {
  let cursor = x;
  const upper = String(text).toUpperCase();
  for (const ch of upper) {
    const glyph = FONT[ch] ?? FONT[' '];
    for (let row = 0; row < 7; row += 1) {
      for (let col = 0; col < 5; col += 1) {
        if (glyph[row][col] === '1') {
          for (let sy = 0; sy < scale; sy += 1) {
            for (let sx = 0; sx < scale; sx += 1) {
              canvas.set(cursor + col * scale + sx, y + row * scale + sy, r, g, b, a);
            }
          }
        }
      }
    }
    cursor += 6 * scale;
  }
  return cursor - x;
}

/* ── Render ────────────────────────────────────────────────────────────── */

/**
 * Render a drawing function to a PNG buffer.
 * `draw(canvas, w, h)` receives the working canvas. When `supersample` > 1
 * the canvas is rendered at that multiple and box-downsampled for smoothing.
 */
function renderPng(size, draw, { supersample = 3 } = {}) {
  const s = supersample;
  const canvas = makeCanvas(size * s, size * s);
  draw(canvas, size * s, size * s);

  if (s === 1) return encodePng(size, size, canvas.data);

  const out = makeCanvas(size, size);
  const block = s * s;
  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      let r = 0;
      let g = 0;
      let b = 0;
      let a = 0;
      for (let sy = 0; sy < s; sy += 1) {
        for (let sx = 0; sx < s; sx += 1) {
          const i = ((y * s + sy) * size * s + x * s + sx) * 4;
          r += canvas.data[i];
          g += canvas.data[i + 1];
          b += canvas.data[i + 2];
          a += canvas.data[i + 3];
        }
      }
      out.set(x, y, Math.round(r / block), Math.round(g / block), Math.round(b / block), Math.round(a / block));
    }
  }
  return encodePng(size, size, out.data);
}

module.exports = {
  encodePng,
  renderPng,
  makeCanvas,
  radialFill,
  fillCircle,
  strokeRing,
  fillPoly,
  thickLine,
  drawText,
};
