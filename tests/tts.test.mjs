import test from 'node:test';
import assert from 'node:assert/strict';

import {
  DEFAULT_TTS_VOICE,
  KOKORO_VOICES,
  resolveTtsEngine,
  synthesizeKokoro,
  truncateForTts,
  ttsCacheKey,
} from '../tts.mjs';

test('truncateForTts collapses whitespace and caps length', () => {
  assert.equal(truncateForTts('  hello   world  '), 'hello world');
  const long = 'a'.repeat(500);
  assert.equal(truncateForTts(long).length, 400);
  assert.match(truncateForTts(long), /…$/);
});

test('ttsCacheKey includes voice speed and text', () => {
  const key = ttsCacheKey('Hi', 'af_bella', 1.1);
  assert.match(key, /^af_bella\|1\.1\|/);
});

test('resolveTtsEngine auto picks browser for German', () => {
  assert.equal(resolveTtsEngine('auto', 'de'), 'browser');
  assert.equal(resolveTtsEngine('auto', 'en'), 'kokoro');
  assert.equal(resolveTtsEngine('kokoro', 'de'), 'kokoro');
});

test('KOKORO_VOICES includes default Bella', () => {
  assert.ok(KOKORO_VOICES.includes(DEFAULT_TTS_VOICE));
});

test('synthesizeKokoro returns null on HTTP error', async () => {
  const blob = await synthesizeKokoro('test', { url: 'http://127.0.0.1:1/nope' });
  assert.equal(blob, null);
});