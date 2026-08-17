'use strict';

/*
 * Copyright © 2026 FGx.
 * All rights reserved.
 */

const { SlashCommandBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const { EVENT_TYPES } = require('../../config/constants');
const { guildConfigRepo } = require('../../database/repos/guildConfig');
const { eventsRepo } = require('../../database/repos/competitive');
const rosterService = require('../../services/clan/rosterService');
const participation = require('../../services/clan/participation');
const announcements = require('../../services/clan/announcements');
const { logAudit } = require('../../services/logging/auditLogger');
const { ValidationError } = require('../../utils/errors');

const TYPE_CHOICES = EVENT_TYPES.map((t) => ({ name: t, value: t }));

module.exports = {
  data: new SlashCommandBuilder()
    .setName('event')
    .setDescription('FGx event management.')
    .addSubcommand((s) =>
      s
        .setName('create')
        .setDescription('Create an event and announce it (staff)')
        .addStringOption((o) => o.setName('title').setDescription('Event title').setRequired(true).setMaxLength(100))
        .addStringOption((o) => o.setName('type').setDescription('Event type').setRequired(true).addChoices(...TYPE_CHOICES))
        .addStringOption((o) => o.setName('description').setDescription('Details').setMaxLength(1000))
        .addStringOption((o) => o.setName('date').setDescription('Start time, e.g. 2026-08-20 18:00 UTC'))
        .addIntegerOption((o) => o.setName('capacity').setDescription('Max participants').setMinValue(1).setMaxValue(500)),
    )
    .addSubcommand((s) => s.setName('list').setDescription('Upcoming events'))
    .addSubcommand((s) => s.setName('join').setDescription('Join an event').addIntegerOption((o) => o.setName('id').setDescription('Event ID').setRequired(true)))
    .addSubcommand((s) => s.setName('leave').setDescription('Leave an event').addIntegerOption((o) => o.setName('id').setDescription('Event ID').setRequired(true)))
    .addSubcommand((s) => s.setName('start').setDescription('Mark an event as live (staff)').addIntegerOption((o) => o.setName('id').setDescription('Event ID').setRequired(true)))
    .addSubcommand((s) => s.setName('end').setDescription('End an event (staff)').addIntegerOption((o) => o.setName('id').setDescription('Event ID').setRequired(true))),
  async execute(interaction) {
    const sub = interaction.options.getSubcommand();
    const config = guildConfigRepo.get(interaction.guild.id);

    if (sub === 'list') {
      const list = eventsRepo.list(interaction.guild.id, 'scheduled');
      const embed = {
        color: 0xdc143c,
        title: '📅 Upcoming Events',
        description: list.length === 0
          ? 'No upcoming events.'
          : list.map((e) => `**#${e.id}** ${e.title} — ${e.type} (${e.status})`).join('\n'),
      };
      return interaction.reply({ embeds: [embed] });
    }

    if (sub === 'join' || sub === 'leave') {
      const join = sub === 'join';
      const result = await participation.toggle(
        interaction.client,
        interaction,
        eventsRepo,
        'events',
        interaction.options.getInteger('id', true),
        { join },
      );
      if (!result.changed) {
        return interaction.reply({ content: join ? 'You are already in this event.' : 'You are not in this event.', ephemeral: true });
      }
      return interaction.reply({
        content: join ? `Joined. **${result.participants.length}** total.` : `Left. **${result.participants.length}** total.`,
        ephemeral: true,
      });
    }

    rosterService.requireStaff(interaction.member, config);

    if (sub === 'create') {
      const event = eventsRepo.create({
        guildId: interaction.guild.id,
        type: interaction.options.getString('type', true),
        title: interaction.options.getString('title', true),
        description: interaction.options.getString('description'),
        startsAt: interaction.options.getString('date'),
        capacity: interaction.options.getInteger('capacity'),
        createdBy: interaction.user.id,
      });
      const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId(`event:join:${event.id}`).setStyle(ButtonStyle.Success).setLabel('Join'),
        new ButtonBuilder().setCustomId(`event:leave:${event.id}`).setStyle(ButtonStyle.Secondary).setLabel('Leave'),
      );
      const message = await interaction.reply({ embeds: [announcements.eventEmbed(event)], components: [row], fetchReply: true });
      eventsRepo.update(event.id, { channel_id: interaction.channel.id, message_id: message.id });
      await logAudit(interaction.client, interaction.guild, {
        action: 'match',
        target: null,
        moderator: interaction.user,
        reason: `Event created: ${event.title}`,
        details: { id: event.id, type: event.type },
      });
      return;
    }

    const id = interaction.options.getInteger('id', true);
    const event = eventsRepo.get(id);
    if (!event || String(event.guild_id) !== String(interaction.guild.id)) {
      throw new ValidationError('Event not found in this server.');
    }

    if (sub === 'start') {
      eventsRepo.update(id, { status: 'live' });
    } else if (sub === 'end') {
      eventsRepo.update(id, { status: 'ended' });
    }
    const fresh = eventsRepo.get(id);
    const channel = interaction.guild.channels.cache.get(fresh.channel_id);
    const message =
      channel && (channel.messages.cache.get(fresh.message_id) ?? (await channel.messages.fetch(fresh.message_id).catch(() => null)));
    if (message) await message.edit({ embeds: [announcements.eventEmbed(fresh)] }).catch(() => {});
    await logAudit(interaction.client, interaction.guild, {
      action: 'match',
      target: null,
      moderator: interaction.user,
      reason: `Event #${id} → ${fresh.status}`,
    });
    return interaction.reply({ content: `Event **#${id}** is now **${fresh.status}**.`, ephemeral: true });
  },
};
