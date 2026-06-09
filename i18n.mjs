/** UI strings + voice patterns (en/de). Browser + node tests. */

export const LOCALES = ['en', 'de'];

export const LOCALE_LABELS = {
  en: 'English',
  de: 'Deutsch',
};

const STRINGS = {
  en: {
    meta: {
      description: 'Soul-AI — Your AI Live Speaker companion that dances to music, listens to your voice, and reacts in real time.',
      title: 'Soul-AI — AI Live Speaker',
    },
    header: {
      tagline: 'AI LIVE SPEAKER',
    },
    modes: {
      idle: 'IDLE',
      dance: 'DANCE',
      music: 'MUSIC',
      chat: 'CHAT',
    },
    upload: {
      canvasTitle: 'Click to upload your character image or MP4 (GIFs use first frame)',
      hintHtml: 'Tap to upload your<br/>character image',
      formats: 'PNG · JPG · WEBP · GIF (first frame) · MP4 (loop)',
    },
    player: {
      noTrack: 'No track loaded',
      urlPlaceholder: 'Paste audio URL here…',
      load: 'Load',
      playlist: 'Playlist',
      addToPlaylist: 'Add to playlist',
      clearPlaylist: 'Clear playlist',
      playlistEmpty: 'No tracks yet — load audio or paste a URL, then tap +',
      removeTrack: 'Remove',
      prevTrack: 'Previous track',
      nextTrack: 'Next track',
      togglePlaylist: 'Show playlist',
    },
    controls: {
      mic: 'MIC',
      micOn: 'MIC ON',
      voice: 'VOICE',
      voiceOn: 'VOICE ON',
      dance: 'DANCE',
      idle: 'IDLE',
      chat: 'CHAT',
    },
    settings: {
      title: 'SETTINGS',
      language: 'Language',
      apiKey: 'OpenAI-Compatible API Key',
      apiKeyPlaceholder: 'sk-… or grok API key',
      rememberApiKey: 'Remember API key in this browser',
      rememberApiKeyHint: 'Uncheck for session-only storage. Never share presets with keys inside.',
      apiBase: 'API Base URL',
      apiBasePlaceholder: 'https://api.openai.com/v1',
      model: 'Model',
      modelPlaceholder: 'gpt-4o-mini',
      volume: 'Master Volume',
      sensitivity: 'Beat Sensitivity',
      theme: 'Accent Theme',
      animSpeed: 'Animation Speed',
      character: 'Character Image',
      reupload: 'Upload New Character',
      exportPreset: 'Export Preset',
      importPreset: 'Import Preset',
      presetHint: 'Exports your character + settings (no API key). Shareable .json file.',
      systemPrompt: 'AI System Prompt',
      systemPromptPlaceholder: 'You are Soul-AI, a friendly AI music companion…',
      ttsEngine: 'Voice Engine',
      ttsEngineAuto: 'Auto (Kokoro EN / Browser DE)',
      ttsEngineKokoro: 'Kokoro (Bella — bancamp TTS)',
      ttsEngineBrowser: 'Browser only',
      ttsVoice: 'Kokoro Voice',
      ttsSpeed: 'Speech Speed',
      voiceAlwaysOn: 'Always-on voice commands',
      voiceAlwaysOnHint: 'VOICE button toggles — no need to press before every command.',
      save: 'SAVE SETTINGS',
      savedLocally: 'Settings saved locally in your browser',
      themeNeon: 'Neon Cyan',
      themePink: 'Hot Pink',
      themePurple: 'Purple',
      themeGreen: 'Neon Green',
      themeYellow: 'Gold',
    },
    chat: {
      title: 'AI CHAT',
      clear: 'Clear',
      empty: 'Say "chat" or tap the CHAT button to start talking to Soul-AI.',
      placeholder: 'Type a message…',
      send: 'SEND',
    },
    perm: {
      title: 'Microphone Access',
      message: 'Soul-AI needs microphone access to listen for music and voice commands.',
      deny: 'Not now',
      allow: 'Allow',
    },
    aria: {
      settings: 'Settings',
      playPause: 'Play/Pause',
      stop: 'Stop',
      loadFile: 'Load audio file',
      mic: 'Toggle microphone listening',
      voice: 'Voice command',
      modeToggle: 'Toggle dance/idle mode',
      chat: 'AI Chat',
      voiceInput: 'Voice input',
    },
    toast: {
      settingsSaved: 'Settings saved',
      chatCleared: 'Chat history cleared',
      presetExportedFull: 'Preset exported (settings + character)',
      presetExportedNoChar: 'Preset exported (settings only). MP4 character is not embedded.',
      presetExportedSettings: 'Preset exported (settings only)',
      importCharConfirm: 'Import character image from this preset?',
      presetImportedSkipped: 'Preset settings imported (character skipped).',
      presetImported: 'Preset imported successfully!',
      presetImportFailed: 'Failed to import preset: {error}',
      presetReadFailed: 'Could not read preset file',
      charImported: 'Character imported from preset',
      charImportFailed: 'Failed to import character image',
      invalidCharFile: 'Invalid character file',
      gifLoaded: 'GIF loaded — first frame only (no animation)',
      mp4Loaded: 'MP4 loaded — loop animation enabled',
      charLoaded: 'Character loaded!',
      mp4LoadFailed: 'Failed to load MP4 character',
      imageLoadFailed: 'Failed to load image',
      corsBeatDisabled: 'Beat detection disabled — URL blocked by CORS. Local files work perfectly.',
      audioAnalysisUnavailable: 'Audio analysis unavailable for this source.',
      playbackBlocked: 'Playback blocked — tap play again',
      trackLoaded: 'Track loaded: {name}',
      loadingUrl: 'Loading URL track…',
      micActive: 'Environmental mic active',
      micOff: 'Microphone off',
      musicDetected: 'Music detected!',
      voiceError: 'Voice error: {error}',
      voiceUnsupported: 'Voice recognition not supported in this browser',
      unknownCommand: 'Unknown command: "{text}"',
      apiKeyRequired: 'Set your API key in Settings first',
      aiError: 'AI error: {error}',
      unsupportedFormat: 'Unsupported character format. Use PNG/JPG/WEBP/GIF or MP4.',
      fileTooLarge: 'Character file is too large (max 25MB).',
      welcome: 'Welcome to Soul-AI! 🎵 Tap to upload your character.',
      sessionRestored: 'Your character and playlist are back!',
      charVideoRestored: 'Character restored (saved MP4).',
      charImageRestored: 'Character restored.',
      charRestoreFailed: 'Could not restore saved character.',
      playlistAdded: 'Added to playlist: {name}',
      playlistExists: 'Already in playlist: {name}',
      playlistCleared: 'Playlist cleared',
      playlistRemoved: 'Removed from playlist',
      playlistNothingToAdd: 'Load a track or paste a URL first',
      trackRestoreFailed: 'Could not restore last track',
      micDenied: 'Microphone permission denied.',
      micNotFound: 'No microphone found — check Windows sound settings.',
      micUnavailable: 'Microphone unavailable: {error}',
      useHttpLocalhost: 'Tip: use http://localhost:8088 for dev (no cert warnings).',
      voiceAlwaysOn: 'Always-on voice — listening continuously',
      voiceAlwaysOff: 'Always-on voice off',
    },
    voice: {
      listening: 'Listening…',
      alwaysOn: 'Always listening…',
      noResponse: '(no response)',
    },
    defaultSystemPrompt:
      'You are Soul-AI, a fun and friendly AI music companion. Keep responses concise and upbeat. You love music, dancing, and making people smile. Max 2 sentences.',
  },
  de: {
    meta: {
      description: 'Soul-AI — Dein KI-Live-Speaker-Begleiter: tanzt zur Musik, hört auf deine Stimme und reagiert in Echtzeit.',
      title: 'Soul-AI — KI Live Speaker',
    },
    header: {
      tagline: 'KI LIVE SPEAKER',
    },
    modes: {
      idle: 'RUHE',
      dance: 'TANZ',
      music: 'MUSIK',
      chat: 'CHAT',
    },
    upload: {
      canvasTitle: 'Klicken zum Hochladen — Bild oder MP4 (GIFs: erstes Frame)',
      hintHtml: 'Tippen zum Hochladen<br/>deines Charakters',
      formats: 'PNG · JPG · WEBP · GIF (erstes Frame) · MP4 (Loop)',
    },
    player: {
      noTrack: 'Kein Track geladen',
      urlPlaceholder: 'Audio-URL hier einfügen…',
      load: 'Laden',
      playlist: 'Playlist',
      addToPlaylist: 'Zur Playlist',
      clearPlaylist: 'Playlist leeren',
      playlistEmpty: 'Noch leer — Track laden oder URL einfügen, dann +',
      removeTrack: 'Entfernen',
      prevTrack: 'Vorheriger Track',
      nextTrack: 'Nächster Track',
      togglePlaylist: 'Playlist anzeigen',
    },
    controls: {
      mic: 'MIKRO',
      micOn: 'MIKRO AN',
      voice: 'STIMME',
      voiceOn: 'STIMME AN',
      dance: 'TANZ',
      idle: 'RUHE',
      chat: 'CHAT',
    },
    settings: {
      title: 'EINSTELLUNGEN',
      language: 'Sprache',
      apiKey: 'OpenAI-kompatibler API-Schlüssel',
      apiKeyPlaceholder: 'sk-… oder Grok API-Key',
      rememberApiKey: 'API-Schlüssel in diesem Browser merken',
      rememberApiKeyHint: 'Abwählen = nur für diese Sitzung. Presets nie mit Keys teilen.',
      apiBase: 'API-Basis-URL',
      apiBasePlaceholder: 'https://api.openai.com/v1',
      model: 'Modell',
      modelPlaceholder: 'gpt-4o-mini',
      volume: 'Master-Lautstärke',
      sensitivity: 'Beat-Empfindlichkeit',
      theme: 'Akzent-Farbschema',
      animSpeed: 'Animationsgeschwindigkeit',
      character: 'Charakterbild',
      reupload: 'Neuen Charakter hochladen',
      exportPreset: 'Preset exportieren',
      importPreset: 'Preset importieren',
      presetHint: 'Exportiert Charakter + Einstellungen (ohne API-Key). Teilbare .json-Datei.',
      systemPrompt: 'KI-System-Prompt',
      systemPromptPlaceholder: 'Du bist Soul-AI, ein freundlicher Musik-Begleiter…',
      ttsEngine: 'Sprach-Engine',
      ttsEngineAuto: 'Auto (Kokoro EN / Browser DE)',
      ttsEngineKokoro: 'Kokoro (Bella — bancamp TTS)',
      ttsEngineBrowser: 'Nur Browser',
      ttsVoice: 'Kokoro-Stimme',
      ttsSpeed: 'Sprechgeschwindigkeit',
      voiceAlwaysOn: 'Dauer-Voice (ständig zuhören)',
      voiceAlwaysOnHint: 'VOICE-Button schaltet um — nicht vor jedem Befehl drücken.',
      save: 'EINSTELLUNGEN SPEICHERN',
      savedLocally: 'Einstellungen lokal im Browser gespeichert',
      themeNeon: 'Neon Cyan',
      themePink: 'Hot Pink',
      themePurple: 'Lila',
      themeGreen: 'Neon Grün',
      themeYellow: 'Gold',
    },
    chat: {
      title: 'KI-CHAT',
      clear: 'Leeren',
      empty: 'Sag „Chat" oder tippe CHAT, um mit Soul-AI zu reden.',
      placeholder: 'Nachricht eingeben…',
      send: 'SENDEN',
    },
    perm: {
      title: 'Mikrofon-Zugriff',
      message: 'Soul-AI braucht Mikrofon-Zugriff für Musik- und Sprachbefehle.',
      deny: 'Nicht jetzt',
      allow: 'Erlauben',
    },
    aria: {
      settings: 'Einstellungen',
      playPause: 'Abspielen/Pause',
      stop: 'Stopp',
      loadFile: 'Audiodatei laden',
      mic: 'Umgebungsmikrofon umschalten',
      voice: 'Sprachbefehl',
      modeToggle: 'Tanz-/Ruhemodus umschalten',
      chat: 'KI-Chat',
      voiceInput: 'Spracheingabe',
    },
    toast: {
      settingsSaved: 'Einstellungen gespeichert',
      chatCleared: 'Chat-Verlauf gelöscht',
      presetExportedFull: 'Preset exportiert (Einstellungen + Charakter)',
      presetExportedNoChar: 'Preset exportiert (nur Einstellungen). MP4-Charakter nicht eingebettet.',
      presetExportedSettings: 'Preset exportiert (nur Einstellungen)',
      importCharConfirm: 'Charakterbild aus diesem Preset importieren?',
      presetImportedSkipped: 'Preset-Einstellungen importiert (Charakter übersprungen).',
      presetImported: 'Preset erfolgreich importiert!',
      presetImportFailed: 'Preset-Import fehlgeschlagen: {error}',
      presetReadFailed: 'Preset-Datei konnte nicht gelesen werden',
      charImported: 'Charakter aus Preset importiert',
      charImportFailed: 'Charakterbild-Import fehlgeschlagen',
      invalidCharFile: 'Ungültige Charakterdatei',
      gifLoaded: 'GIF geladen — nur erstes Frame (keine Animation)',
      mp4Loaded: 'MP4 geladen — Loop-Animation aktiv',
      charLoaded: 'Charakter geladen!',
      mp4LoadFailed: 'MP4-Charakter konnte nicht geladen werden',
      imageLoadFailed: 'Bild konnte nicht geladen werden',
      corsBeatDisabled: 'Beat-Erkennung deaktiviert — URL durch CORS blockiert. Lokale Dateien funktionieren.',
      audioAnalysisUnavailable: 'Audio-Analyse für diese Quelle nicht verfügbar.',
      playbackBlocked: 'Wiedergabe blockiert — nochmal auf Play tippen',
      trackLoaded: 'Track geladen: {name}',
      loadingUrl: 'URL-Track wird geladen…',
      micActive: 'Umgebungsmikrofon aktiv',
      micOff: 'Mikrofon aus',
      musicDetected: 'Musik erkannt!',
      voiceError: 'Sprachfehler: {error}',
      voiceUnsupported: 'Spracherkennung in diesem Browser nicht unterstützt',
      unknownCommand: 'Unbekannter Befehl: „{text}"',
      apiKeyRequired: 'Zuerst API-Schlüssel in den Einstellungen setzen',
      aiError: 'KI-Fehler: {error}',
      unsupportedFormat: 'Nicht unterstütztes Format. PNG/JPG/WEBP/GIF oder MP4.',
      fileTooLarge: 'Charakterdatei zu groß (max. 25 MB).',
      welcome: 'Willkommen bei Soul-AI! 🎵 Tippen zum Charakter-Upload.',
      sessionRestored: 'Charakter und Playlist sind wieder da!',
      charVideoRestored: 'Charakter wiederhergestellt (gespeichertes MP4).',
      charImageRestored: 'Charakter wiederhergestellt.',
      charRestoreFailed: 'Gespeicherter Charakter konnte nicht geladen werden.',
      playlistAdded: 'Zur Playlist: {name}',
      playlistExists: 'Schon in der Playlist: {name}',
      playlistCleared: 'Playlist geleert',
      playlistRemoved: 'Aus Playlist entfernt',
      playlistNothingToAdd: 'Zuerst Track laden oder URL einfügen',
      trackRestoreFailed: 'Letzter Track konnte nicht geladen werden',
      micDenied: 'Mikrofon-Zugriff verweigert.',
      micNotFound: 'Kein Mikrofon gefunden — Windows-Sound-Einstellungen prüfen.',
      micUnavailable: 'Mikrofon nicht verfügbar: {error}',
      useHttpLocalhost: 'Tipp: http://localhost:8088 für Dev (keine Zertifikat-Warnung).',
      voiceAlwaysOn: 'Dauer-Voice aktiv — höre dauerhaft zu',
      voiceAlwaysOff: 'Dauer-Voice aus',
    },
    voice: {
      listening: 'Höre zu…',
      alwaysOn: 'Dauer-Modus aktiv…',
      noResponse: '(keine Antwort)',
    },
    defaultSystemPrompt:
      'Du bist Soul-AI, ein fröhlicher KI-Musikbegleiter. Antworte kurz und positiv. Du liebst Musik, Tanzen und gute Laune. Maximal 2 Sätze.',
  },
};

