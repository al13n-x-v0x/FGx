'use strict';

/*
 * Copyright © 2026 FGx.
 * All rights reserved.
 */

const { SlashCommandBuilder } = require('discord.js');
const { socialService } = require('../../services/community/socialService');
const socialViews = require('../../services/community/socialViews');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('social')
    .setDescription('Social interactions — slap, pat, hug, kiss, tickle, poke.')
    .addSubcommand((sub) =>
      sub
        .setName('slap')
        .setDescription('Slap someone (counts grow with every slap!).')
        .addUserOption((o) => o.setName('user').setDescription('Who to slap').setRequired(true)),
    )
    .addSubcommand((sub) =>
      sub
        .setName('pat')
        .setDescription('Pat someone on the head.')
        .addUserOption((o) => o.setName('user').setDescription('Who to pat').setRequired(true)),
    )
    .addSubcommand((sub) =>
      sub
        .setName('hug')
        .setDescription('Give someone a warm hug.')
        .addUserOption((o) => o.setName('user').setDescription('Who to hug').setRequired(true)),
    )
    .addSubcommand((sub) =>
      sub
        .setName('kiss')
        .setDescription('Plant a kiss on someone.')
        .addUserOption((o) => o.setName('user').setDescription('Who to kiss').setRequired(true)),
    )
    .addSubcommand((sub) =>
      sub
        .setName('tickle')
        .setDescription('Tickle someone mercilessly.')
        .addUserOption((o) => o.setName('user').setDescription('Who to tickle').setRequired(true)),
    )
    .addSubcommand((sub) =>
      sub
        .setName('poke')
        .setDescription('Poke someone.')
        .addUserOption((o) => o.setName('user').setDescription('Who to poke').setRequired(true)),
    )
    .addSubcommand((sub) =>
      sub
        .setName('stats')
        .setDescription('View interaction stats.')
        .addUserOption((o) => o.setName('user').setDescription('Whose stats (default: you)').setRequired(false)),
    ),
  async execute(interaction) {
    const sub = interaction.options.getSubcommand();
    if (sub === 'stats') {
      const target = interaction.options.getUser('user') ?? interaction.user;
      const s = socialService.stats(interaction.guildId, target.id);
      await interaction.reply({ embeds: [socialViews.statsEmbed(target.username, s)] });
      return;
    }
    const target = interaction.options.getUser('user');
    const result = socialService.interact(interaction.guildId, interaction.user.id, target.id, sub, target.username);
    await interaction.reply({ embeds: [socialViews.interactionEmbed(result, target.username)] });
  },
};
