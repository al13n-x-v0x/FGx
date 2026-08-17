'use strict';

/*
 * Copyright © 2026 FGx.
 * All rights reserved.
 */

const {
  SlashCommandBuilder,
  EmbedBuilder,
  ActionRowBuilder,
  TextInputBuilder,
  TextInputStyle,
  ModalBuilder,
  ButtonBuilder,
  ButtonStyle,
} = require('discord.js');
const { BRAND } = require('../../config/constants');
const { guildConfigRepo } = require('../../database/repos/guildConfig');
const { tryoutsRepo } = require('../../database/repos/community');
const rosterService = require('../../services/clan/rosterService');
const { ValidationError } = require('../../utils/errors');

/** Build one step of the two-part application modal. */
function buildModal(step) {
  const fieldsByStep = {
    1: [
      ['bloxstrike_username', 'BloxStrike username', 'Your in-game name', TextInputStyle.Short, true],
      ['discord_username', 'Discord username', 'e.g. player#0000', TextInputStyle.Short, true],
      ['age_range', 'Age range', 'e.g. 13-15, 16-18, 19+', TextInputStyle.Short, true],
      ['region', 'Region / timezone', 'e.g. EU / UTC+2', TextInputStyle.Short, true],
      ['previous_clan', 'Previous clan (if any)', 'Write "none" if you are new', TextInputStyle.Short, false],
    ],
    2: [
      ['main_mode', 'Main game mode', 'e.g. Ranked, Tournament, Casual', TextInputStyle.Short, true],
      ['experience', 'Experience', 'How long have you played? Any competitive background?', TextInputStyle.Paragraph, true],
      ['strengths', 'Strengths', 'What do you bring to FGx?', TextInputStyle.Paragraph, true],
      ['availability', 'Availability', 'When can you attend scrims / training?', TextInputStyle.Paragraph, true],
    ],
  };

  const modal = new ModalBuilder()
    .setCustomId(`tryout:apply:modal:${step}`)
    .setTitle(`FGx Tryout Application — Part ${step}/2`);

  for (const [id, label, placeholder, style, required] of fieldsByStep[step]) {
    modal.addComponents(
      new ActionRowBuilder().addComponents(
        new TextInputBuilder()
          .setCustomId(id)
          .setLabel(label)
          .setPlaceholder(placeholder)
          .setStyle(style)
          .setRequired(required)
          .setMaxLength(style === TextInputStyle.Paragraph ? 1500 : 120),
      ),
    );
  }
  return modal;
}

/** Open the application modal (used by /tryout apply and /clan apply). */
async function handleApplyOpen(interaction) {
  return interaction.showModal(buildModal(1));
}

