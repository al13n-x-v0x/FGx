'use strict';

/*
 * Copyright © 2026 FGx.
 * All rights reserved.
 */

const { PermissionsBitField } = require('discord.js');
const { classify, AIUnavailableError } = require('./client');
const { logAudit } = require('../logging/auditLogger');
const { antispam } = require('../security');
const { guildConfigRepo } = require('../../database/repos/guildConfig');
const { logger } = require('../../utils/logger');

/**
 * AI security layer.
 *
 * Runs on messages that pass heuristic suspicion (invites, links, phishing
 * patterns, all-caps, spam) and classifies them with the AI provider.
 *
 * Action modes (per guild, default LOG — the safest):
 *   LOG       → record the analysis only
 *   RECOMMEND → record + notify staff with the recommended action
 *   MODERATE  → additionally delete + timeout on HIGH risk with sufficient
 *               confidence; never punishes on uncertain classifications.
 *
 * The AI NEVER punishes solely from an uncertain classification.
 */

/** Messages trigger AI review only when at least one heuristic fires. */
function needsReview(message, _config) {
  const content = message.content ?? '';
  if (content.length < 8) return false;
  if (antispam.INVITE_RE.test(content)) return true;
  if (antispam.PHISHY_RE.test(content)) return true;
  if (antispam.URL_RE.test(content)) return true;
  if (content.replace(/[^A-Z]/g, '').length >= 40) return true;
  return false;
}

function isStaff(member, config) {
  if (member?.permissions?.has(PermissionsBitField.Flags.ManageMessages)) return true;
  const staffRoles = config.tickets.staffRoleIds ?? [];
  return member?.roles?.cache?.some((r) => staffRoles.includes(r.id)) ?? false;
}

/** Analyze one message with the AI. Returns the classification or null. */
async function analyzeMessage(client, message) {
  const config = guildConfigRepo.get(message.guild.id);
  if (!config.ai.securityEnabled) return null;
  if (!needsReview(message, config)) return null;
  if (isStaff(message.member, config)) return null;

  try {
    const result = await classify(message.content, {
      context: `Server: ${message.guild.name}. Author: ${message.author.username}. Channel: #${message.channel.name}.`,
    });
    if (!result) return null;

    // LOG mode is always safe: record everything.
    if (config.ai.actionMode === 'LOG' || result.risk !== 'HIGH') {
      await logAudit(client, message.guild, {
        action: 'ai',
        target: message.author,
        moderator: null,
        reason: result.reason,
        details: {
          risk: result.risk,
          confidence: `${Math.round(result.confidence * 100)}%`,
          category: result.category,
          recommendedAction: result.recommendedAction || 'NONE',
          mode: config.ai.actionMode,
        },
      });
      return result;
    }

    // RECOMMEND: log + staff notification with recommendation.
    if (config.ai.actionMode === 'RECOMMEND') {
      await logAudit(client, message.guild, {
        action: 'ai',
        target: message.author,
        moderator: null,
        reason: result.reason,
        details: {
          risk: result.risk,
          confidence: `${Math.round(result.confidence * 100)}%`,
          recommendedAction: result.recommendedAction,
          mode: 'RECOMMEND',
          link: message.url,
        },
      });
      return result;
    }

    // MODERATE: punish only HIGH risk with high confidence.
    if (
      config.ai.actionMode === 'MODERATE' &&
      result.risk === 'HIGH' &&
      result.confidence >= config.ai.moderateConfidence
    ) {
      const punishment = result.suggestedPunishment === 'BAN' ? 'BAN' : 'TIMEOUT';
      await message.delete().catch(() => {});
      if (punishment === 'BAN') {
        await message.guild.members.ban(message.author.id, {
          reason: `[FGx AI] HIGH risk (${Math.round(result.confidence * 100)}%): ${result.reason}`,
        }).catch(() => {});
      } else {
        await message.member?.timeout(10 * 60_000, `[FGx AI] ${result.reason}`).catch(() => {});
      }
      await logAudit(client, message.guild, {
        action: 'ai',
        target: message.author,
        moderator: null,
        reason: `[ENFORCED] ${result.reason}`,
        details: {
          risk: result.risk,
          confidence: `${Math.round(result.confidence * 100)}%`,
          action: punishment,
          mode: 'MODERATE',
        },
      });
      return result;
    }

    await logAudit(client, message.guild, {
      action: 'ai',
      target: message.author,
      moderator: null,
      reason: result.reason,
      details: {
        risk: result.risk,
        confidence: `${Math.round(result.confidence * 100)}%`,
        note: 'below moderation confidence — logged only',
        mode: 'MODERATE',
      },
    });
    return result;
  } catch (err) {
    if (err instanceof AIUnavailableError) return null;
    logger.warn('ai security analysis failed', { guildId: message.guild.id, error: err.message });
    return null;
  }
}

module.exports = { analyzeMessage, needsReview };
