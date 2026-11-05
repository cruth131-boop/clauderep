// Spiel-Intro nach dem Entsperren: Blackscreen → Reißverschluss → Retro-Kimi (GIF-Sprite)
// springt heraus und rennt herum → Titel → Verwandlung in die moderne Kimi mit wechselnden
// Outfits → Menü. Nach dem Geburtstags-Sieg kommen nach und nach alle Gäste dazu und feiern.
import { assets } from './assets.js';
import { Particles, Fireworks } from './fx.js';
import { drawCharacter, drawPerson, drawHero, drawCat, drawFan, drawRollatorOma, roundRect } from './character.js';
import { OUTFIT_PARTS } from './config.js';
import { COSTUMES, drawIceToss } from './levels.js';
import { emoji } from './emoji.js';
import { sfx, playMusic } from './audio.js';

const clamp01 = (v) => Math.max(0, Math.min(1, v));
const ease = (v) => 1 - (1 - clamp01(v)) ** 3;
const easeBack = (v) => { const c = 1.9, x = clamp01(v) - 1; return 1 + (c + 1) * x ** 3 + c * x ** 2; };
const rand = (a, b) => a + Math.random() * (b - a);

const T = { zip0: 0.9, zip1: 2.3, open1: 3.1, jump: 2.55, title: 3.7, morph: 7.6, end: 12.2, party: 11.2 };
const STEP = 2.2;          // Sekunden zwischen zwei neuen Gästen
const COLORS = ['#d55b8f', '#5b7bd5', '#3ea37a', '#e0a030', '#8e5aa8', '#d0503c', '#2a9d8f', '#c06aa0'];

function randomOutfit(i) {
  const keys = (part) => Object.keys(OUTFIT_PARTS[part].options).filter((k) => k !== 'green' && k !== 'track' && k !== 'trackpants');
  const pick = (a, n) => a[(n * 7 + i * 3) % a.length];
  const ex = keys('extra');
  return {
    top: pick(keys('top'), i), topColor: pick(keys('topColor'), i + 2), bottom: pick(keys('bottom'), i + 1),
    socks: pick(keys('socks'), i), shoes: pick(keys('shoes'), i + 1), extra: [ex[(i * 5) % ex.length], ...(i % 2 ? [ex[(i * 3 + 1) % ex.length]] : [])],
  };
}

export class IntroScene {
  constructor({ party = false, outfit, onDone }) {
    this.t = 0; this.onDone = onDone; this.done = false; this.party = party; this.outfit = outfit;
    this.fx = new Particles(); this.fw = new Fireworks(this.fx);
    const cfg = assets.config;
    this.title = cfg.introTitle || ['Die Rückkehr von', cfg.title];
    const cast = (cfg.introCast || []).filter((c) => !c.face || assets.images[c.face] || c.move === 'cat');
    this.cast = cast.map((c, i) => ({ ...c, i, color: c.color || COLORS[i % COLORS.length] }));
    this.names = cfg.guestNames || {};
    this.kx = 0; this.kdir = 1; this.outfitI = 0; this.nextOutfit = 0;
    this.zipSnd = false; this.allT = null; this.sounds = new Set();
  }

  once(key, fn) { if (!this.sounds.has(key)) { this.sounds.add(key); fn(); } }

  tap() {
    if (this.t < 0.6 || this.done) return;
    this.finish();
  }

  finish() { if (this.done) return; this.done = true; this.onDone?.(); }

