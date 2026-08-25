'use strict';

/*
 * Copyright © 2026 FGx.
 * All rights reserved.
 */

const { ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder } = require('discord.js');
const { BRAND } = require('../config/constants');
const verificationService = require('../services/community/verificationService');
const ticketService = require('../services/tickets/ticketService');
const tryoutService = require('../services/clan/tryoutService');
const rosterService = require('../services/clan/rosterService');
const hubService = require('../services/clan/hubService');
const robloxService = require('../services/community/robloxService');
const privateServerService = require('../services/clan/privateServerService');
const { guildConfigRepo } = require('../database/repos/guildConfig');
const { eventsRepo, scrimsRepo, trainingRepo } = require('../database/repos/competitive');
const giveawayService = require('../services/community/giveawayService');
const participation = require('../services/clan/participation');
const shuffleService = require('../services/clan/shuffleService');
const { logAudit } = require('../services/logging/auditLogger');
const { logger } = require('../utils/logger');
const { bloxstrikeUsername, boundedString } = require('../utils/validate');
const { ValidationError } = require('../utils/errors');

/** Toggle a user in/out of an announcement-backed participation list. */
async function toggleParticipation(interaction, repo, rowId, { join }) {
  // Editing the announcement message can exceed Discord's 3s window when the
  // message is not cached — acknowledge first, then finish with editReply.
  await interaction.deferReply({ ephemeral: true });
  const kind = repo === eventsRepo ? 'events' : repo === scrimsRepo ? 'scrims' : 'training';
  const result = await participation.toggle(interaction.client, interaction, repo, kind, rowId, { join });
  if (!result.changed) {
    const text = {
      'already-joined': 'You are already signed up.',
      'not-joined': 'You are not on that list.',
      full: 'That listing is full.',
    }[result.reason];
    return interaction.editReply({ content: text });
  }
  return interaction.editReply({
    content: result.reason === 'joined' ? `You joined. **${result.participants.length}** total.` : `You left. **${result.participants.length}** total.`,
  });
}

/** Handle tryout review buttons (accept / reject / trial / request info). */
async function handleTryoutReview(interaction) {
  const [, , tryoutId, action] = interaction.customId.split(':');
  const valid = new Set(['accept', 'reject', 'trial', 'info']);
  if (!valid.has(action)) throw new ValidationError('Unknown review action.');

  const config = guildConfigRepo.get(interaction.guild.id);
  rosterService.requireStaff(interaction.member, config);

  const statusMap = { accept: 'accepted', reject: 'rejected', trial: 'trial', info: 'info_requested' };
  const next = await tryoutService.decide(
    interaction.client,
    interaction.guild,
    interaction.user,
    Number(tryoutId),
    statusMap[action],
  );
  const data = safeParse(next.data, {});

  // Role changes, DMs and audit log happen after acknowledgement so the
  // interaction never dies inside Discord's 3s window.
  await interaction.deferUpdate();

  // On acceptance, move the applicant to Trial rank (best-effort).
  if (action === 'accept') {
    const member = interaction.guild.members.cache.get(next.user_id);
    if (member) {
      await rosterService.setRank(interaction.client, interaction.guild, member, 'Trial').catch(() => {});
    }
  }

  // Best-effort DM to the applicant.
  const applicant = interaction.guild.members.cache.get(next.user_id)?.user;
  if (applicant) {
    const text = {
      accept: 'Congratulations — your FGx application was **accepted**. You are now on Trial. Welcome to FGx.',
      reject: 'Thank you for applying to FGx. Unfortunately your application was **declined** this time.',
      trial: 'Your FGx application moved to **Trial**. Prepare for evaluation.',
      info: 'Staff requested more information about your application.',
    }[action];
    applicant.send(`**FGx Tryout Update (application #${next.id}):**\n${text}`).catch(() => {});
  }

  const embed = new EmbedBuilder()
    .setColor(action === 'accept' ? BRAND.colors.success : BRAND.colors.danger)
    .setTitle(`Application #${next.id} — ${next.status.toUpperCase()}`)
    .setDescription(
      `**Applicant:** <@${next.user_id}>\n**BloxStrike:** ${data.bloxstrike_username ?? '—'}\n**Reviewed by:** ${interaction.user.username}\n` +
        (next.notes ? `**Notes:** ${next.notes}` : ''),
    )
    .setFooter({ text: BRAND.footer });

  await interaction.editReply({ embeds: [embed], components: [] });

  await logAudit(interaction.client, interaction.guild, {
    action: 'tryout',
    target: { id: next.user_id, username: data.bloxstrike_username || next.user_id },
    moderator: interaction.user,
    reason: `Application #${next.id} → ${next.status.toUpperCase()}`,
  });
}

