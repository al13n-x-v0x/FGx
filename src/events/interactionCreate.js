'use strict';

/*
 * Copyright © 2026 FGx.
 * All rights reserved.
 */

const { Events } = require('discord.js');
const { commandUsageRepo } = require('../database/repos/moderation');
const { router } = require('../interactions');
const { Cooldown } = require('../utils/cooldown');
const { FGxError } = require('../utils/errors');
const { BRAND } = require('../config/constants');
const { logger } = require('../utils/logger');

/** Per-user command cooldown (anti-abuse). */
const cooldown = new Cooldown();
const COMMAND_COOLDOWN_MS = 3000;

/** Reply to an interaction safely with a styled embed, honoring deferral state. */
async function safeReply(interaction, content, { ok = false } = {}) {
  const embed = {
    embeds: [
      {
        color: ok ? BRAND.colors.success : BRAND.colors.warn,
        title: ok ? '✅ Done' : '⚠️ Something went wrong',
        description: content,
        footer: { text: BRAND.footer },
      },
    ],
    ephemeral: true,
  };
  try {
    if (interaction.replied || interaction.deferred) {
      await interaction.followUp(embed);
    } else {
      await interaction.reply(embed);
    }
  } catch {
    /* interaction already gone */
  }
}

function register(client) {
  client.on(Events.InteractionCreate, async (interaction) => {
    try {
      if (interaction.isChatInputCommand()) {
        const command = client.commands.get(interaction.commandName);
        if (!command) {
          return safeReply(interaction, 'Unknown command. Try `/help`.');
        }

        // Per-user cooldown so the bot can't be hammered.
        const cdKey = `cmd:${interaction.user.id}:${interaction.commandName}`;
        if (cooldown.has(cdKey)) {
          return safeReply(interaction, 'Please slow down — you are using commands too quickly.');
        }
        cooldown.set(cdKey, COMMAND_COOLDOWN_MS);

        commandUsageRepo.record(interaction.guild?.id ?? null, interaction.user.id, interaction.commandName);
        await command.execute(interaction);
        return;
      }

      if (interaction.isButton() || interaction.isStringSelectMenu() || interaction.isModalSubmit()) {
        await router.route(interaction);
      }
    } catch (err) {
      // Global error boundary — one failed command must never kill the bot.
      const location = interaction.commandName ?? interaction.customId ?? 'unknown';
      if (err instanceof FGxError) {
        logger.warn('interaction rejected', { location, type: err.type, message: err.message });
        await safeReply(interaction, err.message);
        return;
      }
      logger.error('interaction failed', { location, error: err.message, stack: err.stack });
      await safeReply(interaction, 'An unexpected error occurred. Please try again later.');
    }
  });
}

module.exports = { register };
