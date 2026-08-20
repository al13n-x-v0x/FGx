'use strict';

/*
 * Copyright © 2026 FGx.
 * All rights reserved.
 */

const fs = require('node:fs');
const path = require('node:path');
const {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ChannelType,
  EmbedBuilder,
  PermissionsBitField,
  StringSelectMenuBuilder,
} = require('discord.js');
const { BRAND, TICKET_TYPES } = require('../../config/constants');
const { guildConfigRepo } = require('../../database/repos/guildConfig');
const { ticketsRepo } = require('../../database/repos/community');
const { logAudit } = require('../logging/auditLogger');
const { logger } = require('../../utils/logger');
const { env } = require('../../config/env');

/**
 * Full ticket system: panels, private channels, claiming, transcripts, logs.
 * Prevents duplicate open tickets per type and owner.
 */

function transcriptDir() {
  // Keep transcripts alongside the database so a single persistent volume
  // (e.g. Render's /data disk) holds all state.
  const dbPath = path.resolve(env.DATABASE_PATH);
  const base = env.DATABASE_PATH === ':memory:' ? path.resolve('data') : path.dirname(dbPath);
  const dir = path.join(base, 'transcripts');
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}

/** Create the ticket panel (select menu of ticket types). */
async function createPanel(guild) {
  const config = guildConfigRepo.get(guild.id);
  const tickets = config.tickets;
  if (!tickets.enabled || !tickets.categoryId) {
    throw new Error('Tickets are not configured. Run `/setup` (admin) or set a category with `/config tickets` first.');
  }

  let channel = tickets.panelChannelId
    ? (guild.channels.cache.get(tickets.panelChannelId) ?? null)
    : null;
  // On cold start the channel may not be cached — fetch it.
  if (!channel && tickets.panelChannelId) {
    try {
      channel = await guild.channels.fetch(tickets.panelChannelId);
    } catch {
      channel = null;
    }
  }
  if (!channel?.isTextBased?.()) {
    const firstText = guild.channels.cache.find((c) => c.isTextBased?.() && c.type === ChannelType.GuildText);
    if (!firstText) throw new Error('No text channel available for the ticket panel.');
    channel = firstText;
  }
  const target = channel;

  const embed = new EmbedBuilder()
    .setColor(BRAND.colors.primary)
    .setTitle('FGx Ticket Center')
    .setDescription(
      'Select a category below to open a private ticket.\n\n' +
        '• 🎯 **Clan Application** — join FGx\n' +
        '• 🛠 **Support** — general help\n' +
        '• 🐛 **Bug Report** — report a bug\n' +
        '• 🤝 **Partnership** — partner with FGx\n' +
        '• 🚨 **Player Report** — report a player\n\n' +
        'Abuse of the ticket system may result in moderation action.',
    )
    .setFooter({ text: BRAND.footer });

  const select = new StringSelectMenuBuilder()
    .setCustomId('ticket:create')
    .setPlaceholder('Choose a ticket type…')
    .addOptions(
      Object.entries(TICKET_TYPES).map(([label, value]) => ({
        label,
        value,
        description: `Open a ${label} ticket`,
      })),
    );

  const row = new ActionRowBuilder().addComponents(select);
  const message = await target.send({ embeds: [embed], components: [row] });

  if (tickets.panelChannelId && tickets.panelMessageId) {
    const oldChannel = guild.channels.cache.get(tickets.panelChannelId);
    const oldMessage = oldChannel?.messages?.cache?.get(tickets.panelMessageId);
    if (oldMessage) await oldMessage.delete().catch(() => {});
  }
  guildConfigRepo.update(guild.id, {
    tickets: { panelChannelId: target.id, panelMessageId: message.id },
  });
  return message;
}

