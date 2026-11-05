// Welten für den Endlos-Modus: Hintergrund + passende Hindernisse + Cameos.
import { roundRect, star, drawFaceOn } from './character.js';
import { assets } from './assets.js';

const wrap = (v, m) => ((v % m) + m) % m;
const OL = '#2a1830';

// Reihenfolge im Endlos-Modus. Namen können in der privaten Config überschrieben werden (biomeNames).
export const BIOMES = [
  { id: 'outside', name: 'Draußen', obstacles: { candles: 2, shirt: 2, height: 2, alarm: 2, tax: 2, flyshirt: 2 } },
  { id: 'office', name: 'Im Büro', obstacles: { chair: 4, boss: 2, folders: 3, paper: 3 } },
  { id: 'garden', name: 'Im Garten', obstacles: { tomato: 3, grill: 3, gnome: 2, watering: 2, wasp: 3 } },
  { id: 'party', name: 'Auf der Party', obstacles: { speaker: 3, crate: 3, hourglass: 2, discoball: 3 } },
  { id: 'zoo', name: 'Im Zoo', obstacles: { banana: 3, fence: 3, sign: 2, parrot: 3 }, bonus: 'monkey' },
  { id: 'market', name: 'Auf dem Wochenmarkt', obstacles: { fruitcrate: 3, flowers: 2, basket: 2, cheese: 2, pigeon: 3 } },
  { id: 'kitchen', name: 'Daheim in der Küche', obstacles: { mop: 4, pot: 3, flour: 2, pancake: 3 } },
];
export const biomeName = (b) => assets.config.biomeNames?.[b.id] || b.name;

// ---------------------------------------------------------------------------
// Hindernisse: Maße/Hitboxen (make) und Zeichnung (draw)
// ---------------------------------------------------------------------------
const fill = (g, c, path) => { g.beginPath(); path(); g.fillStyle = c; g.fill(); };

