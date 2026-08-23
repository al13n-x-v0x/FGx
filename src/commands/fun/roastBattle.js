'use strict';

/* Copyright © 2026 FGx. All rights reserved. */

const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const { BRAND } = require('../../config/constants');
const { quickAI } = require('../../services/ai/quick');
const { getGif } = require('../../utils/gifLibrary');

const ROUNDS = 3;
const ROUND_DELAY_MS = 3000;

function randomFrom(arr) { return arr[Math.floor(Math.random() * arr.length)]; }

const BATTLE_INTROS = [
  "Listen up, this is about to get UGLY — ",
  "Ladies and gentlemen, welcome to the ROAST BATTLE — ",
  "The gloves are off. No mercy. Let's GO — ",
  "Two enter, one leaves with their dignity. Maybe. — ",
  "It's about to go DOWN — ",
  "Popcorn ready? Good. Let's fucking GO — ",
];

const VERDICTS = [
  " absolute DOMINANCE. Not even close.",
  " wins but barely — both took heavy damage.",
  " wins by a landslide! The crowd goes WILD.",
  " barely survives! Both are destroyed.",
  " wins on technicality — the other one is in SHAMBLES.",
  " wins! The other one needs therapy after this.",
];

/** Generate a roast for one user targeting the other */
async function generateBattleRoast(attacker, defender, round) {
  const prompt = `ROAST BATTLE — Round ${round}. You are roasting "${defender.username}" on behalf of "${attacker.username}".

Write ONE savage, hilarious roast. Be creative, reference their username if funny. Swearing is encouraged. Under 200 characters. No asterisks, no markdown, no formatting. Just the raw roast text. Start immediately.`;

  const result = await quickAI(
    'You are a legendary roast battle comedian. You deliver devastating one-liners. Be savage and hilarious. Swearing is encouraged.',
    prompt,
    { maxTokens: 200, temperature: 0.95 },
  );

  return result || null;
}

/** Curated fallback roasts for battles */
const FALLBACK_ROASTS = [
  "You're so irrelevant, even your WiFi signal ignores you.",
  "Your face is proof that God has a sense of humor and it's not a good one.",
  "You're the reason evolution is questioned on a daily basis.",
  "If you were any more disappointing, your parents would need a new word for it.",
  "You look like someone took a perfectly good trash bag and gave it a Discord account.",
  "Your personality is so flat, it could be used as a table.",
  "You're the human embodiment of a participation trophy. And not even the good kind.",
  "If stupidity was a crime, you'd be serving life without parole.",
  "You're the reason God doesn't talk to us anymore.",
  "Your existence is proof that natural selection has failed us all.",
];

const WAR_EMOJIS = ['⚔️', '🗡️', '🔥', '💥', '💀', '👊', '🥊', '⚡'];

/** @type {Map<string, BattleState>} active battles */
const activeBattles = new Map();

/** Build the scoreboard embed */
function buildBattleEmbed(state) {
  const { user1, user2, scores, roasts, round, phase, winner } = state;
  const intro = randomFrom(BATTLE_INTROS);

  let description = '';
  if (phase === 'intro') {
    description = `${intro}\n\n**${user1.username}** ⚔️ **${user2.username}**\n\nFirst to ${Math.ceil(ROUNDS / 2)} round wins. May God have mercy on your souls.`;
  } else {
    // Show completed rounds
    for (let i = 0; i < roasts.length; i++) {
      const r = roasts[i];
      const emoji = WAR_EMOJIS[i % WAR_EMOJIS.length];
      description += `${emoji} **Round ${i + 1}**\n`;
      description += `> ${r.text1}\n`;
      description += `> ${r.text2}\n\n`;
    }

    if (phase === 'battle') {
      description += `⏳ **Round ${round + 1}** incoming...`;
    } else if (phase === 'done') {
      description += `━━━━━━━━━━━━━━━━━━━━━━━\n\n`;
      if (winner === 'draw') {
        description += `**💀 DRAW!** Both fighters are destroyed. Nobody wins.`;
      } else {
        description += `**🏆 ${winner.username} WINS!**${randomFrom(VERDICTS)}`;
      }
    }
  }

  const s1 = scores[user1.id] || 0;
  const s2 = scores[user2.id] || 0;
  const bar1 = '🟩'.repeat(s1) + '⬛'.repeat(Math.ceil(ROUNDS / 2) - s1);
  const bar2 = '🟩'.repeat(s2) + '⬛'.repeat(Math.ceil(ROUNDS / 2) - s2);

  const embed = new EmbedBuilder()
    .setColor(phase === 'done' ? 0xED4245 : 0x57F287)
    .setTitle(`⚔️ ROAST BATTLE — Round ${Math.min(round + 1, ROUNDS)}/${ROUNDS}`)
    .setDescription(description)
    .addFields(
      { name: `${user1.username}`, value: `${bar1} **${s1}**`, inline: true },
      { name: '⚔️', value: 'VS', inline: true },
      { name: `${user2.username}`, value: `${bar2} **${s2}**`, inline: true },
    )
    .setFooter({ text: `${BRAND.footer} • Roast Battle` })
    .setTimestamp(new Date());

  if (phase === 'intro') {
    embed.setThumbnail('https://media.tenor.com/images/roasting-fire.gif'.split('').join(''));
  }

  return embed;
}

/** Build the action row based on battle phase */
function buildButtons(phase, battleId) {
  if (phase === 'intro') {
    return new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId(`rb:start:${battleId}`).setLabel('⚔️ START BATTLE').setStyle(ButtonStyle.Danger),
      new ButtonBuilder().setCustomId(`rb:forfeit:${battleId}`).setLabel('🏳️ Forfeit').setStyle(ButtonStyle.Secondary),
    );
  }
  if (phase === 'done') {
    return new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId(`rb:rematch:${battleId}`).setLabel('🔄 Rematch').setStyle(ButtonStyle.Primary),
      new ButtonBuilder().setCustomId(`rb:delete:${battleId}`).setLabel('🗑️ Delete').setStyle(ButtonStyle.Secondary),
    );
  }
  return null;
}

