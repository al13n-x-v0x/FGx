'use strict';

/* Copyright © 2026 FGx. All rights reserved. */

const { env } = require('../../config/env');
const { logger } = require('../../utils/logger');

// Lazy-load minecraft-server-util — it has native deps that can hang on require.
let _mcUtil = null;
function getMcUtil() {
  if (!_mcUtil) _mcUtil = require('minecraft-server-util');
  return _mcUtil;
}

// Active monitors: Map<channelId, intervalId>
const monitors = new Map();

// ─── Standard Minecraft Server Query ────────────────────────────────────────

/**
 * Query a Minecraft server using the standard server list ping protocol.
 * Works with ANY MC server — vanilla, Paper, Aternos, etc.
 */
async function queryServer(host, port) {
  const serverHost = host || env.MC_SERVER_HOST;
  const serverPort = Number(port || env.MC_SERVER_PORT);

  // Quick DNS check — fail fast on bad hostnames.
  const dns = require('dns').promises;
  try {
    await dns.lookup(serverHost, { family: 4, timeout: 2000 });
  } catch {
    return {
      online: false,
      host: serverHost,
      port: serverPort,
      error: 'ENOTFOUND',
      message: `Server address "${serverHost}" not found. Set MC_SERVER_HOST to your actual server IP (e.g. yourserver.aternos.me).`,
    };
  }

  // Hard timeout wrapper — kill the query after 5 seconds no matter what.
  const queryPromise = getMcUtil().status(serverHost, serverPort, {
    timeout: 4000,
    enableSRV: true,
  });
  const timeoutPromise = new Promise((_, reject) => {
    setTimeout(() => reject(Object.assign(new Error('Query timed out'), { code: 'TIMEOUT' })), 5000);
  });

  try {
    const result = await Promise.race([queryPromise, timeoutPromise]);

    const rawVersion = result.version?.name ?? 'Unknown';
    const rawMotd = result.motd?.clean ?? result.motd?.raw ?? '';
    const onlinePlayers = result.players?.online ?? 0;

    // Aternos responds to MC queries even when the server is OFFLINE.
    // Detect this by checking the version string and MOTD for offline indicators.
    const isAternosOffline = (
      rawVersion.toLowerCase().includes('offline') ||
      rawVersion.includes('§c') ||
      rawMotd.toLowerCase().includes('server is offline') ||
      rawMotd.toLowerCase().includes('get this server more ram') ||
      rawMotd.includes('§c')
    );

    if (isAternosOffline) {
      return {
        online: false,
        host: serverHost,
        port: serverPort,
        error: 'ATERNOS_OFFLINE',
        message: 'Aternos proxy is responding but the actual Minecraft server is offline. Start it on Aternos.',
        rawVersion,
        rawMotd,
      };
    }

    return {
      online: true,
      host: serverHost,
      port: serverPort,
      version: rawVersion,
      protocol: result.version?.protocol ?? 0,
      motd: rawMotd,
      players: {
        online: onlinePlayers,
        max: result.players?.max ?? 0,
        sample: (result.players?.sample ?? []).map((p) => p.name ?? p.id ?? 'Unknown'),
      },
      favicon: result.favicon ?? null,
      latency: result.latency ?? 0,
      gamemode: result.gamemode ?? null,
      worldName: result.worldName ?? null,
    };
  } catch (err) {
    // Common errors: ECONNREFUSED (server offline), timeout, ENOTFOUND
    const code = err.code ?? 'UNKNOWN';
    return {
      online: false,
      host: serverHost,
      port: serverPort,
      error: code,
      message: humanizeError(code),
    };
  }
}

function humanizeError(code) {
  const map = {
    ECONNREFUSED: 'Server is offline or not accepting connections',
    ETIMEDOUT: 'Server did not respond in time (may be starting up)',
    ENOTFOUND: 'Server address not found — check the IP/port',
    EHOSTUNREACH: 'Cannot reach server — check firewall/port forwarding',
    TIMEOUT: 'Query timed out — server may be overloaded',
    'Unknown': 'Connection failed',
  };
  return map[code] || `Connection error: ${code}`;
}

// ─── Aternos Auto-Start (Playwright browser automation) ─────────────────

/** Lazy-loaded Playwright browser instance (reused across calls). */
let _browser = null;
let _browserLaunching = false;

