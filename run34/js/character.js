// Prozedural gezeichnete Spielfigur (Comic-Körper + Foto-Kopf), Katze & Cameo-Figuren.
import { getFace } from './assets.js';
import { OUTFIT_PARTS } from './config.js';

const SKIN = '#f2c3a0';
const SKIN_DARK = '#d9a27c';
const L_THIGH = 24, L_SHIN = 24, L_UPPER = 17, L_FORE = 16, TORSO = 34;

const shade = (hex, f) => {
  const n = parseInt(hex.slice(1), 16);
  const r = Math.min(255, Math.max(0, ((n >> 16) & 255) * f));
  const g = Math.min(255, Math.max(0, ((n >> 8) & 255) * f));
  const b = Math.min(255, Math.max(0, (n & 255) * f));
  return `rgb(${r | 0},${g | 0},${b | 0})`;
};

const pt = (x, y, ang, len) => [x + Math.sin(ang) * len, y + Math.cos(ang) * len];

function seg(g, x1, y1, x2, y2, w, color) {
  g.strokeStyle = color; g.lineWidth = w; g.lineCap = 'round';
  g.beginPath(); g.moveTo(x1, y1); g.lineTo(x2, y2); g.stroke();
}

/** Gelenkwinkel für eine Pose berechnen (Winkel 0 = nach unten, + = nach vorne). */
function computePose(pose, phase) {
  const P = { lean: 0.12, hipY: -46, legs: [], arms: [] };
  if (pose === 'run' || pose === 'idle') {
    const amp = pose === 'idle' ? 0.12 : 0.8;
    for (const off of [0, Math.PI]) {
      const a = phase + off;
      const th = Math.sin(a) * amp;
      const bend = pose === 'idle' ? 0.05 : 0.15 + Math.max(0, -Math.sin(a + 0.9)) * 1.25;
      P.legs.push([th, th - bend]);
      const up = -Math.sin(a) * (pose === 'idle' ? 0.1 : 0.9);
      P.arms.push([up, up + 1.3]);
    }
    if (pose === 'idle') { P.lean = 0.02; P.arms = [[0.15, 0.5], [-0.1, 0.4]]; }
  } else if (pose === 'jump') {
    P.legs = [[1.05, 0.15], [-0.45, -1.35]];
    P.arms = [[-0.5, 0.6], [Math.PI * 0.86, Math.PI * 1.02]];
    P.lean = 0.05;
  } else if (pose === 'duck') {
    const w = Math.sin(phase) * 0.25;
    P.lean = 1.0; P.hipY = -32;
    P.legs = [[1.2 + w, -0.2 + w], [0.7 - w, -0.9 - w]];
    P.arms = [[0.5 - w, 1.6], [0.3 + w, 1.4]];
  } else if (pose === 'dead') {
    P.lean = -0.5;
    P.legs = [[0.9, 0.5], [-0.3, -0.2]];
    P.arms = [[Math.PI * 0.8, Math.PI * 0.9], [Math.PI * 1.15, Math.PI * 1.1]];
  } else if (pose === 'cheer') {
    const w = Math.sin(phase * 2) * 0.15;
    P.lean = 0;
    P.legs = [[0.15, 0.1], [-0.15, -0.1]];
    P.arms = [[Math.PI * 0.82 + w, Math.PI * 0.95 + w], [Math.PI * 1.18 - w, Math.PI * 1.05 - w]];
  }
  return P;
}

/**
 * Zeichnet die Hauptfigur. (x, footY) = Fußpunkt.
 * opt: { pose, phase, outfit, expr, scale, faceKey, alpha, rot, scarfT }
 */
