'use strict';

/* Copyright (c) 2026 FGx. All rights reserved. */

const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const { BRAND } = require('../../config/constants');
const { env } = require('../../config/env');

function latencyStars(ms) {
  if (ms <= 50) return '*****';
  if (ms <= 100) return '****';
  if (ms <= 150) return '***';
  if (ms <= 250) return '**';
  return '*';
}

function playerBar(online, max) {
  if (max === 0) return '..........';
  const pct = Math.min(online / max, 1);
  const filled = Math.round(pct * 10);
  return 'O'.repeat(filled) + '.'.repeat(10 - filled);
}

function serverSize(online) {
  if (online === 0) return 'Empty';
  if (online <= 5) return 'Small';
  if (online <= 15) return 'Medium';
  if (online <= 30) return 'Large';
  return 'Packed!';
}

function serverType(version) {
  const v = (version || '').toLowerCase();
  if (v.includes('paper') || v.includes('purpur')) return 'Paper/Purpur';
  if (v.includes('spigot')) return 'Spigot';
  if (v.includes('forge') || v.includes('fabric')) return 'Modded';
  if (v.includes('bedrock') || v.includes('be')) return 'Bedrock';
  return 'Vanilla';
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName('minecraft')
    .setDescription('Check FGx Minecraft server status - IP, players, version')
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
    ),

  async execute(interaction) {
    const sub = interaction.options.getSubcommand();

    if (sub === 'status') {
      await interaction.deferReply();

      const host = interaction.options.getString('host') || env.MC_SERVER_HOST;
      const port = interaction.options.getInteger('port') || Number(env.MC_SERVER_PORT);

      let _mcUtil = null;
      function getMcUtil() {
        if (!_mcUtil) _mcUtil = require('minecraft-server-util');
        return _mcUtil;
      }

      let result;
      try {
        const queryPromise = getMcUtil().status(host, port, { timeout: 4000, enableSRV: true });
        const timeoutPromise = new Promise((_, reject) => {
          setTimeout(() => reject(Object.assign(new Error('Query timed out'), { code: 'TIMEOUT' })), 5000);
        });
        result = await Promise.race([queryPromise, timeoutPromise]);
      } catch (err) {
        result = { online: false, host, port, message: 'Query crashed: ' + err.message };
      }

      if (result.online) {
        const stars = latencyStars(result.latency);
        const bar = playerBar(result.players.online, result.players.max);
        const size = serverSize(result.players.online);
        const type = serverType(result.version);

        const line1 = '**Server Rating:** ' + stars;
        const line2 = '**Connection:** ' + result.latency + 'ms';
        const line3 = 'Server Info';
        const line4 = '> **IP:** `' + host + ':' + port + '`';
        const line5 = '> **Version:** ' + result.version;
        const line6 = '> **Type:** ' + type;
        const line7 = result.gamemode ? '> **Gamemode:** ' + result.gamemode : '';
        const line8 = result.worldName ? '> **World:** ' + result.worldName : '';
        const line9 = '**Players** ' + bar + ' **' + result.players.online + '/' + result.players.max + '**';
        const line10 = '> ' + size;
        let line11 = '';
        if (result.players.sample.length > 0) {
          const names = result.players.sample.map((p) => '`' + p + '`').join('  ');
          line11 = '> ' + names;
        }
        const sep = '━━━━━━━━━━━━━━━━━━━━━━━';

        const embed = new EmbedBuilder()
          .setColor(BRAND.colors.success)
          .setTitle('ONLINE - ' + env.MC_SERVER_NAME)
          .setDescription(
            line1 + '\n' +
            line2 + '\n\n' +
            sep + '\n' +
            line3 + '\n' +
            line4 + '\n' +
            line5 + '\n' +
            line6 + '\n' +
            (line7 ? line7 + '\n' : '') +
            (line8 ? line8 + '\n' : '') +
            '\n' + line9 + '\n' +
            line10 + '\n' +
            (line11 ? '\n' + line11 : '') + '\n\n' +
            sep + '\n' +
            (result.motd ? '> ' + result.motd : ''),
          )
          .setFooter({ text: BRAND.footer + ' - Server is online and ready to play!' })
          .setTimestamp();

        if (result.favicon) {
          embed.setThumbnail('attachment://favicon.png');
        }

        const row = new ActionRowBuilder().addComponents(
          new ButtonBuilder()
            .setLabel('Open Aternos')
            .setURL('https://aternos.org/panel/')
            .setStyle(ButtonStyle.Link),
        );

        await interaction.editReply({ embeds: [embed], components: [row] });
      } else {
        const SERV_START_ID = env.ATERNOS_USERNAME || 'FGXstart';
        const SERV_START_PASS = env.ATERNOS_PASSWORD || 'FGXBLOXSTRIKE';

        const off1 = '**Server Rating:** no stars (offline)';
        const sep2 = '━━━━━━━━━━━━━━━━━━━━━━━';
        const off3 = '**Server Info**';
        const off4 = '> **IP:** `' + host + ':' + port + '`';
        const off5 = '> **Status:** Offline';
        const off6 = '> **Reason:** ' + (result.message || 'Server not responding');

        const embed = new EmbedBuilder()
          .setColor(BRAND.colors.danger)
          .setTitle('OFFLINE - ' + env.MC_SERVER_NAME)
          .setDescription(
            off1 + '\n\n' +
            sep2 + '\n' +
            off3 + '\n' +
            off4 + '\n' +
            off5 + '\n' +
            off6 + '\n\n' +
            sep2,
          )
          .setFooter({ text: BRAND.footer })
          .setTimestamp();

        const startTitle = 'SERVER START ACCESS - @everyone';
        const start1 = 'Want to turn the server on? Use the Aternos access below.';
        const start2 = 'ID: ' + SERV_START_ID;
        const start3 = 'Password: ' + SERV_START_PASS;
        const start4 = 'Permissions: Server START only';
        const start5 = 'Do not change account settings, permissions, or password.';
        const start6 = 'Get the server online and let everyone play!';

        const startAccessEmbed = new EmbedBuilder()
          .setColor(0x00ff00)
          .setTitle(startTitle)
          .setDescription(
            start1 + '\n\n' +
            start2 + '\n' +
            start3 + '\n\n' +
            start4 + '\n' +
            start5 + '\n\n' +
            start6,
          )
          .setFooter({ text: BRAND.footer });

        const row = new ActionRowBuilder().addComponents(
          new ButtonBuilder()
            .setLabel('Open Aternos (Manual Start)')
            .setURL('https://aternos.org/panel/')
            .setStyle(ButtonStyle.Link),
        );

        await interaction.editReply({ embeds: [embed, startAccessEmbed], components: [row] });
      }
    }
  },
};
