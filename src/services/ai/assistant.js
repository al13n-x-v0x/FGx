'use strict';

/*
 * Copyright © 2026 FGx.
 * All rights reserved.
 */

const { chatCompletion, AIUnavailableError } = require('./client');
const { guildConfigRepo } = require('../../database/repos/guildConfig');
const { matchesRepo, scrimsRepo, eventsRepo, clanWarsRepo } = require('../../database/repos/competitive');
const { systemPromptSection } = require('../../data/bloxstrike');
const { RateLimiter } = require('../../utils/ratelimit');
const { lookupPlayer, detectPlayerQuery } = require('./playerLookup');

/**
 * FGx community assistant (/ask, /ai, /bloxai).
 * Answers from the guild's configured system prompt, the FGx BloxStrike
 * knowledge base (verified context for loadout/strategy questions), and
 * *verified* internal data (upcoming scrims, matches, roster size). It is
 * explicitly forbidden from inventing statistics or leaking secrets.
 */

const GUARDRAILS =
  'Answer loadout, role, economy, utility, and strategy questions using the FGx BloxStrike ' +
  'knowledge base below. Never invent match results, player statistics, rankings, or specific ' +
  'numeric stats that are not in the provided knowledge. If asked about something not covered ' +
  'by the verified FGx context, respond with: "I don\'t have verified data for that."';

const limiter = new RateLimiter({ max: 5, windowMs: 60_000 });

/** Build verified context from FGx's own database (never fabricated). */
function buildContext(client, guild, question) {
  const owner = guild.members.cache.get(guild.ownerId)?.user;
  const lines = [
    `Server: ${guild.name}`,
    `Server ID: ${guild.id}`,
    `Members: ${guild.memberCount}`,
    `Owner: ${owner ? `${owner.username} (ID: ${owner.id})` : `ID: ${guild.ownerId}`}`,
    `Created: ${guild.createdAt.toISOString()}`,
    `Boost Level: ${guild.premiumTier} (${guild.premiumSubscriptionCount ?? 0} boosts)`,
    `Roles: ${guild.roles.cache.size}`,
    `Channels: ${guild.channels.cache.size}`,
    `Emojis: ${guild.emojis.cache.size}`,
  ];

  // If the question is about the owner, add extra detail
  const q = question.toLowerCase();
  if (q.includes('owner') || q.includes('who made') || q.includes('who runs') || q.includes('who created') || q.includes('admin') || q.includes('leader')) {
    if (owner) {
      lines.push(`\n--- Server Owner Details ---`);
      lines.push(`Username: ${owner.username}`);
      lines.push(`Display Name: ${owner.displayName}`);
      lines.push(`User ID: ${owner.id}`);
      lines.push(`Account Created: ${owner.createdAt.toISOString()}`);
      lines.push(`Avatar: ${owner.displayAvatarURL({ size: 256 })}`);
      const member = guild.members.cache.get(owner.id);
      if (member) {
        lines.push(`Joined Server: ${member.joinedAt?.toISOString()}`);
        lines.push(`Roles: ${member.roles.cache.filter(r => r.id !== guild.id).map(r => r.name).join(', ') || 'None'}`);
        lines.push(`Highest Role: ${member.roles.highest?.name}`);
        lines.push(`Boosting: ${member.premiumSince ? 'Yes since ' + member.premiumSince.toISOString() : 'No'}`);
      }
    }
  }

  // If asking about who someone is, look them up
  if (q.includes('who is') || q.includes('who\'s') || q.includes('tell me about')) {
    const memberQuery = detectPlayerQuery(guild, question);
    if (memberQuery) {
      try {
        const member = memberQuery.member;
        lines.push(`\n--- User Details: ${member.user.username} ---`);
        lines.push(`User ID: ${member.user.id}`);
        lines.push(`Display Name: ${member.user.displayName}`);
        lines.push(`Account Created: ${member.user.createdAt.toISOString()}`);
        lines.push(`Joined Server: ${member.joinedAt?.toISOString()}`);
        lines.push(`Roles: ${member.roles.cache.filter(r => r.id !== guild.id).map(r => r.name).join(', ') || 'None'}`);
        lines.push(`Highest Role: ${member.roles.highest?.name}`);
        lines.push(`Nickname: ${member.nickname || 'None'}`);
        lines.push(`Boosting: ${member.premiumSince ? 'Yes' : 'No'}`);
        lines.push(`Bot: ${member.user.bot ? 'Yes' : 'No'}`);
      } catch {
        /* lookup failed */
      }
    }
  }

  // If the question is about a specific player, look them up.
  const playerQuery = detectPlayerQuery(guild, question);
  if (playerQuery) {
    try {
      const playerData = lookupPlayer(guild, playerQuery.member.id);
      lines.push(`\n--- Player lookup: ${playerQuery.member.user.username} ---`);
      lines.push(playerData);
    } catch {
      lines.push(`\nPlayer lookup failed for: ${playerQuery.query}`);
    }
  }

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
    'Answer in clean, readable Discord markdown. Be concise: aim for under 250 words.',
    'When asked about a player (who is X, show stats for X, etc.), use the Player lookup data below to answer. Report their roles, rank, stats, verification status, XP, balance, and warnings. If the player is not found, say so.',
    'When asked who the owner is, who runs the server, who made it, who created it, etc., use the Server Owner Details below. Always mention their username, ID, and roles. Be helpful and enthusiastic about the server leadership.',
    GUARDRAILS,
    ...(extraSystem ? [extraSystem] : []),
    `FGx BloxStrike knowledge base (verified FGx context):\n${systemPromptSection()}`,
    `Verified FGx server data (from FGx records only):\n${buildContext(client, guild, question)}`,
  ].join('\n\n');

  // Generous budget: thinking-capable models spend tokens on internal
  // reasoning before producing the visible answer, so a tight cap truncates
  // it mid-sentence. The final reply is still bounded for Discord.
  const reply = await chatCompletion({
    system,
    messages: [{ role: 'user', content: question.slice(0, 2000) }],
    maxTokens: 1500,
    temperature: 0.4,
  });
  return reply.slice(0, 3800);
}

/**
 * Lightweight chat wrapper for commands that don't have guild/client objects.
 * Calls chatCompletion directly with a simplified prompt.
 */
async function chat(prompt, { system, user, guild } = {}) {
  const s = [
    system || 'You are FGx, a helpful, witty community assistant for a competitive gaming Discord server called BloxStrike Clan.',
    'Answer in clean, readable Discord markdown. Be concise: aim for under 250 words.',
    guild ? `You are chatting in the Discord server: ${guild}.` : '',
    user ? `The user asking is: ${user}.` : '',
  ].filter(Boolean).join('\n\n');

  const reply = await chatCompletion({
    system: s,
    messages: [{ role: 'user', content: prompt.slice(0, 2000) }],
    maxTokens: 800,
    temperature: 0.4,
  });
  return reply.slice(0, 3800);
}

module.exports = { ask, chat, buildContext, limiter };