export function drawCharacter(g, x, footY, opt) {
  const { pose = 'run', phase = 0, outfit, expr = 'normal', scale = 1, faceKey = 'her', rot = 0, t = 0 } = opt;
  const P = computePose(pose, phase);
  const o = outfit;
  const top = o.top, bottom = o.bottom;
  const topCol = top === 'princess' ? '#f48cc0' : top === 'green' ? '#3fae3a' : (OUTFIT_PARTS.topColor.options[o.topColor]?.color || '#2c3157');
  const extras = new Set(o.extra || []);

  // Beine vorberechnen, damit die Füße auf dem Boden stehen
  const hip = [0, P.hipY];
  const legPts = P.legs.map(([th, sh]) => {
    const k = pt(hip[0], hip[1], th, L_THIGH);
    const a = pt(k[0], k[1], sh, L_SHIN);
    return { th, sh, k, a };
  });
  let dy = 0;
  if (pose !== 'jump' && pose !== 'dead') dy = -(Math.max(...legPts.map((l) => l.a[1])) + 5);
  else dy = -(L_THIGH + L_SHIN - 6 + P.hipY);

  g.save();
  g.translate(x, footY);
  g.scale(scale, scale);
  if (rot) { g.translate(0, -50); g.rotate(rot); g.translate(0, 50); }
  g.translate(0, dy);

  const shoulder = pt(hip[0], hip[1], Math.PI - P.lean, TORSO);
  // Rücken-Arm & -Bein dunkler
  drawArm(g, shoulder, P.arms[0], top, topCol, true);
  drawLeg(g, hip, legPts[1], o, true);
  if (bottom === 'tutu') drawTutu(g, hip, P.lean, t);
  drawTorso(g, hip, shoulder, P.lean, top, topCol, bottom, extras);
  drawLeg(g, hip, legPts[0], o, false);
  if (bottom === 'tutu') drawTutuFront(g, hip, P.lean, t);
  // Kopf
  const neck = pt(shoulder[0], shoulder[1], Math.PI - P.lean * 0.6, 6);
  if (extras.has('scarf')) drawScarf(g, neck, P.lean, t, false);
  drawHead(g, neck, P.lean, expr, faceKey, extras, t, opt);
  if (extras.has('scarf')) drawScarf(g, neck, P.lean, t, true);
  drawArm(g, shoulder, P.arms[1], top, topCol, false);
  g.restore();
}

function drawLeg(g, hip, L, o, back) {
  const { k, a, sh } = L;
  const f = back ? 0.78 : 1;
  const bottom = o.bottom;
  const pants = { jeans: '#3d5a8c', matrose: '#2c3157', latz: '#5f86c2', culotte: '#26262e', tutu: null }[bottom];
  const skin = back ? SKIN_DARK : SKIN;
  // Haut-Basis (für Culotte/Tutu sichtbar)
  seg(g, hip[0], hip[1], k[0], k[1], 10, skin);
  seg(g, k[0], k[1], a[0], a[1], 9, skin);
  // Socken
  if (o.socks !== 'none') {
    const s0 = [k[0] + (a[0] - k[0]) * (bottom === 'culotte' || bottom === 'tutu' ? 0.45 : 0.78), k[1] + (a[1] - k[1]) * (bottom === 'culotte' || bottom === 'tutu' ? 0.45 : 0.78)];
    if (o.socks === 'ringel') {
      const n = 5;
      for (let i = 0; i < n; i++) {
        const t0 = i / n, t1 = (i + 1) / n;
        seg(g, s0[0] + (a[0] - s0[0]) * t0, s0[1] + (a[1] - s0[1]) * t0, s0[0] + (a[0] - s0[0]) * t1, s0[1] + (a[1] - s0[1]) * t1, 9.5,
          shade(i % 2 ? '#ffffff' : '#e8424f', f));
      }
    } else seg(g, s0[0], s0[1], a[0], a[1], 9.5, shade('#f4f4f4', f));
  }
  if (pants) {
    const w = bottom === 'matrose' ? 13 : bottom === 'culotte' ? 15 : 12;
    seg(g, hip[0], hip[1], k[0], k[1], w, shade(pants, f));
    if (bottom === 'culotte') {
      const e = [k[0] + (a[0] - k[0]) * 0.35, k[1] + (a[1] - k[1]) * 0.35];
      seg(g, k[0], k[1], e[0], e[1], 16, shade(pants, f));
    } else {
      const e = bottom === 'jeans' || bottom === 'latz' ? 0.82 : 0.95;
      const p2 = [k[0] + (a[0] - k[0]) * e, k[1] + (a[1] - k[1]) * e];
      seg(g, k[0], k[1], p2[0], p2[1], bottom === 'matrose' ? 14 : 11, shade(pants, f));
      if (bottom === 'jeans' || bottom === 'latz') seg(g, p2[0] - 0.5, p2[1] - 2, p2[0], p2[1], 12, shade('#8fb0e0', f)); // Umschlag
    }
  }
  drawShoe(g, a, sh, o.shoes, f);
}

