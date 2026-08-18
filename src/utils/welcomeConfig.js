'use strict';

const fs = require('node:fs');
const path = require('node:path');

const CONFIG_PATH = path.join(__dirname, '../../data/welcome.json');

const DEFAULTS = {
  enabled: true,
  channelId: null,
  title: '🎮 Welcome to FGx!',
  message: 'Hey {user}, welcome to **{server}**!\n\nYou are member **#{count}**.',
  color: '00ff00',
  video: '',
  image: '',
  thumbnail: '{avatar}',
  footer: 'Powered by FGx',
  author: '',
  timestamp: true,
  fields: [],
};

function load() {
  try {
    if (fs.existsSync(CONFIG_PATH)) {
      return JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf8'));
    }
  } catch {}
  return {};
}

function save(config) {
  const dir = path.dirname(CONFIG_PATH);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(CONFIG_PATH, JSON.stringify(config, null, 2));
}

function get(channelId) {
  const config = load();
  return config[channelId] || null;
}

function getAll() {
  return load();
}

function set(channelId, settings) {
  const config = load();
  config[channelId] = { ...DEFAULTS, ...settings };
  save(config);
}

function remove(channelId) {
  const config = load();
  delete config[channelId];
  save(config);
}

function isEnabled(channelId) {
  const cfg = get(channelId);
  return cfg && cfg.enabled;
}

module.exports = { get, getAll, set, remove, isEnabled, DEFAULTS };