export const OBS = {
  chair: {
    make: (o) => { o.w = 34; o.rects.push({ x: 4, w: 26, y0: 6, y1: 48 }); o.extraV = 30 + Math.random() * 50; },
    draw: (g, x, b, o) => {
      const r = o.t * 6;
      g.fillStyle = '#222'; for (const wx of [4, 17, 30]) { g.beginPath(); g.arc(x + wx, b - 2.5, 2.6, 0, 7); g.fill(); }
      g.strokeStyle = '#444'; g.lineWidth = 2.4; g.beginPath(); g.moveTo(x + 4, b - 4); g.lineTo(x + 30, b - 4); g.stroke();
      g.fillStyle = '#8a8f99'; g.fillRect(x + 15.5, b - 20, 3, 16);
      g.fillStyle = '#2f3d63'; roundRect(g, x + 4, b - 26, 27, 7, 3); g.fill();
      g.fillStyle = '#26324f'; roundRect(g, x + 3, b - 50, 9, 27, 4); g.fill();
      g.fillStyle = 'rgba(255,255,255,0.15)'; roundRect(g, x + 5, b - 48, 3, 20, 1.5); g.fill();
      g.strokeStyle = '#555'; g.lineWidth = 2; g.beginPath(); g.moveTo(x + 24, b - 24); g.lineTo(x + 26, b - 33); g.lineTo(x + 32, b - 33); g.stroke();
      void r;
    },
  },
  boss: {
    make: (o) => { o.w = 28; o.rects.push({ x: 4, w: 20, y0: 0, y1: 78 }); o.variant = Math.random() < 0.5 ? 0 : 1; },
    draw: (g, x, b, o) => {
      const suit = o.variant ? '#3a3f4a' : '#4a3328', tie = o.variant ? '#c0392b' : '#2e86de';
      g.fillStyle = '#222'; roundRect(g, x + 5, b - 6, 8, 6, 2); g.fill(); roundRect(g, x + 15, b - 6, 9, 6, 2); g.fill();
      g.fillStyle = suit; g.fillRect(x + 7, b - 34, 6, 29); g.fillRect(x + 15, b - 34, 6, 29);
      roundRect(g, x + 4, b - 62, 20, 30, 5); g.fill();
      g.fillStyle = '#fff'; g.beginPath(); g.moveTo(x + 11, b - 62); g.lineTo(x + 17, b - 62); g.lineTo(x + 14, b - 52); g.fill();
      g.fillStyle = tie; g.beginPath(); g.moveTo(x + 13, b - 60); g.lineTo(x + 15, b - 60); g.lineTo(x + 16, b - 47); g.lineTo(x + 14, b - 45); g.lineTo(x + 12, b - 47); g.fill();
      if (o.face) drawFaceOn(g, o.face, 'normal', x + 14, b - 61, 13);
      else {
      g.fillStyle = '#f0c4a2'; g.beginPath(); g.ellipse(x + 14, b - 70, 8, 9, 0, 0, 7); g.fill();
      g.fillStyle = o.variant ? '#6b4a2b' : '#bdbdbd'; g.beginPath(); g.ellipse(x + 14, b - 76, 8.4, 4.5, 0, Math.PI, 0); g.fill();
      g.fillStyle = '#222'; g.fillRect(x + 15, b - 72, 2, 2); g.fillRect(x + 19, b - 72, 2, 2);
      g.strokeStyle = '#7a2b2b'; g.lineWidth = 1.2; g.beginPath(); g.moveTo(x + 15, b - 66); g.lineTo(x + 21, b - 66.5); g.stroke();
      }
      // Kaffeetasse
      g.fillStyle = '#fff'; roundRect(g, x + 23, b - 47, 6, 7, 1.5); g.fill();
      g.strokeStyle = 'rgba(255,255,255,0.6)'; g.lineWidth = 1; g.beginPath(); g.moveTo(x + 26, b - 49); g.quadraticCurveTo(x + 28, b - 53, x + 26, b - 56); g.stroke();
      if (Math.floor(o.t * 2) % 2) {
        g.fillStyle = '#fff'; roundRect(g, x - 8, b - (o.face ? 104 : 98), 44, 14, 6); g.fill();
        g.fillStyle = '#c0392b'; g.font = '900 8px sans-serif'; g.textAlign = 'center'; g.fillText('DEADLINE!', x + 14, b - (o.face ? 94 : 88));
      }
    },
  },
  folders: {
    make: (o) => { o.h = 34 + Math.random() * 14; o.w = 30; o.rects.push({ x: 0, w: 30, y0: 0, y1: o.h }); },
    draw: (g, x, b, o) => {
      const cols = ['#e74c3c', '#3498db', '#f1c40f', '#2ecc71', '#9b59b6'];
      const n = Math.round(o.h / 9);
      for (let i = 0; i < n; i++) {
        const y = b - (i + 1) * 9, dx = ((i * 7) % 5) - 2;
        g.fillStyle = cols[i % 5]; roundRect(g, x + dx, y, 30, 8.5, 1.5); g.fill();
        g.fillStyle = 'rgba(255,255,255,0.75)'; g.fillRect(x + dx + 20, y + 2, 6, 4.5);
        g.fillStyle = '#333'; g.beginPath(); g.arc(x + dx + 5, y + 4.2, 1.4, 0, 7); g.fill();
      }
    },
  },
  paper: {
    fly: true,
    draw: (g, x, b, o) => {
      const y = b - 14, f = Math.sin(o.t * 10) * 2;
      g.save(); g.translate(x + 18, y); g.rotate(-0.12 + Math.sin(o.t * 4) * 0.08);
      fill(g, '#ffffff', () => { g.moveTo(-17, f * 0.3); g.lineTo(17, 0); g.lineTo(-10, 9 + f); g.closePath(); });
      fill(g, '#dfe6f0', () => { g.moveTo(-17, 0); g.lineTo(17, 0); g.lineTo(-8, -6 - f); g.closePath(); });
      g.strokeStyle = '#9aa7b8'; g.lineWidth = 0.8; g.beginPath(); g.moveTo(-17, 0); g.lineTo(17, 0); g.stroke();
      g.restore();
    },
  },
  tomato: {
    make: (o) => { o.w = 30; o.rects.push({ x: 4, w: 22, y0: 0, y1: 62 }); },
    draw: (g, x, b, o) => {
      g.fillStyle = '#b5562d'; g.beginPath(); g.moveTo(x + 3, b - 16); g.lineTo(x + 27, b - 16); g.lineTo(x + 24, b); g.lineTo(x + 6, b); g.fill();
      g.fillStyle = '#9a4423'; g.fillRect(x + 2, b - 18, 26, 4);
      g.strokeStyle = '#c9a26b'; g.lineWidth = 2; g.beginPath(); g.moveTo(x + 15, b - 16); g.lineTo(x + 15, b - 66); g.stroke();
      g.strokeStyle = '#2f7d32'; g.lineWidth = 2.4;
      g.beginPath(); g.moveTo(x + 15, b - 16); g.quadraticCurveTo(x + 8, b - 36, x + 14, b - 60); g.stroke();
      g.fillStyle = '#3c9d40';
      for (const [lx, ly, r] of [[8, 30, 6], [21, 38, 6.5], [9, 48, 5.5], [20, 55, 5], [13, 62, 4.5], [22, 24, 5]]) { g.beginPath(); g.ellipse(x + lx, b - ly, r, r * 0.6, (lx - 15) * 0.08, 0, 7); g.fill(); }
      for (const [tx, ty] of [[7, 27], [22, 33], [12, 44], [20, 50], [9, 56]]) {
        g.fillStyle = '#e53935'; g.beginPath(); g.arc(x + tx, b - ty, 3.6, 0, 7); g.fill();
        g.fillStyle = 'rgba(255,255,255,0.5)'; g.beginPath(); g.arc(x + tx - 1.2, b - ty - 1.2, 1, 0, 7); g.fill();
        g.fillStyle = '#2f7d32'; g.fillRect(x + tx - 1, b - ty - 4.5, 2, 1.6);
      }
    },
  },
  grill: {
    make: (o) => { o.w = 36; o.rects.push({ x: 2, w: 32, y0: 0, y1: 42 }); },
    draw: (g, x, b, o) => {
      g.strokeStyle = '#333'; g.lineWidth = 2.2;
      g.beginPath(); g.moveTo(x + 8, b - 22); g.lineTo(x + 4, b); g.moveTo(x + 28, b - 22); g.lineTo(x + 32, b); g.moveTo(x + 18, b - 22); g.lineTo(x + 18, b); g.stroke();
      g.fillStyle = '#1f1f24'; g.beginPath(); g.arc(x + 18, b - 30, 15, 0, Math.PI); g.fill();
      g.fillStyle = 'rgba(255,255,255,0.15)'; g.beginPath(); g.ellipse(x + 11, b - 25, 3, 5, 0.6, 0, 7); g.fill();
      g.strokeStyle = '#777'; g.lineWidth = 1.4; g.beginPath(); g.moveTo(x + 3, b - 30); g.lineTo(x + 33, b - 30); g.stroke();
      for (const sx of [8, 16, 24]) { g.fillStyle = '#b5532d'; roundRect(g, x + sx, b - 34, 7, 3.4, 1.7); g.fill(); g.fillStyle = '#6b2b12'; g.fillRect(x + sx + 2, b - 33.5, 0.8, 2.4); g.fillRect(x + sx + 4.5, b - 33.5, 0.8, 2.4); }
      g.fillStyle = 'rgba(210,210,210,0.55)';
      for (let i = 0; i < 4; i++) { const ty = (o.t * 18 + i * 9) % 36; g.beginPath(); g.arc(x + 14 + Math.sin(o.t * 3 + i) * 5, b - 38 - ty, 3 + ty * 0.15, 0, 7); g.fill(); }
    },
  },
  gnome: {
    make: (o) => { o.w = 22; o.rects.push({ x: 2, w: 18, y0: 0, y1: 34 }); },
    draw: (g, x, b) => {
      g.fillStyle = '#2e7d32'; roundRect(g, x + 3, b - 6, 16, 6, 2); g.fill();
      g.fillStyle = '#1e5fb4'; roundRect(g, x + 4, b - 20, 14, 15, 5); g.fill();
      g.fillStyle = '#f5f5f5'; g.beginPath(); g.moveTo(x + 4, b - 20); g.quadraticCurveTo(x + 11, b - 8, x + 18, b - 20); g.fill();
      g.fillStyle = '#f0c4a2'; g.beginPath(); g.arc(x + 11, b - 23, 4.5, 0, 7); g.fill();
      g.fillStyle = '#d32f2f'; g.beginPath(); g.moveTo(x + 5, b - 25); g.lineTo(x + 17, b - 25); g.lineTo(x + 12, b - 38); g.fill();
      g.fillStyle = '#e57373'; g.beginPath(); g.arc(x + 14, b - 22, 1.4, 0, 7); g.fill();
    },
  },
  watering: {
    make: (o) => { o.w = 32; o.rects.push({ x: 3, w: 22, y0: 0, y1: 26 }); },
    draw: (g, x, b) => {
      g.fillStyle = '#26a69a'; roundRect(g, x + 4, b - 22, 20, 22, 4); g.fill();
      g.strokeStyle = '#26a69a'; g.lineWidth = 3; g.beginPath(); g.moveTo(x + 22, b - 12); g.lineTo(x + 32, b - 24); g.stroke();
      g.fillStyle = '#1e8077'; g.fillRect(x + 30, b - 27, 4, 4);
      g.strokeStyle = '#1e8077'; g.lineWidth = 2.2; g.beginPath(); g.arc(x + 14, b - 22, 7, Math.PI, 0); g.stroke();
      g.fillStyle = 'rgba(255,255,255,0.25)'; g.fillRect(x + 7, b - 19, 3, 14);
    },
  },
  wasp: {
    fly: true,
    draw: (g, x, b, o) => {
      const y = b - 14, f = Math.sin(o.t * 50);
      g.fillStyle = 'rgba(220,240,255,0.8)'; g.beginPath(); g.ellipse(x + 17, y - 8 - f * 2, 6, 3.5, -0.5, 0, 7); g.ellipse(x + 23, y - 8 + f * 2, 6, 3.5, 0.5, 0, 7); g.fill();
      g.fillStyle = '#f9c80e'; g.beginPath(); g.ellipse(x + 18, y, 12, 7, 0, 0, 7); g.fill();
      g.fillStyle = '#111'; for (const sx of [13, 18, 23]) g.fillRect(x + sx, y - 6.5, 2.6, 13);
      g.beginPath(); g.moveTo(x + 6, y); g.lineTo(x + 1, y + 1); g.lineTo(x + 6, y + 2.5); g.fill();
      g.beginPath(); g.arc(x + 29, y - 1, 4, 0, 7); g.fill();
      g.fillStyle = '#fff'; g.beginPath(); g.arc(x + 30, y - 2, 1.3, 0, 7); g.fill();
    },
  },
  speaker: {
    make: (o) => { o.w = 30; o.rects.push({ x: 0, w: 30, y0: 0, y1: 52 }); },
    draw: (g, x, b, o) => {
      const p = 1 + Math.max(0, Math.sin(o.t * 15)) * 0.12;
      g.fillStyle = '#1b1b22'; roundRect(g, x, b - 52, 30, 52, 3); g.fill();
      g.strokeStyle = '#3a3a48'; g.lineWidth = 1; g.strokeRect(x + 1.5, b - 50.5, 27, 49);
      for (const [cy, r] of [[-38, 7], [-15, 10]]) {
        g.fillStyle = '#2d2d38'; g.beginPath(); g.arc(x + 15, b + cy, r * p, 0, 7); g.fill();
        g.fillStyle = '#0d0d12'; g.beginPath(); g.arc(x + 15, b + cy, r * 0.45 * p, 0, 7); g.fill();
        g.strokeStyle = '#ff4fa3'; g.lineWidth = 1; g.beginPath(); g.arc(x + 15, b + cy, r * p + 1, 0, 7); g.stroke();
      }
    },
  },
  crate: {
    make: (o) => { o.n = Math.random() < 0.5 ? 1 : 2; o.w = 34; o.rects.push({ x: 0, w: 34, y0: 0, y1: o.n * 22 }); },
    draw: (g, x, b, o) => {
      for (let i = 0; i < o.n; i++) {
        const y = b - (i + 1) * 22;
        g.fillStyle = '#c62828'; roundRect(g, x, y, 34, 22, 2); g.fill();
        g.fillStyle = '#8e1c1c'; g.fillRect(x + 4, y + 4, 26, 5);
        g.fillStyle = '#f5f5f5'; g.font = '900 6px sans-serif'; g.textAlign = 'center'; g.fillText('BIER', x + 17, y + 17);
        g.fillStyle = '#5d4037'; for (let k = 0; k < 4; k++) g.fillRect(x + 4 + k * 7.5, y - 4, 4, 5);
        g.fillStyle = '#ffd54f'; for (let k = 0; k < 4; k++) g.fillRect(x + 4.5 + k * 7.5, y - 5, 3, 1.5);
      }
    },
  },
  hourglass: {
    make: (o) => { o.w = 26; o.rects.push({ x: 2, w: 22, y0: 0, y1: 44 }); },
    draw: (g, x, b, o) => {
      g.fillStyle = '#6d4c41'; g.fillRect(x, b - 4, 26, 4); g.fillRect(x, b - 44, 26, 4);
      g.fillRect(x + 1, b - 40, 2, 36); g.fillRect(x + 23, b - 40, 2, 36);
      g.fillStyle = 'rgba(200,235,255,0.55)';
      g.beginPath(); g.moveTo(x + 4, b - 40); g.lineTo(x + 22, b - 40); g.lineTo(x + 14, b - 22); g.lineTo(x + 22, b - 4); g.lineTo(x + 4, b - 4); g.lineTo(x + 12, b - 22); g.closePath(); g.fill();
      const k = (o.t * 0.4) % 1;
      g.fillStyle = '#ffca28';
      g.beginPath(); g.moveTo(x + 13 - 7 * (1 - k), b - 23 - 15 * (1 - k)); g.lineTo(x + 13 + 7 * (1 - k), b - 23 - 15 * (1 - k)); g.lineTo(x + 13, b - 23); g.fill();
      g.beginPath(); g.moveTo(x + 5, b - 4); g.lineTo(x + 21, b - 4); g.lineTo(x + 13, b - 4 - 14 * k); g.fill();
      g.fillRect(x + 12.5, b - 23, 1, 19);
    },
  },
  discoball: {
    fly: true,
    draw: (g, x, b, o) => {
      const cx = x + 19, cy = b - 13;
      g.strokeStyle = '#999'; g.lineWidth = 1; g.beginPath(); g.moveTo(cx, cy - 13); g.lineTo(cx, cy - 40); g.stroke();
      g.fillStyle = '#b0bec5'; g.beginPath(); g.arc(cx, cy, 13, 0, 7); g.fill();
      g.save(); g.beginPath(); g.arc(cx, cy, 13, 0, 7); g.clip();
      for (let i = -13; i < 13; i += 4) for (let j = -13; j < 13; j += 4) {
        const v = (Math.sin(i * 3 + j * 5 + o.t * 8) + 1) / 2;
        g.fillStyle = `rgba(${200 + v * 55},${200 + v * 55},${230 + v * 25},1)`; g.fillRect(cx + i + 0.4, cy + j + 0.4, 3.2, 3.2);
      }
      g.restore();
      g.fillStyle = '#fff'; star(g, cx - 5, cy - 5, 3 + Math.sin(o.t * 12));
    },
  },
  banana: {
    make: (o) => { o.w = 26; o.rects.push({ x: 2, w: 22, y0: 0, y1: 12 }); },
    draw: (g, x, b) => {
      g.fillStyle = '#ffd54f';
      g.beginPath(); g.moveTo(x + 13, b - 9); g.quadraticCurveTo(x + 4, b - 6, x + 1, b); g.lineTo(x + 6, b); g.quadraticCurveTo(x + 9, b - 4, x + 13, b - 5); g.fill();
      g.beginPath(); g.moveTo(x + 13, b - 9); g.quadraticCurveTo(x + 22, b - 6, x + 25, b); g.lineTo(x + 20, b); g.quadraticCurveTo(x + 17, b - 4, x + 13, b - 5); g.fill();
      g.beginPath(); g.moveTo(x + 11, b - 9); g.lineTo(x + 15, b - 9); g.lineTo(x + 16, b - 2); g.lineTo(x + 10, b - 2); g.fill();
      g.fillStyle = '#6d4c41'; g.fillRect(x + 12, b - 12, 2, 3);
      g.fillStyle = 'rgba(120,80,0,0.4)'; g.fillRect(x + 4, b - 2, 2, 1); g.fillRect(x + 20, b - 2, 2, 1);
    },
  },
  fence: {
    make: (o) => { o.w = 48; o.rects.push({ x: 0, w: 48, y0: 0, y1: 34 }); },
    draw: (g, x, b) => {
      g.fillStyle = '#8d6e63';
      for (let i = 0; i < 5; i++) { roundRect(g, x + i * 11, b - 34, 6, 34, 2); g.fill(); }
      g.fillRect(x - 2, b - 27, 52, 4); g.fillRect(x - 2, b - 12, 52, 4);
      g.fillStyle = 'rgba(0,0,0,0.15)'; for (let i = 0; i < 5; i++) g.fillRect(x + i * 11 + 4, b - 34, 2, 34);
    },
  },
  sign: {
    make: (o) => { o.w = 34; o.rects.push({ x: 14, w: 6, y0: 0, y1: 64 }, { x: 0, w: 34, y0: 44, y1: 66 }); },
    draw: (g, x, b) => {
      g.fillStyle = '#6d4c41'; g.fillRect(x + 14, b - 64, 6, 64);
      g.fillStyle = '#43a047'; g.beginPath(); g.moveTo(x - 2, b - 66); g.lineTo(x + 30, b - 66); g.lineTo(x + 37, b - 56); g.lineTo(x + 30, b - 46); g.lineTo(x - 2, b - 46); g.closePath(); g.fill();
      g.fillStyle = '#fff'; g.font = '900 8px sans-serif'; g.textAlign = 'center'; g.fillText('AFFEN →', x + 16, b - 53);
    },
  },
  parrot: {
    fly: true,
    draw: (g, x, b, o) => {
      const y = b - 14, f = Math.sin(o.t * 16) * 6;
      g.fillStyle = '#1e88e5'; g.beginPath(); g.moveTo(x + 16, y - 2); g.lineTo(x + 6, y - 12 - f); g.lineTo(x + 22, y - 3); g.fill();
      g.fillStyle = '#e53935'; g.beginPath(); g.ellipse(x + 20, y, 11, 6.5, -0.2, 0, 7); g.fill();
      g.fillStyle = '#fdd835'; g.beginPath(); g.moveTo(x + 9, y + 2); g.lineTo(x - 2, y + 6); g.lineTo(x + 9, y + 5); g.fill();
      g.fillStyle = '#e53935'; g.beginPath(); g.arc(x + 30, y - 4, 5, 0, 7); g.fill();
      g.fillStyle = '#fff'; g.beginPath(); g.arc(x + 31, y - 5, 2, 0, 7); g.fill(); g.fillStyle = '#111'; g.beginPath(); g.arc(x + 31.5, y - 5, 1, 0, 7); g.fill();
      g.fillStyle = '#333'; g.beginPath(); g.moveTo(x + 34, y - 5); g.quadraticCurveTo(x + 39, y - 3, x + 34, y); g.fill();
    },
  },
  fruitcrate: {
    make: (o) => { o.n = Math.random() < 0.6 ? 1 : 2; o.w = 36; o.rects.push({ x: 0, w: 36, y0: 0, y1: o.n * 20 + 4 }); o.fruit = Math.random() < 0.5 ? '#e53935' : '#fb8c00'; },
    draw: (g, x, b, o) => {
      for (let i = 0; i < o.n; i++) {
        const y = b - (i + 1) * 20;
        for (let k = 0; k < 5; k++) { g.fillStyle = o.fruit; g.beginPath(); g.arc(x + 5 + k * 6.5, y + 1, 4, 0, 7); g.fill(); g.fillStyle = 'rgba(255,255,255,0.45)'; g.beginPath(); g.arc(x + 4 + k * 6.5, y, 1.2, 0, 7); g.fill(); }
        g.fillStyle = '#d7a86e'; g.fillRect(x, y + 2, 36, 18);
        g.fillStyle = '#b5824a'; g.fillRect(x, y + 8, 36, 2); g.fillRect(x, y + 14, 36, 2); g.fillRect(x + 2, y + 2, 3, 18); g.fillRect(x + 31, y + 2, 3, 18);
      }
    },
  },
  flowers: {
    make: (o) => { o.w = 28; o.rects.push({ x: 2, w: 24, y0: 0, y1: 38 }); },
    draw: (g, x, b, o) => {
      g.strokeStyle = '#388e3c'; g.lineWidth = 1.6;
      const fl = [[6, 38, '#ec407a'], [12, 42, '#ffca28'], [18, 39, '#ab47bc'], [23, 35, '#ef5350'], [9, 32, '#fff']];
      for (const [fx, fy] of fl) { g.beginPath(); g.moveTo(x + 14, b - 18); g.lineTo(x + fx, b - fy); g.stroke(); }
      for (const [fx, fy, c] of fl) { g.fillStyle = c; for (let a = 0; a < 5; a++) { g.beginPath(); g.arc(x + fx + Math.cos(a * 1.26) * 2.4, b - fy + Math.sin(a * 1.26) * 2.4, 1.9, 0, 7); g.fill(); } g.fillStyle = '#fdd835'; g.beginPath(); g.arc(x + fx, b - fy, 1.3, 0, 7); g.fill(); }
      g.fillStyle = '#90a4ae'; g.beginPath(); g.moveTo(x + 2, b - 20); g.lineTo(x + 26, b - 20); g.lineTo(x + 23, b); g.lineTo(x + 5, b); g.fill();
      g.fillStyle = 'rgba(255,255,255,0.25)'; g.fillRect(x + 6, b - 18, 3, 16);
    },
  },
  basket: {
    make: (o) => { o.w = 32; o.rects.push({ x: 1, w: 30, y0: 0, y1: 22 }); },
    draw: (g, x, b) => {
      g.strokeStyle = '#a1662f'; g.lineWidth = 2.4; g.beginPath(); g.arc(x + 16, b - 18, 11, Math.PI, 0); g.stroke();
      g.fillStyle = '#4caf50'; g.beginPath(); g.ellipse(x + 10, b - 19, 5, 3, -0.4, 0, 7); g.fill();
      g.fillStyle = '#ff7043'; g.beginPath(); g.moveTo(x + 18, b - 18); g.lineTo(x + 28, b - 26); g.lineTo(x + 22, b - 16); g.fill();
      g.fillStyle = '#c68642'; g.beginPath(); g.moveTo(x, b - 18); g.lineTo(x + 32, b - 18); g.lineTo(x + 28, b); g.lineTo(x + 4, b); g.fill();
      g.strokeStyle = '#8d5524'; g.lineWidth = 0.8; for (let k = 0; k < 3; k++) { g.beginPath(); g.moveTo(x + 2, b - 14 + k * 5); g.lineTo(x + 30, b - 14 + k * 5); g.stroke(); }
    },
  },
  cheese: {
    make: (o) => { o.w = 26; o.rects.push({ x: 2, w: 22, y0: 0, y1: 24 }); o.extraV = 120; },
    draw: (g, x, b, o) => {
      g.save(); g.translate(x + 13, b - 12); g.rotate(-o.t * 6);
      g.fillStyle = '#fbc02d'; g.beginPath(); g.arc(0, 0, 12, 0, 7); g.fill();
      g.fillStyle = '#f9a825'; for (const [hx, hy, r] of [[-4, -3, 2.4], [4, 2, 2], [1, -7, 1.6], [-3, 6, 1.8], [6, -4, 1.4]]) { g.beginPath(); g.arc(hx, hy, r, 0, 7); g.fill(); }
      g.strokeStyle = '#e09400'; g.lineWidth = 1.2; g.beginPath(); g.arc(0, 0, 11.5, 0, 7); g.stroke();
      g.restore();
    },
  },
  pigeon: {
    fly: true,
    draw: (g, x, b, o) => {
      const y = b - 14, f = Math.sin(o.t * 14) * 7;
      g.fillStyle = '#78909c'; g.beginPath(); g.moveTo(x + 14, y - 2); g.lineTo(x + 8, y - 12 - f); g.lineTo(x + 22, y - 3); g.fill();
      g.fillStyle = '#90a4ae'; g.beginPath(); g.ellipse(x + 18, y, 11, 6, 0, 0, 7); g.fill();
      g.fillStyle = '#546e7a'; g.beginPath(); g.moveTo(x + 8, y); g.lineTo(x, y - 3); g.lineTo(x + 1, y + 4); g.fill();
      g.fillStyle = '#8e7cc3'; g.beginPath(); g.arc(x + 28, y - 3, 4.5, 0, 7); g.fill();
      g.fillStyle = '#111'; g.beginPath(); g.arc(x + 29.5, y - 4, 1, 0, 7); g.fill();
      g.fillStyle = '#e0a060'; g.beginPath(); g.moveTo(x + 32, y - 3); g.lineTo(x + 35.5, y - 2); g.lineTo(x + 32, y - 1); g.fill();
    },
  },
  mop: {
    make: (o) => { o.w = 36; o.rects.push({ x: 1, w: 34, y0: 0, y1: 16 }); o.extraV = 50 + Math.random() * 90; },
    draw: (g, x, b, o) => {
      g.fillStyle = 'rgba(120,200,255,0.35)'; g.beginPath(); g.ellipse(x + 40, b - 1, 10, 2, 0, 0, 7); g.fill();
      g.fillStyle = '#eceff1'; g.beginPath(); g.ellipse(x + 18, b - 7, 17, 7, 0, 0, 7); g.fill();
      g.fillStyle = '#cfd8dc'; g.beginPath(); g.ellipse(x + 18, b - 5, 17, 5, 0, 0, Math.PI); g.fill();
      g.fillStyle = '#37474f'; g.beginPath(); g.ellipse(x + 18, b - 11, 9, 3, 0, 0, 7); g.fill();
      g.fillStyle = Math.floor(o.t * 4) % 2 ? '#00e676' : '#1b5e20'; g.beginPath(); g.arc(x + 25, b - 11, 1.3, 0, 7); g.fill();
      g.fillStyle = '#90caf9'; g.fillRect(x + 2, b - 2, 32, 2);
      g.strokeStyle = '#78909c'; g.lineWidth = 1; for (let k = 0; k < 3; k++) { const a = o.t * 20 + k * 2.1; g.beginPath(); g.moveTo(x + 4, b - 3); g.lineTo(x + 4 + Math.cos(a) * 5, b - 3 + Math.sin(a) * 1.5); g.stroke(); }
      if (Math.floor(o.t * 1.5) % 2) { g.fillStyle = '#fff'; g.font = '700 6px sans-serif'; g.textAlign = 'center'; g.fillText('piep', x + 18, b - 18); }
    },
  },
  pot: {
    make: (o) => { o.w = 34; o.rects.push({ x: 3, w: 28, y0: 0, y1: 30 }); },
    draw: (g, x, b, o) => {
      g.fillStyle = '#90a4ae'; roundRect(g, x + 3, b - 24, 28, 24, 3); g.fill();
      g.fillStyle = 'rgba(255,255,255,0.3)'; g.fillRect(x + 7, b - 21, 4, 18);
      g.fillStyle = '#607d8b'; g.fillRect(x, b - 20, 4, 3); g.fillRect(x + 30, b - 20, 4, 3);
      g.fillStyle = '#78909c'; roundRect(g, x + 1, b - 28, 32, 5, 2.5); g.fill();
      g.fillStyle = '#455a64'; roundRect(g, x + 14, b - 32, 6, 4, 2); g.fill();
      g.fillStyle = 'rgba(240,240,240,0.5)';
      for (let i = 0; i < 3; i++) { const ty = (o.t * 22 + i * 10) % 30; g.beginPath(); g.arc(x + 12 + i * 6 + Math.sin(o.t * 4 + i) * 2, b - 33 - ty, 2.5 + ty * 0.1, 0, 7); g.fill(); }
    },
  },
  flour: {
    make: (o) => { o.w = 24; o.rects.push({ x: 1, w: 22, y0: 0, y1: 36 }); },
    draw: (g, x, b) => {
      g.fillStyle = '#f5ecd7'; g.beginPath(); g.moveTo(x + 1, b); g.lineTo(x + 2, b - 30); g.lineTo(x + 6, b - 36); g.lineTo(x + 18, b - 36); g.lineTo(x + 22, b - 30); g.lineTo(x + 23, b); g.fill();
      g.fillStyle = '#1565c0'; g.fillRect(x + 3, b - 22, 18, 9);
      g.fillStyle = '#fff'; g.font = '900 5.5px sans-serif'; g.textAlign = 'center'; g.fillText('MEHL', x + 12, b - 15.5);
      g.fillStyle = 'rgba(255,255,255,0.75)'; for (let k = 0; k < 4; k++) { g.beginPath(); g.arc(x + 4 + k * 5, b - 38 - (k % 2) * 3, 1.5, 0, 7); g.fill(); }
    },
  },
  pancake: {
    fly: true,
    draw: (g, x, b, o) => {
      const y = b - 13;
      g.save(); g.translate(x + 18, y); g.rotate(Math.sin(o.t * 6) * 0.5);
      g.fillStyle = '#d7a04f'; g.beginPath(); g.ellipse(0, 0, 15, 6, 0, 0, 7); g.fill();
      g.fillStyle = '#e8b965'; g.beginPath(); g.ellipse(0, -1.5, 13, 4.5, 0, 0, 7); g.fill();
      g.fillStyle = '#a86c2c'; for (const [px, py] of [[-5, -2], [3, -1], [7, -3]]) { g.beginPath(); g.arc(px, py, 1, 0, 7); g.fill(); }
      g.restore();
      g.strokeStyle = 'rgba(255,255,255,0.6)'; g.lineWidth = 1; g.beginPath(); g.moveTo(x - 6, y - 4); g.lineTo(x + 1, y - 2); g.moveTo(x - 8, y + 2); g.lineTo(x, y + 2); g.stroke();
    },
  },
};

