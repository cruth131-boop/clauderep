// Level-Finale: Einspieler & Minispiele kurz vor dem Ziel.
// Designregeln: eine Geste pro Spiel, per animierter Hand gezeigt statt erklärt, 6–12 s, kein Scheitern
// (nur mehr oder weniger Bonuspunkte), viel Feedback, eine Überraschung pro Spiel. Einspieler: zeigen statt erzählen.
// Die Ereignisse selbst (wer, was, Texte) stehen in der privaten Config: config.levels[i].events.
import { drawPerson, drawCat, drawHero, drawRollatorOma, roundRect } from './character.js';
import { emoji } from './emoji.js';
import { COSTUMES } from './levels.js';
import { sfx, duckMusic } from './audio.js';

const rand = (a, b) => a + Math.random() * (b - a);
const pick = (a) => a[(Math.random() * a.length) | 0];
const lerp = (a, b, t) => a + (b - a) * t;
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const ease = (k) => { k = clamp(k, 0, 1); return k * k * (3 - 2 * k); };
const SC = 0.88;
const COLORS = ['#5b7bd5', '#d55b8f', '#3ea37a', '#d58a3e', '#8e5aa8', '#e0a030'];
const INTRO = 1.6;

function rating(frac) { return frac >= 0.85 ? 'LEGENDÄR! 🔥' : frac >= 0.6 ? 'Mega! 🎉' : frac >= 0.35 ? 'Gut gemacht! 👍' : 'Hauptsache dabei! 😅'; }

// ---------------------------------------------------------------------------
export function startStory(game, ev) {
  const V = game.V;
  const s = { ev, kind: ev.kind, t: 0, phase: 'intro', dur: ev.dur || 5, done: false, parts: [], kimiPose: ev.kimiPose || 'cheer', fw: [], pops: [], skipAny: !!(ev.cinema && game.seenVideos), kimiX: game.p.x };
  if (s.kind === 'party') {
    const src = (ev.faces ? ev.faces.map((f) => ({ face: f })) : game.levelGuests.filter((c) => c.face)).slice(0, 7);
    const uniq = []; const seen = new Set(); for (const c of src) if (!seen.has(c.face)) { seen.add(c.face); uniq.push(c); }
    s.actors = uniq.map((c, i, a) => ({ ...c, x: 0.3 + (i + 0.5) * (0.42 / a.length), from: 'right', t0: i * 0.1, color: COLORS[i % COLORS.length] }));
    s.bpm = ev.bpm || 112; s.beat = 60 / s.bpm; s.n = ev.beats || 12; s.t0 = INTRO + 0.4;
    s.judged = new Array(s.n).fill(null); s.combo = 0; s.best = 0; s.perfect = 0; s.good = 0; s.lastBeat = -1;
    s.solo = Math.floor(rand(4, s.n - 3)); // Überraschung: ein Gast bekommt ein Solo
    duckMusic(true); sfx('fanfare');
  } else if (s.kind === 'scene') {
    s.actors = (ev.actors || []).map((a, i) => ({ color: COLORS[i % COLORS.length], ...a }));
    s.fx = { ...(ev.fx || {}) }; s.phase = 'main';
    sfx('memory');
  } else if (s.kind === 'fipsplay') {
    s.dogs = (ev.dogs || []).map((d, i) => ({ face: d, i })); s.dur = ev.dur || 5; s.phase = 'main';
  } else if (s.kind === 'escalator') {
    s.ex = V.w + 40; s.phase = 'approach'; s.kimiPose = 'run'; s.help = 0;
  } else if (s.kind === 'detector') {
    s.dx = V.w * 0.45; s.lastMove = -9; s.beepT = 0; s.finds = 0; s.digs = [];
    const xs = []; let guard = 0;
    while (xs.length < 3 && guard++ < 500) { const x = rand(V.w * 0.12, V.w * 0.92); if (xs.every((o) => Math.abs(o - x) > V.w * 0.17) && Math.abs(x - s.dx) > V.w * 0.1) xs.push(x); }
    while (xs.length < 3) xs.push(rand(V.w * 0.1, V.w * 0.9));
    const junk = ev.junk || [['🔩', 'Nur ein Kronkorken 🙄'], ['🪙', 'Eine alte Münze! +20 🤑'], ['🥫', 'Eine Dose… 🙄']];
    s.items = [{ x: xs[0], e: junk[0][0], line: junk[0][1] }, { x: xs[1], e: junk[1][0], line: junk[1][1], coin: junk[1][0] === '🪙' }, { x: xs[2], e: '💍', ring: true }];
    s.items.forEach((it) => { it.dug = false; });
    s.kimiPose = 'cheer';
  } else if (s.kind === 'tapgame') {
    s.n = 0; s.need = ev.n || 15; s.time = ev.time || 6; s.shake = 0;
  } else if (s.kind === 'throw') {
    const holes = ev.holes || 4;
    s.holes = Array.from({ length: holes }, (_, i) => ({ x: 0.38 + (i + 0.5) * (0.56 / holes), pop: null }));
    s.hits = 0; s.miss = 0; s.oops = 0; s.next = 0.3; s.time = ev.time || 9; s.shots = []; s.face = {};
  } else if (s.kind === 'candles') {
    s.time = ev.time || 8; s.out = 0; s.candles = [];
    const n = ev.n || 30, cx = V.w * 0.6, cy = V.groundY - 70;
    for (let i = 0; i < n; i++) { const row = i % 3, k = Math.floor(i / 3), cols = Math.ceil(n / 3); s.candles.push({ x: cx - 120 + (k + (row % 2) * 0.5) * (240 / cols), y: cy - 40 + row * 18 - 30, lit: true, c: COLORS[i % COLORS.length] }); }
  } else if (s.kind === 'slot') {
    s.reels = [0, 1, 2].map(() => ({ off: rand(0, 6), stopped: false, anim: null }));
    s.coin = 1; s.coins = ev.coins || 3; s.stopIdx = 0; s.autoT = 0; s.cherries = 0; s.jackpot = false; s.msg = null;
  }
  game.obstacles = [];
  game.items = game.items.filter((i) => !i.bad);
  return s;
}

function finish(game, s, label, value, bonus, frac = null) {
  if (s.result) return;
  s.result = { label, value, bonus: Math.max(0, Math.round(bonus)), rating: frac != null ? rating(frac) : null };
}

// ---------------------------------------------------------------------------
export function updateStory(game, s, dt) {
  const V = game.V;
  s.t += dt;
  if (s.fx?.confetti && Math.floor(s.t * 2) !== Math.floor((s.t - dt) * 2)) game.fx.burst(rand(40, V.w - 40), rand(20, V.groundY * 0.4), { n: 26, type: 'confetti', speed: 220, size: 4, gravity: 280 });
  if (s.fx?.fireworks) fireworks(game, s, dt);
  if (s.fx?.rain && Math.random() < dt * 14) s.parts.push({ e: s.fx.rain, x: rand(0, V.w), y: -20, vy: rand(80, 160), r: rand(-1, 1), vr: rand(-3, 3), s: rand(16, 26) });
  if (s.fx?.hearts && Math.random() < dt * 8) s.parts.push({ e: pick(['❤️', '💕', '💖']), x: rand(V.w * 0.2, V.w * 0.9), y: V.groundY, vy: -rand(50, 90), r: 0, vr: rand(-1, 1), s: rand(14, 22) });
  for (const q of s.parts) { q.y += q.vy * dt; q.r += q.vr * dt; q.vy += (q.g || 0) * dt; q.x += (q.vx || 0) * dt; }
  s.parts = s.parts.filter((q) => q.y < V.h + 40 && q.y > -400);
  for (const q of s.pops) q.t += dt;
  s.pops = s.pops.filter((q) => q.t < 0.9);

  if (s.kind === 'scene' || s.kind === 'fipsplay') {
    s.kimiX = game.p.x;
    if (s.fx?.flashAt != null && s.t >= s.fx.flashAt && !s.flashed) { s.flashed = true; game.flash = 0.9; sfx('fanfare'); for (let i = 0; i < 3; i++) game.fx.burst(rand(60, V.w - 60), rand(30, V.groundY * 0.5), { n: 40, type: 'confetti', speed: 260, size: 4, gravity: 260 }); }
    if (s.ev.kimiOutfits) { let o = null; for (const [t, out] of s.ev.kimiOutfits) if (s.t >= t) o = out; if (o && o !== s.lastOutfit) { s.lastOutfit = o; game.flash = Math.max(game.flash, 0.4); sfx('tap', 6); } s.outfitNow = o ? { ...game.outfit, ...o } : null; }
    for (const a of s.actors || []) {
      if (a.knockAt && s.t >= a.knockAt && !a.knocked) { a.knocked = true; game.shake = 12; game.flash = 0.6; sfx('smash'); sfx('boom'); pop(s, ax(a, s, V), V.groundY - 110, pick(['POW!', 'KAWUMM!', 'BAM!']), '#ffd23f', 30); game.fx.burst(ax(a, s, V), V.groundY - 70, { n: 30, colors: ['#ffd23f', '#fff', '#ff7b39'], speed: 300, size: 4 }); }
    }
    if (s.t >= s.dur) s.done = true;
  } else if (s.kind === 'party') updParty(game, s, dt);
  else if (s.kind === 'escalator') updEscalator(game, s, dt);
  else if (s.kind === 'detector') updDetector(game, s, dt);
  else if (s.kind === 'tapgame') updTap(game, s, dt);
  else if (s.kind === 'throw') updThrow(game, s, dt);
  else if (s.kind === 'slot') updSlot(game, s, dt);
  else if (s.kind === 'candles') {
    if (s.phase === 'intro' && s.t > INTRO) { s.phase = 'play'; s.pt = 0; }
    if (s.phase === 'play') { s.pt += dt; if (s.pt >= s.time || s.out >= s.candles.length) { s.phase = 'end'; s.endT = s.t; sfx('fanfare'); game.flash = 0.6; finish(game, s, s.ev.label || '🎂 Kerzen auspusten', `${s.out}/${s.candles.length}`, s.out * 4 + (s.out >= s.candles.length ? 40 : 0), s.out / s.candles.length); for (let i = 0; i < 4; i++) game.fx.burst(rand(60, V.w - 60), rand(30, V.groundY * 0.5), { n: 40, type: 'confetti', speed: 260, size: 4, gravity: 260 }); } }
    if (s.phase === 'end' && s.t - s.endT > 3) s.done = true;
  }
}