/** Handle the ticket-type select menu. */
async function handleCreate(interaction) {
  const config = guildConfigRepo.get(interaction.guild.id);
  const tickets = config.tickets;
  if (!tickets.enabled) {
    return interaction.reply({ content: 'Tickets are disabled in this server.', ephemeral: true });
  }
  const type = interaction.values?.[0];
  if (!type || !Object.values(TICKET_TYPES).includes(type)) {
    return interaction.reply({ content: 'Invalid ticket type.', ephemeral: true });
  }
  const category = interaction.guild.channels.cache.get(tickets.categoryId);
  if (!category || category.type !== ChannelType.GuildCategory) {
    return interaction.reply({ content: 'The ticket category is misconfigured. Contact staff.', ephemeral: true });
  }

  // Prevent duplicate open tickets for the same user + type.
  const existing = ticketsRepo.openFor(interaction.guild.id, interaction.user.id, type);
  if (existing && existing.channel_id) {
    return interaction.reply({
      content: `You already have an open ${type} ticket: <#${existing.channel_id}>.`,
      ephemeral: true,
    });
  }

  const id = ticketsRepo.newId();
  const label = Object.keys(TICKET_TYPES).find((k) => TICKET_TYPES[k] === type) ?? type;

  // Permission overwrites: owner, staff roles, bot. @everyone is denied by category.
  const overwrites = [
    {
      id: interaction.guild.roles.everyone.id,
      deny: [PermissionsBitField.Flags.ViewChannel],
    },
    {
      id: interaction.user.id,
      allow: [
        PermissionsBitField.Flags.ViewChannel,
        PermissionsBitField.Flags.SendMessages,
        PermissionsBitField.Flags.ReadMessageHistory,
        PermissionsBitField.Flags.AttachFiles,
      ],
    },
    {
      id: interaction.client.user.id,
      allow: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.SendMessages, PermissionsBitField.Flags.ManageChannels],
    },
  ];
  for (const staffRoleId of tickets.staffRoleIds ?? []) {
    const role = interaction.guild.roles.cache.get(staffRoleId);
    if (role) {
      overwrites.push({
        id: role.id,
        allow: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.SendMessages, PermissionsBitField.Flags.ReadMessageHistory],
      });
    }
  }

  // Channel creation + permission overwrites can exceed Discord's 3s
  // interaction window — acknowledge first so users never see
  // "The application did not respond".
  await interaction.deferReply({ ephemeral: true });

  const channel = await interaction.guild.channels.create({
    name: `${type}-${id.replace('FGX-', '').toLowerCase()}`,
    type: ChannelType.GuildText,
    parent: category.id,
    topic: `Ticket ${id} • ${label} • Owner: ${interaction.user.username}`,
    permissionOverwrites: overwrites,
  });

  ticketsRepo.create({
    id,
    guildId: interaction.guild.id,
    channelId: channel.id,
    ownerId: interaction.user.id,
    type,
  });

  const embed = new EmbedBuilder()
    .setColor(BRAND.colors.primary)
    .setTitle(`${label} — Ticket ${id}`)
    .setDescription(
      `${interaction.user}, staff will assist you shortly.\n\n` +
        '• Describe your request clearly\n' +
        '• Staff can **claim** this ticket\n' +
        '• Click **Close** when finished — a transcript is saved automatically',
    )
    .setFooter({ text: BRAND.footer });

  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId(`ticket:claim:${id}`).setStyle(ButtonStyle.Secondary).setLabel('Claim'),
    new ButtonBuilder().setCustomId(`ticket:close:${id}`).setStyle(ButtonStyle.Danger).setLabel('Close'),
  );

  await channel.send({ embeds: [embed], components: [row], content: `<@${interaction.user.id}>` });

  await logAudit(interaction.client, interaction.guild, {
    action: 'ticket',
    target: interaction.user,
    moderator: null,
    details: { ticket: id, type: label, channel: channel.name },
  });

  await interaction.editReply({ content: `Ticket **${id}** created: ${channel}` });
}

/** Handle the claim button. */
async function handleClaim(interaction) {
  const ticket = ticketsRepo.getByChannel(interaction.guild.id, interaction.channel.id);
  if (!ticket) {
    return interaction.reply({ content: 'This channel is not an FGx ticket.', ephemeral: true });
  }
  if (ticket.status !== 'open') {
    return interaction.reply({ content: 'This ticket is already closed.', ephemeral: true });
  }
  if (ticket.claimed_by) {
    return interaction.reply({
      content: `This ticket is already claimed by <@${ticket.claimed_by}>.`,
      ephemeral: true,
    });
  }
  ticketsRepo.claim(interaction.guild.id, ticket.id, interaction.user.id);
  // Channel renames are extra API round-trips — acknowledge before them so
  // the button never reports "not responded" on a slow guild.
  await interaction.deferReply();
  await interaction.channel.setName(`${interaction.channel.name}-claimed`).catch(() => {});
  await interaction.channel.setTopic(`Ticket ${ticket.id} • Claimed by ${interaction.user.username}`).catch(() => {});
  await interaction.editReply({ content: `Ticket claimed by ${interaction.user}.` });
}

