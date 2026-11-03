// WebAudio: synthetisierte Soundeffekte + eigene Chiptune-Tracks.
// Eigene MP3s (z.B. "no", "music_run") aus dem Bundle ersetzen die Synth-Varianten.
import { assets } from './assets.js';

let ctx = null, master, sfxBus, musicBus, noiseBuf;
let muted = false;
const buffers = {};
let current = null; // { name, stop() }

export function isMuted() { return muted; }
export function setMuted(m) {
  muted = m;
  if (master) master.gain.setTargetAtTime(m ? 0 : 1, ctx.currentTime, 0.02);
}

export async function initAudio() {
  if (ctx) { if (ctx.state === 'suspended') ctx.resume(); return; }
  const AC = window.AudioContext || window.webkitAudioContext;
  if (!AC) return;
  ctx = new AC();
  master = ctx.createGain(); master.gain.value = muted ? 0 : 1; master.connect(ctx.destination);
  sfxBus = ctx.createGain(); sfxBus.gain.value = 0.55; sfxBus.connect(master);
  musicBus = ctx.createGain(); musicBus.gain.value = 0.32; musicBus.connect(master);
  noiseBuf = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
  const d = noiseBuf.getChannelData(0);
  for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  // iOS: stummen Buffer abspielen, um Audio freizuschalten
  const s = ctx.createBufferSource(); s.buffer = ctx.createBuffer(1, 1, 22050); s.connect(master); s.start(0);
  for (const [name, ab] of Object.entries(assets.audio)) {
    try { buffers[name] = await ctx.decodeAudioData(ab.slice(0)); } catch {}
  }
}

function playBuffer(name, bus = sfxBus, loop = false) {
  const src = ctx.createBufferSource(); src.buffer = buffers[name]; src.loop = loop;
  const gn = ctx.createGain(); src.connect(gn); gn.connect(bus); src.start();
  return { src, gn };
}

function tone({ type = 'square', f0, f1 = f0, dur = 0.1, vol = 0.3, at = 0, attack = 0.005, vib = 0, bus = sfxBus, filter = 0 }) {
  const t = ctx.currentTime + at;
  const o = ctx.createOscillator(); o.type = type;
  o.frequency.setValueAtTime(f0, t);
  if (f1 !== f0) o.frequency.exponentialRampToValueAtTime(Math.max(1, f1), t + dur);
  const gn = ctx.createGain();
  gn.gain.setValueAtTime(0, t); gn.gain.linearRampToValueAtTime(vol, t + attack);
  gn.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  let node = o;
  if (vib) {
    const l = ctx.createOscillator(), lg = ctx.createGain();
    l.frequency.value = 6; lg.gain.value = vib; l.connect(lg); lg.connect(o.frequency); l.start(t); l.stop(t + dur);
  }
  if (filter) { const f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = filter; o.connect(f); node = f; }
  node.connect(gn); gn.connect(bus);
  o.start(t); o.stop(t + dur + 0.02);
}

function noise({ dur = 0.2, vol = 0.3, at = 0, freq = 1200, type = 'lowpass', f1, bus = sfxBus }) {
  const t = ctx.currentTime + at;
  const s = ctx.createBufferSource(); s.buffer = noiseBuf;
  const f = ctx.createBiquadFilter(); f.type = type; f.frequency.setValueAtTime(freq, t);
  if (f1) f.frequency.exponentialRampToValueAtTime(f1, t + dur);
  const gn = ctx.createGain(); gn.gain.setValueAtTime(vol, t); gn.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  s.connect(f); f.connect(gn); gn.connect(bus);
  s.start(t, Math.random() * 0.5); s.stop(t + dur + 0.02);
}

const N = (n) => 440 * 2 ** ((n - 69) / 12);