function pop(s, x, y, text, color = '#fff', size = 22) { s.pops.push({ x, y, text, color, size, t: 0 }); }
function bonusItems(game, ev, n) {
  if (!ev.item || n <= 0) return;
  game.stats.items[ev.item] = (game.stats.items[ev.item] || 0) + n;
  game.checkQuest();
}
function fireworks(game, s, dt) {
  const V = game.V;
  if (Math.random() < dt * 3) s.fw.push({ x: rand(V.w * 0.15, V.w * 0.9), y: V.groundY, vy: -rand(260, 360), c: pick(['#ff4fa3', '#ffd23f', '#3ee6b4', '#7cc6ff', '#c77dff']) });
  for (const f of s.fw) {
    f.y += f.vy * dt; f.vy += 160 * dt;
    if (!f.boom && f.vy > -40) { f.boom = true; game.fx.burst(f.x, f.y, { n: 40, colors: [f.c, '#fff'], speed: 220, size: 3, gravity: 90 }); sfx('launch'); }
  }
  s.fw = s.fw.filter((f) => !f.boom);
}

// ---- Party: im Takt tippen ---------------------------------------------------
function beatTime(s, k) { return s.t0 + k * s.beat; }
function updParty(game, s, dt) {
  const V = game.V;
  if (s.phase === 'intro' && s.t >= s.t0 - s.beat * 2) s.phase = 'play';
  if (s.phase === 'play') {
    const k = Math.floor((s.t - s.t0) / s.beat + 0.0001);
    if (k !== s.lastBeat && k >= 0 && k < s.n) { s.lastBeat = k; sfx('kick'); }
    for (let i = 0; i < s.n; i++) if (!s.judged[i] && s.t > beatTime(s, i) + 0.22) { s.judged[i] = 'miss'; s.combo = 0; pop(s, V.w * 0.82, V.groundY * 0.45 + 46, 'verpasst', '#ff8a8a', 13); }
    if (s.t > beatTime(s, s.n - 1) + 0.5) {
      s.phase = 'end'; s.endT = s.t;
      const frac = (s.perfect + s.good * 0.6) / s.n;
      finish(game, s, s.ev.label || '💃 Tanzen', `${s.perfect + s.good}/${s.n} im Takt`, s.perfect * 15 + s.good * 8, frac);
      if (frac >= 0.6) s.fx = { fireworks: 1 };
      sfx('fanfare'); game.flash = 0.6;
      for (let i = 0; i < 4; i++) game.fx.burst(rand(60, V.w - 60), rand(30, V.groundY * 0.5), { n: 40, type: 'confetti', speed: 260, size: 4, gravity: 260 });
    }
  }
  s.kimiPose = s.phase === 'play' ? (Math.floor((s.t - s.t0) / s.beat) % 2 ? 'cheer' : 'jump') : 'cheer';
  if (s.phase === 'end' && s.t - s.endT > 2.8) { s.done = true; duckMusic(false); }
}
function partyTap(game, s) {
  if (s.phase !== 'play') return;
  const V = game.V, tx = V.w * 0.82, ty = V.groundY * 0.45;
  let best = -1, bd = 9;
  for (let i = 0; i < s.n; i++) { if (s.judged[i]) continue; const d = Math.abs(s.t - beatTime(s, i)); if (d < bd) { bd = d; best = i; } }
  if (best < 0 || bd > 0.3) { pop(s, tx, ty - 46, 'zu früh!', '#ffb3b3', 14); return; }
  if (bd <= 0.1) { s.judged[best] = 'perfect'; s.perfect++; s.combo++; pop(s, tx, ty - 46, 'PERFEKT!', '#3ee6b4', 22); sfx('clap', 1); }
  else if (bd <= 0.2) { s.judged[best] = 'good'; s.good++; s.combo++; pop(s, tx, ty - 46, 'GUT!', '#ffd23f', 20); sfx('clap', 0); }
  else { s.judged[best] = 'miss'; s.combo = 0; pop(s, tx, ty - 46, 'daneben', '#ff8a8a', 16); return; }
  s.best = Math.max(s.best, s.combo);
  game.fx.burst(tx, ty, { n: 12 + s.combo * 2, colors: ['#ff4fa3', '#ffd23f', '#3ee6b4', '#fff'], speed: 160 + s.combo * 10, size: 3 });
  if (s.combo % 4 === 0) { pop(s, V.w / 2, V.groundY * 0.55, `🔥 COMBO ×${s.combo}`, '#ff7b39', 26); game.fx.burst(V.w / 2, V.groundY * 0.3, { n: 40, type: 'confetti', speed: 260, size: 4, gravity: 280 }); game.shake = 6; }
}

// ---- Rolltreppe: Hilfe rufen (schnell tippen), dann im richtigen Moment zuschlagen -------
const ESC_W = 280, ESC_H = 215;
function updEscalator(game, s, dt) {
  const V = game.V, p = game.p, X0 = 95;
  s.pt = (s.pt || 0) + dt;
  if (s.phase === 'approach') {
    s.ex -= 260 * dt; s.kimiPose = 'cheer';
    if (s.ex <= p.x + 18) { s.phase = 'push'; s.pt = 0; sfx('hurt'); p.expr = 'shock'; p.exprT = 9; }
  } else if (s.phase === 'push') {
    s.ex -= 150 * dt; p.x = Math.max(62, s.ex - 18); s.kimiPose = 'duck';
    if (p.x <= 62) { s.phase = 'stuck'; s.pt = 0; game.shake = 10; sfx('no'); p.expr = 'sad'; p.exprT = 99; }
  } else if (s.phase === 'stuck') {
    s.kimiPose = 'duck'; game.shake = Math.max(game.shake, 1.5);
    s.help = Math.max(0, s.help - dt * 0.06);
    if (s.help >= 1 || s.pt > 9) { s.callTime = s.pt; s.phase = 'hero'; s.pt = 0; s.hx = -140; s.hy = 170; sfx('launch'); sfx('power'); }
  } else if (s.phase === 'hero') {
    const k = ease(s.pt / 1.0);
    s.hx = lerp(-140, s.ex + 10, k); s.hy = lerp(170, 60, k);
    if (s.pt >= 1.0) { s.phase = 'aim'; s.pt = 0; }
  } else if (s.phase === 'aim') {
    s.hy = 60 + Math.sin(s.t * 10) * 4;
    if (s.pt > 1.6) smashEscalator(game, s, false);
  } else if (s.phase === 'smash') {
    s.knock.x += 520 * dt; s.knock.y += 420 * dt; s.knock.r += 4 * dt;
    s.hy = Math.max(0, s.hy - 300 * dt);
    p.expr = 'happy'; p.exprT = 3; s.kimiPose = 'cheer';
    p.x = lerp(p.x, X0, Math.min(1, dt * 2.2));
    if (s.pt > 2.2) { s.phase = 'leave'; s.pt = 0; }
  } else if (s.phase === 'leave') {
    s.hx += 560 * dt; s.hy += 260 * dt; p.x = lerp(p.x, X0, Math.min(1, dt * 3));
    if (s.pt > 1.1) s.done = true;
  }
}
function smashEscalator(game, s, perfect) {
  const V = game.V;
  s.phase = 'smash'; s.pt = 0; s.knock = { x: 0, y: 0, r: 0 }; s.perfect = perfect;
  game.shake = perfect ? 20 : 14; game.flash = 0.8; sfx('smash'); sfx('boom');
  pop(s, s.ex + 110, V.groundY - 150, perfect ? 'SUPER-POW!!' : 'POW!', '#ffd23f', perfect ? 38 : 30);
  game.fx.burst(s.ex + 80, V.groundY - 70, { n: perfect ? 70 : 40, colors: ['#9aa3ad', '#cfd8dc', '#ffd23f', '#fff'], speed: 360, type: 'rubble', size: 5, gravity: 900, spread: Math.PI, angle: -Math.PI / 2 });
  const fast = clamp(1 - (s.callTime - 2) / 5, 0, 1);
  finish(game, s, '📣 Rettung', perfect ? 'perfekter Schlag' : 'gerettet', 30 + fast * 40 + (perfect ? 50 : 0), (fast + (perfect ? 1 : 0)) / 2);
}
function drawEscalator(g, x, gy, t, rot = 0) {
  g.save();
  if (rot) { g.translate(x + ESC_W / 2, gy - ESC_H / 2); g.rotate(rot); g.translate(-(x + ESC_W / 2), -(gy - ESC_H / 2)); }
  g.fillStyle = '#90a4ae'; g.fillRect(x - 4, gy - 40, 60, 40); g.fillStyle = '#607d8b'; g.fillRect(x - 4, gy - 8, 60, 8);
  g.fillStyle = '#b0bec5'; g.beginPath(); g.moveTo(x, gy); g.lineTo(x + 40, gy); g.lineTo(x + ESC_W, gy - ESC_H + 30); g.lineTo(x + ESC_W, gy - ESC_H); g.lineTo(x + ESC_W - 30, gy - ESC_H); g.lineTo(x, gy - 34); g.closePath(); g.fill();
  g.strokeStyle = '#78909c'; g.lineWidth = 2; g.stroke();
  g.save(); g.beginPath(); g.moveTo(x + 4, gy - 30); g.lineTo(x + ESC_W - 30, gy - ESC_H + 4); g.lineTo(x + ESC_W - 6, gy - ESC_H + 26); g.lineTo(x + 30, gy - 6); g.closePath(); g.clip();
  g.fillStyle = '#546e7a'; g.fillRect(x, gy - ESC_H, ESC_W, ESC_H);
  g.strokeStyle = '#cfd8dc'; g.lineWidth = 3;
  const off = (t * 40) % 16;
  for (let i = -2; i < 22; i++) { const u = i * 16 + off; g.beginPath(); g.moveTo(x + u * 0.84, gy - u * 0.74 - 30); g.lineTo(x + u * 0.84 + 26, gy - u * 0.74 - 6); g.stroke(); }
  g.restore();
  g.strokeStyle = '#212121'; g.lineWidth = 7; g.lineCap = 'round';
  g.beginPath(); g.moveTo(x - 6, gy - 44); g.quadraticCurveTo(x - 16, gy - 30, x - 2, gy - 26); g.moveTo(x - 6, gy - 44); g.lineTo(x + ESC_W - 30, gy - ESC_H - 10); g.lineTo(x + ESC_W + 6, gy - ESC_H - 10); g.stroke();
  g.fillStyle = '#ffd23f'; g.font = '900 12px ui-rounded, system-ui, sans-serif'; g.textAlign = 'center';
  g.save(); g.translate(x + ESC_W * 0.55, gy - ESC_H * 0.5 + 10); g.rotate(-0.72); g.fillText('⚠️ VORSICHT', 0, 0); g.restore();
  g.restore();
}

