'use strict';

const { EmbedBuilder } = require('discord.js');
const { logger } = require('../utils/logger');
const welcomeConfig = require('../utils/welcomeConfig');

function register(client) {
  client.on('guildMemberAdd', async (member) => {
    try {
      // Get config for this guild
      const guildChannels = member.guild.channels.cache;
      
      // Find which channel has welcome configured
      let config = null;
      for (const [, channel] of guildChannels) {
        if (channel.isTextBased()) {
          config = welcomeConfig.get(channel.id);
          if (config && config.channelId === channel.id) break;
        }
      }

      if (!config) return; // No welcome channel configured

      const channel = member.guild.channels.cache.get(config.channelId);
      if (!channel) return;

      const color = parseInt(config.color || '00ff00', 16);
      const message = (config.message || 'Hey {user}, welcome to **{server}**!\n\nYou are member **#{count}**.')
        .replace('{user}', member)
        .replace('{server}', member.guild.name)
        .replace('{count}', member.guild.memberCount);

      const embed = new EmbedBuilder()
        .setColor(color)
        .setTitle('🎮 Welcome to FGx!')
        .setDescription(message)
        .setThumbnail(member.user.displayAvatarURL({ dynamic: true }))
        .setTimestamp();

      const msgObj = { embeds: [embed] };
      if (config.video) msgObj.content = `🎬 Welcome video: ${config.video}`;

      await channel.send(msgObj);
      logger.info(`Welcome message sent to ${member.user.tag}`);
    } catch (err) {
      logger.error('Failed to send welcome message', { error: err.message });
    }
  });
}

module.exports = { register };
