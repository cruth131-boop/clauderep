// Story-Einspieler & Minispiele im Level-Modus.
// Die Ereignisse selbst (wer, was, Texte) stehen in der privaten Config: config.levels[i].events.
// Arten: party, scene, escalator, detector, tapgame, throw, slot, fipsplay
import { drawPerson, drawCat, drawHero, roundRect } from './character.js';
import { emoji } from './emoji.js';
import { COSTUMES } from './levels.js';
import { sfx } from './audio.js';

const rand = (a, b) => a + Math.random() * (b - a);
const pick = (a) => a[(Math.random() * a.length) | 0];
const lerp = (a, b, t) => a + (b - a) * t;
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const ease = (k) => { k = clamp(k, 0, 1); return k * k * (3 - 2 * k); };
const SC = 0.88; // Personen-Größe
const COLORS = ['#5b7bd5', '#d55b8f', '#3ea37a', '#d58a3e', '#8e5aa8', '#e0a030'];

// ---------------------------------------------------------------------------
export function startStory(game, ev) {
  const V = game.V;
  const s = { ev, kind: ev.kind, t: 0, phase: 'main', dur: ev.dur || 5, done: false, parts: [], kimiPose: 'cheer', fw: [] };
  game.fx.burst(V.w * 0.6, V.groundY - 40, { n: 20, type: 'smoke', colors: ['#fff', '#ddd'], speed: 120, size: 6, gravity: -30 });
  if (s.kind === 'party') {
    const src = (ev.faces ? ev.faces.map((f) => ({ face: f })) : game.levelGuests.filter((c) => c.face)).slice(0, 7);
    const uniq = []; const seen = new Set(); for (const c of src) if (!seen.has(c.face)) { seen.add(c.face); uniq.push(c); }
    s.actors = uniq.map((c, i, a) => ({ ...c, x: 0.36 + (i + 0.5) * (0.6 / a.length), from: 'right', t0: i * 0.12, anim: ev.style === 'line' ? 'line' : 'dance', color: COLORS[i % COLORS.length] }));
    s.actors.push({ cat: 1, x: 0.27, anim: 'salto', t0: 0.5 });
    s.dur = ev.dur || 5.5; s.fx = { disco: 1, banner: ev.text || 'PARTY TIME! 🪩', confetti: 1, hearts: ev.style === 'wedding' };
    sfx('fanfare');
  } else if (s.kind === 'scene') {
    s.actors = (ev.actors || []).map((a, i) => ({ color: COLORS[i % COLORS.length], ...a }));
    s.fx = ev.fx || {};
    if (ev.banner) s.fx.banner = ev.banner;
    sfx('memory');
  } else if (s.kind === 'escalator') {
    s.ex = V.w + 30; s.phase = 'approach'; s.kimiPose = 'run'; s.dur = 99;
  } else if (s.kind === 'detector') {
    s.phase = 'intro'; s.dur = 99; s.dx = V.w * 0.45; s.lastMove = -9; s.beepT = 0;
    do { s.rx = rand(V.w * 0.15, V.w * 0.9); } while (Math.abs(s.rx - s.dx) < V.w * 0.2);
    s.kimiPose = 'run';
  } else if (s.kind === 'tapgame') {
    s.n = 0; s.need = ev.n || 15; s.dur = 99; s.shake = 0; s.phase = 'main';
  } else if (s.kind === 'throw') {
    s.targets = (ev.targets || []).map((f, i, a) => ({ face: f, x: 0.58 + i * (0.3 / Math.max(1, a.length - 1 || 1)), hits: 0, wob: rand(0, 6) }));
    s.shots = []; s.need = ev.hits || 3; s.dur = 99;
  } else if (s.kind === 'slot') {
    s.reels = [0, 0, 0].map(() => ({ stopped: false, off: rand(0, 10) })); s.stopIdx = 0; s.dur = 99; s.autoT = 0;
  } else if (s.kind === 'fipsplay') {
    s.dogs = (ev.dogs || []).map((d, i) => ({ face: d, i })); s.dur = ev.dur || 5;
    s.fx = { banner: ev.text || 'Spielstunde! 🐾' };
  }
  game.obstacles = [];
  game.items = game.items.filter((i) => !i.bad);
  return s;
}

