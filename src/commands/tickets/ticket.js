'use strict';

/*
 * Copyright © 2026 FGx.
 * All rights reserved.
 */

const { SlashCommandBuilder, EmbedBuilder, PermissionsBitField } = require('discord.js');
const { BRAND } = require('../../config/constants');
const { ticketsRepo } = require('../../database/repos/community');
const ticketService = require('../../services/tickets/ticketService');
const { requireAdmin, requirePerms } = require('../../utils/permissions');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('ticket')
    .setDescription('FGx ticket system.')
    .addSubcommand((s) => s.setName('setup').setDescription('Create the ticket panel (admin)'))
    .addSubcommand((s) => s.setName('list').setDescription('List tickets'))
    .addSubcommand((s) =>
      s
        .setName('close')
        .setDescription('Close a ticket by ID (staff)')
        .addStringOption((o) => o.setName('id').setDescription('Ticket ID, e.g. FGX-7K2Q').setRequired(true)),
    )
    .addSubcommand((s) =>
      s
        .setName('transcript')
        .setDescription('Get a ticket transcript')
        .addStringOption((o) => o.setName('id').setDescription('Ticket ID').setRequired(true)),
    ),
  async execute(interaction) {
    const sub = interaction.options.getSubcommand();

    if (sub === 'setup') {
      requireAdmin(interaction.member);
      const message = await ticketService.createPanel(interaction.guild);
      return interaction.reply({
        embeds: [{ color: BRAND.colors.success, title: 'Ticket panel created', description: `Panel sent to ${message.channel}.` }],
        ephemeral: true,
      });
    }

    if (sub === 'list') {
      const open = ticketsRepo.list(interaction.guild.id, 'open');
      const embed = new EmbedBuilder()
        .setColor(BRAND.colors.primary)
        .setTitle(`Open tickets — ${open.length}`)
        .setDescription(
          open.length === 0
            ? 'No open tickets.'
            : open.map((t) => `**${t.id}** ${t.type} — <@${t.owner_id}>${t.claimed_by ? ` • claimed by <@${t.claimed_by}>` : ''}`).join('\n'),
        )
        .setFooter({ text: BRAND.footer });
      return interaction.reply({ embeds: [embed] });
    }

    if (sub === 'close') {
      requirePerms(interaction.member, [PermissionsBitField.Flags.ManageChannels]);
      const id = interaction.options.getString('id', true).toUpperCase();
      const ticket = ticketsRepo.get(interaction.guild.id, id);
      if (!ticket) {
        return interaction.reply({ content: `No ticket \`${id}\` in this server.`, ephemeral: true });
      }
      const channel = interaction.guild.channels.cache.get(ticket.channel_id);
      if (channel) {
        return interaction.reply({
          content: `Use the **Close** button inside <#${channel.id}> to close ${id} (this preserves the transcript).`,
          ephemeral: true,
        });
      }
      ticketsRepo.close(interaction.guild.id, id, null);
      return interaction.reply({ content: `Ticket ${id} closed (channel already gone).`, ephemeral: true });
    }

    if (sub === 'transcript') {
      const id = interaction.options.getString('id', true).toUpperCase();
      await ticketService.handleTranscript(interaction, id);
    }
  },
};
