'use strict';

/* Copyright © 2026 FGx. All rights reserved. */

const {
  SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle,
} = require('discord.js');
const { BRAND } = require('../../config/constants');
const { formatEmoji, randomEmoji, emojiStats } = require('../../utils/emoji');
const { getGif } = require('../../utils/gifLibrary');

/**
 * /nitro — Discord Nitro-like features for the server.
 * Gives users access to premium-style perks:
 * - Custom emoji anywhere (bot relays server emojis in any channel)
 * - Animated profile card
 * - Premium reactions
 * - Special embed styling
 */

// ─── /nitro boost ─────────────────────────────────────────
// Shows a fake "boost" card with animated styling
const boostCmd = {
  data: new SlashCommandBuilder()
    .setName('nitro')
    .setDescription('Discord Nitro-like features — boost, emoji, profile, and more!')
    .addSubcommand(sub =>
      sub.setName('boost')
        .setDescription('Send a fake Nitro boost message 🚀'))
    .addSubcommand(sub =>
      sub.setName('emoji')
        .setDescription('Use a server custom emoji anywhere (bot relays it)')
        .addStringOption(opt =>
          opt.setName('emoji_name').setDescription('Server emoji name to use').setRequired(true)))
    .addSubcommand(sub =>
      sub.setName('profile')
        .setDescription('Show your Nitro-style animated profile card'))
    .addSubcommand(sub =>
      sub.setName('status')
        .setDescription('Set a custom animated status with server emojis')
        .addStringOption(opt =>
          opt.setName('text').setDescription('Status text').setRequired(true))),

  async execute(interaction) {
    const sub = interaction.options.getSubcommand();

    if (sub === 'boost') {
      const embed = new EmbedBuilder()
        .setColor(0xF47FFF)
        .setTitle('🚀 Server Boosted!')
        .setDescription(
          `**${interaction.user.username}** just boosted **${interaction.guild.name}**!\n\n` +
          `🎉 Everyone gets access to:\n` +
          `• 🔥 Custom emojis in all channels\n` +
          `• 🎬 Animated server banner\n` +
          `• 📊 Enhanced embed quality\n` +
          `• ⚡ Priority bot responses\n` +
          `• 🎨 Custom profile cards\n\n` +
          `*Thank you for making this server even better!* 💜`
        )
        .setThumbnail(interaction.user.displayAvatarURL({ size: 256 }))
        .setFooter({ text: `${BRAND.footer} • Nitro Boost` })
        .setTimestamp(new Date());

      // Add a Nitro-themed image if available
      const gif = await getGif('w');
      if (gif) embed.setImage(gif);

      await interaction.reply({ content: `@everyone`, embeds: [embed] });

    } else if (sub === 'emoji') {
      const emojiName = interaction.options.getString('emoji_name');
      const guild = interaction.guild;

      // Search for the emoji in the server
      const emojis = guild.emojis.cache.filter(e =>
        e.name.toLowerCase().includes(emojiName.toLowerCase())
      );

      if (emojis.size === 0) {
        return interaction.reply({
          content: `❌ No emoji found matching "${emojiName}" in this server.`,
          ephemeral: true,
        });
      }

      const emoji = emojis.first();
      const formatted = formatEmoji(emoji);

      // The bot "relays" the emoji — sends it as a message so everyone sees it
      // even in channels where they might not have access to the emoji
      const embed = new EmbedBuilder()
        .setColor(BRAND.colors.primary)
        .setTitle(`${formatted} ${emoji.name}`)
        .setDescription(
          `**Custom Emoji Relay**\n\n` +
          `Server: **${guild.name}**\n` +
          `Emoji: ${formatted}\n` +
          `Animated: ${emoji.animated ? 'Yes 🎬' : 'No'}\n` +
          `ID: \`${emoji.id}\`\n\n` +
          `Copy: \`${formatted}\``
        )
        .setThumbnail(emoji.url)
        .setFooter({ text: `${BRAND.footer} • Nitro Emoji` });

      await interaction.reply({ embeds: [embed] });

    } else if (sub === 'profile') {
      const user = interaction.user;
      const member = interaction.guild.members.cache.get(user.id);

      // Get the user's roles (exclude @everyone)
      const roles = member
        ? member.roles.cache
            .filter(r => r.id !== interaction.guild.id)
            .sort((a, b) => b.position - a.position)
            .first(10)
        : [];

      const roleStr = roles.length > 0
        ? roles.map(r => `<@&${r.id}>`).join(' ')
        : 'No roles';

      // Check Nitro-like status
      const hasAnimated = user.avatar && user.avatar.startsWith('a_');
      const hasBanner = member?.premiumSince;
      const boosts = member?.premiumSince ? '1+' : '0';

      const embed = new EmbedBuilder()
        .setColor(0xF47FFF)
        .setTitle(`⭐ ${user.username}'s Profile`)
        .setDescription(
          `**Nitro Status:** ${hasAnimated ? '🔥 Animated Avatar' : '⭐ Standard'}\n` +
          `**Server Boosts:** ${boosts}\n` +
          `**Account Created:** <t:${Math.floor(user.createdTimestamp / 1000)}:R>\n` +
          `**Joined Server:** ${member ? `<t:${Math.floor(member.joinedTimestamp / 1000)}:R>` : 'Unknown'}\n\n` +
          `**Roles:** ${roleStr}\n\n` +
          `${hasBanner ? '🚀 **This user is boosting the server!**' : ''}`
        )
        .setThumbnail(user.displayAvatarURL({ size: 256, dynamic: true }))
        .setFooter({ text: `${BRAND.footer} • Nitro Profile` })
        .setTimestamp(new Date());

      // Add banner if boosting
      if (hasBanner && interaction.guild.bannerURL()) {
        embed.setImage(interaction.guild.bannerURL({ size: 512 }));
      }

      // Add animated avatar preview if they have one
      if (hasAnimated) {
        embed.addFields({
          name: '🎬 Animated Avatar',
          value: `[Click to view](${user.displayAvatarURL({ size: 512, dynamic: true })})`,
          inline: true,
        });
      }

      await interaction.reply({ embeds: [embed] });

    } else if (sub === 'status') {
      const text = interaction.options.getString('text');
      const guild = interaction.guild;

      // Check for server emojis in the text
      const emojiMatches = text.match(/<a?:([^:]+):(\d+)>/g) || [];
      const serverEmojis = [];
      for (const match of emojiMatches) {
        const id = match.match(/(\d+)>/)?.[1];
        if (id) {
          const emoji = guild.emojis.cache.get(id);
          if (emoji) serverEmojis.push(formatEmoji(emoji));
        }
      }

      const embed = new EmbedBuilder()
        .setColor(0xF47FFF)
        .setTitle('✨ Custom Status')
        .setDescription(
          `**${interaction.user.username}** set their status:\n\n` +
          `> ${text}\n\n` +
          (serverEmojis.length > 0
            ? `Uses **${serverEmojis.length}** server emoji(s) ${serverEmojis.join(' ')}`
            : '*Tip: Use server emojis in your status with `/nitro emoji`!*')
        )
        .setThumbnail(interaction.user.displayAvatarURL({ size: 256 }))
        .setFooter({ text: `${BRAND.footer} • Nitro Status` })
        .setTimestamp(new Date());

      await interaction.reply({ embeds: [embed] });
    }
  },
};

module.exports = [boostCmd];
