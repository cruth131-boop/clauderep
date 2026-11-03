// Lädt das verschlüsselte Bundle (Fotos, Sounds, private Config) und stellt
// Gesichter bereit. Fehlt ein Foto, wird ein gezeichneter Platzhalter genutzt.
import { DEFAULT_CONFIG } from './config.js';

const KEY_STORE = 'br.key.v1';
export const assets = {
  config: structuredClone(DEFAULT_CONFIG),
  images: {},      // name -> HTMLImageElement
  audio: {},       // name -> ArrayBuffer (wird in audio.js dekodiert)
  hasBundle: false,
};

const b64ToBytes = (b64) => Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
const bytesToB64 = (bytes) => {
  let s = '';
  for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(s);
};

let bundleJson = null;

export async function fetchBundle() {
  try {
    const res = await fetch('assets/bundle.enc', { cache: 'no-cache' });
    if (!res.ok) return false;
    bundleJson = await res.json();
    assets.hasBundle = true;
    return true;
  } catch {
    return false;
  }
}

async function deriveKey(password) {
  const base = await crypto.subtle.importKey('raw', new TextEncoder().encode(password), 'PBKDF2', false, ['deriveKey']);
  return crypto.subtle.deriveKey(
    { name: 'PBKDF2', salt: b64ToBytes(bundleJson.salt), iterations: bundleJson.iter, hash: 'SHA-256' },
    base, { name: 'AES-GCM', length: 256 }, true, ['decrypt'],
  );
}

async function decryptWith(key) {
  const plain = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv: b64ToBytes(bundleJson.iv) }, key, b64ToBytes(bundleJson.data),
  );
  return JSON.parse(new TextDecoder().decode(plain));
}

export async function unlockWithPassword(password) {
  if (!crypto?.subtle) throw new Error('Kein sicherer Kontext (HTTPS nötig)');
  try {
    const key = await deriveKey(password.trim());
    const payload = await decryptWith(key);
    const raw = new Uint8Array(await crypto.subtle.exportKey('raw', key));
    try { localStorage.setItem(KEY_STORE, bytesToB64(raw)); } catch {}
    await applyPayload(payload);
    return true;
  } catch (e) {
    if (e.message?.startsWith('Kein sicherer')) throw e;
    return false;
  }
}

export async function unlockWithStoredKey() {
  let stored = null;
  try { stored = localStorage.getItem(KEY_STORE); } catch {}
  if (!stored || !crypto?.subtle) return false;
  try {
    const key = await crypto.subtle.importKey('raw', b64ToBytes(stored), 'AES-GCM', false, ['decrypt']);
    await applyPayload(await decryptWith(key));
    return true;
  } catch {
    try { localStorage.removeItem(KEY_STORE); } catch {}
    return false;
  }
}

function deepMerge(target, src) {
  for (const [k, v] of Object.entries(src || {})) {
    if (v && typeof v === 'object' && !Array.isArray(v) && target[k] && typeof target[k] === 'object' && !Array.isArray(target[k])) {
      deepMerge(target[k], v);
    } else target[k] = v;
  }
  return target;
}

async function applyPayload(payload) {
  deepMerge(assets.config, payload.config || {});
  const jobs = [];
  for (const [name, file] of Object.entries(payload.files || {})) {
    const base = name.replace(/\.[^.]+$/, '');
    if (file.type.startsWith('image/')) {
      jobs.push(new Promise((resolve) => {
        const img = new Image();
        img.onload = () => { assets.images[base] = img; resolve(); };
        img.onerror = resolve;
        img.src = `data:${file.type};base64,${file.data}`;
      }));
    } else if (file.type.startsWith('audio/')) {
      assets.audio[base] = b64ToBytes(file.data).buffer;
    }
  }
  await Promise.all(jobs);
}

// ---------------------------------------------------------------------------
// Gesichter
// ---------------------------------------------------------------------------
const placeholderCache = {};

/** Liefert {img, exact} – exact=false heißt: Ausdruck wird per Effekt simuliert. */
export function getFace(key, expr = 'normal') {
  const im = assets.images;
  if (im[`${key}_${expr}`]) return { img: im[`${key}_${expr}`], exact: true };
  if (im[key]) return { img: im[key], exact: expr === 'normal' };
  if (expr !== 'normal' && im[`${key}_normal`]) return { img: im[`${key}_normal`], exact: false };
  const ck = `${key}:${expr}`;
  if (!placeholderCache[ck]) placeholderCache[ck] = drawPlaceholderFace(key, expr);
  return { img: placeholderCache[ck], exact: true };
}

