'use strict';

/* Copyright © 2026 FGx. All rights reserved. */

const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const { BRAND } = require('../../config/constants');

const NUMBERS = ['1️⃣', '2️⃣', '3️⃣', '4️⃣', '5️⃣', '6️⃣', '7️⃣', '8️⃣', '9️⃣', '🔟'];

module.exports = {
  data: new SlashCommandBuilder()
    .setName('poll')
    .setDescription('Create an interactive poll with voting')
    .addStringOption(opt =>
      opt.setName('question').setDescription('The poll question').setRequired(true))
    .addStringOption(opt =>
      opt.setName('options').setDescription('Options separated by | (e.g. "Option 1|Option 2|Option 3")'))
    .addIntegerOption(opt =>
      opt.setName('duration').setDescription('Duration in minutes (0 = no timer)')
        .setMinValue(0).setMaxValue(10080)),

  async execute(interaction) {
    const question = interaction.options.getString('question');
    const optionsRaw = interaction.options.getString('options');
    const duration = interaction.options.getInteger('duration') ?? 0;

    let options;
    if (optionsRaw) {
      options = optionsRaw.split('|').map(o => o.trim()).filter(Boolean);
      if (options.length < 2) {
        return interaction.reply({ content: '❌ Provide at least 2 options separated by `|`.', ephemeral: true });
      }
      if (options.length > 10) {
        return interaction.reply({ content: '❌ Maximum 10 options allowed.', ephemeral: true });
      }
    } else {
      options = ['Yes', 'No'];
    }

    const desc = options.map((opt, i) => `${NUMBERS[i]} **${opt}**`).join('\n');
    const endsText = duration > 0
      ? `\n\n⏰ Ends <t:${Math.floor((Date.now() + duration * 60000) / 1000)}:R>`
      : '\n\n*React below to vote!*';

    const embed = new EmbedBuilder()
      .setColor(BRAND.colors.primary)
      .setTitle(`📊 ${question}`)
      .setDescription(desc + endsText)
      .setFooter({ text: `Poll by ${interaction.user.tag} • FGx`, iconURL: interaction.user.displayAvatarURL() })
      .setTimestamp(new Date());

    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId('poll:results')
        .setStyle(ButtonStyle.Secondary)
        .setLabel('📊 Show Results')
        .setEmoji('📊'),
    );

    const msg = await interaction.reply({ embeds: [embed], components: [row], fetchReply: true });

    // Add number reactions
    for (let i = 0; i < options.length; i++) {
      await msg.react(NUMBERS[i]).catch(() => {});
    }

    // Auto-end after duration
    if (duration > 0) {
      setTimeout(async () => {
        try {
          const fresh = await interaction.channel.messages.fetch(msg.id).catch(() => null);
          if (!fresh) return;

          const results = options.map((opt, i) => {
            const reaction = fresh.reactions.cache.get(NUMBERS[i]);
            const count = (reaction?.count ?? 1) - 1; // subtract bot's reaction
            return { option: opt, votes: Math.max(0, count) };
          });

          const totalVotes = results.reduce((sum, r) => sum + r.votes, 0);
          const maxVotes = Math.max(...results.map(r => r.votes));

          const resultDesc = results
            .sort((a, b) => b.votes - a.votes)
            .map((r, rank) => {
              const pct = totalVotes > 0 ? Math.round((r.votes / totalVotes) * 100) : 0;
              const bar = '█'.repeat(Math.round(pct / 10)) + '░'.repeat(10 - Math.round(pct / 10));
              const medal = rank === 0 && r.votes > 0 ? ' 🏆' : '';
              return `${bar} **${r.votes}** votes (${pct}%) — ${r.option}${medal}`;
            })
            .join('\n');

          const endedEmbed = new EmbedBuilder()
            .setColor(BRAND.colors.warn)
            .setTitle(`📊 Poll Ended: ${question}`)
            .setDescription(`**Results** (${totalVotes} total votes):\n\n${resultDesc}`)
            .setFooter({ text: `Poll by ${interaction.user.tag} • FGx` })
            .setTimestamp(new Date());

          await fresh.edit({ embeds: [endedEmbed], components: [] }).catch(() => {});
        } catch { /* silent */ }
      }, duration * 60000);
    }
  },
};
