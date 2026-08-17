'use strict';

/*
 * Copyright © 2026 FGx.
 * All rights reserved.
 */

const {
  SlashCommandBuilder,
  EmbedBuilder,
  ActionRowBuilder,
  StringSelectMenuBuilder,
  ButtonBuilder,
  ButtonStyle,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
} = require('discord.js');
const { BRAND } = require('../../config/constants');
const { guildConfigRepo } = require('../../database/repos/guildConfig');
const { requireAdmin } = require('../../utils/permissions');
const { ValidationError } = require('../../utils/errors');

/**
 * Per-guild configuration dashboard.
 * /config menu → select a category → edit via key=value lines in a modal.
 */

const CATEGORIES = {
  welcome: { label: 'Welcome', icon: '👋', description: 'Welcome message, channel and auto-role.' },
  moderation: { label: 'Moderation', icon: '🛡️', description: 'Mod log channel, anti-spam, anti-raid, anti-nuke limits.' },
  security: { label: 'Security', icon: '🔐', description: 'Lockdown roles and protection toggles.' },
  ai: { label: 'AI', icon: '🤖', description: 'AI assistant + AI security engine.' },
  logs: { label: 'Logging', icon: '📜', description: 'Log channel and logging toggle.' },
  verification: { label: 'Verification', icon: '✅', description: 'Verified role, cooldown, panel.' },
  tickets: { label: 'Tickets', icon: '🎫', description: 'Ticket category, staff roles, panel.' },
  clan: { label: 'Clan', icon: '⚔️', description: 'Rank roles and FGx rating algorithm.' },
  xp: { label: 'XP', icon: '📈', description: 'Community XP settings.' },
  rules: { label: 'Rules', icon: '📖', description: 'FGx community rules text.' },
};

/** Category → editable keys with their value types. */
const KEY_DEFS = {
  welcome: [
    ['enabled', 'boolean'],
    ['channel', 'snowflake'],
    ['message', 'string'],
    ['autoRole', 'snowflake'],
  ],
  moderation: [
    ['modLogChannel', 'snowflake'],
    ['antispam.enabled', 'boolean'],
    ['antispam.maxMessages', 'int'],
    ['antispam.windowSeconds', 'int'],
    ['antispam.duplicateCount', 'int'],
    ['antispam.maxMentions', 'int'],
    ['antispam.maxEmojis', 'int'],
    ['antispam.capsRatio', 'float'],
    ['antispam.capsMinLength', 'int'],
    ['antispam.invitesEnabled', 'boolean'],
    ['antispam.linksEnabled', 'boolean'],
    ['antispam.linkWhitelist', 'list'],
    ['antispam.action', 'choice:WARN|DELETE|TIMEOUT'],
    ['antispam.purgeEnabled', 'boolean'],
    ['antiraid.enabled', 'boolean'],
    ['antiraid.joinThreshold', 'int'],
    ['antiraid.windowSeconds', 'int'],
    ['antiraid.newAccountHours', 'int'],
    ['antiraid.suspiciousThreshold', 'int'],
    ['antinuke.enabled', 'boolean'],
    ['antinuke.windowSeconds', 'int'],
    ['antinuke.channelDeleteLimit', 'int'],
    ['antinuke.roleDeleteLimit', 'int'],
    ['antinuke.channelCreateLimit', 'int'],
    ['antinuke.roleCreateLimit', 'int'],
    ['antinuke.banLimit', 'int'],
    ['antinuke.kickLimit', 'int'],
    ['antinuke.webhookLimit', 'int'],
    ['antinuke.permissionChangeLimit', 'int'],
  ],
  security: [
    ['security.lockdownRoleIds', 'list'],
  ],
  ai: [
    ['ai.securityEnabled', 'boolean'],
    ['ai.assistantEnabled', 'boolean'],
    ['ai.actionMode', 'choice:LOG|RECOMMEND|MODERATE'],
    ['ai.securityConfidence', 'float'],
    ['ai.moderateConfidence', 'float'],
    ['ai.userRateLimit', 'int'],
    ['ai.systemPrompt', 'string'],
  ],
  logs: [
    ['logChannel', 'snowflake'],
    ['logging.enabled', 'boolean'],
  ],
  verification: [
    ['verification.enabled', 'boolean'],
    ['verification.channel', 'snowflake'],
    ['verification.roleId', 'snowflake'],
    ['verification.cooldownMinutes', 'int'],
  ],
  tickets: [
    ['tickets.enabled', 'boolean'],
    ['tickets.categoryId', 'snowflake'],
    ['tickets.staffRoleIds', 'list'],
  ],
  clan: [
    ['clan.ranks.Owner', 'snowflake'],
    ['clan.ranks.Leader', 'snowflake'],
    ['clan.ranks.Co-Leader', 'snowflake'],
    ['clan.ranks.Manager', 'snowflake'],
    ['clan.ranks.Captain', 'snowflake'],
    ['clan.ranks.Elite', 'snowflake'],
    ['clan.ranks.Member', 'snowflake'],
    ['clan.ranks.Trial', 'snowflake'],
    ['clan.ranks.Recruit', 'snowflake'],
    ['clan.rating.winGain', 'int'],
    ['clan.rating.lossLoss', 'int'],
    ['clan.rating.kdFactor', 'int'],
    ['clan.rating.streakBonus', 'int'],
  ],
  xp: [
    ['xp.enabled', 'boolean'],
    ['xp.perMessage', 'int'],
    ['xp.cooldownSeconds', 'int'],
  ],
  rules: [
    ['rules.enabled', 'boolean'],
    ['rules.text', 'string'],
  ],
};

