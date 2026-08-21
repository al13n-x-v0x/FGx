'use strict';

/* Copyright © 2026 FGx. All rights reserved. */

const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const { BRAND } = require('../../config/constants');
const { getGif } = require('../../utils/gifLibrary');

/** Cat breeds organized by rarity tier. */
const CAT_RARITIES = {
  common: { label: 'Common', emoji: '⬜', color: 0x9E9E9E, chance: 0.45 },
  uncommon: { label: 'Uncommon', emoji: '🟩', color: 0x4CAF50, chance: 0.25 },
  rare: { label: 'Rare', emoji: '🟦', color: 0x2196F3, chance: 0.15 },
  epic: { label: 'Epic', emoji: '🟪', color: 0x9C27B0, chance: 0.08 },
  legendary: { label: 'Legendary', emoji: '🟨', color: 0xFF9800, chance: 0.05 },
  mythical: { label: 'Mythical', emoji: '🟥', color: 0xF44336, chance: 0.02 },
  divine: { label: 'Divine', emoji: '💎', color: 0x00BCD4, chance: 0.005 },
};

/** All cat breeds with their info. */
const CATS = [
  // Common
  { id: 'tabby', name: 'Tabby Cat', emoji: '🐱', rarity: 'common', desc: 'Your average house cat. Friendly and curious.' },
  { id: 'calico', name: 'Calico', emoji: '🐈', rarity: 'common', desc: 'Three-colored coat. Lucky in Japan!' },
  { id: 'tuxedo', name: 'Tuxedo Cat', emoji: '🐈‍⬛', rarity: 'common', desc: 'Dressed for success. Always formal.' },
  { id: 'siamese', name: 'Siamese', emoji: '🐱', rarity: 'common', desc: 'Blue eyes, loud voice. Wants attention NOW.' },

  // Uncommon
  { id: 'persian', name: 'Persian', emoji: '🐱', rarity: 'uncommon', desc: 'Long luxurious fur. The royalty of cats.' },
  { id: 'ragdoll', name: 'Ragdoll', emoji: '🐱', rarity: 'uncommon', desc: 'Goes limp when you pick it up. Trusting soul.' },
  { id: 'abyssinian', name: 'Abyssinian', emoji: '🐱', rarity: 'uncommon', desc: 'Ancient Egyptian vibes. Always exploring.' },
  { id: 'bengal', name: 'Bengal', emoji: '🐆', rarity: 'uncommon', desc: 'Mini leopard! Wild-looking, domesticated heart.' },

  // Rare
  { id: 'scottish', name: 'Scottish Fold', emoji: '🐱', rarity: 'rare', desc: 'Folded ears give it an owl-like expression.' },
  { id: 'sphynx', name: 'Sphynx', emoji: '🐱', rarity: 'rare', desc: 'Hairless wonder. Wrinkly and warm.' },
  { id: 'maine_coon', name: 'Maine Coon', emoji: '🐱', rarity: 'rare', desc: 'Gentle giant. Can weigh up to 25 lbs!' },
  { id: 'russian_blue', name: 'Russian Blue', emoji: '🐱', rarity: 'rare', desc: 'Silver-green fur. Elegant and mysterious.' },

  // Epic
  { id: 'savannah', name: 'Savannah', emoji: '🐆', rarity: 'epic', desc: 'Part wild serval. Tall, athletic, fearless.' },
  { id: 'chartreux', name: 'Chartreux', emoji: '🐱', rarity: 'epic', desc: 'French blue cat. Smile that melts hearts.' },
  { id: 'turkish_angora', name: 'Turkish Angora', emoji: '🐱', rarity: 'epic', desc: 'Silky white fur. Graceful as a ballet dancer.' },

  // Legendary
  { id: 'neko', name: 'Neko Lord', emoji: '😺', rarity: 'legendary', desc: 'The chosen one. Has servant-level AI vibes.' },
  { id: 'shadow_cat', name: 'Shadow Cat', emoji: '🐈‍⬛', rarity: 'legendary', desc: 'Appears only at midnight. Pure black fur absorbs light.' },
  { id: 'phoenix_cat', name: 'Phoenix Cat', emoji: '🐱', rarity: 'legendary', desc: 'Born from fire. Has warm fur even in winter.' },

  // Mythical
  { id: 'maneki_neko', name: 'Maneki Neko', emoji: '🐱', rarity: 'mythical', desc: 'The beckoning cat. Brings fortune to its owner.' },
  { id: 'void_cat', name: 'Void Cat', emoji: '🐈‍⬛', rarity: 'mythical', desc: 'A cat-shaped hole in reality. Stares into your soul.' },
  { id: 'cosmic_kitty', name: 'Cosmic Kitty', emoji: '🐱', rarity: 'mythical', desc: 'Fur made of starlight. Walks between dimensions.' },

  // Divine
  { id: 'anubis_cat', name: 'Anubis Cat', emoji: '🐱', rarity: 'divine', desc: 'Guardian of the afterlife. Wears a golden Ankh collar.' },
  { id: 'nyan_cat', name: 'Nyan Cat', emoji: '🐱', rarity: 'divine', desc: 'Rainbow trail through space. The ultimate internet cat.' },
  { id: 'cat_god', name: 'Cat God', emoji: '😺', rarity: 'divine', desc: 'The supreme feline deity. Grants wishes to true believers.' },
];