  // --------------------------------------------------------------- Update
  update(dt, V) {
    this.t += dt; const t = this.t;
    this.fx.update(dt); this.fw.update(dt);
    if (t > T.zip0) this.once('zip', () => sfx('zip'));
    if (t > T.zip1) this.once('rip', () => { sfx('power'); this.fx.burst(V.w / 2, V.h * 0.6, { n: 40, speed: 380, life: 1, size: 4 }); });
    if (t > T.title) this.once('title', () => { sfx('fanfare'); playMusic(assets.audio.music_intro ? 'intro' : 'retro'); });
    if (t > T.morph) this.once('morph', () => {
      sfx('memory'); this.fx.burst(this.kx, V.h * 0.62, { n: 60, speed: 420, life: 1.2, size: 5, colors: ['#fff', '#ffd23f', '#ff8fd0', '#7cf7ff'] });
      this.nextOutfit = t + 0.9;
    });
    // Kimi-Bewegung
    const floor = this.floor(V);
    if (t > T.jump + 0.9 && t < T.morph) {
      this.kx += this.kdir * dt * Math.min(330, V.w * 0.55);
      if (this.kx > V.w * 0.86) { this.kdir = -1; this.kx = V.w * 0.86; }
      if (this.kx < V.w * 0.14) { this.kdir = 1; this.kx = V.w * 0.14; }
      if (Math.random() < dt * 14) this.fx.list.push({ x: this.kx - this.kdir * 30, y: floor - 4, vx: -this.kdir * rand(20, 60), vy: rand(-40, -10), life: 0.5, max: 0.5, color: 'rgba(230,220,255,0.6)', size: 5, gravity: -10, type: 'smoke', rot: 0, vr: 0, drag: 1 });
    } else if (t <= T.jump + 0.9) this.kx = V.w / 2;
    else {
      // nach der Verwandlung: Richtung Mitte laufen
      const target = V.w / 2;
      this.kx += (target - this.kx) * Math.min(1, dt * 2.2);
      if (t > this.nextOutfit && (t < T.party + 0.3 || this.party)) {
        this.outfitI++; this.nextOutfit = t + (t < T.party ? 0.55 : 2.4);
        sfx('collect');
        this.fx.burst(this.kx, floor - 70, { n: 14, speed: 200, life: 0.5, size: 3, colors: ['#fff', '#ffd23f', '#ff8fd0'] });
      }
    }
    // Ende ohne Party
    if (!this.party && t > T.end) this.finish();
    if (this.party && t > T.party) {
      this.once('partyMusic', () => playMusic('bday30'));
      const n = this.arrived();
      for (let i = 0; i < n; i++) {
        const c = this.cast[i];
        this.once(`arr${i}`, () => { sfx(c.move === 'cat' ? 'meow' : 'cheer'); });
      }
      if (n >= this.cast.length && this.allT == null) this.allT = t + 1.3;
      if (this.allT != null && t > this.allT) {
        this.once('all', () => { sfx('fanfare'); });
        if (Math.random() < dt * 2.6) this.fw.launch(rand(V.w * 0.1, V.w * 0.9), V.h, rand(V.h * 0.1, V.h * 0.35));
        if (t > this.allT + 9) this.finish();
      }
      if (Math.random() < dt * 20) this.fx.list.push({ x: rand(0, V.w), y: -10, vx: rand(-30, 30), vy: rand(60, 140), life: 4, max: 4, color: COLORS[(Math.random() * COLORS.length) | 0], size: 4, gravity: 20, type: 'confetti', rot: rand(0, 6), vr: rand(-8, 8), drag: 1 });
    }
  }

  floor(V) { return V.h * 0.86; }
  labelY(V) { const big = Math.min(V.w / 8.5, 64) * 0.75; return V.h * 0.1 + big * 1.9; }
  arrived() { return this.party ? Math.max(0, Math.min(this.cast.length, Math.floor((this.t - T.party) / STEP) + 1)) : 0; }

