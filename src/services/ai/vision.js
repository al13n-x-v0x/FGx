'use strict';

/* Copyright © 2026 FGx. All rights reserved. */

/**
 * Vision module — sends images to Gemini for analysis.
 * Used by /roast to "see" a user's avatar and roast them based on it.
 */

const { env } = require('../../config/env');

/**
 * Download an image from a URL and convert to base64.
 * @param {string} url
 * @returns {Promise<{base64: string, mimeType: string}>}
 */
async function downloadImage(url) {
  const res = await fetch(url, {
    signal: AbortSignal.timeout(10_000),
    headers: { 'User-Agent': 'FGxBot/1.0' },
  });
  if (!res.ok) throw new Error(`Failed to download image: ${res.status}`);

  const contentType = res.headers.get('content-type') || 'image/png';
  const mimeType = contentType.split(';')[0].trim();

  const buffer = Buffer.from(await res.arrayBuffer());
  const base64 = buffer.toString('base64');

  return { base64, mimeType };
}

/**
 * Analyze an image with Gemini vision.
 * @param {string} imageUrl - URL of the image to analyze
 * @param {string} prompt - What to analyze/look for
 * @returns {Promise<string>} - AI's analysis text
 */
async function analyzeImage(imageUrl, prompt) {
  // Find a Gemini API key
  const geminiKey = env.GEMINI_API_KEY || env.GOOGLE_API_KEY;
  if (!geminiKey) throw new Error('No Gemini API key configured for vision');

  const model = env.GEMINI_VISION_MODEL || 'gemini-2.0-flash';
  const { base64, mimeType } = await downloadImage(imageUrl);

  const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(geminiKey)}`;

  const body = {
    contents: [{
      role: 'user',
      parts: [
        { inlineData: { mimeType, data: base64 } },
        { text: prompt },
      ],
    }],
    generationConfig: {
      temperature: 0.8,
      maxOutputTokens: 300,
    },
  };

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 15_000);

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: controller.signal,
    });

    if (!response.ok) {
      const errText = await response.text().catch(() => '');
      throw new Error(`Gemini vision API error ${response.status}: ${errText.slice(0, 200)}`);
    }

    const data = await response.json();
    const text = data?.candidates?.[0]?.content?.parts
      ?.map(p => p.text ?? '')
      .join('');

    if (!text) throw new Error('Gemini returned empty response');
    return text.trim();
  } finally {
    clearTimeout(timer);
  }
}

module.exports = { analyzeImage, downloadImage };
