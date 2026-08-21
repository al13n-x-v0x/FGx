'use strict';

/* Copyright © 2026 FGx. All rights reserved. */

const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { BRAND } = require('../../config/constants');
const { getGif, getGifsRandom } = require('../../utils/gifLibrary');

/**
 * Consolidated action commands — single /action command with subcommands.
 * Saves 14 command slots vs individual commands.
 */

const ACTIONS = {
  kill: { label: 'Killed', emoji: '💀', color: 0x000000, gifKey: 'destroy',
    lines: ['{actor} just absolutely **destroyed** {target} 💀', '{target} has been sent to the shadow realm by {actor} 💀', '{actor} chose violence today and {target} was the target 💀', 'RIP {target} — {actor} just ended their whole career 💀'] },
  bonk: { label: 'Bonked', emoji: '🔨', color: 0xFF6B6B, gifKey: 'punch',
    lines: ['{actor} **BONKED** {target}! Go to horny jail! 🔨', '*BONK* {target} has been sent to jail by {actor} 🔨', '{actor} swung a frying pan at {target} — direct hit! 🔨'] },
  yeet: { label: 'Yeeted', emoji: '🚀', color: 0x57F287, gifKey: 'yeet',
    lines: ['{actor} just **YEETED** {target} into orbit! 🚀', '{target} has been launched into the stratosphere by {actor} 🚀', '{actor} grabbed {target} and threw them into the sun 🚀'] },
  stab: { label: 'Stabbed', emoji: '🗡️', color: 0xED4245, gifKey: 'fight',
    lines: ['{actor} just **stabbed** {target} in the back! 🗡️', '{target} didn\'t see {actor} coming from behind 🗡️', '{actor} pulled a knife on {target} — it\'s personal now 🗡️'] },
  shoot: { label: 'Shot', emoji: '🔫', color: 0xE67E22, gifKey: 'destroy',
    lines: ['{actor} just **shot** {target}! No survivors 🔫', '{target} has been eliminated by {actor} 🔫', '{actor} pulled up on {target} — pew pew 🔫'] },
  destroy: { label: 'Destroyed', emoji: '💥', color: 0xED4245, gifKey: 'destroy',
    lines: ['{actor} just absolutely **ANNIHILATED** {target} 💥', '{target} has been reduced to atoms by {actor} 💥', 'WASTED — {target} was destroyed by {actor} 💥'] },
  beat: { label: 'Beat up', emoji: '👊', color: 0xE67E22, gifKey: 'punch',
    lines: ['{actor} just **beat up** {target}! No mercy! 👊', '{target} got absolutely WRECKED by {actor} 👊', '{actor} hands vs {target} face — {actor} wins 👊'] },
  kiss: { label: 'Kissed', emoji: '💋', color: 0xEB459E, gifKey: 'kiss',
    lines: ['{actor} just **kissed** {target}! 💋', '{target} just got smooched by {actor} — they\'re blushing 💋', '{actor} planted one on {target} — how romantic 💋'] },
  hug: { label: 'Hugged', emoji: '🫂', color: 0x57F287, gifKey: 'hug',
    lines: ['{actor} just gave {target} a big warm hug! 🫂', '{target} is being hugged by {actor} — maximum cozy achieved 🫂', '{actor} wrapped {target} in a blanket of love 🫂'] },
  slap: { label: 'Slapped', emoji: '🖐️', color: 0xFEE75C, gifKey: 'slap',
    lines: ['{actor} just **SLAPPED** {target} across the face! 🖐️', '*SMACK* {target} got slapped by {actor}! 🖐️', '{actor} wind up and slapped {target} into next week 🖐️'] },
  punch: { label: 'Punched', emoji: '👊', color: 0xED4245, gifKey: 'punch',
    lines: ['{actor} just **PUNCHED** {target}! 💥', '{target} got knocked out by {actor}! 💥', '{actor} threw a haymaker at {target} — direct hit! 💥'] },
  roast: { label: 'Roasted', emoji: '🔥', color: 0xED4245, gifKey: 'roast_nuclear',
    lines: ['{actor} just **ROASTED** {target} alive! 🔥', '{target} just got destroyed by {actor}\'s words 🔥', 'FATALITY — {target} was roasted by {actor} 🔥'] },
  blame: { label: 'Blamed', emoji: '👆', color: 0xE67E22, gifKey: 'facepalm',
    lines: ['{actor} just **blamed** {target} for everything! 👆', '{target} is being blamed by {actor} — not again! 👆', '{actor} pointed at {target} and said "it was all their fault" 👆'] },
  simp: { label: 'Simped', emoji: '💘', color: 0xEB459E, gifKey: 'simp',
    lines: ['{actor} is **simping** for {target}! 💘', '{target} has a new fan — it\'s {actor}! 💘', 'SIMP ALERT — {actor} is down bad for {target} 💘'] },
  revive: { label: 'Revived', emoji: '💚', color: 0x57F287, gifKey: 'w',
    lines: ['{actor} just **revived** {target} from the dead! 💚', '{target} has been brought back to life by {actor}! 💚', 'RESURRECTED — {target} is back thanks to {actor} 💚'] },
};

