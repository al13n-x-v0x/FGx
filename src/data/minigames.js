/**
 * Minigames data — shared by /fgxcoin and the chat economy.
 * All economy minigames read from this single source of truth.
 */

/** Cooldown constants (ms). */
const PRAY_COOLDOWN_MS = 2 * 60 * 60 * 1000;     // 2 hours
const HUNT_COOLDOWN_MS = 60 * 1000;              // 60 seconds
const BATTLE_COOLDOWN_MS = 120 * 1000;           // 2 minutes
const WORK_COOLDOWN_MS = 45 * 1000;              // 45 seconds
const CRIME_COOLDOWN_MS = 90 * 1000;             // 90 seconds
const ROB_COOLDOWN_MS = 3 * 60 * 1000;           // 3 minutes
const FISH_COOLDOWN_MS = 30 * 1000;              // 30 seconds

/** Crate cost and bonus range. */
const CRATE_COST = 250;
const CRATE_BONUS_MIN = 50;
const CRATE_BONUS_MAX = 500;

/** Battle loss parameters. */
const BATTLE_LOSS_FRACTION = 0.10;   // lose 10% of balance on a loss
const BATTLE_LOSS_CAP = 200;          // max coins lost in a single battle

/** Rob parameters. */
const ROB_FRACTION = 0.25;            // steal up to 25% of target's balance
const ROB_CAP = 500;                  // max coins stolen per rob
const ROB_FAIL_FINE = 30;             // fine when a rob attempt fails

