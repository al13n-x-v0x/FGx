'use strict';

/*
 * Copyright © 2026 FGx.
 * All rights reserved.
 */

/**
 * Input validation helpers.
 * Never trust raw user input — validate snowflakes, enums, ranges, durations.
 */

const { ValidationError } = require('./errors');

const SNOWFLAKE_RE = /^\d{15,21}$/;

/** Validate a Discord snowflake (user/role/channel ID). */
function snowflake(value, label = 'ID') {
  const id = String(value ?? '').trim();
  if (!SNOWFLAKE_RE.test(id)) {
    throw new ValidationError(`\`${label}\` must be a valid Discord ID.`);
  }
  return id;
}

/** Validate a role ID and ensure it exists in the guild. Returns the role. */
function guildRole(guild, value, label = 'role') {
  const id = snowflake(value, label);
  const role = guild.roles.cache.get(id);
  if (!role) throw new ValidationError(`No role with ID \`${id}\` exists in this server.`);
  return role;
}

/** Validate a channel ID and ensure it exists in the guild. Returns the channel. */
function guildChannel(guild, value, label = 'channel') {
  const id = snowflake(value, label);
  const channel = guild.channels.cache.get(id);
  if (!channel) throw new ValidationError(`No channel with ID \`${id}\` exists in this server.`);
  return channel;
}

/** Validate one of a fixed set of values. */
function oneOf(value, allowed, label) {
  const input = String(value ?? '').toLowerCase();
  const normalized = allowed.find((a) => a.toLowerCase() === input);
  if (!normalized) {
    throw new ValidationError(
      `\`${label}\` must be one of: ${allowed.map((a) => `\`${a}\``).join(', ')}.`,
    );
  }
  return normalized;
}

/** Validate an integer within [min, max]. Returns the number. */
function integer(value, { min = 1, max = Number.MAX_SAFE_INTEGER, label = 'value' } = {}) {
  const n = Number(value);
  if (!Number.isInteger(n) || n < min || n > max) {
    throw new ValidationError(`\`${label}\` must be a whole number between ${min} and ${max}.`);
  }
  return n;
}

/** Validate a positive number (float allowed). */
function number(value, { min = 0, max = Number.MAX_SAFE_INTEGER, label = 'value' } = {}) {
  const n = Number(value);
  if (!Number.isFinite(n) || n < min || n > max) {
    throw new ValidationError(`\`${label}\` must be a number between ${min} and ${max}.`);
  }
  return n;
}

/** Parse a duration string like "1h", "30m", "45s", "2d" into milliseconds. */
function duration(value, label = 'duration') {
  const input = String(value ?? '').trim().toLowerCase();
  const match = /^(\d+)([smhdw])$/.exec(input);
  if (!match) {
    throw new ValidationError(
      `\`${label}\` must be a duration like \`30m\`, \`2h\`, \`1d\` (s/m/h/d/w).`,
    );
  }
  const amount = Number(match[1]);
  const unit = match[2];
  const multipliers = { s: 1000, m: 60_000, h: 3_600_000, d: 86_400_000, w: 604_800_000 };
  const ms = amount * multipliers[unit];
  if (!Number.isSafeInteger(ms) || ms < 1000) {
    throw new ValidationError(`\`${label}\` must be at least 1 second.`);
  }
  return ms;
}

/** Bound a string length. */
function boundedString(value, { min = 1, max = 1024, label = 'text' } = {}) {
  const input = String(value ?? '').trim();
  if (input.length < min || input.length > max) {
    throw new ValidationError(`\`${label}\` must be between ${min} and ${max} characters.`);
  }
  return input;
}

/** Validate a BloxStrike username (alphanumeric + underscore, 3-20 chars). */
function bloxstrikeUsername(value) {
  const input = String(value ?? '').trim();
  if (!/^[A-Za-z0-9_]{3,20}$/.test(input)) {
    throw new ValidationError(
      'That does not look like a valid BloxStrike username (3-20 letters, numbers, underscores).',
    );
  }
  return input;
}

module.exports = {
  snowflake,
  guildRole,
  guildChannel,
  oneOf,
  integer,
  number,
  duration,
  boundedString,
  bloxstrikeUsername,
};
