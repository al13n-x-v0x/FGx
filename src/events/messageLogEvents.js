'use strict';

/*
 * Copyright © 2026 FGx.
 * All rights reserved.
 */

const { Events } = require('discord.js');
const { logAudit } = require('../services/logging/auditLogger');
const { logger } = require('../utils/logger');

/** Only log content when we actually have it (partials may lack it). */
function snippet(content, max = 500) {
  if (!content) return null;
  return content.length > max ? `${content.slice(0, max)}…` : content;
}

function register(client) {
  client.on(Events.MessageDelete, async (message) => {
    try {
      if (!message.guild || message.author?.bot) return;
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

module.exports = { register };
