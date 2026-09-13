'use strict';

/* Copyright © 2026 FGx. All rights reserved. */

const {
  SlashCommandBuilder,
  PermissionFlagsBits,
  EmbedBuilder,
  ApplicationCommandOptionType,
} = require('discord.js');
const { BRAND } = require('../../config/constants');

const COLOR_PRESETS = {
  crimson: 'ff0033',
  gold: 'ffd700',
  blue: '3498db',
  green: '2ecc71',
  purple: '9b59b6',
  orange: 'e67e22',
  pink: 'e91e63',
  cyan: '00bcd4',
  yellow: 'f1c40f',
  red: 'e74c3c',
  white: 'ffffff',
  black: '1a1a1a',
  gray: '636e72',
  dark: '2c2f33',
  neon: '39ff14',
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
    .setDescription('Role management — create, manage, and inspect roles')
    .addSubcommand((sub) =>
      sub
        .setName('create')
        .setDescription('Create a new role with custom color, icon, hoist, and more')
        .addStringOption((o) =>
          o
            .setName('name')
            .setDescription('Name of the new role')
            .setRequired(true)
            .setMaxLength(100),
        )
        .addStringOption((o) =>
          o
            .setName('color')
            .setDescription(
              'Color preset or hex — e.g. `crimson`, `gold`, `#ff0033`, `ff0033`, or `none` for default',
            )
            .setRequired(false)
            .setMaxLength(20),
        )
        .addStringOption((o) =>
          o
            .setName('icon_emoji')
            .setDescription('Server emoji name to use as the role icon (no colons, e.g. `flame`)')
            .setRequired(false)
            .setMaxLength(100),
        )
        .addAttachmentOption((o) =>
          o
            .setName('icon_image')
            .setDescription('Upload an image/gif to use as the role icon')
            .setRequired(false),
        )
        .addBooleanOption((o) =>
          o
            .setName('hoist')
            .setDescription('Show members with this role separately in the member list')
            .setRequired(false),
        )
        .addBooleanOption((o) =>
          o
            .setName('mentionable')
            .setDescription('Allow @role mentions (everyone can ping this role)')
            .setRequired(false),
        )
        .addIntegerOption((o) =>
          o
            .setName('permission_level')
            .setDescription(
              'Recommended permission tier — this just sets a permission hint, not actual permissions',
            )
            .setRequired(false)
            .addChoices(
              { name: '🔰 None (default)', value: 0 },
              { name: '🔇 Muted', value: 1 },
              { name: '👤 Member', value: 2 },
              { name: '✅ Verified', value: 3 },
              { name: '🛡️ Staff', value: 4 },
              { name: '👑 Admin', value: 5 },
              { name: '🔱 Owner', value: 6 },
            ),
        ),
    )
    .addSubcommand((sub) =>
      sub
        .setName('list')
        .setDescription('Show all roles in this server with colors and positions')
        .addBooleanOption((o) =>
          o
            .setName('show_ids')
            .setDescription('Also show the raw role IDs')
            .setRequired(false),
        ),
    )
    .addSubcommand((sub) =>
      sub
        .setName('info')
        .setDescription('Show detailed info about a specific role')
        .addRoleOption((o) =>
          o.setName('role').setDescription('Which role to inspect').setRequired(true),
        ),
    ),

  async execute(interaction) {
    const subcommand = interaction.options.getSubcommand();

    if (subcommand === 'create') {
      await createRole(interaction);
    } else if (subcommand === 'list') {
      await listRoles(interaction);
    } else if (subcommand === 'info') {
      await roleInfo(interaction);
    }
  },
};