export function sfx(name, arg = 0) {
  if (!ctx || muted) return;
  if (buffers[name]) { playBuffer(name); return; }
  switch (name) {
    case 'jump': tone({ type: 'square', f0: 320, f1: 640, dur: 0.12, vol: 0.18 }); break;
    case 'collect': tone({ type: 'triangle', f0: N(84), dur: 0.08, vol: 0.3 }); tone({ type: 'triangle', f0: N(91), dur: 0.14, vol: 0.3, at: 0.07 }); break;
    case 'heart': [72, 79, 84, 88].forEach((n, i) => tone({ type: 'sine', f0: N(n), dur: 0.18, vol: 0.22, at: i * 0.06 })); break;
    case 'candle': { const n = 72 + (arg % 12); tone({ type: 'triangle', f0: N(n), dur: 0.08, vol: 0.28 }); tone({ type: 'triangle', f0: N(n + 7), dur: 0.12, vol: 0.25, at: 0.06 }); tone({ type: 'sine', f0: N(n + 19), dur: 0.2, vol: 0.12, at: 0.1 }); break; }
    case 'wine': tone({ type: 'sine', f0: 2400, dur: 0.35, vol: 0.2 }); tone({ type: 'sine', f0: 3150, dur: 0.3, vol: 0.12, at: 0.04 }); break;
    case 'bad':
      tone({ type: 'sawtooth', f0: 220, f1: 110, dur: 0.35, vol: 0.25 });
      tone({ type: 'square', f0: 233, f1: 116, dur: 0.35, vol: 0.12 }); break;
    case 'hurt': noise({ dur: 0.15, vol: 0.35, freq: 900 }); tone({ type: 'square', f0: 300, f1: 120, dur: 0.2, vol: 0.2 }); break;
    case 'hit': noise({ dur: 0.35, vol: 0.5, freq: 1600, f1: 200 }); tone({ type: 'sawtooth', f0: 180, f1: 50, dur: 0.4, vol: 0.3 }); break;
    case 'no': // Ersatz, falls kein eigenes "no"-MP3: trauriges Posaunen-"wah wah wah waaah"
      [67, 66, 65].forEach((n, i) => tone({ type: 'sawtooth', f0: N(n - 12), dur: 0.32, vol: 0.22, at: 0.35 + i * 0.36, attack: 0.04, filter: 1400 }));
      tone({ type: 'sawtooth', f0: N(64 - 12), dur: 1.1, vol: 0.22, at: 0.35 + 3 * 0.36, attack: 0.04, vib: 6, filter: 1400 });
      break;
    case 'meow':
      tone({ type: 'sawtooth', f0: 520, f1: 900, dur: 0.12, vol: 0.12, filter: 2200 });
      tone({ type: 'sawtooth', f0: 900, f1: 480, dur: 0.3, vol: 0.12, at: 0.11, filter: 2000 }); break;
    case 'smash': noise({ dur: 0.25, vol: 0.45, freq: 3000, f1: 300 }); tone({ type: 'square', f0: 90, f1: 40, dur: 0.2, vol: 0.3 }); break;
    case 'power': [72, 76, 79, 84, 88].forEach((n, i) => tone({ type: 'square', f0: N(n), dur: 0.09, vol: 0.18, at: i * 0.06 })); break;
    case 'cheer': [76, 79, 84].forEach((n, i) => tone({ type: 'triangle', f0: N(n), dur: 0.1, vol: 0.15, at: i * 0.06 })); break;
    case 'memory': [84, 88, 91, 96].forEach((n, i) => tone({ type: 'sine', f0: N(n), dur: 0.25, vol: 0.18, at: i * 0.08 })); break;
    case 'thunder': noise({ dur: 1.6, vol: 0.5, freq: 400, f1: 60 }); break;
    case 'fanfare':
      [[72, 0], [76, 0.12], [79, 0.24], [84, 0.36]].forEach(([n, at]) => tone({ type: 'square', f0: N(n), dur: 0.14, vol: 0.2, at }));
      tone({ type: 'square', f0: N(84), dur: 0.8, vol: 0.2, at: 0.5, vib: 5 }); tone({ type: 'triangle', f0: N(60), dur: 1.2, vol: 0.3, at: 0.5 });
      break;
    case 'launch': tone({ type: 'sine', f0: 400 + Math.random() * 200, f1: 1600, dur: 0.6, vol: 0.06 }); break;
    case 'boom':
      noise({ dur: 0.9, vol: 0.45, freq: 1800, f1: 120 });
      for (let i = 0; i < 6; i++) noise({ dur: 0.05, vol: 0.12, freq: 5000, type: 'highpass', at: 0.2 + Math.random() * 0.6 });
      break;
    case 'tap': tone({ type: 'square', f0: N(60 + arg * 2), dur: 0.1, vol: 0.2 }); noise({ dur: 0.06, vol: 0.15, freq: 2500 }); break;
    case 'explode': noise({ dur: 1.2, vol: 0.6, freq: 4000, f1: 100 }); [72, 76, 79, 84, 88, 91].forEach((n, i) => tone({ type: 'triangle', f0: N(n), dur: 0.3, vol: 0.2, at: 0.1 + i * 0.07 })); break;
    case 'drumroll': for (let i = 0; i < 20; i++) noise({ dur: 0.05, vol: 0.08 + i * 0.01, freq: 2000, at: i * 0.05 }); break;
    case 'sad': [64, 63, 62, 61].forEach((n, i) => tone({ type: 'triangle', f0: N(n), dur: 0.5, vol: 0.2, at: i * 0.45, vib: 4 })); break;
    case 'dun': [55, 54, 50].forEach((n, i) => tone({ type: 'sawtooth', f0: N(n - 12), dur: i === 2 ? 1.2 : 0.3, vol: 0.25, at: i * 0.35, filter: 900, vib: i === 2 ? 4 : 0 })); break;
    case 'violin': [76, 77, 76, 74, 72].forEach((n, i) => tone({ type: 'sawtooth', f0: N(n), dur: 0.45, vol: 0.08, at: i * 0.4, attack: 0.15, vib: 8, filter: 2500 })); break;
    default: break;
  }
}

