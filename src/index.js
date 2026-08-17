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
const dashboard = require('./dashboard/server');

// Gateway intents. 'full' (default) needs the privileged intents enabled in
// the Discord Developer Portal; 'basic' drops them so the bot can run on a
// fresh application — welcome/anti-raid events and message-content scanning
// degrade, everything else works.
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

/** Graceful shutdown: close the gateway, DB, and dashboard. */
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

  // Database first — everything depends on it.
  db.init();

  // Load commands and event handlers.
  client.commands = loadCommands();
  loadEvents(client);

  // Global error boundaries — a single failure must never kill the bot.
  process.on('unhandledRejection', (reason) => {
    logger.error('unhandled rejection', { error: reason instanceof Error ? reason.message : String(reason) });
  });
  process.on('uncaughtException', (err) => {
    logger.error('uncaught exception', { error: err.message, stack: err.stack });
  });
  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('SIGTERM', () => shutdown('SIGTERM'));

  // Register slash commands, then connect.
  await registerCommands(client);
  await client.login(env.DISCORD_TOKEN);

  dashboard.start(client);
  logger.info('FGx startup complete');
}

main().catch((err) => {
  if (/disallowed intents/i.test(err.message)) {
    logger.error('gateway refused: privileged intents are not enabled for this application', {
      hint: 'Enable Server Members + Message Content intents in the Discord Developer Portal ' +
        '(Applications > your app > Bot > Privileged Gateway Intents), or set DISCORD_INTENTS=basic ' +
        'to run without them.',
    });
  } else {
    logger.error('fatal startup error', { error: err.message, stack: err.stack });
  }
  process.exit(1);
});

module.exports = { client };
