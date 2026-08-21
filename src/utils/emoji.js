'use strict';

/* Copyright © 2026 FGx. All rights reserved. */

/**
 * Server Emoji Utilities — fetches and uses custom guild emojis.
 *
 * Usage:
 *   const { getGuildEmojis, randomEmoji, formatEmoji } = require('../utils/emoji');
 *   const emoji = randomEmoji(guild);  // picks a random custom emoji from the server
 *   formatEmoji(emoji);                // returns <:name:id> or <a:name:id>
 */

/**
 * Get all custom emojis for a guild.
 * @param {import('discord.js').Guild} guild
 * @returns {import('discord.js').Collection<string, import('discord.js').GuildEmoji>}
 */
function getGuildEmojis(guild) {
  if (!guild?.emojis?.cache) return [];
  return guild.emojis.cache;
}

/**
 * Get animated custom emojis only.
 */
function getAnimatedEmojis(guild) {
  if (!guild?.emojis?.cache) return [];
  return guild.emojis.cache.filter(e => e.animated);
}

/**
 * Get static (non-animated) custom emojis only.
 */
function getStaticEmojis(guild) {
  if (!guild?.emojis?.cache) return [];
  return guild.emojis.cache.filter(e => !e.animated);
}

/**
 * Pick a random custom emoji from the guild.
 * @param {import('discord.js').Guild} guild
 * @returns {import('discord.js').GuildEmoji|null}
 */
function randomEmoji(guild) {
  if (!guild?.emojis?.cache) return null;
  const emojis = guild.emojis.cache;
  if (emojis.size === 0) return null;
  const arr = [...emojis.values()];
  return arr[Math.floor(Math.random() * arr.length)];
}

/**
 * Pick a random emoji matching a search term (by name).
 * @param {import('discord.js').Guild} guild
 * @param {string} query - search term (partial match, case-insensitive)
 * @returns {import('discord.js').GuildEmoji|null}
 */
function findEmoji(guild, query) {
  if (!guild?.emojis?.cache) return null;
  const q = query.toLowerCase();
  const matches = guild.emojis.cache.filter(e => e.name.toLowerCase().includes(q));
  if (matches.size === 0) return null;
  const arr = [...matches.values()];
  return arr[Math.floor(Math.random() * arr.length)];
}

/**
 * Format a GuildEmoji for use in message text or embeds.
 * Returns <:name:id> for static, <a:name:id> for animated.
 * @param {import('discord.js').GuildEmoji} emoji
 * @returns {string}
 */
function formatEmoji(emoji) {
  if (!emoji) return '';
  return emoji.animated
    ? `<a:${emoji.name}:${emoji.id}>`
    : `<:${emoji.name}:${emoji.id}>`;
}

/**
 * Get a formatted random emoji string ready for embeds.
 * Returns '' if no emojis exist.
 */
function randomEmojiStr(guild) {
  const emoji = randomEmoji(guild);
  return emoji ? formatEmoji(emoji) : '';
}

/**
 * Get a list of all emoji names for autocomplete.
 * @param {import('discord.js').Guild} guild
 * @param {string} query
 * @returns {Array<{name: string, value: string}>}
 */
function emojiChoices(guild, query = '') {
  if (!guild?.emojis?.cache) return [];
  const q = query.toLowerCase();
  return guild.emojis.cache
    .filter(e => !q || e.name.toLowerCase().includes(q))
    .map(e => ({ name: `${e.animated ? '🖥️' : '🖼️'} :${e.name}:`, value: e.name }))
    .slice(0, 25);
}

/**
 * Get emoji stats for a guild.
 */
function emojiStats(guild) {
  if (!guild?.emojis?.cache) return { total: 0, animated: 0, static: 0, list: [] };
  const emojis = guild.emojis.cache;
  return {
    total: emojis.size,
    animated: emojis.filter(e => e.animated).size,
    static: emojis.filter(e => !e.animated).size,
    list: [...emojis.values()].map(e => formatEmoji(e)),
  };
}

module.exports = {
  getGuildEmojis,
  getAnimatedEmojis,
  getStaticEmojis,
  randomEmoji,
  findEmoji,
  formatEmoji,
  randomEmojiStr,
  emojiChoices,
  emojiStats,
};
