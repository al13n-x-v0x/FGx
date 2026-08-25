'use strict';

/*
 * Copyright © 2026 FGx.
 * All rights reserved.
 */

const { BRAND } = require('../../config/constants');
const economy = require('./economyService');
const views = require('./economyViews');
const hubService = require('../clan/hubService');
const { economyRepo } = require('../../database/repos/economy');
const zoo = require('./zooService');
const { socialService } = require('./socialService');
const socialViews = require('./socialViews');
const vipViews = require('./vipViews');
const { healthCheck } = require('../../database/index');
const { RateLimiter } = require('../../utils/ratelimit');
const { logger } = require('../../utils/logger');

/**
 * OwO-style chat commands.
 *
 * In chat, type:  fgx daily | fgx coinflip 50 | fgx transfer @user 100 |
 *                 fgx wallet | fgx weekly | fgx top
 * Plus hub sections: fgx profile, fgx stats, fgx roster, fgx scrims,
 *                 fgx events, fgx wars, fgx loadout, fgx leaderboard,
 *                 fgx roblox, fgx security, fgx help, fgx ping, fgx status
 * Mentioning the bot works too:  @FGx daily
 *
 * Parsing is pure and unit-tested; execution mirrors the slash commands
 * and the /fgx hub (same services, same embeds).
 */

const CHAT_RATE_LIMIT = new RateLimiter({ max: 8, windowMs: 60_000 });

/** Chat command → hub section value. */
const SECTION_ALIASES = {
  profile: 'profile',
  stats: 'stats',
  stat: 'stats',
  roster: 'roster',
  scrim: 'scrims',
  scrims: 'scrims',
  event: 'events',
  events: 'events',
  war: 'clanwars',
  wars: 'clanwars',
  clanwar: 'clanwars',
  clanwars: 'clanwars',
  loadout: 'loadouts',
  loadouts: 'loadouts',
  tryout: 'tryouts',
  tryouts: 'tryouts',
  leaderboard: 'leaderboards',
  leaderboards: 'leaderboards',
  lb: 'leaderboards',
  roblox: 'roblox',
  security: 'security',
  coins: 'coins',
  private: 'private',
};

/** Strip the prefix/mention and return the command line, or null. */
function stripPrefix(content, clientId) {
  let text = String(content ?? '').trim();
  if (!text) return null;
  // @FGx mention first.
  const mentionRe = new RegExp(`^<@!?${clientId}>\\s*`, 'i');
  if (mentionRe.test(text)) {
    text = text.replace(mentionRe, '').trim();
    return text || null;
  }
  // Plain "fgx ..." prefix.
  if (/^fgx\b/i.test(text)) {
    text = text.replace(/^fgx\b/i, '').trim();
    return text || null;
  }
  return null;
}

/** OwO-style bang prefix: `!bal`, `!daily`, `!coinflip 50 heads`, … */
function stripBangPrefix(content) {
  const text = String(content ?? '').trim();
  if (!text.startsWith('!')) return null;
  const rest = text.slice(1).trim();
  return rest || null;
}

/** Parse a whole number, or null when invalid. */
function parseAmount(raw) {
  const n = Number(String(raw ?? '').replace(/[,_]/g, '').trim());
  return Number.isFinite(n) && Number.isInteger(n) && n >= 1 ? n : null;
}

/**
 * Pure command parser.
 * @returns {{ type: string, ...args }} or { type: 'unknown' }
 */
