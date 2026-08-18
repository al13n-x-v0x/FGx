'use strict';

/*
 * Copyright © 2026 FGx.
 * All rights reserved.
 */

const { linksRepo } = require('../../database/repos/profiles');
const { robloxLinksRepo } = require('../../database/repos/roblox');

/**
 * Verification levels — the gate for FGx's VIP features.
 *
 * A member is:
 *   none    — no verification at all
 *   basic   — BloxStrike link approved by staff (/link)
 *   roblox  — Roblox account verified via About-code (/roblox verify)
 *   full    — BOTH verified → VIP features unlock ("it cooks")
 *
 * Levels are derived from existing tables, so no migration is needed and
 * nothing can drift out of sync with the real verification flows.
 */

const LEVELS = ['none', 'basic', 'roblox', 'full'];

/** Full verification status for a member. */
function status(guildId, userId) {
  const link = linksRepo.get(guildId, userId);
  const roblox = robloxLinksRepo.get(guildId, userId);
  const basic = link?.status === 'verified';
  const robloxVerified = roblox?.status === 'verified';
  const full = basic && robloxVerified;
  return {
    basic,
    roblox: robloxVerified,
    full,
    level: full ? 'full' : robloxVerified ? 'roblox' : basic ? 'basic' : 'none',
  };
}

/** True when the member is fully verified (both normal + Roblox). */
function isFull(guildId, userId) {
  return status(guildId, userId).full;
}

/** Throw a typed VIP_LOCKED error when the member isn't fully verified. */
function requireFull(guildId, userId) {
  const s = status(guildId, userId);
  if (!s.full) {
    const err = new Error(
      '🔒 **VIP locked.** Fully verify to unlock — your BloxStrike link must be approved by staff (`/link`) **and** your Roblox account verified (`/roblox verify`).',
    );
    err.code = 'VIP_LOCKED';
    err.vipStatus = s;
    throw err;
  }
  return s;
}

/** Human-readable line describing what's done / missing. */
function statusLines(s) {
  const lines = [
    `${s.basic ? '✅' : '⬜'} BloxStrike link approved by staff — \`/link\``,
    `${s.roblox ? '✅' : '⬜'} Roblox account verified — \`/roblox verify\``,
  ];
  if (s.full) {
    lines.push('👑 **You are fully verified — VIP unlocked!**');
  } else {
    lines.push('🔒 Verify both to unlock **VIP features** (VIP daily ₣Ԡ🇽, pro loadouts, profile crown).');
  }
  return lines;
}

module.exports = { verificationService: { status, isFull, requireFull, statusLines, LEVELS } };