/** Two-step tryout application: page 1 fields then page 2, then submit. */
const tryoutDrafts = new Map(); // userId -> partial fields

function readModalFields(interaction, fields) {
  const data = {};
  for (const field of fields) {
    try {
      data[field] = interaction.fields.getTextInputValue(field) ?? '';
    } catch {
      data[field] = '';
    }
  }
  return data;
}

async function handleTryoutModal(interaction) {
  const step = interaction.customId.split(':').pop();

  if (step === '1') {
    const data = readModalFields(interaction, [
      'bloxstrike_username',
      'discord_username',
      'age_range',
      'region',
      'previous_clan',
    ]);
    tryoutDrafts.set(interaction.user.id, data);
    // Bound the draft cache.
    if (tryoutDrafts.size > 200) {
      tryoutDrafts.delete(tryoutDrafts.keys().next().value);
    }
    return interaction.showModal(require('../commands/clan/tryout').buildModal(2));
  }

  if (step === '2') {
    const draft = tryoutDrafts.get(interaction.user.id) ?? {};
    tryoutDrafts.delete(interaction.user.id);
    const data = { ...draft, ...readModalFields(interaction, ['main_mode', 'experience', 'strengths', 'availability']) };

    data.bloxstrike_username = bloxstrikeUsername(data.bloxstrike_username);
    data.discord_username = boundedString(data.discord_username, { max: 64, label: 'Discord username' });
    for (const field of ['age_range', 'region', 'previous_clan', 'main_mode']) {
      data[field] = boundedString(data[field], { max: 120, label: field });
    }
    data.experience = boundedString(data.experience, { min: 10, max: 1500, label: 'Experience' });
    data.strengths = boundedString(data.strengths, { min: 10, max: 1500, label: 'Strengths' });
    data.availability = boundedString(data.availability, { min: 5, max: 1500, label: 'Availability' });

    const tryout = await tryoutService.submit(interaction.client, interaction.guild, interaction.user.id, data);

    const embed = new EmbedBuilder()
      .setColor(BRAND.colors.success)
      .setTitle('Application submitted')
      .setDescription(
        `Application **#${tryout.id}** received.\n\nStaff will review it privately. You will be notified of the decision.\nCheck status with \`/tryout status\`.`,
      )
      .setFooter({ text: BRAND.footer });

    return interaction.reply({ embeds: [embed], ephemeral: true });
  }

  throw new ValidationError('Unknown application step.');
}

/** Shuffle a scrim's signed-up roster into teams (announcement button). */
async function handleScrimShuffle(interaction) {
  const id = Number(interaction.customId.split(':')[2]);
  const scrim = scrimsRepo.get(id);
  if (!scrim || String(scrim.guild_id) !== String(interaction.guild.id)) {
    return interaction.reply({ content: 'Scrim not found.', ephemeral: true });
  }
  const players = scrimsRepo.players(id);
  if (players.length < 2) {
    return interaction.reply({ content: 'At least 2 players must be signed up before shuffling.', ephemeral: true });
  }
  const formatSize = shuffleService.teamSizeFromFormat(scrim.format);
  const teams = shuffleService.shuffleTeams(players, { teamSize: formatSize ?? 5 });
  const embed = new EmbedBuilder()
    .setColor(BRAND.colors.primary)
    .setTitle('⚔️ FGx TEAM SHUFFLE')
    .setDescription(
      teams
        .map((team, i) => `**Team ${i + 1}** (${team.length})\n${team.map((p) => `<@${p}>`).join(' ')}`)
        .join('\n\n'),
    )
    .setFooter({ text: `${BRAND.footer} • Scrim vs ${scrim.opponent} • Randomly generated` });
  await interaction.reply({ embeds: [embed], ephemeral: true });
}

