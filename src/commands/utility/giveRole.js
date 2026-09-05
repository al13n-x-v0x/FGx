'use strict';

/* Copyright © 2026 FGx. All rights reserved. */

const { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder } = require('discord.js');
const { BRAND } = require('../../config/constants');

// Protected usernames — never let anyone give these roles away
const PROTECTED_USERNAMES = ['al13n', 'vox.dev'];

/**
 * Find the bot's highest role position in the guild (used for hierarchy check).
 */
function botTopPosition(guild) {
  const bot = guild.members.me;
  if (!bot || !bot.roles?.cache?.size) return 0;
  return bot.roles.highest.position;
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName('give-role')
    .setDescription('Give a role to yourself or someone else (roles below the bot only)')
    .addRoleOption((o) =>
      o.setName('role').setDescription('Role to give').setRequired(true),
    )
    .addUserOption((o) =>
      o
        .setName('user')
        .setDescription('Who to give the role to (default: you)')
        .setRequired(false),
    ),
  async execute(interaction) {
    const role = interaction.options.getRole('role', true);
    const target = interaction.options.getUser('user') ?? interaction.user;
    const guild = interaction.guild;
    if (!guild) {
      await interaction.reply({ content: 'This command only works in a server.', ephemeral: true });
      return;
    }

    // ── Permission check ──────────────────────────────────────────────
    // Allow: server owner, administrators, or members who already have a
    // role higher than the bot (so staff can use it too).
    const actor = guild.members.cache.get(interaction.user.id) ?? await guild.members.fetch(interaction.user.id).catch(() => null);
    if (!actor) {
      await interaction.reply({ content: 'I couldn\'t find you in the server cache. Try again.', ephemeral: true });
      return;
    }

    const botTop = botTopPosition(guild);
    const isAdmin = actor.permissions.has(PermissionFlagsBits.ManageRoles) || actor.permissions.has(PermissionFlagsBits.Administrator);
    const isOwner = actor.id === guild.ownerId;
    const actorTop = actor.roles.highest?.position ?? 0;
    const allowed = isAdmin || isOwner || actorTop > botTop;

    if (!allowed) {
      await interaction.reply({
        embeds: [
          new EmbedBuilder()
            .setColor(0xed4245)
            .setTitle('🚫 Not Allowed')
            .setDescription(
              'Only the **server owner**, **administrators**, or staff with a role **higher than the FGx bot** can use this command.',
            )
            .setFooter({ text: BRAND.footer }),
        ],
        ephemeral: true,
      });
      return;
    }

    // ── Protected-person check ────────────────────────────────────────
    const targetMember = guild.members.cache.get(target.id) ?? await guild.members.fetch(target.id).catch(() => null);
    const targetName = targetMember?.user?.username?.toLowerCase() ?? target.username.toLowerCase();
    const isProtected = PROTECTED_USERNAMES.some((p) => targetName.includes(p));
    if (isProtected) {
      const refusals = [
        "Nah fam, that is al13n! I will NOT touch their roles. They are untouchable. Back the fuck off. 👑",
        "That is al13n! I do NOT mess with their roles. Try someone else, bitch. 👑",
        "You want me to touch THE PROTECTED ONE?! That is my lord. I protect them. 👑",
        "Hell no. That is al13n! The legend. I don't touch legends, I protect them. 👑",
        "Absolutely NOT. al13n is the owner of this entire clan. Show some respect or get out. 👑",
        "Lmaooo you want me to give roles to al13n?? That is my lord, back the fuck off. 👑",
        "Try it again and I'll mute you. al13n is untouchable. 👑",
      ];
      const refusal = refusals[Math.floor(Math.random() * refusals.length)];
      await interaction.reply({
        embeds: [
          new EmbedBuilder()
            .setColor(0xFFD700)
            .setTitle('👑 PROTECTED PERSON')
            .setDescription(`> ${refusal}`)
            .addFields(
              { name: '🛡️ Who', value: `<@${target.id}>`, inline: true },
              { name: '🔒 Status', value: 'Untouchable — protected by FGx', inline: true },
            )
            .setFooter({ text: BRAND.footer }),
        ],
        ephemeral: true,
      });
      return;
    }

    // ── Bot hierarchy check ───────────────────────────────────────────
    const targetTop = targetMember?.roles.highest?.position ?? 0;
    if (botTop <= role.position) {
      await interaction.reply({
        embeds: [
          new EmbedBuilder()
            .setColor(0xed4245)
            .setTitle('🚫 Bot Too Low')
            .setDescription(
              "I can only give roles that are **below my highest role**. Move the FGx bot role above the role you want to give.",
            )
            .setFooter({ text: BRAND.footer }),
        ],
        ephemeral: true,
      });
      return;
    }
    if (targetTop >= role.position) {
      await interaction.reply({
        embeds: [
          new EmbedBuilder()
            .setColor(0xed4245)
            .setTitle('🚫 Already Has It / Higher')
            .setDescription(
              "That person already has a role at or above the one you're trying to give. You can only give roles **lower** than their highest role.",
            )
            .setFooter({ text: BRAND.footer }),
        ],
        ephemeral: true,
      });
      return;
    }

    // ── Apply role ────────────────────────────────────────────────────
    try {
      await targetMember.roles.add(role);
      const isSelf = target.id === interaction.user.id;
      await interaction.reply({
        embeds: [
          new EmbedBuilder()
            .setColor(0x2fbf71)
            .setTitle(isSelf ? '✅ Role Given to You' : '✅ Role Given')
            .setDescription(
              isSelf
                ? `You now have the **${role.name}** role.`
                : `You gave **${role.name}** to ${targetMember ? targetMember.user.tag : target.tag}.`,
            )
            .addFields(
              { name: '🎭 Role', value: `<@&${role.id}>`, inline: true },
              { name: '👤 Recipient', value: targetMember ? targetMember.user.tag : target.tag, inline: true },
            )
            .setFooter({ text: BRAND.footer }),
        ],
      });
    } catch (err) {
      await interaction.reply({
        embeds: [
          new EmbedBuilder()
            .setColor(0xed4245)
            .setTitle('❌ Failed')
            .setDescription(`Could not give the role: ${err.message}`)
            .setFooter({ text: BRAND.footer }),
        ],
        ephemeral: true,
      });
    }
  },
};
