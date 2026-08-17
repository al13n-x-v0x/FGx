'use strict';

/*
 * Copyright © 2026 FGx.
 * All rights reserved.
 */

const { PermissionsBitField } = require('discord.js');
const { validateHierarchy, requireBotPerms } = require('../../utils/permissions');
const { ValidationError, NotFoundError, PermissionError } = require('../../utils/errors');
const { logAudit } = require('../logging/auditLogger');
const { guildConfigRepo } = require('../../database/repos/guildConfig');
const { warningsRepo } = require('../../database/repos/moderation');
const { BRAND } = require('../../config/constants');

const COLORS = BRAND.colors;

/**
 * Central moderation service.
 * Every action: permission check → hierarchy check → action → log → safe response.
 */

/** Fetch a guild member, throwing a safe error if they can't be found. */
async function fetchMember(guild, userId) {
  try {
    const member = guild.members.cache.get(userId) ?? (await guild.members.fetch(userId));
    return member;
  } catch {
    throw new NotFoundError('That user could not be found in this server.');
  }
}

async function warn(client, interaction, { target, reason }) {
  const member = await fetchMember(interaction.guild, target.id);
  validateHierarchy(interaction.member, member, client);

  const warning = warningsRepo.add(interaction.guild.id, member.id, interaction.user.id, reason);
  const count = warningsRepo.countFor(interaction.guild.id, member.id);

  await logAudit(client, interaction.guild, {
    action: 'warn',
    target: member.user,
    moderator: interaction.user,
    reason,
    details: { warningId: warning.id, totalWarnings: count },
  });

  await interaction.reply({
    embeds: [
      {
        color: COLORS.warn,
        title: `Warning ${count} for ${member.user.username}`,
        description: reason,
      },
    ],
  });
  return { warning, count };
}

async function timeout(client, interaction, { target, durationMs, reason }) {
  const member = await fetchMember(interaction.guild, target.id);
  validateHierarchy(interaction.member, member, client);
  requireBotPerms(interaction.channel, [PermissionsBitField.Flags.ModerateMembers]);

  await member.timeout(durationMs, reason || 'No reason provided.');

  await logAudit(client, interaction.guild, {
    action: 'timeout',
    target: member.user,
    moderator: interaction.user,
    reason,
    details: { duration: `${durationMs / 60000} minutes` },
  });

  await interaction.reply({
    embeds: [
      {
        color: COLORS.warn,
        title: `${member.user.username} has been timed out`,
        description: `Duration: ${durationMs / 60000} minutes${reason ? `\nReason: ${reason}` : ''}`,
      },
    ],
  });
}

async function kick(client, interaction, { target, reason }) {
  const member = await fetchMember(interaction.guild, target.id);
  validateHierarchy(interaction.member, member, client);
  requireBotPerms(interaction.channel, [PermissionsBitField.Flags.KickMembers]);

  await member.kick(reason || 'No reason provided.');

  await logAudit(client, interaction.guild, {
    action: 'kick',
    target: member.user,
    moderator: interaction.user,
    reason,
  });

  await interaction.reply({
    embeds: [
      {
        color: COLORS.danger,
        title: `${member.user.username} has been kicked`,
        description: reason || 'No reason provided.',
      },
    ],
  });
}

async function ban(client, interaction, { target, reason, deleteDays }) {
  // Banning works by user ID; we still fetch for hierarchy awareness when present.
  const member = interaction.guild.members.cache.get(target.id);
  if (member) validateHierarchy(interaction.member, member, client);

  const days = Math.min(Math.max(Number(deleteDays) || 0, 0), 7);
  await interaction.guild.members.ban(target.id, {
    reason: reason || 'No reason provided.',
    deleteMessageSeconds: days * 86400,
  });

  await logAudit(client, interaction.guild, {
    action: 'ban',
    target: target,
    moderator: interaction.user,
    reason,
    details: { messageHistoryDeleted: `${days} days` },
  });

  await interaction.reply({
    embeds: [
      {
        color: COLORS.danger,
        title: `${target.username} has been banned`,
        description: reason || 'No reason provided.',
      },
    ],
  });
}

async function unban(client, interaction, { target, reason }) {
  try {
    await interaction.guild.bans.remove(target.id, reason || 'No reason provided.');
  } catch {
    throw new NotFoundError('That user is not banned in this server.');
  }

  await logAudit(client, interaction.guild, {
    action: 'unban',
    target,
    moderator: interaction.user,
    reason,
  });

  await interaction.reply({
    embeds: [
      {
        color: COLORS.success,
        title: `${target.username} has been unbanned`,
        description: reason || 'No reason provided.',
      },
    ],
  });
}

