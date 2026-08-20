'use strict';

/* Copyright © 2026 FGx. All rights reserved. */

const { profilesRepo, linksRepo, xpRepo, achievementsRepo } = require('../../database/repos/profiles');
const { economyRepo } = require('../../database/repos/economy');
const { robloxLinksRepo } = require('../../database/repos/roblox');
const { warningsRepo } = require('../../database/repos/moderation');
const { matchesRepo } = require('../../database/repos/competitive');
const { guildConfigRepo } = require('../../database/repos/guildConfig');
const { RANKS } = require('../../config/constants');

/**
 * Comprehensive player lookup.
 * Pulls every available data point about a member from:
 *   - Discord roles & join date
 *   - Profile stats (wins, losses, kills, deaths, rating, streak)
 *   - BloxStrike link
 *   - Roblox link
 *   - XP level
 *   - Economy balance
 *   - Warnings
 *   - Achievements
 *   - Match aggregates
 *   - Clan rank from config
 *
 * Returns a plain-text block the AI can read.
 */
function lookupPlayer(guild, userId) {
  const parts = [];

  // ── Discord member info ─────────────────────────────────────────
  const member = guild.members.cache.get(userId);
  if (member) {
    const roles = member.roles.cache
      .filter((r) => r.id !== guild.id) // exclude @everyone
      .sort((a, b) => b.position - a.position)
      .map((r) => r.name);
    parts.push(`Discord: ${member.user.username} (${member.user.id})`);
    parts.push(`Nickname: ${member.nickname ?? '(none)'}`);
    parts.push(`Roles: ${roles.length > 0 ? roles.join(', ') : '(none)'}`);
    parts.push(`Joined: ${member.joinedAt ? member.joinedAt.toISOString().slice(0, 10) : 'unknown'}`);
    parts.push(`Bot: ${member.user.bot ? 'yes' : 'no'}`);
  } else {
    parts.push(`Discord user ID: ${userId} (not in member cache)`);
  }

  // ── Clan rank from config ───────────────────────────────────────
  try {
    const config = guildConfigRepo.get(guild.id);
    const clanRanks = config.clan?.ranks ?? {};
    for (const [rankName, roleId] of Object.entries(clanRanks)) {
      if (roleId && member?.roles.cache.has(roleId)) {
        parts.push(`Clan rank: ${rankName}`);
        break;
      }
    }
  } catch { /* best-effort */ }

  // ── Profile stats ───────────────────────────────────────────────
  try {
    const profile = profilesRepo.get(guild.id, userId);
    if (profile) {
      parts.push(`\n--- Profile ---`);
      parts.push(`BloxStrike username: ${profile.blox_username ?? '(not set)'}`);
      parts.push(`Clan rank (profile): ${profile.clan_rank ?? '(not set)'}`);
      parts.push(`Wins: ${profile.wins ?? 0} | Losses: ${profile.losses ?? 0} | Matches: ${profile.matches ?? 0}`);
      parts.push(`Kills: ${profile.kills ?? 0} | Deaths: ${profile.deaths ?? 0}`);
      const kd = profile.deaths > 0 ? (profile.kills / profile.deaths).toFixed(2) : profile.kills;
      parts.push(`K/D: ${kd}`);
      parts.push(`Rating: ${profile.rating ?? 1000}`);
      parts.push(`Current streak: ${profile.current_streak ?? 0} | Best streak: ${profile.best_streak ?? 0}`);
      parts.push(`Stats source: ${profile.stats_source ?? 'unverified'}`);
    }
  } catch { /* best-effort */ }

  // ── Match aggregates (from recorded matches) ────────────────────
  try {
    const agg = matchesRepo.playerAggregates(guild.id, userId);
    if (agg.matches > 0) {
      parts.push(`\n--- Recorded Match Stats ---`);
      parts.push(`Matches played: ${agg.matches} | Wins: ${agg.wins} | Losses: ${agg.losses} | Draws: ${agg.draws}`);
      parts.push(`Total kills: ${agg.kills} | Total deaths: ${agg.deaths}`);
    }
  } catch { /* best-effort */ }

  // ── BloxStrike link ─────────────────────────────────────────────
  try {
    const link = linksRepo.get(guild.id, userId);
    if (link) {
      parts.push(`\n--- BloxStrike Link ---`);
      parts.push(`Username: ${link.blox_username}`);
      parts.push(`Status: ${link.status}`);
    }
  } catch { /* best-effort */ }

  // ── Roblox link ─────────────────────────────────────────────────
  try {
    const roblox = robloxLinksRepo.get(guild.id, userId);
    if (roblox) {
      parts.push(`\n--- Roblox Link ---`);
      parts.push(`Username: ${roblox.roblox_username} (id ${roblox.roblox_id})`);
      parts.push(`Status: ${roblox.status}`);
    }
  } catch { /* best-effort */ }

  // ── XP ──────────────────────────────────────────────────────────
  try {
    const xp = xpRepo.get(guild.id, userId);
    if (xp) {
      parts.push(`\n--- XP ---`);
      parts.push(`Level: ${xp.level} | XP: ${xp.xp}`);
    }
  } catch { /* best-effort */ }

  // ── Economy ─────────────────────────────────────────────────────
  try {
    const eco = economyRepo.get(guild.id, userId);
    if (eco) {
      parts.push(`\n--- Economy ---`);
      parts.push(`Balance: ₣Ԡ🇽 ${eco.balance ?? 0} | Lifetime earned: ₣Ԡ🇽 ${eco.lifetime ?? 0}`);
      parts.push(`Daily streak: ${eco.daily_streak ?? 0}`);
    }
  } catch { /* best-effort */ }

  // ── Warnings ────────────────────────────────────────────────────
  try {
    const warnCount = warningsRepo.countFor(guild.id, userId);
    if (warnCount > 0) {
      parts.push(`\n--- Moderation ---`);
      parts.push(`Active warnings: ${warnCount}`);
    }
  } catch { /* best-effort */ }

  // ── Achievements ────────────────────────────────────────────────
  try {
    const achs = achievementsRepo.list(guild.id, userId);
    if (achs.length > 0) {
      parts.push(`\n--- Achievements ---`);
      parts.push(achs.map((a) => a.code).join(', '));
    }
  } catch { /* best-effort */ }

  // ── Verification status ─────────────────────────────────────────
  try {
    const basic = linksRepo.get(guild.id, userId);
    const roblox = robloxLinksRepo.get(guild.id, userId);
    const basicOk = basic?.status === 'verified';
    const robloxOk = roblox?.status === 'verified';
    parts.push(`\n--- Verification ---`);
    parts.push(`BloxStrike: ${basicOk ? '✅ verified' : basic ? '⏳ pending' : '❌ not linked'}`);
    parts.push(`Roblox: ${robloxOk ? '✅ verified' : roblox ? '⏳ pending' : '❌ not linked'}`);
    parts.push(`Full VIP: ${basicOk && robloxOk ? '✅ unlocked' : '🔒 locked'}`);
  } catch { /* best-effort */ }

  return parts.join('\n');
}

