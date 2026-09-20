'use strict';

/* Copyright © 2026 FGx. All rights reserved. */

const { SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits } = require('discord.js');
const { BRAND } = require('../../config/constants');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('dm')
    .setDescription('Send a DM to members')
    .addSubcommand(sub =>
      sub
        .setName('all')
        .setDescription('DM all members in this server')
        .addStringOption(o =>
          o.setName('message').setDescription('Message to send').setRequired(true).setMaxLength(2000),
        ),
    )
    .addSubcommand(sub =>
      sub
        .setName('user')
        .setDescription('DM a specific user')
        .addUserOption(o => o.setName('target').setDescription('Who to DM').setRequired(true))
        .addStringOption(o =>
          o.setName('message').setDescription('Message to send').setRequired(true).setMaxLength(2000),
        ),
    ),

  async execute(interaction) {
    // Only admins / manage messages can use this
    const isAdmin =
      interaction.member.permissions.has(PermissionFlagsBits.Administrator) ||
      interaction.member.permissions.has(PermissionFlagsBits.ManageMessages);

    if (!isAdmin) {
      return interaction.reply({
        embeds: [
          new EmbedBuilder()
            .setColor(0xed4245)
            .setTitle('Not Allowed')
            .setDescription('You need **Administrator** or **Manage Messages** permission.')
            .setFooter({ text: BRAND.footer }),
        ],
        ephemeral: true,
      });
    }

    const sub = interaction.options.getSubcommand();

    if (sub === 'all') {
      const message = interaction.options.getString('message', true);
      await interaction.deferReply({ ephemeral: true });

      const guild = interaction.guild;
      if (!guild) {
        return interaction.editReply({ content: 'Server only.' });
      }

      // Fetch all members
      let allMembers;
      try {
        allMembers = await guild.members.fetch();
      } catch {
        return interaction.editReply({ content: 'Could not fetch member list. Missing permissions?' });
      }

      // Filter: real humans, not bots, and reachable via DM
      const targets = allMembers.filter(m => !m.user.bot);
      let sent = 0;
      let failed = 0;
      let blocked = 0;

      const embed = new EmbedBuilder()
        .setColor(BRAND.colors.primary)
        .setTitle('DM broadcast started')
        .setDescription('Sending to **' + targets.size + '** members...')
        .setFooter({ text: BRAND.footer });

      await interaction.editReply({ embeds: [embed] });

      for (const [, member] of targets) {
        try {
          await member.send(message);
          sent++;
        } catch (err) {
          if (err.code === 50007) blocked++; // Cannot send to this user
          else failed++;
        }
        // Small delay to avoid rate limits
        if (sent % 10 === 0) await new Promise(r => setTimeout(r, 1000));
      }

      const result = new EmbedBuilder()
        .setColor(BRAND.colors.success)
        .setTitle('DM Broadcast Complete')
        .setDescription(
          '**Sent:** ' + sent + '\n' +
          '**Blocked (DMs off):** ' + blocked + '\n' +
          '**Failed:** ' + failed + '\n' +
          '**Total targets:** ' + targets.size,
        )
        .setFooter({ text: BRAND.footer })
        .setTimestamp();

      await interaction.editReply({ embeds: [result] });
    }

    if (sub === 'user') {
      const target = interaction.options.getUser('target', true);
      const message = interaction.options.getString('message', true);

      try {
        await target.send(message);
        const embed = new EmbedBuilder()
          .setColor(BRAND.colors.success)
          .setTitle('DM Sent')
          .setDescription('Sent a DM to **' + target.tag + '**')
          .setFooter({ text: BRAND.footer });

        await interaction.reply({ embeds: [embed], ephemeral: true });
      } catch (err) {
        const reason = err.code === 50007 ? 'Their DMs are closed.' : (err.message || 'Failed to send.');
        await interaction.reply({
          embeds: [
            new EmbedBuilder()
              .setColor(0xed4245)
              .setTitle('DM Failed')
              .setDescription('Could not DM **' + target.tag + '**: ' + reason)
              .setFooter({ text: BRAND.footer }),
          ],
          ephemeral: true,
        });
      }
    }
  },
};
