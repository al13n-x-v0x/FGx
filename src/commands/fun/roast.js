'use strict';

/* Copyright © 2026 FGx. All rights reserved. */

const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { BRAND } = require('../../config/constants');
const { getGif } = require('../../utils/gifLibrary');
const assistant = require('../../services/ai/assistant');
const { analyzeImage } = require('../../services/ai/vision');

// ─── Roast intensity levels ──────────────────────────────
const HEAT = {
  light: { label: '🔥 Light Roast', color: 0xFEE75C, flames: 1 },
  medium: { label: '🔥🔥 Medium Roast', color: 0xE67E22, flames: 2 },
  nuclear: { label: '☢️ NUCLEAR ROAST', color: 0xED4245, flames: 3 },
};

// ─── MEGA Roast collection (100+ unique roasts) ───────────
const MEGA_ROASTS = {
  light: [
    "You're like a cloud. When you disappear, it's a beautiful day.",
    "I'd agree with you, but then we'd both be wrong.",
    "You bring everyone a lot of joy… when you leave.",
    "You're the human version of a sneeze that doesn't come out.",
    "You're like a software update — whenever I see you, I think 'not now'.",
    "You're proof that evolution can go in reverse.",
    "Your birth certificate should be an apology letter.",
    "You're the type of person to Google 'how to Google'.",
    "I'm jealous of people who don't know you.",
    "You're the reason God created the middle finger.",
    "You're like a penny — two-faced and not worth much.",
    "If you were any more boring, you'd be a screensaver.",
    "You're the reason I prefer animals.",
    "You have the charisma of a wet sock.",
    "You're the living proof that man can fly without wings.",
    "You're the human equivalent of a participation trophy.",
    "You're like aMonday morning — nobody wants you here.",
    "You're the WiFi that connects but doesn't work.",
    "You're the human version of a loading screen.",
    "You're the reason autocorrect exists.",
  ],
  medium: [
    "If you were a spice, you'd be flour.",
    "Your face makes onions cry.",
    "You're the type to WiFi disconnect and nobody notices.",
    "Your personality is like expired milk — it went bad a long time ago.",
    "I'd roast you, but my mom taught me not to burn trash.",
    "You're so dense, light bends around you.",
    "You're the reason aliens won't visit us.",
    "You're like a YouTube ad — nobody asked for you and everyone skips you.",
    "You're the human equivalent of a 404 error — present but completely useless.",
    "Your existence is proof that God has a sense of humor.",
    "You're the reason shampoo has instructions.",
    "You're like a participation trophy — everyone gets one but nobody wants it.",
    "You're the reason we can't have nice things.",
    "If you were any more two-faced, you'd be a coin.",
    "You're the reason God doesn't talk to us anymore.",
    "You're like a broken pencil — pointless.",
    "You're the reason the gene pool needs a lifeguard.",
    "You're like a cloud of GNATS — annoying and nobody knows where you came from.",
    "You're the human version of a pop-up ad.",
    "You're the reason I close my eyes when I pray.",
  ],
  nuclear: [
    "Your family tree must be a circle.",
    "If stupid were a sport, you'd have a gold medal, a silver medal, AND a bronze medal.",
    "You're the disappointment in your parents' life.",
    "Somewhere out there, a tree is producing oxygen for you. I'm sorry, tree.",
    "You're not stupid — you just have bad luck when thinking.",
    "The only thing you've ever successfully launched is a conversation topic nobody cares about.",
    "You're the reason aliens won't visit us.",
    "If you were any more irrelevant, you'd be a Wikipedia page nobody reads.",
    "You're the reason God plays Minecraft — to destroy his failed creations.",
    "You're the reason the dinosaurs went extinct — they saw you coming.",
    "You're the reason I have trust issues.",
    "You're the reason I drink.",
    "You're the reason I wake up in the morning — to make sure you're still suffering.",
    "You're the reason God made ugly people.",
    "You're the reason the ocean is salty — it's crying because you exist.",
    "You're the reason I keep a list.",
    "You're the reason God doesn't give second chances.",
    "You're the reason I believe in reincarnation — because you clearly didn't get it right the first time.",
    "You're the reason God created the flood.",
    "You're the reason I keep a baseball bat under my bed.",
  ],
};