function drawShoe(g, a, sh, type, f) {
  g.save();
  g.translate(a[0], a[1]);
  // Schuh zeigt nach vorne, leicht mit dem Schienbein gekippt
  g.rotate(-sh * 0.5);
  if (type === 'docs') {
    g.fillStyle = shade('#1c1a1a', f);
    roundRect(g, -6, -12, 12, 14, 3); g.fill();
    roundRect(g, -6, -3, 20, 8, 4); g.fill();
    g.fillStyle = shade('#e7c440', f); g.fillRect(-6, 3, 20, 1.6);
  } else if (type === 'sneaker') {
    g.fillStyle = shade('#ffffff', f);
    roundRect(g, -6, -5, 19, 9, 4.5); g.fill();
    g.fillStyle = shade('#ff4fa3', f); g.fillRect(-2, -2.5, 9, 2.4);
    g.fillStyle = shade('#cfcfcf', f); g.fillRect(-6, 3, 19, 2.2);
  } else {
    g.fillStyle = shade('#121212', f);
    roundRect(g, -6, -4, 20, 8, 4); g.fill();
    g.fillStyle = 'rgba(255,255,255,0.25)'; g.fillRect(4, -3, 5, 1.5);
  }
  g.restore();
}

function drawArm(g, sh, [up, fo], top, topCol, back) {
  const f = back ? 0.78 : 1;
  const e = pt(sh[0], sh[1], up, L_UPPER);
  const h = pt(e[0], e[1], fo, L_FORE);
  const skin = back ? SKIN_DARK : SKIN;
  const longSleeve = top === 'matrose' || top === 'ripp';
  seg(g, sh[0], sh[1], e[0], e[1], 9, skin);
  seg(g, e[0], e[1], h[0], h[1], 8, skin);
  if (top === 'tank') {
    // nur Haut
  } else if (longSleeve) {
    seg(g, sh[0], sh[1], e[0], e[1], 10, shade(topCol, f));
    const c = [e[0] + (h[0] - e[0]) * 0.8, e[1] + (h[1] - e[1]) * 0.8];
    seg(g, e[0], e[1], c[0], c[1], 9.5, shade(topCol, f));
    if (top === 'matrose') seg(g, c[0], c[1], c[0] + (h[0] - e[0]) * 0.04, c[1] + (h[1] - e[1]) * 0.04, 10, shade('#ffffff', f));
  } else {
    const c = [sh[0] + (e[0] - sh[0]) * 0.55, sh[1] + (e[1] - sh[1]) * 0.55];
    seg(g, sh[0], sh[1], c[0], c[1], top === 'princess' ? 14 : 11, shade(topCol, f));
  }
  // Faust
  g.fillStyle = skin;
  g.beginPath(); g.arc(h[0], h[1], 5.5, 0, 7); g.fill();
}

