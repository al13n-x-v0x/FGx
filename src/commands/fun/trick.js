'use strict';

/* Copyright © 2026 FGx. All rights reserved. */

const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { BRAND } = require('../../config/constants');
const { quickAI } = require('../../services/ai/quick');
const { getGif } = require('../../utils/gifLibrary');

const TRICK_GIFS = {
  roast: ['burn', 'slap', 'punch'],
  compliment: ['heart', 'hug', 'pat'],
  predict: ['crystal', 'magic', 'sparkle'],
  insult: ['slap', 'burn', 'punch'],
  pickup: ['love', 'heart', 'blush'],
  poem: ['sparkle', 'magic', 'shine'],
  debate: ['thinking', 'judge', 'sweat'],
  fortune: ['sparkle', 'magic', 'crystal'],
  story: ['sparkle', 'magic', 'shine'],
  translate: ['laugh', 'dance', 'haha'],
};

function randomFrom(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

function getGifUrl(category) {
  const keys = TRICK_GIFS[category] || ['sparkle'];
  return getGif(randomFrom(keys));
}

/** Build a trick embed with AI response */
function buildEmbed(title, aiText, color, gifCategory, user) {
  const embed = new EmbedBuilder()
    .setColor(color)
    .setTitle(title)
    .setDescription(aiText || 'The AI got shy... try again!')
    .setTimestamp();

  if (user) embed.setThumbnail(user.displayAvatarURL({ size: 128 }));

  const gifUrl = getGifUrl(gifCategory);
  if (gifUrl) embed.setImage(gifUrl);

  embed.setFooter({ text: `${BRAND.footer} • Powered by AI 🤖` });
  return embed;
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName('trick')
    .setDescription('AI-powered tricks — roast, compliment, predict, and more!')
    .addSubcommand((sub) =>
      sub
        .setName('roast')
        .setDescription('AI roasts someone savagely 🔥')
        .addUserOption((o) => o.setName('target').setDescription('Who to roast').setRequired(true)),
    )
    .addSubcommand((sub) =>
      sub
        .setName('compliment')
        .setDescription('AI compliments someone nicely 💜')
        .addUserOption((o) => o.setName('target').setDescription('Who to compliment').setRequired(true)),
    )
    .addSubcommand((sub) =>
      sub
        .setName('insult')
        .setDescription('AI insults someone hilariously 💀')
        .addUserOption((o) => o.setName('target').setDescription('Who to insult').setRequired(true)),
    )
    .addSubcommand((sub) =>
      sub
        .setName('predict')
        .setDescription('AI predicts someone\'s future 🔮')
        .addUserOption((o) => o.setName('target').setDescription('Who to predict').setRequired(true)),
    )
    .addSubcommand((sub) =>
      sub
        .setName('pickup')
        .setDescription('AI crafts a pickup line 💘')
        .addUserOption((o) => o.setName('target').setDescription('Who to impress').setRequired(true)),
    )
    .addSubcommand((sub) =>
      sub
        .setName('poem')
        .setDescription('AI writes a poem about someone 📝')
        .addUserOption((o) => o.setName('target').setDescription('Who to write about').setRequired(true)),
    )
    .addSubcommand((sub) =>
      sub
        .setName('debate')
        .setDescription('AI debates a topic 🔥')
        .addStringOption((o) => o.setName('topic').setDescription('What to debate').setRequired(true))
        .addStringOption((o) => o.setName('side').setDescription('Which side: pro or con').addChoices(
          { name: '🔥 Pro', value: 'pro' },
          { name: '🚫 Con', value: 'con' },
        )),
    )
    .addSubcommand((sub) =>
      sub
        .setName('fortune')
        .setDescription('AI tells your fortune 🔮')
        .addUserOption((o) => o.setName('target').setDescription('Whose fortune to read')),
    )
    .addSubcommand((sub) =>
      sub
        .setName('story')
        .setDescription('AI writes a short story 📖')
        .addStringOption((o) => o.setName('prompt').setDescription('Story topic or scenario').setRequired(true)),
    )
    .addSubcommand((sub) =>
      sub
        .setName('translate')
        .setDescription('AI translates text into a funny language 🌍')
        .addStringOption((o) => o.setName('text').setDescription('Text to translate').setRequired(true))
        .addStringOption((o) => o.setName('language').setDescription('Language (default: pirate)')
          .addChoices(
            { name: '🏴‍☠️ Pirate', value: 'pirate' },
            { name: '🤖 Robot', value: 'robot' },
            { name: '👵 Shakespeare', value: 'shakespearean' },
            { name: '🐸 Frog', value: 'frog' },
            { name: '😈 Demon', value: 'demon' },
            { name: '🧁 Gen Z', value: 'gen z' },
            { name: '🦕 Dinosaur', value: 'dinosaur' },
          )),
    )
    .addSubcommand((sub) =>
      sub
        .setName('roastbattle')
        .setDescription('AI roasts TWO users against each other 🔥🔥')
        .addUserOption((o) => o.setName('user1').setDescription('First combatant').setRequired(true))
        .addUserOption((o) => o.setName('user2').setDescription('Second combatant').setRequired(true)),
    )
    .addSubcommand((sub) =>
      sub
        .setName('simulate')
        .setDescription('AI simulates a funny scenario 🎭')
        .addStringOption((o) => o.setName('scenario').setDescription('What to simulate').setRequired(true)),
    ),

  async execute(interaction) {
    const sub = interaction.options.getSubcommand();

    await interaction.deferReply();

    try {
      let result;

      switch (sub) {
        case 'roast': {
          const target = interaction.options.getUser('target');
          const serverName = interaction.guild?.name || 'the server';
          result = await quickAI(
            `You are a savage, hilarious roast comedian performing at a gaming comedy show in ${serverName}. Write ONE devastating, creative roast about ${target.username}. Max 150 chars. Swearing encouraged. Be brutally funny. No asterisks, no markdown, just raw text. Sound like a real comedian, not a bot.`,
            `Roast ${target.username} HARD.`,
            { temperature: 0.95, maxTokens: 200 },
          );
          const embed = buildEmbed(`🔥 ${target.username} Just Got ROASTED`, result, 0xFF4500, 'roast', target);
          await interaction.editReply({ embeds: [embed] });
          break;
        }

        case 'compliment': {
          const target = interaction.options.getUser('target');
          result = await quickAI(
            `You are the sweetest, most wholesome person ever. Write a heartfelt, creative compliment for ${target.username}. Make them feel amazing. Max 120 chars. Be genuine and warm.`,
            `Give ${target.username} the best compliment ever!`,
            { temperature: 0.8, maxTokens: 150 },
          );
          const embed = buildEmbed(`💜 ${target.username} Deserves Some Love`, result, 0xFF69B4, 'compliment', target);
          await interaction.editReply({ embeds: [embed] });
          break;
        }

        case 'insult': {
          const target = interaction.options.getUser('target');
          result = await quickAI(
            `You are a savage roaster at a gaming tournament. Write a short, hilarious insult for ${target.username}. Keep it under 100 characters. Make it funny and creative, like a playground roast. No asterisks.`,
            `Roast ${target.username} in one line!`,
            { temperature: 0.95, maxTokens: 150 },
          );
          const embed = buildEmbed(`💀 ${target.username} Just Got DESTROYED`, result, 0x8B0000, 'insult', target);
          await interaction.editReply({ embeds: [embed] });
          break;
        }

        case 'predict': {
          const target = interaction.options.getUser('target');
          result = await quickAI(
            `You are a mystical fortune teller at a gaming convention. Predict ${target.username}'s future in a fun, dramatic way. Make it specific and entertaining. Max 150 chars. Use emojis.`,
            `Tell me the future of ${target.username}!`,
            { temperature: 0.9, maxTokens: 200 },
          );
          const embed = buildEmbed(`🔮 ${target.username}'s Destiny`, result, 0x9B59B6, 'predict', target);
          await interaction.editReply({ embeds: [embed] });
          break;
        }

        case 'pickup': {
          const target = interaction.options.getUser('target');
          result = await quickAI(
            `You are the smoothest person alive. Craft the most creative, cheesy, and hilarious pickup line for ${target.username}. Max 100 chars. Make it gaming-themed if possible.`,
            `Give me a pickup line for ${target.username}!`,
            { temperature: 0.95, maxTokens: 150 },
          );
          const embed = buildEmbed(`💘 Pickup Line for ${target.username}`, result, 0xFF69B4, 'pickup', target);
          await interaction.editReply({ embeds: [embed] });
          break;
        }

        case 'poem': {
          const target = interaction.options.getUser('target');
          result = await quickAI(
            `Write a short, funny poem (4-6 lines) about ${target.username}. Make it creative, maybe a bit roasty but mostly fun. Like a limerick or haiku. Max 200 chars.`,
            `Write a poem about ${target.username}!`,
            { temperature: 0.9, maxTokens: 250 },
          );
          const embed = buildEmbed(`📝 A Poem for ${target.username}`, result, 0x3498DB, 'poem', target);
          await interaction.editReply({ embeds: [embed] });
          break;
        }

        case 'debate': {
          const topic = interaction.options.getString('topic');
          const side = interaction.options.getString('side') || (Math.random() > 0.5 ? 'pro' : 'con');
          result = await quickAI(
            `You are a professional debate champion. Argue ${side === 'pro' ? 'FOR' : 'AGAINST'} the following topic with passion and logic. Keep it under 200 chars. Make it convincing and entertaining.`,
            `Debate ${side}: ${topic}`,
            { temperature: 0.85, maxTokens: 250 },
          );
          const embed = buildEmbed(
            `🔥 Debate: "${topic}"`,
            `**Position: ${side === 'pro' ? '✅ FOR' : '❌ AGAINST'}**\n\n${result}`,
            side === 'pro' ? 0x2ECC71 : 0xE74C3C,
            'debate',
          );
          await interaction.editReply({ embeds: [embed] });
          break;
        }

        case 'fortune': {
          const target = interaction.options.getUser('target') || interaction.user;
          result = await quickAI(
            `You are a mystical fortune teller with gaming knowledge. Tell ${target.username}'s fortune in a fun, cryptic way. Include emojis. Max 150 chars. Make it entertaining and slightly ominous.`,
            `Tell my fortune! What does the universe have in store?`,
            { temperature: 0.9, maxTokens: 200 },
          );
          const embed = buildEmbed(`🔮 ${target.username}'s Fortune`, result, 0x9B59B6, 'fortune', target);
          await interaction.editReply({ embeds: [embed] });
          break;
        }

        case 'story': {
          const prompt = interaction.options.getString('prompt');
          result = await quickAI(
            `You are a creative fiction writer. Write a short, entertaining story (2-3 paragraphs max, under 400 chars) about: ${prompt}. Make it vivid, funny, and engaging. Include a twist ending if possible.`,
            `Write a story about: ${prompt}`,
            { temperature: 0.95, maxTokens: 500 },
          );
          const embed = buildEmbed(`📖 ${prompt}`, result, 0x1ABC9C, 'story');
          await interaction.editReply({ embeds: [embed] });
          break;
        }

        case 'translate': {
          const text = interaction.options.getString('text');
          const lang = interaction.options.getString('language') || 'pirate';
          const langPrompts = {
            pirate: 'Translate this into pirate speak. Make it sound like a real pirate would talk:',
            robot: 'Translate this into robot language. Use Beep Boop and mechanical terms:',
            shakespearean: 'Translate this into Shakespearean English. Make it dramatic and poetic:',
            frog: 'Translate this into frog language. Add ribbit and croak sounds:',
            demon: 'Translate this into demon language. Make it sound dark and sinister:',
            'gen z': 'Translate this into Gen Z slang. Use words like slay, no cap, bussin, fam:',
            dinosaur: 'Translate this into dinosaur language. Make it roar and stomp:',
          };
          result = await quickAI(
            `${langPrompts[lang]}\n\n"${text}"`,
            `Translate "${text}" into ${lang}!`,
            { temperature: 0.9, maxTokens: 200 },
          );
          const langEmojis = { pirate: '🏴‍☠️', robot: '🤖', shakespearean: '📜', frog: '🐸', demon: '😈', 'gen z': '💅', dinosaur: '🦕' };
          const embed = buildEmbed(
            `${langEmojis[lang] || '🌍'} Translated to ${lang}`,
            `**Original:** ${text}\n\n**${lang}:** ${result}`,
            0xE67E22,
            'translate',
          );
          await interaction.editReply({ embeds: [embed] });
          break;
        }

        case 'roastbattle': {
          const user1 = interaction.options.getUser('user1');
          const user2 = interaction.options.getUser('user2');
          result = await quickAI(
            `You are hosting an epic roast battle between two gaming rivals: ${user1.username} vs ${user2.username}. Write a hilarious roast for BOTH of them, alternating lines. Make it savage, funny, and creative. Max 300 chars. Each person gets 2-3 lines. No asterisks.`,
            `Roast battle: ${user1.username} vs ${user2.username}!`,
            { temperature: 0.95, maxTokens: 400 },
          );
          const gifUrl = getGifUrl('roast');
          const embed = new EmbedBuilder()
            .setColor(0xFF4500)
            .setTitle(`🔥 ROAST BATTLE: ${user1.username} vs ${user2.username} 🔥`)
            .setDescription(result || 'Both players are too stunned to speak...')
            .addFields(
              { name: '🥊 Combatant 1', value: user1.toString(), inline: true },
              { name: '🥊 Combatant 2', value: user2.toString(), inline: true },
            )
            .setTimestamp()
            .setFooter({ text: `${BRAND.footer} • Roast Battle Arena 🔥` });
          if (gifUrl) embed.setImage(gifUrl);
          await interaction.editReply({ embeds: [embed] });
          break;
        }

        case 'simulate': {
          const scenario = interaction.options.getString('scenario');
          result = await quickAI(
            `You are a narrator describing a funny, dramatic gaming scenario. Describe what happens in: "${scenario}". Make it vivid, hilarious, and entertaining. Like you're commentating a gaming stream. Max 250 chars. Use emojis.`,
            `Simulate this scenario: ${scenario}`,
            { temperature: 0.95, maxTokens: 300 },
          );
          const embed = buildEmbed(`🎭 ${scenario}`, result, 0xF39C12, 'magic');
          await interaction.editReply({ embeds: [embed] });
          break;
        }

        default:
          await interaction.editReply({ content: 'Unknown trick! Use `/trick` to see available options.', ephemeral: true });
          return;
      }
    } catch (err) {
      const content = err.safe
        ? `❌ AI is busy! ${err.message}`
        : '❌ AI is taking a break... try again in a few seconds!';
      await interaction.editReply({ content });
    }
  },
};
