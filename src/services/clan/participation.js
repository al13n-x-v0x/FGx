'use strict';

/*
 * Copyright © 2026 FGx.
 * All rights reserved.
 */

const announcements = require('./announcements');
const { NotFoundError } = require('../../utils/errors');

/**
 * Shared join/leave logic for scrims, events and training sessions.
 * Updates the database and refreshes the announcement message in place.
 */

const RENDERERS = {
  scrims: announcements.scrimEmbed,
  events: announcements.eventEmbed,
  training: announcements.trainingEmbed,
};

async function toggle(client, interaction, repo, kind, rowId, { join }) {
  const row = repo.get(rowId);
  if (!row || String(row.guild_id) !== String(interaction.guild.id)) {
    throw new NotFoundError('That listing no longer exists.');
  }
  const participants = repo.participants(rowId);
  const userId = interaction.user.id;
  const isIn = participants.includes(userId);

  if (join && isIn) return { changed: false, reason: 'already-joined', participants };
  if (!join && !isIn) return { changed: false, reason: 'not-joined', participants };
  if (join && row.capacity && participants.length >= row.capacity) {
    return { changed: false, reason: 'full', participants };
  }

  const next = join ? [...participants, userId] : participants.filter((p) => p !== userId);
  repo.update(rowId, { participants: JSON.stringify(next) });

  const fresh = repo.get(rowId);
  const embed = RENDERERS[kind](fresh);
  if (row.channel_id && row.message_id) {
    const channel = interaction.guild.channels.cache.get(row.channel_id);
    const message =
      channel &&
      (channel.messages.cache.get(row.message_id) ?? (await channel.messages.fetch(row.message_id).catch(() => null)));
    if (message) await message.edit({ embeds: [embed] }).catch(() => {});
  }

  return { changed: true, reason: join ? 'joined' : 'left', participants: next };
}

module.exports = { toggle };
