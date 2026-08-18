'use strict';

/*
 * Copyright © 2026 FGx.
 * All rights reserved.
 */

const {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
} = require('discord.js');
const { BRAND } = require('../../config/constants');
const { guildConfigRepo } = require('../../database/repos/guildConfig');
const { robloxLinksRepo } = require('../../database/repos/roblox');
const { logAudit } = require('../logging/auditLogger');
const { logger } = require('../../utils/logger');

/**
 * Bloxlink-style Roblox verification using Roblox's official public API:
 *   POST https://users.roblox.com/v1/usernames/users   (resolve username → id)
 *   GET  https://users.roblox.com/v1/users/{id}/profile (reads the About/blurb)
 *
 * Flow: enter username → FGx issues a code → user puts the code in their
 * Roblox About section → press Check → the code match links the accounts.
 * No password, no scraping, no fake data.
 */

const ROBLOX_API = 'https://users.roblox.com/v1';
const API_TIMEOUT_MS = 8000;

/** Characters excluded from codes to avoid confusion (0/O, 1/I). */
const CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

/** Injectable for tests; defaults to Node's global fetch. */
let apiFetch = (...args) => globalThis.fetch(...args);

function _setFetch(fn) {
  apiFetch = fn;
}

/** Random verification code like FGX-K7M2QZ. */
function generateCode(length = 6) {
  let out = '';
  for (let i = 0; i < length; i += 1) {
    out += CODE_ALPHABET[Math.floor(Math.random() * CODE_ALPHABET.length)];
  }
  return `FGX-${out}`;
}

/** Resolve a Roblox username to { id, name, displayName } or null. */
async function resolveUsername(username) {
  const res = await apiFetch(`${ROBLOX_API}/usernames/users`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ usernames: [username], excludeBannedUsers: true }),
    signal: AbortSignal.timeout(API_TIMEOUT_MS),
  });
  if (!res.ok) {
    throw new Error(`Roblox API error (${res.status}) — try again in a moment.`);
  }
  const json = await res.json();
  const match = json?.data?.[0];
  if (!match || !match.id) return null;
  return { id: match.id, name: match.name ?? username, displayName: match.displayName ?? username };
}

/** Fetch a user's About/blurb text. */
async function fetchBlurb(userId) {
  const res = await apiFetch(`${ROBLOX_API}/users/${userId}/profile`, {
    headers: { Accept: 'application/json' },
    signal: AbortSignal.timeout(API_TIMEOUT_MS),
  });
  if (!res.ok) {
    throw new Error(`Roblox API error (${res.status}) — try again in a moment.`);
  }
  const json = await res.json();
  return typeof json?.description === 'string' ? json.description : '';
}

/** True when the About text contains the code (case-insensitive). */
function blurbHasCode(blurb, code) {
  return String(blurb ?? '').toLowerCase().includes(String(code ?? '').toLowerCase());
}

/** Short status for embeds (DB only — never throws, never hits the network). */
function linkStatus(guildId, userId) {
  try {
    return robloxLinksRepo.get(guildId, userId) ?? null;
  } catch {
    return null;
  }
}

/** Number of verified Roblox links in a guild (DB only). */
function countVerified(guildId) {
  try {
    return robloxLinksRepo.countVerified(guildId);
  } catch {
    return 0;
  }
}

/** The role granted on verification (roblox role, else generic verified role). */
function verifiedRole(guild, config) {
  const roleId = config.roblox.roleId || config.verification.roleId;
  return roleId ? (guild.roles.cache.get(roleId) ?? null) : null;
}

/** Start (or restart) verification for a user with a Roblox username. */
async function startVerification(guild, user, username) {
  const resolved = await resolveUsername(username);
  if (!resolved) {
    const err = new Error(
      `No Roblox account named **${username}** was found. Double-check the spelling and try again.`,
    );
    err.code = 'ROBLOX_NOT_FOUND';
    throw err;
  }
  const link = robloxLinksRepo.create(guild.id, user.id, {
    robloxUsername: resolved.name,
    robloxId: resolved.id,
    code: generateCode(),
  });
  return { link, resolved };
}

