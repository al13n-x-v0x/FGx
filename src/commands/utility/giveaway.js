'use strict';

/* Copyright © 2026 FGx. All rights reserved. */

const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const giveawayService = require('../../services/community/giveawayService');
const { BRAND } = require('../../config/constants');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('giveaway')
    .setDescription('Create and manage giveaways')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .addSubcommand(sub =>
      sub.setName('create')
        .setDescription('Start a new giveaway')
        .addStringOption(opt =>
          opt.setName('prize').setDescription('What are you giving away?').setRequired(true))
        .addStringOption(opt =>
          opt.setName('duration')
            .setDescription('How long?')
            .setRequired(true)
            .addChoices(
              { name: '30 seconds', value: '30s' },
              { name: '1 minute', value: '1m' },
              { name: '5 minutes', value: '5m' },
              { name: '10 minutes', value: '10m' },
              { name: '30 minutes', value: '30m' },
              { name: '1 hour', value: '1h' },
              { name: '6 hours', value: '6h' },
              { name: '12 hours', value: '12h' },
              { name: '1 day', value: '1d' },
              { name: '3 days', value: '3d' },
              { name: '7 days', value: '7d' },
            ))
        .addIntegerOption(opt =>
          opt.setName('winners').setDescription('Number of winners').setMinValue(1).setMaxValue(20))
        .addChannelOption(opt =>
          opt.setName('channel').setDescription('Channel to post in'))
        .addStringOption(opt =>
          opt.setName('description').setDescription('Extra description'))
    )
    .addSubcommand(sub =>
      sub.setName('end')
        .setDescription('End a giveaway early')
        .addStringOption(opt =>
          opt.setName('message_id').setDescription('Giveaway message ID').setRequired(true))
    )
    .addSubcommand(sub =>
      sub.setName('reroll')
        .setDescription('Pick a new winner from a finished giveaway')
        .addStringOption(opt =>
          opt.setName('message_id').setDescription('Giveaway message ID').setRequired(true))
    ),

  async execute(interaction) {
    const sub = interaction.options.getSubcommand();

    if (sub === 'create') {
      const prize = interaction.options.getString('prize');
      const durationStr = interaction.options.getString('duration');
      const winners = interaction.options.getInteger('winners') ?? 1;
      const channel = interaction.options.getChannel('channel') ?? interaction.channel;
      const description = interaction.options.getString('description') ?? '';

      try {
        const data = giveawayService.create({
          prize,
          durationStr,
          winners,
          host: interaction.member,
          channel,
          description,
        });

        const msg = await channel.send({
          embeds: [data.embed],
          components: [data.row],
        });

        giveawayService.store(msg.id, data);

        await interaction.reply({
          content: `✅ Giveaway started in ${channel}! Ends in **${durationStr}**.`,
          ephemeral: true,
        });
      } catch (err) {
        await interaction.reply({ content: `❌ ${err.message}`, ephemeral: true });
      }

    } else if (sub === 'end') {
      const messageId = interaction.options.getString('message_id');
      const result = await giveawayService.end(messageId, interaction.client);
      if (!result) {
        return interaction.reply({ content: '❌ Giveaway not found or already ended.', ephemeral: true });
      }
      await interaction.reply({
        content: `✅ Giveaway ended! Winner(s): ${result.winners}`,
        ephemeral: true,
      });

    } else if (sub === 'reroll') {
      const messageId = interaction.options.getString('message_id');
      const result = await giveawayService.reroll(messageId, interaction.client);
      if (!result) {
        return interaction.reply({ content: '❌ Giveaway not found or no entries.', ephemeral: true });
      }
      await interaction.reply({
        content: `🔀 New winner: <@${result.winnerId}>! You won **${result.prize}**!`,
      });
    }
  },
};
