// Einspieler: Mini-Szenen nach dem Verlieren, Finale mit Feuerwerk, Geschenk, Karte.
import { assets, getFace } from './assets.js';
import { Particles, Fireworks } from './fx.js';
import { drawCat, roundRect, star } from './character.js';
import { sfx, playMusic } from './audio.js';

const pick = (a) => a[(Math.random() * a.length) | 0];
const ease = (t) => 1 - (1 - Math.min(1, Math.max(0, t))) ** 3;

function caption(g, V, text, y, size = 22, color = '#fff') {
  g.font = `900 ${size}px ui-rounded, system-ui, sans-serif`;
  g.textAlign = 'center'; g.lineWidth = 5; g.strokeStyle = 'rgba(0,0,0,0.6)';
  const maxW = V.w - 30;
  g.strokeText(text, V.w / 2, y, maxW); g.fillStyle = color; g.fillText(text, V.w / 2, y, maxW);
}

function drawFaceAt(g, key, expr, cx, cy, h, rot = 0) {
  const { img, exact } = getFace(key, expr);
  const w = h * (img.width / img.height);
  g.save(); g.translate(cx, cy); g.rotate(rot);
  if (!exact && expr === 'sad') g.filter = 'grayscale(0.85) brightness(0.85)';
  g.drawImage(img, -w / 2, -h / 2, w, h);
  g.filter = 'none';
  if (!exact && expr === 'sad') {
    g.fillStyle = '#7cc6ff';
    const ty = (performance.now() / 12) % (h * 0.35);
    for (const sx of [-0.17, 0.17]) { g.beginPath(); g.ellipse(w * sx, -h * 0.02 + ty, h * 0.022, h * 0.035, 0, 0, 7); g.fill(); }
  }
  g.restore();
}

function photoCard(g, img, cx, cy, W, rot, label) {
  const H = W * 1.18;
  g.save(); g.translate(cx, cy); g.rotate(rot);
  g.shadowColor = 'rgba(0,0,0,0.4)'; g.shadowBlur = 16; g.shadowOffsetY = 6;
  g.fillStyle = '#fffdf7'; g.fillRect(-W / 2, -H / 2, W, H); g.shadowColor = 'transparent';
  const iw = W - 16, ih = iw;
  if (img) {
    const s = Math.max(iw / img.width, ih / img.height);
    g.save(); g.beginPath(); g.rect(-iw / 2, -H / 2 + 8, iw, ih); g.clip();
    g.drawImage(img, -img.width * s / 2, -H / 2 + 8 + ih / 2 - img.height * s / 2, img.width * s, img.height * s); g.restore();
  } else {
    g.fillStyle = '#d8d2e6'; g.fillRect(-iw / 2, -H / 2 + 8, iw, ih);
    g.font = `${W * 0.3}px sans-serif`; g.textAlign = 'center'; g.fillText('🚑', 0, -H / 2 + 8 + ih * 0.62);
  }
  g.fillStyle = '#222'; g.font = `800 ${Math.max(10, W * 0.075)}px ui-rounded, system-ui, sans-serif`; g.textAlign = 'center';
  g.fillText(label, 0, H / 2 - 12, W - 12);
  g.restore();
}

