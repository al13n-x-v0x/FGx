'use strict';

/*
 * Copyright © 2026 FGx.
 * All rights reserved.
 */

const { PermissionsBitField } = require('discord.js');

/**
 * Anti-spam engine.
 *
 * Detection signals (all configurable per guild):
 *  - rapid messages (flood)         5 msgs / 5s
 *  - duplicate messages             3 identical
 *  - mention / mass-mention spam    10 mentions / message
 *  - excessive emojis               15 / message
 *  - excessive caps                 70% caps and >= 15 chars
 *  - invite spam                    discord.gg links
 *  - suspicious links               URLs outside the whitelist (flagged for AI review)
 *  - repeated advertisements        same content in >= 3 channels
 *
 * Progressive enforcement (per user, resets after a quiet window):
 *   1st offense  -> warn (DM)
 *   2nd offense  -> delete + warn
 *   3rd offense  -> delete + timeout
 *   4th+ offense -> delete + longer timeout + staff alert
 *
 * Cooldowns prevent repeated punishment of the same user.
 * A single suspicious message never results in a permanent punishment.
 */

const INVITE_RE = /(?:discord\.(?:gg|com\/invite|app\.com\/invite)\/)([A-Za-z0-9_-]+)/i;
const URL_RE = /(https?:\/\/[^\s]+)/gi;
const EMOJI_RE = /(\p{Extended_Pictographic}|\u00a9|\u00ae|[\u2000-\u3300]|<a?:[A-Za-z0-9_]+:\d+>)/gu;
const PHISHY_RE =
  /(free\s*nitro|nitro\s*gift|steamcommunity\.com\/|discord-nitro|airdrop|claim\s*your|password\s*reset|verify\s*your\s*account)/i;

/** Bounded per-user message history per guild. */
const MAX_TRACKED_USERS = 200;
const MAX_HISTORY_PER_USER = 50;
const state = new Map(); // guildId -> Map(userId -> { history: [], offenses: number, lastPunished: 0 })

function getGuildState(guildId) {
  let guild = state.get(guildId);
  if (!guild) {
    guild = new Map();
    state.set(guildId, guild);
  }
  return guild;
}

function evictIfNeeded(guildState) {
  if (guildState.size > MAX_TRACKED_USERS) {
    const oldest = guildState.keys().next().value;
    guildState.delete(oldest);
  }
}

function analyze(message, config) {
  const cfg = config.antispam;
  const violations = [];
  if (!cfg.enabled) return { violations, spammy: false };

  const content = message.content ?? '';
  const now = Date.now();
  const userState = getGuildState(message.guild.id);
  let entry = userState.get(message.author.id);
  if (!entry) {
    entry = { history: [], offenses: 0, lastPunished: 0, warned: false };
    userState.set(message.author.id, entry);
  }

  entry.history.push({ ts: now, content, channelId: message.channel.id });
  if (entry.history.length > MAX_HISTORY_PER_USER) entry.history.shift();
  evictIfNeeded(userState);

  const windowStart = now - cfg.windowSeconds * 1000;
  const recent = entry.history.filter((h) => h.ts > windowStart);

  // 1. Rapid messages / flood
  if (recent.length >= cfg.maxMessages) {
    violations.push('rapid messages');
  }

  // 2. Duplicate messages
  if (cfg.duplicateCount > 1 && content.length > 4) {
    const dupes = recent.filter((h) => h.content === content).length;
    if (dupes >= cfg.duplicateCount) violations.push('duplicate messages');
  }

  // 3. Mention spam / mass mentions
  if (message.mentions && message.mentions.users.size >= cfg.maxMentions) {
    violations.push('mass mentions');
  }

  // 4. Excessive emojis
  const emojiMatches = content.match(EMOJI_RE);
  if (emojiMatches && emojiMatches.length >= cfg.maxEmojis) {
    violations.push('excessive emojis');
  }

  // 5. Excessive caps
  const letters = content.replace(/[^A-Za-z]/g, '');
  if (letters.length >= cfg.capsMinLength) {
    const upper = letters.replace(/[^A-Z]/g, '').length;
    if (upper / letters.length >= cfg.capsRatio) violations.push('excessive caps');
  }

  // 6. Invite spam
  if (cfg.invitesEnabled && INVITE_RE.test(content)) {
    violations.push('invite link');
  }

  // 7. Suspicious links (outside whitelist) — flagged, not auto-punished here.
  let hasSuspiciousLink = false;
  if (cfg.linksEnabled && content.length > 0) {
    const urls = content.match(URL_RE) ?? [];
    const whitelist = (cfg.linkWhitelist ?? []).map((u) => u.toLowerCase());
    for (const url of urls) {
      try {
        const host = new URL(url).hostname.replace(/^www\./, '').toLowerCase();
        if (!whitelist.includes(host) && !whitelist.some((w) => host.endsWith(`.${w}`))) {
          hasSuspiciousLink = true;
          break;
        }
      } catch {
        hasSuspiciousLink = true;
      }
    }
  }
  if (hasSuspiciousLink) violations.push('suspicious link');

  // 8. Repeated advertisements — same content across >= 3 channels in the window.
  const channelSet = new Set(recent.filter((h) => h.content === content).map((h) => h.channelId));
  if (channelSet.size >= 3) violations.push('repeated advertisement');

  return {
    violations,
    spammy: violations.length > 0,
    suspiciousLink: hasSuspiciousLink,
    content,
  };
}

