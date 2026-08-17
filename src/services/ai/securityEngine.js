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
const { warningsRepo } = require('../../database/repos/moderation');
const { hasProfanity } = require('../../data/profanity');
const { BRAND } = require('../../config/constants');
const { RateLimiter } = require('../../utils/ratelimit');
const { logger } = require('../../utils/logger');

/**
 * AI security layer.
 *
 * Two paths:
 *  1. Profanity fast path — a deterministic local word-list match catches
 *     swearing instantly (no API call, no latency).
 *  2. AI classification — messages that trigger heuristic suspicion
 *     (invites, links, phishing, all-caps) are classified by the AI model.
 *
 * Action modes (per guild, default MODERATE):
 *   LOG       → record the analysis only
 *   RECOMMEND → record + notify staff in the log channel with the recommendation
 *   MODERATE  → DM the author, record an official warning, delete the message,
 *               and apply a 5-minute timeout on HIGH risk (profanity or high
 *               confidence AI classification). BAN only when the AI
 *               explicitly suggests it.
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

/** Send a staff notification embed to the guild's log channel (best-effort). */
async function notifyStaff(client, message, result) {
  const config = guildConfigRepo.get(message.guild.id);
  const channel = config.modLogChannel
    ? message.guild.channels.cache.get(config.modLogChannel)
    : null;
  if (!channel) return;
  await channel
    .send({
      embeds: [
        {
          color: BRAND.colors.warn,
          title: '⚠️ AI moderation recommendation',
          description:
            `**Author:** <@${message.author.id}>\n` +
            `**Channel:** <#${message.channel.id}>\n` +
            `**Risk:** ${result.risk} • **Confidence:** ${Math.round((result.confidence || 0) * 100)}%\n` +
            `**Category:** ${result.category}\n` +
            `**Recommended action:** ${result.recommendedAction || 'NONE'}\n` +
            `**Reason:** ${result.reason}\n\n` +
            `[Jump to message](${message.url})`,
        },
      ],
    })
    .catch(() => {});
}

/**
 * Enforce a HIGH-risk violation: DM the author, record an official warning,
 * delete the message, and apply a 5-minute timeout. Never throws — each
 * step is best-effort so one failure cannot skip the rest.
 */
async function enforce(client, message, result, { ban = false } = {}) {
  const count = warningsRepo.countFor(message.guild.id, message.author.id) + 1;

  await message.author
    .send(
      `**FGx moderation notice — ${message.guild.name}**\n` +
        `Your message in #${message.channel.name} was removed for violating the community rules ` +
        `(${result.category}: ${result.reason}). This is **warning #${count}**.\n` +
        `Repeated violations lead to longer timeouts or removal from the server. ` +
        `If you believe this was a mistake, contact a staff member.`,
    )
    .catch(() => {});

  warningsRepo.add(
    message.guild.id,
    message.author.id,
    null,
    `[FGx AI] ${result.category}: ${result.reason}`,
  );

  await message.delete().catch(() => {});

  if (ban) {
    await message.guild.members
      .ban(message.author.id, {
        reason: `[FGx AI] HIGH risk (${Math.round((result.confidence || 0) * 100)}%): ${result.reason}`,
      })
      .catch(() => {});
  } else {
    await message.member
      ?.timeout(5 * 60_000, `[FGx AI] ${result.reason}`)
      .catch(() => {});
  }

  await logAudit(client, message.guild, {
    action: 'ai',
    target: message.author,
    moderator: null,
    reason: `[ENFORCED] ${result.reason}`,
    details: {
      risk: result.risk,
      confidence: `${Math.round((result.confidence || 0) * 100)}%`,
      category: result.category,
      action: ban ? 'BAN' : 'TIMEOUT 5m',
      warningId: count,
      mode: 'MODERATE',
    },
  });
}

/** Analyze one message with the AI. Returns the classification or null. */
/** Per-user AI classification limiter (protects the API budget). */
const classifyLimiter = new RateLimiter({ max: 5, windowMs: 60_000 });

async function analyzeMessage(client, message) {
  const config = guildConfigRepo.get(message.guild.id);
  if (!config.ai.securityEnabled) return null;
  if (isStaff(message.member, config)) return null;

  const content = message.content ?? '';

  // Profanity fast path: deterministic local match — instant, no API cost.
  if (hasProfanity(content)) {
    const result = {
      risk: 'HIGH',
      confidence: 1,
      category: 'profanity',
      reason: 'Profanity / toxic language',
      recommendedAction: 'TIMEOUT',
      suggestedPunishment: 'TIMEOUT',
    };
    if (config.ai.actionMode === 'MODERATE') {
      await enforce(client, message, result);
    } else if (config.ai.actionMode === 'RECOMMEND') {
      await notifyStaff(client, message, result);
      await logAudit(client, message.guild, {
        action: 'ai',
        target: message.author,
        moderator: null,
        reason: result.reason,
        details: {
          risk: result.risk,
          confidence: '100%',
          category: result.category,
          recommendedAction: result.recommendedAction,
          mode: 'RECOMMEND',
          link: message.url,
        },
      });
    } else {
      await logAudit(client, message.guild, {
        action: 'ai',
        target: message.author,
        moderator: null,
        reason: result.reason,
        details: {
          risk: result.risk,
          confidence: '100%',
          category: result.category,
          recommendedAction: result.recommendedAction,
          mode: 'LOG',
        },
      });
    }
    return result;
  }

  if (!needsReview(message, config)) return null;

  // Paid AI classification is rate-limited per user (protects the API
  // budget from spam floods). The profanity fast-path above is free.
  if (!classifyLimiter.allow(message.author.id)) return null;

  try {
    const result = await classify(content, {
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
      await notifyStaff(client, message, result);
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
      const ban = result.suggestedPunishment === 'BAN';
      await enforce(client, message, result, { ban });
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