/** Helpers */
function range(min, max, rng) {
  if (rng) return Math.floor(rng() * (max - min + 1)) + min;
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function weightedPick(items, rngFn) {
  if (!items || items.length === 0) return null;
  const r = rngFn ? rngFn() : Math.random();
  let cumulative = 0;
  for (const item of items) {
    cumulative += item.weight;
    if (r < cumulative / totalWeight(items)) {
      return item;
    }
  }
  // fallback: return last item
  return items[items.length - 1];
}

function totalWeight(items) {
  let total = 0;
  for (const item of items) total += item.weight;
  return total || 1;
}

/** Rarity system. */
const RARITY = {
  common:    { name: 'Common',    emoji: '🟢',  color: '#22c55e',  multiplier: 1   },
  uncommon:  { name: 'Uncommon',  emoji: '🔵',  color: '#3b82f6',  multiplier: 2   },
  rare:      { name: 'Rare',      emoji: '🟡',  color: '#eab308',  multiplier: 4   },
  epic:      { name: 'Epic',      emoji: '🟣',  color: '#a855f7',  multiplier: 8   },
  legendary: { name: 'Legendary', emoji: '🔴',  color: '#ef4444',  multiplier: 16  },
  mythical:  { name: 'Mythical',  emoji: '🌈',  color: '#f97316',  multiplier: 32  },
};

/** Animals you can hunt / collect. */
const ANIMALS = [
  { id: 'cat',         name: 'Cat',              emoji: '🐱',  rarity: 'common',    weight: 40, min: 50,  max: 200  },
  { id: 'dog',         name: 'Dog',              emoji: '🐶',  rarity: 'common',    weight: 35, min: 60,  max: 250  },
  { id: 'fox',         name: 'Fox',              emoji: '🦊',  rarity: 'common',    weight: 30, min: 70,  max: 300  },
  { id: 'rabbit',      name: 'Rabbit',           emoji: '🐰',  rarity: 'common',    weight: 30, min: 40,  max: 150  },
  { id: 'panda',       name: 'Panda',            emoji: '🐼',  rarity: 'uncommon',  weight: 20, min: 150, max: 500  },
  { id: 'wolf',        name: 'Wolf',             emoji: '🐺',  rarity: 'uncommon',  weight: 18, min: 200, max: 600  },
  { id: 'eagle',       name: 'Eagle',            emoji: '🦅',  rarity: 'uncommon',  weight: 16, min: 250, max: 700  },
  { id: 'dragon_frog', name: 'Dragon Frog',      emoji: '🐸',  rarity: 'uncommon',  weight: 15, min: 300, max: 800  },
  { id: 'tiger',       name: 'Tiger',            emoji: '🐯',  rarity: 'rare',      weight: 10, min: 500, max: 1500 },
  { id: 'lion',        name: 'Lion',             emoji: '🦁',  rarity: 'rare',      weight: 9,  min: 600, max: 1800 },
  { id: 'bear',        name: 'Bear',             emoji: '🐻',  rarity: 'rare',      weight: 8,  min: 700, max: 2000 },
  { id: 'shark',       name: 'Shark',            emoji: '🦈',  rarity: 'rare',      weight: 7,  min: 800, max: 2200 },
  { id: 'phoenix',     name: 'Phoenix',          emoji: '🐦‍🔥', rarity: 'epic',      weight: 4,  min: 1500,max: 4000 },
  { id: 'griffin',     name: 'Griffin',          emoji: '🦅',  rarity: 'epic',      weight: 3,  min: 2000,max: 5000 },
  { id: 'unicorn',     name: 'Unicorn',          emoji: '🦄',  rarity: 'epic',      weight: 3,  min: 2500,max: 6000 },
  { id: 'dragon',      name: 'Dragon',           emoji: '🐉',  rarity: 'legendary', weight: 1,  min: 5000,max: 12000},
  { id: 'kraken',      name: 'Kraken',           emoji: '🐙',  rarity: 'legendary', weight: 1,  min: 6000,max: 15000},
  { id: 'void_wisp',   name: 'Void Wisp',        emoji: '👻',  rarity: 'legendary', weight: 1,  min: 7000,max: 18000},
  { id: 'golden_dragon', name: 'Golden Dragon',  emoji: '🐉',  rarity: 'mythical',  weight: 1,  min: 10000,max: 25000},
  { id: 'celestial_lion', name: 'Celestial Lion',emoji: '🦁',  rarity: 'mythical',  weight: 1,  min: 12000,max: 30000},
];

/** Enemies for battle minigame. */
const ENEMIES = [
  { id: 'rat',       name: 'Giant Rat',     emoji: '🐀',  rarity: 'common',    weight: 40, winChance: 0.8, min: 30,  max: 100  },
  { id: 'slime',     name: 'Slime',         emoji: '🦠',  rarity: 'common',    weight: 35, winChance: 0.75,min: 40,  max: 120  },
  { id: 'goblin',    name: 'Goblin',        emoji: '👺',  rarity: 'common',    weight: 30, winChance: 0.7, min: 50,  max: 150  },
  { id: 'bat',       name: 'Cave Bat',      emoji: '🦇',  rarity: 'uncommon',  weight: 25, winChance: 0.6, min: 100, max: 300  },
  { id: 'skeleton',  name: 'Skeleton',      emoji: '💀',  rarity: 'uncommon',  weight: 20, winChance: 0.55,min: 200, max: 500  },
  { id: 'zombie',    name: 'Zombie',        emoji: '🧟',  rarity: 'uncommon',  weight: 18, winChance: 0.5, min: 300, max: 700  },
  { id: 'orc',       name: 'Orc',           emoji: '👹',  rarity: 'rare',      weight: 12, winChance: 0.4, min: 500, max: 1200 },
  { id: 'demon',     name: 'Demon',         emoji: '😈',  rarity: 'rare',      weight: 10, winChance: 0.35,min: 700, max: 1500 },
  { id: 'vampire',   name: 'Vampire',       emoji: '🧛',  rarity: 'epic',      weight: 5,  winChance: 0.25,min: 1200,max: 3000 },
  { id: 'dragon_whelp', name: 'Dragon Whelp',emoji: '🐉', rarity: 'epic',      weight: 4,  winChance: 0.2, min: 1800,max: 4000 },
  { id: 'lich',      name: 'Lich',          emoji: '🧙',  rarity: 'legendary', weight: 2,  winChance: 0.15,min: 3000,max: 7000 },
  { id: 'behemoth',  name: 'Behemoth',      emoji: '🦍',  rarity: 'legendary', weight: 1,  winChance: 0.1, min: 5000,max: 10000},
];

/** Jobs for the work minigame. */
const JOBS = [
  { id: 'miner',     name: 'Miner',         emoji: '⛏️',  weight: 30, failChance: 0.2, min: 100, max: 300 },
  { id: 'farmer',    name: 'Farmer',        emoji: '🌾',  weight: 28, failChance: 0.15,min: 120, max: 350 },
  { id: 'fisherman', name: 'Fisherman',     emoji: '🎣',  weight: 25, failChance: 0.25,min: 90,  max: 280 },
  { id: 'merchant',  name: 'Merchant',      emoji: '💰',  weight: 20, failChance: 0.1, min: 200, max: 500 },
  { id: 'blacksmith',name: 'Blacksmith',    emoji: '🔨',  weight: 18, failChance: 0.3, min: 150, max: 400 },
  { id: 'guard',     name: 'Guard',         emoji: '🛡️',  weight: 15, failChance: 0.35,min: 180, max: 450 },
  { id: 'mage',      name: 'Mage',          emoji: '🧙',  weight: 12, failChance: 0.4, min: 300, max: 700 },
  { id: 'king',      name: 'King',          emoji: '👑',  weight: 5,  failChance: 0.5, min: 500, max: 1200},
];

/** Crimes for the crime minigame. */
const CRIMES = [
  { id: 'pickpocket', name: 'Pickpocket',  emoji: '👤',  weight: 35, failChance: 0.5, failFine: 20, min: 50,  max: 200  },
  { id: 'shoplift',   name: 'Shoplift',    emoji: '🏪',  weight: 30, failChance: 0.45,failFine: 30, min: 80,  max: 300  },
  { id: 'beg',        name: 'Street Beg',  emoji: '🙏',  weight: 28, failChance: 0.3, failFine: 15, min: 100, max: 400  },
  { id: 'scam',       name: 'Phone Scam',  emoji: '📱',  weight: 22, failChance: 0.5, failFine: 60, min: 200, max: 700  },
  { id: 'burglary',   name: 'Burglary',    emoji: '🔦',  weight: 18, failChance: 0.6, failFine: 100,min: 400, max: 1200 },
  { id: 'heist',      name: 'Heist',       emoji: '💎',  weight: 10, failChance: 0.7, failFine: 200,min: 800, max: 2500 },
  { id: 'bank_robbery', name: 'Bank Robbery', emoji: '🏦', weight: 5, failChance: 0.8, failFine: 500,min: 2000,max: 6000 },
];

/** Fish you can catch. */
const FISH = [
  { id: 'minnow',    name: 'Minnow',       emoji: '🐟',  weight: 40, min: 10,  max: 50   },
  { id: 'trout',     name: 'Trout',        emoji: '🐠',  weight: 30, min: 20,  max: 80   },
  { id: 'bass',      name: 'Bass',         emoji: '🐟',  weight: 25, min: 30,  max: 120  },
  { id: 'salmon',    name: 'Salmon',       emoji: '🐟',  weight: 20, min: 50,  max: 200  },
  { id: 'catfish',   name: 'Catfish',      emoji: '🐟',  weight: 15, min: 80,  max: 300  },
  { id: 'shark_fish',name: 'Shark Fish',   emoji: '🦈',  weight: 10, min: 200, max: 600  },
  { id: 'sea_dragon',name: 'Sea Dragon',   emoji: '🐉',  weight: 5,  min: 500, max: 1500 },
  { id: 'leviathan', name: 'Leviathan',    emoji: '🐙',  weight: 3,  min: 1000,max: 3000 },
  { id: 'golden_fish',name: 'Golden Fish', emoji: '🐟',  weight: 2,  min: 2000,max: 5000 },
];

/** Casino minigames. */
const CASINO = {
  coinflip: {
    name: 'Coin Flip',
    emoji: '🪙',
    maxBet: 5000,
    minBet: 10,
    description: 'Flip a coin. Heads you double your bet, tails you lose it.',
  },
  guess: {
    name: 'Guess the Number',
    emoji: '🎯',
    maxBet: 2000,
    minBet: 10,
    description: 'Guess a number 1-10. Correct guess wins 9x.',
  },
  highlow: {
    name: 'High / Low',
    emoji: '🃏',
    maxBet: 3000,
    minBet: 10,
    description: 'Bet on the next card being higher or lower.',
  },
  deal: {
    name: 'Deal or No Deal',
    emoji: '💼',
    maxBet: 4000,
    minBet: 50,
    description: 'Pick a case, win the prize inside.',
    prizes: [10, 50, 100, 200, 500, 1000, 2000, 5000],
  },
};

/** FGxcoin economy config. */
const FGXCOIN = {
  DAILY_BASE: 500,
  DAILY_STREAK_BONUS: 50,
  DAILY_MAX: 1000,
  WEEKLY: 500,
  VIP_DAILY: 250,
  TRANSFER_TAX: 0.05,
  MATCH_WIN_REWARD: 250,
  MATCH_DRAW_REWARD: 50,
  WEEK_MS: 7 * 24 * 3600 * 1000,
};

module.exports = {
  ...FGXCOIN,
  ...CASINO,
  weightedPick,
  ANIMALS,
  ENEMIES,
  RARITY,
  JOBS,
  CRIMES,
};