// ─── Avatar-specific roast templates ──────────────────────
const AVATAR_ROASTS = {
  anime: [
    "You paid money for an anime subscription just to make that your profile picture. Your parents are disappointed.",
    "That anime character has more personality than you ever will.",
    "You unironically call it 'Japanese animation' and get mad when people say cartoon.",
    "You have more figurines than friends.",
    "You're the reason the anime community has a bad reputation.",
    "That profile picture screams 'I peaked in middle school.'",
    "You watch anime subtitles AND dubs. That's a federal crime.",
    "Your waifu isn't real and neither is your social life.",
    "You're the reason people say 'not all anime fans' when defending you.",
    "You've cried more over anime characters than real people.",
  ],
  selfie: [
    "You took 47 selfies to get that one. We can tell.",
    "That filter is working OVERTIME.",
    "You look like you'd ask to speak to the manager at a fast food restaurant.",
    "You're the reason selfie sticks were invented.",
    "Your phone's front camera has PTSD from how many times you've used it.",
    "You look like a 'live, laugh, love' house personified.",
    "That angle is doing more work than your personality ever has.",
    "You look like you'd ask 'is this gluten-free?' about water.",
    "Your selfie says 'I peaked in high school' louder than your yearbook.",
    "You're the reason front-facing cameras exist and I wish they didn't.",
  ],
  pet: [
    "You use your pet as a profile picture because your actual face would scare people away.",
    "Your pet has more followers than you.",
    "That's the only thing that will ever love you unconditionally.",
    "You're the reason pet Instagram accounts exist and ruin the internet.",
    "Your pet would swipe left on you.",
    "You talk to your pet more than actual humans. Explains a lot.",
    "That animal is your entire personality and it doesn't even know you exist.",
    "You're the reason 'dog mom' t-shirts exist.",
    "Your pet is the only one who pretends to like you.",
    "You're the reason people say 'I like animals better than people.' Your pet agrees.",
  ],
  gaming: [
    "That gaming logo took you 3 hours on Canva and it still looks trash.",
    "You have a gaming logo but a 0.2 K/D ratio.",
    "Your gaming setup is worth more than your future.",
    "You're the reason 'gamer' is an insult.",
    "That profile picture screams 'I peak in Silver rank.'",
    "You have a gaming chair but still sit wrong.",
    "You're the reason people say 'go outside' on the internet.",
    "Your gaming clan has 3 members and 2 of them are your alt accounts.",
    "You have more hours in game than in real life experiences.",
    "Your gaming logo is the only thing you've ever committed to.",
  ],
  logo: [
    "You put a company logo as your profile picture. You're the reason corporate bootlicking exists.",
    "That brand doesn't know you exist and never will.",
    "You're free advertising and they're not even paying you.",
    "Your profile picture is literally an ad. You ARE the product.",
    "You're the reason capitalism works.",
    "You look like you'd defend a billion-dollar company on Twitter.",
    "That brand wouldn't spit on you if you were on fire.",
    "You're the reason 'brand loyalty' is a term.",
    "Your profile picture is more corporate than your personality.",
    "You're the human equivalent of a billboard.",
  ],
  default: [
    "You haven't even bothered to change your default profile picture. That says everything about you.",
    "You're the reason Discord has a default avatar — for people like you who gave up.",
    "You couldn't even spend 10 seconds choosing a profile picture.",
    "Your profile picture is literally 'I don't care.' We get it.",
    "You're so basic, even your profile picture is generic.",
    "You're the human version of a default font.",
    "You look like you were assembled from a IKEA manual — wrong and confusing.",
    "Your profile picture is the visual equivalent of beige.",
    "You're the reason 'stock photo' is an insult.",
    "You couldn't even be bothered to care about your own profile.",
  ],
  gradient: [
    "You picked a gradient because you have no personality.",
    "That gradient is the most interesting thing about you.",
    "You look like a default background on a cheap phone.",
    "Your profile picture is literally a color spectrum. That's it. That's your personality.",
    "You're the reason Canva exists.",
    "That gradient has more depth than you.",
    "You're the human equivalent of a loading screen background.",
    "Your profile picture says 'I gave up halfway through making something real.'",
    "You look like a screensaver from 2005.",
    "That gradient is the only thing about you that has range.",
  ],
};

