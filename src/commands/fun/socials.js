'use strict';

/* Copyright © 2026 FGx. All rights reserved. */

const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { BRAND } = require('../../config/constants');
const { getGif, getGifsRandom } = require('../../utils/gifLibrary');
const { ACTIONS } = require('../../data/actions');

/**
 * Factory — generates individual slash commands for each action type.
 * Each command is a separate entry in the commands array so Discord
 * shows them as standalone `/slap`, `/hug`, etc.
 */

function buildCommand(actionName) {
  const action = ACTIONS[actionName];
  if (!action) return null;

  return {
    data: new SlashCommandBuilder()
      .setName(actionName)
      .setDescription(`${action.emoji} ${action.label.toLowerCase()} someone!`)
      .addUserOption((opt) =>
        opt
          .setName('target')
          .setDescription(`Who to ${actionName}`)
          .setRequired(false),
      ),

    async execute(interaction) {
      const target = interaction.options.getUser('target') ?? interaction.user;
      const self = target.id === interaction.user.id;

      const line = action.lines[Math.floor(Math.random() * action.lines.length)]
        .replaceAll('{actor}', interaction.user.username)
        .replaceAll('{target}', self ? 'themselves' : target.username);

      // Fetch 3 GIFs and pick a random one for variety
      const gifs = await getGifsRandom(action.gifKey, 3);
      const gif = gifs[0] || null;

      const embed = new EmbedBuilder()
        .setColor(action.color)
        .setTitle(`${action.emoji} ${action.label}!`)
        .setDescription(`> ${line}`)
        .addFields(
          { name: '👤 From', value: `${interaction.user}`, inline: true },
          { name: '🎯 To', value: self ? 'Themselves 💀' : `${target}`, inline: true },
        )
        .setFooter({
          text: `${BRAND.footer} • ${action.emoji} ${action.label}`,
        })
        .setTimestamp(new Date());

      if (target.displayAvatarURL) {
        embed.setThumbnail(target.displayAvatarURL({ size: 256 }));
      }

      if (gif) embed.setImage(gif);

      await interaction.reply({ embeds: [embed] });
    },
  };
}

// Build all commands
const commands = Object.keys(ACTIONS)
  .map(buildCommand)
  .filter(Boolean);

module.exports = commands;