// Bonus-Affe im Zoo
export function drawMonkey(g, x, y, t, scale = 1, flip = false) {
  g.save(); g.translate(x, y); g.scale(flip ? -scale : scale, scale);
  const br = '#7b4a26', fc = '#e9c39b';
  g.strokeStyle = br; g.lineWidth = 3; g.lineCap = 'round';
  g.beginPath(); g.moveTo(-6, 6); g.quadraticCurveTo(-16, 8, -14, -4 + Math.sin(t * 4) * 2); g.stroke();
  g.fillStyle = br; g.beginPath(); g.ellipse(0, 4, 7, 8, 0, 0, 7); g.fill();
  g.beginPath(); g.arc(-8, -6, 3.5, 0, 7); g.arc(8, -6, 3.5, 0, 7); g.fill();
  g.beginPath(); g.arc(0, -6, 8, 0, 7); g.fill();
  g.fillStyle = fc; g.beginPath(); g.arc(-8, -6, 2, 0, 7); g.arc(8, -6, 2, 0, 7); g.fill();
  g.beginPath(); g.ellipse(0, -4, 6, 5, 0, 0, 7); g.fill();
  g.fillStyle = '#2a1a0a'; g.beginPath(); g.arc(-2.4, -6.5, 1.3, 0, 7); g.arc(2.4, -6.5, 1.3, 0, 7); g.fill();
  g.strokeStyle = '#2a1a0a'; g.lineWidth = 1; g.beginPath(); g.arc(0, -3, 2.5, 0.2, Math.PI - 0.2); g.stroke();
  g.restore();
}

