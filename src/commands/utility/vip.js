'use strict';

/*
 * Copyright © 2026 FGx.
 * All rights reserved.
 */

const { SlashCommandBuilder } = require('discord.js');
const { BRAND } = require('../../config/constants');
const { vipPanelEmbed, vipDailyEmbed } = require('../../services/community/vipViews');
const economy = require('../../services/community/economyService');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('vip')
    .setDescription('👑 VIP — locked perks for fully verified members (link + Roblox).')
    .addSubcommand((sub) => sub.setName('status').setDescription('Check VIP status and how to unlock it.'))
    .addSubcommand((sub) =>
      sub
        .setName('daily')
        .setDescription('Claim the VIP daily bonus (250 ₣Ԡ🇽) — requires full verification.'),
    )
    .addSubcommand((sub) =>
      sub
        .setName('check')
        .setDescription('Check another member\'s VIP status.')
        .addUserOption((o) => o.setName('user').setDescription('Who to check').setRequired(true)),
    ),
  async execute(interaction) {
    const sub = interaction.options.getSubcommand();

    if (sub === 'status') {
      await interaction.reply({ embeds: [vipPanelEmbed(interaction.user.id, interaction.guildId, interaction.user.username)] });
      return;
    }

    if (sub === 'check') {
      const target = interaction.options.getUser('user');
      await interaction.reply({ embeds: [vipPanelEmbed(target.id, interaction.guildId, target.username)] });
      return;
    }

    // daily
    try {
      const result = await economy.vipDaily(interaction.guildId, interaction.user.id);
      await interaction.reply({ embeds: [vipDailyEmbed(result)] });
    } catch (err) {
      const embed =
        err.code === 'VIP_LOCKED'
          ? vipPanelEmbed(interaction.user.id, interaction.guildId, interaction.user.username)
          : {
              color: BRAND.colors.warning,
              title: '👑 VIP Daily',
              description: err.message,
              footer: { text: BRAND.footer },
            };
      await interaction.reply({ embeds: [embed] });
    }
  },
};
