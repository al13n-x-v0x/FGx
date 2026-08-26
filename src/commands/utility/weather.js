'use strict';

/* Copyright © 2026 FGx. All rights reserved. */

const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { BRAND } = require('../../config/constants');

const WEATHER_ICONS = {
  Clear: '☀️', Sunny: '☀️', 'Partly cloudy': '⛅', Cloudy: '☁️',
  Overcast: '☁️', Mist: '🌫️', Fog: '🌫️', 'Light rain': '🌦️',
  Rain: '🌧️', 'Heavy rain': '🌧️', Thunderstorm: '⛈️', Snow: '🌨️',
  'Light snow': '🌨️', Sleet: '🌨️', Drizzle: '🌦️', Haze: '🌫️',
};

function getIcon(condition) {
  for (const [key, icon] of Object.entries(WEATHER_ICONS)) {
    if (condition.toLowerCase().includes(key.toLowerCase())) return icon;
  }
  return '🌤️';
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName('weather')
    .setDescription('Check the weather for any location 🌤️')
    .addStringOption((o) =>
      o.setName('location').setDescription('City name (default: your server location)').setRequired(false),
    ),

  async execute(interaction) {
    const location = interaction.options.getString('location') || 'London';

    await interaction.deferReply();

    try {
      const url = `https://wttr.in/${encodeURIComponent(location)}?format=j1`;
      const resp = await fetch(url, {
        headers: { 'User-Agent': 'FGx-Bot/1.0' },
        signal: AbortSignal.timeout(8000),
      });

      if (!resp.ok) throw new Error('Weather service unavailable');

      const data = await resp.json();
      const current = data.current_condition?.[0];
      if (!current) throw new Error('No data for that location');

      const area = data.nearest_area?.[0];
      const region = area?.region?.[0]?.value || area?.areaName?.[0]?.value || location;
      const country = area?.country?.[0]?.value || '';
      const tempC = current.temp_C;
      const tempF = current.temp_F;
      const feelsLike = current.FeelsLikeC;
      const condition = current.weatherDesc?.[0]?.value || 'Unknown';
      const humidity = current.humidity;
      const wind = current.windspeedKmph;
      const windDir = current.winddir16Point;
      const visibility = current.visibility;
      const uv = current.uvIndex;
      const icon = getIcon(condition);

      const tomorrow = data.weather?.[1];
      let forecast = '';
      if (tomorrow) {
        const maxC = tomorrow.maxtempC;
        const minC = tomorrow.mintempC;
        const desc = tomorrow.hourly?.[4]?.weatherDesc?.[0]?.value || condition;
        forecast = `\n📅 **Tomorrow:** ${minC}°C - ${maxC}°C, ${desc}`;
      }

      const embed = new EmbedBuilder()
        .setColor(0x3498db)
        .setTitle(`${icon} Weather in ${region}${country ? ', ' + country : ''}`)
        .setDescription(`**${condition}**`)
        .addFields(
          { name: '🌡️ Temperature', value: `${tempC}°C / ${tempF}°F`, inline: true },
          { name: '🤔 Feels Like', value: `${feelsLike}°C`, inline: true },
          { name: '💧 Humidity', value: `${humidity}%`, inline: true },
          { name: '💨 Wind', value: `${wind} km/h ${windDir}`, inline: true },
          { name: '👁️ Visibility', value: `${visibility} km`, inline: true },
          { name: '☀️ UV Index', value: uv, inline: true },
        )
        .setFooter({ text: `${BRAND.footer} • Data from wttr.in` })
        .setTimestamp();

      if (forecast) embed.addFields({ name: '\u200b', value: forecast, inline: false });

      await interaction.editReply({ embeds: [embed] });
    } catch (err) {
      await interaction.editReply({
        content: `❌ Couldn't get weather for "${location}". ${err.message}`,
      });
    }
  },
};
