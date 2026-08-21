'use strict';

/* Copyright © 2026 FGx. All rights reserved. */

const { SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits } = require('discord.js');
const { BRAND } = require('../../config/constants');

const FLAGS = {
  Staff: PermissionFlagsBits.Staff,
  Administrator: PermissionFlagsBits.Administrator,
  'Manage Guild': PermissionFlagsBits.ManageGuild,
  'Ban Members': PermissionFlagsBits.BanMembers,
  'Kick Members': PermissionFlagsBits.KickMembers,
  'Manage Messages': PermissionFlagsBits.ManageMessages,
  'Manage Channels': PermissionFlagsBits.ManageChannels,
  'Manage Roles': PermissionFlagsBits.ManageRoles,
  'Mention Everyone': PermissionFlagsBits.MentionEveryone,
  'Use Voice': PermissionFlagsBits.Connect,
  'Send Messages': PermissionFlagsBits.SendMessages,
};

module.exports = {
  data: new SlashCommandBuilder()
    .setName('userinfo')
    .setDescription('Show detailed info about a user')
    .addUserOption(opt =>
      opt.setName('user').setDescription('User to inspect (default: you)')),

  async execute(interaction) {
    const user = interaction.options.getUser('user') ?? interaction.user;
    const member = interaction.guild.members.cache.get(user.id)
      ?? await interaction.guild.members.fetch(user.id).catch(() => null);

    const createdAge = Math.floor((Date.now() - user.createdTimestamp) / 86400000);
    let createdStr;
    if (createdAge < 1) createdStr = 'Today';
    else if (createdAge < 30) createdStr = `${createdAge} day${createdAge === 1 ? '' : 's'} ago`;
    else if (createdAge < 365) createdStr = `${Math.floor(createdAge / 30)} month${Math.floor(createdAge / 30) === 1 ? '' : 's'} ago`;
    else createdStr = `${Math.floor(createdAge / 365)} year${Math.floor(createdAge / 365) === 1 ? '' : 's'}, ${Math.floor((createdAge % 365) / 30)} month${Math.floor((createdAge % 365) / 30) === 1 ? '' : 's'} ago`;

    let joinedStr = 'Not in server';
    let joinedAge = '—';
    if (member) {
      const joinMs = Date.now() - member.joinedTimestamp;
      const joinDays = Math.floor(joinMs / 86400000);
      if (joinDays < 1) joinedStr = 'Today';
      else if (joinDays < 30) joinedStr = `${joinDays} day${joinDays === 1 ? '' : 's'} ago`;
      else if (joinDays < 365) joinedStr = `${Math.floor(joinDays / 30)} month${Math.floor(joinDays / 30) === 1 ? '' : 's'} ago`;
      else joinedStr = `${Math.floor(joinDays / 365)} year${Math.floor(joinDays / 365) === 1 ? '' : 's'}, ${Math.floor((joinDays % 365) / 30)} month${Math.floor((joinDays % 365) / 30) === 1 ? '' : 's'} ago`;
      joinedAge = `<t:${Math.floor(member.joinedTimestamp / 1000)}:R>`;
    }

    // Roles
    const roles = member
      ? member.roles.cache.filter(r => r.id !== interaction.guild.id).sort((a, b) => b.position - a.position)
      : null;
    const roleList = roles && roles.size > 0
      ? (roles.size > 15
        ? roles.first(15).map(r => `<@&${r.id}>`).join(', ') + ` +${roles.size - 15} more`
        : roles.map(r => `<@&${r.id}>`).join(', '))
      : 'None';

    // Key permissions
    const perms = member
      ? Object.entries(FLAGS)
        .filter(([, bit]) => member.permissions.has(bit))
        .map(([name]) => name)
      : [];

    const embed = new EmbedBuilder()
      .setColor(member?.displayColor ?? BRAND.colors.primary)
      .setTitle(`👤 ${user.tag}`)
      .setThumbnail(user.displayAvatarURL({ size: 512 }))
      .addFields(
        {
          name: '📋 Account',
          value: [
            `**Username:** ${user.username}`,
            `**ID:** ${user.id}`,
            `**Bot:** ${user.bot ? 'Yes 🤖' : 'No'}`,
            `**Created:** <t:${Math.floor(user.createdTimestamp / 1000)}:R> (${createdStr})`,
          ].join('\n'),
          inline: true,
        },
        {
          name: '🏠 Server',
          value: member
            ? [
              `**Joined:** <t:${Math.floor(member.joinedTimestamp / 1000)}:R> (${joinedStr})`,
              `**Nickname:** ${member.nickname ?? 'None'}`,
              `**Boosting:** ${member.premiumSince ? `<t:${Math.floor(member.premiumSince.getTime() / 1000)}:R>` : 'No'}`,
            ].join('\n')
            : 'Not a member',
          inline: true,
        },
      );

    if (roles && roles.size > 0) {
      embed.addFields({
        name: `🎭 Roles (${roles.size})`,
        value: roleList,
      });
    }

    if (perms.length > 0) {
      embed.addFields({
        name: '🔑 Key Permissions',
        value: perms.map(p => `\`${p}\``).join(', '),
      });
    }

    embed
      .setFooter({ text: `${BRAND.footer} • User ID: ${user.id}` })
      .setTimestamp(new Date());

    await interaction.reply({ embeds: [embed] });
  },
};
