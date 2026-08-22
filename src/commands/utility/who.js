'use strict';

/* Copyright © 2026 FGx. All rights reserved. */

const { SlashCommandBuilder, EmbedBuilder, PermissionsBitField } = require('discord.js');
const { BRAND, RANK_ORDER } = require('../../config/constants');
const { getGif } = require('../../utils/gifLibrary');

/** Permission flags mapped to friendly names. */
const KEY_PERMISSIONS = [
  { flag: PermissionsBitField.Flags.Administrator, label: '👑 Administrator', color: 'danger' },
  { flag: PermissionsBitField.Flags.ManageGuild, label: '⚙️ Manage Server', color: 'warn' },
  { flag: PermissionsBitField.Flags.ManageRoles, label: '🎭 Manage Roles', color: 'warn' },
  { flag: PermissionsBitField.Flags.ManageChannels, label: '📁 Manage Channels', color: 'warn' },
  { flag: PermissionsBitField.Flags.BanMembers, label: '🔨 Ban Members', color: 'danger' },
  { flag: PermissionsBitField.Flags.KickMembers, label: '👢 Kick Members', color: 'warn' },
  { flag: PermissionsBitField.Flags.ManageMessages, label: '💬 Manage Messages', color: 'warn' },
  { flag: PermissionsBitField.Flags.MentionEveryone, label: '📣 Ping @everyone', color: 'danger' },
  { flag: PermissionsBitField.Flags.ManageWebhooks, label: '🪝 Manage Webhooks', color: 'danger' },
  { flag: PermissionsBitField.Flags.ManageEmojisAndStickers, label: '😀 Manage Emojis', color: 'warn' },
  { flag: PermissionsBitField.Flags.ViewAuditLog, label: '📋 View Audit Log', color: 'warn' },
  { flag: PermissionsBitField.Flags.ModerateMembers, label: '🔇 Timeout Members', color: 'warn' },
  { flag: PermissionsBitField.Flags.SendMessages, label: '✉️ Send Messages', color: 'neutral' },
  { flag: PermissionsBitField.Flags.ReadMessageHistory, label: '📖 Read History', color: 'neutral' },
  { flag: PermissionsBitField.Flags.Connect, label: '🔊 Voice Connect', color: 'neutral' },
  { flag: PermissionsBitField.Flags.Speak, label: '🎙️ Voice Speak', color: 'neutral' },
];

/** Check if a role name matches known clan ranks. */
function detectClanRank(member) {
  for (const role of member.roles.cache.values()) {
    const name = role.name.toLowerCase();
    for (const rank of Object.keys(RANK_ORDER)) {
      if (name === rank || name === rank + 's') {
        return { rank: role.name, level: RANK_ORDER[rank] };
      }
    }
  }
  return null;
}

/** Detect staff role category. */
function detectStaffRole(member) {
  for (const role of member.roles.cache.values()) {
    const name = role.name.toLowerCase();
    if (name === 'admin' || name === 'administrator') return 'admin';
    if (name === 'mod' || name === 'moderator') return 'moderator';
    if (name === 'helper') return 'helper';
    if (name === 'bot' || name === 'bot dev') return 'bot';
    if (name === 'vip') return 'vip';
  }
  return null;
}

/** Format account age nicely. */
function formatAge(date) {
  const now = Date.now();
  const diff = now - date.getTime();
  const days = Math.floor(diff / (1000 * 60 * 60 * 24));
  if (days < 1) return 'Less than a day';
  if (days < 30) return `${days} day${days !== 1 ? 's' : ''}`;
  const months = Math.floor(days / 30);
  if (months < 12) return `${months} month${months !== 1 ? 's' : ''}`;
  const years = Math.floor(months / 12);
  const remMonths = months % 12;
  return `${years}y ${remMonths}m`;
}

/** Security risk assessment. */
function assessRisk(member) {
  const flags = [];
  const now = Date.now();

  // Account age check
  const accountAgeDays = (now - member.user.createdAt.getTime()) / (1000 * 60 * 60 * 24);
  if (accountAgeDays < 7) flags.push('🚨 Account is less than 7 days old');
  else if (accountAgeDays < 30) flags.push('⚠️ Account is less than 30 days old');

  // Join date check
  if (member.joinedAt) {
    const joinAgeDays = (now - member.joinedAt.getTime()) / (1000 * 60 * 60 * 24);
    if (joinAgeDays < 1) flags.push('🆕 Joined today');
  }

  // Default avatar check
  if (!member.user.avatar) flags.push('😐 Using default Discord avatar');

  // No roles check
  if (member.roles.cache.size <= 1) flags.push('👤 Has no roles (fresh member?)');

  // Bot check
  if (member.user.bot) flags.push('🤖 This is a bot account');

  // High permissions with young account
  if (member.permissions && member.permissions.has(PermissionsBitField.Flags.Administrator)) {
    if (accountAgeDays < 30) flags.push('⚠️ Has Administrator on a new account');
  }

  return flags;
}

