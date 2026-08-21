'use strict';

/* Copyright © 2026 FGx. All rights reserved. */

/**
 * Dynamic GIF library — fetches from Tenor at runtime and caches.
 * Falls back to hardcoded anime GIFs if fetch fails.
 *
 * Usage:
 *   const { getGif } = require('../utils/gifLibrary');
 *   const url = await getGif('slap');       // anime slap gif
 *   const url = await getGif('roast');      // roast/burn gif
 *   const url = await getGif('dance', 3);   // 3 results, pick random
 */

const { logger } = require('./logger');

/** Cache: keyword → array of GIF URLs. Refreshes every 30 min. */
const cache = new Map();
const CACHE_TTL = 30 * 60 * 1000;

/** Curated search terms for each category. */
const SEARCH_TERMS = {
  slap: ['anime slap', 'slap anime', 'anime hit', 'smack anime'],
  hug: ['anime hug', 'hug anime', 'cuddle anime', 'comfort anime hug'],
  kiss: ['anime kiss', 'kiss anime', 'anime love kiss', 'anime blush kiss'],
  punch: ['anime punch', 'punch anime', 'anime fight', 'anime kick'],
  tickle: ['anime tickle', 'tickle anime', 'anime laugh', 'anime giggles'],
  poke: ['anime poke', 'poke anime', 'boop anime', 'anime poke poke'],
  cuddle: ['anime cuddle', 'cuddle anime', 'anime cozy', 'anime warm hug'],
  dance: ['anime dance', 'dance anime', 'anime party', 'anime vibes dance'],
  highfive: ['anime highfive', 'high five anime', 'anime celebrate', 'anime cheers'],
  pat: ['anime headpat', 'pat anime', 'anime pat head', 'frieren pat'],
  clap: ['anime clap', 'clap anime', 'anime applause', 'slow clap anime'],
  stare: ['anime stare', 'stare anime', 'anime suspicious', 'anime side eye'],
  boop: ['anime boop', 'boop anime', 'nose boop anime', 'anime poke nose'],
  feed: ['anime eat', 'anime food', 'anime cookie', 'anime snack'],
  bite: ['anime bite', 'bite anime', 'anime nibble', 'vampire anime bite'],
  roast: ['anime roast', 'anime burn', 'anime destroyed', 'anime oof'],
  sad: ['anime sad', 'sad anime', 'crying anime', 'anime tears'],
  happy: ['anime happy', 'happy anime', 'anime excited', 'anime joy'],
  angry: ['anime angry', 'angry anime', 'anime rage', 'anime mad'],
  confused: ['anime confused', 'confused anime', 'anime what', 'anime question'],
  laugh: ['anime laugh', 'laugh anime', 'anime lol', 'anime hilarious'],
  cringe: ['anime cringe', 'cringe anime', 'anime facepalm', 'anime disappointed'],
  vibe: ['anime vibe', 'vibe anime', 'anime chill', 'anime aesthetic'],
  dance_party: ['anime party', 'anime festival', 'anime celebration'],
  ship: ['anime ship', 'anime couple', 'anime love', 'anime romance'],
  roast_self: ['anime self burn', 'anime oof myself', 'anime pain'],
  cool: ['anime cool', 'cool anime', 'anime sunglasses', 'anime swagger'],
  shy: ['anime shy', 'shy anime', 'anime blush', 'anime embarrassed'],
  wave: ['anime wave', 'wave anime', 'anime hello', 'anime hi'],
  sleep: ['anime sleep', 'sleeping anime', 'anime tired', 'anime nap'],
  flex: ['anime flex', 'anime strong', 'anime muscle', 'anime power'],
  brain: ['anime think', 'big brain anime', 'anime smart', 'anime galaxy brain'],
  money: ['anime money', 'anime rich', 'anime cash', 'anime gold'],
  coffee: ['anime coffee', 'coffee anime', 'anime drink', 'anime cafe'],
  fight: ['anime fight', 'fight anime', 'anime battle', 'anime action'],
  death: ['anime death', 'anime rip', 'anime gone', 'anime soul leaving'],
  shocked: ['anime shocked', 'shocked anime', 'anime surprised', 'anime gasp'],
  sus: ['anime suspicious', 'sus anime', 'anime among us', 'anime suspect'],
  rip: ['anime rip', 'anime funeral', 'anime dead', 'anime gravestone'],
  sus2: ['anime detective', 'anime investigation', 'anime clue'],
  np: ['anime no problem', 'anime thumbs up', 'anime ok', 'anime sure'],
  trigger: ['anime triggered', 'triggered anime', 'anime angry', 'anime rage quit'],
  no_u: ['anime reverse', 'no u anime', 'anime card reverse', 'anime trap card'],
  bonk: ['anime bonk', 'bonk anime', 'anime jail', 'horny jail anime'],
  fbi: ['anime fbi', 'anime police', 'anime arrest', 'anime open up'],
  giga: ['giga chad anime', 'chad anime', 'anime sigma', 'anime grindset'],
  simp: ['anime simp', 'simp anime', 'anime hearts', 'anime drooling'],
  virgin: ['anime virgin', 'virgin walk anime', 'anime alone', 'anime loner'],
  chad: ['giga chad', 'chad anime', 'anime alpha', 'anime sigma male'],
  l: ['anime L', 'anime lose', 'anime fail', 'anime L moment'],
  w: ['anime W', 'anime win', 'anime victory', 'anime success'],
  ratio: ['anime ratio', 'ratio anime', 'anime L reply', 'anime ratio reply'],
  touch_grass: ['anime go outside', 'touch grass anime', 'anime sunlight', 'anime vitamin d'],
  cope: ['anime cope', 'cope anime', 'anime seethe', 'anime dilate'],
  seethe: ['anime angry', 'anime rage', 'anime seethe', 'anime mald'],
  mald: ['anime bald', 'anime hair pull', 'anime frustrated', 'anime malding'],
  poggers: ['anime poggers', 'pog anime', 'anime pogchamp', 'anime excited face'],
  based: ['anime based', 'based anime', 'anime respect', 'anime sigma'],
  yeet: ['anime throw', 'yeet anime', 'anime toss', 'anime yeet'],
  oof: ['anime oof', 'oof anime', 'anime ouch', 'anime pain'],
  sus_among: ['among us anime', 'sus anime', 'anime impostor', 'anime emergency meeting'],
  call: ['anime phone', 'anime call', 'anime talking', 'anime phone call'],
  run: ['anime run', 'run anime', 'anime fast', 'anime flee'],
  block: ['anime block', 'block anime', 'anime shield', 'anime defense'],
  dab: ['anime dab', 'dab anime', 'anime cool', 'anime dab pose'],
  nok: ['anime knock', 'knock anime', 'anime door', 'anime open door'],
  scream: ['anime scream', 'scream anime', 'anime yell', 'anime loud'],
  love: ['anime love', 'love anime', 'anime heart', 'anime valentine'],
  beg: ['anime beg', 'beg anime', 'anime please', 'anime pleading'],
  slap_me: ['anime get slapped', 'anime pain face', 'anime hurt', 'anime ow'],
  roast_target: ['anime destroyed', 'anime burn', 'anime owned', 'anime wrecked'],
};

