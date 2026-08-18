'use strict';

/*
 * Copyright © 2026 FGx.
 * All rights reserved.
 */

const { matchesRepo } = require('../../database/repos/competitive');
const { profilesRepo } = require('../../database/repos/profiles');
const { logAudit } = require('../logging/auditLogger');
const ratingService = require('./ratingService');
const achievementsService = require('./achievementsService');
const economy = require('../community/economyService');

/**
 * Official match recording. Only staff can record results.
 * Updates: team record, per-player stats, streaks, FGx rating, achievements.
 * Anti-fake-stats: numbers recorded here are the ONLY source for official
 * FGx statistics — users cannot edit their own stats.
 */

/**
 * Record a match and update every player in the lineup.
 * @returns {Promise<{match: object, updates: object[]}>}
 */
async function recordMatch(client, guild, {
  opponent,
  ourScore,
  oppScore,
  players = [],   // [{ userId, kills, deaths }]
  notes,
  recordedBy,
  playedAt,
}) {
  const winner = ourScore > oppScore ? 'fgx' : oppScore > ourScore ? 'opponent' : 'draw';
  const match = matchesRepo.create({
    guildId: guild.id,
    opponent,
    ourScore,
    oppScore,
    winner,
    playedAt,
    notes,
    players,
    recordedBy,
  });

  const updates = [];
  const seen = new Set();
  for (const p of players) {
    const userId = String(p.userId ?? '');
    if (!userId || seen.has(userId)) continue;
    seen.add(userId);

    const profile = profilesRepo.ensure(guild.id, userId);
    const won = winner === 'fgx' ? 1 : winner === 'opponent' ? -1 : 0;
    const kills = Number(p.kills) || 0;
    const deaths = Number(p.deaths) || 0;

    const nextStreak = won > 0 ? (profile.current_streak ?? 0) + 1 : 0;
    const bestStreak = Math.max(profile.best_streak ?? 0, nextStreak);
    const { rating, change } = ratingService.apply(
      guild.id,
      profile.rating ?? 0,
      won,
      kills,
      deaths,
      nextStreak,
    );

    profilesRepo.updateStats(guild.id, userId, {
      wins: (profile.wins ?? 0) + (won > 0 ? 1 : 0),
      losses: (profile.losses ?? 0) + (won < 0 ? 1 : 0),
      kills: (profile.kills ?? 0) + kills,
      deaths: (profile.deaths ?? 0) + deaths,
      matches: (profile.matches ?? 0) + 1,
      current_streak: nextStreak,
      best_streak: bestStreak,
      rating,
      stats_source: 'staff',
    });

    const unlocked = achievementsService.evaluateAndUnlock(guild.id, userId);
    updates.push({ userId, kills, deaths, ratingChange: change, unlocked });
  }

  await logAudit(client, guild, {
    action: 'match',
    target: null,
    moderator: recordedBy,
    reason: `${guild.name} ${ourScore}–${oppScore} vs ${opponent} (${winner})`,
    details: { opponent, score: `${ourScore}:${oppScore}`, winner, players: seen.size },
  });

  // Competitive payouts: every lineup player earns ₣Ԡ🇽 on a win (and a
  // small amount on a draw). Applies to matches AND clan wars.
  const coins = economy.rewardMatch(guild.id, [...seen], winner);

  return { match, updates, coins };
}

module.exports = { recordMatch };
