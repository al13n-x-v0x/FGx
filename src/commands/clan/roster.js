'use strict';

/*
 * Copyright © 2026 FGx.
 * All rights reserved.
 */

const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { BRAND, RANKS } = require('../../config/constants');
const { guildConfigRepo } = require('../../database/repos/guildConfig');
const { profilesRepo } = require('../../database/repos/profiles');
const rosterService = require('../../services/clan/rosterService');
const { ValidationError } = require('../../utils/errors');

const RANK_CHOICES = RANKS.map((r) => ({ name: r, value: r }));

module.exports = {
  data: new SlashCommandBuilder()
    .setName('roster')
    .setDescription('FGx clan roster management.')
    .addSubcommand((s) => s.setName('view').setDescription('View the full roster'))
    .addSubcommand((s) =>
      s
        .setName('add')
        .setDescription('Add a member to the roster (staff)')
        .addUserOption((o) => o.setName('user').setDescription('Member').setRequired(true))
        .addStringOption((o) => o.setName('rank').setDescription('Clan rank').setRequired(true).addChoices(...RANK_CHOICES)),
    )
    .addSubcommand((s) =>
      s
        .setName('remove')
        .setDescription('Remove a member from the roster (staff)')
        .addUserOption((o) => o.setName('user').setDescription('Member').setRequired(true)),
    )
    .addSubcommand((s) =>
      s
        .setName('promote')
        .setDescription('Promote a member one rank (staff)')
        .addUserOption((o) => o.setName('user').setDescription('Member').setRequired(true)),
    )
    .addSubcommand((s) =>
      s
        .setName('demote')
        .setDescription('Demote a member one rank (staff)')
        .addUserOption((o) => o.setName('user').setDescription('Member').setRequired(true)),
    )
    .addSubcommand((s) =>
      s
        .setName('inactive')
        .setDescription('Mark a member inactive or active (staff)')
        .addUserOption((o) => o.setName('user').setDescription('Member').setRequired(true))
        .addBooleanOption((o) => o.setName('active').setDescription('Set active (default: false = inactive)')),
    ),
  async execute(interaction) {
    const sub = interaction.options.getSubcommand();
    const config = guildConfigRepo.get(interaction.guild.id);

    if (sub === 'view') {
      const sorted = rosterService.listRoster(interaction.guild.id);
      const grouped = new Map(RANKS.map((r) => [r, []]));
      for (const p of sorted) {
        const rank = p.clan_rank && grouped.has(p.clan_rank) ? p.clan_rank : 'Recruit';
        grouped.get(rank).push(p);
      }
      const embed = new EmbedBuilder()
        .setColor(BRAND.colors.primary)
        .setTitle(`FGx Roster — ${sorted.length} members`)
        .setFooter({ text: `${BRAND.footer} • /roster add to register members` });
      for (const rank of RANKS) {
        const members = grouped.get(rank);
        if (members.length === 0) continue;
        embed.addFields({
          name: `${rank} (${members.length})`,
          value: members
            .slice(0, 12)
            .map(
              (m) =>
                `<@${m.user_id}> — ${m.matches ?? 0} matches, ${m.rating ?? 0} rating` +
                (m.meta && safeParse(m.meta, {}).inactive ? ' *(inactive)*' : ''),
            )
            .join('\n'),
        });
      }
      return interaction.reply({ embeds: [embed] });
    }

    // Staff-only operations.
    rosterService.requireStaff(interaction.member, config);
    const target = interaction.options.getUser('user', true);
    const member = await interaction.guild.members.fetch(target.id).catch(() => null);

    if (sub === 'add') {
      const rank = rosterService.resolveRank(interaction.options.getString('rank', true));
      if (!member) throw new ValidationError('That member is not in this server.');
      await rosterService.setRank(interaction.client, interaction.guild, member, rank);
      return interaction.reply({
        embeds: [{ color: BRAND.colors.success, title: 'Roster updated', description: `${target} is now **${rank}**.` }],
      });
    }

    if (sub === 'remove') {
      const profile = profilesRepo.get(interaction.guild.id, target.id);
      if (!profile) throw new ValidationError('That member is not on the roster.');
      profilesRepo.updateStats(interaction.guild.id, target.id, { clan_rank: 'Recruit', meta: { removed: true } });
      const { logAudit } = require('../../services/logging/auditLogger');
      await logAudit(interaction.client, interaction.guild, {
        action: 'roster',
        target,
        moderator: interaction.user,
        reason: 'Removed from roster',
      });
      return interaction.reply({
        embeds: [{ color: BRAND.colors.danger, title: 'Roster updated', description: `${target} was removed from the roster.` }],
      });
    }

    if (sub === 'promote' || sub === 'demote') {
      const profile = profilesRepo.ensure(interaction.guild.id, target.id);
      const current = profile.clan_rank ?? 'Recruit';
      const idx = RANKS.indexOf(current);
      const nextIdx = sub === 'promote' ? Math.min(idx + 1, RANKS.length - 1) : Math.max(idx - 1, 0);
      const next = RANKS[nextIdx];
      if (next === current) {
        throw new ValidationError(`${target.username} is already at the ${current} rank.`);
      }
      if (member) {
        await rosterService.setRank(interaction.client, interaction.guild, member, next);
      } else {
        profilesRepo.updateStats(interaction.guild.id, target.id, { clan_rank: next });
      }
      return interaction.reply({
        embeds: [
          {
            color: BRAND.colors.success,
            title: 'Rank updated',
            description: `${target}: **${current} → ${next}**`,
          },
        ],
      });
    }

    if (sub === 'inactive') {
      const active = interaction.options.getBoolean('active') ?? false;
      const isInactive = await rosterService.setInactive(interaction.client, interaction.guild, member ?? { user: target, id: target.id }, { active });
      return interaction.reply({
        embeds: [
          {
            color: BRAND.colors.neutral,
            title: 'Roster updated',
            description: `${target} marked **${isInactive ? 'inactive' : 'active'}**.`,
          },
        ],
      });
    }
  },
};

function safeParse(value, fallback) {
  try {
    return JSON.parse(value);
  } catch {
    return fallback;
  }
}