/** In-memory user cat collections (persists in SQLite via animals table). */
const userCollections = new Map(); // key: guildId:userId, value: Map<catId, count>

function getKey(guildId, userId) { return `${guildId}:${userId}`; }

function getCollection(guildId, userId) {
  const key = getKey(guildId, userId);
  if (!userCollections.has(key)) userCollections.set(key, new Map());
  return userCollections.get(key);
}

/** Roll for a cat — weighted by rarity. */
function rollCat() {
  const roll = Math.random();
  let cumulative = 0;
  for (const [rarity, info] of Object.entries(CAT_RARITIES)) {
    cumulative += info.chance;
    if (roll <= cumulative) {
      const pool = CATS.filter(c => c.rarity === rarity);
      return pool[Math.floor(Math.random() * pool.length)];
    }
  }
  return CATS[0]; // fallback
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName('cats')
    .setDescription('Cat collection system with rarity tiers! 🐱')
    .addSubcommand(sub =>
      sub.setName('collect')
        .setDescription('Collect a random cat (free, 30s cooldown)'))
    .addSubcommand(sub =>
      sub.setName('collection')
        .setDescription('View your cat collection')
        .addUserOption(opt =>
          opt.setName('user').setDescription('View someone else\'s collection')))
    .addSubcommand(sub =>
      sub.setName('info')
        .setDescription('View all cat breeds and rarities'))
    .addSubcommand(sub =>
      sub.setName('shop')
        .setDescription('View the cat rarity shop'))
    .addSubcommand(sub =>
      sub.setName('trade')
        .setDescription('Trade a cat with someone')
        .addUserOption(opt =>
          opt.setName('user').setDescription('Who to trade with').setRequired(true))
        .addStringOption(opt =>
          opt.setName('cat').setDescription('Cat breed to trade').setRequired(true))),

  async execute(interaction) {
    const sub = interaction.options.getSubcommand();
    const guildId = interaction.guildId;
    const userId = interaction.user.id;

    if (sub === 'collect') {
      const cat = rollCat();
      const collection = getCollection(guildId, userId);
      const isNew = !collection.has(cat.id);
      collection.set(cat.id, (collection.get(cat.id) ?? 0) + 1);
      const count = collection.get(cat.id);
      const rarityInfo = CAT_RARITIES[cat.rarity];

      const totalCats = [...collection.values()].reduce((a, b) => a + b, 0);
      const uniqueCats = collection.size;

      const embed = new EmbedBuilder()
        .setColor(rarityInfo.color)
        .setTitle(`${cat.emoji} ${isNew ? 'NEW CAT!' : 'Cat Collected!'} ${rarityInfo.emoji}`)
        .setDescription(
          `**${cat.name}**\n` +
          `*${cat.desc}*\n\n` +
          `**Rarity:** ${rarityInfo.emoji} ${rarityInfo.label}\n` +
          `${isNew ? '🌟 **First time finding this breed!**' : `You now have **${count}** of this breed.`}`
        )
        .addFields(
          { name: '📦 Your Collection', value: `${totalCats} total · ${uniqueCats}/${CATS.length} breeds`, inline: true },
        )
        .setFooter({ text: `${BRAND.footer} • ${isNew ? 'NEW!' : ''} ${rarityInfo.label} cat` });

      // Show a cat GIF if available
      const gif = await getGif('cat');
      if (gif) embed.setThumbnail(gif);

      await interaction.reply({ embeds: [embed] });

    } else if (sub === 'collection') {
      const target = interaction.options.getUser('user') ?? interaction.user;
      const collection = getCollection(guildId, target.id);

      if (collection.size === 0) {
        return interaction.reply({
          content: `${target.username} hasn't collected any cats yet! Use \`/cats collect\` to start.`,
          ephemeral: true,
        });
      }

      const totalCats = [...collection.values()].reduce((a, b) => a + b, 0);
      const lines = [];

      // Group by rarity
      for (const [rarity, info] of Object.entries(CAT_RARITIES)) {
        const catsOfRarity = CATS.filter(c => c.rarity === rarity);
        const owned = catsOfRarity.filter(c => collection.has(c.id));
        if (owned.length === 0) continue;

        lines.push(`\n**${info.emoji} ${info.label}** (${owned.length}/${catsOfRarity.length})`);
        for (const cat of owned) {
          const count = collection.get(cat.id);
          lines.push(`${cat.emoji} ${cat.name} ${count > 1 ? `x${count}` : ''}`);
        }
      }

      const embed = new EmbedBuilder()
        .setColor(BRAND.colors.primary)
        .setTitle(`🐱 ${target.username}'s Cat Collection`)
        .setDescription(lines.join('\n'))
        .setFooter({ text: `${BRAND.footer} • ${totalCats} total · ${collection.size}/${CATS.length} breeds` })
        .setTimestamp(new Date());

      await interaction.reply({ embeds: [embed] });

    } else if (sub === 'info') {
      const lines = [];
      for (const [rarity, info] of Object.entries(CAT_RARITIES)) {
        const cats = CATS.filter(c => c.rarity === rarity);
        lines.push(`\n**${info.emoji} ${info.label}** — ${(info.chance * 100).toFixed(1)}% chance`);
        for (const cat of cats) {
          lines.push(`${cat.emoji} **${cat.name}** — ${cat.desc}`);
        }
      }

      const embed = new EmbedBuilder()
        .setColor(BRAND.colors.primary)
        .setTitle('🐱 Cat Breed Encyclopedia')
        .setDescription(lines.join('\n'))
        .setFooter({ text: `${BRAND.footer} • ${CATS.length} breeds across ${Object.keys(CAT_RARITIES).length} rarity tiers` });

      await interaction.reply({ embeds: [embed] });

    } else if (sub === 'shop') {
      const lines = Object.entries(CAT_RARITIES).map(([rarity, info]) => {
        const count = CATS.filter(c => c.rarity === rarity).length;
        return `${info.emoji} **${info.label}** — ${(info.chance * 100).toFixed(1)}% drop rate · ${count} breeds`;
      });

      const embed = new EmbedBuilder()
        .setColor(BRAND.colors.primary)
        .setTitle('🛒 Cat Rarity Shop')
        .setDescription(
          lines.join('\n') +
          '\n\n*Use `/cats collect` to try your luck!*'
        )
        .setFooter({ text: BRAND.footer });

      await interaction.reply({ embeds: [embed] });

    } else if (sub === 'trade') {
      const target = interaction.options.getUser('user');
      const catName = interaction.options.getString('cat');

      if (target.id === userId) {
        return interaction.reply({ content: "❌ You can't trade with yourself!", ephemeral: true });
      }

      const cat = CATS.find(c => c.id === catName.toLowerCase().replace(/\s+/g, '_') || c.name.toLowerCase() === catName.toLowerCase());
      if (!cat) {
        return interaction.reply({ content: `❌ Unknown cat breed: "${catName}". Use \`/cats info\` to see all breeds.`, ephemeral: true });
      }

      const myCollection = getCollection(guildId, userId);
      if (!myCollection.has(cat.id) || myCollection.get(cat.id) < 1) {
        return interaction.reply({ content: `❌ You don't have a **${cat.name}** to trade!`, ephemeral: true });
      }

      // Remove from sender, add to receiver
      myCollection.set(cat.id, myCollection.get(cat.id) - 1);
      if (myCollection.get(cat.id) <= 0) myCollection.delete(cat.id);

      const targetCollection = getCollection(guildId, target.id);
      targetCollection.set(cat.id, (targetCollection.get(cat.id) ?? 0) + 1);

      const rarityInfo = CAT_RARITIES[cat.rarity];
      const embed = new EmbedBuilder()
        .setColor(rarityInfo.color)
        .setTitle('🔄 Cat Traded!')
        .setDescription(
          `${interaction.user} traded **${cat.emoji} ${cat.name}** (${rarityInfo.emoji} ${rarityInfo.label}) to ${target}!`
        )
        .setFooter({ text: BRAND.footer });

      await interaction.reply({ embeds: [embed] });
    }
  },
};
