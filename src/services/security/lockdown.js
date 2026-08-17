'use strict';

/*
 * Copyright © 2026 FGx.
 * All rights reserved.
 */

const { PermissionsBitField, ChannelType } = require('discord.js');
const { guildConfigRepo } = require('../../database/repos/guildConfig');
const { logger } = require('../../utils/logger');

/**
 * Server lockdown / protection mode.
 * Denies SendMessages to @everyone in text channels while allowing configured
 * staff roles through. Used by raid protection and manual /security lockdown.
 */

async function applyLockdown(guild, { allowRoles = [] } = {}) {
  const config = guildConfigRepo.get(guild.id);
  const allow = allowRoles.length > 0 ? allowRoles : config.security.lockdownRoleIds;
  let locked = 0;

  for (const channel of guild.channels.cache.values()) {
    if (!channel.isTextBased?.() || channel.type === ChannelType.GuildCategory) continue;
    try {
      await channel.permissionOverwrites.edit(guild.roles.everyone, {
        SendMessages: false,
        AddReactions: false,
        CreatePublicThreads: false,
        CreatePrivateThreads: false,
      });
      for (const roleId of allow) {
        const role = guild.roles.cache.get(roleId);
        if (role) {
          await channel.permissionOverwrites.edit(role, { SendMessages: true }).catch(() => {});
        }
      }
      locked += 1;
    } catch (err) {
      logger.warn('lockdown failed on channel', { channel: channel.name, error: err.message });
    }
  }

  guildConfigRepo.update(guild.id, { security: { lockdown: true, lockdownRoleIds: allow } });
  return locked;
}

async function removeLockdown(guild) {
  let unlocked = 0;
  for (const channel of guild.channels.cache.values()) {
    if (!channel.isTextBased?.() || channel.type === ChannelType.GuildCategory) continue;
    try {
      await channel.permissionOverwrites.edit(guild.roles.everyone, {
        SendMessages: true,
        AddReactions: true,
        CreatePublicThreads: true,
        CreatePrivateThreads: true,
      });
      unlocked += 1;
    } catch (err) {
      logger.warn('unlock failed on channel', { channel: channel.name, error: err.message });
    }
  }
  guildConfigRepo.update(guild.id, { security: { lockdown: false } });
  return unlocked;
}

/** Whether the guild is currently in protection mode. */
function isLockedDown(guildId) {
  return guildConfigRepo.get(guildId).security.lockdown === true;
}

/** Whether a member may speak during lockdown. */
function maySpeakDuringLockdown(member) {
  return Boolean(member?.permissions?.has(PermissionsBitField.Flags.ManageMessages));
}

module.exports = { applyLockdown, removeLockdown, isLockedDown, maySpeakDuringLockdown };
