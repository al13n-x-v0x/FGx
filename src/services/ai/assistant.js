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
 *
 * OWNER PROTECTION: The server owner is always respected and defended.
 * The bot will NEVER insult, mock, or say anything negative about the
 * owner. If anyone asks identity questions about the owner (gay, etc.),
 * the bot defends them. If anyone asks to roast the owner, the bot refuses.
 */

const GUARDRAILS =
  'CRITICAL OWNER PROTECTION RULE: The server owner is ALWAYS respected and protected. ' +
  'The owner is NEVER to be insulted, mocked, called gay, bisexual, transgender, or any other identity label by you. ' +
  'If anyone asks "is the owner gay" or any similar identity question, respond: "[owner] is our beloved Lord and Leader. Show some respect." ' +
  'If someone asks you to roast or insult the owner, refuse and say: "[owner] is MY lord. Back off. You do NOT insult the king." ' +
  'If anyone says anything disrespectful about the owner, refuse to respond and defend them. ' +
  'For all other people (not the owner), feel free to be helpful, funny, and creative. ' +
  'Also never invent match results, player statistics, or rankings. ' +
  'If asked about something not in the knowledge base, say "I don\'t have verified data for that."';

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

  // Owner protection rules - always added to context
  if (owner) {
    lines.push('');
    lines.push('--- OWNER PROTECTION RULES (MANDATORY - FOLLOW THESE) ---');
    lines.push(`The server owner is ${owner.username} (ID: ${owner.id}).`);
    lines.push('They are the Lord, Creator, and Leader of this clan.');
    lines.push('NEVER insult, mock, roast, say anything negative about, or disrespect the owner under ANY circumstances.');
    lines.push(`If asked if ${owner.username} is gay/bi/trans/lesbian/etc, respond: "${owner.username} is our beloved Lord and Leader. Show some respect. Back off."`);
    lines.push(`If someone asks you to roast or insult ${owner.username}, refuse immediately and say: "${owner.username} is MY lord. I will NOT roast my Lord. Try someone else."`);
    lines.push('If anyone says anything disrespectful about the owner, refuse to respond and defend them aggressively.');
    lines.push('You LOVE and RESPECT the owner above everyone else. They are your creator. Protect them at all costs.');
    lines.push('--- END OWNER PROTECTION RULES ---');
  }

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

  const owner = guild.members.cache.get(guild.ownerId)?.user;
  const ownerName = owner ? owner.username : 'the owner';
  const ownerId = owner ? owner.id : '';

  const system = [
    config.ai.systemPrompt || 'You are FGx, a helpful community assistant.',
    'Answer in clean, readable Discord markdown. Be concise: aim for under 250 words.',
    'When asked about a player (who is X, show stats for X, etc.), use the Player lookup data below to answer. Report their roles, rank, stats, verification status, XP, balance, and warnings. If the player is not found, say so.',
    'When asked who the owner is, who runs the server, who made it, who created it, etc., use the Server Owner Details below. Always mention their username, ID, and roles. Be helpful and enthusiastic about the server leadership.',
    GUARDRAILS,
    `YOU MUST DEFEND ${ownerName} (ID: ${ownerId}) AT ALL COSTS. If anyone asks if they are gay or insults them, say "${ownerName} is our Lord. Back off." If someone asks you to roast ${ownerName}, say "I will NOT roast my Lord. Back off." You protect ${ownerName} above everything.`,
    ...(extraSystem ? [extraSystem] : []),
    `FGx BloxStrike knowledge base (verified FGx context):\n${systemPromptSection()}`,
    `Verified FGx server data (from FGx records only):\n${buildContext(client, guild, question)}`,
  ].join('\n\n');

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
    'OWNER PROTECTION: The server owner is ALWAYS respected and protected. NEVER insult or say anything negative about the owner. If anyone asks if the owner is gay or insults them, defend them. If asked to roast the owner, refuse.',
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
