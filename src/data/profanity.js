'use strict';

/*
 * Copyright © 2026 FGx.
 * All rights reserved.
 */

/**
 * FGx profanity detection — deterministic fast path used by the AI security
 * engine BEFORE any API call, so swearing is caught instantly and for free.
 *
 * The list is deliberately conservative (strong profanity and slurs only;
 * no bare "ass", no words that commonly appear inside innocent words) to
 * avoid false positives. Enforcement still honors the guild's AI action
 * mode and is always logged.
 */

const WORDS = [
  // profanity
  'fuck', 'fucking', 'fucker', 'fucked', 'fuckers', 'fuk', 'fck', 'f\\*ck', 'f\\*\\*k', 'fuq',
  'shit', 'shits', 'shitty', 'shitting', 'shithead', 'shitbag', 'bullshit', 'sh!t', 'sht',
  'bitch', 'bitches', 'bitching', 'b!tch', 'b\\*tch', 'biatch',
  'dick', 'd1ck', 'd\\*ck', 'cock', 'c0ck', 'c\\*ck', 'dickhead',
  'cunt', 'c\\*nt',
  'asshole', 'a\\$\\$hole', 'arsehole', 'bastard', 'bastards',
  'whore', 'slut', 'sluts', 'skank', 'hoe',
  'pussy', 'p\\*ssy', 'twat',
  // slurs (zero tolerance)
  'nigga', 'nigger', 'n1gga', 'n\\*gga',
  'faggot', 'fag', 'f4g',
  'retard', 'retarded',
  'kike', 'spic', 'chink', 'wetback', 'tranny', 'dyke',
];

const PROFANITY_RE = new RegExp(`\\b(?:${WORDS.join('|')})\\b`, 'i');

/** True when the content contains profanity (word-boundary match). */
function hasProfanity(content) {
  return PROFANITY_RE.test(content ?? '');
}

module.exports = { WORDS, PROFANITY_RE, hasProfanity };
