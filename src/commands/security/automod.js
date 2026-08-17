'use strict';

/*
 * Copyright © 2026 FGx.
 * All rights reserved.
 */

const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { BRAND } = require('../../config/constants');
const { guildConfigRepo } = require('../../database/repos/guildConfig');
const { requireAdmin } = require('../../utils/permissions');
const { ValidationError } = require('../../utils/errors');

/** Which config keys map to which category, for /automod set. */
const CATEGORY_KEYS = {
  antispam: ['enabled', 'maxMessages', 'windowSeconds', 'duplicateCount', 'maxMentions', 'maxEmojis', 'capsRatio', 'capsMinLength', 'invitesEnabled', 'linksEnabled', 'purgeEnabled', 'action', 'linkWhitelist'],
  antiraid: ['enabled', 'joinThreshold', 'windowSeconds', 'newAccountHours', 'suspiciousThreshold', 'action'],
  antinuke: ['enabled', 'windowSeconds', 'channelDeleteLimit', 'roleDeleteLimit', 'channelCreateLimit', 'roleCreateLimit', 'banLimit', 'kickLimit', 'webhookLimit', 'permissionChangeLimit', 'notifyOwner'],
  ai: ['securityEnabled', 'assistantEnabled', 'actionMode', 'securityConfidence', 'moderateConfidence', 'userRateLimit'],
  xp: ['enabled', 'perMessage', 'cooldownSeconds'],
  logging: ['enabled'],
};

function coerce(value, key) {
  const lower = value.toLowerCase();
  if (lower === 'true') return true;
  if (lower === 'false') return false;
  if (/^\d+$/.test(value)) return Number(value);
  if (/^\d*\.\d+$/.test(value)) return Number(value);
  if (key === 'linkWhitelist') return value.split(',').map((s) => s.trim()).filter(Boolean);
  return value;
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName('automod')
    .setDescription('View or configure FGx automod.')
    .addSubcommand((s) => s.setName('view').setDescription('Show current automod configuration'))
    .addSubcommand((s) =>
      s
        .setName('set')
        .setDescription('Change one automod setting')
        .addStringOption((o) =>
          o
            .setName('category')
            .setDescription('Category')
            .setRequired(true)
            .addChoices(
              ...Object.keys(CATEGORY_KEYS).map((c) => ({ name: c, value: c })),
            ),
        )
        .addStringOption((o) => o.setName('key').setDescription('Setting key, e.g. maxMessages, action, enabled').setRequired(true))
        .addStringOption((o) => o.setName('value').setDescription('New value (true/false, number, text, or comma list for linkWhitelist)').setRequired(true)),
    ),
  async execute(interaction) {
    const sub = interaction.options.getSubcommand();
    requireAdmin(interaction.member);
    const config = guildConfigRepo.get(interaction.guild.id);

    if (sub === 'view') {
      const embed = new EmbedBuilder()
        .setColor(BRAND.colors.primary)
        .setTitle('FGx Automod')
        .setDescription('Current per-server configuration. Use `/automod set` to change values.')
        .addFields(
          {
            name: 'Anti-spam',
            value:
              `${fmtBool(config.antispam.enabled)} — ${config.antispam.maxMessages} msgs/${config.antispam.windowSeconds}s, ` +
              `${config.antispam.duplicateCount} dupes, ${config.antispam.maxMentions} mentions, action ${config.antispam.action}`,
          },
          {
            name: 'Anti-raid',
            value: `${fmtBool(config.antiraid.enabled)} — ${config.antiraid.joinThreshold} joins/${config.antiraid.windowSeconds}s, action ${config.antiraid.action}`,
          },
          {
            name: 'Anti-nuke',
            value: `${fmtBool(config.antinuke.enabled)} — ${config.antinuke.channelDeleteLimit} channel deletes, ${config.antinuke.banLimit} bans, ${config.antinuke.roleDeleteLimit} role deletes per ${config.antinuke.windowSeconds}s`,
          },
          {
            name: 'AI',
            value: `security ${fmtBool(config.ai.securityEnabled)} • assistant ${fmtBool(config.ai.assistantEnabled)} • mode ${config.ai.actionMode} • mod-conf ${config.ai.moderateConfidence}`,
          },
          { name: 'XP', value: `${fmtBool(config.xp.enabled)} — ${config.xp.perMessage} XP per message (${config.xp.cooldownSeconds}s)` },
          { name: 'Logging', value: fmtBool(config.logging.enabled) },
        )
        .setFooter({ text: BRAND.footer });
      return interaction.reply({ embeds: [embed] });
    }

    // /automod set
    const category = interaction.options.getString('category', true);
    const key = interaction.options.getString('key', true);
    const raw = interaction.options.getString('value', true);

    const allowed = CATEGORY_KEYS[category];
    if (!allowed.includes(key)) {
      throw new ValidationError(
        `Unknown key \`${key}\` for ${category}. Allowed: ${allowed.map((k) => `\`${k}\``).join(', ')}.`,
      );
    }
    const value = coerce(raw, key);
    // Type-safety: booleans must stay booleans, numbers must stay numbers.
    const current = config[category][key];
    if (typeof current === 'boolean' && typeof value !== 'boolean') {
      throw new ValidationError(`\`${key}\` expects true or false.`);
    }
    if (typeof current === 'number' && typeof value !== 'number') {
      throw new ValidationError(`\`${key}\` expects a number.`);
    }

    guildConfigRepo.setPath(interaction.guild.id, `${category}.${key}`, value);
    const next = guildConfigRepo.get(interaction.guild.id);
    const formatted =
      key === 'linkWhitelist' ? (next[category][key] ?? []).join(', ') || '(empty)' : String(next[category][key]);
    return interaction.reply({
      embeds: [
        {
          color: BRAND.colors.success,
          title: 'Automod updated',
          description: `**${category}.${key}** is now \`${formatted}\`.`,
        },
      ],
    });
  },
};

function fmtBool(v) {
  return v ? '✅ enabled' : '❌ disabled';
}