// ---- Sonde: wischen zum Suchen, tippen zum Graben ---------------------------------
function updDetector(game, s, dt) {
  const V = game.V, p = game.p;
  if (s.phase === 'intro') { if (s.t > 2.4) { s.phase = 'search'; s.st = 0; } return; }
  for (const d of s.digs) d.t += dt;
  if (s.phase === 'search') {
    s.st += dt;
    p.x = clamp(s.dx - 46, 24, V.w - 60); s.kimiPose = s.t - s.lastMove < 0.25 ? 'run' : 'cheer';
    const open = s.items.filter((it) => !it.dug);
    const dist = Math.min(...open.map((it) => Math.abs(s.dx - it.x)));
    s.prox = clamp(1 - dist / (V.w * 0.5), 0, 1);
    s.beepT -= dt;
    if (s.beepT <= 0) { s.beepT = 0.07 + (1 - s.prox) * 0.7; sfx('beep', s.prox); }
    if (s.st > 22) { const ring = s.items.find((it) => it.ring); ring.x = lerp(ring.x, s.dx, dt * 0.4); }
  } else if (s.phase === 'found') {
    s.ft += dt; s.kimiPose = 'cheer'; p.expr = 'happy'; p.exprT = 2;
    if (s.ft > 3.4) s.done = true;
  }
}
function dig(game, s) {
  const V = game.V;
  const it = s.items.find((o) => !o.dug && Math.abs(o.x - s.dx) < 24);
  s.digs.push({ x: s.dx, t: 0, e: it ? it.e : null });
  game.fx.burst(s.dx, V.groundY - 4, { n: 18, colors: ['#6d4c41', '#8d6e63', '#4e342e'], speed: 180, size: 3, gravity: 500, spread: Math.PI * 0.8, angle: -Math.PI / 2 });
  sfx('dig');
  if (!it) { pop(s, s.dx, V.groundY - 70, pick(['Nur Erde 🪱', 'Nix! 🤷‍♀️', 'Ein Regenwurm 🪱']), '#fff', 15); return; }
  it.dug = true;
  if (it.ring) {
    s.phase = 'found'; s.ft = 0; s.rx = it.x; sfx('power'); sfx('fanfare'); game.flash = 0.7;
    try { navigator.vibrate?.([90, 50, 260]); } catch {}
    game.fx.burst(it.x, V.groundY - 10, { n: 50, colors: ['#ffd23f', '#fff', '#111'], speed: 260, size: 3 });
    const fast = clamp(1 - (s.st - 6) / 18, 0, 1);
    finish(game, s, '💍 Ringsuche', `${Math.round(s.st)} s`, 40 + fast * 60 + s.finds * 10, fast);
    bonusItems(game, s.ev, 1);
  } else {
    s.finds++; pop(s, it.x, V.groundY - 80, it.line, '#ffd23f', 15); sfx(it.coin ? 'collect' : 'bad');
    if (it.coin) game.score += 20;
  }
}

// ---- Schultüte: schnell tippen ------------------------------------------------
function updTap(game, s, dt) {
  s.shake = Math.max(0, s.shake - dt * 4);
  if (s.phase === 'intro' && s.t > INTRO) { s.phase = 'play'; s.pt = 0; }
  if (s.phase === 'play') { s.pt += dt; if (s.pt >= s.time) burstCone(game, s); }
  if (s.phase === 'burst' && s.t - s.burstT > 3.2) s.done = true;
}
function burstCone(game, s) {
  const V = game.V, cx = V.w * 0.6, cy = V.groundY - 120;
  s.phase = 'burst'; s.burstT = s.t; sfx('explode'); game.flash = 0.6; game.shake = 8;
  const n = Math.max(10, s.n * 2);
  for (let i = 0; i < n; i++) s.parts.push({ e: pick(s.ev.burst || ['🍬', '🍭', '🍫', '🧸', '✏️']), x: cx, y: cy, vx: rand(-280, 280), vy: -rand(150, 440), g: 520, r: 0, vr: rand(-6, 6), s: rand(16, 26) });
  const frac = clamp(s.n / (s.need * 1.6), 0, 1);
  finish(game, s, s.ev.label || '🎒 Schultüte', `${s.n}× getippt`, Math.min(150, s.n * 4), frac);
  bonusItems(game, s.ev, Math.min(s.ev.bonus || 4, Math.ceil(s.n / 4)));
}

// ---- Schokokuss-Werfen (Köpfe tauchen hinter dem Tisch auf) ----------------------
function updThrow(game, s, dt) {
  const ev = s.ev;
  if (s.phase === 'intro' && s.t > INTRO) { s.phase = 'play'; s.pt = 0; }
  for (const sh of s.shots) sh.t += dt;
  s.shots = s.shots.filter((sh) => sh.t < 0.25);
  for (const h of s.holes) { const q = h.pop; if (!q) continue; q.t += dt; if (q.t > q.life + 0.3) h.pop = null; }
  if (s.phase === 'play') {
    s.pt += dt; s.next -= dt;
    if (s.next <= 0 && s.pt < s.time - 0.5) {
      s.next = lerp(0.75, 0.45, s.pt / s.time);
      const free = s.holes.filter((h) => !h.pop);
      if (free.length) {
        const h = pick(free), decoy = ev.avoid?.length && Math.random() < 0.22, gold = !decoy && Math.random() < 0.12;
        h.pop = { face: decoy ? pick(ev.avoid) : pick(ev.targets), decoy, gold, t: 0, life: lerp(1.0, 0.6, s.pt / s.time), hit: false };
      }
    }
    if (s.pt >= s.time) {
      s.phase = 'end'; s.endT = s.t; sfx('fanfare');
      const frac = clamp(s.hits / 10, 0, 1);
      finish(game, s, ev.label || '🍫 Werfen', `${s.hits} Treffer`, s.hits * 10 - s.oops * 15, frac);
      bonusItems(game, ev, Math.min(ev.bonus || 4, s.hits));
    }
  }
  if (s.phase === 'end' && s.t - s.endT > 3) s.done = true;
}
function throwTap(game, s, x, y) {
  if (s.phase !== 'play') return;
  const V = game.V;
  const h = s.holes.find((o) => Math.abs(V.w * o.x - x) < 38);
  s.shots.push({ x0: game.p.x + 14, y0: V.groundY - 100, x1: x, y1: Math.min(y, V.groundY - 40), t: 0 });
  sfx('jump');
  const q = h?.pop;
  if (q && !q.hit && q.t > 0.06 && q.t < q.life + 0.15) {
    q.hit = true; q.life = Math.min(q.life, q.t + 0.15);
    if (q.decoy) { s.oops++; game.shake = 10; sfx('bad'); pop(s, V.w * h.x, V.groundY - 150, s.ev.oops || 'Doch nicht DIE! 😱', '#ff8a8a', 18); return; }
    const n = q.gold ? 3 : 1; s.hits += n;
    s.face[q.face] = (s.face[q.face] || 0) + n;
    sfx('smash'); pop(s, V.w * h.x, V.groundY - 150, q.gold ? 'GOLD! ×3 ✨' : pick(['PLATSCH!', 'SPLAT!', 'Volltreffer!']), q.gold ? '#ffd23f' : '#fff', q.gold ? 24 : 20);
    game.fx.burst(V.w * h.x, V.groundY - 100, { n: 18, colors: ['#4a2a17', '#e9d8b8', '#7b4a26'], speed: 220, size: 3 });
  } else { s.miss++; pop(s, x, y, 'daneben', '#ffb3b3', 13); }
}

