/* minecraft-service reduced: only queryServer kept for /minecraft status */

const { env } = require('../../config/env');

async function queryServer(host, port) {
  const serverHost = host || env.MC_SERVER_HOST;
  const serverPort = Number(port || env.MC_SERVER_PORT);

  let _mcUtil = null;
  function getMcUtil() {
    if (!_mcUtil) _mcUtil = require('minecraft-server-util');
    return _mcUtil;
  }

  const dns = require('dns').promises;
  try {
    await dns.lookup(serverHost, { family: 4, timeout: 2000 });
  } catch {
    return { online: false, host: serverHost, port: serverPort, error: 'ENOTFOUND', message: `Server address "${serverHost}" not found.` };
  }

  const queryPromise = getMcUtil().status(serverHost, serverPort, { timeout: 4000, enableSRV: true });
  const timeoutPromise = new Promise((_, reject) => {
    setTimeout(() => reject(Object.assign(new Error('Query timed out'), { code: 'TIMEOUT' })), 5000);
  });

  try {
    const result = await Promise.race([queryPromise, timeoutPromise]);
    const rawVersion = result.version?.name ?? 'Unknown';
    const rawMotd = result.motd?.clean ?? result.motd?.raw ?? '';
    const onlinePlayers = result.players?.online ?? 0;

    const isAternosOffline =
      rawVersion.toLowerCase().includes('offline') ||
      rawVersion.includes('§c') ||
      rawMotd.toLowerCase().includes('server is offline') ||
      rawMotd.toLowerCase().includes('get this server more ram') ||
      rawMotd.includes('§c');

    if (isAternosOffline) {
      return { online: false, host: serverHost, port: serverPort, error: 'ATERNOS_OFFLINE', message: 'Aternos proxy responds but the actual MC server is offline.' };
    }

    return {
      online: true,
      host: serverHost,
      port: serverPort,
      version: rawVersion,
      protocol: result.version?.protocol ?? 0,
      motd: rawMotd,
      players: { online: onlinePlayers, max: result.players?.max ?? 0, sample: (result.players?.sample ?? []).map((p) => p.name ?? p.id ?? 'Unknown') },
      favicon: result.favicon ?? null,
      latency: result.latency ?? 0,
      gamemode: result.gamemode ?? null,
      worldName: result.worldName ?? null,
    };
  } catch (err) {
    const code = err.code ?? 'UNKNOWN';
    return { online: false, host: serverHost, port: serverPort, error: code, message: `Connection error: ${code}` };
  }
}

module.exports = { queryServer };
