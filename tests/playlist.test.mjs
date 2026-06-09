import test from 'node:test';
import assert from 'node:assert/strict';

import {
  adjacentPlaylistIndex,
  clampPlaylistIndex,
  normalizePlaylistItem,
  playlistDisplayTitle,
  playlistTitleFromUrl,
} from '../core.mjs';

test('playlistTitleFromUrl extracts filename', () => {
  assert.equal(playlistTitleFromUrl('https://cdn.example.com/music/song%20one.mp3?x=1'), 'song one.mp3');
  assert.equal(playlistTitleFromUrl(''), 'URL track');
});

test('normalizePlaylistItem validates url and file entries', () => {
  const urlItem = normalizePlaylistItem({ source: 'url', url: 'https://x.test/a.mp3', title: 'A' });
  assert.equal(urlItem.title, 'A');
  assert.equal(urlItem.source, 'url');
  assert.equal(urlItem.url, 'https://x.test/a.mp3');
  assert.ok(urlItem.id);
  assert.equal(normalizePlaylistItem({ source: 'url' }), null);
  assert.equal(
    normalizePlaylistItem({ source: 'file', blobKey: 'blob-1', title: 'Local' })?.title,
    'Local',
  );
  assert.equal(normalizePlaylistItem({ source: 'file' }), null);
});

test('playlistDisplayTitle prefers explicit title', () => {
  const item = normalizePlaylistItem({ source: 'url', url: 'https://x.test/b.mp3', title: 'Custom' });
  assert.equal(playlistDisplayTitle(item), 'Custom');
});

test('clampPlaylistIndex bounds index', () => {
  assert.equal(clampPlaylistIndex(-2, 3), 0);
  assert.equal(clampPlaylistIndex(5, 3), 2);
  assert.equal(clampPlaylistIndex(1, 3), 1);
  assert.equal(clampPlaylistIndex(0, 0), -1);
});

test('adjacentPlaylistIndex wraps around', () => {
  assert.equal(adjacentPlaylistIndex(0, 3, -1), 2);
  assert.equal(adjacentPlaylistIndex(2, 3, 1), 0);
  assert.equal(adjacentPlaylistIndex(-1, 3, 1), 0);
  assert.equal(adjacentPlaylistIndex(-1, 0, 1), -1);
});