// --------------------------------------------------------------------------
// Mini-Einspieler nach dem Verlieren
// --------------------------------------------------------------------------
let lastScene = '';
const pick2 = (obj, arr) => (obj._p ??= arr[(Math.random() * arr.length) | 0]);
export class LoseScene {
  constructor(info, onDone) {
    this.info = info; this.onDone = onDone; this.t = 0; this.done = false;
    const cfg = assets.config;
    const options = ['rain', 'zoom', 'violin', 'er', 'sadface'];
    if (assets.images.her_meh_0) options.push('meh', 'meh');
    if ((cfg.cameos || []).some((c) => c.oma)) options.push('oma');
    if (assets.images.katha_shock && !assets.kidMode) options.push('katha', 'katha');
    let k; do { k = pick(options); } while (k === lastScene && options.length > 1);
    // Verletzungsszene etwas seltener, wenn kein Foto da ist
    this.kind = lastScene = k;
    this.dur = k === 'er' ? 3.4 : 2.8;
    this.rain = Array.from({ length: 40 }, () => ({ x: Math.random(), y: Math.random(), s: 0.6 + Math.random() * 0.6 }));
    sfx({ rain: 'sad', sadface: 'sad', cat: 'meow', zoom: 'dun', violin: 'violin', er: 'drumroll', oma: 'sad', meh: 'sad', katha: 'dun' }[k]);
    this.partner = cfg.partnerName || 'Er';
  }
  tap() { if (this.t > 0.4) this.finish(); }
  finish() { if (!this.done) { this.done = true; this.onDone(); } }
  update(dt) { this.t += dt; if (this.t > this.dur) this.finish(); }
  draw(g, V) {
    const t = this.t, cx = V.w / 2, cy = V.h * 0.45;
    const fade = Math.min(1, t * 4) * Math.min(1, (this.dur - t) * 4);
    g.save(); g.globalAlpha = fade;
    g.fillStyle = 'rgba(15,8,30,0.78)'; g.fillRect(0, 0, V.w, V.h);
    const S = Math.min(V.w, V.h * 1.2);
    if (this.kind === 'rain') {
      const h = S * 0.42;
      drawFaceAt(g, 'him', 'sad', cx, cy + Math.sin(t * 3) * 3, h);
      g.fillStyle = '#9aa3b5';
      const ky = cy - h * 0.85;
      for (const [dx, r] of [[-0.18, 0.12], [0, 0.16], [0.18, 0.12], [0.09, 0.1], [-0.09, 0.1]]) { g.beginPath(); g.arc(cx + dx * S, ky, r * S * 0.6, 0, 7); g.fill(); }
      g.strokeStyle = '#7cc6ff'; g.lineWidth = 2;
      for (const d of this.rain) {
        const x = cx + (d.x - 0.5) * S * 0.4, y = ky + 10 + ((d.y + t * d.s * 1.5) % 1) * h * 1.2;
        g.beginPath(); g.moveTo(x, y); g.lineTo(x - 2, y + 8); g.stroke();
      }
      caption(g, V, `${this.partner} ist jetzt traurig. 🌧️`, cy + h * 0.75);
    } else if (this.kind === 'cat') {
      if (assets.images.fips_sad) drawFaceAt(g, 'fips', 'sad', cx, cy - S * 0.02, S * 0.42, Math.sin(t * 1.5) * 0.06);
      else drawCat(g, cx, cy + S * 0.18, { pose: 'sit', scale: S / 110, flip: true, t });
      caption(g, V, `${assets.config.catName || 'Fips'} ist enttäuscht. 😾`, cy + S * 0.32);
      if (t > 1.2) caption(g, V, '…und dreht dir den Rücken zu.', cy + S * 0.32 + 30, 16, '#d9c8ef');
    } else if (this.kind === 'zoom') {
      const z = 0.3 + ease(t / 1.2) * 0.5 + (t > 1.2 ? (t - 1.2) * 0.05 : 0);
      const sh = t > 0.7 && t < 1.4 ? (Math.random() - 0.5) * 8 : 0;
      drawFaceAt(g, 'her', 'shock', cx + sh, cy + sh, S * z);
      const gr = g.createRadialGradient(cx, cy, S * 0.2, cx, cy, S * 0.9);
      gr.addColorStop(0, 'rgba(120,0,0,0)'); gr.addColorStop(1, 'rgba(120,0,0,0.7)');
      g.fillStyle = gr; g.fillRect(0, 0, V.w, V.h);
      caption(g, V, 'DUN DUN DUNNN…', V.h * 0.85, 26, '#ff6b6b');
    } else if (this.kind === 'violin') {
      const h = S * 0.4;
      drawFaceAt(g, 'him', 'sad', cx, cy, h, Math.sin(t * 2) * 0.05);
      // Mini-Geige
      g.save(); g.translate(cx + h * 0.42, cy + h * 0.35); g.rotate(-0.6 + Math.sin(t * 6) * 0.05);
      g.fillStyle = '#a0522d'; g.beginPath(); g.ellipse(0, 0, 9, 14, 0, 0, 7); g.fill();
      g.fillStyle = '#5a2d0c'; g.fillRect(-1.5, -30, 3, 18);
      g.restore();
      g.strokeStyle = '#ddd'; g.lineWidth = 1.5;
      const bx = Math.sin(t * 8) * 10;
      g.beginPath(); g.moveTo(cx + h * 0.2 + bx, cy + h * 0.2); g.lineTo(cx + h * 0.65 + bx, cy + h * 0.5); g.stroke();
      g.fillStyle = '#fff'; g.font = '20px sans-serif';
      for (let i = 0; i < 3; i++) g.fillText('♪', cx + h * 0.5 + i * 18, cy - ((t * 40 + i * 30) % 90));
      caption(g, V, 'Die kleinste Geige der Welt spielt nur für dich.', cy + h * 0.75, 18);
    } else if (this.kind === 'er') {
      const blink = Math.floor(t * 6) % 2;
      g.fillStyle = blink ? 'rgba(255,40,40,0.25)' : 'rgba(40,120,255,0.25)'; g.fillRect(0, 0, V.w, V.h);
      const W = Math.min(V.w * 0.4, V.h * 0.42);
      const i1 = assets.images.injury_op, i2 = assets.images.injury_wheelchair;
      photoCard(g, i1, cx - W * 0.45 * ease(t / 0.6), cy - 6, W, -0.08, 'Not-OP!');
      if (t > 1.0) photoCard(g, i2, cx + W * 0.5, cy + 8 - (1 - ease((t - 1) / 0.5)) * V.h, W, 0.07, 'Reha: 6 Wochen');
      caption(g, V, `Diagnose: ${pick(['Messlatte überschätzt', 'zu wenig Anlauf', 'Kerzen-Trauma'])}`, V.h * 0.9, 18);
      this.diag ||= null;
    } else if (this.kind === 'katha') { // geschockte beste Freundin springt ins Bild
      const k = ease(t / 0.35), h = S * 0.5 * (0.6 + 0.4 * k), sh = t < 0.6 ? Math.sin(t * 60) * 6 * (1 - t / 0.6) : 0;
      drawFaceAt(g, 'katha_shock', 'normal', cx + sh, cy, h, Math.sin(t * 3) * 0.04);
      g.fillStyle = '#ffd23f'; g.font = `900 ${Math.round(h * 0.22)}px ui-rounded, system-ui, sans-serif`; g.textAlign = 'center'; for (let i = 0; i < 3; i++) { const a = -0.5 + i * 0.5; g.fillText('!', cx + h * 0.55 + i * h * 0.12, cy - h * 0.25 + Math.sin(t * 12 + i) * 4 + i * 6); }
      caption(g, V, assets.config.kathaShockLine || 'Katha ist geschockt! 😱', cy + h * 0.62, 22, '#ffd23f');
    } else if (this.kind === 'sadface') {
      const h = S * 0.5;
      drawFaceAt(g, 'her', 'sad', cx, cy + Math.sin(t * 2) * 3, h);
      caption(g, V, pick2(this, ['Och nööö…', 'Heul doch nicht, Bish!', 'Das tat weh.']), cy + h * 0.62, 20);
    } else if (this.kind === 'meh') {
      const h = S * 0.55 * (0.85 + ease(t / 0.5) * 0.15);
      drawFaceAt(g, 'her', 'meh', cx, cy, h);
      const line = assets.config.loseLines?.[0] || 'Das hab ich mir so nicht vorgestellt!';
      if (t > 0.5) caption(g, V, line, cy + h * 0.62, Math.min(24, V.w / 20), '#ffd23f');
    } else if (this.kind === 'oma') {
      const h = S * 0.42;
      drawFaceAt(g, 'oma', 'normal', cx, cy, h, Math.sin(t * 9) * 0.18);
      const omaCfg = (assets.config.cameos || []).find((c) => c.oma);
      caption(g, V, omaCfg?.loseLine || '„Bei so einer Leistung gibt es keine Graupensuppe!"', cy + h * 0.75, 17);
    }
    g.restore();
    g.fillStyle = 'rgba(255,255,255,0.6)'; g.font = '700 12px system-ui'; g.textAlign = 'right';
    g.fillText('Tippen zum Überspringen', V.w - 12, V.h - 12);
  }
}

