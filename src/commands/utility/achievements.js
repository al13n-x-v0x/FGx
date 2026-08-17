'use strict';

/*
 * Copyright © 2026 FGx.
 * All rights reserved.
 */

const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { BRAND } = require('../../config/constants');
const achievementsService = require('../../services/clan/achievementsService');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('achievements')
    .setDescription('View FGx achievements.')
    .addUserOption((o) => o.setName('user').setDescription('Member (default: you)')),
  async execute(interaction) {
    const target = interaction.options.getUser('user') ?? interaction.user;
    const catalog = achievementsService.catalogFor(interaction.guild.id, target.id);
    const unlocked = catalog.filter((a) => a.unlocked);
    const locked = catalog.filter((a) => !a.unlocked);

    const embed = new EmbedBuilder()
      .setColor(BRAND.colors.primary)
      .setTitle(`Achievements — ${target.username}`)
      .setDescription(
        unlocked.length > 0
          ? unlocked.map((a) => `${a.icon} **${a.name}** — ${a.description}`).join('\n')
          : 'No achievements yet. Recorded competitive results unlock them.',
      )
      .setFooter({ text: `${BRAND.footer} • ${unlocked.length}/${catalog.length} unlocked` });

    if (locked.length > 0) {
      embed.addFields({ name: 'Locked', value: locked.map((a) => `${a.icon} ${a.name}`).join(' • ') });
    }

    await interaction.reply({ embeds: [embed] });
  },
};
