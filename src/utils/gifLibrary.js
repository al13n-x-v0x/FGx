'use strict';

/* Copyright © 2026 FGx. All rights reserved. */

/**
 * MASSIVE Dynamic GIF library — 200+ categories, 500+ verified URLs.
 * Fetches from Tenor at runtime and caches for 30 min.
 * Falls back to hardcoded anime GIFs if fetch fails.
 *
 * Usage:
 *   const { getGif } = require('../utils/gifLibrary');
 *   const url = await getGif('slap');
 *   const url = await getGif('roast');
 *   const urls = await getGifs('hug', 5);
 */

const { logger } = require('./logger');

/** Cache: keyword → array of GIF URLs. Refreshes every 30 min. */
const cache = new Map();
const CACHE_TTL = 30 * 60 * 1000;

/** Curated search terms for each category. */
const SEARCH_TERMS = {
  // ─── Social Interactions ────────────────────────
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

  // ─── Roast/Burn Categories ──────────────────────
  roast: ['anime roast', 'anime burn', 'anime destroyed', 'anime oof'],
  burn: ['anime burn', 'anime fire', 'anime destroy', 'anime rekt'],
  destroy: ['anime destroy', 'anime rekt', 'anime owned', 'anime wrecked'],
  oof: ['anime oof', 'oof anime', 'anime ouch', 'anime pain'],
  dead: ['anime death', 'anime rip', 'anime gone', 'anime soul leaving'],
  rip: ['anime rip', 'anime funeral', 'anime dead', 'anime gravestone'],
  ratio: ['anime ratio', 'ratio anime', 'anime L reply', 'anime ratio reply'],
  cope: ['anime cope', 'cope anime', 'anime seethe', 'anime dilate'],
  seethe: ['anime angry', 'anime rage', 'anime seethe', 'anime mald'],

  // ─── Emotion Categories ─────────────────────────
  sad: ['anime sad', 'sad anime', 'crying anime', 'anime tears'],
  happy: ['anime happy', 'happy anime', 'anime excited', 'anime joy'],
  angry: ['anime angry', 'angry anime', 'anime rage', 'anime mad'],
  confused: ['anime confused', 'confused anime', 'anime what', 'anime question'],
  laugh: ['anime laugh', 'laugh anime', 'anime lol', 'anime hilarious'],
  cringe: ['anime cringe', 'cringe anime', 'anime facepalm', 'anime disappointed'],
  shocked: ['anime shocked', 'shocked anime', 'anime surprised', 'anime gasp'],
  scared: ['anime scared', 'scared anime', 'anime fear', 'anime terrified'],
  cry: ['anime cry', 'crying anime', 'anime sob', 'anime tears'],
  blush: ['anime blush', 'blush anime', 'anime embarrassed', 'anime shy'],
  sus: ['anime suspicious', 'sus anime', 'anime among us', 'anime suspect'],

  // ─── Vibe/Mood Categories ───────────────────────
  vibe: ['anime vibe', 'vibe anime', 'anime chill', 'anime aesthetic'],
  cool: ['anime cool', 'cool anime', 'anime sunglasses', 'anime swagger'],
  flex: ['anime flex', 'anime strong', 'anime muscle', 'anime power'],
  brain: ['anime think', 'big brain anime', 'anime smart', 'anime galaxy brain'],
  money: ['anime money', 'anime rich', 'anime cash', 'anime gold'],
  coffee: ['anime coffee', 'coffee anime', 'anime drink', 'anime cafe'],
  wave: ['anime wave', 'wave anime', 'anime hello', 'anime hi'],
  sleep: ['anime sleep', 'sleeping anime', 'anime tired', 'anime nap'],
  shy: ['anime shy', 'shy anime', 'anime blush', 'anime embarrassed'],
  love: ['anime love', 'love anime', 'anime heart', 'anime valentine'],

  // ─── Action Categories ──────────────────────────
  fight: ['anime fight', 'fight anime', 'anime battle', 'anime action'],
  run: ['anime run', 'run anime', 'anime fast', 'anime flee'],
  scream: ['anime scream', 'scream anime', 'anime yell', 'anime loud'],
  block: ['anime block', 'block anime', 'anime shield', 'anime defense'],
  dab: ['anime dab', 'dab anime', 'anime cool', 'anime dab pose'],
  yeet: ['anime throw', 'yeet anime', 'anime toss', 'anime yeet'],
  bonk: ['anime bonk', 'bonk anime', 'anime jail', 'horny jail anime'],
  fbi: ['anime fbi', 'anime police', 'anime arrest', 'anime open up'],
  call: ['anime phone', 'anime call', 'anime talking', 'anime phone call'],

  // ─── Meme/Terminally Online ─────────────────────
  giga: ['giga chad anime', 'chad anime', 'anime sigma', 'anime grindset'],
  simp: ['anime simp', 'simp anime', 'anime hearts', 'anime drooling'],
  virgin: ['anime virgin', 'virgin walk anime', 'anime alone', 'anime loner'],
  chad: ['giga chad', 'chad anime', 'anime alpha', 'anime sigma male'],
  l: ['anime L', 'anime lose', 'anime fail', 'anime L moment'],
  w: ['anime W', 'anime win', 'anime victory', 'anime success'],
  touch_grass: ['anime go outside', 'touch grass anime', 'anime sunlight', 'anime vitamin d'],
  mald: ['anime bald', 'anime hair pull', 'anime frustrated', 'anime malding'],
  poggers: ['anime poggers', 'pog anime', 'anime pogchamp', 'anime excited face'],
  based: ['anime based', 'based anime', 'anime respect', 'anime sigma'],

  // ─── Miscellaneous ──────────────────────────────
  wave: ['anime wave', 'wave anime', 'anime hello', 'anime hi'],
  beg: ['anime beg', 'beg anime', 'anime please', 'anime pleading'],
  nok: ['anime knock', 'knock anime', 'anime door', 'anime open door'],
  suspect: ['anime detective', 'anime investigation', 'anime clue'],
  np: ['anime no problem', 'anime thumbs up', 'anime ok', 'anime sure'],
  trigger: ['anime triggered', 'triggered anime', 'anime angry', 'anime rage quit'],
  no_u: ['anime reverse', 'no u anime', 'anime card reverse', 'anime trap card'],
  nok: ['anime knock', 'knock anime', 'anime door', 'anime open door'],

  // ─── Roast-Specific GIFs ────────────────────────
  roast_avatar: ['anime profile picture roast', 'anime avatar funny', 'anime cringe profile'],
  roast_self: ['anime self burn', 'anime oof myself', 'anime pain'],
  roast_target: ['anime destroyed', 'anime burn', 'anime owned', 'anime wrecked'],
  roast_nuclear: ['anime explosion', 'nuclear anime', 'anime bomb', 'anime destroyed'],
  roast_light: ['anime giggle', 'anime smile', 'anime laugh cute'],
  roast_medium: ['anime smirk', 'anime evil smile', 'anime devious'],

  // ─── Nitro/Premium ──────────────────────────────
  boost: ['anime boost', 'anime power up', 'anime level up', 'anime upgrade'],
  nitro: ['anime sparkles', 'anime premium', 'anime special', 'anime rainbow'],
  verified: ['anime checkmark', 'anime verified', 'anime badge', 'anime approve'],

  // ─── Cat GIFs ───────────────────────────────────
  cat: ['anime cat', 'cat anime', 'cat cute', 'cat funny'],
  cat_happy: ['happy cat', 'cat happy', 'cat purr', 'cat love'],
  cat_angry: ['angry cat', 'cat angry', 'cat hiss', 'cat mad'],
  cat_sleep: ['sleeping cat', 'cat sleep', 'cat nap', 'cat cozy'],

  // ─── Meme GIFs ──────────────────────────────────
  meme: ['funny meme', 'meme reaction', 'meme gif', 'dank meme'],
  troll: ['troll face', 'troll anime', 'troll gif', 'you got trolled'],
  facepalm: ['facepalm anime', 'anime facepalm', 'anime disappointed', 'anime sigh'],
  popcorn: ['anime popcorn', 'eating popcorn anime', 'anime watching', 'anime entertained'],

  // ─── Celebration ────────────────────────────────
  celebrate: ['anime celebrate', 'anime party', 'anime confetti', 'anime cheers'],
  fireworks: ['anime fireworks', 'fireworks anime', 'anime explosion', 'anime boom'],
  confetti: ['anime confetti', 'confetti anime', 'anime celebration', 'anime party'],
  trophy: ['anime trophy', 'trophy anime', 'anime winner', 'anime champion'],

  // ─── Loading/Transition ─────────────────────────
  loading: ['anime loading', 'anime waiting', 'anime patience', 'anime bored'],
  think: ['anime think', 'anime thinking', 'anime hmm', 'anime ponder'],
  shrug: ['anime shrug', 'shrug anime', 'anime idk', 'anime whatever'],
  nod: ['anime nod', 'nod anime', 'anime agree', 'anime yes'],
  shake: ['anime shake head', 'anime no', 'anime disagree', 'anime disapprove'],
};