// --------------------------------------------------------------------------
// Finale: Feuerwerk -> Geschenk (10x tippen) -> Enthüllung
// --------------------------------------------------------------------------
export class FinaleScene {
  constructor(game, { onReveal, outfit }) {
    this.game = game; this.onReveal = onReveal; this.outfit = outfit;
    this.t = 0; this.phase = 'fireworks';
    this.p = new Particles(); this.fw = new Fireworks(this.p);
    this.nextLaunch = 0; this.taps = 0; this.box = { y: -200, vy: 0, shake: 0, squash: 0, landed: false };
    this.headlineT = 0; this.revealT = 0;
    playMusic('finale');
  }

  tap(x, y, V) {
    if (this.phase === 'gift' && this.box.landed) {
      this.taps++;
      this.box.shake = 0.35 + this.taps * 0.035; this.box.squash = 1;
      sfx('tap', this.taps);
      this.p.burst(V.w * 0.6, this.box.y - 30, { n: 8 + this.taps * 2, type: 'confetti', speed: 200 + this.taps * 20, size: 3.5, gravity: 500 });
      if (this.taps >= 15) this.explode(V);
    } else if (this.phase === 'fireworks' && this.t > 3) {
      this.t = Math.max(this.t, 8.5); // abkürzen
    }
  }

