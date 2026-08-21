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

/** Curated anime GIF URLs from Tenor (verified working). Falls back to emoji-only if all fail. */
const GIFS = {
  slap: [
    'https://media.tenor.com/cfobWWgjG8wAAAAC/anime-kaguya-sama.gif',
    'https://media.tenor.com/1GdYD6Wyf3wAAAAC/chunibyo-chuunibyou-demo-koi-ga-shitai.gif',
    'https://media.tenor.com/0ssFlowQEUQAAAAM/naru-punch.gif',
  ],
  hug: [
    'https://media.tenor.com/7f9CqFtd4SsAAAAM/hug.gif',
    'https://media.tenor.com/7oCaSR-q1kkAAAAM/alice-vt.gif',
    'https://media.tenor.com/4OHcWvReiCgAAAAM/hugs.gif',
  ],
  kiss: [
    'https://media.tenor.com/3480Xh8IgfAAAAAM/casal-anime.gif',
    'https://media.tenor.com/3OJ0mHw6tfMAAAAM/saya-hagi.gif',
    'https://media.tenor.com/52Tq8hCOTk4AAAAM/kissme-hon-anime.gif',
  ],
  punch: [
    'https://media.tenor.com/0ssFlowQEUQAAAAM/naru-punch.gif',
    'https://media.tenor.com/4kb-MzW-2jgAAAAM/sendo-ippo.gif',
    'https://media.tenor.com/54vXJe6Jj3kAAAAM/spy-family-spy-x-family.gif',
  ],
  tickle: [
    'https://media.tenor.com/0UY84zQWda8AAAAM/laugh-droll.gif',
    'https://media.tenor.com/15PqZtMQUWkAAAAM/natsu-erza.gif',
    'https://media.tenor.com/2Jh17akjyyEAAAAM/saikin-yatotta-maid-ga-ayashii-anime-tickle.gif',
  ],
  poke: [
    'https://media.tenor.com/-rM9lJr9BT8AAAAM/poke-anime.gif',
    'https://media.tenor.com/0wPms8tS0eoAAAAM/boop-poke.gif',
    'https://media.tenor.com/3dOqO4vVlr8AAAAM/poke-anime.gif',
  ],
  cuddle: [
    'https://media.tenor.com/08vDStcjoGAAAAAM/cuddle-anime-hug-anime.gif',
    'https://media.tenor.com/6_CN5d4S2wMAAAAM/anime-cute-anime-cuddle.gif',
    'https://media.tenor.com/59OfAXf4EUMAAAAM/anime-drawing.gif',
  ],
  dance: [
    'https://media.tenor.com/3wX8AyxMBfIAAAAM/nogg.gif',
    'https://media.tenor.com/6DxJzu87RocAAAAM/cute-girls.gif',
    'https://media.tenor.com/3YSeyf8bkTMAAAAM/dance.gif',
  ],
  highfive: [
    'https://media.tenor.com/1SKzPjLVtrIAAAAM/friends-high5.gif',
    'https://media.tenor.com/0WN6DfnOfF8AAAAM/wataten-watashi-ni-tenshi-ga-maiorita.gif',
    'https://media.tenor.com/0why9RLUJ74AAAAM/kanata-konoe-love-live.gif',
  ],
  pat: [
    'https://media.tenor.com/5Epx4bEKJA4AAAAM/frieren-pat.gif',
    'https://media.tenor.com/5a4O1hOHucgAAAAM/headpats-anime-headpat.gif',
    'https://media.tenor.com/2IXwqmUciHAAAAAM/pyseph-anime-vanguards.gif',
  ],
  clap: [
    'https://media.tenor.com/1HqzH509WBkAAAAM/slow-clap-clap.gif',
    'https://media.tenor.com/1GdYD6Wyf3wAAAAM/chunibyo-chuunibyou-demo-koi-ga-shitai.gif',
    'https://media.tenor.com/4CI4KY58SNsAAAAM/quagsire-nuoh.gif',
  ],
  stare: [
    'https://media.tenor.com/2RPEyp4NjRcAAAAM/nagatoro-stare.gif',
    'https://media.tenor.com/1Ds4FDvm92cAAAAM/sukuna.gif',
    'https://media.tenor.com/0Zrxg3b0nMwAAAAM/anime-girl.gif',
  ],
  boop: [
    'https://media.tenor.com/0qgTSXdBaZcAAAAM/anime-animation.gif',
    'https://media.tenor.com/1YMrMsCtxLQAAAAM/anime-poke.gif',
    'https://media.tenor.com/0wPms8tS0eoAAAAM/boop-poke.gif',
  ],
  feed: [
    'https://media.tenor.com/0cde6-gf-z8AAAAM/slow-start-anime.gif',
    'https://media.tenor.com/1gfvD5zWXKUAAAAM/chinesenewyear.gif',
    'https://media.tenor.com/1kwwQQvF-rMAAAAM/munch-munching.gif',
  ],
  bite: [
    'https://media.tenor.com/0neaBmDilHsAAAAM/anime-bite.gif',
    'https://media.tenor.com/0yrpvnpqSG0AAAAM/anime-bite.gif',
    'https://media.tenor.com/1AxqGIb7VP8AAAAM/call-of-the-night-yofukashi-no-uta.gif',
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
