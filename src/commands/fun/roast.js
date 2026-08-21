'use strict';

/* Copyright © 2026 FGx. All rights reserved. */

const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { BRAND } = require('../../config/constants');
const { getGif } = require('../../utils/gifLibrary');
const assistant = require('../../services/ai/assistant');

// ─── Roast intensity levels ──────────────────────────────
const HEAT = {
  light: { label: '🔥 Light Roast', color: 0xFEE75C, flames: 1 },
  medium: { label: '🔥🔥 Medium Roast', color: 0xE67E22, flames: 2 },
  nuclear: { label: '☢️ NUCLEAR ROAST', color: 0xED4245, flames: 3 },
};

// ─── Fallback roasts by intensity (used if AI fails) ──────
const FALLBACK_ROASTS = {
  light: [
    "You're like a cloud. When you disappear, it's a beautiful day.",
    "I'd agree with you, but then we'd both be wrong.",
    "You bring everyone a lot of joy… when you leave.",
    "You're the human version of a sneeze that doesn't come out.",
    "You're like a software update — whenever I see you, I think 'not now'.",
    "If you were any more inbred, you'd be a sandwich.",
    "You're proof that evolution can go in reverse.",
    "Your birth certificate should be an apology letter.",
    "You're the type of person to Google 'how to Google'.",
    "I'm jealous of people who don't know you.",
  ],
  medium: [
    "You're so dense, light bends around you.",
    "You have the charisma of a wet sock.",
    "I'd roast you, but my mom taught me not to burn trash.",
    "You're the living proof that man can fly without wings.",
    "You're the reason God created the middle finger.",
    "If you were a spice, you'd be flour.",
    "Your face makes onions cry.",
    "You're like a Monday morning — nobody wants you here.",
    "You're the type to WiFi disconnect and nobody notices.",
    "Your personality is like expired milk — it went bad a long time ago.",
  ],
  nuclear: [
    "Your family tree must be a circle.",
    "You're the reason shampoo has instructions.",
    "If stupid were a sport, you'd have a gold medal, a silver medal, AND a bronze medal.",
    "You're the disappointment in your parents' life.",
    "Somewhere out there, a tree is producing oxygen for you. I'm sorry, tree.",
    "You're not stupid — you just have bad luck when thinking.",
    "The only thing you've ever successfully launched is a conversation topic nobody cares about.",
    "You're like a human version of a 404 error — present but completely useless.",
    "You're the reason aliens won't visit us.",
    "If you were any more irrelevant, you'd be a Wikipedia page nobody reads.",
  ],
};

const COMPLIMENTS = [
  "You're literally the best person in this server. 💜",
  "If kindness was a currency, you'd be a billionaire. 🌟",
  "You have the energy of a golden retriever on a sunny day. ☀️",
  "The world is better because you're in it. 💫",
  "You're the reason someone smiled today and you don't even know it. 😊",
  "Your vibe is immaculate and your presence is a gift. 🎁",
  "If being amazing was a crime, you'd be serving life. ⭐",
  "You deserve flowers, good food, and everything nice. 🌹",
  "You're not just a W — you're THE W. 🏆",
  "Your energy is healing. Keep being you. ✨",
];

const INSULTS = [
  "You have the personality of a damp napkin.",
  "Your face makes onions cry.",
  "You're the reason I prefer animals.",
  "If you were a spice, you'd be flour.",
  "You're like a Monday morning — nobody wants you here.",
  "Your presence is like background noise — annoying but hard to get rid of.",
  "You're the human equivalent of a 404 error.",
  "You make me want to learn sign language so I can ignore you quieter.",
  "Your personality is like expired milk — it went bad a long time ago.",
  "You're the type to WiFi disconnect and nobody notices.",
];