// ---- Spielautomat: im richtigen Moment stoppen, am Ende kommt der Profi ----------
const SYM = ['🍒', '🔔', '7️⃣', '🍋', '⭐', '🍇'];
function updSlot(game, s, dt) {
  const V = game.V, ev = s.ev;
  if (s.phase === 'intro' && s.t > INTRO) s.phase = 'play';
  for (const r of s.reels) {
    if (r.anim) { r.anim.t += dt; const k = ease(r.anim.t / 0.25); r.off = lerp(r.anim.from, r.anim.to, k); if (k >= 1) { r.anim = null; r.stopped = true; } }
    else if (!r.stopped && s.phase !== 'result') r.off += dt * (s.phase === 'lukas' ? 12 : 4.2);
  }
  if (s.phase === 'play') {
    s.autoT += dt;
    if (s.autoT > 3.2) stopReel(game, s);
    if (s.reels.every((r) => r.stopped)) evalSpin(game, s);
  } else if (s.phase === 'result') {
    if (s.t - s.resT > 1.6) {
      if (s.coin < s.coins && !s.jackpot) { s.coin++; s.phase = 'play'; s.stopIdx = 0; s.msg = null; s.autoT = 0; for (const r of s.reels) r.stopped = false; }
      else { s.phase = 'lukas'; s.lt = 0; for (const r of s.reels) r.stopped = false; }
    }
  } else if (s.phase === 'lukas') {
    s.lt += dt;
    if (s.lt > 1.3 && !s.bonked) { s.bonked = true; game.shake = 14; sfx('smash'); pop(s, V.w * 0.6, V.groundY - 210, 'BONK!', '#ffd23f', 26); }
    if (s.lt > 1.6) s.reels.forEach((r, i) => { if (!r.stopped && !r.anim && s.lt > 1.6 + i * 0.35) r.anim = { t: 0, from: r.off, to: Math.ceil(r.off / 6 + 1) * 6 }; });
    if (s.reels.every((r) => r.stopped) && !s.lukasWin) {
      s.lukasWin = true; s.winT = s.t; sfx('fanfare'); game.flash = 0.8;
      finish(game, s, '🎰 Spielautomat', s.jackpot ? 'eigener JACKPOT!' : `${s.cherries} 🍒`, s.cherries * 15 + (s.jackpot ? 100 : 0), s.jackpot ? 1 : s.cherries / 9);
      bonusItems(game, ev, ev.bonus || 3);
    }
    if (s.lukasWin) { if (Math.random() < dt * 22) s.parts.push({ e: '🪙', x: rand(0, V.w), y: -20, vy: rand(140, 240), r: 0, vr: rand(-4, 4), s: rand(16, 24) }); if (s.t - s.winT > 3.6) s.done = true; }
  }
}
function stopReel(game, s) {
  if (s.phase !== 'play' || s.stopIdx >= 3) return;
  const r = s.reels[s.stopIdx++]; s.autoT = 0;
  r.anim = { t: 0, from: r.off, to: Math.round(r.off) };
  sfx('tap', s.stopIdx * 3);
}
function evalSpin(game, s) {
  const V = game.V;
  const res = s.reels.map((r) => SYM[((Math.round(r.off) % 6) + 6) % 6]);
  const ch = res.filter((x) => x === '🍒').length;
  s.cherries += ch; s.phase = 'result'; s.resT = s.t;
  if (ch === 3) { s.jackpot = true; s.msg = 'JACKPOT!!! 🍒🍒🍒'; sfx('fanfare'); game.flash = 0.7; for (let i = 0; i < 30; i++) s.parts.push({ e: '🪙', x: rand(0, V.w), y: -20 - i * 10, vy: rand(140, 240), r: 0, vr: rand(-4, 4), s: 20 }); }
  else if (ch === 2) { s.msg = 'Sooo knapp! 😩'; sfx('cheer'); }
  else if (ch === 1) { s.msg = 'Eine Kirsche 🍒'; sfx('collect'); }
  else { s.msg = 'Niete 😬'; sfx('bad'); }
}

// ---------------------------------------------------------------------------
export function storyInput(game, s, type, x, y) {
  const V = game.V;
  if (s.kind === 'candles' && s.phase === 'play' && (type === 'move' || type === 'down')) {
    for (const c of s.candles) if (c.lit && Math.abs(c.x - x) < 16 && Math.abs(c.y - 12 - y) < 26) { c.lit = false; s.out++; sfx('tap', s.out % 12); game.fx.burst(c.x, c.y - 14, { n: 6, type: 'smoke', colors: ['#ddd', '#fff'], speed: 40, size: 4, gravity: -60 }); }
    return;
  }
  if (s.kind === 'detector' && s.phase === 'search') {
    if (type === 'move' || type === 'down') { const moved = Math.abs(x - s.dx) > 2; s.dx = clamp(x, 20, V.w - 20); if (moved) s.lastMove = s.t; }
    if (type === 'down') { s.downAt = s.t; s.downX = x; }
    if (type === 'up' && s.downAt != null && s.t - s.downAt < 0.4 && Math.abs(x - s.downX) < 16) { s.downAt = null; dig(game, s); }
    return;
  }
  if (type !== 'down') return;
  if (s.kind === 'party') partyTap(game, s);
  else if (s.kind === 'tapgame' && s.phase === 'play') {
    s.n++; s.shake = 1; sfx('tap', s.n % 12);
    const cx = V.w * 0.6, cy = V.groundY - 120;
    s.parts.push({ e: pick(s.ev.burst || ['🍬', '🍭', '🍫']), x: cx + rand(-20, 20), y: cy - 50, vx: rand(-120, 120), vy: -rand(120, 260), g: 520, r: 0, vr: rand(-5, 5), s: 16 });
    if (s.n === s.need) { pop(s, cx, cy - 120, 'VOLL! Weiter = Bonus!', '#3ee6b4', 18); sfx('power'); }
  } else if (s.kind === 'throw') throwTap(game, s, x, y);
  else if (s.kind === 'slot') stopReel(game, s);
  else if (s.kind === 'escalator') {
    if (s.phase === 'stuck') { s.help = Math.min(1, s.help + 0.085); sfx('tap', Math.floor(s.help * 10)); pop(s, game.p.x + rand(-10, 30), V.groundY - 160 - rand(0, 30), pick(['MAMAAA!', 'HILFE!', 'MAMA! 😭']), '#fff', 14); }
    else if (s.phase === 'aim') smashEscalator(game, s, true);
  } else if ((s.kind === 'scene' || s.kind === 'fipsplay') && (s.t > 0.8 || s.skipAny)) s.done = true;
}

// ---------------------------------------------------------------------------
function ax(a, s, V) {
  let x = a.kx != null ? s.kimiX + a.kx : V.w * (a.x ?? 0.6);
  if (a.moves) { const m = a.moves; let i = 0; while (i < m.length - 1 && s.t > m[i + 1][0]) i++; const [t0, x0] = m[i], [t1, x1] = m[Math.min(i + 1, m.length - 1)]; x = V.w * (t1 > t0 ? lerp(x0, x1, clamp((s.t - t0) / (t1 - t0), 0, 1)) : x0); }
  const t0 = a.t0 || 0;
  if (a.from === 'right') x = lerp(V.w + 60, x, ease((s.t - t0) / 0.7));
  if (a.from === 'left') x = lerp(-60, x, ease((s.t - t0) / 0.7));
  if (a.knocked) x += (s.t - a.knockAt) * 520;
  return x;
}
function bubble(g, x, y, text, col = '#222') {
  g.font = '800 12px ui-rounded, system-ui, sans-serif';
  const w = Math.min(210, g.measureText(text).width + 18);
  x = Math.max(x, w / 2 + 4);
  g.fillStyle = '#fff'; roundRect(g, x - w / 2, y - 20, w, 26, 11); g.fill();
  g.beginPath(); g.moveTo(x - 6, y + 5); g.lineTo(x, y + 14); g.lineTo(x + 6, y + 5); g.fill();
  g.fillStyle = col; g.textAlign = 'center'; g.fillText(text, x, y - 2, w - 12);
}
function banner(g, V, text, t, big = false, y = null) {
  const pulse = 1 + Math.sin(t * 8) * 0.05;
  const size = Math.min(big ? 44 : 24, V.w / (big ? 9 : 16));
  g.save(); g.translate(V.w / 2, y ?? Math.max(54, V.groundY * 0.24)); g.scale(pulse, pulse);
  g.font = `900 ${size}px ui-rounded, system-ui, sans-serif`; g.textAlign = 'center'; g.textBaseline = 'middle';
  g.lineWidth = size * 0.22; g.strokeStyle = 'rgba(40,10,50,0.85)'; g.strokeText(text, 0, 0, V.w - 30);
  g.fillStyle = big ? `hsl(${(t * 300) % 360},95%,65%)` : '#fff'; g.fillText(text, 0, 0, V.w - 30);
  g.restore();
}
/** animierte Hand, die die Geste vormacht */
function hand(g, x, y, t, gesture = 'tap') {
  let dx = 0, sc = 1;
  if (gesture === 'tap') sc = 1 - Math.max(0, Math.sin(t * 9)) * 0.22;
  if (gesture === 'swipe') dx = Math.sin(t * 3) * 60;
  if (gesture === 'mash') sc = 1 - Math.abs(Math.sin(t * 18)) * 0.25;
  g.save();
  if (gesture !== 'swipe') { g.strokeStyle = 'rgba(255,255,255,0.7)'; g.lineWidth = 2; const k = (t * 1.6) % 1; g.globalAlpha = 1 - k; g.beginPath(); g.arc(x, y - 18, 8 + k * 22, 0, 7); g.stroke(); }
  g.globalAlpha = 0.95;
  emoji(g, '👆', x + dx, y + 6, 40 * sc);
  g.restore();
}
function resultBanner(g, V, s) {
  if (!s.result?.rating) return;
  banner(g, V, s.result.rating, s.t, true);
  g.font = '900 16px ui-rounded, system-ui, sans-serif'; g.textAlign = 'center'; g.fillStyle = '#ffd23f';
  g.lineWidth = 4; g.strokeStyle = 'rgba(0,0,0,0.6)';
  const txt = `+${s.result.bonus} Bonus`, y = Math.max(54, V.groundY * 0.24) + 34;
  g.strokeText(txt, V.w / 2, y); g.fillText(txt, V.w / 2, y);
}

