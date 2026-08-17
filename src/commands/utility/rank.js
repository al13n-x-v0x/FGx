'use strict';

/*
 * Copyright © 2026 FGx.
 * All rights reserved.
 */

const { SlashCommandBuilder } = require('discord.js');
const { guildConfigRepo } = require('../../database/repos/guildConfig');
const { xpRepo } = require('../../database/repos/profiles');
const { levelEmbed } = require('./level');

/** Alias of /level. */
module.exports = {
  data: new SlashCommandBuilder()
    .setName('rank')
    .setDescription('Check your FGx community level (alias of /level).')
    .addUserOption((o) => o.setName('user').setDescription('Member (default: you)')),
  async execute(interaction) {
    const config = guildConfigRepo.get(interaction.guild.id);
    if (!config.xp.enabled) {
      return interaction.reply({ content: 'XP is disabled in this server.', ephemeral: true });
    }
    const target = interaction.options.getUser('user') ?? interaction.user;
    const row = xpRepo.get(interaction.guild.id, target.id);
    await interaction.reply({ embeds: [levelEmbed(interaction.guild, target, row)] });
  },
};