// ─── /roast-battle ─────────────────────────────────────────
const roastBattleCmd = {
  data: new SlashCommandBuilder()
    .setName('roast-battle')
    .setDescription('Two users go head-to-head in a savage roast battle ⚔️🔥')
    .addUserOption(opt =>
      opt.setName('opponent').setDescription('Who you wanna battle?').setRequired(true)),

  async execute(interaction) {
    const user1 = interaction.user;
    const user2 = interaction.options.getUser('opponent');

    if (user1.id === user2.id) {
      return interaction.reply({ content: "❌ You can't battle yourself, you masochist.", ephemeral: true });
    }
    if (user2.bot) {
      return interaction.reply({ content: "❌ You can't roast a bot. They don't have feelings... or do they?", ephemeral: true });
    }

    const battleId = `${user1.id}-${user2.id}-${Date.now()}`;
    const state = {
      user1,
      user2,
      scores: { [user1.id]: 0, [user2.id]: 0 },
      roasts: [],
      round: 0,
      phase: 'intro', // intro → battle → done
      winner: null,
      battleId,
    };

    activeBattles.set(battleId, state);

    const embed = buildBattleEmbed(state);
    const buttons = buildButtons('intro', battleId);

    await interaction.reply({ embeds: [embed], components: buttons ? [buttons] : [] });
  },
};

/** Handle button interactions for roast battles */
async function handleBattleButton(interaction) {
  const [, action, battleId] = interaction.customId.split(':');
  const state = activeBattles.get(battleId);

  if (!state) {
    return interaction.reply({ content: '❌ This battle has expired. Start a new one with `/roast-battle`.', ephemeral: true });
  }

  if (action === 'delete') {
    activeBattles.delete(battleId);
    return interaction.message.delete().catch(() => {});
  }

  if (action === 'rematch') {
    activeBattles.delete(battleId);
    // Re-trigger the command
    const cmd = interaction.client.commands.get('roast-battle');
    if (cmd) {
      await interaction.deferUpdate();
      // Create a mock interaction
      const mockInteraction = {
        ...interaction,
        options: {
          getUser: () => state.user2,
          getString: () => null,
        },
        reply: (opts) => interaction.editReply(opts),
        editReply: (opts) => interaction.editReply(opts),
        user: state.user1,
        client: interaction.client,
        guild: interaction.guild,
        deferred: true,
        replied: true,
      };
      try {
        await cmd.execute(mockInteraction);
      } catch {
        await interaction.editReply({ content: '❌ Failed to start rematch.', embeds: [], components: [] });
      }
    }
    return;
  }

  if (action === 'forfeit') {
    if (interaction.user.id !== state.user1.id && interaction.user.id !== state.user2.id) {
      return interaction.reply({ content: "❌ Only the fighters can forfeit.", ephemeral: true });
    }
    state.phase = 'done';
    state.winner = interaction.user.id === state.user1.id ? state.user2 : state.user1;
    const embed = buildBattleEmbed(state);
    const buttons = buildButtons('done', battleId);
    activeBattles.delete(battleId);
    return interaction.update({ embeds: [embed], components: buttons ? [buttons] : [] });
  }

  if (action === 'start') {
    if (interaction.user.id !== state.user1.id) {
      return interaction.reply({ content: "❌ Only the challenger can start the battle.", ephemeral: true });
    }

    state.phase = 'battle';
    await interaction.deferUpdate();

    // Run rounds
    for (let r = 0; r < ROUNDS; r++) {
      state.round = r;

      // Update embed with "incoming" message
      const thinkingEmbed = buildBattleEmbed(state);
      await interaction.editReply({ embeds: [thinkingEmbed], components: [] }).catch(() => {});

      // Generate roasts for both users
      let text1 = await generateBattleRoast(state.user1, state.user2, r + 1);
      let text2 = await generateBattleRoast(state.user2, state.user1, r + 1);

      // Fallback if AI fails
      if (!text1) text1 = randomFrom(FALLBACK_ROASTS);
      if (!text2) text2 = randomFrom(FALLBACK_ROASTS);

      state.roasts.push({ text1, text2 });

      // Score: randomly assign a point (could add AI judging later)
      const winner = Math.random() > 0.5 ? state.user1.id : state.user2.id;
      state.scores[winner] = (state.scores[winner] || 0) + 1;

      // Show round result
      const roundEmbed = buildBattleEmbed(state);
      await interaction.editReply({ embeds: [roundEmbed], components: [] }).catch(() => {});

      // Delay between rounds
      if (r < ROUNDS - 1) {
        await new Promise((resolve) => setTimeout(resolve, ROUND_DELAY_MS));
      }
    }

    // Determine final winner
    const s1 = state.scores[state.user1.id] || 0;
    const s2 = state.scores[state.user2.id] || 0;
    if (s1 > s2) state.winner = state.user1;
    else if (s2 > s1) state.winner = state.user2;
    else state.winner = 'draw';

    state.phase = 'done';
    const finalEmbed = buildBattleEmbed(state);
    const buttons = buildButtons('done', battleId);

    await interaction.editReply({ embeds: [finalEmbed], components: buttons ? [buttons] : [] }).catch(() => {});

    // Clean up after 5 minutes
    setTimeout(() => activeBattles.delete(battleId), 5 * 60 * 1000);
  }
}

module.exports = [roastBattleCmd];
module.exports.handleBattleButton = handleBattleButton;
