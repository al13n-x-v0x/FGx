'use strict';

/* Copyright © 2026 FGx. All rights reserved. */

const {
  SlashCommandBuilder,
  PermissionFlagsBits,
  EmbedBuilder,
} = require('discord.js');
const { BRAND } = require('../../config/constants');

const NL = '\n';

const COLOR_PRESETS = {
  crimson: 'ff0033', gold: 'ffd700', blue: '3498db', green: '2ecc71',
  purple: '9b59b6', orange: 'e67e22', pink: 'e91e63', cyan: '00bcd4',
  yellow: 'f1c40f', red: 'e74c3c', white: 'ffffff', black: '1a1a1a',
  gray: '636e72', dark: '2c2f33', neon: '39ff14',
};

function resolveColor(raw) {
  if (!raw || raw.toLowerCase() === 'none' || raw.toLowerCase() === 'default') return null;
  const cleaned = raw.replace(/^#/, '').trim();
  if (COLOR_PRESETS[cleaned.toLowerCase()]) return COLOR_PRESETS[cleaned.toLowerCase()];
  if (/^[0-9a-f]{6}$/i.test(cleaned)) return parseInt(cleaned, 16);
  if (/^[0-9a-f]{3}$/i.test(cleaned)) {
    const c = cleaned.split('');
    return parseInt(c.map(x => x + x).join(''), 16);
  }
  return null;
}

const roleCmd = {
  data: new SlashCommandBuilder()
    .setName('role')
    .setDescription('Role management - create, list, and inspect roles')
    .addSubcommand(sub =>
      sub
        .setName('create')
        .setDescription('Create a new role')
        .addStringOption(o => o.setName('name').setDescription('Role name').setRequired(true).setMaxLength(100))
        .addStringOption(o => o.setName('color').setDescription('Color preset or hex (crimson, gold, #ff0033)').setRequired(false).setMaxLength(20))
        .addBooleanOption(o => o.setName('hoist').setDescription('Show separately in member list').setRequired(false))
        .addBooleanOption(o => o.setName('mentionable').setDescription('Allow @mention').setRequired(false))
    )
    .addSubcommand(sub =>
      sub
        .setName('list')
        .setDescription('Show all roles')
        .addBooleanOption(o => o.setName('show_ids').setDescription('Show role IDs').setRequired(false))
    )
    .addSubcommand(sub =>
      sub
        .setName('info')
        .setDescription('Detailed info about a role')
        .addRoleOption(o => o.setName('role').setDescription('Which role').setRequired(true))
    ),

  async execute(interaction) {
    const sub = interaction.options.getSubcommand();
    if (sub === 'create') return createRole(interaction);
    if (sub === 'list') return listRoles(interaction);
    if (sub === 'info') return roleInfo(interaction);
  },
};

async function createRole(interaction) {
  if (!interaction.guild) {
    return interaction.reply({ content: 'Server only.', ephemeral: true });
  }

  const actor = interaction.member;
  const canManage =
    actor.permissions.has(PermissionFlagsBits.ManageRoles) ||
    actor.permissions.has(PermissionFlagsBits.Administrator) ||
    actor.id === interaction.guild.ownerId;

  if (!canManage) {
    return interaction.reply({
      embeds: [
        new EmbedBuilder()
          .setColor(0xed4245)
          .setTitle('Not Allowed')
          .setDescription('You need **Manage Roles** permission to create roles.')
          .setFooter({ text: BRAND.footer }),
      ],
      ephemeral: true,
    });
  }

  const name = interaction.options.getString('name', true).trim();
  const colorRaw = interaction.options.getString('color') ?? null;
  const hoist = interaction.options.getBoolean('hoist') ?? false;
  const mentionable = interaction.options.getBoolean('mentionable') ?? false;
  const color = resolveColor(colorRaw);

  try {
    const role = await interaction.guild.roles.create({ name, color: color ?? undefined, hoist, mentionable });

    const colorLine = role.color ? '> Color: `' + role.color.toString(16).padStart(6, '0') + '`' : '> Color: default';
    const embed = new EmbedBuilder()
      .setColor(color ?? BRAND.colors.primary)
      .setTitle('Role Created')
      .setDescription(
        'Created **' + role.name + '**' + NL + NL +
        colorLine + NL +
        '> Hoist: ' + (role.hoist ? 'Yes' : 'No') + NL +
        '> Mentionable: ' + (role.mentionable ? 'Yes' : 'No') + NL +
        '> ID: `' + role.id + '`'
      )
      .setFooter({ text: BRAND.footer })
      .setTimestamp();

    await interaction.reply({ embeds: [embed] });
  } catch (err) {
    const msg = err.code === 50013
      ? 'I need **Manage Roles** permission.'
      : err.code === 50016
        ? 'Role count limit reached.'
        : (err.message || 'Failed to create role.');

    await interaction.reply({
      embeds: [new EmbedBuilder().setColor(0xed4245).setTitle('Failed').setDescription(msg).setFooter({ text: BRAND.footer })],
      ephemeral: true,
    });
  }
}

async function listRoles(interaction) {
  if (!interaction.guild) {
    return interaction.reply({ content: 'Server only.', ephemeral: true });
  }

  await interaction.deferReply();

  const roles = interaction.guild.roles.cache
    .filter(r => r.id !== interaction.guild.id)
    .sort((a, b) => b.position - a.position);

  if (roles.size === 0) {
    return interaction.editReply({ content: 'No roles in this server.' });
  }

  const showIds = interaction.options.getBoolean('show_ids') ?? false;
  const lines = [];

  for (const role of roles.values()) {
    const hex = role.color.toString(16).padStart(6, '0');
    const idPart = showIds ? ' [' + role.id + ']' : '';
    const hoistPart = role.hoist ? ' *' : '';
    const mentionPart = role.mentionable ? ' @' : '';
    lines.push('**' + role.name + '** `' + hex + '` pos:' + role.position + idPart + hoistPart + mentionPart);
  }

  const embed = new EmbedBuilder()
    .setColor(BRAND.colors.primary)
    .setTitle('Roles - ' + interaction.guild.name)
    .setDescription(lines.join(NL))
    .setFooter({ text: BRAND.footer + ' - ' + roles.size + ' roles' })
    .setTimestamp();

  await interaction.editReply({ embeds: [embed] });
}

async function roleInfo(interaction) {
  const role = interaction.options.getRole('role', true);

  if (!interaction.guild) {
    return interaction.reply({ content: 'Server only.', ephemeral: true });
  }

  const count = role.members?.size ?? 0;
  const memberNames = role.members?.cache?.first(10)?.map(m => m.user.tag).join(', ') || 'None';

  const colorInt = role.color ? parseInt(role.color.toString(16).padStart(6, '0'), 16) : BRAND.colors.primary;

  const embed = new EmbedBuilder()
    .setColor(colorInt)
    .setTitle('Role: ' + role.name)
    .setDescription(
      'ID: `' + role.id + '`' + NL +
      'Position: ' + role.position + NL +
      'Hoist: ' + (role.hoist ? 'Yes' : 'No') + NL +
      'Mentionable: ' + (role.mentionable ? 'Yes' : 'No') + NL +
      'Members: ' + count + NL +
      'Permissions: `' + role.permissions.toArray().slice(0, 8).join(', ') + (role.permissions.toArray().length > 8 ? '...' : '') + '`'
    )
    .addFields({ name: 'Members (first 10)', value: memberNames, inline: false })
    .setFooter({ text: BRAND.footer })
    .setTimestamp();

  await interaction.reply({ embeds: [embed] });
}

module.exports = roleCmd;
