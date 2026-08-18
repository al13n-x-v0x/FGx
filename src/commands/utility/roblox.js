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
 * status: show the current link.  unlink: remove it.  panel: staff panel.
 */

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
    .addSubcommand((s) => s.setName('unlink').setDescription('Unlink your Roblox account from this server'))
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

    if (sub === 'status') {
      const link = robloxLinksRepo.get(interaction.guild.id, interaction.user.id);
      const role = robloxService.verifiedRole(interaction.guild, config);
      const embed = {
        color: BRAND.colors.primary,
        title: '🟥 Roblox Verification — Status',
        description: link
          ? link.status === 'verified'
            ? `**Linked:** ${link.roblox_username} (id \`${link.roblox_id}\`)\n**Verified:** ${link.verified_at ?? '—'}\n${role ? `**Role:** ${role.name}` : ''}`
            : `**Pending** — finish the code step from your verification message, then press **Check**.`
          : 'You are **not linked** yet. Run `/roblox verify <username>`.',
        footer: { text: BRAND.footer },
      };
      return interaction.reply({ embeds: [embed], ephemeral: true });
    }

    if (sub === 'unlink') {
      const link = robloxLinksRepo.get(interaction.guild.id, interaction.user.id);
      if (!link) {
        return interaction.reply({
          embeds: [
            {
              color: BRAND.colors.warn,
              title: 'Nothing to unlink',
              description: 'You have no Roblox link in this server.',
              footer: { text: BRAND.footer },
            },
          ],
          ephemeral: true,
        });
      }
      await interaction.deferReply({ ephemeral: true });
      await robloxService.unlink(interaction.client, interaction.guild, interaction.user);
      return interaction.editReply({
        embeds: [
          {
            color: BRAND.colors.success,
            title: 'Unlinked',
            description: `**${link.roblox_username}** is no longer linked to your Discord account.`,
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
      return interaction.editReply({
        embeds: [
          {
            color: BRAND.colors.primary,
            title: '🟥 Roblox Verification — Step 2',
            description:
              `Verified that **${resolved.displayName}** (id \`${resolved.id}\`) exists.\n\n` +
              '**Put this code in your Roblox profile → About section:**\n' +
              `\`\`\`\n${link.code}\n\`\`\`\n\n` +
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