  explode(V) {
    this.phase = 'boom'; this.revealT = 0;
    sfx('explode');
    for (let i = 0; i < 4; i++) this.p.burst(V.w * 0.6, this.box.y - 30, { n: 60, type: 'confetti', speed: 520, size: 5, gravity: 380, life: 2.2 });
    this.p.burst(V.w * 0.6, this.box.y - 30, { n: 60, speed: 400, size: 3, gravity: 100, life: 1.4 });
    this.fw.flash = 1;
  }

  update(dt, V) {
    this.t += dt;
    this.fw.update(dt); this.p.update(dt);
    const launchY = V.groundY;
    if (this.phase === 'fireworks') {
      this.nextLaunch -= dt;
      if (this.nextLaunch <= 0) {
        this.nextLaunch = 0.25 + Math.random() * 0.35;
        const shape = Math.random() < 0.15 ? 'heart' : Math.random() < 0.2 ? 'ring' : 'ball';
        this.fw.launch(V.w * (0.15 + Math.random() * 0.7), launchY, V.groundY * (0.15 + Math.random() * 0.35), { shape });
        sfx('launch'); setTimeout(() => sfx('boom'), 700);
      }
      if (!this.text34 && this.t > 1.8) { this.text34 = true; this.fw.launchText(V.w * 0.5, launchY, V.groundY * 0.3, String(assets.config.age || 34)); }
      if (!this.heart && this.t > 4.5) { this.heart = true; this.fw.launch(V.w * 0.5, launchY, V.groundY * 0.3, { shape: 'heart', colors: ['#ff4fa3', '#ffd1e8'] }); }
      if (this.t > 9) { this.phase = 'gift'; this.box.y = -120; sfx('drumroll'); }
    } else if (this.phase === 'gift') {
      const b = this.box, floor = V.groundY - 4;
      if (!b.landed) {
        b.vy += 1800 * dt; b.y += b.vy * dt;
        if (b.y >= floor) { b.y = floor; if (b.vy > 200) { b.vy = -b.vy * 0.35; this.p.burst(V.w * 0.6, floor, { n: 14, type: 'smoke', colors: ['#fff'], speed: 120, size: 6, gravity: -20 }); } else { b.vy = 0; b.landed = true; } }
      }
      b.shake = Math.max(0, b.shake - dt * 1.5); b.squash = Math.max(0, b.squash - dt * 5);
      // Idle-Wackeln, damit klar ist: anfassen!
      if (b.landed && Math.floor(this.t * 1.2) % 2 === 0 && b.shake < 0.05) b.shake = 0.08; // wackelt von selbst und lädt zum Antippen ein
      this.nextLaunch -= dt;
      if (this.nextLaunch <= 0) { this.nextLaunch = 1.2 + Math.random(); this.fw.launch(V.w * (0.1 + Math.random() * 0.8), launchY, V.groundY * 0.25); }
    } else if (this.phase === 'boom') {
      this.revealT += dt;
      if (this.revealT > 1.1 && !this.revealed) { this.revealed = true; this.onReveal(); }
      this.nextLaunch -= dt;
      if (this.nextLaunch <= 0) { this.nextLaunch = 0.5 + Math.random() * 0.6; this.fw.launch(V.w * (0.1 + Math.random() * 0.8), launchY, V.groundY * (0.15 + Math.random() * 0.3), { shape: Math.random() < 0.3 ? 'heart' : 'ball' }); sfx('launch'); }
    }
  }

