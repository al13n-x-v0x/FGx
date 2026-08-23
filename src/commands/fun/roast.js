'use strict';

/* Copyright © 2026 FGx. All rights reserved. */

const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { BRAND } = require('../../config/constants');
const { getGif } = require('../../utils/gifLibrary');
const { quickAI } = require('../../services/ai/quick');
const { analyzeImage } = require('../../services/ai/vision');

// ─── Roast intensity levels ──────────────────────────────
const HEAT = {
  light:   { label: '🔥 Light Roast', color: 0xFEE75C, flames: 1, bar: '🔥⚫⚫' },
  medium:  { label: '🔥🔥 Medium Roast', color: 0xE67E22, flames: 2, bar: '🔥🔥⚫' },
  nuclear: { label: '☢️ NUCLEAR ROAST', color: 0xED4245, flames: 3, bar: '🔥🔥🔥' },
  savage:  { label: '💀 SAVAGE ROAST', color: 0x2C2F33, flames: 3, bar: '💀💀💀' },
};

// ─── SAVAGE Roast collection (no filter, swearing, brutal) ─
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
    "You have the charisma of a wet sock.",
    "You're the human equivalent of a participation trophy.",
    "You're like a Monday morning — nobody wants you here.",
    "You're the WiFi that connects but doesn't work.",
    "You're the human version of a loading screen.",
    "You're the reason autocorrect exists.",
    "You're the type of person who claps when the plane lands.",
    "If personality was an app, yours would need a major update.",
  ],
  medium: [
    "If you were a spice, you'd be flour. Bland as shit.",
    "Your face makes onions cry. Literally.",
    "I'd roast you, but my mom taught me not to burn trash.",
    "You're so dense, light bends around you. That's why you're always in the dark.",
    "You're the reason aliens won't visit us — they saw your profile and said 'hell no'.",
    "Your personality is like expired milk — it went bad a long damn time ago.",
    "You're the human equivalent of a 404 error — present but completely fucking useless.",
    "You're the reason shampoo has instructions. Dumbass.",
    "Your existence is proof that God has a sick sense of humor.",
    "You're the reason we can't have nice things.",
    "You're the reason the gene pool needs a lifeguard. Badly.",
    "You're like a YouTube ad — nobody asked for you and everyone skips your ass.",
    "You're the reason God doesn't talk to us anymore.",
    "You're like a broken pencil — pointless as fuck.",
    "You're the human version of a pop-up ad — annoying and impossible to get rid of.",
    "Your mom should've swallowed. That's not a joke, that's a suggestion.",
    "You're the reason the ocean is salty — it's crying because you exist.",
    "If you were any more two-faced, you'd be a damn coin.",
    "You're the disappointment in your family's group chat.",
    "You're the human equivalent of a participation ribbon — you exist but nobody cares.",
  ],
  nuclear: [
    "Your family tree must be a circle. That explains why you're so damn dense.",
    "If stupid were a sport, you'd have a gold, silver, AND bronze medal. Overachiever.",
    "You're the disappointment your parents talk about when they're drunk.",
    "Somewhere out there, a tree is producing oxygen for you. I'm sorry, tree. You deserve better than this dumbass.",
    "You're not stupid — you just have bad luck when thinking. Every. Single. Time.",
    "If you were any more irrelevant, you'd be a Wikipedia page that even bots don't read.",
    "You're the reason God plays Minecraft — he's practicing how to destroy his failed creations.",
    "You're the reason the dinosaurs went extinct — they took one look at your ancestors and said 'fuck this'.",
    "You're the reason I have trust issues. And therapy bills.",
    "You're the reason your mom drinks. And honestly? I don't blame her.",
    "You're the reason God made ugly people — he ran out of good designs and just said 'screw it'.",
    "You're the reason God created the flood. He saw humanity and thought 'let me start over without this idiot'.",
    "Your parents didn't raise you. They just... left you there.",
    "You're the reason abortion clinics exist. Your mom should've listened.",
    "If you were born in the Stone Age, you'd still be the dumbest caveman. 'Ug ug' ass bitch.",
    "You're the reason the gene pool needs chlorine. And a damn hazmat team.",
    "The only thing you've ever successfully launched is a conversation that nobody gives a shit about.",
    "You're the reason God doesn't answer prayers anymore. He saw yours and said 'absolutely not'.",
    "Your life is so worthless, even your screen time report is embarrassed for you.",
    "If failure was a currency, you'd be a trillionaire. Dumbass.",
  ],
  savage: [
    "Your mom should've put you up for adoption. Hell, the dog would've done a better job raising you.",
    "You're so ugly, when you were born, the doctor slapped your mama and said 'my bad, this one's on me'.",
    "You're the reason God made hell — he needed somewhere to put your worthless ass when you die.",
    "If you were any more of a disappointment, your parents would have to invent a new word for it.",
    "You're the human equivalent of a dumpster fire behind a Wendy's. Unwanted, unloved, and fucking disgusting.",
    "The only thing you're good at is being a cautionary tale. Parents point at you and say 'don't be that shithead'.",
    "Your existence is a testament to the fact that condoms sometimes fail. A tragic, tragic failure.",
    "If intelligence was shit, you wouldn't have a pot to piss in. Dumb as fuck.",
    "You're the reason flat Earthers exist — they looked at your brain and thought 'that's how the world works'.",
    "Your life is so pathetic, I'd set a fire just to watch it warm someone up for once.",
    "You're the reason God created middle fingers — specifically for people like your sorry ass.",
    "If you were a spice, you'd be flour. If you were a book, you'd be two pages of 'fuck off'.",
    "You're the reason people say 'the good die young' — because the trash like you keeps living forever.",
    "Your parents should've just gotten a dog. A sick, flea-bitten mutt would've been a better child than you.",
    "You're so stupid, you'd try to drown a fish. Then cry about it.",
    "If you were any more worthless, you'd be aassing in the wind. A completely pointless fucking existence.",
    "Your face is so damn ugly, even blindness is a gift for people who see you.",
    "You're the reason people say 'never stick your dick in crazy' — your mom did and here you are.",
    "The world would be a better place if your dad had pulled out. Just saying.",
    "You're the reason aliens don't visit. They scanned Earth, saw your dumbass, and said 'nah, nuke it'.",
  ],
};