// ─── Roast intro lines (adds flavor) ──────────────────────
const ROAST_INTROS = [
  "Listen here, ",
  "Alright, ",
  "So basically, ",
  "Look, ",
  "Here's the thing, ",
  "Straight up, ",
  "Real talk, ",
  "No cap, ",
  "I'm just gonna say it — ",
  "Listen — ",
  "Okay but fr — ",
  "Gonna keep it real — ",
  "Not gonna lie — ",
  "Deadass — ",
  "On God — ",
];

// ─── Roast outros (adds finishing punch) ───────────────────
const ROAST_OUTROS = [
  " And that's just what your avatar says about you.",
  " That's just the first thing I noticed.",
  " And that's on your profile picture alone.",
  " I haven't even gotten to your username yet.",
  " And that's being generous.",
  " I could go on but I don't want to be mean.",
  " That's just what I see from your profile.",
  " Imagine what I'd say if I actually knew you.",
  " And I'm just getting warmed up.",
  " I'm done. For now.",
  " And that's the LIGHT version.",
  " You're lucky I'm not saying more.",
  " I could roast you for days but I'll stop here.",
];

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
  "🎒 **Probably not.** — Leaning no.",
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
  return '🔥'.repeat(info.flames) + '⚫'.repeat(3 - info.flames);
}

/** Detect what type of avatar a user has based on common patterns */
function detectAvatarType(avatarUrl) {
  if (!avatarUrl) return 'default';
  // Discord default avatars
  if (avatarUrl.includes('embed/avatars/') || avatarUrl.includes('default')) return 'default';
  return 'general';
}

/**
 * Generate a multi-attempt roast using AI — tries 3 times and picks the best one.
 * Falls back to categorized fallback roasts.
 */
async function generateRoast(target, heat, isSelf) {
  const username = target.username;
  const avatarUrl = target.displayAvatarURL({ size: 512, dynamic: true });

  // Try AI vision first (analyzes the actual avatar)
  if (!isSelf) {
    try {
      const visionRoast = await generateVisionRoast(avatarUrl, username, heat);
      if (visionRoast && visionRoast.length > 10) return { text: visionRoast, method: 'vision' };
    } catch (err) {
      console.log('[roast] Vision failed:', err.message);
    }
  }

  // Try AI text roast (3 attempts, pick the most unique)
  const attempts = [];
  for (let i = 0; i < 3; i++) {
    try {
      const roast = await generateAIRoast(username, heat, isSelf);
      if (roast && roast.length > 10) attempts.push(roast);
    } catch {
      break; // AI unavailable, stop trying
    }
  }

  // Pick the longest/most creative attempt
  if (attempts.length > 0) {
    attempts.sort((a, b) => b.length - a.length);
    return { text: attempts[0], method: 'ai' };
  }

  // Fallback to categorized roasts
  const roast = randomFrom(MEGA_ROASTS[heat]);
  return { text: roast, method: 'fallback' };
}

/**
 * Generate a roast using AI vision — analyzes the avatar.
 */