// ---------------------------------------------------------------------------
// Hintergründe
// ---------------------------------------------------------------------------
export function sky(g, V, top, bot) {
  const gr = g.createLinearGradient(0, 0, 0, V.groundY);
  gr.addColorStop(0, top); gr.addColorStop(1, bot);
  g.fillStyle = gr; g.fillRect(0, 0, V.w, V.groundY + 1);
}
export function ground(g, V, c1, c2, off, deco) {
  g.fillStyle = c1; g.fillRect(0, V.groundY, V.w, V.h - V.groundY);
  g.fillStyle = c2; g.fillRect(0, V.groundY - 2, V.w, 5);
  if (deco) deco();
}
export function clouds(g, V, off, a = 0.9) {
  g.fillStyle = `rgba(255,255,255,${a})`;
  for (let i = 0; i < 5; i++) {
    const cx = wrap(i * 220 - off * 0.12, V.w + 220) - 110, cy = V.groundY * 0.18 + (i % 3) * 26;
    g.beginPath(); g.arc(cx, cy, 15, 0, 7); g.arc(cx + 17, cy - 8, 19, 0, 7); g.arc(cx + 36, cy, 14, 0, 7); g.rect(cx, cy, 36, 13); g.fill();
  }
}

export function drawBiomeBg(g, V, id, off, t) {
  const gy = V.groundY;
  if (id === 'office') {
    sky(g, V, '#e9eef5', '#d7dfea');
    // Fenster mit Skyline
    for (let k = -1; k < V.w / 260 + 2; k++) {
      const x = k * 260 - wrap(off * 0.3, 260);
      g.fillStyle = '#9ec9ef'; g.fillRect(x + 20, gy - 175, 120, 95);
      g.fillStyle = '#7fa8cf'; for (let i = 0; i < 6; i++) g.fillRect(x + 24 + i * 19, gy - 80 - (30 + ((i * 37 + k * 11) % 50)), 15, 30 + ((i * 37 + k * 11) % 50));
      g.strokeStyle = '#fff'; g.lineWidth = 5; g.strokeRect(x + 20, gy - 175, 120, 95); g.beginPath(); g.moveTo(x + 80, gy - 175); g.lineTo(x + 80, gy - 80); g.stroke();
      // Pflanze
      g.fillStyle = '#5d4037'; g.fillRect(x + 175, gy - 40, 16, 18);
      g.fillStyle = '#43a047'; for (const [lx, ly] of [[183, 62], [174, 52], [193, 50], [179, 44], [190, 42]]) { g.beginPath(); g.ellipse(x + lx, gy - ly, 6, 13, (lx - 183) * 0.05, 0, 7); g.fill(); }
    }
    // Firmenschild
    const name = assets.config.biomeSigns?.office || 'AGENTUR';
    const sx = wrap(-off * 0.3 + 80, 900) - 150;
    g.fillStyle = '#263238'; roundRect(g, sx, gy - 225, 230, 34, 6); g.fill();
    g.fillStyle = '#ffd23f'; g.font = '900 17px ui-rounded, system-ui, sans-serif'; g.textAlign = 'center'; g.fillText(name, sx + 115, gy - 202, 220);
    // Schreibtische
    for (let k = -1; k < V.w / 190 + 2; k++) {
      const x = k * 190 - wrap(off * 0.55, 190);
      g.fillStyle = '#b0bec5'; g.fillRect(x, gy - 34, 110, 6); g.fillRect(x + 6, gy - 28, 5, 26); g.fillRect(x + 99, gy - 28, 5, 26);
      g.fillStyle = '#263238'; roundRect(g, x + 35, gy - 62, 40, 26, 2); g.fill(); g.fillStyle = '#4fc3f7'; g.fillRect(x + 38, gy - 59, 34, 20); g.fillStyle = '#263238'; g.fillRect(x + 52, gy - 37, 6, 4);
      g.fillStyle = '#ffffff'; g.fillRect(x + 82, gy - 40, 8, 6);
    }
    g.fillStyle = 'rgba(255,255,255,0.7)'; for (let k = 0; k < V.w / 160 + 2; k++) { const x = k * 160 - wrap(off * 0.3, 160); g.fillRect(x + 40, 6, 70, 5); }
    ground(g, V, '#7d8796', '#5f6875', off, () => { g.fillStyle = 'rgba(255,255,255,0.06)'; for (let i = 0; i < 30; i++) g.fillRect(wrap(i * 47 - off, V.w + 40) - 20, gy + 8 + (i % 4) * 7, 14, 2); });
  } else if (id === 'garden') {
    sky(g, V, '#7ec8f0', '#e9f7ff'); clouds(g, V, off);
    // Hecke + Zaun
    g.fillStyle = '#3e8e41'; g.beginPath(); g.moveTo(0, gy);
    for (let x = 0; x <= V.w + 20; x += 20) g.lineTo(x, gy - 70 - Math.sin((x + off * 0.3) * 0.05) * 6 - Math.sin((x + off * 0.3) * 0.13) * 4);
    g.lineTo(V.w, gy); g.fill();
    for (let k = -1; k < V.w / 22 + 2; k++) { const x = k * 22 - wrap(off * 0.6, 22); g.fillStyle = '#c8a26a'; g.fillRect(x, gy - 42, 12, 42); g.beginPath(); g.moveTo(x, gy - 42); g.lineTo(x + 6, gy - 48); g.lineTo(x + 12, gy - 42); g.fill(); }
    g.fillStyle = '#b08850'; g.fillRect(0, gy - 34, V.w, 4); g.fillRect(0, gy - 14, V.w, 4);
    // Gartenhaus
    const hx = wrap(-off * 0.35 + 300, 1100) - 200;
    g.fillStyle = '#8d6e63'; g.fillRect(hx, gy - 110, 90, 70); g.fillStyle = '#6d4c41'; g.beginPath(); g.moveTo(hx - 8, gy - 110); g.lineTo(hx + 45, gy - 140); g.lineTo(hx + 98, gy - 110); g.fill();
    g.fillStyle = '#fff59d'; g.fillRect(hx + 15, gy - 95, 20, 16); g.fillStyle = '#5d4037'; g.fillRect(hx + 55, gy - 85, 22, 45);
    ground(g, V, '#7cb342', '#558b2f', off, () => { for (let i = 0; i < 30; i++) { const x = wrap(i * 41 - off, V.w + 40) - 20; g.fillStyle = ['#ef5350', '#ffeb3b', '#fff'][i % 3]; g.beginPath(); g.arc(x, gy + 10 + (i % 4) * 8, 2, 0, 7); g.fill(); } });
  } else if (id === 'party') {
    sky(g, V, '#12051f', '#3a0e4a');
    // Lichtkegel
    g.save(); g.globalCompositeOperation = 'lighter';
    const cols = ['rgba(255,79,163,0.18)', 'rgba(62,230,180,0.16)', 'rgba(124,198,255,0.16)', 'rgba(255,210,63,0.14)'];
    for (let i = 0; i < 4; i++) {
      const sx = V.w * (0.15 + i * 0.25), a = Math.sin(t * (0.8 + i * 0.3) + i) * 0.6;
      g.fillStyle = cols[i]; g.beginPath(); g.moveTo(sx, 0); g.lineTo(sx + Math.sin(a - 0.12) * gy * 1.3, gy); g.lineTo(sx + Math.sin(a + 0.12) * gy * 1.3, gy); g.fill();
    }
    g.restore();
    // Banner
    const name = assets.config.biomeSigns?.party || 'PARTY';
    const bx = wrap(-off * 0.25 + 120, 1000) - 160;
    g.fillStyle = '#ff4fa3'; roundRect(g, bx, Math.max(10, gy - 230), 230, 34, 8); g.fill();
    g.fillStyle = '#fff'; g.font = '900 18px ui-rounded, system-ui, sans-serif'; g.textAlign = 'center'; g.fillText(name, bx + 115, Math.max(10, gy - 230) + 23, 220);
    // tanzende Menge
    for (let i = 0; i < 18; i++) {
      const x = wrap(i * 47 - off * 0.45, V.w + 60) - 30, hop = Math.abs(Math.sin(t * 6 + i)) * 6;
      g.fillStyle = '#05010a';
      g.beginPath(); g.arc(x, gy - 58 - hop, 8, 0, 7); g.fill(); roundRect(g, x - 9, gy - 50 - hop, 18, 40, 7); g.fill();
      if (i % 3 === 0) { g.strokeStyle = '#05010a'; g.lineWidth = 4; g.beginPath(); g.moveTo(x + 6, gy - 46 - hop); g.lineTo(x + 12, gy - 70 - hop); g.stroke(); }
    }
    // leuchtende Tanzfläche
    g.fillStyle = '#1a0726'; g.fillRect(0, gy, V.w, V.h - gy);
    for (let i = 0; i < V.w / 30 + 2; i++) {
      const x = i * 30 - wrap(off, 30), on = (Math.floor(t * 4) + i) % 4;
      g.fillStyle = ['#ff4fa3', '#3ee6b4', '#7cc6ff', '#ffd23f'][on]; g.globalAlpha = 0.55; g.fillRect(x + 1, gy + 2, 28, 10); g.globalAlpha = 1;
    }
  } else if (id === 'zoo') {
    sky(g, V, '#86d0f5', '#f6f0c8'); clouds(g, V, off, 0.8);
    // Dschungelbäume mit Lianen & Affen
    for (let k = -1; k < V.w / 230 + 2; k++) {
      const x = k * 230 - wrap(off * 0.35, 230);
      g.fillStyle = '#6d4c41'; g.fillRect(x + 30, gy - 170, 16, 170);
      g.fillStyle = '#2e7d32'; for (const [lx, ly, r] of [[38, 175, 40], [10, 160, 30], [66, 160, 32], [38, 140, 28]]) { g.beginPath(); g.arc(x + lx, gy - ly, r, 0, 7); g.fill(); }
      g.strokeStyle = '#558b2f'; g.lineWidth = 2;
      const sw = Math.sin(t * 2 + k) * 0.35;
      const lx = x + 80, ly = gy - 165, len = 85;
      const mx = lx + Math.sin(sw) * len, my = ly + Math.cos(sw) * len;
      g.beginPath(); g.moveTo(lx, ly); g.lineTo(mx, my); g.stroke();
      drawMonkey(g, mx, my + 8, t + k, 1.1, sw < 0);
    }
    // Gehege
    g.strokeStyle = '#8d6e63'; g.lineWidth = 3;
    for (let k = -1; k < V.w / 40 + 2; k++) { const x = k * 40 - wrap(off * 0.6, 40); g.beginPath(); g.moveTo(x, gy); g.lineTo(x, gy - 30); g.stroke(); }
    g.beginPath(); g.moveTo(0, gy - 26); g.lineTo(V.w, gy - 26); g.moveTo(0, gy - 12); g.lineTo(V.w, gy - 12); g.stroke();
    ground(g, V, '#e0c48c', '#c9a46a', off, () => { g.fillStyle = '#c9a46a'; for (let i = 0; i < 26; i++) g.fillRect(wrap(i * 53 - off, V.w + 40) - 20, gy + 12 + (i % 4) * 8, 5, 2); });
  } else if (id === 'market') {
    sky(g, V, '#9fd3f5', '#fff3de'); clouds(g, V, off, 0.8);
    // Fachwerkhäuser
    const hc = ['#f3e0c0', '#e9c9a6', '#f6efe2', '#e7d2b5'];
    for (let k = -1; k < V.w / 120 + 2; k++) {
      const x = k * 120 - wrap(off * 0.25, 120), h = 120 + ((k * 37) % 40 + 40) % 40;
      g.fillStyle = hc[((k % 4) + 4) % 4]; g.fillRect(x, gy - h, 110, h);
      g.fillStyle = '#a5402d'; g.beginPath(); g.moveTo(x - 6, gy - h); g.lineTo(x + 55, gy - h - 45); g.lineTo(x + 116, gy - h); g.fill();
      g.strokeStyle = '#5d3a22'; g.lineWidth = 3; g.strokeRect(x, gy - h, 110, h);
      g.beginPath(); for (let i = 1; i < 4; i++) { g.moveTo(x + i * 27.5, gy - h); g.lineTo(x + i * 27.5, gy - 40); } g.moveTo(x, gy - h + 40); g.lineTo(x + 110, gy - h + 40); g.moveTo(x, gy - h); g.lineTo(x + 27, gy - h + 40); g.moveTo(x + 110, gy - h); g.lineTo(x + 83, gy - h + 40); g.stroke();
      g.fillStyle = '#90caf9'; for (let i = 0; i < 3; i++) g.fillRect(x + 12 + i * 32, gy - h + 55, 16, 20);
    }
    // Marktstände
    const aw = [['#e53935', '#fff'], ['#43a047', '#fff'], ['#1e88e5', '#fff'], ['#fb8c00', '#fff']];
    for (let k = -1; k < V.w / 170 + 2; k++) {
      const x = k * 170 - wrap(off * 0.55, 170), [c1, c2] = aw[((k % 4) + 4) % 4];
      g.fillStyle = '#795548'; g.fillRect(x + 4, gy - 62, 4, 62); g.fillRect(x + 112, gy - 62, 4, 62);
      for (let i = 0; i < 8; i++) { g.fillStyle = i % 2 ? c2 : c1; g.beginPath(); g.moveTo(x + i * 15, gy - 78); g.lineTo(x + (i + 1) * 15, gy - 78); g.lineTo(x + (i + 1) * 15, gy - 62); g.quadraticCurveTo(x + i * 15 + 7.5, gy - 56, x + i * 15, gy - 62); g.fill(); }
      g.fillStyle = '#a1887f'; g.fillRect(x, gy - 30, 120, 6);
      for (let i = 0; i < 9; i++) { g.fillStyle = ['#e53935', '#fdd835', '#43a047', '#fb8c00', '#8e24aa'][(i + k) % 5]; g.beginPath(); g.arc(x + 8 + i * 13, gy - 34, 5, 0, 7); g.fill(); }
    }
    ground(g, V, '#9e9e9e', '#757575', off, () => { g.strokeStyle = 'rgba(0,0,0,0.18)'; g.lineWidth = 1; for (let i = 0; i < V.w / 14 + 2; i++) { const x = i * 14 - wrap(off, 14); for (let r = 0; r < 4; r++) { g.strokeRect(x + (r % 2) * 7, gy + 4 + r * 9, 14, 9); } } });
  } else if (id === 'kitchen') {
    sky(g, V, '#fdfaf3', '#f3ecdf');
    // Fliesenspiegel
    g.strokeStyle = 'rgba(0,0,0,0.06)'; g.lineWidth = 1;
    for (let y = gy - 120; y < gy - 34; y += 12) for (let i = 0; i < V.w / 24 + 2; i++) { const x = i * 24 - wrap(off * 0.5 + (y / 12 % 2) * 12, 24); g.strokeRect(x, y, 24, 12); }
    for (let k = -1; k < V.w / 300 + 2; k++) {
      const x = k * 300 - wrap(off * 0.5, 300);
      // Hängeschränke
      g.fillStyle = '#7fb3a4'; g.fillRect(x, gy - 210, 180, 80);
      g.strokeStyle = '#5f9384'; g.lineWidth = 2; g.strokeRect(x + 4, gy - 206, 84, 72); g.strokeRect(x + 92, gy - 206, 84, 72);
      g.fillStyle = '#c9a66b'; g.fillRect(x + 80, gy - 175, 3, 14); g.fillRect(x + 97, gy - 175, 3, 14);
      // Fenster
      g.fillStyle = '#bfe3f7'; g.fillRect(x + 200, gy - 205, 80, 70); g.strokeStyle = '#fff'; g.lineWidth = 5; g.strokeRect(x + 200, gy - 205, 80, 70);
      // Arbeitsplatte + Herd + Regal
      g.fillStyle = '#d7ccc8'; g.fillRect(x, gy - 40, 300, 8);
      g.fillStyle = '#e8e2d9'; g.fillRect(x, gy - 32, 300, 32);
      g.strokeStyle = '#cfc6b8'; g.lineWidth = 1.5; for (let i = 0; i < 5; i++) g.strokeRect(x + i * 60 + 3, gy - 30, 54, 28);
      g.fillStyle = '#37474f'; g.fillRect(x + 120, gy - 44, 60, 4);
      g.fillStyle = '#ff7043'; g.globalAlpha = 0.5 + Math.sin(t * 8) * 0.2; g.beginPath(); g.ellipse(x + 137, gy - 44, 8, 1.6, 0, 0, 7); g.ellipse(x + 163, gy - 44, 8, 1.6, 0, 0, 7); g.fill(); g.globalAlpha = 1;
      g.fillStyle = '#8d6e63'; g.fillRect(x + 200, gy - 120, 80, 4);
      for (let i = 0; i < 5; i++) { g.fillStyle = ['#ffcc80', '#a5d6a7', '#ef9a9a', '#fff59d', '#ce93d8'][i]; roundRect(g, x + 204 + i * 15, gy - 136, 11, 16, 2); g.fill(); g.fillStyle = '#6d4c41'; g.fillRect(x + 204 + i * 15, gy - 139, 11, 3); }
    }
    ground(g, V, '#c8a27a', '#a8825a', off, () => { g.fillStyle = 'rgba(0,0,0,0.08)'; for (let i = 0; i < V.w / 40 + 2; i++) g.fillRect(i * 40 - wrap(off, 40), gy + 3, 2, V.h); });
  } else {
    return false; // "outside" -> Standardhintergrund
  }
  return true;
}