/** Voice command patterns per locale (lowercase matching). */
export const VOICE_COMMANDS = {
  en: {
    dance: ['dance', 'start dancing', "let's dance"],
    idle: ['idle', 'stop dancing', 'rest', 'chill'],
    play: ['play', 'start music', 'play music'],
    pause: ['pause', 'stop music', 'stop playing'],
    stop: ['stop'],
    nextTrack: ['next track', 'next song', 'skip', 'next'],
    prevTrack: ['previous track', 'previous song', 'last track', 'back'],
    volumeUp: ['volume up', 'louder', 'turn it up'],
    volumeDown: ['volume down', 'quieter', 'turn it down'],
    mute: ['mute', 'silence'],
    unmute: ['unmute'],
    chat: ['chat', 'talk to me', "let's chat", 'hey soul-ai', 'hello soul-ai', 'hey soul ai'],
    settings: ['settings', 'open settings'],
    mic: ['microphone', 'start listening', 'listen'],
    close: ['close', 'never mind', 'cancel'],
    stopVoice: ['stop listening', 'stop voice', 'voice off'],
    spin: ['spin', 'rotate'],
    flash: ['light up', 'flash'],
    shake: ['shake', 'tremble'],
  },
  de: {
    dance: ['tanzen', 'tanz', 'tanz an', 'lass uns tanzen', 'dance'],
    idle: ['ruhe', 'chillen', 'entspannen', 'pause', 'idle', 'nicht tanzen'],
    play: ['abspielen', 'spielen', 'musik abspielen', 'musik an', 'play', 'start'],
    pause: ['pause', 'anhalten', 'musik pause'],
    stop: ['stopp', 'stop', 'beenden'],
    nextTrack: ['nächster track', 'nächstes lied', 'weiter', 'skip', 'next'],
    prevTrack: ['vorheriger track', 'vorheriges lied', 'zurück', 'previous'],
    volumeUp: ['lauter', 'leiser nicht', 'volumen hoch', 'volume up'],
    volumeDown: ['leiser', 'volumen runter', 'volume down', 'ruhiger'],
    mute: ['stumm', 'stille', 'mute'],
    unmute: ['laut', 'ton an', 'unmute', 'nicht stumm'],
    chat: ['chat', 'unterhalten', 'hallo soul-ai', 'hey soul-ai', 'hey soul ai', 'reden'],
    settings: ['einstellungen', 'settings', 'optionen'],
    mic: ['mikrofon', 'mikro', 'hören', 'zuhören', 'listen'],
    close: ['schließen', 'abbrechen', 'vergiss es', 'close', 'cancel'],
    stopVoice: ['stopp zuhören', 'nicht mehr zuhören', 'voice aus', 'stimme aus', 'stop listening'],
    spin: ['drehen', 'rotieren', 'spin'],
    flash: ['aufleuchten', 'blinken', 'flash', 'leuchten'],
    shake: ['schütteln', 'wackeln', 'shake'],
  },
};