  // --------------------------------------------------------------- Zeichnen
  draw(g, V) {
    const t = this.t;
    g.fillStyle = '#000'; g.fillRect(0, 0, V.w, V.h);
    if (t < T.zip0) return this.skipHint(g, V);
    const zipK = clamp01((t - T.zip0) / (T.zip1 - T.zip0)); // Schieber oben → unten
    const openK = ease((t - T.zip1) / (T.open1 - T.zip1));   // Hälften fahren auseinander
    // Bühne hinter dem Reißverschluss
    g.save();
    if (openK < 1) this.clipGap(g, V, zipK, openK);
    this.drawStage(g, V);
    if (openK < 1) { // grelles Licht hinter dem Reißverschluss
      const lg = g.createRadialGradient(V.w / 2, V.h * 0.35, 5, V.w / 2, V.h * 0.35, V.h * 0.8);
      lg.addColorStop(0, `rgba(255,240,255,${0.9 * (1 - openK)})`); lg.addColorStop(0.5, `rgba(255,120,220,${0.45 * (1 - openK)})`); lg.addColorStop(1, 'rgba(255,120,220,0)');
      g.fillStyle = lg; g.fillRect(0, 0, V.w, V.h);
    }
    this.drawPeople(g, V);
    g.restore();
    if (openK < 1) this.drawZipper(g, V, zipK, openK);
    this.drawTitle(g, V);
    this.fx.draw(g); this.fw.draw?.(g);
    // Blitz bei der Verwandlung
    const fl = 1 - Math.abs(t - T.morph) / 0.35;
    if (fl > 0) { g.fillStyle = `rgba(255,255,255,${fl * 0.85})`; g.fillRect(0, 0, V.w, V.h); }
    this.skipHint(g, V);
  }

  skipHint(g, V) {
    if (this.t < 1.2) return;
    g.font = '700 12px ui-rounded, system-ui, sans-serif'; g.textAlign = 'right';
    g.fillStyle = 'rgba(255,255,255,0.55)';
    g.fillText(this.party && this.t > T.party ? 'Tippen → Menü' : 'Tippen zum Überspringen', V.w - 12, V.h - 12);
  }

  // Öffnung: oben bereits geöffnet (V-Form bis zum Schieber), danach komplett
  gapPath(g, V, zipK, openK, begin = true) {
    const cx = V.w / 2, sy = zipK * (V.h + 40) - 20;
    const top = 26 + V.w * 0.22 * zipK + openK * V.w * 0.6;
    const bot = openK * V.w * 0.6;
    if (begin) g.beginPath();
    g.moveTo(cx - top, -5); g.lineTo(cx + top, -5);
    g.quadraticCurveTo(cx + top * 0.35 + bot, sy * 0.7, cx + bot, sy);
    g.lineTo(cx + bot, V.h + 5); g.lineTo(cx - bot, V.h + 5); g.lineTo(cx - bot, sy);
    g.quadraticCurveTo(cx - top * 0.35 - bot, sy * 0.7, cx - top, -5);
    g.closePath();
    return { cx, sy, top, bot };
  }

  clipGap(g, V, zipK, openK) { this.gapPath(g, V, zipK, openK); g.clip(); }

