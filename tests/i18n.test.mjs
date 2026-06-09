import test from 'node:test';
import assert from 'node:assert/strict';

import {
  LOCALES,
  detectLocale,
  getLocale,
  modeLabel,
  setLocale,
  speechRecognitionLang,
  t,
  voicePatterns,
  voiceReply,
} from '../i18n.mjs';

test('setLocale falls back to en for unknown codes', () => {
  setLocale('fr');
  assert.equal(getLocale(), 'en');
  setLocale('de');
  assert.equal(getLocale(), 'de');
});

test('t returns German strings when locale is de', () => {
  setLocale('de');
  assert.equal(t('settings.title'), 'EINSTELLUNGEN');
  assert.match(t('toast.welcome'), /Soul-AI/);
});

test('t interpolates variables', () => {
  setLocale('en');
  assert.equal(t('toast.trackLoaded', { name: 'song.mp3' }), 'Track loaded: song.mp3');
});

test('speechRecognitionLang maps locales', () => {
  assert.equal(speechRecognitionLang('en'), 'en-US');
  assert.equal(speechRecognitionLang('de'), 'de-DE');
});

test('voicePatterns differ by locale', () => {
  assert.ok(voicePatterns('de').dance.includes('tanzen'));
  assert.ok(voicePatterns('en').dance.includes('dance'));
});

test('modeLabel is localized', () => {
  assert.equal(modeLabel('idle', 'de'), 'RUHE');
  assert.equal(modeLabel('dance', 'en'), 'DANCE');
});

test('LOCALES includes en and de', () => {
  assert.deepEqual(LOCALES, ['en', 'de']);
});

test('voiceReply returns localized short phrase', () => {
  assert.equal(voiceReply('dance', 'de'), 'Los geht der Tanz!');
  assert.equal(voiceReply('dance', 'en'), "Let's dance!");
});