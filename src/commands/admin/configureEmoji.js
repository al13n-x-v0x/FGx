'use strict';

/* Copyright © 2026 FGx. All rights reserved. */

const { SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits } = require('discord.js');
const { BRAND } = require('../../config/constants');
const { guildConfigRepo } = require('../../database/repos/guildConfig');

/** Default emojis for each social kind. */
const DEFAULT_EMOJIS = {
  slap: '🖐️',
  clap: '👏',
  pat: '🤗',
  hug: '🫂',
  kiss: '💋',
  tickle: '🪶',
  poke: '👉',
  cuddle: '🧸',
  stare: '👀',
  boop: '🐾',
  feed: '🍪',
  highfive: '🙌',
  punch: '👊',
  bite: '🦷',
  dance: '💃',
};

module.exports = {
  data: new SlashCommandBuilder()
    .setName('configure-emoji')
    .setDescription('Set custom emojis for social actions using server emojis')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .addSubcommand(sub =>
      sub.setName('set')
        .setDescription('Set an emoji for a social action')
        .addStringOption(opt =>
          opt.setName('action')
            .setDescription('Social action to configure')
            .setRequired(true)
            .addChoices(...Object.keys(DEFAULT_EMOJIS).map(k => ({ name: k, value: k }))))
        .addStringOption(opt =>
          opt.setName('emoji')
            .setDescription('Emoji to use (unicode or <:name:id>)')
            .setRequired(true)))
    .addSubcommand(sub =>
      sub.setName('reset')
        .setDescription('Reset all emojis to defaults'))
    .addSubcommand(sub =>
      sub.setName('view')
        .setDescription('View current emoji configuration')),

  async execute(interaction) {
    const sub = interaction.options.getSubcommand();
    const guildId = interaction.guildId;

    if (sub === 'set') {
      const action = interaction.options.getString('action');
      const emoji = interaction.options.getString('emoji');

      // Store the custom emoji in guild config
      const config = guildConfigRepo.get(guildId) ?? {};
      if (!config.socialEmojis) config.socialEmojis = {};
      config.socialEmojis[action] = emoji;
      guildConfigRepo.set(guildId, config);

      const embed = new EmbedBuilder()
        .setColor(0x57F287)
        .setTitle('✅ Emoji Updated')
        .setDescription(
          `**${action}** is now ${emoji}\n\n` +
          `All social commands will use this emoji for **${action}**.`
        )
        .setFooter({ text: BRAND.footer });

      await interaction.reply({ embeds: [embed], ephemeral: true });

    } else if (sub === 'reset') {
      const config = guildConfigRepo.get(guildId) ?? {};
      config.socialEmojis = {};
      guildConfigRepo.set(guildId, config);

      const embed = new EmbedBuilder()
        .setColor(BRAND.colors.primary)
        .setTitle('🔄 Emojis Reset')
        .setDescription('All social emojis have been reset to defaults.')
        .setFooter({ text: BRAND.footer });

      await interaction.reply({ embeds: [embed], ephemeral: true });

    } else if (sub === 'view') {
      const config = guildConfigRepo.get(guildId) ?? {};
      const custom = config.socialEmojis ?? {};

      const lines = Object.entries(DEFAULT_EMOJIS).map(([action, defaultEmoji]) => {
        const customEmoji = custom[action] || defaultEmoji;
        const isCustom = !!custom[action];
        return `${customEmoji} **${action}** ${isCustom ? '✅ custom' : '⬜ default'}`;
      });

      const embed = new EmbedBuilder()
        .setColor(BRAND.colors.primary)
        .setTitle('🏷️ Server Emoji Configuration')
        .setDescription(lines.join('\n'))
        .setFooter({ text: `${BRAND.footer} • Use /configure-emoji set to change` });

      await interaction.reply({ embeds: [embed], ephemeral: true });
    }
  },
};