function parseCommand(line, mentionIds = []) {
  const tokens = String(line ?? '').trim().split(/\s+/);
  const cmd = (tokens[0] ?? '').toLowerCase();
  const rest = tokens.slice(1);

  if (!cmd || cmd === 'help') return { type: 'help' };
  if (cmd === 'ping') return { type: 'ping' };
  if (cmd === 'status') return { type: 'status' };
  if (cmd === 'wallet' || cmd === 'bal' || cmd === 'balance') {
    return { type: 'wallet', targetId: mentionIds[0] ?? null };
  }
  if (cmd === 'daily') return { type: 'daily' };
  if (cmd === 'weekly') return { type: 'weekly' };

  if (cmd === 'transfer' || cmd === 'pay' || cmd === 'give') {
    const targetId = mentionIds[0] ?? null;
    // Ignore mention tokens when reading the amount (<@123> or plain @name).
    const amountText = rest.filter((t) => !/^<@!?\d+>$/.test(t) && !/^@.+/.test(t)).join(' ');
    const amount = parseAmount(amountText);
    return { type: 'transfer', targetId, amount, raw: rest.join(' ') };
  }

  if (cmd === 'coinflip' || cmd === 'gamble' || cmd === 'cf' || cmd === 'flip') {
    const raw = rest.join(' ').trim();
    // Optional heads/tails pick: `coinflip 50 heads`, `coinflip heads 50`,
    // `coinflip tails all`, …
    const pickTok = rest.find((t) => /^(heads|tails|h|t)$/i.test(t));
    const pick = pickTok ? (pickTok.toLowerCase() === 'h' ? 'heads' : pickTok.toLowerCase() === 't' ? 'tails' : pickTok.toLowerCase()) : null;
    const amountText = rest.filter((t) => !/^(heads|tails|h|t)$/i.test(t)).join(' ');
    const all = amountText.toLowerCase() === 'all';
    return { type: 'coinflip', all, pick, amount: all ? null : parseAmount(amountText), raw };
  }

  if (cmd === 'top') {
    const n = parseAmount(rest[0] ?? '') ?? 10;
    return { type: 'top', count: Math.min(Math.max(n, 1), 15) };
  }

  if (cmd === 'hunt') return { type: 'hunt' };
  if (cmd === 'battle' || cmd === 'fight') return { type: 'battle' };
  if (cmd === 'pray') return { type: 'pray' };
  if (cmd === 'crate' || cmd === 'lootbox' || cmd === 'box') return { type: 'crate' };
  if (cmd === 'work') return { type: 'work' };
  if (cmd === 'crime') return { type: 'crime' };
  if (cmd === 'rob') {
    return { type: 'rob', targetId: mentionIds[0] ?? null };
  }
  if (cmd === 'fish') return { type: 'fish' };
  if (cmd === 'slots' || cmd === 'slot') {
    const amount = parseAmount(rest[0] ?? '');
    return { type: 'slots', amount };
  }
  if (cmd === 'dice' || cmd === 'roll') {
    const raw = rest.join(' ').trim() || '1d6';
    return { type: 'dice', raw };
  }
  if (cmd === '8ball' || cmd === 'eightball' || cmd === 'ask') {
    return { type: '8ball', question: rest.join(' ').trim() };
  }
  if (cmd === 'choose' || cmd === 'pick') {
    return { type: 'choose', options: rest.join(' ').split(/[|,]/).map(s => s.trim()).filter(Boolean) };
  }
  if (cmd === 'ship') {
    return { type: 'ship', targetId: mentionIds[0] ?? null };
  }
  if (cmd === 'rate') {
    return { type: 'rate', thing: rest.join(' ').trim() };
  }
  if (cmd === 'zoo' || cmd === 'pets' || cmd === 'animals' || cmd === 'collection') {
    return { type: 'zoo', targetId: mentionIds[0] ?? null };
  }
  if (cmd === 'sell') {
    return { type: 'sell', key: rest.join(' ').trim() };
  }

  if (socialService.KINDS.includes(cmd)) {
    return { type: 'social', kind: cmd, targetId: mentionIds[0] ?? null };
  }
  if (cmd === 'social' || cmd === 'interactions') {
    return { type: 'socialStats', targetId: mentionIds[0] ?? null };
  }
  if (cmd === 'socialtop' || cmd === 'sociallb') {
    const kind = rest[0]?.toLowerCase() ?? 'slap';
    return { type: 'socialTop', kind, n: 5 };
  }
  if (cmd === 'vip' || cmd === 'premium') {
    const sub = (rest[0] ?? '').toLowerCase();
    if (sub === 'daily') return { type: 'vipDaily' };
    if (sub === 'check' || sub === 'status') return { type: 'vipCheck', targetId: mentionIds[0] ?? null };
    return { type: 'vipStatus' };
  }

  if (cmd === 'history' || cmd === 'logs' || cmd === 'tx') {
    const countText = rest.filter((t) => !/^<@!?\d+>$/.test(t) && !/^@.+/.test(t))[0] ?? '';
    const count = Math.min(25, Math.max(1, parseAmount(countText) ?? 10));
    return { type: 'history', targetId: mentionIds[0] ?? null, count };
  }

  if (cmd === 'profile') {
    return { type: 'profile', targetId: mentionIds[0] ?? null };
  }

  if (SECTION_ALIASES[cmd]) {
    return { type: 'section', section: SECTION_ALIASES[cmd] };
  }

  return { type: 'unknown', raw: line };
}