// ─── Avatar-specific roast templates ──────────────────────
const AVATAR_ROASTS = {
  anime: [
    "You paid money for an anime subscription just to make that your profile picture. Your parents are fucking disappointed.",
    "That anime character has more personality than you ever will. And it's drawn.",
    "You unironically call it 'Japanese animation' and get mad when people say cartoon. God you're insufferable.",
    "You have more figurines than friends. Let that sink in, you weeaboo bitch.",
    "You're the reason the anime community has a bad reputation. Every single one of you.",
    "That profile picture screams 'I peaked in middle school and never recovered'.",
    "Your waifu isn't real and neither is your social life. You lonely ass bitch.",
    "You've cried more over anime characters than real people. Pathetic.",
    "You watch anime with subs AND dubs. That's a fucking federal crime.",
    "Your entire personality is a tv show. That's sad as hell.",
  ],
  selfie: [
    "You took 47 selfies to get that one. We can all tell. Desperate much?",
    "That filter is working OVERTIME. Without it, you'd be a jump scare.",
    "You look like you'd ask to speak to the manager at a fast food restaurant. Karen-ass bitch.",
    "Your phone's front camera has PTSD from how many times you've used it.",
    "You look like a 'live, laugh, love' house personified. Basic as hell.",
    "That angle is doing more work than your personality ever has. And that's saying something.",
    "You look like you'd ask 'is this gluten-free?' about water.",
    "Your selfie says 'I peaked in high school' louder than your damn yearbook.",
    "You're the reason front-facing cameras exist and I wish they didn't.",
    "Take 50 more selfies. Maybe one will make you interesting. (It won't.)",
  ],
  pet: [
    "You use your pet as a profile picture because your actual face would scare people away. Smart move actually.",
    "Your pet has more followers than you. Let that sink in, you absolute loser.",
    "That's the only thing that will ever love you unconditionally. And it doesn't even know you exist.",
    "Your pet would swipe left on you if it could. I guarantee it.",
    "You talk to your pet more than actual humans. Explains a lot about your sad ass life.",
    "That animal is your entire personality. You are literally nothing without it.",
    "You're the reason 'dog mom' t-shirts exist and I hate everyone who wears them.",
    "Your pet is the only one who pretends to like you. And even that's debatable.",
    "You're the reason people say 'I like animals better than people.' Your own pet agrees.",
    "If your pet could talk, it would leave you. Just saying.",
  ],
  gaming: [
    "That gaming logo took you 3 hours on Canva and it still looks like absolute garbage.",
    "You have a gaming logo but a 0.2 K/D ratio. You're a walking contradiction.",
    "Your gaming setup is worth more than your future. And your future is worth nothing.",
    "You're the reason 'gamer' is an insult. Thanks for nothing, bitch.",
    "That profile picture screams 'I peak in Silver rank and blame my teammates'.",
    "You have a gaming chair but still sit wrong. Money can't fix stupid.",
    "Your gaming clan has 3 members and 2 of them are your alt accounts. Sad as fuck.",
    "You have more hours in game than in real life experiences. Touch grass, you degenerate.",
    "Your gaming logo is the only thing you've ever committed to. Not even your relationships.",
    "You're the reason 'go outside' is said on the internet every 5 minutes.",
  ],
  logo: [
    "You put a company logo as your profile picture. You're the reason corporate bootlicking exists.",
    "That brand doesn't know you exist and never will. You're literally nobody to them.",
    "You're free advertising and they're not even paying you. Stupid AND generous.",
    "Your profile picture is literally an ad. You ARE the product. How does that feel, you corporate shill?",
    "You look like you'd defend a billion-dollar company on Twitter. Pathetic.",
    "That brand wouldn't spit on you if you were on fire. And yet here you are, simping.",
    "You're the reason 'brand loyalty' is a term. It's not loyalty, it's desperation.",
    "Your profile picture is more corporate than your personality. And your personality is a spreadsheet.",
    "You're the human equivalent of a billboard. Loud, ugly, and nobody wants to look at you.",
    "At least billboards get paid. You're doing this shit for free. Dumbass.",
  ],
  default: [
    "You haven't even bothered to change your default profile picture. That says EVERYTHING about you, you lazy fuck.",
    "You're the reason Discord has a default avatar — for people like you who gave up on life.",
    "You couldn't even spend 10 seconds choosing a profile picture. 10 seconds. That's all it takes.",
    "Your profile picture is literally 'I don't care.' We get it. You gave up.",
    "You're so basic, even your profile picture is generic. You're a walking default setting.",
    "You're the human version of a default font. Bland, boring, and nobody chose you.",
    "You look like you were assembled from a IKEA manual — wrong, confusing, and missing pieces.",
    "Your profile picture is the visual equivalent of beige. Beige is more interesting than you.",
    "You're the reason 'stock photo' is an insult.",
    "You couldn't even be bothered to care about your own profile. That's depression-level apathy.",
  ],
  gradient: [
    "You picked a gradient because you have zero personality. A literal color spectrum has more depth than you.",
    "That gradient is the most interesting thing about you. And it's a fucking background.",
    "You look like a default background on a cheap phone. Basic as hell.",
    "Your profile picture is literally a color gradient. That's it. That's your whole personality.",
    "You're the reason Canva exists — to give people with no creativity something to steal.",
    "That gradient has more range than you. And it's two colors.",
    "You're the human equivalent of a loading screen background. Nobody's looking at you on purpose.",
    "Your profile picture says 'I gave up halfway through making something real.' Just like everything else you do.",
    "You look like a screensaver from 2005. And not the cool kind.",
    "That gradient is the only thing about you that has any depth at all.",
  ],
};

