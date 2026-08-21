'use strict';

/* Copyright © 2026 FGx. All rights reserved. */

const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const { BRAND } = require('../../config/constants');

/** Subreddits to pull memes from. */
const SUBREDDITS = [
  'memes', 'dankmemes', 'me_irl', 'funny', 'MemeEconomy',
  'comedyheaven', 'terriblefacebookmemes', 'wholesomememes',
];

/** Fallback memes if Reddit fetch fails. */
const FALLBACK = [
  { title: 'When the code works on the first try', url: 'https://i.imgur.com/GfpJG3E.jpeg', sub: 'ProgrammerHumor' },
  { title: 'Monday mood', url: 'https://i.imgur.com/5kfBqfK.jpeg', sub: 'me_irl' },
  { title: 'Modern problems require modern solutions', url: 'https://i.imgur.com/zXl3jgR.jpeg', sub: 'dankmemes' },
  { title: 'The squad rolling up', url: 'https://i.imgur.com/G3U2vyw.jpeg', sub: 'memes' },
  { title: 'Nobody: ... Me at 3am:', url: 'https://i.imgur.com/SJtBpkv.jpeg', sub: 'funny' },
];

/**
 * Fetch a random meme from Reddit.
 * Uses the .json API endpoint which doesn't require auth.
 */
async function fetchMeme(subreddit) {
  const sub = subreddit || SUBREDDITS[Math.floor(Math.random() * SUBREDDITS.length)];
  try {
    const res = await fetch(
      `https://www.reddit.com/r/${sub}/hot.json?limit=25&raw_json=1`,
      {
        headers: { 'User-Agent': 'FGxBot/1.0 (Discord Bot)' },
        signal: AbortSignal.timeout(8000),
      },
    );
    if (!res.ok) return null;

    const data = await res.json();
    const posts = data?.data?.children
      ?.map(c => c.data)
      ?.filter(p => !p.stickied && p.post_hint === 'image' && p.url)
      ?? [];

    if (posts.length === 0) return null;

    const post = posts[Math.floor(Math.random() * posts.length)];
    return {
      title: post.title?.slice(0, 256) || 'Untitled meme',
      url: post.url,
      sub: post.subreddit || sub,
      author: post.author || 'Unknown',
      upvotes: post.ups || 0,
      comments: post.num_comments || 0,
      permalink: post.permalink ? `https://reddit.com${post.permalink}` : null,
    };
  } catch {
    return null;
  }
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
        text: `r/${meme.sub} • ⬆️ ${(meme.upvotes ?? 0).toLocaleString()} • 💬 ${(meme.comments ?? 0).toLocaleString()} • ${BRAND.footer}`,
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
        text: `r/${meme.sub} • ⬆️ ${(meme.upvotes ?? 0).toLocaleString()} • 💬 ${(meme.comments ?? 0).toLocaleString()} • ${BRAND.footer}`,
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