  draw(g, V) {
    const cfg = assets.config;
    // Nachthimmel über die Spielszene legen
    g.fillStyle = `rgba(10,5,30,${Math.min(0.55, this.t * 0.4)})`; g.fillRect(0, 0, V.w, V.h);
    g.save(); g.globalCompositeOperation = 'lighter'; this.p.draw(g); g.restore();
    for (const r of this.fw.rockets) { g.fillStyle = '#fff'; g.beginPath(); g.arc(r.x, r.y, 2.5, 0, 7); g.fill(); }
    if (this.fw.flash > 0) { g.fillStyle = `rgba(255,240,220,${this.fw.flash * 0.25})`; g.fillRect(0, 0, V.w, V.h); }

    if (this.phase === 'fireworks') {
      const head = cfg.finale?.headline || 'HAPPY BIRTHDAY!';
      const size = Math.min(56, V.w / (head.length * 0.62));
      g.font = `900 ${size}px ui-rounded, system-ui, sans-serif`; g.textAlign = 'center';
      const total = g.measureText(head).width;
      let x = V.w / 2 - total / 2;
      const y = Math.max(size + 20, V.groundY * 0.22);
      const cols = ['#ff4fa3', '#ffd23f', '#3ee6b4', '#7cc6ff', '#c77dff'];
      for (let i = 0; i < head.length; i++) {
        const ch = head[i], w = g.measureText(ch).width;
        const appear = ease((this.t - 0.3 - i * 0.05) * 3);
        if (appear <= 0) { x += w; continue; }
        const by = y + Math.sin(this.t * 6 + i * 0.5) * 5 - (1 - appear) * 60;
        g.save(); g.translate(x + w / 2, by); g.scale(appear, appear);
        g.lineWidth = 6; g.strokeStyle = 'rgba(0,0,0,0.5)'; g.strokeText(ch, 0, 0);
        g.fillStyle = cols[i % cols.length]; g.fillText(ch, 0, 0); g.restore();
        x += w;
      }
      if (cfg.name && this.t > 1.2) caption(g, V, cfg.name.toUpperCase(), y + size * 0.9, size * 0.6, '#fff');
      // Sein glücklicher Kopf ploppt von unten rein
      if (this.t > 3) {
        const k = ease((this.t - 3) * 2);
        const hh = Math.min(V.h * 0.25, 110);
        drawFaceAt(g, 'him', 'happy', V.w * 0.84, V.h + hh * 0.2 - k * hh * 0.9, hh, Math.sin(this.t * 4) * 0.12);
        if (k > 0.9) bubble(g, V.w * 0.84 - hh * 0.4, V.h - hh * 0.95, cfg.finale?.partnerLine || 'GESCHAFFT!!');
      }
      if (this.t > 3.5) {
        g.fillStyle = 'rgba(255,255,255,0.6)'; g.font = '700 12px system-ui'; g.textAlign = 'right';
        g.fillText('Tippen zum Weitermachen', V.w - 12, V.h - 12);
      }
    }
    if (this.phase === 'gift' || this.phase === 'boom') this.drawGift(g, V);
  }