/** Render a hub section as plain embeds (no interactive components). */
function sectionEmbeds(guild, userId, section) {
  const rendered = hubService.renderSection(guild, userId, section);
  return rendered.embeds;
}

/** General chat-command help embed. */
function helpEmbed() {
  return {
    color: BRAND.colors.primary,
    title: '💰 FGx — chat commands',
    description:
      'Type **`fgx <command>`** in chat (mentioning the bot works too: `@FGx daily`).\n\n' +
      '**Economy** (works with `fgx` or `!` prefixes)\n' +
      '• `fgx daily` / `!daily` — 500 ₣Ԡ🇽 daily (streak bonus!)\n' +
      '• `fgx weekly` / `!weekly` — weekly reward\n' +
      '• `fgx wallet [@user]` / `!bal` — check a balance\n' +
      '• `fgx transfer @user <amount>` — send ₣Ԡ🇽 (5% tax)\n' +
      '• `fgx coinflip <amount|all> [heads|tails]` / `!coinflip 50 heads` — 50/50 gamble\n' +
      '• `fgx hunt` / `!hunt` — hunt animals for coins, they join your zoo (60s)\n' +
      '• `fgx zoo` / `!zoo` — your collected animals\n' +
      '• `fgx sell <animal>` / `!sell fox` — sell a duplicate for coins\n' +
      '• `fgx battle` / `!battle` — fight enemies, win big or lose 10% (120s)\n' +
      '• `fgx pray` / `!pray` — a big coin blessing (2h cooldown)\n' +
      '• `fgx crate` / `!crate` — open a loot crate (250 ₣Ԡ🇽)\n' +
      '• `fgx history [@user] [count]` / `!history` — last transactions\n' +
      '• `fgx top` — richest members\n' +
      '• `fgx work` / `!work` — do a job for coins (45s)\n' +
      '• `fgx crime` / `!crime` — commit a crime, high risk reward (90s)\n' +
      '• `fgx rob @user` / `!rob @user` — steal from someone (3min)\n' +
      '• `fgx fish` / `!fish` — go fishing for coins (30s)\n' +
      '• `!slots <amount>` — slot machine, 5x jackpot\n' +
      '• `!dice 2d6+3` — roll dice\n\n' +
      '**Fun** (chat only)\n' +
      '• `!8ball <question>` — magic 8-ball\n' +
      '• `!choose option1 | option2 | option3` — pick one\n' +
      '• `!ship @user` — love compatibility\n' +
      '• `!rate <thing>` — rate anything 0-10\n\n' +
      '**Socials** (chat only)\n' +
      '• `!slap` / `!clap` / `!pat` / `!hug` / `!kiss` / `!tickle` / `!poke` / `!cuddle` / `!stare` / `!boop` / `!feed` / `!highfive` / `!punch` / `!bite` / `!dance` — all with @user, counts grow\n' +
      '• `!social [@user]` — interaction stats\n' +
      '• `!socialtop [kind]` — who leads each interaction\n\n' +
      '**VIP (locked until fully verified)**\n' +
      '• `!vip` — status & how to unlock\n' +
      '• `!vip daily` — 250 ₣Ԡ🇽 extra daily (needs link + Roblox verified)\n' +
      '• `!vip check @user` — someone else\'s status\n\n' +
      '**Server**\n' +
      '• `fgx profile [@user]` — player profile\n' +
      '• `fgx stats` / `fgx roster` / `fgx leaderboard` — competitive\n' +
      '• `fgx scrims` / `fgx events` / `fgx wars` — schedule & history\n' +
      '• `fgx loadout` / `fgx tryouts` — guides\n' +
      '• `fgx roblox` / `fgx security` — verification & protection\n' +
      '• `fgx ping` / `fgx status` — bot health',
    footer: { text: `${BRAND.footer} • Slash versions: /fgx, /fgxcoin` },
  };
}