function randomFrom(arr) { return arr[Math.floor(Math.random() * arr.length)]; }

module.exports = {
  data: new SlashCommandBuilder()
    .setName('action')
    .setDescription('Perform an action on someone! 💥')
    .addSubcommand(sub =>
      sub.setName('kill').setDescription('💀 Kill someone')
        .addUserOption(opt => opt.setName('target').setDescription('Who to kill').setRequired(false)))
    .addSubcommand(sub =>
      sub.setName('bonk').setDescription('🔨 Bonk someone to horny jail')
        .addUserOption(opt => opt.setName('target').setDescription('Who to bonk').setRequired(false)))
    .addSubcommand(sub =>
      sub.setName('yeet').setDescription('🚀 Yeet someone into orbit')
        .addUserOption(opt => opt.setName('target').setDescription('Who to yeet').setRequired(false)))
    .addSubcommand(sub =>
      sub.setName('stab').setDescription('🗡️ Stab someone in the back')
        .addUserOption(opt => opt.setName('target').setDescription('Who to stab').setRequired(false)))
    .addSubcommand(sub =>
      sub.setName('shoot').setDescription('🔫 Shoot someone')
        .addUserOption(opt => opt.setName('target').setDescription('Who to shoot').setRequired(false)))
    .addSubcommand(sub =>
      sub.setName('destroy').setDescription('💥 Destroy someone')
        .addUserOption(opt => opt.setName('target').setDescription('Who to destroy').setRequired(false)))
    .addSubcommand(sub =>
      sub.setName('beat').setDescription('👊 Beat someone up')
        .addUserOption(opt => opt.setName('target').setDescription('Who to beat up').setRequired(false)))
    .addSubcommand(sub =>
      sub.setName('kiss').setDescription('💋 Kiss someone')
        .addUserOption(opt => opt.setName('target').setDescription('Who to kiss').setRequired(false)))
    .addSubcommand(sub =>
      sub.setName('hug').setDescription('🫂 Hug someone')
        .addUserOption(opt => opt.setName('target').setDescription('Who to hug').setRequired(false)))
    .addSubcommand(sub =>
      sub.setName('slap').setDescription('🖐️ Slap someone')
        .addUserOption(opt => opt.setName('target').setDescription('Who to slap').setRequired(false)))
    .addSubcommand(sub =>
      sub.setName('punch').setDescription('👊 Punch someone')
        .addUserOption(opt => opt.setName('target').setDescription('Who to punch').setRequired(false)))
    .addSubcommand(sub =>
      sub.setName('roast').setDescription('🔥 Roast someone')
        .addUserOption(opt => opt.setName('target').setDescription('Who to roast').setRequired(false)))
    .addSubcommand(sub =>
      sub.setName('blame').setDescription('👆 Blame someone')
        .addUserOption(opt => opt.setName('target').setDescription('Who to blame').setRequired(false)))
    .addSubcommand(sub =>
      sub.setName('simp').setDescription('💘 Simp for someone')
        .addUserOption(opt => opt.setName('target').setDescription('Who to simp for').setRequired(false)))
    .addSubcommand(sub =>
      sub.setName('revive').setDescription('💚 Revive someone from the dead')
        .addUserOption(opt => opt.setName('target').setDescription('Who to revive').setRequired(false))),

  async execute(interaction) {
    const sub = interaction.options.getSubcommand();
    const target = interaction.options.getUser('target') ?? interaction.user;
    const self = target.id === interaction.user.id;
    const action = ACTIONS[sub];

    if (!action) {
      return interaction.reply({ content: '❌ Unknown action.', ephemeral: true });
    }

    const line = randomFrom(action.lines)
      .replaceAll('{actor}', interaction.user.username)
      .replaceAll('{target}', self ? 'themselves' : target.username);

    const gifs = await getGifsRandom(action.gifKey, 2);
    const gif = gifs[0] || null;

    const embed = new EmbedBuilder()
      .setColor(action.color)
      .setTitle(`${action.emoji} ${action.label}!`)
      .setDescription(`> ${line}`)
      .addFields(
        { name: '👤 Actor', value: `${interaction.user}`, inline: true },
        { name: '🎯 Target', value: self ? 'Themselves 💀' : `${target}`, inline: true },
      )
      .setFooter({ text: `${BRAND.footer} • ${action.emoji} ${action.label}` })
      .setTimestamp(new Date());

    if (target.displayAvatarURL) {
      embed.setThumbnail(target.displayAvatarURL({ size: 256 }));
    }

    if (gif) embed.setImage(gif);

    await interaction.reply({ embeds: [embed] });
  },
};
