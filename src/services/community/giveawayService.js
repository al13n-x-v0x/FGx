'use strict';

/* Copyright © 2026 FGx. All rights reserved. */

const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const { BRAND } = require('../../config/constants');
const { logger } = require('../../utils/logger');

/**
 * Giveaway system.
 *
 * Active giveaways are held in memory (resets on restart — Render free tier).
 * For persistent giveaways, store in the database.
 */

/** @type {Map<string, object>} messageId → giveaway data */
const active = new Map();

/** Duration presets in milliseconds. */
const DURATIONS = {
  '30s': 30_000,
  '1m': 60_000,
  '5m': 300_000,
  '10m': 600_000,
  '30m': 1_800_000,
  '1h': 3_600_000,
  '6h': 21_600_000,
  '12h': 43_200_000,
  '1d': 86_400_000,
  '3d': 259_200_000,
  '7d': 604_800_000,
};

/**
 * Create a giveaway.
 *
 * @param {object} opts
 * @param {string} opts.prize
 * @param {string} opts.durationStr - key from DURATIONS or raw ms string
 * @param {number} opts.winners
 * @param {GuildMember} opts.host
 * @param {TextChannel} opts.channel
 * @param {string} [opts.description]
 * @returns {Promise<object>} { embed, row, endsAt }
 */
function create({ prize, durationStr, winners, host, channel, description }) {
  const durationMs = DURATIONS[durationStr] ?? parseInt(durationStr, 10);
  if (!durationMs || durationMs < 10_000) {
    throw new Error('Duration must be at least 10 seconds.');
  }
  if (winners < 1 || winners > 20) {
    throw new Error('Winner count must be 1–20.');
  }

  const endsAt = Date.now() + durationMs;

  const embed = new EmbedBuilder()
    .setColor(BRAND.colors.success)
    .setTitle(`🎉 GIVEAWAY — ${prize}`)
    .setDescription(
      (description ? `${description}\n\n` : '') +
        `**Prize:** ${prize}\n` +
        `**Winner${winners > 1 ? 's' : ''}:** ${winners}\n` +
        `**Hosted by:** <@${host.id}>\n\n` +
        `> Click the 🎉 button below to enter!\n` +
        `> Ends: <t:${Math.floor(endsAt / 1000)}:R>`,
    )
    .setFooter({ text: `${BRAND.footer} • Ends` })
    .setTimestamp(new Date(endsAt));

  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId('giveaway:enter')
      .setStyle(ButtonStyle.Success)
      .setEmoji('🎉')
      .setLabel('Enter Giveaway'),
    new ButtonBuilder()
      .setCustomId('giveaway:reroll')
      .setStyle(ButtonStyle.Secondary)
      .setEmoji('🔀')
      .setLabel('Reroll')
      .setDisabled(true),
  );

  return { embed, row, endsAt, prize, winners, hostId: host.id, channelId: channel.id, entries: new Set() };
}

/**
 * Store a giveaway in memory after sending.
 */
function store(messageId, data) {
  active.set(messageId, data);
}

/**
 * Handle the Enter button click.
 */
function handleEnter(interaction) {
  const data = active.get(interaction.message.id);
  if (!data) {
    return interaction.reply({ content: 'This giveaway has ended.', ephemeral: true });
  }
  if (Date.now() > data.endsAt) {
    return interaction.reply({ content: 'This giveaway has ended.', ephemeral: true });
  }

  if (data.entries.has(interaction.user.id)) {
    data.entries.delete(interaction.user.id);
    return interaction.reply({ content: '❌ You left the giveaway.', ephemeral: true });
  }

  data.entries.add(interaction.user.id);
  return interaction.reply({
    content: `🎉 You entered the giveaway for **${data.prize}**! Good luck!`,
    ephemeral: true,
  });
}

/**
 * End a giveaway — pick random winners and announce.
 */
async function end(messageId, client) {
  const data = active.get(messageId);
  if (!data) return null;

  active.delete(messageId);

  const channel = client.channels.cache.get(data.channelId);
  if (!channel) return null;

  const entries = [...data.entries];
  const winnerCount = Math.min(data.winners, entries.length);

  let winnerText;
  if (winnerCount === 0) {
    winnerText = 'No entries — nobody won! 😢';
  } else {
    const shuffled = entries.sort(() => Math.random() - 0.5);
    const winners = shuffled.slice(0, winnerCount);
    winnerText = winners.map((id) => `<@${id}>`).join(', ');
  }

  const embed = new EmbedBuilder()
    .setColor(BRAND.colors.warn)
    .setTitle(`🎉 GIVEAWAY ENDED — ${data.prize}`)
    .setDescription(
      `**Winner${winnerCount !== 1 ? 's' : ''}:** ${winnerText}\n\n` +
        `**Total entries:** ${entries.length}`,
    )
    .setFooter({ text: `${BRAND.footer} • Congratulations!` })
    .setTimestamp(new Date());

  // Build reroll button
  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId(`giveaway:reroll:${messageId}`)
      .setStyle(ButtonStyle.Primary)
      .setEmoji('🔀')
      .setLabel('Reroll Winner')
      .setDisabled(entries.length === 0),
  );

  // Try to edit the original message
  try {
    const msg = await channel.messages.fetch(messageId);
    await msg.edit({ embeds: [embed], components: [row] });
  } catch {
    await channel.send({ embeds: [embed], components: [row] });
  }

  if (winnerCount > 0) {
    await channel.send({
      content: `🎊 Congratulations ${winnerText}! You won **${data.prize}**!`,
    });
  }

  return { winners: winnerText, entries: entries.length };
}

/**
 * Reroll a giveaway — pick a new random winner.
 */
async function reroll(messageId, client) {
  const data = active.get(messageId);
  if (!data) {
    // Ended giveaway — we still have the data passed in via button customId
    return null;
  }

  const entries = [...data.entries];
  if (entries.length === 0) return null;

  const winner = entries[Math.floor(Math.random() * entries.length)];
  return { winnerId: winner, prize: data.prize };
}

/**
 * Auto-end giveaways whose timer has expired.
 * Called periodically from index.js.
 */
async function sweep(client) {
  const now = Date.now();
  for (const [messageId, data] of active) {
    if (now >= data.endsAt) {
      await end(messageId, client).catch((err) =>
        logger.warn('giveaway auto-end failed', { messageId, error: err.message }),
      );
    }
  }
}

module.exports = {
  DURATIONS,
  create,
  store,
  handleEnter,
  end,
  reroll,
  sweep,
  active,
};