// --------------------------------------------------------------------------
// Musik: kleiner Step-Sequencer mit eigenen (originalen) Chiptune-Tracks
// --------------------------------------------------------------------------
const parse = (s) => s.trim().split(/\s+/).map((t) => {
  if (t === '.' || t === '-') return null;
  const m = /^([A-G])(#|b)?(\d)$/.exec(t);
  const base = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 }[m[1]] + (m[2] === '#' ? 1 : m[2] === 'b' ? -1 : 0);
  return base + (Number(m[3]) + 1) * 12;
});

const TRACKS = {
  menu: {
    bpm: 112, lead: parse(`
      E5 . G5 . C6 . G5 .  D5 . G5 . B5 . G5 .  C5 . E5 . A5 . E5 .  C5 . F5 . A5 . G5 .
      E5 G5 C6 G5 E5 . . .  D5 G5 B5 G5 D5 . . .  E5 A5 C6 A5 E5 . . .  F5 A5 C6 . B5 . G5 .`),
    bass: parse(`C3 . C3 . C3 . C3 .  G2 . G2 . G2 . G2 .  A2 . A2 . A2 . A2 .  F2 . F2 . F2 . F2 .
      C3 . C3 . C3 . C3 .  G2 . G2 . G2 . G2 .  A2 . A2 . A2 . A2 .  F2 . F2 . G2 . G2 .`),
    drums: 'k.h.s.h.k.h.s.hh',
    leadType: 'triangle',
  },
  run: {
    bpm: 152, lead: parse(`
      E5 . G5 E5 C6 . G5 .  D5 . G5 D5 B5 . G5 .  C5 . E5 A5 C6 . B5 A5  A5 . C6 A5 G5 . E5 D5
      E5 E5 G5 . C6 C6 D6 .  B5 . G5 . D6 . B5 .  C6 . A5 . E5 . A5 C6  D6 . C6 . B5 . G5 .`),
    bass: parse(`C3 C4 C3 C4 C3 C4 C3 C4  G2 G3 G2 G3 G2 G3 G2 G3  A2 A3 A2 A3 A2 A3 A2 A3  F2 F3 F2 F3 G2 G3 G2 G3
      C3 C4 C3 C4 C3 C4 C3 C4  G2 G3 G2 G3 G2 G3 G2 G3  A2 A3 A2 A3 A2 A3 A2 A3  F2 F3 F2 F3 G2 G3 B2 G3`),
    drums: 'k.h.s.k.k.h.s.hh',
    leadType: 'square',
  },
  horror: {
    bpm: 126, lead: parse(`
      A4 . . C5 . . B4 .  A4 . . E5 . . D#5 .  F4 . . A4 . . G#4 .  E4 . . . . . . .
      A5 . G#5 . A5 . E5 .  F5 . E5 . D5 . C5 .  D5 . F5 . A5 . G#5 .  E5 . B4 . G#4 . E4 .`),
    bass: parse(`A2 . A2 A2 . A2 . .  A2 . A2 A2 . A2 . .  F2 . F2 F2 . F2 . .  E2 . E2 E2 . E2 . .
      A2 . A2 A2 . A2 . .  F2 . F2 F2 . F2 . .  D2 . D2 D2 . D2 . .  E2 . E2 E2 . E2 . .`),
    drums: 'k...s..k..k.s...',
    leadType: 'sawtooth',
  },
  finale: {
    bpm: 132, lead: parse(`
      C5 E5 G5 C6 . G5 C6 .  D5 F5 A5 D6 . A5 D6 .  E6 . D6 . C6 . B5 .  C6 . G5 . E5 . G5 .
      F5 A5 C6 F6 . C6 A5 .  G5 B5 D6 G6 . D6 B5 .  C6 E6 G6 E6 C6 . G5 .  C6 . . . C6 . . .`),
    bass: parse(`C3 C3 G3 C3 C3 C3 G3 C3  D3 D3 A3 D3 D3 D3 A3 D3  E3 E3 B3 E3 G3 G3 D3 G3  C3 C3 G3 C3 C3 C3 G3 C3
      F2 F2 C3 F2 F2 F2 C3 F2  G2 G2 D3 G2 G2 G2 D3 G2  C3 C3 G3 C3 E3 E3 G3 E3  C3 . G2 . C3 . . .`),
    drums: 'k.hsk.hsk.hsk.ss',
    leadType: 'square',
  },
};

