'use strict';

/*
 * Copyright © 2026 FGx.
 * All rights reserved.
 */

const { guildConfigRepo } = require('../../database/repos/guildConfig');
const { ratingTier } = require('../../utils/format');

/**
 * FGx internal competitive rating.
 * This is explicitly NOT an official BloxStrike ranking — it is computed from
 * FGx-recorded matches only, using configurable gains/losses.
 */

/**
 * Compute the rating change for one match using the guild's configured algorithm.
 * @param {string} guildId
 * @param {object} opts
 * @param {number} opts.won  1 = win, -1 = loss, 0 = draw
 * @param {number} opts.kills
 * @param {number} opts.deaths
 * @param {number} opts.streakAfter Current win streak AFTER this match.
 */
function computeDelta(guildId, { won, kills, deaths, streakAfter }) {
  const cfg = guildConfigRepo.get(guildId).clan.rating;
  let change = 0;
  if (won > 0) {
    change += cfg.winGain;
    const kd = deaths > 0 ? kills / deaths : kills;
    change += Math.min(cfg.kdFactor * kd, cfg.kdFactor * 3); // cap the K/D bonus
    if (streakAfter >= 2) change += cfg.streakBonus;
  } else if (won < 0) {
    change -= cfg.lossLoss;
  }
  return Math.round(change);
}

/**
 * Apply a rating change to a profile, clamped at 0.
 * Returns { rating, change }.
 */
function apply(guildId, rating, won, kills, deaths, streakAfter) {
  const change = computeDelta(guildId, { won, kills, deaths, streakAfter });
  return { rating: Math.max(0, rating + change), change };
}

module.exports = { computeDelta, apply, ratingTier };
