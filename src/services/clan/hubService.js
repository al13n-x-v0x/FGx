'use strict';

/*
 * Copyright © 2026 FGx.
 * All rights reserved.
 */

const {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder,
  StringSelectMenuBuilder,
} = require('discord.js');
const robloxService = require('../community/robloxService');
const { BRAND, RANKS, TICKET_TYPES } = require('../../config/constants');
const { profilesRepo } = require('../../database/repos/profiles');
const { scrimsRepo, eventsRepo, clanWarsRepo, matchesRepo } = require('../../database/repos/competitive');
const { tryoutsRepo } = require('../../database/repos/community');
const { guildConfigRepo } = require('../../database/repos/guildConfig');
const { privateServersRepo } = require('../../database/repos/privateServers');
const privateServerService = require('./privateServerService');
const economy = require('../community/economyService');
const { aiSummary } = require('../../config/env');
const rosterService = require('./rosterService');
const { verificationService } = require('../community/verificationService');
const { winRate } = require('../../utils/format');

/**
 * /bloxstrike interactive hub.
 * Clean menu (select) → section panels, all rendered from real data.
 */

const OPTIONS = [
  { value: 'profile', label: '👤 Profile', description: 'Your FGx player profile' },
  { value: 'roster', label: '⚔️ Roster', description: 'Current clan roster' },
  { value: 'leaderboards', label: '🏆 Leaderboards', description: 'Competitive rankings' },
  { value: 'tryouts', label: '🎯 Tryouts', description: 'Applications & status' },
  { value: 'scrims', label: '🔥 Scrims', description: 'Upcoming scrims' },
  { value: 'clanwars', label: '⚔️ Clan Wars', description: 'War history' },
  { value: 'events', label: '📅 Events', description: 'Upcoming events' },
  { value: 'stats', label: '📊 Statistics', description: 'FGx competitive record' },
  { value: 'loadouts', label: '🎒 Loadouts', description: 'BloxStrike buy & role guide' },
  { value: 'roblox', label: '🟥 Roblox', description: 'Bloxlink-style Roblox verification' },
  { value: 'private', label: '🎮 Private Server', description: 'Temporary match servers (1v1–6v6)' },
  { value: 'coins', label: '💰 FGx Coins', description: 'Your FGx economy wallet' },
  { value: 'support', label: '🎫 Support', description: 'Tickets & help' },
  { value: 'ai', label: '🤖 FGx AI', description: 'Assistant status & usage' },
  { value: 'security', label: '🛡️ Security', description: 'Protection status' },
  { value: 'vip', label: '👑 VIP', description: 'Locked perks for fully verified members' },
];

/** Quick-action buttons (customId bloxstrike:btn:<section>). */
const QUICK_ACTIONS = [
  ['profile', '👤', 'Profile'],
  ['roster', '⚔️', 'Roster'],
  ['leaderboards', '🏆', 'Leaderboard'],
  ['loadouts', '🎒', 'Loadouts'],
  ['roblox', '🟥', 'Roblox'],
  ['scrims', '🔥', 'Scrims'],
  ['clanwars', '⚔️', 'Wars'],
  ['events', '📅', 'Events'],
  ['private', '🎮', 'Private'],
  ['support', '🎫', 'Support'],
  ['ai', '🤖', 'AI'],
  ['vip', '👑', 'VIP'],
];

function mainEmbed({ title = 'FGx • BloxStrike Command Hub' } = {}) {
  return new EmbedBuilder()
    .setColor(BRAND.colors.primary)
    .setTitle(title)
    .setDescription(
      'Select a section below — or use the quick buttons.\n\n' +
        '👤 Profile\n⚔️ Roster\n🏆 Leaderboards\n🎯 Tryouts\n' +
        '🔥 Scrims\n⚔️ Clan Wars\n📅 Events\n📊 Statistics\n🎒 Loadouts\n' +
        '🟥 Roblox\n🎮 Private Server\n💰 FGx Coins\n🎫 Support\n🤖 FGx AI\n🛡️ Security\n👑 VIP',
    )
    .setFooter({ text: BRAND.footer });
}

/** Quick-action button rows (2 rows × 5 buttons). */
function quickActionRows() {
  const [first, second] = [QUICK_ACTIONS.slice(0, 5), QUICK_ACTIONS.slice(5)];
  return [first, second].map((group) =>
    new ActionRowBuilder().addComponents(
      group.map(([value, emoji, label]) =>
        new ButtonBuilder()
          .setCustomId(`bloxstrike:btn:${value}`)
          .setStyle(ButtonStyle.Secondary)
          .setEmoji(emoji)
          .setLabel(label),
      ),
    ),
  );
}

