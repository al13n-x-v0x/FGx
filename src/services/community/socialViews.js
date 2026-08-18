'use strict';

/*
 * Copyright © 2026 FGx.
 * All rights reserved.
 */

const { BRAND } = require('../../config/constants');
const { socialService } = require('./socialService');

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

/** Result of an interaction — the line plus the running pair count. */
function interactionEmbed(result, targetName) {
  const verb = result.kind;
  const pairCount = result.count;
  return {
    color: BRAND.colors.primary,
    title: `${result.emoji} ${verb.charAt(0).toUpperCase()}${verb.slice(1)}!`,
    description:
      `${result.line}\n\n` +
      `That's **#${pairCount}** ${verb} you've ${GIVEN_KINDS.has(verb) ? 'given' : 'shared with'} **${targetName}**.`,
    footer: { text: `${BRAND.footer} • FGx socials` },
  };
}

/** Per-member social stats: dealt vs received, plus lifetime. */
function statsEmbed(username, s) {
  const lines = socialService.KINDS.map((k) => {
    const dealt = s.dealt[k] ?? 0;
    const received = s.received[k] ?? 0;
    return `**${KIND_LABEL[k]}** — dealt **${dealt}** · received **${received}**`;
  });
  return {
    color: BRAND.colors.primary,
    title: `🤝 ${username}'s social stats`,
    description:
      lines.join('\n') +
      `\n\n**Lifetime interactions: ${s.lifetime}**`,
    footer: { text: `${BRAND.footer} • Slap someone with !slap @user` },
  };
}

/** Top members for one kind — the Wall of Fame/Shame. */
function topEmbed(kind, rows) {
  const label = KIND_LABEL[kind] ?? kind;
  return {
    color: BRAND.colors.primary,
    title: `${EMOJI_FOR(kind)} ${label} leaderboard`,
    description:
      rows.length > 0
        ? rows.map((r, i) => `${['🥇', '🥈', '🥉'][i] ?? `**${i + 1}.**`} <@${r.actor_id}> — **${r.total}** ${kind}s`).join('\n')
        : `Nobody has ${kind}ed anyone yet. Be the first with \`!${kind} @user\`!`,
    footer: { text: `${BRAND.footer} • FGx socials` },
  };
}

/** Look up an emoji without importing the service (avoids cycles). */
function EMOJI_FOR(kind) {
  return { slap: '🖐️', clap: '👏', pat: '🤗', hug: '🫂', kiss: '💋', tickle: '🪶', poke: '👉', cuddle: '🧸', stare: '👀', boop: '🐾', feed: '🍪', highfive: '🙌', punch: '👊', bite: '🦷', dance: '💃' }[kind] ?? '🤝';
}

module.exports = { interactionEmbed, statsEmbed, topEmbed, KIND_LABEL };