async function getBrowser() {
  if (_browser && _browser.isConnected()) return _browser;
  if (_browserLaunching) {
    for (let i = 0; i < 60; i++) {
      if (_browser && _browser.isConnected()) return _browser;
      await new Promise(r => setTimeout(r, 500));
    }
  }
  _browserLaunching = true;
  try {
    // Check if playwright is even installed (not on Render free tier)
    let chromium;
    try {
      chromium = require('playwright').chromium;
    } catch {
      logger.info('aternos: playwright not installed — using manual start fallback');
      return null;
    }

    // Try system Chrome/Chromium first (lighter than downloading)
    const fs = require('fs');
    const systemPaths = [
      '/usr/bin/chromium',
      '/usr/bin/chromium-browser',
      '/usr/bin/google-chrome',
      '/usr/bin/google-chrome-stable',
      '/snap/bin/chromium',
    ];
    let execPath = null;
    for (const p of systemPaths) {
      if (fs.existsSync(p)) { execPath = p; break; }
    }

    _browser = await chromium.launch({
      headless: true,
      executablePath: execPath || undefined,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-gpu',
        '--single-process',
        '--no-zygote',
        '--disable-extensions',
        '--disable-background-networking',
      ],
    });
    logger.info('aternos: playwright browser launched', { execPath: execPath || 'bundled' });
    return _browser;
  } catch (err) {
    logger.warn('aternos: failed to launch browser', { error: err.message });
    return null;
  } finally {
    _browserLaunching = false;
  }
}

async function closeBrowser() {
  if (_browser) {
    try { await _browser.close(); } catch {}
    _browser = null;
  }
}

/**
 * Attempt to start an Aternos server using Playwright (real browser).
 * This bypasses Cloudflare by running a real Chromium instance.
 *
 * @returns {Promise<{success: boolean, message: string, manualUrl?: string}>}
 */
async function startAternos() {
  const username = env.ATERNOS_USERNAME;
  const password = env.ATERNOS_PASSWORD;
  const panelUrl = 'https://aternos.org/panel/';

  if (!username || !password) {
    return {
      success: false,
      message: 'Aternos credentials not configured. Set ATERNOS_USERNAME and ATERNOS_PASSWORD in Render env vars.',
      manualUrl: panelUrl,
    };
  }

  let context = null;
  try {
    const browser = await getBrowser();
    if (!browser) {
      return {
        success: false,
        message: '❌ Could not start browser. Playwright/Chromium may not be installed.\nClick below to start manually!',
        manualUrl: panelUrl,
      };
    }

    context = await browser.newContext({
      userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
      viewport: { width: 1280, height: 720 },
    });
    const page = await context.newPage();

    logger.info('aternos: navigating to login page');

    // Step 1: Navigate to login page
    await page.goto('https://aternos.org/login/', { waitUntil: 'networkidle', timeout: 30000 });

    // Wait for Cloudflare challenge to resolve (if any)
    try {
      await page.waitForSelector('input[name="username"], input#username, input[type="text"]', { timeout: 15000 });
    } catch {
      // Cloudflare might be challenging us — wait a bit
      logger.warn('aternos: waiting for Cloudflare challenge to resolve...');
      await page.waitForTimeout(5000);
      try {
        await page.waitForSelector('input[name="username"], input#username, input[type="text"]', { timeout: 15000 });
      } catch {
        return {
          success: false,
          message: '❌ Aternos Cloudflare challenge could not be solved.\nClick below to start manually!',
          manualUrl: panelUrl,
        };
      }
    }

    // Step 2: Fill login form
    logger.info('aternos: filling login form');
    await page.fill('input[name="username"], input#username, input[type="text"]', username);
    await page.fill('input[name="password"], input[type="password"]', password);

    // Click login button
    await page.click('button[type="submit"], input[type="submit"], .btn-login, #login-submit');
    await page.waitForLoadState('networkidle', { timeout: 15000 });

    // Check if we're on the panel page
    const currentUrl = page.url();
    logger.info('aternos: after login', { url: currentUrl });

    if (currentUrl.includes('login') || currentUrl.includes('challenge')) {
      return {
        success: false,
        message: '❌ Aternos login failed. Credentials may be incorrect or Cloudflare blocked us.\nClick below to start manually!',
        manualUrl: panelUrl,
      };
    }

    // Step 3: Navigate to panel and find start button
    if (!currentUrl.includes('panel')) {
      await page.goto(panelUrl, { waitUntil: 'networkidle', timeout: 15000 });
    }

    logger.info('aternos: on panel page, looking for start button');

    // Wait for the start button to appear
    try {
      await page.waitForSelector('.server-start-button, [data-a] .btn, .btn-start, #serverStart', { timeout: 15000 });
    } catch {
      // Try clicking any button that says "Start"
      try {
        await page.click('text=Start', { timeout: 5000 });
      } catch {
        return {
          success: false,
          message: '❌ Could not find the Start button on Aternos panel.\nClick below to start manually!',
          manualUrl: panelUrl,
        };
      }
    }

    // Click the start button
    const startSelectors = ['.server-start-button', '[data-a] .btn', '.btn-start', '#serverStart', 'text=Start'];
    for (const sel of startSelectors) {
      try {
        await page.click(sel, { timeout: 5000 });
        logger.info('aternos: clicked start button', { selector: sel });
        break;
      } catch {
        continue;
      }
    }

    // Wait for confirmation or status change
    await page.waitForTimeout(3000);

    // Check if server started successfully
    const pageContent = await page.content();
    if (pageContent.includes('starting') || pageContent.includes('Starting') ||
        pageContent.includes('waiting') || pageContent.includes('Loading')) {
      logger.info('aternos: server start confirmed');
      return {
        success: true,
        message: '🚀 Aternos server start confirmed! It usually takes 1-3 minutes to come online.',
      };
    }

    // If we got this far, the start was likely successful
    logger.info('aternos: start request sent (confirmation unclear)');
    return {
      success: true,
      message: '🚀 Aternos server start requested! It usually takes 1-3 minutes to come online.',
    };
  } catch (err) {
    logger.error('aternos: playwright start failed', { error: err.message });
    return {
      success: false,
      message: `❌ Aternos auto-start failed: ${err.message}\nClick below to start manually!`,
      manualUrl: panelUrl,
    };
  } finally {
    if (context) {
      try { await context.close(); } catch {}
    }
  }
}

