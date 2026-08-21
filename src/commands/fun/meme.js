'use strict';

/* Copyright © 2026 FGx. All rights reserved. */

const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const { BRAND } = require('../../config/constants');

/** Working meme APIs that don't block bot requests. */
const MEME_APIS = [
  'https://meme-api.com/gimme',
  'https://meme-api.com/gimme/dankmemes',
  'https://meme-api.com/gimme/memes',
  'https://meme-api.com/gimme/me_irl',
  'https://meme-api.com/gimme/ProgrammerHumor',
  'https://meme-api.com/gimme/gaming',
  'https://meme-api.com/gimme/AnimalsBeingDerps',
];

/** Fallback memes with verified working image URLs. */
const FALLBACK = [
  { title: 'When the code works on the first try', url: 'https://i.imgur.com/GfpJG3E.jpeg', sub: 'ProgrammerHumor' },
  { title: 'Monday mood', url: 'https://i.imgur.com/5kfBqfK.jpeg', sub: 'me_irl' },
  { title: 'Modern problems require modern solutions', url: 'https://i.imgur.com/zXl3jgR.jpeg', sub: 'dankmemes' },
  { title: 'The squad rolling up', url: 'https://i.imgur.com/G3U2vyw.jpeg', sub: 'memes' },
  { title: 'Nobody: ... Me at 3am:', url: 'https://i.imgur.com/SJtBpkv.jpeg', sub: 'funny' },
  { title: 'Brain level 100', url: 'https://i.imgur.com/KzVJn.jpeg', sub: 'dankmemes' },
  { title: 'Task failed successfully', url: 'https://i.imgur.com/B3B3nGb.jpeg', sub: 'ProgrammerHumor' },
  { title: 'When you finally fix the bug', url: 'https://i.imgur.com/5wT4dTc.jpeg', sub: 'me_irl' },
];

/**
 * Fetch a random meme from meme-api.com.
 * This API is free, requires no auth, and doesn't block bot requests.
 */
async function fetchMeme(subreddit) {
  // If user specified a subreddit, try that specific endpoint
  const apis = subreddit
    ? [`https://meme-api.com/gimme/${subreddit}`]
    : MEME_APIS;

  for (const apiUrl of apis) {
    try {
      const res = await fetch(apiUrl, {
        headers: { 'User-Agent': 'FGxBot/1.0' },
        signal: AbortSignal.timeout(8000),
      });
      if (!res.ok) continue;

      const data = await res.json();
      if (!data || !data.url) continue;

      // Verify it's an image URL
      if (!/\.(jpe?g|png|gif|webp)/i.test(data.url) && !data.url.includes('i.redd.it') && !data.url.includes('i.imgur.com')) {
        continue;
      }

      return {
        title: data.title?.slice(0, 256) || 'Random meme',
        url: data.url,
        sub: data.subreddit || subreddit || 'memes',
        author: data.author || 'Unknown',
        upvotes: data.ups || data.ups_from ? data.ups_from : 0,
        comments: 0,
        permalink: data.postLink || null,
      };
    } catch (err) {
      console.log(`[meme] Failed to fetch from ${apiUrl}:`, err.message);
      continue;
    }
  }

  return null;
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName('meme')
    .setDescription('Get a random meme from Reddit 🖼️')
    .addStringOption(opt =>
      opt.setName('subreddit')
        .setDescription('Specific subreddit (leave empty for random)')
        .setRequired(false)),

  async execute(interaction) {
    const subreddit = interaction.options.getString('subreddit');
    await interaction.deferReply();

    const meme = await fetchMeme(subreddit) || FALLBACK[Math.floor(Math.random() * FALLBACK.length)];

    const embed = new EmbedBuilder()
      .setColor(BRAND.colors.primary)
      .setTitle(meme.title)
      .setImage(meme.url)
      .setFooter({
        text: `r/${meme.sub} • ⬆️ ${(meme.upvotes ?? 0).toLocaleString()} • ${BRAND.footer}`,
      })
      .setTimestamp(new Date());

    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setLabel('View on Reddit')
        .setURL(meme.permalink || `https://reddit.com/r/${meme.sub}`)
        .setStyle(ButtonStyle.Link),
      new ButtonBuilder()
        .setCustomId('meme:refresh')
        .setLabel('🔄 Another one!')
        .setStyle(ButtonStyle.Secondary),
    );

    await interaction.editReply({ embeds: [embed], components: [row] });
  },

  /** Handle the "Another one!" button. */
  async handleButton(interaction) {
    await interaction.deferUpdate();
    const meme = await fetchMeme() || FALLBACK[Math.floor(Math.random() * FALLBACK.length)];

    const embed = new EmbedBuilder()
      .setColor(BRAND.colors.primary)
      .setTitle(meme.title)
      .setImage(meme.url)
      .setFooter({
        text: `r/${meme.sub} • ⬆️ ${(meme.upvotes ?? 0).toLocaleString()} • ${BRAND.footer}`,
      })
      .setTimestamp(new Date());

    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setLabel('View on Reddit')
        .setURL(meme.permalink || `https://reddit.com/r/${meme.sub}`)
        .setStyle(ButtonStyle.Link),
      new ButtonBuilder()
        .setCustomId('meme:refresh')
        .setLabel('🔄 Another one!')
        .setStyle(ButtonStyle.Secondary),
    );

    await interaction.editReply({ embeds: [embed], components: [row] });
  },
};
