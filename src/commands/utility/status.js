'use strict';

/*
 * Copyright © 2026 FGx.
 * All rights reserved.
 */

const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { BRAND } = require('../../config/constants');
const { env, aiConfigured, providerLabel } = require('../../config/env');
const { healthCheck } = require('../../database/index');
const { guildConfigRepo } = require('../../database/repos/guildConfig');
const { formatDuration } = require('../../utils/format');

module.exports = {
  data: new SlashCommandBuilder().setName('status').setDescription('Show FGx system status.'),
  async execute(interaction) {
    const config = guildConfigRepo.get(interaction.guild.id);
    const dbOk = healthCheck();
    const aiOk = aiConfigured();

    const embed = new EmbedBuilder()
      .setColor(BRAND.colors.primary)
      .setTitle('FGx')
      .setDescription(
        `━━━━━━━━━━━━━━━━\n` +
          `🟢 **Online**\n\n` +
          `**Latency** ${interaction.client.ws.ping}ms\n` +
          `**Uptime** ${formatDuration(interaction.client.uptime)}\n` +
          `**Guilds** ${interaction.client.guilds.cache.size}\n` +
          `**Users** ${interaction.client.guilds.cache.reduce((acc, g) => acc + g.memberCount, 0)}\n` +
          `**Commands** ${interaction.client.commands.size}\n` +
          `**AI Status** ${aiOk ? `✅ ${providerLabel()}` : '⚠️ not configured (set AI_API_KEY / GROQ_API_KEY / GEMINI_API_KEY)'}\n` +
          `**Database** ${dbOk ? '✅ connected' : '❌ error'}\n` +
          `**Security** ${config.security.lockdown ? '🟢 protection mode ACTIVE' : '⚪ normal'} (anti-spam ${config.antispam.enabled ? 'on' : 'off'} • anti-nuke ${config.antinuke.enabled ? 'on' : 'off'})`,
      )
      .setFooter({ text: `FGx v${BRAND.version} • ${env.NODE_ENV}` })
      .setTimestamp(new Date());

    await interaction.reply({ embeds: [embed] });
  },
};