/**
 * Check Aternos server status via their panel page (using Playwright).
 */
async function checkAternosStatus() {
  const username = env.ATERNOS_USERNAME;
  const password = env.ATERNOS_PASSWORD;

  if (!username || !password) return { configured: false };

  let context = null;
  try {
    const browser = await getBrowser();
    if (!browser) return { configured: true, status: 'unknown (no browser)' };

    context = await browser.newContext({
      userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
    });
    const page = await context.newPage();

    await page.goto('https://aternos.org/login/', { waitUntil: 'networkidle', timeout: 20000 });
    try {
      await page.waitForSelector('input[name="username"], input#username', { timeout: 10000 });
    } catch {
      await page.waitForTimeout(3000);
    }

    await page.fill('input[name="username"], input#username', username);
    await page.fill('input[name="password"], input[type="password"]', password);
    await page.click('button[type="submit"], input[type="submit"]');
    await page.waitForLoadState('networkidle', { timeout: 10000 });

    const html = await page.content();
    const statusMatch = html.match(/server-status[^>]*>([^<]+)/i);
    return { configured: true, status: statusMatch ? statusMatch[1].trim() : 'unknown' };
  } catch {
    return { configured: true, status: 'unknown' };
  } finally {
    if (context) {
      try { await context.close(); } catch {}
    }
  }
}

// ─── Auto-Monitor ───────────────────────────────────────────────────────────

/**
 * Start monitoring a Minecraft server. Pings every `intervalMs` and sends a
 * notification to the channel when the server comes online.
 *
 * @param {import('discord.js').TextChannel} channel
 * @param {string} host - Server host
 * @param {number} port - Server port
 * @param {number} intervalMs - How often to ping (default: 30s)
 * @param {number} maxChecks - Stop after this many checks (default: 60 = 30 min)
 * @returns {{ intervalId: NodeJS.Timeout, checks: number }}
 */
