'use strict';

/*
 * Copyright © 2026 FGx.
 * All rights reserved.
 */

const { BRAND } = require('../../config/constants');
const { socialService } = require('./socialService');

const KIND_LABEL = {
  slap: '👋 Slaps',
  pat: '🤗 Pats',
  hug: '🫂 Hugs',
  kiss: '💋 Kisses',
  tickle: '🪶 Tickles',
  poke: '👉 Pokes',
};

/** Result of an interaction — the line plus the running pair count. */
function interactionEmbed(result, targetName) {
  const verb = result.kind;
  const pairCount = result.count;
  return {
    color: BRAND.colors.primary,
    title: `${result.emoji} ${verb.charAt(0).toUpperCase()}${verb.slice(1)}!`,
    description:
      `${result.line}\n\n` +
      `That's **#${pairCount}** ${verb} you've ${verb === 'slap' || verb === 'poke' || verb === 'tickle' ? 'given' : 'shared with'} **${targetName}**.`,
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

module.exports = { interactionEmbed, statsEmbed, KIND_LABEL };