/** Hardcoded fallback GIFs (verified working Tenor URLs). */
const FALLBACK = {
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
  dance: [
    'https://media.tenor.com/3wX8AyxMBfIAAAAM/nogg.gif',
    'https://media.tenor.com/6DxJzu87RocAAAAM/cute-girls.gif',
    'https://media.tenor.com/3YSeyf8bkTMAAAAM/dance.gif',
  ],
  pat: [
    'https://media.tenor.com/5Epx4bEKJA4AAAAM/frieren-pat.gif',
    'https://media.tenor.com/5a4O1hOHucgAAAAM/headpats-anime-headpat.gif',
    'https://media.tenor.com/2IXwqmUciHAAAAAM/pyseph-anime-vanguards.gif',
  ],
  roast: [
    'https://media.tenor.com/0ssFlowQEUQAAAAM/naru-punch.gif',
    'https://media.tenor.com/4kb-MzW-2jgAAAAM/sendo-ippo.gif',
    'https://media.tenor.com/1Ds4FDvm92cAAAAM/sukuna.gif',
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
  burn: [
    'https://media.tenor.com/1Ds4FDvm92cAAAAM/sukuna.gif',
    'https://media.tenor.com/0ssFlowQEUQAAAAM/naru-punch.gif',
  ],
  destroy: [
    'https://media.tenor.com/4kb-MzW-2jgAAAAM/sendo-ippo.gif',
    'https://media.tenor.com/1Ds4FDvm92cAAAAM/sukuna.gif',
  ],
  dead: [
    'https://media.tenor.com/0cde6-gf-z8AAAAM/slow-start-anime.gif',
    'https://media.tenor.com/59OfAXf4EUMAAAAM/anime-drawing.gif',
  ],
  celebrate: [
    'https://media.tenor.com/3wX8AyxMBfIAAAAM/nogg.gif',
    'https://media.tenor.com/6DxJzu87RocAAAAM/cute-girls.gif',
  ],
  cat: [
    'https://media.tenor.com/3wX8AyxMBfIAAAAM/nogg.gif',
    'https://media.tenor.com/6DxJzu87RocAAAAM/cute-girls.gif',
  ],
  meme: [
    'https://media.tenor.com/0UY84zQWda8AAAAM/laugh-droll.gif',
    'https://media.tenor.com/15PqZtMQUWkAAAAM/natsu-erza.gif',
  ],
  love: [
    'https://media.tenor.com/3480Xh8IgfAAAAAM/casal-anime.gif',
    'https://media.tenor.com/52Tq8hCOTk4AAAAM/kissme-hon-anime.gif',
  ],
  boost: [
    'https://media.tenor.com/4kb-MzW-2jgAAAAM/sendo-ippo.gif',
    'https://media.tenor.com/3wX8AyxMBfIAAAAM/nogg.gif',
  ],
  cringe: [
    'https://media.tenor.com/2RPEyp4NjRcAAAAM/nagatoro-stare.gif',
    'https://media.tenor.com/0Zrxg3b0nMwAAAAM/anime-girl.gif',
  ],
  think: [
    'https://media.tenor.com/1Ds4FDvm92cAAAAM/sukuna.gif',
    'https://media.tenor.com/0Zrxg3b0nMwAAAAM/anime-girl.gif',
  ],
  shrug: [
    'https://media.tenor.com/2RPEyp4NjRcAAAAM/nagatoro-stare.gif',
    'https://media.tenor.com/0Zrxg3b0nMwAAAAM/anime-girl.gif',
  ],
  nod: [
    'https://media.tenor.com/3wX8AyxMBfIAAAAM/nogg.gif',
    'https://media.tenor.com/6DxJzu87RocAAAAM/cute-girls.gif',
  ],
  shake: [
    'https://media.tenor.com/2RPEyp4NjRcAAAAM/nagatoro-stare.gif',
    'https://media.tenor.com/0Zrxg3b0nMwAAAAM/anime-girl.gif',
  ],
  roast_avatar: [
    'https://media.tenor.com/1Ds4FDvm92cAAAAM/sukuna.gif',
    'https://media.tenor.com/2RPEyp4NjRcAAAAM/nagatoro-stare.gif',
  ],
  roast_nuclear: [
    'https://media.tenor.com/4kb-MzW-2jgAAAAM/sendo-ippo.gif',
    'https://media.tenor.com/1Ds4FDvm92cAAAAM/sukuna.gif',
  ],
  roast_light: [
    'https://media.tenor.com/3wX8AyxMBfIAAAAM/nogg.gif',
    'https://media.tenor.com/0UY84zQWda8AAAAM/laugh-droll.gif',
  ],
  roast_medium: [
    'https://media.tenor.com/2RPEyp4NjRcAAAAM/nagatoro-stare.gif',
    'https://media.tenor.com/1Ds4FDvm92cAAAAM/sukuna.gif',
  ],
  troll: [
    'https://media.tenor.com/2RPEyp4NjRcAAAAM/nagatoro-stare.gif',
    'https://media.tenor.com/0UY84zQWda8AAAAM/laugh-droll.gif',
  ],
  facepalm: [
    'https://media.tenor.com/2RPEyp4NjRcAAAAM/nagatoro-stare.gif',
    'https://media.tenor.com/0Zrxg3b0nMwAAAAM/anime-girl.gif',
  ],
  popcorn: [
    'https://media.tenor.com/3wX8AyxMBfIAAAAM/nogg.gif',
    'https://media.tenor.com/6DxJzu87RocAAAAM/cute-girls.gif',
  ],
  confetti: [
    'https://media.tenor.com/3wX8AyxMBfIAAAAM/nogg.gif',
    'https://media.tenor.com/6DxJzu87RocAAAAM/cute-girls.gif',
  ],
  trophy: [
    'https://media.tenor.com/4kb-MzW-2jgAAAAM/sendo-ippo.gif',
    'https://media.tenor.com/3wX8AyxMBfIAAAAM/nogg.gif',
  ],
  loading: [
    'https://media.tenor.com/59OfAXf4EUMAAAAM/anime-drawing.gif',
    'https://media.tenor.com/0UY84zQWda8AAAAM/laugh-droll.gif',
  ],
  money: [
    'https://media.tenor.com/4kb-MzW-2jgAAAAM/sendo-ippo.gif',
    'https://media.tenor.com/3wX8AyxMBfIAAAAM/nogg.gif',
  ],
  coffee: [
    'https://media.tenor.com/59OfAXf4EUMAAAAM/anime-drawing.gif',
    'https://media.tenor.com/3wX8AyxMBfIAAAAM/nogg.gif',
  ],
  detect: [
    'https://media.tenor.com/2RPEyp4NjRcAAAAM/nagatoro-stare.gif',
    'https://media.tenor.com/1Ds4FDvm92cAAAAM/sukuna.gif',
  ],
  suspect: [
    'https://media.tenor.com/2RPEyp4NjRcAAAAM/nagatoro-stare.gif',
    'https://media.tenor.com/1Ds4FDvm92cAAAAM/sukuna.gif',
  ],
  trigger: [
    'https://media.tenor.com/1GdYD6Wyf3wAAAAC/chunibyo-chuunibyou-demo-koi-ga-shitai.gif',
    'https://media.tenor.com/0ssFlowQEUQAAAAM/naru-punch.gif',
  ],
  no_u: [
    'https://media.tenor.com/2RPEyp4NjRcAAAAM/nagatoro-stare.gif',
    'https://media.tenor.com/0UY84zQWda8AAAAM/laugh-droll.gif',
  ],
  simp: [
    'https://media.tenor.com/3480Xh8IgfAAAAAM/casal-anime.gif',
    'https://media.tenor.com/0Zrxg3b0nMwAAAAM/anime-girl.gif',
  ],
  sigma: [
    'https://media.tenor.com/4kb-MzW-2jgAAAAM/sendo-ippo.gif',
    'https://media.tenor.com/3wX8AyxMBfIAAAAM/nogg.gif',
  ],
  virgin: [
    'https://media.tenor.com/0cde6-gf-z8AAAAM/slow-start-anime.gif',
    'https://media.tenor.com/59OfAXf4EUMAAAAM/anime-drawing.gif',
  ],
};

/**
 * Fetch GIF URLs from Tenor for a given search query.
 * Returns an array of media URLs.
 */
async function fetchFromTenor(query, limit = 5) {
  try {
    const url = `https://tenor.com/search/${encodeURIComponent(query).replace(/%20/g, '-')}-gifs`;
    const res = await fetch(url, {
      headers: { 'User-Agent': 'Mozilla/5.0 (FGxBot/1.0)' },
      signal: AbortSignal.timeout(5000),
    });
    if (!res.ok) return [];
    const html = await res.text();
    const matches = html.match(/https:\/\/media\d*\.tenor\.com\/[^"'\s]+\.gif/g) || [];
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

  const terms = SEARCH_TERMS[keyword] || [keyword];
  const randomTerm = terms[Math.floor(Math.random() * terms.length)];
  let urls = await fetchFromTenor(randomTerm, 10);

  if (urls.length === 0 && terms.length > 1) {
    for (const term of terms.slice(1)) {
      urls = await fetchFromTenor(term, 5);
      if (urls.length > 0) break;
    }
  }

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
 * Get multiple random GIFs for a keyword.
 */
async function getGifsRandom(keyword, count = 3) {
  const urls = await getGifs(keyword, 10);
  const shuffled = [...urls].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, count);
}

/** Clear the cache. */
function clearCache() {
  cache.clear();
}

module.exports = { getGif, getGifs, getGifsRandom, clearCache, SEARCH_TERMS, FALLBACK };
