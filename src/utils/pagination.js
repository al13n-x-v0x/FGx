'use strict';

/*
 * Copyright © 2026 FGx.
 * All rights reserved.
 */

const { ActionRowBuilder, ButtonBuilder, ButtonStyle, ComponentType } = require('discord.js');

/**
 * Message pagination over an array of page embeds.
 * Returns the paginated message; buttons update the embed in place.
 *
 * @param {import('discord.js').Interaction} interaction
 * @param {import('discord.js').EmbedBuilder[]} pages
 * @param {object} [options]
 * @param {string} [options.customIdPrefix]
 * @param {number} [options.timeoutMs]
 */
async function paginate(interaction, pages, { customIdPrefix = 'pg', timeoutMs = 120_000 } = {}) {
  if (pages.length <= 1) {
    const content = pages[0];
    if (interaction.deferred || interaction.replied) {
      return interaction.editReply({ embeds: [content] });
    }
    return interaction.reply({ embeds: [content] });
  }

  const prefix = `${customIdPrefix}:`;
  let index = 0;

  const render = (pageIndex) => {
    const embed = pages[pageIndex];
    const total = pages.length;
    embed.setFooter({ text: `FGx • BloxStrike Clan • Page ${pageIndex + 1} of ${total}` });
    return embed;
  };

  const buttons = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId(`${prefix}prev`).setStyle(ButtonStyle.Secondary).setEmoji('◀️'),
    new ButtonBuilder()
      .setCustomId(`${prefix}page`)
      .setStyle(ButtonStyle.Secondary)
      .setLabel(`${index + 1}/${pages.length}`)
      .setDisabled(true),
    new ButtonBuilder().setCustomId(`${prefix}next`).setStyle(ButtonStyle.Secondary).setEmoji('▶️'),
  );

  const replyOptions = { embeds: [render(0)], components: [buttons] };
  if (interaction.deferred || interaction.replied) {
    await interaction.editReply(replyOptions);
  } else {
    await interaction.reply(replyOptions);
  }

  const message = interaction.deferred || interaction.replied
    ? await interaction.fetchReply()
    : await interaction.fetchReply();

  const collector = message.createMessageComponentCollector({
    componentType: ComponentType.Button,
    time: timeoutMs,
    filter: (i) => i.user.id === interaction.user.id && i.customId.startsWith(prefix),
  });

  collector.on('collect', async (i) => {
    if (i.customId.endsWith('prev')) index = (index - 1 + pages.length) % pages.length;
    if (i.customId.endsWith('next')) index = (index + 1) % pages.length;
    const next = render(index);
    buttons.components[1].setLabel(`${index + 1}/${pages.length}`);
    await i.update({ embeds: [next], components: [buttons] });
  });

  collector.on('end', async () => {
    buttons.components.forEach((b) => b.setDisabled(true));
    try {
      await message.edit({ components: [buttons] }).catch(() => {});
    } catch {
      /* message may already be gone */
    }
  });

  return message;
}

module.exports = { paginate };
