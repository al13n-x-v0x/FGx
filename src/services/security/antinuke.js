'use strict';

/*
 * Copyright © 2026 FGx.
 * All rights reserved.
 */

const { AuditLogEvent } = require('discord.js');
const { guildConfigRepo } = require('../../database/repos/guildConfig');
const { logAudit } = require('../logging/auditLogger');
const { applyLockdown } = require('./lockdown');
const { logger } = require('../../utils/logger');

/**
 * Anti-nuke protection.
 *
 * Monitors dangerous actions (via guild events + audit logs) and enforces
 * configurable per-executor limits inside a sliding window:
 *   10 channel deletions / min    5 role deletions / min
 *   10 channel creations / min    5 role creations / min
 *   10 bans / min                 10 kicks / min
 *   5 webhook changes / min       5 permission escalations / min
 *
 * When a threshold is exceeded:
 *   1. Alert the server owner + staff channel.
 *   2. Log everything.
 *   3. Enable protection mode (lockdown) so the compromise window is contained.
 */

const ACTION_LIMIT_KEYS = {
  [AuditLogEvent.ChannelDelete]: 'channelDeleteLimit',
  [AuditLogEvent.ChannelCreate]: 'channelCreateLimit',
  [AuditLogEvent.RoleDelete]: 'roleDeleteLimit',
  [AuditLogEvent.RoleCreate]: 'roleCreateLimit',
  [AuditLogEvent.MemberBanAdd]: 'banLimit',
  [AuditLogEvent.MemberKick]: 'kickLimit',
  [AuditLogEvent.WebhookCreate]: 'webhookLimit',
  [AuditLogEvent.WebhookUpdate]: 'webhookLimit',
  [AuditLogEvent.WebhookDelete]: 'webhookLimit',
  [AuditLogEvent.GuildRoleUpdate]: 'permissionChangeLimit',
};

/** guildId -> Map("executorId:action" -> [timestamps]) */
const state = new Map();

function prune(guildId) {
  const map = state.get(guildId);
  if (!map) return;
  const cutoff = Date.now() - 10 * 60_000;
  for (const [key, timestamps] of map) {
    const live = timestamps.filter((t) => t > cutoff);
    if (live.length === 0) map.delete(key);
    else map.set(key, live);
  }
}

/**
 * Record a dangerous action and check limits.
 * Returns { anomaly: boolean, executorId, count, limit }.
 *
 * @param {object} [options]
 * @param {function} [options.predicate] Extra check on the audit entry; when it
 *   returns false the action is not counted (e.g. permission escalation only
 *   counts when dangerous bits were actually added).
 */
async function record(client, guild, auditEventType, target, { predicate } = {}) {
  const config = guildConfigRepo.get(guild.id);
  if (!config.antinuke.enabled) return { anomaly: false };

  // Identify the executor through the audit log.
  let executorId = null;
  try {
    const audit = await guild.fetchAuditLogs({ type: auditEventType, limit: 5 });
    let entry = null;
    if (target) {
      entry = audit.entries.find((e) => e.targetId === target.id) ?? audit.entries.first();
    } else {
      entry = audit.entries.first();
    }
    if (entry && predicate && !predicate(entry)) return { anomaly: false };
    executorId = entry?.executorId ?? null;
  } catch {
    /* audit log may be unavailable */
  }
  if (!executorId) return { anomaly: false };

  // Never flag our own bot or the owner.
  if (executorId === client.user.id || executorId === guild.ownerId) return { anomaly: false };

  const limitKey = ACTION_LIMIT_KEYS[auditEventType];
  if (!limitKey) return { anomaly: false };

  const limit = config.antinuke[limitKey] ?? 10;
  const windowMs = config.antinuke.windowSeconds * 1000;
  const key = `${executorId}:${auditEventType}`;

  prune(guild.id);
  if (!state.has(guild.id)) state.set(guild.id, new Map());
  const map = state.get(guild.id);

  const cutoff = Date.now() - windowMs;
  const timestamps = (map.get(key) ?? []).filter((t) => t > cutoff);
  timestamps.push(Date.now());
  map.set(key, timestamps);

  const count = timestamps.length;
  const anomaly = count >= limit;

  if (anomaly) {
    await handleAnomaly(client, guild, executorId, auditEventType, count, limit);
  }
  return { anomaly, executorId, count, limit };
}

async function handleAnomaly(client, guild, executorId, auditEventType, count, limit) {
  const executor = guild.members.cache.get(executorId)?.user ?? { id: executorId, username: executorId };
  const actionName = auditEventType.replace(/_/g, ' ');

  await logAudit(client, guild, {
    action: 'security',
    target: executor,
    moderator: null,
    reason: 'ANTI-NUKE ANOMALY',
    details: {
      action: actionName,
      occurrences: count,
      limit,
      window: `${guildConfigRepo.get(guild.id).antinuke.windowSeconds}s`,
      status: 'Protection mode enabled',
    },
  });

  // Enable protection mode to contain the compromise.
  const locked = await applyLockdown(guild).catch((err) => {
    logger.warn('antinuke lockdown failed', { guildId: guild.id, error: err.message });
    return 0;
  });

  // DM the owner.
  if (guildConfigRepo.get(guild.id).antinuke.notifyOwner) {
    const owner = await guild.fetchOwner().catch(() => null);
    if (owner) {
      await owner
        .send({
          embeds: [
            {
              color: 0xb91c1c,
              title: '⚠️ Anti-Nuke Alert',
              description:
                `Possible destructive action detected in **${guild.name}**.\n\n` +
                `**Action:** ${actionName}\n` +
                `**Executed by:** <@${executorId}>\n` +
                `**Count:** ${count} (limit ${limit} per window)\n` +
                `**Action taken:** Protection mode enabled — ${locked} channels locked.\n\n` +
                `Review immediately with \`/security status\`. Use \`/security disable\` when resolved.`,
            },
          ],
        })
        .catch(() => {});
    }
  }
}

function reset(guildId) {
  state.delete(guildId);
}

module.exports = { record, reset, ACTION_LIMIT_KEYS };
