'use strict';

/* Copyright © 2026 FGx. All rights reserved. */

const {
  SlashCommandBuilder, EmbedBuilder, ActionRowBuilder,
  ButtonBuilder, ButtonStyle, ModalBuilder, TextInputBuilder,
  TextInputStyle, PermissionFlagsBits, ChannelType,
} = require('discord.js');
const { BRAND } = require('../../config/constants');

/** Store embed data temporarily per user. */
const pendingEmbeds = new Map();

module.exports = {
  data: new SlashCommandBuilder()
    .setName('embed')
    .setDescription('Create a beautiful custom embed with a builder 📝')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages)
    .addChannelOption(opt =>
      opt.setName('channel').setDescription('Channel to send to (default: current)')
        .addChannelTypes(ChannelType.GuildText))
    .addStringOption(opt =>
      opt.setName('title').setDescription('Embed title'))
    .addStringOption(opt =>
      opt.setName('description').setDescription('Embed description'))
    .addStringOption(opt =>
      opt.setName('color').setDescription('Hex color (e.g. #FF0000 or red)'))
    .addStringOption(opt =>
      opt.setName('image').setDescription('Image URL'))
    .addStringOption(opt =>
      opt.setName('thumbnail').setDescription('Thumbnail URL'))
    .addStringOption(opt =>
      opt.setName('footer').setDescription('Footer text'))
    .addStringOption(opt =>
      opt.setName('author').setDescription('Author name'))
    .addUserOption(opt =>
      opt.setName('ping').setDescription('User or role to ping')),

  async execute(interaction) {
    const title = interaction.options.getString('title');
    const description = interaction.options.getString('description');
    const colorStr = interaction.options.getString('color');
    const image = interaction.options.getString('image');
    const thumbnail = interaction.options.getString('thumbnail');
    const footer = interaction.options.getString('footer');
    const author = interaction.options.getString('author');
    const ping = interaction.options.getUser('ping');
    const channel = interaction.options.getChannel('channel') ?? interaction.channel;

    // Parse color
    let color = BRAND.colors.primary;
    if (colorStr) {
      const parsed = parseColor(colorStr);
      if (parsed !== null) color = parsed;
    }

    // Build the embed
    const embed = new EmbedBuilder().setColor(color);
    if (title) embed.setTitle(title);
    if (description) embed.setDescription(description);
    if (image) embed.setImage(image);
    if (thumbnail) embed.setThumbnail(thumbnail);
    if (footer) embed.setFooter({ text: footer });
    if (author) embed.setAuthor({ name: author });
    if (!title && !description) embed.setDescription('*Empty embed — use the buttons to edit!*');
    embed.setTimestamp(new Date());

    // Preview buttons
    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId('embed:edit')
        .setLabel('📝 Edit')
        .setStyle(ButtonStyle.Primary),
      new ButtonBuilder()
        .setCustomId('embed:send')
        .setLabel('📤 Send')
        .setStyle(ButtonStyle.Success),
      new ButtonBuilder()
        .setCustomId('embed:cancel')
        .setLabel('❌ Cancel')
        .setStyle(ButtonStyle.Danger),
    );

    // Store for this interaction
    pendingEmbeds.set(interaction.user.id, {
      embed,
      channelId: channel.id,
      ping: ping?.id ?? null,
      guildId: interaction.guildId,
    });

    await interaction.reply({
      content: `📝 **Embed Preview** — will be sent to ${channel}`,
      embeds: [embed],
      components: [row],
      ephemeral: true,
    });
  },

  /** Handle edit button — show modal. */
  async handleButton(interaction) {
    const data = pendingEmbeds.get(interaction.user.id);
    if (!data) {
      return interaction.reply({ content: '❌ This embed session expired. Run `/embed` again.', ephemeral: true });
    }

    if (interaction.customId === 'embed:cancel') {
      pendingEmbeds.delete(interaction.user.id);
      return interaction.update({ content: '❌ Embed cancelled.', embeds: [], components: [] });
    }

    if (interaction.customId === 'embed:send') {
      const channel = interaction.guild.channels.cache.get(data.channelId);
      if (!channel) {
        return interaction.update({ content: '❌ Channel not found.', embeds: [], components: [] });
      }

      const pingContent = data.ping ? `<@${data.ping}>` : '';
      await channel.send({ content: pingContent, embeds: [data.embed] });
      pendingEmbeds.delete(interaction.user.id);
      return interaction.update({
        content: `✅ Embed sent to ${channel}!`,
        embeds: [],
        components: [],
      });
    }

    if (interaction.customId === 'embed:edit') {
      const modal = new ModalBuilder()
        .setCustomId('embed:modal')
        .setTitle('Edit Embed');

      const titleInput = new TextInputBuilder()
        .setCustomId('embed:title')
        .setLabel('Title')
        .setStyle(TextInputStyle.Short)
        .setPlaceholder('Enter embed title...')
        .setValue(data.embed.data?.title ?? '')
        .setRequired(false);

      const descInput = new TextInputBuilder()
        .setCustomId('embed:description')
        .setLabel('Description')
        .setStyle(TextInputStyle.Paragraph)
        .setPlaceholder('Enter embed description...')
        .setValue(data.embed.data?.description ?? '')
        .setRequired(false);

      const colorInput = new TextInputBuilder()
        .setCustomId('embed:color')
        .setLabel('Color (hex or name)')
        .setStyle(TextInputStyle.Short)
        .setPlaceholder('#FF0000 or red')
        .setRequired(false);

      const footerInput = new TextInputBuilder()
        .setCustomId('embed:footer')
        .setLabel('Footer Text')
        .setStyle(TextInputStyle.Short)
        .setPlaceholder('Footer text...')
        .setRequired(false);

      const imageInput = new TextInputBuilder()
        .setCustomId('embed:image')
        .setLabel('Image URL')
        .setStyle(TextInputStyle.Short)
        .setPlaceholder('https://...')
        .setRequired(false);

      modal.addComponents(
        new ActionRowBuilder().addComponents(titleInput),
        new ActionRowBuilder().addComponents(descInput),
        new ActionRowBuilder().addComponents(colorInput),
        new ActionRowBuilder().addComponents(footerInput),
        new ActionRowBuilder().addComponents(imageInput),
      );

      return interaction.showModal(modal);
    }
  },

  /** Handle modal submission. */
  async handleModal(interaction) {
    const data = pendingEmbeds.get(interaction.user.id);
    if (!data) {
      return interaction.reply({ content: '❌ Session expired.', ephemeral: true });
    }

    const title = interaction.fields.getTextInputValue('embed:title') || null;
    const description = interaction.fields.getTextInputValue('embed:description') || null;
    const colorStr = interaction.fields.getTextInputValue('embed:color') || null;
    const footer = interaction.fields.getTextInputValue('embed:footer') || null;
    const image = interaction.fields.getTextInputValue('embed:image') || null;

    let color = BRAND.colors.primary;
    if (colorStr) {
      const parsed = parseColor(colorStr);
      if (parsed !== null) color = parsed;
    }

    const embed = new EmbedBuilder().setColor(color);
    if (title) embed.setTitle(title);
    if (description) embed.setDescription(description);
    if (image) embed.setImage(image);
    if (footer) embed.setFooter({ text: footer });
    embed.setTimestamp(new Date());

    data.embed = embed;

    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId('embed:edit')
        .setLabel('📝 Edit')
        .setStyle(ButtonStyle.Primary),
      new ButtonBuilder()
        .setCustomId('embed:send')
        .setLabel('📤 Send')
        .setStyle(ButtonStyle.Success),
      new ButtonBuilder()
        .setCustomId('embed:cancel')
        .setLabel('❌ Cancel')
        .setStyle(ButtonStyle.Danger),
    );

    const channel = interaction.guild.channels.cache.get(data.channelId);
    await interaction.update({
      content: `📝 **Embed Preview** — will be sent to ${channel ?? 'unknown'}`,
      embeds: [embed],
      components: [row],
    });
  },
};

/** Parse a color string (hex or name). */
function parseColor(str) {
  if (!str) return null;
  str = str.trim().toLowerCase();
  const named = {
    red: 0xED4245, blue: 0x5865F2, green: 0x57F287, yellow: 0xFEE75C,
    orange: 0xE67E22, purple: 0x9B59B6, pink: 0xEB459E, cyan: 0x00BCD4,
    gold: 0xFFD700, white: 0xFFFFFF, black: 0x000000, grey: 0x99AAB5,
    gray: 0x99AAB5, navy: 0x1E3A5F, teal: 0x1ABC9C,
  };
  if (named[str] !== undefined) return named[str];
  const hex = str.replace('#', '');
  const num = parseInt(hex, 16);
  return isNaN(num) ? null : num;
}
