'use strict';

/*
 * Copyright © 2026 FGx.
 * All rights reserved.
 */

const { ACHIEVEMENTS } = require('../../config/constants');
const { profilesRepo, achievementsRepo } = require('../../database/repos/profiles');
const db = require('../../database/index');

/**
 * Achievement evaluation. Called after recorded matches and clan wars.
 * Achievements are configurable — definitions live in config/constants.js.
 */

/** Collect the codes this player has earned, based on FGx-recorded data only. */
function earnedCodes(profile, _matchStats) {
  const codes = new Set();
  const { wins = 0, current_streak = 0, rating = 0 } = profile;
  if (wins >= 1) codes.add('first_win');
  if (wins >= 10) codes.add('wins_10');
  if (wins >= 50) codes.add('wins_50');
  if (wins >= 100) codes.add('wins_100');
  if (current_streak >= 5) codes.add('streak_5');
  if (rating >= 2100) codes.add('fgx_legend');

  // Count clan-war matches via the [clan war] marker in match notes.
  const warMatches = db.all(
    `SELECT COUNT(*) AS c FROM matches
     WHERE guild_id = ? AND notes LIKE '%[clan war]%'
       AND players LIKE ?`,
    profile.guild_id,
    `%"user_id":"${profile.user_id}"%`,
  )[0]?.c ?? 0;
  if (warMatches >= 5) codes.add('clanwar_veteran');

  const tournamentWins = db.all(
    `SELECT COUNT(*) AS c FROM matches
     WHERE guild_id = ? AND winner = 'fgx' AND notes LIKE '%[tournament]%'
       AND players LIKE ?`,
    profile.guild_id,
    `%"user_id":"${profile.user_id}"%`,
  )[0]?.c ?? 0;
  if (tournamentWins >= 1) codes.add('tournament_champion');

  return codes;
}

/**
 * Unlock any newly-earned achievements for a player.
 * Returns the list of newly unlocked achievement definitions.
 */
function evaluateAndUnlock(guildId, userId) {
  const profile = profilesRepo.get(guildId, userId);
  if (!profile) return [];
  const earned = earnedCodes(profile);
  const newly = [];
  for (const code of earned) {
    if (!achievementsRepo.has(guildId, userId, code)) {
      achievementsRepo.unlock(guildId, userId, code);
      const def = ACHIEVEMENTS.find((a) => a.code === code);
      if (def) newly.push(def);
    }
  }
  return newly;
}

/** Full achievement catalog with the player's unlock state. */
function catalogFor(guildId, userId) {
  const unlocked = new Set(achievementsRepo.list(guildId, userId).map((a) => a.code));
  return ACHIEVEMENTS.map((a) => ({ ...a, unlocked: unlocked.has(a.code) }));
}

module.exports = { evaluateAndUnlock, catalogFor, earnedCodes };
