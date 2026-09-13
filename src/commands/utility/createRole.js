'use strict';

/* Copyright © 2026 FGx. All rights reserved. */

const {
  SlashCommandBuilder,
  EmbedBuilder,
  PermissionFlagsBits,
  RoleFlagsBitField,
} = require('discord.js');
const { BRAND } = require('../../config/constants');
const { requireAdmin } = require('../../utils/permissions');
const { logger } = require('../../utils/logger');

// ─── Helpers ──────────────────────────────────────────────────────────────

/** Max role name length allowed by Discord is 100. */
const MAX_NAME_LEN = 100;

/** Color palette the user can pick from without typing a hex code. */
const COLOR_PRESETS = [
  { name: 'Crimson', hex: '#dc143c' },
  { name: 'Red', hex: '#ff0000' },
  { name: 'Orange', hex: '#ff8800' },
  { name: 'Gold', hex: '#ffd700' },
  { name: 'Yellow', hex: '#ffff00' },
  { name: 'Green', hex: '#2fbf71' },
  { name: 'Teal', hex: '#00bfff' },
  { name: 'Blue', hex: '#3b82f6' },
  { name: 'Purple', hex: '#a855f7' },
  { name: 'Pink', hex: '#ec4899' },
  { name: 'White', hex: '#ffffff' },
  { name: 'Gray', hex: '#808080' },
  { name: 'Dark Gray', hex: '#404040' },
  { name: 'Black', hex: '#000000' },
  { name: 'Transparent (no color)', hex: null },
];

/**
 * Validate a hex color string. Returns the integer color or null for none.
 */
