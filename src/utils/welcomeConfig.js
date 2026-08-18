'use strict';

const { SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits } = require('discord.js');
const { logger } = require('../../utils/logger');
const welcomeConfig = require('../../utils/welcomeConfig');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('welcome-setup')
    .setDescription('Configure the welcome message')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .addChannelOption(o => o.setName('channel').setDescription('Welcome channel').setRequired(true))
    .addStringOption(o => o.setName('title').setDescription('Embed title').setRequired(false))
    .addStringOption(o => o.setName('message').setDescription('Message ({user}, {server}, {count}, {avatar})').setRequired(false))
    .addStringOption(o => o.setName('color').setDescription('Hex color (00ff00)').setRequired(false))
    .addStringOption(o => o.setName('video').setDescription('Video URL').setRequired(false))
    .addStringOption(o => o.setName('image').setDescription('Image URL').setRequired(false))
    .addStringOption(o => o.setName('footer').setDescription('Footer text').setRequired(false))
    .addStringOption(o => o.setName('author').setDescription('Author name').setRequired(false))
    .addBooleanOption(o => o.setName('timestamp').setDescription('Show timestamp?').setRequired(false))
    .addBooleanOption(o => o.setName('enabled').setDescription('Enable welcome?').setRequired(false)),

  async execute(interaction) {
    const channel = interaction.options.getChannel('channel');
    if (!channel.isTextBased()) {
      return interaction.reply({ content: '❌ Select a text channel.', ephemeral: true });
    }

    const current = welcomeConfig.get(channel.id) || {};
    const video = interaction.options.getString('video') || current.video || '';
    const image = interaction.options.getString('image') || current.image || '';
    const title = interaction.options.getString('title') || current.title || '🎮 Welcome to FGx!';
    const message = interaction.options.getString('message') || current.message || 'Hey {user}, welcome to **{server}**!\n\nYou are member **#{count}**.';
    const color = interaction.options.getString('color') || current.color || '00ff00';
    const footer = interaction.options.getString('footer') || current.footer || 'Powered by FGx';
    const author = interaction.options.getString('author') || current.author || '';
    const timestamp = interaction.options.getBoolean('timestamp') ?? current.timestamp ?? true;
    const enabled = interaction.options.getBoolean('enabled') ?? current.enabled ?? true;

    const placeholders = {
      user: `${interaction.user}`,
      server: interaction.guild.name,
      count: interaction.guild.memberCount,
      avatar: interaction.user.displayAvatarURL({ dynamic: true }),
    };

    welcomeConfig.set(channel.id, {
      channelId: channel.id,
      enabled, title, message, color, video, image, footer, author, timestamp,
      setBy: interaction.user.id,
      setAt: new Date().toISOString(),
    });

    // Build preview
    const embed = new EmbedBuilder()
      .setColor(parseInt(color, 16))
      .setTitle(title)
      .setDescription(message.replace(/{(user|server|count|avatar)}/g, (_, k) => placeholders[k]));

    if (footer) embed.setFooter({ text: footer });
    if (author) embed.setAuthor({ name: author });
    if (timestamp) embed.setTimestamp();
    if (image) embed.setImage(image);
    if (video) embed.setImage(video); // Shows as link preview
    embed.setThumbnail(placeholders.avatar);

    await interaction.reply({ embeds: [embed], ephemeral: true });

    // Send test to channel
    const testMsg = { embeds: [embed] };
    await channel.send(testMsg);

    logger.info(`Welcome configured for #${channel.name}`);
  },
};
