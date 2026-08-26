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

    return {
      online: true,
      host: serverHost,
      port: serverPort,
      version: result.version?.name ?? 'Unknown',
      protocol: result.version?.protocol ?? 0,
      motd: result.motd?.clean ?? result.motd?.raw ?? '',
      players: {
        online: result.players?.online ?? 0,
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

// ─── Aternos Auto-Start (unofficial API) ────────────────────────────────────

/**
 * Attempt to start an Aternos server via their unofficial web API.
 * NOTE: Aternos uses Cloudflare bot protection which often blocks requests from
 * cloud servers like Render. This method tries with browser-like headers but may
 * fail — in that case, it returns a manual start link for the user.
 *
 * @returns {Promise<{success: boolean, message: string, manualUrl?: string}>}
 */
async function startAternos() {
  const username = env.ATERNOS_USERNAME;
  const password = env.ATERNOS_PASSWORD;
  const serverName = env.MC_SERVER_HOST?.replace('.aternos.me', '') || '';

  if (!username || !password) {
    return {
      success: false,
      message: 'Aternos credentials not configured. Set ATERNOS_USERNAME and ATERNOS_PASSWORD in Render env vars.',
      manualUrl: 'https://aternos.org/panel/',
    };
  }

  const BASE = 'https://aternos.org';
  const panelUrl = `${BASE}/panel/`;

  // Browser-like headers to bypass basic Cloudflare checks
  const fetchOpts = {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
      'Accept-Language': 'en-US,en;q=0.9',
      'Accept-Encoding': 'gzip, deflate, br',
      'Cache-Control': 'no-cache',
      'Sec-Ch-Ua': '"Not_A Brand";v="8", "Chromium";v="120", "Google Chrome";v="120"',
      'Sec-Ch-Ua-Mobile': '?0',
      'Sec-Ch-Ua-Platform': '"Windows"',
      'Sec-Fetch-Dest': 'document',
      'Sec-Fetch-Mode': 'navigate',
      'Sec-Fetch-Site': 'none',
      'Sec-Fetch-User': '?1',
      'Upgrade-Insecure-Requests': '1',
    },
    redirect: 'follow',
  };

  // Retry up to 2 times (Cloudflare sometimes allows on retry)
  for (let attempt = 1; attempt <= 2; attempt++) {
    try {
      logger.info('aternos: login attempt', { attempt });

      // Step 1: Get login page
      const loginPage = await fetch(`${BASE}/login/`, { ...fetchOpts, method: 'GET' });
      const loginHtml = await loginPage.text();
      const cookies = extractCookies(loginPage);

      // Check for Cloudflare challenge (indicates bot detection)
      if (loginHtml.includes('cf-challenge') || loginHtml.includes('Just a moment') ||
          loginHtml.includes('challenge-platform') || loginPage.status === 403) {
        logger.warn('aternos: Cloudflare challenge detected', { attempt });
        if (attempt < 2) {
          await new Promise(r => setTimeout(r, 2000));
          continue;
        }
        return {
          success: false,
          message: '❌ Aternos is blocking automated access (Cloudflare protection).\n' +
                   'Click the button below to start your server manually!',
          manualUrl: panelUrl,
        };
      }

      // Extract CSRF token
      const tokenMatch = loginHtml.match(/name="token"\s+value="([^"]+)"/);
      const token = tokenMatch ? tokenMatch[1] : '';

      // Step 2: Submit login
      const formData = new URLSearchParams();
      formData.append('username', username);
      formData.append('password', password);
      formData.append('token', token);
      formData.append('remember', '1');

      const loginResp = await fetch(`${BASE}/login/`, {
        ...fetchOpts,
        method: 'POST',
        body: formData,
        headers: {
          ...fetchOpts.headers,
          'Content-Type': 'application/x-www-form-urlencoded',
          'Cookie': cookies,
          'Origin': BASE,
          'Referer': `${BASE}/login/`,
        },
      });

      const loginCookies = mergeCookies(cookies, loginResp);

      // Check login result
      if (loginResp.status >= 400 && loginResp.status < 500) {
        return {
          success: false,
          message: '❌ Aternos login failed — the credentials may be blocked by Cloudflare bot protection.\n' +
                   'Click below to start your server manually!',
          manualUrl: panelUrl,
        };
      }

      // Step 3: Get server panel
      const panelResp = await fetch(panelUrl, {
        ...fetchOpts,
        method: 'GET',
        headers: { ...fetchOpts.headers, Cookie: loginCookies },
      });
      const panelHtml = await panelResp.text();
      const panelCookies = mergeCookies(loginCookies, panelResp);

      // Check if panel is Cloudflare challenged
      if (panelHtml.includes('cf-challenge') || panelHtml.includes('Just a moment')) {
        return {
          success: false,
          message: '❌ Aternos panel blocked by Cloudflare bot protection.\n' +
                   'Click below to start your server manually!',
          manualUrl: panelUrl,
        };
      }

      // Extract server ID
      const serverIdMatch = panelHtml.match(/data-server-id="([^"]+)"/);
      const serverId = serverIdMatch ? serverIdMatch[1] : null;

      if (!serverId) {
        // Could be a Cloudflare redirect or the page didn't load properly
        if (attempt < 2) {
          await new Promise(r => setTimeout(r, 2000));
          continue;
        }
        return {
          success: false,
          message: '❌ Could not find server on Aternos panel. It may be behind Cloudflare protection.\n' +
                   'Click below to start your server manually!',
          manualUrl: panelUrl,
        };
      }

      // Step 4: Start the server
      const startResp = await fetch(`${BASE}/ajax/server/start.php`, {
        ...fetchOpts,
        method: 'GET',
        headers: {
          ...fetchOpts.headers,
          'Cookie': panelCookies,
          'X-Requested-With': 'XMLHttpRequest',
          'Referer': panelUrl,
        },
      });

      const startData = await startResp.json().catch(() => ({}));

      if (startData.success === false || startData.error) {
        const errMsg = startData.text || startData.error || 'Unknown error';
        return {
          success: false,
          message: `❌ Aternos start failed: ${errMsg}`,
          manualUrl: panelUrl,
        };
      }

      logger.info('aternos: server start requested', { serverId });
      return {
        success: true,
        message: '🚀 Aternos server start requested! It usually takes 1-3 minutes to come online.',
        serverId,
      };
    } catch (err) {
      logger.warn('aternos: attempt failed', { attempt, error: err.message });
      if (attempt >= 2) {
        return {
          success: false,
          message: `❌ Aternos auto-start failed (Cloudflare may be blocking): ${err.message}\n` +
                   'Click below to start your server manually!',
          manualUrl: panelUrl,
        };
      }
      await new Promise(r => setTimeout(r, 2000));
    }
  }

  // Should not reach here, but just in case
  return {
    success: false,
    message: '❌ Auto-start failed after retries. Please start your server manually.',
    manualUrl: panelUrl,
  };
}

