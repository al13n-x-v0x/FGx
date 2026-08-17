'use strict';

/*
 * Copyright © 2026 FGx.
 * All rights reserved.
 */

const { matchesRepo } = require('../../database/repos/competitive');
const { profilesRepo } = require('../../database/repos/profiles');
const { kdRatio, winRate } = require('../../utils/format');

/**
 * Staff-only analysis generated from FGx-recorded data.
 * All numbers come from the database — nothing is fabricated.
 */

/** Player analysis from recorded matches. */
function analyzePlayer(guildId, userId) {
  const profile = profilesRepo.get(guildId, userId);
  const aggregates = matchesRepo.playerAggregates(guildId, userId);
  const recent = matchesRepo
    .list(guildId, 100)
    .filter((m) => {
      try {
        return JSON.parse(m.players).some((p) => String(p.user_id) === String(userId));
      } catch {
        return false;
      }
    })
    .slice(0, 5);

  const recentWins = recent.filter((m) => m.winner === 'fgx').length;
  const overallWinRate = winRate(profile?.wins ?? 0, profile?.matches ?? 0);
  const recentWinRate = recent.length > 0 ? winRate(recentWins, recent.length) : 'n/a';

  const kd = kdRatio(aggregates.kills, aggregates.deaths);
  const kdNum = Number(kd);
  const wrNum = profile?.matches > 0 ? (profile.wins / profile.matches) : 0;

  let strength = 'Consistency';
  if (kdNum >= 1.5 && kdNum > wrNum * 2) strength = 'K/D ratio';
  else if (wrNum >= 0.6) strength = 'Win rate';

  let weakness = 'Limited sample size';
  if (profile?.matches >= 5) {
    weakness = kdNum < 1.0 ? 'K/D ratio' : 'Consistency under pressure';
  }

  return {
    profile,
    aggregates,
    overall: {
      record: `${profile?.wins ?? 0}W ${profile?.losses ?? 0}L`,
      winRate: overallWinRate,
      kd,
      matches: profile?.matches ?? 0,
    },
    recent: {
      count: recent.length,
      wins: recentWins,
      winRate: recentWinRate,
    },
    strength,
    weakness,
    sampleSize: profile?.matches ?? 0,
  };
}

/** Team analysis from the guild's record. */
function analyzeTeam(guildId) {
  const record = matchesRepo.record(guildId);
  const recent = matchesRepo.recent(guildId, 10);
  const recentWins = recent.filter((m) => m.winner === 'fgx').length;
  const totalMatches = record?.matches ?? 0;

  const trend =
    totalMatches === 0
      ? 'No recorded matches yet'
      : recent.length >= 5
        ? recentWins / recent.length >= 0.5
          ? 'Improving'
          : 'Needs work'
        : 'Not enough recent matches to judge';

  return {
    record,
    recent: { count: recent.length, wins: recentWins },
    trend,
    totalMatches,
  };
}

/** Match analysis: lineup performance table. */
function analyzeMatch(guildId, matchId) {
  const match = matchesRepo.get(matchId);
  if (!match) return null;
  let players;
  try {
    players = JSON.parse(match.players);
  } catch {
    players = [];
  }
  return { match, players };
}

module.exports = { analyzePlayer, analyzeTeam, analyzeMatch };
