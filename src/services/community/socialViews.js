'use strict';

/* Copyright © 2026 FGx. All rights reserved. */

const { BRAND } = require('../../config/constants');
const { socialService } = require('./socialService');
const { randomEmojiStr, findEmoji, formatEmoji } = require('../../utils/emoji');

const KIND_LABEL = {
  slap: '👋 Slaps',
  clap: '👏 Claps',
  pat: '🤗 Pats',
  hug: '🫂 Hugs',
  kiss: '💋 Kisses',
  tickle: '🪶 Tickles',
  poke: '👉 Pokes',
  cuddle: '🧸 Cuddles',
  stare: '👀 Stares',
  boop: '🐾 Boops',
  feed: '🍪 Feeds',
  highfive: '🙌 High-fives',
  punch: '👊 Punches',
  bite: '🦷 Bites',
  dance: '💃 Dances',
};

/** Kinds where "you've given" reads better than "shared with". */
const GIVEN_KINDS = new Set(['slap', 'poke', 'tickle', 'punch', 'bite', 'stare', 'boop']);

/** Try to find a matching server emoji, or return the unicode emoji */
function serverEmoji(guild, kind) {
  if (!guild) return socialService.EMOJI[kind] || '🤝';
  const custom = findEmoji(guild, kind);
  if (custom) return formatEmoji(custom);
  return socialService.EMOJI[kind] || '🤝';
}

/** Result of an interaction — the line plus the running pair count. */
function interactionEmbed(result, targetName, guild = null) {
  const verb = result.kind;
  const pairCount = result.count;
  const emoji = serverEmoji(guild, verb) || result.emoji;
  const randomDeco = randomEmojiStr(guild);

  return {
    color: BRAND.colors.primary,
    title: `${emoji} ${verb.charAt(0).toUpperCase()}${verb.slice(1)}!`,
    description:
      `${result.line}\n\n` +
      `That's **#${pairCount}** ${verb} you've ${GIVEN_KINDS.has(verb) ? 'given' : 'shared with'} **${targetName}**. ${randomDeco}`,
    image: result.gif ? { url: result.gif } : undefined,
    footer: { text: `${BRAND.footer} • FGx socials ${randomDeco}` },
  };
}

/** Per-member social stats: dealt vs received, plus lifetime. */
function statsEmbed(username, s, guild = null) {
  const randomDeco = randomEmojiStr(guild);
  const lines = socialService.KINDS.map((k) => {
    const dealt = s.dealt[k] ?? 0;
    const received = s.received[k] ?? 0;
    const emoji = serverEmoji(guild, k);
    return `${emoji} **${KIND_LABEL[k]}** — dealt **${dealt}** · received **${received}**`;
  });

  return {
    color: BRAND.colors.primary,
    title: `🤝 ${username}'s social stats ${randomDeco}`,
    description:
      lines.join('\n') +
      `\n\n**Lifetime interactions: ${s.lifetime}** ${randomDeco}`,
    footer: { text: `${BRAND.footer} • FGx socials` },
  };
}

/** Top members for one kind — the Wall of Fame/Shame. */
function topEmbed(kind, rows, guild = null) {
  const label = KIND_LABEL[kind] ?? kind;
  const emoji = serverEmoji(guild, kind);
  const randomDeco = randomEmojiStr(guild);

  return {
    color: BRAND.colors.primary,
    title: `${emoji} ${label} leaderboard ${randomDeco}`,
    description:
      rows.length > 0
        ? rows.map((r, i) => `${['🥇', '🥈', '🥉'][i] ?? `**${i + 1}.**`} <@${r.actor_id}> — **${r.total}** ${kind}s`).join('\n')
        : `Nobody has ${kind}ed anyone yet. Be the first with /social ${kind} @user!`,
    footer: { text: `${BRAND.footer} • FGx socials` },
  };
}

module.exports = { interactionEmbed, statsEmbed, topEmbed, KIND_LABEL };
