'use strict';

/* Copyright © 2026 FGx. All rights reserved. */

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
    db.close();    client.destroy();
    logger.info('shutdown: complete');
    process.exit(0);
  } catch (err) {
    logger.error('shutdown failed', { error: err.message });
    process.exit(1);
  }
}

// Connect to Discord with auto-retry (never blocks the health endpoint).
async function connectDiscord(attempt = 1) {
  try {
    logger.info(`Discord: connecting (attempt ${attempt})...`);
    // Timeout login after 15s — prevents hanging if gateway is unreachable.
    const loginPromise = client.login(env.DISCORD_TOKEN);
    const loginTimeout = new Promise((_, reject) => {
      setTimeout(() => reject(Object.assign(new Error('Login timed out after 15s'), { code: 'LOGIN_TIMEOUT' })), 15_000);
    });
    await Promise.race([loginPromise, loginTimeout]);
    logger.info('Discord: logged in successfully');

    // Register slash commands AFTER login, non-blocking.
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
    } else if (/token/i.test(err.message) || /unauthorized/i.test(err.message)) {
      logger.error('Discord token is invalid — check DISCORD_TOKEN env var', { error: err.message });
    } else {
      logger.error('Discord login error', { error: err.message });
    }
    logger.info(`Discord: retrying in 30s... (attempt ${attempt})`);
    setTimeout(() => connectDiscord(attempt + 1), 30_000);
  }
}

/** Auto-monitor the Minecraft server on the first guild's general channel. */
async function startMinecraftAutoMonitor() {
  try {
    const mcHost = env.MC_SERVER_HOST;
    const mcPort = Number(env.MC_SERVER_PORT);
    if (!mcHost || !mcPort) return;

    // Find the first guild and its best channel to notify.
    const guild = client.guilds.cache.first();
    if (!guild) return;

    // Look for a channel named 'general', 'chat', 'lobby', or use system channel.
    const preferred = ['general', 'chat', 'lobby', 'welcome', 'announcements'];
    let channel = null;
    for (const name of preferred) {
      channel = guild.channels.cache.find(
        (c) => c.name === name && c.isTextBased() && c.permissionsFor(guild.members.me)?.has('SendMessages'),
      );
      if (channel) break;
    }
    if (!channel) channel = guild.systemChannel;
    if (!channel) return;

    // Check if server is already online.
    const mcService = require('./services/minecraft/minecraftService');
    const quickCheck = await mcService.queryServer(mcHost, mcPort);

    if (quickCheck.online) {
      logger.info('minecraft: server already online on startup', { host: mcHost, port: mcPort });
      return; // No need to monitor — it's already up.
    }

    // Server is offline — start monitoring (pings every 30s, notifies when UP).
    logger.info('minecraft: server offline on startup, starting auto-monitor', {
      host: mcHost,
      port: mcPort,
      channel: channel.name,
    });

    mcService.startMonitor(channel, mcHost, mcPort, 30_000, 120); // 120 checks = 60 min max

    // Try to auto-start via Aternos if credentials are configured.
    if (env.ATERNOS_USERNAME && env.ATERNOS_PASSWORD) {
      const startResult = await mcService.startAternos();
      if (startResult.success) {
        await channel.send({
          embeds: [new (require('discord.js').EmbedBuilder)()
            .setTitle('🚀 Server Auto-Started')
            .setDescription(`**${env.MC_SERVER_NAME}** started on Aternos!\nMonitoring for it to come online...`)
            .setColor(0x00ff00)
            .setFooter({ text: 'FGx • Auto-start' })],
          components: [new (require('discord.js').ActionRowBuilder()).addComponents(
            new (require('discord.js').ButtonBuilder())
              .setURL('https://aternos.org/panel/')
              .setLabel('🌐 Open Aternos Panel')
              .setStyle(require('discord.js').ButtonStyle.Link),
          )],
        }).catch(() => {});
      } else {
        // Auto-start failed (likely Cloudflare) — notify with manual link
        logger.warn('aternos: auto-start failed on startup', { message: startResult.message });
        const manualUrl = startResult.manualUrl || 'https://aternos.org/panel/';
        await channel.send({
          embeds: [new (require('discord.js').EmbedBuilder)()
            .setTitle('⚠️ Auto-Start Blocked by Cloudflare')
            .setDescription(
              `Aternos is blocking automated access.\n\n` +
              `**Click the button below to start your server manually.**\n` +
              `I'll keep monitoring and notify you when it's online!`
            )
            .setColor(0xff6600)
            .setFooter({ text: 'FGx • Manual start required' })],
          components: [new (require('discord.js').ActionRowBuilder()).addComponents(
            new (require('discord.js').ButtonBuilder())
              .setLabel('🚀 Start Server Manually')
              .setURL(manualUrl)
              .setStyle(require('discord.js').ButtonStyle.Link),
          )],
        }).catch(() => {});
      }
    } else {
      logger.info('minecraft: no Aternos credentials — monitoring only (no auto-start)', {
        hint: 'Set ATERNOS_USERNAME and ATERNOS_PASSWORD in Render to enable auto-start',
      });
    }
  } catch (err) {
    logger.error('minecraft: auto-monitor setup failed', { error: err.message });
  }
}

