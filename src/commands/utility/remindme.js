'use strict';

/* Copyright © 2026 FGx. All rights reserved. */

const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { BRAND } = require('../../config/constants');

/** Active reminders per user: Map<userId, NodeJS.Timeout[]> */
const activeReminders = new Map();

module.exports = {
  data: new SlashCommandBuilder()
    .setName('remindme')
    .setDescription('Set a reminder — the bot will DM you when it\'s time!')
    .addStringOption((o) =>
      o.setName('time').setDescription('When to remind you (e.g. 30m, 2h, 1d)').setRequired(true),
    )
    .addStringOption((o) =>
      o.setName('message').setDescription('What to remind you about').setRequired(true),
    ),

  async execute(interaction) {
    const timeStr = interaction.options.getString('time').trim();
    const message = interaction.options.getString('message').trim();

    // Parse time string: 30m, 2h, 1d, 45s
    const match = timeStr.match(/^(\d+)\s*(s|m|h|d)$/i);
    if (!match) {
      return interaction.reply({
        content: '❌ Invalid time format. Use: `30m`, `2h`, `1d`, `45s`',
        ephemeral: true,
      });
    }

    const amount = parseInt(match[1], 10);
    const unit = match[2].toLowerCase();
    const multipliers = { s: 1000, m: 60_000, h: 3_600_000, d: 86_400_000 };
    const ms = amount * multipliers[unit];
    const unitLabels = { s: 'second', m: 'minute', h: 'hour', d: 'day' };
    const unitLabel = amount === 1 ? unitLabels[unit] : `${unitLabels[unit]}s`;

    // Max 7 days
    if (ms > 7 * 86_400_000) {
      return interaction.reply({
        content: '❌ Maximum reminder time is 7 days.',
        ephemeral: true,
      });
    }

    // Min 10 seconds
    if (ms < 10_000) {
      return interaction.reply({
        content: '❌ Minimum reminder time is 10 seconds.',
        ephemeral: true,
      });
    }

    const endsAt = Date.now() + ms;

    const embed = new EmbedBuilder()
      .setColor(BRAND.colors.success)
      .setTitle('⏰ Reminder Set!')
      .setDescription(
        `I'll DM you in **${amount} ${unitLabel}** with:\n\n> ${message}`,
      )
      .addFields({
        name: '⏱️ Expires',
        value: `<t:${Math.floor(endsAt / 1000)}:R> (<t:${Math.floor(endsAt / 1000)}:f>)`,
        inline: true,
      })
      .setFooter({ text: BRAND.footer })
      .setTimestamp(new Date());

    await interaction.reply({ embeds: [embed], ephemeral: true });

    // Set the timeout
    const timer = setTimeout(async () => {
      try {
        const dm = await interaction.user.createDM();
        const reminderEmbed = new EmbedBuilder()
          .setColor(BRAND.colors.warn)
          .setTitle('⏰ Reminder!')
          .setDescription(`**You asked me to remind you:**\n\n> ${message}`)
          .setFooter({ text: `Set ${amount} ${unitLabel} ago • ${BRAND.footer}` })
          .setTimestamp(new Date());

        await dm.send({ embeds: [reminderEmbed] }).catch(() => {
          // DMs disabled — try to message in the channel
          interaction.channel?.send({
            content: `${interaction.user}, here's your reminder: ${message}`,
          }).catch(() => {});
        });
      } catch {
        // User DMs are blocked
      }
      // Clean up
      const timers = activeReminders.get(interaction.user.id) || [];
      const idx = timers.indexOf(timer);
      if (idx !== -1) timers.splice(idx, 1);
      if (timers.length === 0) activeReminders.delete(interaction.user.id);
    }, ms);

    if (!activeReminders.has(interaction.user.id)) {
      activeReminders.set(interaction.user.id, []);
    }
    activeReminders.get(interaction.user.id).push(timer);
  },
};
