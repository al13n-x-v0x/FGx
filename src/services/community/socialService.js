'use strict';

/*
 * Copyright © 2026 FGx.
 * All rights reserved.
 */

const { socialRepo } = require('../../database/repos/social');

/**
 * Social interactions (OwO-style slap/pat/hug/kiss/tickle/poke).
 * Every interaction bumps a per-pair counter so rivalries grow —
 * "…that's slap #12 you've given them!"
 */

const KINDS = ['slap', 'pat', 'hug', 'kiss', 'tickle', 'poke'];

const EMOJI = {
  slap: '🖐️',
  pat: '🤗',
  hug: '🤗',
  kiss: '💋',
  tickle: '🪶',
  poke: '👉',
};

/** Randomized OwO-style flavor lines; {target} is replaced with the name. */
const LINES = {
  slap: [
    'You slap **{target}** right across the face! **{target}** staggers back, seeing stars.',
    '**{target}** gets a mighty slap! The sound echoes across the whole server.',
    'You wind up and slap **{target}** so hard their ancestors feel it.',
    '🖐️ *SMACK!* **{target}** has been slapped!',
  ],
  pat: [
    'You pat **{target}** on the head. **{target}** purrs softly.',
    'A gentle pat for **{target}** — good boy/girl energy detected.',
    '**{target}** receives a comforting pat. The server feels warmer already.',
  ],
  hug: [
    'You wrap **{target}** in a big warm hug. 🤗',
    '**{target}** is hugged tightly. They squeak happily.',
    'A group hug forms around **{target}**! Everyone is safe now.',
  ],
  kiss: [
    'You plant a kiss on **{target}**\'s cheek. 💋 They turn bright red.',
    '**{target}** gets a smooch. Sparks fly across the channel.',
    '💋 You kiss **{target}**! Their Discord profile briefly glows.',
  ],
  tickle: [
    'You tickle **{target}**! They burst out laughing uncontrollably.',
    '🪶 **{target}** is tickled into submission. *"Please, no more!"*',
    '**{target}** squirms as you tickle them mercilessly.',
  ],
  poke: [
    'You poke **{target}**. 👉 **{target}** pokes you back. It\'s war.',
    '👉 Poke! **{target}** looks around confused.',
    '**{target}** has been poked. Their attention has been acquired.',
  ],
};

/** Pick a line deterministically (rng injectable for tests). */
function lineFor(kind, targetName, rng = Math.random) {
  const pool = LINES[kind] ?? LINES.slap;
  const line = pool[Math.floor(rng() * pool.length)];
  return line.replaceAll('{target}', targetName);
}

/**
 * Perform an interaction. Returns the count for this pair+kind and a
 * rendered line. Self-interactions are allowed (OwO-style).
 */
function interact(guildId, actorId, targetId, kind, targetName = 'them', rng) {
  if (!KINDS.includes(kind)) {
    const err = new Error(`Unknown interaction \`${kind}\`.`);
    err.code = 'UNKNOWN_KIND';
    throw err;
  }
  const count = socialRepo.add(guildId, actorId, targetId, kind);
  return { kind, actorId, targetId, count, emoji: EMOJI[kind], line: lineFor(kind, targetName, rng) };
}

/** Rich stats for one member: dealt/received per kind + lifetime. */
function stats(guildId, userId) {
  const dealt = socialRepo.dealt(guildId, userId).reduce((acc, r) => ({ ...acc, [r.kind]: r.total }), {});
  const received = socialRepo.received(guildId, userId).reduce((acc, r) => ({ ...acc, [r.kind]: r.total }), {});
  const counts = socialRepo.lifetime(guildId, userId);
  return { dealt, received, lifetime: counts };
}

/** Total interactions for a member in either role. */
function lifetime(guildId, userId) {
  return socialRepo.lifetime(guildId, userId);
}

/** Top N members by a specific kind (e.g. who slaps the most). */
function top(guildId, kind, n = 5) {
  return socialRepo.top(guildId, kind, n);
}

module.exports = { socialService: { interact, stats, lifetime, top, KINDS, EMOJI } };
