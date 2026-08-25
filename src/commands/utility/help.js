'use strict';

/* Copyright © 2026 FGx. All rights reserved. */

const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const { BRAND } = require('../../config/constants');

/**
 * Interactive help command — paginated by category.
 * Each page shows one category with every command and its description.
 */

const CATEGORIES = [
  {
    name: '⚔️ Clan & Competitive',
    description: 'The core of FGx — matches, scrims, rankings, and team management.',
    commands: [
      { name: '/fgx', desc: 'Open the FGx control panel — profile, clan, rankings, AI, security' },
      { name: '/bloxstrike', desc: 'Open the BloxStrike command hub' },
      { name: '/clan info', desc: 'View clan info, roster counts, and your rank' },
      { name: '/clan roster', desc: 'Full clan roster with stats' },
      { name: '/roster', desc: 'Quick roster view' },
      { name: '/loadout', desc: 'BloxStrike loadout guide — buy situations, roles, economy' },
      { name: '/match record', desc: 'Record an official match result (staff)' },
      { name: '/match history', desc: 'View match history' },
      { name: '/clanwar challenge', desc: 'Challenge another clan to a war (staff)' },
      { name: '/clanwar result', desc: 'Record a clan war result (staff)' },
      { name: '/scrim', desc: 'Scrim management — create, accept, find' },
      { name: '/tryout start', desc: 'Start a tryout session (staff)' },
      { name: '/evaluate record', desc: 'Record trial evaluation scores (staff)' },
      { name: '/training start', desc: 'Start a training session (staff)' },
      { name: '/event create', desc: 'Create and announce an event (staff)' },
      { name: '/analysis player', desc: 'Staff-only player analysis from recorded data' },
      { name: '/analysis match', desc: 'Staff-only match analysis' },
      { name: '/shuffle', desc: 'Shuffle players into random teams' },
    ],
  },
  {
    name: '🎮 Private Servers & Duels',
    description: 'Instant private servers for BloxStrike matches with auto-invites.',
    commands: [
      { name: '/1v1', desc: '⚡ Instant 1v1 server — drops invite in chat' },
      { name: '/2v2', desc: '⚡ Instant 2v2 server' },
      { name: '/3v3', desc: '⚡ Instant 3v3 server' },
      { name: '/4v4', desc: '⚡ Instant 4v4 server' },
      { name: '/5v5', desc: '⚡ Instant 5v5 server' },
      { name: '/6v6', desc: '⚡ Instant 6v6 server' },
      { name: '/2v1 /3v1 /3v2 /4v2 /4v3 /5v3 /5v4 /6v4 /6v5', desc: '⚡ Asymmetric duel servers' },
      { name: '/private create', desc: 'Create a custom private server with options' },
      { name: '/private list', desc: 'List your active private servers' },
      { name: '/private end', desc: 'End one of your private servers' },
    ],
  },
  {
    name: '🛡️ Moderation',
    description: 'Keep the server clean and safe.',
    commands: [
      { name: '/warn', desc: 'Warn a member (tracked in warnings system)' },
      { name: '/warnings', desc: 'View a member\'s warning history' },
      { name: '/timeout', desc: 'Timeout a member (1m–7d)' },
      { name: '/kick', desc: 'Kick a member from the server' },
      { name: '/ban', desc: 'Ban a member' },
      { name: '/unban', desc: 'Unban a member' },
      { name: '/purge', desc: 'Bulk-delete messages (1–100)' },
      { name: '/slowmode', desc: 'Set channel slowmode' },
      { name: '/lock', desc: 'Lock a channel' },
      { name: '/unlock', desc: 'Unlock a channel' },
      { name: '/nick', desc: 'Change a member\'s nickname' },
      { name: '/role add', desc: 'Add a role to a member' },
      { name: '/role remove', desc: 'Remove a role from a member' },
      { name: '/say', desc: 'Make the bot send a message in any channel' },
    ],
  },
  {
    name: '🔐 Security',
    description: 'Automod, raid protection, and server security.',
    commands: [
      { name: '/security', desc: 'View server security status and settings' },
      { name: '/automod config', desc: 'Configure automod rules (flood, spam, invites, caps)' },
      { name: '/automod test', desc: 'Test automod rules against a message' },
    ],
  },
  {
    name: '👥 Community & Profile',
    description: 'Your identity, stats, and progression in FGx.',
    commands: [
      { name: '/profile', desc: 'View your (or someone\'s) FGx profile with stats' },
      { name: '/player', desc: 'Alias of /profile' },
      { name: '/level', desc: 'Check your community level and XP' },
      { name: '/rank', desc: 'Alias of /level' },
      { name: '/leaderboard', desc: 'Competitive leaderboards — wins, kills, K/D, rating' },
      { name: '/achievements', desc: 'View all achievements and your unlocked badges' },
      { name: '/status', desc: 'Show FGx system status (DB, uptime, memory)' },
      { name: '/bot-info', desc: 'Detailed bot info — uptime, memory, AI, system stats' },
      { name: '/remindme', desc: 'Set a reminder — bot DMs you when it\'s time' },
    ],
  },
  {
    name: '🪙 Economy (FGx Coins)',
    description: 'Earn, spend, and gamble ₣Ԡ🇽 coins.',
    commands: [
      { name: '/fgxcoin wallet', desc: 'Show your ₣Ԡ🇽 balance' },
      { name: '/fgxcoin daily', desc: 'Claim daily reward' },
      { name: '/fgxcoin weekly', desc: 'Claim weekly bonus' },
      { name: '/fgxcoin transfer', desc: 'Send ₣Ԡ🇽 to another member (5% tax)' },
      { name: '/fgxcoin gamble', desc: '50/50 coinflip — double it or lose it' },
      { name: '/fgxcoin history', desc: 'Transaction history' },
      { name: '/fgxcoin zoo', desc: 'View collected animals' },
      { name: '/fgxcoin sell', desc: 'Sell a duplicate animal for coins' },
      { name: '/fgxcoin crate', desc: 'Open a loot crate' },
      { name: '/fgxcoin pray', desc: 'Pray for coins' },
      { name: 'chat: !daily !hunt !battle !zoo !coinflip', desc: 'Text commands for quick access' },
    ],
  },
  {
    name: '👑 VIP',
    description: 'Exclusive perks for fully verified members.',
    commands: [
      { name: '/vip daily', desc: 'Claim VIP daily bonus (250 ₣Ԡ🇽, needs full verification)' },
      { name: '/vip check', desc: 'Check a member\'s VIP status' },
      { name: '/vip status', desc: 'Your VIP status and perks' },
      { name: 'chat: !vip !vip daily', desc: 'Quick VIP access via text' },
    ],
  },
  {
    name: '🤖 AI Assistant',
    description: 'Ask the AI anything about FGx, BloxStrike, rules, or players.',
    commands: [
      { name: '/ask', desc: 'Ask the AI assistant about rules, events, strategies, or players' },
      { name: '/ai', desc: 'Alias of /ask' },
      { name: '/bloxai', desc: 'Ask the BloxStrike-specific AI assistant' },
    ],
  },
  {
    name: '🟥 Roblox & Verification',
    description: 'Link accounts and unlock perks.',
    commands: [
      { name: '/roblox verify', desc: 'Link your Roblox account (Bloxlink-style, no password)' },
      { name: '/roblox status', desc: 'Check your Roblox link status' },
      { name: '/roblox unlink', desc: 'Unlink your Roblox account' },
      { name: '/roblox leaderboard', desc: 'First members to verify Roblox' },
      { name: '/roblox list', desc: 'List verified Roblox members (staff)' },
      { name: '/roblox panel', desc: 'Create a verification panel (staff)' },
      { name: '/link bloxstrike', desc: 'Link your BloxStrike username (pending staff verify)' },
      { name: '/link verify', desc: 'Verify a member\'s BloxStrike link (staff)' },
      { name: '/unlink', desc: 'Remove your BloxStrike link' },
      { name: '/verify setup', desc: 'Set up the verification panel (admin)' },
    ],
  },
  {
    name: '🖐️ Socials & Fun',
    description: 'Fun interactions, games, and social commands.',
    commands: [
      { name: '/social slap', desc: 'Give someone a slap (+11 more: hug, kiss, punch, destroy...)' },
      { name: '/roast @user', desc: 'AI-powered savage roasts with heat levels' },
      { name: '/roast-battle @user', desc: '3-round roast battle with AI commentary' },
      { name: '/rps', desc: 'Rock Paper Scissors — button rematches' },
      { name: '/trivia', desc: 'Gaming trivia quiz' },
      { name: '/8ball', desc: 'Ask the magic 8-ball' },
      { name: '/choose', desc: 'Pick between options' },
      { name: '/ship', desc: 'Check love compatibility' },
      { name: '/meme', desc: 'Random meme from Reddit' },
      { name: '/cats', desc: 'Collect cats with rarity system' },
      { name: 'chat: !slap @user !hug @user', desc: 'Quick social commands via text' },
    ],
  },
  {
    name: '🎫 Tickets',
    description: 'Staff support and help desk.',
    commands: [
      { name: '/ticket setup', desc: 'Set up the ticket system (auto-creates channels)' },
      { name: '/ticket close', desc: 'Close the current ticket' },
    ],
  },
  {
    name: '⚙️ Admin',
    description: 'Bot configuration and server setup.',
    commands: [
      { name: '/setup', desc: 'One-command full server setup — channels, roles, panels' },
      { name: '/config menu', desc: 'Open the config dashboard (admin)' },
      { name: '/welcome setup', desc: 'Configure welcome messages and auto-role (admin)' },
      { name: '/help', desc: 'Show this help menu' },
    ],
  },
];