/** Handle the /bloxstrike + /fgx hub: select menu, back button, quick buttons. */
async function handleHub(interaction) {
  let section = null;
  if (interaction.isStringSelectMenu()) {
    section = interaction.values[0] ?? null;
  } else if (interaction.customId.startsWith('bloxstrike:btn:')) {
    section = interaction.customId.split(':')[2] ?? null;
  }
  if (interaction.isStringSelectMenu() && !section) {
    return interaction.reply({ content: 'Choose a section.', ephemeral: true });
  }
  if (section) {
    const panel = hubService.renderSection(interaction.guild, interaction.user.id, section);
    // A stale/expired hub message makes update() fail — reply with a fresh
    // panel instead so the click always does something visible.
    try {
      return await interaction.update({ embeds: panel.embeds, components: panel.components });
    } catch {
      return interaction.reply({ embeds: panel.embeds, components: panel.components });
    }
  }
  // Back button
  return interaction.update({
    embeds: [hubService.mainEmbed()],
    components: hubService.hubComponents(false),
  });
}

const configCommand = require('../commands/admin/config');

/** Config menu select → show the category panel. */
async function handleConfigMenu(interaction) {
  const category = interaction.values?.[0];
  if (!category || !configCommand.CATEGORIES[category]) {
    return interaction.reply({ content: 'Invalid category.', ephemeral: true });
  }
  const config = guildConfigRepo.get(interaction.guild.id);
  return interaction.update({
    embeds: [configCommand.categoryEmbed(interaction.guild, category, config)],
    components: [configCommand.categoryRow(category)],
  });
}

/** Config Edit button → open the key=value modal. */
async function handleConfigEdit(interaction) {
  const category = interaction.customId.split(':')[2];
  if (!configCommand.CATEGORIES[category]) {
    return interaction.reply({ content: 'Invalid category.', ephemeral: true });
  }
  return interaction.showModal(configCommand.editModal(category));
}

/** Config modal submit → apply key=value lines. */
async function handleConfigModal(interaction) {
  const category = interaction.customId.split(':')[3];
  const text = interaction.fields.getTextInputValue('config_lines');
  const applied = configCommand.applyLines(interaction.guild.id, category, text);
  const embed = new EmbedBuilder()
    .setColor(BRAND.colors.success)
    .setTitle('Configuration updated')
    .setDescription(applied.join('\n'))
    .setFooter({ text: BRAND.footer });
  return interaction.reply({ embeds: [embed], ephemeral: true });
}

/** Hub Private Server: mode select → confirm with create button. */
async function handlePrivateMode(interaction) {
  const mode = interaction.values?.[0];
  if (!mode || !privateServerService.modeInfo(mode)) {
    throw new ValidationError('Unknown match mode.');
  }
  const info = privateServerService.modeInfo(mode);
  const embed = new EmbedBuilder()
    .setColor(BRAND.colors.primary)
    .setTitle(`🎮 Confirm FGx ${info.label} server`)
    .setDescription(
      'Creating a temporary branded server with **match-chat**, **results**, **Main**, and team voice channels.\n\n' +
        'It auto-deletes after **3 hours** (staff can adjust with `/private create`). Requires Roblox verification unless you are staff.',
    )
    .setFooter({ text: BRAND.footer });
  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId(`private:create:${mode}`)
      .setStyle(ButtonStyle.Success)
      .setLabel(`Create ${info.label} server`),
    new ButtonBuilder().setCustomId('private:cancel').setStyle(ButtonStyle.Secondary).setLabel('Cancel'),
  );
  await interaction.update({ embeds: [embed], components: [row] });
}

/** Hub Private Server: create button → actually create the server. */
async function handlePrivateCreate(interaction) {
  const mode = interaction.customId.split(':')[2];
  const config = guildConfigRepo.get(interaction.guild.id);
  await interaction.deferReply({ ephemeral: true });
  try {
    const { server, invite, info } = await privateServerService.create(
      interaction.client,
      interaction.guild,
      interaction.user,
      mode,
      privateServerService.DEFAULT_HOURS,
      { member: interaction.member, config },
    );
    return interaction.editReply({
      embeds: [
        {
          color: BRAND.colors.success,
          title: `🎮 FGx ${info.label} private server ready`,
          description:
            `**${server.name}** is live for **${privateServerService.DEFAULT_HOURS}h**.\n\n` +
            `**Invite:** https://discord.gg/${invite.code}\n\n` +
            'Share it with your opponents — the server auto-deletes when the timer expires.',
          footer: { text: `${BRAND.footer} • Roblox-verified members only` },
        },
      ],
    });
  } catch (err) {
    if (['INVALID_MODE', 'GUILD_LIMIT', 'OWNER_LIMIT', 'ROBLOX_REQUIRED'].includes(err.code)) {
      return interaction.editReply({
        embeds: [{ color: BRAND.colors.warn, title: 'Private server not created', description: err.message, footer: { text: BRAND.footer } }],
      });
    }
    throw err;
  }
}