/** Short TTS replies after voice commands. */
export const VOICE_REPLIES = {
  en: {
    dance: "Let's dance!",
    idle: 'Chilling out.',
    play: 'Playing music!',
    pause: 'Paused.',
    stop: 'Stopped.',
    nextTrack: 'Next track!',
    prevTrack: 'Previous track.',
    volumeUp: 'Volume up!',
    volumeDown: 'Volume down.',
    mute: 'Muted.',
    unmute: 'Unmuted!',
    chat: "What's up?",
  },
  de: {
    dance: 'Los geht der Tanz!',
    idle: 'Chill-Modus.',
    play: 'Musik läuft!',
    pause: 'Pausiert.',
    stop: 'Gestoppt.',
    nextTrack: 'Nächster Track!',
    prevTrack: 'Vorheriger Track.',
    volumeUp: 'Lauter!',
    volumeDown: 'Leiser.',
    mute: 'Stumm.',
    unmute: 'Ton wieder an!',
    chat: 'Was gibt’s?',
  },
};

let currentLocale = 'en';

export function isValidLocale(locale) {
  return LOCALES.includes(locale);
}

export function detectLocale(saved) {
  if (saved && isValidLocale(saved)) return saved;
  const nav = (navigator?.language || 'en').slice(0, 2).toLowerCase();
  return isValidLocale(nav) ? nav : 'en';
}