function drawTorso(g, hip, sh, lean, top, topCol, bottom, extras) {
  g.save();
  g.translate(hip[0], hip[1]);
  g.rotate(lean);
  const w = top === 'tank' ? 20 : 23;
  // Oberteil
  g.fillStyle = topCol;
  roundRect(g, -w / 2, -TORSO - 2, w, TORSO + 6, 8); g.fill();
  if (top === 'tank') {
    g.fillStyle = SKIN; roundRect(g, -w / 2 + 2, -TORSO - 3, w - 4, 7, 3); g.fill();
    g.fillStyle = topCol; g.fillRect(-w / 2 + 3, -TORSO - 3, 3, 7); g.fillRect(w / 2 - 6, -TORSO - 3, 3, 7);
  }
  if (top === 'ripp') {
    g.strokeStyle = 'rgba(0,0,0,0.18)'; g.lineWidth = 1.2;
    for (let i = -w / 2 + 3; i < w / 2; i += 3.2) { g.beginPath(); g.moveTo(i, -TORSO); g.lineTo(i, 3); g.stroke(); }
  }
  if (top === 'matrose') {
    g.fillStyle = '#ffffff'; // Kragen hinten
    g.beginPath(); g.moveTo(-w / 2 - 1, -TORSO - 1); g.lineTo(-2, -TORSO - 1); g.lineTo(-4, -TORSO + 12); g.lineTo(-w / 2 - 2, -TORSO + 10); g.closePath(); g.fill();
    g.fillStyle = topCol; g.fillRect(-w / 2 + 1, -TORSO + 1.5, 6, 6);
    g.fillStyle = '#111'; // Halstuch
    g.beginPath(); g.moveTo(4, -TORSO + 2); g.lineTo(9, -TORSO + 15); g.lineTo(2, -TORSO + 11); g.closePath(); g.fill();
  }
  if (top === 'princess') {
    g.fillStyle = 'rgba(255,255,255,0.8)';
    for (const [sx, sy] of [[-5, -25], [4, -15], [-2, -6], [6, -29]]) star(g, sx, sy, 2.2);
  }
  if (top === 'green') {
    g.fillStyle = 'rgba(0,0,0,0.15)'; g.fillRect(-w / 2, -6, w, 3);
  }
  // Hose oben / Gürtel
  if (bottom === 'jeans' || bottom === 'matrose' || bottom === 'culotte') {
    const pc = { jeans: '#3d5a8c', matrose: '#2c3157', culotte: '#26262e' }[bottom];
    g.fillStyle = pc; roundRect(g, -w / 2, -6, w, 10, 4); g.fill();
    g.fillStyle = bottom === 'matrose' ? '#151515' : '#5a3a22'; g.fillRect(-w / 2, -7, w, 3);
  }
  if (bottom === 'latz') {
    g.fillStyle = '#5f86c2';
    roundRect(g, -w / 2 + 2, -TORSO + 9, w - 4, TORSO - 5, 3); g.fill();
    g.fillRect(-w / 2, -6, w, 10);
    g.strokeStyle = '#5f86c2'; g.lineWidth = 3;
    g.beginPath(); g.moveTo(-w / 2 + 4, -TORSO + 10); g.lineTo(-w / 2 + 3, -TORSO - 1); g.moveTo(w / 2 - 4, -TORSO + 10); g.lineTo(w / 2 - 3, -TORSO - 1); g.stroke();
    g.fillStyle = '#e7c440'; g.beginPath(); g.arc(-w / 2 + 4, -TORSO + 10, 1.6, 0, 7); g.arc(w / 2 - 4, -TORSO + 10, 1.6, 0, 7); g.fill();
    g.fillStyle = '#4c70a8'; roundRect(g, -5, -TORSO + 14, 10, 8, 2); g.fill();
  }
  if (extras.has('sash')) {
    g.strokeStyle = '#ffd23f'; g.lineWidth = 6;
    g.beginPath(); g.moveTo(-w / 2, -TORSO + 2); g.lineTo(w / 2, -4); g.stroke();
    g.fillStyle = '#b3236b'; g.font = 'bold 6px sans-serif'; g.textAlign = 'center';
    g.save(); g.translate(0, -TORSO / 2 - 1); g.rotate(0.62); g.fillText('34', 0, 2); g.restore();
  }
  g.restore();
}

