/** Shared constants + pure helpers (browser + node tests). */

export const APP_NAME = 'Soul-AI';
export const APP_SLUG = 'soul-ai';
export const APP_VERSION = '2.5.0';

export const STORAGE_KEYS = {
  settings: 'soul-ai-settings',
  chatHistory: 'soul-ai-chat-history',
  apiKeySession: 'soul-ai-api-key-session',
  legacy: {
    settings: 'souler-settings',
    chatHistory: 'souler-chat-history',
    apiKeySession: 'souler-api-key-session',
  },
};

/** Read localStorage with one-time migration from pre-rename Souler keys. */
export function readStoredJson(key, legacyKey) {
  if (typeof localStorage === 'undefined') return null;
  let raw = localStorage.getItem(key);
  if (raw == null && legacyKey) {
    raw = localStorage.getItem(legacyKey);
    if (raw != null) localStorage.setItem(key, raw);
  }
  if (raw == null) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

/** @typedef {{ id: string, title: string, source: 'url'|'file', url?: string, blobKey?: string, mimeType?: string }} PlaylistItem */

export function createPlaylistItemId() {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return `pl-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

/**
 * @param {Partial<PlaylistItem> & { source?: string }} raw
 * @returns {PlaylistItem|null}
 */
export function normalizePlaylistItem(raw) {
  if (!raw || typeof raw !== 'object') return null;
  const source = raw.source === 'file' ? 'file' : raw.source === 'url' ? 'url' : null;
  if (!source) return null;
  const id = typeof raw.id === 'string' && raw.id ? raw.id : createPlaylistItemId();
  const title = typeof raw.title === 'string' && raw.title.trim()
    ? raw.title.trim()
    : source === 'url'
      ? playlistTitleFromUrl(raw.url)
      : 'Track';
  if (source === 'url') {
    if (typeof raw.url !== 'string' || !raw.url.trim()) return null;
    return { id, title, source: 'url', url: raw.url.trim() };
  }
  if (typeof raw.blobKey !== 'string' || !raw.blobKey) return null;
  return {
    id,
    title,
    source: 'file',
    blobKey: raw.blobKey,
    mimeType: typeof raw.mimeType === 'string' ? raw.mimeType : '',
  };
}

export function playlistTitleFromUrl(url) {
  if (typeof url !== 'string' || !url) return 'URL track';
  try {
    const path = new URL(url).pathname;
    const name = path.split('/').pop() || '';
    return decodeURIComponent(name.split('?')[0]) || 'URL track';
  } catch {
    const name = url.split('/').pop() || '';
    return decodeURIComponent(name.split('?')[0]) || 'URL track';
  }
}

/** @param {PlaylistItem} item */
export function playlistDisplayTitle(item) {
  if (!item) return '';
  if (item.title) return item.title;
  if (item.source === 'url') return playlistTitleFromUrl(item.url);
  return 'Track';
}

export function clampPlaylistIndex(index, length) {
  if (!length) return -1;
  if (index < 0) return 0;
  if (index >= length) return length - 1;
  return index;
}

export function adjacentPlaylistIndex(currentIndex, length, delta) {
  if (!length) return -1;
  const base = currentIndex < 0 ? (delta > 0 ? 0 : length - 1) : currentIndex + delta;
  if (base < 0) return length - 1;
  if (base >= length) return 0;
  return base;
}

export function escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export function escapeRegExp(str) {
  return String(str).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/** Match voice commands without substring false positives (e.g. "play" in "playing"). */
export function matchVoiceCommand(text, patterns) {
  const normalized = String(text || '').toLowerCase().trim();
  if (!normalized || !Array.isArray(patterns)) return false;
  return patterns.some((pattern) => {
    const phrase = String(pattern || '').trim().toLowerCase();
    if (!phrase) return false;
    if (phrase.includes(' ')) return normalized.includes(phrase);
    return new RegExp(`\\b${escapeRegExp(phrase)}\\b`, 'i').test(normalized);
  });
}

export function beatThresholdFromSensitivity(
  sensitivity,
  beat = { sensitivityHigh: 0.3, sensitivityLow: 0.05 },
) {
  const s = Math.max(0, Math.min(1, Number(sensitivity) || 0));
  return beat.sensitivityHigh - s * (beat.sensitivityHigh - beat.sensitivityLow);
}

export function isValidPreset(data) {
  return Boolean(data && data.version === 1 && typeof data === 'object');
}