function coerce(value, type) {
  const v = String(value).trim();
  if (type === 'boolean') {
    if (v === 'true') return true;
    if (v === 'false') return false;
    throw new ValidationError(`\`${value}\` is not true or false.`);
  }
  if (type === 'int') {
    const n = Number(v);
    if (!Number.isInteger(n)) throw new ValidationError(`\`${value}\` is not a whole number.`);
    return n;
  }
  if (type === 'float') {
    const n = Number(v);
    if (!Number.isFinite(n)) throw new ValidationError(`\`${value}\` is not a number.`);
    if (n < 0 || n > 1) throw new ValidationError(`\`${value}\` must be between 0 and 1.`);
    return n;
  }
  if (type === 'snowflake') {
    if (!/^\d{15,21}$/.test(v)) throw new ValidationError(`\`${value}\` is not a valid Discord ID.`);
    return v;
  }
  if (type === 'list') {
    return v.split(',').map((s) => s.trim()).filter(Boolean);
  }
  if (type.startsWith('choice:')) {
    const allowed = type.slice(7).split('|');
    if (!allowed.includes(v.toUpperCase())) {
      throw new ValidationError(`\`${value}\` must be one of: ${allowed.join(', ')}.`);
    }
    return v.toUpperCase();
  }
  return v;
}

function categoryEmbed(guild, category, config) {
  const def = CATEGORIES[category];
  const keys = KEY_DEFS[category];
  const lines = keys.map(([key, type]) => {
    let value = getPath(config, key);
    if (Array.isArray(value)) value = value.join(', ') || '(none)';
    if (value === null || value === undefined || value === '') value = '(unset)';
    return `\`${key}\` (${type}) = **${String(value).slice(0, 60)}**`;
  });
  return new EmbedBuilder()
    .setColor(BRAND.colors.primary)
    .setTitle(`${def.icon} ${def.label} — FGx Configuration`)
    .setDescription(`${def.description}\n\n${lines.join('\n')}`)
    .setFooter({ text: `${BRAND.footer} • /config <category> to edit` });
}

function menuEmbed() {
  return new EmbedBuilder()
    .setColor(BRAND.colors.primary)
    .setTitle('FGx Configuration')
    .setDescription(
      'Select a category to view its settings, then use the **Edit** button.\n\n' +
        Object.entries(CATEGORIES)
          .map(([_key, def]) => `${def.icon} ${def.label} — ${def.description}`)
          .join('\n'),
    )
    .setFooter({ text: BRAND.footer });
}

function menuRow() {
  return new ActionRowBuilder().addComponents(
    new StringSelectMenuBuilder()
      .setCustomId('config:menu')
      .setPlaceholder('Choose a category…')
      .addOptions(
        Object.entries(CATEGORIES).map(([value, def]) => ({
          label: def.label,
          value,
          description: def.description,
          emoji: def.icon.replace(/[^\p{Extended_Pictographic}]/gu, '') || undefined,
        })),
      ),
  );
}

