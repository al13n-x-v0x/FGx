'use strict';

/*
 * Copyright © 2026 FGx.
 * All rights reserved.
 */

const { SlashCommandBuilder } = require('discord.js');
const hubService = require('../../services/clan/hubService');

/** /fgx — the central FGx control panel (profile, clan, AI, security, …). */
module.exports = {
  data: new SlashCommandBuilder()
    .setName('fgx')
    .setDescription('Open the FGx control panel: profile, clan, rankings, AI, security and more.'),
  async execute(interaction) {
    await interaction.reply({
      embeds: [hubService.mainEmbed({ title: '⚔️ FGx — BloxStrike Clan' })],
      components: hubService.hubComponents(false),
    });
  },
};
