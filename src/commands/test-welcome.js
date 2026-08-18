
'use strict';

const { EmbedBuilder } = require('discord.js');
const { logger } = require('../utils/logger');

const WELCOME_CHANNEL_ID = '1538957171558064310';

const WELCOME_VIDEO_URL = 'https://ddg21s9t062h4.cloudfront.net/0i6yy%2Ffile%2F5677ab6007520fee437a623919e2d306_31d1512d55dce5da6a7a0e8467d111ef.mp4?response-content-disposition=inline%3Bfilename%3D%225677ab6007520fee437a623919e2d306_31d1512d55dce5da6a7a0e8467d111ef.mp4%22%3B&response-content-type=video%2Fmp4&Expires=1787084091&Signature=V~uq8ycc5VTN6lOmAlTM8XUXtkpkRbHCrD4MqWtTxZPvrs6~wDGh5Jagxx303gLEiDAEoUNoA9vvGqRMX68nCk5rsoRYAZP0i0mGi~3C2Hxr1RMVQVUTuIDCJJOtgCnVJ0ai7uIdrcV2m6Zg-VnJbs-6Aq09ku04uwMOV4vDYTAlkAbzCMJtLLVMOc83nuGN7nYsHZL3jimWKP8rBjnWXOecAXnglrYB~2cFgcZIMnqHSTJxujbwIrxLHkUZ4bkcfKA8bNLgK6Jl7GBk-r6rqUhBwij34wLXHKs8oG-FuIlPUmgPDLCpauYMwdKJdCdavx879DWS2Ew68v-UJ~wsbA__&Key-Pair-Id=APKAJT5WQLLEOADKLHBQ';

function register(client) {
  client.on('guildMemberAdd', async (member) => {
    try {
      const channel = member.guild.channels.cache.get(WELCOME_CHANNEL_ID);
      if (!channel) {
        logger.warn('Welcome channel not found', { channelId: WELCOME_CHANNEL_ID });
        return;
      }

      const embed = new EmbedBuilder()
        .setColor(0x00ff00)
        .setTitle('🎮 Welcome to FGx!')
        .setDescription(`Hey ${member}, welcome to **${member.guild.name}**!\n\nYou are member **#${member.guild.memberCount}**.`)
        .setThumbnail(member.user.displayAvatarURL({ dynamic: true }))
        .setTimestamp();

      await channel.send({
        embeds: [embed],
        content: `🎬 Welcome video: ${WELCOME_VIDEO_URL}`
      });

      logger.info(`Welcome message sent to ${member.user.tag}`);
    } catch (err) {
      logger.error('Failed to send welcome message', { error: err.message });
    }
  });
}

module.exports = { register };
