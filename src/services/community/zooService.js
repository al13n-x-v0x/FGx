'use strict';

/*
 * Copyright © 2026 FGx.
 * All rights reserved.
 */

const minigames = require('../../data/minigames');
const { animalsRepo } = require('../../database/repos/animals');
const { economyRepo } = require('../../database/repos/economy');

/**
 * Animal collection (OwO-style zoo). Hunts add animals to your zoo;
 * duplicates stack. Sell extras for coins, scaled by rarity.
 */

/** Add a hunted/crate animal to the collection. Returns { isNew, count }. */
function addAnimal(guildId, userId, animal) {
  return animalsRepo.add(guildId, userId, animal.id);
}

/** Full collection joined with species data, ordered by rarity. */
function collection(guildId, userId) {
  const rows = animalsRepo.list(guildId, userId);
  return rows
    .map((r) => {
      const animal = minigames.findAnimal(r.animal_id);
      if (!animal) return null;
      return { animal, count: r.count, firstFoundAt: r.first_found_at };
    })
    .filter(Boolean)
    .sort((a, b) => {
      const r = minigames.RARITY[a.animal.rarity].order - minigames.RARITY[b.animal.rarity].order;
      return r !== 0 ? r : a.animal.id.localeCompare(b.animal.id);
    });
}

/** Collection stats. */
function stats(guildId, userId) {
  return {
    total: animalsRepo.totalCount(guildId, userId),
    species: animalsRepo.speciesCount(guildId, userId),
  };
}

/**
 * Sell ONE of an animal (by id or name). Pays the rarity-scaled price.
 * Returns { animal, price, remaining, balance } — throws when not owned.
 */
function sell(guildId, userId, key) {
  const animal = minigames.findAnimal(key);
  if (!animal) {
    const err = new Error(`I don't know an animal called **${key}**. Check \`fgx zoo\`.`);
    err.code = 'UNKNOWN_ANIMAL';
    throw err;
  }
  const owned = animalsRepo.get(guildId, userId, animal.id);
  if (!owned) {
    const err = new Error(`You don't own a **${animal.emoji} ${animal.name}** yet.`);
    err.code = 'NOT_OWNED';
    throw err;
  }
  const price = minigames.sellPrice(animal);
  animalsRepo.remove(guildId, userId, animal.id, 1);
  economyRepo.updateBalance(guildId, userId, price);
  economyRepo.logTx(guildId, userId, 'sell', price, `Sold a ${animal.name}`);
  const remaining = owned.count - 1;
  return { animal, price, remaining, balance: economyRepo.get(guildId, userId).balance };
}

module.exports = { addAnimal, collection, stats, sell };