function reviewEmbed(tryout) {
  const data = safeParse(tryout.data, {});
  const embed = new EmbedBuilder()
    .setColor(BRAND.colors.primary)
    .setTitle(`FGx Tryout Application #${tryout.id}`)
    .setDescription(
      `**Applicant:** <@${tryout.user_id}>\n` +
        `**Status:** ${tryout.status.toUpperCase()}\n` +
        `**Submitted:** ${tryout.created_at}\n\n` +
        `**BloxStrike:** ${data.bloxstrike_username ?? '—'}\n` +
        `**Discord:** ${data.discord_username ?? '—'}\n` +
        `**Age range:** ${data.age_range ?? '—'}\n` +
        `**Region:** ${data.region ?? '—'}\n` +
        `**Previous clan:** ${data.previous_clan ?? '—'}\n` +
        `**Main mode:** ${data.main_mode ?? '—'}\n\n` +
        `**Experience**\n${data.experience ?? '—'}\n\n` +
        `**Strengths**\n${data.strengths ?? '—'}\n\n` +
        `**Availability**\n${data.availability ?? '—'}` +
        (tryout.notes ? `\n\n**Staff notes:** ${tryout.notes}` : ''),
    )
    .setFooter({ text: `${BRAND.footer} • Private — staff only` });
  return embed;
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName('tryout')
    .setDescription('FGx tryout applications.')
    .addSubcommand((s) => s.setName('apply').setDescription('Start a tryout application'))
    .addSubcommand((s) => s.setName('status').setDescription('Check your application status'))
    .addSubcommand((s) =>
      s
        .setName('review')
        .setDescription('Review an application (staff)')
        .addIntegerOption((o) => o.setName('id').setDescription('Application ID').setRequired(true)),
    )
    .addSubcommand((s) =>
      s
        .setName('list')
        .setDescription('List applications (staff)')
        .addStringOption((o) => o.setName('status').setDescription('Filter by status').addChoices(
          { name: 'Pending', value: 'pending' },
          { name: 'Trial', value: 'trial' },
          { name: 'Accepted', value: 'accepted' },
          { name: 'Rejected', value: 'rejected' },
        )),
    ),
  async execute(interaction) {
    const sub = interaction.options.getSubcommand();
    const config = guildConfigRepo.get(interaction.guild.id);

    if (sub === 'apply') return handleApplyOpen(interaction);

    if (sub === 'status') {
      const mine = tryoutsRepo
        .list(interaction.guild.id)
        .filter((t) => String(t.user_id) === String(interaction.user.id));
      if (mine.length === 0) {
        return interaction.reply({ content: 'You have no applications. Use `/tryout apply` to start one.', ephemeral: true });
      }
      const embed = new EmbedBuilder()
        .setColor(BRAND.colors.primary)
        .setTitle('Your applications')
        .setDescription(
          mine
            .map((t) => `**#${t.id}** — ${t.status.toUpperCase()} (${t.created_at})`)
            .join('\n'),
        )
        .setFooter({ text: BRAND.footer });
      return interaction.reply({ embeds: [embed], ephemeral: true });
    }

    // Staff-only from here.
    rosterService.requireStaff(interaction.member, config);

    if (sub === 'review') {
      const id = interaction.options.getInteger('id', true);
      const tryout = tryoutsRepo.get(id);
      if (!tryout || String(tryout.guild_id) !== String(interaction.guild.id)) {
        throw new ValidationError(`No application with ID \`${id}\` in this server.`);
      }
      const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId(`tryout:review:${id}:accept`).setStyle(ButtonStyle.Success).setLabel('Accept'),
        new ButtonBuilder().setCustomId(`tryout:review:${id}:reject`).setStyle(ButtonStyle.Danger).setLabel('Reject'),
        new ButtonBuilder().setCustomId(`tryout:review:${id}:trial`).setStyle(ButtonStyle.Primary).setLabel('Trial'),
        new ButtonBuilder().setCustomId(`tryout:review:${id}:info`).setStyle(ButtonStyle.Secondary).setLabel('Request Info'),
      );
      return interaction.reply({ embeds: [reviewEmbed(tryout)], components: [row], ephemeral: true });
    }

    if (sub === 'list') {
      const status = interaction.options.getString('status') ?? null;
      const list = tryoutsRepo.list(interaction.guild.id, status);
      const embed = new EmbedBuilder()
        .setColor(BRAND.colors.primary)
        .setTitle(`FGx Applications (${status ?? 'all'})`)
        .setDescription(
          list.length === 0
            ? 'No applications found.'
            : list
                .slice(0, 20)
                .map((t) => {
                  const data = safeParse(t.data, {});
                  return `**#${t.id}** <@${t.user_id}> — ${data.bloxstrike_username ?? '—'} • ${t.status.toUpperCase()}`;
                })
                .join('\n'),
        )
        .setFooter({ text: `${BRAND.footer} • /tryout review <id>` });
      return interaction.reply({ embeds: [embed], ephemeral: true });
    }
  },
  buildModal,
  handleApplyOpen,
  reviewEmbed,
};

function safeParse(value, fallback) {
  try {
    return JSON.parse(value);
  } catch {
    return fallback;
  }
}