const FACE_STYLES = {
  her: { skin: '#f3c9a8', hair: '#c9a46b', long: true },
  him: { skin: '#eec09c', hair: '#5a3d24', short: true },
  oma: { skin: '#f0cdb4', hair: '#d8d8d8', bun: true, glasses: true },
  cameo1: { skin: '#f0c4a2', hair: '#6b4a2b', long: true },
  cameo2: { skin: '#e9b993', hair: '#3a3a3a', short: true, beard: true },
};
FACE_STYLES.mama = FACE_STYLES.cameo1;
FACE_STYLES.papa = FACE_STYLES.cameo2;

function drawPlaceholderFace(key, expr) {
  const st = FACE_STYLES[key] || FACE_STYLES.cameo1;
  const c = document.createElement('canvas');
  c.width = 200; c.height = 240;
  const g = c.getContext('2d');
  g.translate(100, 125);
  // Haare hinten
  g.fillStyle = st.hair;
  if (st.long) { g.beginPath(); g.ellipse(0, 10, 78, 100, 0, 0, Math.PI * 2); g.fill(); }
  if (st.bun) { g.beginPath(); g.arc(0, -92, 30, 0, Math.PI * 2); g.fill(); }
  // Gesicht
  g.fillStyle = st.skin;
  g.beginPath(); g.ellipse(0, 5, 62, 78, 0, 0, Math.PI * 2); g.fill();
  // Haare vorne
  g.fillStyle = st.hair;
  g.beginPath(); g.ellipse(0, -55, 66, 34, 0, Math.PI, 0); g.fill();
  if (st.short) { g.beginPath(); g.ellipse(0, -48, 64, 36, 0, Math.PI * 0.95, Math.PI * 2.05); g.fill(); }
  if (st.beard) { g.beginPath(); g.ellipse(0, 55, 50, 30, 0, 0, Math.PI); g.fill(); }
  // Augen
  g.fillStyle = '#2b1d14';
  const eyeY = -5;
  if (expr === 'happy') {
    g.lineWidth = 7; g.strokeStyle = '#2b1d14'; g.lineCap = 'round';
    for (const ex of [-24, 24]) { g.beginPath(); g.arc(ex, eyeY + 6, 12, Math.PI * 1.1, Math.PI * 1.9); g.stroke(); }
  } else if (expr === 'shock') {
    for (const ex of [-24, 24]) {
      g.fillStyle = '#fff'; g.beginPath(); g.arc(ex, eyeY, 15, 0, 7); g.fill();
      g.fillStyle = '#2b1d14'; g.beginPath(); g.arc(ex, eyeY, 6, 0, 7); g.fill();
    }
  } else {
    for (const ex of [-24, 24]) { g.beginPath(); g.ellipse(ex, eyeY, 7, 10, 0, 0, 7); g.fill(); }
    if (expr === 'sad') {
      g.strokeStyle = '#2b1d14'; g.lineWidth = 5;
      g.beginPath(); g.moveTo(-36, -28); g.lineTo(-14, -20); g.moveTo(36, -28); g.lineTo(14, -20); g.stroke();
    }
  }
  if (st.glasses) {
    g.strokeStyle = '#5b3b8a'; g.lineWidth = 5;
    g.beginPath(); g.arc(-24, eyeY, 18, 0, 7); g.moveTo(42, eyeY); g.arc(24, eyeY, 18, 0, 7); g.moveTo(-6, eyeY); g.lineTo(6, eyeY); g.stroke();
  }
  // Wangen
  g.fillStyle = 'rgba(255,110,130,0.35)';
  g.beginPath(); g.arc(-40, 22, 12, 0, 7); g.arc(40, 22, 12, 0, 7); g.fill();
  // Mund
  g.strokeStyle = '#7a2b2b'; g.fillStyle = '#7a2b2b'; g.lineWidth = 6; g.lineCap = 'round';
  g.beginPath();
  if (expr === 'happy') { g.arc(0, 28, 24, 0.1 * Math.PI, 0.9 * Math.PI); g.closePath(); g.fill(); }
  else if (expr === 'shock') { g.ellipse(0, 40, 14, 18, 0, 0, 7); g.fill(); }
  else if (expr === 'sad') { g.arc(0, 56, 20, 1.15 * Math.PI, 1.85 * Math.PI); g.stroke(); }
  else { g.arc(0, 26, 20, 0.2 * Math.PI, 0.8 * Math.PI); g.stroke(); }
  if (expr === 'sad') {
    g.fillStyle = '#7cc6ff';
    g.beginPath(); g.moveTo(-26, 8); g.quadraticCurveTo(-36, 30, -26, 34); g.quadraticCurveTo(-16, 30, -26, 8); g.fill();
  }
  return c;
}
