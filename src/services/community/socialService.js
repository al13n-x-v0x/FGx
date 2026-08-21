'use strict';

/*
 * Copyright © 2026 FGx.
 * All rights reserved.
 */

const { socialRepo } = require('../../database/repos/social');

/**
 * Social interactions (OwO-style slap/clap/pat/hug/kiss/…).
 * Every interaction bumps a per-pair counter so rivalries grow —
 * "…that's slap #12 you've given them!"
 */

const KINDS = [
  'slap',
  'clap',
  'pat',
  'hug',
  'kiss',
  'tickle',
  'poke',
  'cuddle',
  'stare',
  'boop',
  'feed',
  'highfive',
  'punch',
  'bite',
  'dance',
];

const EMOJI = {
  slap: '🖐️',
  clap: '👏',
  pat: '🤗',
  hug: '🤗',
  kiss: '💋',
  tickle: '🪶',
  poke: '👉',
  cuddle: '🧸',
  stare: '👀',
  boop: '🐾',
  feed: '🍪',
  highfive: '🙌',
  punch: '👊',
  bite: '🦷',
  dance: '💃',
};

/** Curated GIF URLs for each interaction (hosted on Tenor, free to use). */
const GIFS = {
  slap: [
    'https://media.tenor.com/images/54a15c7757e08c68d5f7b89b3e3e5e5e/tenor.gif',
    'https://media1.tenor.com/m/WiRBXorDxMoAAAAC/anime-slap.gif',
    'https://media1.tenor.com/m/7ZNQqW8x9ZoAAAAC/anime-slap.gif',
  ],
  hug: [
    'https://media1.tenor.com/m/P0fK92xTiG4AAAAC/hug-anime.gif',
    'https://media1.tenor.com/m/Mp4-8z3rTuEAAAAC/hug-cuddle.gif',
    'https://media1.tenor.com/m/LXOR2cJY9WcAAAAC/anime-hug.gif',
  ],
  kiss: [
    'https://media1.tenor.com/m/TK1dAS3u1fcAAAAC/kiss-anime.gif',
    'https://media1.tenor.com/m/BsdnWrPaUKYAAAAC/kiss-love.gif',
    'https://media1.tenor.com/m/fF1aVoPqz2sAAAAC/kiss-cute.gif',
  ],
  punch: [
    'https://media1.tenor.com/m/4E5iEz6_qQEAAAAC/punch-anime.gif',
    'https://media1.tenor.com/m/EGKa5FKHO8oAAAAC/punch-fight.gif',
    'https://media1.tenor.com/m/k7bMb2d-XiEAAAAC/punch-anime-fight.gif',
  ],
  tickle: [
    'https://media1.tenor.com/m/jR9zA2-5vFsAAAAC/tickle-anime.gif',
    'https://media1.tenor.com/m/4GWL4z_yCx8AAAAC/tickle-laugh.gif',
    'https://media1.tenor.com/m/7q9k2aX-aMYAAAAC/tickle-cute.gif',
  ],
  poke: [
    'https://media1.tenor.com/m/sSvwVm-Sfm8AAAAC/poke-anime.gif',
    'https://media1.tenor.com/m/hA3tvZDzS_QAAAAC/poke-boop.gif',
    'https://media1.tenor.com/m/T5RQMQ8x-hEAAAAC/poke-hello.gif',
  ],
  cuddle: [
    'https://media1.tenor.com/m/9hxIgzICbqoAAAAC/cuddle-anime.gif',
    'https://media1.tenor.com/m/P0fK92xTiG4AAAAC/cuddle-hug.gif',
    'https://media1.tenor.com/m/0_6nKg-0dfgAAAAC/cuddle-cute.gif',
  ],
  dance: [
    'https://media1.tenor.com/m/9UjYI6AQ_bEAAAAC/dance-anime.gif',
    'https://media1.tenor.com/m/fFnfwbX-aQEAAAAC/dance-party.gif',
    'https://media1.tenor.com/m/kfIjKVZSkjYAAAAC/dance-happy.gif',
  ],
  highfive: [
    'https://media1.tenor.com/m/3CkJGf_kmgEAAAAC/highfive-anime.gif',
    'https://media1.tenor.com/m/bpvHmFQKyyYAAAAC/highfive-five.gif',
    'https://media1.tenor.com/m/kIq2F2kPrhEAAAAC/highfive-celebrate.gif',
  ],
  pat: [
    'https://media1.tenor.com/m/9gxg_SfR_voAAAAC/pat-anime.gif',
    'https://media1.tenor.com/m/5yF9zSG_q-QAAAAC/pat-head.gif',
    'https://media1.tenor.com/m/EpFJeCOBnOQAAAAC/pat-cute.gif',
  ],
  clap: [
    'https://media1.tenor.com/m/WJEZhjCnbdAAAAAC/clap-anime.gif',
    'https://media1.tenor.com/m/CZjEfcUuIBQAAAAC/clap-bravo.gif',
    'https://media1.tenor.com/m/iDaLp1vF8j0AAAAC/clap-applause.gif',
  ],
  stare: [
    'https://media1.tenor.com/m/9BZB3A7Q-GgAAAAC/stare-anime.gif',
    'https://media1.tenor.com/m/sdE3JU1Xjj0AAAAC/stare-intense.gif',
    'https://media1.tenor.com/m/pDb8W_uqVtIAAAAC/stare-looking.gif',
  ],
  boop: [
    'https://media1.tenor.com/m/QG3qL1b6Va0AAAAC/boop-nose.gif',
    'https://media1.tenor.com/m/LhvfHpHrFnIAAAAC/boop-cute.gif',
    'https://media1.tenor.com/m/q-Mfw6uGQWcAAAAC/boop-anime.gif',
  ],
  feed: [
    'https://media1.tenor.com/m/h1dPNR1jOiEAAAAC/feed-cookie.gif',
    'https://media1.tenor.com/m/KShAuJU3rQkAAAAC/feed-snack.gif',
    'https://media1.tenor.com/m/NmaIY74xJMYAAAAC/feed-cute.gif',
  ],
  bite: [
    'https://media1.tenor.com/m/QU-5ZXhJxnEAAAAC/bite-anime.gif',
    'https://media1.tenor.com/m/0IPxy7aEHXoAAAAC/bite-chomp.gif',
    'https://media1.tenor.com/m/Vcbmxz6JCaUAAAAC/bite-cute.gif',
  ],
};

