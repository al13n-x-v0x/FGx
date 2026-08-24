'use strict';

/* Copyright © 2026 FGx. All rights reserved. */

const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, StringSelectMenuBuilder } = require('discord.js');
const { BRAND } = require('../../config/constants');
const { env } = require('../../config/env');
const mc = require('../../services/minecraft/minecraftService');

/** Generate star rating based on latency (lower = better). */
function latencyStars(ms) {
  if (ms <= 50) return '⭐⭐⭐⭐⭐';
  if (ms <= 100) return '⭐⭐⭐⭐';
  if (ms <= 150) return '⭐⭐⭐';
  if (ms <= 250) return '⭐⭐';
  return '⭐';
}

/** Generate a player fill bar like ▓▓▓▓▓░░░░░ */
function playerBar(online, max) {
  if (max === 0) return '░░░░░░░░░░';
  const pct = Math.min(online / max, 1);
  const filled = Math.round(pct * 10);
  return '▓'.repeat(filled) + '░'.repeat(10 - filled);
}

/** Human-readable server size label. */
function serverSize(online) {
  if (online === 0) return 'Empty';
  if (online <= 5) return 'Small';
  if (online <= 15) return 'Medium';
  if (online <= 30) return 'Large';
  return 'Packed!';
}

/** Get uptime category based on version string heuristics. */
function serverType(version) {
  const v = (version || '').toLowerCase();
  if (v.includes('paper') || v.includes('purpur')) return '📄 Paper/Purpur';
  if (v.includes('spigot')) return '🔩 Spigot';
  if (v.includes('forge') || v.includes('fabric')) return '⚙️ Modded';
  if (v.includes('bedrock') || v.includes('be')) return '🪨 Bedrock';
  return '🟩 Vanilla';
}

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
    )
    .addSubcommand((sub) =>
      sub
        .setName('rate')
        .setDescription('Rate the server experience (1-5 stars)')
        .addIntegerOption((opt) =>
          opt.setName('stars')
            .setDescription('Your rating (1-5)')
            .setRequired(true)
            .addChoices(
              { name: '⭐ Terrible', value: 1 },
              { name: '⭐⭐ Bad', value: 2 },
              { name: '⭐⭐⭐ Okay', value: 3 },
              { name: '⭐⭐⭐⭐ Good', value: 4 },
              { name: '⭐⭐⭐⭐⭐ Amazing', value: 5 },
            ),
        ),
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
        const stars = latencyStars(result.latency);
        const bar = playerBar(result.players.online, result.players.max);
        const size = serverSize(result.players.online);
        const type = serverType(result.version);

        const embed = new EmbedBuilder()
          .setColor(BRAND.colors.success)
          .setTitle(`🟢 ${env.MC_SERVER_NAME} — ONLINE`)
          .setDescription(
            `**Server Rating:** ${stars}\n` +
            `**Connection:** ${result.latency}ms\n\n` +
            `━━━━━━━━━━━━━━━━━━━━━━━\n` +
            `**📡 Server Info**\n` +
            `> **IP:** \`${host}:${port}\`\n` +
            `> **Version:** ${result.version}\n` +
            `> **Type:** ${type}\n` +
            (result.gamemode ? `> **Gamemode:** ${result.gamemode}\n` : '') +
            (result.worldName ? `> **World:** ${result.worldName}\n` : '') +
            `\n**👥 Players** ${bar} **${result.players.online}/${result.players.max}**\n` +
            `> ${size}` +
            (result.players.sample.length > 0
              ? `\n> ${result.players.sample.map((p) => `\`${p}\``).join(' • ')}`
              : '') +
            `\n\n━━━━━━━━━━━━━━━━━━━━━━━` +
            (result.motd ? `\n> 💬 *${result.motd}*` : ''),
          )
          .setFooter({ text: `${BRAND.footer} • Server is online and ready to play!` })
          .setTimestamp();

        if (result.favicon) {
          embed.setThumbnail('attachment://favicon.png');
        }

        const row = new ActionRowBuilder().addComponents(
          new ButtonBuilder()
            .setCustomId(`mc:refresh:${host}:${port}`)
            .setLabel('🔄 Refresh')
            .setStyle(ButtonStyle.Secondary),
          new ButtonBuilder()
            .setCustomId(`mc:monitor:${host}:${port}`)
            .setLabel('📡 Monitor')
            .setStyle(ButtonStyle.Primary),
        );

        await interaction.editReply({ embeds: [embed], components: [row] });
      } else {
        const embed = new EmbedBuilder()
          .setColor(BRAND.colors.danger)
          .setTitle(`🔴 ${env.MC_SERVER_NAME} — OFFLINE`)
          .setDescription(
            `**Server Rating:** ☆☆☆☆☆ (offline)\n\n` +
            `━━━━━━━━━━━━━━━━━━━━━━━\n` +
            `**📡 Server Info**\n` +
            `> **IP:** \`${host}:${port}\`\n` +
            `> **Status:** Offline\n` +
            `> **Reason:** ${result.message || 'Server not responding'}\n\n` +
            `━━━━━━━━━━━━━━━━━━━━━━━` +
            (env.ATERNOS_USERNAME
              ? `\n\n🚀 **Click Start below to bring the server online!**`
              : `\n\nUse \`/minecraft start\` or start manually on Aternos.`),
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

    // ─── RATE ──────────────────────────────────────────────────────────────
    if (sub === 'rate') {
      const stars = interaction.options.getInteger('stars');
      const starText = '⭐'.repeat(stars) + '☆'.repeat(5 - stars);
      const messages = {
        1: [
          'Yikes... the server was rough. We\'ll do better! 💀',
          '1 star? That hurts. What went wrong? 😭',
          'Noted. We need to fix this ASAP. 🔧',
        ],
        2: [
          'Below average. We\'re working on improvements! 🔨',
          '2 stars — room for improvement. Thanks for the feedback!',
          'Got it. We\'ll try harder next time. 📝',
        ],
        3: [
          'Solid server! Thanks for playing! 👍',
          'Average but functional. We\'ll aim higher! ⬆️',
          '3 stars — not bad! Thanks for the rating!',
        ],
        4: [
          'Nice! Almost perfect. What could make it a 5? 🤔',
          '4 stars! Glad you enjoyed it! 🎉',
          'Great feedback — we\'re almost there! 💪',
        ],
        5: [
          'PERFECT SCORE! You\'re the best! 🏆🔥',
          '5 stars! We love you! Keep playing! 💜',
          'ABSOLUTELY COOKED! Thanks for the perfect rating! ⭐',
        ],
      };

      const msg = messages[stars][Math.floor(Math.random() * messages[stars].length)];

      // Store rating (best effort)
      try {
        const { db } = require('../../database');
        db.prepare(`
          INSERT INTO guild_config (guild_id, config_key, config_value)
          VALUES (?, 'mc_rating_${interaction.user.id}', ?)
          ON CONFLICT(guild_id, config_key) DO UPDATE SET config_value = excluded.config_value
        `).run(interaction.guild.id, String(stars));
      } catch {
        // Rating storage is optional — ignore errors
      }

      const embed = new EmbedBuilder()
        .setColor(stars >= 4 ? BRAND.colors.success : stars >= 3 ? BRAND.colors.warn : BRAND.colors.danger)
        .setTitle('⭐ Server Rating Submitted!')
        .setDescription(
          `**${interaction.user.username}** rated **${env.MC_SERVER_NAME}**\n\n` +
          `**Rating:** ${starText}\n` +
          `**Score:** ${stars}/5\n\n` +
          `> ${msg}`,
        )
        .setThumbnail(interaction.user.displayAvatarURL({ size: 128 }))
        .setFooter({ text: BRAND.footer })
        .setTimestamp();

      const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId(`mc:refresh:${env.MC_SERVER_HOST}:${Number(env.MC_SERVER_PORT)}`)
          .setLabel('🔄 Check Status')
          .setStyle(ButtonStyle.Secondary),
        new ButtonBuilder()
          .setCustomId('mc:start')
          .setLabel('🚀 Start Server')
          .setStyle(ButtonStyle.Success),
      );

      await interaction.reply({ embeds: [embed], components: [row] });
    }
  },
};
