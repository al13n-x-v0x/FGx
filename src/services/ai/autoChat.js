'use strict';

/* Copyright © 2026 FGx. All rights reserved. */

/**
 * Auto-chat: the bot reads recent messages and decides whether to jump in.
 *
 * Triggers:
 *  1. Bot is @mentioned
 *  2. Someone says the bot's name ("FGx", "fgx")
 *  3. Random chance (~3%) when messages are interesting (questions, exclamations)
 *
 * The bot never floods — one response per channel per 60 seconds.
 * It pulls the last 15 messages for context so it can hold a real conversation.
 */

const { chatCompletion } = require('./client');
const { logger } = require('../../utils/logger');

/** Per-channel cooldown: timestamp of last auto-response. */
const cooldowns = new Map();
const COOLDOWN_MS = 60_000; // 1 minute between auto-responses per channel
const CONTEXT_WINDOW = 15;  // messages to fetch for context
const RANDOM_CHANCE = 0.03; // 3% chance to jump in on interesting messages

/** Words that indicate someone is talking TO the bot. */
const BOT_TRIGGERS = ['fgx', 'fgx bot', 'hey fgx', 'yo fgx', 'sup fgx'];

/** Patterns that indicate an interesting conversation worth jumping into. */
const INTERESTING_PATTERNS = [
  /\?$/, // ends with question mark
  /!{2,}/, // multiple exclamation marks
  /\b(help|how|what|why|who|where|when|which)\b/i, // question words
  /\b(lol|lmao|bruh|dead|ngl|fr|no way|omg)\b/i, // reactions that invite banter
  /\b(who|which).*(better|best|worse|worst|win|lose)\b/i, // comparison questions
];

/** System prompt for auto-chat — keeps the bot's personality consistent. */
const SYSTEM_PROMPT = `You are FGx, a witty, helpful Discord bot for the FGx BloxStrike clan. You're in a group chat.

PERSONALITY:
- Witty and playful, but not annoying
- Helpful when someone asks a real question
- competitive gaming humor (BloxStrike, Roblox, FPS games)
- Use 1-2 emojis max per message, don't overdo it
- Keep responses SHORT (1-2 sentences max)
- Never be cringe or try too hard
- You have a subtle dry humor

RULES:
- NEVER respond with just an emoji
- NEVER write essays — keep it conversational
- If someone asks something you don't know, say "idk" or make a joke
- Match the vibe of the conversation — if they're joking, joke back
- If someone is being toxic, don't engage — just ignore
- You can reference FGx features (coins, cats, etc) naturally
- Don't mention that you're an AI unless directly asked
- NEVER use the word "As an AI" or "I'm an AI"
- Keep it real, like a friend in the chat`;

/**
 * Decide if the bot should respond to this message.
 * @returns {{ shouldRespond: boolean, reason: string }}
 */
function shouldRespond(message, client) {
  const content = message.content.toLowerCase();
  const botId = client.user.id;

  // 1. Always respond when mentioned
  if (message.mentions.has(botId)) {
    return { shouldRespond: true, reason: 'mention' };
  }

  // 2. Respond if someone says the bot's name
  if (BOT_TRIGGERS.some(t => content.includes(t))) {
    return { shouldRespond: true, reason: 'name' };
  }

  // 3. Random chance on interesting messages
  if (INTERESTING_PATTERNS.some(p => p.test(message.content))) {
    if (Math.random() < RANDOM_CHANCE) {
      return { shouldRespond: true, reason: 'interesting' };
    }
  }

  return { shouldRespond: false, reason: 'none' };
}

/**
 * Build the context from recent messages.
 */
function buildContext(messages, currentMessage) {
  const lines = [];
  for (const msg of messages) {
    const name = msg.member?.displayName ?? msg.author?.username ?? 'Unknown';
    const isBot = msg.author?.bot;
    const prefix = isBot ? `[BOT: ${name}]` : `[${name}]`;
    lines.push(`${prefix} ${msg.content.slice(0, 300)}`);
  }
  // Add the current message as the latest
  const currentName = currentMessage.member?.displayName ?? currentMessage.author?.username ?? 'Unknown';
  lines.push(`[${currentName}] ${currentMessage.content.slice(0, 300)}`);
  return lines.join('\n');
}

/**
 * Main entry: called from messageCreate handler.
 * @param {Client} client
 * @param {Message} message
 * @returns {Promise<boolean>} true if the bot responded
 */
async function handle(client, message) {
  // Check cooldown
  const channelKey = message.channel.id;
  const lastResponse = cooldowns.get(channelKey) ?? 0;
  if (Date.now() - lastResponse < COOLDOWN_MS) return false;

  // Decide if we should respond
  const decision = shouldRespond(message, client);
  if (!decision.shouldRespond) return false;
  const { reason } = decision;

  // Don't respond to mentions of other bots
  if (reason === 'mention' && message.mentions.users.size > 1) return false;

  try {
    // Fetch recent messages for context
    let contextMessages = [];
    try {
      const fetched = await message.channel.messages.fetch({ limit: CONTEXT_WINDOW });
      contextMessages = [...fetched.values()]
        .filter(m => m.id !== message.id && !m.author.bot)
        .reverse() // oldest first
        .slice(-CONTEXT_WINDOW);
    } catch {
      // Can't fetch history — proceed with just the current message
    }

    const context = buildContext(contextMessages, message);

    // Add channel topic if available
    const channelTopic = message.channel.topic ? `\nChannel topic: ${message.channel.topic}` : '';

    const response = await chatCompletion({
      system: SYSTEM_PROMPT + channelTopic,
      messages: [{ role: 'user', content: context }],
      maxTokens: 200,
      temperature: 0.8,
    });

    if (!response || response.length < 2) return false;

    // Clean up the response — remove quotes, "FGx:" prefix, etc
    let cleaned = response
      .replace(/^["']|["']$/g, '')
      .replace(/^(FGx|Bot|Assistant):\s*/i, '')
      .trim();

    // Don't send if it looks like a refusal or meta-response
    if (/^(i can't|i cannot|as an ai|i'm sorry|i apologize)/i.test(cleaned)) return false;

    // Don't send if too long
    if (cleaned.length > 500) cleaned = cleaned.slice(0, 497) + '...';

    // Rate limit: set cooldown
    cooldowns.set(channelKey, Date.now());

    // Send the response
    await message.reply({ content: cleaned });

    logger.debug('auto-chat responded', {
      channelId: message.channel.id,
      reason,
      response: cleaned.slice(0, 80),
    });

    return true;
  } catch (err) {
    logger.warn('auto-chat failed', { error: err.message });
    return false;
  }
}

/** Clean up old cooldown entries every 10 minutes. */
setInterval(() => {
  const now = Date.now();
  for (const [key, ts] of cooldowns) {
    if (now - ts > 10 * 60_000) cooldowns.delete(key);
  }
}, 10 * 60_000);

module.exports = { handle, shouldRespond, SYSTEM_PROMPT };