/** Hub Private Server: cancel → back to the private section panel. */
async function handlePrivateCancel(interaction) {
  const section = await hubService.renderSection(interaction.guild, interaction.user.id, 'private');
  await interaction.update({ embeds: section.embeds, components: section.components });
}

const handlers = [
  { match: 'verify:click', fn: (i) => verificationService.handleVerify(i) },
  { match: 'ticket:create', fn: (i) => ticketService.handleCreate(i) },
  { match: 'ticket:claim:', fn: (i) => ticketService.handleClaim(i) },
  { match: 'ticket:close:', fn: (i) => ticketService.handleClose(i) },
  { match: 'ticket:delete:', fn: (i) => ticketService.handleDelete(i) },
  {
    match: 'tryout:review:',
    fn: (i) => handleTryoutReview(i),
  },
  {
    match: 'event:join:',
    fn: (i) => toggleParticipation(i, eventsRepo, Number(i.customId.split(':')[2]), { join: true }),
  },
  {
    match: 'event:leave:',
    fn: (i) => toggleParticipation(i, eventsRepo, Number(i.customId.split(':')[2]), { join: false }),
  },
  {
    match: 'scrim:join:',
    fn: (i) => toggleParticipation(i, scrimsRepo, Number(i.customId.split(':')[2]), { join: true }),
  },
  {
    match: 'scrim:leave:',
    fn: (i) => toggleParticipation(i, scrimsRepo, Number(i.customId.split(':')[2]), { join: false }),
  },
  { match: 'scrim:shuffle:', fn: (i) => handleScrimShuffle(i) },
  {
    match: 'training:join:',
    fn: (i) => toggleParticipation(i, trainingRepo, Number(i.customId.split(':')[2]), { join: true }),
  },
  { match: 'bloxstrike:menu', fn: (i) => handleHub(i) },
  { match: 'bloxstrike:back', fn: (i) => handleHub(i) },
  { match: 'bloxstrike:btn:', fn: (i) => handleHub(i) },
  { match: 'roblox:start', fn: (i) => robloxService.handleStart(i) },
  { match: 'roblox:cancel', fn: (i) => robloxService.handleCancel(i) },
  {
    match: 'welcome:link',
    fn: (i) =>
      i.reply({
        embeds: [
          {
            color: 0x2ecc71,
            title: '⚔️ Link your BloxStrike account',
            description:
              'Linking your BloxStrike username puts you on the competitive roster and counts toward **full verification** (which unlocks 👑 VIP perks).\n\n' +
              '1. Run **`/link submit username:<your-name>`** here in the server\n' +
              '2. Staff verifies your username\n' +
              '3. Combined with Roblox verification you reach **fully verified** — crown badge + VIP loadouts + 250 ₣Ԡ🇽 daily\n\n' +
              'Do both verifications and the server fully unlocks for you. 🔓',
            footer: { text: 'FGx • BloxStrike Clan' },
          },
        ],
        ephemeral: true,
      }),
  },
  { match: 'private:mode', fn: (i) => handlePrivateMode(i) },
  { match: 'private:create:', fn: (i) => handlePrivateCreate(i) },
  { match: 'private:cancel', fn: (i) => handlePrivateCancel(i) },
  { match: 'roblox:submit', fn: (i) => robloxService.handleSubmit(i), modal: true },
  { match: 'roblox:check', fn: (i) => robloxService.handleCheck(i) },
  { match: 'roblox:unlink', fn: (i) => robloxService.handleUnlink(i) },
  { match: 'config:edit:modal:', fn: (i) => handleConfigModal(i), modal: true },
  { match: 'config:edit:', fn: (i) => handleConfigEdit(i) },
  { match: 'config:menu', fn: (i) => handleConfigMenu(i) },
  {
    match: 'config:back',
    fn: (i) => i.update({ embeds: [configCommand.menuEmbed()], components: [configCommand.menuRow()] }),
  },
  { match: 'tryout:apply:modal', fn: (i) => handleTryoutModal(i), modal: true },
  { match: 'help:', fn: (i) => require('../commands/utility/help').handleButton(i) },
  { match: 'giveaway:enter', fn: (i) => giveawayService.handleEnter(i) },
  { match: 'giveaway:reroll', fn: (i) => handleGiveawayReroll(i) },

  { match: 'announce:', fn: (i) => require('../commands/admin/announce').handleButton(i) },
  { match: 'announce:modal:', fn: (i) => require('../commands/admin/announce').handleModal(i), modal: true },
  { match: 'poll:', fn: (i) => handlePollButton(i) },
  { match: 'emoji:pick', fn: (i) => handleEmojiPick(i) },
  { match: 'meme:refresh', fn: (i) => require('../commands/fun/meme').handleButton(i) },
  { match: 'embed:edit', fn: (i) => require('../commands/utility/embedBuilder').handleButton(i) },
  { match: 'embed:send', fn: (i) => require('../commands/utility/embedBuilder').handleButton(i) },
  { match: 'embed:cancel', fn: (i) => require('../commands/utility/embedBuilder').handleButton(i) },
  { match: 'embed:modal', fn: (i) => require('../commands/utility/embedBuilder').handleModal(i), modal: true },
  { match: 'nitro:', fn: (i) => handleNitroButton(i) },
  { match: 'editbot:', fn: (i) => require('../commands/admin/editBot').handleButton(i) },
  { match: 'rb:', fn: (i) => require('../commands/fun/roastBattle').handleBattleButton(i) },
  { match: 'mc:', fn: (i) => handleMinecraftButton(i) },
  { match: 'rps:', fn: (i) => require('../commands/fun/rps').handleButton(i) },
  { match: 'trivia:', fn: (i) => require('../commands/fun/trivia').handleButton(i) },
];