// ─── Intro / Outro flavor ─────────────────────────────────
const ROAST_INTROS = [
  "Listen here, you absolute disaster — ",
  "Alright, buckle up bitch — ",
  "So basically, here's the thing — ",
  "Look, I'm gonna be real with you — ",
  "Here's the brutal truth, ",
  "Straight up, no sugarcoating — ",
  "Real talk, you need to hear this — ",
  "No cap, this one's gonna hurt — ",
  "I'm just gonna say it — ",
  "Deadass, listen — ",
  "On God, I'm not holding back — ",
  "Gonna keep it a buck fifty — ",
  "Not gonna lie, this is gonna sting — ",
  "Brace yourself, ",
  "Pull up a chair, ",
];

const ROAST_OUTROS = [
  " And that's just what your avatar says about you. Imagine if I saw your actual face.",
  " That's just the first thing I noticed. I could go on for HOURS.",
  " And that's on your profile picture alone. Your personality is worse.",
  " I haven't even gotten to your username yet. That's a whole other roast.",
  " And that's being GENEROUS. I'm being nice right now.",
  " I could go on but I don't want to make you cry. Oh wait, too late.",
  " That's just from your profile. If I knew you personally? It'd be worse.",
  " Imagine what I'd say if I actually knew you. Actually, don't. You'd combust.",
  " And I'm just getting warmed up. This is the preheating stage.",
  " I'm done. For now. But I'm keeping a list.",
  " And that's the LIGHT version. You don't want the nuclear one.",
  " You're lucky I'm not saying more. Be grateful, bitch.",
  " I could roast you for days but I'll stop here. You've suffered enough.",
  " Your ancestors are rolling in their graves right now.",
  " Even God is reading this and nodding.",
];