  drawZipper(g, V, zipK, openK) {
    const { cx, sy, top, bot } = this.gapPath(g, V, zipK, openK);
    // Stoff (schwarzes Leder) außerhalb der Öffnung
    g.save();
    g.beginPath(); g.rect(0, 0, V.w, V.h);
    this.gapPath(g, V, zipK, openK, false);
    g.fillStyle = '#0b0b10'; g.fill('evenodd');
    g.restore();
    // Zähne entlang beider Kanten
    const edge = (side, k) => { // k: 0..1 entlang der Kante von oben nach unten
      const y = k * V.h;
      if (y < sy) { // geöffnet: entlang der Kurve
        const u = clamp01(y / Math.max(1, sy));
        const xa = cx + side * top, xc = cx + side * (top * 0.35 + bot), xb = cx + side * bot;
        const s = Math.sqrt(u), x = (1 - s) ** 2 * xa + 2 * (1 - s) * s * xc + s * s * xb;
        return [x, y];
      }
      return [cx + side * bot, y];
    };
    const N = Math.ceil(V.h / 9);
    for (let i = 0; i < N; i++) {
      const k = i / N, y = k * V.h;
      for (const side of [-1, 1]) {
        let [x] = edge(side, k);
        const closed = y > sy;
        if (closed && openK === 0) x = cx + side * 0;
        g.fillStyle = (i + (side > 0 ? 1 : 0)) % 2 ? '#d9b44a' : '#a8862a';
        if (closed && openK === 0) { if ((i + (side > 0 ? 1 : 0)) % 2) { roundRect(g, cx - 7, y, 14, 5, 2); g.fill(); } }
        else { roundRect(g, x - (side > 0 ? 0 : 9), y, 9, 5, 2); g.fill(); }
      }
    }
    // Naht
    g.strokeStyle = 'rgba(255,255,255,0.12)'; g.setLineDash([6, 5]); g.lineWidth = 1.5;
    for (const side of [-1, 1]) { g.beginPath(); g.moveTo(cx + side * (bot + 16), Math.max(sy, 0)); g.lineTo(cx + side * (bot + 16), V.h); g.stroke(); }
    g.setLineDash([]);
    // Licht aus dem Spalt
    if (openK < 0.9 && zipK > 0) {
      const lg = g.createRadialGradient(cx, sy * 0.5, 4, cx, sy * 0.5, V.w * 0.5);
      lg.addColorStop(0, `rgba(255,220,255,${0.35 * (1 - openK)})`); lg.addColorStop(1, 'rgba(255,220,255,0)');
      g.fillStyle = lg; g.fillRect(0, 0, V.w, V.h);
    }
    // Schieber
    if (openK < 0.5) {
      g.save(); g.translate(cx + bot, Math.min(sy, V.h - 20)); g.globalAlpha = 1 - openK * 2;
      g.fillStyle = '#c9c9d2'; roundRect(g, -13, -20, 26, 30, 6); g.fill();
      g.fillStyle = '#9a9aa6'; roundRect(g, -7, 8, 14, 34, 6); g.fill();
      g.fillStyle = '#0b0b10'; roundRect(g, -3, 26, 6, 10, 3); g.fill();
      g.fillStyle = 'rgba(255,255,255,0.6)'; g.fillRect(-9, -16, 4, 20);
      g.restore();
    }
  }

  drawStage(g, V) {
    const t = this.t, floor = this.floor(V);
    const party = this.party && t > T.party;
    const bg = g.createLinearGradient(0, 0, 0, V.h);
    bg.addColorStop(0, party ? '#1a0b3b' : '#2a0b4a'); bg.addColorStop(0.7, party ? '#4a1470' : '#7a2a8a'); bg.addColorStop(1, '#1a0828');
    g.fillStyle = bg; g.fillRect(0, 0, V.w, V.h);
    // Sterne
    for (let i = 0; i < 40; i++) {
      const x = (i * 97.3) % V.w, y = (i * 53.7) % (V.h * 0.6), tw = (Math.sin(t * 3 + i) + 1) / 2;
      g.fillStyle = `rgba(255,255,255,${0.2 + tw * 0.6})`; g.fillRect(x, y, 2, 2);
    }
    // Scheinwerfer
    g.save(); g.globalCompositeOperation = 'lighter';
    const beams = party ? 4 : 2;
    for (let i = 0; i < beams; i++) {
      const bx = V.w * (i + 0.5) / beams, a = Math.sin(t * (0.8 + i * 0.3) + i * 2) * 0.5;
      const col = party ? ['255,80,180', '80,200,255', '255,220,80', '140,255,140'][i] : '255,230,255';
      const lg = g.createLinearGradient(bx, 0, bx, floor);
      lg.addColorStop(0, `rgba(${col},0.35)`); lg.addColorStop(1, `rgba(${col},0)`);
      g.fillStyle = lg; g.beginPath(); g.moveTo(bx - 6, 0); g.lineTo(bx + 6, 0);
      g.lineTo(bx + Math.sin(a) * floor + 90, floor); g.lineTo(bx + Math.sin(a) * floor - 90, floor); g.fill();
    }
    g.restore();
    // Bühnenboden
    const fg = g.createLinearGradient(0, floor, 0, V.h);
    fg.addColorStop(0, '#3a1850'); fg.addColorStop(1, '#12061c');
    g.fillStyle = fg; g.fillRect(0, floor, V.w, V.h - floor);
    if (party) { // Tanzfläche mit Leuchtkacheln
      const n = 12, w = V.w / n;
      for (let i = 0; i < n; i++) for (let r = 0; r < 2; r++) {
        const on = (Math.floor(t * 4) + i + r * 3) % 4 === 0;
        g.fillStyle = on ? COLORS[(i + r) % COLORS.length] : 'rgba(255,255,255,0.05)';
        g.globalAlpha = on ? 0.45 : 1; g.fillRect(i * w + 1, floor + r * (V.h - floor) / 2 + 1, w - 2, (V.h - floor) / 2 - 2);
      }
      g.globalAlpha = 1;
    }
    g.fillStyle = 'rgba(255,255,255,0.25)'; g.fillRect(0, floor, V.w, 2);
  }

