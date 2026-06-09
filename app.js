/**
 * Soul-AI — app.js
 * ================
 * Main application logic for the Soul-AI Live Speaker experience.
 *
 * Sections:
 *  1. State Management
 *  2. Settings (load/save)
 *  3. Particle Background
 *  4. Character Renderer (Canvas)
 *  5. Web Audio API — Beat/Energy Detection
 *  6. Audio Player
 *  7. Environmental Microphone Listener
 *  8. Voice Commands (Web Speech Recognition)
 *  9. AI Chat (OpenAI-compatible API)
 * 10. UI Controls & Event Wiring
 * 11. Animation Loop
 * 12. Utility Helpers
 * 13. PWA & Initialization
 */

import {
  APP_SLUG,
  APP_VERSION,
  readStoredJson,
  STORAGE_KEYS,
  adjacentPlaylistIndex,
  beatThresholdFromSensitivity,
  clampPlaylistIndex,
  createPlaylistItemId,
  escapeHtml,
  isValidPreset,
  matchVoiceCommand,
  normalizePlaylistItem,
  playlistDisplayTitle,
  playlistTitleFromUrl,
} from './core.mjs';
import {
  deleteBlob,
  loadBlob,
  loadCharacter,
  loadSession,
  migrateLegacyStorage,
  saveBlob,
  saveCharacter,
  saveSession,
} from './storage.mjs';
import {
  defaultSystemPrompt,
  detectLocale,
  getLocale,
  modeLabel,
  setLocale,
  speechRecognitionLang,
  speechSynthesisLang,
  t,
  isLikelyVoiceEcho,
  voicePatterns,
  voiceReply,
} from './i18n.mjs';
import {
  DEFAULT_TTS_SPEED,
  DEFAULT_TTS_VOICE,
  resolveTtsEngine,
  synthesizeKokoro,
  truncateForTts,
} from './tts.mjs';

/* ─────────────────────────────────────────────────
   CONFIG — All tunable constants in one place
   ───────────────────────────────────────────────── */
const CONFIG = {
  audio: {
    fftSize: 256,
    playerSmoothing: 0.8,
    micSmoothing: 0.7,
    energyFocusRatio: 0.5,
    peakDecay: 0.995,
    minPeak: 0.01,
  },
  particles: {
    initialCount: 60,
    maxCount: 150,
    baseSpeed: 0.3,
    lifeDecay: 0.003,
    connectionDistance: 80,
    burstMultiplier: 5,
    burstEnergyThreshold: 0.7,
    burstSpread: 200,
    burstVelocity: 2,
    burstRadius: [1, 3],
  },
  character: {
    maxCanvasSize: 420,
    maxUploadBytes: 25 * 1024 * 1024,
    sizeLandscape: 0.85,
    sizePortrait: 0.75,
    shadowBase: 20,
    shadowEnergy: 40,
    flashThreshold: 0.01,
    flashAlphaMul: 0.3,
  },
  animation: {
    lerp: { scale: 0.12, rotation: 0.1, position: 0.1, flash: 0.88 },
    idle: { breathSpeed: 0.8, breathAmount: 0.02, floatAmount: 3, blinkMin: 3.5, blinkRandom: 2 },
    dance: { bounceSpeed: 3, swaySpeed: 1.5, scaleAmount: 0.08, yAmount: 18, xAmount: 10, rotAmount: 3 },
    music: {
      bounceBase: 2, bounceEnergy: 4, swayBase: 1, swayEnergy: 2,
      beatScale: 0.15, beatY: 20, idleScale: 0.04, idleY: 8,
      xBase: 5, xEnergy: 10, rotBase: 2, rotEnergy: 4,
      shakeThreshold: 0.75, shakeAmount: 8,
    },
  },
  mic: {
    highpassHz: 100,
    humBinSkipRatio: 0.1,
    bassBinEndRatio: 0.4,
    confirmFrames: 18,
    constraints: {
      echoCancellation: true,
      noiseSuppression: true,
      autoGainControl: true,
    },
  },
  beat: {
    defaultThreshold: 0.15,
    sensitivityHigh: 0.3,
    sensitivityLow: 0.05,
    envMicFactor: 0.5,
    envMicCap: 0.3,
    visualizerMaxH: 55,
    visualizerHueShift: 50,
    onsetDecay: 0.92,
    onsetNormDiv: 80,
    onsetTrigger: 0.55,
  },
  glow: {
    outerBase: 0.45, innerBase: 0.65, outerEnergy: 0.15, innerEnergy: 0.1,
    sizeBase: 12, sizeEnergy: 30, alphaBase: 0.2, alphaEnergy: 0.5,
  },
  ui: {
    chatHistoryLimit: 30,
    aiPromptTurns: 10,
    aiMaxTokens: 120,
    toastDuration: 3000,
    voiceFeedbackDuration: 2500,
    voicePostTtsUnlockMs: 1400,
    voiceNoTtsUnlockMs: 500,
    voiceCommandCooldownMs: 2200,
    voiceTranscriptDedupeMs: 4500,
    resizeDebounce: 200,
    animationDeltaCap: 0.1,
  },
};

/* ─────────────────────────────────────────────────
   1. STATE MANAGEMENT
   ───────────────────────────────────────────────── */

const AppState = {
  mode: 'idle',           // 'idle' | 'dance' | 'music' | 'chat'
  characterImage: null,   // HTMLImageElement | HTMLVideoElement
  characterMediaType: 'image', // 'image' | 'video'
  characterObjectURL: null, // temporary object URL for uploaded local character media
  characterImageDataURL: null, // base64 data URL (PNG) for export/import & sharing
  audioContext: null,
  analyser: null,
  playerSource: null,     // MediaElementAudioSourceNode
  micSource: null,        // MediaStreamAudioSourceNode
  micHighpass: null,      // cuts 50/60 Hz hum before analysis
  micStream: null,
  audioElement: new Audio(),
  audioObjectURL: null,
  cachedAccentColor: '#00f5ff',
  chatInFlight: false,
  reducedMotion: false,
  lastAudioSource: null,   // 'file' | 'url'
  isPlaying: false,
  isMicListening: false,
  isVoiceListening: false,
  isSpeaking: false,      // TTS is currently playing (for mouth animation)
  micEnergy: 0,           // 0–1 current environmental mic level (for UI meter)
  micConfirmCount: 0,     // frames above threshold (for debounced music detection)
  beatEnergy: 0,          // 0–1 current audio energy (sustained)
  peakEnergy: 0,          // running peak for normalization
  beatThreshold: CONFIG.beat.defaultThreshold,
  prevFreqData: null,     // previous frame freq data for spectral flux
  onset: 0,               // 0–1 percussive onset strength (spectral flux)
  onsetPeak: 0,           // for normalizing onset over time
  envMusicDetected: false,
  animFrame: null,
  particles: [],
  vizBars: [],
  chatHistory: [],
  playlist: [],
  playlistIndex: -1,
  playlistPanelOpen: false,
  _persistSessionTimer: null,
  settings: {
    apiKey: '',
    apiBase: 'https://api.openai.com/v1',
    model: 'gpt-4o-mini',
    volume: 0.8,
    sensitivity: 0.5,
    theme: 'neon',
    animSpeed: 1.0,
    systemPrompt: '',
    rememberApiKey: true,
    locale: '',
    ttsEngine: 'auto',
    ttsVoice: DEFAULT_TTS_VOICE,
    ttsSpeed: DEFAULT_TTS_SPEED,
    voiceAlwaysOn: false,
  },

  // Character animation state
  anim: {
    // Shared
    scale: 1,
    targetScale: 1,
    rotation: 0,
    targetRotation: 0,
    x: 0,
    targetX: 0,
    y: 0,
    targetY: 0,
    // Idle breathing
    breathPhase: 0,
    blinkTimer: 0,
    blinkOpen: 1,
    // Dance bouncing
    bouncePhase: 0,
    swayPhase: 0,
    // Flash effect
    flashAlpha: 0,
    flashColor: '#00f5ff',
    // Shake
    shakeX: 0,
    shakeY: 0,
    // TTS speaking animation
    speakingPhase: 0,
  },
};

/* ─────────────────────────────────────────────────
   2. SETTINGS
   ───────────────────────────────────────────────── */

function loadSettings() {
  try {
    const saved = readStoredJson(STORAGE_KEYS.settings, STORAGE_KEYS.legacy.settings) || {};
    Object.assign(AppState.settings, saved);
    if (AppState.settings.rememberApiKey === undefined) {
      AppState.settings.rememberApiKey = true;
    }
    if (!AppState.settings.rememberApiKey) {
      let sessionKey = sessionStorage.getItem(STORAGE_KEYS.apiKeySession);
      if (!sessionKey) {
        sessionKey = sessionStorage.getItem(STORAGE_KEYS.legacy.apiKeySession);
        if (sessionKey) sessionStorage.setItem(STORAGE_KEYS.apiKeySession, sessionKey);
      }
      if (sessionKey) AppState.settings.apiKey = sessionKey;
    }
  } catch (e) {
    console.warn('Settings load error:', e);
  }

  const locale = detectLocale(AppState.settings.locale);
  AppState.settings.locale = locale;
  setLocale(locale);
  if (!AppState.settings.systemPrompt) {
    AppState.settings.systemPrompt = defaultSystemPrompt(locale);
  }

  applySettings();
}

function persistSettings({ showSavedToast = true } = {}) {
  try {
    const payload = { ...AppState.settings };
    if (!payload.rememberApiKey) {
      sessionStorage.setItem(STORAGE_KEYS.apiKeySession, payload.apiKey || '');
      payload.apiKey = '';
    } else {
      sessionStorage.removeItem(STORAGE_KEYS.apiKeySession);
    }
    localStorage.setItem(STORAGE_KEYS.settings, JSON.stringify(payload));
  } catch (e) {
    console.warn('Settings save error:', e);
  }
  applySettings();
  if (showSavedToast) showToast(t('toast.settingsSaved'), 'success');
}

function saveSettings() {
  persistSettings({ showSavedToast: true });
}

function applySettings() {
  const s = AppState.settings;
  // Volume
  AppState.audioElement.volume = s.volume;
  UI.volumeSlider.value = s.volume;
  UI.settingVolume.value = s.volume;
  UI.volDisplay.textContent = Math.round(s.volume * 100) + '%';
  AppState.beatThreshold = beatThresholdFromSensitivity(s.sensitivity, CONFIG.beat);
  UI.settingSensitivity.value = s.sensitivity;
  UI.sensDisplay.textContent = Math.round(s.sensitivity * 100) + '%';
  // Speed
  UI.settingSpeed.value = s.animSpeed;
  UI.speedDisplay.textContent = s.animSpeed.toFixed(1) + 'x';
  // API
  UI.settingApiKey.value = s.apiKey;
  UI.settingApiBase.value = s.apiBase;
  UI.settingModel.value = s.model;
  UI.settingSystemPrompt.value = s.systemPrompt;
  if (UI.settingRememberApiKey) {
    UI.settingRememberApiKey.checked = s.rememberApiKey !== false;
  }
  if (UI.settingLanguage) {
    UI.settingLanguage.value = s.locale || getLocale();
  }
  if (UI.settingTtsEngine) {
    UI.settingTtsEngine.value = s.ttsEngine || 'auto';
  }
  if (UI.settingTtsVoice) {
    UI.settingTtsVoice.value = s.ttsVoice || DEFAULT_TTS_VOICE;
  }
  if (UI.settingTtsSpeed) {
    UI.settingTtsSpeed.value = s.ttsSpeed ?? DEFAULT_TTS_SPEED;
    if (UI.ttsSpeedDisplay) {
      UI.ttsSpeedDisplay.textContent = Number(s.ttsSpeed ?? DEFAULT_TTS_SPEED).toFixed(2) + 'x';
    }
  }
  if (UI.settingVoiceAlwaysOn) {
    UI.settingVoiceAlwaysOn.checked = Boolean(s.voiceAlwaysOn);
  }
  updateVoiceButtonState();
  // Theme
  setAccentTheme(s.theme, false);
  // Swatches
  document.querySelectorAll('.theme-swatch').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.theme === s.theme);
  });
}

/* ─────────────────────────────────────────────────
   CHAT HISTORY PERSISTENCE
   ───────────────────────────────────────────────── */

function loadChatHistory() {
  try {
    const saved = readStoredJson(STORAGE_KEYS.chatHistory, STORAGE_KEYS.legacy.chatHistory) || [];
    AppState.chatHistory = Array.isArray(saved) ? saved.slice(-CONFIG.ui.chatHistoryLimit) : [];
  } catch (e) {
    console.warn('Chat history load error:', e);
    AppState.chatHistory = [];
  }
  renderChatHistory();
}

function saveChatHistory() {
  try {
    localStorage.setItem(STORAGE_KEYS.chatHistory, JSON.stringify(AppState.chatHistory.slice(-CONFIG.ui.chatHistoryLimit)));
  } catch (e) {
    console.warn('Chat history save error:', e);
  }
}

function applyTranslations() {
  const locale = getLocale();
  document.documentElement.lang = locale;

  document.querySelectorAll('[data-i18n]').forEach((el) => {
    el.textContent = t(el.dataset.i18n);
  });
  document.querySelectorAll('[data-i18n-html]').forEach((el) => {
    el.innerHTML = t(el.dataset.i18nHtml);
  });
  document.querySelectorAll('[data-i18n-placeholder]').forEach((el) => {
    el.placeholder = t(el.dataset.i18nPlaceholder);
  });
  document.querySelectorAll('[data-i18n-title]').forEach((el) => {
    el.title = t(el.dataset.i18nTitle);
  });
  document.querySelectorAll('[data-i18n-aria]').forEach((el) => {
    el.setAttribute('aria-label', t(el.dataset.i18nAria));
  });

  const metaDesc = document.querySelector('meta[name="description"]');
  if (metaDesc) metaDesc.content = t('meta.description');
  document.title = t('meta.title');

  refreshDynamicLabels();
}