function drawTutu(g, hip, lean, t) {
  g.save(); g.translate(hip[0], hip[1] - 2); g.rotate(lean);
  g.fillStyle = '#e06aa6';
  g.beginPath(); g.ellipse(-3, 6, 18, 9, 0, 0, Math.PI * 2); g.fill();
  g.restore();
}
function drawTutuFront(g, hip, lean, t) {
  g.save(); g.translate(hip[0], hip[1] - 2); g.rotate(lean);
  for (let i = 0; i < 6; i++) {
    g.fillStyle = i % 2 ? 'rgba(255,170,210,0.95)' : 'rgba(255,200,228,0.95)';
    const a = (i / 5) * Math.PI - Math.PI;
    g.beginPath(); g.ellipse(Math.cos(a) * 12, 6 + Math.sin(t * 8 + i) * 0.8, 9, 7, 0, 0, Math.PI * 2); g.fill();
  }
  g.fillStyle = 'rgba(255,255,255,0.9)';
  for (let i = 0; i < 5; i++) star(g, -12 + i * 6, 5 + (i % 2) * 3, 1.3);
  g.restore();
}

function drawScarf(g, neck, lean, t, front) {
  const col = '#c0392b', col2 = '#e0573f';
  if (!front) {
    // flatterndes Ende nach hinten
    g.strokeStyle = col; g.lineWidth = 6; g.lineCap = 'round';
    g.beginPath(); g.moveTo(neck[0] - 2, neck[1] + 2);
    for (let i = 1; i <= 4; i++) g.lineTo(neck[0] - 2 - i * 6, neck[1] + 2 + i * 2 + Math.sin(t * 14 - i) * 3);
    g.stroke();
    g.strokeStyle = col2; g.lineWidth = 1.5;
    g.beginPath(); g.moveTo(neck[0] - 26, neck[1] + 8 + Math.sin(t * 14 - 4) * 3); g.lineTo(neck[0] - 30, neck[1] + 12); g.stroke();
  } else {
    g.fillStyle = col;
    roundRect(g, neck[0] - 9, neck[1] - 1, 18, 7, 3.5); g.fill();
    g.fillStyle = col2; g.fillRect(neck[0] - 7, neck[1] + 1, 14, 1.2);
  }
}

function drawHead(g, neck, lean, expr, faceKey, extras, t, opt = {}) {
  const { img, exact } = getFace(faceKey, expr);
  const h = 58;
  const w = h * ((img.width || 200) / (img.height || 240));
  g.save();
  const hc = pt(neck[0], neck[1], Math.PI - lean * 0.8, h * 0.42);
  g.translate(hc[0] + 2, hc[1]);
  g.rotate(lean * 0.55 + (expr === 'shock' ? Math.sin(t * 40) * 0.08 : 0));
  if (opt.swell) g.scale(1 + opt.swell * 0.3, 1 + opt.swell * 0.22);
  // Hals
  g.fillStyle = SKIN; g.fillRect(-4, h * 0.3, 8, 10);
  if (expr === 'sad' && !exact) g.filter = 'grayscale(0.6) brightness(0.9)';
  g.drawImage(img, -w / 2, -h / 2, w, h);
  g.filter = 'none';
  if (!exact) faceFx(g, expr, w, h, t);
  if (opt.swell) {
    g.globalAlpha = Math.min(0.55, opt.swell * 0.6);
    g.fillStyle = '#ff3b3b';
    for (const [bx, by, br] of [[-0.2, 0.1, 0.12], [0.18, 0.0, 0.1], [0.02, 0.25, 0.09], [-0.1, -0.2, 0.07], [0.22, 0.28, 0.08]]) {
      g.beginPath(); g.arc(bx * w, by * h, br * w, 0, 7); g.fill();
    }
    g.globalAlpha = 1;
  }
  if (extras.has('party')) drawPartyGlasses(g, w, h, t);
  if (extras.has('shades')) {
    g.fillStyle = '#111';
    roundRect(g, -w * 0.38, -h * 0.1, w * 0.33, h * 0.12, 3); g.fill();
    roundRect(g, w * 0.04, -h * 0.1, w * 0.33, h * 0.12, 3); g.fill();
    g.fillRect(-w * 0.06, -h * 0.08, w * 0.12, 2);
    g.fillStyle = 'rgba(255,255,255,0.5)'; g.fillRect(-w * 0.33, -h * 0.08, 4, 2); g.fillRect(w * 0.09, -h * 0.08, 4, 2);
  }
  if (extras.has('crown')) drawCrown(g, 0, -h / 2 + 2, w * 0.55);
  g.restore();
}

