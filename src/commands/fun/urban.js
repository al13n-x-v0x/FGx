'use strict';

/* Copyright © 2026 FGx. All rights reserved. */

const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { BRAND } = require('../../config/constants');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('urban')
    .setDescription('Look up a word on Urban Dictionary 📖')
    .addStringOption((o) =>
      o.setName('word').setDescription('Word or phrase to look up').setRequired(true),
    ),

  async execute(interaction) {
    const word = interaction.options.getString('word');

    await interaction.deferReply();

    try {
      const url = `https://api.urbandictionary.com/v0/define?term=${encodeURIComponent(word)}`;
      const resp = await fetch(url, { signal: AbortSignal.timeout(8000) });
      const data = await resp.json();

      if (!data.list || data.list.length === 0) {
        return interaction.editReply(`❌ No results found for **${word}**.`);
      }

      const def = data.list[0];
      const clean = (text) => text
        .replace(/\[/g, '')
        .replace(/\]/g, '')
        .replace(/\n/g, '\n> ')
        .slice(0, 1000);

      const embed = new EmbedBuilder()
        .setColor(0x1a1a2e)
        .setTitle(`📖 ${def.word}`)
        .setDescription(`> ${clean(def.definition)}`)
        .addFields(
          { name: '💡 Example', value: def.example ? `> ${clean(def.example)}` : '*No example*', inline: false },
          { name: '👍', value: String(def.thumbs_up || 0), inline: true },
          { name: '👎', value: String(def.thumbs_down || 0), inline: true },
        )
        .setFooter({ text: `${BRAND.footer} • Urban Dictionary • By ${def.author || 'Unknown'}` })
        .setURL(def.permalink)
        .setTimestamp();

      if (data.list.length > 1) {
        embed.setFooter({
          text: `${BRAND.footer} • +${data.list.length - 1} more definitions`,
        });
      }

      await interaction.editReply({ embeds: [embed] });
    } catch (err) {
      await interaction.editReply({
        content: `❌ Couldn't look up "${word}". ${err.message || 'Try again later.'}`,
      });
    }
  },
};
