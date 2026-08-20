'use strict';

/* Copyright © 2026 FGx. All rights reserved. */

const { createCanvas, GlobalFonts } = require('@napi-rs/canvas');
const { AttachmentBuilder } = require('discord.js');
const path = require('node:path');
const { logger } = require('./logger');

/**
 * Canvas-based welcome image generator.
 *
 * Creates a branded welcome card with:
 *   • Gradient background in FGx brand colors
 *   • User's avatar in a circular frame with glow
 *   • "WELCOME" title
 *   • Username and server name
 *   • Member count badge
 *
 * The image is returned as a Discord AttachmentBuilder ready to send.
 */

const WIDTH = 934;
const HEIGHT = 280;

/** FGx brand palette. */
const COLORS = {
  bg1: '#1a1a2e',
  bg2: '#16213e',
  accent: '#e94560',
  gold: '#f5c518',
  text: '#ffffff',
  textDim: '#a0a0b0',
  border: '#e94560',
  glow: 'rgba(233, 69, 96, 0.4)',
};

/**
 * Fetch a user's avatar as a Buffer from Discord's CDN.
 * Falls back to a generated default avatar if the fetch fails.
 */
async function fetchAvatar(user, size = 256) {
  try {
    const url = user.displayAvatarURL({ extension: 'png', size, forceStatic: true });
    const res = await globalThis.fetch(url);
    if (!res.ok) throw new Error(`avatar fetch ${res.status}`);
    return Buffer.from(await res.arrayBuffer());
  } catch {
    // Generate a simple colored circle as fallback
    const c = createCanvas(size, size);
    const ctx = c.getContext('2d');
    ctx.fillStyle = COLORS.accent;
    ctx.beginPath();
    ctx.arc(size / 2, size / 2, size / 2, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = COLORS.text;
    ctx.font = `bold ${size * 0.4}px sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('?', size / 2, size / 2);
    return c.toBuffer('image/png');
  }
}

/**
 * Draw a circular clipped image.
 */
function drawCircleImage(ctx, img, x, y, radius) {
  ctx.save();
  ctx.beginPath();
  ctx.arc(x, y, radius, 0, Math.PI * 2);
  ctx.closePath();
  ctx.clip();
  ctx.drawImage(img, x - radius, y - radius, radius * 2, radius * 2);
  ctx.restore();
}

/**
 * Draw a glowing ring around the avatar.
 */
function drawGlow(ctx, x, y, radius) {
  ctx.save();
  ctx.shadowColor = COLORS.glow;
  ctx.shadowBlur = 20;
  ctx.beginPath();
  ctx.arc(x, y, radius + 3, 0, Math.PI * 2);
  ctx.strokeStyle = COLORS.accent;
  ctx.lineWidth = 4;
  ctx.stroke();
  ctx.restore();
}

/**
 * Generate the welcome image.
 *
 * @param {GuildMember} member - The joining member.
 * @param {object} opts
 * @param {string} [opts.message] - Custom message to show.
 * @returns {Promise<AttachmentBuilder>} Discord attachment.
 */
async function generateWelcomeImage(member, { message } = {}) {
  const canvas = createCanvas(WIDTH, HEIGHT);
  const ctx = canvas.getContext('2d');

  // ── Background gradient ──────────────────────────────────────────
  const grad = ctx.createLinearGradient(0, 0, WIDTH, HEIGHT);
  grad.addColorStop(0, COLORS.bg1);
  grad.addColorStop(1, COLORS.bg2);
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, WIDTH, HEIGHT);

  // ── Decorative accent bar at top ────────────────────────────────
  const barGrad = ctx.createLinearGradient(0, 0, WIDTH, 0);
  barGrad.addColorStop(0, COLORS.accent);
  barGrad.addColorStop(0.5, COLORS.gold);
  barGrad.addColorStop(1, COLORS.accent);
  ctx.fillStyle = barGrad;
  ctx.fillRect(0, 0, WIDTH, 4);

  // ── Decorative circles in background ────────────────────────────
  ctx.globalAlpha = 0.05;
  ctx.fillStyle = COLORS.accent;
  ctx.beginPath();
  ctx.arc(WIDTH - 60, HEIGHT - 40, 120, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.arc(80, 50, 80, 0, Math.PI * 2);
  ctx.fill();
  ctx.globalAlpha = 1;

  // ── Avatar ──────────────────────────────────────────────────────
  const AVATAR_RADIUS = 70;
  const AVATAR_X = 140;
  const AVATAR_Y = HEIGHT / 2;

  const avatarBuf = await fetchAvatar(member.user);
  const avatarImg = new (require('@napi-rs/canvas').loadImage)
    ? null
    : null; // will use Image directly

  // Load the avatar buffer into a canvas image
  const avatarCanvas = createCanvas(1, 1);
  const avatarCtx = avatarCanvas.getContext('2d');

  // Use loadImage from @napi-rs/canvas
  const { loadImage } = require('@napi-rs/canvas');
  const avatarImage = await loadImage(avatarBuf);

  // Glow ring
  drawGlow(ctx, AVATAR_X, AVATAR_Y, AVATAR_RADIUS);

  // Avatar circle
  drawCircleImage(ctx, avatarImage, AVATAR_X, AVATAR_Y, AVATAR_RADIUS);

  // White border ring
  ctx.beginPath();
  ctx.arc(AVATAR_X, AVATAR_Y, AVATAR_RADIUS + 2, 0, Math.PI * 2);
  ctx.strokeStyle = 'rgba(255,255,255,0.15)';
  ctx.lineWidth = 2;
  ctx.stroke();

  // ── Text content ────────────────────────────────────────────────
  const TEXT_X = 260;
  const guildName = member.guild.name;
  const username = member.user.username;
  const memberCount = member.guild.memberCount;

  // "WELCOME" label
  ctx.fillStyle = COLORS.accent;
  ctx.font = 'bold 18px sans-serif';
  ctx.letterSpacing = '6px';
  ctx.fillText('W E L C O M E', TEXT_X, 60);
  ctx.letterSpacing = '0px';

  // Username
  ctx.fillStyle = COLORS.text;
  ctx.font = 'bold 36px sans-serif';
  const displayName = username.length > 22 ? username.slice(0, 20) + '…' : username;
  ctx.fillText(displayName, TEXT_X, 105);

  // "to" + server name
  ctx.fillStyle = COLORS.textDim;
  ctx.font = '18px sans-serif';
  ctx.fillText('to', TEXT_X, 135);

  ctx.fillStyle = COLORS.gold;
  ctx.font = 'bold 22px sans-serif';
  const serverName = guildName.length > 28 ? guildName.slice(0, 26) + '…' : guildName;
  ctx.fillText(serverName, TEXT_X + 30, 135);

  // Member count badge
  ctx.fillStyle = 'rgba(233, 69, 96, 0.2)';
  const badgeText = `#${memberCount} member`;
  ctx.font = 'bold 16px sans-serif';
  const badgeWidth = ctx.measureText(badgeText).width + 24;
  const badgeX = TEXT_X;
  const badgeY = 158;
  // Rounded rect for badge
  const badgeRadius = 8;
  ctx.beginPath();
  ctx.moveTo(badgeX + badgeRadius, badgeY);
  ctx.lineTo(badgeX + badgeWidth - badgeRadius, badgeY);
  ctx.arcTo(badgeX + badgeWidth, badgeY, badgeX + badgeWidth, badgeY + badgeRadius, badgeRadius);
  ctx.lineTo(badgeX + badgeWidth, badgeY + 28 - badgeRadius);
  ctx.arcTo(badgeX + badgeWidth, badgeY + 28, badgeX + badgeWidth - badgeRadius, badgeY + 28, badgeRadius);
  ctx.lineTo(badgeX + badgeRadius, badgeY + 28);
  ctx.arcTo(badgeX, badgeY + 28, badgeX, badgeY + 28 - badgeRadius, badgeRadius);
  ctx.lineTo(badgeX, badgeY + badgeRadius);
  ctx.arcTo(badgeX, badgeY, badgeX + badgeRadius, badgeY, badgeRadius);
  ctx.closePath();
  ctx.fill();

  ctx.fillStyle = COLORS.accent;
  ctx.font = 'bold 14px sans-serif';
  ctx.fillText(badgeText, badgeX + 12, badgeY + 18);

  // ── Custom message ──────────────────────────────────────────────
  if (message) {
    ctx.fillStyle = COLORS.textDim;
    ctx.font = '14px sans-serif';
    const shortMsg = message.length > 60 ? message.slice(0, 58) + '…' : message;
    ctx.fillText(shortMsg, TEXT_X, 220);
  }

  // ── FGx branding ────────────────────────────────────────────────
  ctx.fillStyle = 'rgba(255,255,255,0.15)';
  ctx.font = '12px sans-serif';
  ctx.textAlign = 'right';
  ctx.fillText('FGx Clan', WIDTH - 20, HEIGHT - 15);
  ctx.textAlign = 'left';

  // ── Bottom accent bar ───────────────────────────────────────────
  ctx.fillStyle = barGrad;
  ctx.fillRect(0, HEIGHT - 4, WIDTH, 4);

  // ── Output ──────────────────────────────────────────────────────
  const buffer = canvas.toBuffer('image/png');
  return new AttachmentBuilder(buffer, { name: 'welcome-card.png' });
}

module.exports = { generateWelcomeImage, WIDTH, HEIGHT };