function refreshDynamicLabels() {
  setMode(AppState.mode);
  UI.micLabel.textContent = AppState.isMicListening ? t('controls.micOn') : t('controls.mic');
  if (!AppState.audioElement?.src) {
    UI.trackInfo.textContent = t('player.noTrack');
  }
}

function changeLocale(locale) {
  AppState.settings.locale = locale;
  setLocale(locale);
  applyTranslations();
  applyRecognitionConfig();
  renderChatHistory();
}

function renderChatHistory() {
  const container = UI.chatMessages;
  if (!container) return;
  container.innerHTML = '';

  if (AppState.chatHistory.length === 0) {
    const ph = document.createElement('div');
    ph.className = 'text-gray-500 text-xs text-center mt-8';
    ph.id = 'chat-empty-hint';
    ph.textContent = t('chat.empty');
    container.appendChild(ph);
    return;
  }

  AppState.chatHistory.forEach(msg => {
    const role = msg.role === 'assistant' ? 'ai' : 'user';
    const el = document.createElement('div');
    el.className = 'chat-msg ' + role;
    el.innerHTML = `
      <div class="avatar">${role === 'user' ? '👤' : '🤖'}</div>
      <div class="bubble">${escapeHtml(msg.content)}</div>
    `;
    container.appendChild(el);
  });
  container.scrollTop = container.scrollHeight;
}

function clearChatHistory() {
  AppState.chatHistory = [];
  localStorage.removeItem(STORAGE_KEYS.chatHistory);
  renderChatHistory();
  showToast(t('toast.chatCleared'), 'info');
}

/* ─────────────────────────────────────────────────
   CHARACTER + SETTINGS EXPORT / IMPORT
   ───────────────────────────────────────────────── */

function exportCharacterAndSettings() {
  const s = AppState.settings;

  // Never export the raw API key
  const safeSettings = {
    apiBase: s.apiBase,
    model: s.model,
    volume: s.volume,
    sensitivity: s.sensitivity,
    theme: s.theme,
    animSpeed: s.animSpeed,
    systemPrompt: s.systemPrompt,
    locale: s.locale || getLocale(),
    ttsEngine: s.ttsEngine || 'auto',
    ttsVoice: s.ttsVoice || DEFAULT_TTS_VOICE,
    ttsSpeed: s.ttsSpeed ?? DEFAULT_TTS_SPEED,
    voiceAlwaysOn: Boolean(s.voiceAlwaysOn),
  };

  const payload = {
    version: 1,
    exportedAt: new Date().toISOString(),
    settings: safeSettings,
    character: AppState.characterImageDataURL
      ? {
          image: AppState.characterImageDataURL,
          note: 'PNG data URL (first frame if original was animated)'
        }
      : null,
  };

  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);

  const a = document.createElement('a');
  const date = new Date().toISOString().slice(0, 10);
  a.href = url;
  a.download = `${APP_SLUG}-preset-${date}.json`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);

  const hasExportedCharacter = Boolean(payload.character);
  if (hasExportedCharacter) {
    showToast(t('toast.presetExportedFull'), 'success');
  } else if (AppState.characterMediaType === 'video' && AppState.characterImage) {
    showToast(t('toast.presetExportedNoChar'), 'info');
  } else {
    showToast(t('toast.presetExportedSettings'), 'success');
  }
}

function importCharacterAndSettings(file) {
  if (!file) return;

  const reader = new FileReader();
  reader.onload = (e) => {
    try {
      const data = JSON.parse(e.target.result);

      if (!isValidPreset(data)) {
        throw new Error('Unsupported preset version');
      }

      // Apply safe settings
      const incoming = data.settings || {};
      const s = AppState.settings;

      if (incoming.apiBase) s.apiBase = incoming.apiBase;
      if (incoming.model) s.model = incoming.model;
      if (typeof incoming.volume === 'number') s.volume = Math.max(0, Math.min(1, incoming.volume));
      if (typeof incoming.sensitivity === 'number') s.sensitivity = Math.max(0, Math.min(1, incoming.sensitivity));
      if (incoming.theme) s.theme = incoming.theme;
      if (typeof incoming.animSpeed === 'number') s.animSpeed = Math.max(0.3, Math.min(2, incoming.animSpeed)); // keep user-facing range simple
      if (incoming.systemPrompt) s.systemPrompt = incoming.systemPrompt;
      if (incoming.locale) changeLocale(incoming.locale);
      if (incoming.ttsEngine) s.ttsEngine = incoming.ttsEngine;
      if (incoming.ttsVoice) s.ttsVoice = incoming.ttsVoice;
      if (typeof incoming.ttsSpeed === 'number') s.ttsSpeed = incoming.ttsSpeed;
      if (typeof incoming.voiceAlwaysOn === 'boolean') s.voiceAlwaysOn = incoming.voiceAlwaysOn;

      applySettings();

      if (data.character && data.character.image) {
        if (confirm(t('toast.importCharConfirm'))) {
          applyPresetCharacter(data.character.image);
        } else {
          showToast(t('toast.presetImportedSkipped'), 'info');
        }
      }

      persistSettings({ showSavedToast: false });
      showToast(t('toast.presetImported'), 'success');

    } catch (err) {
      console.error(err);
      showToast(t('toast.presetImportFailed', { error: err.message }), 'error');
    }
  };
  reader.onerror = () => showToast(t('toast.presetReadFailed'), 'error');
  reader.readAsText(file);
}

async function applyPresetCharacter(imageDataUrl) {
  try {
    const res = await fetch(imageDataUrl);
    const blob = await res.blob();
    loadCharacterImage(blob, { isVideo: false });
    showToast(t('toast.charImported'), 'success');
  } catch (err) {
    console.error(err);
    showToast(t('toast.charImportFailed'), 'error');
  }
}

/* ─────────────────────────────────────────────────
   3. PARTICLE BACKGROUND
   ───────────────────────────────────────────────── */

const pCanvas = document.getElementById('particle-canvas');
const pCtx = pCanvas.getContext('2d');

function resizeParticleCanvas() {
  pCanvas.width  = window.innerWidth;
  pCanvas.height = window.innerHeight;
}

function initParticles(count = CONFIG.particles.initialCount) {
  AppState.particles = [];
  for (let i = 0; i < count; i++) {
    AppState.particles.push(createParticle());
  }
}

function createParticle() {
  return {
    x: Math.random() * pCanvas.width,
    y: Math.random() * pCanvas.height,
    r: Math.random() * 1.5 + 0.3,
    vx: (Math.random() - 0.5) * CONFIG.particles.baseSpeed,
    vy: (Math.random() - 0.5) * CONFIG.particles.baseSpeed - 0.1,
    alpha: Math.random() * 0.6 + 0.1,
    life: Math.random(),
    hue: 185 + Math.random() * 40, // cyan-ish range
  };
}

function drawParticleConnections(particles, maxDist) {
  const cell = maxDist;
  const buckets = new Map();

  particles.forEach((p, idx) => {
    const key = `${Math.floor(p.x / cell)},${Math.floor(p.y / cell)}`;
    if (!buckets.has(key)) buckets.set(key, []);
    buckets.get(key).push(idx);
  });

  const offsets = [
    [0, 0], [1, 0], [-1, 0], [0, 1], [0, -1],
    [1, 1], [1, -1], [-1, 1], [-1, -1],
  ];

  for (let i = 0; i < particles.length; i++) {
    const p = particles[i];
    const cx = Math.floor(p.x / cell);
    const cy = Math.floor(p.y / cell);

    for (const [ox, oy] of offsets) {
      const bucket = buckets.get(`${cx + ox},${cy + oy}`);
      if (!bucket) continue;

      for (const j of bucket) {
        if (j <= i) continue;
        const q = particles[j];
        const dx = p.x - q.x;
        const dy = p.y - q.y;
        const dist = Math.hypot(dx, dy);
        if (dist >= maxDist) continue;

        pCtx.beginPath();
        pCtx.moveTo(p.x, p.y);
        pCtx.lineTo(q.x, q.y);
        pCtx.strokeStyle = `hsla(${p.hue}, 100%, 70%, ${0.05 * (1 - dist / maxDist) * p.life})`;
        pCtx.lineWidth = 0.5;
        pCtx.stroke();
      }
    }
  }
}

function updateParticles(energy) {
  if (AppState.reducedMotion) return;

  const speedMult = 1 + energy * 3;
  pCtx.clearRect(0, 0, pCanvas.width, pCanvas.height);

  AppState.particles.forEach((p, i) => {
    p.x += p.vx * speedMult;
    p.y += p.vy * speedMult;
    p.life -= CONFIG.particles.lifeDecay * speedMult;

    if (p.life <= 0 || p.x < 0 || p.x > pCanvas.width || p.y < 0 || p.y > pCanvas.height) {
      AppState.particles[i] = createParticle();
      return;
    }

    pCtx.beginPath();
    pCtx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
    pCtx.fillStyle = `hsla(${p.hue}, 100%, 70%, ${p.alpha * p.life})`;
    pCtx.fill();
  });

  drawParticleConnections(AppState.particles, CONFIG.particles.connectionDistance);

  // Beat burst: spawn extra particles on loud energy OR strong percussive onset
  if (energy > CONFIG.particles.burstEnergyThreshold || AppState.onset > 0.6) {
    const burst = Math.floor(energy * CONFIG.particles.burstMultiplier);
    for (let b = 0; b < burst; b++) {
      const bp = createParticle();
      bp.x  = pCanvas.width / 2 + (Math.random() - 0.5) * CONFIG.particles.burstSpread;
      bp.y  = pCanvas.height * 0.5 + (Math.random() - 0.5) * CONFIG.particles.burstSpread;
      bp.vx = (Math.random() - 0.5) * CONFIG.particles.burstVelocity;
      bp.vy = (Math.random() - 0.5) * CONFIG.particles.burstVelocity - 0.5;
      bp.r  = Math.random() * (CONFIG.particles.burstRadius[1] - CONFIG.particles.burstRadius[0]) + CONFIG.particles.burstRadius[0];
      bp.alpha = 0.9;
      AppState.particles.push(bp);
      if (AppState.particles.length > CONFIG.particles.maxCount) {
        AppState.particles.splice(0, AppState.particles.length - CONFIG.particles.maxCount);
      }
    }
  }
}

/* ─────────────────────────────────────────────────
   4. CHARACTER RENDERER
   ───────────────────────────────────────────────── */

const charCanvas = document.getElementById('character-canvas');
const charCtx    = charCanvas.getContext('2d');

function resizeCharCanvas() {
  const size = Math.min(window.innerWidth * 0.85, window.innerHeight * 0.55, CONFIG.character.maxCanvasSize);
  charCanvas.width  = size;
  charCanvas.height = size;
  charCanvas.style.width  = size + 'px';
  charCanvas.style.height = size + 'px';
}

/**
 * Draw the character with current animation state.
 */
function drawCharacter() {
  const ctx  = charCtx;
  const w    = charCanvas.width;
  const h    = charCanvas.height;
  const a    = AppState.anim;
  const energy = AppState.beatEnergy;

  ctx.clearRect(0, 0, w, h);

  // Smoothly lerp animation values
  const spd = AppState.settings.animSpeed;
  a.scale    += (a.targetScale    - a.scale)    * CONFIG.animation.lerp.scale * spd;
  a.rotation += (a.targetRotation - a.rotation) * CONFIG.animation.lerp.rotation * spd;
  a.x        += (a.targetX        - a.x)        * CONFIG.animation.lerp.position * spd;
  a.y        += (a.targetY        - a.y)        * CONFIG.animation.lerp.position * spd;
  a.flashAlpha *= CONFIG.animation.lerp.flash;

  ctx.save();
  ctx.translate(w / 2 + a.x + a.shakeX, h / 2 + a.y + a.shakeY);
  ctx.rotate(a.rotation * Math.PI / 180);
  ctx.scale(a.scale, a.scale);

  if (AppState.characterImage) {
    // Draw the uploaded character
    const media = AppState.characterImage;
    const mediaWidth = AppState.characterMediaType === 'video' ? media.videoWidth : media.naturalWidth;
    const mediaHeight = AppState.characterMediaType === 'video' ? media.videoHeight : media.naturalHeight;
    const safeWidth = mediaWidth || 1;
    const safeHeight = mediaHeight || 1;
    const mediaAspect = safeWidth / safeHeight;
    const drawW = (mediaAspect >= 1) ? w * CONFIG.character.sizeLandscape : w * CONFIG.character.sizePortrait;
    const drawH = drawW / mediaAspect;

    // Shadow / glow
    ctx.shadowColor = getAccentColor();
    ctx.shadowBlur  = CONFIG.character.shadowBase + energy * CONFIG.character.shadowEnergy;

    ctx.drawImage(media, -drawW / 2, -drawH / 2, drawW, drawH);

    // Beat flash overlay
    if (a.flashAlpha > CONFIG.character.flashThreshold) {
      ctx.globalAlpha = a.flashAlpha * CONFIG.character.flashAlphaMul;
      ctx.fillStyle   = a.flashColor;
      ctx.drawImage(media, -drawW / 2, -drawH / 2, drawW, drawH);
      ctx.globalAlpha = 1;
    }
  } else {
    // Placeholder: animated robot silhouette
    drawPlaceholderCharacter(ctx, w, h, energy);
  }

  ctx.restore();
}

/**
 * Draw an animated SVG-like placeholder when no image is loaded.
 */
