'use strict';

/*
 * Copyright © 2026 FGx.
 * All rights reserved.
 */

const { EmbedBuilder } = require('discord.js');
const { BRAND } = require('../../config/constants');
const { formatDate } = require('../../utils/format');

/**
 * Clean, professional competitive announcements.
 * Rendered from database rows — never fabricated.
 */

function scrimEmbed(scrim) {
  const players = safeParse(scrim.players, []);
  const embed = new EmbedBuilder()
    .setColor(BRAND.colors.primary)
    .setTitle('⚔️ FGx SCRIM ALERT')
    .setDescription(
      `**FGx vs ${scrim.opponent}**\n\n` +
        `━━━━━━━━━━━━━━━━\n\n` +
        `**FORMAT**\n${scrim.format}\n\n` +
        `**STATUS**\n${scrim.status}\n\n` +
        (scrim.scheduled_at ? `**TIME**\n${formatDate(new Date(scrim.scheduled_at))}\n\n` : '') +
        (scrim.mode ? `**MODE**\n${scrim.mode}\n\n` : '') +
        `**ROSTER (${players.length})**\n${players.map((p) => `<@${p}>`).join(' ') || '—'}\n\n` +
        'Represent FGx.',
    )
    .setFooter({ text: BRAND.footer });
  return embed;
}

function eventEmbed(event) {
  const participants = safeParse(event.participants, []);
  const capacity = event.capacity ? ` (${participants.length}/${event.capacity})` : '';
  const embed = new EmbedBuilder()
    .setColor(BRAND.colors.primary)
    .setTitle(`📅 ${event.title}`)
    .setDescription(
      `**Type:** ${event.type}\n` +
        (event.starts_at ? `**Starts:** ${formatDate(new Date(event.starts_at))}\n` : '') +
        (event.description ? `\n${event.description}\n` : '') +
        `\n**Status:** ${event.status}\n` +
        `**Participants${capacity}:**\n${participants.map((p) => `<@${p}>`).join(' ') || '—'}`,
    )
    .setFooter({ text: BRAND.footer });
  return embed;
}

function trainingEmbed(session) {
  const participants = safeParse(session.participants, []);
  const embed = new EmbedBuilder()
    .setColor(BRAND.colors.primary)
    .setTitle(`🎯 Training: ${session.title}`)
    .setDescription(
      `**Category:** ${session.category}\n` +
        (session.scheduled_at ? `**Time:** ${formatDate(new Date(session.scheduled_at))}\n` : '') +
        (session.trainer_id ? `**Trainer:** <@${session.trainer_id}>\n` : '') +
        `\n**Status:** ${session.status}\n` +
        `**Signed up (${participants.length}):**\n${participants.map((p) => `<@${p}>`).join(' ') || '—'}`,
    )
    .setFooter({ text: BRAND.footer });
  return embed;
}

function matchAlertEmbed(scrim) {
  const embed = new EmbedBuilder()
    .setColor(BRAND.colors.danger)
    .setTitle('⚔️ FGx MATCH ALERT')
    .setDescription(
      `**FGx vs ${scrim.opponent}**\n\n` +
        `━━━━━━━━━━━━━━━━\n\n` +
        `**FORMAT**\n${scrim.format}\n\n` +
        `**STATUS**\n${scrim.status}\n\n` +
        (scrim.scheduled_at ? `**TIME**\n${formatDate(new Date(scrim.scheduled_at))}\n\n` : '') +
        `Good luck to the roster.\nRepresent FGx.`,
    )
    .setFooter({ text: BRAND.footer });
  return embed;
}

function safeParse(value, fallback) {
  try {
    return JSON.parse(value);
  } catch {
    return fallback;
  }
}

module.exports = { scrimEmbed, eventEmbed, trainingEmbed, matchAlertEmbed };
