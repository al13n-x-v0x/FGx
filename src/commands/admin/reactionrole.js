'use strict';

/* Copyright © 2026 FGx. All rights reserved. */

const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, StringSelectMenuBuilder, PermissionFlagsBits, ChannelType } = require('discord.js');
const { BRAND } = require('../../config/constants');
const { logger } = require('../../utils/logger');

/** Active reaction-role messages (in-memory, resets on restart). */
const activePanels = new Map();

module.exports = {
  data: new SlashCommandBuilder()
    .setName('reactionrole')
    .setDescription('Set up reaction roles — users pick roles from a menu')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageRoles)
    .addSubcommand(sub =>
      sub.setName('create')
        .setDescription('Create a reaction role panel')
        .addStringOption(opt =>
          opt.setName('title').setDescription('Panel title').setRequired(true))
        .addStringOption(opt =>
          opt.setName('description').setDescription('Panel description').setRequired(true))
        .addChannelOption(opt =>
          opt.setName('channel').setDescription('Channel to send panel in')
            .addChannelTypes(ChannelType.GuildText))
    )
    .addSubcommand(sub =>
      sub.setName('add')
        .setDescription('Add a role to the most recent panel in this channel')
        .addRoleOption(opt =>
          opt.setName('role').setDescription('Role to add').setRequired(true))
        .addStringOption(opt =>
          opt.setName('emoji').setDescription('Emoji for this role').setRequired(true))
        .addStringOption(opt =>
          opt.setName('label').setDescription('Display label (default: role name)'))
    )
    .addSubcommand(sub =>
      sub.setName('delete')
        .setDescription('Delete a reaction role panel')
        .addStringOption(opt =>
          opt.setName('message_id').setDescription('Panel message ID').setRequired(true))
    ),

  async execute(interaction) {
    const sub = interaction.options.getSubcommand();

    if (sub === 'create') {
      const title = interaction.options.getString('title');
      const description = interaction.options.getString('description');
      const channel = interaction.options.getChannel('channel') ?? interaction.channel;

      const embed = new EmbedBuilder()
        .setColor(BRAND.colors.primary)
        .setTitle(title)
        .setDescription(description + '\n\n*Select your roles from the menu below!*')
        .setFooter({ text: `${BRAND.footer} • Reaction Roles` })
        .setTimestamp(new Date());

      const placeholder = new ActionRowBuilder().addComponents(
        new StringSelectMenuBuilder()
          .setCustomId(`rr:${interaction.guildId}:${channel.id}`)
          .setPlaceholder('Pick your roles...')
          .setMinValues(0)
          .setMaxValues(5),
      );

      const msg = await channel.send({ embeds: [embed], components: [placeholder] });

      // Store the panel reference
      const panelKey = `${interaction.guildId}:${channel.id}`;
      activePanels.set(panelKey, {
        messageId: msg.id,
        channelId: channel.id,
        guildId: interaction.guildId,
        roles: [],
      });

      await interaction.reply({
        content: `✅ Reaction role panel created in ${channel}! Use \`/reactionrole add\` to add roles to it.`,
        ephemeral: true,
      });

    } else if (sub === 'add') {
      const role = interaction.options.getRole('role');
      const emoji = interaction.options.getString('emoji');
      const label = interaction.options.getString('label') ?? role.name;

      // Find the most recent panel for this guild
      const panelKey = `${interaction.guildId}:${interaction.channelId}`;
      let panel = activePanels.get(panelKey);

      // Also search all panels in this guild
      if (!panel) {
        for (const [key, data] of activePanels) {
          if (data.guildId === interaction.guildId) {
            panel = data;
            break;
          }
        }
      }

      if (!panel) {
        return interaction.reply({
          content: '❌ No reaction role panel found in this channel. Create one first with `/reactionrole create`.',
          ephemeral: true,
        });
      }

      if (role.position >= interaction.guild.members.me.roles.highest.position) {
        return interaction.reply({
          content: '❌ I can\'t assign that role — it\'s higher than my highest role.',
          ephemeral: true,
        });
      }

      // Add the role to the panel
      panel.roles.push({ roleId: role.id, emoji, label });

      // Rebuild the select menu with all roles
      const channel = interaction.guild.channels.cache.get(panel.channelId);
      if (!channel) {
        return interaction.reply({ content: '❌ Panel channel not found.', ephemeral: true });
      }

      const msg = await channel.messages.fetch(panel.messageId).catch(() => null);
      if (!msg) {
        return interaction.reply({ content: '❌ Panel message not found. Create a new panel.', ephemeral: true });
      }

      const menu = new StringSelectMenuBuilder()
        .setCustomId(`rr:${panel.guildId}:${panel.channelId}`)
        .setPlaceholder('Pick your roles...')
        .setMinValues(0)
        .setMaxValues(Math.min(panel.roles.length, 5));

      for (const r of panel.roles) {
        menu.addOptions({ label: r.label, value: r.roleId, emoji: r.emoji });
      }

      const row = new ActionRowBuilder().addComponents(menu);
      const embed = msg.embeds[0];
      await msg.edit({ components: [row] });

      await interaction.reply({
        content: `✅ Added ${role} to the reaction role panel with emoji ${emoji}.`,
        ephemeral: true,
      });

    } else if (sub === 'delete') {
      const messageId = interaction.options.getString('message_id');

      // Find the panel
      let panelKey = null;
      for (const [key, data] of activePanels) {
        if (data.messageId === messageId && data.guildId === interaction.guildId) {
          panelKey = key;
          break;
        }
      }

      if (!panelKey) {
        return interaction.reply({ content: '❌ Panel not found.', ephemeral: true });
      }

      const panel = activePanels.get(panelKey);
      const channel = interaction.guild.channels.cache.get(panel.channelId);
      if (channel) {
        const msg = await channel.messages.fetch(messageId).catch(() => null);
        if (msg) await msg.delete().catch(() => {});
      }

      activePanels.delete(panelKey);
      await interaction.reply({ content: '✅ Reaction role panel deleted.', ephemeral: true });
    }
  },

  /**
   * Handle the string select menu interaction for reaction roles.
   * Called from router when customId starts with 'rr:'.
   */
  async handleSelect(interaction) {
    const [, guildId, channelId] = interaction.customId.split(':');
    const panelKey = `${guildId}:${channelId}`;
    const panel = activePanels.get(panelKey);

    if (!panel) {
      return interaction.reply({ content: 'This panel is no longer active.', ephemeral: true });
    }

    const selected = interaction.values;
    const member = interaction.member;
    const added = [];
    const removed = [];

    for (const roleId of panel.roles.map(r => r.roleId)) {
      const hasRole = member.roles.cache.has(roleId);
      if (selected.includes(roleId) && !hasRole) {
        await member.roles.add(roleId).catch(() => {});
        added.push(`<@&${roleId}>`);
      } else if (!selected.includes(roleId) && hasRole) {
        await member.roles.remove(roleId).catch(() => {});
        removed.push(`<@&${roleId}>`);
      }
    }

    const parts = [];
    if (added.length > 0) parts.push(`Added: ${added.join(', ')}`);
    if (removed.length > 1) parts.push(`Removed: ${removed.join(', ')}`);
    if (parts.length === 0) parts.push('No changes.');

    await interaction.reply({ content: parts.join('\n'), ephemeral: true });
  },
};
