'use strict';

/* Copyright © 2026 FGx. All rights reserved. */

/**
 * Shared action definitions for /slap, /hug, /kiss, etc.
 * Each action has a label, emoji, color, GIF key, and flavor text lines.
 */

const ACTIONS = {
  slap: {
    label: 'Slapped',
    emoji: '🖐️',
    color: 0xFEE75C,
    gifKey: 'slap',
    lines: [
      '{actor} just **SLAPPED** {target} across the face! 🖐️',
      '*SMACK* {target} got slapped by {actor}! 🖐️',
      '{actor} wound up and slapped {target} into next week 🖐️',
      '{target} just caught a nuclear slap from {actor} 🖐️',
      'SLAP CAM — {actor} caught {target} lacking 🖐️',
    ],
  },
  hug: {
    label: 'Hugged',
    emoji: '🫂',
    color: 0x57F287,
    gifKey: 'hug',
    lines: [
      '{actor} just gave {target} a big warm hug! 🫂',
      '{target} is being hugged by {actor} — maximum cozy achieved 🫂',
      '{actor} wrapped {target} in a blanket of love 🫂',
      '{actor} pulled {target} into the biggest hug ever 🫂',
      'FREE HUGS — {actor} is spreading love to {target} 🫂',
    ],
  },
  kiss: {
    label: 'Kissed',
    emoji: '💋',
    color: 0xEB459E,
    gifKey: 'kiss',
    lines: [
      '{actor} just **kissed** {target}! 💋',
      '{target} just got smooched by {actor} — they\'re blushing 💋',
      '{actor} planted one on {target} — how romantic 💋',
      '*mwah* — {actor} gave {target} a kiss 💋',
      '{actor} and {target} sitting in a tree... K-I-S-S-I-N-G 💋',
    ],
  },
  punch: {
    label: 'Punched',
    emoji: '👊',
    color: 0xED4245,
    gifKey: 'punch',
    lines: [
      '{actor} just **PUNCHED** {target}! 💥',
      '{target} got knocked out by {actor}! 💥',
      '{actor} threw a haymaker at {target} — direct hit! 💥',
      'K.O.! {target} went down from {actor}\'s punch 💥',
      '{actor} activated Ultra Instinct and punched {target} 💥',
    ],
  },
  kill: {
    label: 'Killed',
    emoji: '💀',
    color: 0x000000,
    gifKey: 'destroy',
    lines: [
      '{actor} just absolutely **destroyed** {target} 💀',
      '{target} has been sent to the shadow realm by {actor} 💀',
      '{actor} chose violence today and {target} was the target 💀',
      'RIP {target} — {actor} just ended their whole career 💀',
      '{actor} did a fatality on {target} — no survivors 💀',
    ],
  },
  bonk: {
    label: 'Bonked',
    emoji: '🔨',
    color: 0xFF6B6B,
    gifKey: 'bonk',
    lines: [
      '{actor} **BONKED** {target}! Go to horny jail! 🔨',
      '*BONK* {target} has been sent to jail by {actor} 🔨',
      '{actor} swung a frying pan at {target} — direct hit! 🔨',
      'BONK BONK BONK — {target} is going to jail 🔨',
      '{actor} pulled out the big bonk hammer on {target} 🔨',
    ],
  },
  yeet: {
    label: 'Yeeted',
    emoji: '🚀',
    color: 0x57F287,
    gifKey: 'yeet',
    lines: [
      '{actor} just **YEETED** {target} into orbit! 🚀',
      '{target} has been launched into the stratosphere by {actor} 🚀',
      '{actor} grabbed {target} and threw them into the sun 🚀',
      'YEET — {target} is now in low Earth orbit thanks to {actor} 🚀',
      '{actor} put {target} in a trebuchet and launched them 🚀',
    ],
  },
  dance: {
    label: 'Danced with',
    emoji: '💃',
    color: 0xEB459E,
    gifKey: 'dance',
    lines: [
      '{actor} started dancing with {target}! 💃',
      '{actor} and {target} are hitting the dance floor! 💃',
      'DANCE BATTLE — {actor} vs {target}! 💃',
      '{actor} pulled {target} onto the dance floor 💃',
      'The DJ played their song — {actor} and {target} are vibing 💃',
    ],
  },
  pat: {
    label: 'Patted',
    emoji: '🐾',
    color: 0x57F287,
    gifKey: 'pat',
    lines: [
      '{actor} is patting {target} on the head! 🐾',
      '*pat pat* — {target} is being patted by {actor} 🐾',
      '{actor} gave {target} gentle head pats 🐾',
      'Maximum headpat achieved — {actor} is patting {target} 🐾',
      '{actor} can\'t stop patting {target} — too adorable 🐾',
    ],
  },
  stare: {
    label: 'Stared at',
    emoji: '👀',
    color: 0x99AAB5,
    gifKey: 'stare',
    lines: [
      '{actor} is staring intensely at {target}... 👀',
      '*stares* — {actor} is giving {target} the look 👀',
      '{actor} is giving {target} the side-eye 👀',
      'Why is {actor} staring at {target} like that... 👀',
      '{actor} hasn\'t blinked once while looking at {target} 👀',
    ],
  },
  poke: {
    label: 'Poked',
    emoji: '👆',
    color: 0x5865F2,
    gifKey: 'poke',
    lines: [
      '*boop* — {actor} poked {target}! 👆',
      '{actor} just poked {target} — stop poking! 👆',
      '*poke poke* — {target} is being poked by {actor} 👆',
      '{actor} can\'t stop poking {target} 👆',
      'POKE — {actor} activated {target}\'s boop sensor 👆',
    ],
  },
  bite: {
    label: 'Bit',
    emoji: '🦷',
    color: 0xED4245,
    gifKey: 'bite',
    lines: [
      '{actor} just **bit** {target}! 🦷',
      '*CHOMP* — {target} got bitten by {actor} 🦷',
      '{actor} went full vampire on {target} 🦷',
      '{actor} chomped down on {target} — ouch! 🦷',
      'VAMPIRE MODE — {actor} is feasting on {target} 🦷',
    ],
  },
  tickle: {
    label: 'Tickled',
    emoji: '😂',
    color: 0x57F287,
    gifKey: 'tickle',
    lines: [
      '{actor} is **tickling** {target}! 😂',
      '*tick tick tick* — {target} can\'t stop laughing! 😂',
      '{actor} found {target}\'s tickle spot! 😂',
      'TICKLE ATTACK — {target} is helpless against {actor} 😂',
      '{actor} is relentlessly tickling {target} — no mercy! 😂',
    ],
  },
  highfive: {
    label: 'High-fived',
    emoji: '🖐️',
    color: 0x57F287,
    gifKey: 'highfive',
    lines: [
      '{actor} just high-fived {target}! 🖐️',
      '*SLAP* — {actor} and {target} nailed the high-five! 🖐️',
      '{actor} and {target} are celebrating with a high-five! 🖐️',
      'EPIC HIGH-FIVE between {actor} and {target}! 🖐️',
      '{actor} gave {target} the most satisfying high-five ever 🖐️',
    ],
  },
  blame: {
    label: 'Blamed',
    emoji: '👆',
    color: 0xE67E22,
    gifKey: 'facepalm',
    lines: [
      '{actor} just **blamed** {target} for everything! 👆',
      '{target} is being blamed by {actor} — not again! 👆',
      '{actor} pointed at {target} and said "it was all their fault" 👆',
      'IT WAS {target} — {actor} is pointing fingers 👆',
      '{actor} threw {target} under the bus — hard 👆',
    ],
  },
  simp: {
    label: 'Simped for',
    emoji: '💘',
    color: 0xEB459E,
    gifKey: 'simp',
    lines: [
      '{actor} is **simping** for {target}! 💘',
      '{target} has a new fan — it\'s {actor}! 💘',
      'SIMP ALERT — {actor} is down bad for {target} 💘',
      '{actor} just sent {target} a love letter — cringe 💘',
      'Caught in 4K — {actor} is absolutely simping for {target} 💘',
    ],
  },
  revive: {
    label: 'Revived',
    emoji: '💚',
    color: 0x57F287,
    gifKey: 'w',
    lines: [
      '{actor} just **revived** {target} from the dead! 💚',
      '{target} has been brought back to life by {actor}! 💚',
      'RESURRECTED — {target} is back thanks to {actor} 💚',
      '{actor} used Phoenix Down on {target}! 💚',
      'ZOMBIE MODE — {actor} brought {target} back 💚',
    ],
  },
  shoot: {
    label: 'Shot',
    emoji: '🔫',
    color: 0xE67E22,
    gifKey: 'destroy',
    lines: [
      '{actor} just **shot** {target}! No survivors 🔫',
      '{target} has been eliminated by {actor} 🔫',
      '{actor} pulled up on {target} — pew pew 🔫',
      'HEADSHOT — {actor} nailed {target} 🔫',
      '{actor} went John Wick on {target} 🔫',
    ],
  },
  stab: {
    label: 'Stabbed',
    emoji: '🗡️',
    color: 0xED4245,
    gifKey: 'fight',
    lines: [
      '{actor} just **stabbed** {target} in the back! 🗡️',
      '{target} didn\'t see {actor} coming from behind 🗡️',
      '{actor} pulled a knife on {target} — it\'s personal now 🗡️',
      'BACKSTAB — {actor} betrayed {target} 🗡️',
      '{actor} went full assassin mode on {target} 🗡️',
    ],
  },
  destroy: {
    label: 'Destroyed',
    emoji: '💥',
    color: 0xED4245,
    gifKey: 'destroy',
    lines: [
      '{actor} just absolutely **ANNIHILATED** {target} 💥',
      '{target} has been reduced to atoms by {actor} 💥',
      'WASTED — {target} was destroyed by {actor} 💥',
      '{actor} brought the nuke — {target} doesn\'t exist anymore 💥',
      'GG — {actor} deleted {target} from the server 💥',
    ],
  },
};

function randomFrom(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

module.exports = { ACTIONS, randomFrom };
