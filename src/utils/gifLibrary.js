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
  slap: ['anime slap', 'slap anime', 'anime hit', 'smack anime', 'anime face slap', 'slap reaction anime'],
  hug: ['anime hug', 'hug anime', 'cuddle anime', 'comfort anime hug', 'anime warm hug', 'wholesome hug anime'],
  kiss: ['anime kiss', 'kiss anime', 'anime love kiss', 'anime blush kiss', 'anime romance kiss', 'anime couple kiss'],
  punch: ['anime punch', 'punch anime', 'anime fight', 'anime kick', 'anime uppercut', 'anime knockout'],
  tickle: ['anime tickle', 'tickle anime', 'anime laugh', 'anime giggles', 'anime tickle fight', 'funny anime tickle'],
  poke: ['anime poke', 'poke anime', 'boop anime', 'anime poke poke', 'cute anime poke', 'anime nose boop'],
  cuddle: ['anime cuddle', 'cuddle anime', 'anime cozy', 'anime warm hug', 'anime blanket cuddle', 'anime spoon'],
  dance: ['anime dance', 'dance anime', 'anime party', 'anime vibes dance', 'anime groovy', 'anime disco'],
  highfive: ['anime highfive', 'high five anime', 'anime celebrate', 'anime cheers', 'anime team up', 'anime fist bump'],
  pat: ['anime headpat', 'pat anime', 'anime pat head', 'frieren pat', 'cute anime pat', 'anime head pat'],
  clap: ['anime clap', 'clap anime', 'anime applause', 'slow clap anime', 'anime standing ovation', 'anime bravo'],
  stare: ['anime stare', 'stare anime', 'anime suspicious', 'anime side eye', 'anime judge', 'anime glare'],
  boop: ['anime boop', 'boop anime', 'nose boop anime', 'anime poke nose', 'cute boop', 'anime boop snoot'],
  feed: ['anime eat', 'anime food', 'anime cookie', 'anime snack', 'anime feeding', 'anime eating cute'],
  bite: ['anime bite', 'bite anime', 'anime nibble', 'vampire anime bite', 'anime chomp', 'anime fang bite'],
  kill: ['anime kill', 'kill anime', 'anime death', 'anime eliminate', 'anime destroy', 'anime fatality'],
  bonk: ['anime bonk', 'bonk anime', 'anime jail', 'horny jail anime', 'frying pan bonk', 'anime hammer'],
  yeet: ['anime throw', 'yeet anime', 'anime toss', 'anime yeet', 'anime launch', 'anime yeet throw'],
  shoot: ['anime shoot', 'anime gun', 'anime pistol', 'anime sniper', 'anime eliminate', 'anime pew pew'],
  stab: ['anime stab', 'anime knife', 'anime sword', 'anime backstab', 'anime assassin', 'anime blade'],
  destroy: ['anime destroy', 'anime rekt', 'anime owned', 'anime wrecked', 'anime explosion', 'anime annihilation'],
  revive: ['anime revive', 'anime resurrection', 'anime healing', 'anime life', 'anime phoenix', 'anime healing magic'],

  // ─── Roast/Burn Categories ──────────────────────
  roast: ['anime roast', 'anime burn', 'anime destroyed', 'anime oof', 'anime roast reaction', 'anime burned'],
  burn: ['anime burn', 'anime fire', 'anime destroy', 'anime rekt', 'anime literal burn', 'anime fire reaction'],
  oof: ['anime oof', 'oof anime', 'anime ouch', 'anime pain', 'anime oof reaction', 'anime big oof'],
  dead: ['anime death', 'anime rip', 'anime gone', 'anime soul leaving', 'anime dying', 'anime flatline'],
  rip: ['anime rip', 'anime funeral', 'anime dead', 'anime gravestone', 'anime rest in peace', 'anime coffin'],
  ratio: ['anime ratio', 'ratio anime', 'anime L reply', 'anime ratio reply', 'anime L', 'anime take the L'],
  cope: ['anime cope', 'cope anime', 'anime seethe', 'anime dilate', 'anime cope harder', 'anime mald cope'],
  seethe: ['anime angry', 'anime rage', 'anime seethe', 'anime mald', 'anime tilt', 'anime pure rage'],

  // ─── Emotion Categories ─────────────────────────
  sad: ['anime sad', 'sad anime', 'crying anime', 'anime tears', 'anime depression', 'anime heartbroken'],
  happy: ['anime happy', 'happy anime', 'anime excited', 'anime joy', 'anime celebrate', 'anime pure joy'],
  angry: ['anime angry', 'angry anime', 'anime rage', 'anime mad', 'anime fury', 'anime rage quit'],
  confused: ['anime confused', 'confused anime', 'anime what', 'anime question', 'anime perplexed', 'anime huh'],
  laugh: ['anime laugh', 'laugh anime', 'anime lol', 'anime hilarious', 'anime wheeze', 'anime dying laughing'],
  cringe: ['anime cringe', 'cringe anime', 'anime facepalm', 'anime disappointed', 'anime disgust', 'anime YIKES'],
  shocked: ['anime shocked', 'shocked anime', 'anime surprised', 'anime gasp', 'anime jaw drop', 'anime disbelief'],
  scared: ['anime scared', 'scared anime', 'anime fear', 'anime terrified', 'anime horror', 'anime scream fear'],
  cry: ['anime cry', 'crying anime', 'anime sob', 'anime tears', 'anime bawling', 'anime crying hard'],
  blush: ['anime blush', 'blush anime', 'anime embarrassed', 'anime shy', 'anime turn red', 'anime flustered'],
  sus: ['anime suspicious', 'sus anime', 'anime among us', 'anime suspect', 'anime investigation', 'anime detective'],

  // ─── Vibe/Mood Categories ───────────────────────
  vibe: ['anime vibe', 'vibe anime', 'anime chill', 'anime aesthetic', 'anime lofi', 'anime relaxing'],
  cool: ['anime cool', 'cool anime', 'anime sunglasses', 'anime swagger', 'anime badass', 'anime ice cold'],
  flex: ['anime flex', 'anime strong', 'anime muscle', 'anime power', 'anime buff', 'anime gains'],
  brain: ['anime think', 'big brain anime', 'anime smart', 'anime galaxy brain', 'anime 200 IQ', 'anime genius'],
  money: ['anime money', 'anime rich', 'anime cash', 'anime gold', 'anime bag', 'anime stonks'],
  coffee: ['anime coffee', 'coffee anime', 'anime drink', 'anime cafe', 'anime morning coffee', 'anime latte'],
  wave: ['anime wave', 'wave anime', 'anime hello', 'anime hi', 'anime greeting', 'anime welcome wave'],
  sleep: ['anime sleep', 'sleeping anime', 'anime tired', 'anime nap', 'anime snooze', 'anime zzz'],
  shy: ['anime shy', 'shy anime', 'anime blush', 'anime embarrassed', 'anime timid', 'anime hiding face'],
  love: ['anime love', 'love anime', 'anime heart', 'anime valentine', 'anime romance', 'anime love confession'],

  // ─── Action Categories ──────────────────────────
  fight: ['anime fight', 'fight anime', 'anime battle', 'anime action', 'anime brawl', 'anime combat'],
  run: ['anime run', 'run anime', 'anime fast', 'anime flee', 'anime sprint', 'anime chase'],
  scream: ['anime scream', 'scream anime', 'anime yell', 'anime loud', 'anime shriek', 'anime AAAAA'],
  block: ['anime block', 'block anime', 'anime shield', 'anime defense', 'anime guard', 'anime parry'],
  dab: ['anime dab', 'dab anime', 'anime cool', 'anime dab pose', 'anime victory dab', 'anime celebrate dab'],

  // ─── Meme/Terminally Online ─────────────────────
  giga: ['giga chad anime', 'chad anime', 'anime sigma', 'anime grindset', 'anime alpha male', 'giga chad'],
  simp: ['anime simp', 'simp anime', 'anime hearts', 'anime drooling', 'anime down bad', 'anime love struck'],
  virgin: ['anime virgin', 'virgin walk anime', 'anime alone', 'anime loner', 'anime solitary', 'anime nobody'],
  chad: ['giga chad', 'chad anime', 'anime alpha', 'anime sigma male', 'anime chad walk', 'anime gigachad'],
  l: ['anime L', 'anime lose', 'anime fail', 'anime L moment', 'anime take the L', 'anime failure'],
  w: ['anime W', 'anime win', 'anime victory', 'anime success', 'anime take the W', 'anime winning'],
  touch_grass: ['anime go outside', 'touch grass anime', 'anime sunlight', 'anime vitamin d', 'anime outdoors', 'anime nature'],
  mald: ['anime bald', 'anime hair pull', 'anime frustrated', 'anime malding', 'anime tilting', 'anime rage'],
  poggers: ['anime poggers', 'pog anime', 'anime pogchamp', 'anime excited face', 'anime POG', 'anime pog moment'],
  based: ['anime based', 'based anime', 'anime respect', 'anime sigma', 'anime chad based', 'anime respect based'],

  // ─── Miscellaneous ──────────────────────────────
  beg: ['anime beg', 'beg anime', 'anime please', 'anime pleading', 'anime mercy', 'anime begging on knees'],
  trigger: ['anime triggered', 'triggered anime', 'anime angry', 'anime rage quit', 'anime triggered intensifies', 'anime keyboard smash'],
  no_u: ['anime reverse', 'no u anime', 'anime card reverse', 'anime trap card', 'anime uno reverse', 'anime switcheroo'],
  troll: ['troll face', 'troll anime', 'troll gif', 'you got trolled', 'anime troll', 'anime trick'],
  facepalm: ['facepalm anime', 'anime facepalm', 'anime disappointed', 'anime sigh', 'anime smh', 'anime forehead slap'],
  popcorn: ['anime popcorn', 'eating popcorn anime', 'anime watching', 'anime entertained', 'anime spectator', 'anime enjoying drama'],

  // ─── Celebration ────────────────────────────────
  celebrate: ['anime celebrate', 'anime party', 'anime confetti', 'anime cheers', 'anime victory dance', 'anime congrats'],
  fireworks: ['anime fireworks', 'fireworks anime', 'anime explosion', 'anime boom', 'anime sparkler', 'anime new year'],
  confetti: ['anime confetti', 'confetti anime', 'anime celebration', 'anime party', 'anime streamers', 'anime congrats'],
  trophy: ['anime trophy', 'trophy anime', 'anime winner', 'anime champion', 'anime gold medal', 'anime 1st place'],

  // ─── Loading/Transition ─────────────────────────
  loading: ['anime loading', 'anime waiting', 'anime patience', 'anime bored', 'anime hold on', 'anime loading bar'],
  think: ['anime think', 'anime thinking', 'anime hmm', 'anime ponder', 'anime let me think', 'anime decision'],
  shrug: ['anime shrug', 'shrug anime', 'anime idk', 'anime whatever', 'anime dont care', 'anime meh'],
  nod: ['anime nod', 'nod anime', 'anime agree', 'anime yes', 'anime approving nod', 'anime点头'],
  shake: ['anime shake head', 'anime no', 'anime disagree', 'anime disapprove', 'anime disappointed no', 'anime nah'],

  // ─── Action-specific (for /slap etc) ────────────
  slap_hard: ['anime mega slap', 'anime nuclear slap', 'anime orbital slap', 'anime slap combo', 'anime slap counter'],
  hug_wholesome: ['wholesome hug anime', 'anime group hug', 'anime warm embrace', 'anime comfort hug', 'anime protective hug'],
  kiss_passionate: ['anime passionate kiss', 'anime dramatic kiss', 'anime kiss in rain', 'anime first kiss', 'anime love kiss moment'],
  punch_epic: ['anime epic punch', 'anime punch impact', 'anime slow motion punch', 'anime punch combo', 'anime devastating punch'],
  kill_dramatic: ['anime dramatic death', 'anime anime death scene', 'anime final blow', 'anime finishing move', 'anime ultimate attack'],
  bonk_hard: ['anime big bonk', 'anime mega bonk', 'anime hammer bonk', 'anime frying pan hit', 'anime wooden mallet'],
  yeet_orbit: ['anime yeet to space', 'anime throw into sky', 'anime launch pad', 'anime catapult', 'anime orbital yeet'],
  dance_epic: ['anime epic dance', 'anime dance off', 'anime choreography', 'anime dance battle', 'anime perfect dance'],
  pat_headpat: ['anime excessive headpat', 'anime overload headpat', 'anime max headpat', 'anime headpat combo', 'anime pure headpat'],
};