  drawGift(g, V) {
    const b = this.box, cx = V.w * 0.6;
    if (this.phase === 'gift') {
      const s = Math.min(1.4, V.h / 260);
      const sh = b.shake > 0 ? Math.sin(this.t * 70) * b.shake * 10 : 0;
      const sq = b.squash * 0.15;
      g.save(); g.translate(cx + sh, b.y); g.rotate(sh * 0.02); g.scale(s * (1 + sq), s * (1 - sq));
      const glow = g.createRadialGradient(0, -35, 5, 0, -35, 90);
      glow.addColorStop(0, `rgba(255,210,63,${0.25 + this.taps * 0.035})`); glow.addColorStop(1, 'rgba(255,210,63,0)');
      g.fillStyle = glow; g.beginPath(); g.arc(0, -35, 90, 0, 7); g.fill();
      g.fillStyle = '#ff4fa3'; roundRect(g, -34, -60, 68, 60, 6); g.fill();
      g.fillStyle = '#ffd23f'; g.fillRect(-6, -60, 12, 60);
      // Deckel hüpft mit jedem Tippen höher
      const lid = -Math.abs(Math.sin(this.t * 18)) * this.taps * 0.6 * (b.shake > 0.1 ? 1 : 0.2);
      g.fillStyle = '#ff6fb5'; roundRect(g, -38, -72 + lid, 76, 16, 5); g.fill();
      g.fillStyle = '#ffd23f'; g.fillRect(-6, -72 + lid, 12, 16);
      g.beginPath(); g.ellipse(-13, -78 + lid, 13, 8, -0.5, 0, 7); g.ellipse(13, -78 + lid, 13, 8, 0.5, 0, 7); g.fill();
      g.fillStyle = '#e6b800'; g.beginPath(); g.arc(0, -76 + lid, 5, 0, 7); g.fill();
      g.fillStyle = 'rgba(255,255,255,0.8)';
      for (let i = 0; i < this.taps; i++) star(g, -26 + (i % 5) * 13, -50 + Math.floor(i / 5) * 16, 2.6);
      g.restore();
      if (b.landed) {
        caption(g, V, assets.config.finale?.giftPrompt || 'Moment… da ist noch was! 🎁', Math.max(40, V.groundY * 0.25), Math.min(22, V.w / 22));
      }
    } else {
      const k = this.revealT;
      g.save(); g.translate(cx, b.y - 40); g.globalCompositeOperation = 'lighter';
      for (let i = 0; i < 16; i++) {
        g.rotate(Math.PI / 8 + k * 0.02);
        g.fillStyle = `rgba(255,220,120,${Math.max(0, 0.35 - k * 0.2)})`;
        g.beginPath(); g.moveTo(0, 0); g.lineTo(-20, -V.w); g.lineTo(20, -V.w); g.fill();
      }
      g.restore();
    }
  }
}

function bubble(g, x, y, text) {
  g.font = '900 16px ui-rounded, system-ui, sans-serif';
  const w = g.measureText(text).width + 20;
  g.fillStyle = '#fff'; roundRect(g, x - w, y - 30, w, 30, 12); g.fill();
  g.beginPath(); g.moveTo(x - 20, y); g.lineTo(x - 6, y + 12); g.lineTo(x - 8, y); g.fill();
  g.fillStyle = '#ff4fa3'; g.textAlign = 'center'; g.fillText(text, x - w / 2, y - 9);
}

