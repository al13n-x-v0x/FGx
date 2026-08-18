'use strict';

/*
 * Copyright © 2026 FGx.
 * All rights reserved.
 */

const { Client, GatewayIntentBits, Partials } = require('discord.js');
const { env } = require('./config/env');
const { logger } = require('./utils/logger');
const db = require('./database');
const { loadCommands, loadEvents, registerCommands } = require('./utils/registry');
const privateServerService = require('./services/clan/privateServerService');
const dashboard = require('./dashboard/server');

// Gateway intents.
const intents = [
  GatewayIntentBits.Guilds,
  GatewayIntentBits.GuildMessages,
  GatewayIntentBits.GuildModeration,
];
if (env.DISCORD_INTENTS !== 'basic') {
  intents.push(GatewayIntentBits.GuildMembers, GatewayIntentBits.MessageContent);
}

const client = new Client({
  intents,
  partials: [Partials.Channel, Partials.Message, Partials.GuildMember, Partials.User],
});

let shuttingDown = false;

/** Graceful shutdown. */
async function shutdown(signal) {
  if (shuttingDown) return;
  shuttingDown = true;
  logger.info(`shutdown: received ${signal}`);
  try {
    dashboard.stop();
    db.close();
    client.destroy();
    logger.info('shutdown: complete');
    process.exit(0);
  } catch (err) {
    logger.error('shutdown failed', { error: err.message });
    process.exit(1);
  }
}

async function main() {
  logger.info(`FGx v${require('../package.json').version} starting`, { node: process.version, env: env.NODE_ENV });

  // Database first.
  db.init();

  // Load commands and event handlers.
  client.commands = loadCommands();
  loadEvents(client);

  // Global error boundaries.
  process.on('unhandledRejection', (reason) => {
    logger.error('unhandled rejection', { error: reason instanceof Error ? reason.message : String(reason) });
  });
  process.on('uncaughtException', (err) => {
    logger.error('uncaught exception', { error: err.message, stack: err.stack });
  });
  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('SIGTERM', () => shutdown('SIGTERM'));

  // Start health-check endpoint BEFORE Discord login.
  dashboard.start(client);
  logger.info('Web dashboard server started');

  // ✅ Connect to Discord FIRST — don't let registerCommands block this.
  try {
    await client.login(env.DISCORD_TOKEN);
    logger.info('Discord client logged in successfully');

    // ✅ Register slash commands AFTER login, non-blocking.
    registerCommands(client)
      .then(() => logger.info('Slash commands registered'))
      .catch((err) => logger.error('Failed to register slash commands', { error: err.message }));

    // Clean up expired private servers.
    privateServerService.sweep(client).catch((err) =>
      logger.warn('private server sweep failed', { error: err.message }),
    );
  } catch (err) {
    if (/disallowed intents/i.test(err.message)) {
      logger.error('gateway refused: privileged intents not enabled', {
        hint: 'Enable Server Members + Message Content intents in the Discord Developer Portal, or set DISCORD_INTENTS=basic',
      });
    } else {
      logger.error('Discord login error', { error: err.message, stack: err.stack });
    }
  }

  // Auto-sweep expired Roblox verification codes every 2 minutes.
  const robloxService = require('./services/community/robloxService');
  setInterval(() => robloxService.sweepExpiredCodes(), 2 * 60 * 1000);

  // Self-pinger: keep Render free-tier awake.
  const PING_INTERVAL_MS = 1 * 60 * 1000;
  setInterval(() => {
    const port = Number(process.env.PORT || env.WEBHOOK_PORT);
    const url = `http://127.0.0.1:${port}/health`;
    fetch(url).catch(() => {});
  }, PING_INTERVAL_MS);

  logger.info('FGx startup complete');
}

main().catch((err) => {
  logger.error('fatal startup error', { error: err.message, stack: err.stack });
  process.exit(1);
});

module.exports = { client };