  // Kimi: GIF-Sprite (retro) oder moderne Figur
  drawKimi(g, V) {
    const t = this.t, floor = this.floor(V);
    if (t < T.jump) return;
    if (t < T.morph) {
      const img = assets.images.intro_kim;
      const meta = assets.config.introGif || { fw: 198, fh: 220, n: 18, ms: 90 };
      const H = Math.min(V.h * 0.56, 300);
      // Sprung aus dem Reißverschluss
      const jk = clamp01((t - T.jump) / 0.9);
      const sc = 0.15 + 0.85 * easeBack(jk);
      const jy = jk < 1 ? Math.sin(jk * Math.PI) * V.h * 0.28 : 0;
      const squish = 1 - Math.max(0, 1 - Math.abs(t - T.morph + 0.12) / 0.12) * 0.9;
      g.save(); g.translate(this.kx, floor - jy + 6);
      g.fillStyle = 'rgba(0,0,0,0.3)'; g.beginPath(); g.ellipse(0, 0, 40 * sc, 7 * sc, 0, 0, 7); g.fill();
      g.scale((this.kdir < 0 ? -1 : 1) * sc * squish, sc);
      if (img) {
        const f = Math.floor(t * 1000 / meta.ms) % meta.n, w = H * meta.fw / meta.fh;
        g.drawImage(img, f * meta.fw, 0, meta.fw, meta.fh, -w / 2, -H, w, H);
      } else drawCharacter(g, 0, 0, { pose: 'run', phase: t * 12, outfit: this.outfit, scale: H / 140, t });
      g.restore();
      return;
    }
    // modern
    const k = ease((t - T.morph) / 0.5);
    const outfit = this.outfitI === 0 ? this.outfit : randomOutfit(this.outfitI);
    const sc = (Math.min(1.7, V.h / 260)) * (0.3 + 0.7 * easeBack(k));
    const party = this.party && t > T.party;
    const moving = Math.abs(this.kx - V.w / 2) > 6;
    const pose = moving ? 'run' : party ? (Math.floor(t * 1.5) % 3 === 0 ? 'jump' : 'cheer') : 'cheer';
    const hop = pose === 'jump' ? Math.abs(Math.sin(t * 4.7)) * 26 : 0;
    drawCharacter(g, this.kx, floor - hop, { pose, phase: t * 12, outfit, scale: sc, t, expr: 'happy' });
  }

  // Gäste-Plätze: bis zu drei Reihen, hintere kleiner
  slots(V) {
    const n = this.cast.length, floor = this.floor(V);
    const perMax = Math.max(4, Math.floor(V.w / 54));
    const rows = Math.max(1, Math.ceil(n / perMax));
    const gapY = Math.min(V.h * 0.12, 70), base = Math.min(1.25, V.h / 330);
    const out = [];
    for (let i = 0; i < n; i++) {
      const row = Math.floor(i / perMax);           // 0 = vorne (erste Gäste)
      const m = Math.min(perMax, n - row * perMax), k = i - row * perMax;
      const side = k % 2 ? -1 : 1, j = Math.floor(k / 2), nSide = side > 0 ? Math.ceil(m / 2) : Math.floor(m / 2) || 1;
      const gap = row === 0 ? Math.min(150, V.w * 0.2) : (V.w - 48) / m * 0.5; // vorne Platz für Kimi
      const half = V.w / 2 - 26 - gap / 2;
      const x = V.w / 2 + side * (gap / 2 + (j + 0.5) * (half / nSide));
      out.push({ x, y: floor - row * gapY, scale: base * Math.max(0.6, 1 - row * 0.12), row: rows - 1 - row });
    }
    return out;
  }