function faceFx(g, expr, w, h, t) {
  if (expr === 'shock') {
    g.fillStyle = '#7cc6ff';
    for (const [x, y] of [[w * 0.5, -h * 0.2], [-w * 0.55, -h * 0.05]]) {
      g.beginPath(); g.moveTo(x, y - 6); g.quadraticCurveTo(x + 4, y + 2, x, y + 4); g.quadraticCurveTo(x - 4, y + 2, x, y - 6); g.fill();
    }
    g.fillStyle = '#ff3b3b'; g.font = 'bold 22px sans-serif'; g.textAlign = 'center';
    g.fillText('!', w * 0.62, -h * 0.35);
  } else if (expr === 'sad') {
    g.fillStyle = 'rgba(80,140,255,0.25)'; g.fillRect(-w / 2, -h / 2, w, h * 0.0001);
    g.fillStyle = '#7cc6ff';
    const ty = (t * 40) % 20;
    g.beginPath(); g.arc(-w * 0.18, h * 0.05 + ty, 3, 0, 7); g.fill();
  } else if (expr === 'happy') {
    g.fillStyle = '#ffd23f';
    star(g, w * 0.6, -h * 0.35 + Math.sin(t * 6) * 2, 4);
    star(g, -w * 0.62, -h * 0.2 + Math.cos(t * 6) * 2, 3);
  }
}

function drawPartyGlasses(g, w, h, t) {
  // Cupcake-Partybrille mit "HAPPY BIRTHDAY"-Stäbchen
  const ey = -h * 0.05;
  for (const sx of [-1, 1]) {
    const cx = sx * w * 0.22;
    g.fillStyle = '#ff6f9c'; g.beginPath(); g.moveTo(cx - 9, ey + 2); g.lineTo(cx + 9, ey + 2); g.lineTo(cx + 6, ey + 10); g.lineTo(cx - 6, ey + 10); g.fill();
    g.fillStyle = '#ffd6e4'; g.beginPath(); g.arc(cx, ey - 2, 9, Math.PI, 0); g.fill();
    g.fillStyle = '#2a2a33'; g.beginPath(); g.arc(cx, ey + 3, 6, 0, 7); g.fill();
    g.fillStyle = 'rgba(255,255,255,.4)'; g.beginPath(); g.arc(cx - 2, ey + 1, 1.8, 0, 7); g.fill();
    const cols = ['#ff4fa3', '#ffd23f', '#3ee6b4', '#9b6bff', '#46b3ff'];
    for (let i = 0; i < 5; i++) {
      const a = -Math.PI / 2 + (i - 2) * 0.32 + Math.sin(t * 6 + i) * 0.05;
      const ex = cx + Math.cos(a) * 18, eyy = ey - 6 + Math.sin(a) * 18;
      g.strokeStyle = '#f3e6f0'; g.lineWidth = 0.8; g.beginPath(); g.moveTo(cx, ey - 6); g.lineTo(ex, eyy); g.stroke();
      g.fillStyle = cols[i]; g.fillRect(ex - 2, eyy - 2.5, 4, 5);
    }
  }
  g.fillStyle = '#ff6f9c'; g.fillRect(-w * 0.08, ey + 2, w * 0.16, 2);
}

