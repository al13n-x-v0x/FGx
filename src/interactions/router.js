'use strict';

/*
 * Copyright © 2026 FGx.
 * All rights reserved.
 */

const { EmbedBuilder } = require('discord.js');
const { BRAND } = require('../config/constants');
const verificationService = require('../services/community/verificationService');
const ticketService = require('../services/tickets/ticketService');
const tryoutService = require('../services/clan/tryoutService');
const rosterService = require('../services/clan/rosterService');
const hubService = require('../services/clan/hubService');
const { guildConfigRepo } = require('../database/repos/guildConfig');
const { eventsRepo, scrimsRepo, trainingRepo } = require('../database/repos/competitive');
const participation = require('../services/clan/participation');
const shuffleService = require('../services/clan/shuffleService');
const { logAudit } = require('../services/logging/auditLogger');
const { logger } = require('../utils/logger');
const { bloxstrikeUsername, boundedString } = require('../utils/validate');
const { ValidationError } = require('../utils/errors');

/** Toggle a user in/out of an announcement-backed participation list. */
async function toggleParticipation(interaction, repo, rowId, { join }) {
  const kind = repo === eventsRepo ? 'events' : repo === scrimsRepo ? 'scrims' : 'training';
  const result = await participation.toggle(interaction.client, interaction, repo, kind, rowId, { join });
  if (!result.changed) {
    const text = {
      'already-joined': 'You are already signed up.',
      'not-joined': 'You are not on that list.',
      full: 'That listing is full.',
    }[result.reason];
    return interaction.reply({ content: text, ephemeral: true });
  }
  return interaction.reply({
    content: result.reason === 'joined' ? `You joined. **${result.participants.length}** total.` : `You left. **${result.participants.length}** total.`,
    ephemeral: true,
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

  await interaction.update({ embeds: [embed], components: [] });

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

/** Handle the /bloxstrike hub select menu + back button. */
async function handleHub(interaction) {
  const section = interaction.isStringSelectMenu() ? interaction.values[0] : null;
  if (interaction.isStringSelectMenu() && !section) {
    return interaction.reply({ content: 'Choose a section.', ephemeral: true });
  }
  if (section) {
    const panel = hubService.renderSection(interaction.guild, interaction.user.id, section);
    return interaction.update({ embeds: panel.embeds, components: panel.components });
  }
  // Back button
  return interaction.update({ embeds: [hubService.mainEmbed()], components: [hubService.navRow(false)] });
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
  { match: 'config:edit:modal:', fn: (i) => handleConfigModal(i), modal: true },
  { match: 'config:edit:', fn: (i) => handleConfigEdit(i) },
  { match: 'config:menu', fn: (i) => handleConfigMenu(i) },
  {
    match: 'config:back',
    fn: (i) => i.update({ embeds: [configCommand.menuEmbed()], components: [configCommand.menuRow()] }),
  },
  { match: 'tryout:apply:modal', fn: (i) => handleTryoutModal(i), modal: true },
];

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
