'use strict';

/* Copyright © 2026 FGx. All rights reserved. */

const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, StringSelectMenuBuilder } = require('discord.js');
const { BRAND } = require('../../config/constants');

const TRIVIA_BANK = [
  { q: 'What does "GG" stand for?', options: ['Good Game', 'Great Going', 'Go Go', 'Get Going'], answer: 0 },
  { q: 'In Minecraft, what mob explodes?', options: ['Zombie', 'Skeleton', 'Creeper', 'Spider'], answer: 2 },
  { q: 'What is the most popular game on Roblox (2024)?', options: ['Brookhaven', 'Adopt Me', 'Blox Fruits', 'Tower of Hell'], answer: 2 },
  { q: 'What year was Discord founded?', options: ['2014', '2015', '2016', '2017'], answer: 1 },
  { q: 'What does "AFK" mean?', options: ['Away From Keyboard', 'Always Fun Key', 'A Free Kill', 'Another Free Kill'], answer: 0 },
  { q: 'In FPS games, what is a "clutch"?', options: ['Losing badly', 'Winning a 1vX situation', 'A team strategy', 'A weapon type'], answer: 1 },
  { q: 'What does "FPS" stand for?', options: ['Fast Play System', 'Frames Per Second', 'First Person Shooter', 'Both B and C'], answer: 3 },
  { q: 'What is the max level in most BloxStrike competitive modes?', options: ['50', '100', 'Level varies', 'There is no max'], answer: 3 },
  { q: 'Which platform is FGx primarily a clan for?', options: ['PC', 'Mobile', 'Roblox/BloxStrike', 'Console'], answer: 2 },
  { q: 'What is "tilting" in competitive gaming?', options: ['Playing better under pressure', 'Getting frustrated and playing worse', 'A specific game mechanic', 'Team communication'], answer: 1 },
  { q: 'What does "meta" mean in gaming?', options: ['Most Effective Tactic Available', 'A game mode', 'A character class', 'Meta gaming'], answer: 0 },
  { q: 'In BloxStrike, what is an "eco round"?', options: ['A round with full buy', 'A round where you save money', 'A round with only pistols', 'An environmental round'], answer: 1 },
  { q: 'What is "game sense" in FPS games?', options: ['Reaction time', 'Game awareness and decision making', 'Aim accuracy', 'Movement speed'], answer: 1 },
  { q: 'What does "Nerf" mean in gaming?', options: ['Making something stronger', 'Making something weaker', 'A type of weapon', 'A bug fix'], answer: 1 },
  { q: 'What is "entry fragging"?', options: ['Being the last alive', 'Being the first into a site/area to get kills', 'A frag grenade', 'Fragging teammates'], answer: 1 },
  { q: 'What does "GGWP" mean?', options: ['Good Game Well Played', 'Great Game Win Please', 'Go Go Win Play', 'Good Gaming Win Points'], answer: 0 },
  { q: 'What is "map control" in competitive?', options: ['Controlling the minimap', 'Holding key positions on the map', 'Changing maps mid-game', 'Map downloading'], answer: 1 },
  { q: 'In Roblox, what does "UGC" stand for?', options: ['User Generated Content', 'Universal Game Code', 'United Gaming Club', 'Ultimate Game Currency'], answer: 0 },
  { q: 'What does "ACE" mean in competitive games?', options: ['Winning a round solo', 'A specific card game', 'Best player of the match', 'A rank'], answer: 0 },
  { q: 'What is "peeking" in FPS games?', options: ['Looking at the scoreboard', 'Quickly exposing yourself to shoot then hiding', 'Playing passively', 'Watching replays'], answer: 1 },
  { q: 'What does "OP" mean in gaming?', options: ['Over Powered', 'Online Player', 'Open Party', 'Official Patch'], answer: 0 },
  { q: 'What is "stratting" in competitive gaming?', options: ['Trash talking', 'Planning strategies', 'Playing ranked', 'Streaming'], answer: 1 },
  { q: 'In Minecraft, what is the rarest ore?', options: ['Diamond', 'Emerald', 'Netherite', 'Gold'], answer: 1 },
  { q: 'What does "smurf" mean in gaming?', options: ['A small character', 'A high-ranked player on a new account', 'A friendly player', 'A bad player'], answer: 1 },
  { q: 'What does "throwing" mean?', options: ['Using grenades', 'Intentionally losing a match', 'Lagging out', 'Changing loadout'], answer: 1 },
];

const NUMBERS = ['1️⃣', '2️⃣', '3️⃣', '4️⃣'];

module.exports = {
  data: new SlashCommandBuilder()
    .setName('trivia')
    .setDescription('Test your gaming knowledge with a trivia question!'),

  async execute(interaction) {
    const trivia = TRIVIA_BANK[Math.floor(Math.random() * TRIVIA_BANK.length)];

    const desc = trivia.options
      .map((opt, i) => `${NUMBERS[i]} **${opt}**`)
      .join('\n');

    const embed = new EmbedBuilder()
      .setColor(BRAND.colors.primary)
      .setTitle('🧠 Trivia Time!')
      .setDescription(trivia.q + '\n\n' + desc)
      .setFooter({ text: `${BRAND.footer} • You have 30 seconds` })
      .setTimestamp(new Date());

    const row = new ActionRowBuilder().addComponents(
      new StringSelectMenuBuilder()
        .setCustomId(`trivia:${trivia.answer}`)
        .setPlaceholder('Pick your answer...')
        .addOptions(
          trivia.options.map((opt, i) => ({
            label: opt,
            value: String(i),
            emoji: NUMBERS[i],
          })),
        ),
    );

    await interaction.reply({ embeds: [embed], components: [row], fetchReply: true });
  },

  /** Handle select menu answer */
  async handleButton(interaction) {
    const correctIdx = parseInt(interaction.customId.split(':')[1], 10);
    const chosenIdx = parseInt(interaction.values[0], 10);
    const isCorrect = chosenIdx === correctIdx;

    const trivia = TRIVIA_BANK.find((t) => t.options[correctIdx] !== undefined) || TRIVIA_BANK[0];

    const color = isCorrect ? BRAND.colors.success : BRAND.colors.danger;
    const title = isCorrect ? '✅ Correct!' : '❌ Wrong!';
    const desc = isCorrect
      ? `The answer was **${trivia.options[correctIdx]}**`
      : `The answer was **${trivia.options[correctIdx]}**, not **${trivia.options[chosenIdx]}**`;

    const embed = new EmbedBuilder()
      .setColor(color)
      .setTitle(title)
      .setDescription(desc)
      .setFooter({ text: BRAND.footer })
      .setTimestamp(new Date());

    await interaction.update({ embeds: [embed], components: [] });
  },
};
