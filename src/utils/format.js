'use strict';

/*
 * Copyright © 2026 FGx.
 * All rights reserved.
 */

const { BRAND, RATING_TIERS } = require('../config/constants');

/** Human-friendly duration, e.g. "3d 4h". */
function formatDuration(ms) {
  if (!Number.isFinite(ms) || ms <= 0) return '0s';
  const s = Math.floor(ms / 1000);
  const units = [
    ['w', 604_800],
    ['d', 86_400],
    ['h', 3_600],
    ['m', 60],
    ['s', 1],
  ];
  const parts = [];
  let rest = s;
  for (const [suffix, size] of units) {
    const count = Math.floor(rest / size);
    if (count > 0) parts.push(`${count}${suffix}`);
    rest %= size;
  }
  return parts.slice(0, 2).join(' ') || '0s';
}

/** Date -> "2026-01-15 18:30 UTC". */
function formatDate(date = new Date()) {
  return date.toISOString().slice(0, 16).replace('T', ' ') + ' UTC';
}

/** 0.7123 -> "71%". */
function percent(value, digits = 0) {
  if (!Number.isFinite(value)) return '0%';
  return `${(value * 100).toFixed(digits)}%`;
}

/** K/D ratio string, e.g. "1.42". */
function kdRatio(kills, deaths) {
  if (deaths <= 0) return kills > 0 ? kills.toFixed(2) : '0.00';
  return (kills / deaths).toFixed(2);
}

/** Win rate 0..1 -> "74%". */
function winRate(wins, matches) {
  if (matches <= 0) return '0%';
  return percent(wins / matches);
}

/** Compute the FGx competitive rating tier for a rating value. */
function ratingTier(rating) {
  let tier = RATING_TIERS[0];
  for (const t of RATING_TIERS) {
    if (rating >= t.min) tier = t;
  }
  return tier;
}

/** Rating tier with an icon. */
function ratingTierIcon(rating) {
  const tier = ratingTier(rating);
  const icons = {
    Bronze: '🥉',
    Silver: '🥈',
    Gold: '🥇',
    Platinum: '💠',
    Diamond: '💎',
    Master: '🛡️',
    Elite: '⚔️',
    'FGx Legend': '⭐',
  };
  return `${icons[tier.name] ?? '🏅'} ${tier.name}`;
}

/** Sanitize a username for safe display (never render raw user input into embeds). */
function safeDisplay(value) {
  const input = String(value ?? '');
  // Replace markdown and zero-width characters that could distort embeds.
  return input.replace(/[*_`~|>]/g, '').replace(/\u200b/g, '').slice(0, 100);
}

/** Escape text for Discord markdown where it must render literally. */
function escapeMarkdown(value) {
  return String(value ?? '').replace(/([*_`~|\\])/g, '\\$1');
}

/** Pluralize a word. */
function pluralize(count, singular, plural) {
  return count === 1 ? singular : (plural ?? `${singular}s`);
}

/** Build a simple ASCII progress bar. */
function progressBar(value, max, width = 10) {
  const filled = Math.max(0, Math.min(width, Math.round((value / Math.max(1, max)) * width)));
  return '█'.repeat(filled) + '░'.repeat(width - filled);
}

module.exports = {
  formatDuration,
  formatDate,
  percent,
  kdRatio,
  winRate,
  ratingTier,
  ratingTierIcon,
  safeDisplay,
  escapeMarkdown,
  pluralize,
  progressBar,
  BRAND,
};