function navRow(back = false) {
  const select = new StringSelectMenuBuilder()
    .setCustomId('bloxstrike:menu')
    .setPlaceholder('Navigate FGx…')
    .addOptions(OPTIONS);
  const row = new ActionRowBuilder().addComponents(select);
  if (back) {
    row.addComponents(
      new ButtonBuilder().setCustomId('bloxstrike:back').setStyle(ButtonStyle.Secondary).setLabel('← Back'),
    );
  }
  return row;
}

/** Full component set: nav select (+ back) and quick-action buttons. */
function hubComponents(back = false) {
  return back ? [navRow(true), ...quickActionRows()] : [navRow(false), ...quickActionRows()];
}

/** Render a hub section. Returns { embeds, components }. */
function renderSection(guild, userId, section) {
  const rows = profilesRepo.allByRating(guild.id);

  switch (section) {
    case 'profile': {
      const profile = profilesRepo.ensure(guild.id, userId);
      const member = guild.members.cache.get(userId);
      const embed = new EmbedBuilder()
        .setColor(BRAND.colors.primary)
        .setAuthor({ name: member?.displayName ?? userId, iconURL: member?.displayAvatarURL() ?? undefined })
        .setTitle('FGx Player Profile')
        .addFields(
          { name: 'Clan Rank', value: profile.clan_rank ?? 'Recruit', inline: true },
          { name: 'BloxStrike', value: profile.blox_username ?? 'Not linked', inline: true },
          { name: 'Record', value: `${profile.wins ?? 0}W ${profile.losses ?? 0}L`, inline: true },
          { name: 'Kills', value: String(profile.kills ?? 0), inline: true },
          { name: 'Deaths', value: String(profile.deaths ?? 0), inline: true },
          { name: 'K/D', value: (profile.deaths > 0 ? (profile.kills / profile.deaths).toFixed(2) : (profile.kills || '0.00')), inline: true },
          { name: 'Matches', value: String(profile.matches ?? 0), inline: true },
          { name: 'Win Rate', value: winRate(profile.wins ?? 0, profile.matches ?? 0), inline: true },
          { name: 'FGx Rating', value: String(profile.rating ?? 0), inline: true },
          {
            name: 'VIP',
            value: verificationService.status(guild.id, userId).full ? '👑 Unlocked' : '🔒 Locked',
            inline: true,
          },
        )
        .setFooter({ text: `${BRAND.footer} • FGx Competitive Rating` });
      return { embeds: [embed], components: hubComponents(true) };
    }

    case 'roster': {
      const sorted = rosterService.listRoster(guild.id);
      const grouped = new Map(RANKS.map((r) => [r, []]));
      for (const p of sorted) {
        const rank = p.clan_rank && grouped.has(p.clan_rank) ? p.clan_rank : 'Recruit';
        grouped.get(rank).push(p);
      }
      const embed = new EmbedBuilder()
        .setColor(BRAND.colors.primary)
        .setTitle(`FGx Roster — ${sorted.length} members`);
      for (const rank of RANKS) {
        const members = grouped.get(rank);
        if (members.length === 0) continue;
        const lines = members
          .slice(0, 12)
          .map((m) => `<@${m.user_id}> — ${m.matches ?? 0} matches, ${m.rating ?? 0} rating${m.meta && safeParse(m.meta, {}).inactive ? ' *(inactive)*' : ''}`);
        embed.addFields({ name: `${rank} (${members.length})`, value: lines.join('\n') || '—' });
      }
      embed.setFooter({ text: BRAND.footer });
      return { embeds: [embed], components: hubComponents(true) };
    }

    case 'leaderboards': {
      const top = rows.slice(0, 10);
      const lines = top.map(
        (m, i) => `**#${i + 1}** <@${m.user_id}> — ${m.rating ?? 0} rating (${m.wins ?? 0}W ${m.losses ?? 0}L)`,
      );
      const embed = new EmbedBuilder()
        .setColor(BRAND.colors.primary)
        .setTitle('🏆 FGx Leaderboard — Rating')
        .setDescription(lines.join('\n') || 'No recorded matches yet.')
        .setFooter({ text: `${BRAND.footer} • FGx Competitive Rating` });
      return { embeds: [embed], components: hubComponents(true) };
    }

    case 'tryouts': {
      const pending = tryoutsRepo.list(guild.id, 'pending').length;
      const embed = new EmbedBuilder()
        .setColor(BRAND.colors.primary)
        .setTitle('🎯 FGx Tryouts')
        .setDescription(
          `Open applications: **${pending}**\n\n` +
            'Apply with `/tryout apply`. Staff review each application privately.',
        );
      return { embeds: [embed], components: hubComponents(true) };
    }

    case 'scrims': {
      const upcoming = scrimsRepo.list(guild.id, 'SCHEDULED').slice(0, 5);
      const lines = upcoming.map((s) => `**${s.opponent}** — ${s.format}, ${s.status}`);
      const embed = new EmbedBuilder()
        .setColor(BRAND.colors.primary)
        .setTitle('🔥 FGx Scrims')
        .setDescription(lines.join('\n') || 'No scrims scheduled. Staff can create one with `/scrim create`.');
      return { embeds: [embed], components: hubComponents(true) };
    }

    case 'clanwars': {
      const wars = clanWarsRepo.list(guild.id, 10);
      const record = clanWarsRepo.record(guild.id);
      const lines = wars.map((w) => `**${w.opponent}** — ${w.status}${w.winner ? ` (${w.winner})` : ''}`);
      const embed = new EmbedBuilder()
        .setColor(BRAND.colors.primary)
        .setTitle('⚔️ Clan Wars')
        .setDescription(
          `Record: **${record?.wins ?? 0}W ${record?.losses ?? 0}L ${record?.draws ?? 0}D**\n\n` +
            (lines.join('\n') || 'No wars recorded yet.'),
        );
      return { embeds: [embed], components: hubComponents(true) };
    }

    case 'events': {
      const upcoming = eventsRepo.list(guild.id, 'scheduled').slice(0, 5);
      const lines = upcoming.map((e) => `**${e.title}** — ${e.type}, ${e.status}`);
      const embed = new EmbedBuilder()
        .setColor(BRAND.colors.primary)
        .setTitle('📅 FGx Events')
        .setDescription(lines.join('\n') || 'No upcoming events.');
      return { embeds: [embed], components: hubComponents(true) };
    }

    case 'roblox': {
      const config = guildConfigRepo.get(guild.id);
      const link = robloxService.linkStatus(guild.id, userId);
      const verified = robloxService.countVerified(guild.id);
      const role = config.roblox.roleId || config.verification.roleId;
      const roleLabel = role ? `<@&${role}>` : '(no role configured) — staff: `/config roblox`';
      const embed = new EmbedBuilder()
        .setColor(BRAND.colors.primary)
        .setTitle('🟥 FGx Roblox Verification')
        .setDescription(
          (link && link.status === 'verified'
            ? `**Verified as** \`${link.roblox_username}\`${link.verified_at ? ` (${link.verified_at})` : ''}\n\n`
            : link && link.status === 'pending'
              ? `**Pending** — put the code from your verification message in your Roblox About section, then press **Check**.\n\n`
              : 'Not linked yet.\n\n') +
            `**Verified members:** ${verified}${verified > 0 ? ' — staff: `/roblox list`' : ''}\n\n` +
            `Reward: **${roleLabel}**\n\n` +
            '**How it works (Bloxlink-style)**\n' +
            '1. Click **Verify with Roblox**\n' +
            '2. Enter your Roblox username\n' +
            '3. Put the code FGx gives you in your Roblox **About** section\n' +
            '4. Press **Check** — your Roblox account is linked to your Discord',
        )
        .setFooter({ text: `${BRAND.footer} • Uses Roblox public API — no password, no scraping` });
      const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId('roblox:start').setStyle(ButtonStyle.Primary).setLabel('Verify with Roblox'),
      );
      if (link && link.status === 'verified') {
        row.addComponents(
          new ButtonBuilder().setCustomId('roblox:unlink').setStyle(ButtonStyle.Danger).setLabel('Unlink'),
        );
      }
      return { embeds: [embed], components: [row, navRow(true)] };
    }

    case 'private': {
      const active = privateServersRepo.listActive(guild.id);
      const embed = new EmbedBuilder()
        .setColor(BRAND.colors.primary)
        .setTitle('🎮 FGx Private Servers')
        .setDescription(
          'Temporary branded servers for **BloxStrike matches** — 1v1 through 6v6 and practice.\n\n' +
            '• Requires **Roblox verification** (`/roblox verify`) unless staff\n' +
            '• Auto-deletes after the timer (1–24h)\n' +
            '• Full setup: match-chat, results, Main, Team 1/Team 2\n\n' +
            (active.length > 0
              ? `**Active:** ${active
                  .map(
                    (r) =>
                      `#${r.id} ${privateServerService.MODES[r.mode]?.label ?? r.mode} — ` +
                      `https://discord.gg/${r.invite_code ?? '—'} (until ${r.expires_at ?? '—'})`,
                  )
                  .join('\n')}`
              : 'No active servers — pick a mode below to create one.') +
            '\n\nChoose a mode:',
        )
        .setFooter({ text: `${BRAND.footer} • Managed by /private` });
      const modeRow = new ActionRowBuilder().addComponents(
        new StringSelectMenuBuilder()
          .setCustomId('private:mode')
          .setPlaceholder('Choose a match mode…')
          .addOptions(
            Object.entries(privateServerService.MODES).map(([value, info]) => ({
              value,
              label: `FGx ${info.label}`,
              description: value === 'practice' ? 'Free practice / aim server' : 'Team-based match server',
            })),
          ),
      );
      return { embeds: [embed], components: [modeRow, navRow(true), ...quickActionRows()] };
    }

    case 'coins': {
      const row = economy.balance(guild.id, userId);
      const top = economy.leaderboard(guild.id, 5);
      const embed = new EmbedBuilder()
        .setColor(BRAND.colors.primary)
        .setTitle('💰 FGx Coins')
        .setDescription(
          `**Your balance:** ${economy.format(row.balance ?? 0)}\n` +
            `**Lifetime earned:** ${economy.format(row.lifetime ?? 0)}\n` +
            `**Daily streak:** ${row.daily_streak ?? 0} day${(row.daily_streak ?? 0) === 1 ? '' : 's'}\n\n` +
            '**How to earn & spend:**\n' +
            '• `/fgxcoin daily` — daily reward (+streak bonus)\n' +
            '• `/fgxcoin weekly` — weekly reward\n' +
            '• `/fgxcoin transfer` — send to a friend (5% tax)\n' +
            '• `/fgxcoin gamble` — 50/50 double-or-nothing\n\n' +
            (top.length > 0 ? `**Top wallets:**\n${top.map((r, i) => `${['🥇', '🥈', '🥉'][i] ?? `${i + 1}.`} <@${r.user_id}> — ${economy.format(r.balance ?? 0)}`).join('\n')}` : 'No coins in circulation yet — claim your `/fgxcoin daily`.'),
        )
        .setFooter({ text: `${BRAND.footer} • FGx economy` });
      return { embeds: [embed], components: hubComponents(true) };
    }

    case 'support': {
      const tickets = guildConfigRepo.get(guild.id).tickets;
      const embed = new EmbedBuilder()
        .setColor(BRAND.colors.primary)
        .setTitle('🎫 FGx Support')
        .setDescription(
          tickets.enabled && tickets.panelChannelId
            ? `Open the ticket panel in <#${tickets.panelChannelId}> and pick a category — a private channel opens for you and staff.`
            : 'Tickets are not configured yet. Staff: run `/setup` to create the ticket system.'
        )
        .addFields(
          { name: 'Categories', value: Object.keys(TICKET_TYPES).join('\n'), inline: true },
          { name: 'Staff', value: tickets.staffRoleIds.length > 0 ? 'Configured' : 'Not configured (staff = Manage Channels)', inline: true },
        )
        .setFooter({ text: `${BRAND.footer} • Claim / Close / Transcript built in` });
      return { embeds: [embed], components: hubComponents(true) };
    }

    case 'ai': {
      const ai = guildConfigRepo.get(guild.id).ai;
      const embed = new EmbedBuilder()
        .setColor(BRAND.colors.primary)
        .setTitle('🤖 FGx AI')
        .setDescription(
          `**Assistant:** ${ai.assistantEnabled ? 'Enabled' : 'Disabled'}\n` +
            `**Security analysis:** ${ai.securityEnabled ? 'Enabled' : 'Disabled'} (mode ${ai.actionMode})\n` +
            `**Provider pool:** ${aiSummary()}\n\n` +
            'Ask me anything with `/ask`, `/ai`, or `/bloxai` — loadouts, clan info, scrims, and more. ' +
            'I never reveal secrets and never invent statistics.'
        )
        .setFooter({ text: `${BRAND.footer} • Rate-limited 5 calls/min` });
      return { embeds: [embed], components: hubComponents(true) };
    }

    case 'security': {
      const config = guildConfigRepo.get(guild.id);
      const embed = new EmbedBuilder()
        .setColor(BRAND.colors.primary)
        .setTitle('🛡️ FGx Security')
        .setDescription(
          `**Protection mode:** ${config.security.lockdown ? '🟢 ACTIVE' : '⚪ Inactive'}\n` +
            `**Anti-spam:** ${config.antispam.enabled ? 'Enabled' : 'Disabled'} (action ${config.antispam.action})\n` +
            `**Anti-raid:** ${config.antiraid.enabled ? 'Enabled' : 'Disabled'} (threshold ${config.antiraid.joinThreshold}/${config.antiraid.windowSeconds}s)\n` +
            `**Anti-nuke:** ${config.antinuke.enabled ? 'Enabled' : 'Disabled'} (${config.antinuke.channelDeleteLimit} deletions/min)\n` +
            `**AI moderation:** ${config.ai.securityEnabled ? 'Enabled' : 'Disabled'} (mode ${config.ai.actionMode})\n` +
            `**Verification:** ${config.verification.enabled ? 'Enabled' : 'Disabled'}\n\n` +
            'Staff: manage everything with `/security` and `/automod`. Incident alerts post to the log channel.'
        )
        .setFooter({ text: `${BRAND.footer} • Progressive enforcement, never blind punishment` });
      return { embeds: [embed], components: hubComponents(true) };
    }

    case 'loadouts': {
      const { ROLES, VIP_ROLES, BUY_SITUATIONS } = require('../../data/bloxstrike');
      const vip = verificationService.status(guild.id, userId).full;
      const embed = new EmbedBuilder()
        .setColor(BRAND.colors.primary)
        .setTitle('🎒 BloxStrike Loadout Guide')
        .setDescription('FGx-curated strategy — weapon advice by class and role, so it stays useful across balance patches.')
        .addFields(
          {
            name: '💸 Buy situations',
            value: BUY_SITUATIONS.map((b) => `**${b.situation}** — ${b.plan}`).join('\n'),
          },
          {
            name: '🎭 Roles',
            value: ROLES.map((r) => `**${r.role}** — ${r.loadout}`).join('\n'),
          },
          {
            name: vip ? '👑 VIP Pro Loadouts' : '🔒 VIP Pro Loadouts (locked)',
            value: vip
              ? VIP_ROLES.map((r) => `**${r.role}** — ${r.loadout}\n*${r.tips}*`).join('\n')
              : 'Fully verify — `/link` (staff approval) **and** `/roblox verify` — to unlock 4 pro loadouts: clutch tech, entry primetime, eco baron strats and impossible-to-rush anchors.',
          },
        )
        .setFooter({ text: `${BRAND.footer} • Ask /bloxai for tailored advice` });
      return { embeds: [embed], components: hubComponents(true) };
    }

    case 'vip': {
      const s = verificationService.status(guild.id, userId);
      const embed = new EmbedBuilder()
        .setColor(BRAND.colors.primary)
        .setTitle(s.full ? '👑 VIP — Unlocked' : '🔒 VIP — Locked')
        .setDescription(
          verificationService.statusLines(s).join('\n') +
            '\n\n**Perks when unlocked**\n' +
            '• 👑 `!vip daily` — 250 ₣Ԡ🇽 extra every day\n' +
            '• 🎒 4 pro loadouts in the Loadouts guide\n' +
            '• 🏅 Crown badge on your profile\n' +
            '• 🎮 Priority access to private match servers',
        )
        .setFooter({ text: `${BRAND.footer} • Verify both to unlock` });
      return { embeds: [embed], components: hubComponents(true) };
    }

    case 'stats': {
      const record = matchesRepo.record(guild.id);
      const embed = new EmbedBuilder()
        .setColor(BRAND.colors.primary)
        .setTitle('📊 FGx Statistics')
        .setDescription(
          record && record.matches > 0
            ? `**Record:** ${record.wins}W ${record.losses}L ${record.draws}D (${record.matches} matches)\n` +
              `**Total score:** ${record.total_ours ?? 0} : ${record.total_opps ?? 0}\n` +
              `**Win rate:** ${winRate(record.wins ?? 0, record.matches ?? 0)}`
            : 'No recorded competitive data yet. Staff record results with `/match result`.',
        );
      return { embeds: [embed], components: hubComponents(true) };
    }

    default:
      return { embeds: [mainEmbed()], components: hubComponents(false) };
  }
}

function safeParse(json, fallback) {
  try {
    return JSON.parse(json);
  } catch {
    return fallback;
  }
}

module.exports = { mainEmbed, navRow, hubComponents, quickActionRows, renderSection, OPTIONS };
