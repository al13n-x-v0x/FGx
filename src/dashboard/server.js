'use strict';

/*
 * Copyright © 2026 FGx.
 * All rights reserved.
 */

const http = require('node:http');
const { env } = require('../config/env');
const { healthCheck } = require('../database/index');
const { BRAND } = require('../config/constants');
const { logger } = require('../utils/logger');

/**
 * Minimal built-in HTTP endpoint for deployment health checks.
 * No secrets are exposed. (A full web dashboard can be layered on later.)
 */

let server = null;

function start(client) {
  if (server) return server;
  server = http.createServer((req, res) => {
    if (req.url === '/health' || req.url === '/') {
      const body = JSON.stringify({
        status: 'ok',
        service: BRAND.name,
        version: BRAND.version,
        uptimeSeconds: Math.floor(process.uptime()),
        guilds: client.guilds.cache.size,
        database: healthCheck() ? 'ok' : 'error',
      });
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(body);
      return;
    }
    res.writeHead(404);
    res.end('Not found');
  });

  server.listen(Number(env.WEBHOOK_PORT), '0.0.0.0', () => {
    logger.info(`dashboard: health endpoint on :${env.WEBHOOK_PORT}/health`);
  });
  return server;
}

function stop() {
  if (server) {
    server.close();
    server = null;
  }
}

module.exports = { start, stop };
