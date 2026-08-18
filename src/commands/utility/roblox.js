'use strict';

/*
 * Copyright © 2026 FGx.
 * All rights reserved.
 */

const { SlashCommandBuilder } = require('discord.js');
const { BRAND } = require('../../config/constants');
const { guildConfigRepo } = require('../../database/repos/guildConfig');
const { robloxLinksRepo } = require('../../database/repos/roblox');
const robloxService = require('../../services/community/robloxService');
const rosterService = require('../../services/clan/rosterService');

/**
 * /roblox — Bloxlink-style Roblox verification.
 * verify: start a code-based link (code goes in the Roblox About section).
 * status: show the current link.  unlink: remove it (staff can remove any).
 * list:   staff overview of verified members (paginated).
 * panel:  staff panel message.
 */

const PAGE_SIZE = 10;

module.exports = {
  data: new SlashCommandBuilder()
    .setName('roblox')
    .setDescription('Bloxlink-style Roblox verification for FGx.')
    .addSubcommand((s) =>
      s
        .setName('verify')
        .setDescription('Link your Roblox account to Discord (code goes in your Roblox About)')
        .addStringOption((o) => o.setName('username').setDescription('Your Roblox username').setRequired(true)),
    )
    .addSubcommand((s) => s.setName('status').setDescription('Show your Roblox verification status'))
    .addSubcommand((s) =>
      s
        .setName('unlink')
        .setDescription('Unlink a Roblox account (your own, or anyone\'s as staff)')
        .addUserOption((o) => o.setName('user').setDescription('Member to unlink (staff only)').setRequired(false)),
    )
    .addSubcommand((s) =>
      s
        .setName('list')
        .setDescription('List verified Roblox members (staff)')
        .addIntegerOption((o) => o.setName('page').setDescription('Page number').setMinValue(1).setRequired(false)),
    )
    .addSubcommand((s) =>
      s
        .setName('leaderboard')
        .setDescription('First members to verify Roblox in this server')
        .addIntegerOption((o) => o.setName('page').setDescription('Page number').setMinValue(1).setRequired(false)),
    )
    .addSubcommand((s) => s.setName('panel').setDescription('Create the Roblox verification panel (staff)')),
  async execute(interaction) {
    const sub = interaction.options.getSubcommand();
    const config = guildConfigRepo.get(interaction.guild.id);

    if (sub === 'panel') {
      rosterService.requireStaff(interaction.member, config);
      await interaction.deferReply({ ephemeral: true });
      try {
        await robloxService.createPanel(interaction.guild);
        return interaction.editReply({
          embeds: [
            {
              color: BRAND.colors.success,
              title: 'Roblox panel ready',
              description: 'The **Verify with Roblox** panel is posted in the configured channel.',
              footer: { text: BRAND.footer },
            },
          ],
        });
      } catch (err) {
        return interaction.editReply({
          embeds: [
            {
              color: BRAND.colors.danger,
              title: 'Panel not created',
              description: err.message,
              footer: { text: BRAND.footer },
            },
          ],
        });
      }
    }

    if (sub === 'list') {
      rosterService.requireStaff(interaction.member, config);
      const page = Math.max(1, interaction.options.getInteger('page') ?? 1);
      const rows = robloxLinksRepo.listVerified(interaction.guild.id);
      const totalPages = Math.max(1, Math.ceil(rows.length / PAGE_SIZE));
      const slice = rows.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
      const lines = slice.map((r, i) => {
        const member = interaction.guild.members.cache.get(r.user_id);
        const who = member ? `**${member.user.username}**` : `<@${r.user_id}>`;
        return `${(page - 1) * PAGE_SIZE + i + 1}. ${who} — \`${r.roblox_username}\` (${r.verified_at ?? '—'})`;
      });
      const embed = {
        color: BRAND.colors.primary,
        title: '🟥 Verified Roblox Members',
        description:
          lines.length > 0 ? lines.join('\n') : 'No verified members yet — share the panel and run `/setup` to enable Roblox verification.',
        footer: { text: `${BRAND.footer} • Page ${page}/${totalPages} • ${rows.length} verified` },
      };
      return interaction.reply({ embeds: [embed], ephemeral: true });
    }

    if (sub === 'leaderboard') {
      const page = Math.max(1, interaction.options.getInteger('page') ?? 1);
      // Oldest verified first — the pioneers at the top.
      const rows = robloxLinksRepo.listVerified(interaction.guild.id).reverse();
      const totalPages = Math.max(1, Math.ceil(rows.length / PAGE_SIZE));
      const slice = rows.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
      const lines = slice.map((r, i) => {
        const rank = (page - 1) * PAGE_SIZE + i + 1;
        const member = interaction.guild.members.cache.get(r.user_id);
        const who = member ? `**${member.user.username}**` : `<@${r.user_id}>`;
        const pioneer = rank <= 50 ? '👑 ' : '';
        return `${pioneer}**#${rank}** ${who} — \`${r.roblox_username}\` (${r.verified_at ?? '—'})`;
      });
      const myRank = rows.findIndex((r) => r.user_id === interaction.user.id);
      const youLine =
        myRank !== -1
          ? `\n\n**Your rank:** #${myRank + 1} of ${rows.length} verified${myRank < 50 ? ' — 👑 Pioneer' : ''}`
          : '\n\nNot verified yet — run `/roblox verify` to claim a spot.';
      const embed = {
        color: BRAND.colors.primary,
        title: '🟥 Roblox Verification — First to Verify',
        description:
          (lines.length > 0 ? lines.join('\n') : 'No verified members yet.') +
          youLine,
        footer: {
          text: `${BRAND.footer} • 👑 = first 50 (Pioneers) • Page ${page}/${totalPages}`, 
        },
      };
      return interaction.reply({ embeds: [embed], ephemeral: true });
    }

    if (sub === 'status') {
      const link = robloxLinksRepo.get(interaction.guild.id, interaction.user.id);
      const role = robloxService.verifiedRole(interaction.guild, config);
      const embed = {
        color: BRAND.colors.primary,
        title: '🟥 Roblox Verification — Status',
        description: link
          ? link.status === 'verified'
            ? `**Linked:** ${link.roblox_username} (id \`${link.roblox_id}\`)\n**Verified:** ${link.verified_at ?? '—'}\n${role ? `**Role:** ${role.name}` : ''}`
            : '**Pending** — finish the code step from your verification message, then press **Check**.'
          : 'You are **not linked** yet. Run `/roblox verify <username>`.',
        footer: { text: BRAND.footer },
      };
      return interaction.reply({ embeds: [embed], ephemeral: true });
    }

    if (sub === 'unlink') {
      const target = interaction.options.getUser('user') ?? interaction.user;
      const isSelf = target.id === interaction.user.id;
      if (!isSelf) rosterService.requireStaff(interaction.member, config);
      const link = robloxLinksRepo.get(interaction.guild.id, target.id);
      if (!link) {
        return interaction.reply({
          embeds: [
            {
              color: BRAND.colors.warn,
              title: 'Nothing to unlink',
              description: isSelf ? 'You have no Roblox link in this server.' : `**${target.username}** has no Roblox link in this server.`,
              footer: { text: BRAND.footer },
            },
          ],
          ephemeral: true,
        });
      }
      await interaction.deferReply({ ephemeral: true });
      await robloxService.unlink(interaction.client, interaction.guild, target);
      return interaction.editReply({
        embeds: [
          {
            color: BRAND.colors.success,
            title: 'Unlinked',
            description: `**${link.roblox_username}** is no longer linked to ${isSelf ? 'your Discord account' : `**${target.username}**`}.`,
            footer: { text: BRAND.footer },
          },
        ],
      });
    }

    // sub === 'verify'
    const username = interaction.options.getString('username', true).trim();
    if (!/^[A-Za-z0-9_]{3,20}$/.test(username)) {
      return interaction.reply({
        embeds: [
          {
            color: BRAND.colors.danger,
            title: 'Invalid Roblox username',
            description: 'Usernames are 3–20 letters, numbers and underscores.',
            footer: { text: BRAND.footer },
          },
        ],
        ephemeral: true,
      });
    }
    if (!config.roblox.enabled) {
      return interaction.reply({
        embeds: [
          {
            color: BRAND.colors.danger,
            title: 'Roblox verification disabled',
            description: 'Staff can enable it with `/config roblox`.',
            footer: { text: BRAND.footer },
          },
        ],
        ephemeral: true,
      });
    }
    await interaction.deferReply({ ephemeral: true });
    try {
      const { link, resolved } = await robloxService.startVerification(interaction.guild, interaction.user, username);
      const ttl = config.roblox.codeTtlMinutes > 0 ? config.roblox.codeTtlMinutes : 15;
      const bt = '`';
      return interaction.editReply({
        embeds: [
          {
            color: BRAND.colors.primary,
            title: '🟥 Roblox Verification — Step 2',
            description:
              `Verified that **${resolved.displayName}** (id ${bt}${resolved.id}${bt}) exists.\n\n` +
              '**Put this code in your Roblox profile → About section:**\n' +
              `${bt}${bt}${bt}\n${link.code}\n${bt}${bt}${bt}\n\n` +
              `• Code expires in **${ttl} minutes**\n` +
              '• Press **Check** below once it is saved',
            footer: { text: `${BRAND.footer} • Bloxlink-style verification` },
          },
        ],
        components: [
          {
            type: 1,
            components: [
              {
                type: 2,
                style: 3,
                custom_id: 'roblox:check',
                label: '✅ I added it — Check now',
              },
            ],
          },
        ],
      });
    } catch (err) {
      if (err.code === 'DUPLICATE_ROBLOX' || err.code === 'ROBLOX_NOT_FOUND') {
        return interaction.editReply({
          embeds: [
            {
              color: BRAND.colors.danger,
              title: 'Verification blocked',
              description: err.message,
              footer: { text: BRAND.footer },
            },
          ],
        });
      }
      throw err;
    }
  },
};