function startMonitor(channel, host, port, intervalMs = 30000, maxChecks = 60) {
  const key = channel.id;

  // Stop existing monitor for this channel
  if (monitors.has(key)) {
    clearInterval(monitors.get(key));
  }

  let checks = 0;

  const intervalId = setInterval(async () => {
    checks++;

    const result = await queryServer(host, port);

    if (result.online) {
      // Server is UP — notify and stop monitoring
      clearInterval(intervalId);
      monitors.delete(key);

      const { EmbedBuilder } = require('discord.js');
      const { BRAND } = require('../../config/constants');

      const embed = new EmbedBuilder()
        .setColor(BRAND.colors.success)
        .setTitle('🟢 Minecraft Server is ONLINE!')
        .setDescription(
          `**${env.MC_SERVER_NAME}** is ready to play!\n\n` +
          `**IP:** \`${host}:${port}\`\n` +
          `**Version:** ${result.version}\n` +
          `**Players:** ${result.players.online}/${result.players.max}\n` +
          (result.motd ? `**MOTD:** ${result.motd}\n` : '') +
          `\n*Monitoring stopped — server detected as online after ${checks} checks.*`
        )
        .setFooter({ text: `${BRAND.footer} • Auto-monitor` })
        .setTimestamp();

      await channel.send({ content: '@everyone 🟢 **Minecraft server is up!**', embeds: [embed] });
      logger.info('minecraft: monitor detected server online', { channel: channel.id, checks });
      return;
    }

    // Still offline — send periodic update every 5 checks (2.5 min)
    if (checks % 5 === 0 && checks < maxChecks) {
      const embed = new (require('discord.js').EmbedBuilder)()
        .setColor(0xf0a500)
        .setTitle('⏳ Minecraft Server Monitor')
        .setDescription(
          `Still waiting... **${env.MC_SERVER_NAME}** is offline.\n\n` +
          `**Check:** ${checks}/${maxChecks}\n` +
          `**Next check in:** ${intervalMs / 1000}s\n` +
          `**Error:** ${result.message || result.error || 'Server offline'}`
        )
        .setFooter({ text: `${require('../../config/constants').BRAND.footer} • Auto-monitor` })
        .setTimestamp();

      await channel.send({ embeds: [embed] }).catch(() => {});
    }

    // Max checks reached — stop
    if (checks >= maxChecks) {
      clearInterval(intervalId);
      monitors.delete(key);

      await channel.send({
        content: `⏰ **Monitor timed out** after ${maxChecks} checks. Server may need manual start on [Aternos](https://aternos.org).`,
      }).catch(() => {});
    }
  }, intervalMs);

  monitors.set(key, intervalId);
  return { intervalId, checks: 0 };
}

/**
 * Stop monitoring a channel.
 */
function stopMonitor(channelId) {
  if (monitors.has(channelId)) {
    clearInterval(monitors.get(channelId));
    monitors.delete(channelId);
    return true;
  }
  return false;
}

/**
 * Check if a channel is being monitored.
 */
function isMonitoring(channelId) {
  return monitors.has(channelId);
}

// ─── Auto-Restart Health Monitor ─────────────────────────────────────────

/** Health check state: tracks consecutive failures and last restart time. */
const healthState = {
  consecutiveFailures: 0,   // How many times in a row the server was unreachable
  lastRestartTime: 0,       // Timestamp of last restart trigger
  lastQueryTime: 0,         // Timestamp of last successful query
  latencySpikeCount: 0,     // Consecutive high-latency readings (RAM pressure indicator)
};

// Thresholds for auto-restart (RAM pressure indicators via latency/player proxy)
const HEALTH_CONFIG = {
  maxConsecutiveFailures: 3,  // Restart after 3 failed queries in a row (90s offline)
  maxLatencyMs: 2000,         // Latency spike threshold (server struggling)
  maxLatencySpikes: 5,        // Consecutive spikes before restart (2.5 min of lag)
  minRestartGapMs: 300000,    // Min 5 min between restarts to prevent loops
  checkIntervalMs: 30000,     // Check every 30 seconds
};

/**
 * Run a health check on the server and auto-restart if needed.
 * Checks: consecutive timeouts, latency spikes, player saturation.
 *
 * @param {Function} notifyFn - async (message) => void — sends to Discord
 */