export function playMusic(name) {
  if (!ctx) return;
  if (current?.name === name) return;
  stopMusic();
  const mp3 = buffers[`music_${name}`];
  if (mp3) {
    const { src, gn } = playBuffer(`music_${name}`, musicBus, true);
    gn.gain.value = 1.4;
    current = { name, stop: () => { gn.gain.setTargetAtTime(0, ctx.currentTime, 0.1); src.stop(ctx.currentTime + 0.5); } };
    return;
  }
  const tr = TRACKS[name];
  if (!tr) return;
  const stepDur = 60 / tr.bpm / 2; // Achtelnoten
  let step = 0, nextT = ctx.currentTime + 0.05, alive = true;
  const bus = ctx.createGain(); bus.gain.value = 1; bus.connect(musicBus);
  const len = tr.lead.length;
  const tick = () => {
    if (!alive) return;
    while (nextT < ctx.currentTime + 0.15) {
      const i = step % len;
      const at = nextT - ctx.currentTime;
      const ln = tr.lead[i], bn = tr.bass[i % tr.bass.length];
      if (ln != null) tone({ type: tr.leadType, f0: N(ln), dur: stepDur * 0.9, vol: tr.leadType === 'triangle' ? 0.3 : 0.12, at, bus, filter: tr.leadType === 'sawtooth' ? 1800 : 0 });
      if (bn != null) tone({ type: 'triangle', f0: N(bn), dur: stepDur * 0.85, vol: 0.32, at, bus });
      const d = tr.drums[i % tr.drums.length];
      if (d === 'k') tone({ type: 'sine', f0: 140, f1: 45, dur: 0.12, vol: 0.5, at, bus });
      if (d === 's') noise({ dur: 0.1, vol: 0.2, freq: 3000, type: 'bandpass', at, bus });
      if (d === 'h') noise({ dur: 0.03, vol: 0.06, freq: 7000, type: 'highpass', at, bus });
      nextT += stepDur; step++;
    }
  };
  const iv = setInterval(tick, 25); tick();
  current = { name, stop: () => { alive = false; clearInterval(iv); bus.gain.setTargetAtTime(0, ctx.currentTime, 0.05); setTimeout(() => bus.disconnect(), 400); } };
}

export function stopMusic() { current?.stop(); current = null; }

export function suspendAudio() { ctx?.suspend(); }
export function resumeAudio() { ctx?.resume(); }
