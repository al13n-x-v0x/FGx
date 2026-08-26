'use strict';

/* Copyright © 2026 FGx. All rights reserved. */

const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { BRAND } = require('../../config/constants');

const DICE_FACES = ['⚀', '⚁', '⚂', '⚃', '⚄', '⚅'];

function rollDice(count, sides, modifier) {
  const rolls = [];
  let total = 0;
  for (let i = 0; i < count; i++) {
    const roll = Math.floor(Math.random() * sides) + 1;
    rolls.push(roll);
    total += roll;
  }
  total += modifier;
  return { rolls, total, modifier };
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName('dice')
    .setDescription('Roll dice — supports count, sides, and modifier 🎲')
    .addStringOption((o) =>
      o
        .setName('expression')
        .setDescription('Dice expression: NdS+M (e.g. 2d6+3, d20, 4d6)')
        .setRequired(false),
    ),

  async execute(interaction) {
    const expr = (interaction.options.getString('expression') || '1d6').trim().toLowerCase();

    // Parse NdS+M format
    const match = expr.match(/^(\d*)d(\d+)([+-]\d+)?$/i);
    if (!match) {
      return interaction.reply({
        content: '❌ Invalid format! Use: `NdS+M` (e.g., `2d6`, `d20`, `4d6+2`)',
        ephemeral: true,
      });
    }

    const count = Math.min(Math.max(parseInt(match[1]) || 1, 1), 100);
    const sides = Math.min(Math.max(parseInt(match[2]) || 6, 2), 1000);
    const modifier = parseInt(match[3]) || 0;

    const { rolls, total } = rollDice(count, sides, modifier);

    const diceDisplay = rolls
      .map((r) => (sides <= 6 ? DICE_FACES[r - 1] || `**${r}**` : `**${r}**`))
      .join(' ');

    const modText = modifier > 0 ? ` + ${modifier}` : modifier < 0 ? ` - ${Math.abs(modifier)}` : '';
    const expression = count === 1 ? `d${sides}` : `${count}d${sides}`;
    const fullExpr = `${expression}${modText}`;

    let color = 0x3498db;
    if (total === sides * count) color = 0xffd700; // Natural max!
    else if (total === count) color = 0xff0000; // All 1s
    else if (count >= 2 && total >= sides * count * 0.8) color = 0x00ff00;

    const embed = new EmbedBuilder()
      .setColor(color)
      .setTitle(`🎲 Rolling ${fullExpr}`)
      .setDescription(
        `${diceDisplay}\n\n` +
        `**Result: ${total}**${modText !== ' + ' && modText !== ' - ' ? ` (${rolls.join(' + ')}${modText})` : ''}`,
      )
      .setFooter({ text: BRAND.footer })
      .setTimestamp();

    // Fun flavor text for special rolls
    if (count >= 2 && total === sides * count) {
      embed.setDescription(`${diceDisplay}\n\n🏆 **NATURAL MAX! ${total}** — Absolutely CRUSHED it!`);
    } else if (count >= 2 && total === count) {
      embed.setDescription(`${diceDisplay}\n\n💀 **ALL ONES! ${total}** — The worst roll possible...`);
    }

    await interaction.reply({ embeds: [embed] });
  },
};
