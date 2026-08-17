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
const { BRAND, RANKS, TICKET_TYPES } = require('../../config/constants');
const { profilesRepo } = require('../../database/repos/profiles');
const { scrimsRepo, eventsRepo, clanWarsRepo, matchesRepo } = require('../../database/repos/competitive');
const { tryoutsRepo } = require('../../database/repos/community');
const { guildConfigRepo } = require('../../database/repos/guildConfig');
const { aiSummary } = require('../../config/env');
const rosterService = require('./rosterService');
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
  { value: 'support', label: '🎫 Support', description: 'Tickets & help' },
  { value: 'ai', label: '🤖 FGx AI', description: 'Assistant status & usage' },
  { value: 'security', label: '🛡️ Security', description: 'Protection status' },
];

function mainEmbed({ title = 'FGx • BloxStrike Command Hub' } = {}) {
  return new EmbedBuilder()
    .setColor(BRAND.colors.primary)
    .setTitle(title)
    .setDescription(
      'Select a section below.\n\n' +
        '👤 Profile\n⚔️ Roster\n🏆 Leaderboards\n🎯 Tryouts\n' +
        '🔥 Scrims\n⚔️ Clan Wars\n📅 Events\n📊 Statistics\n🎒 Loadouts\n' +
        '🎫 Support\n🤖 FGx AI\n🛡️ Security',
    )
    .setFooter({ text: BRAND.footer });
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
        )
        .setFooter({ text: `${BRAND.footer} • FGx Competitive Rating` });
      return { embeds: [embed], components: [navRow(true)] };
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
      return { embeds: [embed], components: [navRow(true)] };
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
      return { embeds: [embed], components: [navRow(true)] };
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
      return { embeds: [embed], components: [navRow(true)] };
    }

    case 'scrims': {
      const upcoming = scrimsRepo.list(guild.id, 'SCHEDULED').slice(0, 5);
      const lines = upcoming.map((s) => `**${s.opponent}** — ${s.format}, ${s.status}`);
      const embed = new EmbedBuilder()
        .setColor(BRAND.colors.primary)
        .setTitle('🔥 FGx Scrims')
        .setDescription(lines.join('\n') || 'No scrims scheduled. Staff can create one with `/scrim create`.');
      return { embeds: [embed], components: [navRow(true)] };
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
      return { embeds: [embed], components: [navRow(true)] };
    }

    case 'events': {
      const upcoming = eventsRepo.list(guild.id, 'scheduled').slice(0, 5);
      const lines = upcoming.map((e) => `**${e.title}** — ${e.type}, ${e.status}`);
      const embed = new EmbedBuilder()
        .setColor(BRAND.colors.primary)
        .setTitle('📅 FGx Events')
        .setDescription(lines.join('\n') || 'No upcoming events.');
      return { embeds: [embed], components: [navRow(true)] };
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
      return { embeds: [embed], components: [navRow(true)] };
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
      return { embeds: [embed], components: [navRow(true)] };
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
      return { embeds: [embed], components: [navRow(true)] };
    }

    case 'loadouts': {
      const { ROLES, BUY_SITUATIONS } = require('../../data/bloxstrike');
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
        )
        .setFooter({ text: `${BRAND.footer} • Ask /bloxai for tailored advice` });
      return { embeds: [embed], components: [navRow(true)] };
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
      return { embeds: [embed], components: [navRow(true)] };
    }

    default:
      return { embeds: [mainEmbed()], components: [navRow(false)] };
  }
}

function safeParse(json, fallback) {
  try {
    return JSON.parse(json);
  } catch {
    return fallback;
  }
}

module.exports = { mainEmbed, navRow, renderSection, OPTIONS };
