'use strict';

/* Copyright © 2026 FGx. All rights reserved. */

const {
  SlashCommandBuilder, EmbedBuilder, ActionRowBuilder,
  ButtonBuilder, ButtonStyle, ModalBuilder, TextInputBuilder, TextInputStyle,
  PermissionFlagsBits, ChannelType,
} = require('discord.js');
const { BRAND } = require('../../config/constants');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('announce')
    .setDescription('Create a beautiful announcement embed')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages)
    .addChannelOption(opt =>
      opt.setName('channel').setDescription('Channel to send announcement')
        .addChannelTypes(ChannelType.GuildText).setRequired(true))
    .addStringOption(opt =>
      opt.setName('title').setDescription('Announcement title').setRequired(true))
    .addStringOption(opt =>
      opt.setName('description').setDescription('Announcement description').setRequired(true))
    .addStringOption(opt =>
      opt.setName('color').setDescription('Hex color (e.g. #FF0000 or red/green/blue)'))
    .addStringOption(opt =>
      opt.setName('image').setDescription('Image URL to include'))
    .addStringOption(opt =>
      opt.setName('thumbnail').setDescription('Thumbnail URL'))
    .addStringOption(opt =>
      opt.setName('footer').setDescription('Custom footer text'))
    .addUserOption(opt =>
      opt.setName('ping').setDescription('Who to ping in the announcement')),

  async execute(interaction) {
    const channel = interaction.options.getChannel('channel');
    const title = interaction.options.getString('title');
    const description = interaction.options.getString('description');
    const colorStr = interaction.options.getString('color');
    const image = interaction.options.getString('image');
    const thumbnail = interaction.options.getString('thumbnail');
    const footer = interaction.options.getString('footer');
    const ping = interaction.options.getUser('ping');

    // Parse color
    let color = BRAND.colors.primary;
    if (colorStr) {
      const colorMap = {
        red: 0xED4245, blue: 0x5865F2, green: 0x57F287, yellow: 0xFEE75C,
        purple: 0x9B59B6, orange: 0xE67E22, pink: 0xEB459E, white: 0xFFFFFF,
        black: 0x000000, gold: 0xF1C40F, cyan: 0x1ABC9C,
      };
      if (colorMap[colorStr.toLowerCase()]) {
        color = colorMap[colorStr.toLowerCase()];
      } else {
        const hex = colorStr.replace('#', '');
        const parsed = parseInt(hex, 16);
        if (!isNaN(parsed) && hex.length <= 6) color = parsed;
      }
    }

    const embed = new EmbedBuilder()
      .setColor(color)
      .setTitle(title)
      .setDescription(description);

    if (image) embed.setImage(image);
    if (thumbnail) embed.setThumbnail(thumbnail);
    embed.setFooter({
      text: footer || BRAND.footer,
      iconURL: interaction.guild.iconURL(),
    });
    embed.setTimestamp(new Date());

    // Preview buttons
    const previewRow = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId('announce:send')
        .setStyle(ButtonStyle.Success)
        .setLabel('Send Announcement')
        .setEmoji('📤'),
      new ButtonBuilder()
        .setCustomId('announce:edit')
        .setStyle(ButtonStyle.Secondary)
        .setLabel('Edit')
        .setEmoji('✏️'),
      new ButtonBuilder()
        .setCustomId('announce:cancel')
        .setStyle(ButtonStyle.Danger)
        .setLabel('Cancel')
        .setEmoji('❌'),
    );

    // Store draft for this interaction
    const draftKey = `${interaction.user.id}:${interaction.id}`;
    if (!module.exports._drafts) module.exports._drafts = new Map();
    module.exports._drafts.set(draftKey, {
      embed, channel, ping,
      title, description, colorStr, image, thumbnail, footer,
      guildId: interaction.guildId,
    });

    // Auto-cleanup
    setTimeout(() => module.exports._drafts.delete(draftKey), 5 * 60 * 1000);

    await interaction.reply({
      content: `**Preview** — This will be sent to ${channel}:`,
      embeds: [embed],
      components: [previewRow],
      ephemeral: true,
    });
  },

  _drafts: null,

  /**
   * Handle the announce preview buttons.
   */
  async handleButton(interaction) {
    const action = interaction.customId.split(':')[1];
    const draftKey = `${interaction.user.id}`;
    const drafts = module.exports._drafts;

    if (!drafts) {
      return interaction.reply({ content: '❌ Draft expired. Run `/announce` again.', ephemeral: true });
    }

    // Find the draft for this user
    let draft = null;
    let key = null;
    for (const [k, d] of drafts) {
      if (k.startsWith(interaction.user.id)) {
        draft = d;
        key = k;
        break;
      }
    }

    if (!draft) {
      return interaction.reply({ content: '❌ Draft expired. Run `/announce` again.', ephemeral: true });
    }

    if (action === 'cancel') {
      drafts.delete(key);
      return interaction.update({ content: '❌ Announcement cancelled.', embeds: [], components: [] });
    }

    if (action === 'send') {
      drafts.delete(key);

      const pingText = draft.ping ? `<@${draft.ping.id}>` : '';
      await draft.channel.send({
        content: pingText || undefined,
        embeds: [draft.embed],
      });

      return interaction.update({
        content: `✅ Announcement sent to ${draft.channel}!`,
        embeds: [draft.embed],
        components: [],
      });
    }

    if (action === 'edit') {
      // Show modal to edit the announcement
      const modal = new ModalBuilder()
        .setCustomId(`announce:modal:${key}`)
        .setTitle('Edit Announcement')
        .addComponents(
          new ActionRowBuilder().addComponents(
            new TextInputBuilder()
              .setCustomId('announce_title')
              .setLabel('Title')
              .setValue(draft.title)
              .setStyle(TextInputStyle.Short)
              .setRequired(true),
          ),
          new ActionRowBuilder().addComponents(
            new TextInputBuilder()
              .setCustomId('announce_description')
              .setLabel('Description')
              .setValue(draft.description)
              .setStyle(TextInputStyle.Paragraph)
              .setRequired(true),
          ),
          new ActionRowBuilder().addComponents(
            new TextInputBuilder()
              .setCustomId('announce_footer')
              .setLabel('Footer (leave blank for default)')
              .setValue(draft.footer ?? '')
              .setStyle(TextInputStyle.Short)
              .setRequired(false),
          ),
        );

      return interaction.showModal(modal);
    }
  },

  /**
   * Handle the announce modal submit.
   */
  async handleModal(interaction) {
    const key = interaction.customId.split(':').pop();
    const drafts = module.exports._drafts;
    const draft = drafts?.get(key);

    if (!draft) {
      return interaction.reply({ content: '❌ Draft expired.', ephemeral: true });
    }

    const title = interaction.fields.getTextInputValue('announce_title');
    const description = interaction.fields.getTextInputValue('announce_description');
    const footer = interaction.fields.getTextInputValue('announce_footer') || BRAND.footer;

    // Rebuild the embed
    const embed = EmbedBuilder.from(draft.embed)
      .setTitle(title)
      .setDescription(description)
      .setFooter({ text: footer, iconURL: interaction.guild.iconURL() });

    draft.embed = embed;
    draft.title = title;
    draft.description = description;

    const previewRow = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId('announce:send')
        .setStyle(ButtonStyle.Success)
        .setLabel('Send Announcement')
        .setEmoji('📤'),
      new ButtonBuilder()
        .setCustomId('announce:edit')
        .setStyle(ButtonStyle.Secondary)
        .setLabel('Edit')
        .setEmoji('✏️'),
      new ButtonBuilder()
        .setCustomId('announce:cancel')
        .setStyle(ButtonStyle.Danger)
        .setLabel('Cancel')
        .setEmoji('❌'),
    );

    await interaction.reply({
      content: `**Updated Preview** — This will be sent to ${draft.channel}:`,
      embeds: [embed],
      components: [previewRow],
      ephemeral: true,
    });
  },
};