// ---------------------------------------------------------------------------
export function updateStory(game, s, dt) {
  const V = game.V, p = game.p, ev = s.ev;
  s.t += dt;
  if (s.fx?.confetti && Math.floor(s.t * 2) !== Math.floor((s.t - dt) * 2)) game.fx.burst(rand(40, V.w - 40), rand(20, V.groundY * 0.4), { n: 26, type: 'confetti', speed: 220, size: 4, gravity: 280 });
  if (s.fx?.fireworks || ev.fireworks) fireworks(game, s, dt);
  if (s.fx?.rain && Math.random() < dt * 14) s.parts.push({ e: s.fx.rain, x: rand(0, V.w), y: -20, vy: rand(80, 160), r: rand(-1, 1), vr: rand(-3, 3), s: rand(16, 26) });
  if ((s.fx?.hearts) && Math.random() < dt * 8) s.parts.push({ e: pick(['❤️', '💕', '💖']), x: rand(V.w * 0.2, V.w * 0.9), y: V.groundY, vy: -rand(50, 90), r: 0, vr: rand(-1, 1), s: rand(14, 22) });
  for (const q of s.parts) { q.y += q.vy * dt; q.r += q.vr * dt; q.vy += (q.g || 0) * dt; q.x += (q.vx || 0) * dt; }
  s.parts = s.parts.filter((q) => q.y < V.h + 40 && q.y > -60);

  if (s.kind === 'party' || s.kind === 'scene' || s.kind === 'fipsplay') {
    for (const a of s.actors || []) {
      if (a.knockAt && s.t >= a.knockAt && !a.knocked) { a.knocked = true; game.shake = 12; game.flash = 0.6; sfx('smash'); sfx('boom'); game.fx.text(ax(a, s, V), V.groundY - 100, pick(['POW!', 'KAWUMM!', 'BAM!']), { color: '#ffd23f', size: 30 }); game.fx.burst(ax(a, s, V), V.groundY - 70, { n: 30, colors: ['#ffd23f', '#fff', '#ff7b39'], speed: 300, size: 4 }); }
      if (a.sfxAt && s.t >= a.sfxAt && !a.sfxDone) { a.sfxDone = true; sfx(a.sfx || 'cheer'); }
    }
    if (s.kind === 'party') s.kimiPose = Math.floor(s.t * 3) % 2 ? 'cheer' : 'jump';
    if (s.t >= s.dur) s.done = true;
  } else if (s.kind === 'escalator') updEscalator(game, s, dt);
  else if (s.kind === 'detector') updDetector(game, s, dt);
  else if (s.kind === 'tapgame') {
    s.shake = Math.max(0, s.shake - dt * 4);
    if (s.phase === 'main' && s.t > 14) { s.n = s.need; finishTap(game, s); }
    if (s.phase === 'burst' && s.t - s.burstT > 2.6) s.done = true;
  } else if (s.kind === 'throw') {
    for (const sh of s.shots) {
      sh.t += dt;
      if (!sh.hit && sh.t >= 0.35) { sh.hit = true; sh.tg.hits++; sfx('smash'); game.fx.text(V.w * sh.tg.x, V.groundY - 120, pick(['PLATSCH!', 'Volltreffer!', 'SPLAT!']), { color: '#6d3b1f', size: 20 }); game.fx.burst(V.w * sh.tg.x, V.groundY - 100, { n: 16, colors: ['#4a2a17', '#e9d8b8', '#7b4a26'], speed: 200, size: 3 }); }
    }
    s.shots = s.shots.filter((sh) => sh.t < 0.4);
    const all = s.targets.every((tg) => tg.hits >= s.need);
    if ((all || s.t > 12) && s.phase !== 'end') { s.phase = 'end'; s.endT = s.t; sfx('fanfare'); bonus(game, ev); }
    if (s.phase === 'end' && s.t - s.endT > 2.6) s.done = true;
  } else if (s.kind === 'slot') {
    for (const r of s.reels) if (!r.stopped) r.off += dt * 14;
    s.autoT += dt;
    if (s.phase === 'main' && s.autoT > 3) stopReel(game, s);
    if (s.phase === 'win') { if (Math.random() < dt * 20) s.parts.push({ e: '🪙', x: rand(0, V.w), y: -20, vy: rand(120, 220), r: 0, vr: rand(-4, 4), s: rand(16, 24) }); if (s.t - s.winT > 3.4) s.done = true; }
  }
}

function bonus(game, ev) {
  if (!ev.item) return;
  game.stats.items[ev.item] = (game.stats.items[ev.item] || 0) + (ev.bonus || 1);
  game.checkQuest();
}

function fireworks(game, s, dt) {
  const V = game.V;
  if (Math.random() < dt * 3) s.fw.push({ x: rand(V.w * 0.15, V.w * 0.9), y: V.groundY, vy: -rand(260, 360), t: 0, c: pick(['#ff4fa3', '#ffd23f', '#3ee6b4', '#7cc6ff', '#c77dff']) });
  for (const f of s.fw) {
    f.t += dt; f.y += f.vy * dt; f.vy += 160 * dt;
    if (!f.boom && f.vy > -40) { f.boom = true; game.fx.burst(f.x, f.y, { n: 40, colors: [f.c, '#fff'], speed: 220, size: 3, gravity: 90 }); sfx('launch'); }
  }
  s.fw = s.fw.filter((f) => !f.boom);
}

