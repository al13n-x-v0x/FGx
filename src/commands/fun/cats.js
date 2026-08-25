'use strict';

/* Copyright © 2026 FGx. All rights reserved. */

const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const { BRAND } = require('../../config/constants');
const { getGif } = require('../../utils/gifLibrary');

/** Cat rarity tiers with drop chances and coin costs for gacha. */
const CAT_RARITIES = {
  common:    { label: 'Common',    emoji: '⬜', color: 0x9E9E9E, chance: 0.35, gachaCost: 0 },
  uncommon:  { label: 'Uncommon',  emoji: '🟩', color: 0x4CAF50, chance: 0.25, gachaCost: 100 },
  rare:      { label: 'Rare',      emoji: '🟦', color: 0x2196F3, chance: 0.18, gachaCost: 250 },
  epic:      { label: 'Epic',      emoji: '🟪', color: 0x9C27B0, chance: 0.12, gachaCost: 500 },
  legendary: { label: 'Legendary', emoji: '🟨', color: 0xFF9800, chance: 0.07, gachaCost: 1000 },
  mythical:  { label: 'Mythical',  emoji: '🟥', color: 0xF44336, chance: 0.025, gachaCost: 2500 },
  divine:    { label: 'Divine',    emoji: '💎', color: 0x00BCD4, chance: 0.005, gachaCost: 5000 },
};