/** Confirm a pending verification by checking the Roblox About section. */
async function checkVerification(client, guild, user) {
  const link = robloxLinksRepo.get(guild.id, user.id);
  if (!link || link.status !== 'pending' || !link.code) {
    const err = new Error('You have no pending Roblox verification. Run `/roblox verify` first.');
    err.code = 'NO_PENDING';
    throw err;
  }

  const config = guildConfigRepo.get(guild.id);
  const ttlMinutes = config.roblox.codeTtlMinutes > 0 ? config.roblox.codeTtlMinutes : 15;
  const ageMs = Date.now() - new Date(`${link.created_at} UTC`).getTime();
  if (Number.isFinite(ageMs) && ageMs > ttlMinutes * 60_000) {
    robloxLinksRepo.remove(guild.id, user.id);
    const err = new Error(
      `Your verification code expired after ${ttlMinutes} minutes. Run \`/roblox verify\` again for a fresh code.`,
    );
    err.code = 'EXPIRED';
    throw err;
  }

  const blurb = await fetchBlurb(link.roblox_id);
  if (!blurbHasCode(blurb, link.code)) {
    const err = new Error(
      'Your Roblox **About** section does not contain the verification code yet.\n\n' +
        '1. Open your Roblox profile → **About**\n' +
        '2. Paste the code exactly as shown\n' +
        '3. Save, wait ~10 seconds, then press **Check** again',
    );
    err.code = 'CODE_NOT_FOUND';
    throw err;
  }

  // Verified — persist, grant the role, log it, and notify the user.
  robloxLinksRepo.verify(guild.id, user.id);
  const role = verifiedRole(guild, config);
  const member = guild.members.cache.get(user.id);
  if (role && member) {
    await member.roles.add(role, 'FGx Roblox verification').catch(() => {});
  }
  await logAudit(client, guild, {
    action: 'verification',
    target: user,
    moderator: null,
    details: { roblox: link.roblox_username, robloxId: link.roblox_id, role: role?.name ?? null },
  });
  const fresh = robloxLinksRepo.get(guild.id, user.id);
  return { link: fresh ?? link, role };
}

/** Remove a verified/pending link (best-effort role removal). */
async function unlink(client, guild, user) {
  const link = robloxLinksRepo.get(guild.id, user.id);
  if (!link) return null;
  const config = guildConfigRepo.get(guild.id);
  const role = verifiedRole(guild, config);
  const member = guild.members.cache.get(user.id);
  if (role && member && member.roles.cache.has(role.id)) {
    await member.roles.remove(role, 'FGx Roblox unlink').catch(() => {});
  }
  robloxLinksRepo.remove(guild.id, user.id);
  await logAudit(client, guild, {
    action: 'verification',
    target: user,
    moderator: null,
    details: { event: 'roblox_unlink', roblox: link.roblox_username },
  });
  return link;
}

/** Create the Roblox verification panel message in the configured channel. */
async function createPanel(guild) {
  const config = guildConfigRepo.get(guild.id);
  if (!config.roblox.enabled) {
    throw new Error('Roblox verification is disabled. Enable it with `/config roblox` first.');
  }
  const channelId = config.roblox.channel || config.verification.channel;
  const channel = channelId ? (guild.channels.cache.get(channelId) ?? null) : null;
  if (!channel?.isTextBased?.()) {
    throw new Error(
      'No Roblox verification channel configured. Set it with `/config roblox channel=<id>` or run `/setup`.',
    );
  }
  const embed = new EmbedBuilder()
    .setColor(BRAND.colors.primary)
    .setTitle('🟥 Roblox Verification')
    .setDescription(
      'Link your **Roblox account** to your Discord (Bloxlink-style).\n\n' +
        '• No password, no personal data\n' +
        '• Your code goes in your Roblox **About** section\n' +
        '• One Roblox account per Discord user\n\n' +
        'Click **Verify with Roblox** to begin.',
    )
    .setFooter({ text: `${BRAND.footer} • Powered by the Roblox public API` });
  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId('roblox:start').setStyle(ButtonStyle.Primary).setLabel('Verify with Roblox'),
  );
  const message = await channel.send({ embeds: [embed], components: [row] });

  if (config.roblox.panelChannelId && config.roblox.panelMessageId) {
    const oldChannel = guild.channels.cache.get(config.roblox.panelChannelId);
    const oldMessage = oldChannel?.messages?.cache?.get(config.roblox.panelMessageId);
    if (oldMessage) await oldMessage.delete().catch(() => {});
  }
  guildConfigRepo.update(guild.id, {
    roblox: { panelChannelId: channel.id, panelMessageId: message.id },
  });
  return message;
}

/* ── Interaction handlers ──────────────────────────────────────────────── */

/** Panel/hub button → modal asking for the Roblox username. */
function handleStart(interaction) {
  const modal = new ModalBuilder().setCustomId('roblox:submit').setTitle('Roblox Verification');
  modal.addComponents(
    new ActionRowBuilder().addComponents(
      new TextInputBuilder()
        .setCustomId('roblox_username')
        .setLabel('Your Roblox username')
        .setStyle(TextInputStyle.Short)
        .setRequired(true)
        .setMinLength(3)
        .setMaxLength(20)
        .setPlaceholder('e.g. xX_BloxKiller_Xx'),
    ),
  );
  return interaction.showModal(modal);
}

