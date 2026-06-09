/**
 * IndexedDB persistence for character media + playlist session.
 * Survives page reloads (localStorage is too small for audio blobs).
 */

import { APP_SLUG } from './core.mjs';

const DB_NAME = APP_SLUG;
const LEGACY_DB_NAME = 'souler-web';
const DB_VERSION = 1;
const STORE_KV = 'kv';
const STORE_BLOBS = 'blobs';

const KEYS = {
  character: 'character',
  session: 'session',
};

let dbPromise = null;
let migrationPromise = null;

function reqToPromise(request) {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

function txDone(tx) {
  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error);
  });
}

function openDbNamed(name) {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(name, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_KV)) {
        db.createObjectStore(STORE_KV);
      }
      if (!db.objectStoreNames.contains(STORE_BLOBS)) {
        db.createObjectStore(STORE_BLOBS);
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export function openDb() {
  if (dbPromise) return dbPromise;
  if (typeof indexedDB === 'undefined') {
    return Promise.reject(new Error('IndexedDB unavailable'));
  }
  dbPromise = openDbNamed(DB_NAME);
  return dbPromise;
}

async function readAllFromStore(db, storeName) {
  const tx = db.transaction(storeName, 'readonly');
  const store = tx.objectStore(storeName);
  const keys = await reqToPromise(store.getAllKeys());
  const entries = [];
  for (const key of keys) {
    entries.push([key, await reqToPromise(store.get(key))]);
  }
  await txDone(tx);
  return entries;
}

async function writeEntries(db, storeName, entries) {
  if (!entries.length) return;
  const tx = db.transaction(storeName, 'readwrite');
  const store = tx.objectStore(storeName);
  for (const [key, value] of entries) {
    store.put(value, key);
  }
  await txDone(tx);
}

/** One-time copy from pre-rename IndexedDB (`souler-web`). */
export async function migrateLegacyStorage() {
  if (migrationPromise) return migrationPromise;
  if (typeof indexedDB === 'undefined') return;

  migrationPromise = (async () => {
    const db = await openDb();
    const hasCharacter = await getKv(KEYS.character);
    const hasSession = await getKv(KEYS.session);
    if (hasCharacter || hasSession) return;

    let legacyDb;
    try {
      legacyDb = await openDbNamed(LEGACY_DB_NAME);
    } catch {
      return;
    }

    try {
      const kvEntries = await readAllFromStore(legacyDb, STORE_KV);
      const blobEntries = await readAllFromStore(legacyDb, STORE_BLOBS);
      if (!kvEntries.length && !blobEntries.length) return;
      await writeEntries(db, STORE_KV, kvEntries);
      await writeEntries(db, STORE_BLOBS, blobEntries);
    } catch (e) {
      console.warn('Legacy storage migration skipped:', e);
    } finally {
      legacyDb.close();
    }
  })();

  return migrationPromise;
}

async function getKv(key) {
  const db = await openDb();
  const tx = db.transaction(STORE_KV, 'readonly');
  const value = await reqToPromise(tx.objectStore(STORE_KV).get(key));
  await txDone(tx);
  return value ?? null;
}

async function setKv(key, value) {
  const db = await openDb();
  const tx = db.transaction(STORE_KV, 'readwrite');
  tx.objectStore(STORE_KV).put(value, key);
  await txDone(tx);
}

async function deleteKv(key) {
  const db = await openDb();
  const tx = db.transaction(STORE_KV, 'readwrite');
  tx.objectStore(STORE_KV).delete(key);
  await txDone(tx);
}

export async function saveBlob(key, blob) {
  const db = await openDb();
  const tx = db.transaction(STORE_BLOBS, 'readwrite');
  tx.objectStore(STORE_BLOBS).put(blob, key);
  await txDone(tx);
}

export async function loadBlob(key) {
  const db = await openDb();
  const tx = db.transaction(STORE_BLOBS, 'readonly');
  const value = await reqToPromise(tx.objectStore(STORE_BLOBS).get(key));
  await txDone(tx);
  return value ?? null;
}

export async function deleteBlob(key) {
  const db = await openDb();
  const tx = db.transaction(STORE_BLOBS, 'readwrite');
  tx.objectStore(STORE_BLOBS).delete(key);
  await txDone(tx);
}

/**
 * @param {{ mediaType: 'image'|'video', dataUrl?: string|null, blobKey?: string|null, mimeType?: string }} payload
 */
export async function saveCharacter(payload) {
  await setKv(KEYS.character, payload);
}

/** @returns {Promise<{ mediaType: 'image'|'video', dataUrl?: string, blobKey?: string, mimeType?: string }|null>} */
export async function loadCharacter() {
  return getKv(KEYS.character);
}

export async function clearCharacter() {
  const existing = await loadCharacter();
  if (existing?.blobKey) {
    await deleteBlob(existing.blobKey);
  }
  await deleteKv(KEYS.character);
}

/**
 * @param {{ playlist: object[], currentIndex: number, lastUrl?: string }} session
 */
export async function saveSession(session) {
  await setKv(KEYS.session, session);
}

/** @returns {Promise<{ playlist: object[], currentIndex: number, lastUrl?: string }|null>} */
export async function loadSession() {
  return getKv(KEYS.session);
}

export async function clearSession() {
  const session = await loadSession();
  if (session?.playlist) {
    for (const item of session.playlist) {
      if (item?.source === 'file' && item.blobKey) {
        await deleteBlob(item.blobKey).catch(() => {});
      }
    }
  }
  await deleteKv(KEYS.session);
}