/** Pick a random GIF for the given kind. */
function gifFor(kind) {
  const pool = GIFS[kind];
  if (!pool || pool.length === 0) return null;
  return pool[Math.floor(Math.random() * pool.length)];
}

/** Randomized flavor lines; {actor}/{target} are replaced with names. */
const LINES = {
  slap: [
    '{actor} slaps **{target}** right across the face! **{target}** staggers back, seeing stars.',
    '**{target}** gets a mighty slap from {actor}! The sound echoes across the whole server.',
    '{actor} winds up and slaps **{target}** so hard their ancestors feel it.',
    '🖐️ *SMACK!* {actor} has slapped **{target}**!',
  ],
  clap: [
    '{actor} claps for **{target}**! 👏👏 Standing ovation material.',
    '👏👏👏 {actor} gives **{target}** a round of applause. Slow clap. Then fast clap.',
    '{actor} claps. **{target}** bows gracefully.',
  ],
  pat: [
    '{actor} pats **{target}** on the head. **{target}** purrs softly.',
    'A gentle pat from {actor} for **{target}** — good boy/girl energy detected.',
    '**{target}** receives a comforting pat from {actor}. The server feels warmer already.',
  ],
  hug: [
    '{actor} wraps **{target}** in a big warm hug. 🤗',
    '**{target}** is hugged tightly by {actor}. They squeak happily.',
    'A group hug forms around **{target}**, led by {actor}! Everyone is safe now.',
  ],
  kiss: [
    '{actor} plants a kiss on **{target}**\'s cheek. 💋 They turn bright red.',
    '**{target}** gets a smooch from {actor}. Sparks fly across the channel.',
    '💋 {actor} kisses **{target}**! Their Discord profile briefly glows.',
  ],
  tickle: [
    '{actor} tickles **{target}**! They burst out laughing uncontrollably.',
    '🪶 {actor} tickles **{target}** into submission. *"Please, no more!"*',
    '**{target}** squirms as {actor} tickles them mercilessly.',
  ],
  poke: [
    '{actor} pokes **{target}**. 👉 **{target}** pokes back. It\'s war.',
    '👉 Poke! {actor} pokes **{target}**, who looks around confused.',
    '**{target}** has been poked by {actor}. Their attention has been acquired.',
  ],
  cuddle: [
    '{actor} curls up for a cuddle with **{target}**. 🧸 Maximum cozy achieved.',
    '🧸 {actor} cuddles **{target}**. Blankets and hot cocoa vibes.',
    '**{target}** is cuddled by {actor}. The server collectively goes *aww*.',
  ],
  stare: [
    '{actor} stares at **{target}**… 👀 …intensely. **{target}** checks their zipper.',
    '👀 {actor} stares deep into **{target}**\'s soul. They feel *seen*.',
    '**{target}** catches {actor} staring. Awkward silence. Then a nod.',
  ],
  boop: [
    '{actor} boops **{target}** on the nose. 🐾 *boop!*',
    '🐾 *Boop!* {actor} boops **{target}**. Irresistible, honestly.',
    '**{target}** gets a nose boop from {actor}. Their day is made.',
  ],
  feed: [
    '{actor} feeds **{target}** a freshly baked cookie. 🍪',
    '🍪 {actor} offers **{target}** a snack. Nom nom nom.',
    '**{target}** is fed by {actor}. Happiness +10.',
  ],
  highfive: [
    '{actor} raises a hand… **{target}** slaps it! 🙌 Perfect high five.',
    '🙌 {actor} and **{target}** high-five so hard it echoes.',
    '**{target}** returns {actor}\'s high five flawlessly. No hesitation.',
  ],
  punch: [
    '{actor} lands a solid punch on **{target}**! 👊 Oof.',
    '👊 *THUD!* {actor} punches **{target}**. Someone\'s getting a warning.',
    '**{target}** takes a punch from {actor} and shakes it off like a champ.',
  ],
  bite: [
    '{actor} bites **{target}**! 🦷 *nom.* It\'s affectionate, probably.',
    '🦷 {actor} nibbles **{target}**. They yelp dramatically.',
    '**{target}** is bitten by {actor}. Marks territory. OwO.',
  ],
  dance: [
    '{actor} and **{target}** break into a spontaneous dance. 💃🕺',
    '💃 {actor} pulls **{target}** onto the dance floor. No one can resist.',
    '**{target}** dances with {actor}. The beat drops. The server vibes.',
  ],
};