  drawPeople(g, V) {
    const t = this.t;
    const n = this.arrived();
    if (!n) { this.drawKimi(g, V); return; }
    const S = this.slots(V);
    const list = this.cast.slice(0, n).map((c, i) => ({ c, s: S[i], t0: T.party + i * STEP }));
    list.sort((a, b) => a.s.row - b.s.row);
    const drawn = new Set();
    for (const L of list) {
      if (L.s.row === Math.max(...S.map((s) => s.row)) && !drawn.has('kimi')) { this.drawKimi(g, V); drawn.add('kimi'); }
      this.drawGuest(g, V, L.c, L.s, t - L.t0);
    }
    if (!drawn.has('kimi')) this.drawKimi(g, V);
    // Ankunfts-Label
    const last = list.reduce((a, b) => (b.t0 > (a?.t0 ?? -1) ? b : a), null);
    if (last && t - last.t0 < 1.9) {
      const name = last.c.name || this.names[last.c.face] || '';
      if (name) {
        const a = Math.min(1, (1.9 - (t - last.t0)) * 3);
        g.globalAlpha = a; g.font = '900 20px ui-rounded, system-ui, sans-serif'; g.textAlign = 'center';
        g.lineWidth = 5; g.strokeStyle = 'rgba(0,0,0,0.6)';
        const txt = `${last.c.hello || `${name} ist da!`}`;
        const ly = this.labelY(V); g.strokeText(txt, V.w / 2, ly, V.w - 20); g.fillStyle = '#ffd23f'; g.fillText(txt, V.w / 2, ly, V.w - 20);
        g.globalAlpha = 1;
      }
    }
    if (this.allT != null && t > this.allT) {
      const k = easeBack((t - this.allT) / 0.6);
      g.save(); g.translate(V.w / 2, this.labelY(V) + 34); g.scale(k, k);
      g.font = '900 30px ui-rounded, system-ui, sans-serif'; g.textAlign = 'center'; g.lineWidth = 6; g.strokeStyle = '#4a1470';
      const txt = assets.config.introAllLine || 'ALLE DA – PARTY! 🎉';
      g.strokeText(txt, 0, 0, V.w - 20); g.fillStyle = '#fff'; g.fillText(txt, 0, 0, V.w - 20);
      g.restore();
    }
  }