// ===========================================================================
// Roadtrip-Welten (ab 4.12.) und Fips' Geheimlevel
// ===========================================================================
export const BIOMES_RT = [
  { id: 'autobahn', name: 'Auf der Autobahn', obstacles: { cone: 3, bake: 2, tire: 2, blitzer: 2, pigeon: 1 }, items: ['fries', 'poffertjes', 'wine'] },
  { id: 'eindhoven', name: 'Eindhoven', obstacles: { designchair: 4, lamp: 2, bike: 3, tulip: 3 }, items: ['poffertjes', 'stroop'] },
  { id: 'antwerpen', name: 'Antwerpen', obstacles: { xmastree: 3, frietzak: 2, shopbag: 3, snow: 3 }, items: ['waffle', 'fries'] },
  { id: 'ahxl', name: 'Albert Heijn XL', obstacles: { cart: 4, cans: 3, display: 2, chips: 3 }, items: ['stroop', 'poffertjes', 'wine'] },
];
export const FIPSLAND = { id: 'fipsland', name: 'Fips’ Geheimversteck', obstacles: {}, items: ['treat'] };

Object.assign(OBS, {
  cone: {
    make: (o) => { o.w = 20; o.rects.push({ x: 3, w: 14, y0: 0, y1: 26 }); },
    draw: (g, x, b) => {
      g.fillStyle = '#ff6d00'; g.beginPath(); g.moveTo(x + 10, b - 28); g.lineTo(x + 17, b - 3); g.lineTo(x + 3, b - 3); g.fill();
      g.fillStyle = '#fff'; g.beginPath(); g.moveTo(x + 7.6, b - 19); g.lineTo(x + 12.4, b - 19); g.lineTo(x + 13.8, b - 13); g.lineTo(x + 6.2, b - 13); g.fill();
      g.fillStyle = '#e65100'; g.fillRect(x, b - 3.5, 20, 3.5);
    },
  },
  bake: {
    make: (o) => { o.w = 18; o.rects.push({ x: 3, w: 12, y0: 0, y1: 54 }); },
    draw: (g, x, b) => {
      g.fillStyle = '#333'; g.fillRect(x, b - 4, 18, 4);
      g.save(); g.beginPath(); g.rect(x + 3, b - 54, 12, 50); g.clip();
      g.fillStyle = '#fff'; g.fillRect(x + 3, b - 54, 12, 50);
      g.fillStyle = '#d50000'; for (let i = -2; i < 8; i++) { g.beginPath(); g.moveTo(x + 3, b - 54 + i * 10); g.lineTo(x + 15, b - 60 + i * 10); g.lineTo(x + 15, b - 55 + i * 10); g.lineTo(x + 3, b - 49 + i * 10); g.fill(); }
      g.restore();
      g.fillStyle = '#ffeb3b'; g.beginPath(); g.arc(x + 9, b - 57, 3, 0, 7); g.fill();
    },
  },
  tire: {
    make: (o) => { o.w = 30; o.rects.push({ x: 1, w: 28, y0: 0, y1: 30 }); },
    draw: (g, x, b) => {
      for (const y of [b - 8, b - 23]) {
        g.fillStyle = '#212121'; roundRect(g, x, y - 7, 30, 14, 6); g.fill();
        g.fillStyle = '#424242'; roundRect(g, x + 6, y - 3, 18, 6, 3); g.fill();
        g.fillStyle = 'rgba(255,255,255,0.12)'; g.fillRect(x + 3, y - 5, 24, 1.5);
      }
    },
  },
  blitzer: {
    make: (o) => { o.w = 22; o.rects.push({ x: 7, w: 8, y0: 0, y1: 60 }, { x: 0, w: 22, y0: 56, y1: 78 }); },
    draw: (g, x, b, o) => {
      g.fillStyle = '#9e9e9e'; g.fillRect(x + 8, b - 60, 6, 60);
      g.fillStyle = '#eceff1'; roundRect(g, x, b - 80, 22, 24, 3); g.fill();
      g.fillStyle = '#263238'; roundRect(g, x + 3, b - 76, 16, 9, 2); g.fill();
      g.fillStyle = '#607d8b'; g.beginPath(); g.arc(x + 11, b - 71.5, 3, 0, 7); g.fill();
      if (Math.floor(o.t * 3) % 3 === 0) { g.fillStyle = 'rgba(255,40,40,0.7)'; g.beginPath(); g.arc(x + 11, b - 62, 4, 0, 7); g.fill(); }
      g.fillStyle = '#fff'; g.font = '900 5px sans-serif'; g.textAlign = 'center'; g.fillText('BLITZ', x + 11, b - 58);
    },
  },
  designchair: {
    make: (o) => { o.w = 32; o.rects.push({ x: 2, w: 28, y0: 0, y1: 50 }); },
    draw: (g, x, b) => {
      const woods = ['#b07a4a', '#d9a066', '#7f5539', '#e6c79c', '#9c6b43', '#c08552', '#5e3b23'];
      g.fillStyle = '#5e3b23'; g.fillRect(x + 3, b - 22, 4, 22); g.fillRect(x + 25, b - 22, 4, 22);
      for (let i = 0; i < 5; i++) { g.fillStyle = woods[i]; g.fillRect(x + 1 + i * 6, b - 26, 6, 5); }
      for (let r = 0; r < 5; r++) for (let c = 0; c < 2; c++) { g.fillStyle = woods[(r * 2 + c + 3) % 7]; g.fillRect(x + 1 + c * 4, b - 52 + r * 5.4, 4, 5.4); }
      g.strokeStyle = 'rgba(0,0,0,0.25)'; g.lineWidth = 0.6; g.strokeRect(x + 1, b - 52, 8, 27); g.strokeRect(x + 1, b - 26, 30, 5);
    },
  },
  lamp: {
    make: (o) => { o.w = 32; o.rects.push({ x: 13, w: 6, y0: 0, y1: 54 }, { x: 2, w: 28, y0: 52, y1: 72 }); },
    draw: (g, x, b, o) => {
      g.fillStyle = '#212121'; g.fillRect(x + 6, b - 3, 20, 3); g.fillRect(x + 14.5, b - 56, 3, 54);
      const gl = g.createRadialGradient(x + 16, b - 52, 2, x + 16, b - 52, 26); gl.addColorStop(0, 'rgba(255,230,150,0.55)'); gl.addColorStop(1, 'rgba(255,230,150,0)');
      g.fillStyle = gl; g.beginPath(); g.arc(x + 16, b - 52, 26, 0, 7); g.fill();
      g.fillStyle = '#ff7043'; g.beginPath(); g.moveTo(x + 6, b - 56); g.lineTo(x + 26, b - 56); g.lineTo(x + 31, b - 72); g.lineTo(x + 1, b - 72); g.fill();
      g.fillStyle = 'rgba(255,255,255,0.25)'; g.fillRect(x + 6, b - 70, 3, 12);
    },
  },
  bike: {
    make: (o) => { o.w = 50; o.rects.push({ x: 2, w: 46, y0: 0, y1: 32 }); },
    draw: (g, x, b) => {
      g.strokeStyle = '#212121'; g.lineWidth = 2;
      for (const wx of [11, 39]) { g.beginPath(); g.arc(x + wx, b - 10, 10, 0, 7); g.stroke(); g.lineWidth = 0.6; for (let a = 0; a < 6; a++) { g.beginPath(); g.moveTo(x + wx, b - 10); g.lineTo(x + wx + Math.cos(a) * 10, b - 10 + Math.sin(a) * 10); g.stroke(); } g.lineWidth = 2; }
      g.strokeStyle = '#1565c0'; g.lineWidth = 2.6;
      g.beginPath(); g.moveTo(x + 11, b - 10); g.lineTo(x + 22, b - 24); g.lineTo(x + 36, b - 24); g.lineTo(x + 39, b - 10); g.moveTo(x + 22, b - 24); g.lineTo(x + 26, b - 10); g.lineTo(x + 39, b - 10); g.moveTo(x + 36, b - 24); g.lineTo(x + 38, b - 31); g.stroke();
      g.fillStyle = '#5d4037'; g.fillRect(x + 18, b - 28, 9, 3);
      g.fillStyle = '#c68642'; g.fillRect(x + 37, b - 34, 10, 7);
    },
  },
  tulip: {
    fly: true,
    draw: (g, x, b, o) => {
      const y = b - 14;
      g.save(); g.translate(x + 18, y); g.rotate(Math.sin(o.t * 5) * 0.3);
      g.strokeStyle = '#2e7d32'; g.lineWidth = 2; for (const a of [-0.4, 0, 0.4]) { g.beginPath(); g.moveTo(0, 10); g.lineTo(Math.sin(a) * 12, -2); g.stroke(); }
      for (const [a, c] of [[-0.4, '#e53935'], [0, '#fdd835'], [0.4, '#ec407a']]) {
        const tx = Math.sin(a) * 12, ty = -4;
        g.fillStyle = c; g.beginPath(); g.moveTo(tx - 4, ty); g.lineTo(tx - 4, ty - 6); g.lineTo(tx - 2, ty - 4); g.lineTo(tx, ty - 7); g.lineTo(tx + 2, ty - 4); g.lineTo(tx + 4, ty - 6); g.lineTo(tx + 4, ty); g.quadraticCurveTo(tx, ty + 4, tx - 4, ty); g.fill();
      }
      g.restore();
    },
  },
  xmastree: {
    make: (o) => { o.w = 34; o.rects.push({ x: 5, w: 24, y0: 0, y1: 60 }); },
    draw: (g, x, b, o) => {
      g.fillStyle = '#6d4c41'; g.fillRect(x + 14, b - 8, 6, 8);
      g.fillStyle = '#1b5e20';
      for (const [w, y] of [[34, 8], [28, 24], [20, 40]]) { g.beginPath(); g.moveTo(x + 17 - w / 2, b - y); g.lineTo(x + 17 + w / 2, b - y); g.lineTo(x + 17, b - y - 22); g.fill(); }
      const cols = ['#ffd23f', '#ff4fa3', '#7cc6ff', '#fff'];
      for (let i = 0; i < 10; i++) { const on = (Math.floor(o.t * 4) + i) % 2; g.fillStyle = on ? cols[i % 4] : 'rgba(255,255,255,0.3)'; g.beginPath(); g.arc(x + 9 + ((i * 7) % 17), b - 12 - ((i * 11) % 40), 1.6, 0, 7); g.fill(); }
      g.fillStyle = '#ffd23f'; star(g, x + 17, b - 62, 4);
    },
  },
  frietzak: {
    make: (o) => { o.w = 26; o.rects.push({ x: 2, w: 22, y0: 0, y1: 44 }); },
    draw: (g, x, b) => {
      g.fillStyle = '#ffd54f'; for (let i = 0; i < 7; i++) { g.save(); g.translate(x + 6 + i * 2.4, b - 30); g.rotate((i - 3) * 0.12); g.fillRect(-1.6, -14, 3.2, 16); g.restore(); }
      g.fillStyle = '#fff'; g.beginPath(); g.moveTo(x + 13, b - 18); g.quadraticCurveTo(x + 22, b - 22, x + 18, b - 30); g.quadraticCurveTo(x + 14, b - 26, x + 9, b - 29); g.quadraticCurveTo(x + 6, b - 22, x + 13, b - 18); g.fill();
      g.fillStyle = '#fbfbfb'; g.beginPath(); g.moveTo(x + 2, b - 30); g.lineTo(x + 24, b - 30); g.lineTo(x + 15, b); g.lineTo(x + 11, b); g.fill();
      g.fillStyle = '#e53935'; g.fillRect(x + 5, b - 24, 16, 4);
      g.fillStyle = '#e53935'; g.font = '900 4.5px sans-serif'; g.textAlign = 'center'; g.fillText('FRIETEN', x + 13, b - 14);
    },
  },
  shopbag: {
    make: (o) => { o.w = 32; o.rects.push({ x: 1, w: 30, y0: 0, y1: 30 }); },
    draw: (g, x, b) => {
      for (const [dx, c, h] of [[0, '#ff8a65', 28], [12, '#4db6ac', 24]]) {
        g.strokeStyle = '#5d4037'; g.lineWidth = 1.4; g.beginPath(); g.arc(x + dx + 9, b - h, 5, Math.PI, 0); g.stroke();
        g.fillStyle = c; g.fillRect(x + dx, b - h, 18, h);
        g.fillStyle = 'rgba(255,255,255,0.3)'; g.fillRect(x + dx + 3, b - h + 4, 12, 3);
      }
    },
  },
  snow: {
    fly: true,
    draw: (g, x, b, o) => {
      const cx = x + 18, cy = b - 13;
      g.save(); g.translate(cx, cy); g.rotate(o.t * 2);
      g.strokeStyle = '#e3f2fd'; g.lineWidth = 2.4; g.lineCap = 'round';
      for (let a = 0; a < 6; a++) { const ang = a * Math.PI / 3; g.beginPath(); g.moveTo(0, 0); g.lineTo(Math.cos(ang) * 13, Math.sin(ang) * 13); g.moveTo(Math.cos(ang) * 8, Math.sin(ang) * 8); g.lineTo(Math.cos(ang + 0.5) * 11, Math.sin(ang + 0.5) * 11); g.stroke(); }
      g.restore();
    },
  },
  cart: {
    make: (o) => { o.w = 40; o.rects.push({ x: 2, w: 36, y0: 0, y1: 36 }); o.extraV = 140 + Math.random() * 80; },
    draw: (g, x, b) => {
      g.fillStyle = '#212121'; for (const wx of [8, 32]) { g.beginPath(); g.arc(x + wx, b - 3, 3, 0, 7); g.fill(); }
      g.strokeStyle = '#90a4ae'; g.lineWidth = 2;
      g.beginPath(); g.moveTo(x + 4, b - 34); g.lineTo(x + 8, b - 10); g.lineTo(x + 34, b - 10); g.lineTo(x + 38, b - 30); g.closePath(); g.stroke();
      g.lineWidth = 0.8; for (let i = 1; i < 5; i++) { g.beginPath(); g.moveTo(x + 4 + i * 7, b - 33); g.lineTo(x + 7 + i * 6, b - 10); g.stroke(); }
      g.beginPath(); g.moveTo(x + 5, b - 26); g.lineTo(x + 37, b - 24); g.stroke();
      g.strokeStyle = '#1e88e5'; g.lineWidth = 2.6; g.beginPath(); g.moveTo(x + 38, b - 30); g.lineTo(x + 44, b - 36); g.stroke();
      g.fillStyle = '#ffca28'; g.fillRect(x + 10, b - 40, 9, 9); g.fillStyle = '#e53935'; g.fillRect(x + 20, b - 38, 8, 7);
    },
  },
  cans: {
    make: (o) => { o.w = 36; o.rects.push({ x: 0, w: 36, y0: 0, y1: 36 }); },
    draw: (g, x, b) => {
      for (let r = 0; r < 4; r++) for (let i = 0; i < 4 - r; i++) {
        const cx = x + r * 4.5 + i * 9, cy = b - 9 - r * 9;
        g.fillStyle = '#e53935'; g.fillRect(cx, cy, 8, 9);
        g.fillStyle = '#fff'; g.fillRect(cx, cy + 3, 8, 2.5);
        g.fillStyle = '#bdbdbd'; g.fillRect(cx, cy, 8, 1.2);
      }
    },
  },
  display: {
    make: (o) => { o.w = 30; o.rects.push({ x: 12, w: 6, y0: 0, y1: 36 }, { x: 0, w: 30, y0: 32, y1: 54 }); },
    draw: (g, x, b) => {
      g.fillStyle = '#757575'; g.fillRect(x + 13, b - 36, 4, 36); g.fillRect(x + 6, b - 3, 18, 3);
      g.fillStyle = '#ffeb3b'; roundRect(g, x, b - 56, 30, 22, 3); g.fill();
      g.fillStyle = '#d50000'; g.font = '900 5.5px sans-serif'; g.textAlign = 'center'; g.fillText('AANBIEDING', x + 15, b - 47); g.font = '900 8px sans-serif'; g.fillText('1+1', x + 15, b - 38);
    },
  },
  chips: {
    fly: true,
    draw: (g, x, b, o) => {
      const y = b - 14;
      g.save(); g.translate(x + 18, y); g.rotate(Math.sin(o.t * 7) * 0.4);
      g.fillStyle = '#ffb300'; g.beginPath(); g.moveTo(-11, -14); g.lineTo(11, -14); g.lineTo(9, 14); g.lineTo(-9, 14); g.closePath(); g.fill();
      g.fillStyle = '#e65100'; g.fillRect(-11, -14, 22, 4); g.fillRect(-9, 10, 18, 4);
      g.fillStyle = '#fff'; g.beginPath(); g.ellipse(0, 0, 6, 5, 0, 0, 7); g.fill();
      g.fillStyle = '#e65100'; g.font = '900 4px sans-serif'; g.textAlign = 'center'; g.fillText('CHIPS', 0, 1.5);
      g.restore();
    },
  },
  fipsbox: {
    make: (o) => { o.w = 34; o.rects.push({ x: 2, w: 30, y0: 0, y1: 28 }); o.secret = true; },
    draw: (g, x, b, o) => {
      g.fillStyle = '#c69c6d'; g.fillRect(x + 2, b - 26, 30, 26);
      g.fillStyle = '#a87c4f'; g.beginPath(); g.moveTo(x + 2, b - 26); g.lineTo(x - 4, b - 34); g.lineTo(x + 12, b - 30); g.lineTo(x + 17, b - 26); g.fill();
      g.beginPath(); g.moveTo(x + 32, b - 26); g.lineTo(x + 38, b - 33); g.lineTo(x + 22, b - 30); g.lineTo(x + 17, b - 26); g.fill();
      g.fillStyle = '#5d4037'; g.font = '900 6px sans-serif'; g.textAlign = 'center'; g.fillText('FIPS', x + 17, b - 10);
      const peek = Math.max(0, Math.sin(o.t * 2)) * 6;
      g.fillStyle = '#e8843a'; g.beginPath(); g.moveTo(x + 10, b - 26 - peek); g.lineTo(x + 12, b - 31 - peek); g.lineTo(x + 15, b - 27 - peek); g.fill();
      g.beginPath(); g.moveTo(x + 19, b - 27 - peek); g.lineTo(x + 22, b - 31 - peek); g.lineTo(x + 24, b - 26 - peek); g.fill();
      g.fillStyle = '#fff'; g.font = '900 8px sans-serif'; if (Math.floor(o.t * 3) % 2) g.fillText('?', x + 17, b - 40);
    },
  },
});