// --------------------------------------------------------------------------
// Roadtrip-Karte im Enthüllungs-Screen
// --------------------------------------------------------------------------
export function animateMap(canvas, stops) {
  const g = canvas.getContext('2d');
  const W = canvas.width, H = canvas.height;
  const n = stops.length;
  const loop = n > 2 && stops[0] === stops[n - 1];
  const uniq = loop ? stops.slice(0, -1) : stops;
  const pts = uniq.map((_, i) => {
    const u = uniq.length === 1 ? 0.5 : i / (uniq.length - 1);
    return [W * (0.84 - u * 0.62), H * (0.45 + Math.sin(u * Math.PI * 1.3 + 0.4) * 0.17)];
  });
  const path = loop ? [...pts, pts[0]] : pts;
  const segLen = []; let total = 0;
  for (let i = 1; i < path.length; i++) { const d = Math.hypot(path[i][0] - path[i - 1][0], path[i][1] - path[i - 1][1]); segLen.push(d); total += d; }
  const at = (dist) => {
    for (let i = 0; i < segLen.length; i++) {
      if (dist <= segLen[i]) { const u = dist / segLen[i]; return [path[i][0] + (path[i + 1][0] - path[i][0]) * u, path[i][1] + (path[i + 1][1] - path[i][1]) * u, Math.atan2(path[i + 1][1] - path[i][1], path[i + 1][0] - path[i][0])]; }
      dist -= segLen[i];
    }
    const l = path[path.length - 1]; return [l[0], l[1], 0];
  };
  let t0 = null, stopped = false;
  const frame = (ts) => {
    if (stopped) return;
    if (t0 == null) t0 = ts;
    const t = (ts - t0) / 1000;
    g.clearRect(0, 0, W, H);
    // Landmasse
    const bg = g.createLinearGradient(0, 0, 0, H); bg.addColorStop(0, '#2f6f5e'); bg.addColorStop(1, '#24564a');
    g.fillStyle = bg; g.fillRect(0, 0, W, H);
    g.fillStyle = '#3d86a8'; g.beginPath(); g.moveTo(0, 0); g.lineTo(W * 0.12, 0); g.quadraticCurveTo(W * 0.05, H * 0.5, W * 0.14, H); g.lineTo(0, H); g.fill();
    g.fillStyle = 'rgba(255,255,255,0.06)';
    for (let i = 0; i < 12; i++) { g.beginPath(); g.arc((i * 137) % W, (i * 71) % H, 18 + (i % 4) * 6, 0, 7); g.fill(); }
    // Route
    const prog = Math.min(1, t / 4) * total;
    g.setLineDash([10, 8]); g.lineDashOffset = -t * 30; g.strokeStyle = 'rgba(255,255,255,0.35)'; g.lineWidth = 4;
    g.beginPath(); path.forEach(([x, y], i) => (i ? g.lineTo(x, y) : g.moveTo(x, y))); g.stroke();
    g.setLineDash([]); g.strokeStyle = '#ffd23f'; g.lineWidth = 5; g.lineCap = 'round';
    g.beginPath(); let d = 0; g.moveTo(path[0][0], path[0][1]);
    for (let i = 1; i < path.length && d < prog; i++) {
      const rem = Math.min(segLen[i - 1], prog - d);
      const u = rem / segLen[i - 1];
      g.lineTo(path[i - 1][0] + (path[i][0] - path[i - 1][0]) * u, path[i - 1][1] + (path[i][1] - path[i - 1][1]) * u);
      d += segLen[i - 1];
    }
    g.stroke();
    // Pins
    pts.forEach(([x, y], i) => {
      let reach = 0; for (let k = 0; k < i; k++) reach += segLen[k];
      const k = Math.min(1, Math.max(0, (prog - reach + 20) / 40));
      if (i === 0) { /* Start immer sichtbar */ }
      const s = i === 0 ? 1 : ease(k) * (1 + Math.sin(t * 4 + i) * 0.04);
      if (s <= 0) return;
      g.save(); g.translate(x, y); g.scale(s, s);
      g.fillStyle = i === 0 ? '#7cc6ff' : '#ff4fa3';
      g.beginPath(); g.arc(0, -18, 11, Math.PI, 0); g.lineTo(0, 0); g.closePath(); g.fill();
      g.fillStyle = '#fff'; g.beginPath(); g.arc(0, -18, 4.5, 0, 7); g.fill();
      g.font = '900 17px ui-rounded, system-ui, sans-serif'; g.textAlign = 'center';
      g.lineWidth = 4; g.strokeStyle = 'rgba(0,0,0,0.55)'; g.strokeText(uniq[i], 0, 20); g.fillStyle = '#fff'; g.fillText(uniq[i], 0, 20);
      g.restore();
    });
    // Auto (fährt danach in Schleife weiter)
    const carD = t < 4 ? prog : ((t - 4) * 60) % total;
    const [cx, cy, ang] = at(carD);
    g.save(); g.translate(cx, cy - 6); if (Math.abs(ang) > Math.PI / 2) g.scale(-1, 1);
    const bob = Math.sin(t * 20) * 0.8;
    g.fillStyle = '#e8424f'; roundRect(g, -16, -8 + bob, 32, 11, 4); g.fill();
    g.fillStyle = '#ff6b6b'; roundRect(g, -9, -15 + bob, 17, 9, 3); g.fill();
    g.fillStyle = '#bfe6ff'; g.fillRect(-7, -13 + bob, 6, 6); g.fillRect(1, -13 + bob, 6, 6);
    g.fillStyle = '#e8843a'; g.beginPath(); g.arc(-4, -10 + bob, 2.4, 0, 7); g.fill(); // Katze im Fenster
    g.fillStyle = '#222'; g.beginPath(); g.arc(-9, 4, 4, 0, 7); g.arc(9, 4, 4, 0, 7); g.fill();
    g.restore();
    requestAnimationFrame(frame);
  };
  requestAnimationFrame(frame);
  return () => { stopped = true; };
}
