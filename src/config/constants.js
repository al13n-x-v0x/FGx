'use strict';

/*
 * Copyright © 2026 FGx.
 * All rights reserved.
 */

/**
 * FGx brand constants and shared defaults.
 * Visual identity: black, deep red, crimson, white. Minimal accents.
 */

const BRAND = Object.freeze({
  name: 'FGx',
  clan: 'BloxStrike Clan',
  tagline: 'BloxStrike Clan Discord Platform',
  version: require('../../package.json').version,
  // Crimson primary, dark neutral, muted success/danger accents.
  colors: Object.freeze({
    primary: 0xdc143c,
    danger: 0xb91c1c,
    success: 0x2fbf71,
    neutral: 0x23272a,
    warn: 0xf0a500,
  }),
  footer: 'FGx • BloxStrike Clan',
  url: 'https://github.com/FGx/bloxstrike',
});

/** Clan rank ladder, lowest to highest. */
const RANKS = Object.freeze([
  'Recruit',
  'Trial',
  'Member',
  'Elite',
  'Captain',
  'Manager',
  'Co-Leader',
  'Leader',
  'Co-Owner',
  'Owner',
]);

const RANK_ORDER = Object.freeze(
  RANKS.reduce((acc, rank, i) => {
    acc[rank.toLowerCase()] = i;
    return acc;
  }, {}),
);

/** Staff-only ranks. */
const STAFF_RANKS = Object.freeze(['captain', 'manager', 'co-leader', 'leader', 'co-owner', 'owner']);

/** FGx competitive rating tiers (internal, NOT an official BloxStrike ranking). */
const RATING_TIERS = Object.freeze([
  { name: 'Bronze', min: 0 },
  { name: 'Silver', min: 900 },
  { name: 'Gold', min: 1100 },
  { name: 'Platinum', min: 1300 },
  { name: 'Diamond', min: 1500 },
  { name: 'Master', min: 1700 },
  { name: 'Elite', min: 1900 },
  { name: 'FGx Legend', min: 2100 },
]);

/** Ticket categories. */
const TICKET_TYPES = Object.freeze({
  '🎯 Clan Application': 'application',
  '🛠 Support': 'support',
  '🐛 Bug Report': 'bug',
  '🤝 Partnership': 'partnership',
  '🚨 Player Report': 'player-report',
});

/** Event categories. */
const EVENT_TYPES = Object.freeze([
  'Tournament',
  'Scrim',
  'Clan War',
  'Tryout',
  'Training',
  'Community Match',
]);

/** Training categories. */
const TRAINING_CATEGORIES = Object.freeze([
  'Aim',
  'Movement',
  'PvP Mechanics',
  'Game Sense',
  'Team Communication',
  'Clutch Practice',
]);

/** Anti-fake-stats sources. */
const STAT_SOURCES = Object.freeze({
  UNVERIFIED: 'unverified',
  STAFF: 'staff',
  VERIFIED_API: 'verified_api',
});

/** Achievement definitions with unlock predicates evaluated by services/achievements. */
const ACHIEVEMENTS = Object.freeze([
  { code: 'first_win', name: 'First Win', description: 'Win your first recorded match.', icon: '🥇' },
  { code: 'wins_10', name: '10 Wins', description: 'Reach 10 recorded wins.', icon: '🏅' },
  { code: 'wins_50', name: '50 Wins', description: 'Reach 50 recorded wins.', icon: '🎖️' },
  { code: 'wins_100', name: '100 Wins', description: 'Reach 100 recorded wins.', icon: '🏆' },
  { code: 'streak_5', name: 'Win Streak', description: 'Reach a 5-match win streak.', icon: '🔥' },
  { code: 'clanwar_veteran', name: 'Clan War Veteran', description: 'Participate in 5 clan wars.', icon: '⚔️' },
  { code: 'tournament_champion', name: 'Tournament Champion', description: 'Win a recorded tournament event.', icon: '👑' },
  { code: 'fgx_legend', name: 'FGx Legend', description: 'Reach the FGx Legend rating tier.', icon: '⭐' },
]);

module.exports = {
  BRAND,
  RANKS,
  RANK_ORDER,
  STAFF_RANKS,
  RATING_TIERS,
  TICKET_TYPES,
  EVENT_TYPES,
  TRAINING_CATEGORIES,
  STAT_SOURCES,
  ACHIEVEMENTS,
};
