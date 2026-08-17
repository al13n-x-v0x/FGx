'use strict';

/*
 * Copyright © 2026 FGx.
 * All rights reserved.
 */

const { SlashCommandBuilder } = require('discord.js');

module.exports = {
  data: new SlashCommandBuilder().setName('ping').setDescription('Check bot latency.'),
  async execute(interaction) {
    const sent = await interaction.reply({ content: 'Pinging…', fetchReply: true });
    const roundtrip = sent.createdTimestamp - interaction.createdTimestamp;
    await interaction.editReply({
      content: `Pong. **${roundtrip}ms** roundtrip • **${interaction.client.ws.ping}ms** gateway.`,
    });
  },
};
