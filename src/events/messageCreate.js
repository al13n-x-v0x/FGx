'use strict';

/*
 * Copyright © 2026 FGx.
 * All rights reserved.
 */

const { Events, EmbedBuilder } = require('discord.js');
const { guildConfigRepo } = require('../database/repos/guildConfig');
const { antispam, lockdown } = require('../services/security');
const { awardForMessage } = require('../services/community/xpService');
const chatCommands = require('../services/community/chatCommands');
const { analyzeMessage } = require('../services/ai/securityEngine');
const { logger } = require('../utils/logger');
const { logAudit } = require('../services/logging/auditLogger');
const afkCmd = require('../commands/utility/afk');

function register(client) {
  client.on(Events.MessageCreate, async (message) => {
    if (!message.guild || message.author.bot) return;

    try {
      const config = guildConfigRepo.get(message.guild.id);

      // ── AFK system ──────────────────────────────────────
      // Check if this user is returning from AFK
      const afkReturn = await afkCmd.checkReturn(message.author.id, message.guild.id);
      if (afkReturn) {
        const returnEmbed = new EmbedBuilder()
          .setColor(0x57F287)
          .setDescription(afkReturn.message)
          .setTimestamp(new Date());
        if (afkReturn.gif) returnEmbed.setImage(afkReturn.gif);
        await message.reply({ embeds: [returnEmbed] }).catch(() => {});
      }

      // Check if any mentioned users are AFK
      for (const [userId] of message.mentions.users) {
        const afkInfo = afkCmd.getAfkInfo(userId);
        if (afkInfo && userId !== message.author.id) {
          const mentionData = await afkCmd.formatMention(userId);
          if (mentionData) {
            const afkEmbed = new EmbedBuilder()
              .setColor(0xFEE75C)
              .setDescription(mentionData.message)
              .setTimestamp(new Date());
            if (mentionData.gif) afkEmbed.setImage(mentionData.gif);
            await message.reply({ embeds: [afkEmbed] }).catch(() => {});
          }
        }
      }

      // Lockdown: silence non-staff during protection mode.
      if (config.security.lockdown && !lockdown.maySpeakDuringLockdown(message.member)) {
        if (config.antispam.purgeEnabled) {
          await message.delete().catch(() => {});
        }
        return;
      }

      // Anti-spam engine.
      const analysis = antispam.analyze(message, config);
      if (analysis.spammy && !antispam.isImmune(message.member)) {
        const decision = antispam.decideAction(message.guild.id, message.author.id, analysis, config);
        if (decision.action !== 'none') {
          if (decision.action === 'delete' || decision.action === 'timeout') {
            await message.delete().catch(() => {});
          }
          if (decision.action === 'warn') {
            await message.author.send(
              `**FGx moderation:** your message in ${message.guild.name} was flagged for ${decision.reason}. Please review the server rules.`,
            ).catch(() => {});
          }
          if (decision.action === 'timeout') {
            await message.member
              ?.timeout(decision.minutes * 60_000, `[FGx anti-spam] ${decision.reason}`)
              .catch(() => {});
          }
          await logAudit(client, message.guild, {
            action: 'security',
            target: message.author,
            moderator: null,
            reason: `Anti-spam: ${decision.reason}`,
            details: {
              action: decision.action.toUpperCase(),
              minutes: decision.minutes || '—',
              escalated: decision.escalated ? 'YES' : 'no',
            },
          });
        }
      }

      // OwO-style chat commands: `fgx daily`, `fgx coinflip 50`, …
      if (await chatCommands.handle(client, message)) {
        return;
      }

      // AI security layer (profanity fast-path is free; the paid AI
      // classification is rate-limited inside analyzeMessage).
      if (config.ai.securityEnabled) {
        await analyzeMessage(client, message);
      }

      // XP from participation.
      await awardForMessage(message);
    } catch (err) {
      logger.warn('messageCreate handler failed', { guildId: message.guild.id, error: err.message });
    }
  });
}

module.exports = { register };