export function setLocale(locale) {
  currentLocale = isValidLocale(locale) ? locale : 'en';
}

export function getLocale() {
  return currentLocale;
}

export function speechRecognitionLang(locale = currentLocale) {
  return locale === 'de' ? 'de-DE' : 'en-US';
}

export function speechSynthesisLang(locale = currentLocale) {
  return speechRecognitionLang(locale);
}

function lookup(strings, key) {
  const parts = key.split('.');
  let val = strings;
  for (const part of parts) {
    val = val?.[part];
  }
  return val;
}

export function t(key, vars = {}) {
  let val = lookup(STRINGS[currentLocale], key);
  if (val === undefined) val = lookup(STRINGS.en, key);
  if (typeof val !== 'string') return key;
  return val.replace(/\{(\w+)\}/g, (_, name) => (vars[name] ?? `{${name}}`));
}

export function defaultSystemPrompt(locale = currentLocale) {
  return STRINGS[locale]?.defaultSystemPrompt || STRINGS.en.defaultSystemPrompt;
}

export function voicePatterns(locale = currentLocale) {
  return VOICE_COMMANDS[locale] || VOICE_COMMANDS.en;
}

export function voiceReply(action, locale = currentLocale) {
  return VOICE_REPLIES[locale]?.[action] || VOICE_REPLIES.en[action] || '';
}

