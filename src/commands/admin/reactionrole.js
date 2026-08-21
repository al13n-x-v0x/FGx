'use strict';

/* Copyright © 2026 FGx. All rights reserved. */

const {
  SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits, ChannelType,
} = require('discord.js');
const { BRAND } = require('../../config/constants');
const { reactionRolesRepo } = require('../../database/repos/reactionRoles');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('reactionrole')
    .setDescription('Set up reaction roles — users click emoji to get roles')
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
        .setDescription('Add a role with emoji to a panel')
        .addStringOption(opt =>
          opt.setName('message_id').setDescription('Panel message ID or link').setRequired(true))
        .addRoleOption(opt =>
          opt.setName('role').setDescription('Role to assign').setRequired(true))
        .addStringOption(opt =>
          opt.setName('emoji').setDescription('Emoji for this role (e.g. 🔴 or :custom_emoji:)').setRequired(true))
        .addStringOption(opt =>
          opt.setName('label').setDescription('Display label (default: role name)'))
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
        .setFooter({ text: `${BRAND.footer} • Reaction Roles` })
        .setTimestamp(new Date());

      const msg = await channel.send({ embeds: [embed] });

      await interaction.reply({
        content: `✅ Panel created! Now add roles:\n\`/reactionrole add message_id:${msg.id} role:@Role emoji:🔴\`\n\nReact to the message with the emoji you want to use, then run the command.`,
        ephemeral: true,
      });

    } else if (sub === 'add') {
      const messageId = resolveMessageId(interaction.options.getString('message_id'));
      const role = interaction.options.getRole('role');
      const emojiStr = interaction.options.getString('emoji');
      const label = interaction.options.getString('label') ?? role.name;

      if (!messageId) {
        return interaction.reply({ content: '❌ Invalid message ID or link.', ephemeral: true });
      }

      // Check role hierarchy
      if (role.position >= interaction.guild.members.me.roles.highest.position) {
        return interaction.reply({
          content: "❌ I can't assign that role — it's higher than my highest role.",
          ephemeral: true,
        });
      }

      // Check if role already mapped to this message
      const existing = reactionRolesRepo.getByMessage(interaction.guildId, messageId);
      if (existing.some(r => r.role_id === role.id)) {
        return interaction.reply({ content: `❌ ${role} is already in this panel.`, ephemeral: true });
      }

      // Normalize emoji — extract the Unicode emoji or keep custom format
      const emoji = normalizeEmoji(emojiStr);

      // Fetch the panel message
      const channel = interaction.channel;
      const msg = await channel.messages.fetch(messageId).catch(() => null);
      if (!msg) {
        return interaction.reply({ content: '❌ Panel message not found. Make sure the message is in this channel.', ephemeral: true });
      }

      // Add reaction to the message
      try {
        await msg.react(emoji);
      } catch (err) {
        return interaction.reply({
          content: `❌ Failed to add reaction \`${emoji}\`. Make sure it's a valid emoji.\nError: ${err.message}`,
          ephemeral: true,
        });
      }

      // Save to database
      reactionRolesRepo.add(
        interaction.guildId, channel.id, messageId, role.id, emoji, label,
      );

      // Update the embed with the role list
      const allRoles = reactionRolesRepo.getByMessage(interaction.guildId, messageId);
      const roleList = allRoles.map(r => `${r.emoji} **${r.label || r.role_id}**`).join('\n');

      const embed = EmbedBuilder.from(msg.embeds[0] ?? new EmbedBuilder())
        .setColor(BRAND.colors.primary)
        .setDescription(
          `${roleList}\n\n*Click an emoji above to get/remove a role!*`
        );

      await msg.edit({ embeds: [embed] }).catch(() => {});

      await interaction.reply({
        content: `✅ Added ${role} (${emoji}) to the panel. **${allRoles.length}** role(s) total.`,
        ephemeral: true,
      });

    } else if (sub === 'remove') {
      const messageId = resolveMessageId(interaction.options.getString('message_id'));
      const role = interaction.options.getRole('role');

      if (!messageId) {
        return interaction.reply({ content: '❌ Invalid message ID or link.', ephemeral: true });
      }

      const allRoles = reactionRolesRepo.getByMessage(interaction.guildId, messageId);
      const match = allRoles.find(r => r.role_id === role.id);
      if (!match) {
        return interaction.reply({ content: `❌ ${role} is not in this panel.`, ephemeral: true });
      }

      // Remove from database
      reactionRolesRepo.remove(interaction.guildId, messageId, role.id);

      // Try to remove the reaction from the message
      const channel = interaction.guild.channels.cache.get(match.channel_id);
      if (channel) {
        const msg = await channel.messages.fetch(messageId).catch(() => null);
        if (msg) {
          // Remove the bot's reaction
          const botReaction = msg.reactions.cache.find(r =>
            normalizeEmoji(r.emoji.name) === match.emoji ||
            (r.emoji.id && `<:${r.emoji.name}:${r.emoji.id}>` === match.emoji)
          );
          if (botReaction) await botReaction.remove().catch(() => {});

          // Update the embed
          const remaining = reactionRolesRepo.getByMessage(interaction.guildId, messageId);
          if (remaining.length > 0) {
            const roleList = remaining.map(r => `${r.emoji} **${r.label || r.role_id}**`).join('\n');
            const embed = EmbedBuilder.from(msg.embeds[0] ?? new EmbedBuilder())
              .setColor(BRAND.colors.primary)
              .setDescription(`${roleList}\n\n*Click an emoji above to get/remove a role!*`);
            await msg.edit({ embeds: [embed] }).catch(() => {});
          } else {
            const embed = EmbedBuilder.from(msg.embeds[0] ?? new EmbedBuilder())
              .setColor(BRAND.colors.primary)
              .setDescription('*No roles configured yet. Staff: use /reactionrole add to add roles.*');
            await msg.edit({ embeds: [embed], components: [] }).catch(() => {});
          }
        }
      }

      await interaction.reply({
        content: `✅ Removed ${role} from the panel. **${allRoles.length - 1}** role(s) remaining.`,
        ephemeral: true,
      });

    } else if (sub === 'delete') {
      const messageId = resolveMessageId(interaction.options.getString('message_id'));
      if (!messageId) {
        return interaction.reply({ content: '❌ Invalid message ID.', ephemeral: true });
      }

      const allRoles = reactionRolesRepo.getByMessage(interaction.guildId, messageId);
      if (allRoles.length === 0) {
        return interaction.reply({ content: '❌ No reaction role panel found with that message ID.', ephemeral: true });
      }

      // Delete the message
      const channel = interaction.guild.channels.cache.get(allRoles[0].channel_id);
      if (channel) {
        const msg = await channel.messages.fetch(messageId).catch(() => null);
        if (msg) await msg.delete().catch(() => {});
      }

      // Delete from database
      reactionRolesRepo.deleteMessage(interaction.guildId, messageId);

      await interaction.reply({ content: '✅ Reaction role panel deleted.', ephemeral: true });

    } else if (sub === 'list') {
      const allRoles = reactionRolesRepo.getAll(interaction.guildId);
      if (allRoles.length === 0) {
        return interaction.reply({ content: 'No reaction role panels found.', ephemeral: true });
      }

      // Group by message
      const panels = {};
      for (const r of allRoles) {
        if (!panels[r.message_id]) {
          panels[r.message_id] = { channelId: r.channel_id, roles: [] };
        }
        panels[r.message_id].roles.push(r);
      }

      const list = Object.entries(panels).map(([msgId, data]) => {
        const roleNames = data.roles.map(r => `${r.emoji} ${r.label || r.role_id}`).join(', ');
        return `• <#${data.channelId}> (msg: \`${msgId}\`) — ${roleNames}`;
      }).join('\n');

      await interaction.reply({ content: list, ephemeral: true });
    }
  },
};

/** Extract message ID from a message link or raw ID. */
function resolveMessageId(input) {
  if (!input) return null;
  const linkMatch = input.match(/channels\/\d+\/\d+\/(\d+)/);
  if (linkMatch) return linkMatch[1];
  return input.trim();
}

/** Normalize an emoji string for storage and reaction lookup. */
function normalizeEmoji(str) {
  if (!str) return str;
  // Custom emoji format: <:name:id> or <a:name:id>
  const customMatch = str.match(/^<a?:([^:]+):(\d+)>$/);
  if (customMatch) return `<:${customMatch[1]}:${customMatch[2]}>`;
  // Unicode emoji — return as-is
  return str.trim();
}
