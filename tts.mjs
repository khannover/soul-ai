/** Kokoro TTS client (OpenAI-compatible) + helpers. Browser + node tests. */

export const KOKORO_VOICES = [
  'af_bella',
  'af_sarah',
  'am_adam',
  'am_michael',
  'bf_emma',
  'bm_george',
];

export const DEFAULT_TTS_VOICE = 'af_bella';
export const DEFAULT_TTS_SPEED = 1.05;
export const DEFAULT_TTS_URL = '/api/tts';
export const TTS_MAX_CHARS = 400;

const memoryCache = new Map();

export function truncateForTts(text, max = TTS_MAX_CHARS) {
  const trimmed = String(text || '').replace(/\s+/g, ' ').trim();
  if (!trimmed) return '';
  if (trimmed.length <= max) return trimmed;
  return trimmed.slice(0, max - 1).trimEnd() + '…';
}

export function ttsCacheKey(text, voice, speed = DEFAULT_TTS_SPEED) {
  return `${voice}|${speed}|${truncateForTts(text)}`;
}

/** auto = Kokoro for English, browser for German (no DE Kokoro voice). */
export function resolveTtsEngine(engine, locale) {
  const mode = engine || 'auto';
  if (mode === 'browser') return 'browser';
  if (mode === 'kokoro') return 'kokoro';
  return locale === 'de' ? 'browser' : 'kokoro';
}

export function peekTtsCache(text, { voice = DEFAULT_TTS_VOICE, speed = DEFAULT_TTS_SPEED } = {}) {
  const key = ttsCacheKey(text, voice, speed);
  return memoryCache.get(key) || null;
}

export function storeTtsCache(text, blob, { voice = DEFAULT_TTS_VOICE, speed = DEFAULT_TTS_SPEED } = {}) {
  const key = ttsCacheKey(text, voice, speed);
  memoryCache.set(key, blob);
  if (memoryCache.size > 48) {
    const oldest = memoryCache.keys().next().value;
    memoryCache.delete(oldest);
  }
}

/**
 * Synthesize MP3 via Kokoro (POST /v1/audio/speech). Returns Blob or null.
 */
export async function synthesizeKokoro(
  text,
  {
    url = DEFAULT_TTS_URL,
    voice = DEFAULT_TTS_VOICE,
    speed = DEFAULT_TTS_SPEED,
    signal,
  } = {},
) {
  const input = truncateForTts(text);
  if (!input) return null;

  const cached = peekTtsCache(input, { voice, speed });
  if (cached) return cached;

  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'kokoro',
        input,
        voice,
        response_format: 'mp3',
        speed: Number(speed) || DEFAULT_TTS_SPEED,
        stream: false,
      }),
      signal,
    });

    if (!res.ok) return null;

    const blob = await res.blob();
    if (!blob || blob.size === 0) return null;
    const type = blob.type || res.headers.get('content-type') || '';
    if (type && !type.startsWith('audio/')) return null;

    storeTtsCache(input, blob, { voice, speed });
    return blob;
  } catch {
    return null;
  }
}