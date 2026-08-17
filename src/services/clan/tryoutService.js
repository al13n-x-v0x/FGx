'use strict';

/*
 * Copyright © 2026 FGx.
 * All rights reserved.
 */

const { tryoutsRepo } = require('../../database/repos/community');
const { logAudit } = require('../logging/auditLogger');
const { ValidationError } = require('../../utils/errors');

/**
 * Tryout workflow:
 * Application (modal, private) → staff review → Trial → Evaluation → Accepted/Rejected.
 * Every decision is logged. Personal info never shown publicly.
 */

/** Required application fields collected in the modal. */
const REQUIRED_FIELDS = [
  'bloxstrike_username',
  'discord_username',
  'age_range',
  'region',
  'previous_clan',
  'main_mode',
  'experience',
  'strengths',
  'availability',
];

function validateApplication(data) {
  const missing = REQUIRED_FIELDS.filter((f) => !data[f] || !String(data[f]).trim());
  if (missing.length > 0) {
    throw new ValidationError(`Missing required fields: ${missing.join(', ')}.`);
  }
}

async function submit(client, guild, userId, data) {
  validateApplication(data);
  // One pending application per user at a time.
  const existing = tryoutsRepo.list(guild.id).find(
    (t) => String(t.user_id) === String(userId) && ['pending', 'info_requested'].includes(t.status),
  );
  if (existing) {
    throw new ValidationError('You already have an application under review. Wait for staff to respond.');
  }
  const tryout = tryoutsRepo.create(guild.id, userId, data);
  await logAudit(client, guild, {
    action: 'tryout',
    target: { id: userId, username: data.discord_username || userId },
    moderator: null,
    reason: 'New tryout application',
    details: { id: tryout.id, bloxstrike: data.bloxstrike_username, mode: data.main_mode },
  });
  return tryout;
}

async function decide(client, guild, staff, tryoutId, status, { notes } = {}) {
  const tryout = tryoutsRepo.get(tryoutId);
  if (!tryout) throw new ValidationError(`No application with ID \`${tryoutId}\`.`);
  const next = tryoutsRepo.decide(tryoutId, status, staff.id, { notes });
  await logAudit(client, guild, {
    action: 'tryout',
    target: { id: tryout.user_id, username: tryout.user_id },
    moderator: staff,
    reason: `Application #${tryoutId} → ${status.toUpperCase()}`,
    details: { notes: notes ?? '' },
  });
  return next;
}

module.exports = { submit, decide, validateApplication, REQUIRED_FIELDS };