/**
 * Search for a member by username, display name, nickname, or mention.
 * Returns the member or null.
 */
function findMember(guild, query) {
  const q = query.trim().toLowerCase();

  // Try mention format: <@123> or <@!123>
  const mentionMatch = q.match(/^<@!?(\d+)>$/);
  if (mentionMatch) {
    return guild.members.cache.get(mentionMatch[1]) ?? null;
  }

  // Try raw ID
  if (/^\d{17,21}$/.test(q)) {
    return guild.members.cache.get(q) ?? null;
  }

  // Exact username match
  const exact = guild.members.cache.find(
    (m) => m.user.username.toLowerCase() === q,
  );
  if (exact) return exact;

  // Exact display name / nickname match
  const display = guild.members.cache.find(
    (m) => (m.displayName ?? '').toLowerCase() === q,
  );
  if (display) return display;

  // Partial username match
  const partial = guild.members.cache.find(
    (m) =>
      m.user.username.toLowerCase().includes(q) ||
      (m.displayName ?? '').toLowerCase().includes(q) ||
      (m.nickname ?? '').toLowerCase().includes(q),
  );
  return partial ?? null;
}

/**
 * Detect if a question is asking about a specific player.
 * Returns { member, query } or null.
 */
function detectPlayerQuery(guild, question) {
  const q = question.toLowerCase();

  // Patterns: "who is X", "who's X", "tell me about X", "what rank is X",
  // "is X verified", "show me X", "info on X", "profile of X", "stats for X"
  const patterns = [
    /who\s+(?:is|'s)\s+(.+)/i,
    /tell\s+(?:me\s+)?(?:about|me\s+about)\s+(.+)/i,
    /what\s+(?:rank|role|level)\s+(?:is|does)\s+(.+?)(?:\s+have)?$/i,
    /is\s+(\S+)\s+(?:verified|admin|mod|staff|member|clan)/i,
    /(?:show|give)\s+(?:me\s+)?(?:info|stats|profile|details?)\s+(?:on|of|for|about)\s+(.+)/i,
    /(?:info|stats|profile|details?)\s+(?:on|of|for|about)\s+(.+)/i,
    /what(?:'s| is)\s+(\S+)'?s\s+(?:stats|rank|level|balance|profile)/i,
    /lookup\s+(.+)/i,
    /search\s+(?:for\s+)?(.+)/i,
  ];

  for (const pattern of patterns) {
    const match = q.match(pattern);
    if (match) {
      const name = match[1].replace(/[?!.]+$/, '').trim();
      if (name.length >= 2 && name.length <= 40) {
        const member = findMember(guild, name);
        if (member) return { member, query: name };
      }
    }
  }

  // Also check for <@ID> mentions directly in the question
  const mentionMatch = question.match(/<@!?(\d+)>/);
  if (mentionMatch) {
    const member = guild.members.cache.get(mentionMatch[1]);
    if (member) return { member, query: member.user.username };
  }

  return null;
}

module.exports = { lookupPlayer, findMember, detectPlayerQuery };
