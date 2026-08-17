'use strict';

/*
 * Copyright © 2026 FGx.
 * All rights reserved.
 */

const { SlashCommandBuilder } = require('discord.js');
const { BRAND } = require('../../config/constants');

module.exports = {
  data: new SlashCommandBuilder().setName('ping').setDescription('Check bot latency.'),
  async execute(interaction) {
    const sent = await interaction.reply({
      embeds: [
        {
          color: BRAND.colors.neutral,
          title: 'Pinging…',
          description: 'Measuring roundtrip latency…',
        },
      ],
      fetchReply: true,
    });
    const roundtrip = sent.createdTimestamp - interaction.createdTimestamp;
    await interaction.editReply({
      embeds: [
        {
          color: BRAND.colors.success,
          title: 'Pong 🏓',
          description: `**Roundtrip:** ${roundtrip}ms\n**Gateway:** ${interaction.client.ws.ping}ms`,
          footer: { text: BRAND.footer },
        },
      ],
    });
  },
};
