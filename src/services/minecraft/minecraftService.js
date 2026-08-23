'use strict';

/* Copyright © 2026 FGx. All rights reserved. */

const net = require('net');
const { status } = require('minecraft-server-util');
const { env } = require('../../config/env');
const { logger } = require('../../utils/logger');

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

  try {
    const result = await status(serverHost, serverPort, {
      timeout: 8000,
      enableSRV: true,
    });

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
 * This uses Aternos's internal AJAX endpoints — may break if they change.
 *
 * @returns {Promise<{success: boolean, message: string}>}
 */
async function startAternos() {
  const username = env.ATERNOS_USERNAME;
  const password = env.ATERNOS_PASSWORD;

  if (!username || !password) {
    return {
      success: false,
      message: 'Aternos credentials not configured. Set `ATERNOS_USERNAME` and `ATERNOS_PASSWORD` in Render env vars.',
    };
  }

  // Aternos uses a two-step auth flow:
  // 1. GET the login page to get cookies and a CSRF-like token
  // 2. POST credentials to authenticate
  // 3. GET the server panel page to get the server ID and start token
  // 4. POST to the start endpoint

  const BASE = 'https://aternos.org';
  const fetchOpts = {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      'Accept-Language': 'en-US,en;q=0.9',
    },
    redirect: 'follow',
  };

  try {
    // Step 1: Get login page
    const loginPage = await fetch(`${BASE}/login/`, { ...fetchOpts, method: 'GET' });
    const loginHtml = await loginPage.text();
    const cookies = extractCookies(loginPage);

    // Extract login token
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
      },
    });

    const loginCookies = mergeCookies(cookies, loginResp);

    // Check if login succeeded (redirect to /panel/)
    if (loginResp.status >= 400 && loginResp.status < 500) {
      return { success: false, message: '❌ Aternos login failed — check your username and password.' };
    }

    // Step 3: Get server panel
    const panelResp = await fetch(`${BASE}/panel/`, {
      ...fetchOpts,
      method: 'GET',
      headers: { ...fetchOpts.headers, Cookie: loginCookies },
    });
    const panelHtml = await panelResp.text();
    const panelCookies = mergeCookies(loginCookies, panelResp);

    // Extract server ID
    const serverIdMatch = panelHtml.match(/data-server-id="([^"]+)"/);
    const serverId = serverIdMatch ? serverIdMatch[1] : null;

    if (!serverId) {
      return { success: false, message: '❌ Could not find your Aternos server. Make sure you have a server created.' };
    }

    // Step 4: Start the server
    const startResp = await fetch(`${BASE}/ajax/server/start.php`, {
      ...fetchOpts,
      method: 'GET',
      headers: {
        ...fetchOpts.headers,
        'Cookie': panelCookies,
        'X-Requested-With': 'XMLHttpRequest',
      },
    });

    const startData = await startResp.json().catch(() => ({}));

    if (startData.success === false || startData.error) {
      const errMsg = startData.text || startData.error || 'Unknown error';
      return { success: false, message: `❌ Aternos start failed: ${errMsg}` };
    }

    logger.info('aternos: server start requested', { serverId });
    return {
      success: true,
      message: '🚀 Aternos server start requested! It usually takes 1-3 minutes to come online.',
      serverId,
    };
  } catch (err) {
    logger.error('aternos: start failed', { error: err.message });
    return {
      success: false,
      message: `❌ Failed to communicate with Aternos: ${err.message}. Their API may have changed.`,
    };
  }
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
};