  drawGuest(g, V, c, s, lt) {
    // Einlaufen von der näheren Seite
    const fromX = s.x < V.w / 2 ? -40 : V.w + 40;
    const k = clamp01(lt / 1.1);
    const x = fromX + (s.x - fromX) * ease(k), y = s.y;
    const arriving = k < 1;
    const sc = 0.95 * s.scale, tt = lt + c.i;
    const mv = c.move || 'dance';
    if (mv === 'hero') { // fliegt Kreise über der Party
      const a = lt * 1.4;
      const hx = arriving ? x : V.w / 2 + Math.cos(a) * V.w * 0.36, hy = arriving ? V.h * 0.42 : V.h * 0.44 + Math.sin(a * 2) * V.h * 0.05;
      g.save(); if (!arriving && Math.sin(a) > 0) { g.translate(hx, 0); g.scale(-1, 1); g.translate(-hx, 0); }
      drawHero(g, hx, hy, { pose: 'fly', t: lt, scale: sc * 0.95, costume: COSTUMES[c.costume] || COSTUMES.classic, faceKey: c.face });
      g.restore(); return;
    }
    if (mv === 'cat') { const jy = arriving ? 0 : Math.abs(Math.sin(lt * 5)) * 22; drawCat(g, x, y - jy, { phase: lt * 14, scale: sc * 1.1, t: lt, pose: arriving ? 'run' : (Math.floor(lt) % 3 ? 'run' : 'sit') }); return; }
    if (mv === 'pet') { drawPerson(g, x, y, { faceKey: c.face, t: tt, pet: true, scale: sc * 1.1 }); return; }
    if (mv === 'rollator') { const ox = arriving ? 0 : Math.sin(lt * 1.3) * 30; drawRollatorOma(g, x + ox, y + 4, { t: lt, scale: sc }); return; }
    if (arriving) { drawPerson(g, x, y, { faceKey: c.face, t: tt, color: c.color, scale: sc, run: true, acc: c.acc }); return; }
    switch (mv) {
      case 'twerk': drawPerson(g, x, y, { faceKey: c.face, t: tt, color: c.color, scale: sc, twerk: true, acc: c.acc }); break;
      case 'ice': drawPerson(g, x, y, { faceKey: c.face, t: tt, color: c.color, scale: sc, wave: false, acc: c.acc }); g.save(); g.translate(x, y); g.scale(sc, sc); drawIceToss(g, 0, 0, tt); g.restore(); break;
      case 'flag': drawFan(g, x, y, { faceKey: c.face, t: tt, color: c.color, scale: sc, flag: c.flag || 'GO KIMI! ❤️' }); break;
      case 'cowboy': { // hin und her, Revolver in die Luft, YEEEHA
        const ox = Math.sin(lt * 2.2) * 40, dir = Math.cos(lt * 2.2) >= 0 ? 1 : -1;
        g.save(); g.translate(x + ox, 0); g.scale(dir, 1); g.translate(-(x + ox), 0);
        drawPerson(g, x + ox, y, { faceKey: c.face, t: tt, color: c.color || '#8a5a2b', scale: sc, run: true, acc: ['cowboyhat', ...(c.acc || [])] });
        g.restore();
        const gx = x + ox + dir * 16 * sc, gy = y - 96 * sc;
        g.fillStyle = '#333'; g.fillRect(gx - 3, gy, 6, 14 * sc);
        if ((lt * 3) % 1 < 0.15) { g.fillStyle = '#ffd23f'; g.beginPath(); g.arc(gx, gy - 4, 7 * sc, 0, 7); g.fill(); this.once(`bang${Math.floor(lt * 3)}`, () => sfx('shot')); }
        if (lt % 4 < 1.4) this.bubble(g, x + ox, y - 130 * sc, c.line || 'YEEEEHA!');
        break;
      }
      case 'drunk': {
        g.save(); g.translate(x, y); g.rotate(Math.sin(lt * 1.7) * 0.18); g.translate(-x, -y);
        drawPerson(g, x, y, { faceKey: c.face, t: tt, color: c.color, scale: sc, wave: false, acc: c.acc, expr: 'happy' });
        g.restore();
        emoji(g, c.prop || '🍹', x + 22 * sc, y - 70 * sc, 26 * sc);
        if (lt % 3.5 < 1) this.bubble(g, x, y - 120 * sc, c.line || '*hicks*');
        break;
      }
      case 'griess': {
        drawPerson(g, x, y, { faceKey: c.face, t: tt, color: c.color, scale: sc, wave: false, acc: c.acc });
        const bx = x + 20 * sc, by = y - 52 * sc;
        g.fillStyle = '#f3ead2'; g.beginPath(); g.ellipse(bx, by, 14 * sc, 5 * sc, 0, 0, 7); g.fill();
        g.fillStyle = '#e9ddb8'; for (let q = 0; q < 4; q++) { g.beginPath(); g.arc(bx - 8 * sc + q * 5 * sc, by - 2 * sc, 3.2 * sc, 0, 7); g.fill(); }
        g.fillStyle = '#5b7bd5'; g.beginPath(); g.moveTo(bx - 14 * sc, by); g.lineTo(bx + 14 * sc, by); g.lineTo(bx + 9 * sc, by + 10 * sc); g.lineTo(bx - 9 * sc, by + 10 * sc); g.fill();
        g.strokeStyle = '#bbb'; g.lineWidth = 2.5 * sc; g.beginPath(); g.moveTo(bx + Math.cos(lt * 6) * 6 * sc, by - 2 * sc); g.lineTo(bx + Math.cos(lt * 6) * 3 * sc, by - 22 * sc); g.stroke();
        break;
      }
      case 'jump': drawPerson(g, x, y - Math.abs(Math.sin(lt * 5)) * 20 * sc, { faceKey: c.face, t: tt, color: c.color, scale: sc, acc: c.acc }); break;
      case 'drink': drawPerson(g, x, y, { faceKey: c.face, t: tt, color: c.color, scale: sc, acc: c.acc }); emoji(g, c.prop || '🍺', x - 22 * sc, y - 56 * sc - Math.abs(Math.sin(lt * 3)) * 8, 22 * sc); break;
      default: drawPerson(g, x, y - Math.abs(Math.sin(lt * 4 + c.i)) * 8 * sc, { faceKey: c.face, t: tt, color: c.color, scale: sc, acc: c.acc, emojiHead: c.emoji });
    }
    if (c.prop && !['drunk', 'drink'].includes(mv)) emoji(g, c.prop, x - 22 * sc, y - 60 * sc, 22 * sc);
  }

