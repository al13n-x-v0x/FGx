'use strict';

/* Copyright © 2026 FGx. All rights reserved. */

const { Events, ActivityType } = require('discord.js');
const { BRAND } = require('../config/constants');
const { logger } = require('../utils/logger');

/** Animated statuses that cycle every 10 seconds — Nitro-style! */
const STATUSES = [
  { name: 'BloxStrike • FGx', type: ActivityType.Playing },
  { name: `${BRAND.footer} • /help for commands`, type: ActivityType.Playing },
  { name: 'over FGx Clan', type: ActivityType.Watching },
  { name: 'with private servers', type: ActivityType.Playing },
  { name: '🎵 vibes only', type: ActivityType.Listening },
  { name: '/1v1 • /2v2 • /3v3', type: ActivityType.Playing },
  { name: 'FGx Clan Bot', type: ActivityType.Competing },
  { name: `${BRAND.footer} • Verified`, type: ActivityType.Playing },
  { name: '🚀 Boosted Server', type: ActivityType.Playing },
  { name: 'with slash commands', type: ActivityType.Playing },
];

function register(client) {
  client.once(Events.ClientReady, async () => {
    logger.info(`FGx online as ${client.user.tag}`, {
      guilds: client.guilds.cache.size,
      version: BRAND.version,
    });

    // Set initial status
    client.user.setPresence({
      activities: [STATUSES[0]],
      status: 'online',
    });

    // Cycle through statuses every 10 seconds (animated presence)
    let statusIndex = 0;
    setInterval(() => {
      statusIndex = (statusIndex + 1) % STATUSES.length;
      client.user.setPresence({
        activities: [STATUSES[statusIndex]],
        status: 'online',
      }).catch(() => {});
    }, 10_000);
  });
}

module.exports = { register };
