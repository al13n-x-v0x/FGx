'use strict';

/*
 * Copyright © 2026 FGx.
 * All rights reserved.
 */

const { EmbedBuilder } = require('discord.js');
const { BRAND } = require('../config/constants');

/**
 * Clean, brand-consistent embeds.
 * Minimal emojis, crimson accents, consistent footer.
 */
function baseEmbed() {
  return new EmbedBuilder().setColor(BRAND.colors.primary).setFooter({
    text: BRAND.footer,
    iconURL: 'https://cdn.discordapp.com/embed/avatars/0.png',
  });
}

/** Standard info embed. */
function infoEmbed(title, description) {
  const embed = baseEmbed();
  if (title) embed.setTitle(title);
  if (description) embed.setDescription(description);
  return embed;
}

/** Success embed. */
function successEmbed(title, description) {
  const embed = baseEmbed().setColor(BRAND.colors.success);
  if (title) embed.setTitle(title);
  if (description) embed.setDescription(description);
  return embed;
}

/** Danger/warning embed. */
function dangerEmbed(title, description) {
  const embed = baseEmbed().setColor(BRAND.colors.danger);
  if (title) embed.setTitle(title);
  if (description) embed.setDescription(description);
  return embed;
}

/** Error embed shown to users — always safe, never exposes internals. */
function errorEmbed(message) {
  return baseEmbed()
    .setColor(BRAND.colors.danger)
    .setTitle('Something went wrong')
    .setDescription(message || 'An unexpected error occurred. Please try again later.');
}

module.exports = { baseEmbed, infoEmbed, successEmbed, dangerEmbed, errorEmbed };
