'use strict';

/* Copyright © 2026 FGx. All rights reserved. */

const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const { BRAND } = require('../../config/constants');

/**
 * /nitro-profile — Shows a Nitro-style bot profile card.
 * Like Cat Bot's profile with animated status, verified badge, server count.
 */
module.exports = {
  data: new SlashCommandBuilder()
    .setName('nitro-profile')
    .setDescription('Show the bot\'s Nitro-style profile card ✨'),

  async execute(interaction) {
    const client = interaction.client;
    const user = client.user;
    const guilds = client.guilds.cache.size;
    const uptime = formatUptime(client.uptime);

    // Count total members across all guilds
    const totalMembers = client.guilds.cache.reduce((acc, g) => acc + g.memberCount, 0);

    // Build the Nitro-style profile embed
    const embed = new EmbedBuilder()
      .setColor(0xF47FFF)
      .setTitle(`✨ ${user.username}`)
      .setDescription(
        `**${user.username}** <a:nitro:1234567890> **APP**\n` +
        `${user.tag} <a:boost:1234567891>\n\n` +
        `**Servers:** ${guilds.toLocaleString()}\n` +
        `**Users:** ${totalMembers.toLocaleString()}\n` +
        `**Uptime:** ${uptime}\n` +
        `**Commands:** 86+\n\n` +
        `*Bot made by <@${interaction.guild?.ownerId ?? '0'}> for FGx Clan*\n\n` +
        `> 🚀 **Nitro Boosted** • <a:verified:1234567892> **Verified Bot**`
      )
      .setThumbnail(user.displayAvatarURL({ size: 256, dynamic: true }))
      .setFooter({ text: `${BRAND.footer} • Nitro Profile` })
      .setTimestamp(new Date());

    // Try to add server banner
    if (interaction.guild?.bannerURL()) {
      embed.setImage(interaction.guild.bannerURL({ size: 512 }));
    }

    // Add the bot's animated avatar if available
    const avatarURL = user.displayAvatarURL({ size: 512, dynamic: true });
    if (avatarURL.includes('a_')) {
      embed.addFields({
        name: '🎬 Animated Avatar',
        value: `[View Animation](${avatarURL})`,
        inline: true,
      });
    }

    // Action buttons
    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setLabel('🤖 Bot Website')
        .setURL('https://github.com/al13n-x-v0x/FGx')
        .setStyle(ButtonStyle.Link),
      new ButtonBuilder()
        .setCustomId('nitro:boost')
        .setLabel('🚀 Boost Server')
        .setStyle(ButtonStyle.Primary),
      new ButtonBuilder()
        .setCustomId('nitro:status')
        .setLabel('✨ Nitro Status')
        .setStyle(ButtonStyle.Secondary),
    );

    await interaction.reply({ embeds: [embed], components: [row] });
  },
};

/** Format uptime as a readable string. */
function formatUptime(ms) {
  const seconds = Math.floor(ms / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  if (days > 0) return `${days}d ${hours % 24}h ${minutes % 60}m`;
  if (hours > 0) return `${hours}h ${minutes % 60}m`;
  return `${minutes}m ${seconds % 60}s`;
}
