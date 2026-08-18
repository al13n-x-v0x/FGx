'use strict';

/*
 * Copyright © 2026 FGx.
 * All rights reserved.
 */

/**
 * FGx BloxStrike knowledge base.
 *
 * BloxStrike is a 5v5 round-based Roblox shooter built on the classic
 * Counter-Strike formula: a buy phase each round, an in-round economy, and
 * team play around sites, utility, and trade kills.
 *
 * This module is FGx's own *verified context*: a curated strategy guide that
 * the AI assistant draws on, instead of refusing with "no data". Weapon
 * advice is given by class and role (not by made-up names or stats) so it
 * stays accurate across balance patches. FGx never claims this is official
 * game data — it is community strategy knowledge.
 */

const OVERVIEW =
  'BloxStrike is a fast-paced 5v5 competitive Roblox shooter in the ' +
  'Counter-Strike formula. Each round starts with a short buy phase where ' +
  'players spend Credits on weapons and utility, then teams fight to plant ' +
  'or defuse the bomb (or eliminate the enemy). Rounds are short, deaths ' +
  'last until the next round, and the economy carries over — how your team ' +
  'spends (or saves) decides who controls the mid-game. Outside matches, ' +
  'Credits also buy cases containing weapon skins.';

const ROLES = [
  {
    role: 'Entry Fragger',
    loadout: 'rifle (AK/M4-class) + flash + smoke',
    tips: 'First one through the site. Trade your life for information and a kill; always call what you see before you die.',
  },
  {
    role: 'Support',
    loadout: 'rifle (M4-class) + smoke + flash + HE',
    tips: 'Throw the executes (smokes/flashes), refrag the entry, and stay alive to hold the post-plant.',
  },
  {
    role: 'Anchor',
    loadout: 'rifle or shotgun + smoke',
    tips: 'Holds a site solo. Buy a smoke to stall a rush and buy time for rotates.',
  },
  {
    role: 'AWPer / Sniper',
    loadout: 'sniper (AWP-class) + pistol (Deagle-class)',
    tips: 'Hold long sightlines and get first picks. If the enemy dry-peeks, punish them; reposition after every shot.',
  },
  {
    role: 'IGL / Caller',
    loadout: 'rifle + full utility',
    tips: 'Keep buys coordinated: five rifles beat one sniper and four pistols. Call the plan in the buy phase, not mid-round.',
  },
  {
    role: 'Lurker',
    loadout: 'rifle + smoke',
    tips: 'Stays off the main push to catch rotates. Only lurk when the team is executing a site; otherwise group up.',
  },
];

/** VIP-only pro loadouts — unlocked for fully verified members only. */
const VIP_ROLES = [
  {
    role: 'Clutch Master (VIP)',
    loadout: 'deagle (1-tap class) + full armor + flash — play the retake clock, not the fight',
    tips: 'VIP tech: save your flash for the last 10 seconds, jiggle-peek to bait the swing, and always hold the tightest angle on site.',
  },
  {
    role: 'Entry Prime (VIP)',
    loadout: 'rifle + molotov + flash + smoke — you go first, EVERY round',
    tips: 'VIP tech: pop-flash your own entry, prefire the two most common angles, and trade yourself immediately — your death is a win if the site opens.',
  },
  {
    role: 'Eco Baron (VIP)',
    loadout: 'p250/deagle + armor — turns losing rounds into money factories',
    tips: 'VIP tech: buy exactly 1 deagle + armor on full eco, take one opening duel, and if you lose it, save the gun. Anti-eco wins fund the next 3 buys.',
  },
  {
    role: 'Site Anchor Prime (VIP)',
    loadout: 'shotgun + smoke + molotov — impossible to rush',
    tips: 'VIP tech: molotov the main choke, smoke the second, and play the corner that forces a 1v1. You stall until rotates — you never need to win the 1v2.',
  },
];

const BUY_SITUATIONS = [
  {
    situation: 'Pistol round (round 1)',
    plan: 'Armor + a Deagle-class pistol (or a strong default pistol). Play slow, trade as a team, and win the round with numbers.',
  },
  {
    situation: 'Eco round (saving)',
    plan: 'Buy nothing or only a cheap pistol + armor. Losing the round is fine — you keep money for the next buy. As a team, NEVER half-buy.',
  },
  {
    situation: 'Force buy (2-3 rounds of losses)',
    plan: 'SMGs or shotguns + full utility + armor. Rush a site with flashes to overwhelm the enemy before their rifles outrange you.',
  },
  {
    situation: 'Full buy (won or big loss bonus)',
    plan: 'Rifles (AK/M4-class) + armor + full utility, or sniper if you are the AWPer. This is when executes and site takes happen.',
  },
  {
    situation: 'Anti-eco (enemy is saving)',
    plan: 'SMGs are fine and save money, but keep rifles for the guaranteed win. Play site with numbers — do not over-peek.',
  },
];

const UTILITY = [
  'Smoke — blocks sightlines and cuts a site in half. Throw it to cover executes and rotates.',
  'Flash — thrown BEFORE entry, not at the moment of entry. Pop-flash corners, then push.',
  'HE grenade — softens stacked site players and punishes tight rushes.',
  'Molotov/incendiary — clears corners and forces enemies out of cover; also stalls defuses.',
  'Buy utility every full buy — it wins rounds more than a slightly better gun does.',
];

const ECONOMY = [
  'The whole team should buy or save together — five rifles beat one sniper and four pistols.',
  'Losing streak = loss bonus: money grows each consecutive loss, so a planned eco sets up the next full buy.',
  'Winning the pistol round snowballs: convert it with a force/anti-eco, then keep the economy rolling.',
  'Planting the bomb (or getting plants) pays bonus money — the planter should survive the plant.',
  'Do not spend your last Credits on a case mid-competitive-match; the economy is the match.',
];

const TEAMPLAY = [
  'Trade kills: if your teammate dies, you MUST refrag the killer — a 1-for-1 trade keeps the numbers even.',
  'Crosshair placement at head height on common angles beats reflexes every time.',
  'Call what you see and what you die to — dead teammates are the best information source.',
  'Stick to the plan during an execute: flashes, then entry, then post-plant positions.',
  'On retake, use utility to delay the defuse and play the clock, not a 1v5 hero play.',
  'Warm up in deathmatch before competitive matches; consistency is a skill.',
];

/** Compact system-prompt section the AI assistant receives as verified context. */
function systemPromptSection() {
  const lines = [
    OVERVIEW,
    '',
    'Recommended loadouts by role:',
    ...ROLES.map((r) => `- ${r.role}: ${r.loadout}. ${r.tips}`),
    '',
    'Buy situations:',
    ...BUY_SITUATIONS.map((b) => `- ${b.situation}: ${b.plan}`),
    '',
    'Utility:',
    ...UTILITY.map((u) => `- ${u}`),
    '',
    'Economy:',
    ...ECONOMY.map((e) => `- ${e}`),
    '',
    'Teamplay:',
    ...TEAMPLAY.map((t) => `- ${t}`),
  ];
  return lines.join('\n');
}

module.exports = {
  OVERVIEW,
  ROLES,
  VIP_ROLES,
  BUY_SITUATIONS,
  UTILITY,
  ECONOMY,
  TEAMPLAY,
  systemPromptSection,
};