/** Start the MC health monitor that checks every 30s and auto-restarts on RAM spikes. */
function startMinecraftHealthMonitor() {
  const mcHost = env.MC_SERVER_HOST;
  const mcPort = Number(env.MC_SERVER_PORT);
  if (!mcHost || !mcPort) return;

  const guild = client.guilds.cache.first();
  if (!guild) return;

  // Find the same notification channel.
  const preferred = ['general', 'chat', 'lobby', 'welcome', 'announcements'];
  let notifyChannel = null;
  for (const name of preferred) {
    notifyChannel = guild.channels.cache.find(
      (c) => c.name === name && c.isTextBased() && c.permissionsFor(guild.members.me)?.has('SendMessages'),
    );
    if (notifyChannel) break;
  }
  if (!notifyChannel) notifyChannel = guild.systemChannel;
  if (!notifyChannel) return;

  const mcService = require('./services/minecraft/minecraftService');
  const { HEALTH_CONFIG } = mcService;

  logger.info('minecraft: health monitor started', {
    interval: `${HEALTH_CONFIG.checkIntervalMs / 1000}s`,
    autoRestartOnFail: HEALTH_CONFIG.maxConsecutiveFailures,
    latencyThreshold: `${HEALTH_CONFIG.maxLatencyMs}ms`,
  });

  const intervalId = setInterval(async () => {
    try {
      await mcService.healthCheck(async (msg) => {
        await notifyChannel.send({ content: msg }).catch(() => {});
      });
    } catch (err) {
      logger.error('minecraft: health check error', { error: err.message });
    }
  }, HEALTH_CONFIG.checkIntervalMs);

  // Cleanup on shutdown.
  process.on('SIGTERM', () => clearInterval(intervalId));
  process.on('SIGINT', () => clearInterval(intervalId));
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

  // Auto-reconnect on gateway disconnect.
  client.on('disconnect', (event) => {
    logger.warn('Discord disconnected', { code: event.code, reason: event.reason });
    setTimeout(() => connectDiscord(), 30_000);
  });

  client.on('ready', () => {
    logger.info(`Discord bot ready — serving ${client.guilds.cache.size} guild(s)`, {
      user: client.user?.tag,
      id: client.user?.id,
    });

    // (Minecraft auto-monitor removed — /minecraft command deleted)
  });

  // Catch gateway errors to prevent silent failures.
  client.on('error', (err) => {
    logger.error('Discord gateway error', { error: err.message });
  });

  client.on('warn', (msg) => {
    logger.warn('Discord gateway warning', { message: msg });
  });

  // Auto-sweep expired Roblox verification codes every 2 minutes.
  const robloxService = require('./services/community/robloxService');
  setInterval(() => robloxService.sweepExpiredCodes(), 2 * 60 * 1000);

  // Auto-sweep expired giveaways every 30 seconds.
  const giveawayService = require('./services/community/giveawayService');
  setInterval(() => giveawayService.sweep(client), 30 * 1000);

  // Self-pinger: keep Render free-tier awake (pings /health every 1 min).
  const PING_INTERVAL_MS = 1 * 60 * 1000;
  setInterval(() => {
    const port = Number(process.env.PORT || env.WEBHOOK_PORT);
    const url = `http://127.0.0.1:${port}/health`;
    fetch(url).catch(() => {});
  }, PING_INTERVAL_MS);

  logger.info('FGx startup complete');

  // Connect to Discord LAST — dashboard is already accepting health checks.
  if (env.DISCORD_TOKEN && env.DISCORD_TOKEN.length >= 20) {
    connectDiscord();
  } else {
    logger.error('DISCORD_TOKEN is missing or invalid — bot cannot connect to Discord');
  }

  // Bind MC start credentials to the client for the /minecraft embed
  client[Symbol.for('mcServerId')] = env.ATERNOS_USERNAME || 'FGXstart';
  client[Symbol.for('mcServerPass')] = env.ATERNOS_PASSWORD || 'FGXBLOXSTRIKE';
}

main().catch((err) => {
  logger.error('fatal startup error', { error: err.message, stack: err.stack });
  process.exit(1);
});

module.exports = { client };