const EIGHT_BALL = [
  "🎱 **Yes.** — Without a doubt.",
  "🎱 **No.** — Absolutely not.",
  "🎱 **Maybe.** — Ask again later.",
  "🎱 **Definitely.** — I'd bet my last byte on it.",
  "🎱 **No way.** — Not in this universe.",
  "🎱 **Yes!** — The stars are aligned for you.",
  "🎱 **NO.** — Like, a thousand times no.",
  "🎱 **Probably.** — Leaning yes.",
  "🎱 **Probably not.** — Leaning no.",
  "🎱 **The answer is within you.** — Look deeper.",
  "🎱 **My sources say yes.** — Trust me bro.",
  "🎱 **Very doubtful.** — Don't hold your breath.",
  "🎱 **Cannot predict now.** — My WiFi is down.",
  "🎱 **Outlook not so good.** — Yikes.",
];

const RATE_REPLIES = [
  { min: 0, max: 1, msg: "💀 0/10? That's rough buddy." },
  { min: 1, max: 3, msg: "😬 {score}/10 — not great, not terrible." },
  { min: 3, max: 5, msg: "😐 {score}/10 — average at best." },
  { min: 5, max: 7, msg: "👍 {score}/10 — not bad actually!" },
  { min: 7, max: 9, msg: "🔥 {score}/10 — that's pretty good!" },
  { min: 9, max: 10, msg: "💯 {score}/10 — absolutely perfect!" },
];

function randomFrom(arr) { return arr[Math.floor(Math.random() * arr.length)]; }

function getRateReply(score) {
  const range = RATE_REPLIES.find(r => score >= r.min && score <= r.max);
  return range ? range.msg.replace('{score}', score) : `${score}/10`;
}

/** Build the flame bar for roast intensity */
function flameBar(level) {
  const info = HEAT[level];
  return '🔥'.repeat(info.flames) + ' gray_fire'.repeat(3 - info.flames).replace(/gray_fire/g, '⚫');
}

