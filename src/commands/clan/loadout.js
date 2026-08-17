'use strict';

/*
 * Copyright © 2026 FGx.
 * All rights reserved.
 */

const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { BRAND } = require('../../config/constants');
const { ROLES, BUY_SITUATIONS } = require('../../data/bloxstrike');

/** Instant, data-driven loadout guide — no AI needed. */
module.exports = {
  data: new SlashCommandBuilder()
    .setName('loadout')
    .setDescription('BloxStrike loadout guide: buy situations, roles, and economy (FGx knowledge base).'),
  async execute(interaction) {
    const embed = new EmbedBuilder()
      .setColor(BRAND.colors.primary)
      .setTitle('🎒 BloxStrike Loadout Guide')
      .setDescription(
        'FGx-curated strategy for BloxStrike (5v5 round-based shooter). Weapon advice is by class ' +
          'and role so it stays useful across balance patches. Ask `/bloxai` for tailored picks.',
      )
      .addFields(
        {
          name: '💸 Buy situations',
          value: BUY_SITUATIONS.map((b) => `**${b.situation}** — ${b.plan}`).join('\n'),
        },
        {
          name: '🎭 Roles',
          value: ROLES.map((r) => `**${r.role}** — ${r.loadout}`).join('\n'),
        },
      )
      .setFooter({ text: `${BRAND.footer} • FGx knowledge base` });
    await interaction.reply({ embeds: [embed] });
  },
};