/** Hardcoded fallback GIFs (verified working Tenor URLs). */
const FALLBACK = {
  slap: [
    'https://media.tenor.com/cfobWWgjG8wAAAAC/anime-kaguya-sama.gif',
    'https://media.tenor.com/1GdYD6Wyf3wAAAAC/chunibyo-chuunibyou-demo-koi-ga-shitai.gif',
  ],
  hug: [
    'https://media.tenor.com/7f9CqFtd4SsAAAAM/hug.gif',
    'https://media.tenor.com/7oCaSR-q1kkAAAAM/alice-vt.gif',
  ],
  kiss: [
    'https://media.tenor.com/3480Xh8IgfAAAAAM/casal-anime.gif',
    'https://media.tenor.com/3OJ0mHw6tfMAAAAM/saya-hagi.gif',
  ],
  punch: [
    'https://media.tenor.com/0ssFlowQEUQAAAAM/naru-punch.gif',
    'https://media.tenor.com/4kb-MzW-2jgAAAAM/sendo-ippo.gif',
  ],
  dance: [
    'https://media.tenor.com/3wX8AyxMBfIAAAAM/nogg.gif',
    'https://media.tenor.com/6DxJzu87RocAAAAM/cute-girls.gif',
  ],
  pat: [
    'https://media.tenor.com/5Epx4bEKJA4AAAAM/frieren-pat.gif',
    'https://media.tenor.com/5a4O1hOHucgAAAAM/headpats-anime-headpat.gif',
  ],
  roast: [
    'https://media.tenor.com/0ssFlowQEUQAAAAM/naru-punch.gif',
    'https://media.tenor.com/4kb-MzW-2jgAAAAM/sendo-ippo.gif',
  ],
  sad: [
    'https://media.tenor.com/0cde6-gf-z8AAAAM/slow-start-anime.gif',
    'https://media.tenor.com/59OfAXf4EUMAAAAM/anime-drawing.gif',
  ],
  happy: [
    'https://media.tenor.com/3wX8AyxMBfIAAAAM/nogg.gif',
    'https://media.tenor.com/6DxJzu87RocAAAAM/cute-girls.gif',
  ],
  angry: [
    'https://media.tenor.com/1GdYD6Wyf3wAAAAC/chunibyo-chuunibyou-demo-koi-ga-shitai.gif',
    'https://media.tenor.com/0ssFlowQEUQAAAAM/naru-punch.gif',
  ],
  laugh: [
    'https://media.tenor.com/0UY84zQWda8AAAAM/laugh-droll.gif',
    'https://media.tenor.com/15PqZtMQUWkAAAAM/natsu-erza.gif',
  ],
  cool: [
    'https://media.tenor.com/1SKzPjLVtrIAAAAM/friends-high5.gif',
    'https://media.tenor.com/0WN6DfnOfF8AAAAM/wataten-watashi-ni-tenshi-ga-maiorita.gif',
  ],
  vibe: [
    'https://media.tenor.com/3wX8AyxMBfIAAAAM/nogg.gif',
    'https://media.tenor.com/6DxJzu87RocAAAAM/cute-girls.gif',
  ],
  shy: [
    'https://media.tenor.com/0Zrxg3b0nMwAAAAM/anime-girl.gif',
    'https://media.tenor.com/2RPEyp4NjRcAAAAM/nagatoro-stare.gif',
  ],
  wave: [
    'https://media.tenor.com/7f9CqFtd4SsAAAAM/hug.gif',
    'https://media.tenor.com/1SKzPjLVtrIAAAAM/friends-high5.gif',
  ],
  sleep: [
    'https://media.tenor.com/59OfAXf4EUMAAAAM/anime-drawing.gif',
    'https://media.tenor.com/0UY84zQWda8AAAAM/laugh-droll.gif',
  ],
  flex: [
    'https://media.tenor.com/4kb-MzW-2jgAAAAM/sendo-ippo.gif',
    'https://media.tenor.com/0ssFlowQEUQAAAAM/naru-punch.gif',
  ],
  ship: [
    'https://media.tenor.com/3480Xh8IgfAAAAAM/casal-anime.gif',
    'https://media.tenor.com/52Tq8hCOTk4AAAAM/kissme-hon-anime.gif',
  ],
  fight: [
    'https://media.tenor.com/4kb-MzW-2jgAAAAM/sendo-ippo.gif',
    'https://media.tenor.com/54vXJe6Jj3kAAAAM/spy-family-spy-x-family.gif',
  ],
  confused: [
    'https://media.tenor.com/2RPEyp4NjRcAAAAM/nagatoro-stare.gif',
    'https://media.tenor.com/0Zrxg3b0nMwAAAAM/anime-girl.gif',
  ],
  shocked: [
    'https://media.tenor.com/1Ds4FDvm92cAAAAM/sukuna.gif',
    'https://media.tenor.com/2RPEyp4NjRcAAAAM/nagatoro-stare.gif',
  ],
  sus: [
    'https://media.tenor.com/2RPEyp4NjRcAAAAM/nagatoro-stare.gif',
    'https://media.tenor.com/1Ds4FDvm92cAAAAM/sukuna.gif',
  ],
  rip: [
    'https://media.tenor.com/0cde6-gf-z8AAAAM/slow-start-anime.gif',
    'https://media.tenor.com/59OfAXf4EUMAAAAM/anime-drawing.gif',
  ],
  giga: [
    'https://media.tenor.com/4kb-MzW-2jgAAAAM/sendo-ippo.gif',
    'https://media.tenor.com/0ssFlowQEUQAAAAM/naru-punch.gif',
  ],
  w: [
    'https://media.tenor.com/3wX8AyxMBfIAAAAM/nogg.gif',
    'https://media.tenor.com/6DxJzu87RocAAAAM/cute-girls.gif',
  ],
  l: [
    'https://media.tenor.com/0cde6-gf-z8AAAAM/slow-start-anime.gif',
    'https://media.tenor.com/59OfAXf4EUMAAAAM/anime-drawing.gif',
  ],
  brain: [
    'https://media.tenor.com/1Ds4FDvm92cAAAAM/sukuna.gif',
    'https://media.tenor.com/0Zrxg3b0nMwAAAAM/anime-girl.gif',
  ],
  oof: [
    'https://media.tenor.com/0cde6-gf-z8AAAAM/slow-start-anime.gif',
    'https://media.tenor.com/0ssFlowQEUQAAAAM/naru-punch.gif',
  ],
  scream: [
    'https://media.tenor.com/0ssFlowQEUQAAAAM/naru-punch.gif',
    'https://media.tenor.com/1GdYD6Wyf3wAAAAC/chunibyo-chuunibyou-demo-koi-ga-shitai.gif',
  ],
  beg: [
    'https://media.tenor.com/0cde6-gf-z8AAAAM/slow-start-anime.gif',
    'https://media.tenor.com/0Zrxg3b0nMwAAAAM/anime-girl.gif',
  ],
};