// Kleine Item-Icons für Roadtrip & Fips-Level
export const ITEM_ICONS = {
  poffertjes: (g) => {
    g.fillStyle = '#f4f1ea'; g.beginPath(); g.ellipse(0, 5, 13, 4, 0, 0, 7); g.fill();
    g.fillStyle = '#d9913d'; for (const [px, py] of [[-6, 2], [0, 1], [6, 2], [-3, -2], [3, -2]]) { g.beginPath(); g.ellipse(px, py, 4.2, 2.8, 0, 0, 7); g.fill(); }
    g.fillStyle = '#fff'; for (const [px, py] of [[-6, 1], [0, 0], [6, 1], [-3, -3], [3, -3]]) { g.beginPath(); g.arc(px, py, 1, 0, 7); g.fill(); }
  },
  fries: (g) => {
    g.fillStyle = '#ffd54f'; for (let i = 0; i < 5; i++) { g.save(); g.translate(-4 + i * 2, -2); g.rotate((i - 2) * 0.15); g.fillRect(-1.2, -10, 2.4, 11); g.restore(); }
    g.fillStyle = '#e53935'; g.beginPath(); g.moveTo(-8, -2); g.lineTo(8, -2); g.lineTo(5, 11); g.lineTo(-5, 11); g.fill();
    g.fillStyle = '#fff'; g.fillRect(-4, 2, 8, 2);
  },
  waffle: (g) => {
    g.fillStyle = '#e0a04a'; roundRect(g, -10, -8, 20, 16, 3); g.fill();
    g.strokeStyle = '#b5772a'; g.lineWidth = 1; for (let i = -6; i <= 6; i += 4) { g.beginPath(); g.moveTo(i, -8); g.lineTo(i, 8); g.moveTo(-10, i * 0.9); g.lineTo(10, i * 0.9); g.stroke(); }
    g.fillStyle = '#fff'; g.beginPath(); g.arc(-3, -6, 3, 0, 7); g.arc(3, -7, 2.4, 0, 7); g.fill();
  },
  stroop: (g) => {
    g.fillStyle = '#c98a3b'; g.beginPath(); g.arc(0, 0, 10, 0, 7); g.fill();
    g.strokeStyle = '#9c6a2a'; g.lineWidth = 0.8; for (let i = -8; i <= 8; i += 3) { g.beginPath(); g.moveTo(i, -9); g.lineTo(i + 3, 9); g.moveTo(-9, i); g.lineTo(9, i + 3); g.stroke(); }
    g.fillStyle = '#7a4a16'; g.fillRect(-10, -1, 20, 2);
  },
  treat: (g) => {
    g.fillStyle = '#8d6e63'; g.beginPath(); g.moveTo(-8, -3); g.quadraticCurveTo(0, -9, 8, -3); g.quadraticCurveTo(10, 0, 8, 3); g.quadraticCurveTo(0, 9, -8, 3); g.quadraticCurveTo(-10, 0, -8, -3); g.fill();
    g.fillStyle = '#ff8a80'; g.beginPath(); g.arc(-2, -1, 1.6, 0, 7); g.arc(2.5, 1, 1.4, 0, 7); g.fill();
  },
};