// ---- Rolltreppe ------------------------------------------------------------
const ESC_W = 280, ESC_H = 215;
function updEscalator(game, s, dt) {
  const V = game.V, p = game.p, ev = s.ev, X0 = 95;
  s.pt = (s.pt || 0) + dt;
  if (s.phase === 'approach') {
    s.ex -= 240 * dt; game.bgOffset += 0; s.kimiPose = 'run';
    if (s.ex <= p.x + 18) { s.phase = 'push'; s.pt = 0; sfx('hurt'); p.expr = 'shock'; p.exprT = 9; }
  } else if (s.phase === 'push') {
    s.ex -= 150 * dt; p.x = Math.max(62, s.ex - 18); s.kimiPose = 'duck';
    if (p.x <= 62) { s.phase = 'stuck'; s.pt = 0; game.shake = 10; sfx('no'); p.expr = 'sad'; p.exprT = 9; }
  } else if (s.phase === 'stuck') {
    s.kimiPose = 'duck'; game.shake = Math.max(game.shake, 2);
    if (s.pt > (ev.stuck || 3.6)) { s.phase = 'hero'; s.pt = 0; s.hx = -120; s.hy = 180; sfx('launch'); }
  } else if (s.phase === 'hero') {
    const k = ease(s.pt / 1.1);
    s.hx = lerp(-120, s.ex + 50, k); s.hy = lerp(180, 40, k);
    if (s.pt >= 1.1) { s.phase = 'smash'; s.pt = 0; s.knock = { x: s.ex, y: 0, r: 0 }; game.shake = 16; game.flash = 0.8; sfx('smash'); sfx('boom');
      game.fx.text(s.ex + 80, V.groundY - 140, 'POW!', { color: '#ffd23f', size: 34 });
      game.fx.burst(s.ex + 60, V.groundY - 60, { n: 40, colors: ['#9aa3ad', '#cfd8dc', '#ffd23f', '#fff'], speed: 340, type: 'rubble', size: 5, gravity: 900, spread: Math.PI, angle: -Math.PI / 2 }); }
  } else if (s.phase === 'smash') {
    s.knock.x += 520 * dt; s.knock.y += 420 * dt; s.knock.r += 4 * dt;
    s.hx = s.ex + 50; s.hy = 0;
    p.expr = 'happy'; p.exprT = 3; s.kimiPose = 'cheer';
    p.x = lerp(p.x, X0, Math.min(1, dt * 2.2));
    if (s.pt > 2.4) { s.phase = 'leave'; s.pt = 0; }
  } else if (s.phase === 'leave') {
    s.hx += 520 * dt; s.hy += 260 * dt; p.x = lerp(p.x, X0, Math.min(1, dt * 3));
    if (s.pt > 1.2) s.done = true;
  }
}
function drawEscalator(g, x, gy, t, rot = 0) {
  g.save();
  if (rot) { g.translate(x + ESC_W / 2, gy - ESC_H / 2); g.rotate(rot); g.translate(-(x + ESC_W / 2), -(gy - ESC_H / 2)); }
  // Sockel
  g.fillStyle = '#90a4ae'; g.fillRect(x - 4, gy - 40, 60, 40); g.fillStyle = '#607d8b'; g.fillRect(x - 4, gy - 8, 60, 8);
  // Seitenwange
  g.fillStyle = '#b0bec5'; g.beginPath(); g.moveTo(x, gy); g.lineTo(x + 40, gy); g.lineTo(x + ESC_W, gy - ESC_H + 30); g.lineTo(x + ESC_W, gy - ESC_H); g.lineTo(x + ESC_W - 30, gy - ESC_H); g.lineTo(x, gy - 34); g.closePath(); g.fill();
  g.strokeStyle = '#78909c'; g.lineWidth = 2; g.stroke();
  // Stufen
  g.save(); g.beginPath(); g.moveTo(x + 4, gy - 30); g.lineTo(x + ESC_W - 30, gy - ESC_H + 4); g.lineTo(x + ESC_W - 6, gy - ESC_H + 26); g.lineTo(x + 30, gy - 6); g.closePath(); g.clip();
  g.fillStyle = '#546e7a'; g.fillRect(x, gy - ESC_H, ESC_W, ESC_H);
  g.strokeStyle = '#cfd8dc'; g.lineWidth = 3;
  const off = (t * 40) % 16;
  for (let i = -2; i < 18; i++) { const u = i * 16 + off; g.beginPath(); g.moveTo(x + u * 0.84, gy - u * 0.74 - 30); g.lineTo(x + u * 0.84 + 26, gy - u * 0.74 - 6); g.stroke(); }
  g.restore();
  // Handlauf
  g.strokeStyle = '#212121'; g.lineWidth = 7; g.lineCap = 'round';
  g.beginPath(); g.moveTo(x - 6, gy - 44); g.quadraticCurveTo(x - 16, gy - 30, x - 2, gy - 26); g.moveTo(x - 6, gy - 44); g.lineTo(x + ESC_W - 30, gy - ESC_H - 10); g.lineTo(x + ESC_W + 6, gy - ESC_H - 10); g.stroke();
  g.fillStyle = '#ffd23f'; g.font = '900 12px ui-rounded, system-ui, sans-serif'; g.textAlign = 'center';
  g.save(); g.translate(x + ESC_W * 0.55, gy - ESC_H * 0.5 + 10); g.rotate(-0.72); g.fillText('⚠️ VORSICHT', 0, 0); g.restore();
  g.restore();
}

