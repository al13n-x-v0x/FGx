'use strict';

/*
 * Copyright © 2026 FGx.
 * All rights reserved.
 */

const path = require('path');
const { ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder } = require('discord.js');
const { BRAND } = require('../../config/constants');
const { guildConfigRepo } = require('../../database/repos/guildConfig');
const { robloxLinksRepo } = require('../../database/repos/roblox');
const { logAudit } = require('../logging/auditLogger');
const { logger } = require('../../utils/logger');

/**
 * Welcome system.
 *
 * Renders a cinematic welcome: an attached welcome animation video, a branded
 * embed with the member's avatar/username, server name, member count and
 * configured message, plus one-tap verification buttons (Roblox + BloxStrike)
 * so new members start their verification journey on day one.
 *
 * The video ships in-repo at assets/welcome.mp4 — configure a different one by
 * setting welcome.video (absolute path or assets/… filename) via /config.
 */

const WELCOME_VIDEO = path.join(__dirname, '..', '..', '..', 'assets', 'welcome.mp4');

const PLACEHOLDERS = {
  '{{user}}': (member) => member.user.username,
  '{{mention}}': (member) => `<@${member.id}>`,
  '{{server}}': (member) => member.guild.name,
  '{{count}}': (member) => String(member.guild.memberCount),
};

function renderMessage(template, member) {
  let out = String(template ?? '');
  for (const [key, fn] of Object.entries(PLACEHOLDERS)) {
    out = out.split(key).join(fn(member));
  }
  return out;
}

/** Resolve the welcome video path from config, defaulting to the bundled one. */
function welcomeVideoPath(config) {
  const raw = config?.welcome?.video;
  if (!raw) return WELCOME_VIDEO;
  if (path.isAbsolute(raw)) return raw;
  return path.join(__dirname, '..', '..', '..', raw);
}

/**
 * Build the welcome embed + the action rows (verify buttons).
 * Exported separately so /setup's preview renders the exact same thing.
 */
function buildWelcomeView({ member, message, memberCount, guildName, includeVerify }) {
  const embed = new EmbedBuilder()
    .setColor(BRAND.colors.primary)
    .setAuthor({
      name: `Welcome to ${guildName}`,
      iconURL: member.guild?.iconURL() ?? undefined,
    })
    .setTitle(`👋 WELCOME, ${String(member.user?.username ?? 'NEW MEMBER').toUpperCase()}`)
    .setDescription(
      `You've joined **${guildName}** — home of the **${BRAND.clan}**. 🎯\n\n` +
        `${message ?? ''}\n\n` +
        `**What you can do here**\n` +
        `🔐 **Verify** — link your Roblox + BloxStrike account to unlock VIP perks\n` +
        `💰 **Earn ₣Ԡ🇽** — daily rewards, hunts, battles & match payouts\n` +
        `🏆 **Compete** — scrims, clan wars, tryouts and the leaderboard\n` +
        `🖐️ **Have fun** — socials, games, and an AI assistant in /ask\n\n` +
        `Member **#${memberCount}** — press **Verify** below to get started!`,
    )
    .setThumbnail(member.user?.displayAvatarURL({ size: 256 }) ?? undefined)
    .setFooter({ text: `${BRAND.footer} • We're glad you're here` })
    .setTimestamp(new Date());

  const rows = [];
  if (includeVerify) {
    rows.push(
      new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId('roblox:start')
          .setStyle(ButtonStyle.Primary)
          .setLabel('🟥 Verify with Roblox')
          .setEmoji('🟥'),
        new ButtonBuilder()
          .setCustomId('welcome:link')
          .setStyle(ButtonStyle.Success)
          .setLabel('⚔️ Link BloxStrike')
          .setEmoji('⚔️'),
      ),
    );
  }
  return { embed, rows };
}

async function onJoin(client, member) {
  const config = guildConfigRepo.get(member.guild.id);
  const welcome = config.welcome;
  if (!welcome.enabled) return;

  try {
    // Optional auto-role (validated by config command; double-check it exists).
    if (welcome.autoRole) {
      const role = member.guild.roles.cache.get(welcome.autoRole);
      if (role) await member.roles.add(role, 'FGx welcome auto-role').catch(() => {});
    }

    if (!welcome.channel) return;
    const channel = member.guild.channels.cache.get(welcome.channel);
    if (!channel?.isTextBased?.()) return;

    const { embed, rows } = buildWelcomeView({
      member,
      message: renderMessage(welcome.message, member),
      memberCount: member.guild.memberCount,
      guildName: member.guild.name,
      includeVerify: true,
    });

    // The bundled welcome animation, attached so it plays inline in Discord.
    const files = [{ attachment: welcomeVideoPath(config), name: 'welcome.mp4' }];

    await channel.send({
      content: `<@${member.id}>`,
      embeds: [embed],
      components: rows,
      files,
    });

    // Bloxlink-style Roblox verification prompt — DM new members who aren't
    // linked yet so verification starts on day one.
    if (config.roblox.enabled && !robloxLinksRepo.get(member.guild.id, member.id)) {
      const dmEmbed = new EmbedBuilder()
        .setColor(BRAND.colors.primary)
        .setTitle('🟥 Verify your Roblox account')
        .setDescription(
          `Welcome to **${member.guild.name}**!\\n\\n` +
            'Link your **Roblox account** to unlock your verification role — ' +
            'Bloxlink-style, no password needed.\\n\\n' +
            '1. Click **Verify with Roblox**\\n' +
            '2. Enter your Roblox username\\n' +
            '3. Put the **one-time code** in your Roblox **About** section\\n' +
            `4. Press **Check** within **5 minutes** — done\\n\\n` +
            'The code is single-use: the moment verification succeeds it is destroyed, ' +
            'so nobody else can ever claim your account.',
        )
        .setFooter({ text: `${BRAND.footer} • Powered by the Roblox public API` });
      const dmRow = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId('roblox:start')
          .setStyle(ButtonStyle.Primary)
          .setLabel('Verify with Roblox'),
      );
      await member.send({ embeds: [dmEmbed], components: [dmRow] }).catch(() => {});
    }

    await logAudit(client, member.guild, {
      action: 'join',
      target: member.user,
      moderator: null,
      details: { memberCount: member.guild.memberCount },
    });
  } catch (err) {
    logger.warn('welcome message failed', { guildId: member.guild.id, error: err.message });
  }
}

module.exports = { onJoin, renderMessage, buildWelcomeView, welcomeVideoPath, WELCOME_VIDEO };