function categoryRow(category) {
  return new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId(`config:edit:${category}`).setStyle(ButtonStyle.Primary).setLabel('Edit'),
    new ButtonBuilder().setCustomId('config:back').setStyle(ButtonStyle.Secondary).setLabel('← Back'),
  );
}

function editModal(category) {
  const def = CATEGORIES[category];
  const modal = new ModalBuilder().setCustomId(`config:edit:modal:${category}`).setTitle(`Edit ${def.label}`);
  modal.addComponents(
    new ActionRowBuilder().addComponents(
      new TextInputBuilder()
        .setCustomId('config_lines')
        .setLabel(`key=value per line (see current values)`)
        .setStyle(TextInputStyle.Paragraph)
        .setRequired(true)
        .setMaxLength(2000)
        .setPlaceholder(KEY_DEFS[category].slice(0, 6).map(([k]) => `${k}=`).join('\n')),
    ),
  );
  return modal;
}

/** Apply a key=value block for a category. Returns summary lines. */
function applyLines(guildId, category, text) {
  const applied = [];
  const seen = new Set();
  for (const rawLine of text.split('\n')) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) continue;
    const eq = line.indexOf('=');
    if (eq === -1) throw new ValidationError(`Line \`${line}\` is missing "=".`);
    const key = line.slice(0, eq).trim();
    const value = line.slice(eq + 1).trim();
    const def = KEY_DEFS[category].find(([k]) => k === key);
    if (!def) {
      throw new ValidationError(`Unknown key \`${key}\` in ${category}.`);
    }
    if (seen.has(key)) continue;
    seen.add(key);
    const coerced = coerce(value, def[1]);
    guildConfigRepo.setPath(guildId, key, coerced);
    applied.push(`\`${key}\` → \`${Array.isArray(coerced) ? coerced.join(', ') || '(none)' : coerced}\``);
  }
  if (applied.length === 0) throw new ValidationError('No valid key=value lines found.');
  return applied;
}

function getPath(obj, path) {
  return path.split('.').reduce((acc, part) => (acc == null ? acc : acc[part]), obj);
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName('config')
    .setDescription('FGx configuration dashboard (admin).')
    .addSubcommand((s) => s.setName('menu').setDescription('Open the interactive configuration menu'))
    .addSubcommand((s) => s.setName('view').setDescription('View all configured values'))
    .addSubcommand((s) => s.setName('welcome').setDescription('Edit welcome settings'))
    .addSubcommand((s) => s.setName('moderation').setDescription('Edit moderation / anti-spam / anti-raid / anti-nuke settings'))
    .addSubcommand((s) => s.setName('security').setDescription('Edit security settings'))
    .addSubcommand((s) => s.setName('ai').setDescription('Edit AI settings'))
    .addSubcommand((s) => s.setName('logs').setDescription('Edit logging settings')),
  async execute(interaction) {
    requireAdmin(interaction.member);
    const sub = interaction.options.getSubcommand();
    const config = guildConfigRepo.get(interaction.guild.id);

    if (sub === 'menu') {
      return interaction.reply({ embeds: [menuEmbed()], components: [menuRow()] });
    }

    if (sub === 'view') {
      const embed = new EmbedBuilder()
        .setColor(BRAND.colors.primary)
        .setTitle('FGx Configuration — Full View')
        .setDescription('```json\n' + JSON.stringify(config, null, 2).slice(0, 3900) + '\n```');
      return interaction.reply({ embeds: [embed], ephemeral: true });
    }

    if (sub === 'welcome' || sub === 'moderation' || sub === 'security' || sub === 'ai' || sub === 'logs') {
      const category = sub;
      return interaction.reply({ embeds: [categoryEmbed(interaction.guild, category, config)], components: [categoryRow(category)] });
    }
  },
  // Exports for the interaction router.
  menuEmbed,
  menuRow,
  categoryEmbed,
  categoryRow,
  editModal,
  applyLines,
  KEY_DEFS,
  CATEGORIES,
};