function drawPlaceholderCharacter(ctx, w, h, energy) {
  const glow = getAccentColor();
  const t     = Date.now() / 1000;
  const bob   = Math.sin(t * 1.5) * 4 * (1 + energy * 2);
  const pulse = 0.9 + Math.sin(t * 2) * 0.05 + energy * 0.1;

  ctx.shadowColor = glow;
  ctx.shadowBlur  = 15 + energy * 30;
  ctx.strokeStyle = glow;
  ctx.fillStyle   = 'rgba(0,245,255,0.1)';
  ctx.lineWidth   = 2;

  const sz = Math.min(w, h) * 0.55;
  const cx = 0, cy = bob;

  ctx.save();
  ctx.scale(pulse, pulse);

  // Head
  ctx.beginPath();
  ctx.arc(cx, cy - sz * 0.3, sz * 0.18, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();

  // Eyes — blinking
  const blinkScale = AppState.anim.blinkOpen;
  ctx.save();
  ctx.translate(cx - sz * 0.07, cy - sz * 0.32);
  ctx.scale(1, blinkScale);
  ctx.beginPath();
  ctx.arc(0, 0, sz * 0.04, 0, Math.PI * 2);
  ctx.fillStyle = glow;
  ctx.shadowBlur = 8;
  ctx.fill();
  ctx.restore();

  ctx.save();
  ctx.translate(cx + sz * 0.07, cy - sz * 0.32);
  ctx.scale(1, blinkScale);
  ctx.beginPath();
  ctx.arc(0, 0, sz * 0.04, 0, Math.PI * 2);
  ctx.fillStyle = glow;
  ctx.shadowBlur = 8;
  ctx.fill();
  ctx.restore();

  // Mouth — animated when Soul-AI is speaking via TTS
  const mouthY = cy - sz * 0.205;
  if (AppState.isSpeaking) {
    const open = (Math.sin(AppState.anim.speakingPhase * 1.75) * 0.5 + 0.5) * 0.065 + 0.012;
    ctx.beginPath();
    ctx.ellipse(cx, mouthY, sz * 0.052, sz * open, 0, 0, Math.PI * 2);
    ctx.fillStyle = '#111';
    ctx.fill();
  } else {
    // Closed mouth as a small line
    ctx.strokeStyle = glow;
    ctx.lineWidth = 1.8;
    ctx.beginPath();
    ctx.moveTo(cx - sz * 0.032, mouthY);
    ctx.lineTo(cx + sz * 0.032, mouthY);
    ctx.stroke();
    ctx.lineWidth = 2;
  }

  ctx.fillStyle = 'rgba(0,245,255,0.1)';

  // Body
  ctx.beginPath();
  ctx.roundRect(cx - sz * 0.15, cy - sz * 0.1, sz * 0.30, sz * 0.35, sz * 0.04);
  ctx.fill();
  ctx.stroke();

  // Arms (with dance sway)
  const armAngle = AppState.mode === 'dance' || AppState.mode === 'music'
    ? Math.sin(t * 3 * AppState.settings.animSpeed) * 0.4
    : Math.sin(t * 0.8) * 0.1;

  // Left arm
  ctx.save();
  ctx.translate(cx - sz * 0.15, cy);
  ctx.rotate(-0.3 + armAngle);
  ctx.beginPath();
  ctx.roundRect(-sz * 0.06, 0, sz * 0.06, sz * 0.28, sz * 0.03);
  ctx.fill();
  ctx.stroke();
  ctx.restore();

  // Right arm
  ctx.save();
  ctx.translate(cx + sz * 0.15, cy);
  ctx.rotate(0.3 - armAngle);
  ctx.beginPath();
  ctx.roundRect(0, 0, sz * 0.06, sz * 0.28, sz * 0.03);
  ctx.fill();
  ctx.stroke();
  ctx.restore();

  // Legs
  const legSway = AppState.mode === 'dance' || AppState.mode === 'music'
    ? Math.sin(t * 4 * AppState.settings.animSpeed) * 0.15
    : 0;

  ctx.save();
  ctx.translate(cx - sz * 0.06, cy + sz * 0.25);
  ctx.rotate(-legSway);
  ctx.beginPath();
  ctx.roundRect(-sz * 0.06, 0, sz * 0.07, sz * 0.28, sz * 0.03);
  ctx.fill();
  ctx.stroke();
  ctx.restore();

  ctx.save();
  ctx.translate(cx + sz * 0.06, cy + sz * 0.25);
  ctx.rotate(legSway);
  ctx.beginPath();
  ctx.roundRect(0, 0, sz * 0.07, sz * 0.28, sz * 0.03);
  ctx.fill();
  ctx.stroke();
  ctx.restore();

  ctx.restore(); // scale(pulse)
}

/**
 * Load character media (image or MP4) from a local Blob/File into the character slot.
 */
async function persistCharacterMedia() {
  try {
    if (AppState.characterMediaType === 'image' && AppState.characterImageDataURL) {
      await saveCharacter({ mediaType: 'image', dataUrl: AppState.characterImageDataURL });
      return;
    }
    if (AppState.characterMediaType === 'video' && AppState.characterObjectURL) {
      const res = await fetch(AppState.characterObjectURL);
      const blob = await res.blob();
      const blobKey = `char-video-${createPlaylistItemId()}`;
      const existing = await loadCharacter();
      if (existing?.blobKey && existing.blobKey !== blobKey) {
        await deleteBlob(existing.blobKey).catch(() => {});
      }
      await saveBlob(blobKey, blob);
      await saveCharacter({
        mediaType: 'video',
        blobKey,
        mimeType: blob.type || 'video/mp4',
      });
    }
  } catch (e) {
    console.warn('Character persist error:', e);
  }
}

function schedulePersistSession() {
  clearTimeout(AppState._persistSessionTimer);
  AppState._persistSessionTimer = setTimeout(() => {
    persistSession().catch((e) => console.warn('Session persist error:', e));
  }, 400);
}

async function persistSession() {
  await saveSession({
    playlist: AppState.playlist,
    currentIndex: AppState.playlistIndex,
    lastUrl: UI.urlInput?.value?.trim() || '',
  });
}

function playlistHasItem(item) {
  return AppState.playlist.some((p) => {
    if (item.source === 'url' && p.source === 'url') return p.url === item.url;
    if (item.source === 'file' && p.source === 'file') {
      return p.blobKey === item.blobKey || (p.title === item.title && !item.blobKey);
    }
    return false;
  });
}

async function addFileToPlaylist(file, { silent = false } = {}) {
  const blobKey = `track-${createPlaylistItemId()}`;
  await saveBlob(blobKey, file);
  const item = normalizePlaylistItem({
    source: 'file',
    title: file.name,
    blobKey,
    mimeType: file.type,
  });
  if (!item) return null;
  if (playlistHasItem(item)) {
    if (!silent) showToast(t('toast.playlistExists', { name: file.name }), 'info');
    return AppState.playlist.find((p) => p.source === 'file' && p.title === file.name) || null;
  }
  AppState.playlist.push(item);
  if (!silent) showToast(t('toast.playlistAdded', { name: file.name }), 'success');
  schedulePersistSession();
  renderPlaylist();
  return item;
}

async function addUrlToPlaylist(url, { silent = false } = {}) {
  const trimmed = url?.trim();
  if (!trimmed) return null;
  const item = normalizePlaylistItem({
    source: 'url',
    url: trimmed,
    title: playlistTitleFromUrl(trimmed),
  });
  if (!item) return null;
  if (playlistHasItem(item)) {
    if (!silent) showToast(t('toast.playlistExists', { name: item.title }), 'info');
    return AppState.playlist.find((p) => p.source === 'url' && p.url === trimmed) || null;
  }
  AppState.playlist.push(item);
  if (!silent) showToast(t('toast.playlistAdded', { name: item.title }), 'success');
  schedulePersistSession();
  renderPlaylist();
  return item;
}

async function addCurrentOrUrlToPlaylist() {
  const url = UI.urlInput?.value?.trim();
  if (url) {
    const item = await addUrlToPlaylist(url);
    if (item) {
      AppState.playlistIndex = AppState.playlist.findIndex((p) => p.id === item.id);
      renderPlaylist();
      schedulePersistSession();
    }
    return;
  }

  const title = UI.trackInfo?.textContent?.trim();
  const hasTrack = AppState.audioElement?.src && title && title !== t('player.noTrack');
  if (!hasTrack) {
    showToast(t('toast.playlistNothingToAdd'), 'info');
    return;
  }

  if (AppState.lastAudioSource === 'url') {
    const item = await addUrlToPlaylist(AppState.audioElement.src);
    if (item) {
      AppState.playlistIndex = AppState.playlist.findIndex((p) => p.id === item.id);
      renderPlaylist();
      schedulePersistSession();
    }
    return;
  }

  try {
    const res = await fetch(AppState.audioElement.src);
    const blob = await res.blob();
    const file = new File([blob], title, { type: blob.type || 'audio/mpeg' });
    const item = await addFileToPlaylist(file);
    if (item) {
      AppState.playlistIndex = AppState.playlist.findIndex((p) => p.id === item.id);
      renderPlaylist();
      schedulePersistSession();
    }
  } catch (e) {
    console.warn('Playlist add from current track failed:', e);
    showToast(t('toast.playlistNothingToAdd'), 'info');
  }
}

function renderPlaylist() {
  const list = UI.playlistList;
  if (!list) return;

  list.innerHTML = '';
  const total = AppState.playlist.length;
  const current = AppState.playlistIndex;
  if (UI.playlistCount) {
    UI.playlistCount.textContent = total
      ? `${current >= 0 ? current + 1 : 0}/${total}`
      : '0/0';
  }

  if (!total) {
    const empty = document.createElement('li');
    empty.className = 'playlist-empty';
    empty.textContent = t('player.playlistEmpty');
    list.appendChild(empty);
    return;
  }

  AppState.playlist.forEach((item, index) => {
    const li = document.createElement('li');
    li.className = 'playlist-item' + (index === current ? ' active' : '');
    li.dataset.index = String(index);

    const title = document.createElement('span');
    title.className = 'playlist-item-title';
    title.textContent = playlistDisplayTitle(item);
    title.title = playlistDisplayTitle(item);

    const remove = document.createElement('button');
    remove.type = 'button';
    remove.className = 'playlist-item-remove';
    remove.setAttribute('aria-label', t('player.removeTrack'));
    remove.textContent = '×';

    li.appendChild(title);
    li.appendChild(remove);
    list.appendChild(li);
  });
}

function togglePlaylistPanel() {
  if (!UI.playlistPanel) return;
  AppState.playlistPanelOpen = !AppState.playlistPanelOpen;
  UI.playlistPanel.classList.toggle('hidden', !AppState.playlistPanelOpen);
}

async function playPlaylistIndex(index, { autoplay = true, silent = false } = {}) {
  if (!AppState.playlist.length) return false;
  const safeIndex = clampPlaylistIndex(index, AppState.playlist.length);
  const item = AppState.playlist[safeIndex];
  if (!item) return false;

  AppState.playlistIndex = safeIndex;
  renderPlaylist();
  schedulePersistSession();

  if (item.source === 'url') {
    loadAudioURL(item.url, { silent, skipPlaylist: true });
    if (autoplay) playAudio();
    return true;
  }

  const blob = await loadBlob(item.blobKey);
  if (!blob) {
    if (!silent) showToast(t('toast.trackRestoreFailed'), 'error');
    return false;
  }
  const file = new File([blob], item.title, { type: item.mimeType || blob.type || 'audio/mpeg' });
  loadAudioFile(file, { silent, skipPlaylist: true });
  if (autoplay) playAudio();
  return true;
}

async function playNextTrack({ autoplay = true } = {}) {
  if (!AppState.playlist.length) return false;
  const next = adjacentPlaylistIndex(AppState.playlistIndex, AppState.playlist.length, 1);
  return playPlaylistIndex(next, { autoplay, silent: true });
}

async function playPrevTrack({ autoplay = true } = {}) {
  if (!AppState.playlist.length) return false;
  const prev = adjacentPlaylistIndex(AppState.playlistIndex, AppState.playlist.length, -1);
  return playPlaylistIndex(prev, { autoplay, silent: true });
}

async function removePlaylistItemAt(index) {
  const item = AppState.playlist[index];
  if (!item) return;
  if (item.source === 'file' && item.blobKey) {
    await deleteBlob(item.blobKey).catch(() => {});
  }
  AppState.playlist.splice(index, 1);
  if (!AppState.playlist.length) {
    AppState.playlistIndex = -1;
  } else if (AppState.playlistIndex === index) {
    AppState.playlistIndex = Math.min(index, AppState.playlist.length - 1);
  } else if (AppState.playlistIndex > index) {
    AppState.playlistIndex -= 1;
  }
  renderPlaylist();
  schedulePersistSession();
  showToast(t('toast.playlistRemoved'), 'info');
}

async function clearPlaylist() {
  for (const item of AppState.playlist) {
    if (item.source === 'file' && item.blobKey) {
      await deleteBlob(item.blobKey).catch(() => {});
    }
  }
  AppState.playlist = [];
  AppState.playlistIndex = -1;
  renderPlaylist();
  schedulePersistSession();
  showToast(t('toast.playlistCleared'), 'info');
}

async function ensureLoadedTrackInPlaylist(file) {
  const existingIdx = AppState.playlist.findIndex(
    (p) => p.source === 'file' && p.title === file.name,
  );
  if (existingIdx >= 0) {
    AppState.playlistIndex = existingIdx;
    renderPlaylist();
    schedulePersistSession();
    return;
  }
  const item = await addFileToPlaylist(file, { silent: true });
  if (item) {
    AppState.playlistIndex = AppState.playlist.findIndex((p) => p.id === item.id);
    renderPlaylist();
    schedulePersistSession();
  }
}

async function ensureLoadedUrlInPlaylist(url) {
  const existingIdx = AppState.playlist.findIndex(
    (p) => p.source === 'url' && p.url === url,
  );
  if (existingIdx >= 0) {
    AppState.playlistIndex = existingIdx;
    renderPlaylist();
    schedulePersistSession();
    return;
  }
  const item = await addUrlToPlaylist(url, { silent: true });
  if (item) {
    AppState.playlistIndex = AppState.playlist.findIndex((p) => p.id === item.id);
    renderPlaylist();
    schedulePersistSession();
  }
}

async function restorePersistedSession() {
  let restored = false;

  try {
    const char = await loadCharacter();
    if (char?.mediaType === 'image' && char.dataUrl) {
      const res = await fetch(char.dataUrl);
      const blob = await res.blob();
      loadCharacterImage(blob, { isVideo: false, silent: true });
      restored = true;
    } else if (char?.mediaType === 'video' && char.blobKey) {
      const blob = await loadBlob(char.blobKey);
      if (blob) {
        loadCharacterImage(blob, { isVideo: true, silent: true });
        restored = true;
      }
    }
  } catch (e) {
    console.warn('Character restore error:', e);
  }

  try {
    const session = await loadSession();
    if (session?.lastUrl && UI.urlInput) {
      UI.urlInput.value = session.lastUrl;
    }
    if (session?.playlist?.length) {
      AppState.playlist = session.playlist.map(normalizePlaylistItem).filter(Boolean);
      AppState.playlistIndex = clampPlaylistIndex(
        session.currentIndex ?? -1,
        AppState.playlist.length,
      );
      renderPlaylist();
      if (AppState.playlistIndex >= 0) {
        await playPlaylistIndex(AppState.playlistIndex, { autoplay: false, silent: true });
      }
      restored = true;
    }
  } catch (e) {
    console.warn('Session restore error:', e);
  }

  if (restored) {
    setTimeout(() => showToast(t('toast.sessionRestored'), 'success'), 1400);
  }
}

function loadCharacterImage(fileOrBlob, options = {}) {
  const { isVideo = false, silent = false } = options;
  if (!(fileOrBlob instanceof Blob)) {
    AppState._pendingCharacterUploadType = null;
    showToast(t('toast.invalidCharFile'), 'error');
    return;
  }

  const objectURL = URL.createObjectURL(fileOrBlob);
  const previousObjectURL = AppState.characterObjectURL;

  const media = isVideo ? document.createElement('video') : new Image();

  const onLoad = () => {
    if (previousObjectURL && previousObjectURL !== objectURL) {
      URL.revokeObjectURL(previousObjectURL);
    }
    AppState.characterObjectURL = objectURL;
    AppState.characterImage = media;
    AppState.characterMediaType = isVideo ? 'video' : 'image';

    // Capture a portable PNG data URL for export/import (images only)
    if (!isVideo) {
      try {
        const c = document.createElement('canvas');
        c.width = media.naturalWidth;
        c.height = media.naturalHeight;
        const cx = c.getContext('2d');
        cx.drawImage(media, 0, 0);
        AppState.characterImageDataURL = c.toDataURL('image/png');
      } catch (e) {
        AppState.characterImageDataURL = null;
      }
    } else {
      AppState.characterImageDataURL = null;
      media.play().catch(() => {});
    }

    document.getElementById('upload-overlay').style.display = 'none';

    if (!silent) {
      if (AppState._pendingCharacterUploadType === 'gif') {
        showToast(t('toast.gifLoaded'), 'info');
      } else if (AppState._pendingCharacterUploadType === 'mp4' || isVideo) {
        showToast(t('toast.mp4Loaded'), 'success');
      } else {
        showToast(t('toast.charLoaded'), 'success');
      }
    }
    AppState._pendingCharacterUploadType = null;
    persistCharacterMedia().catch((e) => console.warn('Character persist error:', e));
    triggerFlash();
  };

  media.onerror = () => {
    URL.revokeObjectURL(objectURL);
    AppState._pendingCharacterUploadType = null;
    showToast(isVideo ? t('toast.mp4LoadFailed') : t('toast.imageLoadFailed'), 'error');
  };

  if (isVideo) {
    media.muted = true;
    media.loop = true;
    media.playsInline = true;
    media.autoplay = true;
    media.preload = 'auto';
    media.onloadeddata = onLoad;
    media.src = objectURL;
  } else {
    media.onload = onLoad;
    media.src = objectURL;
  }
}

/* ─────────────────────────────────────────────────
   5. WEB AUDIO API — BEAT/ENERGY DETECTION
   ───────────────────────────────────────────────── */

function initAudioContext() {
  if (AppState.audioContext) return;
  AppState.audioContext = new (window.AudioContext || window.webkitAudioContext)();
  AppState.analyser = AppState.audioContext.createAnalyser();
  AppState.analyser.fftSize = CONFIG.audio.fftSize;
  AppState.analyser.smoothingTimeConstant = CONFIG.audio.playerSmoothing;
  AppState.analyser.connect(AppState.audioContext.destination);
}

/**
 * Connect the <audio> element to the analyser graph.
 * Gracefully handles CORS-blocked cross-origin audio (common with public URLs).
 */
function connectPlayerToAnalyser() {
  initAudioContext();
  if (!AppState.playerSource) {
    try {
      AppState.playerSource = AppState.audioContext.createMediaElementSource(AppState.audioElement);
      AppState.playerSource.connect(AppState.analyser);
    } catch (err) {
      // This is almost always a CORS / tainted media element error
      console.warn('Web Audio connection failed (likely CORS):', err);
      if (AppState.lastAudioSource === 'url') {
        showToast(t('toast.corsBeatDisabled'), 'info');
      } else {
        showToast(t('toast.audioAnalysisUnavailable'), 'info');
      }
      // Playback still works, just no reactive visuals / beat sync
    }
  }
}

/**
 * Compute normalized energy (0–1) from the analyser's frequency data.
 * Also detects beat peaks.
 */
function computeAudioEnergy() {
  if (!AppState.analyser) return 0;

  const bufLen = AppState.analyser.frequencyBinCount;
  const data   = new Uint8Array(bufLen);
  AppState.analyser.getByteFrequencyData(data);

  // Focus on bass/mid frequencies
  const focusBins = Math.floor(bufLen * CONFIG.audio.energyFocusRatio);

  // --- 1. Sustained energy (existing behavior) ---
  let sum = 0;
  for (let i = 0; i < focusBins; i++) {
    sum += data[i];
  }
  const avg = sum / (focusBins * 255);

  AppState.peakEnergy = Math.max(AppState.peakEnergy * CONFIG.audio.peakDecay, avg);
  const normalized = AppState.peakEnergy > CONFIG.audio.minPeak ? Math.min(avg / AppState.peakEnergy, 1) : avg;
  AppState.beatEnergy = normalized;

  // --- 2. Spectral flux onset detection (new — much tighter on real beats) ---
  let flux = 0;
  if (AppState.prevFreqData && AppState.prevFreqData.length === bufLen) {
    for (let i = 0; i < focusBins; i++) {
      const diff = data[i] - AppState.prevFreqData[i];
      if (diff > 0) flux += diff;
    }
  }

  // Normalize flux into ~0–1 range
  const normFlux = Math.min(flux / (focusBins * CONFIG.beat.onsetNormDiv), 1);

  // Peak-normalized + smoothed onset
  AppState.onsetPeak = Math.max(AppState.onsetPeak * CONFIG.beat.onsetDecay, normFlux);
  AppState.onset = (AppState.onsetPeak > 0.005)
    ? Math.min(normFlux / AppState.onsetPeak, 1)
    : 0;

  // Keep copy for next frame (getByteFrequencyData reuses the buffer)
  AppState.prevFreqData = new Uint8Array(data);

  return normalized;
}

/**
 * Update the beat visualizer bars.
 */
function updateVisualizer() {
  if (!AppState.analyser) return;

  const bars = AppState.vizBars;
  const data = new Uint8Array(AppState.analyser.frequencyBinCount);
  AppState.analyser.getByteFrequencyData(data);

  const barCount = bars.length;
  const step = Math.floor(data.length / barCount);
  const maxH = CONFIG.beat.visualizerMaxH;

  bars.forEach((bar, i) => {
    const val = data[i * step] / 255;
    const h   = Math.max(2, val * maxH);
    bar.style.height = h + 'px';
    // Color shifts from accent → pink at high energy
    const hue = 185 - val * CONFIG.beat.visualizerHueShift;
    bar.style.background = `hsl(${hue}, 100%, 60%)`;
    bar.style.boxShadow  = `0 0 ${4 + val * 8}px hsl(${hue}, 100%, 60%)`;
  });
}

/* ─────────────────────────────────────────────────
   6. AUDIO PLAYER
   ───────────────────────────────────────────────── */

function setupAudioPlayer() {
  const audio = AppState.audioElement;

  audio.addEventListener('play', () => {
    AppState.isPlaying = true;
    updatePlayPauseIcon();
    setMode('music');
    connectPlayerToAnalyser();
    // Resume audio context if suspended (browser policy)
    if (AppState.audioContext && AppState.audioContext.state === 'suspended') {
      AppState.audioContext.resume();
    }
  });

  audio.addEventListener('pause', () => {
    AppState.isPlaying = false;
    updatePlayPauseIcon();
    resetAudioAnalysis();
    if (!AppState.isMicListening) setMode('idle');
  });

  audio.addEventListener('ended', () => {
    AppState.isPlaying = false;
    updatePlayPauseIcon();
    resetAudioAnalysis();
    if (AppState.playlist.length > 1) {
      playNextTrack({ autoplay: true }).catch((e) => console.warn('Auto-advance failed:', e));
      return;
    }
    if (!AppState.isMicListening) setMode('idle');
  });

  audio.addEventListener('error', () => {
    const err = audio.error;
    let msg = 'Audio error: cannot play this source';
    let type = 'error';

    if (err) {
      switch (err.code) {
        case 1: // MEDIA_ERR_ABORTED
          msg = 'Playback was aborted.';
          type = 'info';
          break;
        case 2: // MEDIA_ERR_NETWORK
          msg = 'Network error while loading audio.';
          break;
        case 3: // MEDIA_ERR_DECODE
          msg = 'Audio file is corrupted or unsupported format.';
          break;
        case 4: // MEDIA_ERR_SRC_NOT_SUPPORTED
          if (AppState.lastAudioSource === 'url') {
            msg = 'Audio URL failed (CORS, 404, or unsupported). Try a direct MP3 link or load a local file.';
          } else {
            msg = 'Audio format not supported by this browser.';
          }
          break;
        default:
          msg = 'Audio error: ' + (err.message || 'cannot play this source');
      }
    }

    showToast(msg, type);
    AppState.isPlaying = false;
    updatePlayPauseIcon();
  });
}

function playAudio() {
  initAudioContext();
  connectPlayerToAnalyser();
  AppState.audioElement.play().catch(err => {
    showToast(t('toast.playbackBlocked'), 'info');
  });
}

function pauseAudio() {
  AppState.audioElement.pause();
}

function stopAudio() {
  AppState.audioElement.pause();
  AppState.audioElement.currentTime = 0;
  resetAudioAnalysis();
}

function resetAudioAnalysis() {
  AppState.prevFreqData = null;
  AppState.onset = 0;
  AppState.onsetPeak = 0;
  AppState.beatEnergy = 0;
}

function revokeAudioObjectURL() {
  if (AppState.audioObjectURL) {
    URL.revokeObjectURL(AppState.audioObjectURL);
    AppState.audioObjectURL = null;
  }
}

function prepareAudioElementForSource(sourceType) {
  revokeAudioObjectURL();
  resetAudioAnalysis();
  AppState.audioElement.crossOrigin = sourceType === 'url' ? 'anonymous' : null;
  AppState.lastAudioSource = sourceType;
}

function loadAudioFile(file, options = {}) {
  const { silent = false, skipPlaylist = false } = options;
  prepareAudioElementForSource('file');
  const url = URL.createObjectURL(file);
  AppState.audioObjectURL = url;
  AppState.audioElement.src = url;
  AppState.audioElement.load();
  UI.trackInfo.textContent = file.name;
  if (!silent) showToast(t('toast.trackLoaded', { name: file.name }), 'info');
  if (!skipPlaylist) {
    ensureLoadedTrackInPlaylist(file).catch((e) => console.warn('Playlist sync failed:', e));
  } else {
    schedulePersistSession();
  }
}

function loadAudioURL(url, options = {}) {
  const { silent = false, skipPlaylist = false } = options;
  if (!url) return;
  prepareAudioElementForSource('url');
  AppState.audioElement.src = url;
  AppState.audioElement.load();
  const shortName = playlistTitleFromUrl(url);
  UI.trackInfo.textContent = shortName;
  if (UI.urlInput) UI.urlInput.value = url;
  if (!silent) showToast(t('toast.loadingUrl'), 'info');
  if (!skipPlaylist) {
    ensureLoadedUrlInPlaylist(url).catch((e) => console.warn('Playlist sync failed:', e));
  } else {
    schedulePersistSession();
  }
}

function updatePlayPauseIcon() {
  UI.iconPlay.style.display  = AppState.isPlaying ? 'none'  : 'block';
  UI.iconPause.style.display = AppState.isPlaying ? 'block' : 'none';
}

/* ─────────────────────────────────────────────────
   7. ENVIRONMENTAL MICROPHONE LISTENER
   ───────────────────────────────────────────────── */

async function toggleEnvMic() {
  if (AppState.isMicListening) {
    stopEnvMic();
  } else {
    await startEnvMic();
  }
}

function readMicLevels(data) {
  const skip = Math.max(1, Math.floor(data.length * CONFIG.mic.humBinSkipRatio));
  const bassEnd = Math.floor(data.length * CONFIG.mic.bassBinEndRatio);
  let totalSum = 0;
  let bassSum = 0;
  for (let i = 0; i < data.length; i++) totalSum += data[i];
  for (let i = skip; i < bassEnd; i++) bassSum += data[i];
  const totalAvg = totalSum / (data.length * 255);
  const bassAvg = bassSum / (Math.max(1, bassEnd - skip) * 255);
  return { totalAvg, bassAvg };
}

function computeMicEnergy() {
  if (!AppState.micAnalyser) return 0;
  const data = new Uint8Array(AppState.micAnalyser.frequencyBinCount);
  AppState.micAnalyser.getByteFrequencyData(data);
  const { bassAvg } = readMicLevels(data);
  return Math.min(bassAvg / CONFIG.beat.envMicCap, 1);
}

async function startEnvMic() {
  try {
    initAudioContext();
    const stream = await navigator.mediaDevices.getUserMedia({
      audio: CONFIG.mic.constraints,
      video: false,
    });
    AppState.micStream = stream;
    AppState.micSource = AppState.audioContext.createMediaStreamSource(stream);

    const micHighpass = AppState.audioContext.createBiquadFilter();
    micHighpass.type = 'highpass';
    micHighpass.frequency.value = CONFIG.mic.highpassHz;
    micHighpass.Q.value = 0.7;
    AppState.micHighpass = micHighpass;

    const micAnalyser = AppState.audioContext.createAnalyser();
    micAnalyser.fftSize = CONFIG.audio.fftSize;
    micAnalyser.smoothingTimeConstant = CONFIG.audio.micSmoothing;
    AppState.micSource.connect(micHighpass);
    micHighpass.connect(micAnalyser);

    AppState.micAnalyser = micAnalyser;

    AppState.isMicListening = true;
    AppState.micConfirmCount = 0;
    UI.btnMic.classList.add('active');
    UI.micLabel.textContent = t('controls.micOn');
    showToast(t('toast.micActive'), 'info');

    // Resume context
    if (AppState.audioContext.state === 'suspended') {
      AppState.audioContext.resume();
    }
  } catch (err) {
    console.warn('Mic error:', err);
    if (err?.name === 'NotFoundError') {
      showToast(t('toast.micNotFound'), 'error');
    } else if (err?.name === 'NotAllowedError' || err?.name === 'PermissionDeniedError') {
      showToast(t('toast.micDenied'), 'error');
      showPermissionOverlay('microphone');
    } else {
      showToast(t('toast.micUnavailable', { error: err?.message || err?.name || 'unknown' }), 'error');
    }
  }
}

function stopEnvMic() {
  if (AppState.micStream) {
    AppState.micStream.getTracks().forEach(t => t.stop());
    AppState.micStream = null;
  }
  if (AppState.micSource) {
    AppState.micSource.disconnect();
    AppState.micSource = null;
  }
  if (AppState.micHighpass) {
    AppState.micHighpass.disconnect();
    AppState.micHighpass = null;
  }
  AppState.micAnalyser = null;
  AppState.isMicListening = false;
  AppState.envMusicDetected = false;
  AppState.micEnergy = 0;
  AppState.micConfirmCount = 0;
  UI.btnMic.classList.remove('active');
  UI.micLabel.textContent = t('controls.mic');
  if (UI.micLevelMeter) UI.micLevelMeter.classList.add('hidden');
  if (!AppState.isPlaying) setMode('idle');
  showToast(t('toast.micOff'), 'info');
}

/**
 * Check microphone energy to auto-detect music in the environment.
 */
function checkEnvMic() {
  if (!AppState.micAnalyser) return;

  const data = new Uint8Array(AppState.micAnalyser.frequencyBinCount);
  AppState.micAnalyser.getByteFrequencyData(data);
  const { totalAvg, bassAvg } = readMicLevels(data);
  AppState.micEnergy = totalAvg;

  updateMicLevelMeter(totalAvg);

  const threshold = AppState.beatThreshold * CONFIG.beat.envMicFactor;
  const isAbove = bassAvg > threshold;

  if (isAbove) {
    AppState.micConfirmCount = Math.min(AppState.micConfirmCount + 1, 40);
  } else {
    AppState.micConfirmCount = Math.max(AppState.micConfirmCount - 2, 0);
  }

  const confirmedMusic = AppState.micConfirmCount > CONFIG.mic.confirmFrames;

  if (confirmedMusic) {
    if (!AppState.envMusicDetected) {
      AppState.envMusicDetected = true;
      setMode('music');
      showToast(t('toast.musicDetected'), 'info');
    }
    if (!AppState.isPlaying) {
      // Feed the character animation from the mic
      AppState.beatEnergy = Math.min(bassAvg / CONFIG.beat.envMicCap, 1);
    }
  } else {
    if (AppState.envMusicDetected) {
      AppState.envMusicDetected = false;
      if (!AppState.isPlaying) setMode('idle');
    }
  }
}

function updateMicLevelMeter(energy) {
  const meter = UI.micLevelMeter;
  if (!meter) return;

  // Show meter only when mic is actively listening
  if (AppState.isMicListening) {
    meter.classList.remove('hidden');
    // Map 0–0.6+ energy to 0–100% fill
    const fill = Math.min(energy / 0.55, 1) * 100;
    meter.style.setProperty('--fill', fill + '%');
    // Dynamic color: cyan → pink as it gets louder (more "musical")
    const hue = 185 - Math.min(energy * 70, 55);
    meter.style.background = `hsl(${hue}, 100%, 55%)`;
    meter.style.boxShadow = `0 0 5px hsl(${hue}, 100%, 55%)`;
  } else {
    meter.classList.add('hidden');
  }
}

/* ─────────────────────────────────────────────────
   8. VOICE COMMANDS
   ───────────────────────────────────────────────── */

let recognition = null;
let recognitionChatMode = false;
let voiceUnlockTimer = null;
let voiceInputLocked = false;
let voiceCommandCooldownUntil = 0;
let lastVoiceTranscript = '';
let lastVoiceTranscriptAt = 0;
const recentSpokenPhrases = [];

function applyRecognitionConfig() {
  if (!recognition) return;
  recognition.continuous = Boolean(AppState.settings.voiceAlwaysOn) && !recognitionChatMode;
  recognition.interimResults = false;
  recognition.lang = speechRecognitionLang();
}

function updateVoiceButtonState() {
  const label = document.getElementById('voice-label');
  if (!label || !UI.btnVoice) return;
  const on = Boolean(AppState.settings.voiceAlwaysOn);
  label.textContent = on ? t('controls.voiceOn') : t('controls.voice');
  UI.btnVoice.classList.toggle('always-on', on);
  if (!on && !AppState.isVoiceListening) {
    UI.btnVoice.classList.remove('listening');
  }
}

function clearVoiceUnlockTimer() {
  if (voiceUnlockTimer) {
    clearTimeout(voiceUnlockTimer);
    voiceUnlockTimer = null;
  }
}

function rememberSpokenPhrase(text) {
  const normalized = String(text || '').toLowerCase().replace(/[''´`]/g, '').replace(/[.!?,…]+/g, ' ').replace(/\s+/g, ' ').trim();
  if (!normalized) return;
  recentSpokenPhrases.push(normalized);
  if (recentSpokenPhrases.length > 10) recentSpokenPhrases.shift();
}

function abortVoiceRecognition() {
  if (!recognition) return;
  try {
    recognition.abort();
  } catch (_) {
    try { recognition.stop(); } catch (_) { /* already stopped */ }
  }
  AppState.isVoiceListening = false;
}

function lockVoiceInput() {
  voiceInputLocked = true;
  clearVoiceUnlockTimer();
  abortVoiceRecognition();
}

function isVoiceInputBlocked() {
  return voiceInputLocked || AppState.isSpeaking || AppState.chatInFlight;
}

function scheduleVoiceUnlock(delayMs = CONFIG.ui.voiceNoTtsUnlockMs) {
  if (!AppState.settings.voiceAlwaysOn || recognitionChatMode) {
    voiceInputLocked = false;
    return;
  }
  clearVoiceUnlockTimer();
  voiceCommandCooldownUntil = Date.now() + delayMs + CONFIG.ui.voiceCommandCooldownMs;
  voiceUnlockTimer = setTimeout(() => {
    if (AppState.isSpeaking || AppState.chatInFlight) {
      scheduleVoiceUnlock(CONFIG.ui.voicePostTtsUnlockMs);
      return;
    }
    voiceInputLocked = false;
    if (AppState.settings.voiceAlwaysOn && !AppState.isVoiceListening) {
      startVoiceRecognition(false, { silent: true });
    }
  }, delayMs);
}

function isDuplicateVoiceTranscript(transcript) {
  const now = Date.now();
  if (
    transcript === lastVoiceTranscript
    && now - lastVoiceTranscriptAt < CONFIG.ui.voiceTranscriptDedupeMs
  ) {
    return true;
  }
  lastVoiceTranscript = transcript;
  lastVoiceTranscriptAt = now;
  return false;
}

function setVoiceAlwaysOn(enabled, { persist = true, announce = true } = {}) {
  AppState.settings.voiceAlwaysOn = Boolean(enabled);
  if (UI.settingVoiceAlwaysOn) {
    UI.settingVoiceAlwaysOn.checked = AppState.settings.voiceAlwaysOn;
  }
  updateVoiceButtonState();
  applyRecognitionConfig();

  if (AppState.settings.voiceAlwaysOn) {
    startVoiceRecognition(false, { silent: !announce });
    if (announce) showToast(t('toast.voiceAlwaysOn'), 'info');
  } else {
    clearVoiceUnlockTimer();
    voiceInputLocked = false;
    voiceCommandCooldownUntil = 0;
    lastVoiceTranscript = '';
    lastVoiceTranscriptAt = 0;
    if (recognition && AppState.isVoiceListening) {
      abortVoiceRecognition();
    }
    if (announce) showToast(t('toast.voiceAlwaysOff'), 'info');
  }

  if (persist) persistSettings({ showSavedToast: false });
}

function toggleVoiceAlwaysOn() {
  setVoiceAlwaysOn(!AppState.settings.voiceAlwaysOn);
}

function initSpeechRecognition() {
  const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!SR) {
    console.warn('SpeechRecognition not supported');
    return;
  }
  recognition = new SR();
  recognition.maxAlternatives = 3;
  applyRecognitionConfig();

  recognition.onstart = () => {
    AppState.isVoiceListening = true;
    UI.btnVoice.classList.add('listening');
    if (AppState.settings.voiceAlwaysOn && !recognitionChatMode) {
      showVoiceFeedback(t('voice.alwaysOn'));
    } else {
      showVoiceFeedback(t('voice.listening'));
    }
  };

  recognition.onend = () => {
    AppState.isVoiceListening = false;
    if (recognitionChatMode) {
      recognitionChatMode = false;
      applyRecognitionConfig();
    }
    if (AppState.settings.voiceAlwaysOn) {
      updateVoiceButtonState();
      if (!voiceInputLocked && !AppState.isSpeaking && !AppState.chatInFlight) {
        scheduleVoiceUnlock(CONFIG.ui.voiceNoTtsUnlockMs);
      }
      return;
    }
    UI.btnVoice.classList.remove('listening');
    hideVoiceFeedback();
  };

  recognition.onerror = (e) => {
    AppState.isVoiceListening = false;
    if (e.error === 'not-allowed' || e.error === 'service-not-allowed') {
      setVoiceAlwaysOn(false, { persist: true, announce: false });
      showToast(t('toast.micDenied'), 'error');
      UI.btnVoice.classList.remove('listening');
      hideVoiceFeedback();
      return;
    }
    if (e.error === 'no-speech' && AppState.settings.voiceAlwaysOn) {
      if (!voiceInputLocked && !AppState.isSpeaking) {
        scheduleVoiceUnlock(CONFIG.ui.voiceNoTtsUnlockMs);
      }
      return;
    }
    if (AppState.settings.voiceAlwaysOn && e.error !== 'aborted') {
      if (!voiceInputLocked && !AppState.isSpeaking) {
        scheduleVoiceUnlock(800);
      }
      return;
    }
    UI.btnVoice.classList.remove('listening');
    hideVoiceFeedback();
    if (e.error !== 'no-speech' && e.error !== 'aborted') {
      showToast(t('toast.voiceError', { error: e.error }), 'error');
    }
  };

  recognition.onresult = (e) => {
    if (isVoiceInputBlocked()) return;
    if (Date.now() < voiceCommandCooldownUntil) return;

    const last = e.results[e.results.length - 1];
    if (!last?.isFinal) return;

    const transcript = last[0].transcript.trim().toLowerCase();
    if (!transcript) return;
    if (isLikelyVoiceEcho(transcript, recentSpokenPhrases)) return;
    if (isDuplicateVoiceTranscript(transcript)) return;

    lockVoiceInput();
    voiceCommandCooldownUntil = Date.now() + CONFIG.ui.voiceCommandCooldownMs;

    showVoiceFeedback('"' + transcript + '"');
    setTimeout(hideVoiceFeedback, CONFIG.ui.voiceFeedbackDuration);

    if (recognitionChatMode) {
      recognitionChatMode = false;
      applyRecognitionConfig();
      void sendChatMessage(transcript, { fromVoice: true });
      return;
    }

    const outcome = handleVoiceCommand(transcript);
    if (!outcome.spoke && !outcome.expectTts) {
      scheduleVoiceUnlock(CONFIG.ui.voiceNoTtsUnlockMs);
    }
  };
}

function startVoiceRecognition(chatMode = false, { silent = false } = {}) {
  if (!recognition) {
    if (!silent) showToast(t('toast.voiceUnsupported'), 'error');
    return;
  }
  recognitionChatMode = chatMode;
  applyRecognitionConfig();
  try {
    recognition.start();
  } catch (e) {
    if (!silent) console.warn('Recognition already running:', e);
    if (AppState.settings.voiceAlwaysOn && !chatMode && !voiceInputLocked) {
      scheduleVoiceUnlock(CONFIG.ui.voiceNoTtsUnlockMs);
    }
  }
}

/**
 * Parse and dispatch voice commands.
 */
function handleVoiceCommand(text) {
  const cmd = text.toLowerCase();
  const patterns = voicePatterns();
  const outcome = { spoke: false, expectTts: false };

  const say = (action) => {
    speak(voiceReply(action));
    outcome.spoke = true;
  };

  if (matchVoiceCommand(cmd, patterns.dance)) {
    setMode('dance'); say('dance');
  } else if (matchVoiceCommand(cmd, patterns.idle)) {
    setMode('idle'); say('idle');
  } else if (matchVoiceCommand(cmd, patterns.play)) {
    playAudio(); say('play');
  } else if (matchVoiceCommand(cmd, patterns.pause)) {
    pauseAudio(); say('pause');
  } else if (matchVoiceCommand(cmd, patterns.stop)) {
    stopAudio(); say('stop');
  } else if (matchVoiceCommand(cmd, patterns.nextTrack)) {
    outcome.expectTts = true;
    playNextTrack().then((ok) => {
      if (ok) speak(voiceReply('nextTrack'));
      else scheduleVoiceUnlock(CONFIG.ui.voiceNoTtsUnlockMs);
    });
  } else if (matchVoiceCommand(cmd, patterns.prevTrack)) {
    outcome.expectTts = true;
    playPrevTrack().then((ok) => {
      if (ok) speak(voiceReply('prevTrack'));
      else scheduleVoiceUnlock(CONFIG.ui.voiceNoTtsUnlockMs);
    });
  } else if (matchVoiceCommand(cmd, patterns.volumeUp)) {
    adjustVolume(0.1); say('volumeUp');
  } else if (matchVoiceCommand(cmd, patterns.volumeDown)) {
    adjustVolume(-0.1); say('volumeDown');
  } else if (matchVoiceCommand(cmd, patterns.mute)) {
    AppState.audioElement.volume = 0; AppState.settings.volume = 0; applySettings(); say('mute');
  } else if (matchVoiceCommand(cmd, patterns.unmute)) {
    AppState.settings.volume = 0.8; applySettings(); say('unmute');
  } else if (matchVoiceCommand(cmd, patterns.chat)) {
    openChatPanel(); say('chat');
    if (!AppState.settings.voiceAlwaysOn) {
      setTimeout(() => startVoiceRecognition(true), 1500);
    }
  } else if (matchVoiceCommand(cmd, patterns.settings)) {
    openSettings();
  } else if (matchVoiceCommand(cmd, patterns.mic)) {
    startEnvMic();
  } else if (matchVoiceCommand(cmd, patterns.close)) {
    closeChatPanel(); closeSettings();
  } else if (matchVoiceCommand(cmd, patterns.stopVoice)) {
    setVoiceAlwaysOn(false);
  } else if (matchVoiceCommand(cmd, patterns.spin)) {
    triggerSpin();
  } else if (matchVoiceCommand(cmd, patterns.flash)) {
    triggerFlash();
  } else if (matchVoiceCommand(cmd, patterns.shake)) {
    triggerShake();
  } else if (AppState.settings.apiKey) {
    outcome.expectTts = true;
    void sendChatMessage(text, { fromVoice: true });
  } else {
    showToast(t('toast.unknownCommand', { text }), 'info');
  }

  return outcome;
}

function adjustVolume(delta) {
  AppState.settings.volume = Math.max(0, Math.min(1, AppState.settings.volume + delta));
  applySettings();
}

/* ─────────────────────────────────────────────────
   9. AI CHAT (OpenAI-compatible)
   ───────────────────────────────────────────────── */

async function sendChatMessage(text, { fromVoice = false } = {}) {
  if (!text.trim()) return;
  if (AppState.chatInFlight) return;
  if (fromVoice && AppState.settings.voiceAlwaysOn) lockVoiceInput();

  const apiKey  = AppState.settings.apiKey;
  if (!apiKey) {
    showToast(t('toast.apiKeyRequired'), 'info');
    openSettings();
    return;
  }

  // Push user message to history and UI
  AppState.chatHistory.push({ role: 'user', content: text });
  addChatBubble('user', text);
  saveChatHistory();

  // Show typing indicator
  const typingId = addTypingIndicator();
  showChatBubbleOnCharacter('…');
  AppState.chatInFlight = true;

  const messages = [
    { role: 'system', content: AppState.settings.systemPrompt },
    ...AppState.chatHistory.slice(-CONFIG.ui.aiPromptTurns), // keep last N turns for context
  ];

  let spokeReply = false;
  try {
    const res = await fetch(AppState.settings.apiBase.replace(/\/$/, '') + '/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer ' + apiKey,
      },
      body: JSON.stringify({
        model: AppState.settings.model || 'gpt-4o-mini',
        messages,
        max_tokens: CONFIG.ui.aiMaxTokens,
        temperature: 0.8,
      }),
    });

    removeTypingIndicator(typingId);

    if (!res.ok) {
      const errData = await res.json().catch(() => ({}));
      throw new Error(errData.error?.message || 'API error ' + res.status);
    }

    const data = await res.json();
    const reply = data.choices?.[0]?.message?.content || t('voice.noResponse');

    AppState.chatHistory.push({ role: 'assistant', content: reply });
    addChatBubble('ai', reply);
    showChatBubbleOnCharacter(reply);
    speak(reply);
    spokeReply = true;
    saveChatHistory();
  } catch (err) {
    removeTypingIndicator(typingId);
    const errMsg = t('toast.aiError', { error: err.message });
    addChatBubble('ai', errMsg);
    showToast(errMsg, 'error');
    console.error(err);
  } finally {
    AppState.chatInFlight = false;
    if (fromVoice && AppState.settings.voiceAlwaysOn && !spokeReply && !AppState.isSpeaking) {
      scheduleVoiceUnlock(CONFIG.ui.voiceNoTtsUnlockMs);
    }
  }
}

function addChatBubble(role, text) {
  const container = UI.chatMessages;
  // Remove "no messages" placeholder if present
  const placeholder = container.querySelector('div.text-gray-500');
  if (placeholder) placeholder.remove();

  const el = document.createElement('div');
  el.className = 'chat-msg ' + role;
  el.innerHTML = `
    <div class="avatar">${role === 'user' ? '👤' : '🤖'}</div>
    <div class="bubble">${escapeHtml(text)}</div>
  `;
  container.appendChild(el);
  container.scrollTop = container.scrollHeight;
}

function addTypingIndicator() {
  const id = 'typing-' + Date.now();
  const el = document.createElement('div');
  el.className = 'chat-msg ai';
  el.id = id;
  el.innerHTML = `
    <div class="avatar">🤖</div>
    <div class="bubble flex gap-1 items-center">
      <span class="typing-dot"></span>
      <span class="typing-dot"></span>
      <span class="typing-dot"></span>
    </div>
  `;
  UI.chatMessages.appendChild(el);
  UI.chatMessages.scrollTop = UI.chatMessages.scrollHeight;
  return id;
}

function removeTypingIndicator(id) {
  const el = document.getElementById(id);
  if (el) el.remove();
}

function showChatBubbleOnCharacter(text) {
  const bubble = document.getElementById('chat-bubble');
  bubble.textContent = text.length > 80 ? text.slice(0, 77) + '…' : text;
  bubble.classList.remove('hidden');
  clearTimeout(bubble._timeout);
  bubble._timeout = setTimeout(() => bubble.classList.add('hidden'), 5000);
}

/* ─────────────────────────────────────────────────
   10. UI CONTROLS & EVENT WIRING
   ───────────────────────────────────────────────── */

// Cache DOM elements
const UI = {
  btnSettings:       document.getElementById('btn-settings'),
  btnCloseSettings:  document.getElementById('btn-close-settings'),
  settingsPanel:     document.getElementById('settings-panel'),
  settingsBackdrop:  document.getElementById('settings-backdrop'),
  btnSaveSettings:   document.getElementById('btn-save-settings'),

  settingApiKey:     document.getElementById('setting-api-key'),
  settingApiBase:    document.getElementById('setting-api-base'),
  settingModel:      document.getElementById('setting-model'),
  settingVolume:     document.getElementById('setting-volume'),
  settingSensitivity:document.getElementById('setting-sensitivity'),
  settingSpeed:      document.getElementById('setting-speed'),
  settingSystemPrompt: document.getElementById('setting-system-prompt'),
  settingRememberApiKey: document.getElementById('setting-remember-api-key'),
  settingLanguage:     document.getElementById('setting-language'),
  settingVoiceAlwaysOn: document.getElementById('setting-voice-always-on'),
  settingTtsEngine:    document.getElementById('setting-tts-engine'),
  settingTtsVoice:     document.getElementById('setting-tts-voice'),
  settingTtsSpeed:     document.getElementById('setting-tts-speed'),
  ttsSpeedDisplay:     document.getElementById('tts-speed-display'),

  volDisplay:        document.getElementById('vol-display'),
  sensDisplay:       document.getElementById('sens-display'),
  speedDisplay:      document.getElementById('speed-display'),

  btnPlayPause:      document.getElementById('btn-play-pause'),
  btnStop:           document.getElementById('btn-stop'),
  btnLoadFile:       document.getElementById('btn-load-file'),
  audioFileInput:    document.getElementById('audio-file-input'),
  urlInput:          document.getElementById('url-input'),
  btnLoadURL:        document.getElementById('btn-load-url'),
  volumeSlider:      document.getElementById('volume-slider'),
  trackInfo:         document.getElementById('track-info'),
  btnPlaylistPrev:   document.getElementById('btn-playlist-prev'),
  btnPlaylistNext:   document.getElementById('btn-playlist-next'),
  btnPlaylistToggle: document.getElementById('btn-playlist-toggle'),
  btnPlaylistAdd:    document.getElementById('btn-playlist-add'),
  btnPlaylistClear:  document.getElementById('btn-playlist-clear'),
  playlistPanel:     document.getElementById('playlist-panel'),
  playlistList:      document.getElementById('playlist-list'),
  playlistCount:     document.getElementById('playlist-count'),
  iconPlay:          document.getElementById('icon-play'),
  iconPause:         document.getElementById('icon-pause'),

  btnMic:            document.getElementById('btn-mic'),
  micLabel:          document.getElementById('mic-label'),
  micLevelMeter:     document.getElementById('mic-level-meter'),
  btnVoice:          document.getElementById('btn-voice'),
  btnModeToggle:     document.getElementById('btn-mode-toggle'),
  modeToggleLabel:   document.getElementById('mode-toggle-label'),
  btnChat:           document.getElementById('btn-chat'),

  modeBadge:         document.getElementById('mode-badge'),
  modeLabel:         document.getElementById('mode-label'),
  modeDot:           document.getElementById('mode-dot'),

  fileInput:         document.getElementById('file-input'),
  btnReupload:       document.getElementById('btn-reupload'),
  btnExportPreset:   document.getElementById('btn-export-preset'),
  btnImportPreset:   document.getElementById('btn-import-preset'),
  presetFileInput:   document.getElementById('preset-file-input'),

  chatPanel:         document.getElementById('chat-panel'),
  chatBackdrop:      document.getElementById('chat-backdrop'),
  btnCloseChat:      document.getElementById('btn-close-chat'),
  btnClearChat:      document.getElementById('btn-clear-chat'),
  chatMessages:      document.getElementById('chat-messages'),
  chatInput:         document.getElementById('chat-input'),
  btnSendChat:       document.getElementById('btn-send-chat'),
  btnVoiceChat:      document.getElementById('btn-voice-chat'),

  toastContainer:    document.getElementById('toast-container'),
  voiceFeedback:     document.getElementById('voice-feedback'),
  glowRingOuter:     document.getElementById('glow-ring-outer'),
  glowRingInner:     document.getElementById('glow-ring-inner'),
  visualizer:        document.getElementById('visualizer'),
  uploadOverlay:     document.getElementById('upload-overlay'),
  uploadHint:        document.getElementById('upload-hint'),

  permOverlay:       document.getElementById('perm-overlay'),
  permAllow:         document.getElementById('perm-allow'),
  permDeny:          document.getElementById('perm-deny'),
};

function wireEvents() {
  // ── Settings ──
  UI.btnSettings.addEventListener('click', openSettings);
  UI.btnCloseSettings.addEventListener('click', closeSettings);
  UI.settingsBackdrop.addEventListener('click', closeSettings);
  UI.btnSaveSettings.addEventListener('click', () => {
    AppState.settings.apiKey     = UI.settingApiKey.value.trim();
    AppState.settings.apiBase    = UI.settingApiBase.value.trim() || 'https://api.openai.com/v1';
    AppState.settings.model      = UI.settingModel.value.trim()   || 'gpt-4o-mini';
    AppState.settings.volume     = parseFloat(UI.settingVolume.value);
    AppState.settings.sensitivity= parseFloat(UI.settingSensitivity.value);
    AppState.settings.animSpeed  = parseFloat(UI.settingSpeed.value);
    AppState.settings.systemPrompt = UI.settingSystemPrompt.value;
    AppState.settings.ttsEngine = UI.settingTtsEngine?.value || 'auto';
    AppState.settings.ttsVoice = UI.settingTtsVoice?.value || DEFAULT_TTS_VOICE;
    AppState.settings.ttsSpeed = parseFloat(UI.settingTtsSpeed?.value) || DEFAULT_TTS_SPEED;
    if (UI.settingVoiceAlwaysOn) {
      AppState.settings.voiceAlwaysOn = UI.settingVoiceAlwaysOn.checked;
    }
    if (UI.settingLanguage) {
      AppState.settings.locale = UI.settingLanguage.value;
      changeLocale(AppState.settings.locale);
    }
    if (UI.settingRememberApiKey) {
      AppState.settings.rememberApiKey = UI.settingRememberApiKey.checked;
    }
    saveSettings();
    closeSettings();
  });

  // Live sliders
  UI.settingVolume.addEventListener('input', () => {
    UI.volDisplay.textContent = Math.round(UI.settingVolume.value * 100) + '%';
    AppState.audioElement.volume = parseFloat(UI.settingVolume.value);
  });
  UI.settingSensitivity.addEventListener('input', () => {
    const sens = parseFloat(UI.settingSensitivity.value);
    UI.sensDisplay.textContent = Math.round(sens * 100) + '%';
    AppState.settings.sensitivity = sens;
    AppState.beatThreshold = beatThresholdFromSensitivity(sens, CONFIG.beat);
  });
  UI.settingSpeed.addEventListener('input', () => {
    UI.speedDisplay.textContent = parseFloat(UI.settingSpeed.value).toFixed(1) + 'x';
  });
  UI.settingTtsSpeed?.addEventListener('input', () => {
    if (UI.ttsSpeedDisplay) {
      UI.ttsSpeedDisplay.textContent = parseFloat(UI.settingTtsSpeed.value).toFixed(2) + 'x';
    }
  });

  UI.settingLanguage?.addEventListener('change', () => {
    AppState.settings.locale = UI.settingLanguage.value;
    changeLocale(UI.settingLanguage.value);
    persistSettings({ showSavedToast: false });
  });

  // Theme swatches
  document.querySelectorAll('.theme-swatch').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.theme-swatch').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      AppState.settings.theme = btn.dataset.theme;
      setAccentTheme(btn.dataset.theme, true);
    });
  });

  // ── Audio Player ──
  UI.btnPlayPause.addEventListener('click', () => {
    initAudioContext();
    if (AppState.isPlaying) pauseAudio(); else playAudio();
  });
  UI.btnStop.addEventListener('click', stopAudio);
  UI.btnLoadFile.addEventListener('click', () => UI.audioFileInput.click());
  UI.audioFileInput.addEventListener('change', (e) => {
    if (e.target.files[0]) loadAudioFile(e.target.files[0]);
    e.target.value = '';
  });
  UI.btnLoadURL.addEventListener('click', () => loadAudioURL(UI.urlInput.value.trim()));
  UI.urlInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') loadAudioURL(UI.urlInput.value.trim());
  });
  UI.volumeSlider.addEventListener('input', () => {
    AppState.settings.volume = parseFloat(UI.volumeSlider.value);
    AppState.audioElement.volume = AppState.settings.volume;
    UI.settingVolume.value = AppState.settings.volume;
    UI.volDisplay.textContent = Math.round(AppState.settings.volume * 100) + '%';
  });

  UI.btnPlaylistAdd?.addEventListener('click', () => {
    addCurrentOrUrlToPlaylist().catch((e) => console.warn('Add to playlist failed:', e));
  });
  UI.btnPlaylistPrev?.addEventListener('click', () => {
    playPrevTrack().catch((e) => console.warn('Previous track failed:', e));
  });
  UI.btnPlaylistNext?.addEventListener('click', () => {
    playNextTrack().catch((e) => console.warn('Next track failed:', e));
  });
  UI.btnPlaylistToggle?.addEventListener('click', togglePlaylistPanel);
  UI.btnPlaylistClear?.addEventListener('click', () => {
    clearPlaylist().catch((e) => console.warn('Clear playlist failed:', e));
  });
  UI.playlistList?.addEventListener('click', (e) => {
    const removeBtn = e.target.closest('.playlist-item-remove');
    if (removeBtn) {
      e.stopPropagation();
      const li = removeBtn.closest('.playlist-item');
      const index = Number(li?.dataset.index);
      if (!Number.isNaN(index)) {
        removePlaylistItemAt(index).catch((err) => console.warn('Remove track failed:', err));
      }
      return;
    }
    const li = e.target.closest('.playlist-item');
    if (!li || li.classList.contains('playlist-empty')) return;
    const index = Number(li.dataset.index);
    if (!Number.isNaN(index)) {
      playPlaylistIndex(index, { autoplay: true, silent: true })
        .catch((err) => console.warn('Play playlist item failed:', err));
    }
  });
  UI.urlInput?.addEventListener('change', () => schedulePersistSession());

  // ── Character Upload ──
  UI.fileInput.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (file) {
      const isMp4 = file.type === 'video/mp4' || file.name.toLowerCase().endsWith('.mp4');
      const isImage = file.type.startsWith('image/');
      const isGif = file.type === 'image/gif' || file.name.toLowerCase().endsWith('.gif');

      if (!isImage && !isMp4) {
        showToast(t('toast.unsupportedFormat'), 'error');
        e.target.value = '';
        return;
      }

      if (file.size > CONFIG.character.maxUploadBytes) {
        showToast(t('toast.fileTooLarge'), 'error');
        e.target.value = '';
        return;
      }

      // Store temporary flag so loadCharacterImage can show the right message
      AppState._pendingCharacterUploadType = isGif ? 'gif' : (isMp4 ? 'mp4' : null);
      loadCharacterImage(file, { isVideo: isMp4 });
    }
    e.target.value = '';
  });
  UI.btnReupload.addEventListener('click', () => {
    closeSettings();
    UI.fileInput.click();
  });

  // Export / Import preset
  UI.btnExportPreset?.addEventListener('click', () => {
    exportCharacterAndSettings();
  });
  UI.btnImportPreset?.addEventListener('click', () => {
    UI.presetFileInput?.click();
  });
  UI.presetFileInput?.addEventListener('change', (e) => {
    if (e.target.files[0]) {
      importCharacterAndSettings(e.target.files[0]);
    }
    e.target.value = '';
  });

  charCanvas.addEventListener('click', () => {
    if (!AppState.characterImage) UI.fileInput.click();
    else triggerFlash();
  });

  // ── Mode Toggle ──
  UI.btnModeToggle.addEventListener('click', () => {
    if (AppState.mode === 'dance' || AppState.mode === 'music') {
      setMode('idle');
    } else {
      setMode('dance');
    }
  });

  // ── Mic ──
  UI.btnMic.addEventListener('click', () => {
    initAudioContext();
    toggleEnvMic();
  });

  // ── Voice ──
  UI.btnVoice.addEventListener('click', () => toggleVoiceAlwaysOn());
  UI.settingVoiceAlwaysOn?.addEventListener('change', () => {
    setVoiceAlwaysOn(UI.settingVoiceAlwaysOn.checked, { persist: true, announce: true });
  });

  // ── Chat ──
  UI.btnChat.addEventListener('click', openChatPanel);
  UI.btnCloseChat.addEventListener('click', closeChatPanel);
  UI.chatBackdrop?.addEventListener('click', closeChatPanel);
  UI.btnClearChat?.addEventListener('click', clearChatHistory);
  UI.btnSendChat.addEventListener('click', () => {
    const text = UI.chatInput.value.trim();
    if (text) {
      sendChatMessage(text);
      UI.chatInput.value = '';
    }
  });
  UI.chatInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      const text = UI.chatInput.value.trim();
      if (text) { sendChatMessage(text); UI.chatInput.value = ''; }
    }
  });
  UI.btnVoiceChat.addEventListener('click', () => {
    openChatPanel();
    startVoiceRecognition(true);
  });

  // ── Permission overlay ──
  UI.permAllow.addEventListener('click', () => {
    closePermissionOverlay();
    startEnvMic();
  });
  UI.permDeny.addEventListener('click', closePermissionOverlay);

  // ── Keyboard shortcuts ──
  document.addEventListener('keydown', (e) => {
    if (document.activeElement.tagName === 'INPUT' ||
        document.activeElement.tagName === 'TEXTAREA') return;
    switch (e.code) {
      case 'Space':      e.preventDefault(); if (AppState.isPlaying) pauseAudio(); else playAudio(); break;
      case 'KeyD':       setMode(AppState.mode === 'dance' ? 'idle' : 'dance'); break;
      case 'KeyV':       toggleVoiceAlwaysOn(); break;
      case 'KeyC':       openChatPanel(); break;
      case 'KeyM':       toggleEnvMic(); break;
      case 'KeyS':       openSettings(); break;
      case 'Escape':     closeSettings(); closeChatPanel(); break;
    }
  });
}

function openSettings() {
  UI.settingsPanel.classList.remove('hidden');
  UI.settingsPanel.classList.add('flex');
}

function closeSettings() {
  UI.settingsPanel.classList.add('hidden');
  UI.settingsPanel.classList.remove('flex');
}

function openChatPanel() {
  UI.chatPanel.classList.remove('hidden');
  UI.chatPanel.classList.add('flex');
  UI.chatInput.focus();
  setMode('chat');
}

function closeChatPanel() {
  UI.chatPanel.classList.add('hidden');
  UI.chatPanel.classList.remove('flex');
  if (!AppState.isPlaying) setMode('idle');
}

function showPermissionOverlay(type) {
  if (type === 'microphone') {
    document.getElementById('perm-icon').textContent = '🎤';
    applyTranslations();
  }
  UI.permOverlay.classList.remove('hidden');
  UI.permOverlay.classList.add('flex');
}

function closePermissionOverlay() {
  UI.permOverlay.classList.add('hidden');
  UI.permOverlay.classList.remove('flex');
}

/* ─────────────────────────────────────────────────
   11. ANIMATION LOOP
   ───────────────────────────────────────────────── */

let lastFrame = 0;

function animationLoop(timestamp) {
  AppState.animFrame = requestAnimationFrame(animationLoop);

  const delta = Math.min((timestamp - lastFrame) / 1000, CONFIG.ui.animationDeltaCap); // seconds, capped
  lastFrame = timestamp;

  // 1) Check env mic first (may set envMusicDetected + beatEnergy)
  if (AppState.isMicListening) checkEnvMic();

  // 2) Compute audio energy — player OR mic, never the wrong analyser
  let energy = 0;
  if (AppState.isPlaying) {
    energy = computeAudioEnergy();
  } else if (AppState.isMicListening && AppState.envMusicDetected) {
    energy = computeMicEnergy();
    AppState.beatEnergy = energy;
    AppState.onset = 0;
  } else if (AppState.envMusicDetected) {
    energy = AppState.beatEnergy;
  }

  // 3) Update character animation targets
  updateCharacterAnimation(energy, delta);

  // 4) Draw character
  drawCharacter();

  // 5) Update visualizer (player only — mic has no bar graph)
  if (AppState.isPlaying) {
    updateVisualizer();
  } else {
    // Fade bars to zero
    AppState.vizBars.forEach(b => { b.style.height = '2px'; });
  }

  // 6) Update glow rings
  updateGlowRings(energy);

  // 7) Particle background
  if (!AppState.reducedMotion) {
    updateParticles(energy);
  }
}

/**
 * Set character animation targets based on current mode and audio energy.
 */
function updateCharacterAnimation(energy, delta) {
  const a   = AppState.anim;
  const spd = AppState.settings.animSpeed;
  const t   = Date.now() / 1000;

  // Reset shake
  a.shakeX = 0;
  a.shakeY = 0;

  switch (AppState.mode) {
    case 'idle': {
      // Gentle breathing: scale oscillation
      a.breathPhase += delta * CONFIG.animation.idle.breathSpeed * spd;
      const breathScale = 1 + Math.sin(a.breathPhase) * CONFIG.animation.idle.breathAmount;
      a.targetScale = breathScale;
      a.targetRotation = 0;
      a.targetX = 0;
      a.targetY = Math.sin(a.breathPhase * 0.5) * CONFIG.animation.idle.floatAmount;

      // Blinking
      a.blinkTimer += delta;
      if (a.blinkTimer > CONFIG.animation.idle.blinkMin + Math.random() * CONFIG.animation.idle.blinkRandom) {
        a.blinkTimer = 0;
        triggerBlink();
      }
      break;
    }

    case 'dance': {
      // Energetic bouncing
      a.bouncePhase += delta * CONFIG.animation.dance.bounceSpeed * spd;
      a.swayPhase   += delta * CONFIG.animation.dance.swaySpeed * spd;
      a.targetScale = 1 + Math.abs(Math.sin(a.bouncePhase)) * CONFIG.animation.dance.scaleAmount;
      a.targetY     = -Math.abs(Math.sin(a.bouncePhase)) * CONFIG.animation.dance.yAmount;
      a.targetX     = Math.sin(a.swayPhase) * CONFIG.animation.dance.xAmount;
      a.targetRotation = Math.sin(a.swayPhase * 0.7) * CONFIG.animation.dance.rotAmount;
      break;
    }

    case 'music': {
      // Beat-reactive
      a.bouncePhase += delta * (CONFIG.animation.music.bounceBase + energy * CONFIG.animation.music.bounceEnergy) * spd;
      a.swayPhase   += delta * (CONFIG.animation.music.swayBase + energy * CONFIG.animation.music.swayEnergy) * spd;

      // Use BOTH sustained energy AND spectral flux onset for tight, musical reaction
      const strongBeat = (energy > AppState.beatThreshold) || (AppState.onset > CONFIG.beat.onsetTrigger);

      if (strongBeat) {
        // On real percussive hits (onset) we get snappier pops even if RMS energy is moderate
        const pop = Math.max(energy, AppState.onset * 0.9);
        a.targetScale = 1 + pop * CONFIG.animation.music.beatScale;
        a.targetY     = -pop * CONFIG.animation.music.beatY;
        a.flashAlpha  = Math.max(a.flashAlpha, pop);
        a.flashColor  = getAccentColor();
      } else {
        a.targetScale = 1 + Math.abs(Math.sin(a.bouncePhase)) * CONFIG.animation.music.idleScale;
        a.targetY     = -Math.abs(Math.sin(a.bouncePhase)) * CONFIG.animation.music.idleY;
      }

      a.targetX     = Math.sin(a.swayPhase) * (CONFIG.animation.music.xBase + energy * CONFIG.animation.music.xEnergy);
      a.targetRotation = Math.sin(a.swayPhase * 0.8) * (CONFIG.animation.music.rotBase + energy * CONFIG.animation.music.rotEnergy);

      // Shake on strong energy OR strong onset (much more responsive to drums)
      const doShake = (energy > CONFIG.animation.music.shakeThreshold) || (AppState.onset > 0.65);
      if (doShake) {
        const shakeMag = Math.max(energy, AppState.onset) * CONFIG.animation.music.shakeAmount;
        a.shakeX = (Math.random() - 0.5) * shakeMag;
        a.shakeY = (Math.random() - 0.5) * shakeMag * 0.7;
      }
      break;
    }

    case 'chat': {
      // Subtle "talking" bob
      a.breathPhase += delta * 1.5 * spd;
      a.targetScale = 1 + Math.sin(a.breathPhase * 2) * 0.015;
      a.targetY     = Math.sin(a.breathPhase) * 5;
      a.targetX     = 0;
      a.targetRotation = Math.sin(a.breathPhase * 0.5) * 1;
      break;
    }
  }

  // Speaking overlay — extra head nods + phase advance while TTS is active
  // This makes the character feel alive during both voice commands and AI chat replies
  if (AppState.isSpeaking) {
    a.speakingPhase += delta * 15 * spd;           // mouth cycle speed
    const talkBob = Math.sin(a.speakingPhase * 1.55) * 3.2;
    a.targetY += talkBob;                          // rhythmic nodding
    a.breathPhase += delta * 1.8;                  // slightly faster breathing
  }
}

function updateGlowRings(energy) {
  const size = Math.min(window.innerWidth, window.innerHeight);
  const base = size * CONFIG.glow.outerBase;
  const outer = base + energy * base * CONFIG.glow.outerEnergy;
  const inner = base * CONFIG.glow.innerBase + energy * base * CONFIG.glow.innerEnergy;

  UI.glowRingOuter.style.width  = outer + 'px';
  UI.glowRingOuter.style.height = outer + 'px';
  UI.glowRingInner.style.width  = inner + 'px';
  UI.glowRingInner.style.height = inner + 'px';

  const accent = getAccentColor();
  const glowSize = CONFIG.glow.sizeBase + energy * CONFIG.glow.sizeEnergy;
  UI.glowRingOuter.style.boxShadow =
    `0 0 ${glowSize}px rgba(${hexToRgb(accent)}, ${CONFIG.glow.alphaBase + energy * CONFIG.glow.alphaEnergy}),
     inset 0 0 ${glowSize * 0.5}px rgba(${hexToRgb(accent)}, ${0.1 + energy * 0.2})`;
  UI.glowRingOuter.style.borderColor = `rgba(${hexToRgb(accent)}, ${0.3 + energy * CONFIG.glow.alphaEnergy})`;
}

/* ─────────────────────────────────────────────────
   12. UTILITY HELPERS
   ───────────────────────────────────────────────── */

function setMode(mode) {
  AppState.mode = mode;
  UI.modeBadge.dataset.mode = mode;
  UI.modeLabel.textContent = modeLabel(mode);

  // Update toggle button
  const isDancing = mode === 'dance' || mode === 'music';
  UI.modeToggleLabel.textContent = isDancing ? t('controls.idle') : t('controls.dance');
}

let activeTtsAudio = null;
let activeTtsObjectUrl = null;
let speakGeneration = 0;

function stopSpeaking() {
  speakGeneration += 1;
  if (window.speechSynthesis) window.speechSynthesis.cancel();
  if (activeTtsAudio) {
    activeTtsAudio.pause();
    activeTtsAudio.src = '';
    activeTtsAudio = null;
  }
  if (activeTtsObjectUrl) {
    URL.revokeObjectURL(activeTtsObjectUrl);
    activeTtsObjectUrl = null;
  }
  restoreMusicDuck();
  AppState.isSpeaking = false;
  AppState.anim.speakingPhase = 0;
}

let musicDuckVolume = null;

function duckMusicWhileSpeaking() {
  if (!AppState.isPlaying || musicDuckVolume !== null) return;
  musicDuckVolume = AppState.audioElement.volume;
  AppState.audioElement.volume = Math.max(0.08, musicDuckVolume * 0.35);
}

function restoreMusicDuck() {
  if (musicDuckVolume === null) return;
  AppState.audioElement.volume = musicDuckVolume;
  musicDuckVolume = null;
}

function beginSpeakingAnimation() {
  AppState.isSpeaking = true;
  AppState.anim.speakingPhase = 0;
  duckMusicWhileSpeaking();
}

function endSpeakingAnimation() {
  AppState.isSpeaking = false;
  AppState.anim.speakingPhase = 0;
  restoreMusicDuck();
  if (AppState.settings.voiceAlwaysOn) {
    scheduleVoiceUnlock(CONFIG.ui.voicePostTtsUnlockMs);
  } else {
    voiceInputLocked = false;
  }
}

function speak(text) {
  const trimmed = truncateForTts(text);
  if (!trimmed) return;
  rememberSpokenPhrase(trimmed);
  if (AppState.settings.voiceAlwaysOn) lockVoiceInput();
  stopSpeaking();
  const gen = speakGeneration;
  void speakInternal(trimmed, gen);
}

async function speakInternal(text, gen) {
  const engine = resolveTtsEngine(AppState.settings.ttsEngine, getLocale());
  beginSpeakingAnimation();

  if (engine === 'kokoro') {
    const played = await playKokoroSpeech(text, gen);
    if (played || gen !== speakGeneration) return;
  }

  if (gen === speakGeneration) {
    playBrowserSpeech(text, gen);
  }
}

async function playKokoroSpeech(text, gen) {
  try {
    const blob = await synthesizeKokoro(text, {
      voice: AppState.settings.ttsVoice || DEFAULT_TTS_VOICE,
      speed: AppState.settings.ttsSpeed ?? DEFAULT_TTS_SPEED,
    });
    if (!blob || gen !== speakGeneration) return false;
    if (blob.type && !blob.type.startsWith('audio/')) return false;

    const url = URL.createObjectURL(blob);
    activeTtsObjectUrl = url;
    const audio = new Audio(url);
    activeTtsAudio = audio;
    audio.volume = Math.min(1, (AppState.settings.volume ?? 0.8) + 0.1);

    return await new Promise((resolve) => {
      const finish = (ok) => {
        if (gen !== speakGeneration) {
          resolve(false);
          return;
        }
        if (activeTtsObjectUrl === url) {
          URL.revokeObjectURL(url);
          activeTtsObjectUrl = null;
        }
        if (activeTtsAudio === audio) activeTtsAudio = null;
        endSpeakingAnimation();
        resolve(ok);
      };
      audio.onended = () => finish(true);
      audio.onerror = () => finish(false);
      audio.play().catch(() => finish(false));
    });
  } catch {
    if (gen === speakGeneration) endSpeakingAnimation();
    return false;
  }
}

function playBrowserSpeech(text, gen) {
  if (!window.speechSynthesis) {
    endSpeakingAnimation();
    return;
  }

  window.speechSynthesis.cancel();
  beginSpeakingAnimation();

  const utt = new SpeechSynthesisUtterance(text);
  utt.rate = 1.05;
  utt.pitch = 1.1;
  utt.volume = 0.9;
  utt.lang = speechSynthesisLang();

  const voices = window.speechSynthesis.getVoices();
  const langPrefix = getLocale() === 'de' ? 'de' : 'en';
  const preferred = voices.find(v => v.lang.startsWith(langPrefix))
    || voices.find(v => v.name.includes('Google') && v.lang.startsWith(langPrefix));
  if (preferred) utt.voice = preferred;

  const finish = () => {
    if (gen !== speakGeneration) return;
    endSpeakingAnimation();
  };
  utt.onend = finish;
  utt.onerror = finish;

  window.speechSynthesis.speak(utt);
}

function showToast(message, type = 'info') {
  const el = document.createElement('div');
  el.className = 'toast ' + type;
  el.textContent = message;
  UI.toastContainer.appendChild(el);
  setTimeout(() => {
    el.style.animation = 'toast-out 0.3s ease-in forwards';
    setTimeout(() => el.remove(), 350);
  }, 3000);
}

function showVoiceFeedback(text) {
  UI.voiceFeedback.textContent = text;
  UI.voiceFeedback.classList.remove('hidden');
}

function hideVoiceFeedback() {
  UI.voiceFeedback.classList.add('hidden');
}

function triggerFlash() {
  AppState.anim.flashAlpha = 0.8;
  AppState.anim.flashColor = getAccentColor();
}

function triggerSpin() {
  AppState.anim.targetRotation = AppState.anim.rotation + 360;
  setTimeout(() => { AppState.anim.targetRotation = 0; AppState.anim.rotation = 0; }, 700);
}

function triggerShake() {
  let count = 0;
  const id = setInterval(() => {
    AppState.anim.shakeX = (Math.random() - 0.5) * 14;
    AppState.anim.shakeY = (Math.random() - 0.5) * 8;
    if (++count > 10) { clearInterval(id); AppState.anim.shakeX = 0; AppState.anim.shakeY = 0; }
  }, 60);
}

function triggerBlink() {
  AppState.anim.blinkOpen = 0;
  setTimeout(() => { AppState.anim.blinkOpen = 0.2; }, 80);
  setTimeout(() => { AppState.anim.blinkOpen = 1; },   160);
}

function getAccentColor() {
  return AppState.cachedAccentColor || '#00f5ff';
}

function setAccentTheme(theme, save = false) {
  const themes = {
    neon:   '#00f5ff',
    pink:   '#ff2d78',
    purple: '#a855f7',
    green:  '#39ff14',
    yellow: '#ffd700',
  };
  const color = themes[theme] || themes.neon;
  AppState.cachedAccentColor = color;
  document.documentElement.style.setProperty('--accent', color);
  document.documentElement.style.setProperty('--accent-rgb', hexToRgb(color));
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.content = '#0a0a0f';
  if (save) {
    AppState.settings.theme = theme;
    persistSettings({ showSavedToast: false });
  }
}

function hexToRgb(hex) {
  hex = hex.replace('#', '');
  if (hex.length === 3) hex = hex.split('').map(c => c + c).join('');
  const num = parseInt(hex, 16);
  return `${(num >> 16) & 255}, ${(num >> 8) & 255}, ${num & 255}`;
}

function initVisualizerBars() {
  UI.visualizer.innerHTML = '';
  AppState.vizBars = [];
  const barCount = Math.floor(window.innerWidth / 8);
  for (let i = 0; i < barCount; i++) {
    const bar = document.createElement('div');
    bar.className = 'viz-bar';
    UI.visualizer.appendChild(bar);
    AppState.vizBars.push(bar);
  }
}

/* ─────────────────────────────────────────────────
   13. PWA & INITIALIZATION
   ───────────────────────────────────────────────── */

async function registerServiceWorker() {
  if (!('serviceWorker' in navigator) || !window.isSecureContext) return;

  const swUrl = `sw.js?v=${APP_VERSION}`;
  try {
    const probe = await fetch(swUrl, { method: 'GET', cache: 'no-store' });
    if (!probe.ok) return;
    await navigator.serviceWorker.register(swUrl);
  } catch {
    // Self-signed HTTPS breaks SW — http://localhost:8088 works without TLS
    if (location.protocol === 'https:' && location.hostname === 'localhost') {
      console.info('SW skipped (untrusted cert). Use http://localhost:8088 for full PWA support.');
    }
  }
}

function handleResize() {
  resizeParticleCanvas();
  resizeCharCanvas();
  initVisualizerBars();
}

function init() {
  AppState.reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  window.matchMedia('(prefers-reduced-motion: reduce)').addEventListener('change', (e) => {
    AppState.reducedMotion = e.matches;
  });

  // Load saved settings
  loadSettings();
  applyTranslations();

  // Load persisted chat history (after settings + DOM)
  loadChatHistory();

  // Resize and set up canvases
  resizeParticleCanvas();
  resizeCharCanvas();

  // Init particles
  initParticles();

  // Init visualizer bars
  initVisualizerBars();

  // Set up audio player events
  setupAudioPlayer();

  // Wire all UI events
  wireEvents();

  renderPlaylist();
  migrateLegacyStorage()
    .then(() => restorePersistedSession())
    .catch((e) => console.warn('Restore session failed:', e));

  // Set up speech recognition
  initSpeechRecognition();
  if (AppState.settings.voiceAlwaysOn) {
    setVoiceAlwaysOn(true, { persist: false, announce: false });
  }

  // Start animation loop
  animationLoop(0);

  // Set initial mode
  setMode('idle');

  // Load voices async
  window.speechSynthesis?.getVoices();
  window.speechSynthesis?.addEventListener('voiceschanged', () => {
    window.speechSynthesis.getVoices();
  });

  // Handle resize
  window.addEventListener('resize', debounce(handleResize, CONFIG.ui.resizeDebounce));

  // Register SW
  registerServiceWorker();

  // Welcome message
  setTimeout(() => showToast(t('toast.welcome'), 'info'), 800);

  if (location.protocol === 'https:' && location.port === '8443' && location.hostname === 'localhost') {
    setTimeout(() => showToast(t('toast.useHttpLocalhost'), 'info'), 2200);
  }
}

function debounce(fn, delay) {
  let id;
  return (...args) => {
    clearTimeout(id);
    id = setTimeout(() => fn(...args), delay);
  };
}

// Boot
document.addEventListener('DOMContentLoaded', init);
