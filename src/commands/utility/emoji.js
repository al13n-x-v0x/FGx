'use strict';

/* Copyright © 2026 FGx. All rights reserved. */

const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, StringSelectMenuBuilder } = require('discord.js');
const { BRAND } = require('../../config/constants');
const { getGuildEmojis, formatEmoji, emojiStats } = require('../../utils/emoji');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('emoji')
    .setDescription('Browse and use server custom emojis')
    .addStringOption(opt =>
      opt.setName('search').setDescription('Search emoji by name').setRequired(false)),

  async execute(interaction) {
    const guild = interaction.guild;
    if (!guild) {
      return interaction.reply({ content: '❌ This command can only be used in a server.', ephemeral: true });
    }

    const search = interaction.options.getString('search');
    let emojis = [...guild.emojis.cache.values()];

    if (search) {
      const q = search.toLowerCase();
      emojis = emojis.filter(e => e.name.toLowerCase().includes(q));
    }

    if (emojis.length === 0) {
      return interaction.reply({
        content: search
          ? `❌ No emojis found matching "${search}".`
          : '❌ This server has no custom emojis.',
        ephemeral: true,
      });
    }

    const stats = emojiStats(guild);
    const pageSize = 20;
    const page = emojis.slice(0, pageSize);

    const emojiList = page.map(e => {
      const formatted = formatEmoji(e);
      const animated = e.animated ? ' 🎬' : '';
      return `${formatted} \`:${e.name}:\` ${animated}`;
    }).join('\n');

    const embed = new EmbedBuilder()
      .setColor(BRAND.colors.primary)
      .setTitle(`🏷️ Server Emojis ${search ? `— "${search}"` : ''}`)
      .setDescription(emojiList)
      .setFooter({
        text: `${BRAND.footer} • ${emojis.length} emoji${emojis.length !== 1 ? 's' : ''} found • ${stats.animated} animated, ${stats.static} static`,
      })
      .setTimestamp(new Date());

    // If there are more emojis, add a select menu
    if (emojis.length > pageSize) {
      const options = page.slice(0, 25).map(e => ({
        label: `:${e.name}:`,
        value: formatEmoji(e),
        description: e.animated ? 'Animated' : 'Static',
        emoji: e,
      }));

      const row = new ActionRowBuilder().addComponents(
        new StringSelectMenuBuilder()
          .setCustomId('emoji:pick')
          .setPlaceholder('Pick an emoji to copy its code')
          .addOptions(options),
      );

      return interaction.reply({ embeds: [embed], components: [row] });
    }

    await interaction.reply({ embeds: [embed] });
  },
};