/**
 * Fetch GIF URLs from Tenor for a given search query.
 * Returns an array of media URLs.
 */
async function fetchFromTenor(query, limit = 5) {
  try {
    // Use Tenor's anonymous search page and extract GIF URLs
    const url = `https://tenor.com/search/${encodeURIComponent(query).replace(/%20/g, '-')}-gifs`;
    const res = await fetch(url, {
      headers: { 'User-Agent': 'Mozilla/5.0 (FGxBot/1.0)' },
      signal: AbortSignal.timeout(5000),
    });
    if (!res.ok) return [];
    const html = await res.text();
    // Extract .gif URLs from the page
    const matches = html.match(/https:\/\/media\d*\.tenor\.com\/[^"'\s]+\.gif/g) || [];
    // Deduplicate and take unique ones
    const unique = [...new Set(matches)];
    return unique.slice(0, limit);
  } catch {
    return [];
  }
}

/**
 * Get GIFs for a category. Caches results for 30 minutes.
 * Tries Tenor first, falls back to hardcoded URLs.
 */
async function getGifs(keyword, count = 3) {
  const cacheKey = keyword;
  const cached = cache.get(cacheKey);
  if (cached && Date.now() - cached.ts < CACHE_TTL) {
    return cached.urls;
  }

  // Try Tenor search
  const terms = SEARCH_TERMS[keyword] || [keyword];
  const randomTerm = terms[Math.floor(Math.random() * terms.length)];
  let urls = await fetchFromTenor(randomTerm, 10);

  // If no results, try alternate search terms
  if (urls.length === 0 && terms.length > 1) {
    for (const term of terms.slice(1)) {
      urls = await fetchFromTenor(term, 5);
      if (urls.length > 0) break;
    }
  }

  // Fallback to hardcoded
  if (urls.length === 0) {
    urls = FALLBACK[keyword] || FALLBACK.slap || [];
  }

  cache.set(cacheKey, { urls, ts: Date.now() });
  return urls;
}

/**
 * Get a single random GIF for a keyword.
 */
async function getGif(keyword) {
  const urls = await getGifs(keyword, 5);
  if (urls.length === 0) return null;
  return urls[Math.floor(Math.random() * urls.length)];
}

/**
 * Clear the cache (for testing or manual refresh).
 */
function clearCache() {
  cache.clear();
}

module.exports = { getGif, getGifs, clearCache, SEARCH_TERMS, FALLBACK };