async function healthCheck(notifyFn) {
  const host = env.MC_SERVER_HOST;
  const port = Number(env.MC_SERVER_PORT);
  const now = Date.now();

  const result = await queryServer(host, port);

  // ── Server is OFFLINE ──
  if (!result.online) {
    healthState.consecutiveFailures++;
    healthState.latencySpikeCount = 0;

    if (healthState.consecutiveFailures >= HEALTH_CONFIG.maxConsecutiveFailures) {
      const timeSinceRestart = now - healthState.lastRestartTime;
      if (timeSinceRestart > HEALTH_CONFIG.minRestartGapMs) {
        logger.warn('minecraft health: server offline, triggering auto-restart', {
          consecutiveFailures: healthState.consecutiveFailures,
          error: result.error,
        });
        await triggerRestart(notifyFn, 'Server went offline — auto-restarting');
      } else {
        logger.debug('minecraft health: restart suppressed (cooldown)', {
          cooldownRemaining: HEALTH_CONFIG.minRestartGapMs - timeSinceRestart,
        });
      }
    }
    return;
  }

  // ── Server is ONLINE — check health metrics ──
  healthState.consecutiveFailures = 0;
  healthState.lastQueryTime = now;

  const issues = [];

  // Check latency (high latency = server RAM/CPU struggling)
  if (result.latency > HEALTH_CONFIG.maxLatencyMs) {
    healthState.latencySpikeCount++;
    if (healthState.latencySpikeCount >= HEALTH_CONFIG.maxLatencySpikes) {
      issues.push(`High latency: ${result.latency}ms (${healthState.latencySpikeCount} consecutive spikes)`);
    }
  } else {
    healthState.latencySpikeCount = 0;
  }

  // Check if server is full (saturation = RAM pressure)
  if (result.players.max > 0 && result.players.online >= result.players.max) {
    issues.push(`Server full: ${result.players.online}/${result.players.max} — may need restart to free RAM`);
  }

  // If critical issues found and cooldown passed, restart
  if (issues.length > 0) {
    const timeSinceRestart = now - healthState.lastRestartTime;
    if (timeSinceRestart > HEALTH_CONFIG.minRestartGapMs) {
      logger.warn('minecraft health: issues detected, triggering auto-restart', { issues });
      await triggerRestart(notifyFn, issues.join('\n') + '\n\n🔄 Auto-restarting to free RAM...');
    }
  }
}

/**
 * Trigger an auto-restart of the Minecraft server via Aternos.
 */
async function triggerRestart(notifyFn, reason) {
  healthState.lastRestartTime = Date.now();

  const result = await startAternos();
  if (result.success) {
    const msg = [
      '🔄 **Auto-Restart Triggered!**',
      `**Reason:** ${reason}`,
      '',
      '🚀 Server is restarting on Aternos...',
      '📡 Monitoring for it to come back online.',
    ].join('\n');
    await notifyFn(msg).catch(() => {});
  } else {
    const msg = [
      '⚠️ **Auto-Restart Failed!**',
      `**Reason:** ${reason}`,
      `**Error:** ${result.message}`,
      '',
      ' manual restart may be needed on [Aternos](https://aternos.org).',
    ].join('\n');
    await notifyFn(msg).catch(() => {});
  }
}

/** Get current health status (for /minecraft status command). */
function getHealthStatus() {
  return { ...healthState };
}

// ─── Cookie Helpers ─────────────────────────────────────────────────────────

function extractCookies(response) {
  const setCookies = response.headers.getSetCookie?.() ?? [];
  return setCookies
    .map((c) => c.split(';')[0])
    .filter(Boolean)
    .join('; ');
}

function mergeCookies(existing, response) {
  const newCookies = extractCookies(response);
  if (!newCookies) return existing;
  const merged = { ...parseCookieString(existing), ...parseCookieString(newCookies) };
  return Object.entries(merged).map(([k, v]) => `${k}=${v}`).join('; ');
}

function parseCookieString(str) {
  const map = {};
  if (!str) return map;
  str.split('; ').forEach((part) => {
    const [key, ...rest] = part.split('=');
    if (key) map[key.trim()] = rest.join('=');
  });
  return map;
}

module.exports = {
  queryServer,
  startAternos,
  checkAternosStatus,
  startMonitor,
  stopMonitor,
  isMonitoring,
  healthCheck,
  getHealthStatus,
  triggerRestart,
  healthState,
  HEALTH_CONFIG,
};
