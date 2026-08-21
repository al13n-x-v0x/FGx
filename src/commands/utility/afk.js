'use strict';

/* Copyright © 2026 FGx. All rights reserved. */

const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { BRAND } = require('../../config/constants');
const { getGif } = require('../../utils/gifLibrary');

/** Active AFK users: userId → { reason, since, guildId } */
const afkUsers = new Map();

/** AFK reasons — shown when user goes AFK */
const AFK_MESSAGES = [
  '💤 Gone AFK — catching some Z\'s',
  '🚶 Stepped away — back soon',
  '🎮 Gone gaming — BRB',
  '📱 On a call — will return',
  '😴 Taking a nap — don\'t disturb',
  '🍕 Grabbing food — back in a bit',
  '📚 Studying — silence please',
  '🏃 Gone for a run — be right back',
  '🎭 Touching grass — see you soon',
  '⚡ Powering down — reboot in progress',
];

/** Messages shown when someone mentions an AFK user */
const MENTION_MESSAGES = [
  '{user} is AFK: {reason}',
  '{user} went AFK {time} — {reason}',
  '**{user}** is away from keyboard — {reason}',
  '💤 **{user}** is AFK since {time}: {reason}',
  '📱 **{user}** stepped away: {reason}',
];

/** Messages shown when AFK user returns */
const RETURN_MESSAGES = [
  'Welcome back, {user}! You were AFK for {duration}. 💜',
  '{user} returned after {duration} — they\'re back! 🎉',
  '🌙 **{user}** is no longer AFK (was away for {duration})',
  '⚡ **{user}** has returned from the void after {duration}!',
  '🎮 **{user}** stopped being AFK after {duration} — let\'s go!',
];

function formatDuration(ms) {
  const seconds = Math.floor(ms / 1000);
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  return `${hours}h ${mins}m`;
}

function randomFrom(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName('afk')
    .setDescription('Set your AFK status — get notified when someone mentions you')
    .addStringOption(opt =>
      opt.setName('reason').setDescription('Why are you AFK? (optional)')),

  async execute(interaction) {
    const reason = interaction.options.getString('reason') || randomFrom(AFK_MESSAGES);
    const member = interaction.member;

    afkUsers.set(interaction.user.id, {
      reason,
      since: Date.now(),
      guildId: interaction.guildId,
      displayName: member.displayName || interaction.user.username,
    });

    const gifUrl = await getGif('sleep');

    const embed = new EmbedBuilder()
      .setColor(BRAND.colors.warn)
      .setTitle('🌙 AFK Status Set')
      .setDescription(
        `**${interaction.user.username}** is now AFK.\n\n` +
        `**Reason:** ${reason}\n` +
        `**Since:** <t:${Math.floor(Date.now() / 1000)}:R>`
      )
      .setFooter({ text: `${BRAND.footer} • I'll notify anyone who mentions you` })
      .setTimestamp(new Date());

    if (gifUrl) embed.setImage(gifUrl);
    embed.setThumbnail(interaction.user.displayAvatarURL({ size: 256 }));

    await interaction.reply({ embeds: [embed] });
  },

  /**
   * Check if a user is AFK when they send a message.
   * Returns { wasAfk, message, gif } if they just returned, null otherwise.
   */
  async checkReturn(userId, guildId) {
    const afk = afkUsers.get(userId);
    if (!afk || afk.guildId !== guildId) return null;

    afkUsers.delete(userId);
    const duration = formatDuration(Date.now() - afk.since);
    const msg = randomFrom(RETURN_MESSAGES)
      .replaceAll('{user}', `<@${userId}>`)
      .replaceAll('{duration}', duration);

    const gifUrl = await getGif('wave');
    return { message: msg, gif: gifUrl, duration, afkSince: afk.since };
  },

  /**
   * Get AFK info for a mentioned user.
   */
  getAfkInfo(userId) {
    return afkUsers.get(userId) || null;
  },

  /**
   * Format an AFK mention message with optional GIF.
   */
  async formatMention(targetUserId) {
    const afk = afkUsers.get(targetUserId);
    if (!afk) return null;

    const time = formatDuration(Date.now() - afk.since);
    const msg = randomFrom(MENTION_MESSAGES)
      .replaceAll('{user}', `<@${targetUserId}>`)
      .replaceAll('{reason}', afk.reason)
      .replaceAll('{time}', time);

    const gifUrl = await getGif('sleep');
    return { message: msg, gif: gifUrl };
  },

  /** Expose the map for router use. */
  afkUsers,
};
