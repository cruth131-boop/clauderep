#!/usr/bin/env node
// Verschlüsselt private/config.json + private/assets/* nach assets/bundle.enc (AES-256-GCM, PBKDF2).
//
//   PASSWORT="geheim" node tools/build.mjs            -> verschlüsseln
//   PASSWORT="geheim" node tools/build.mjs --decrypt  -> private/ aus dem Bundle wiederherstellen
//
// Das Repo ist öffentlich: Nur assets/bundle.enc wird committet, private/ steht in .gitignore.
import { webcrypto as crypto } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const PRIV = path.join(root, 'private');
const OUT = path.join(root, 'assets', 'bundle.enc');
const ITER = 210000;
const TYPES = { '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp', '.gif': 'image/gif', '.mp3': 'audio/mpeg', '.m4a': 'audio/mp4', '.wav': 'audio/wav', '.ogg': 'audio/ogg' };
const EXT = Object.fromEntries(Object.entries(TYPES).map(([e, t]) => [t, e]));

const password = process.env.PASSWORT || process.env.PASSWORD;
if (!password) { console.error('Bitte PASSWORT="..." setzen.'); process.exit(1); }

async function key(salt) {
  const base = await crypto.subtle.importKey('raw', new TextEncoder().encode(password.trim()), 'PBKDF2', false, ['deriveKey']);
  return crypto.subtle.deriveKey({ name: 'PBKDF2', salt, iterations: ITER, hash: 'SHA-256' }, base, { name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']);
}

if (process.argv.includes('--decrypt')) {
  const b = JSON.parse(fs.readFileSync(OUT, 'utf8'));
  const k = await key(Buffer.from(b.salt, 'base64'));
  const plain = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: Buffer.from(b.iv, 'base64') }, k, Buffer.from(b.data, 'base64'));
  const payload = JSON.parse(Buffer.from(plain).toString('utf8'));
  fs.mkdirSync(path.join(PRIV, 'assets'), { recursive: true });
  fs.writeFileSync(path.join(PRIV, 'config.json'), JSON.stringify(payload.config, null, 2));
  for (const [name, f] of Object.entries(payload.files)) fs.writeFileSync(path.join(PRIV, 'assets', name), Buffer.from(f.data, 'base64'));
  console.log(`Wiederhergestellt: config.json + ${Object.keys(payload.files).length} Dateien in private/`);
} else {
  const config = JSON.parse(fs.readFileSync(path.join(PRIV, 'config.json'), 'utf8'));
  const files = {};
  const dir = path.join(PRIV, 'assets');
  for (const name of fs.existsSync(dir) ? fs.readdirSync(dir).sort() : []) {
    const type = TYPES[path.extname(name).toLowerCase()];
    if (!type) continue;
    files[name] = { type, data: fs.readFileSync(path.join(dir, name)).toString('base64') };
  }
  // Salt aus dem bisherigen Bundle weiterverwenden: gleiches Passwort -> gleicher Schlüssel,
  // so bleibt der gespeicherte Schlüssel auf dem Handy nach Updates gültig (kein erneutes Passwort).
  let salt = null;
  try { const old = JSON.parse(fs.readFileSync(OUT, 'utf8')); if (old.iter === ITER && old.salt) salt = new Uint8Array(Buffer.from(old.salt, 'base64')); } catch {}
  if (!salt || salt.length !== 16) salt = crypto.getRandomValues(new Uint8Array(16));
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const k = await key(salt);
  const data = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, k, new TextEncoder().encode(JSON.stringify({ config, files })));
  fs.mkdirSync(path.dirname(OUT), { recursive: true });
  fs.writeFileSync(OUT, JSON.stringify({ v: 1, iter: ITER, salt: Buffer.from(salt).toString('base64'), iv: Buffer.from(iv).toString('base64'), data: Buffer.from(data).toString('base64') }));
  const kb = (fs.statSync(OUT).size / 1024).toFixed(0);
  console.log(`assets/bundle.enc geschrieben (${kb} KB, ${Object.keys(files).length} Dateien: ${Object.keys(files).join(', ') || '-'})`);
}
void EXT;
