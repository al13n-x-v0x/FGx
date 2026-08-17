'use strict';

/*
 * Copyright © 2026 FGx.
 * All rights reserved.
 */

const { SlashCommandBuilder } = require('discord.js');
const { linksRepo, profilesRepo } = require('../../database/repos/profiles');
const { bloxstrikeUsername } = require('../../utils/validate');
const { logAudit } = require('../../services/logging/auditLogger');
const rosterService = require('../../services/clan/rosterService');
const { guildConfigRepo } = require('../../database/repos/guildConfig');
const { BRAND } = require('../../config/constants');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('link')
    .setDescription('Link your BloxStrike username to your FGx Discord account.')
    .addSubcommand((s) =>
      s
        .setName('submit')
        .setDescription('Link your BloxStrike username (pending staff verification)')
        .addStringOption((o) => o.setName('username').setDescription('Your BloxStrike username').setRequired(true)),
    )
    .addSubcommand((s) =>
      s
        .setName('verify')
        .setDescription('Verify a member\'s BloxStrike link (staff)')
        .addUserOption((o) => o.setName('user').setDescription('Member to verify').setRequired(true)),
    )
    .addSubcommand((s) => s.setName('list').setDescription('List pending link verifications (staff)')),
  async execute(interaction) {
    const sub = interaction.options.getSubcommand();
    const config = guildConfigRepo.get(interaction.guild.id);

    if (sub === 'submit') {
      const username = bloxstrikeUsername(interaction.options.getString('username', true));
      const existing = linksRepo.get(interaction.guild.id, interaction.user.id);
      try {
        const link = linksRepo.create(interaction.guild.id, interaction.user.id, username);
        profilesRepo.updateStats(interaction.guild.id, interaction.user.id, {
          blox_username: username,
          meta: { linked_at: new Date().toISOString() },
        });
        await logAudit(interaction.client, interaction.guild, {
          action: 'roster',
          target: interaction.user,
          moderator: null,
          reason: `Linked BloxStrike username ${username}`,
          details: { status: link.status },
        });
        await interaction.reply({
          embeds: [
            {
              color: BRAND.colors.success,
              title: 'BloxStrike link submitted',
              description:
                existing
                  ? `Your link was updated to **${username}** and reset to **pending**. Staff will re-verify it.`
                  : `**${username}** is now linked to your account and **pending staff verification**.`,
            },
          ],
        });
      } catch (err) {
        if (err.code === 'DUPLICATE_USERNAME' || err.code === 'DUPLICATE_USER') {
          return interaction.reply({
            embeds: [{ color: BRAND.colors.danger, title: 'Link rejected', description: err.message }],
          });
        }
        throw err;
      }
      return;
    }

    // Staff-only subcommands.
    rosterService.requireStaff(interaction.member, config);

    if (sub === 'verify') {
      const target = interaction.options.getUser('user', true);
      const link = linksRepo.get(interaction.guild.id, target.id);
      if (!link) {
        return interaction.reply({
          embeds: [
            {
              color: BRAND.colors.danger,
              title: 'No link found',
              description: `<@${target.id}> has no BloxStrike link submission in this server.`,
            },
          ],
        });
      }
      linksRepo.setStatus(interaction.guild.id, target.id, 'verified');
      profilesRepo.updateStats(interaction.guild.id, target.id, { blox_username: link.blox_username });
      await logAudit(interaction.client, interaction.guild, {
        action: 'roster',
        target,
        moderator: interaction.user,
        reason: `Verified BloxStrike link ${link.blox_username}`,
        details: { status: 'verified' },
      });
      await target
        .send({
          embeds: [
            {
              color: BRAND.colors.success,
              title: '✅ BloxStrike link verified',
              description: `**${interaction.guild.name}** — your BloxStrike link **${link.blox_username}** has been **verified** by staff.`,
              footer: { text: BRAND.footer },
            },
          ],
        })
        .catch(() => {});
      return interaction.reply({
        embeds: [
          {
            color: BRAND.colors.success,
            title: 'Link verified',
            description: `<@${target.id}> → **${link.blox_username}** is now **verified**. They have been notified by DM.`,
          },
        ],
      });
    }

    // sub === 'list'
    const pending = linksRepo.listPending ? linksRepo.listPending(interaction.guild.id) : [];
    const rows = pending.length > 0
      ? pending.map((l) => `<@${l.user_id}> — **${l.blox_username}** — use \`/link verify @user\``).join('\n')
      : 'No pending verifications. Members submit with `/link submit <username>`.';
    return interaction.reply({
      embeds: [
        {
          color: BRAND.colors.primary,
          title: `Pending link verifications (${pending.length})`,
          description: rows,
        },
      ],
    });
  },
};
