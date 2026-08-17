'use strict';

/*
 * Copyright © 2026 FGx.
 * All rights reserved.
 */

const { SlashCommandBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const { guildConfigRepo } = require('../../database/repos/guildConfig');
const { scrimsRepo } = require('../../database/repos/competitive');
const rosterService = require('../../services/clan/rosterService');
const participation = require('../../services/clan/participation');
const announcements = require('../../services/clan/announcements');
const { logAudit } = require('../../services/logging/auditLogger');
const { ValidationError } = require('../../utils/errors');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('scrim')
    .setDescription('FGx scrim management.')
    .addSubcommand((s) =>
      s
        .setName('create')
        .setDescription('Schedule a scrim and announce it (staff)')
        .addStringOption((o) => o.setName('opponent').setDescription('Opponent clan or team').setRequired(true))
        .addStringOption((o) => o.setName('date').setDescription('Date/time, e.g. 2026-08-20 20:00 UTC'))
        .addStringOption((o) => o.setName('format').setDescription('Format, e.g. 5v5').setMaxLength(40))
        .addStringOption((o) => o.setName('mode').setDescription('Map/mode, e.g. Ranked Standard').setMaxLength(80)),
    )
    .addSubcommand((s) => s.setName('info').setDescription('Scrim details').addIntegerOption((o) => o.setName('id').setDescription('Scrim ID').setRequired(true)))
    .addSubcommand((s) => s.setName('join').setDescription('Join a scrim roster').addIntegerOption((o) => o.setName('id').setDescription('Scrim ID').setRequired(true)))
    .addSubcommand((s) => s.setName('leave').setDescription('Leave a scrim roster').addIntegerOption((o) => o.setName('id').setDescription('Scrim ID').setRequired(true)))
    .addSubcommand((s) =>
      s
        .setName('result')
        .setDescription('Record a scrim result (staff)')
        .addIntegerOption((o) => o.setName('id').setDescription('Scrim ID').setRequired(true))
        .addIntegerOption((o) => o.setName('our_score').setDescription('FGx score').setMinValue(0).setRequired(true))
        .addIntegerOption((o) => o.setName('opp_score').setDescription('Opponent score').setMinValue(0).setRequired(true)),
    )
    .addSubcommand((s) =>
      s
        .setName('cancel')
        .setDescription('Cancel a scrim (staff)')
        .addIntegerOption((o) => o.setName('id').setDescription('Scrim ID').setRequired(true)),
    ),
  async execute(interaction) {
    const sub = interaction.options.getSubcommand();
    const config = guildConfigRepo.get(interaction.guild.id);

    if (sub === 'info') {
      const scrim = scrimsRepo.get(interaction.options.getInteger('id', true));
      if (!scrim || String(scrim.guild_id) !== String(interaction.guild.id)) {
        throw new ValidationError('Scrim not found in this server.');
      }
      return interaction.reply({ embeds: [announcements.scrimEmbed(scrim)] });
    }

    if (sub === 'join' || sub === 'leave') {
      const join = sub === 'join';
      const result = await participation.toggle(
        interaction.client,
        interaction,
        scrimsRepo,
        'scrims',
        interaction.options.getInteger('id', true),
        { join },
      );
      if (!result.changed) {
        return interaction.reply({ content: join ? 'You are already signed up.' : 'You are not on that list.', ephemeral: true });
      }
      return interaction.reply({
        content: join ? `You joined. **${result.participants.length}** total.` : `You left. **${result.participants.length}** total.`,
        ephemeral: true,
      });
    }

    // Staff-only below.
    rosterService.requireStaff(interaction.member, config);

    if (sub === 'create') {
      const opponent = interaction.options.getString('opponent', true);
      const scheduledAt = interaction.options.getString('date');
      const format = interaction.options.getString('format') ?? '5v5';
      const mode = interaction.options.getString('mode') ?? 'Standard';
      const scrim = scrimsRepo.create({
        guildId: interaction.guild.id,
        opponent,
        scheduledAt,
        format,
        mode,
        createdBy: interaction.user.id,
      });

      const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId(`scrim:join:${scrim.id}`).setStyle(ButtonStyle.Success).setLabel('Join'),
        new ButtonBuilder().setCustomId(`scrim:leave:${scrim.id}`).setStyle(ButtonStyle.Secondary).setLabel('Leave'),
        new ButtonBuilder().setCustomId(`scrim:shuffle:${scrim.id}`).setStyle(ButtonStyle.Secondary).setLabel('🔀 Shuffle'),
      );
      const message = await interaction.reply({ embeds: [announcements.scrimEmbed(scrim)], components: [row], fetchReply: true });
      scrimsRepo.update(scrim.id, { channel_id: interaction.channel.id, message_id: message.id });

      await logAudit(interaction.client, interaction.guild, {
        action: 'match',
        target: null,
        moderator: interaction.user,
        reason: `Scrim scheduled vs ${opponent}`,
        details: { id: scrim.id, format },
      });
      return;
    }

    if (sub === 'result' || sub === 'cancel') {
      const scrim = scrimsRepo.get(interaction.options.getInteger('id', true));
      if (!scrim || String(scrim.guild_id) !== String(interaction.guild.id)) {
        throw new ValidationError('Scrim not found in this server.');
      }
      if (sub === 'cancel') {
        scrimsRepo.update(scrim.id, { status: 'CANCELLED' });
      } else {
        scrimsRepo.update(scrim.id, {
          status: 'COMPLETED',
          result: JSON.stringify({
            our_score: interaction.options.getInteger('our_score', true),
            opp_score: interaction.options.getInteger('opp_score', true),
          }),
        });
      }
      const fresh = scrimsRepo.get(scrim.id);
      const channel = interaction.guild.channels.cache.get(fresh.channel_id);
      const message =
        channel &&
        (channel.messages.cache.get(fresh.message_id) ?? (await channel.messages.fetch(fresh.message_id).catch(() => null)));
      if (message) await message.edit({ embeds: [announcements.scrimEmbed(fresh)] }).catch(() => {});

      await logAudit(interaction.client, interaction.guild, {
        action: 'match',
        target: null,
        moderator: interaction.user,
        reason: sub === 'cancel' ? `Scrim vs ${fresh.opponent} cancelled` : `Scrim vs ${fresh.opponent} completed`,
      });
      return interaction.reply({ content: sub === 'cancel' ? 'Scrim cancelled.' : 'Scrim result recorded.', ephemeral: true });
    }
  },
};