async function generateVisionRoast(avatarUrl, username, heat) {
  const heatDesc = heat === 'light' ? 'mildly funny' : heat === 'medium' ? 'savage and brutal' : 'absolutely devastating and merciless';

  const prompt = `You are the funniest roast comedian alive. Look at this person's Discord profile picture.

Their username is: "${username}"

Write ONE absolutely hilarious roast about their avatar and overall vibe. Be ${heatDesc}.

IMPORTANT RULES:
- Be specific about what you SEE in the image
- Use clever wordplay and callbacks
- Reference the username if it's funny
- Make it sound like a real stand-up comedian, not a robot
- Under 200 characters
- NO asterisks, NO markdown, NO formatting
- Just the raw roast text, nothing else
- Do NOT start with quotes or dashes
- Be mean but funny, not actually hurtful

Examples of good roasts:
- "That profile picture is doing the heavy lifting because your personality sure won't"
- "You look like you'd ask for extra napkins at a free sample"
- "Your avatar screams 'I peaked in middle school and never recovered'"

Write ONE roast. Start writing immediately. No preamble.`;

  return analyzeImage(avatarUrl, prompt);
}

/**
 * Generate a roast using text-based AI.
 */
async function generateAIRoast(username, heat, isSelf) {
  const heatDesc = heat === 'light' ? 'mildly funny, light teasing' : heat === 'medium' ? 'savage, brutal, no mercy' : 'absolutely devastating, nuclear level, zero chill';

  const prompt = isSelf
    ? `You are a legendary roast comedian. Someone just asked you to roast THEMSELVES on stage.

Write ONE absolutely savage, hilarious self-roast. Be ${heatDesc}.
The audience is dying laughing.

RULES:
- Under 150 characters
- NO asterisks, NO markdown, NO formatting
- Just the raw roast text
- Make it sound like a real comedian, not a chatbot
- Be creative and unique, not generic

Write the roast now. No preamble, no quotes.`

    : `You are a legendary roast comedian at a sold-out show. You're roasting someone named "${username}" who's sitting in the front row.

Write ONE absolutely savage, hilarious roast about them. Be ${heatDesc}.

RULES:
- Under 150 characters
- NO asterisks, NO markdown, NO formatting  
- Just the raw roast text
- Reference their username if possible
- Be creative and unique, not generic
- Sound like Kevin Hart, Andrew Schulz, or Dave Chappelle

Write the roast now. No preamble, no quotes.`;

  return assistant.chat(prompt);
}

// ─── /roast ────────────────────────────────────────────────
const roastCmd = {
  data: new SlashCommandBuilder()
    .setName('roast')
    .setDescription('Roast someone — AI sees their avatar and destroys them 🔥')
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

    const { text: roastText, method } = await generateRoast(target, heat, self);

    // Add intro and outro for extra flavor
    const intro = self ? '' : randomFrom(ROAST_INTROS);
    const outro = randomFrom(ROAST_OUTROS);
    const fullRoast = self ? roastText : `${intro}${roastText}${outro}`;

    const gif = await getGif('roast');
    const embed = new EmbedBuilder()
      .setColor(heatInfo.color)
      .setTitle(`${heatInfo.label} — ${self ? 'Self-Roast' : `Roasting ${target.username}`}`)
      .setDescription(`> ${fullRoast}`)
      .addFields(
        { name: '🌡️ Heat Level', value: flameBar(heat), inline: true },
        { name: '🎯 Victim', value: self ? 'Themselves (brave!)' : `${target}`, inline: true },
      )
      .setFooter({
        text: method === 'vision'
          ? `👁️ AI analyzed ${target.username}'s avatar`
          : method === 'ai'
            ? `🤖 AI-generated roast`
            : `${BRAND.footer} • Roasted by ${interaction.user.tag}`,
      })
      .setTimestamp(new Date());

    // Show the avatar prominently
    if (target.displayAvatarURL) embed.setThumbnail(target.displayAvatarURL({ size: 256 }));

    // Show the avatar as the main image if we used vision
    if (method === 'vision') {
      embed.setImage(target.displayAvatarURL({ size: 512, dynamic: true }));
    } else if (gif) {
      embed.setImage(gif);
    }

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