/** Handle nitro-style buttons. */
async function handleNitroButton(interaction) {
  if (interaction.customId === 'nitro:boost') {
    const embed = new EmbedBuilder()
      .setColor(0xF47FFF)
      .setTitle('🚀 Server Boosted!')
      .setDescription(
        `**${interaction.user.username}** just boosted **${interaction.guild.name}**!\n\n` +
        `🎉 Everyone gets:\n` +
        `• 🔥 Custom emojis in all channels\n` +
        `• 🎬 Animated server banner\n` +
        `• 📊 Enhanced embed quality\n` +
        `• ⚡ Priority bot responses\n` +
        `• 🎨 Custom profile cards\n\n` +
        `*Thank you for making this server even better!* 💜`
      )
      .setThumbnail(interaction.user.displayAvatarURL({ size: 256 }))
      .setFooter({ text: `${BRAND.footer} • Nitro Boost` })
      .setTimestamp(new Date());
    return interaction.reply({ content: '@everyone', embeds: [embed] });
  }

  if (interaction.customId === 'nitro:status') {
    const embed = new EmbedBuilder()
      .setColor(0xF47FFF)
      .setTitle('✨ Nitro Status')
      .setDescription(
        `**${interaction.user.username}** has Nitro!\n\n` +
        `• 🎬 Animated Avatar\n` +
        `• 🖼️ Custom Banner\n` +
        `• 🏷️ Custom Tags\n` +
        `• 📺 4K Streaming\n` +
        `• 🎵 HD Audio\n` +
        `• 📎 500MB Uploads\n\n` +
        `*Join FGx to get Nitro perks for free!*`
      )
      .setFooter({ text: BRAND.footer })
      .setTimestamp(new Date());
    return interaction.reply({ embeds: [embed], ephemeral: true });
  }
}

/** Handle poll results button. */
async function handlePollButton(interaction) {
  return interaction.reply({ content: 'React above to vote! Results show when the poll ends.', ephemeral: true });
}

/** Handle giveaway reroll button. */
async function handleGiveawayReroll(interaction) {
  const messageId = interaction.customId.split(':')[2];
  if (!messageId) {
    return interaction.reply({ content: 'This giveaway has no data.', ephemeral: true });
  }
  const result = await giveawayService.reroll(messageId, interaction.client);
  if (!result) {
    return interaction.reply({ content: '❌ No entries to reroll from.', ephemeral: true });
  }
  await interaction.reply({
    content: `🔀 New winner: <@${result.winnerId}>! You won **${result.prize}**!`,
  });
}