function parseColor(raw) {
  if (!raw || raw.toLowerCase() === 'none' || raw.toLowerCase() === 'null') {
    return null;
  }
  const m = raw.trim().replace(/^#/, '').match(/^([0-9a-f]{6})$/i);
  if (m) return parseInt(m[1], 16);
  // allow hex without # already handled above; anything else invalid
  throw new Error(
    'Invalid color. Use a 6-digit hex like `ff0000`, `#ff0000`, or pick a preset.',
  );
}

/** Human-readable role icon label (emoji or attachment description). */
function iconLabel(iconEmoji, iconAsset) {
  if (iconEmoji) return `:${iconEmoji.name}:`;
  if (iconAsset) return iconAsset.description ?? 'custom icon';
  return 'none';
}

// ─── Command definition ───────────────────────────────────────────────────

module.exports = {
  data: new SlashCommandBuilder()
    .setName('createrole')
    .setDescription(
      'Create a new role with name, color, icon/emoji, hoist, mentionable, and permissions',
    )
    // Name
    .addStringOption((o) =>
      o
        .setName('name')
        .setDescription('Role name (max 100 chars)')
        .setRequired(true),
    )
    // Color — user can pick a preset or type a hex
    .addStringOption((o) =>
      o
        .setName('color')
        .setDescription(
          'Color preset or hex (e.g. crimson, ff0000, #ff0000, none)',
        )
        .setRequired(false),
    )
    // Icon emoji
    .addStringOption((o) =>
      o
        .setName('icon_emoji')
        .setDescription('Emoji to use as the role icon (Discord emoji or custom)')
        .setRequired(false),
    )
    // Role icon upload
    .addAttachmentOption((o) =>
      o
        .setName('icon_image')
        .setDescription(
          'Upload an image to use as the role icon (square PNG recommended)',
        )
        .setRequired(false),
    )
    // Hoist (display separately)
    .addBooleanOption((o) =>
      o
        .setName('hoist')
        .setDescription('Show this role separately in the member list')
        .setRequired(false),
    )
    // Mentionable
    .addBooleanOption((o) =>
      o
        .setName('mentionable')
        .setDescription('Allow anyone to @mention this role')
        .setRequired(false),
    )
    // Permission granuality — preset levels
    .addIntegerOption((o) =>
      o
        .setName('permission_level')
        .setDescription(
          'Permission preset: 0=None, 1=Muted, 2=Member, 3=Verified, 4=Staff, 5=Admin, 6=Owner',
        )
        .setRequired(false)
        .addChoices(
          { name: 'None (no extra perms)', value: 0 },
          { name: 'Muted (can read, no speak)', value: 1 },
          { name: 'Member (default)', value: 2 },
          { name: 'Verified (can use voice/activities)', value: 3 },
          { name: 'Staff (moderate)', value: 4 },
          { name: 'Admin (full config)', value: 5 },
          { name: 'Owner (all perms)', value: 6 },
        ),
    ),

  async execute(interaction) {
    const guild = interaction.guild;
    if (!guild) {
      await interaction.reply({
        content: 'This command only works in a server.',
        ephemeral: true,
      });
      return;
    }

    // ── Permission gate ─────────────────────────────────────────────────
    // Only people who can manage roles may create roles.
    try {
      requireAdmin(interaction.member);
    } catch (err) {
      await interaction.reply({
        content: err.message,
        ephemeral: true,
      });
      return;
    }

    await interaction.deferReply({ ephemeral: true });

    const name = interaction.options.getString('name', true).trim();
    if (name.length > MAX_NAME_LEN) {
      return interaction.editReply({
        content: `Role name is too long (max ${MAX_NAME_LEN} characters).`,
      });
    }

    // ── Color ───────────────────────────────────────────────────────────
    let colorHex = null;
    let colorInt = null;
    try {
      const raw = interaction.options.getString('color') ?? 'crimson';
      // try a preset first
      const preset = COLOR_PRESETS.find(
        (p) => p.name.toLowerCase() === raw.toLowerCase(),
      );
      if (preset) {
        colorHex = preset.hex;
        colorInt = preset.hex ? parseInt(preset.hex.replace('#', ''), 16) : null;
      } else {
        colorInt = parseColor(raw);
        colorHex = colorInt ? '#' + colorInt.toString(16).padStart(6, '0') : null;
      }
    } catch (err) {
      return interaction.editReply({ content: err.message });
    }

    // ── Icon emoji ──────────────────────────────────────────────────────
    let iconEmoji = null;
    const emojiRaw = interaction.options.getString('icon_emoji');
    if (emojiRaw) {
      const parsed = guild.emojis.cache.find((e) => e.name === emojiRaw);
      if (parsed) {
        iconEmoji = parsed;
      } else {
        // maybe it's a custom emoji supplied as name:<name> — try match
        const byName = guild.emojis.cache.find(
          (e) => e.name.toLowerCase() === emojiRaw.toLowerCase(),
        );
        if (byName) iconEmoji = byName;
        else {
          return interaction.editReply({
            content:
              `I couldn't find an emoji named \`${emojiRaw}\` in this server. Use the server emoji name (no colons).`,
          });
        }
      }
    }

    // ── Icon image attachment ────────────────────────────────────────────
    let iconAsset = null;
    const attachment = interaction.options.getAttachment('icon_image');
    if (attachment) {
      if (!attachment.contentType?.startsWith('image/')) {
        return interaction.editReply({
          content: 'The icon must be an image file (PNG, JPG, GIF…).',
        });
      }
      // Discord accepts any image up to a few MB as role icon.
      iconAsset = attachment;
    }

    // Exactly one icon? If both provided, pick image over emoji.
    if (iconAsset && iconEmoji) {
      iconEmoji = null;
    }

    // ── Hoist / mentionable ──────────────────────────────────────────────
    const hoist = interaction.options.getBoolean('hoist') ?? false;
    const mentionable = interaction.options.getBoolean('mentionable') ?? false;

    // ── Permission granuality ────────────────────────────────────────────
    let flags = RoleFlagsBitField.Flags.UseSlashCommands; // baseline
    const permLevel = interaction.options.getInteger('permission_level');
    if (permLevel !== null) {
      // 0 = None: no extra flags beyond baseline
      if (permLevel >= 1) {
        flags |= RoleFlagsBitField.Flags.SendMessages;
      }
      if (permLevel >= 2) {
        flags |= RoleFlagsBitField.Flags.AddReactions;
      }
      if (permLevel >= 3) {
        flags |= RoleFlagsBitField.Flags.UseVoice | RoleFlagsBitField.Flags.Speak;
      }
      if (permLevel >= 4) {
        flags |=
          RoleFlagsBitField.Flags.ManageMessages |
          RoleFlagsBitField.Flags.KickMembers |
          RoleFlagsBitField.Flags.BanMembers |
          RoleFlagsBitField.Flags.MuteMembers |
          RoleFlagsBitField.Flags.DeafenMembers |
          RoleFlagsBitField.Flags.MoveMembers |
          RoleFlagsBitField.Flags.ManageNicknames |
          RoleFlagsBitField.Flags.ManageRoles;
      }
      if (permLevel >= 5) {
        flags |= RoleFlagsBitField.Flags.Administrator;
      }
      // 6 = owner-level: admin + manage server
      if (permLevel >= 6) {
        flags |=
          RoleFlagsBitField.Flags.ManageServer |
          RoleFlagsBitField.Flags.ManageChannels |
          RoleFlagsBitField.Flags.ManageWebhooks |
          RoleFlagsBitField.Flags.ManageEmojisAndStickers |
          RoleFlagsBitField.Flags.ManageEvents |
          RoleFlagsBitField.Flags.ManageThreads;
      }
    }

    // ── Build the role ───────────────────────────────────────────────────
    const bot = guild.members.me;
    const botTop = bot?.roles.highest?.position ?? 0;

    try {
      const created = await guild.roles.create({
        name,
        color: colorInt,
        hoist,
        mentionable,
        permissions: flags,
        icon: iconAsset?.url,
        // Discord requires an emoji name or image; if neither, omit icon
        // The API will attach the emoji if iconEmoji is a GuildEmoji object
        // — but the discord.js v14 create role API does NOT accept emoji directly,
        // so we set the emoji separately after creation.
      });

      // Apply emoji icon if provided (separate API call)
      if (iconEmoji) {
        try {
          await created.edit({ icon: iconEmoji.url ?? iconEmoji.id });
        } catch (emojiErr) {
          logger.warn('createrole: failed to set emoji icon', {
            role: created.name,
            error: emojiErr.message,
          });
          // fall back — role is still valid, just no icon
        }
      }

      // Build response embed
      const colorField =
        colorInt !== null
          ? `> **Color:** \`${colorHex}\` (custom)`
          : '> **Color:** none (transparent)';

      const iconField = iconLabel(iconEmoji, iconAsset);

      const permLabel = [
        'None (no extra perms)',
        'Muted (read only)',
        'Member (default)',
        'Verified (voice/activities)',
        'Staff (moderate)',
        'Admin (full config)',
        'Owner (all perms)',
      ][permLevel ?? 2] ?? 'Member (default)';

      const embed = new EmbedBuilder()
        .setColor(colorInt ?? BRAND.colors.primary)
        .setTitle('✅ Role Created')
        .setDescription(`**${created.name}** has been created in this server.`)
        .addFields(
          { name: '🎭 Name', value: created.name, inline: true },
          { name: '🎨 ' + (colorHex ? 'Color' : 'Color'), value: colorField, inline: true },
          {
            name: '🖼️ Icon',
            value: iconField,
            inline: true,
          },
          { name: '📌 Hoisted', value: hoist ? 'Yes (separate section)' : 'No', inline: true },
          {
            name: '💬 Mentionable',
            value: mentionable ? 'Yes (@role works)' : 'No',
            inline: true,
          },
          { name: '🔒 Permission Level', value: permLabel, inline: true },
          {
            name: '🔢 Position',
            value: `Position ${created.position} (above bot: ${created.position > botTop})`,
            inline: true,
          },
        )
        .setFooter({ text: BRAND.footer })
        .setTimestamp();

      return interaction.editReply({
        embeds: [embed],
        // Show the role mention so it's easy to copy
        content: created.mention,
      });
    } catch (err) {
      logger.error('createrole: failed to create role', {
        name,
        error: err.message,
      });
      return interaction.editReply({
        content: `Failed to create the role: ${err.message}`,
      });
    }
  },
};