/** Pick a line deterministically (rng injectable for tests). */
function lineFor(kind, actorName, targetName, rng = Math.random) {
  const pool = LINES[kind] ?? LINES.slap;
  const line = pool[Math.floor(rng() * pool.length)];
  return line.replaceAll('{actor}', actorName).replaceAll('{target}', targetName);
}

/**
 * Perform an interaction. Returns the count for this pair+kind and a
 * rendered line. Self-interactions are allowed (OwO-style).
 */
function interact(guildId, actorId, targetId, kind, targetName = 'them', actorName = 'You', rng) {
  if (!KINDS.includes(kind)) {
    const err = new Error(`Unknown interaction \`${kind}\`.`);
    err.code = 'UNKNOWN_KIND';
    throw err;
  }
  const count = socialRepo.add(guildId, actorId, targetId, kind);
  const gif = gifFor(kind);
  return { kind, actorId, targetId, count, emoji: EMOJI[kind], gif, line: lineFor(kind, actorName, targetName, rng) };
}

/** Rich stats for one member: dealt/received per kind + lifetime. */
function stats(guildId, userId) {
  const dealt = socialRepo.dealt(guildId, userId).reduce((acc, r) => ({ ...acc, [r.kind]: r.total }), {});
  const received = socialRepo.received(guildId, userId).reduce((acc, r) => ({ ...acc, [r.kind]: r.total }), {});
  const lifetimeTotal = socialRepo.lifetime(guildId, userId);
  return { dealt, received, lifetime: lifetimeTotal };
}

/** Total interactions for a member in either role. */
function lifetime(guildId, userId) {
  return socialRepo.lifetime(guildId, userId);
}

/** Top N members by a specific kind (e.g. who slaps the most). */
function top(guildId, kind, n = 5) {
  if (!KINDS.includes(kind)) {
    const err = new Error(`Unknown interaction \`${kind}\`.`);
    err.code = 'UNKNOWN_KIND';
    throw err;
  }
  return socialRepo.top(guildId, kind, n);
}

module.exports = { socialService: { interact, stats, lifetime, top, KINDS, EMOJI, GIFS, gifFor } };