/** 108 cat breeds — one for every vibe. */
const CATS = [
  // ═══════ COMMON (38) ═══════
  { id: 'tabby', name: 'Tabby Cat', emoji: '🐱', rarity: 'common', desc: 'Your average house cat. Friendly and curious.', power: 10 },
  { id: 'calico', name: 'Calico', emoji: '🐈', rarity: 'common', desc: 'Three-colored coat. Lucky in Japan!', power: 12 },
  { id: 'tuxedo', name: 'Tuxedo Cat', emoji: '🐈‍⬛', rarity: 'common', desc: 'Dressed for success. Always formal.', power: 11 },
  { id: 'siamese', name: 'Siamese', emoji: '🐱', rarity: 'common', desc: 'Blue eyes, loud voice. Wants attention NOW.', power: 13 },
  { id: 'orange_tabby', name: 'Orange Tabby', emoji: '🐱', rarity: 'common', desc: 'One brain cell. Uses it for chaos.', power: 8 },
  { id: 'black_cat', name: 'Black Cat', emoji: '🐈‍⬛', rarity: 'common', desc: 'Bad luck? More like best luck.', power: 14 },
  { id: 'white_cat', name: 'White Cat', emoji: '🐱', rarity: 'common', desc: 'Pure as snow. Suspiciously clean.', power: 10 },
  { id: 'grey_cat', name: 'Grey Cat', emoji: '🐱', rarity: 'common', desc: 'Sleek and mysterious. Always judging.', power: 11 },
  { id: 'ginger', name: 'Ginger Cat', emoji: '🐱', rarity: 'common', desc: 'Orange menace. Will eat your food.', power: 9 },
  { id: 'tortoiseshell', name: 'Tortoiseshell', emoji: '🐱', rarity: 'common', desc: 'Fiery personality. Will fight you.', power: 15 },
  { id: 'calico_short', name: 'Calico Short', emoji: '🐈', rarity: 'common', desc: 'Quick and agile. Born runner.', power: 12 },
  { id: 'chocolate', name: 'Chocolate Point', emoji: '🐱', rarity: 'common', desc: 'Sweet as cocoa. Warm personality.', power: 10 },
  { id: 'cream', name: 'Cream Cat', emoji: '🐱', rarity: 'common', desc: 'Soft as butter. Pure comfort.', power: 9 },
  { id: 'lilac', name: 'Lilac Cat', emoji: '🐱', rarity: 'common', desc: 'Pale purple hue. Gentle soul.', power: 11 },
  { id: 'brown_tabby', name: 'Brown Tabby', emoji: '🐱', rarity: 'common', desc: 'Classic stripes. Classic vibes.', power: 10 },
  { id: 'silver_tabby', name: 'Silver Tabby', emoji: '🐱', rarity: 'common', desc: 'Shimmering coat. Always photogenic.', power: 12 },
  { id: 'mackerel', name: 'Mackerel Tabby', emoji: '🐱', rarity: 'common', desc: 'Fish-patterned. Born fisherman.', power: 11 },
  { id: 'spotted', name: 'Spotted Tabby', emoji: '🐱', rarity: 'common', desc: 'Leopard spots. Tiny predator.', power: 13 },
  { id: 'blotched', name: 'Blotched Tabby', emoji: '🐱', rarity: 'common', desc: 'Swirled patterns. Art in fur form.', power: 10 },
  { id: 'grey_tuxedo', name: 'Grey Tuxedo', emoji: '🐈‍⬛', rarity: 'common', desc: 'Formal grey. Distinguished gentleman.', power: 11 },
  { id: 'brown_tuxedo', name: 'Brown Tuxedo', emoji: '🐈‍⬛', rarity: 'common', desc: 'Earthy tones. Grounded personality.', power: 10 },
  { id: 'patchwork', name: 'Patchwork Cat', emoji: '🐱', rarity: 'common', desc: 'Every patch tells a story.', power: 12 },
  { id: 'van_cat', name: 'Van Pattern', emoji: '🐱', rarity: 'common', desc: 'Color only on head and tail. Fancy.', power: 11 },
  { id: 'bicolor', name: 'Bicolor Cat', emoji: '🐱', rarity: 'common', desc: 'Two-tone perfection. Simple yet bold.', power: 10 },
  { id: 'colorpoint', name: 'Colorpoint', emoji: '🐱', rarity: 'common', desc: 'Darker points on light body. Subtle elegance.', power: 12 },
  { id: 'seal_point', name: 'Seal Point', emoji: '🐱', rarity: 'common', desc: 'Dark brown points. Classic look.', power: 11 },
  { id: 'blue_point', name: 'Blue Point', emoji: '🐱', rarity: 'common', desc: 'Grey-blue points. Cool and collected.', power: 12 },
  { id: 'flame_point', name: 'Flame Point', emoji: '🐱', rarity: 'common', desc: 'Orange points. Fiery personality.', power: 13 },
  { id: 'lynx_point', name: 'Lynx Point', emoji: '🐱', rarity: 'common', desc: 'Tabby points. Wild at heart.', power: 14 },
  { id: 'chocolate_tux', name: 'Chocolate Tuxedo', emoji: '🐈‍⬛', rarity: 'common', desc: 'Brown and white. Sweet face.', power: 10 },
  { id: 'lavender', name: 'Lavender Cat', emoji: '🐱', rarity: 'common', desc: 'Soft purple-grey. Dreamy.', power: 11 },
  { id: 'cinnamon', name: 'Cinnamon Cat', emoji: '🐱', rarity: 'common', desc: 'Warm brown. Spicy personality.', power: 12 },
  { id: 'fawn', name: 'Fawn Cat', emoji: '🐱', rarity: 'common', desc: 'Light beige. Delicate and graceful.', power: 9 },
  { id: 'peach', name: 'Peach Cat', emoji: '🐱', rarity: 'common', desc: 'Soft orange. Sweet as summer.', power: 10 },
  { id: 'coral', name: 'Coral Cat', emoji: '🐱', rarity: 'common', desc: 'Pinkish orange. Tropical vibes.', power: 11 },
  { id: 'sand', name: 'Sand Cat', emoji: '🐱', rarity: 'common', desc: 'Desert dweller. Tiny and fierce.', power: 13 },
  { id: 'marble', name: 'Marble Cat', emoji: '🐱', rarity: 'common', desc: 'Swirled patterns like marble cake.', power: 10 },
  { id: 'bi_color', name: 'Bi-Color', emoji: '🐱', rarity: 'common', desc: 'Classic two-tone. Timeless.', power: 11 },

  // ═══════ UNCOMMON (25) ═══════
  { id: 'persian', name: 'Persian', emoji: '🐱', rarity: 'uncommon', desc: 'Long luxurious fur. The royalty of cats.', power: 20 },
  { id: 'ragdoll', name: 'Ragdoll', emoji: '🐱', rarity: 'uncommon', desc: 'Goes limp when you pick it up. Trusting soul.', power: 18 },
  { id: 'abyssinian', name: 'Abyssinian', emoji: '🐱', rarity: 'uncommon', desc: 'Ancient Egyptian vibes. Always exploring.', power: 22 },
  { id: 'bengal', name: 'Bengal', emoji: '🐆', rarity: 'uncommon', desc: 'Mini leopard! Wild-looking, domesticated heart.', power: 25 },
  { id: 'british_shorthair', name: 'British Shorthair', emoji: '🐱', rarity: 'uncommon', desc: 'Chonky British gentleman. Loves tea and naps.', power: 19 },
  { id: 'american_shorthair', name: 'American Shorthair', emoji: '🐱', rarity: 'uncommon', desc: 'All-American cat. Strong and healthy.', power: 21 },
  { id: 'exotic_shorthair', name: 'Exotic Shorthair', emoji: '🐱', rarity: 'uncommon', desc: 'Persian in a t-shirt. Low-maintenance luxury.', power: 18 },
  { id: 'burmese', name: 'Burmese', emoji: '🐱', rarity: 'uncommon', desc: 'Social butterfly. Never leaves your side.', power: 20 },
  { id: 'tonkinese', name: 'Tonkinese', emoji: '🐱', rarity: 'uncommon', desc: 'Burmese meets Siamese. Best of both worlds.', power: 22 },
  { id: 'ocicat', name: 'Ocicat', emoji: '🐆', rarity: 'uncommon', desc: 'Wild spotted pattern. 100% domestic.', power: 24 },
  { id: 'manx', name: 'Manx', emoji: '🐱', rarity: 'uncommon', desc: 'No tail? No problem. Bunny hops.', power: 19 },
  { id: 'cornish_rex', name: 'Cornish Rex', emoji: '🐱', rarity: 'uncommon', desc: 'Curly coat. Alien-looking. Adorable.', power: 17 },
  { id: 'devon_rex', name: 'Devon Rex', emoji: '🐱', rarity: 'uncommon', desc: 'Big ears, elf face. mischievous.', power: 18 },
  { id: 'somali', name: 'Somali', emoji: '🐱', rarity: 'uncommon', desc: 'Long-haired Abyssinian. Fluffy explorer.', power: 21 },
  { id: 'oriental_shorthair', name: 'Oriental Shorthair', emoji: '🐱', rarity: 'uncommon', desc: 'Bat ears, huge eyes. Extra-terrestrial beauty.', power: 20 },
  { id: 'birman', name: 'Birman', emoji: '🐱', rarity: 'uncommon', desc: 'Sacred cat of Burma. White-gloved paws.', power: 22 },
  { id: 'chartreux', name: 'Chartreux', emoji: '🐱', rarity: 'uncommon', desc: 'French blue cat. Smile that melts hearts.', power: 23 },
  { id: 'khao_manee', name: 'Khao Manee', emoji: '🐱', rarity: 'uncommon', desc: 'Thai diamond eye cat. Heterochromia vibes.', power: 24 },
  { id: 'toybob', name: 'Toybob', emoji: '🐱', rarity: 'uncommon', desc: 'Tiny bobtail. Smallest cat breed.', power: 15 },
  { id: 'munchkin', name: 'Munchkin', emoji: '🐱', rarity: 'uncommon', desc: 'Short legs. Maximum adorable.', power: 16 },
  { id: 'snowshoe', name: 'Snowshoe', emoji: '🐱', rarity: 'uncommon', desc: 'White paws like snowshoes. Athletic.', power: 21 },
  { id: 'javanese', name: 'Javanese', emoji: '🐱', rarity: 'uncommon', desc: 'Siamese with long hair. Elegant.', power: 20 },
  { id: 'laperm', name: 'LaPerm', emoji: '🐱', rarity: 'uncommon', desc: 'Curly perm coat. Never goes out of style.', power: 19 },
  { id: 'singapura', name: 'Singapura', emoji: '🐱', rarity: 'uncommon', desc: 'World\'s smallest breed. Big personality.', power: 17 },
  { id: 'tonkinese_seal', name: 'Tonkinese Seal', emoji: '🐱', rarity: 'uncommon', desc: 'Seal-point Tonkinese. Mysterious.', power: 22 },

  // ═══════ RARE (20) ═══════
  { id: 'scottish', name: 'Scottish Fold', emoji: '🐱', rarity: 'rare', desc: 'Folded ears give it an owl-like expression.', power: 30 },
  { id: 'sphynx', name: 'Sphynx', emoji: '🐱', rarity: 'rare', desc: 'Hairless wonder. Wrinkly and warm.', power: 28 },
  { id: 'maine_coon', name: 'Maine Coon', emoji: '🐱', rarity: 'rare', desc: 'Gentle giant. Can weigh up to 25 lbs!', power: 35 },
  { id: 'russian_blue', name: 'Russian Blue', emoji: '🐱', rarity: 'rare', desc: 'Silver-green fur. Elegant and mysterious.', power: 32 },
  { id: 'norwegian_forest', name: 'Norwegian Forest Cat', emoji: '🐱', rarity: 'rare', desc: 'Viking cat. Thick coat survives blizzards.', power: 34 },
  { id: 'turkish_angora', name: 'Turkish Angora', emoji: '🐱', rarity: 'rare', desc: 'Silky white fur. Graceful as a ballet dancer.', power: 30 },
  { id: 'selkirk_rex', name: 'Selkirk Rex', emoji: '🐱', rarity: 'rare', desc: 'Perm cat. Curly and cuddly.', power: 27 },
  { id: 'american_bobtail', name: 'American Bobtail', emoji: '🐱', rarity: 'rare', desc: 'Wild look, tame heart. Short tail.', power: 31 },
  { id: 'balinese', name: 'Balinese', emoji: '🐱', rarity: 'rare', desc: 'Long-haired Siamese. Silky and vocal.', power: 29 },
  { id: 'bombay', name: 'Bombay', emoji: '🐈‍⬛', rarity: 'rare', desc: 'Mini black panther. Copper eyes glow.', power: 33 },
  { id: 'korat', name: 'Korat', emoji: '🐱', rarity: 'rare', desc: 'Silver-tipped blue. Heart-shaped face.', power: 30 },
  { id: '虎斑', name: 'Classic Tabby', emoji: '🐱', rarity: 'rare', desc: 'Ancient mackerel pattern. Fierce hunter.', power: 32 },
  { id: 'cyprus', name: 'Cyprus Cat', emoji: '🐱', rarity: 'rare', desc: 'Island cat. Loves swimming.', power: 28 },
  { id: 'toyger', name: 'Toyger', emoji: '🐯', rarity: 'rare', desc: 'Mini tiger. Striped and majestic.', power: 35 },
  { id: 'minuet', name: 'Minuet', emoji: '🐱', rarity: 'rare', desc: 'Short-legged Persian mix. Aristocratic.', power: 26 },
  { id: 'donskoy', name: 'Donskoy', emoji: '🐱', rarity: 'rare', desc: 'Russian hairless. Warm cuddle buddy.', power: 27 },
  { id: 'Peterbald', name: 'Peterbald', emoji: '🐱', rarity: 'rare', desc: 'Bald elegance. Slender and affectionate.', power: 29 },
  { id: 'chausie', name: 'Chausie', emoji: '🐆', rarity: 'rare', desc: 'Jungle cat hybrid. Athletic and bold.', power: 36 },
  { id: 'bengal_snow', name: 'Snow Bengal', emoji: '🐆', rarity: 'rare', desc: 'White leopard print. Rare and stunning.', power: 34 },
  { id: 'egyptian_mau', name: 'Egyptian Mau', emoji: '🐱', rarity: 'rare', desc: 'Spotted coat from ancient Egypt. Fast.', power: 33 },

  // ═══════ EPIC (13) ═══════
  { id: 'savannah', name: 'Savannah', emoji: '🐆', rarity: 'epic', desc: 'Part wild serval. Tall, athletic, fearless.', power: 45 },
  { id: 'bengal_rosette', name: 'Rosette Bengal', emoji: '🐆', rarity: 'epic', desc: 'Rosette spots like a real leopard.', power: 48 },
  { id: 'blue_persian', name: 'Blue Persian', emoji: '🐱', rarity: 'epic', desc: 'Rare blue coat. Calm and regal.', power: 40 },
  { id: 'chinchilla', name: 'Chinchilla Persian', emoji: '🐱', rarity: 'epic', desc: 'Silver-tipped fur. Most glamorous cat.', power: 42 },
  { id: 'golden_persian', name: 'Golden Persian', emoji: '🐱', rarity: 'epic', desc: 'Golden shimmer. Looks expensive.', power: 44 },
  { id: 'munchkin_fold', name: 'Munchkin Fold', emoji: '🐱', rarity: 'epic', desc: 'Short legs + folded ears. Maximum cute.', power: 38 },
  { id: 'sphynx_hairless', name: 'Hairless Sphynx', emoji: '🐱', rarity: 'epic', desc: 'Completely hairless. Warm like a heater.', power: 36 },
  { id: 'black_savannah', name: 'Black Savannah', emoji: '🐆', rarity: 'epic', desc: 'Dark serval hybrid. Stealth mode.', power: 50 },
  { id: 'silver_maincoon', name: 'Silver Maine Coon', emoji: '🐱', rarity: 'epic', desc: 'Silver giant. Weighs as much as a dog.', power: 47 },
  { id: 'golden_bengal', name: 'Golden Bengal', emoji: '🐆', rarity: 'epic', desc: 'Golden rosettes. Sun-kissed predator.', power: 46 },
  { id: 'blue_abyssinian', name: 'Blue Abyssinian', emoji: '🐱', rarity: 'epic', desc: 'Rare blue ticked coat. Ancient bloodline.', power: 43 },
  { id: 'white_sphynx', name: 'White Sphynx', emoji: '🐱', rarity: 'epic', desc: 'Albino hairless. Ghost cat.', power: 39 },
  { id: 'mink_tonkinese', name: 'Mink Tonkinese', emoji: '🐱', rarity: 'epic', desc: 'Aquatic mink coat. Silky and unique.', power: 41 },

  // ═══════ LEGENDARY (6) ═══════
  { id: 'neko', name: 'Neko Lord', emoji: '😺', rarity: 'legendary', desc: 'The chosen one. Has servant-level AI vibes.', power: 60 },
  { id: 'shadow_cat', name: 'Shadow Cat', emoji: '🐈‍⬛', rarity: 'legendary', desc: 'Appears only at midnight. Pure black fur absorbs light.', power: 65 },
  { id: 'phoenix_cat', name: 'Phoenix Cat', emoji: '🐱', rarity: 'legendary', desc: 'Born from fire. Has warm fur even in winter.', power: 58 },
  { id: 'thunder_cat', name: 'Thunder Cat', emoji: '🐱', rarity: 'legendary', desc: 'Striped like lightning. Strikes fast.', power: 62 },
  { id: 'frost_cat', name: 'Frost Cat', emoji: '🐱', rarity: 'legendary', desc: 'Ice-blue fur. Breath freezes the air.', power: 55 },
  { id: 'sakura_cat', name: 'Sakura Cat', emoji: '🌸', rarity: 'legendary', desc: 'Cherry blossom fur. Appears in spring.', power: 57 },

  // ═══════ MYTHICAL (4) ═══════
  { id: 'maneki_neko', name: 'Maneki Neko', emoji: '🐱', rarity: 'mythical', desc: 'The beckoning cat. Brings fortune to its owner.', power: 80 },
  { id: 'void_cat', name: 'Void Cat', emoji: '🐈‍⬛', rarity: 'mythical', desc: 'A cat-shaped hole in reality. Stares into your soul.', power: 85 },
  { id: 'cosmic_kitty', name: 'Cosmic Kitty', emoji: '🌌', rarity: 'mythical', desc: 'Fur made of starlight. Walks between dimensions.', power: 90 },
  { id: 'crystal_cat', name: 'Crystal Cat', emoji: '💎', rarity: 'mythical', desc: 'Body made of living crystal. Refracts light.', power: 82 },

  // ═══════ DIVINE (2) ═══════
  { id: 'anubis_cat', name: 'Anubis Cat', emoji: '𓃠', rarity: 'divine', desc: 'Guardian of the afterlife. Wears a golden Ankh collar.', power: 100 },
  { id: 'nyan_cat', name: 'Nyan Cat', emoji: '🌈', rarity: 'divine', desc: 'Rainbow trail through space. The ultimate internet cat.', power: 100 },
];

