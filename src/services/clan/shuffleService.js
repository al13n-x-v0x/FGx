'use strict';

/*
 * Copyright © 2026 FGx.
 * All rights reserved.
 */

/**
 * BloxStrike team shuffling.
 * Random, even team splits for scrims, events, and custom practice.
 * Pure functions — easy to test and reuse from commands and buttons.
 */

/** Fisher–Yates shuffle (returns a new array). */
function shuffleArray(input) {
  const arr = [...input];
  for (let i = arr.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

/**
 * Split players into teams.
 * @param {string[]} players Unique player identifiers (user IDs).
 * @param {object} [opts]
 * @param {number} [opts.teamSize] Target players per team (wins over teamCount).
 * @param {number} [opts.teamCount] Target number of teams.
 * @returns {string[][]} Array of teams.
 */
function shuffleTeams(players, { teamSize, teamCount } = {}) {
  const unique = [...new Set(players.map((p) => String(p).trim()).filter(Boolean))];
  if (unique.length < 2) {
    const err = new Error('At least 2 players are required to shuffle.');
    err.code = 'TOO_FEW';
    throw err;
  }

  // Derive the number of teams, then deal round-robin so teams differ by at
  // most one player.
  let count = 0;
  if (teamSize && Number(teamSize) >= 1) {
    count = Math.ceil(unique.length / Math.min(Number(teamSize), unique.length));
  } else if (teamCount && Number(teamCount) >= 1) {
    count = Math.min(Number(teamCount), unique.length);
  } else {
    count = Math.ceil(unique.length / Math.min(5, unique.length));
  }
  count = Math.max(1, Math.min(count, unique.length));

  const shuffled = shuffleArray(unique);
  const teams = Array.from({ length: count }, () => []);
  shuffled.forEach((player, i) => {
    teams[i % count].push(player);
  });
  return teams;
}

/** Parse a free-form player list (mentions and/or raw IDs) into user IDs. */
function parsePlayerList(input) {
  const ids = new Set();
  const re = /<@!?(\d{15,21})>|\b(\d{15,21})\b/g;
  let match;
  while ((match = re.exec(String(input ?? ''))) !== null) {
    ids.add(match[1] ?? match[2]);
  }
  return [...ids];
}

/** Extract the team size from a scrim format like "5v5" (returns null if absent). */
function teamSizeFromFormat(format) {
  const match = /(\d+)\s*v\s*(\d+)/i.exec(String(format ?? ''));
  if (!match) return null;
  return Math.min(Number(match[1]), Number(match[2])) || null;
}

module.exports = { shuffleArray, shuffleTeams, parsePlayerList, teamSizeFromFormat };
