'use strict';

/* Copyright © 2026 FGx. All rights reserved. */

const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const { BRAND } = require('../../config/constants');
const { env } = require('../../config/env');
const mc = require('../../services/minecraft/minecraftService');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('minecraft')
    .setDescription('Minecraft server tools — status, start, monitor')
    .addSubcommand((sub) =>
      sub
        .setName('status')
        .setDescription('Check if the Minecraft server is online')
        .addStringOption((opt) =>
          opt.setName('host').setDescription('Server IP (default from config)').setRequired(false),
        )
        .addIntegerOption((opt) =>
          opt.setName('port').setDescription('Server port (default 25565)').setRequired(false),
        ),
    )
    .addSubcommand((sub) =>
      sub
        .setName('start')
        .setDescription('Start the Aternos server (auto-start)'),
    )
    .addSubcommand((sub) =>
      sub
        .setName('monitor')
        .setDescription('Auto-monitor server and notify when online')
        .addStringOption((opt) =>
          opt.setName('host').setDescription('Server IP to monitor').setRequired(false),
        )
        .addIntegerOption((opt) =>
          opt.setName('port').setDescription('Server port to monitor').setRequired(false),
        ),
    )
    .addSubcommand((sub) =>
      sub
        .setName('stop')
        .setDescription('Stop monitoring the server in this channel'),
    ),

  async execute(interaction) {
    const sub = interaction.options.getSubcommand();

    // ─── STATUS ────────────────────────────────────────────────────────────
    if (sub === 'status') {
      await interaction.deferReply();

      const host = interaction.options.getString('host') || env.MC_SERVER_HOST;
      const port = interaction.options.getInteger('port') || Number(env.MC_SERVER_PORT);

      const result = await mc.queryServer(host, port);

      if (result.online) {
        const embed = new EmbedBuilder()
          .setColor(BRAND.colors.success)
          .setTitle('🟢 Server is ONLINE')
          .setDescription(
            `**${env.MC_SERVER_NAME}**\n\n` +
            `**IP:** \`${host}:${port}\`\n` +
            `**Version:** ${result.version}\n` +
            `**Players:** ${result.players.online}/${result.players.max}\n` +
            `**Latency:** ${result.latency}ms\n` +
            (result.motd ? `**MOTD:** ${result.motd}\n` : '') +
            (result.gamemode ? `**Gamemode:** ${result.gamemode}\n` : '') +
            (result.worldName ? `**World:** ${result.worldName}\n` : '') +
            (result.players.sample.length > 0
              ? `**Online Players:** ${result.players.sample.join(', ')}`
              : ''),
          )
          .setFooter({ text: BRAND.footer })
          .setTimestamp();

        if (result.favicon) {
          embed.setThumbnail('attachment://favicon.png');
        }

        const row = new ActionRowBuilder().addComponents(
          new ButtonBuilder()
            .setCustomId(`mc:monitor:${host}:${port}`)
            .setLabel('📡 Start Monitor')
            .setStyle(ButtonStyle.Primary),
          new ButtonBuilder()
            .setCustomId(`mc:refresh:${host}:${port}`)
            .setLabel('🔄 Refresh')
            .setStyle(ButtonStyle.Secondary),
        );

        await interaction.editReply({ embeds: [embed], components: [row] });
      } else {
        const embed = new EmbedBuilder()
          .setColor(BRAND.colors.danger)
          .setTitle('🔴 Server is OFFLINE')
          .setDescription(
            `**${env.MC_SERVER_NAME}**\n\n` +
            `**IP:** \`${host}:${port}\`\n` +
            `**Status:** Offline\n` +
            `**Reason:** ${result.message || 'Server not responding'}\n\n` +
            (env.ATERNOS_USERNAME
              ? 'Click **🚀 Start Server** below to auto-start via Aternos!'
              : 'Use `/minecraft start` to auto-start, or start manually on Aternos.'),
          )
          .setFooter({ text: BRAND.footer })
          .setTimestamp();

        const row = new ActionRowBuilder().addComponents(
          new ButtonBuilder()
            .setCustomId('mc:start')
            .setLabel('🚀 Start Server')
            .setStyle(ButtonStyle.Success),
          new ButtonBuilder()
            .setCustomId(`mc:monitor:${host}:${port}`)
            .setLabel('📡 Auto-Monitor')
            .setStyle(ButtonStyle.Primary),
          new ButtonBuilder()
            .setURL('https://aternos.org')
            .setLabel('🌐 Open Aternos')
            .setStyle(ButtonStyle.Link),
        );

        await interaction.editReply({ embeds: [embed], components: [row] });
      }
    }

    // ─── START ─────────────────────────────────────────────────────────────
    if (sub === 'start') {
      await interaction.deferReply();

      const result = await mc.startAternos();

      const embed = new EmbedBuilder()
        .setColor(result.success ? BRAND.colors.success : BRAND.colors.danger)
        .setTitle(result.success ? '🚀 Starting Server' : '❌ Start Failed')
        .setDescription(result.message)
        .setFooter({ text: BRAND.footer })
        .setTimestamp();

      if (result.success) {
        // Auto-start monitoring
        const host = env.MC_SERVER_HOST;
        const port = Number(env.MC_SERVER_PORT);

        const row = new ActionRowBuilder().addComponents(
          new ButtonBuilder()
            .setCustomId(`mc:monitor:${host}:${port}`)
            .setLabel('📡 Auto-Monitor (Notify when UP)')
            .setStyle(ButtonStyle.Primary),
          new ButtonBuilder()
            .setURL('https://aternos.org')
            .setLabel('🌐 Open Aternos')
            .setStyle(ButtonStyle.Link),
        );

        await interaction.editReply({ embeds: [embed], components: [row] });

        // Start monitoring in background
        mc.startMonitor(interaction.channel, host, port, 30000, 60);
        await interaction.followUp({
          content: '📡 **Auto-monitor started** — I\'ll ping the server every 30s and notify here when it\'s online!',
        });
      } else {
        const row = new ActionRowBuilder().addComponents(
          new ButtonBuilder()
            .setURL('https://aternos.org')
            .setLabel('🌐 Start Manually on Aternos')
            .setStyle(ButtonStyle.Link),
        );

        await interaction.editReply({ embeds: [embed], components: [row] });
      }
    }

    // ─── MONITOR ───────────────────────────────────────────────────────────
    if (sub === 'monitor') {
      const host = interaction.options.getString('host') || env.MC_SERVER_HOST;
      const port = interaction.options.getInteger('port') || Number(env.MC_SERVER_PORT);

      if (mc.isMonitoring(interaction.channel.id)) {
        return interaction.reply({
          content: '📡 This channel is already being monitored! I\'ll notify when the server comes online.',
          ephemeral: true,
        });
      }

      // Quick check — if already online, no need to monitor
      const quickCheck = await mc.queryServer(host, port);
      if (quickCheck.online) {
        return interaction.reply({
          content: `🟢 **Server is already online!** \`${host}:${port}\` — ${quickCheck.players.online}/${quickCheck.players.max} players.`,
          ephemeral: true,
        });
      }

      mc.startMonitor(interaction.channel, host, port, 30000, 60);

      const embed = new EmbedBuilder()
        .setColor(BRAND.colors.warn)
        .setTitle('📡 Minecraft Server Monitor Started')
        .setDescription(
          `Monitoring \`${host}:${port}\` every **30 seconds**.\n\n` +
          `• I'll notify **@everyone** here when the server comes online\n` +
          `• Max monitoring time: **30 minutes** (60 checks)\n` +
          `• Use \`/minecraft stop\` to cancel early\n\n` +
          `**Current status:** 🔴 Offline`,
        )
        .setFooter({ text: BRAND.footer })
        .setTimestamp();

      const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId('mc:stop-monitor')
          .setLabel('⛔ Stop Monitor')
          .setStyle(ButtonStyle.Danger),
      );

      await interaction.reply({ embeds: [embed], components: [row] });
    }

    // ─── STOP ──────────────────────────────────────────────────────────────
    if (sub === 'stop') {
      const stopped = mc.stopMonitor(interaction.channel.id);

      return interaction.reply({
        content: stopped
          ? '⛔ Server monitoring stopped.'
          : 'There\'s no active monitor in this channel.',
        ephemeral: true,
      });
    }
  },
};