  bubble(g, x, y, text) {
    g.font = '900 14px ui-rounded, system-ui, sans-serif';
    const w = g.measureText(text).width + 16;
    g.fillStyle = '#fff'; roundRect(g, x - w / 2, y - 14, w, 24, 10); g.fill();
    g.beginPath(); g.moveTo(x - 5, y + 9); g.lineTo(x + 3, y + 18); g.lineTo(x + 7, y + 9); g.fill();
    g.fillStyle = '#222'; g.textAlign = 'center'; g.fillText(text, x, y + 3);
  }

  drawTitle(g, V) {
    const t = this.t - T.title;
    if (t < 0) return;
    const party = this.party && this.t > T.party;
    const y0 = party ? V.h * 0.1 : V.h * 0.16;
    const big = Math.min(V.w / 8.5, 64) * (party ? 0.75 : 1);
    const k1 = easeBack(t / 0.5), k2 = easeBack((t - 0.45) / 0.6);
    g.save(); g.textAlign = 'center';
    g.globalAlpha = clamp01(t / 0.3);
    g.font = `800 ${big * 0.42}px ui-rounded, system-ui, sans-serif`;
    g.fillStyle = '#ffd6f2'; g.fillText(this.title[0], V.w / 2, y0 - 6 + (1 - k1) * -60);
    g.restore();
    if (t < 0.45) return;
    g.save(); g.translate(V.w / 2, y0 + big * 0.95); g.scale(k2, k2); g.rotate(Math.sin(this.t * 2) * 0.025);
    g.font = `900 ${big}px ui-rounded, system-ui, sans-serif`; g.textAlign = 'center';
    const tg = g.createLinearGradient(0, -big, 0, 0);
    tg.addColorStop(0, '#fff6a8'); tg.addColorStop(0.5, '#ffd23f'); tg.addColorStop(1, '#ff8a1c');
    g.shadowColor = '#ff4fa3'; g.shadowBlur = 18 + Math.sin(this.t * 5) * 8;
    g.lineWidth = big * 0.14; g.strokeStyle = '#3a0b4a'; g.strokeText(this.title[1], 0, 0, V.w - 24);
    g.shadowBlur = 0; g.fillStyle = tg; g.fillText(this.title[1], 0, 0, V.w - 24);
    g.restore();
    // Funkeln
    for (let i = 0; i < 4; i++) {
      const a = this.t * 2 + i * 1.6, r = big * (2.3 + i * 0.5);
      const fx = V.w / 2 + Math.cos(a) * Math.min(r, V.w * 0.45), fy = y0 + big * 0.6 + Math.sin(a * 1.3) * big * 0.5;
      const tw = (Math.sin(this.t * 7 + i) + 1) / 2;
      g.fillStyle = `rgba(255,255,255,${tw})`; g.beginPath();
      g.moveTo(fx, fy - 7); g.lineTo(fx + 2, fy - 2); g.lineTo(fx + 7, fy); g.lineTo(fx + 2, fy + 2); g.lineTo(fx, fy + 7); g.lineTo(fx - 2, fy + 2); g.lineTo(fx - 7, fy); g.lineTo(fx - 2, fy - 2); g.fill();
    }
  }
}
