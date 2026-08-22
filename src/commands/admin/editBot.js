'use strict';

/* Copyright © 2026 FGx. All rights reserved. */

const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const { BRAND } = require('../../config/constants');
const { requireOwnerOrLeader } = require('../../utils/permissions');
const { chatCompletion, AIUnavailableError } = require('../../services/ai/client');
const { logger } = require('../../utils/logger');
const fs = require('node:fs');
const path = require('node:path');

const PROJECT_ROOT = path.resolve(__dirname, '..', '..', '..');

/** Bot knowledge base — file structure and what each file does. */
const BOT_CONTEXT = `
## FGx Bot Architecture

### Entry Point
- src/index.js — Main bot startup, Discord client, event loading, dashboard, health endpoint

### Commands (src/commands/)
- admin/ — Admin commands: config, setup, welcome, reactionrole, announce, verify, configureEmoji, editBot
- clan/ — Clan management: ask, tryout, roster, hub, match, scrim, clanwar, evaluate, shuffle, private
- fun/ — Fun commands: roast, meme, actions, cats, nitro, nitroProfile
- moderation/ — Mod commands: ban, kick, timeout, warn, mute, purge, snipe, role
- security/ — Security: automod, security, antinuke
- tickets/ — Ticket system
- utility/ — Utility: help, who, status, serverinfo, userinfo, poll, giveaway, afk, level, rank, leaderboard, achievements, fgxcoin, vip, profile, link, unlink, roblox, emoji, embedBuilder, ping, player

### Services (src/services/)
- ai/ — AI assistant (assistant.js), AI client (client.js), player lookup, vision
- clan/ — Clan services: roster, tryout, hub, shuffle, participation, privateServer
- community/ — Welcome, verification, Roblox, giveaways, social
- logging/ — Audit logger
- security/ — Anti-nuke, automod, raid detection
- tickets/ — Ticket service

### Database (src/database/)
- index.js — SQLite setup with better-sqlite3
- schema.js — Table definitions and migrations
- repos/ — Data access: guildConfig, competitive, community, economy, social, privateServers

### Config & Utils (src/config/, src/utils/)
- constants.js — Brand, ranks, tiers, achievements
- env.js — Environment config (AI provider, Discord token, etc.)
- guildDefaults.js — Default guild configuration
- permissions.js — Permission checks
- gifLibrary.js — 160+ GIF categories
- registry.js — Command/event loading

### Interactions (src/interactions/)
- router.js — Routes button/select/modal interactions to handlers
`;

/** Safety check — does the proposed code change look dangerous? */
function safetyCheck(instruction, code) {
  const lower = (instruction + ' ' + (code || '')).toLowerCase();
  const redFlags = [
    'delete all',
    'rm -rf',
    'process.exit',
    'process.env.token',
    'process.env.discord_token',
    'client.destroy',
    'client.logout',
    'fs.unlink',
    'fs.rmdir',
    'DROP TABLE',
    'DELETE FROM',
  ];
  for (const flag of redFlags) {
    if (lower.includes(flag.toLowerCase())) {
      return { safe: false, reason: `Blocked: contains "${flag}"` };
    }
  }
  return { safe: true };
}