export const bgRT = {
  autobahn(g, V, off, t) {
    sky(g, V, '#8ecdf2', '#eaf6ff'); clouds(g, V, off, 0.85);
    const gy = V.groundY;
    g.fillStyle = '#a5d6a7'; g.beginPath(); g.moveTo(0, gy - 40); for (let x = 0; x <= V.w + 10; x += 10) g.lineTo(x, gy - 50 - Math.sin((x + off * 0.2) * 0.012) * 18); g.lineTo(V.w, gy - 40); g.fill();
    // Gegenfahrbahn mit Autos
    g.fillStyle = '#616161'; g.fillRect(0, gy - 40, V.w, 26);
    g.fillStyle = '#fff'; for (let i = 0; i < V.w / 40 + 2; i++) g.fillRect(i * 40 - wrap(off * 0.7, 40), gy - 28, 20, 2);
    const cc = ['#e53935', '#1e88e5', '#fdd835', '#43a047', '#fafafa'];
    for (let i = 0; i < 5; i++) {
      const x = wrap(i * 210 + t * 160 - off * 0.7, V.w + 200) - 100;
      g.fillStyle = cc[i]; roundRect(g, x, gy - 38, 34, 11, 3); g.fill(); roundRect(g, x + 7, gy - 45, 18, 8, 3); g.fill();
      g.fillStyle = '#bfe6ff'; g.fillRect(x + 9, gy - 43.5, 6, 5); g.fillRect(x + 17, gy - 43.5, 6, 5);
      g.fillStyle = '#111'; g.beginPath(); g.arc(x + 8, gy - 27, 3.5, 0, 7); g.arc(x + 26, gy - 27, 3.5, 0, 7); g.fill();
    }
    // Leitplanke
    g.fillStyle = '#b0bec5'; g.fillRect(0, gy - 13, V.w, 4);
    for (let i = 0; i < V.w / 30 + 2; i++) g.fillRect(i * 30 - wrap(off, 30), gy - 13, 2.5, 13);
    // Schilder
    const sx = wrap(-off * 0.7 + 400, 1200) - 200;
    g.fillStyle = '#1565c0'; roundRect(g, sx, gy - 140, 130, 60, 5); g.fill();
    g.strokeStyle = '#fff'; g.lineWidth = 2; g.strokeRect(sx + 4, gy - 136, 122, 52);
    g.fillStyle = '#fff'; g.font = '700 12px sans-serif'; g.textAlign = 'left';
    g.fillText('Eindhoven   210', sx + 10, gy - 117); g.fillText('Antwerpen   290', sx + 10, gy - 97);
    g.fillStyle = '#757575'; g.fillRect(sx + 20, gy - 80, 5, 67); g.fillRect(sx + 105, gy - 80, 5, 67);
    // Raststätte
    const rx = wrap(-off * 0.5 + 900, 1600) - 300;
    g.fillStyle = '#eceff1'; g.fillRect(rx, gy - 95, 140, 55); g.fillStyle = '#e53935'; g.fillRect(rx - 6, gy - 102, 152, 9);
    g.fillStyle = '#90caf9'; for (let i = 0; i < 4; i++) g.fillRect(rx + 10 + i * 32, gy - 82, 22, 20);
    g.fillStyle = '#fff'; g.font = '900 9px sans-serif'; g.textAlign = 'center'; g.fillText('RASTSTÄTTE', rx + 70, gy - 95);
    ground(g, V, '#4a4a4f', '#3a3a3f', off, () => { g.fillStyle = '#fff'; for (let i = 0; i < V.w / 60 + 2; i++) g.fillRect(i * 60 - wrap(off, 60), V.groundY + 18, 30, 3); });
  },
  eindhoven(g, V, off, t) {
    sky(g, V, '#a9cbe0', '#eef3f6'); clouds(g, V, off, 0.7);
    const gy = V.groundY;
    for (let k = -1; k < V.w / 240 + 2; k++) {
      const x = k * 240 - wrap(off * 0.3, 240);
      g.fillStyle = '#9c4a33'; g.fillRect(x, gy - 140, 220, 140);
      g.fillStyle = '#8a3f2b'; for (let i = 0; i < 5; i++) { g.beginPath(); g.moveTo(x + i * 44, gy - 140); g.lineTo(x + i * 44 + 44, gy - 140); g.lineTo(x + i * 44 + 44, gy - 160); g.fill(); }
      g.fillStyle = '#c8e1f0'; for (let r = 0; r < 2; r++) for (let i = 0; i < 6; i++) g.fillRect(x + 12 + i * 35, gy - 125 + r * 45, 24, 32);
      g.strokeStyle = '#3e2723'; g.lineWidth = 1; for (let r = 0; r < 2; r++) for (let i = 0; i < 6; i++) { g.beginPath(); g.moveTo(x + 24 + i * 35, gy - 125 + r * 45); g.lineTo(x + 24 + i * 35, gy - 93 + r * 45); g.stroke(); }
    }
    const cx = wrap(-off * 0.15 + 500, 1400) - 200;
    g.fillStyle = '#7b3a28'; g.fillRect(cx, gy - 230, 18, 230); g.fillStyle = '#fff'; g.fillRect(cx, gy - 215, 18, 6);
    const sx = wrap(-off * 0.3 + 120, 900) - 150;
    g.fillStyle = '#212121'; roundRect(g, sx, gy - 190, 120, 26, 4); g.fill();
    g.fillStyle = '#ffd23f'; g.font = '900 15px ui-rounded, system-ui, sans-serif'; g.textAlign = 'center'; g.fillText('STRIJP-S', sx + 60, gy - 172);
    for (let k = -1; k < V.w / 160 + 2; k++) {
      const x = k * 160 - wrap(off * 0.6, 160);
      g.strokeStyle = '#37474f'; g.lineWidth = 1.5;
      for (const wx of [x + 20, x + 50]) { g.beginPath(); g.arc(wx, gy - 9, 8, 0, 7); g.stroke(); }
      g.beginPath(); g.moveTo(x + 20, gy - 9); g.lineTo(x + 30, gy - 22); g.lineTo(x + 45, gy - 22); g.lineTo(x + 50, gy - 9); g.stroke();
    }
    ground(g, V, '#b36a4e', '#8d4f38', off, () => { g.strokeStyle = 'rgba(0,0,0,0.18)'; g.lineWidth = 1; for (let i = 0; i < V.w / 16 + 2; i++) for (let r = 0; r < 4; r++) g.strokeRect(i * 16 - wrap(off, 16) + (r % 2) * 8, V.groundY + 4 + r * 7, 16, 7); });
  },
  antwerpen(g, V, off, t) {
    sky(g, V, '#3b4a8c', '#c79bc1');
    const gy = V.groundY;
    const sp = wrap(-off * 0.08 + 300, 1600) - 300;
    g.fillStyle = '#2b2f55'; g.fillRect(sp, gy - 300, 30, 300); g.beginPath(); g.moveTo(sp - 4, gy - 300); g.lineTo(sp + 15, gy - 360); g.lineTo(sp + 34, gy - 300); g.fill();
    const hc = ['#e8d5b7', '#c9a27c', '#d98f7a', '#f2e6d0', '#9fb3c8'];
    for (let k = -1; k < V.w / 70 + 2; k++) {
      const x = k * 70 - wrap(off * 0.3, 70), h = 110 + ((k * 29) % 40 + 40) % 40;
      g.fillStyle = hc[((k % 5) + 5) % 5];
      g.beginPath(); g.moveTo(x, gy); g.lineTo(x, gy - h);
      for (let s = 0; s < 4; s++) { g.lineTo(x + s * 8, gy - h - s * 9); g.lineTo(x + s * 8 + 8, gy - h - s * 9); }
      g.lineTo(x + 35, gy - h - 36); for (let s = 3; s >= 0; s--) { g.lineTo(x + 70 - s * 8 - 8, gy - h - s * 9); g.lineTo(x + 70 - s * 8, gy - h - s * 9); }
      g.lineTo(x + 70, gy); g.fill();
      g.fillStyle = '#ffe082'; for (let r = 0; r < 3; r++) for (let i = 0; i < 3; i++) g.fillRect(x + 10 + i * 20, gy - h + 10 + r * 30, 10, 16);
    }
    // Lichterkette
    g.strokeStyle = 'rgba(0,0,0,0.4)'; g.lineWidth = 1;
    for (let k = -1; k < V.w / 200 + 2; k++) {
      const x = k * 200 - wrap(off * 0.45, 200), y0 = gy - 160;
      g.beginPath(); g.moveTo(x, y0); g.quadraticCurveTo(x + 100, y0 + 40, x + 200, y0); g.stroke();
      for (let i = 1; i < 10; i++) { const u = i / 10, lx = x + 200 * u, ly = y0 + 80 * u * (1 - u); g.fillStyle = (i + Math.floor(t * 3)) % 3 ? '#fff59d' : '#ff8a80'; g.beginPath(); g.arc(lx, ly + 2, 2.2, 0, 7); g.fill(); }
    }
    g.fillStyle = 'rgba(255,255,255,0.85)';
    for (let i = 0; i < 40; i++) { const sx = wrap(i * 53 - off * 0.2 + Math.sin(t + i) * 10, V.w), sy = wrap(i * 37 + t * 30, gy); g.beginPath(); g.arc(sx, sy, 1.4, 0, 7); g.fill(); }
    ground(g, V, '#8d8d99', '#f5f5f5', off, () => { g.strokeStyle = 'rgba(0,0,0,0.15)'; for (let i = 0; i < V.w / 14 + 2; i++) for (let r = 0; r < 4; r++) g.strokeRect(i * 14 - wrap(off, 14) + (r % 2) * 7, V.groundY + 4 + r * 9, 14, 9); });
  },
  ahxl(g, V, off, t) {
    sky(g, V, '#f5f7fa', '#e3e8ef');
    const gy = V.groundY;
    g.fillStyle = 'rgba(255,255,255,0.9)'; for (let k = 0; k < V.w / 120 + 2; k++) { const x = k * 120 - wrap(off * 0.3, 120); g.fillRect(x + 20, 8, 80, 6); }
    const prod = ['#e53935', '#fdd835', '#43a047', '#1e88e5', '#fb8c00', '#8e24aa', '#ffffff'];
    for (let k = -1; k < V.w / 200 + 2; k++) {
      const x = k * 200 - wrap(off * 0.5, 200);
      g.fillStyle = '#cfd8dc'; g.fillRect(x, gy - 150, 180, 150);
      for (let r = 0; r < 5; r++) {
        g.fillStyle = '#90a4ae'; g.fillRect(x, gy - 150 + r * 30 + 26, 180, 4);
        for (let i = 0; i < 12; i++) { g.fillStyle = prod[(i * 3 + r * 5 + k) % 7]; const h = 14 + ((i + r) % 3) * 4; g.fillRect(x + 4 + i * 14.5, gy - 150 + r * 30 + 26 - h, 11, h); }
      }
    }
    const name = assets.config.biomeSigns?.ahxl || 'SUPERMARKT';
    const sx = wrap(-off * 0.3 + 150, 800) - 120;
    g.fillStyle = '#00a0e2'; roundRect(g, sx, gy - 200, 140, 30, 6); g.fill();
    g.fillStyle = '#fff'; g.font = '900 15px ui-rounded, system-ui, sans-serif'; g.textAlign = 'center'; g.fillText(name, sx + 70, gy - 179, 130);
    g.strokeStyle = '#90a4ae'; g.lineWidth = 1; g.beginPath(); g.moveTo(sx + 30, gy - 200); g.lineTo(sx + 30, gy - 230); g.moveTo(sx + 110, gy - 200); g.lineTo(sx + 110, gy - 230); g.stroke();
    ground(g, V, '#d5d9de', '#b0b6bd', off, () => { g.strokeStyle = 'rgba(0,0,0,0.08)'; for (let i = 0; i < V.w / 30 + 2; i++) g.strokeRect(i * 30 - wrap(off, 30), V.groundY + 2, 30, 30); });
  },
  fipsland(g, V, off, t) {
    sky(g, V, '#ffc6e2', '#fff0f7');
    const gy = V.groundY;
    g.fillStyle = 'rgba(255,255,255,0.6)';
    for (let i = 0; i < 24; i++) {
      const x = wrap(i * 77 - off * 0.2, V.w + 40) - 20, y = (i * 53) % (gy - 40) + 20;
      g.beginPath(); g.arc(x, y, 5, 0, 7); g.fill();
      for (const [dx, dy] of [[-5, -6], [0, -8], [5, -6]]) { g.beginPath(); g.arc(x + dx, y + dy, 2.2, 0, 7); g.fill(); }
    }
    for (let k = -1; k < V.w / 260 + 2; k++) {
      const x = k * 260 - wrap(off * 0.4, 260);
      g.fillStyle = '#bcaaa4'; g.fillRect(x + 40, gy - 120, 10, 120); g.fillRect(x + 90, gy - 80, 10, 80);
      g.fillStyle = '#8d6e63'; roundRect(g, x + 20, gy - 128, 50, 10, 4); g.fill(); roundRect(g, x + 70, gy - 88, 50, 10, 4); g.fill();
      g.fillStyle = ['#ef5350', '#42a5f5', '#ab47bc'][((k % 3) + 3) % 3]; g.beginPath(); g.arc(x + 160, gy - 10, 10, 0, 7); g.fill();
      g.strokeStyle = 'rgba(255,255,255,0.6)'; g.lineWidth = 1; g.beginPath(); g.arc(x + 160, gy - 10, 6, 0.5, 3); g.stroke();
    }
    ground(g, V, '#f8bbd0', '#f48fb1', off);
  },
};

const _drawBiomeBg = drawBiomeBg;
export function drawAnyBiomeBg(g, V, id, off, t) {
  if (bgRT[id]) { bgRT[id](g, V, off, t); return true; }
  return _drawBiomeBg(g, V, id, off, t);
}