/**
 * Check Aternos server status via their panel page.
 */
async function checkAternosStatus() {
  const username = env.ATERNOS_USERNAME;
  const password = env.ATERNOS_PASSWORD;

  if (!username || !password) {
    return { configured: false };
  }

  const BASE = 'https://aternos.org';
  const fetchOpts = {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      'Accept': 'text/html,application/xhtml+xml',
    },
    redirect: 'follow',
  };

  try {
    // Quick login
    const loginPage = await fetch(`${BASE}/login/`, { ...fetchOpts, method: 'GET' });
    const loginHtml = await loginPage.text();
    const cookies = extractCookies(loginPage);
    const tokenMatch = loginHtml.match(/name="token"\s+value="([^"]+)"/);

    const formData = new URLSearchParams();
    formData.append('username', username);
    formData.append('password', password);
    formData.append('token', tokenMatch ? tokenMatch[1] : '');
    formData.append('remember', '1');

    const loginResp = await fetch(`${BASE}/login/`, {
      ...fetchOpts, method: 'POST', body: formData,
      headers: { ...fetchOpts.headers, 'Content-Type': 'application/x-www-form-urlencoded', 'Cookie': cookies },
    });
    const panelCookies = mergeCookies(cookies, loginResp);

    const panelResp = await fetch(`${BASE}/panel/`, {
      ...fetchOpts, method: 'GET',
      headers: { ...fetchOpts.headers, Cookie: panelCookies },
    });
    const html = await panelResp.text();

    // Try to extract status from the panel page
    const statusMatch = html.match(/server-status[^>]*>([^<]+)/i);
    const statusText = statusMatch ? statusMatch[1].trim() : 'unknown';

    return { configured: true, status: statusText };
  } catch {
    return { configured: true, status: 'unknown' };
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
