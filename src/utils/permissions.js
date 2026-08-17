'use strict';

/*
 * Copyright © 2026 FGx.
 * All rights reserved.
 */

const { PermissionsBitField } = require('discord.js');
const { PermissionError } = require('./errors');

/**
 * Permission helpers shared by moderation and admin commands.
 */

/** Require the member to have every listed permission. */
function requirePerms(member, perms, message) {
  if (!member || !member.permissions) throw new PermissionError(message);
  const missing = member.permissions.missing(perms);
  if (missing.length > 0) {
    throw new PermissionError(
      message || `You need ${missing.map((p) => `\`${p}\``).join(', ')} to do that.`,
    );
  }
}

/** Require ManageGuild (effectively administrator-level configuration access). */
function requireAdmin(member) {
  requirePerms(member, [PermissionsBitField.Flags.ManageGuild], 'Only administrators can use that.');
}

/**
 * Validate that a moderator can act on a target:
 *  - moderator is not the target
 *  - moderator's highest role outranks the target's
 *  - the bot's highest role outranks the target
 * Returns the bot member for callers that need it.
 */
function validateHierarchy(member, target, _client) {
  if (member.id === target.id) {
    throw new PermissionError('You cannot perform a moderation action on yourself.');
  }
  if (target.id === member.guild.ownerId) {
    throw new PermissionError('You cannot moderate the server owner.');
  }
  const modTop = member.roles.highest;
  const targetTop = target.roles.highest;
  if (modTop.comparePositionTo(targetTop) <= 0) {
    throw new PermissionError('Your highest role does not outrank that member.');
  }
  const bot = member.guild.members.me;
  if (bot.roles.highest.comparePositionTo(targetTop) <= 0) {
    throw new PermissionError('My highest role does not outrank that member, so I cannot moderate them.');
  }
  return bot;
}

/**
 * Check that the bot has required permissions in a channel (e.g. ManageMessages).
 * Throws a safe error if not.
 */
function requireBotPerms(channel, perms) {
  if (!channel || !channel.permissionsFor) return;
  const bot = channel.guild.members.me;
  const missing = channel.permissionsFor(bot).missing(perms);
  if (missing.length > 0) {
    throw new PermissionError(
      `I need ${missing.map((p) => `\`${p}\``).join(', ')} in that channel.`,
    );
  }
}

module.exports = { requirePerms, requireAdmin, validateHierarchy, requireBotPerms };
