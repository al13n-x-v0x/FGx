'use strict';

/* Copyright © 2026 FGx. All rights reserved. */

const {
  SlashCommandBuilder, EmbedBuilder, ActionRowBuilder,
  StringSelectMenuBuilder, PermissionFlagsBits, ChannelType,
} = require('discord.js');
const { BRAND } = require('../../config/constants');

/** Active reaction-role messages (in-memory, resets on restart). */
const activePanels = new Map();

/**
 * Build the select menu row for a panel's current role list.
 */
function buildMenuRow(panel) {
  const options = panel.roles.map(r => ({
    label: r.label,
    value: r.roleId,
    emoji: r.emoji,
    description: r.description || undefined,
  }));

  const menu = new StringSelectMenuBuilder()
    .setCustomId(`rr:${panel.guildId}:${panel.channelId}`)
    .setPlaceholder('Pick your roles...')
    .setMinValues(0)
    .setMaxValues(Math.min(panel.roles.length, 25));

  for (const opt of options) {
    menu.addOptions(opt);
  }

  return new ActionRowBuilder().addComponents(menu);
}

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
        .setDescription('Add a role to a panel (use message link or ID)')
        .addStringOption(opt =>
          opt.setName('message_id').setDescription('Panel message ID or link').setRequired(true))
        .addRoleOption(opt =>
          opt.setName('role').setDescription('Role to add').setRequired(true))
        .addStringOption(opt =>
          opt.setName('emoji').setDescription('Emoji for this role (e.g. 🔴)').setRequired(true))
        .addStringOption(opt =>
          opt.setName('label').setDescription('Display label (default: role name)'))
        .addStringOption(opt =>
          opt.setName('description').setDescription('Option description'))
    )
    .addSubcommand(sub =>
      sub.setName('remove')
        .setDescription('Remove a role from a panel')
        .addStringOption(opt =>
          opt.setName('message_id').setDescription('Panel message ID or link').setRequired(true))
        .addRoleOption(opt =>
          opt.setName('role').setDescription('Role to remove').setRequired(true))
    )
    .addSubcommand(sub =>
      sub.setName('delete')
        .setDescription('Delete a reaction role panel')
        .addStringOption(opt =>
          opt.setName('message_id').setDescription('Panel message ID').setRequired(true))
    )
    .addSubcommand(sub =>
      sub.setName('list')
        .setDescription('List all active reaction role panels')
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
        .setDescription(description + '\n\n*Roles will appear here once added by staff.*')
        .setFooter({ text: `${BRAND.footer} • Reaction Roles • Use /reactionrole add to add roles` })
        .setTimestamp(new Date());

      // Send the embed first — no select menu yet (need at least 1 role first)
      const msg = await channel.send({ embeds: [embed] });

      // Store the panel reference
      const panelKey = `${interaction.guildId}:${msg.id}`;
      activePanels.set(panelKey, {
        messageId: msg.id,
        channelId: channel.id,
        guildId: interaction.guildId,
        title,
        roles: [],
      });

      await interaction.reply({
        content: `✅ Panel created in ${channel}! Now use:\n\`/reactionrole add message_id:${msg.id} role:@Role emoji:🔴\`\n\nto add roles to the panel.`,
        ephemeral: true,
      });

    } else if (sub === 'add') {
      const messageId = resolveMessageId(interaction.options.getString('message_id'));
      const role = interaction.options.getRole('role');
      const emoji = interaction.options.getString('emoji');
      const label = interaction.options.getString('label') ?? role.name;
      const description = interaction.options.getString('description') ?? '';

      // Find the panel by message ID
      const panel = findPanel(interaction.guildId, messageId);
      if (!panel) {
        return interaction.reply({
          content: '❌ Panel not found. Make sure you paste the message ID or link of the reaction role panel.',
          ephemeral: true,
        });
      }

      // Check role hierarchy
      if (role.position >= interaction.guild.members.me.roles.highest.position) {
        return interaction.reply({
          content: '❌ I can\'t assign that role — it\'s higher than my highest role.',
          ephemeral: true,
        });
      }

      // Check if role already added
      if (panel.roles.some(r => r.roleId === role.id)) {
        return interaction.reply({
          content: `❌ ${role} is already in this panel.`,
          ephemeral: true,
        });
      }

      // Add the role
      panel.roles.push({ roleId: role.id, emoji, label, description });

      // Fetch the panel message and update it
      const channel = interaction.guild.channels.cache.get(panel.channelId);
      if (!channel) {
        return interaction.reply({ content: '❌ Panel channel not found.', ephemeral: true });
      }

      const msg = await channel.messages.fetch(panel.messageId).catch(() => null);
      if (!msg) {
        return interaction.reply({ content: '❌ Panel message not found. Create a new panel.', ephemeral: true });
      }

      // Rebuild the embed with role list
      const roleList = panel.roles.map(r => `${r.emoji} **${r.label}**`).join('\n');
      const embed = EmbedBuilder.from(msg.embeds[0])
        .setDescription(
          panel.title ? `**${panel.title}**\n\n` : '' +
          `${roleList}\n\n*Select your roles from the menu below!*`
        );

      const row = buildMenuRow(panel);
      await msg.edit({ embeds: [embed], components: [row] });

      await interaction.reply({
        content: `✅ Added ${role} (${emoji}) to the panel. **${panel.roles.length}** role(s) total.`,
        ephemeral: true,
      });

    } else if (sub === 'remove') {
      const messageId = resolveMessageId(interaction.options.getString('message_id'));
      const role = interaction.options.getRole('role');

      const panel = findPanel(interaction.guildId, messageId);
      if (!panel) {
        return interaction.reply({ content: '❌ Panel not found.', ephemeral: true });
      }

      const idx = panel.roles.findIndex(r => r.roleId === role.id);
      if (idx === -1) {
        return interaction.reply({ content: `❌ ${role} is not in this panel.`, ephemeral: true });
      }

      panel.roles.splice(idx, 1);

      // Update the panel message
      const channel = interaction.guild.channels.cache.get(panel.channelId);
      if (channel) {
        const msg = await channel.messages.fetch(panel.messageId).catch(() => null);
        if (msg) {
          if (panel.roles.length === 0) {
            // No more roles — remove the select menu, keep embed
            const embed = EmbedBuilder.from(msg.embeds[0])
              .setDescription(
                (panel.title ? `**${panel.title}**\n\n` : '') +
                '*Roles will appear here once added by staff.*'
              );
            await msg.edit({ embeds: [embed], components: [] });
          } else {
            const roleList = panel.roles.map(r => `${r.emoji} **${r.label}**`).join('\n');
            const embed = EmbedBuilder.from(msg.embeds[0])
              .setDescription(
                (panel.title ? `**${panel.title}**\n\n` : '') +
                `${roleList}\n\n*Select your roles from the menu below!*`
              );
            const row = buildMenuRow(panel);
            await msg.edit({ embeds: [embed], components: [row] });
          }
        }
      }

      await interaction.reply({
        content: `✅ Removed ${role} from the panel. **${panel.roles.length}** role(s) remaining.`,
        ephemeral: true,
      });

    } else if (sub === 'delete') {
      const messageId = resolveMessageId(interaction.options.getString('message_id'));
      const panel = findPanel(interaction.guildId, messageId);
      if (!panel) {
        return interaction.reply({ content: '❌ Panel not found.', ephemeral: true });
      }

      const channel = interaction.guild.channels.cache.get(panel.channelId);
      if (channel) {
        const msg = await channel.messages.fetch(panel.messageId).catch(() => null);
        if (msg) await msg.delete().catch(() => {});
      }

      const panelKey = `${interaction.guildId}:${panel.messageId}`;
      activePanels.delete(panelKey);
      await interaction.reply({ content: '✅ Reaction role panel deleted.', ephemeral: true });

    } else if (sub === 'list') {
      const guildPanels = [];
      for (const [key, data] of activePanels) {
        if (data.guildId === interaction.guildId) {
          guildPanels.push(data);
        }
      }

      if (guildPanels.length === 0) {
        return interaction.reply({ content: 'No active reaction role panels.', ephemeral: true });
      }

      const list = guildPanels.map(p =>
        `• **${p.title || 'Untitled'}** — ${p.roles.length} role(s) — <#${p.channelId}> (msg: \`${p.messageId}\`)`
      ).join('\n');

      await interaction.reply({ content: list, ephemeral: true });
    }
  },

  /**
   * Handle the string select menu interaction for reaction roles.
   */
  async handleSelect(interaction) {
    const [, guildId, messageId] = interaction.customId.split(':');
    const panelKey = `${guildId}:${messageId}`;
    const panel = activePanels.get(panelKey);

    if (!panel) {
      return interaction.reply({ content: 'This reaction role panel is no longer active.', ephemeral: true });
    }

    const selected = interaction.values;
    const member = interaction.member;
    const added = [];
    const removed = [];

    for (const roleData of panel.roles) {
      const hasRole = member.roles.cache.has(roleData.roleId);
      if (selected.includes(roleData.roleId) && !hasRole) {
        await member.roles.add(roleData.roleId).catch(() => {});
        added.push(roleData.label);
      } else if (!selected.includes(roleData.roleId) && hasRole) {
        await member.roles.remove(roleData.roleId).catch(() => {});
        removed.push(roleData.label);
      }
    }

    const parts = [];
    if (added.length > 0) parts.push(`✅ Added: ${added.join(', ')}`);
    if (removed.length > 0) parts.push(`❌ Removed: ${removed.join(', ')}`);
    if (parts.length === 0) parts.push('No changes.');

    await interaction.reply({ content: parts.join('\n'), ephemeral: true });
  },
};

/** Extract message ID from a message link or raw ID. */
function resolveMessageId(input) {
  if (!input) return null;
  // Handle message link: https://discord.com/channels/GUILD/CHANNEL/MESSAGE
  const linkMatch = input.match(/channels\/\d+\/\d+\/(\d+)/);
  if (linkMatch) return linkMatch[1];
  return input.trim();
}

/** Find a panel by guild ID and message ID. */
function findPanel(guildId, messageId) {
  if (!messageId) return null;
  const key = `${guildId}:${messageId}`;
  return activePanels.get(key) || null;
}