const COMPLIMENTS = [
  "You're literally the best person in this server. And I don't say that lightly. 💜",
  "If kindness was a currency, you'd be a billionaire. The world needs more of you. 🌟",
  "You have the energy of a golden retriever on a sunny day and we love that. ☀️",
  "The world is better because you're in it. Period. No debate. 💫",
  "You're the reason someone smiled today and you don't even know it. That's real power. 😊",
  "Your vibe is immaculate and your presence is a gift. Never change. 🎁",
  "If being amazing was a crime, you'd be serving life. No parole. ⭐",
  "You deserve flowers, good food, and everything nice in this world. 🌹",
  "You're not just a W — you're THE W. The biggest W. 🏆",
  "Your energy is healing. Keep being you because you're killing it. ✨",
];

const INSULTS = [
  "You have the personality of a damp napkin. A used one.",
  "Your face makes onions cry. And onions don't even have feelings.",
  "If you were a spice, you'd be flour. Bland, basic, and boring as shit.",
    "Your presence is like background noise — annoying, unwanted, and impossible to get rid of.",
  "You make me want to learn sign language so I can ignore you quieter.",
  "Your personality is like expired milk — it went bad a long damn time ago.",
  "You're the type to WiFi disconnect and nobody notices. Not a single soul.",
  "You're the human equivalent of a 404 error — present but completely fucking useless.",
  "You're the reason I prefer animals. And even they don't like you.",
  "If you were any more irrelevant, you'd be a Wikipedia page that even bots skip.",
];

const EIGHT_BALL = [
  "🎱 **Yes.** — Without a fucking doubt.",
  "🎱 **No.** — Absolutely not. Not in a million years.",
  "🎱 **Maybe.** — Ask again when you grow a brain.",
  "🎱 **Definitely.** — I'd bet my last byte on it.",
  "🎱 **No way.** — Not in this universe. Not in any universe.",
  "🎱 **Yes!** — The stars are aligned for you, you beautiful disaster.",
  "🎱 **NO.** — Like, a thousand times no. Stop asking.",
  "🎱 **Probably.** — Leaning yes but don't get your hopes up.",
  "🎒 **Probably not.** — Leaning no. Way no.",
  "🎱 **The answer is within you.** — Look deeper. Like WAY deeper.",
  "🎱 **My sources say yes.** — Trust me bro. I know people.",
  "🎱 **Very doubtful.** — Don't hold your breath. Seriously.",
  "🎱 **Cannot predict now.** — My WiFi is down and so is my faith in you.",
  "🎱 **Outlook not so good.** — Yikes. Hard yikes.",
  "🎱 **Hell yes.** — Even I'm surprised I said that.",
  "🎱 **Fuck no.** — Next question.",
];

const RATE_REPLIES = [
  { min: 0, max: 1, msg: "💀 {score}/10? That's rough buddy. I'm sorry for your loss." },
  { min: 1, max: 3, msg: "😬 {score}/10 — not great, not terrible. But mostly not great." },
  { min: 3, max: 5, msg: "😐 {score}/10 — average at best. Mediocrity looks good on you." },
  { min: 5, max: 7, msg: "👍 {score}/10 — not bad actually! You surprised me." },
  { min: 7, max: 9, msg: "🔥 {score}/10 — that's pretty good! You're not completely worthless." },
  { min: 9, max: 10, msg: "💯 {score}/10 — absolutely perfect! I'm genuinely shocked." },
];

function randomFrom(arr) { return arr[Math.floor(Math.random() * arr.length)]; }

function getRateReply(score) {
  const range = RATE_REPLIES.find(r => score >= r.min && score <= r.max);
  return range ? range.msg.replace('{score}', score) : `${score}/10`;
}