async function purge(client, interaction, { channel, count, filter }) {
  requireBotPerms(channel, [PermissionsBitField.Flags.ManageMessages]);

  let amount = Math.min(Math.max(count, 1), 100);

  let messages;
  try {
    messages = await channel.messages.fetch({ limit: 100 });
  } catch {
    throw new PermissionError('I could not fetch messages in that channel.');
  }

  // Apply the optional filter before bulk-deleting.
  let eligible = [...messages.values()];
  if (filter) {
    eligible = eligible.filter(filter);
  }
  eligible = eligible.filter((m) => Date.now() - m.createdTimestamp < 14 * 86400_000);
  eligible = eligible.slice(0, amount);

  if (eligible.length === 0) {
    throw new ValidationError('No messages matched the filter.');
  }

  const deleted = await channel.bulkDelete(eligible, true).catch(async () => {
    // Fall back to individual deletions if bulk delete fails (e.g. >2 weeks old).
    let n = 0;
    for (const m of eligible) {
      await m.delete().catch(() => {});
      n += 1;
    }
    return n;
  });
  const deletedCount = typeof deleted === 'number' ? deleted : deleted.size ?? eligible.length;

  await logAudit(client, interaction.guild, {
    action: 'purge',
    target: null,
    moderator: interaction.user,
    reason: filter ? `Purged ${deletedCount} messages (filtered)` : `Purged ${deletedCount} messages`,
    details: { channel: channel.name, count: deletedCount },
  });

  await interaction.reply({
    embeds: [
      {
        color: COLORS.neutral,
        title: `Deleted ${deletedCount} messages`,
        description: `Channel: ${channel}`,
      },
    ],
  });
}

async function setSlowmode(client, interaction, { channel, seconds }) {
  requireBotPerms(channel, [PermissionsBitField.Flags.ManageChannels]);
  await channel.setRateLimitPerUser(Math.min(Math.max(seconds, 0), 21600));

  await logAudit(client, interaction.guild, {
    action: 'slowmode',
    target: null,
    moderator: interaction.user,
    details: { channel: channel.name, seconds },
  });

  await interaction.reply({
    embeds: [
      {
        color: COLORS.neutral,
        title: seconds > 0 ? `Slowmode set to ${seconds}s` : 'Slowmode removed',
        description: `Channel: ${channel}`,
      },
    ],
  });
}

async function setLock(client, interaction, { channel, locked, reason }) {
  requireBotPerms(channel, [PermissionsBitField.Flags.ManageChannels]);
  const everyone = interaction.guild.roles.everyone;
  const overwrite = channel.permissionOverwrites.cache.get(everyone.id);
  const currentlyLocked = overwrite?.deny?.has(PermissionsBitField.Flags.SendMessages) ?? false;
  if (currentlyLocked === locked) {
    throw new ValidationError(locked ? 'That channel is already locked.' : 'That channel is already unlocked.');
  }

  await channel.permissionOverwrites.edit(everyone, {
    SendMessages: !locked,
    AddReactions: !locked,
  });

  await logAudit(client, interaction.guild, {
    action: locked ? 'lock' : 'unlock',
    target: null,
    moderator: interaction.user,
    reason,
    details: { channel: channel.name },
  });

  await interaction.reply({
    embeds: [
      {
        color: locked ? COLORS.danger : COLORS.success,
        title: locked ? `Channel locked` : `Channel unlocked`,
        description: `${channel} has been ${locked ? 'locked' : 'unlocked'}.${reason ? `\nReason: ${reason}` : ''}`,
      },
    ],
  });
}

async function setNick(client, interaction, { member, nickname }) {
  validateHierarchy(interaction.member, member, client);
  const old = member.displayName;
  await member.setNickname(nickname || null, `Nickname changed by ${interaction.user.tag}`);

  await logAudit(client, interaction.guild, {
    action: 'nick',
    target: member.user,
    moderator: interaction.user,
    details: { old: old || '(none)', new: nickname || '(none)' },
  });

  await interaction.reply({
    embeds: [
      {
        color: COLORS.neutral,
        title: `Nickname updated for ${member.user.username}`,
        description: `**Before:** ${old || '(none)'}\n**After:** ${nickname || '(none)'}`,
      },
    ],
  });
}

async function setRole(client, interaction, { member, role, add }) {
  validateHierarchy(interaction.member, member, client);
  requireBotPerms(interaction.guild, [PermissionsBitField.Flags.ManageRoles]);

  const has = member.roles.cache.has(role.id);
  if (add && has) throw new ValidationError(`${member.user.username} already has that role.`);
  if (!add && !has) throw new ValidationError(`${member.user.username} does not have that role.`);

  if (add) await member.roles.add(role, `Role added by ${interaction.user.tag}`);
  else await member.roles.remove(role, `Role removed by ${interaction.user.tag}`);

  await logAudit(client, interaction.guild, {
    action: 'role',
    target: member.user,
    moderator: interaction.user,
    details: { role: role.name, action: add ? 'added' : 'removed' },
  });

  await interaction.reply({
    embeds: [
      {
        color: COLORS.neutral,
        title: `${add ? 'Added' : 'Removed'} role ${role.name}`,
        description: `${member.user.username} ${add ? 'now has' : 'no longer has'} ${role}.`,
      },
    ],
  });
}

/** Get the guild's configured moderation log channel safely. */
function getModLogChannel(guild) {
  const config = guildConfigRepo.get(guild.id);
  const id = config.modLogChannel || config.logChannel;
  if (!id) return null;
  return guild.channels.cache.get(id) ?? null;
}

module.exports = {
  warn,
  timeout,
  kick,
  ban,
  unban,
  purge,
  setSlowmode,
  setLock,
  setNick,
  setRole,
  fetchMember,
  getModLogChannel,
};
