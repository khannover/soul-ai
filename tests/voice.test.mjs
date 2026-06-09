import test from 'node:test';
import assert from 'node:assert/strict';

import { matchVoiceCommand } from '../core.mjs';
import { isLikelyVoiceEcho, VOICE_COMMANDS, VOICE_REPLIES } from '../i18n.mjs';

test('matchVoiceCommand does not match "play" inside TTS phrase "playing music"', () => {
  const playPatterns = VOICE_COMMANDS.en.play;
  assert.equal(matchVoiceCommand('play', playPatterns), true);
  assert.equal(matchVoiceCommand('playing music', playPatterns), false);
  assert.equal(matchVoiceCommand('playing music!', playPatterns), false);
});

test('matchVoiceCommand still matches multi-word phrases', () => {
  const playPatterns = VOICE_COMMANDS.en.play;
  assert.equal(matchVoiceCommand('start music please', playPatterns), true);
  assert.equal(matchVoiceCommand('play music now', playPatterns), true);
});

test('matchVoiceCommand uses word boundaries for single-word German commands', () => {
  const dancePatterns = VOICE_COMMANDS.de.dance;
  assert.equal(matchVoiceCommand('tanzen', dancePatterns), true);
  assert.equal(matchVoiceCommand('untertanzen', dancePatterns), false);
});

test('isLikelyVoiceEcho rejects known TTS replies bleeding into the mic', () => {
  assert.equal(isLikelyVoiceEcho('playing music', []), true);
  assert.equal(isLikelyVoiceEcho('lets dance', []), true);
  assert.equal(isLikelyVoiceEcho(VOICE_REPLIES.de.play, []), true);
  assert.equal(isLikelyVoiceEcho('volume up', ['Playing music!']), true);
  assert.equal(isLikelyVoiceEcho('shuffle playlist', []), false);
});