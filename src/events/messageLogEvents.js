'use strict';

/* Copyright © 2026 FGx. All rights reserved. */

const { Events } = require('discord.js');
const { logAudit } = require('../services/logging/auditLogger');
const { logger } = require('../utils/logger');

/** Cache of last deleted messages per channel (for /snipe). */
const snipeCache = new Map();
const MAX_SNIPE_CACHE = 50; // per channel, keep last 5
const SNIPE_TTL = 5 * 60 * 1000; // 5 minutes

/** Only log content when we actually have it (partials may lack it). */
function snippet(content, max = 500) {
  if (!content) return null;
  return content.length > max ? `${content.slice(0, max)}…` : content;
}

function register(client) {
  client.on(Events.MessageDelete, async (message) => {
    try {
      if (!message.guild || message.author?.bot) return;

      // Cache for snipe command
      if (message.content || message.embeds.length > 0) {
        const channelId = message.channel.id;
        if (!snipeCache.has(channelId)) snipeCache.set(channelId, []);
        const cached = snipeCache.get(channelId);
        cached.unshift({
          author: { id: message.author.id, tag: message.author.tag, avatar: message.author.displayAvatarURL?.({ size: 128 }) },
          content: message.content || null,
          embeds: message.embeds.map(e => e.toJSON?.() ?? null).filter(Boolean),
          attachments: [...(message.attachments?.values() ?? [])].map(a => a.url),
          channel: message.channel.name ?? message.channel.id,
          timestamp: Date.now(),
        });
        if (cached.length > MAX_SNIPE_CACHE) cached.pop();
      }

      await logAudit(client, message.guild, {
        action: 'message_delete',
        target: message.author,
        moderator: null,
        details: {
          channel: message.channel.name ?? message.channel.id,
          content: snippet(message.content) ?? '(not cached)',
        },
      });
    } catch (err) {
      logger.warn('messageDelete log failed', { error: err.message });
    }
  });

  client.on(Events.MessageUpdate, async (oldMessage, newMessage) => {
    try {
      if (!newMessage.guild || newMessage.author?.bot) return;
      if (oldMessage.content === newMessage.content) return;
      await logAudit(client, newMessage.guild, {
        action: 'message_edit',
        target: newMessage.author,
        moderator: null,
        details: {
          channel: newMessage.channel.name ?? newMessage.channel.id,
          before: snippet(oldMessage.content) ?? '(not cached)',
          after: snippet(newMessage.content),
        },
      });
    } catch (err) {
      logger.warn('messageUpdate log failed', { error: err.message });
    }
  });
}

/** Get the snipe cache for a channel. */
function getSnipeCache(channelId) {
  const cached = snipeCache.get(channelId) || [];
  const now = Date.now();
  // Filter out expired entries
  const valid = cached.filter(e => now - e.timestamp < SNIPE_TTL);
  snipeCache.set(channelId, valid);
  return valid;
}

module.exports = { register, getSnipeCache };
