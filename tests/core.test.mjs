import test from 'node:test';
import assert from 'node:assert/strict';

import {
  APP_NAME,
  APP_SLUG,
  APP_VERSION,
  readStoredJson,
  STORAGE_KEYS,
  beatThresholdFromSensitivity,
  escapeHtml,
  isValidPreset,
} from '../core.mjs';

test('escapeHtml neutralizes markup', () => {
  assert.equal(escapeHtml('<script>"x"</script>'), '&lt;script&gt;&quot;x&quot;&lt;/script&gt;');
});

test('beatThresholdFromSensitivity maps slider to threshold', () => {
  assert.equal(beatThresholdFromSensitivity(0), 0.3);
  assert.ok(Math.abs(beatThresholdFromSensitivity(1) - 0.05) < 1e-9);
  assert.equal(beatThresholdFromSensitivity(0.5), 0.175);
});

test('isValidPreset accepts version 1 objects only', () => {
  assert.equal(isValidPreset({ version: 1, settings: {} }), true);
  assert.equal(isValidPreset({ version: 2 }), false);
  assert.equal(isValidPreset(null), false);
});

test('APP_VERSION is semver-like', () => {
  assert.match(APP_VERSION, /^\d+\.\d+\.\d+$/);
  assert.equal(APP_NAME, 'Soul-AI');
  assert.equal(APP_SLUG, 'soul-ai');
  assert.equal(APP_VERSION, '2.5.0');
  assert.equal(STORAGE_KEYS.settings, 'soul-ai-settings');
  assert.equal(readStoredJson('missing-key'), null);
});