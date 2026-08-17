'use strict';

/*
 * Copyright © 2026 FGx.
 * All rights reserved.
 */

const { chatCompletion, AIUnavailableError } = require('./client');
const { guildConfigRepo } = require('../../database/repos/guildConfig');
const { matchesRepo, scrimsRepo, eventsRepo, clanWarsRepo } = require('../../database/repos/competitive');
const { RateLimiter } = require('../../utils/ratelimit');

/**
 * FGx community assistant (/ask, /ai, /bloxai).
 * Answers from the guild's configured system prompt plus *verified* internal
 * data (upcoming scrims, matches, roster size). It is explicitly forbidden
 * from inventing statistics or leaking secrets.
 */

const GUARDRAILS =
  'If you do not have verified data for a match result, player statistic, ranking, or BloxStrike fact, ' +
  'respond with: "I don\'t have verified data for that." Never invent numbers.';

const limiter = new RateLimiter({ max: 5, windowMs: 60_000 });

/** Build verified context from FGx's own database (never fabricated). */
function buildContext(client, guild) {
  const lines = [`Server: ${guild.name}`, `Members: ${guild.memberCount}`];

  try {
    const record = matchesRepo.record(guild.id);
    if (record && record.matches > 0) {
      lines.push(
        `FGx recorded competitive record: ${record.wins}W ${record.losses}L ${record.draws}D across ${record.matches} recorded match(es).`,
      );
    }
    const upcoming = scrimsRepo.list(guild.id, 'SCHEDULED').slice(0, 3);
    if (upcoming.length > 0) {
      lines.push(
        `Upcoming scrims: ${upcoming.map((s) => `${s.opponent} (${s.format})`).join(', ')}.`,
      );
    }
    const events = eventsRepo.list(guild.id, 'scheduled').slice(0, 3);
    if (events.length > 0) {
      lines.push(`Upcoming events: ${events.map((e) => `${e.title} (${e.type})`).join(', ')}.`);
    }
    const wars = clanWarsRepo.list(guild.id, 3);
    if (wars.length > 0) {
      lines.push(`Recent clan war(s): ${wars.map((w) => `${w.opponent} (${w.status})`).join(', ')}.`);
    }
  } catch {
    /* context is best-effort */
  }

  return lines.join('\n');
}

/**
 * Answer a community question.
 * @param {object} [options]
 * @param {string} [options.extraSystem] Extra guardrail/system lines.
 * @returns {Promise<string>}
 */
async function ask(client, guild, userId, question, { extraSystem } = {}) {
  if (!limiter.allow(userId)) {
    const { RateLimitError } = require('../../utils/errors');
    throw new RateLimitError('You are using the AI assistant too quickly. Please wait a minute.');
  }

  const config = guildConfigRepo.get(guild.id);
  if (!config.ai.assistantEnabled) {
    throw new AIUnavailableError('The AI assistant is disabled for this server.');
  }

  const system = [
    config.ai.systemPrompt || 'You are FGx, a helpful community assistant.',
    GUARDRAILS,
    ...(extraSystem ? [extraSystem] : []),
    `Verified FGx data (context, from FGx records only):\n${buildContext(client, guild)}`,
  ].join('\n\n');

  const reply = await chatCompletion({
    system,
    messages: [{ role: 'user', content: question.slice(0, 2000) }],
    maxTokens: 700,
    temperature: 0.4,
  });
  return reply.slice(0, 3800);
}

module.exports = { ask, buildContext, limiter };
