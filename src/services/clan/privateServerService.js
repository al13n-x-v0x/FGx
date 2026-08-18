'use strict';

/*
 * Copyright © 2026 FGx.
 * All rights reserved.
 */

const fs = require('node:fs');
const path = require('node:path');
const { ChannelType, PermissionFlagsBits } = require('discord.js');
const { privateServersRepo } = require('../../database/repos/privateServers');
const { robloxLinksRepo } = require('../../database/repos/roblox');
const { logger } = require('../../utils/logger');

/**
 * Temporary private Discord servers for BloxStrike scrims, 1v1s, and 6v6s.
 *
 * The bot creates a branded server via the Discord API (guilds.create),
 * provisions text + voice channels and an invite, and auto-deletes it on
 * expiry. Creation requires a verified Roblox link (Bloxlink-style) unless
 * the user is clan staff — so the server is only for real, verified players.
 */

const ICON_PATH = path.join(__dirname, '..', '..', 'assets', 'fgx-icon.png');

const MODES = {
  '1v1': { label: '1v1', teams: 2 },
  '2v2': { label: '2v2', teams: 2 },
  '3v3': { label: '3v3', teams: 2 },
  '4v4': { label: '4v4', teams: 2 },
  '5v5': { label: '5v5', teams: 2 },
  '6v6': { label: '6v6', teams: 2 },
  practice: { label: 'Practice', teams: 1 },
};

const DEFAULT_HOURS = 3;
const MAX_HOURS = 24;
const MAX_ACTIVE_PER_GUILD = 3;
const MAX_ACTIVE_PER_OWNER = 1;

function modeInfo(mode) {
  return MODES[mode] ?? null;
}

/** Staff check reused by the gate: ManageGuild, Manage Messages, or Captain+. */
function isStaff(member, config) {
  if (member?.permissions?.has('ManageGuild')) return true;
  if (member?.permissions?.has('ManageMessages')) return true;
  if (member && config) return rosterHasStaff(member, config);
  return false;
}

function rosterHasStaff(member, config) {
  const { hasRank } = require('./rosterService');
  try {
    return hasRank(member, 'Captain', config);
  } catch {
    return false;
  }
}

/** True when the user holds a verified Roblox link in this guild. */
function isRobloxVerified(guildId, userId) {
  try {
    return robloxLinksRepo.get(guildId, userId)?.status === 'verified';
  } catch {
    return false;
  }
}

/** Guild icon as a data URI for guilds.create. */
function iconDataUri() {
  try {
    return `data:image/png;base64,${fs.readFileSync(ICON_PATH).toString('base64')}`;
  } catch {
    return undefined;
  }
}

/**
 * Create a private server for a match mode.
 * Gates: Roblox-verified (or staff), per-guild + per-owner limits.
 */
