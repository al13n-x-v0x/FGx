'use strict';

/*
 * Copyright © 2026 FGx.
 * All rights reserved.
 */

const { SlashCommandBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const { TRAINING_CATEGORIES } = require('../../config/constants');
const { guildConfigRepo } = require('../../database/repos/guildConfig');
const { trainingRepo } = require('../../database/repos/competitive');
const rosterService = require('../../services/clan/rosterService');
const participation = require('../../services/clan/participation');
const announcements = require('../../services/clan/announcements');
const { logAudit } = require('../../services/logging/auditLogger');
const { ValidationError } = require('../../utils/errors');

const CATEGORY_CHOICES = TRAINING_CATEGORIES.map((c) => ({ name: c, value: c }));

module.exports = {
  data: new SlashCommandBuilder()
    .setName('training')
    .setDescription('FGx training sessions.')
    .addSubcommand((s) =>
      s
        .setName('schedule')
        .setDescription('Schedule a training session (staff)')
        .addStringOption((o) => o.setName('title').setDescription('Session title').setRequired(true).setMaxLength(100))
        .addStringOption((o) => o.setName('category').setDescription('Category').setRequired(true).addChoices(...CATEGORY_CHOICES))
        .addStringOption((o) => o.setName('date').setDescription('Time, e.g. 2026-08-20 18:00 UTC'))
        .addUserOption((o) => o.setName('trainer').setDescription('Trainer (default: you)')),
    )
    .addSubcommand((s) => s.setName('list').setDescription('Upcoming training sessions'))
    .addSubcommand((s) => s.setName('join').setDescription('Join a session').addIntegerOption((o) => o.setName('id').setDescription('Session ID').setRequired(true)))
    .addSubcommand((s) => s.setName('cancel').setDescription('Cancel a session (staff)').addIntegerOption((o) => o.setName('id').setDescription('Session ID').setRequired(true))),
  async execute(interaction) {
    const sub = interaction.options.getSubcommand();
    const config = guildConfigRepo.get(interaction.guild.id);

    if (sub === 'list') {
      const list = trainingRepo.list(interaction.guild.id, 'scheduled');
      const embed = {
        color: 0xdc143c,
        title: '🎯 Upcoming Training',
        description: list.length === 0
          ? 'No training scheduled.'
          : list.map((s) => `**#${s.id}** ${s.title} — ${s.category} (${s.status})`).join('\n'),
      };
      return interaction.reply({ embeds: [embed] });
    }

    if (sub === 'join') {
      const result = await participation.toggle(
        interaction.client,
        interaction,
        trainingRepo,
        'training',
        interaction.options.getInteger('id', true),
        { join: true },
      );
      if (!result.changed) {
        return interaction.reply({ content: 'You are already signed up.', ephemeral: true });
      }
      return interaction.reply({ content: `Joined. **${result.participants.length}** total.`, ephemeral: true });
    }

    rosterService.requireStaff(interaction.member, config);

    if (sub === 'schedule') {
      const session = trainingRepo.create({
        guildId: interaction.guild.id,
        category: interaction.options.getString('category', true),
        title: interaction.options.getString('title', true),
        scheduledAt: interaction.options.getString('date'),
        trainerId: interaction.options.getUser('trainer')?.id ?? interaction.user.id,
      });
      const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId(`training:join:${session.id}`).setStyle(ButtonStyle.Success).setLabel('Join'),
      );
      const message = await interaction.reply({ embeds: [announcements.trainingEmbed(session)], components: [row], fetchReply: true });
      trainingRepo.update(session.id, { message_id: message.id, channel_id: interaction.channel.id });
      await logAudit(interaction.client, interaction.guild, {
        action: 'match',
        target: null,
        moderator: interaction.user,
        reason: `Training scheduled: ${session.title}`,
        details: { id: session.id, category: session.category },
      });
      return;
    }

    if (sub === 'cancel') {
      const session = trainingRepo.get(interaction.options.getInteger('id', true));
      if (!session || String(session.guild_id) !== String(interaction.guild.id)) {
        throw new ValidationError('Session not found in this server.');
      }
      trainingRepo.update(session.id, { status: 'cancelled' });
      await logAudit(interaction.client, interaction.guild, {
        action: 'match',
        target: null,
        moderator: interaction.user,
        reason: `Training cancelled: ${session.title}`,
      });
      return interaction.reply({ content: 'Training session cancelled.', ephemeral: true });
    }
  },
};