/**
 * Execute a parsed chat command against the message's author.
 * Returns true when the message was handled as a command.
 */
async function handle(client, message) {
  // `!`-prefixed messages are only claimed when the command name matches —
  // unknown ones pass through untouched so other bots aren't hijacked.
  let bang = false;
  let line = stripPrefix(message.content, client.user.id);
  if (!line) {
    line = stripBangPrefix(message.content);
    bang = line !== null;
  }
  if (!line) return false;

  if (!CHAT_RATE_LIMIT.allow(message.author.id)) {
    await message
      .reply({ embeds: [views.warnEmbed('Slow down', 'Chat commands are rate-limited — wait a moment.')] })
      .catch(() => {});
    return true;
  }

  const mentionIds = [...(message.mentions.users?.values?.() ?? [])].map((u) => u.id);
  const parsed = parseCommand(line, mentionIds);
  const guildId = message.guild.id;
  const userId = message.author.id;

  try {
    switch (parsed.type) {
      case 'help':
        await message.reply({ embeds: [helpEmbed()] });
        return true;

      case 'ping': {
        const embed = {
          color: BRAND.colors.primary,
          title: '🏓 Pong!',
          description: `Gateway latency: **${client.ws.ping}ms**`,
          footer: { text: BRAND.footer },
        };
        await message.reply({ embeds: [embed] });
        return true;
      }

      case 'status': {
        const embed = {
          color: BRAND.colors.primary,
          title: 'FGx Status',
          description:
            `Discord   🟢 (${client.guilds.cache.size} guild${client.guilds.cache.size === 1 ? '' : 's'}, ${client.ws.ping}ms)\n` +
            `Database  ${healthCheck() ? '🟢' : '🔴'}\n` +
            `Commands  ${client.commands?.size ?? 0} registered`,
          footer: { text: BRAND.footer },
        };
        await message.reply({ embeds: [embed] });
        return true;
      }

      case 'profile': {
        const targetId = parsed.targetId ?? userId;
        await message.reply({ embeds: sectionEmbeds(message.guild, targetId, 'profile') });
        return true;
      }

      case 'section':
        await message.reply({ embeds: sectionEmbeds(message.guild, userId, parsed.section) });
        return true;

      case 'wallet': {
        const target = parsed.targetId ? message.mentions.users.get(parsed.targetId) ?? message.author : message.author;
        const row = economy.balance(guildId, target.id);
        const rank = economyRepo.rank(guildId, target.id);
        await message.reply({ embeds: [views.walletEmbed(target, row, rank)] });
        return true;
      }

      case 'daily':
      case 'weekly': {
        const result = await economy[parsed.type](guildId, userId);
        await message.reply({ embeds: [views.claimEmbed(parsed.type, result)] });
        return true;
      }

      case 'transfer': {
        if (!parsed.targetId) {
          await message.reply({ embeds: [views.warnEmbed('Who?', 'Mention someone: `fgx transfer @user <amount>`')] });
          return true;
        }
        if (!parsed.amount) {
          await message.reply({ embeds: [views.warnEmbed('Invalid amount', 'Use a whole number: `fgx transfer @user 100`')] });
          return true;
        }
        const target = message.mentions.users.get(parsed.targetId);
        const result = await economy.transfer(guildId, userId, target.id, parsed.amount);
        await message.reply({ embeds: [views.transferEmbed(target, result)] });
        return true;
      }

      case 'coinflip': {
        const row = economy.balance(guildId, userId);
        const amount = parsed.all ? (row.balance ?? 0) : parsed.amount;
        if (!amount) {
          await message.reply({
            embeds: [views.warnEmbed('Invalid amount', 'Use `coinflip <amount|all> [heads|tails]` — e.g. `!coinflip 50 heads`')],
          });
          return true;
        }
        // OwO-style: coin spins, reactions fly, result lands.
        const spinner = await message.reply({ content: '🪙 The coin spins…' });
        await spinner.react('🪙').catch(() => {});
        const result = await economy.coinflip(guildId, userId, amount, parsed.pick ?? null);
        await new Promise((resolve) => setTimeout(resolve, 1400));
        await spinner.edit({ content: null, embeds: [views.coinflipEmbed(result)] }).catch(() => {});
        if (result.won) {
          await spinner.react('🎉').catch(() => {});
          await spinner.react('💰').catch(() => {});
        } else {
          await spinner.react('💀').catch(() => {});
          await spinner.react('🪦').catch(() => {});
        }
        return true;
      }

      case 'zoo': {
        const target = parsed.targetId ? message.mentions.users.get(parsed.targetId) ?? message.author : message.author;
        const s = zoo.stats(guildId, target.id);
        const rows = zoo.collection(guildId, target.id);
        await message.reply({ embeds: [views.zooEmbed(target.username, s, rows)] });
        return true;
      }

      case 'sell': {
        if (!parsed.key) {
          await message.reply({ embeds: [views.warnEmbed('Sell what?', '`fgx sell <animal>` — e.g. `!sell fox`')] });
          return true;
        }
        const result = zoo.sell(guildId, userId, parsed.key);
        await message.reply({ embeds: [views.sellEmbed(result)] });
        return true;
      }

      case 'pray': {
        const result = await economy.pray(guildId, userId);
        await message.reply({ embeds: [views.prayEmbed(result)] });
        return true;
      }

      case 'crate': {
        const result = await economy.crate(guildId, userId);
        await message.reply({ embeds: [views.crateEmbed(result)] });
        return true;
      }

      case 'history': {
        const target = parsed.targetId ? message.mentions.users.get(parsed.targetId) ?? message.author : message.author;
        const rows = economyRepo.recentTx(guildId, target.id, parsed.count);
        await message.reply({ embeds: [views.historyEmbed(target.username, rows)] });
        return true;
      }

      case 'hunt': {
        const result = await economy.hunt(guildId, userId);
        await message.reply({ embeds: [views.huntEmbed(result)] });
        return true;
      }

      case 'battle': {
        // Quick animation: strike first, then the result lands.
        const spinner = await message.reply({ content: '⚔️ You ready your weapon and charge…' });
        const result = await economy.battle(guildId, userId);
        await new Promise((resolve) => setTimeout(resolve, 1400));
        await spinner.edit({ content: null, embeds: [views.battleEmbed(result)] }).catch(() => {});
        return true;
      }

      case 'social': {
        if (!parsed.targetId) {
          await message.reply({
            embeds: [views.warnEmbed('Who?', `Mention someone: \`!${parsed.kind} @user\``)],
          });
          return true;
        }
        const target = message.mentions.users.get(parsed.targetId) ?? message.author;
        // Slap/poke get a little wind-up animation, OwO-style.
        if (parsed.kind === 'slap' || parsed.kind === 'poke') {
          const spinner = await message.reply({ content: `${socialService.EMOJI[parsed.kind]} You wind up…` });
          const result = socialService.interact(guildId, userId, target.id, parsed.kind, target.username, message.author.username);
          await new Promise((resolve) => setTimeout(resolve, 1200));
          await spinner.edit({ content: null, embeds: [socialViews.interactionEmbed(result, target.username)] }).catch(() => {});
        } else {
          const result = socialService.interact(guildId, userId, target.id, parsed.kind, target.username, message.author.username);
          await message.reply({ embeds: [socialViews.interactionEmbed(result, target.username)] });
        }
        return true;
      }

      case 'socialStats': {
        const target = parsed.targetId ? message.mentions.users.get(parsed.targetId) ?? message.author : message.author;
        const s = socialService.stats(guildId, target.id);
        await message.reply({ embeds: [socialViews.statsEmbed(target.username, s)] });
        return true;
      }

      case 'socialTop': {
        let rows;
        try {
          rows = socialService.top(guildId, parsed.kind, parsed.n);
        } catch (err) {
          if (err.code === 'UNKNOWN_KIND') {
            await message.reply({ embeds: [views.warnEmbed('Unknown interaction', `Try one of: ${socialService.KINDS.join(', ')}`)] });
            return true;
          }
          throw err;
        }
        await message.reply({ embeds: [socialViews.topEmbed(parsed.kind, rows)] });
        return true;
      }

      case 'vipStatus': {
        await message.reply({ embeds: [vipViews.vipPanelEmbed(userId, guildId, message.author.username)] });
        return true;
      }

      case 'vipCheck': {
        const target = parsed.targetId ? message.mentions.users.get(parsed.targetId) ?? message.author : message.author;
        await message.reply({ embeds: [vipViews.vipPanelEmbed(target.id, guildId, target.username)] });
        return true;
      }

      case 'vipDaily': {
        try {
          const result = await economy.vipDaily(guildId, userId);
          await message.reply({ embeds: [vipViews.vipDailyEmbed(result)] });
        } catch (err) {
          if (err.code === 'VIP_LOCKED' || err.code === 'ALREADY_CLAIMED') {
            await message.reply({ embeds: [views.warnEmbed('👑 VIP Daily', err.message)] });
            return true;
          }
          throw err;
        }
        return true;
      }

      case 'top': {
        const rows = economy.leaderboard(guildId, parsed.count);
        const embed = {
          color: BRAND.colors.primary,
          title: '💰 ₣Ԡ🇽 Richest Members',
          description:
            rows.length > 0
              ? rows.map((r, i) => `${['🥇', '🥈', '🥉'][i] ?? `**${i + 1}.**`} <@${r.user_id}> — ${economy.format(r.balance ?? 0)}`).join('\n')
              : 'No coins in circulation yet — claim `fgx daily`!',
          footer: { text: `${BRAND.footer} • FGx economy` },
        };
        await message.reply({ embeds: [embed] });
        return true;
      }

      case 'work': {
        try {
          const result = await economy.work(guildId, userId);
          await message.reply({ embeds: [views.workEmbed(result)] });
        } catch (err) {
          if (['WORK_COOLDOWN'].includes(err.code)) {
            await message.reply({ embeds: [views.warnEmbed('Work', err.message)] });
            return true;
          }
          throw err;
        }
        return true;
      }

      case 'crime': {
        try {
          const result = await economy.crime(guildId, userId);
          await message.reply({ embeds: [views.crimeEmbed(result)] });
        } catch (err) {
          if (['CRIME_COOLDOWN'].includes(err.code)) {
            await message.reply({ embeds: [views.warnEmbed('Crime', err.message)] });
            return true;
          }
          throw err;
        }
        return true;
      }

      case 'rob': {
        if (!parsed.targetId) {
          await message.reply({ embeds: [views.warnEmbed('Who?', 'Mention someone: `!rob @user`')] });
          return true;
        }
        if (parsed.targetId === userId) {
          await message.reply({ embeds: [views.warnEmbed('Nope', "You can't rob yourself.")] });
          return true;
        }
        try {
          const result = await economy.rob(guildId, userId, parsed.targetId);
          await message.reply({ embeds: [views.robEmbed(result)] });
        } catch (err) {
          if (['ROB_COOLDOWN', 'TARGET_POOR'].includes(err.code)) {
            await message.reply({ embeds: [views.warnEmbed('Rob', err.message)] });
            return true;
          }
          throw err;
        }
        return true;
      }

      case 'fish': {
        try {
          const result = await economy.fish(guildId, userId);
          await message.reply({ embeds: [views.fishEmbed(result)] });
        } catch (err) {
          if (['FISH_COOLDOWN'].includes(err.code)) {
            await message.reply({ embeds: [views.warnEmbed('Fish', err.message)] });
            return true;
          }
          throw err;
        }
        return true;
      }

      case 'slots': {
        const bet = parsed.amount ?? 100;
        const row = economy.balance(guildId, userId);
        if ((row.balance ?? 0) < bet) {
          await message.reply({ embeds: [views.warnEmbed('Slots', `You need ${economy.format(bet)} ₣Ԡ🇽 but have ${economy.format(row.balance ?? 0)}.`)] });
          return true;
        }
        const symbols = ['🍒', '🍋', '🍊', '🍇', '💎', '7️⃣', '🔔'];
        const s1 = symbols[Math.floor(Math.random() * symbols.length)];
        const s2 = symbols[Math.floor(Math.random() * symbols.length)];
        const s3 = symbols[Math.floor(Math.random() * symbols.length)];
        const won = s1 === s2 && s2 === s3;
        const partial = s1 === s2 || s2 === s3 || s1 === s3;
        const amount = won ? bet * 5 : partial ? Math.floor(bet * 0.5) : -bet;
        await economy.updateBalance(guildId, userId, amount);
        economy.logTx(guildId, userId, won ? 'slots_win' : 'slots_loss', amount, `Slots: ${s1} ${s2} ${s3}`);
        const updated = economy.balance(guildId, userId);
        const embed = {
          color: won ? BRAND.colors.success : partial ? BRAND.colors.warn : BRAND.colors.danger,
          title: won ? '🎰 JACKPOT!' : partial ? '🎰 Almost!' : '🎰 No luck...',
          description: `**[ ${s1} | ${s2} | ${s3} ]**\n\n${won ? `You won **${economy.format(amount)}** ₣Ԡ🇽!` : partial ? `Close! You got back **${economy.format(Math.abs(amount))}** ₣Ԡ🇽` : `You lost **${economy.format(Math.abs(amount))}** ₣Ԡ🇽`}\nBalance: **${economy.format(updated.balance)}** ₣Ԡ🇽`,
          footer: { text: BRAND.footer },
        };
        await message.reply({ embeds: [embed] });
        return true;
      }

      case 'dice': {
        const diceMatch = parsed.raw.match(/^(\d+)d(\d+)([+-]\d+)?$/i);
        if (!diceMatch) {
          await message.reply({ embeds: [views.warnEmbed('Dice', 'Format: `!dice 2d6+3` or `!dice d20`')] });
          return true;
        }
        const count = Math.min(20, parseInt(diceMatch[1], 10));
        const sides = parseInt(diceMatch[2], 10);
        const mod = diceMatch[3] ? parseInt(diceMatch[3], 10) : 0;
        if (sides < 1 || sides > 1000) {
          await message.reply({ embeds: [views.warnEmbed('Dice', 'Sides must be 1-1000.')] });
          return true;
        }
        const rolls = [];
        for (let i = 0; i < count; i++) rolls.push(Math.floor(Math.random() * sides) + 1);
        const total = rolls.reduce((a, b) => a + b, 0) + mod;
        const embed = {
          color: BRAND.colors.primary,
          title: '🎲 Dice Roll',
          description: `**${count}d${sides}${mod ? (mod > 0 ? '+' : '') + mod : ''}**\nRolls: [${rolls.join(', ')}]${mod ? ` ${mod > 0 ? '+' : ''}${mod}` : ''}\n**Total: ${total}**`,
          footer: { text: BRAND.footer },
        };
        await message.reply({ embeds: [embed] });
        return true;
      }

      case '8ball': {
        const answers = [
          '🟢 It is certain.', '🟢 It is decidedly so.', '🟢 Without a doubt.', '🟢 Yes — definitely.',
          '🟢 You may rely on it.', '🟢 As I see it, yes.', '🟢 Most likely.', '🟢 Outlook good.',
          '🟡 Yes.', '🟡 Reply hazy, try again.', '🟡 Ask again later.', '🟡 Better not tell you now.',
          '🔴 Don\'t count on it.', '🔴 My reply is no.', '🔴 My sources say no.', '🔴 Outlook not so good.',
          '🔴 Very doubtful.', '🔴 No.',
        ];
        const q = parsed.question || '...nothing?';
        const a = answers[Math.floor(Math.random() * answers.length)];
        const embed = {
          color: BRAND.colors.primary,
          title: '🎱 Magic 8-Ball',
          description: `**Q:** ${q}\n**A:** ${a}`,
          footer: { text: BRAND.footer },
        };
        await message.reply({ embeds: [embed] });
        return true;
      }

      case 'choose': {
        if (parsed.options.length < 2) {
          await message.reply({ embeds: [views.warnEmbed('Choose', 'Give me options: `!choose option1 | option2 | option3`')] });
          return true;
        }
        const pick = parsed.options[Math.floor(Math.random() * parsed.options.length)];
        const embed = {
          color: BRAND.colors.primary,
          title: '🤔 I choose...',
          description: `**${pick}**\n\n*(from ${parsed.options.length} options)*`,
          footer: { text: BRAND.footer },
        };
        await message.reply({ embeds: [embed] });
        return true;
      }

      case 'ship': {
        const target = parsed.targetId ? message.mentions.users.get(parsed.targetId) : null;
        if (!target) {
          await message.reply({ embeds: [views.warnEmbed('Ship', 'Mention someone: `!ship @user`')] });
          return true;
        }
        const compat = Math.floor(Math.random() * 101);
        const heart = compat >= 80 ? '💖' : compat >= 50 ? '💔' : compat >= 25 ? '💔' : '💀';
        const bar = '█'.repeat(Math.round(compat / 10)) + '░'.repeat(10 - Math.round(compat / 10));
        const verdict = compat >= 90 ? 'Soulmates! 💍' : compat >= 70 ? 'Perfect match! 💕' : compat >= 50 ? 'Could work! 🤞' : compat >= 30 ? 'Friends zone 😅' : 'Better as enemies 💀';
        const embed = {
          color: compat >= 50 ? BRAND.colors.success : BRAND.colors.danger,
          title: '💘 Love Calculator',
          description: `${message.author.username} × ${target.username}\n\n${bar} **${compat}%** ${heart}\n\n*${verdict}*`,
          footer: { text: BRAND.footer },
        };
        await message.reply({ embeds: [embed] });
        return true;
      }

      case 'rate': {
        const thing = parsed.thing || 'this message';
        const rating = Math.floor(Math.random() * 11);
        const stars = '⭐'.repeat(rating) + '☆'.repeat(10 - rating);
        const embed = {
          color: BRAND.colors.primary,
          title: '📊 Rating',
          description: `I rate **${thing}** a...\n\n${stars}\n**${rating}/10**`,
          footer: { text: BRAND.footer },
        };
        await message.reply({ embeds: [embed] });
        return true;
      }

      default:
        // Unknown `!`-commands are left alone (other bots may use them);
        // unknown `fgx`-commands get guidance.
        if (bang) return false;
        await message.reply({
          embeds: [views.warnEmbed('Unknown command', `\`fgx ${parsed.raw}\` isn't a thing. Try \`fgx help\` — or use \`/help\`.`)],
        });
        return true;
    }
  } catch (err) {
    const codes = ['ALREADY_CLAIMED', 'INVALID_AMOUNT', 'SELF_TRANSFER', 'INSUFFICIENT', 'RATE_LIMITED', 'HUNT_COOLDOWN', 'BATTLE_COOLDOWN', 'PRAY_COOLDOWN', 'WORK_COOLDOWN', 'CRIME_COOLDOWN', 'ROB_COOLDOWN', 'FISH_COOLDOWN', 'TARGET_POOR', 'UNKNOWN_ANIMAL', 'NOT_OWNED', 'UNKNOWN_KIND', 'VIP_LOCKED'];
    if (codes.includes(err.code)) {
      await message.reply({ embeds: [views.warnEmbed('FGx coins', err.message)] }).catch(() => {});
      return true;
    }
    logger.warn('chat command failed', { guildId, userId, error: err.message });
    return true;
  }
}

module.exports = { handle, stripPrefix, stripBangPrefix, parseCommand, parseAmount, CHAT_RATE_LIMIT, helpEmbed, SECTION_ALIASES };