async function create(client, guild, user, mode, hours = DEFAULT_HOURS, { member, config } = {}) {
  const info = modeInfo(mode);
  if (!info) {
    const err = new Error(`Unknown mode **${mode}**. Modes: ${Object.keys(MODES).join(', ')}.`);
    err.code = 'INVALID_MODE';
    throw err;
  }
  const h = Math.max(1, Math.min(MAX_HOURS, Math.floor(hours ?? DEFAULT_HOURS)));

  if (privateServersRepo.countActive(guild.id) >= MAX_ACTIVE_PER_GUILD) {
    const err = new Error(`This server already has ${MAX_ACTIVE_PER_GUILD} active private servers. End one first with \`/private end\`.`);
    err.code = 'GUILD_LIMIT';
    throw err;
  }
  if (privateServersRepo.countActiveByOwner(guild.id, user.id) >= MAX_ACTIVE_PER_OWNER) {
    const err = new Error('You already have an active private server. End it with `/private end` before creating another.');
    err.code = 'OWNER_LIMIT';
    throw err;
  }
  if (!isStaff(member, config) && !isRobloxVerified(guild.id, user.id)) {
    const err = new Error(
      'Private servers are for **Roblox-verified** members only. Run `/roblox verify <username>` first — ' +
        'it takes under a minute (code goes in your Roblox About section).',
    );
    err.code = 'ROBLOX_REQUIRED';
    throw err;
  }

  const stamp = new Date().toISOString().slice(0, 10);
  const name = `FGx ${info.label} • ${stamp}`;
  const expiresAt = new Date(Date.now() + h * 3_600_000).toISOString();

  const server = await client.guilds.create({
    name,
    icon: iconDataUri(),
    reason: `FGx private ${info.label} server requested by ${user.username}`,
  });

  try {
    const everyone = server.roles.everyone;
    const view = [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory];

    const text = await server.channels.create({
      name: 'match-chat',
      type: ChannelType.GuildText,
      permissionOverwrites: [
        { id: everyone.id, allow: view },
        { id: user.id, allow: [PermissionFlagsBits.ManageChannels, PermissionFlagsBits.ManageMessages] },
      ],
    });
    await server.channels.create({
      name: 'results',
      type: ChannelType.GuildText,
      permissionOverwrites: [{ id: everyone.id, allow: view }],
    });

    const voicePerms = [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.Connect, PermissionFlagsBits.Speak];
    await server.channels.create({
      name: 'Main',
      type: ChannelType.GuildVoice,
      permissionOverwrites: [{ id: everyone.id, allow: voicePerms }],
    });
    for (let i = 1; i <= info.teams; i += 1) {
      await server.channels.create({
        name: `Team ${i}`,
        type: ChannelType.GuildVoice,
        permissionOverwrites: [{ id: everyone.id, allow: voicePerms }],
      });
    }

    const invite = await text.createInvite({
      maxAge: h * 3_600,
      maxUses: 0,
      reason: `FGx private ${info.label} server`,
    });

    let record = privateServersRepo.create({
      guildId: guild.id,
      serverId: server.id,
      ownerId: user.id,
      mode,
      expiresAt,
    });
    record = privateServersRepo.setInvite(server.id, invite.code);

    return { server, invite, record, info };
  } catch (err) {
    // Roll back: delete the half-created server so nothing is left behind.
    await server.delete('FGx private server creation failed').catch(() => {});
    throw err;
  }
}

/** Delete a private server and mark its record ended. */
async function end(client, serverId) {
  const record = privateServersRepo.getByServer(serverId);
  if (!record) {
    const err = new Error('No private server with that ID is active.');
    err.code = 'NOT_FOUND';
    throw err;
  }
  try {
    const server = await client.guilds.fetch(serverId);
    await server.delete('FGx private server ended');
  } catch {
    // The guild may already be gone — just mark the record ended.
  }
  privateServersRepo.end(serverId);
  return record;
}

/**
 * Startup sweep: delete expired servers and clean up records whose guilds
 * no longer exist.
 */
async function sweep(client) {
  const active = privateServersRepo.listAllActive();
  let deleted = 0;
  for (const record of active) {
    try {
      const server = await client.guilds.fetch(record.server_id);
      if (record.expires_at && new Date(record.expires_at).getTime() <= Date.now()) {
        await server.delete('FGx private server expired');
        privateServersRepo.end(record.server_id);
        deleted += 1;
      }
    } catch {
      // Guild gone or unreachable — drop the record.
      privateServersRepo.end(record.server_id);
      deleted += 1;
    }
  }
  if (deleted > 0) logger.info(`private servers: swept ${deleted} stale server(s)`);
  return deleted;
}

module.exports = {
  MODES,
  DEFAULT_HOURS,
  MAX_HOURS,
  MAX_ACTIVE_PER_GUILD,
  MAX_ACTIVE_PER_OWNER,
  modeInfo,
  isStaff,
  isRobloxVerified,
  create,
  end,
  sweep,
};
