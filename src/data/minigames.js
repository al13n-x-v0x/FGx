'use strict';

/*
 * Copyright © 2026 FGx.
 * All rights reserved.
 */

/**
 * OwO-style minigame tables for the FGx economy.
 *
 * Hunt: weighted animals with rarity tiers (common → mythical) and coin
 * ranges; hunted animals are COLLECTED in your zoo. Duplicates stack —
 * sell extras for coins.
 *
 * Battle: weighted enemies with a win chance and coin ranges; losing a
 * battle costs 10% of your balance (capped), so there's real risk.
 *
 * Crate: costs coins, pays a random animal + bonus coins.
 * Pray: 2h cooldown, a big coin blessing.
 */

const RARITY_ORDER = Object.freeze(['common', 'uncommon', 'rare', 'epic', 'legendary', 'mythical']);

const RARITY = Object.freeze({
  common: { label: 'Common', emoji: '⬜', order: 0 },
  uncommon: { label: 'Uncommon', emoji: '🟩', order: 1 },
  rare: { label: 'Rare', emoji: '🟦', order: 2 },
  epic: { label: 'Epic', emoji: '🟪', order: 3 },
  legendary: { label: 'Legendary', emoji: '🟨', order: 4 },
  mythical: { label: 'Mythical', emoji: '🟥', order: 5 },
});

const ANIMALS = Object.freeze([
  // common
  { id: 'rabbit', name: 'Rabbit', emoji: '🐇', rarity: 'common', weight: 26, min: 20, max: 60 },
  { id: 'squirrel', name: 'Squirrel', emoji: '🐿️', rarity: 'common', weight: 24, min: 15, max: 50 },
  { id: 'mouse', name: 'Mouse', emoji: '🐭', rarity: 'common', weight: 20, min: 15, max: 45 },
  { id: 'frog', name: 'Frog', emoji: '🐸', rarity: 'common', weight: 16, min: 20, max: 55 },
  // uncommon
  { id: 'fox', name: 'Fox', emoji: '🦊', rarity: 'uncommon', weight: 12, min: 60, max: 140 },
  { id: 'deer', name: 'Deer', emoji: '🦌', rarity: 'uncommon', weight: 10, min: 80, max: 180 },
  { id: 'wolf', name: 'Wolf', emoji: '🐺', rarity: 'uncommon', weight: 8, min: 150, max: 300 },
  // rare
  { id: 'bear', name: 'Bear', emoji: '🐻', rarity: 'rare', weight: 5, min: 250, max: 500 },
  { id: 'panther', name: 'Panther', emoji: '🐆', rarity: 'rare', weight: 4, min: 300, max: 600 },
  { id: 'owl', name: 'Owl', emoji: '🦉', rarity: 'rare', weight: 4, min: 260, max: 550 },
  // epic
  { id: 'dragon', name: 'Dragon', emoji: '🐉', rarity: 'epic', weight: 1.6, min: 800, max: 2000 },
  { id: 'unicorn', name: 'Unicorn', emoji: '🦄', rarity: 'epic', weight: 1.4, min: 700, max: 1800 },
  // legendary
  { id: 'phoenix', name: 'Phoenix', emoji: '🦅', rarity: 'legendary', weight: 0.7, min: 1500, max: 3000 },
  { id: 'kraken', name: 'Kraken', emoji: '🐙', rarity: 'legendary', weight: 0.6, min: 1800, max: 3500 },
  // mythical
  { id: 'griffin', name: 'Griffin', emoji: '🦁', rarity: 'mythical', weight: 0.25, min: 4000, max: 8000 },
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
const PRAY_COOLDOWN_MS = 2 * 3_600_000;
const BATTLE_LOSS_FRACTION = 0.1;
const BATTLE_LOSS_CAP = 200;
const CRATE_COST = 250;
const CRATE_BONUS_MIN = 100;
const CRATE_BONUS_MAX = 400;

/** Animal lookup by id or (case-insensitive) name. */
function findAnimal(key) {
  const k = String(key ?? '').toLowerCase().trim();
  if (!k) return null;
  return ANIMALS.find((a) => a.id === k || a.name.toLowerCase() === k) ?? null;
}

/** Sell price for an animal — rarity-scaled, generous for dupes. */
function sellPrice(animal) {
  const rarity = RARITY[animal.rarity] ?? RARITY.common;
  return Math.round((animal.min + animal.max) / 2 / Math.max(1, 4 - rarity.order * 0.4));
}

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
  RARITY,
  RARITY_ORDER,
  HUNT_COOLDOWN_MS,
  BATTLE_COOLDOWN_MS,
  PRAY_COOLDOWN_MS,
  BATTLE_LOSS_FRACTION,
  BATTLE_LOSS_CAP,
  CRATE_COST,
  CRATE_BONUS_MIN,
  CRATE_BONUS_MAX,
  findAnimal,
  sellPrice,
  weightedPick,
  range,
};
