'use strict';

/*
 * Copyright © 2026 FGx.
 * All rights reserved.
 */

const fs = require('node:fs');
const path = require('node:path');
const { Collection, REST, Routes } = require('discord.js');
const { env } = require('../config/env');
const { logger } = require('./logger');

/** Recursively list .js files under a directory. */
function walk(dir) {
  const absolute = path.resolve(dir);
  if (!fs.existsSync(absolute)) return [];
  const out = [];
  for (const entry of fs.readdirSync(absolute, { withFileTypes: true })) {
    const full = path.join(absolute, entry.name);
    if (entry.isDirectory()) out.push(...walk(full));
    else if (entry.name.endsWith('.js')) out.push(full);
  }
  return out;
}

/** Load all slash commands from src/commands/**\/*.js into a Collection. */
function loadCommands() {
  const commands = new Collection();
  for (const file of walk('src/commands')) {
    try {
      const mod = require(file);
      if (!mod.data || typeof mod.execute !== 'function') {
        logger.warn('registry: skipped command without data/execute', { file });
        continue;
      }
      commands.set(mod.data.name, mod);
    } catch (err) {
      logger.error('registry: failed to load command', { file, error: err.message });
    }
  }
  logger.info(`registry: loaded ${commands.size} commands`);
  return commands;
}

/** Register slash commands with Discord (guild-scoped when GUILD_ID is set). */
async function registerCommands(client) {
  if (!env.CLIENT_ID) {
    logger.warn('registry: CLIENT_ID not set — skipping slash command registration');
    return;
  }
  const rest = new REST({ version: '10' }).setToken(env.DISCORD_TOKEN);
  const bodies = [...client.commands.values()].map((c) => c.data.toJSON());
  try {
    if (env.GUILD_ID) {
      await rest.put(Routes.applicationGuildCommands(env.CLIENT_ID, env.GUILD_ID), { body: bodies });
      logger.info(`registry: registered ${bodies.length} commands for guild ${env.GUILD_ID}`);
    } else {
      await rest.put(Routes.applicationCommands(env.CLIENT_ID), { body: bodies });
      logger.info(`registry: registered ${bodies.length} global commands`);
    }
  } catch (err) {
    logger.error('registry: command registration failed', { error: err.message });
    throw err;
  }
}

/** Load all event handlers from src/events/**\/*.js. */
function loadEvents(client) {
  let loaded = 0;
  for (const file of walk('src/events')) {
    if (file.endsWith('index.js')) continue;
    const mod = require(file);
    if (typeof mod.register !== 'function') continue;
    mod.register(client);
    loaded += 1;
  }
  logger.info(`registry: loaded ${loaded} event handlers`);
}

module.exports = { loadCommands, loadEvents, registerCommands, walk };