/** /edit-bot — Owner-only AI bot editing assistant. */
module.exports = {
  data: new SlashCommandBuilder()
    .setName('edit-bot')
    .setDescription('🤖 AI-powered bot editor — only for owner/co-owner')
    .addStringOption((o) =>
      o.setName('instruction')
        .setDescription('What do you want the bot to do? (e.g., "add a /joke command")')
        .setRequired(true)
        .setMaxLength(2000),
    ),

  async execute(interaction) {
    // Only owner, co-owner, or leader can use this
    try {
      requireOwnerOrLeader(interaction.member);
    } catch (err) {
      return interaction.reply({
        embeds: [
          new EmbedBuilder()
            .setColor(BRAND.colors.danger)
            .setTitle('🚫 Access Denied')
            .setDescription('Only the **server owner**, **Co-Owner**, or **Leader** can use the bot editor.')
            .setFooter({ text: BRAND.footer }),
        ],
        ephemeral: true,
      });
    }

    const instruction = interaction.options.getString('instruction', true);

    // Safety check
    const safety = safetyCheck(instruction);
    if (!safety.safe) {
      return interaction.reply({
        embeds: [
          new EmbedBuilder()
            .setColor(BRAND.colors.danger)
            .setTitle('🚫 Blocked by Safety')
            .setDescription(safety.reason)
            .setFooter({ text: BRAND.footer }),
        ],
        ephemeral: true,
      });
    }

    await interaction.deferReply({ ephemeral: true });

    try {
      // Build the system prompt for the coding AI
      const system = `You are FGx's bot coding assistant. You help the server owner modify and improve the FGx Discord bot.

${BOT_CONTEXT}

RULES:
1. You are a senior Node.js/Discord.js developer.
2. Always respond with COMPLETE, WORKING code — never placeholders.
3. When asked to add a command, provide the FULL file content and explain where to save it.
4. When asked to fix something, explain the issue and provide the exact code fix.
5. Use discord.js v14 patterns (SlashCommandBuilder, EmbedBuilder, ActionRowBuilder).
6. Follow the existing code style: 'use strict', copyright header, JSDoc comments.
7. Keep responses under 3000 characters for Discord. If the code is long, summarize and offer to show more.
8. Never suggest deleting the bot or critical files.
9. If the request is ambiguous, suggest the most likely interpretation.
10. Reference the file structure above when suggesting file paths.

When providing code, wrap it in a code block with the language tag (e.g. \`\`\`js).
Always explain what the code does and where to put it.`;

      const reply = await chatCompletion({
        system,
        messages: [{ role: 'user', content: instruction }],
        maxTokens: 2500,
        temperature: 0.2,
      });

      const embed = new EmbedBuilder()
        .setColor(BRAND.colors.primary)
        .setAuthor({ name: '🤖 FGx Bot Editor', iconURL: interaction.client.user.displayAvatarURL() })
        .setDescription(reply)
        .addFields({
          name: '📋 Request',
          value: `> ${instruction.slice(0, 200)}`,
        })
        .setFooter({ text: `${BRAND.footer} • Owner-only AI Editor` })
        .setTimestamp(new Date());

      // Add action buttons
      const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId('editbot:apply')
          .setLabel('✅ Apply Changes')
          .setStyle(ButtonStyle.Success),
        new ButtonBuilder()
          .setCustomId('editbot:explain')
          .setLabel('💡 Explain More')
          .setStyle(ButtonStyle.Primary),
        new ButtonBuilder()
          .setCustomId('editbot:rollback')
          .setLabel('↩️ Rollback')
          .setStyle(ButtonStyle.Secondary),
      );

      await interaction.editReply({ embeds: [embed], components: [row] });

      logger.info('edit-bot used', {
        userId: interaction.user.id,
        instruction: instruction.slice(0, 100),
      });
    } catch (err) {
      if (err instanceof AIUnavailableError) {
        return interaction.editReply({
          embeds: [
            new EmbedBuilder()
              .setColor(BRAND.colors.danger)
              .setTitle('AI Unavailable')
              .setDescription('The AI service is not configured. Set `AI_API_KEY`, `GROQ_API_KEY`, or `GEMINI_API_KEY` in Render environment variables.')
              .setFooter({ text: BRAND.footer }),
          ],
        });
      }
      throw err;
    }
  },

  /** Handle edit-bot buttons. */
  async handleButton(interaction) {
    const action = interaction.customId.split(':')[1];

    if (action === 'apply') {
      return interaction.reply({
        embeds: [
          new EmbedBuilder()
            .setColor(BRAND.colors.warn)
            .setTitle('📋 Next Step')
            .setDescription(
              'To apply changes, copy the code from the AI response above and save it to the correct file.\n\n' +
              '**How to apply:**\n' +
              '1. Copy the code block from the AI response\n' +
              '2. Open the file in your code editor\n' +
              '3. Replace or add the code\n' +
              '4. Push to GitHub — Render auto-deploys!\n\n' +
              'Or ask me to generate a complete file and I\'ll show the full content.',
            )
            .setFooter({ text: BRAND.footer }),
        ],
        ephemeral: true,
      });
    }

    if (action === 'explain') {
      return interaction.reply({
        embeds: [
          new EmbedBuilder()
            .setColor(BRAND.colors.primary)
            .setTitle('💡 More Details')
            .setDescription(
              'Ask me a follow-up question like:\n' +
              '• "Explain what that code does line by line"\n' +
              '• "Show me a more advanced version"\n' +
              '• "Add error handling to that"\n' +
              '• "Now add a button to that command"',
            )
            .setFooter({ text: BRAND.footer }),
        ],
        ephemeral: true,
      });
    }

    if (action === 'rollback') {
      return interaction.reply({
        embeds: [
          new EmbedBuilder()
            .setColor(BRAND.colors.danger)
            .setTitle('↩️ Rollback')
            .setDescription(
              'Since changes haven\'t been applied yet, there\'s nothing to rollback!\n\n' +
              'If you already pushed code that broke something:\n' +
              '1. Go to your GitHub repo\n' +
              '2. Find the last working commit\n' +
              '3. Revert or reset to it\n' +
              '4. Render will auto-deploy the fixed version',
            )
            .setFooter({ text: BRAND.footer }),
        ],
        ephemeral: true,
      });
    }
  },
};