/** Handle the close button: transcript, log, then offer deletion. */
async function handleClose(interaction) {
  const ticket = ticketsRepo.getByChannel(interaction.guild.id, interaction.channel.id);
  if (!ticket) {
    return interaction.reply({ content: 'This channel is not an FGx ticket.', ephemeral: true });
  }
  if (ticket.status !== 'open') {
    return interaction.reply({ content: 'This ticket is already closed.', ephemeral: true });
  }

  // Building the transcript fetches up to 200 messages — acknowledge before
  // that so closing a long ticket never shows "not responded".
  await interaction.deferReply();

  // Fetch history for the transcript.
  let lines = [`FGx Ticket Transcript — ${ticket.id}`, `Type: ${ticket.type}`, `Owner: ${ticket.owner_id}`, `Closed by: ${interaction.user.username}`, ''.repeat(0) + '─'.repeat(40)];
  try {
    const messages = await interaction.channel.messages.fetch({ limit: 200 });
    for (const msg of [...messages.values()].reverse()) {
      const content = msg.content || (msg.attachments.size ? `[attachment: ${msg.attachments.first().name}]` : '');
      lines.push(`[${new Date(msg.createdTimestamp).toISOString()}] ${msg.author.username}: ${content}`);
    }
  } catch (err) {
    logger.warn('transcript fetch failed', { error: err.message });
  }

  const filePath = path.join(transcriptDir(), `${interaction.guild.id}-${ticket.id}.txt`);
  fs.writeFileSync(filePath, lines.join('\n'), 'utf8');

  ticketsRepo.close(interaction.guild.id, ticket.id, filePath);

  await logAudit(interaction.client, interaction.guild, {
    action: 'ticket',
    target: null,
    moderator: interaction.user,
    details: { ticket: ticket.id, event: 'closed', transcript: filePath },
  });

  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId(`ticket:delete:${ticket.id}`).setStyle(ButtonStyle.Danger).setLabel('Delete channel'),
  );
  await interaction.editReply({
    content: `Ticket **${ticket.id}** closed. Transcript saved.\n\n**Transcript:**`,
    files: [{ attachment: filePath, name: `${ticket.id}.txt` }],
    components: [row],
  });
}

/** Handle the delete-channel button after closing. */
async function handleDelete(interaction) {
  const ticket = ticketsRepo.getByChannel(interaction.guild.id, interaction.channel.id);
  if (!ticket) return interaction.reply({ content: 'Not a ticket channel.', ephemeral: true });
  if (ticket.status !== 'closed') {
    return interaction.reply({ content: 'Close the ticket first.', ephemeral: true });
  }
  await interaction.reply({ content: 'Deleting channel…', ephemeral: true });
  await interaction.channel.delete('Ticket closed by staff').catch(() => {});
}

/** Send a stored transcript to the user. */
async function handleTranscript(interaction, ticketId) {
  const ticket = ticketsRepo.get(interaction.guild.id, ticketId);
  if (!ticket) {
    return interaction.reply({ content: `No ticket \`${ticketId}\` found.`, ephemeral: true });
  }
  if (ticket.transcript && fs.existsSync(ticket.transcript)) {
    return interaction.reply({
      content: `Transcript for **${ticket.id}**:`,
      files: [{ attachment: ticket.transcript, name: `${ticket.id}.txt` }],
      ephemeral: true,
    });
  }
  return interaction.reply({ content: `No transcript exists for **${ticket.id}**.`, ephemeral: true });
}

module.exports = {
  createPanel,
  handleCreate,
  handleClaim,
  handleClose,
  handleDelete,
  handleTranscript,
  transcriptDir,
};
