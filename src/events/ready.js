'use strict';

/*
 * Copyright © 2026 FGx.
 * All rights reserved.
 */

const { Events, ActivityType } = require('discord.js');
const { BRAND } = require('../config/constants');
const { logger } = require('../utils/logger');

function register(client) {
  client.once(Events.ClientReady, async () => {
    logger.info(`FGx online as ${client.user.tag}`, {
      guilds: client.guilds.cache.size,
      version: BRAND.version,
    });
    client.user.setPresence({
      activities: [{ name: 'BloxStrike • FGx', type: ActivityType.Playing }],
      status: 'online',
    });
  });
}

module.exports = { register };
