'use strict';

/* Copyright © 2026 FGx. All rights reserved. */

const { EmbedBuilder, SlashCommandBuilder } = require('discord.js');
const { BRAND } = require('../../config/constants');
const { guildConfigRepo } = require('../../database/repos/guildConfig');
const privateServerService = require('../../services/clan/privateServerService');

/**
 * Instant duel commands: /1v1, /2v2, /5v5, /2v1, etc.
 *
 * Type the command → bot creates the server → drops the invite in chat.
 * No menus, no confirmations, no ephemeral. Just instant.
 */

const SHORTCUT_MODES = [
  // Symmetric
  { mode: '1v1', name: '1v1', desc: '⚡ Create a 1v1 server — drops invite in chat' },
  { mode: '2v2', name: '2v2', desc: '⚡ Create a 2v2 server — drops invite in chat' },
  { mode: '3v3', name: '3v3', desc: '⚡ Create a 3v3 server — drops invite in chat' },
  { mode: '4v4', name: '4v4', desc: '⚡ Create a 4v4 server — drops invite in chat' },
  { mode: '5v5', name: '5v5', desc: '⚡ Create a 5v5 server — drops invite in chat' },
  { mode: '6v6', name: '6v6', desc: '⚡ Create a 6v6 server — drops invite in chat' },
  // Asymmetric
  { mode: '2v1', name: '2v1', desc: '⚡ Create a 2v1 server — drops invite in chat' },
  { mode: '3v1', name: '3v1', desc: '⚡ Create a 3v1 server — drops invite in chat' },
  { mode: '3v2', name: '3v2', desc: '⚡ Create a 3v2 server — drops invite in chat' },
  { mode: '4v2', name: '4v2', desc: '⚡ Create a 4v2 server — drops invite in chat' },
  { mode: '4v3', name: '4v3', desc: '⚡ Create a 4v3 server — drops invite in chat' },
  { mode: '5v3', name: '5v3', desc: '⚡ Create a 5v3 server — drops invite in chat' },
  { mode: '5v4', name: '5v4', desc: '⚡ Create a 5v4 server — drops invite in chat' },
  { mode: '6v4', name: '6v4', desc: '⚡ Create a 6v4 server — drops invite in chat' },
  { mode: '6v5', name: '6v5', desc: '⚡ Create a 6v5 server — drops invite in chat' },
];

function buildShortcut({ mode, name, desc }) {
  return {
    data: new SlashCommandBuilder()
      .setName(name)
      .setDescription(desc)
      .addIntegerOption((o) =>
        o
          .setName('hours')
          .setDescription('Hours before auto-delete (1–24, default 3)')
          .setMinValue(1)
          .setMaxValue(24),
      ),
    async execute(interaction) {
      const config = guildConfigRepo.get(interaction.guild.id);
      const hours = interaction.options.getInteger('hours') ?? privateServerService.DEFAULT_HOURS;

      // Defer PUBLICLY so everyone sees the "Creating..." status.
      await interaction.deferReply();

      try {
        const { server, invite, info } = await privateServerService.create(
          interaction.client,
          interaction.guild,
          interaction.user,
          mode,
          hours,
          { member: interaction.member, config },
        );

        const embed = new EmbedBuilder()
          .setColor(BRAND.colors.success)
          .setTitle(`⚔️ ${mode.toUpperCase()} SERVER READY`)
          .setDescription(
            `<@${interaction.user.id}> created a **${mode}** server!\n\n` +
            `🔗 **Click to join:** https://discord.gg/${invite.code}\n\n` +
            `📍 **Channels:** match-chat, results, Main, Team 1${info.teams > 1 ? ', Team 2' : ''}\n` +
            `⏰ **Expires in:** ${hours}h (auto-deletes)\n\n` +
            `*Share the link with your opponent — game on!*`,
          )
          .setFooter({ text: `${BRAND.footer} • Roblox-verified players only` })
          .setTimestamp();

        return interaction.editReply({ embeds: [embed] });
      } catch (err) {
        const errorEmbed = new EmbedBuilder()
          .setColor(BRAND.colors.danger)
          .setTitle('❌ Server not created');

        if (err.code === 'GUILD_LIMIT') {
          errorEmbed.setDescription('Too many active servers. End one first with `/private end`.');
        } else if (err.code === 'OWNER_LIMIT') {
          errorEmbed.setDescription('You already have an active server. End it first with `/private end`.');
        } else if (err.code === 'ROBLOX_REQUIRED') {
          errorEmbed.setDescription('You need to verify your Roblox account first.\nRun `/roblox verify` — it takes under a minute.');
        } else {
          errorEmbed.setDescription(`Error: ${err.message}`);
        }

        errorEmbed.setFooter({ text: BRAND.footer });
        return interaction.editReply({ embeds: [errorEmbed] });
      }
    },
  };
}

module.exports = SHORTCUT_MODES.map(buildShortcut);
