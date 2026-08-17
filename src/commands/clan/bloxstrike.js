'use strict';

/*
 * Copyright © 2026 FGx.
 * All rights reserved.
 */

const { SlashCommandBuilder } = require('discord.js');
const hubService = require('../../services/clan/hubService');

module.exports = {
  data: new SlashCommandBuilder().setName('bloxstrike').setDescription('Open the FGx BloxStrike command hub.'),
  async execute(interaction) {
    await interaction.reply({
      embeds: [hubService.mainEmbed()],
      components: [hubService.navRow(false)],
    });
  },
};