function disco(g, V, t, power = 1) {
  g.fillStyle = 'rgba(10,0,25,0.5)'; g.fillRect(0, 0, V.w, V.h);
  g.save(); g.globalCompositeOperation = 'lighter';
  const cols = ['rgba(255,60,160,', 'rgba(60,255,190,', 'rgba(100,170,255,', 'rgba(255,220,60,'];
  for (let i = 0; i < 5; i++) {
    const sx = V.w * (0.1 + i * 0.2), a = Math.sin(t * (1.6 + i * 0.4) * (0.7 + power * 0.5) + i * 2) * 0.7;
    g.fillStyle = cols[i % 4] + (0.16 + power * 0.18) + ')'; g.beginPath(); g.moveTo(sx, 0); g.lineTo(sx + Math.sin(a - 0.14) * V.groundY * 1.4, V.groundY + 20); g.lineTo(sx + Math.sin(a + 0.14) * V.groundY * 1.4, V.groundY + 20); g.fill();
  }
  g.restore();
  if (power > 0.6 && Math.floor(t * 8) % 3 === 0) { g.fillStyle = `hsla(${(t * 400) % 360},100%,60%,${0.08 + power * 0.1})`; g.fillRect(0, 0, V.w, V.h); }
  const bx = V.w / 2, by = 24;
  g.strokeStyle = '#ccc'; g.lineWidth = 1; g.beginPath(); g.moveTo(bx, 0); g.lineTo(bx, by - 14); g.stroke();
  const gr = g.createRadialGradient(bx - 4, by - 4, 2, bx, by, 16); gr.addColorStop(0, '#fff'); gr.addColorStop(1, '#8a9aa8');
  g.fillStyle = gr; g.beginPath(); g.arc(bx, by, 16, 0, 7); g.fill();
  for (let i = 0; i < 10; i++) { const a = i / 10 * 6.28 + t * 3; g.fillStyle = `hsl(${(i * 50 + t * 200) % 360},100%,75%)`; g.fillRect(bx + Math.cos(a) * 9 - 1.5, by + Math.sin(a) * 9 - 1.5, 3, 3); }
}

function drawActor(g, game, s, a, i, extra = {}) {
  const V = game.V, t0 = a.t0 || 0;
  if (s.t < t0) return;
  if (a.t1 && s.t > a.t1 + 0.8) return;
  const lt = s.t - t0;
  let x = ax(a, s, V);
  if (a.t1 && s.t > a.t1) x += (s.t - a.t1) * (a.exit === 'left' ? -500 : 500);
  let y = V.groundY - 6, rot = 0;
  const anim = extra.anim || a.anim || 'wave', amp = extra.amp ?? 1;
  if (anim === 'dance') { y -= Math.abs(Math.sin(lt * 7 + i)) * 12 * amp; rot = Math.sin(lt * 3.5 + i) * 0.18 * amp; }
  if (anim === 'line') { x += (extra.step ?? 0) * 16; y -= (extra.hop ?? 0) * 10; rot = (extra.step ?? 0) * 0.1; }
  if (anim === 'hop') y -= Math.abs(Math.sin(lt * 6 + i)) * 10;
  if (anim === 'shake') x += Math.sin(lt * 40) * 2.5;
  if (anim === 'twerk') rot = Math.sin(lt * 22) * 0.22;
  if (anim === 'solo') { y -= Math.abs(Math.sin(lt * 10)) * 26; rot = Math.sin(lt * 5) * 0.4; }
  if (a.knocked) { rot = (s.t - a.knockAt) * 9; y -= (s.t - a.knockAt) * 300; }
  if (a.yUp) y -= a.yUp;
  const sc = (a.scale || 1) * SC;
  g.save(); g.translate(x, y - 40); g.rotate(rot); g.translate(-x, -(y - 40));
  if (a.rollator) { drawRollatorOma(g, x, y + 6, { t: s.t, scale: 0.95 * 1.05 }); if (a.moves && s.t > a.moves[a.moves.length - 1][0] - 1) game.fx.list.push({ x: x - 40, y: y - 16, vx: -60, vy: rand(-10, 10), life: 0.6, max: 0.6, color: 'rgba(200,200,200,0.8)', size: 4, gravity: -20, type: 'smoke', rot: 0, vr: 0, drag: 1 }); }
  else if (a.big) emoji(g, a.big, x, y - 34 * (a.scale || 1), 70 * (a.scale || 1), 0, !!a.flip);
  else if (a.cat) {
    const salto = anim === 'salto' ? (lt % 1.6) : 0, jy = anim === 'salto' ? Math.sin(Math.min(1, salto / 0.9) * Math.PI) * 60 : 0;
    const cy = y - jy - 18;
    g.save(); g.translate(x, cy); g.rotate(anim === 'salto' && salto < 0.9 ? -salto / 0.9 * Math.PI * 2 : 0); g.translate(-x, -cy);
    drawCat(g, x, y - jy + 6, { phase: s.t * 14, scale: 1.1 * (a.scale || 1), t: s.t, pose: anim === 'sit' ? 'sit' : 'run' });
    g.restore();
  } else if (a.hero) {
    const k = clamp((s.t - t0) / ((a.arrive || t0 + 1) - t0), 0, 1);
    const hy = a.from === 'top' ? lerp(-200, 0, ease(k)) : 0;
    drawHero(g, x, y - hy, { pose: k < 1 ? 'fly' : 'land', t: s.t, scale: 0.95 * 1.18, costume: COSTUMES[a.costume] || null, faceKey: a.face });
  } else {
    drawPerson(g, x, y, { faceKey: a.face, emojiHead: a.emoji, t: s.t + i, color: a.color, scale: sc, wave: anim !== 'twerk', pet: a.pet, oma: a.oma, run: anim === 'run', acc: a.acc });
  }
  if (a.prop && (!a.propT || s.t >= a.propT) && (!a.propEnd || s.t < a.propEnd)) emoji(g, a.prop, x + 16, y - (a.pet ? 18 : 60), 20);
  g.restore();
  for (const [st, en, txt] of a.says || []) if (s.t >= st && s.t <= en) bubble(g, x, y - (a.pet ? 62 : a.rollator ? 120 : a.big ? 80 : 140) * (a.scale || 1), txt);
}

export function drawStoryBack(g, game, s) {
  const V = game.V;
  if (s.kind === 'party') disco(g, V, s.t, s.phase === 'end' ? 1 : clamp(0.3 + (s.combo || 0) * 0.08, 0, 1));
  else if (s.fx?.disco) disco(g, V, s.t);
  if (s.fx?.dim && (s.fx.dimUntil == null || s.t < s.fx.dimUntil)) { g.fillStyle = `rgba(0,0,0,${s.fx.dim})`; g.fillRect(0, 0, V.w, V.h); }
  if (s.fx?.tint && s.t >= (s.fx.tintFrom || 0)) { g.fillStyle = s.fx.tint; g.fillRect(0, 0, V.w, V.h); }
}

