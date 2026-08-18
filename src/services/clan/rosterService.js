'use strict';

/*
 * Copyright © 2026 FGx.
 * All rights reserved.
 */

const { RANKS, RANK_ORDER, STAFF_RANKS } = require('../../config/constants');
const { guildConfigRepo } = require('../../database/repos/guildConfig');
const { profilesRepo } = require('../../database/repos/profiles');
const { logAudit } = require('../logging/auditLogger');
const { PermissionError, ValidationError } = require('../../utils/errors');

/**
 * Clan roster management.
 * Ranks are configurable per guild (role IDs). Rank changes also apply the
 * matching Discord role when one is configured.
 */

/** Resolve a rank name (case-insensitive) or throw. */
function resolveRank(input) {
  const key = String(input ?? '').toLowerCase();
  const rank = RANKS.find((r) => r.toLowerCase() === key);
  if (!rank) {
    throw new ValidationError(
      `Invalid rank. Valid ranks: ${RANKS.map((r) => `\`${r}\``).join(', ')}.`,
    );
  }
  return rank;
}

/** True if the member's highest clan rank is at least `minimum`. */
function hasRank(member, minimum, config) {
  if (member.permissions?.has('Administrator')) return true;
  const ranks = config.clan.ranks;
  const held = [];
  for (const [rank, roleId] of Object.entries(ranks)) {
    if (roleId && member.roles?.cache?.has(roleId)) held.push(rank);
  }
  if (held.length === 0) return false;
  const highest = held.sort((a, b) => RANK_ORDER[b.toLowerCase()] - RANK_ORDER[a.toLowerCase()])[0];
  return RANK_ORDER[highest.toLowerCase()] >= RANK_ORDER[minimum.toLowerCase()];
}

/**
 * Require staff: any permission that implies moderation — ManageGuild or
 * ManageMessages ("delete others' messages") — or a Captain+ clan rank.
 */
function requireStaff(member, config) {
  if (member.permissions?.has('ManageGuild')) return;
  if (member.permissions?.has('ManageMessages')) return;
  if (hasRank(member, 'Captain', config)) return;
  throw new PermissionError('Only staff can do that (Captain+ rank, or the Manage Messages permission).');
}

/** Require a leadership rank (Manager+), ManageGuild, or Manage Messages. */
function requireLeadership(member, config) {
  if (member.permissions?.has('ManageGuild')) return;
  if (member.permissions?.has('ManageMessages')) return;
  if (hasRank(member, 'Manager', config)) return;
  throw new PermissionError('Only clan leadership (Manager+) can do that.');
}

/** Get or create a profile and set its clan rank (+ Discord role if configured). */
async function setRank(client, guild, member, rank) {
  const config = guildConfigRepo.get(guild.id);
  const roleId = config.clan.ranks[rank];
  const old = profilesRepo.ensure(guild.id, member.id).clan_rank ?? 'Recruit';

  profilesRepo.updateStats(guild.id, member.id, { clan_rank: rank });

  if (roleId && member.roles) {
    const role = guild.roles.cache.get(roleId);
    if (role) {
      await member.roles.add(role, `FGx roster: ${rank}`).catch(() => {});
      // Remove other configured rank roles so ranks don't stack.
      for (const [other, id] of Object.entries(config.clan.ranks)) {
        if (other !== rank && id && id !== roleId && member.roles.cache.has(id)) {
          await member.roles.remove(id, `FGx roster: ${rank}`).catch(() => {});
        }
      }
    }
  }

  await logAudit(client, guild, {
    action: 'roster',
    target: member.user,
    moderator: null,
    reason: `Rank change: ${old} → ${rank}`,
    details: { rank },
  });
  return rank;
}

/** Mark a member inactive (kept on the roster, flagged in meta). */
async function setInactive(client, guild, member, { active } = {}) {
  const profile = profilesRepo.ensure(guild.id, member.id);
  const meta = { ...safeParse(profile.meta, {}), inactive: active === false };
  profilesRepo.updateStats(guild.id, member.id, { meta });
  await logAudit(client, guild, {
    action: 'roster',
    target: member.user,
    moderator: null,
    reason: active === false ? 'Marked inactive' : 'Marked active',
  });
  return active === false;
}

/** Roster listing, sorted by rank then rating. */
function listRoster(guildId) {
  const rows = profilesRepo.allByRating(guildId);
  const rankOrder = (rank) => RANK_ORDER[String(rank ?? 'Recruit').toLowerCase()] ?? 0;
  return rows.sort((a, b) => {
    const byRank = rankOrder(b.clan_rank) - rankOrder(a.clan_rank);
    if (byRank !== 0) return byRank;
    return (b.rating ?? 0) - (a.rating ?? 0);
  });
}

/** Count members per rank. */
function countByRank(guildId) {
  const counts = Object.fromEntries(RANKS.map((r) => [r, 0]));
  for (const row of profilesRepo.allByRating(guildId)) {
    const rank = row.clan_rank && counts[row.clan_rank] !== undefined ? row.clan_rank : 'Recruit';
    counts[rank] += 1;
  }
  return counts;
}

function safeParse(json, fallback) {
  try {
    return JSON.parse(json);
  } catch {
    return fallback;
  }
}

module.exports = {
  resolveRank,
  hasRank,
  requireStaff,
  requireLeadership,
  setRank,
  setInactive,
  listRoster,
  countByRank,
  RANKS,
  STAFF_RANKS,
};