function drawCrown(g, x, y, w) {
  g.fillStyle = '#ffd23f'; g.strokeStyle = '#b8860b'; g.lineWidth = 1;
  g.beginPath();
  g.moveTo(x - w / 2, y); g.lineTo(x - w / 2, y - 10); g.lineTo(x - w / 4, y - 4); g.lineTo(x, y - 14);
  g.lineTo(x + w / 4, y - 4); g.lineTo(x + w / 2, y - 10); g.lineTo(x + w / 2, y); g.closePath();
  g.fill(); g.stroke();
  g.fillStyle = '#ff4fa3'; g.beginPath(); g.arc(x, y - 4, 2, 0, 7); g.fill();
  g.fillStyle = '#3ee6b4'; g.beginPath(); g.arc(x - w / 3, y - 3, 1.5, 0, 7); g.arc(x + w / 3, y - 3, 1.5, 0, 7); g.fill();
}

export function star(g, x, y, r) {
  g.beginPath();
  for (let i = 0; i < 10; i++) {
    const a = (i / 10) * Math.PI * 2 - Math.PI / 2;
    const rr = i % 2 ? r * 0.45 : r;
    g.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr);
  }
  g.closePath(); g.fill();
}

export function roundRect(g, x, y, w, h, r) {
  g.beginPath();
  g.moveTo(x + r, y);
  g.arcTo(x + w, y, x + w, y + h, r);
  g.arcTo(x + w, y + h, x, y + h, r);
  g.arcTo(x, y + h, x, y, r);
  g.arcTo(x, y, x + w, y, r);
  g.closePath();
}

// ---------------------------------------------------------------------------
// Rot getigerter Kater
// ---------------------------------------------------------------------------
export function drawCat(g, x, footY, { phase = 0, scale = 1, pose = 'run', flip = false, t = 0 } = {}) {
  const { img } = getFace('fips', 'normal');
  const hasPhoto = img && !(img instanceof HTMLCanvasElement);
  g.save();
  g.translate(x, footY); g.scale(flip ? -scale : scale, scale);
  const orange = '#e8843a', dark = '#b8561c', light = '#f7c08a';
  if (pose === 'sit') {
    g.fillStyle = orange;
    g.beginPath(); g.ellipse(0, -16, 13, 17, 0, 0, 7); g.fill();
    g.strokeStyle = orange; g.lineWidth = 5; g.lineCap = 'round';
    g.beginPath(); g.moveTo(-10, -4); g.quadraticCurveTo(-28, -2, -24, -22 + Math.sin(t * 3) * 3); g.stroke();
    g.strokeStyle = dark; g.lineWidth = 2.5;
    for (const yy of [-24, -17, -10]) { g.beginPath(); g.moveTo(-11, yy); g.quadraticCurveTo(-4, yy + 2, -2, yy - 1); g.stroke(); }
    drawCatHead(g, 2, -36, hasPhoto ? img : null, orange, dark, light, true);
  } else {
    const b = Math.sin(phase * 2) * 2;
    const legs = [[10, 0], [6, Math.PI], [-10, Math.PI * 0.5], [-14, Math.PI * 1.5]];
    g.strokeStyle = dark; g.lineWidth = 4.5; g.lineCap = 'round';
    for (const [lx, off] of legs) {
      const a = Math.sin(phase * 2 + off) * 0.7;
      g.beginPath(); g.moveTo(lx, -14 + b); g.lineTo(lx + Math.sin(a) * 12, -14 + b + Math.cos(a) * 12); g.stroke();
    }
    // Schwanz
    g.strokeStyle = orange; g.lineWidth = 5;
    g.beginPath(); g.moveTo(-18, -20 + b); g.quadraticCurveTo(-32, -28 + b, -30, -40 + Math.sin(phase) * 4); g.stroke();
    g.fillStyle = orange;
    g.beginPath(); g.ellipse(0, -20 + b, 20, 9, 0, 0, 7); g.fill();
    g.fillStyle = light; g.beginPath(); g.ellipse(4, -15 + b, 12, 3.5, 0, 0, 7); g.fill();
    g.strokeStyle = dark; g.lineWidth = 2.5;
    for (const xx of [-12, -5, 2, 9]) { g.beginPath(); g.moveTo(xx, -28 + b); g.lineTo(xx - 2, -20 + b); g.stroke(); }
    drawCatHead(g, 22, -28 + b, hasPhoto ? img : null, orange, dark, light, false);
  }
  g.restore();
}

