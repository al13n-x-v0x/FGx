'use strict';

/*
 * Copyright © 2026 FGx.
 * All rights reserved.
 */

const { BRAND } = require('../../config/constants');
const { verificationService } = require('./verificationService');
const economy = require('./economyService');

/** Shared VIP status panel — slash, chat and hub all render this. */
function vipPanelEmbed(userId, guildId, targetName) {
  const s = verificationService.status(guildId, userId);
  return {
    color: s.full ? BRAND.colors.success : BRAND.colors.warning,
    title: s.full ? '👑 VIP — Unlocked' : '🔒 VIP — Locked',
    description:
      verificationService.statusLines(s).join('\n') +
      '\n\n**Perks when unlocked**\n' +
      '• 👑 `!vip daily` — 250 ₣Ԡ🇽 extra every day\n' +
      '• 🎒 4 pro loadouts in the Loadouts guide\n' +
      '• 🏅 Crown badge on your profile\n' +
      '• 🎮 Priority access to private match servers',
    footer: { text: `${BRAND.footer} • ${targetName} · /vip daily once unlocked` },
  };
}

/** Successful VIP daily claim. */
function vipDailyEmbed(result) {
  return {
    color: BRAND.colors.success,
    title: '👑 VIP Daily claimed!',
    description: `**+${economy.format(result.amount)}** — new balance **${economy.format(result.balance)}**. Come back tomorrow!`,
    footer: { text: `${BRAND.footer} • VIP perk` },
  };
}

module.exports = { vipPanelEmbed, vipDailyEmbed };
