'use strict';

/*
 * Copyright © 2026 FGx.
 * All rights reserved.
 */

const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { BRAND } = require('../../config/constants');

const GROUPS = [
  { name: 'Moderation', icon: '🛡️', commands: ['/warn', '/warnings', '/timeout', '/kick', '/ban', '/unban', '/purge', '/slowmode', '/lock', '/unlock', '/nick', '/role'] },
  { name: 'Security', icon: '🔐', commands: ['/security', '/automod'] },
  { name: 'Community', icon: '👥', commands: ['/profile', '/link', '/roblox', '/level', '/leaderboard', '/achievements', '/verify', '/ticket'] },
  { name: 'BloxStrike', icon: '⚔️', commands: ['/fgx', '/bloxstrike', '/loadout', '/roster', '/tryout', '/evaluate', '/scrim', '/match', '/event', '/clanwar', '/training', '/analysis', '/bloxai'] },
  { name: 'Roblox', icon: '🟥', commands: ['/roblox verify', '/roblox status', '/roblox unlink', '/roblox panel'] },
  { name: 'AI Assistant', icon: '🤖', commands: ['/ask', '/ai', '/bloxai'] },
  { name: 'Admin', icon: '⚙️', commands: ['/setup', '/config', '/status', '/help'] },
  { name: 'BloxStrike Tools', icon: '🔀', commands: ['/shuffle'] },
];

module.exports = {
  data: new SlashCommandBuilder().setName('help').setDescription('List FGx commands.'),
  async execute(interaction) {
    const embed = new EmbedBuilder()
      .setColor(BRAND.colors.primary)
      .setTitle('FGx — Command Guide')
      .setDescription(
        'Use `/bloxstrike` for the interactive hub. AI questions: `/ask`. Full documentation: `docs/commands.md`.',
      );

    for (const group of GROUPS) {
      embed.addFields({
        name: `${group.icon} ${group.name}`,
        value: group.commands.map((c) => `\`${c}\``).join(' '),
      });
    }
    embed.setFooter({ text: `${BRAND.footer} • ${interaction.guild.name}` });

    await interaction.reply({ embeds: [embed] });
  },
};