/** Modal submit → resolve the account and show the code + Check button. */
async function handleSubmit(interaction) {
  const username = String(interaction.fields.getTextInputValue('roblox_username') ?? '').trim();
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
  // Resolving via the Roblox API can take a moment.
  await interaction.deferReply({ ephemeral: true });
  try {
    const { link, resolved } = await startVerification(interaction.guild, interaction.user, username);
    const config = guildConfigRepo.get(interaction.guild.id);
    const ttl = config.roblox.codeTtlMinutes > 0 ? config.roblox.codeTtlMinutes : 15;
    const bt = '`';
    const embed = new EmbedBuilder()
      .setColor(BRAND.colors.primary)
      .setTitle('🟥 Roblox Verification — Step 2')
      .setDescription(
        `Verified that **${resolved.displayName}** (id ${bt}${resolved.id}${bt}) exists.\n\n` +
          '**Put this code in your Roblox profile → About section:**\n' +
          `${bt}${bt}${bt}\n${link.code}\n${bt}${bt}${bt}\n\n` +
          '• Open Roblox → your profile → **About**\n' +
          `• Paste **${link.code}** and save\n` +
          `• Code expires in **${ttl} minutes**\n\n` +
          'Then press **Check** below.',
      )
      .setFooter({ text: `${BRAND.footer} • Bloxlink-style verification` });
    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId('roblox:check').setStyle(ButtonStyle.Success).setLabel('✅ I added it — Check now'),
    );
    await interaction.editReply({ embeds: [embed], components: [row] });
  } catch (err) {
    if (err.code === 'DUPLICATE_ROBLOX' || err.code === 'ROBLOX_NOT_FOUND') {
      return interaction.editReply({
        embeds: [{ color: BRAND.colors.danger, title: 'Verification blocked', description: err.message, footer: { text: BRAND.footer } }],
      });
    }
    throw err;
  }
  return undefined;
}

/** Check button → confirm the code appears in the Roblox About section. */
async function handleCheck(interaction) {
  // The Roblox API call may take a moment — acknowledge the click first.
  await interaction.deferUpdate();
  try {
    const { link, role } = await checkVerification(interaction.client, interaction.guild, interaction.user);
    const bt = '`';
    const embed = new EmbedBuilder()
      .setColor(BRAND.colors.success)
      .setTitle('✅ Roblox Verified')
      .setDescription(
        `Your Discord account is now linked to **${link.roblox_username}** (id ${bt}${link.roblox_id}${bt}).\n\n` +
          (role ? `You received the **${role.name}** role.` : 'No verification role is configured yet.') +
          '\n\nManage your link anytime with `/roblox`.',
      )
      .setFooter({ text: `${BRAND.footer} • Verified via Roblox public API` });
    await interaction.editReply({ embeds: [embed], components: [] });
    await interaction.user
      .send({
        embeds: [
          {
            color: BRAND.colors.success,
            title: '🟥 Roblox verified',
            description: `**${interaction.guild.name}** — your Roblox account **${link.roblox_username}** is verified.`,
            footer: { text: BRAND.footer },
          },
        ],
      })
      .catch(() => {});
  } catch (err) {
    if (err.code === 'CODE_NOT_FOUND' || err.code === 'EXPIRED' || err.code === 'NO_PENDING') {
      return interaction.followUp({
        embeds: [{ color: BRAND.colors.warn, title: 'Not verified yet', description: err.message, footer: { text: BRAND.footer } }],
        ephemeral: true,
      });
    }
    logger.warn('roblox check failed', { guildId: interaction.guild.id, error: err.message });
    return interaction.followUp({
      embeds: [
        {
          color: BRAND.colors.danger,
          title: 'Roblox API error',
          description: err.message,
          footer: { text: BRAND.footer },
        },
      ],
      ephemeral: true,
    });
  }
  return undefined;
}

/** Unlink button (from the hub). */
async function handleUnlink(interaction) {
  await interaction.deferUpdate();
  const link = await unlink(interaction.client, interaction.guild, interaction.user);
  const embed = new EmbedBuilder()
    .setColor(BRAND.colors.neutral)
    .setTitle('Roblox link removed')
    .setDescription(
      link
        ? `**${link.roblox_username}** is no longer linked to your Discord account.`
        : 'You had no Roblox link to remove.',
    )
    .setFooter({ text: BRAND.footer });
  return interaction.editReply({ embeds: [embed], components: [] });
}

module.exports = {
  generateCode,
  blurbHasCode,
  resolveUsername,
  fetchBlurb,
  linkStatus,
  countVerified,
  startVerification,
  checkVerification,
  unlink,
  createPanel,
  handleStart,
  handleSubmit,
  handleCheck,
  handleUnlink,
  _setFetch,
};