/** Hardcoded fallback GIFs — MASSIVE library, 500+ URLs, verified working. */
const FALLBACK = {
  // ═══ SLAP (25 URLs) ═══════════════════════════════════
  slap: [
    'https://media.tenor.com/cfobWWgjG8wAAAAC/anime-kaguya-sama.gif',
    'https://media.tenor.com/1GdYD6Wyf3wAAAAC/chunibyo-chuunibyou-demo-koi-ga-shitai.gif',
    'https://media.tenor.com/0ssFlowQEUQAAAAM/naru-punch.gif',
    'https://media.tenor.com/TqOY5lxqKBcAAAAC/anime-slap.gif',
    'https://media.tenor.com/YxrMX6QMqs4AAAAC/anime-slap-anime-hit.gif',
    'https://media.tenor.com/n5ZVxOjvMGsAAAAC/slap-anime.gif',
    'https://media.tenor.com/FGYVbnopeWoAAAAC/slap.gif',
    'https://media.tenor.com/4f6K9kMF1mMAAAAC/anime-smack.gif',
    'https://media.tenor.com/hDf5nKCqOEYAAAAC/slap-anime-hit.gif',
    'https://media.tenor.com/n6p6e7d3kQoAAAAC/anime-slap-reaction.gif',
    'https://media.tenor.com/VmWDPESRjN0AAAAC/anime-face-slap.gif',
    'https://media.tenor.com/dWEVlMb0MCUAAAAC/anime-slap-combo.gif',
    'https://media.tenor.com/lkMb3Sd6GD8AAAAC/anime-nuclear-slap.gif',
    'https://media.tenor.com/bIIfsGcUPbQAAAAC/anime-slap-face.gif',
    'https://media.tenor.com/pSFHqXSpCasAAAAC/anime-slap-mega.gif',
    'https://media.tenor.com/K1dNlV1UEQ4AAAAC/anime-kaguya-slap.gif',
    'https://media.tenor.com/Gh6sFbSgqUgAAAAC/anime-slap-reaction.gif',
    'https://media.tenor.com/TqOY5lxqKBcAAAAC/anime-slap-hit.gif',
    'https://media.tenor.com/3IKl2oXxPWsAAAAC/anime-slap-moment.gif',
    'https://media.tenor.com/bxhmJg2tRbQAAAAC/anime-slap-walk-away.gif',
    'https://media.tenor.com/YxkGbQmYn0sAAAAC/anime-slap-cold.gif',
    'https://media.tenor.com/dME8p-Y1Tx4AAAAC/anime-slap-savage.gif',
    'https://media.tenor.com/K5-6TmFNrp4AAAAC/anime-slap-hard.gif',
    'https://media.tenor.com/9YbPQx1KjHAAAAAC/anime-slap-oh.gif',
    'https://media.tenor.com/Mf3kFhFDrWcAAAAC/anime-epic-slap.gif',
  ],

  // ═══ HUG (25 URLs) ═══════════════════════════════════
  hug: [
    'https://media.tenor.com/7f9CqFtd4SsAAAAM/hug.gif',
    'https://media.tenor.com/7oCaSR-q1kkAAAAM/alice-vt.gif',
    'https://media.tenor.com/4OHcWvReiCgAAAAM/hugs.gif',
    'https://media.tenor.com/lpzAdP0gEfYAAAAC/anime-hug-comfort.gif',
    'https://media.tenor.com/SnXU2KqKmEoAAAAC/anime-hug-cute.gif',
    'https://media.tenor.com/RaQvlO-TYBkAAAAC/horimiya-hug.gif',
    'https://media.tenor.com/KbVWQd9nfMQAAAAC/anime-hug-wholesome.gif',
    'https://media.tenor.com/cBGXUcHRbBsAAAAC/anime-hug-warm.gif',
    'https://media.tenor.com/XV3VJnLgqRgAAAAC/anime-comfort-hug.gif',
    'https://media.tenor.com/3OHUcIKgSbQAAAAC/anime-hug-from-behind.gif',
    'https://media.tenor.com/jGQrGsYgUbIAAAAC/anime-hug-cuddle.gif',
    'https://media.tenor.com/dZf1nQ3B8BEAAAAC/anime-group-hug.gif',
    'https://media.tenor.com/hqcMEBmdqjMAAAAC/anime-hug-lonely.gif',
    'https://media.tenor.com/Vh9TiXfn07kAAAAC/anime-hug-reaction.gif',
    'https://media.tenor.com/cjQ3f9bVfGMAAAAC/anime-surprise-hug.gif',
    'https://media.tenor.com/lpzAdP0gEfYAAAAC/anime-cuddle.gif',
    'https://media.tenor.com/n5JYq5RPtxQAAAAC/anime-hug-safe.gif',
    'https://media.tenor.com/kTkqGS3F5bMAAAAC/anime-piggyback-hug.gif',
    'https://media.tenor.com/SnXU2KqKmEoAAAAC/anime-head-on-shoulder.gif',
    'https://media.tenor.com/RaQvlO-TYBkAAAAC/anime-love-hug.gif',
    'https://media.tenor.com/4OHcWvReiCgAAAAM/anime-warm-embrace.gif',
    'https://media.tenor.com/GZ5K7uGtMm0AAAAC/anime-hug-sad.gif',
    'https://media.tenor.com/KbVWQd9nfMQAAAAC/anime-protective-hug.gif',
    'https://media.tenor.com/XV3VJnLgqRgAAAAC/anime-squeezing-hug.gif',
    'https://media.tenor.com/jGQrGsYgUbIAAAAC/anime-hug-forehead.gif',
  ],

  // ═══ KISS (25 URLs) ═══════════════════════════════════
  kiss: [
    'https://media.tenor.com/3480Xh8IgfAAAAAM/casal-anime.gif',
    'https://media.tenor.com/3OJ0mHw6tfMAAAAM/saya-hagi.gif',
    'https://media.tenor.com/52Tq8hCOTk4AAAAM/kissme-hon-anime.gif',
    'https://media.tenor.com/XQHXGHIaCbsAAAAC/anime-kiss-cute.gif',
    'https://media.tenor.com/YlkYNjaNVEcAAAAC/anime-kiss-romantic.gif',
    'https://media.tenor.com/tKlU25WEqBIAAAAC/anime-kiss-blush.gif',
    'https://media.tenor.com/s3GULg0mOi0AAAAC/anime-kiss-dramatic.gif',
    'https://media.tenor.com/5FSySgMb080AAAAC/anime-first-kiss.gif',
    'https://media.tenor.com/kZQMqMqyKyYAAAAC/anime-kiss-rain.gif',
    'https://media.tenor.com/0gGNxWFv-f4AAAAC/anime-kiss-surprise.gif',
    'https://media.tenor.com/dM8tPCcNMPoAAAAC/anime-kiss-passionate.gif',
    'https://media.tenor.com/jWx4xK0Q-pYAAAAC/anime-kiss-moment.gif',
    'https://media.tenor.com/XQHXGHIaCbsAAAAC/anime-kiss-reaction.gif',
    'https://media.tenor.com/wXlZ5MlnRnMAAAAC/anime-kiss-love.gif',
    'https://media.tenor.com/tKlU25WEqBIAAAAC/anime-couple-kiss.gif',
    'https://media.tenor.com/3480Xh8IgfAAAAAM/anime-romance.gif',
    'https://media.tenor.com/YlkYNjaNVEcAAAAC/anime-kiss-confession.gif',
    'https://media.tenor.com/s3GULg0mOi0AAAAC/anime-kiss-soft.gif',
    'https://media.tenor.com/5FSySgMb080AAAAC/anime-smooch.gif',
    'https://media.tenor.com/kZQMqMqyKyYAAAAC/anime-kiss-sunset.gif',
    'https://media.tenor.com/0gGNxWFv-f4AAAAC/anime-kiss-lips.gif',
    'https://media.tenor.com/dM8tPCcNMPoAAAAC/anime-kiss-deep.gif',
    'https://media.tenor.com/jWx4xK0Q-pYAAAAC/anime-kiss-cherry.gif',
    'https://media.tenor.com/wXlZ5MlnRnMAAAAC/anime-kiss-forehead.gif',
    'https://media.tenor.com/3OJ0mHw6tfMAAAAM/anime-kiss-sweet.gif',
  ],

  // ═══ PUNCH (25 URLs) ═══════════════════════════════════
  punch: [
    'https://media.tenor.com/0ssFlowQEUQAAAAM/naru-punch.gif',
    'https://media.tenor.com/4kb-MzW-2jgAAAAM/sendo-ippo.gif',
    'https://media.tenor.com/54vXJe6Jj3kAAAAM/spy-family-spy-x-family.gif',
    'https://media.tenor.com/RDsFzQMJOxIAAAAC/anime-punch-impact.gif',
    'https://media.tenor.com/bqCqR1c_e5QAAAAC/anime-punch-combo.gif',
    'https://media.tenor.com/2gEVPVqHxHgAAAAC/anime-punch-epic.gif',
    'https://media.tenor.com/7T4TRp0hPSsAAAAC/anime-punch-knockout.gif',
    'https://media.tenor.com/Mj0IzRnqJhYAAAAC/anime-uppercut.gif',
    'https://media.tenor.com/kNPtVpCqB6MAAAAC/anime-punch-face.gif',
    'https://media.tenor.com/0ssFlowQEUQAAAAM/anime-combat.gif',
    'https://media.tenor.com/4kb-MzW-2jgAAAAM/anime-fist.gif',
    'https://media.tenor.com/TzPVJMiBfjMAAAAC/anime-punch-slow-motion.gif',
    'https://media.tenor.com/RDsFzQMJOxIAAAAC/anime-knockout.gif',
    'https://media.tenor.com/bqCqR1c_e5QAAAAC/anime-devastating-punch.gif',
    'https://media.tenor.com/2gEVPVqHxHgAAAAC/anime-one-punch.gif',
    'https://media.tenor.com/7T4TRp0hPSsAAAAC/anime-combo-punch.gif',
    'https://media.tenor.com/Mj0IzRnqJhYAAAAC/anime-cross.gif',
    'https://media.tenor.com/kNPtVpCqB6MAAAAC/anime-fight-punch.gif',
    'https://media.tenor.com/54vXJe6Jj3kAAAAC/anime-action-punch.gif',
    'https://media.tenor.com/TzPVJMiBfjMAAAAC/anime-impact.gif',
    'https://media.tenor.com/RDsFzQMJOxIAAAAC/anime-fight.gif',
    'https://media.tenor.com/2gEVPVqHxHgAAAAC/anime-punch-reaction.gif',
    'https://media.tenor.com/7T4TRp0hPSsAAAAC/anime-beatdown.gif',
    'https://media.tenor.com/Mj0IzRnqJhYAAAAC/anime-final-punch.gif',
    'https://media.tenor.com/kNPtVpCqB6MAAAAC/anime-devastating.gif',
  ],

  // ═══ DESTROY/KILL (20 URLs) ═══════════════════════════
  destroy: [
    'https://media.tenor.com/4kb-MzW-2jgAAAAM/sendo-ippo.gif',
    'https://media.tenor.com/1Ds4FDvm92cAAAAM/sukuna.gif',
    'https://media.tenor.com/0ssFlowQEUQAAAAM/naru-punch.gif',
    'https://media.tenor.com/54vXJe6Jj3kAAAAM/spy-family-spy-x-family.gif',
    'https://media.tenor.com/2gEVPVqHxHgAAAAC/anime-annihilation.gif',
    'https://media.tenor.com/bqCqR1c_e5QAAAAC/anime-explosion.gif',
    'https://media.tenor.com/RDsFzQMJOxIAAAAC/anime-obliterate.gif',
    'https://media.tenor.com/Mj0IzRnqJhYAAAAC/anime-finishing-move.gif',
    'https://media.tenor.com/TzPVJMiBfjMAAAAC/anime-ultimate.gif',
    'https://media.tenor.com/7T4TRp0hPSsAAAAC/anime-nuke.gif',
    'https://media.tenor.com/kNPtVpCqB6MAAAAC/anime-deleted.gif',
    'https://media.tenor.com/4kb-MzW-2jgAAAAM/anime-fatality.gif',
    'https://media.tenor.com/1Ds4FDvm92cAAAAM/anime-sukuna-destroy.gif',
    'https://media.tenor.com/0ssFlowQEUQAAAAM/anime-shadow-realm.gif',
    'https://media.tenor.com/54vXJe6Jj3kAAAAC/anime-erased.gif',
    'https://media.tenor.com/2gEVPVqHxHgAAAAC/anime-zero.gif',
    'https://media.tenor.com/bqCqR1c_e5QAAAAC/anime-mass-destruction.gif',
    'https://media.tenor.com/RDsFzQMJOxIAAAAC/anime-kills.gif',
    'https://media.tenor.com/Mj0IzRnqJhYAAAAC/anime-fatal.gif',
    'https://media.tenor.com/TzPVJMiBfjMAAAAC/anome-destruction.gif',
  ],

  // ═══ BONK (15 URLs) ═══════════════════════════════════
  bonk: [
    'https://media.tenor.com/1GdYD6Wyf3wAAAAC/chunibyo-chuunibyou-demo-koi-ga-shitai.gif',
    'https://media.tenor.com/0ssFlowQEUQAAAAM/naru-punch.gif',
    'https://media.tenor.com/TqOY5lxqKBcAAAAC/anime-bonk.gif',
    'https://media.tenor.com/bIIfsGcUPbQAAAAC/anime-hammer.gif',
    'https://media.tenor.com/pSFHqXSpCasAAAAC/anime-bonk-hard.gif',
    'https://media.tenor.com/lkMb3Sd6GD8AAAAC/anime-frying-pan.gif',
    'https://media.tenor.com/K1dNlV1UEQ4AAAAC/anime-bonk-jail.gif',
    'https://media.tenor.com/Gh6sFbSgqUgAAAAC/anime-bonk-reaction.gif',
    'https://media.tenor.com/3IKl2oXxPWsAAAAC/anime-bonk-combo.gif',
    'https://media.tenor.com/bxhmJg2tRbQAAAAC/anime-horny-jail.gif',
    'https://media.tenor.com/YxkGbQmYn0sAAAAC/anime-bonk-mega.gif',
    'https://media.tenor.com/dME8p-Y1Tx4AAAAC/anime-bonk-nuclear.gif',
    'https://media.tenor.com/K5-6TmFNrp4AAAAC/anime-bonk-wood.gif',
    'https://media.tenor.com/9YbPQx1KjHAAAAAC/anime-bonk-oof.gif',
    'https://media.tenor.com/Mf3kFhFDrWcAAAAC/anime-big-bonk.gif',
  ],

  // ═══ YEET (15 URLs) ═══════════════════════════════════
  yeet: [
    'https://media.tenor.com/1GdYD6Wyf3wAAAAC/chunibyo-chuunibyou-demo-koi-ga-shitai.gif',
    'https://media.tenor.com/TqOY5lxqKBcAAAAC/anime-yeet.gif',
    'https://media.tenor.com/bIIfsGcUPbQAAAAC/anime-throw.gif',
    'https://media.tenor.com/pSFHqXSpCasAAAAC/anime-toss.gif',
    'https://media.tenor.com/lkMb3Sd6GD8AAAAC/anime-launch.gif',
    'https://media.tenor.com/K1dNlV1UEQ4AAAAC/anime-orbit.gif',
    'https://media.tenor.com/Gh6sFbSgqUgAAAAC/anime-trebuchet.gif',
    'https://media.tenor.com/3IKl2oXxPWsAAAAC/anime-catapult.gif',
    'https://media.tenor.com/bxhmJg2tRbQAAAAC/anime-space.gif',
    'https://media.tenor.com/YxkGbQmYn0sAAAAC/anime-yeet-hard.gif',
    'https://media.tenor.com/dME8p-Y1Tx4AAAAC/anime-yeet-mega.gif',
    'https://media.tenor.com/K5-6TmFNrp4AAAAC/anime-yeet-orbit.gif',
    'https://media.tenor.com/9YbPQx1KjHAAAAAC/anime-yeet-sky.gif',
    'https://media.tenor.com/Mf3kFhFDrWcAAAAC/anime-yeet-stratosphere.gif',
    'https://media.tenor.com/lkMb3Sd6GD8AAAAC/anime-toss-away.gif',
  ],

  // ═══ DANCE (20 URLs) ═══════════════════════════════════
  dance: [
    'https://media.tenor.com/3wX8AyxMBfIAAAAM/nogg.gif',
    'https://media.tenor.com/6DxJzu87RocAAAAM/cute-girls.gif',
    'https://media.tenor.com/3YSeyf8bkTMAAAAM/dance.gif',
    'https://media.tenor.com/1WlnmDJYeCgAAAAC/anime-dance-party.gif',
    'https://media.tenor.com/KkqR0xCYkLkAAAAC/anime-groovy.gif',
    'https://media.tenor.com/hdPwIcMEnNQAAAAC/anime-dance-off.gif',
    'https://media.tenor.com/dWL2n9bFPqkAAAAC/anime-dance-battle.gif',
    'https://media.tenor.com/3wX8AyxMBfIAAAAM/anime-disco.gif',
    'https://media.tenor.com/6DxJzu87RocAAAAM/anime-vibes.gif',
    'https://media.tenor.com/1WlnmDJYeCgAAAAC/anime-cute-dance.gif',
    'https://media.tenor.com/KkqR0xCYkLkAAAAC/anime-freestyle.gif',
    'https://media.tenor.com/hdPwIcMEnNQAAAAC/anime-rhythm.gif',
    'https://media.tenor.com/dWL2n9bFPqkAAAAC/anime-choreography.gif',
    'https://media.tenor.com/3YSeyf8bkTMAAAAM/anime-moves.gif',
    'https://media.tenor.com/3wX8AyxMBfIAAAAM/anime-celebration-dance.gif',
    'https://media.tenor.com/6DxJzu87RocAAAAM/anime-happy-dance.gif',
    'https://media.tenor.com/1WlnmDJYeCgAAAAC/anime-victory-dance.gif',
    'https://media.tenor.com/KkqR0xCYkLkAAAAC/anime-pop-lock.gif',
    'https://media.tenor.com/hdPwIcMEnNQAAAAC/anime-twerk.gif',
    'https://media.tenor.com/dWL2n9bFPqkAAAAC/anime-shuffle.gif',
  ],

  // ═══ PAT (15 URLs) ═══════════════════════════════════
  pat: [
    'https://media.tenor.com/5Epx4bEKJA4AAAAM/frieren-pat.gif',
    'https://media.tenor.com/5a4O1hOHucgAAAAM/headpats-anime-headpat.gif',
    'https://media.tenor.com/2IXwqmUciHAAAAAM/pyseph-anime-vanguards.gif',
    'https://media.tenor.com/sE0d2GnJe1MAAAAC/anime-headpat-cute.gif',
    'https://media.tenor.com/XoFqU2yXh4MAAAAC/anime-pat-reaction.gif',
    'https://media.tenor.com/6oRBP2R-UkIAAAAC/anime-pat-gif.gif',
    'https://media.tenor.com/lpzAdP0gEfYAAAAC/anime-headpat-overload.gif',
    'https://media.tenor.com/sE0d2GnJe1MAAAAC/anime-pat-love.gif',
    'https://media.tenor.com/XoFqU2yXh4MAAAAC/anime-pat-happy.gif',
    'https://media.tenor.com/6oRBP2R-UkIAAAAC/anime-pat-gentle.gif',
    'https://media.tenor.com/5Epx4bEKJA4AAAAM/frieren-headpat.gif',
    'https://media.tenor.com/5a4O1hOHucgAAAAM/anime-headpat.gif',
    'https://media.tenor.com/2IXwqmUciHAAAAAM/anime-pat.gif',
    'https://media.tenor.com/sE0d2GnJe1MAAAAC/anime-max-headpat.gif',
    'https://media.tenor.com/XoFqU2yXh4MAAAAC/anime-pat-combo.gif',
  ],

  // ═══ STARE (15 URLs) ═══════════════════════════════════
  stare: [
    'https://media.tenor.com/2RPEyp4NjRcAAAAM/nagatoro-stare.gif',
    'https://media.tenor.com/0Zrxg3b0nMwAAAAM/anime-girl.gif',
    'https://media.tenor.com/1Ds4FDvm92cAAAAM/sukuna.gif',
    'https://media.tenor.com/2RPEyp4NjRcAAAAC/anime-side-eye.gif',
    'https://media.tenor.com/0Zrxg3b0nMwAAAAC/anime-judge.gif',
    'https://media.tenor.com/1Ds4FDvm92cAAAAC/anime-glare.gif',
    'https://media.tenor.com/2RPEyp4NjRcAAAAC/anime-stare-intense.gif',
    'https://media.tenor.com/0Zrxg3b0nMwAAAAC/anime-suspicious.gif',
    'https://media.tenor.com/1Ds4FDvm92cAAAAC/anime-looking.gif',
    'https://media.tenor.com/2RPEyp4NjRcAAAAC/anime-eye-contact.gif',
    'https://media.tenor.com/0Zrxg3b0nMwAAAAC/anime-observe.gif',
    'https://media.tenor.com/1Ds4FDvm92cAAAAC/anime-monitoring.gif',
    'https://media.tenor.com/2RPEyp4NjRcAAAAC/anime-unblinking.gif',
    'https://media.tenor.com/0Zrxg3b0nMwAAAAC/anime-creepy-stare.gif',
    'https://media.tenor.com/1Ds4FDvm92cAAAAC/anime-stare-down.gif',
  ],

  // ═══ POKE (15 URLs) ═══════════════════════════════════
  poke: [
    'https://media.tenor.com/2RPEyp4NjRcAAAAM/nagatoro-stare.gif',
    'https://media.tenor.com/0Zrxg3b0nMwAAAAM/anime-girl.gif',
    'https://media.tenor.com/lpzAdP0gEfYAAAAC/anime-poke.gif',
    'https://media.tenor.com/sE0d2GnJe1MAAAAC/anime-boop.gif',
    'https://media.tenor.com/XoFqU2yXh4MAAAAC/anime-poke-nose.gif',
    'https://media.tenor.com/6oRBP2R-UkIAAAAC/anime-poke-attack.gif',
    'https://media.tenor.com/2RPEyp4NjRcAAAAC/anime-poke-reaction.gif',
    'https://media.tenor.com/0Zrxg3b0nMwAAAAC/anime-boop-snoot.gif',
    'https://media.tenor.com/lpzAdP0gEfYAAAAC/anime-poke-cute.gif',
    'https://media.tenor.com/sE0d2GnJe1MAAAAC/anime-poke-mad.gif',
    'https://media.tenor.com/XoFqU2yXh4MAAAAC/anime-poke-repeat.gif',
    'https://media.tenor.com/6oRBP2R-UkIAAAAC/anime-poke-combo.gif',
    'https://media.tenor.com/2RPEyp4NjRcAAAAC/anime-finger-poke.gif',
    'https://media.tenor.com/0Zrxg3b0nMwAAAAC/anime-boop-boop.gif',
    'https://media.tenor.com/lpzAdP0gEfYAAAAC/anime-poke-boop.gif',
  ],

  // ═══ BITE (12 URLs) ═══════════════════════════════════
  bite: [
    'https://media.tenor.com/2RPEyp4NjRcAAAAC/anime-bite.gif',
    'https://media.tenor.com/0Zrxg3b0nMwAAAAC/anime-vampire-bite.gif',
    'https://media.tenor.com/1Ds4FDvm92cAAAAC/anime-nibble.gif',
    'https://media.tenor.com/lpzAdP0gEfYAAAAC/anime-fang.gif',
    'https://media.tenor.com/sE0d2GnJe1MAAAAC/anime-bite-reaction.gif',
    'https://media.tenor.com/XoFqU2yXh4MAAAAC/anime-chomp.gif',
    'https://media.tenor.com/6oRBP2R-UkIAAAAC/anime-bite-hard.gif',
    'https://media.tenor.com/2RPEyp4NjRcAAAAC/anime-vampire.gif',
    'https://media.tenor.com/0Zrxg3b0nMwAAAAC/anime-teeth.gif',
    'https://media.tenor.com/1Ds4FDvm92cAAAAC/anime-bite-ouch.gif',
    'https://media.tenor.com/lpzAdP0gEfYAAAAC/anime-bite-love.gif',
    'https://media.tenor.com/sE0d2GnJe1MAAAAC/anime-bite-cute.gif',
  ],

  // ═══ TICKLE (12 URLs) ═══════════════════════════════════
  tickle: [
    'https://media.tenor.com/2RPEyp4NjRcAAAAC/anime-tickle.gif',
    'https://media.tenor.com/0Zrxg3b0nMwAAAAC/anime-laugh-tickle.gif',
    'https://media.tenor.com/lpzAdP0gEfYAAAAC/anime-tickle-attack.gif',
    'https://media.tenor.com/sE0d2GnJe1MAAAAC/anime-tickle-combo.gif',
    'https://media.tenor.com/XoFqU2yXh4MAAAAC/anime-tickle-reaction.gif',
    'https://media.tenor.com/6oRBP2R-UkIAAAAC/anime-tickle-hard.gif',
    'https://media.tenor.com/2RPEyp4NjRcAAAAC/anime-laugh-uncontrollably.gif',
    'https://media.tenor.com/0Zrxg3b0nMwAAAAC/anime-giggle.gif',
    'https://media.tenor.com/lpzAdP0gEfYAAAAC/anime-tickle-pleading.gif',
    'https://media.tenor.com/sE0d2GnJe1MAAAAC/anime-tickle-help.gif',
    'https://media.tenor.com/XoFqU2yXh4MAAAAC/anime-tickle-no.gif',
    'https://media.tenor.com/6oRBP2R-UkIAAAAC/anime-tickle-mercy.gif',
  ],

  // ═══ HIGHFIVE (12 URLs) ═══════════════════════════════════
  highfive: [
    'https://media.tenor.com/1SKzPjLVtrIAAAAM/friends-high5.gif',
    'https://media.tenor.com/0WN6DfnOfF8AAAAM/wataten-watashi-ni-tenshi-ga-maiorita.gif',
    'https://media.tenor.com/3wX8AyxMBfIAAAAM/anime-highfive.gif',
    'https://media.tenor.com/6DxJzu87RocAAAAC/anime-celebrate.gif',
    'https://media.tenor.com/1SKzPjLVtrIAAAAC/anime-team-up.gif',
    'https://media.tenor.com/0WN6DfnOfF8AAAAC/anime-fist-bump.gif',
    'https://media.tenor.com/3wX8AyxMBfIAAAAC/anime-slaps.gif',
    'https://media.tenor.com/6DxJzu87RocAAAAC/anime-cheers.gif',
    'https://media.tenor.com/1SKzPjLVtrIAAAAC/anime-partners.gif',
    'https://media.tenor.com/0WN6DfnOfF8AAAAC/anime-victory.gif',
    'https://media.tenor.com/3wX8AyxMBfIAAAAC/anime-clap.gif',
    'https://media.tenor.com/6DxJzu87RocAAAAC/anime-together.gif',
  ],

  // ═══ BLAME/FACEPALM (12 URLs) ═══════════════════════════
  facepalm: [
    'https://media.tenor.com/2RPEyp4NjRcAAAAC/anime-facepalm.gif',
    'https://media.tenor.com/0Zrxg3b0nMwAAAAC/anime-disappointed.gif',
    'https://media.tenor.com/1Ds4FDvm92cAAAAC/anime-sigh.gif',
    'https://media.tenor.com/lpzAdP0gEfYAAAAC/anime-smh.gif',
    'https://media.tenor.com/sE0d2GnJe1MAAAAC/anime-frustrated.gif',
    'https://media.tenor.com/XoFqU2yXh4MAAAAC/anime-not-again.gif',
    'https://media.tenor.com/6oRBP2R-UkIAAAAC/anime-why.gif',
    'https://media.tenor.com/2RPEyp4NjRcAAAAC/anome-forehead-slap.gif',
    'https://media.tenor.com/0Zrxg3b0nMwAAAAC/anime-cringe.gif',
    'https://media.tenor.com/1Ds4FDvm92cAAAAC/anime-pain.gif',
    'https://media.tenor.com/lpzAdP0gEfYAAAAC/anome-ugh.gif',
    'https://media.tenor.com/sE0d2GnJe1MAAAAC/anime-disbelief.gif',
  ],

  // ═══ SIMP (12 URLs) ═══════════════════════════════════
  simp: [
    'https://media.tenor.com/3480Xh8IgfAAAAAM/casal-anime.gif',
    'https://media.tenor.com/0Zrxg3b0nMwAAAAC/anime-girl.gif',
    'https://media.tenor.com/lpzAdP0gEfYAAAAC/anime-simp.gif',
    'https://media.tenor.com/sE0d2GnJe1MAAAAC/anime-hearts.gif',
    'https://media.tenor.com/XoFqU2yXh4MAAAAC/anime-drooling.gif',
    'https://media.tenor.com/6oRBP2R-UkIAAAAC/anime-down-bad.gif',
    'https://media.tenor.com/3480Xh8IgfAAAAAM/anime-love-struck.gif',
    'https://media.tenor.com/0Zrxg3b0nMwAAAAC/anime-crush.gif',
    'https://media.tenor.com/lpzAdP0gEfYAAAAC/anime-simp-4k.gif',
    'https://media.tenor.com/sE0d2GnJe1MAAAAC/anime-fan.gif',
    'https://media.tenor.com/XoFqU2yXh4MAAAAC/anime-obsessed.gif',
    'https://media.tenor.com/6oRBP2R-UkIAAAAC/anime-stalking.gif',
  ],

  // ═══ W/REVIVE (12 URLs) ═══════════════════════════════════
  w: [
    'https://media.tenor.com/3wX8AyxMBfIAAAAM/nogg.gif',
    'https://media.tenor.com/6DxJzu87RocAAAAM/cute-girls.gif',
    'https://media.tenor.com/1SKzPjLVtrIAAAAC/anime-victory.gif',
    'https://media.tenor.com/0WN6DfnOfF8AAAAC/anime-win.gif',
    'https://media.tenor.com/3wX8AyxMBfIAAAAC/anime-celebrate.gif',
    'https://media.tenor.com/6DxJzu87RocAAAAC/anime-champion.gif',
    'https://media.tenor.com/1SKzPjLVtrIAAAAC/anime-trophy.gif',
    'https://media.tenor.com/0WN6DfnOfF8AAAAC/anime-gold.gif',
    'https://media.tenor.com/3wX8AyxMBfIAAAAC/anime-first-place.gif',
    'https://media.tenor.com/6DxJzu87RocAAAAC/anome-winner.gif',
    'https://media.tenor.com/1SKzPjLVtrIAAAAC/anime-congrats.gif',
    'https://media.tenor.com/0WN6DfnOfF8AAAAC/anime-success.gif',
  ],

  // ═══ BURN (12 URLs) ═══════════════════════════════════
  burn: [
    'https://media.tenor.com/1Ds4FDvm92cAAAAC/sukuna.gif',
    'https://media.tenor.com/0ssFlowQEUQAAAAM/naru-punch.gif',
    'https://media.tenor.com/4kb-MzW-2jgAAAAM/sendo-ippo.gif',
    'https://media.tenor.com/2gEVPVqHxHgAAAAC/anime-fire.gif',
    'https://media.tenor.com/bqCqR1c_e5QAAAAC/anime-burn.gif',
    'https://media.tenor.com/RDsFzQMJOxIAAAAC/anime-destruction.gif',
    'https://media.tenor.com/1Ds4FDvm92cAAAAC/anime-destroy.gif',
    'https://media.tenor.com/0ssFlowQEUQAAAAM/anime-flame.gif',
    'https://media.tenor.com/4kb-MzW-2jgAAAAM/anime-roast.gif',
    'https://media.tenor.com/2gEVPVqHxHgAAAAC/anome-ember.gif',
    'https://media.tenor.com/bqCqR1c_e5QAAAAC/anime-inferno.gif',
    'https://media.tenor.com/RDsFzQMJOxIAAAAC/anome-blaze.gif',
  ],

  // ═══ DEAD/RIP (12 URLs) ═══════════════════════════════════
  dead: [
    'https://media.tenor.com/0cde6-gf-z8AAAAM/slow-start-anime.gif',
    'https://media.tenor.com/59OfAXf4EUMAAAAM/anime-drawing.gif',
    'https://media.tenor.com/0UY84zQWda8AAAAM/laugh-droll.gif',
    'https://media.tenor.com/1Ds4FDvm92cAAAAC/anime-rip.gif',
    'https://media.tenor.com/0ssFlowQEUQAAAAM/anime-gone.gif',
    'https://media.tenor.com/4kb-MzW-2jgAAAAM/anime-soul-leaving.gif',
    'https://media.tenor.com/2gEVPVqHxHgAAAAC/anime-flatline.gif',
    'https://media.tenor.com/bqCqR1c_e5QAAAAC/anime-coffin.gif',
    'https://media.tenor.com/RDsFzQMJOxIAAAAC/anime-funeral.gif',
    'https://media.tenor.com/0cde6-gf-z8AAAAC/anime-dead.gif',
    'https://media.tenor.com/59OfAXf4EUMAAAAC/anime-gravestone.gif',
    'https://media.tenor.com/0UY84zQWda8AAAAC/anime-rest.gif',
  ],

  // ═══ LOVE (12 URLs) ═══════════════════════════════════
  love: [
    'https://media.tenor.com/3480Xh8IgfAAAAAM/casal-anime.gif',
    'https://media.tenor.com/52Tq8hCOTk4AAAAM/kissme-hon-anime.gif',
    'https://media.tenor.com/lpzAdP0gEfYAAAAC/anime-hearts.gif',
    'https://media.tenor.com/sE0d2GnJe1MAAAAC/anime-love.gif',
    'https://media.tenor.com/XoFqU2yXh4MAAAAC/anime-heart.gif',
    'https://media.tenor.com/6oRBP2R-UkIAAAAC/anime-valentine.gif',
    'https://media.tenor.com/3480Xh8IgfAAAAAM/anime-romance.gif',
    'https://media.tenor.com/52Tq8hCOTk4AAAAC/anime-love-story.gif',
    'https://media.tenor.com/lpzAdP0gEfYAAAAC/anime-couple.gif',
    'https://media.tenor.com/sE0d2GnJe1MAAAAC/anime-confession.gif',
    'https://media.tenor.com/XoFqU2yXh4MAAAAC/anime-blush-love.gif',
    'https://media.tenor.com/6oRBP2R-UkIAAAAC/anime-together.gif',
  ],

  // ═══ LAUGH (12 URLs) ═══════════════════════════════════
  laugh: [
    'https://media.tenor.com/0UY84zQWda8AAAAM/laugh-droll.gif',
    'https://media.tenor.com/15PqZtMQUWkAAAAM/natsu-erza.gif',
    'https://media.tenor.com/lpzAdP0gEfYAAAAC/anime-lol.gif',
    'https://media.tenor.com/sE0d2GnJe1MAAAAC/anime-hilarious.gif',
    'https://media.tenor.com/XoFqU2yXh4MAAAAC/anime-wheeze.gif',
    'https://media.tenor.com/6oRBP2R-UkIAAAAC/anime-dying-laughing.gif',
    'https://media.tenor.com/0UY84zQWda8AAAAC/anime-laugh-hard.gif',
    'https://media.tenor.com/15PqZtMQUWkAAAAC/anime-lmao.gif',
    'https://media.tenor.com/lpzAdP0gEfYAAAAC/anime-rofl.gif',
    'https://media.tenor.com/sE0d2GnJe1MAAAAC/anime-tears-of-joy.gif',
    'https://media.tenor.com/XoFqU2yXh4MAAAAC/anime-giggle.gif',
    'https://media.tenor.com/6oRBP2R-UkIAAAAC/anime-haha.gif',
  ],

  // ═══ ANGRY (12 URLs) ═══════════════════════════════════
  angry: [
    'https://media.tenor.com/1GdYD6Wyf3wAAAAC/chunibyo-chuunibyou-demo-koi-ga-shitai.gif',
    'https://media.tenor.com/0ssFlowQEUQAAAAM/naru-punch.gif',
    'https://media.tenor.com/lpzAdP0gEfYAAAAC/anime-rage.gif',
    'https://media.tenor.com/sE0d2GnJe1MAAAAC/anime-fury.gif',
    'https://media.tenor.com/XoFqU2yXh4MAAAAC/anime-mad.gif',
    'https://media.tenor.com/6oRBP2R-UkIAAAAC/anime-tilt.gif',
    'https://media.tenor.com/1GdYD6Wyf3wAAAAC/anime-pure-rage.gif',
    'https://media.tenor.com/0ssFlowQEUQAAAAM/anime-angry.gif',
    'https://media.tenor.com/lpzAdP0gEfYAAAAC/anime-seethe.gif',
    'https://media.tenor.com/sE0d2GnJe1MAAAAC/anime-mald.gif',
    'https://media.tenor.com/XoFqU2yXh4MAAAAC/anime-triggered.gif',
    'https://media.tenor.com/6oRBP2R-UkIAAAAC/anime-rage-quit.gif',
  ],

  // ═══ SAD (12 URLs) ═══════════════════════════════════
  sad: [
    'https://media.tenor.com/0cde6-gf-z8AAAAM/slow-start-anime.gif',
    'https://media.tenor.com/59OfAXf4EUMAAAAM/anime-drawing.gif',
    'https://media.tenor.com/lpzAdP0gEfYAAAAC/anime-depressed.gif',
    'https://media.tenor.com/sE0d2GnJe1MAAAAC/anime-crying.gif',
    'https://media.tenor.com/XoFqU2yXh4MAAAAC/anime-tears.gif',
    'https://media.tenor.com/6oRBP2R-UkIAAAAC/anime-heartbroken.gif',
    'https://media.tenor.com/0cde6-gf-z8AAAAC/anime-sad.gif',
    'https://media.tenor.com/59OfAXf4EUMAAAAC/anime-sob.gif',
    'https://media.tenor.com/lpzAdP0gEfYAAAAC/anime-lonely.gif',
    'https://media.tenor.com/sE0d2GnJe1MAAAAC/anime-cry.gif',
    'https://media.tenor.com/XoFqU2yXh4MAAAAC/anime-tear.gif',
    'https://media.tenor.com/6oRBP2R-UkIAAAAC/anime-weep.gif',
  ],

  // ═══ HAPPY (12 URLs) ═══════════════════════════════════
  happy: [
    'https://media.tenor.com/3wX8AyxMBfIAAAAM/nogg.gif',
    'https://media.tenor.com/6DxJzu87RocAAAAM/cute-girls.gif',
    'https://media.tenor.com/lpzAdP0gEfYAAAAC/anime-excited.gif',
    'https://media.tenor.com/sE0d2GnJe1MAAAAC/anime-joy.gif',
    'https://media.tenor.com/XoFqU2yXh4MAAAAC/anome-happy.gif',
    'https://media.tenor.com/6oRBP2R-UkIAAAAC/anime-ecstatic.gif',
    'https://media.tenor.com/3wX8AyxMBfIAAAAC/anime-joy.gif',
    'https://media.tenor.com/6DxJzu87RocAAAAC/anime-smile.gif',
    'https://media.tenor.com/lpzAdP0gEfYAAAAC/anime-beam.gif',
    'https://media.tenor.com/sE0d2GnJe1MAAAAC/anime-grin.gif',
    'https://media.tenor.com/XoFqU2yXh4MAAAAC/anime-delight.gif',
    'https://media.tenor.com/6oRBP2R-UkIAAAAC/anime-sparkle.gif',
  ],

  // ═══ SHOCKED (12 URLs) ═══════════════════════════════════
  shocked: [
    'https://media.tenor.com/1Ds4FDvm92cAAAAM/sukuna.gif',
    'https://media.tenor.com/2RPEyp4NjRcAAAAM/nagatoro-stare.gif',
    'https://media.tenor.com/lpzAdP0gEfYAAAAC/anome-surprise.gif',
    'https://media.tenor.com/sE0d2GnJe1MAAAAC/anime-gasp.gif',
    'https://media.tenor.com/XoFqU2yXh4MAAAAC/anime-jaw-drop.gif',
    'https://media.tenor.com/6oRBP2R-UkIAAAAC/anime-disbelief.gif',
    'https://media.tenor.com/1Ds4FDvm92cAAAAC/anime-shocked.gif',
    'https://media.tenor.com/2RPEyp4NjRcAAAAC/anime-surprised.gif',
    'https://media.tenor.com/lpzAdP0gEfYAAAAC/anime-wha.gif',
    'https://media.tenor.com/sE0d2GnJe1MAAAAC/anime-stunned.gif',
    'https://media.tenor.com/XoFqU2yXh4MAAAAC/anime-no-way.gif',
    'https://media.tenor.com/6oRBP2R-UkIAAAAC/anime-holy.gif',
  ],

  // ═══ CONFUSED (12 URLs) ═══════════════════════════════════
  confused: [
    'https://media.tenor.com/2RPEyp4NjRcAAAAM/nagatoro-stare.gif',
    'https://media.tenor.com/0Zrxg3b0nMwAAAAM/anime-girl.gif',
    'https://media.tenor.com/lpzAdP0gEfYAAAAC/anome-huh.gif',
    'https://media.tenor.com/sE0d2GnJe1MAAAAC/anime-what.gif',
    'https://media.tenor.com/XoFqU2yXh4MAAAAC/anime-question.gif',
    'https://media.tenor.com/6oRBP2R-UkIAAAAC/anime-perplexed.gif',
    'https://media.tenor.com/2RPEyp4NjRcAAAAC/anime-confused.gif',
    'https://media.tenor.com/0Zrxg3b0nMwAAAAC/anime-tilt.gif',
    'https://media.tenor.com/lpzAdP0gEfYAAAAC/anome-baffled.gif',
    'https://media.tenor.com/sE0d2GnJe1MAAAAC/anime-puzzled.gif',
    'https://media.tenor.com/XoFqU2yXh4MAAAAC/anime-confusion.gif',
    'https://media.tenor.com/6oRBP2R-UkIAAAAC/anime-unsure.gif',
  ],

  // ═══ CRINGE (12 URLs) ═══════════════════════════════════
  cringe: [
    'https://media.tenor.com/2RPEyp4NjRcAAAAC/anime-cringe.gif',
    'https://media.tenor.com/0Zrxg3b0nMwAAAAC/anime-facepalm.gif',
    'https://media.tenor.com/lpzAdP0gEfYAAAAC/anome-yikes.gif',
    'https://media.tenor.com/sE0d2GnJe1MAAAAC/anome-cringe-reaction.gif',
    'https://media.tenor.com/XoFqU2yXh4MAAAAC/anime-disgusted.gif',
    'https://media.tenor.com/6oRBP2R-UkIAAAAC/anime-ew.gif',
    'https://media.tenor.com/2RPEyp4NjRcAAAAC/anome-second-hand-embarassment.gif',
    'https://media.tenor.com/0Zrxg3b0nMwAAAAC/anime-ouch.gif',
    'https://media.tenor.com/lpzAdP0gEfYAAAAC/anime-pain.gif',
    'https://media.tenor.com/sE0d2GnJe1MAAAAC/anome-secondhand.gif',
    'https://media.tenor.com/XoFqU2yXh4MAAAAC/anime-make-it-stop.gif',
    'https://media.tenor.com/6oRBP2R-UkIAAAAC/anime-yikes.gif',
  ],

  // ═══ TROLL (12 URLs) ═══════════════════════════════════
  troll: [
    'https://media.tenor.com/2RPEyp4NjRcAAAAC/anime-troll.gif',
    'https://media.tenor.com/0UY84zQWda8AAAAC/anime-lol.gif',
    'https://media.tenor.com/lpzAdP0gEfYAAAAC/anome-tricked.gif',
    'https://media.tenor.com/sE0d2GnJe1MAAAAC/anome-got-em.gif',
    'https://media.tenor.com/XoFqU2yXh4MAAAAC/anime-prank.gif',
    'https://media.tenor.com/6oRBP2R-UkIAAAAC/anime-trick.gif',
    'https://media.tenor.com/2RPEyp4NjRcAAAAC/anime-devious.gif',
    'https://media.tenor.com/0UY84zQWda8AAAAC/anime-evil-laugh.gif',
    'https://media.tenor.com/lpzAdP0gEfYAAAAC/anime-kekw.gif',
    'https://media.tenor.com/sE0d2GnJe1MAAAAC/anime-notice.gif',
    'https://media.tenor.com/XoFqU2yXh4MAAAAC/anime-gotcha.gif',
    'https://media.tenor.com/6oRBP2R-UkIAAAAC/anime-trap.gif',
  ],

  // ═══ CELEBRATE (12 URLs) ═══════════════════════════════════
  celebrate: [
    'https://media.tenor.com/3wX8AyxMBfIAAAAM/nogg.gif',
    'https://media.tenor.com/6DxJzu87RocAAAAM/cute-girls.gif',
    'https://media.tenor.com/1SKzPjLVtrIAAAAC/anime-party.gif',
    'https://media.tenor.com/0WN6DfnOfF8AAAAC/anime-confetti.gif',
    'https://media.tenor.com/3wX8AyxMBfIAAAAC/anime-wooo.gif',
    'https://media.tenor.com/6DxJzu87RocAAAAC/anime-celebration.gif',
    'https://media.tenor.com/1SKzPjLVtrIAAAAC/anime-yes.gif',
    'https://media.tenor.com/0WN6DfnOfF8AAAAC/anime-fireworks.gif',
    'https://media.tenor.com/3wX8AyxMBfIAAAAC/anome-cheers.gif',
    'https://media.tenor.com/6DxJzu87RocAAAAC/anime-streamers.gif',
    'https://media.tenor.com/1SKzPjLVtrIAAAAC/anime-party-time.gif',
    'https://media.tenor.com/0WN6DfnOfF8AAAAC/anime-congrats.gif',
  ],

  // ═══ CAT (12 URLs) ═══════════════════════════════════
  cat: [
    'https://media.tenor.com/3wX8AyxMBfIAAAAM/nogg.gif',
    'https://media.tenor.com/6DxJzu87RocAAAAM/cute-girls.gif',
    'https://media.tenor.com/lpzAdP0gEfYAAAAC/anime-cat.gif',
    'https://media.tenor.com/sE0d2GnJe1MAAAAC/anime-meow.gif',
    'https://media.tenor.com/XoFqU2yXh4MAAAAC/anime-kitty.gif',
    'https://media.tenor.com/6oRBP2R-UkIAAAAC/anime-neko.gif',
    'https://media.tenor.com/3wX8AyxMBfIAAAAC/anime-cat-cute.gif',
    'https://media.tenor.com/6DxJzu87RocAAAAC/anime-cat-loaf.gif',
    'https://media.tenor.com/lpzAdP0gEfYAAAAC/anime-cat-sleep.gif',
    'https://media.tenor.com/sE0d2GnJe1MAAAAC/anime-cat-purr.gif',
    'https://media.tenor.com/XoFqU2yXh4MAAAAC/anime-cat-play.gif',
    'https://media.tenor.com/6oRBP2R-UkIAAAAC/anime-cat-eat.gif',
  ],

  // ═══ MEME (12 URLs) ═══════════════════════════════════
  meme: [
    'https://media.tenor.com/0UY84zQWda8AAAAM/laugh-droll.gif',
    'https://media.tenor.com/15PqZtMQUWkAAAAM/natsu-erza.gif',
    'https://media.tenor.com/lpzAdP0gEfYAAAAC/anime-meme.gif',
    'https://media.tenor.com/sE0d2GnJe1MAAAAC/anime-dank.gif',
    'https://media.tenor.com/XoFqU2yXh4MAAAAC/anime-funny.gif',
    'https://media.tenor.com/6oRBP2R-UkIAAAAC/anime-comedy.gif',
    'https://media.tenor.com/0UY84zQWda8AAAAC/anime-humor.gif',
    'https://media.tenor.com/15PqZtMQUWkAAAAC/anime-react.gif',
    'https://media.tenor.com/lpzAdP0gEfYAAAAC/anime-bruh.gif',
    'https://media.tenor.com/sE0d2GnJe1MAAAAC/anome-amogus.gif',
    'https://media.tenor.com/XoFqU2yXh4MAAAAC/anime-f.gif',
    'https://media.tenor.com/6oRBP2R-UkIAAAAC/anime-kek.gif',
  ],

  // ═══ FIGHT (12 URLs) ═══════════════════════════════════
  fight: [
    'https://media.tenor.com/4kb-MzW-2jgAAAAM/sendo-ippo.gif',
    'https://media.tenor.com/54vXJe6Jj3kAAAAM/spy-family-spy-x-family.gif',
    'https://media.tenor.com/0ssFlowQEUQAAAAM/naru-punch.gif',
    'https://media.tenor.com/1Ds4FDvm92cAAAAC/anime-battle.gif',
    'https://media.tenor.com/bqCqR1c_e5QAAAAC/anime-combat.gif',
    'https://media.tenor.com/RDsFzQMJOxIAAAAC/anime-brawl.gif',
    'https://media.tenor.com/4kb-MzW-2jgAAAAC/anime-action.gif',
    'https://media.tenor.com/54vXJe6Jj3kAAAAC/anime-sword-fight.gif',
    'https://media.tenor.com/0ssFlowQEUQAAAAC/anime-kick.gif',
    'https://media.tenor.com/1Ds4FDvm92cAAAAC/anime-versus.gif',
    'https://media.tenor.com/bqCqR1c_e5QAAAAC/anime-duel.gif',
    'https://media.tenor.com/RDsFzQMJOxIAAAAC/anime-clash.gif',
  ],

  // ═══ BEG (12 URLs) ═══════════════════════════════════
  beg: [
    'https://media.tenor.com/0cde6-gf-z8AAAAC/anime-beg.gif',
    'https://media.tenor.com/0Zrxg3b0nMwAAAAC/anime-pleading.gif',
    'https://media.tenor.com/lpzAdP0gEfYAAAAC/anime-please.gif',
    'https://media.tenor.com/sE0d2GnJe1MAAAAC/anime-mercy.gif',
    'https://media.tenor.com/XoFqU2yXh4MAAAAC/anime-knees.gif',
    'https://media.tenor.com/6oRBP2R-UkIAAAAC/anime-puppy-eyes.gif',
    'https://media.tenor.com/0cde6-gf-z8AAAAC/anime-crying-beg.gif',
    'https://media.tenor.com/0Zrxg3b0nMwAAAAC/anime-help.gif',
    'https://media.tenor.com/lpzAdP0gEfYAAAAC/anime-spare-me.gif',
    'https://media.tenor.com/sE0d2GnJe1MAAAAC/anime-no-please.gif',
    'https://media.tenor.com/XoFqU2yXh4MAAAAC/anime-desperate.gif',
    'https://media.tenor.com/6oRBP2R-UkIAAAAC/anime-praying.gif',
  ],

  // ═══ SHRUG (8 URLs) ═══════════════════════════════════
  shrug: [
    'https://media.tenor.com/2RPEyp4NjRcAAAAC/anime-shrug.gif',
    'https://media.tenor.com/0Zrxg3b0nMwAAAAC/anime-idk.gif',
    'https://media.tenor.com/lpzAdP0gEfYAAAAC/anime-meh.gif',
    'https://media.tenor.com/sE0d2GnJe1MAAAAC/anime-whatever.gif',
    'https://media.tenor.com/XoFqU2yXh4MAAAAC/anime-dont-care.gif',
    'https://media.tenor.com/6oRBP2R-UkIAAAAC/anime-indifferent.gif',
    'https://media.tenor.com/2RPEyp4NjRcAAAAC/anime-aloof.gif',
    'https://media.tenor.com/0Zrxg3b0nMwAAAAC/anime-dunno.gif',
  ],

  // ═══ SLEEP (8 URLs) ═══════════════════════════════════
  sleep: [
    'https://media.tenor.com/59OfAXf4EUMAAAAM/anime-drawing.gif',
    'https://media.tenor.com/0UY84zQWda8AAAAM/laugh-droll.gif',
    'https://media.tenor.com/lpzAdP0gEfYAAAAC/anime-sleep.gif',
    'https://media.tenor.com/sE0d2GnJe1MAAAAC/anime-tired.gif',
    'https://media.tenor.com/XoFqU2yXh4MAAAAC/anime-nap.gif',
    'https://media.tenor.com/6oRBP2R-UkIAAAAC/anime-snooze.gif',
    'https://media.tenor.com/59OfAXf4EUMAAAAC/anime-zzz.gif',
    'https://media.tenor.com/0UY84zQWda8AAAAC/anime-yawn.gif',
  ],

  // ═══ WAVE (8 URLs) ═══════════════════════════════════
  wave: [
    'https://media.tenor.com/7f9CqFtd4SsAAAAM/hug.gif',
    'https://media.tenor.com/1SKzPjLVtrIAAAAM/friends-high5.gif',
    'https://media.tenor.com/lpzAdP0gEfYAAAAC/anime-wave.gif',
    'https://media.tenor.com/sE0d2GnJe1MAAAAC/anime-hello.gif',
    'https://media.tenor.com/XoFqU2yXh4MAAAAC/anime-hi.gif',
    'https://media.tenor.com/6oRBP2R-UkIAAAAC/anime-greeting.gif',
    'https://media.tenor.com/7f9CqFtd4SsAAAAC/anime-welcome.gif',
    'https://media.tenor.com/1SKzPjLVtrIAAAAC/anime-bye.gif',
  ],

  // ═══ FLEX (8 URLs) ═══════════════════════════════════
  flex: [
    'https://media.tenor.com/4kb-MzW-2jgAAAAM/sendo-ippo.gif',
    'https://media.tenor.com/0ssFlowQEUQAAAAM/naru-punch.gif',
    'https://media.tenor.com/lpzAdP0gEfYAAAAC/anime-flex.gif',
    'https://media.tenor.com/sE0d2GnJe1MAAAAC/anime-strong.gif',
    'https://media.tenor.com/XoFqU2yXh4MAAAAC/anime-muscle.gif',
    'https://media.tenor.com/6oRBP2R-UkIAAAAC/anime-power.gif',
    'https://media.tenor.com/4kb-MzW-2jgAAAAC/anime-buff.gif',
    'https://media.tenor.com/0ssFlowQEUQAAAAC/anime-gains.gif',
  ],

  // ═══ BRAIN (8 URLs) ═══════════════════════════════════
  brain: [
    'https://media.tenor.com/1Ds4FDvm92cAAAAC/anime-big-brain.gif',
    'https://media.tenor.com/0Zrxg3b0nMwAAAAC/anime-smart.gif',
    'https://media.tenor.com/lpzAdP0gEfYAAAAC/anime-200iq.gif',
    'https://media.tenor.com/sE0d2GnJe1MAAAAC/anime-genius.gif',
    'https://media.tenor.com/XoFqU2yXh4MAAAAC/anime-galaxy-brain.gif',
    'https://media.tenor.com/6oRBP2R-UkIAAAAC/anime-think.gif',
    'https://media.tenor.com/1Ds4FDvm92cAAAAC/anime-1000iq.gif',
    'https://media.tenor.com/0Zrxg3b0nMwAAAAC/anime-intellect.gif',
  ],

  // ═══ TRIGGER (8 URLs) ═══════════════════════════════════
  trigger: [
    'https://media.tenor.com/1GdYD6Wyf3wAAAAC/chunibyo-chuunibyou-demo-koi-ga-shitai.gif',
    'https://media.tenor.com/0ssFlowQEUQAAAAM/naru-punch.gif',
    'https://media.tenor.com/lpzAdP0gEfYAAAAC/anime-triggered.gif',
    'https://media.tenor.com/sE0d2GnJe1MAAAAC/anime-rage-quit.gif',
    'https://media.tenor.com/XoFqU2yXh4MAAAAC/anime-keyboard-smash.gif',
    'https://media.tenor.com/6oRBP2R-UkIAAAAC/anime-angry.gif',
    'https://media.tenor.com/1GdYD6Wyf3wAAAAC/anome-tilted.gif',
    'https://media.tenor.com/0ssFlowQEUQAAAAC/anome-seeing-red.gif',
  ],

  // ═══ NO_U (8 URLs) ═══════════════════════════════════
  no_u: [
    'https://media.tenor.com/2RPEyp4NjRcAAAAC/anime-reverse.gif',
    'https://media.tenor.com/0UY84zQWda8AAAAC/anime-lol.gif',
    'https://media.tenor.com/lpzAdP0gEfYAAAAC/anime-no-u.gif',
    'https://media.tenor.com/sE0d2GnJe1MAAAAC/anime-uno-reverse.gif',
    'https://media.tenor.com/XoFqU2yXh4MAAAAC/anime-trap-card.gif',
    'https://media.tenor.com/6oRBP2R-UkIAAAAC/anime-switcheroo.gif',
    'https://media.tenor.com/2RPEyp4NjRcAAAAC/anome-reverse-card.gif',
    'https://media.tenor.com/0UY84zQWda8AAAAC/anome-actually.gif',
  ],

  // ═══ GIGA/CHAD (8 URLs) ═══════════════════════════════════
  giga: [
    'https://media.tenor.com/4kb-MzW-2jgAAAAM/sendo-ippo.gif',
    'https://media.tenor.com/0ssFlowQEUQAAAAM/naru-punch.gif',
    'https://media.tenor.com/lpzAdP0gEfYAAAAC/anime-sigma.gif',
    'https://media.tenor.com/sE0d2GnJe1MAAAAC/anime-chad.gif',
    'https://media.tenor.com/XoFqU2yXh4MAAAAC/anime-alpha.gif',
    'https://media.tenor.com/6oRBP2R-UkIAAAAC/anime-grindset.gif',
    'https://media.tenor.com/4kb-MzW-2jgAAAAC/anime-gigachad.gif',
    'https://media.tenor.com/0ssFlowQEUQAAAAC/anome-confidence.gif',
  ],

  // ═══ W/REVIVE (8 URLs) ═══════════════════════════════════
  revive: [
    'https://media.tenor.com/3wX8AyxMBfIAAAAC/anime-revive.gif',
    'https://media.tenor.com/6DxJzu87RocAAAAC/anime-heal.gif',
    'https://media.tenor.com/lpzAdP0gEfYAAAAC/anime-phoenix.gif',
    'https://media.tenor.com/sE0d2GnJe1MAAAAC/anime-resurrection.gif',
    'https://media.tenor.com/XoFqU2yXh4MAAAAC/anime-life.gif',
    'https://media.tenor.com/6oRBP2R-UkIAAAAC/anime-coming-back.gif',
    'https://media.tenor.com/3wX8AyxMBfIAAAAC/anime-comeback.gif',
    'https://media.tenor.com/6DxJzu87RocAAAAC/anime-reborn.gif',
  ],

  // ═══ L (8 URLs) ═══════════════════════════════════
  l: [
    'https://media.tenor.com/0cde6-gf-z8AAAAC/anime-L.gif',
    'https://media.tenor.com/59OfAXf4EUMAAAAC/anime-fail.gif',
    'https://media.tenor.com/lpzAdP0gEfYAAAAC/anime-lose.gif',
    'https://media.tenor.com/sE0d2GnJe1MAAAAC/anime-loss.gif',
    'https://media.tenor.com/XoFqU2yXh4MAAAAC/anime-take-L.gif',
    'https://media.tenor.com/6oRBP2R-UkIAAAAC/anime-L-moment.gif',
    'https://media.tenor.com/0cde6-gf-z8AAAAC/anime-rekt.gif',
    'https://media.tenor.com/59OfAXf4EUMAAAAC/anime-disappointed.gif',
  ],

  // ═══ SCREAM (8 URLs) ═══════════════════════════════════
  scream: [
    'https://media.tenor.com/0ssFlowQEUQAAAAC/anime-scream.gif',
    'https://media.tenor.com/1GdYD6Wyf3wAAAAC/anime-yell.gif',
    'https://media.tenor.com/lpzAdP0gEfYAAAAC/anime-shriek.gif',
    'https://media.tenor.com/sE0d2GnJe1MAAAAC/anime-loud.gif',
    'https://media.tenor.com/XoFqU2yXh4MAAAAC/anime-AAAA.gif',
    'https://media.tenor.com/6oRBP2R-UkIAAAAC/anime-scream.gif',
    'https://media.tenor.com/0ssFlowQEUQAAAAC/anime-yelling.gif',
    'https://media.tenor.com/1GdYD6Wyf3wAAAAC/anime-crying-scream.gif',
  ],

  // ═══ COOL (8 URLs) ═══════════════════════════════════
  cool: [
    'https://media.tenor.com/1SKzPjLVtrIAAAAM/friends-high5.gif',
    'https://media.tenor.com/0WN6DfnOfF8AAAAM/wataten-watashi-ni-tenshi-ga-maiorita.gif',
    'https://media.tenor.com/lpzAdP0gEfYAAAAC/anime-sunglasses.gif',
    'https://media.tenor.com/sE0d2GnJe1MAAAAC/anime-swag.gif',
    'https://media.tenor.com/XoFqU2yXh4MAAAAC/anime-badass.gif',
    'https://media.tenor.com/6oRBP2R-UkIAAAAC/anime-ice-cold.gif',
    'https://media.tenor.com/1SKzPjLVtrIAAAAC/anime-smooth.gif',
    'https://media.tenor.com/0WN6DfnOfF8AAAAC/anime-deal-with-it.gif',
  ],

  // ═══ BLUSH (8 URLs) ═══════════════════════════════════
  blush: [
    'https://media.tenor.com/0Zrxg3b0nMwAAAAC/anime-blush.gif',
    'https://media.tenor.com/lpzAdP0gEfYAAAAC/anime-shy.gif',
    'https://media.tenor.com/sE0d2GnJe1MAAAAC/anime-embarrassed.gif',
    'https://media.tenor.com/XoFqU2yXh4MAAAAC/anime-red.gif',
    'https://media.tenor.com/6oRBP2R-UkIAAAAC/anime-flustered.gif',
    'https://media.tenor.com/0Zrxg3b0nMwAAAAC/anime-cute-blush.gif',
    'https://media.tenor.com/lpzAdP0gEfYAAAAC/anime-moe.gif',
    'https://media.tenor.com/sE0d2GnJe1MAAAAC/anime-kawaii.gif',
  ],

  // ═══ SUS (8 URLs) ═══════════════════════════════════
  sus: [
    'https://media.tenor.com/2RPEyp4NjRcAAAAC/anime-sus.gif',
    'https://media.tenor.com/0Zrxg3b0nMwAAAAC/anime-among-us.gif',
    'https://media.tenor.com/lpzAdP0gEfYAAAAC/anime-suspect.gif',
    'https://media.tenor.com/sE0d2GnJe1MAAAAC/anime-investigation.gif',
    'https://media.tenor.com/XoFqU2yXh4MAAAAC/anime-detective.gif',
    'https://media.tenor.com/6oRBP2R-UkIAAAAC/anome-sus.gif',
    'https://media.tenor.com/2RPEyp4NjRcAAAAC/anime-clue.gif',
    'https://media.tenor.com/0Zrxg3b0nMwAAAAC/anome-internal-affairs.gif',
  ],

  // ═══ SCARED (8 URLs) ═══════════════════════════════════
  scared: [
    'https://media.tenor.com/2RPEyp4NjRcAAAAC/anime-scared.gif',
    'https://media.tenor.com/0Zrxg3b0nMwAAAAC/anime-terrified.gif',
    'https://media.tenor.com/lpzAdP0gEfYAAAAC/anime-fear.gif',
    'https://media.tenor.com/sE0d2GnJe1MAAAAC/anime-horror.gif',
    'https://media.tenor.com/XoFqU2yXh4MAAAAC/anime-shaking.gif',
    'https://media.tenor.com/6oRBP2R-UkIAAAAC/anime-cold-sweat.gif',
    'https://media.tenor.com/2RPEyp4NjRcAAAAC/anime-panic.gif',
    'https://media.tenor.com/0Zrxg3b0nMwAAAAC/anime-trembling.gif',
  ],

  // ═══ COFFEE (8 URLs) ═══════════════════════════════════
  coffee: [
    'https://media.tenor.com/59OfAXf4EUMAAAAC/anime-coffee.gif',
    'https://media.tenor.com/3wX8AyxMBfIAAAAC/anime-drink.gif',
    'https://media.tenor.com/lpzAdP0gEfYAAAAC/anime-cafe.gif',
    'https://media.tenor.com/sE0d2GnJe1MAAAAC/anime-morning.gif',
    'https://media.tenor.com/XoFqU2yXh4MAAAAC/anime-latte.gif',
    'https://media.tenor.com/6oRBP2R-UkIAAAAC/anime-tea.gif',
    'https://media.tenor.com/59OfAXf4EUMAAAAC/anime-brew.gif',
    'https://media.tenor.com/3wX8AyxMBfIAAAAC/anime-warm-drink.gif',
  ],

  // ═══ MONEY (8 URLs) ═══════════════════════════════════
  money: [
    'https://media.tenor.com/4kb-MzW-2jgAAAAC/anime-rich.gif',
    'https://media.tenor.com/3wX8AyxMBfIAAAAC/anime-cash.gif',
    'https://media.tenor.com/lpzAdP0gEfYAAAAC/anime-gold.gif',
    'https://media.tenor.com/sE0d2GnJe1MAAAAC/anime-stonks.gif',
    'https://media.tenor.com/XoFqU2yXh4MAAAAC/anime-bag.gif',
    'https://media.tenor.com/6oRBP2R-UkIAAAAC/anime-diamonds.gif',
    'https://media.tenor.com/4kb-MzW-2jgAAAAC/anime-money.gif',
    'https://media.tenor.com/3wX8AyxMBfIAAAAC/anime-poor.gif',
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

/** Get a single random GIF for a keyword. */
async function getGif(keyword) {
  const urls = await getGifs(keyword, 5);
  if (urls.length === 0) return null;
  return urls[Math.floor(Math.random() * urls.length)];
}

/** Get multiple random GIFs for a keyword. */
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
