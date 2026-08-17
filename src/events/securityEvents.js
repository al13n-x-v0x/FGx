'use strict';

/*
 * Copyright © 2026 FGx.
 * All rights reserved.
 */

const { Events, AuditLogEvent, PermissionsBitField } = require('discord.js');
const { antinuke } = require('../services/security');
const { logAudit } = require('../services/logging/auditLogger');
const { logger } = require('../utils/logger');

/**
 * Anti-nuke event wiring.
 * Channel/role creation and deletion, bans, kicks, webhook abuse, and
 * dangerous permission escalations are recorded against the executor.
 */

const DANGEROUS_PERMISSIONS = [
  PermissionsBitField.Flags.Administrator,
  PermissionsBitField.Flags.ManageGuild,
  PermissionsBitField.Flags.ManageChannels,
  PermissionsBitField.Flags.ManageRoles,
  PermissionsBitField.Flags.BanMembers,
  PermissionsBitField.Flags.KickMembers,
  PermissionsBitField.Flags.ManageWebhooks,
];

/** True when the audit entry added dangerous permission bits to a role. */
function escalatedPermissions(entry) {
  const changes = entry.changes ?? [];
  for (const change of changes) {
    if (change.key !== 'permissions') continue;
    const oldBits = typeof change.old === 'bigint' ? change.old : BigInt(change.old ?? 0n);
    const newBits = typeof change.new === 'bigint' ? change.new : BigInt(change.new ?? 0n);
    const added = newBits & ~oldBits;
    if (DANGEROUS_PERMISSIONS.some((bit) => (added & bit) === bit)) return true;
  }
  return false;
}

function register(client) {
  const safe = (fn) => (arg) => fn(arg).catch((err) => {
    logger.warn('antinuke event failed', { error: err.message });
  });

  client.on(Events.ChannelDelete, safe((channel) => {
    if (!channel.guild) return;
    antinuke.record(client, channel.guild, AuditLogEvent.ChannelDelete, channel);
  }));

  client.on(Events.ChannelCreate, safe((channel) => {
    if (!channel.guild) return;
    antinuke.record(client, channel.guild, AuditLogEvent.ChannelCreate, channel);
  }));

  client.on(Events.RoleDelete, safe((role) => {
    if (!role.guild) return;
    antinuke.record(client, role.guild, AuditLogEvent.RoleDelete, role);
  }));

  client.on(Events.RoleCreate, safe((role) => {
    if (!role.guild) return;
    antinuke.record(client, role.guild, AuditLogEvent.RoleCreate, role);
  }));

  client.on(Events.GuildRoleUpdate, safe((oldRole, newRole) => {
    if (!newRole.guild) return;
    antinuke.record(client, newRole.guild, AuditLogEvent.GuildRoleUpdate, newRole, {
      predicate: escalatedPermissions,
    });
  }));

  client.on(Events.GuildBanAdd, safe((ban) => {
    if (!ban.guild) return;
    antinuke.record(client, ban.guild, AuditLogEvent.MemberBanAdd, ban.user);
  }));

  // Kicks surface as GuildMemberRemove; confirm via audit log to avoid false flags.
  client.on(Events.GuildMemberRemove, safe(async (member) => {
    if (!member.guild) return;
    let isKick = false;
    try {
      const audit = await member.guild.fetchAuditLogs({ type: AuditLogEvent.MemberKick, limit: 1 });
      const entry = audit.entries.first();
      if (
        entry &&
        entry.executorId !== member.id &&
        Date.now() - entry.createdTimestamp < 5000 &&
        String(entry.targetId) === String(member.id)
      ) {
        isKick = true;
      }
    } catch {
      /* audit log unavailable */
    }
    if (isKick) {
      await antinuke.record(client, member.guild, AuditLogEvent.MemberKick, member.user);
      await logAudit(client, member.guild, {
        action: 'kick',
        target: member.user,
        moderator: null,
        reason: 'Removed from server (kick detected)',
      });
    }
  }));

  client.on(Events.WebhooksUpdate, safe((channel) => {
    if (!channel.guild) return;
    // Webhook audit targets are webhooks, not channels — pass no target.
    antinuke.record(client, channel.guild, AuditLogEvent.WebhookCreate, null).catch(() => {});
  }));
}

module.exports = { register };