// ─── /roast ────────────────────────────────────────────────
const roastCmd = {
  data: new SlashCommandBuilder()
    .setName('roast')
    .setDescription('Roast someone with savage AI-generated burns 🔥')
    .addUserOption(opt =>
      opt.setName('target').setDescription('Who to roast').setRequired(false))
    .addStringOption(opt =>
      opt.setName('heat').setDescription('Roast intensity')
        .addChoices(
          { name: '🔥 Light', value: 'light' },
          { name: '🔥🔥 Medium', value: 'medium' },
          { name: '☢️ Nuclear', value: 'nuclear' },
        )),

  async execute(interaction) {
    const target = interaction.options.getUser('target') ?? interaction.user;
    const self = target.id === interaction.user.id;
    const heat = interaction.options.getString('heat') ?? randomFrom(['light', 'medium', 'nuclear']);
    const heatInfo = HEAT[heat];

    await interaction.deferReply();

    let roast;
    try {
      const prompt = self
        ? `You are a legendary comedy roast master at a stand-up show. The person on stage is roasting THEMSELVES. Write ONE savage, hilarious, creative self-roast. Be brutally funny — think Kevin Hart or Andrew Schulz level. Under 250 chars. No asterisks, no formatting, just the raw roast text.`
        : `You are a legendary comedy roast master. Roast a Discord user named "${target.username}" who is sitting in the front row. Write ONE absolutely savage, hilarious, creative roast. Be brutally funny — think Kevin Hart or Andrew Schulz level. Under 250 chars. No asterisks, no formatting, just the raw roast text. Make it PERSONAL to their name if possible.`;
      roast = await assistant.chat(prompt);
      // Clean up any quotes or extra formatting
      roast = roast.replace(/^["']|["']$/g, '').replace(/\*\*/g, '').trim();
    } catch {
      roast = randomFrom(FALLBACK_ROASTS[heat]);
    }

    const gif = await getGif('roast');
    const embed = new EmbedBuilder()
      .setColor(heatInfo.color)
      .setTitle(`${heatInfo.label} — ${self ? 'Self-Roast' : `Roasting ${target.username}`}`)
      .setDescription(`> ${roast}`)
      .addFields(
        { name: '🌡️ Heat Level', value: flameBar(heat), inline: true },
        { name: '🎯 Victim', value: self ? 'Themselves (brave!)' : `${target}`, inline: true },
      )
      .setFooter({ text: `${BRAND.footer} • Roasted by ${interaction.user.tag}` })
      .setTimestamp(new Date());
    if (target.displayAvatarURL) embed.setThumbnail(target.displayAvatarURL({ size: 256 }));
    if (gif) embed.setImage(gif);

    await interaction.editReply({ embeds: [embed] });
  },
};

// ─── /compliment ────────────────────────────────────────────
const complimentCmd = {
  data: new SlashCommandBuilder()
    .setName('compliment')
    .setDescription('Give someone a wholesome compliment 💜')
    .addUserOption(opt =>
      opt.setName('target').setDescription('Who to compliment').setRequired(false)),

  async execute(interaction) {
    const target = interaction.options.getUser('target') ?? interaction.user;
    await interaction.deferReply();
    let compliment;
    try {
      compliment = await assistant.chat(
        `You are the world's best hype person. Give a wholesome, creative, heartfelt compliment for a Discord user named "${target.username}". Make it genuine and make them feel special. Under 200 chars. No asterisks, no formatting, just the text.`
      );
      compliment = compliment.replace(/^["']|["']$/g, '').replace(/\*\*/g, '').trim();
    } catch {
      compliment = randomFrom(COMPLIMENTS);
    }
    const gif = await getGif('love');
    const embed = new EmbedBuilder()
      .setColor(0xEB459E)
      .setTitle(`💜 Compliment for ${target.username}`)
      .setDescription(`> ${compliment}`)
      .setThumbnail(target.displayAvatarURL({ size: 256 }))
      .setFooter({ text: `${BRAND.footer} • From ${interaction.user.tag}` })
      .setTimestamp(new Date());
    if (gif) embed.setImage(gif);
    await interaction.editReply({ embeds: [embed] });
  },
};

// ─── /insult ────────────────────────────────────────────────
const insultCmd = {
  data: new SlashCommandBuilder()
    .setName('insult')
    .setDescription('Generate a funny insult for someone')
    .addUserOption(opt =>
      opt.setName('target').setDescription('Who to insult').setRequired(false)),

  async execute(interaction) {
    const target = interaction.options.getUser('target') ?? interaction.user;
    await interaction.deferReply();
    let insult;
    try {
      insult = await assistant.chat(
        `You are a witty comedian. Give a funny, creative, savage insult for a Discord user named "${target.username}". Be clever and hilarious, not genuinely mean. Under 200 chars. No asterisks, no formatting, just the text.`
      );
      insult = insult.replace(/^["']|["']$/g, '').replace(/\*\*/g, '').trim();
    } catch {
      insult = randomFrom(INSULTS);
    }
    const gif = await getGif('angry');
    const embed = new EmbedBuilder()
      .setColor(0xE67E22)
      .setTitle(`💢 ${target.username} just got insulted`)
      .setDescription(`> ${insult}`)
      .setThumbnail(target.displayAvatarURL({ size: 256 }))
      .setFooter({ text: `${BRAND.footer} • Insulted by ${interaction.user.tag}` })
      .setTimestamp(new Date());
    if (gif) embed.setImage(gif);
    await interaction.editReply({ embeds: [embed] });
  },
};

// ─── /8ball ────────────────────────────────────────────────
const eightBallCmd = {
  data: new SlashCommandBuilder()
    .setName('8ball')
    .setDescription('Ask the magic 8-ball a question 🎱')
    .addStringOption(opt =>
      opt.setName('question').setDescription('Your question').setRequired(true)),

  async execute(interaction) {
    const question = interaction.options.getString('question');
    const answer = randomFrom(EIGHT_BALL);
    const gif = await getGif('brain');
    const embed = new EmbedBuilder()
      .setColor(0x9B59B6)
      .setTitle('🎱 Magic 8-Ball')
      .setDescription(`**Q:** ${question}\n\n**A:** ${answer}`)
      .setFooter({ text: BRAND.footer })
      .setTimestamp(new Date());
    if (gif) embed.setThumbnail(gif);
    await interaction.reply({ embeds: [embed] });
  },
};

// ─── /choose ────────────────────────────────────────────────
const chooseCmd = {
  data: new SlashCommandBuilder()
    .setName('choose')
    .setDescription('Let the bot choose between options')
    .addStringOption(opt =>
      opt.setName('options').setDescription('Options separated by |').setRequired(true)),

  async execute(interaction) {
    const options = interaction.options.getString('options').split('|').map(o => o.trim()).filter(Boolean);
    if (options.length < 2) {
      return interaction.reply({ content: '❌ Give me at least 2 options separated by `|`.', ephemeral: true });
    }
    const chosen = randomFrom(options);
    const gif = await getGif('cool');
    const embed = new EmbedBuilder()
      .setColor(BRAND.colors.primary)
      .setTitle('🤔 The Choice Has Been Made')
      .setDescription(
        `**Options:** ${options.map(o => `\`${o}\``).join(', ')}\n\n` +
        `**I choose:** 🏆 **${chosen}**`
      )
      .setFooter({ text: BRAND.footer })
      .setTimestamp(new Date());
    if (gif) embed.setImage(gif);
    await interaction.reply({ embeds: [embed] });
  },
};

// ─── /rate ──────────────────────────────────────────────────
const rateCmd = {
  data: new SlashCommandBuilder()
    .setName('rate')
    .setDescription('Rate something from 0 to 10')
    .addStringOption(opt =>
      opt.setName('thing').setDescription('What to rate').setRequired(true)),

  async execute(interaction) {
    const thing = interaction.options.getString('thing');
    const score = (Math.random() * 10).toFixed(1);
    const reply = getRateReply(score);
    const gifKey = score >= 7 ? 'w' : score >= 4 ? 'vibe' : 'oof';
    const gif = await getGif(gifKey);
    const embed = new EmbedBuilder()
      .setColor(score >= 7 ? 0x57F287 : score >= 4 ? 0xFEE75C : 0xED4245)
      .setTitle(`📊 Rating: ${thing}`)
      .setDescription(`${reply}\n\n*Score: ${score}/10*`)
      .setFooter({ text: `${BRAND.footer} • Rated by ${interaction.user.tag}` })
      .setTimestamp(new Date());
    if (gif) embed.setImage(gif);
    await interaction.reply({ embeds: [embed] });
  },
};

// ─── /ship ──────────────────────────────────────────────────
const shipCmd = {
  data: new SlashCommandBuilder()
    .setName('ship')
    .setDescription('Check love compatibility between two people 💕')
    .addUserOption(opt =>
      opt.setName('user1').setDescription('First person').setRequired(true))
    .addUserOption(opt =>
      opt.setName('user2').setDescription('Second person').setRequired(true)),

  async execute(interaction) {
    const user1 = interaction.options.getUser('user1');
    const user2 = interaction.options.getUser('user2');
    const hash = (user1.id + user2.id).split('').reduce((a, c) => a + c.charCodeAt(0), 0);
    const percent = hash % 101;

    let emoji, verdict;
    if (percent >= 90) { emoji = '💘'; verdict = 'SOULMATES! The universe brought you together.'; }
    else if (percent >= 70) { emoji = '💕'; verdict = "High compatibility! There's something real here."; }
    else if (percent >= 50) { emoji = '💛'; verdict = 'Decent match! Could work with some effort.'; }
    else if (percent >= 30) { emoji = '💔'; verdict = "Not great... but opposites attract?"; }
    else { emoji = '☠️'; verdict = 'Absolutely not. Run. Save yourselves.'; }

    const bar = '❤️'.repeat(Math.round(percent / 10)) + '🖤'.repeat(10 - Math.round(percent / 10));
    const gif = await getGif('ship');
    const embed = new EmbedBuilder()
      .setColor(0xEB459E)
      .setTitle(`${emoji} Love Calculator`)
      .setDescription(
        `**${user1.username}** 💕 **${user2.username}**\n\n` +
        `${bar}\n\n**Compatibility: ${percent}%**\n\n*${verdict}*`
      )
      .setFooter({ text: BRAND.footer })
      .setTimestamp(new Date());
    if (gif) embed.setImage(gif);
    await interaction.reply({ embeds: [embed] });
  },
};

module.exports = [roastCmd, complimentCmd, insultCmd, eightBallCmd, chooseCmd, rateCmd, shipCmd];