// ---- Metalldetektor --------------------------------------------------------
function updDetector(game, s, dt) {
  const V = game.V, p = game.p, ev = s.ev;
  if (s.phase === 'intro') { s.kimiPose = 'cheer'; if (s.t > 2.6) { s.phase = 'search'; s.st = 0; } return; }
  if (s.phase === 'search') {
    s.st += dt;
    p.x = clamp(s.dx - 46, 24, V.w - 60); s.kimiPose = s.t - s.lastMove < 0.3 ? 'run' : 'cheer';
    const dist = Math.abs(s.dx - s.rx), prox = clamp(1 - dist / (V.w * 0.7), 0, 1);
    s.prox = prox;
    s.beepT -= dt;
    if (s.beepT <= 0) { s.beepT = 0.07 + (1 - prox) * 0.8; sfx('beep', prox); }
    if (dist < 16) {
      s.phase = 'found'; s.ft = 0; sfx('power'); sfx('fanfare');
      try { navigator.vibrate?.([90, 50, 260]); } catch {}
      game.fx.burst(s.rx, V.groundY - 6, { n: 40, colors: ['#ffd23f', '#fff', '#111'], speed: 240, size: 3 });
      game.stats.items[ev.item || 'blackring'] = (game.stats.items[ev.item || 'blackring'] || 0) + 1;
      game.checkQuest();
    }
    if (s.st > 30) s.rx = lerp(s.rx, s.dx, dt * 0.5); // Hilfe, falls es zu lange dauert
  } else if (s.phase === 'found') {
    s.ft += dt; s.kimiPose = 'cheer'; p.expr = 'happy'; p.exprT = 2;
    if (s.ft > 3.2) s.done = true;
  }
}

// ---- Tippspiel -------------------------------------------------------------
function finishTap(game, s) {
  const V = game.V, cx = V.w * 0.62, cy = V.groundY - 120;
  s.phase = 'burst'; s.burstT = s.t; sfx('explode'); game.flash = 0.6; game.shake = 8;
  for (let i = 0; i < 26; i++) s.parts.push({ e: pick(s.ev.burst || ['🍬', '🍭', '🍫', '🧸', '✏️']), x: cx, y: cy, vx: rand(-260, 260), vy: -rand(150, 420), g: 520, r: 0, vr: rand(-6, 6), s: rand(16, 26) });
  bonus(game, s.ev);
}
function stopReel(game, s) {
  if (s.phase !== 'main') return;
  const r = s.reels[s.stopIdx++]; r.stopped = true; s.autoT = 0; sfx('tap', s.stopIdx * 3);
  if (s.stopIdx >= 3) { s.phase = 'win'; s.winT = s.t; sfx('fanfare'); game.flash = 0.7; bonus(game, s.ev); }
}

// ---------------------------------------------------------------------------
export function storyInput(game, s, type, x, y) {
  const V = game.V;
  if (s.kind === 'detector' && s.phase === 'search' && (type === 'move' || type === 'down')) { s.dx = clamp(x, 20, V.w - 20); s.lastMove = s.t; return; }
  if (type !== 'down') return;
  if (s.kind === 'tapgame' && s.phase === 'main') {
    s.n++; s.shake = 1; sfx('tap', s.n % 12);
    const cx = V.w * 0.62, cy = V.groundY - 120;
    s.parts.push({ e: pick(s.ev.burst || ['🍬', '🍭', '🍫']), x: cx + rand(-20, 20), y: cy - 50, vx: rand(-120, 120), vy: -rand(120, 260), g: 520, r: 0, vr: rand(-5, 5), s: 16 });
    if (s.n >= s.need) finishTap(game, s);
  } else if (s.kind === 'throw' && s.phase !== 'end') {
    const open = s.targets.filter((tg) => tg.hits < s.need);
    const tg = open.sort((a, b) => Math.abs(V.w * a.x - x) - Math.abs(V.w * b.x - x))[0] || s.targets[0];
    s.shots.push({ tg, t: 0, x0: game.p.x + 14, y0: V.groundY - 90 });
    sfx('jump');
  } else if (s.kind === 'slot') stopReel(game, s);
  else if ((s.kind === 'party' || s.kind === 'scene' || s.kind === 'fipsplay') && s.t > 1.5) s.done = true;
}

// ---------------------------------------------------------------------------
function ax(a, s, V) {
  let x = V.w * (a.x ?? 0.6);
  if (a.moves) { const m = a.moves; let i = 0; while (i < m.length - 1 && s.t > m[i + 1][0]) i++; const [t0, x0] = m[i], [t1, x1] = m[Math.min(i + 1, m.length - 1)]; x = V.w * (t1 > t0 ? lerp(x0, x1, clamp((s.t - t0) / (t1 - t0), 0, 1)) : x0); }
  const t0 = a.t0 || 0;
  if (a.from === 'right') x = lerp(V.w + 60, x, ease((s.t - t0) / 0.8));
  if (a.from === 'left') x = lerp(-60, x, ease((s.t - t0) / 0.8));
  if (a.knocked) x += (s.t - a.knockAt) * 520;
  return x;
}

function bubble(g, x, y, text, col = '#222') {
  g.font = '800 12px ui-rounded, system-ui, sans-serif';
  const w = Math.min(200, g.measureText(text).width + 18);
  g.fillStyle = '#fff'; roundRect(g, x - w / 2, y - 20, w, 26, 11); g.fill();
  g.beginPath(); g.moveTo(x - 6, y + 5); g.lineTo(x, y + 14); g.lineTo(x + 6, y + 5); g.fill();
  g.fillStyle = col; g.textAlign = 'center'; g.fillText(text, x, y - 2, w - 12);
}