/** Ignore mic input that likely came from our own TTS (speaker bleed). */
export function isLikelyVoiceEcho(transcript, recentSpoken = []) {
  const t = String(transcript || '').toLowerCase().replace(/[''´`]/g, '').replace(/[.!?,…]+/g, ' ').replace(/\s+/g, ' ').trim();
  if (!t || t.length < 2) return true;

  const pool = [];
  for (const phrase of recentSpoken) {
    const p = String(phrase || '').toLowerCase().replace(/[''´`]/g, '').replace(/[.!?,…]+/g, ' ').replace(/\s+/g, ' ').trim();
    if (p) pool.push(p);
  }
  for (const locale of Object.keys(VOICE_REPLIES)) {
    for (const phrase of Object.values(VOICE_REPLIES[locale])) {
      const p = String(phrase || '').toLowerCase().replace(/[''´`]/g, '').replace(/[.!?,…]+/g, ' ').replace(/\s+/g, ' ').trim();
      if (p) pool.push(p);
    }
  }

  for (const phrase of pool) {
    if (!phrase || phrase.length < 2) continue;
    if (t === phrase) return true;
    if (phrase.includes(t) && t.length >= 3) return true;
    if (t.includes(phrase) && phrase.length >= 4) return true;
  }
  return false;
}

export function modeLabel(mode, locale = currentLocale) {
  const key = `modes.${mode}`;
  const val = lookup(STRINGS[locale], key) || lookup(STRINGS.en, key);
  return typeof val === 'string' ? val : String(mode).toUpperCase();
}