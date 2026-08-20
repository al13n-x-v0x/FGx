'use strict';

/* Copyright © 2026 FGx. All rights reserved. */

const { SlashCommandBuilder } = require('discord.js');
const { BRAND } = require('../../config/constants');
const { guildConfigRepo } = require('../../database/repos/guildConfig');
const privateServerService = require('../../services/clan/privateServerService');

/**
 * Shortcut commands for creating private servers directly.
 * Each command is a separate module exported as an array.
 *
 * Usage: /1v1, /2v2, /5v5, /2v1, /3v2, etc.
 * Creates a private server instantly without the menu flow.
 */

const SHORTCUT_MODES = [
  // Symmetric
  { mode: '1v1', name: '1v1', desc: 'Create a 1v1 private server instantly' },
  { mode: '2v2', name: '2v2', desc: 'Create a 2v2 private server instantly' },
  { mode: '3v3', name: '3v3', desc: 'Create a 3v3 private server instantly' },
  { mode: '4v4', name: '4v4', desc: 'Create a 4v4 private server instantly' },
  { mode: '5v5', name: '5v5', desc: 'Create a 5v5 private server instantly' },
  { mode: '6v6', name: '6v6', desc: 'Create a 6v6 private server instantly' },
  // Asymmetric
  { mode: '2v1', name: '2v1', desc: 'Create a 2v1 private server instantly' },
  { mode: '3v1', name: '3v1', desc: 'Create a 3v1 private server instantly' },
  { mode: '3v2', name: '3v2', desc: 'Create a 3v2 private server instantly' },
  { mode: '4v2', name: '4v2', desc: 'Create a 4v2 private server instantly' },
  { mode: '4v3', name: '4v3', desc: 'Create a 4v3 private server instantly' },
  { mode: '5v3', name: '5v3', desc: 'Create a 5v3 private server instantly' },
  { mode: '5v4', name: '5v4', desc: 'Create a 5v4 private server instantly' },
  { mode: '6v4', name: '6v4', desc: 'Create a 6v4 private server instantly' },
  { mode: '6v5', name: '6v5', desc: 'Create a 6v5 private server instantly' },
];

/**
 * Build a shortcut command module for a given mode.
 */
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

      await interaction.deferReply({ ephemeral: true });
      try {
        const { server, invite, info } = await privateServerService.create(
          interaction.client,
          interaction.guild,
          interaction.user,
          mode,
          hours,
          { member: interaction.member, config },
        );

        const totalPlayers = info.teams === 2 ? ` (${mode})` : '';
        const embed = {
          color: BRAND.colors.success,
          title: `🎮 FGx ${info.label} server ready${totalPlayers}`,
          description:
            `**${server.name}** is live for **${hours}h**.\n\n` +
            `**Invite:** https://discord.gg/${invite.code}\n` +
            `**Channels:** match-chat, results, Main, Team 1${info.teams > 1 ? ', Team 2' : ''}\n\n` +
            'Share the invite with your opponents. The server **auto-deletes** when the timer expires.',
          footer: { text: `${BRAND.footer} • Roblox-verified members only` },
        };
        return interaction.editReply({ embeds: [embed] });
      } catch (err) {
        if (['INVALID_MODE', 'GUILD_LIMIT', 'OWNER_LIMIT', 'ROBLOX_REQUIRED'].includes(err.code)) {
          return interaction.editReply({
            embeds: [{ color: BRAND.colors.warn, title: 'Server not created', description: err.message, footer: { text: BRAND.footer } }],
          });
        }
        return interaction.editReply({
          embeds: [{ color: BRAND.colors.danger, title: 'Creation failed', description: `Discord API error: ${err.message}`, footer: { text: BRAND.footer } }],
        });
      }
    },
  };
}

/** Export all shortcut commands as an array. */
module.exports = SHORTCUT_MODES.map(buildShortcut);