function banner(g, V, text, t, big = false) {
  const pulse = 1 + Math.sin(t * 8) * 0.05;
  const size = Math.min(big ? 46 : 26, V.w / (big ? 9 : 16));
  g.save(); g.translate(V.w / 2, Math.max(54, V.groundY * 0.26)); g.scale(pulse, pulse);
  g.font = `900 ${size}px ui-rounded, system-ui, sans-serif`; g.textAlign = 'center'; g.textBaseline = 'middle';
  g.lineWidth = size * 0.22; g.strokeStyle = 'rgba(40,10,50,0.85)'; g.strokeText(text, 0, 0, V.w - 30);
  g.fillStyle = big ? `hsl(${(t * 300) % 360},95%,65%)` : '#fff'; g.fillText(text, 0, 0, V.w - 30);
  g.restore();
}

function disco(g, V, t) {
  g.fillStyle = 'rgba(10,0,25,0.5)'; g.fillRect(0, 0, V.w, V.h);
  g.save(); g.globalCompositeOperation = 'lighter';
  const cols = ['rgba(255,60,160,0.32)', 'rgba(60,255,190,0.28)', 'rgba(100,170,255,0.3)', 'rgba(255,220,60,0.26)'];
  for (let i = 0; i < 5; i++) {
    const sx = V.w * (0.1 + i * 0.2), a = Math.sin(t * (1.6 + i * 0.4) + i * 2) * 0.7;
    g.fillStyle = cols[i % 4]; g.beginPath(); g.moveTo(sx, 0); g.lineTo(sx + Math.sin(a - 0.14) * V.groundY * 1.4, V.groundY + 20); g.lineTo(sx + Math.sin(a + 0.14) * V.groundY * 1.4, V.groundY + 20); g.fill();
  }
  g.restore();
  if (Math.floor(t * 8) % 3 === 0) { g.fillStyle = `hsla(${(t * 400) % 360},100%,60%,0.16)`; g.fillRect(0, 0, V.w, V.h); }
  // Discokugel
  const bx = V.w / 2, by = 24;
  g.strokeStyle = '#ccc'; g.lineWidth = 1; g.beginPath(); g.moveTo(bx, 0); g.lineTo(bx, by - 14); g.stroke();
  const gr = g.createRadialGradient(bx - 4, by - 4, 2, bx, by, 16); gr.addColorStop(0, '#fff'); gr.addColorStop(1, '#8a9aa8');
  g.fillStyle = gr; g.beginPath(); g.arc(bx, by, 16, 0, 7); g.fill();
  for (let i = 0; i < 10; i++) { const a = i / 10 * 6.28 + t * 3; g.fillStyle = `hsl(${(i * 50 + t * 200) % 360},100%,75%)`; g.fillRect(bx + Math.cos(a) * 9 - 1.5, by + Math.sin(a) * 9 - 1.5, 3, 3); }
}

function drawActor(g, game, s, a, i) {
  const V = game.V, t0 = a.t0 || 0;
  if (s.t < t0) return;
  if (a.t1 && s.t > a.t1 + 0.8) return;
  const lt = s.t - t0;
  let x = ax(a, s, V);
  if (a.t1 && s.t > a.t1) x += (s.t - a.t1) * (a.exit === 'left' ? -500 : 500);
  let y = V.groundY - 6, rot = 0, sx = 1, sy = 1;
  const anim = a.anim || 'wave';
  if (anim === 'dance') { y -= Math.abs(Math.sin(lt * 7 + i)) * 12; rot = Math.sin(lt * 3.5 + i) * 0.18; }
  if (anim === 'line') { x += Math.sin(s.t * 4) * 16; y -= Math.max(0, Math.sin(s.t * 8)) * 8; rot = Math.sin(s.t * 4) * 0.1; }
  if (anim === 'hop') y -= Math.abs(Math.sin(lt * 6 + i)) * 10;
  if (anim === 'shake') x += Math.sin(lt * 40) * 2.5;
  if (anim === 'twerk') { rot = Math.sin(lt * 22) * 0.22; sy = 1 + Math.sin(lt * 22) * 0.06; }
  if (a.knocked) { rot = (s.t - a.knockAt) * 9; y -= (s.t - a.knockAt) * 300; }
  const sc = (a.scale || 1) * SC;
  g.save(); g.translate(x, y); g.rotate(rot); g.scale(sx, sy); g.translate(-x, -y);
  if (a.big) { emoji(g, a.big, x, y - 34 * (a.scale || 1), 70 * (a.scale || 1), 0, !!a.flip); }
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
    drawPerson(g, x, y, { faceKey: a.face, emojiHead: a.emoji, t: s.t + i, color: a.color, scale: sc, wave: anim !== 'twerk', pet: a.pet, oma: a.oma, run: anim === 'run' });
  }
  if (a.prop && (!a.propT || s.t >= a.propT) && (!a.propEnd || s.t < a.propEnd)) emoji(g, a.prop, x + 16, y - (a.pet ? 18 : 60), 20);
  g.restore();
  if (a.say) {
    const st = a.sayT ?? t0 + 0.4, en = a.sayEnd ?? s.dur;
    if (s.t >= st && s.t <= en) bubble(g, x, y - (a.pet ? 62 : 140) * (a.scale || 1), a.say);
  }
  for (const [st, en, txt] of a.says || []) if (s.t >= st && s.t <= en) bubble(g, x, y - (a.pet ? 62 : 140) * (a.scale || 1), txt);
}