export function drawStory(g, game, s) {
  const V = game.V, ev = s.ev, gy = V.groundY;
  if (s.kind === 'scene') (s.actors || []).forEach((a, i) => drawActor(g, game, s, a, i));
  else if (s.kind === 'party') drawParty(g, game, s);
  else if (s.kind === 'fipsplay') drawFipsPlay(g, game, s);
  else if (s.kind === 'escalator') drawEsc(g, game, s);
  else if (s.kind === 'detector') drawDetector(g, game, s);
  else if (s.kind === 'tapgame') drawTap(g, game, s);
  else if (s.kind === 'throw') drawThrow(g, game, s);
  else if (s.kind === 'slot') drawSlot(g, game, s);
  else if (s.kind === 'candles') drawCandles(g, game, s);
  for (const q of s.parts) emoji(g, q.e, q.x, q.y, q.s, q.r);
  for (const q of s.pops) {
    const k = q.t / 0.9;
    g.save(); g.globalAlpha = 1 - k * k; g.font = `900 ${q.size}px ui-rounded, system-ui, sans-serif`; g.textAlign = 'center';
    g.lineWidth = 4; g.strokeStyle = 'rgba(30,10,40,0.8)'; g.strokeText(q.text, q.x, q.y - k * 30); g.fillStyle = q.color; g.fillText(q.text, q.x, q.y - k * 30);
    g.restore();
  }
  if (s.fx?.banner && s.t < (s.fx.bannerEnd || 2.2)) banner(g, V, s.fx.banner, s.t, false);
  if (ev.endBanner && s.t > (ev.endBannerAt || s.dur - 1.6)) banner(g, V, ev.endBanner, s.t, true);
  if (s.kind === 'scene') {
    const kx = game.p.x, ky = gy - game.p.y;
    if (ev.kimiProp) emoji(g, ev.kimiProp, kx + 18, ky - 70, 24);
    if (ev.kimiHat) emoji(g, ev.kimiHat, kx + 2, ky - 132, 30);
    if (ev.kimiFx === 'zzz') for (let i = 0; i < 3; i++) { const k = (s.t * 0.6 + i / 3) % 1; g.globalAlpha = 1 - k; emoji(g, '💤', kx + 20 + k * 30, ky - 90 - k * 50, 14 + k * 10); g.globalAlpha = 1; }
    for (const [st, en, txt] of ev.kimiSays || []) if (s.t >= st && s.t <= en) bubble(g, kx + 8, ky - 140, txt, '#c2185b');
  }
  if (ev.cinema) {
    const k = clamp(Math.min(s.t, s.dur - s.t) / 0.35, 0, 1), bh = V.h * 0.09 * k;
    g.fillStyle = '#000'; g.fillRect(0, 0, V.w, bh); g.fillRect(0, V.h - bh, V.w, bh);
  }
  if ((s.kind === 'scene' || s.kind === 'fipsplay') && (s.t > 0.8 || s.skipAny)) { g.globalAlpha = 0.5 + Math.sin(s.t * 4) * 0.25; g.fillStyle = '#fff'; g.font = '800 11px ui-rounded, system-ui, sans-serif'; g.textAlign = 'right'; g.fillText('⏩ Tippen zum Überspringen', V.w - 12, V.h - 10); g.globalAlpha = 1; }
}

function drawParty(g, game, s) {
  const V = game.V, gy = V.groundY, style = s.ev.style;
  const beatF = s.phase === 'play' || s.phase === 'end' ? ((s.t - s.t0) / s.beat) : 0;
  const onBeat = Math.max(0, 1 - (beatF - Math.floor(beatF)) * 4);
  const amp = s.phase === 'end' ? 1.4 : clamp(0.35 + (s.combo || 0) * 0.12, 0, 1.5);
  const step = Math.floor(beatF) % 2 ? 1 : -1;
  s.actors.forEach((a, i) => {
    const solo = s.phase === 'play' && Math.floor(beatF) >= s.solo && Math.floor(beatF) < s.solo + 2 && i === s.solo % s.actors.length;
    drawActor(g, game, s, a, i, style === 'line' ? { anim: 'line', step, hop: onBeat } : { anim: solo ? 'solo' : 'dance', amp });
    if (solo) bubble(g, ax(a, s, V), gy - 168, 'SOLO! 🕺');
  });
  const fx = game.p.x + 52, jy = Math.abs(Math.sin(beatF * Math.PI)) * 22 * amp;
  drawCat(g, fx, gy - jy + 4, { phase: s.t * 10, scale: 1.05, t: s.t, pose: 'sit' });
  if (style === 'wedding' && Math.random() < 0.3) s.parts.push({ e: pick(['❤️', '💕', '💍']), x: rand(V.w * 0.2, V.w * 0.9), y: gy, vy: -rand(50, 90), r: 0, vr: 0, s: 18 });
  const tx = V.w * 0.82, ty = V.groundY * 0.45;
  if (s.phase === 'intro') {
    banner(g, V, s.ev.text || 'PARTY TIME! 🪩', s.t, true);
    hand(g, tx, ty + 30, s.t, 'tap');
    g.fillStyle = '#fff'; g.font = '800 13px ui-rounded, system-ui, sans-serif'; g.textAlign = 'center'; g.fillText('im Takt tippen!', tx, ty + 70);
  }
  if (s.phase === 'play') {
    banner(g, V, s.ev.text || 'PARTY TIME! 🪩', s.t, false, 34);
    g.fillStyle = 'rgba(0,0,0,0.35)'; g.beginPath(); g.arc(tx, ty, 30, 0, 7); g.fill();
    g.strokeStyle = '#fff'; g.lineWidth = 4; g.beginPath(); g.arc(tx, ty, 26, 0, 7); g.stroke();
    emoji(g, style === 'line' ? '🤠' : style === 'wedding' ? '💍' : '🪩', tx, ty, 26 + onBeat * 8);
    for (let i = 0; i < s.n; i++) {
      if (s.judged[i]) continue;
      const dtb = beatTime(s, i) - s.t;
      if (dtb < -0.2 || dtb > s.beat * 2) continue;
      const r = 26 + Math.max(0, dtb) / (s.beat * 2) * 80;
      g.strokeStyle = Math.abs(dtb) < 0.1 ? '#3ee6b4' : 'rgba(255,255,255,0.85)'; g.lineWidth = 3; g.beginPath(); g.arc(tx, ty, r, 0, 7); g.stroke();
    }
    g.fillStyle = '#fff'; g.font = '900 14px ui-rounded, system-ui, sans-serif'; g.textAlign = 'center';
    if (s.combo > 1) g.fillText(`Combo ×${s.combo}`, tx, ty + 50);
    g.fillText(`🎵 ${s.n - s.judged.filter(Boolean).length}`, tx, ty - 44);
  }
  if (s.phase === 'end') resultBanner(g, V, s);
}

function drawFipsPlay(g, game, s) {
  const V = game.V, gy = V.groundY;
  const fx = lerp(-40, V.w + 60, s.t / s.dur);
  const jumpK = (s.t * 1.6) % 1, jy = Math.sin(jumpK * Math.PI) * 50;
  g.save(); const cy = gy - jy - 18; g.translate(fx, cy); g.rotate(-jumpK * Math.PI * 2); g.translate(-fx, -cy);
  drawCat(g, fx, gy - jy + 4, { phase: s.t * 16, scale: 1.15, t: s.t });
  g.restore();
  s.dogs.forEach((d, i) => {
    const dx = fx - 70 - i * 62 + Math.sin(s.t * 3 + i) * 8, hop = Math.abs(Math.sin(s.t * 9 + i)) * 10;
    drawPerson(g, dx, gy - hop, { faceKey: d.face, t: s.t + i, pet: true, scale: 1.1 });
    if (Math.floor(s.t * 1.3 + i) % 3 === 0) bubble(g, dx + 6, gy - 70, 'Wuff! 🐾');
  });
}

function drawEsc(g, game, s) {
  const V = game.V, gy = V.groundY, p = game.p;
  if (s.knock) drawEscalator(g, s.ex + s.knock.x, gy - s.knock.y, s.t, s.knock.r);
  else drawEscalator(g, s.ex, gy, s.t);
  if (s.phase === 'push') bubble(g, p.x + 10, gy - 150, 'Hä?! 😨');
  if (s.phase === 'stuck') {
    for (let i = 0; i < 2; i++) { const k = (s.t * 1.5 + i * 0.5) % 1; emoji(g, '💧', p.x + 8 + i * 10, gy - 112 + k * 30, 10); }
    bubble(g, p.x + 10, gy - 150, s.ev.ouch || 'AUA!!! 😭');
    const mx = V.w * 0.5 - 90, my = Math.max(70, gy * 0.3);
    g.fillStyle = 'rgba(0,0,0,0.5)'; roundRect(g, mx - 6, my - 30, 192, 50, 12); g.fill();
    g.fillStyle = '#fff'; g.font = '900 13px ui-rounded, system-ui, sans-serif'; g.textAlign = 'center'; g.fillText('📣 HILFE RUFEN!', mx + 90, my - 12);
    g.fillStyle = 'rgba(255,255,255,0.2)'; roundRect(g, mx, my, 180, 12, 6); g.fill();
    g.fillStyle = `hsl(${s.help * 120},90%,55%)`; roundRect(g, mx, my, Math.max(1, 180 * s.help), 12, 6); g.fill();
    hand(g, V.w * 0.5 + 120, my + 10, s.t, 'mash');
  }
  if (s.hx != null && ['hero', 'aim', 'smash', 'leave'].includes(s.phase)) {
    const pose = s.phase === 'smash' ? 'punch' : 'fly';
    drawHero(g, s.hx, gy - s.hy, { pose, t: s.t, scale: 0.95 * 1.25, costume: COSTUMES[s.ev.costume || 'fan'] || null, faceKey: s.ev.face });
    if (s.phase === 'aim') { banner(g, V, 'JETZT! 👊', s.t, true); hand(g, s.ex + 120, gy - 90, s.t, 'tap'); }
    if (s.phase === 'smash') bubble(g, s.hx, gy - s.hy - 120, s.ev.heroLine || 'Ich rette dich!');
  }
  if (s.phase === 'leave' || (s.phase === 'smash' && s.pt > 0.8)) resultBanner(g, V, s);
}