/**
 * Decide the enforcement step for a flagged user.
 * Returns { action: 'none'|'warn'|'delete'|'timeout', minutes?, reason, escalated }.
 *
 * Escalation happens during an active burst; after a quiet period the offense
 * counter resets so the user is not permanently locked at max punishment.
 */
function decideAction(guildId, userId, analysis, config) {
  const cfg = config.antispam;
  if (!analysis.spammy) return { action: 'none', reason: '' };

  const guildState = getGuildState(guildId);
  let entry = guildState.get(userId);
  if (!entry) {
    entry = { history: [], offenses: 0, lastPunished: 0 };
    guildState.set(userId, entry);
  }

  // Quiet-period reset: a user who stops spamming starts back at warn.
  const QUIET_RESET_MS = 60_000;
  if (now() - (entry.lastPunished ?? 0) > QUIET_RESET_MS) {
    entry.offenses = 0;
  }

  entry.offenses += 1;
  entry.lastPunished = now();

  const ceiling = cfg.action; // WARN | DELETE | TIMEOUT
  const ladder = ['warn', 'delete', 'timeout'];
  const step = Math.min(entry.offenses, ladder.length);

  // The configured ceiling caps how far we go up the ladder.
  const allowedIndex = ladder.indexOf(ceiling.toLowerCase());
  const actionIndex = Math.min(step - 1, allowedIndex < 0 ? ladder.length - 1 : allowedIndex);
  const action = ladder[actionIndex];

  const escalated = entry.offenses >= 4;
  const minutes = action === 'timeout' ? (escalated ? 60 : 10) : 0;
  return {
    action,
    minutes,
    reason: analysis.violations.join(', '),
    escalated,
    offenses: entry.offenses,
  };
}

/** Should this user be immune (staff with manage perms)? */
function isImmune(member) {
  return Boolean(
    member?.permissions?.has(PermissionsBitField.Flags.ManageMessages) ||
      member?.permissions?.has(PermissionsBitField.Flags.Administrator),
  );
}

/** Reset a user's offense counter (e.g. after manual staff action). */
function reset(guildId, userId) {
  getGuildState(guildId).delete(userId);
}

/** Whether a message should be skipped for XP purposes (spammy or recently punished). */
function shouldReward(message, _config) {
  const entry = getGuildState(message.guild.id).get(message.author.id);
  if (!entry) return true;
  if (now() - entry.lastPunished < 60_000) return false;
  return true;
}

function now() {
  return Date.now();
}

/** Sweep stale guild state periodically. */
setInterval(() => {
  const cutoff = now() - 10 * 60_000;
  for (const [guildId, guild] of state) {
    for (const [userId, entry] of guild) {
      const recent = entry.history.filter((h) => h.ts > cutoff);
      if (recent.length === 0) guild.delete(userId);
      else entry.history = recent;
    }
    if (guild.size === 0) state.delete(guildId);
  }
}, 5 * 60_000).unref?.();

module.exports = {
  analyze,
  decideAction,
  isImmune,
  reset,
  shouldReward,
  INVITE_RE,
  URL_RE,
  PHISHY_RE,
  getGuildState,
};
