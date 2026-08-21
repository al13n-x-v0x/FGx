'use strict';

/* Copyright © 2026 FGx. All rights reserved. */

const { SlashCommandBuilder, EmbedBuilder, ChannelType } = require('discord.js');
const { BRAND } = require('../../config/constants');
const { formatDuration } = require('../../utils/format');

/**
 * /serverinfo — comprehensive server dashboard.
 *
 * Shows: owner, creation date, member counts (total/bots/online),
 * channel breakdown, role list, boost tier, emoji count, verification level.
 */

function tierName(level) {
  return ['None', 'Tier 1', 'Tier 2', 'Tier 3'][level] ?? 'None';
}

function verificationName(level) {
  return ['None', 'Low', 'Medium', 'High', 'Highest'][level] ?? 'None';
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName('serverinfo')
    .setDescription('Show comprehensive server stats and info.'),

  async execute(interaction) {
    const guild = interaction.guild;
    if (!guild) {
      return interaction.reply({ content: 'This command can only be used in a server.', ephemeral: true });
    }

    await interaction.deferReply();

    // Fetch all members to get accurate counts
    if (!guild.members.cache.has(guild.ownerId)) {
      await guild.members.fetch(guild.ownerId).catch(() => {});
    }

    const totalMembers = guild.memberCount;
    const botCount = guild.members.cache.filter((m) => m.user.bot).size;
    const humanCount = totalMembers - botCount;
    const onlineCount = guild.members.cache.filter(
      (m) => m.presence?.status && m.presence.status !== 'offline',
    ).size;

    // Channels breakdown
    const textChannels = guild.channels.cache.filter((c) => c.type === ChannelType.GuildText).size;
    const voiceChannels = guild.channels.cache.filter((c) => c.type === ChannelType.GuildVoice).size;
    const categories = guild.channels.cache.filter((c) => c.type === ChannelType.GuildCategory).size;
    const announcementChannels = guild.channels.cache.filter(
      (c) => c.type === ChannelType.GuildAnnouncement,
    ).size;
    const stageChannels = guild.channels.cache.filter(
      (c) => c.type === ChannelType.GuildStageVoice,
    ).size;
    const forumChannels = guild.channels.cache.filter(
      (c) => c.type === ChannelType.GuildForum,
    ).size;

    // Roles (excluding @everyone)
    const roles = guild.roles.cache
      .filter((r) => r.id !== guild.id)
      .sort((a, b) => b.position - a.position);
    const roleList = roles.size > 15
      ? roles.first(15).map((r) => `<@&${r.id}>`).join(', ') + ` +${roles.size - 15} more`
      : roles.map((r) => `<@&${r.id}>`).join(', ') || 'None';

    // Boosts
    const boostCount = guild.premiumSubscriptionCount ?? 0;
    const boostTier = guild.premiumTier ?? 0;

    // Emoji counts
    const staticEmojis = guild.emojis.cache.filter((e) => !e.animated).size;
    const animatedEmojis = guild.emojis.cache.filter((e) => e.animated).size;

    // Server age
    const createdTimestamp = guild.createdTimestamp;
    const ageMs = Date.now() - createdTimestamp;
    const ageDays = Math.floor(ageMs / 86400000);
    let ageStr;
    if (ageDays < 1) ageStr = 'Today';
    else if (ageDays < 30) ageStr = `${ageDays} day${ageDays === 1 ? '' : 's'}`;
    else if (ageDays < 365) ageStr = `${Math.floor(ageDays / 30)} month${Math.floor(ageDays / 30) === 1 ? '' : 's'}`;
    else ageStr = `${Math.floor(ageDays / 365)} year${Math.floor(ageDays / 365) === 1 ? '' : 's'}, ${Math.floor((ageDays % 365) / 30)} month${Math.floor((ageDays % 365) / 30) === 1 ? '' : 's'}`;

    const owner = await guild.fetchOwner().catch(() => null);

    // ── Build the main embed ──────────────────────────────────────
    const embed = new EmbedBuilder()
      .setColor(BRAND.colors.primary)
      .setTitle(`📊 ${guild.name}`)
      .setThumbnail(guild.iconURL({ size: 512 }) ?? undefined)
      .setDescription(
        guild.description || `Server owned by ${owner ? `<@${owner.id}>` : 'Unknown'}`,
      )
      .addFields(
        {
          name: '📋 General',
          value: [
            `**Owner:** ${owner ? `<@${owner.id}>` : 'Unknown'}`,
            `**Created:** <t:${Math.floor(createdTimestamp / 1000)}:R>`,
            `**Server Age:** ${ageStr}`,
            `**Verification:** ${verificationName(guild.verificationLevel)}`,
            `**Boost Tier:** ${tierName(boostTier)} (${boostCount} boosts)`,
          ].join('\n'),
          inline: true,
        },
        {
          name: '👥 Members',
          value: [
            `**Total:** ${totalMembers}`,
            `**Humans:** ${humanCount}`,
            `**Bots:** ${botCount}`,
            `**Online:** ${onlineCount}`,
          ].join('\n'),
          inline: true,
        },
        {
          name: '\u200b',
          value: '\u200b',
          inline: true,
        },
        {
          name: `📝 Channels (${textChannels + voiceChannels + announcementChannels + stageChannels + forumChannels})`,
          value: [
            `**Text:** ${textChannels}`,
            `**Voice:** ${voiceChannels}`,
            `**Announcements:** ${announcementChannels}`,
            `**Forums:** ${forumChannels}`,
            `**Stage:** ${stageChannels}`,
            `**Categories:** ${categories}`,
          ].join('\n'),
          inline: true,
        },
        {
          name: '🎭 Extras',
          value: [
            `**Roles:** ${roles.size}`,
            `**Emojis:** ${staticEmojis} static, ${animatedEmojis} animated`,
            `**Boost Level:** ${boostTier}/3`,
          ].join('\n'),
          inline: true,
        },
        {
          name: '\u200b',
          value: '\u200b',
          inline: true,
        },
      );

    // Add roles field (can be long)
    if (roles.size > 0) {
      embed.addFields({
        name: `🏷️ Roles (${roles.size})`,
        value: roleList,
      });
    }

    embed
      .setImage(guild.bannerURL({ size: 1024 }) ?? undefined)
      .setFooter({
        text: `${BRAND.footer} • Server ID: ${guild.id}`,
      })
      .setTimestamp(new Date());

    await interaction.editReply({ embeds: [embed] });
  },
};
