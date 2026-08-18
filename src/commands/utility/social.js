'use strict';

/*
 * Copyright © 2026 FGx.
 * All rights reserved.
 */

const { SlashCommandBuilder } = require('discord.js');
const { socialService } = require('../../services/community/socialService');
const socialViews = require('../../services/community/socialViews');

// Subcommands are generated from the kind list so adding a new
// interaction in socialService automatically gets a slash command.
const builder = new SlashCommandBuilder()
  .setName('social')
  .setDescription('Social interactions — slap, clap, hug, boop, and more!');

for (const kind of socialService.KINDS) {
  builder.addSubcommand((sub) =>
    sub
      .setName(kind)
      .setDescription(`Give someone a ${kind}.`)
      .addUserOption((o) => o.setName('user').setDescription(`Who to ${kind}`).setRequired(true)),
  );
}

builder
  .addSubcommand((sub) =>
    sub
      .setName('stats')
      .setDescription('View interaction stats.')
      .addUserOption((o) => o.setName('user').setDescription('Whose stats (default: you)').setRequired(false)),
  )
  .addSubcommand((sub) =>
    sub
      .setName('top')
      .setDescription('Who leads an interaction.')
      .addStringOption((o) =>
        o
          .setName('kind')
          .setDescription('Interaction to rank (default: slap)')
          .addChoices(...socialService.KINDS.map((k) => ({ name: k, value: k }))),
      ),
  );

module.exports = {
  data: builder,
  async execute(interaction) {
    const sub = interaction.options.getSubcommand();

    if (sub === 'stats') {
      const target = interaction.options.getUser('user') ?? interaction.user;
      const s = socialService.stats(interaction.guildId, target.id);
      await interaction.reply({ embeds: [socialViews.statsEmbed(target.username, s)] });
      return;
    }

    if (sub === 'top') {
      const kind = interaction.options.getString('kind') ?? 'slap';
      const rows = socialService.top(interaction.guildId, kind, 5);
      await interaction.reply({ embeds: [socialViews.topEmbed(kind, rows)] });
      return;
    }

    const target = interaction.options.getUser('user');
    const result = socialService.interact(
      interaction.guildId,
      interaction.user.id,
      target.id,
      sub,
      target.username,
      interaction.user.username,
    );
    await interaction.reply({ embeds: [socialViews.interactionEmbed(result, target.username)] });
  },
};