export function drawStoryBack(g, game, s) {
  const V = game.V;
  if (s.fx?.disco) disco(g, V, s.t);
  if (s.fx?.dim) { g.fillStyle = `rgba(0,0,0,${s.fx.dim})`; g.fillRect(0, 0, V.w, V.h); }
}

export function drawStory(g, game, s) {
  const V = game.V, ev = s.ev, gy = V.groundY;
  if (s.kind === 'party' || s.kind === 'scene') {
    (s.actors || []).forEach((a, i) => drawActor(g, game, s, a, i));
  } else if (s.kind === 'fipsplay') {
    const run = s.t / s.dur;
    const fx = lerp(-40, V.w + 60, run);
    const jumpK = (s.t * 1.6) % 1, jy = Math.sin(jumpK * Math.PI) * 50;
    g.save(); const cy = gy - jy - 18; g.translate(fx, cy); g.rotate(-jumpK * Math.PI * 2); g.translate(-fx, -cy);
    drawCat(g, fx, gy - jy + 4, { phase: s.t * 16, scale: 1.15, t: s.t });
    g.restore();
    s.dogs.forEach((d, i) => {
      const dx = fx - 70 - i * 62 + Math.sin(s.t * 3 + i) * 8, hop = Math.abs(Math.sin(s.t * 9 + i)) * 10;
      drawPerson(g, dx, gy - hop, { faceKey: d.face, t: s.t + i, pet: true, scale: 1.1 });
      if (Math.floor(s.t * 1.3 + i) % 3 === 0) bubble(g, dx + 6, gy - 70, 'Wuff! 🐾');
    });
    if (Math.random() < 0.08) game.fx.burst(fx, gy - 30, { n: 4, colors: ['#ff6b8a', '#fff'], speed: 80, size: 2 });
  } else if (s.kind === 'escalator') {
    if (s.knock) drawEscalator(g, s.ex + s.knock.x - s.ex + 0, gy - 0 - s.knock.y, s.t, s.knock.r);
    else drawEscalator(g, s.ex, gy, s.t);
    if (s.phase === 'stuck' || s.phase === 'push') {
      bubble(g, game.p.x + 10, gy - 150, s.phase === 'stuck' ? (s.ev.ouch || 'AUA!!! 😭') : 'Hilfe!');
      if (s.phase === 'stuck') { for (let i = 0; i < 2; i++) { const k = (s.t * 1.5 + i * 0.5) % 1; emoji(g, '💧', game.p.x + 8 + i * 10, gy - 112 + k * 30, 10); } banner(g, V, s.ev.text || 'Finger in der Rolltreppe! 😱', s.t); }
    }
    if (s.hx != null && s.phase !== 'approach') {
      const pose = s.phase === 'hero' || s.phase === 'leave' ? 'fly' : 'land';
      drawHero(g, s.hx, gy - s.hy, { pose, t: s.t, scale: 0.95 * 1.25, costume: COSTUMES[s.ev.costume || 'fan'] || null, faceKey: s.ev.face });
      if (s.phase === 'smash') bubble(g, s.hx, gy - 150, s.ev.heroLine || 'Ich rette dich!');
    }
  } else if (s.kind === 'detector') drawDetector(g, game, s);
  else if (s.kind === 'tapgame') {
    const cx = V.w * 0.62, cy = gy - 120;
    if (s.phase === 'main') {
      const sc = 1 + s.n * 0.035, sh = Math.sin(s.t * 60) * s.shake * 6;
      g.save(); g.translate(cx + sh, cy); g.scale(sc, sc); drawCone(g); g.restore();
      banner(g, V, s.ev.text || 'Tippe ganz schnell!', s.t);
      g.fillStyle = '#fff'; g.font = '900 22px ui-rounded, system-ui, sans-serif'; g.textAlign = 'center';
      g.lineWidth = 4; g.strokeStyle = 'rgba(0,0,0,0.5)'; g.strokeText(`${s.n} / ${s.need}`, cx, cy + 96); g.fillText(`${s.n} / ${s.need}`, cx, cy + 96);
      if (Math.floor(s.t * 2) % 2) emoji(g, '👆', cx + 50, cy + 40, 30);
    } else {
      banner(g, V, s.ev.done || 'JUHU! 🎉', s.t, true);
      if (s.ev.face) drawPerson(g, V.w * 0.8, gy - 6 - Math.abs(Math.sin(s.t * 7)) * 10, { faceKey: s.ev.face, t: s.t, color: '#3ea37a', scale: SC });
      if (s.ev.faceLine) bubble(g, V.w * 0.8, gy - 140, s.ev.faceLine);
    }
  } else if (s.kind === 'throw') {
    for (const tg of s.targets) {
      const x = V.w * tg.x + Math.sin(s.t * 2.2 + tg.wob) * 18, y = gy - 6;
      tg.sx = x;
      drawPerson(g, x, y - (s.phase === 'end' ? Math.abs(Math.sin(s.t * 6)) * 6 : 0), { faceKey: tg.face, t: s.t, color: '#5b7bd5', scale: SC * 1.1, expr: tg.hits ? 'sad' : 'happy' });
      g.fillStyle = 'rgba(74,42,23,0.92)';
      for (let k = 0; k < Math.min(tg.hits, 6); k++) { g.beginPath(); g.arc(x + Math.sin(k * 2.3) * 8, y - 104 + Math.cos(k * 1.7) * 9, 6 + (k % 2) * 2, 0, 7); g.fill(); }
    }
    for (const sh of s.shots) {
      const k = clamp(sh.t / 0.35, 0, 1), tx = sh.tg.sx || V.w * sh.tg.x;
      const x = lerp(sh.x0, tx, k), y = lerp(sh.y0, gy - 100, k) - Math.sin(k * Math.PI) * 60;
      g.save(); g.translate(x, y); g.rotate(k * 8);
      g.fillStyle = '#e9d8b8'; g.beginPath(); g.ellipse(0, 6, 9, 2.5, 0, 0, 7); g.fill(); g.fillStyle = '#4a2a17'; g.beginPath(); g.ellipse(0, 5, 8, 12, 0, Math.PI, 0); g.fill();
      g.restore();
    }
    banner(g, V, s.phase === 'end' ? (s.ev.done || 'Volltreffer! 😂') : (s.ev.text || 'Tippe zum Werfen!'), s.t, s.phase === 'end');
  } else if (s.kind === 'slot') {
    drawSlot(g, game, s);
  }
  for (const q of s.parts) emoji(g, q.e, q.x, q.y, q.s, q.r);
  if (s.fx?.banner && (s.kind === 'party' || s.kind === 'scene' || s.kind === 'fipsplay')) banner(g, V, s.fx.banner, s.t, s.kind === 'party');
  if (s.ev.endBanner && s.t > (s.ev.endBannerAt || s.dur - 1.6)) banner(g, V, s.ev.endBanner, s.t, true);
  if ((s.kind === 'party' || s.kind === 'scene' || s.kind === 'fipsplay') && s.t > 1.5) {
    g.globalAlpha = 0.5 + Math.sin(s.t * 4) * 0.3; g.fillStyle = '#fff'; g.font = '800 11px ui-rounded, system-ui, sans-serif'; g.textAlign = 'center';
    g.fillText('Tippen = weiter', V.w / 2, gy + 38); g.globalAlpha = 1;
  }
}

