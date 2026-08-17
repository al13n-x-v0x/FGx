'use strict';

/*
 * Copyright © 2026 FGx.
 * All rights reserved.
 */

const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { BRAND } = require('../../config/constants');
const { guildConfigRepo } = require('../../database/repos/guildConfig');
const { xpRepo } = require('../../database/repos/profiles');
const { xpForNextLevel, xpToReachLevel } = require('../../services/community/xpService');
const { progressBar } = require('../../utils/format');

function levelEmbed(guild, target, row) {
  const xp = row?.xp ?? 0;
  const level = row?.level ?? 0;
  const currentFloor = xpToReachLevel(level);
  const nextFloor = xpToReachLevel(level + 1);
  const into = xp - currentFloor;
  const span = nextFloor - currentFloor;

  return new EmbedBuilder()
    .setColor(BRAND.colors.primary)
    .setAuthor({ name: target.username, iconURL: target.displayAvatarURL?.() ?? undefined })
    .setTitle(`Level ${level}`)
    .setDescription(
      `${progressBar(into, span)}\n\n` +
        `**XP:** ${xp} (${into}/${span} to level ${level + 1})\n` +
        `**Next level:** ${xpForNextLevel(level)} XP`,
    )
    .setFooter({ text: BRAND.footer });
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName('level')
    .setDescription('Check your FGx community level and XP.')
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
  levelEmbed,
};
