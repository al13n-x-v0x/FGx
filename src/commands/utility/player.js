'use strict';

/*
 * Copyright © 2026 FGx.
 * All rights reserved.
 */

const { SlashCommandBuilder } = require('discord.js');
const { profilesRepo, linksRepo } = require('../../database/repos/profiles');
const { profileEmbed } = require('./profile');

/** Alias of /profile for BloxStrike players. */
module.exports = {
  data: new SlashCommandBuilder()
    .setName('player')
    .setDescription('View an FGx player profile (alias of /profile).')
    .addUserOption((o) => o.setName('user').setDescription('Member (default: you)')),
  async execute(interaction) {
    const target = interaction.options.getUser('user') ?? interaction.user;
    const profile = profilesRepo.ensure(interaction.guild.id, target.id);
    const link = linksRepo.get(interaction.guild.id, target.id);
    await interaction.reply({ embeds: [profileEmbed(interaction.guild, target, profile, link)] });
  },
};
