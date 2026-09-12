'use strict';

/* Copyright © 2026 FGx. All rights reserved. */

const { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder } = require('discord.js');
const { BRAND } = require('../../config/constants');

// In-memory mute store: { guildId/userId: { until: timestamp, message: string } }
const activeMutes = new Map();

module.exports = {
  data: new SlashCommandBuilder()
    .setName('mute')
    .setDescription('Mute a user — they cannot send messages until unmuted or time expires')
    .addUserOption((o) =>
      o.setName('user').setDescription('Who to mute').setRequired(true),
    )
    .addIntegerOption((o) =>
      o
        .setName('minutes')
        .setDescription('How many minutes to mute (0 = indefinite, until staff unmutes)')
        .setRequired(false)
        .setMinValue(0)
        .setMaxValue(1440),
    )
    .addStringOption((o) =>
      o.setName('reason').setDescription('Why are you muting them?').setRequired(false),
    ),

  async execute(interaction) {
    const target = interaction.options.getUser('user', true);
    const minutes = interaction.options.getInteger('minutes') ?? 10;
    const reason = interaction.options.getString('reason') ?? 'No reason given';

    if (!interaction.guild) {
      return interaction.reply({
        content: 'This command only works in a server.',
        ephemeral: true,
      });
    }

    const actor = interaction.member;
    const canManage =
      actor.permissions.has(PermissionFlagsBits.MuteMembers) ||
      actor.permissions.has(PermissionFlagsBits.Administrator) ||
      actor.id === interaction.guild.ownerId;

    if (!canManage) {
      return interaction.reply({
        embeds: [
          new EmbedBuilder()
            .setColor(0xed4245)
            .setTitle('🚫 Not Allowed')
            .setDescription(
              'Only staff with **Mute Members** permission, **Administrators**, or the **server owner** can use this.',
            )
            .setFooter({ text: BRAND.footer }),
        ],
        ephemeral: true,
      });
    }

    // Can't mute bot, can't mute self if not admin
    if (target.bot) {
      return interaction.reply({
        embeds: [
          new EmbedBuilder()
            .setColor(0xed4245)
            .setTitle('🚫 Cannot Mute Bot')
            .setDescription('You cannot mute other bots.')
            .setFooter({ text: BRAND.footer }),
        ],
        ephemeral: true,
      });
    }

    const guild = interaction.guild;
    const member = guild.members.cache.get(target.id) ?? await guild.members.fetch(target.id).catch(() => null);
    if (!member) {
      return interaction.reply({
        embeds: [
          new EmbedBuilder()
            .setColor(0xed4245)
            .setTitle('🚫 User Not Found')
            .setDescription('I couldn\'t find that user in the server.')
            .setFooter({ text: BRAND.footer }),
        ],
        ephemeral: true,
      });
    }

    const untilMs = minutes > 0 ? Date.now() + minutes * 60_000 : null;
    const untilStr = untilMs
      ? `<t:${Math.floor(untilMs / 1000)}:R>`
      : 'until staff unmutes them';

    try {
      await member.timeout(untilMs ?? null, reason);
    } catch (err) {
      if (err.code === 50013) {
        return interaction.reply({
          embeds: [
            new EmbedBuilder()
              .setColor(0xed4245)
              .setTitle('🚫 No Permission')
              .setDescription(
                'I don\'t have permission to mute that user — check my role position vs theirs.',
              )
              .setFooter({ text: BRAND.footer }),
          ],
          ephemeral: true,
        });
      }
      throw err;
    }

    // Store for /unmute + auto-expire
    activeMutes.set(`${guild.id}:${target.id}`, { until: untilMs, reason, by: interaction.user.id });

    if (untilMs) {
      // Clear the stored mute when it expires
      setTimeout(() => {
        activeMutes.delete(`${guild.id}:${target.id}`);
      }, untilMs - Date.now());
    }

    const embed = new EmbedBuilder()
      .setColor(0xED4245)
      .setTitle('🔇 User Muted')
      .setDescription(
        `**${target.tag}** has been muted for **${minutes === 0 ? 'indefinitely' : `${minutes} minute${minutes === 1 ? '' : 's'}`}**.\n\n` +
          `> **Reason:** ${reason}\n` +
          `> **Expires:** ${untilStr}`,
      )
      .addFields(
        { name: '👤 User', value: `<@${target.id}>`, inline: true },
        { name: '👤 Muted by', value: `<@${interaction.user.id}>`, inline: true },
      )
      .setThumbnail(target.displayAvatarURL({ size: 128 }))
      .setFooter({ text: BRAND.footer })
      .setTimestamp();

    await interaction.reply({ embeds: [embed] });
  },
};