/** /who — Deep user analysis with roles, permissions, and security check. */
module.exports = {
  data: new SlashCommandBuilder()
    .setName('who')
    .setDescription('Deep analysis of a user — roles, permissions, account info, security check')
    .addUserOption((o) => o.setName('user').setDescription('User to analyze').setRequired(false)),
  async execute(interaction) {
    const target = interaction.options.getMember('user') || interaction.member;
    const user = target.user;

    await interaction.deferReply();

    // ── Account Info ──
    const accountAge = formatAge(user.createdAt);
    const serverAge = target.joinedAt ? formatAge(target.joinedAt) : 'Unknown';
    const highestRole = target.roles.highest;
    const roleCount = target.roles.cache.size - 1; // exclude @everyone

    // ── Clan rank detection ──
    const clanRank = detectClanRank(target);
    const staffRole = detectStaffRole(target);

    // ── Permissions ──
    const perms = [];
    if (target.permissions) {
      for (const { flag, label } of KEY_PERMISSIONS) {
        if (target.permissions.has(flag)) perms.push(label);
      }
    }

    // ── Security assessment ──
    const risks = assessRisk(target);

    // ── Build embed ──
    const embed = new EmbedBuilder()
      .setColor(BRAND.colors.primary)
      .setAuthor({ name: `🔍 Analysis: ${user.tag}`, iconURL: user.displayAvatarURL({ size: 256 }) })
      .setThumbnail(user.displayAvatarURL({ size: 256 }))
      .addFields(
        {
          name: '👤 Account',
          value: [
            `**Username:** ${user.tag}`,
            `**Display Name:** ${user.displayName || 'None'}`,
            `**ID:** ${user.id}`,
            `**Account Created:** <t:${Math.floor(user.createdAt.getTime() / 1000)}:R>`,
            `**Account Age:** ${accountAge}`,
            `**Bot:** ${user.bot ? 'Yes 🤖' : 'No'}`,
            `**Nitro:** ${user.avatar?.includes('a_') ? 'Animated Avatar ✨' : user.banner ? 'Has Banner 🖼️' : 'Unknown'}`,
          ].join('\n'),
          inline: true,
        },
        {
          name: '🏠 Server',
          value: [
            `**Joined:** ${target.joinedAt ? `<t:${Math.floor(target.joinedAt.getTime() / 1000)}:R>` : 'Unknown'}`,
            `**Server Time:** ${serverAge}`,
            `**Nickname:** ${target.nickname || 'None'}`,
            `**Boosting:** ${target.premiumSince ? `Yes since <t:${Math.floor(target.premiumSince.getTime() / 1000)}:R>` : 'No'}`,
            `**Top Role:** ${highestRole.name}`,
            `**Role Count:** ${roleCount}`,
          ].join('\n'),
          inline: true,
        },
      );

    // ── Clan rank badge ──
    if (clanRank) {
      embed.addFields({
        name: '⚔️ FGx Clan',
        value: `**Rank:** ${clanRank.rank}\n**Level:** ${clanRank.level + 1}/${Object.keys(RANK_ORDER).length}`,
        inline: true,
      });
    }

    // ── Staff status ──
    if (staffRole) {
      const icons = { admin: '👑', moderator: '🛡️', helper: '🤝', bot: '🤖', vip: '💎' };
      embed.addFields({
        name: `${icons[staffRole] || '🏷️'} Staff Status`,
        value: `**Role:** ${staffRole.charAt(0).toUpperCase() + staffRole.slice(1)}`,
        inline: true,
      });
    }

    // ── Permissions ──
    if (perms.length > 0) {
      // Group by category
      const admin = perms.filter(p => p.includes('Administrator') || p.includes('Manage Server') || p.includes('Manage Roles') || p.includes('Manage Channels') || p.includes('Manage Webhooks'));
      const mod = perms.filter(p => p.includes('Ban') || p.includes('Kick') || p.includes('Messages') || p.includes('Timeout') || p.includes('Audit'));
      const general = perms.filter(p => !admin.includes(p) && !mod.includes(p));

      let permText = '';
      if (admin.length) permText += `**Admin:** ${admin.join(', ')}\n`;
      if (mod.length) permText += `**Mod:** ${mod.join(', ')}\n`;
      if (general.length) permText += `**General:** ${general.join(', ')}`;

      embed.addFields({
        name: `🔐 Permissions (${perms.length})`,
        value: permText.slice(0, 1024),
        inline: false,
      });
    } else {
      embed.addFields({
        name: '🔐 Permissions',
        value: 'No special permissions',
        inline: false,
      });
    }

    // ── Roles list ──
    const roleList = target.roles.cache
      .filter(r => r.id !== interaction.guild.id)
      .sort((a, b) => b.position - a.position)
      .map(r => `${r.emoji || ''} ${r.name}`)
      .slice(0, 20);

    if (roleList.length > 0) {
      embed.addFields({
        name: `🎭 Roles (${roleCount})`,
        value: roleList.join(', ').slice(0, 1024) + (roleCount > 20 ? `\n... and ${roleCount - 20} more` : ''),
        inline: false,
      });
    }

    // ── Security assessment ──
    if (risks.length > 0) {
      embed.addFields({
        name: '🛡️ Security Check',
        value: risks.join('\n'),
        inline: false,
      });
    } else {
      embed.addFields({
        name: '🛡️ Security Check',
        value: '✅ No flags — account looks clean',
        inline: false,
      });
    }

    embed.setFooter({ text: `${BRAND.footer} • Analysis by FGx` }).setTimestamp(new Date());

    await interaction.editReply({ embeds: [embed] });
  },
};