function drawCone(g) {
  const cols = ['#e53935', '#fdd835', '#1e88e5', '#43a047', '#8e24aa'];
  g.save();
  g.beginPath(); g.moveTo(-38, -46); g.lineTo(38, -46); g.lineTo(0, 70); g.closePath(); g.clip();
  for (let i = 0; i < 8; i++) { g.fillStyle = cols[i % 5]; g.beginPath(); g.moveTo(-60 + i * 18, -50); g.lineTo(-42 + i * 18, -50); g.lineTo(40 + i * 18 - 70, 80); g.lineTo(22 + i * 18 - 70, 80); g.fill(); }
  g.restore();
  g.strokeStyle = '#2a1830'; g.lineWidth = 2; g.beginPath(); g.moveTo(-38, -46); g.lineTo(38, -46); g.lineTo(0, 70); g.closePath(); g.stroke();
  g.fillStyle = '#66bb6a'; g.beginPath(); g.moveTo(-40, -46);
  for (let i = 0; i <= 8; i++) g.lineTo(-40 + i * 10, -62 - (i % 2) * 12);
  g.lineTo(40, -46); g.closePath(); g.fill();
  g.fillStyle = '#e53935'; g.fillRect(-12, -66, 24, 6); emoji(g, '⭐', 0, -10, 22);
}
function drawTap(g, game, s) {
  const V = game.V, gy = V.groundY, cx = V.w * 0.6, cy = gy - 120;
  if (s.phase !== 'burst') {
    const sc = 1 + Math.min(s.n, s.need * 2) * 0.03, sh = Math.sin(s.t * 60) * s.shake * 6;
    g.save(); g.translate(cx + sh, cy); g.scale(sc, sc); drawCone(g); g.restore();
    if (s.phase === 'intro') { banner(g, V, s.ev.text || '🎒 Schnell tippen!', s.t); hand(g, cx + 60, cy + 30, s.t, 'mash'); }
    else {
      const k = 1 - s.pt / s.time;
      g.fillStyle = 'rgba(0,0,0,0.4)'; roundRect(g, cx - 80, cy + 82, 160, 12, 6); g.fill();
      g.fillStyle = k > 0.3 ? '#3ee6b4' : '#ff5b5b'; roundRect(g, cx - 80, cy + 82, Math.max(1, 160 * k), 12, 6); g.fill();
      g.fillStyle = '#fff'; g.font = '900 24px ui-rounded, system-ui, sans-serif'; g.textAlign = 'center';
      g.lineWidth = 4; g.strokeStyle = 'rgba(0,0,0,0.5)'; const txt = s.n >= s.need ? `${s.n} 🔥` : `${s.n} / ${s.need}`;
      g.strokeText(txt, cx, cy - 92); g.fillText(txt, cx, cy - 92);
    }
  } else {
    resultBanner(g, V, s);
    if (s.ev.face && s.t - s.burstT > 0.9) {
      const k = ease((s.t - s.burstT - 0.9) / 0.5), x = lerp(V.w + 60, V.w * 0.82, k);
      drawPerson(g, x, gy - 6, { faceKey: s.ev.face, t: s.t, color: '#3ea37a', scale: SC });
      g.save(); g.translate(x + 26, gy - 70); g.scale(0.55, 0.55); drawCone(g); g.restore();
      if (s.ev.faceLine && s.t - s.burstT > 1.4) bubble(g, x, gy - 140, s.ev.faceLine);
    }
  }
}

function drawThrow(g, game, s) {
  const V = game.V, gy = V.groundY, top = gy - 64;
  for (const h of s.holes) {
    const x = V.w * h.x, q = h.pop;
    if (!q) continue;
    const up = q.t < 0.15 ? q.t / 0.15 : q.t > q.life ? Math.max(0, 1 - (q.t - q.life) / 0.25) : 1;
    g.save(); g.beginPath(); g.rect(x - 60, 0, 120, top + 2); g.clip();
    const yy = top + 110 - up * 110;
    if (q.gold) { const gl = g.createRadialGradient(x, yy - 90, 4, x, yy - 90, 50); gl.addColorStop(0, 'rgba(255,220,60,0.8)'); gl.addColorStop(1, 'rgba(255,220,60,0)'); g.fillStyle = gl; g.beginPath(); g.arc(x, yy - 90, 50, 0, 7); g.fill(); }
    drawPerson(g, x, yy, { faceKey: q.face, t: s.t, color: q.decoy ? '#d55b8f' : '#5b7bd5', scale: SC * 1.1, expr: q.hit ? 'sad' : 'happy', wave: !q.hit });
    const n = s.face[q.face] || 0;
    g.fillStyle = 'rgba(74,42,23,0.92)';
    for (let k = 0; k < Math.min(n, 7); k++) { g.beginPath(); g.arc(x + Math.sin(k * 2.3) * 9, yy - 100 + Math.cos(k * 1.7) * 9, 5 + (k % 2) * 2.5, 0, 7); g.fill(); }
    if (q.decoy) emoji(g, '🚫', x + 24, yy - 124, 18);
    g.restore();
  }
  g.fillStyle = '#8d6e63'; g.fillRect(V.w * 0.34, top, V.w * 0.64, 70); g.fillStyle = '#fafafa'; g.fillRect(V.w * 0.34, top - 6, V.w * 0.64, 10);
  for (let i = 0; i < 12; i++) { g.fillStyle = i % 2 ? '#ff6fae' : '#7cc6ff'; g.fillRect(V.w * 0.34 + i * V.w * 0.0533, top + 4, V.w * 0.0533, 8); }
  emoji(g, '🎂', V.w * 0.66, top - 14, 26);
  for (const sh of s.shots) {
    const k = clamp(sh.t / 0.18, 0, 1), x = lerp(sh.x0, sh.x1, k), y = lerp(sh.y0, sh.y1, k) - Math.sin(k * Math.PI) * 40;
    g.fillStyle = '#4a2a17'; g.beginPath(); g.ellipse(x, y, 7, 9, k * 6, 0, 7); g.fill();
  }
  if (s.phase === 'intro') { banner(g, V, s.ev.text || '🍫 Tippe auf die Köpfe!', s.t); hand(g, V.w * 0.6, top - 40, s.t, 'tap'); }
  if (s.phase === 'play') {
    const k = 1 - s.pt / s.time;
    g.fillStyle = 'rgba(0,0,0,0.4)'; roundRect(g, V.w / 2 - 90, 40, 180, 10, 5); g.fill();
    g.fillStyle = k > 0.3 ? '#3ee6b4' : '#ff5b5b'; roundRect(g, V.w / 2 - 90, 40, Math.max(1, 180 * k), 10, 5); g.fill();
    g.fillStyle = '#fff'; g.font = '900 18px ui-rounded, system-ui, sans-serif'; g.textAlign = 'center'; g.fillText(`🍫 ${s.hits}`, V.w / 2, 72);
  }
  if (s.phase === 'end') {
    resultBanner(g, V, s);
    (s.ev.targets || []).forEach((f, i) => {
      const x = V.w * (0.55 + i * 0.22), y = gy - 6;
      drawPerson(g, x, y, { faceKey: f, t: s.t, color: '#5b7bd5', scale: SC * 1.1, expr: 'sad' });
      const n = s.face[f] || 0; g.fillStyle = 'rgba(74,42,23,0.92)';
      for (let k = 0; k < Math.min(n, 7); k++) { g.beginPath(); g.arc(x + Math.sin(k * 2.3) * 9, y - 100 + Math.cos(k * 1.7) * 9, 5 + (k % 2) * 2.5, 0, 7); g.fill(); }
      if (i === 0 && s.ev.endLine) bubble(g, x, y - 150, s.ev.endLine);
    });
  }
}

function drawDetector(g, game, s) {
  const V = game.V, gy = V.groundY, ev = s.ev;
  if (s.phase === 'intro') {
    if (ev.face) { drawPerson(g, V.w * 0.66, gy - 6, { faceKey: ev.face, t: s.t, color: '#8e5aa8', scale: SC, expr: 'sad' }); bubble(g, V.w * 0.66, gy - 140, ev.line || 'Mein Ring!!'); }
    for (const [i, f] of (ev.helpers || []).entries()) drawPerson(g, V.w * (0.8 + i * 0.1), gy - 6, { faceKey: f, t: s.t + i, color: COLORS[i], scale: SC });
    if (s.t > 1.2) banner(g, V, '🔎 Such den Ring!', s.t);
    return;
  }
  g.fillStyle = 'rgba(0,0,0,0.3)'; g.fillRect(0, 0, V.w, gy - 40);
  for (const d of s.digs) { g.fillStyle = '#5d4037'; g.beginPath(); g.ellipse(d.x, gy + 2, 16, 5, 0, 0, 7); g.fill(); if (d.e && d.e !== '💍' && d.t < 1.4) emoji(g, d.e, d.x, gy - 10 - Math.min(1, d.t * 3) * 40, 26); }
  const x = s.dx, prox = s.prox || 0;
  if (s.phase === 'search') {
    g.strokeStyle = '#424242'; g.lineWidth = 4; g.beginPath(); g.moveTo(x - 30, gy - 92); g.lineTo(x, gy - 10); g.stroke();
    g.fillStyle = '#212121'; roundRect(g, x - 44, gy - 104, 26, 16, 4); g.fill();
    g.fillStyle = prox > 0.9 ? '#ff1744' : prox > 0.65 ? '#ffd23f' : '#3ee6b4'; g.beginPath(); g.arc(x - 31, gy - 96, 4 + (Math.floor(s.t * (2 + prox * 14)) % 2) * 2, 0, 7); g.fill();
    g.strokeStyle = '#b0bec5'; g.lineWidth = 4; g.beginPath(); g.ellipse(x, gy - 6, 20, 6, 0, 0, 7); g.stroke();
    g.strokeStyle = `rgba(62,230,180,${0.3 + prox * 0.6})`; g.lineWidth = 2;
    for (let i = 0; i < 3; i++) { const k = (s.t * (1 + prox * 3) + i / 3) % 1; g.beginPath(); g.ellipse(x, gy - 6, 20 + k * 30, 6 + k * 9, 0, 0, 7); g.globalAlpha = 1 - k; g.stroke(); }
    g.globalAlpha = 1;
    const mx = V.w - 120, my = 74;
    g.fillStyle = 'rgba(0,0,0,0.5)'; roundRect(g, mx - 10, my - 26, 120, 52, 10); g.fill();
    for (let i = 0; i < 8; i++) { g.fillStyle = i / 8 < prox ? `hsl(${120 - i * 15},90%,55%)` : 'rgba(255,255,255,0.15)'; g.fillRect(mx + i * 12, my + 10 - i * 3, 9, 8 + i * 3); }
    g.fillStyle = '#fff'; g.font = '800 11px ui-rounded, system-ui, sans-serif'; g.textAlign = 'left';
    g.fillText(prox > 0.92 ? '🔥 HEISS! Tippen!' : prox > 0.7 ? 'warm…' : prox > 0.45 ? 'lauwarm' : 'kalt ❄️', mx, my - 10);
    if (s.st < 4.5) { hand(g, V.w * 0.5, gy - 60, s.t, s.st < 2.4 ? 'swipe' : 'tap'); banner(g, V, s.st < 2.4 ? 'Wischen = suchen' : 'Tippen = graben', s.t); }
  }
  if (s.phase === 'found') {
    const k = clamp(s.ft / 0.8, 0, 1), rx = s.rx, ry = gy - 10 - k * 90;
    const gl = g.createRadialGradient(rx, ry, 2, rx, ry, 40); gl.addColorStop(0, 'rgba(255,240,150,0.9)'); gl.addColorStop(1, 'rgba(255,240,150,0)');
    g.fillStyle = gl; g.beginPath(); g.arc(rx, ry, 40, 0, 7); g.fill();
    g.strokeStyle = '#111'; g.lineWidth = 6; g.beginPath(); g.ellipse(rx, ry, 14, 14 * Math.abs(Math.cos(s.ft * 3)) + 3, 0, 0, 7); g.stroke();
    if (ev.face && s.ft > 0.6) {
      const kk = ease((s.ft - 0.6) / 0.5), fx = lerp(V.w + 60, Math.min(V.w - 60, rx + 70), kk);
      drawPerson(g, fx, gy - 6 - Math.abs(Math.sin(s.t * 7)) * 12, { faceKey: ev.face, t: s.t, color: '#8e5aa8', scale: SC });
      if (s.ft > 1.1) bubble(g, fx, gy - 142, ev.found || 'Danke!!');
    }
    if (s.ft > 1.6) resultBanner(g, V, s);
  }
}

