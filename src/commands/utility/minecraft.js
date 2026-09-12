'use strict';

/* Copyright © 2026 FGx. All rights reserved. */

const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const { BRAND } = require('../../config/constants');
const { env } = require('../../config/env');

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
    .setDescription('Check FGx Minecraft server status — IP, players, version')
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

      // Lazy-load minecraft-server-util (native dep, loaded on demand).
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
        result = { online: false, host, port, error: 'CRASH', message: `Query crashed: ${err.message}` };
      }

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
              ? `\n> ${result.players.sample.map((p) => \`${p}\`).join(' • ')}`
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
            .setLabel('🌐 Open Aternos')
            .setURL('https://aternos.org/panel/')
            .setStyle(ButtonStyle.Link),
        );

        await interaction.editReply({ embeds: [embed], components: [row] });
      } else {
        // Offline — show server credentials and the "access blocked" image
        const SERV_START_ID = env.ATERNOS_USERNAME || 'FGXstart';
        const SERV_START_PASS = env.ATERNOS_PASSWORD || 'FGXBLOXSTRIKE';

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
            `━━━━━━━━━━━━━━━━━━━━━━━`,
          )
          .setImage('https://cdn.discordapp.com/attachments/1538504231013589094/1542063766899007518/ChatGPT_Image_Aug_26_2026_12_19_46_PM.png?ex=6a8fde4c&is=6a8e8ccc&hm=159a3acfdfc807a84c621c46ea5b3d33c9c4f5c1fba4e84eb45a561dd65a66c3&=&format=webp&quality=lossless&width=768&height=384')
          .setFooter({ text: BRAND.footer })
          .setTimestamp();

        const startAccessEmbed = new EmbedBuilder()
          .setColor(0x00ff00)
          .setTitle('🚀 SERVER START ACCESS  @everyone')
          .setDescription(
            `Want to turn the server on? ⚡ Use the Aternos access below.\n\n` +
            `🟢 **ID:** ${SERV_START_ID}\n` +
            `🔑 **Password:** ${SERV_START_PASS}\n\n` +
            `📌 **Permissions:** Server START only\n` +
            `❌ Do not change account settings, permissions, or password.\n\n` +
            `🔥 Get the server online and let everyone play!`,
          )
          .setFooter({ text: BRAND.footer });

        const row = new ActionRowBuilder().addComponents(
          new ButtonBuilder()
            .setLabel('🌐 Open Aternos (Manual Start)')
            .setURL('https://aternos.org/panel/')
            .setStyle(ButtonStyle.Link),
        );

        await interaction.editReply({ embeds: [embed, startAccessEmbed], components: [row] });
      }
    }
  },
};