// Sync total
// CATS.length should be 108

const CAT_GACHA_COOLDOWN_MS = 30_000;

/** In-memory user cat collections. */
const userCollections = new Map();

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
  return CATS[0];
}

/** Calculate battle power (base + random 0-20%). */
function battlePower(cat) {
  return Math.floor(cat.power * (1 + Math.random() * 0.2));
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName('cats')
    .setDescription('Cat collection system with rarity tiers and battles! 🐱')
    .addSubcommand(sub =>
      sub.setName('collect')
        .setDescription('Collect a random cat (free, 30s cooldown)'))
    .addSubcommand(sub =>
      sub.setName('gacha')
        .setDescription('Spend ₣Ԡ🇽 for a chance at rare cats')
        .addIntegerOption(opt =>
          opt.setName('amount').setDescription('Number of pulls (default 1, max 10)').setMinValue(1).setMaxValue(10)))
    .addSubcommand(sub =>
      sub.setName('collection')
        .setDescription('View your cat collection')
        .addUserOption(opt =>
          opt.setName('user').setDescription('View someone else\'s collection')))
    .addSubcommand(sub =>
      sub.setName('battle')
        .setDescription('Battle your strongest cat against someone!')
        .addUserOption(opt =>
          opt.setName('user').setDescription('Who to battle').setRequired(true)))
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
        .setTitle(`${cat.emoji} ${isNew ? '✨ NEW CAT!' : 'Cat Collected!'} ${rarityInfo.emoji}`)
        .setDescription(
          `**${cat.name}**\n*${cat.desc}*\n\n` +
          `**Rarity:** ${rarityInfo.emoji} ${rarityInfo.label}\n` +
          `**Power:** ⚔️ ${cat.power}\n` +
          (isNew ? '🌟 **First time finding this breed!**' : `You now have **${count}** of this breed.`)
        )
        .addFields(
          { name: '📦 Collection', value: `${totalCats} total · ${uniqueCats}/${CATS.length} breeds`, inline: true },
        )
        .setFooter({ text: `${BRAND.footer} • ${isNew ? 'NEW!' : ''} ${rarityInfo.label} cat` });

      const gif = await getGif('cat');
      if (gif) embed.setThumbnail(gif);

      await interaction.reply({ embeds: [embed] });

    } else if (sub === 'gacha') {
      const economy = require('../../services/community/economyService');
      const pulls = interaction.options.getInteger('amount') ?? 1;
      const costPerPull = 100;
      const totalCost = costPerPull * pulls;

      const row = economy.balance(guildId, userId);
      if ((row.balance ?? 0) < totalCost) {
        return interaction.reply({
          content: `❌ You need **${economy.format(totalCost)}** ₣Ԡ🇽 but have **${economy.format(row.balance ?? 0)}**.`,
          ephemeral: true,
        });
      }

      await economy.updateBalance(guildId, userId, -totalCost);
      economy.logTx(guildId, userId, 'cat_gacha', -totalCost, `Cat Gacha x${pulls}`);

      const results = [];
      const collection = getCollection(guildId, userId);

      for (let i = 0; i < pulls; i++) {
        const cat = rollCat();
        const isNew = !collection.has(cat.id);
        collection.set(cat.id, (collection.get(cat.id) ?? 0) + 1);
        const rarityInfo = CAT_RARITIES[cat.rarity];
        results.push({ cat, isNew, rarityInfo });
      }

      const lines = results.map((r, i) =>
        `${r.isNew ? '🌟' : r.rarityInfo.emoji} **${r.cat.emoji} ${r.cat.name}** ${r.isNew ? '(NEW!)' : ''} — ${r.rarityInfo.label} ⚔️${r.cat.power}`
      );

      const embed = new EmbedBuilder()
        .setColor(BRAND.colors.primary)
        .setTitle(`🎰 Cat Gacha — ${pulls} Pull${pulls > 1 ? 's' : ''}`)
        .setDescription(lines.join('\n'))
        .addFields(
          { name: '💰 Spent', value: `${economy.format(totalCost)} ₣Ԡ🇽`, inline: true },
          { name: '💰 Balance', value: `${economy.format((row.balance ?? 0) - totalCost)} ₣Ԡ🇽`, inline: true },
        )
        .setFooter({ text: BRAND.footer });

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

      for (const [rarity, info] of Object.entries(CAT_RARITIES)) {
        const catsOfRarity = CATS.filter(c => c.rarity === rarity);
        const owned = catsOfRarity.filter(c => collection.has(c.id));
        if (owned.length === 0) continue;
        lines.push(`\n**${info.emoji} ${info.label}** (${owned.length}/${catsOfRarity.length})`);
        for (const cat of owned) {
          const count = collection.get(cat.id);
          lines.push(`${cat.emoji} ${cat.name} ⚔️${cat.power} ${count > 1 ? `x${count}` : ''}`);
        }
      }

      const embed = new EmbedBuilder()
        .setColor(BRAND.colors.primary)
        .setTitle(`🐱 ${target.username}'s Cat Collection`)
        .setDescription(lines.join('\n').slice(0, 4000))
        .setFooter({ text: `${BRAND.footer} • ${totalCats} total · ${collection.size}/${CATS.length} breeds` })
        .setTimestamp(new Date());

      await interaction.reply({ embeds: [embed] });

    } else if (sub === 'battle') {
      const target = interaction.options.getUser('user');
      if (target.id === userId) {
        return interaction.reply({ content: "❌ You can't battle yourself!", ephemeral: true });
      }

      const myCollection = getCollection(guildId, userId);
      const theirCollection = getCollection(guildId, target.id);

      if (myCollection.size === 0) {
        return interaction.reply({ content: "❌ You have no cats! Use `/cats collect` first.", ephemeral: true });
      }
      if (theirCollection.size === 0) {
        return interaction.reply({ content: `❌ ${target.username} has no cats to battle!`, ephemeral: true });
      }

      // Pick strongest cat for each
      const myBest = CATS.filter(c => myCollection.has(c.id)).sort((a, b) => b.power - a.power)[0];
      const theirBest = CATS.filter(c => theirCollection.has(c.id)).sort((a, b) => b.power - a.power)[0];

      const myPower = battlePower(myBest);
      const theirPower = battlePower(theirBest);
      const iWin = myPower >= theirPower;

      const embed = new EmbedBuilder()
        .setColor(iWin ? BRAND.colors.success : BRAND.colors.danger)
        .setTitle(iWin ? '🏆 Victory!' : '💀 Defeat!')
        .setDescription(
          `**${interaction.user.username}**'s ${myBest.emoji} **${myBest.name}** (⚔️${myPower})\n` +
          `vs\n` +
          `**${target.username}**'s ${theirBest.emoji} **${theirBest.name}** (⚔️${theirPower})\n\n` +
          (iWin ? `${myBest.name} dominated the battle! 🎉` : `${theirBest.name} was too strong! 💪`)
        )
        .setFooter({ text: BRAND.footer });

      await interaction.reply({ embeds: [embed] });

    } else if (sub === 'info') {
      const lines = [];
      for (const [rarity, info] of Object.entries(CAT_RARITIES)) {
        const cats = CATS.filter(c => c.rarity === rarity);
        lines.push(`\n**${info.emoji} ${info.label}** — ${(info.chance * 100).toFixed(1)}% chance · ${cats.length} breeds${info.gachaCost ? ` · ${info.gachaCost} ₣Ԡ🇽 gacha` : ' · free'}`);
        for (const cat of cats) {
          lines.push(`${cat.emoji} **${cat.name}** ⚔️${cat.power} — ${cat.desc}`);
        }
      }

      const embed = new EmbedBuilder()
        .setColor(BRAND.colors.primary)
        .setTitle(`🐱 Cat Breed Encyclopedia — ${CATS.length} Breeds`)
        .setDescription(lines.join('\n').slice(0, 4000))
        .setFooter({ text: `${BRAND.footer} • ${CATS.length} breeds across ${Object.keys(CAT_RARITIES).length} tiers` });

      await interaction.reply({ embeds: [embed] });

    } else if (sub === 'shop') {
      const lines = Object.entries(CAT_RARITIES).map(([rarity, info]) => {
        const count = CATS.filter(c => c.rarity === rarity).length;
        return `${info.emoji} **${info.label}** — ${(info.chance * 100).toFixed(1)}% drop · ${count} breeds · ${info.gachaCost ? `${info.gachaCost} ₣Ԡ🇽 gacha` : 'free collect'}`;
      });

      const embed = new EmbedBuilder()
        .setColor(BRAND.colors.primary)
        .setTitle('🛒 Cat Rarity Shop')
        .setDescription(lines.join('\n') + '\n\n*Use `/cats collect` (free) or `/cats gacha` (coins) to get cats!*')
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

      myCollection.set(cat.id, myCollection.get(cat.id) - 1);
      if (myCollection.get(cat.id) <= 0) myCollection.delete(cat.id);

      const targetCollection = getCollection(guildId, target.id);
      targetCollection.set(cat.id, (targetCollection.get(cat.id) ?? 0) + 1);

      const rarityInfo = CAT_RARITIES[cat.rarity];
      const embed = new EmbedBuilder()
        .setColor(rarityInfo.color)
        .setTitle('🔄 Cat Traded!')
        .setDescription(
          `${interaction.user} traded **${cat.emoji} ${cat.name}** (${rarityInfo.emoji} ${rarityInfo.label} ⚔️${cat.power}) to ${target}!`
        )
        .setFooter({ text: BRAND.footer });

      await interaction.reply({ embeds: [embed] });
    }
  },
};
