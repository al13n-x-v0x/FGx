'use strict';

/*
 * Copyright © 2026 FGx.
 * All rights reserved.
 */

const { SlashCommandBuilder } = require('discord.js');
const { BRAND } = require('../../config/constants');
const { guildConfigRepo } = require('../../database/repos/guildConfig');
const { privateServersRepo } = require('../../database/repos/privateServers');
const privateServerService = require('../../services/clan/privateServerService');
const rosterService = require('../../services/clan/rosterService');

/**
 * /private — temporary branded Discord servers for BloxStrike matches.
 * create: 1v1–6v6 or practice; requires Roblox verification (staff bypass).
 * info:   active servers + invites.  end:   delete a server.
 */

const MODE_CHOICES = Object.keys(privateServerService.MODES).map((m) => ({
  name: privateServerService.MODES[m].label,
  value: m,
}));

module.exports = {
  data: new SlashCommandBuilder()
    .setName('private')
    .setDescription('Temporary private server for BloxStrike matches (1v1–6v6).')
    .addSubcommand((s) =>
      s
        .setName('create')
        .setDescription('Create a private server for a match (requires Roblox verification)')
        .addStringOption((o) =>
          o.setName('mode').setDescription('Match mode').setRequired(true).addChoices(...MODE_CHOICES),
        )
        .addIntegerOption((o) =>
          o.setName('hours').setDescription('Hours before auto-delete (1–24, default 3)').setMinValue(1).setMaxValue(24),
        ),
    )
    .addSubcommand((s) => s.setName('info').setDescription('Show active private servers and invites'))
    .addSubcommand((s) =>
      s
        .setName('end')
        .setDescription('Delete a private server (staff, or the owner)')
        .addIntegerOption((o) => o.setName('id').setDescription('Private server ID from /private info').setRequired(false)),
    ),
  async execute(interaction) {
    const sub = interaction.options.getSubcommand();
    const config = guildConfigRepo.get(interaction.guild.id);

    if (sub === 'info') {
      const rows = privateServersRepo.listActive(interaction.guild.id);
      const embed = {
        color: BRAND.colors.primary,
        title: '🎮 FGx Private Servers',
        description:
          rows.length > 0
            ? rows
                .map(
                  (r) =>
                    `**#${r.id}** — ${privateServerService.MODES[r.mode]?.label ?? r.mode} • ` +
                    `invite: https://discord.gg/${r.invite_code ?? '—'} • expires ${r.expires_at ?? '—'}`,
                )
                .join('\n')
            : 'No active private servers. Create one with `/private create <mode>`.',
        footer: { text: `${BRAND.footer} • Auto-deletes on expiry` },
      };
      return interaction.reply({ embeds: [embed], ephemeral: true });
    }

    if (sub === 'end') {
      const id = interaction.options.getInteger('id');
      let isStaff = false;
      try {
        rosterService.requireStaff(interaction.member, config);
        isStaff = true;
      } catch {
        isStaff = false;
      }
      let record = null;
      if (id) {
        record = privateServersRepo.getById(id);
        if (!record || record.guild_id !== interaction.guild.id) {
          return interaction.reply({
            embeds: [
              {
                color: BRAND.colors.warn,
                title: 'Not found',
                description: `No active private server with ID **${id}** in this server. Use \`/private info\`.`,
                footer: { text: BRAND.footer },
              },
            ],
            ephemeral: true,
          });
        }
      } else {
        const mine = privateServersRepo.listActive(interaction.guild.id).find((r) => r.owner_id === interaction.user.id);
        record = mine ?? null;
        if (!record) {
          return interaction.reply({
            embeds: [
              {
                color: BRAND.colors.warn,
                title: 'Nothing to end',
                description: 'You have no active private server. Staff can pass an ID from `/private info`.',
                footer: { text: BRAND.footer },
              },
            ],
            ephemeral: true,
          });
        }
      }
      if (record.owner_id !== interaction.user.id && !isStaff) {
        return interaction.reply({
          embeds: [
            {
              color: BRAND.colors.danger,
              title: 'Not yours to end',
              description: 'Only the owner or clan staff can end that private server.',
              footer: { text: BRAND.footer },
            },
          ],
          ephemeral: true,
        });
      }

      await interaction.deferReply({ ephemeral: true });
      await privateServerService.end(interaction.client, record.server_id);
      return interaction.editReply({
        embeds: [
          {
            color: BRAND.colors.success,
            title: 'Private server ended',
            description: `**#${record.id}** (${privateServerService.MODES[record.mode]?.label ?? record.mode}) deleted.`,
            footer: { text: BRAND.footer },
          },
        ],
      });
    }

    // sub === 'create'
    const mode = interaction.options.getString('mode', true);
    const hours = interaction.options.getInteger('hours') ?? privateServerService.DEFAULT_HOURS;

    await interaction.deferReply({ ephemeral: true });
    try {
      const { server, invite, info } = await privateServerService.create(
        interaction.client,
        interaction.guild,
        interaction.user,
        mode,
        hours,
        { member: interaction.member, config },
      );
      const embed = {
        color: BRAND.colors.success,
        title: `🎮 FGx ${info.label} private server ready`,
        description:
          `**${server.name}** is live for **${hours}h**.\\n\\n` +
          `**Invite:** https://discord.gg/${invite.code}\\n` +
          `**Channels:** match-chat, results, Main, Team 1${info.teams > 1 ? ', Team 2' : ''}\\n\\n` +
          'Share the invite with your opponents. The server **auto-deletes** when the timer expires — ' +
          'results can still be recorded back here with `/match` or `/clanwar result`.',
        footer: { text: `${BRAND.footer} • Roblox-verified members only` },
      };
      return interaction.editReply({ embeds: [embed] });
    } catch (err) {
      if (['INVALID_MODE', 'GUILD_LIMIT', 'OWNER_LIMIT', 'ROBLOX_REQUIRED'].includes(err.code)) {
        return interaction.editReply({
          embeds: [{ color: BRAND.colors.warn, title: 'Private server not created', description: err.message, footer: { text: BRAND.footer } }],
        });
      }
      return interaction.editReply({
        embeds: [
          {
            color: BRAND.colors.danger,
            title: 'Private server creation failed',
            description: `Discord API error: ${err.message}`,
            footer: { text: BRAND.footer },
          },
        ],
      });
    }
  },
};
