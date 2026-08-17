'use strict';

/*
 * Copyright © 2026 FGx.
 * All rights reserved.
 */

const { EmbedBuilder } = require('discord.js');
const { BRAND } = require('../../config/constants');
const { guildConfigRepo } = require('../../database/repos/guildConfig');
const { logAudit } = require('../logging/auditLogger');
const { applyLockdown } = require('./lockdown');
const { logger } = require('../../utils/logger');

/**
 * Anti-raid engine.
 *
 * Signals monitored on member joins:
 *  - join velocity       >= joinThreshold joins / windowSeconds
 *  - new accounts        >= suspiciousThreshold accounts younger than newAccountHours
 *  - profile similarity  repeated avatar hash or username pattern
 *
 * On detection: protection mode (lockdown), alert staff, log. Never auto-bans.
 */

const MAX_WINDOW_ENTRIES = 500;
const state = new Map(); // guildId -> { joins: [], lastAlert: 0, raiding: false }

function getGuildState(guildId) {
  if (!state.has(guildId)) state.set(guildId, { joins: [], lastAlert: 0, raiding: false });
  return state.get(guildId);
}

function windowed(guildState, windowMs) {
  const cutoff = Date.now() - windowMs;
  return guildState.joins.filter((j) => j.joinedAt > cutoff);
}

/**
 * Record a join and evaluate raid signals.
 * Returns { raid: boolean, signals: string[] }.
 */
function evaluate(guild, member, config) {
  const cfg = config.antiraid;
  const gs = getGuildState(guild.id);
  if (!cfg.enabled) return { raid: false, signals: [] };

  const accountAgeMs = Date.now() - (member.user.createdAt?.getTime() ?? Date.now());
  const entry = {
    userId: member.id,
    joinedAt: Date.now(),
    accountAgeMs,
    avatarHash: member.user.avatar,
    username: member.user.username,
  };
  gs.joins.push(entry);
  if (gs.joins.length > MAX_WINDOW_ENTRIES) gs.joins.shift();

  const windowMs = cfg.windowSeconds * 1000;
  const recent = windowed(gs, windowMs);
  const signals = [];

  if (recent.length >= cfg.joinThreshold) signals.push('join velocity');
  const newAccounts = recent.filter((j) => j.accountAgeMs < cfg.newAccountHours * 3_600_000);
  if (newAccounts.length >= cfg.suspiciousThreshold) signals.push('new account pattern');

  // Repeated profile similarity: same avatar hash or same username-with-number suffix.
  const avatarGroups = new Map();
  const nameGroups = new Map();
  for (const j of recent) {
    if (j.avatarHash) {
      avatarGroups.set(j.avatarHash, (avatarGroups.get(j.avatarHash) ?? 0) + 1);
    }
    const nameBase = j.username.replace(/[\d_]+$/, '');
    nameGroups.set(nameBase, (nameGroups.get(nameBase) ?? 0) + 1);
  }
  for (const count of avatarGroups.values()) {
    if (count >= cfg.suspiciousThreshold) {
      signals.push('repeated profile similarity');
      break;
    }
  }
  for (const [name, count] of nameGroups) {
    if (count >= cfg.suspiciousThreshold && name.length >= 4) {
      signals.push('repeated profile similarity');
      break;
    }
  }

  const raid = signals.length > 0 && recent.length >= Math.min(cfg.suspiciousThreshold, cfg.joinThreshold);
  return { raid, signals };
}

/**
 * Act on a detected raid: enable protection mode, alert staff, log.
 * Cooldown prevents alert spam.
 */
async function handleRaid(client, guild, member, config, signals) {
  const gs = getGuildState(guild.id);
  const now = Date.now();
  const ALERT_COOLDOWN_MS = 10 * 60_000;
  if (now - gs.lastAlert < ALERT_COOLDOWN_MS) {
    return { alerted: false, reason: 'cooldown' };
  }
  gs.lastAlert = now;
  gs.raiding = true;

  const locked = await applyLockdown(guild).catch((err) => {
    logger.warn('raid lockdown failed', { guildId: guild.id, error: err.message });
    return 0;
  });

  await logAudit(client, guild, {
    action: 'security',
    target: member.user,
    moderator: null,
    reason: 'RAID DETECTED',
    details: {
      signal: signals.join(', '),
      protectionMode: `ENABLED (${locked} channels locked)`,
      suspiciousUser: member.user.username,
    },
  });

  // Alert the configured staff channel with a prominent embed.
  const configNow = guildConfigRepo.get(guild.id);
  const channelId = configNow.logChannel || configNow.modLogChannel;
  if (channelId) {
    const channel = guild.channels.cache.get(channelId) ?? (await guild.channels.fetch(channelId).catch(() => null));
    if (channel?.isTextBased?.()) {
      const embed = new EmbedBuilder()
        .setColor(BRAND.colors.danger)
        .setTitle('RAID DETECTED')
        .setDescription(
          `A possible raid has been detected on **${guild.name}**.\n\n` +
            `**Signals:** ${signals.join(', ')}\n` +
            `**Protection mode:** Enabled — ${locked} channels locked for everyone.\n` +
            `**Next step:** Staff should review joins and use \`/security disable\` once the threat is resolved.`,
        )
        .setTimestamp(new Date())
        .setFooter({ text: BRAND.footer });
      await channel.send({ embeds: [embed] }).catch(() => {});
    }
  }

  return { alerted: true, channelsLocked: locked };
}

/** Reset raid state (called by /security disable). */
function reset(guildId) {
  state.delete(guildId);
}

module.exports = { evaluate, handleRaid, reset, getGuildState };
