'use strict';

/*
 * Copyright © 2026 FGx.
 * All rights reserved.
 */

const { guildConfigRepo } = require('../../database/repos/guildConfig');
const { xpRepo } = require('../../database/repos/profiles');
const { antispam } = require('../security');
const { Cooldown } = require('../../utils/cooldown');

/**
 * Community XP from legitimate participation.
 * Anti-spam protection: spammy messages earn nothing, and each member is
 * limited to one grant per cooldown window so grinding messages is pointless.
 */

const messageCooldown = new Cooldown();

/** XP needed to go from `level` to `level + 1` (increasing curve). */
function xpForNextLevel(level) {
  return 5 * level * level + 50 * level + 100;
}

/** Total XP required to *reach* a level (inverse of the curve). */
function xpToReachLevel(level) {
  let total = 0;
  for (let i = 0; i < level; i += 1) total += xpForNextLevel(i);
  return total;
}

/** Derive the level from cumulative XP. */
function levelFromXp(xp) {
  let level = 0;
  while (xp >= xpToReachLevel(level + 1)) level += 1;
  return level;
}

/**
 * Award XP for a message if eligible.
 * Returns { awarded, leveledUp, newLevel } or null when skipped.
 */
async function awardForMessage(message) {
  if (message.author.bot) return null;
  if (!message.guild) return null;

  const config = guildConfigRepo.get(message.guild.id);
  if (!config.xp.enabled) return null;

  // Never reward spam.
  if (!antispam.shouldReward(message, config)) return null;

  const cooldownMs = config.xp.cooldownSeconds * 1000;
  const key = `xp:${message.guild.id}:${message.author.id}`;
  if (messageCooldown.has(key)) return null;
  messageCooldown.set(key, cooldownMs);

  const amount = config.xp.perMessage || 1;
  const row = xpRepo.add(message.guild.id, message.author.id, amount);
  const newLevel = levelFromXp(row.xp);
  const leveledUp = newLevel > (row.level ?? 0);
  if (leveledUp) xpRepo.setLevel(message.guild.id, message.author.id, newLevel);

  return { awarded: amount, leveledUp, newLevel, xp: row.xp };
}

module.exports = { awardForMessage, levelFromXp, xpForNextLevel, xpToReachLevel };
