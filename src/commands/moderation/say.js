'use strict';

/* Copyright © 2026 FGx. All rights reserved. */

const { SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits } = require('discord.js');
const { BRAND } = require('../../config/constants');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('say')
    .setDescription('Make the bot send a message or embed in a channel.')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages)
    .addStringOption((o) =>
      o.setName('message').setDescription('What the bot should say').setRequired(true),
    )
    .addChannelOption((o) =>
      o.setName('channel').setDescription('Channel to send to (default: current)'),
    )
    .addBooleanOption((o) =>
      o.setName('embed').setDescription('Send as an embed? (default: plain text)'),
    )
    .addStringOption((o) =>
      o.setName('color').setDescription('Embed color hex (e.g. dc143c)'),
    ),

  async execute(interaction) {
    const message = interaction.options.getString('message');
    const channel = interaction.options.getChannel('channel') ?? interaction.channel;
    const useEmbed = interaction.options.getBoolean('embed') ?? false;
    const colorHex = interaction.options.getString('color');

    if (!channel.isTextBased()) {
      return interaction.reply({ content: '❌ That\'s not a text channel.', ephemeral: true });
    }

    if (useEmbed) {
      const color = colorHex ? parseInt(colorHex.replace('#', ''), 16) : BRAND.colors.primary;
      const embed = new EmbedBuilder()
        .setColor(Number.isFinite(color) ? color : BRAND.colors.primary)
        .setDescription(message)
        .setFooter({ text: `Sent by ${interaction.user.tag} • ${BRAND.footer}` })
        .setTimestamp(new Date());

      await channel.send({ embeds: [embed] });
    } else {
      await channel.send({ content: message });
    }

    await interaction.reply({
      content: `✅ Sent to ${channel}`,
      ephemeral: true,
    });
  },
};
