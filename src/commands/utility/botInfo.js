'use strict';

/* Copyright © 2026 FGx. All rights reserved. */

const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { BRAND } = require('../../config/constants');
const { env, aiConfigured, aiSummary } = require('../../config/env');
const { healthCheck } = require('../../database/index');
const { formatDuration } = require('../../utils/format');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('bot-info')
    .setDescription('Detailed bot information, system stats, and performance metrics.'),

  async execute(interaction) {
    const client = interaction.client;
    const mem = process.memoryUsage();

    const heapUsed = (mem.heapUsed / 1024 / 1024).toFixed(1);
    const heapTotal = (mem.heapTotal / 1024 / 1024).toFixed(1);
    const rss = (mem.rss / 1024 / 1024).toFixed(1);
    const ext = (mem.external / 1024 / 1024).toFixed(1);

    const totalGuilds = client.guilds.cache.size;
    const totalUsers = client.guilds.cache.reduce((a, g) => a + g.memberCount, 0);
    const totalChannels = client.guilds.cache.reduce((a, g) => a + g.channels.cache.size, 0);
    const onlineMembers = client.guilds.cache.reduce(
      (a, g) => a + g.members.cache.filter((m) => m.presence?.status !== 'offline').size,
      0,
    );

    const uptime = formatDuration(client.uptime);
    const latency = client.ws.ping;
    const dbOk = healthCheck();

    const embed = new EmbedBuilder()
      .setColor(BRAND.colors.primary)
      .setTitle('🤖 FGx Bot Info')
      .setDescription(`Comprehensive stats and system information for **${BRAND.name}**.`)
      .addFields(
        {
          name: '📊 General',
          value: [
            `**Version** v${BRAND.version}`,
            `**Node.js** ${process.version}`,
            `**Commands** ${client.commands.size}`,
            `**Events** 8 handlers`,
            `**Uptime** ${uptime}`,
            `**Ping** ${latency}ms`,
          ].join('\n'),
          inline: true,
        },
        {
          name: '🌐 Discord',
          value: [
            `**Guilds** ${totalGuilds}`,
            `**Users** ${totalUsers.toLocaleString()}`,
            `**Online** ${onlineMembers.toLocaleString()}`,
            `**Channels** ${totalChannels}`,
            `**Bot ID** ${client.user.id}`,
          ].join('\n'),
          inline: true,
        },
        {
          name: '💾 Memory',
          value: [
            `**Heap** ${heapUsed}/${heapTotal} MB`,
            `**RSS** ${rss} MB`,
            `**External** ${ext} MB`,
          ].join('\n'),
          inline: true,
        },
        {
          name: '🧠 AI',
          value: aiConfigured()
            ? `✅ ${aiSummary()}`
            : '⚠️ Not configured',
          inline: true,
        },
        {
          name: '🗄️ Database',
          value: dbOk ? '✅ SQLite connected' : '❌ Error',
          inline: true,
        },
        {
          name: '⚡ Performance',
          value: [
            `**PID** ${process.pid}`,
            `**Platform** ${process.platform}`,
            `**Arch** ${process.arch}`,
            `**Env** ${env.NODE_ENV}`,
          ].join('\n'),
          inline: true,
        },
      )
      .setFooter({ text: `${BRAND.footer} • Built with ❤️` })
      .setTimestamp(new Date());

    await interaction.reply({ embeds: [embed] });
  },
};