/** Handle emoji pick from select menu — reply with the emoji code. */
async function handleEmojiPick(interaction) {
  const value = interaction.values[0];
  if (!value) return;
  await interaction.reply({
    content: `Copy this code to use the emoji:\n${value}`,
    ephemeral: true,
  });
}

/** Handle /minecraft buttons. */
async function handleMinecraftButton(interaction) {
  const mc = require('../services/minecraft/minecraftService');
  const { BRAND } = require('../config/constants');
  const env = require('../config/env').env;
  const parts = interaction.customId.split(':');

  // mc:start — start Aternos server
  if (parts[1] === 'start') {
    await interaction.deferReply({ ephemeral: true });
    const result = await mc.startAternos();
    const embed = new EmbedBuilder()
      .setColor(result.success ? BRAND.colors.success : BRAND.colors.danger)
      .setTitle(result.success ? '🚀 Starting Server' : '❌ Start Failed')
      .setDescription(result.message)
      .setFooter({ text: BRAND.footer });
    await interaction.editReply({ embeds: [embed] });
    if (result.success) {
      mc.startMonitor(interaction.channel, env.MC_SERVER_HOST, Number(env.MC_SERVER_PORT), 30000, 60);
    }
    return;
  }

  // mc:monitor:host:port — start monitoring
  if (parts[1] === 'monitor') {
    const host = parts[2] || env.MC_SERVER_HOST;
    const port = Number(parts[3] || env.MC_SERVER_PORT);
    if (mc.isMonitoring(interaction.channel.id)) {
      return interaction.reply({ content: '📡 Already monitoring this channel!', ephemeral: true });
    }
    mc.startMonitor(interaction.channel, host, port, 30000, 60);
    const embed = new EmbedBuilder()
      .setColor(BRAND.colors.warn)
      .setTitle('📡 Monitor Started')
      .setDescription(`Monitoring \`${host}:${port}\` every 30s. I'll notify when it's online!`)
      .setFooter({ text: BRAND.footer });
    return interaction.reply({ embeds: [embed], ephemeral: true });
  }

  // mc:refresh:host:port — re-check server status
  if (parts[1] === 'refresh') {
    await interaction.deferUpdate();
    const host = parts[2] || env.MC_SERVER_HOST;
    const port = Number(parts[3] || env.MC_SERVER_PORT);
    const result = await mc.queryServer(host, port);
    if (result.online) {
      const embed = new EmbedBuilder()
        .setColor(BRAND.colors.success)
        .setTitle('🟢 Server is ONLINE')
        .setDescription(
          `**${env.MC_SERVER_NAME}**\n\n` +
          `**IP:** \`${host}:${port}\`\n` +
          `**Version:** ${result.version}\n` +
          `**Players:** ${result.players.online}/${result.players.max}\n` +
          `**Latency:** ${result.latency}ms\n` +
          (result.motd ? `**MOTD:** ${result.motd}` : '')
        )
        .setFooter({ text: BRAND.footer })
        .setTimestamp();
      return interaction.editReply({ embeds: [embed] });
    }
    return interaction.editReply({
      embeds: [
        new EmbedBuilder()
          .setColor(BRAND.colors.danger)
          .setTitle('🔴 Still Offline')
          .setDescription(`\`${host}:${port}\` — ${result.message || 'Not responding'}`)
          .setFooter({ text: BRAND.footer }),
      ],
    });
  }

  // mc:stop-monitor
  if (parts[1] === 'stop-monitor') {
    const stopped = mc.stopMonitor(interaction.channel.id);
    return interaction.reply({
      content: stopped ? '⛔ Monitor stopped.' : 'No active monitor found.',
      ephemeral: true,
    });
  }
}

/** Route a component/modal interaction by customId prefix. */
async function route(interaction) {
  const customId = interaction.customId ?? '';
  for (const handler of handlers) {
    if (customId.startsWith(handler.match)) {
      await handler.fn(interaction);
      return;
    }
  }
  // Stale pagination buttons from an expired collector are ignored silently.
  if (customId.startsWith('pg:')) {
    await interaction.reply({ content: 'This pagination has expired. Run the command again.', ephemeral: true }).catch(() => {});
    return;
  }
  logger.warn('router: unhandled customId', { customId });
  await interaction
    .reply({ content: 'That interaction is no longer available.', ephemeral: true })
    .catch(() => {});
}

function safeParse(value, fallback) {
  try {
    return JSON.parse(value);
  } catch {
    return fallback;
  }
}

module.exports = { route };
