'use strict';

/* Copyright © 2026 FGx. All rights reserved. */

const { SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits } = require('discord.js');
const { BRAND } = require('../../config/constants');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('snipe')
    .setDescription('Show the last deleted message in this channel')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages),

  async execute(interaction) {
    const { getSnipeCache } = require('../../events/messageLogEvents');
    const cached = getSnipeCache(interaction.channel.id);

    if (cached.length === 0) {
      return interaction.reply({
        content: '❌ No deleted messages to snipe in this channel.',
        ephemeral: true,
      });
    }

    const entry = cached[0];
    const embed = new EmbedBuilder()
      .setColor(0xED4245)
      .setTitle('🔍 Sniped Message')
      .setAuthor({
        name: entry.author.tag,
        iconURL: entry.author.avatar,
      });

    if (entry.content) {
      embed.setDescription(entry.content);
    } else {
      embed.setDescription('*No text content (embed or attachment only)*');
    }

    if (entry.attachments?.length > 0) {
      embed.addFields({
        name: '📎 Attachments',
        value: entry.attachments.map(a => `[${a.split('/').pop()}](${a})`).join('\n'),
      });
    }

    embed
      .addFields(
        { name: '📍 Channel', value: `<#${interaction.channel.id}>`, inline: true },
        { name: '⏰ Deleted', value: `<t:${Math.floor(entry.timestamp / 1000)}:R>`, inline: true },
      )
      .setFooter({ text: `${BRAND.footer} • ${cached.length} message(s) cached` })
      .setTimestamp(new Date());

    await interaction.reply({ embeds: [embed] });
  },
};