// ─── /roast ────────────────────────────────────────────────
const roastCmd = {
  data: new SlashCommandBuilder()
    .setName('roast')
    .setDescription('Roast someone — AI sees their avatar and DESTROYS them 🔥💀')
    .addUserOption(opt =>
      opt.setName('target').setDescription('Who to roast').setRequired(false))
    .addStringOption(opt =>
      opt.setName('heat').setDescription('Roast intensity')
        .addChoices(
          { name: '🔥 Light', value: 'light' },
          { name: '🔥🔥 Medium', value: 'medium' },
          { name: '☢️ Nuclear', value: 'nuclear' },
          { name: '💀 Savage', value: 'savage' },
        )),

  async execute(interaction) {
    const target = interaction.options.getUser('target') ?? interaction.user;
    const self = target.id === interaction.user.id;
    const heat = interaction.options.getString('heat') ?? randomFrom(['light', 'medium', 'nuclear', 'savage']);
    const heatInfo = HEAT[heat];

    await interaction.deferReply();

    let roastText, method;
    try {
      ({ text: roastText, method } = await generateRoast(target, heat, self));
    } catch (err) {
      // AI completely failed — use a curated fallback
      roastText = randomFrom(MEGA_ROASTS[heat]);
      method = 'fallback';
      console.log('[roast] AI completely failed, using fallback:', err.message);
    }

    // Add intro and outro for extra flavor
    const intro = self ? '' : randomFrom(ROAST_INTROS);
    const outro = randomFrom(ROAST_OUTROS);
    const fullRoast = self ? roastText : `${intro}${roastText}${outro}`;

    // Pick GIFs
    const gifCategory = heat === 'savage' ? 'destroy' : heat === 'nuclear' ? 'roast_nuclear' : heat === 'medium' ? 'roast_medium' : 'roast_light';
    const gif = await getGif(gifCategory);
    const burnGif = await getGif('burn');

    const embed = new EmbedBuilder()
      .setColor(heatInfo.color)
      .setTitle(`${heatInfo.label} — ${self ? 'Self-Roast 💀' : `Roasting ${target.username}`}`)
      .setDescription(`> ${fullRoast}`)
      .addFields(
        { name: '🌡️ Heat Level', value: heatInfo.bar, inline: true },
        { name: '🎯 Victim', value: self ? 'Themselves (brave!)' : `${target}`, inline: true },
        { name: '💀 Method', value: method === 'vision' ? '👁️ AI Vision' : method === 'ai' ? '🤖 AI Generated' : '🔥 Curated', inline: true },
      )
      .setFooter({
        text: method === 'vision'
          ? `👁️ AI analyzed ${target.username}'s avatar and destroyed them`
          : method === 'ai'
            ? `🤖 AI-generated savage roast • ${heat} heat`
            : `${BRAND.footer} • Roasted by ${interaction.user.tag}`,
      })
      .setTimestamp(new Date());

    if (target.displayAvatarURL) embed.setThumbnail(target.displayAvatarURL({ size: 256 }));

    if (method === 'vision') {
      embed.setImage(target.displayAvatarURL({ size: 512, dynamic: true }));
    } else if (burnGif) {
      embed.setImage(burnGif);
    } else if (gif) {
      embed.setImage(gif);
    }

    await interaction.editReply({ embeds: [embed] });
  },
};

// ─── AI Generation ────────────────────────────────────────

async function generateRoast(target, heat, isSelf) {
  const username = target.username;
  const avatarUrl = target.displayAvatarURL({ size: 512, dynamic: true });

  // Try AI vision first
  if (!isSelf) {
    try {
      const visionRoast = await generateVisionRoast(avatarUrl, username, heat);
      if (visionRoast && visionRoast.length > 10) return { text: visionRoast, method: 'vision' };
    } catch (err) {
      console.log('[roast] Vision failed:', err.message);
    }
  }

  // Try AI text roast (3 attempts, pick the best)
  const attempts = [];
  for (let i = 0; i < 3; i++) {
    try {
      const roast = await generateAIRoast(username, heat, isSelf);
      if (roast && roast.length > 10) attempts.push(roast);
    } catch {
      break;
    }
  }

  if (attempts.length > 0) {
    attempts.sort((a, b) => b.length - a.length);
    return { text: attempts[0], method: 'ai' };
  }

  // Fallback to curated roasts
  return { text: randomFrom(MEGA_ROASTS[heat]), method: 'fallback' };
}