function drawCatHead(g, x, y, photo, orange, dark, light, front) {
  if (photo) {
    const h = 34, w = h * (photo.width / photo.height);
    g.save(); g.translate(x, y); if (g.getTransform().a < 0) g.scale(-1, 1);
    g.drawImage(photo, -w / 2, -h * 0.62, w, h); g.restore();
    return;
  }
  g.fillStyle = orange;
  g.beginPath(); g.moveTo(x - 9, y - 4); g.lineTo(x - 7, y - 15); g.lineTo(x - 1, y - 8); g.fill();
  g.beginPath(); g.moveTo(x + 9, y - 4); g.lineTo(x + 7, y - 15); g.lineTo(x + 1, y - 8); g.fill();
  g.beginPath(); g.ellipse(x, y, 11, 9.5, 0, 0, 7); g.fill();
  g.fillStyle = light; g.beginPath(); g.ellipse(x + (front ? 0 : 3), y + 4, 6, 4, 0, 0, 7); g.fill();
  g.strokeStyle = dark; g.lineWidth = 1.8;
  g.beginPath(); g.moveTo(x - 3, y - 9); g.lineTo(x - 2, y - 4); g.moveTo(x + 3, y - 9); g.lineTo(x + 2, y - 4); g.stroke();
  g.fillStyle = '#2a1a0a';
  g.beginPath(); g.ellipse(x - 4 + (front ? 0 : 3), y - 1, 1.6, 2.4, 0, 0, 7); g.ellipse(x + 4 + (front ? 0 : 3), y - 1, 1.6, 2.4, 0, 0, 7); g.fill();
  g.fillStyle = '#e86a8a'; g.beginPath(); g.arc(x + (front ? 0 : 4), y + 3, 1.5, 0, 7); g.fill();
}

// ---------------------------------------------------------------------------
// Cameo-Figuren (Eltern, Oma) am Wegesrand
// ---------------------------------------------------------------------------
export function drawPerson(g, x, footY, { faceKey, t = 0, color = '#5b7bd5', wave = true, oma = false, scale = 1, expr = 'happy' }) {
  g.save(); g.translate(x, footY); g.scale(scale, scale);
  const legC = oma ? '#6b5b4b' : '#333a4a';
  seg(g, -5, -40, -6, -4, 9, legC); seg(g, 5, -40, 6, -4, 9, legC);
  g.fillStyle = '#222'; roundRect(g, -13, -6, 12, 6, 3); g.fill(); roundRect(g, 1, -6, 12, 6, 3); g.fill();
  g.fillStyle = oma ? '#8a5aa8' : color;
  if (oma) { g.beginPath(); g.moveTo(-14, -72); g.lineTo(14, -72); g.lineTo(18, -30); g.lineTo(-18, -30); g.closePath(); g.fill(); }
  else { roundRect(g, -13, -74, 26, 38, 8); g.fill(); }
  // Arme
  const w = wave ? Math.sin(t * 9) * 0.5 : 0;
  seg(g, -12, -68, -20, -46, 8, oma ? '#8a5aa8' : color);
  g.fillStyle = SKIN; g.beginPath(); g.arc(-20, -45, 5, 0, 7); g.fill();
  const hx = 12 + Math.sin(Math.PI * 0.8 + w) * 22, hy = -70 + Math.cos(Math.PI * 0.8 + w) * 22;
  seg(g, 12, -68, hx, hy, 8, oma ? '#8a5aa8' : color);
  g.fillStyle = SKIN; g.beginPath(); g.arc(hx, hy, 5, 0, 7); g.fill();
  const { img } = getFace(faceKey, expr);
  const h = 52, fw = h * (img.width / img.height);
  g.drawImage(img, -fw / 2, -74 - h * 0.85, fw, h);
  g.restore();
}