function drawCone(g) {
  // Schultüte: bunte Spitztüte mit Krepppapier
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

function drawDetector(g, game, s) {
  const V = game.V, gy = V.groundY, ev = s.ev;
  if (s.phase === 'intro') {
    banner(g, V, ev.text || 'Der Ring ist weg! 😱', s.t);
    if (ev.face) { drawPerson(g, V.w * 0.7, gy - 6, { faceKey: ev.face, t: s.t, color: '#8e5aa8', scale: SC }); bubble(g, V.w * 0.7, gy - 140, ev.line || 'Mein Ring!!'); }
    for (const [i, f] of (ev.helpers || []).entries()) drawPerson(g, V.w * (0.82 + i * 0.08), gy - 6, { faceKey: f, t: s.t + i, color: COLORS[i], scale: SC });
    return;
  }
  // Boden hervorheben
  g.fillStyle = 'rgba(0,0,0,0.35)'; g.fillRect(0, 0, V.w, gy - 40);
  g.fillStyle = 'rgba(255,255,255,0.08)'; g.fillRect(0, gy - 40, V.w, 50);
  const x = s.dx, prox = s.prox || 0;
  // Sonde
  g.strokeStyle = '#424242'; g.lineWidth = 4; g.beginPath(); g.moveTo(x - 30, gy - 92); g.lineTo(x, gy - 10); g.stroke();
  g.fillStyle = '#212121'; roundRect(g, x - 44, gy - 104, 26, 16, 4); g.fill();
  g.fillStyle = prox > 0.85 ? '#ff1744' : prox > 0.6 ? '#ffd23f' : '#3ee6b4'; g.beginPath(); g.arc(x - 31, gy - 96, 4 + (Math.floor(s.t * (2 + prox * 14)) % 2) * 2, 0, 7); g.fill();
  g.strokeStyle = '#b0bec5'; g.lineWidth = 4; g.beginPath(); g.ellipse(x, gy - 6, 20, 6, 0, 0, 7); g.stroke();
  g.strokeStyle = `rgba(62,230,180,${0.3 + prox * 0.6})`; g.lineWidth = 2;
  for (let i = 0; i < 3; i++) { const k = (s.t * (1 + prox * 3) + i / 3) % 1; g.beginPath(); g.ellipse(x, gy - 6, 20 + k * 30, 6 + k * 9, 0, 0, 7); g.globalAlpha = 1 - k; g.stroke(); }
  g.globalAlpha = 1;
  // Signal-Anzeige
  const mx = V.w - 120, my = 70;
  g.fillStyle = 'rgba(0,0,0,0.5)'; roundRect(g, mx - 10, my - 26, 120, 52, 10); g.fill();
  for (let i = 0; i < 8; i++) { g.fillStyle = i / 8 < prox ? `hsl(${120 - i * 15},90%,55%)` : 'rgba(255,255,255,0.15)'; g.fillRect(mx + i * 12, my + 10 - i * 3, 9, 8 + i * 3); }
  g.fillStyle = '#fff'; g.font = '800 11px ui-rounded, system-ui, sans-serif'; g.textAlign = 'left';
  g.fillText(prox > 0.9 ? '🔥 HEISS!' : prox > 0.7 ? 'warm…' : prox > 0.45 ? 'lauwarm' : 'kalt ❄️', mx, my - 10);
  if (s.phase === 'search') banner(g, V, '👆 Wisch über den Boden!', s.t);
  if (s.phase === 'found') {
    const k = clamp(s.ft / 0.8, 0, 1);
    const rx = s.rx, ry = gy - 10 - k * 90;
    const gl = g.createRadialGradient(rx, ry, 2, rx, ry, 40); gl.addColorStop(0, 'rgba(255,240,150,0.9)'); gl.addColorStop(1, 'rgba(255,240,150,0)');
    g.fillStyle = gl; g.beginPath(); g.arc(rx, ry, 40, 0, 7); g.fill();
    g.strokeStyle = '#111'; g.lineWidth = 6; g.beginPath(); g.ellipse(rx, ry, 14, 14 * Math.abs(Math.cos(s.ft * 3)) + 3, 0, 0, 7); g.stroke();
    banner(g, V, ev.done || 'GEFUNDEN! 💍', s.t, true);
    if (ev.face) { drawPerson(g, V.w * 0.8, gy - 6 - Math.abs(Math.sin(s.t * 7)) * 12, { faceKey: ev.face, t: s.t, color: '#8e5aa8', scale: SC }); bubble(g, V.w * 0.8, gy - 142, ev.found || 'Danke!!'); }
  }
}

function drawSlot(g, game, s) {
  const V = game.V, gy = V.groundY, cx = V.w * 0.6, top = gy - 200;
  const SYM = ['🍒', '🔔', '7️⃣', '🍋', '⭐', '🍇'];
  g.fillStyle = '#6a1b9a'; roundRect(g, cx - 120, top, 240, 190, 18); g.fill();
  g.strokeStyle = '#ffd23f'; g.lineWidth = 5; g.stroke();
  for (let i = 0; i < 14; i++) { g.fillStyle = (Math.floor(s.t * 8) + i) % 2 ? '#ffd23f' : '#ff4fa3'; g.beginPath(); g.arc(cx - 110 + i * 17, top + 8, 4, 0, 7); g.fill(); }
  g.fillStyle = '#fff'; g.font = '900 16px ui-rounded, system-ui, sans-serif'; g.textAlign = 'center'; g.fillText('🎰 JACKPOT 🎰', cx, top + 34);
  s.reels.forEach((r, i) => {
    const x = cx - 74 + i * 74, y = top + 60;
    g.fillStyle = '#fff'; roundRect(g, x - 30, y, 60, 76, 8); g.fill();
    g.save(); g.beginPath(); g.rect(x - 30, y, 60, 76); g.clip();
    if (r.stopped) emoji(g, '🍒', x, y + 38, 40);
    else { const f = r.off % 1, k = Math.floor(r.off); for (let j = -1; j <= 1; j++) emoji(g, SYM[(k + j + 60) % SYM.length], x, y + 38 + (j + f) * 50, 36); }
    g.restore();
  });
  g.fillStyle = '#c0c0c0'; g.fillRect(cx + 124, top + 40, 8, 70); g.fillStyle = '#e53935'; g.beginPath(); g.arc(cx + 128, top + 36, 10, 0, 7); g.fill();
  if (s.phase === 'main') banner(g, V, s.ev.text || 'Tippe 3× zum Stoppen!', s.t);
  else {
    banner(g, V, s.ev.done || 'JACKPOT!!! 🍒🍒🍒', s.t, true);
    if (s.ev.winner) { drawPerson(g, V.w * 0.18 + 60, gy - 6 - Math.abs(Math.sin(s.t * 7)) * 12, { faceKey: s.ev.winner, t: s.t, color: '#3ea37a', scale: SC }); bubble(g, V.w * 0.18 + 60, gy - 142, s.ev.winnerLine || 'JACKPOT!'); }
    if (s.ev.twerk) {
      const x = V.w * 0.9, y = gy - 6;
      g.save(); g.translate(x, y); g.rotate(Math.sin(s.t * 22) * 0.22); g.translate(-x, -y);
      drawPerson(g, x, y, { faceKey: s.ev.twerk, t: s.t, color: '#d55b8f', scale: SC, wave: false });
      g.restore(); bubble(g, x, gy - 140, s.ev.twerkLine || '*twerk*');
    }
  }
}