async function generateVisionRoast(avatarUrl, username, heat) {
  const heatLevel = {
    light: 'mildly funny, light teasing',
    medium: 'savage and brutal, no mercy',
    nuclear: 'absolutely devastating and merciless, swear words allowed',
    savage: 'THE MOST BRUTAL ROAST POSSIBLE. Use every swear word, be absolutely ruthless, no filter whatsoever',
  }[heat];

  const prompt = `You are the most savage roast comedian alive. Look at this person's Discord profile picture. Their username is "${username}".

Write ONE absolutely DESTROYING roast about their avatar. Be ${heatLevel}.

RULES:
- Be specific about what you SEE in the image
- Use clever wordplay, callbacks, and devastating burns
- Reference their username if it's funny
- Sound like a real stand-up comedian at a roast battle, not a robot
- Swearing is ENCOURAGED — this is a ROAST, not a tea party
- Under 200 characters
- NO asterisks, NO markdown, NO formatting
- Just the raw roast text, nothing else
- Do NOT start with quotes or dashes
- Be MEAN and FUNNY, not hurtful — big difference
- Think Andrew Schulz, Kevin Hart, Dave Chappelle at a celebrity roast

Write ONE roast. Start immediately.`;

  return analyzeImage(avatarUrl, prompt);
}

async function generateAIRoast(username, heat, isSelf) {
  const heatLevel = {
    light: 'mildly funny, light teasing, keep it playful',
    medium: 'savage, brutal, no mercy, swearing allowed',
    nuclear: 'absolutely devastating, nuclear level, use swear words freely, zero chill',
    savage: 'THE MOST BRUTAL ROAST POSSIBLE. Drop every swear word, be absolutely ruthless, savage as fuck, no filter, zero mercy',
  }[heat];

  const system = `You are the most savage roast comedian in history. You perform at celebrity roasts where everyone gets destroyed. Your style is sharp, quick, devastating, and hilarious. You swear freely and make people laugh while destroying them. You are NOT a polite AI — you're a ROAST COMEDIAN.`;

  const prompt = isSelf
    ? `Someone just asked you to roast THEMSELVES on stage. They're sitting right there, ready to take it.\n\nWrite ONE absolutely savage, hilarious self-roast. Be ${heatLevel}.\nThe audience is dying laughing.\n\nRULES:\n- Under 200 characters\n- NO asterisks, NO markdown, NO formatting\n- Just the raw roast text\n- Sound like a real comedian, not a chatbot\n- Swearing is encouraged\n- Be creative and unique\n\nWrite the roast now.`
    : `You're roasting someone named "${username}" at a sold-out show. They're sitting in the front row.\n\nWrite ONE absolutely savage, hilarious roast about them. Be ${heatLevel}.\n\nRULES:\n- Under 200 characters\n- NO asterisks, NO markdown, NO formatting\n- Just the raw roast text\n- Reference their username if it's funny\n- Swearing is encouraged\n- Be creative and unique, not generic\n- Sound like Andrew Schulz or Dave Chappelle at a roast battle\n\nWrite the roast now.`;

  const result = await quickAI(system, prompt, { maxTokens: 300, temperature: 0.9 });
  if (!result) throw new Error('AI unavailable');
  return result;
}

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
      compliment = await quickAI(
        'You are the world\'s best hype person. Give wholesome, creative, heartfelt compliments. Be genuine and make people feel special.',
        `Give a wholesome, creative, heartfelt compliment for a Discord user named "${target.username}". Make it genuine and unique. Under 200 chars. No asterisks, no formatting, just the text.`,
        { maxTokens: 300, temperature: 0.8 },
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
    .setDescription('Generate a funny insult for someone 💢')
    .addUserOption(opt =>
      opt.setName('target').setDescription('Who to insult').setRequired(false)),

  async execute(interaction) {
    const target = interaction.options.getUser('target') ?? interaction.user;
    await interaction.deferReply();
    let insult;
    try {
      insult = await quickAI(
        'You are a witty, savage comedian. Give funny, creative, devastating insults. Swearing is encouraged. Be hilarious, not genuinely mean.',
        `Give a funny, creative, savage insult for a Discord user named "${target.username}". Be clever and hilarious. Swearing allowed. Under 200 chars. No asterisks, no formatting, just the text.`,
        { maxTokens: 300, temperature: 0.8 },
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
    if (percent >= 90) { emoji = '💘'; verdict = 'SOULMATES! The universe brought you together. Nothing can stop this.'; }
    else if (percent >= 70) { emoji = '💕'; verdict = "High compatibility! There's something real here. Don't fuck it up."; }
    else if (percent >= 50) { emoji = '💛'; verdict = 'Decent match! Could work with some effort. Maybe.'; }
    else if (percent >= 30) { emoji = '💔'; verdict = "Not great... but opposites attract? I doubt it though."; }
    else { emoji = '☠️'; verdict = 'Absolutely not. Run. Save yourselves. This is a disaster waiting to happen.'; }

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