function drawSlot(g, game, s) {
  const V = game.V, gy = V.groundY, cx = V.w * 0.6, top = gy - 200, ev = s.ev;
  const shake = s.phase === 'lukas' && s.lt > 1.2 && s.lt < 1.6 ? Math.sin(s.t * 80) * 5 : 0;
  g.save(); g.translate(shake, 0);
  g.fillStyle = '#6a1b9a'; roundRect(g, cx - 120, top, 240, 190, 18); g.fill();
  g.strokeStyle = '#ffd23f'; g.lineWidth = 5; g.stroke();
  for (let i = 0; i < 14; i++) { g.fillStyle = (Math.floor(s.t * (s.jackpot || s.lukasWin ? 16 : 6)) + i) % 2 ? '#ffd23f' : '#ff4fa3'; g.beginPath(); g.arc(cx - 110 + i * 17, top + 8, 4, 0, 7); g.fill(); }
  g.fillStyle = '#fff'; g.font = '900 15px ui-rounded, system-ui, sans-serif'; g.textAlign = 'center'; g.fillText(`🎰 Münze ${Math.min(s.coin, s.coins)}/${s.coins}`, cx, top + 34);
  s.reels.forEach((r, i) => {
    const x = cx - 74 + i * 74, y = top + 60;
    g.fillStyle = '#fff'; roundRect(g, x - 30, y, 60, 76, 8); g.fill();
    g.save(); g.beginPath(); g.rect(x - 30, y, 60, 76); g.clip();
    const k = Math.floor(r.off), f = r.off - k;
    for (let j = -1; j <= 1; j++) emoji(g, SYM[((k - j) % 6 + 6) % 6], x, y + 38 + (j + f) * 46, 34);
    g.restore();
    if (r.stopped) { g.strokeStyle = '#3ee6b4'; g.lineWidth = 3; roundRect(g, x - 30, y, 60, 76, 8); g.stroke(); }
  });
  g.strokeStyle = 'rgba(255,60,60,0.8)'; g.lineWidth = 2; g.beginPath(); g.moveTo(cx - 108, top + 98); g.lineTo(cx + 108, top + 98); g.stroke();
  g.restore();
  if (s.phase === 'intro') { banner(g, V, '🍒 Stopp bei der Kirsche!', s.t); hand(g, cx, top + 150, s.t, 'tap'); }
  if (s.phase === 'play' && s.stopIdx === 0 && s.coin === 1) hand(g, cx + 130, top + 150, s.t, 'tap');
  if (s.phase === 'result' && s.msg) banner(g, V, s.msg, s.t, s.jackpot);
  if (s.phase === 'lukas') {
    const k = ease(s.lt / 0.8), lx = lerp(-60, cx - 150, k);
    drawPerson(g, lx, gy - 6 - (s.lukasWin ? Math.abs(Math.sin(s.t * 7)) * 12 : 0), { faceKey: ev.winner, t: s.t, color: '#3ea37a', scale: SC });
    bubble(g, lx, gy - 142, s.lukasWin ? (ev.winnerLine || 'JACKPOT!') : 'Lass mich mal! 😎');
    if (s.lukasWin) {
      banner(g, V, 'JACKPOT!!! 🍒🍒🍒', s.t, true, 40);
      if (ev.twerk) {
        const x = V.w * 0.92, y = gy - 6;
        g.save(); g.translate(x, y - 40); g.rotate(Math.sin(s.t * 22) * 0.22); g.translate(-x, -(y - 40));
        drawPerson(g, x, y, { faceKey: ev.twerk, t: s.t, color: '#d55b8f', scale: SC, wave: false });
        g.restore(); bubble(g, x - 20, gy - 140, ev.twerkLine || '*twerk*');
      }
      if (s.t - s.winT > 1.4 && s.result) { g.font = '900 16px ui-rounded, system-ui, sans-serif'; g.textAlign = 'center'; g.fillStyle = '#ffd23f'; g.lineWidth = 4; g.strokeStyle = 'rgba(0,0,0,0.6)'; const txt = `Deine Kirschen: ${s.cherries} 🍒  ·  +${s.result.bonus} Bonus`; g.strokeText(txt, V.w / 2, 80); g.fillText(txt, V.w / 2, 80); }
    }
  }
}

function drawCandles(g, game, s) {
  const V = game.V, gy = V.groundY, cx = V.w * 0.6;
  // dreistöckige Torte
  const tiers = [[260, 50, '#f8bbd0'], [200, 40, '#fff3e0'], [140, 34, '#f8bbd0']];
  let y = gy;
  for (const [w, h, c] of tiers) { g.fillStyle = c; roundRect(g, cx - w / 2, y - h, w, h, 8); g.fill(); g.fillStyle = '#fff'; for (let i = 0; i < w / 14; i++) { g.beginPath(); g.arc(cx - w / 2 + 7 + i * 14, y - h + 2, 6, 0, Math.PI); g.fill(); } y -= h; }
  g.fillStyle = '#e91e63'; g.font = '900 22px ui-rounded, system-ui, sans-serif'; g.textAlign = 'center'; g.fillText(s.ev.cakeText || '30', cx, gy - 18);
  for (const c of s.candles) {
    g.fillStyle = c.c; roundRect(g, c.x - 3, c.y - 10, 6, 20, 2); g.fill();
    if (c.lit) { const fl = Math.sin(s.t * 20 + c.x) * 1.2; const gl = g.createRadialGradient(c.x, c.y - 16, 1, c.x, c.y - 16, 12); gl.addColorStop(0, 'rgba(255,220,120,0.7)'); gl.addColorStop(1, 'rgba(255,220,120,0)'); g.fillStyle = gl; g.beginPath(); g.arc(c.x, c.y - 16, 12, 0, 7); g.fill(); g.fillStyle = '#ff9f1c'; g.beginPath(); g.ellipse(c.x + fl * 0.3, c.y - 16, 3, 5.5 + fl, 0, 0, 7); g.fill(); g.fillStyle = '#fff3a0'; g.beginPath(); g.ellipse(c.x, c.y - 15, 1.4, 2.6, 0, 0, 7); g.fill(); }
  }
  if (s.phase === 'intro') { banner(g, V, '🎂 Auspusten!', s.t); hand(g, cx, gy - 150, s.t, 'swipe'); }
  if (s.phase === 'play') {
    const k = 1 - s.pt / s.time;
    g.fillStyle = 'rgba(0,0,0,0.4)'; roundRect(g, V.w / 2 - 90, 40, 180, 10, 5); g.fill();
    g.fillStyle = k > 0.3 ? '#3ee6b4' : '#ff5b5b'; roundRect(g, V.w / 2 - 90, 40, Math.max(1, 180 * k), 10, 5); g.fill();
    g.fillStyle = '#fff'; g.font = '900 18px ui-rounded, system-ui, sans-serif'; g.textAlign = 'center'; g.fillText(`💨 ${s.out}/${s.candles.length}`, V.w / 2, 72);
    if (s.pt < 2) hand(g, cx, gy - 150, s.t, 'swipe');
  }
  if (s.phase === 'end') resultBanner(g, V, s);
}