async function createRole(interaction) {
  const name = interaction.options.getString('name', true).trim();
  const colorRaw = interaction.options.getString('color') ?? null;
  const iconEmojiName = interaction.options.getString('icon_emoji') ?? null;
  const iconAttachment = interaction.options.getAttachment('icon_image') ?? null;
  const hoist = interaction.options.getBoolean('hoist') ?? false;
  const mentionable = interaction.options.getBoolean('mentionable') ?? false;
  const permissionLevel = interaction.options.getInteger('permission_level') ?? 0;

  if (!interaction.guild) {
    return interaction.reply({
      content: 'This command only works in a server.',
      ephemeral: true,
    });
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
          .setTitle('🚫 Not Allowed')
          .setDescription(
            'Only staff with **Manage Roles** permission, **Administrators**, or the **server owner** can create roles.',
          )
          .setFooter({ text: BRAND.footer }),
      ],
      ephemeral: true,
    });
  }

  const color = resolveColor(colorRaw);

  // Build the role create options
  const createOptions = { name, color: color ?? null, hoist, mentionable };

  // Role icon: prefer uploaded image, then emoji
  let iconFile = null;
  if (iconAttachment) {
    iconFile = iconAttachment;
    createOptions.icon = iconAttachment.url;
  } else if (iconEmojiName) {
    // Look up the guild emoji by name
    const emoji = interaction.guild.emojis.cache.find(
      (e) => e.name === iconEmojiName || e.name === iconEmojiName.replace(/[^a-z0-9_]/gi, ''),
    );
    if (emoji) {
      // Get the emoji image URL
      try {
        const emojiUrl = await emoji.url.clone().catch(() => null) || emoji.url;
        // Download and re-upload as a temp file for the role icon
        const res = await fetch(emojiUrl.toString());
        if (res.ok) {
          const buf = Buffer.from(await res.arrayBuffer());
          const ext = emojiUrl.toString().endsWith('.gif') ? 'gif' : 'png';
          iconFile = { name: `role-icon.${ext}`, attachment: buf };
          createOptions.icon = iconFile.attachment;
        }
      } catch {}
    }
  }

  try {
    const role = await interaction.guild.roles.create(createOptions);

    const embed = new EmbedBuilder()
      .setColor(color ?? BRAND.colors.primary)
      .setTitle('✅ Role Created')
      .setDescription(
        'Created the **' + role.name + '** role.' + NL + NL +
        (role.color?.toString(16)?.padStart(6, '0') ? '> **Color:** `' + role.color.toString(16).padStart(6, '0') + '`' : '') +
        (role.hoist ? NL + '**Hoist:** Yes - shown separately in member list' : '') +
        (role.mentionable ? NL + '**Mentionable:** Yes - @mentionable' : '') +
        (iconFile ? NL + '**Icon:** Yes - ' + iconFile.name : '') +
        NL + '**ID:** `' +' role.id + '`',
      )
      .setFooter({ text: BRAND.footer })
      .setTimestamp();

    await interaction.reply({ embeds: [embed] });
  } catch (err) {
    const code = err.code ?? err.message?.slice(0, 100);
    if (code === 50013) {
      return interaction.reply({
        embeds: [
          new EmbedBuilder()
            .setColor(0xed4245)
            .setTitle('🚫 No Permission')
            .setDescription('I don\'t have the **Manage Roles** permission to create a new role.')
            .setFooter({ text: BRAND.footer }),
        ],
        ephemeral: true,
      });
    }

    let msg = err.message || 'Unknown error creating role.';
    if (msg.includes('Missing Access') || msg.includes('missing access')) {
      msg = 'I need the **Manage Roles** permission to create roles. Ask an admin to grant it.';
    } else if (msg.includes('2103')) {
      msg = 'Maximum role count (250) reached — delete an old role first.';
    } else if (msg.includes('Name')) {
      msg = 'Invalid role name. Role names must be 1-100 characters.';
    }

    await interaction.reply({
      embeds: [
        new EmbedBuilder()
          .setColor(0xed4245)
          .setTitle('❌ Failed to Create Role')
          .setDescription(msg)
          .setFooter({ text: BRAND.footer }),
      ],
      ephemeral: true,
    });
  }
}

async function listRoles(interaction) {
  if (!interaction.guild) {
    return interaction.reply({
      content: 'This command only works in a server.',
      ephemeral: true,
    });
  }

  await interaction.deferReply();

  const roles = interaction.guild.roles.cache
    .filter((r) => r.id !== interaction.guild.id)
    .sort((a, b) => b.position - a.position);

  if (roles.size === 0) {
    return interaction.editReply({
      content: 'This server has no custom roles yet.',
      ephemeral: true,
    });
  }

  const showIds = interaction.options.getBoolean('show_ids') ?? false;
  let description = '';
  for (const role of roles.values()) {
    const colorHex = role.color.toString(16).padStart(6, '0');
    const line = showIds
      ? `**${role.name}** \`${colorHex}\` — ${role.position} [${role.id}]${role.hoist ? ' 🔝' : ''}${role.mentionable ? ' @️⃣' : ''}`
      : `**${role.name}** \`#${colorHex}\` — position ${role.position}${role.hoist ? ' 🔝' : ''}${role.mentionable ? ' @️⃣' : ''}`;
    description += `${line}\\n`;
  }

  const embed = new EmbedBuilder()
    .setColor(BRAND.colors.primary)
    .setTitle(`🏷️ Roles — ${interaction.guild.name}`)
    .setDescription(description.trim())
    .setFooter({ text: `${BRAND.footer} • ${roles.size} roles` })
    .setTimestamp();

  await interaction.editReply({ embeds: [embed] });
}

async function roleInfo(interaction) {
  const role = interaction.options.getRole('role', true);

  if (!interaction.guild) {
    return interaction.reply({
      content: 'This command only works in a server.',
      ephemeral: true,
    });
  }

  const count = role.members?.size ?? 0;
  const memberList = role.members?.cache?.first(10);
  const memberNames = memberList?.map((m) => m.user.tag).join(', ') ?? 'None';

  const embed = new EmbedBuilder()
    .setColor(role.color?.toString(16)?.padStart(6, '0') ? parseInt(role.color.toString(16).padStart(6, '0'), 16) : BRAND.colors.primary)
    .setTitle(`🎭 ${role.name}`)
    .setDescription(
      '**ID:** `${role.id}`

      '**Position:** ${role.position}`

      '**Hoist:** ${role.hoist ? 'Yes' : 'No'}`

      '**Mentionable:** ${role.mentionable ? 'Yes' : 'No'}`

      '**Managed:** ${role.managed ? 'Yes (bot/external)' : 'No'}`

      '**Members:** ${count}`

      '**Permissions:** `${role.permissions.toArray().slice(0, 8).join(', ')}${role.permissions.toArray().length > 8 ? '...' : ''}`',
    )
      '**Managed:** ${role.managed ? 'Yes (bot/external)' : 'No'}`

      '**Members:** ${count}`

      '**Permissions:** `${role.permissions.toArray().slice(0, 8).join(', ')}${role.permissions.toArray().length > 8 ? '...' : ''}`',
    )
      '**Managed:** ' + (role.managed ? 'Yes (bot/external)' : 'No') + '
' +
      '**Members:** ' + count + '
' +
      '**Permissions:** `' + role.permissions.toArray().slice(0, 8).join(', ') + (role.permissions.toArray().length > 8 ? '...' : '') + '`',
    )
    .addFields(
      memberNames ? { name: '👥 Members (first 10)', value: memberNames, inline: false } : null,
    )
    .setFooter({ text: BRAND.footer })
    .setTimestamp();

  await interaction.reply({ embeds: [embed] });
}

module.exports = roleCmd;
