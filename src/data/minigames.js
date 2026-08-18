'use strict';

/*
 * Copyright © 2026 FGx.
 * All rights reserved.
 */

/**
 * OwO-style minigame tables for the FGx economy.
 * Hunt: weighted animals with coin ranges (rarer = bigger payout).
 * Battle: weighted enemies with a win chance and coin ranges; losing a
 * battle costs 10% of your balance (capped), so there's real risk.
 */

const ANIMALS = Object.freeze([
  { id: 'rabbit', name: 'Rabbit', emoji: '🐇', weight: 30, min: 20, max: 60 },
  { id: 'squirrel', name: 'Squirrel', emoji: '🐿️', weight: 25, min: 15, max: 50 },
  { id: 'fox', name: 'Fox', emoji: '🦊', weight: 15, min: 60, max: 140 },
  { id: 'deer', name: 'Deer', emoji: '🦌', weight: 12, min: 80, max: 180 },
  { id: 'wolf', name: 'Wolf', emoji: '🐺', weight: 8, min: 150, max: 300 },
  { id: 'bear', name: 'Bear', emoji: '🐻', weight: 6, min: 250, max: 500 },
  { id: 'dragon', name: 'Dragon', emoji: '🐉', weight: 1.5, min: 800, max: 2000 },
  { id: 'phoenix', name: 'Phoenix', emoji: '🦅', weight: 1, min: 1500, max: 3000 },
]);

const ENEMIES = Object.freeze([
  { id: 'slime', name: 'Slime', emoji: '🟢', weight: 30, winChance: 0.85, min: 30, max: 80 },
  { id: 'goblin', name: 'Goblin', emoji: '👺', weight: 25, winChance: 0.75, min: 60, max: 150 },
  { id: 'bandit', name: 'Bandit', emoji: '🥷', weight: 18, winChance: 0.65, min: 100, max: 250 },
  { id: 'werewolf', name: 'Werewolf', emoji: '🐺', weight: 12, winChance: 0.55, min: 200, max: 450 },
  { id: 'darkknight', name: 'Dark Knight', emoji: '🛡️', weight: 8, winChance: 0.45, min: 350, max: 700 },
  { id: 'dragonboss', name: 'Dragon Boss', emoji: '🐲', weight: 5, winChance: 0.35, min: 600, max: 1500 },
]);

const HUNT_COOLDOWN_MS = 60_000;
const BATTLE_COOLDOWN_MS = 120_000;
const BATTLE_LOSS_FRACTION = 0.1;
const BATTLE_LOSS_CAP = 200;

/** Pick an entry from a weighted table. */
function weightedPick(table, random = Math.random) {
  const total = table.reduce((sum, e) => sum + e.weight, 0);
  let roll = random() * total;
  for (const entry of table) {
    roll -= entry.weight;
    if (roll <= 0) return entry;
  }
  return table[table.length - 1];
}

/** Uniform integer in [min, max]. */
function range(min, max, random = Math.random) {
  return Math.floor(min + random() * (max - min + 1));
}

module.exports = {
  ANIMALS,
  ENEMIES,
  HUNT_COOLDOWN_MS,
  BATTLE_COOLDOWN_MS,
  BATTLE_LOSS_FRACTION,
  BATTLE_LOSS_CAP,
  weightedPick,
  range,
};