const ITEMS_PER_PAGE = 1;

function buildPage(pageIndex) {
  const cat = CATEGORIES[pageIndex];
  const embed = new EmbedBuilder()
    .setColor(BRAND.colors.primary)
    .setTitle(`${cat.name}`)
    .setDescription(cat.description);

  // Split commands into chunks for embed field value limits (1024 chars)
  const chunks = [];
  let current = '';
  for (const cmd of cat.commands) {
    const line = `\`${cmd.name}\` — ${cmd.desc}\n`;
    if (current.length + line.length > 1000) {
      chunks.push(current);
      current = line;
    } else {
      current += line;
    }
  }
  if (current) chunks.push(current);

  for (let i = 0; i < chunks.length; i++) {
    embed.addFields({
      name: i === 0 ? 'Commands' : '\u200b',
      value: chunks[i],
    });
  }

  embed.setFooter({
    text: `${BRAND.footer} • Page ${pageIndex + 1}/${CATEGORIES.length} • ${cat.commands.length} commands`,
  });

  return embed;
}

function buildRow(pageIndex) {
  return new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId(`help:prev:${pageIndex}`)
      .setStyle(ButtonStyle.Secondary)
      .setEmoji('◀️')
      .setDisabled(pageIndex === 0),
    new ButtonBuilder()
      .setCustomId('help:category_select')
      .setStyle(ButtonStyle.Primary)
      .setLabel(`${pageIndex + 1}/${CATEGORIES.length}`)
      .setDisabled(true),
    new ButtonBuilder()
      .setCustomId(`help:next:${pageIndex}`)
      .setStyle(ButtonStyle.Secondary)
      .setEmoji('▶️')
      .setDisabled(pageIndex === CATEGORIES.length - 1),
  );
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName('help')
    .setDescription('Browse all FGx commands by category.')
    .addStringOption((o) =>
      o
        .setName('category')
        .setDescription('Jump to a specific category')
        .setRequired(false)
        .addChoices(...CATEGORIES.map((c, i) => ({ name: c.name, value: String(i) }))),
    ),

  async execute(interaction) {
    const raw = interaction.options.getString('category');
    const startPage = raw !== null ? Math.min(Math.max(parseInt(raw, 10), 0), CATEGORIES.length - 1) : 0;

    const embed = buildPage(startPage);
    const row = buildRow(startPage);

    await interaction.reply({ embeds: [embed], components: [row] });
  },

  /**
   * Handle button interactions for pagination.
   * Called from the router when customId starts with 'help:'.
   */
  async handleButton(interaction) {
    const parts = interaction.customId.split(':');
    const action = parts[1];

    if (action === 'prev' || action === 'next') {
      const current = parseInt(parts[2], 10);
      const next = action === 'next' ? current + 1 : current - 1;

      if (next < 0 || next >= CATEGORIES.length) {
        return interaction.deferUpdate();
      }

      const embed = buildPage(next);
      const row = buildRow(next);
      return interaction.update({ embeds: [embed], components: [row] });
    }

    // category_select — do nothing (disabled button)
    return interaction.deferUpdate();
  },

  /** Exported for the router to know which category pages exist. */
  CATEGORIES,
};
