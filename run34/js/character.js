// Prozedural gezeichnete Spielfigur (Comic-Körper + Foto-Kopf), Katze & Cameo-Figuren.
import { emoji } from './emoji.js';
import { assets, getFace, faceMeta } from './assets.js';
import { OUTFIT_PARTS } from './config.js';

const SKIN = '#f3c4a2';
const SKIN_DARK = '#dca47f';
const OL = '#2a1830';      // Konturfarbe
const OLW = 1.35;          // Konturbreite
const L_THIGH = 24, L_SHIN = 24, L_UPPER = 17, L_FORE = 16, TORSO = 34;

const shade = (hex, f) => {
  const n = parseInt(hex.slice(1), 16);
  const r = Math.min(255, Math.max(0, ((n >> 16) & 255) * f));
  const g = Math.min(255, Math.max(0, ((n >> 8) & 255) * f));
  const b = Math.min(255, Math.max(0, (n & 255) * f));
  return `rgb(${r | 0},${g | 0},${b | 0})`;
};
const lerpP = (p, q, t) => [p[0] + (q[0] - p[0]) * t, p[1] + (q[1] - p[1]) * t];
const pt = (x, y, ang, len) => [x + Math.sin(ang) * len, y + Math.cos(ang) * len];

function seg(g, x1, y1, x2, y2, w, color) {
  g.strokeStyle = color; g.lineWidth = w; g.lineCap = 'round';
  g.beginPath(); g.moveTo(x1, y1); g.lineTo(x2, y2); g.stroke();
}

// ---------------------------------------------------------------------------
// Bausteine: Teile mit gemeinsamer Kontur (keine Nähte an Gelenken)
// ---------------------------------------------------------------------------
function capPath(g, a, b, wa, wb) {
  const ang = Math.atan2(b[1] - a[1], b[0] - a[0]);
  g.arc(a[0], a[1], wa / 2, ang + Math.PI / 2, ang - Math.PI / 2);
  g.arc(b[0], b[1], wb / 2, ang - Math.PI / 2, ang + Math.PI / 2);
  g.closePath();
}

/** Zylinder-Schattierung quer zum Segment (Licht von oben vorne). */
function cylFill(g, a, b, w, base, f) {
  const dx = b[0] - a[0], dy = b[1] - a[1], len = Math.hypot(dx, dy) || 1;
  let nx = -dy / len, ny = dx / len;
  if (nx * 0.55 + ny * -0.85 < 0) { nx = -nx; ny = -ny; }
  const m = lerpP(a, b, 0.5), r = w / 2 + 1;
  const gr = g.createLinearGradient(m[0] + nx * r, m[1] + ny * r, m[0] - nx * r, m[1] - ny * r);
  gr.addColorStop(0, shade(base, f * 1.16));
  gr.addColorStop(0.45, shade(base, f));
  gr.addColorStop(1, shade(base, f * 0.76));
  return gr;
}

const cap = (a, b, wa, wb, color, f, detail) => ({
  path: (g) => capPath(g, a, b, wa, wb),
  fill: (g) => cylFill(g, a, b, Math.max(wa, wb), color, f),
  detail,
});

function drawGroup(g, pieces) {
  g.save();
  g.lineJoin = 'round'; g.lineCap = 'round';
  g.fillStyle = OL; g.strokeStyle = OL; g.lineWidth = OLW * 2;
  for (const p of pieces) { if (p.noOutline) continue; g.beginPath(); p.path(g); g.fill(); g.stroke(); }
  for (const p of pieces) {
    g.beginPath(); p.path(g);
    g.fillStyle = typeof p.fill === 'function' ? p.fill(g) : p.fill; g.fill();
    if (p.detail) { g.save(); g.beginPath(); p.path(g); g.clip(); p.detail(g); g.restore(); }
  }
  g.restore();
}

/** Linien quer zu einem Segment (Ringel, Bündchen …). */
function bands(g, a, b, step, colorFn, w = 14) {
  const len = Math.hypot(b[0] - a[0], b[1] - a[1]); const n = Math.max(1, Math.round(len / step));
  const ang = Math.atan2(b[1] - a[1], b[0] - a[0]);
  for (let i = 0; i < n; i++) {
    const c = colorFn(i); if (!c) continue;
    const p0 = lerpP(a, b, i / n), p1 = lerpP(a, b, (i + 1) / n);
    g.save(); g.translate(p0[0], p0[1]); g.rotate(ang);
    g.fillStyle = c; g.fillRect(0, -w, Math.hypot(p1[0] - p0[0], p1[1] - p0[1]) + 0.2, w * 2);
    g.restore();
  }
}
function lineAlong(g, a, b, off, color, w = 0.7, dash = null) {
  const dx = b[0] - a[0], dy = b[1] - a[1], len = Math.hypot(dx, dy) || 1;
  const nx = -dy / len * off, ny = dx / len * off;
  g.save(); g.strokeStyle = color; g.lineWidth = w; if (dash) g.setLineDash(dash);
  g.beginPath(); g.moveTo(a[0] + nx, a[1] + ny); g.lineTo(b[0] + nx, b[1] + ny); g.stroke(); g.restore();
}
function lineAcross(g, p, a, b, half, color, w = 0.8) {
  const ang = Math.atan2(b[1] - a[1], b[0] - a[0]) + Math.PI / 2;
  g.save(); g.strokeStyle = color; g.lineWidth = w;
  g.beginPath(); g.moveTo(p[0] - Math.cos(ang) * half, p[1] - Math.sin(ang) * half); g.lineTo(p[0] + Math.cos(ang) * half, p[1] + Math.sin(ang) * half); g.stroke();
  g.restore();
}

// ---------------------------------------------------------------------------
// Posen
// ---------------------------------------------------------------------------
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
 * opt: { pose, phase, outfit, expr, scale, faceKey, rot, t, swell }
 */
export function drawCharacter(g, x, footY, opt) {
  const { pose = 'run', phase = 0, outfit, expr = 'normal', scale = 1, faceKey = 'her', rot = 0, t = 0 } = opt;
  const P = computePose(pose, phase);
  const o = outfit;
  const top = o.top;
  const topCol = FIXED_TOP[top] || (OUTFIT_PARTS.topColor.options[o.topColor]?.color || '#2c3157');
  const extras = new Set(o.extra || []);

  const hip = [0, P.hipY];
  const legPts = P.legs.map(([th, sh]) => {
    const k = pt(hip[0], hip[1], th, L_THIGH);
    const a = pt(k[0], k[1], sh, L_SHIN);
    return { th, sh, k, a };
  });
  let dy;
  if (pose !== 'jump' && pose !== 'dead') dy = -(Math.max(...legPts.map((l) => l.a[1])) + 5);
  else dy = -(L_THIGH + L_SHIN - 6 + P.hipY);

  g.save();
  g.translate(x, footY);
  g.scale(scale, scale);
  if (rot) { g.translate(0, -50); g.rotate(rot); g.translate(0, 50); }
  g.translate(0, dy);

  const shoulder = pt(hip[0], hip[1], Math.PI - P.lean, TORSO - 3);
  const neck = pt(shoulder[0], shoulder[1], Math.PI - P.lean * 0.6, 6);

  if (extras.has('scarf')) drawScarfTail(g, neck, t);
  if (extras.has('tote')) drawTote(g, shoulder, hip, P.lean, t);
  drawGroup(g, armPieces(shoulder, P.arms[0], top, topCol, 0.8));
  drawGroup(g, legPieces(hip, legPts[1], o, 0.8));
  if (o.bottom === 'tutu') drawTutu(g, hip, P.lean, t, false);
  g.save(); g.translate(hip[0], hip[1]); g.rotate(P.lean);
  drawGroup(g, torsoPieces(o, topCol, extras));
  g.restore();
  drawGroup(g, legPieces(hip, legPts[0], o, 1));
  if (o.bottom === 'tutu') drawTutu(g, hip, P.lean, t, true);
  if (extras.has('apron')) { g.save(); g.translate(hip[0], hip[1]); g.rotate(P.lean); drawGroup(g, [apronPiece()]); g.restore(); }
  drawHead(g, neck, P.lean, expr, faceKey, extras, t, opt);
  if (extras.has('scarf')) drawScarfWrap(g, neck, P.lean);
  drawGroup(g, armPieces(shoulder, P.arms[1], top, topCol, 1));
  g.restore();
}

// ---------------------------------------------------------------------------
// Beine, Socken, Hosen, Schuhe
// ---------------------------------------------------------------------------
const DENIM = { jeans: '#42649e', latz: '#6a8fc8' };
// Oberteile mit fester Farbe (Farbwahl ausgeblendet)
export const FIXED_TOP = { princess: '#f58dc2', green: '#3fae3a', pyjama: '#7fcf8e', vans: '#1d1d24', carhartt: '#a86e34', track: '#1f7a3a' };
const TRACK = '#1f7a3a';
const PJ = '#7fcf8e', DK_BROWN = '#5b4630', BOOT = '#8a5a30';
/** Drei feine Streifen längs eines Segments (Trainingsanzug). */
function stripes3(g, a, b, side, color = '#ffffff') { for (const off of [2.2, 3.6, 5]) lineAlong(g, a, b, side * off, color, 0.8); }

function legPieces(H, L, o, f) {
  const { k: K, a: A, sh } = L;
  const P = [];
  const b = o.bottom;
  const bare = b === 'culotte' || b === 'tutu' || b === 'pyshorts';
  const trackL = b === 'trackpants';
  P.push(cap(H, K, 11, 9.6, SKIN, f, (g) => {
    g.fillStyle = 'rgba(255,255,255,0.12)'; g.beginPath(); g.arc(K[0] + 1, K[1] - 1, 2.2, 0, 7); g.fill();
  }));
  P.push(cap(K, A, 9.6, 7.2, SKIN, f));

  if (o.socks !== 'none') {
    const s0 = lerpP(K, A, bare ? 0.3 : 0.66);
    if (o.socks === 'ringel') {
      P.push(cap(s0, A, 8.8, 7.8, '#f6f1e6', f, (g) => {
        bands(g, s0, A, 3.1, (i) => (i % 2 ? null : shade('#d9343f', f)));
        lineAlong(g, s0, A, 2.6, 'rgba(0,0,0,0.12)', 2.2);
      }));
    } else {
      P.push(cap(s0, A, 8.8, 7.8, '#fbfbfb', f, (g) => {
        bands(g, s0, lerpP(s0, A, 0.3), 0.9, (i) => (i % 2 ? 'rgba(0,0,0,0.09)' : null));
        lineAcross(g, lerpP(s0, A, 0.3), s0, A, 6, 'rgba(0,0,0,0.18)', 0.6);
      }));
    }
  }

  if (b === 'jeans' || b === 'latz') {
    const c = DENIM[b];
    const hem = lerpP(K, A, 0.84);
    const stitch = shade('#e8b85a', f);
    P.push(cap(H, K, 13.6, 11.6, c, f, (g) => {
      lineAlong(g, H, K, -4.2, stitch, 0.6, [1.4, 1.1]);
      const kn = g.createRadialGradient(K[0], K[1], 0.5, K[0], K[1], 7);
      kn.addColorStop(0, 'rgba(255,255,255,0.22)'); kn.addColorStop(1, 'rgba(255,255,255,0)');
      g.fillStyle = kn; g.fillRect(K[0] - 8, K[1] - 8, 16, 16);
    }));
    P.push(cap(K, hem, 11.6, 10.8, c, f, (g) => {
      lineAlong(g, K, hem, -3.8, stitch, 0.6, [1.4, 1.1]);
      for (const tt of [0.25, 0.45]) lineAcross(g, lerpP(K, hem, tt), K, hem, 3, 'rgba(0,0,0,0.12)', 0.6);
    }));
    const c0 = lerpP(K, A, 0.76), c1 = lerpP(K, A, 0.9);
    P.push(cap(c0, c1, 11.9, 11.6, '#9fbce8', f, (g) => {
      lineAcross(g, lerpP(c0, c1, 0.5), c0, c1, 7, 'rgba(40,60,110,0.45)', 0.7);
    }));
  } else if (b === 'matrose') {
    const c = '#2b3158';
    const hem = lerpP(K, A, 0.98);
    P.push(cap(H, K, 13.6, 11.6, c, f, (g) => lineAlong(g, H, K, 0, 'rgba(255,255,255,0.10)', 0.8)));
    P.push(cap(K, hem, 11.6, 17.5, c, f, (g) => {
      lineAlong(g, K, hem, 0, 'rgba(255,255,255,0.10)', 0.8);
      lineAcross(g, lerpP(K, hem, 0.92), K, hem, 10, 'rgba(255,255,255,0.18)', 0.8);
    }));
  } else if (b === 'culotte') {
    const c = '#2b2b36';
    const hem = lerpP(K, A, 0.42);
    const dx = hem[0] - K[0], dy = hem[1] - K[1], len = Math.hypot(dx, dy) || 1, nx = -dy / len, ny = dx / len;
    const q = [[K[0] + nx * 8.6, K[1] + ny * 8.6], [hem[0] + nx * 12, hem[1] + ny * 12], [hem[0] - nx * 12, hem[1] - ny * 12], [K[0] - nx * 8.6, K[1] - ny * 8.6]];
    P.push(cap(H, K, 14.5, 17.2, c, f, (g) => lineAlong(g, lerpP(H, K, 0.25), K, 2.5, 'rgba(255,255,255,0.10)', 0.8)));
    P.push({
      path: (g) => { g.moveTo(...q[0]); g.lineTo(...q[1]); g.quadraticCurveTo(hem[0] + (q[1][0] - hem[0]) * 0 + dx / len * 1.5, hem[1] + dy / len * 1.5, ...q[2]); g.lineTo(...q[3]); g.closePath(); },
      fill: (g) => cylFill(g, K, hem, 22, c, f),
      detail: (g) => {
        lineAcross(g, lerpP(K, hem, 0.86), K, hem, 13, 'rgba(255,255,255,0.22)', 0.9);
        for (const off of [-5, 0.5, 6]) lineAlong(g, lerpP(K, hem, 0.15), lerpP(K, hem, 0.8), off, 'rgba(0,0,0,0.22)', 0.7);
      },
    });
  } else if (trackL) { // Trainingshose mit drei weißen Streifen außen
    const hem = lerpP(K, A, 0.9);
    P.push(cap(H, K, 13.8, 12, TRACK, f, (g) => stripes3(g, H, K, -1)));
    P.push(cap(K, hem, 12, 11, TRACK, f, (g) => stripes3(g, K, hem, -1)));
    const c0 = lerpP(K, A, 0.84);
    P.push(cap(c0, hem, 11.2, 10.6, shade(TRACK, 0.8), f));
  } else if (b === 'pyshorts') { // kurze Schlafanzughose mit weißer Paspel
    const hem = lerpP(H, K, 0.62);
    P.push(cap(H, hem, 15.5, 15, PJ, f, (g) => {
      lineAcross(g, lerpP(H, hem, 0.9), H, hem, 9, '#ffffff', 1.3);
      g.fillStyle = 'rgba(255,255,255,0.5)'; for (const tt of [0.3, 0.6]) { const q = lerpP(H, hem, tt); g.beginPath(); g.arc(q[0] + 2, q[1], 0.9, 0, 7); g.fill(); }
    }));
  } else if (b === 'doubleknee') { // Workwear-Hose mit doppeltem Knie
    const c = DK_BROWN, hem = lerpP(K, A, 0.95), k0 = lerpP(H, K, 0.7), k1 = lerpP(K, A, 0.4);
    P.push(cap(H, K, 14.4, 13, c, f, (g) => { lineAlong(g, H, K, -4.4, 'rgba(232,184,90,0.6)', 0.6, [1.4, 1.1]); }));
    P.push(cap(K, hem, 13, 13.2, c, f, (g) => lineAlong(g, K, hem, -4, 'rgba(232,184,90,0.6)', 0.6, [1.4, 1.1])));
    P.push(cap(k0, k1, 13.8, 13.6, '#4a3826', f, (g) => {
      lineAcross(g, lerpP(k0, k1, 0.04), k0, k1, 7, 'rgba(232,184,90,0.7)', 0.6);
      lineAcross(g, lerpP(k0, k1, 0.96), k0, k1, 7, 'rgba(232,184,90,0.7)', 0.6);
    }));
  }
  if (o.shoes === 'cowboy') { // Stiefelschaft mit Ziernähten (über der Hose getragen)
    const s0 = lerpP(K, A, 0.4);
    P.push(cap(s0, A, 11.6, 9.8, BOOT, f, (g) => {
      lineAcross(g, lerpP(s0, A, 0.06), s0, A, 7, shade('#3d2412', f), 1.4);
      lineAlong(g, lerpP(s0, A, 0.15), lerpP(s0, A, 0.8), 0.5, shade('#f2d3a0', f), 0.6, [1.2, 0.9]);
      lineAlong(g, lerpP(s0, A, 0.2), lerpP(s0, A, 0.7), 2.5, shade('#f2d3a0', f), 0.5, [1.2, 0.9]);
    }));
  }
  P.push(shoePiece(A, sh, o.shoes, f));
  return P;
}

function shoePiece(A, sh, type, f) {
  const rot = -sh * 0.5;
  const tf = (g) => { g.translate(A[0], A[1]); g.rotate(rot); };
  let path, fill, detail;
  if (type === 'docs') {
    path = (g) => { g.save(); tf(g); g.moveTo(-6, -14); g.lineTo(4.5, -14); g.lineTo(5.5, -6); g.quadraticCurveTo(14.5, -5.5, 16.5, 0); g.lineTo(16.5, 5.2); g.lineTo(-7.2, 5.2); g.lineTo(-7.2, -3); g.closePath(); g.restore(); };
    fill = (g) => { const gr = g.createLinearGradient(A[0], A[1] - 14, A[0], A[1] + 5); gr.addColorStop(0, shade('#3a3434', f)); gr.addColorStop(1, shade('#151212', f)); return gr; };
    detail = (g) => {
      g.save(); tf(g);
      g.fillStyle = shade('#121010', f); g.fillRect(-9, 1.6, 28, 5);
      g.strokeStyle = shade('#f2cf3a', f); g.lineWidth = 0.75; g.setLineDash([1.3, 0.9]);
      g.beginPath(); g.moveTo(-7, 2.2); g.lineTo(16.5, 2.2); g.stroke(); g.setLineDash([]);
      g.fillStyle = shade('#f2cf3a', f); g.fillRect(-7.2, -14, 2.2, 4.5);
      g.strokeStyle = shade('#c9b89a', f); g.lineWidth = 0.7;
      for (let y = -12.5; y < -5; y += 2.4) { g.beginPath(); g.moveTo(2, y); g.lineTo(5, y + 1.2); g.stroke(); }
      g.fillStyle = 'rgba(255,255,255,0.28)'; g.beginPath(); g.ellipse(10.5, -2.6, 3.2, 1.1, -0.25, 0, 7); g.fill();
      g.restore();
    };
  } else if (type === 'sneaker') {
    path = (g) => { g.save(); tf(g); g.moveTo(-6, -6.5); g.quadraticCurveTo(-8.6, 1, -6.6, 5.2); g.lineTo(13.5, 5.2); g.quadraticCurveTo(17.6, 5, 16.6, 0.8); g.quadraticCurveTo(14.5, -3.6, 7.5, -4.2); g.lineTo(3, -7.4); g.quadraticCurveTo(-2, -9, -6, -6.5); g.closePath(); g.restore(); };
    fill = (g) => { const gr = g.createLinearGradient(A[0], A[1] - 8, A[0], A[1] + 5); gr.addColorStop(0, shade('#ffffff', f)); gr.addColorStop(1, shade('#e5e1ea', f)); return gr; };
    detail = (g) => {
      g.save(); tf(g);
      g.fillStyle = shade('#efe6d6', f); g.fillRect(-9, 2.2, 28, 4);
      g.strokeStyle = 'rgba(0,0,0,0.25)'; g.lineWidth = 0.6; g.beginPath(); g.moveTo(-8, 2.2); g.lineTo(18, 2.2); g.stroke();
      g.strokeStyle = shade('#ff4fa3', f); g.lineWidth = 1.8; g.beginPath(); g.moveTo(-3.5, 0.2); g.quadraticCurveTo(3, -0.6, 9.5, -2.6); g.stroke();
      g.fillStyle = shade('#ff4fa3', f); g.fillRect(-7, -6, 2.4, 4);
      g.strokeStyle = 'rgba(0,0,0,0.3)'; g.lineWidth = 0.6;
      g.beginPath(); g.moveTo(10, 2); g.quadraticCurveTo(10.5, -1.8, 14.5, -1); g.stroke();
      g.strokeStyle = shade('#9aa3b5', f); g.lineWidth = 0.8;
      for (let i = 0; i < 3; i++) { g.beginPath(); g.moveTo(2.6 + i * 1.6, -6.6 + i * 1.1); g.lineTo(5.4 + i * 1.6, -5.4 + i * 1.1); g.stroke(); }
      g.restore();
    };
  } else if (type === 'checker' || type === 'oldskool') {
    // Skate-Schuh: flaches Canvas-Obermaterial, weiße Vulkanisiersohle mit Rand-Streifen
    const slip = type === 'checker';
    path = (g) => { g.save(); tf(g); g.moveTo(-6, -5.6); g.quadraticCurveTo(-8.4, 1, -6.8, 5.2); g.lineTo(14.6, 5.2); g.quadraticCurveTo(17.8, 4.6, 16.8, 1); g.quadraticCurveTo(15, -3.2, 7, -3.8); g.lineTo(slip ? 2.5 : 3.5, slip ? -5.2 : -6.8); g.quadraticCurveTo(-2, -7.2, -6, -5.6); g.closePath(); g.restore(); };
    fill = (g) => (slip ? shade('#f4f1ea', f) : shade('#1b1b20', f));
    detail = (g) => {
      g.save(); tf(g);
      if (slip) { // Schachbrett
        for (let x = -9; x < 18; x += 2.6) for (let y = -8; y < 2.4; y += 2.6) if (((Math.round((x + 9) / 2.6) + Math.round((y + 8) / 2.6)) % 2) === 0) { g.fillStyle = shade('#16161a', f); g.fillRect(x, y, 2.6, 2.6); }
        g.fillStyle = shade('#222', f); g.beginPath(); g.moveTo(1.2, -5.4); g.lineTo(4.2, -5.6); g.lineTo(2.7, -2.2); g.closePath(); g.fill(); // Gummizug
      } else { // seitlicher Schwung-Streifen + Schnürung
        g.strokeStyle = shade('#ffffff', f); g.lineWidth = 1.6; g.beginPath(); g.moveTo(-4.5, 0.6); g.quadraticCurveTo(2, 0.8, 5, -2.5); g.quadraticCurveTo(6.5, -0.6, 11, 0.4); g.stroke();
        g.strokeStyle = shade('#e8e8e8', f); g.lineWidth = 0.8; for (let i = 0; i < 3; i++) { g.beginPath(); g.moveTo(3.4 + i * 1.6, -6.4 + i * 1.1); g.lineTo(6 + i * 1.6, -5.2 + i * 1.1); g.stroke(); }
      }
      g.fillStyle = shade('#fbfaf6', f); g.fillRect(-9, 2.1, 28, 4.2); // Sohle
      g.strokeStyle = shade(slip ? '#1b1b20' : '#b33a3a', f); g.lineWidth = 0.6; g.beginPath(); g.moveTo(-8, 3.4); g.lineTo(18, 3.4); g.stroke();
      g.strokeStyle = 'rgba(0,0,0,0.3)'; g.lineWidth = 0.5; g.beginPath(); g.moveTo(-8, 2.1); g.lineTo(18, 2.1); g.stroke();
      g.fillStyle = shade('#c9a46b', f); g.fillRect(-8.6, 5, 2.2, 1); // Ferse
      g.restore();
    };
  } else if (type === 'cowboy') {
    // Cowboystiefel: spitze Kappe, Absatz, Ziernähte (Schaft kommt aus legPieces)
    path = (g) => { g.save(); tf(g); g.moveTo(-6.4, -8); g.lineTo(5, -8); g.quadraticCurveTo(6, -4.5, 9, -3.6); g.quadraticCurveTo(16, -2, 20.5, 3.4); g.quadraticCurveTo(14, 4.4, 1, 4); g.lineTo(-1.6, 5.2); g.lineTo(-7.2, 5.2); g.lineTo(-7.4, -2); g.closePath(); g.restore(); };
    fill = (g) => { const gr = g.createLinearGradient(A[0], A[1] - 8, A[0], A[1] + 5); gr.addColorStop(0, shade('#a06a3a', f)); gr.addColorStop(1, shade('#5e3a1c', f)); return gr; };
    detail = (g) => {
      g.save(); tf(g);
      g.fillStyle = shade('#2e1c0e', f); g.fillRect(-7.4, 2.4, 6, 3); g.fillRect(-1.6, 3.4, 22, 1.2);
      g.strokeStyle = shade('#f2d3a0', f); g.lineWidth = 0.55; g.setLineDash([1.1, 0.8]);
      g.beginPath(); g.moveTo(7, -2.6); g.quadraticCurveTo(12, -0.6, 17, 2.2); g.stroke();
      g.beginPath(); g.arc(9.5, -0.8, 2.2, Math.PI, 0); g.stroke(); g.setLineDash([]);
      g.fillStyle = 'rgba(255,255,255,0.3)'; g.beginPath(); g.ellipse(14, -0.4, 2.8, 0.8, 0.3, 0, 7); g.fill();
      g.restore();
    };
  } else {
    path = (g) => { g.save(); tf(g); g.moveTo(-6, -4.5); g.quadraticCurveTo(-8.5, 2.5, -6.4, 5.2); g.lineTo(13.5, 5.2); g.quadraticCurveTo(16.8, 4.4, 15.6, 0.4); g.quadraticCurveTo(12.5, -4, 4, -4.4); g.closePath(); g.restore(); };
    fill = (g) => { const gr = g.createLinearGradient(A[0], A[1] - 5, A[0], A[1] + 5); gr.addColorStop(0, shade('#3b3540', f)); gr.addColorStop(1, shade('#0f0d12', f)); return gr; };
    detail = (g) => {
      g.save(); tf(g);
      g.fillStyle = shade('#060506', f); g.fillRect(-9, 3, 28, 3);
      g.strokeStyle = 'rgba(255,255,255,0.25)'; g.lineWidth = 0.7; g.beginPath(); g.moveTo(2, -3.6); g.quadraticCurveTo(6, -1, 9, -3.4); g.stroke();
      g.fillStyle = 'rgba(255,255,255,0.35)'; g.beginPath(); g.ellipse(11, -1.4, 2.6, 0.9, -0.2, 0, 7); g.fill();
      g.restore();
    };
  }
  return { path, fill, detail };
}

// ---------------------------------------------------------------------------
// Arme & Ärmel
// ---------------------------------------------------------------------------
function armPieces(S, [up, fo], top, topCol, f) {
  const E = pt(S[0], S[1], up, L_UPPER);
  const Hn = pt(E[0], E[1], fo, L_FORE);
  const P = [cap(S, E, 9.2, 7.6, SKIN, f), cap(E, Hn, 7.6, 6.4, SKIN, f)];
  if (top === 'matrose' || top === 'ripp' || top === 'blazer' || top === 'carhartt' || top === 'track') {
    const c1 = lerpP(E, Hn, 0.7), c2 = lerpP(E, Hn, 0.84);
    const tex = top === 'track'
      ? (a, b) => (g) => stripes3(g, a, b, 1)
      : top === 'ripp'
      ? (a, b) => (g) => { for (const off of [-3, -1.5, 0, 1.5, 3]) lineAlong(g, a, b, off, 'rgba(0,0,0,0.13)', 0.55); }
      : (a, b) => (g) => lineAlong(g, a, b, -2.5, 'rgba(255,255,255,0.10)', 1.2);
    P.push(cap(S, E, 11.2, 9.6, topCol, f, tex(S, E)));
    P.push(cap(E, c1, 9.6, 9, topCol, f, tex(E, c1)));
    if (top === 'blazer') {
      P.push(cap(c1, c2, 8.6, 8.2, '#ffffff', f));
    } else if (top === 'track') { // Bündchen
      P.push(cap(c1, c2, 9.2, 8.8, shade(TRACK, 0.8), f));
    } else if (top === 'carhartt') { // Druckknopf-Bündchen
      P.push(cap(c1, c2, 9.4, 9.2, shade(topCol, 0.82), f, (g) => { const m = lerpP(c1, c2, 0.5); g.fillStyle = '#d8c9a0'; g.beginPath(); g.arc(m[0], m[1], 1, 0, 7); g.fill(); }));
    } else if (top === 'matrose') {
      P.push(cap(c1, c2, 9.4, 9.2, '#f4f2ee', f, (g) => {
        lineAcross(g, lerpP(c1, c2, 0.35), c1, c2, 6, shade('#2c3157', f), 0.9);
        lineAcross(g, lerpP(c1, c2, 0.65), c1, c2, 6, shade('#2c3157', f), 0.9);
      }));
    } else {
      P.push(cap(c1, c2, 8.8, 8.4, topCol, f, (g) => {
        bands(g, c1, c2, 0.9, (i) => (i % 2 ? 'rgba(0,0,0,0.16)' : null));
      }));
    }
  } else if (top === 'princess') {
    const pm = lerpP(S, E, 0.22), ang = Math.atan2(E[1] - S[1], E[0] - S[0]);
    P.push({
      path: (g) => g.ellipse(pm[0], pm[1], 6.4, 5.4, ang, 0, Math.PI * 2),
      fill: (g) => cylFill(g, S, E, 14, topCol, f),
      detail: (g) => {
        g.strokeStyle = 'rgba(160,40,100,0.35)'; g.lineWidth = 0.7;
        for (const a2 of [-0.6, 0, 0.6]) { g.beginPath(); g.moveTo(S[0], S[1]); g.lineTo(pm[0] + Math.cos(ang + a2) * 9, pm[1] + Math.sin(ang + a2) * 9); g.stroke(); }
        g.fillStyle = 'rgba(255,255,255,0.7)'; star(g, pm[0] + 1, pm[1] - 2, 1.6);
      },
    });
  } else if (top === 'green' || top === 'pyjama' || top === 'vans') {
    const e2 = lerpP(S, E, 0.58);
    P.push(cap(S, e2, 12.4, 12, topCol, f, (g) => {
      if (top === 'pyjama') lineAcross(g, lerpP(S, e2, 0.88), S, e2, 8, '#ffffff', 1.3);
      else if (top === 'vans') { const m = lerpP(S, e2, 0.8); for (let k = -2; k <= 2; k++) { const q = lerpP(S, e2, 0.8 + k * 0.035); g.fillStyle = (k + 2) % 2 ? '#f4f1ea' : '#16161a'; g.beginPath(); g.arc(q[0], q[1], 1.6, 0, 7); g.fill(); } void m; }
      else lineAcross(g, lerpP(S, e2, 0.86), S, e2, 8, 'rgba(0,0,0,0.2)', 0.8);
    }));
  } else if (top === 'tank') {
    // Träger sitzen am Torso
  }
  // Faust mit Daumen
  P.push({
    path: (g) => g.arc(Hn[0], Hn[1], 4.8, 0, Math.PI * 2),
    fill: (g) => { const gr = g.createRadialGradient(Hn[0] - 1.5, Hn[1] - 1.5, 0.5, Hn[0], Hn[1], 5.5); gr.addColorStop(0, shade(SKIN, f * 1.1)); gr.addColorStop(1, shade(SKIN, f * 0.85)); return gr; },
    detail: (g) => {
      g.strokeStyle = shade('#b57b5a', f); g.lineWidth = 0.6;
      const ang = Math.atan2(Hn[1] - E[1], Hn[0] - E[0]);
      for (const d of [-1.6, 0, 1.6]) { g.beginPath(); g.arc(Hn[0] + Math.cos(ang) * 2.4 + Math.cos(ang + Math.PI / 2) * d, Hn[1] + Math.sin(ang) * 2.4 + Math.sin(ang + Math.PI / 2) * d, 0.9, ang - 1.2, ang + 1.2); g.stroke(); }
    },
  });
  return P;
}

// ---------------------------------------------------------------------------
// Torso (lokal: Hüfte = Ursprung, oben = -y, vorne = +x)
// ---------------------------------------------------------------------------
const EDGE = [[-36, -8, 8.5], [-34, -10, 10.4], [-30, -10.2, 11.8], [-26, -10, 12.4], [-22, -9.4, 11.2], [-18, -8.7, 9.4],
  [-14, -8.4, 8.6], [-9, -9.4, 9.6], [-4, -10.4, 10.6], [0, -10.8, 10.9], [5, -10.4, 10.6]];
function edgeAt(y) {
  if (y <= EDGE[0][0]) return [EDGE[0][1], EDGE[0][2]];
  for (let i = 1; i < EDGE.length; i++) {
    if (y <= EDGE[i][0]) {
      const [y0, b0, f0] = EDGE[i - 1], [y1, b1, f1] = EDGE[i];
      let u = (y - y0) / (y1 - y0); u = u * u * (3 - 2 * u);
      return [b0 + (b1 - b0) * u, f0 + (f1 - f0) * u];
    }
  }
  return [EDGE[EDGE.length - 1][1], EDGE[EDGE.length - 1][2]];
}
/** Silhouette zwischen y0 und y1; topFront/topBack erlauben Ausschnitte. */
function bodyPath(g, y0, y1, { inset = 0, topCurve = null, botCurve = 0 } = {}) {
  const st = 1;
  const [b0, f0] = edgeAt(y0);
  g.moveTo(b0 + inset, y0);
  if (topCurve) topCurve(g, b0 + inset, f0 - inset);
  else g.quadraticCurveTo((b0 + f0) / 2, y0 - 1.5, f0 - inset, y0);
  for (let y = y0 + st; y < y1; y += st) g.lineTo(edgeAt(y)[1] - inset, y);
  const [b1, f1] = edgeAt(y1);
  g.lineTo(f1 - inset, y1);
  g.quadraticCurveTo((b1 + f1) / 2, y1 + botCurve, b1 + inset, y1);
  for (let y = y1 - st; y > y0; y -= st) g.lineTo(edgeAt(y)[0] + inset, y);
  g.closePath();
}
const hGrad = (g, base, y0, y1) => {
  const gr = g.createLinearGradient(-11, 0, 12, 0);
  gr.addColorStop(0, shade(base, 0.74)); gr.addColorStop(0.55, shade(base, 1)); gr.addColorStop(0.85, shade(base, 1.12)); gr.addColorStop(1, shade(base, 0.92));
  return gr;
};

function torsoPieces(o, topCol, extras) {
  const P = [];
  const top = o.top, b = o.bottom;
  const tucked = b === 'jeans' || b === 'matrose' || b === 'culotte' || b === 'doubleknee';
  const hemY = tucked && top !== 'pyjama' ? -6 : top === 'green' || top === 'pyjama' ? -1 : -3;
  // Hautbasis (sichtbar bei Ausschnitten)
  P.push({ path: (g) => bodyPath(g, -36, -20), fill: (g) => hGrad(g, SKIN), noOutline: true });

  if (top === 'track') {
    // Trainingsjacke über der Hose – siehe unten
  } else if (top === 'carhartt') {
    // Workwear-Jacke (Canvas, Cordkragen, Reißverschluss, Brusttasche) – siehe unten, über der Hose
  } else if (top === 'blazer') {
    P.push({
      path: (g) => bodyPath(g, -36, -1, { botCurve: 1 }),
      fill: (g) => hGrad(g, topCol),
      detail: (g) => {
        // Hemd im Ausschnitt
        g.fillStyle = '#ffffff'; g.beginPath(); g.moveTo(1, -37); g.lineTo(11, -37); g.lineTo(edgeAt(-20)[1], -20); g.lineTo(5, -14); g.closePath(); g.fill();
        // Revers
        g.fillStyle = shade(topCol, 0.78); g.beginPath(); g.moveTo(1, -37); g.lineTo(5, -14); g.lineTo(2.5, -24); g.lineTo(-1, -30); g.closePath(); g.fill();
        g.beginPath(); g.moveTo(11, -37); g.lineTo(edgeAt(-20)[1], -20); g.lineTo(edgeAt(-26)[1] - 2.5, -27); g.closePath(); g.fill();
        g.fillStyle = '#d4af37'; for (const by of [-12, -6]) { g.beginPath(); g.arc(6.5, by, 1, 0, 7); g.fill(); }
        if (extras.has('sweep')) { // Schornsteinfeger: zweireihige Goldknöpfe + Rußflecken
          g.fillStyle = '#e8c547'; for (const by of [-30, -24, -18, -12, -6]) for (const bx of [2.5, 10]) { g.beginPath(); g.arc(bx, by, 1.2, 0, 7); g.fill(); }
          g.fillStyle = 'rgba(0,0,0,0.35)'; for (const [sx, sy, r] of [[-6, -18, 3], [9, -3, 2.4], [-2, -6, 2]]) { g.beginPath(); g.arc(sx, sy, r, 0, 7); g.fill(); }
        }
        g.strokeStyle = 'rgba(0,0,0,0.25)'; g.lineWidth = 0.7; g.beginPath(); g.moveTo(-3, -8); g.lineTo(4, -8); g.stroke();
        g.fillStyle = 'rgba(255,255,255,0.5)'; g.fillRect(-6, -28, 4, 2.4);
      },
    });
  } else if (top === 'glitter') {
    P.push({
      path: (g) => bodyPath(g, -30, hemY, { topCurve: (g, xb, xf) => { g.quadraticCurveTo(-3, -32, 2, -29); g.quadraticCurveTo(7, -27, xf, -29); } }),
      fill: (g) => { const gr = g.createLinearGradient(-11, -30, 12, hemY); gr.addColorStop(0, '#cfd8dc'); gr.addColorStop(0.5, '#fffde7'); gr.addColorStop(1, '#b0bec5'); return gr; },
      detail: (g) => {
        const tt = performance.now() / 1000;
        for (let yy = -29; yy < hemY; yy += 2.2) for (let xx = -11; xx < 12; xx += 2.2) {
          const v = (Math.sin(xx * 1.7 + yy * 2.3 + tt * 6) + 1) / 2;
          g.fillStyle = v > 0.85 ? '#ffffff' : v > 0.55 ? 'rgba(255,214,90,0.8)' : 'rgba(150,160,180,0.5)';
          g.beginPath(); g.arc(xx + (yy % 4.4 ? 1.1 : 0), yy, 0.9, 0, 7); g.fill();
        }
      },
    });
    for (const sx of [-6, 4.5]) P.push({ path: (g) => { g.rect(sx, -37, 1.8, 9); }, fill: '#cfd8dc' });
  } else if (top === 'tank') {
    P.push({
      path: (g) => bodyPath(g, -29, hemY, { topCurve: (g, xb, xf) => { g.quadraticCurveTo(-4, -31, 2, -27); g.quadraticCurveTo(6, -24.5, xf, -27); } }),
      fill: (g) => hGrad(g, topCol),
      detail: (g) => {
        g.strokeStyle = 'rgba(255,255,255,0.18)'; g.lineWidth = 0.8; g.beginPath(); g.moveTo(-3, -28); g.quadraticCurveTo(6, -23.5, 12, -26.5); g.stroke();
        g.strokeStyle = 'rgba(0,0,0,0.15)'; g.beginPath(); g.moveTo(-9, hemY - 1.5); g.lineTo(10, hemY - 1.5); g.stroke();
      },
    });
    for (const sx of [-6.5, 4.5]) P.push({ path: (g) => { g.rect(sx, -36.5, 2.4, 9); }, fill: shade(topCol, 0.9) });
  } else if (top === 'princess') {
    P.push({
      path: (g) => bodyPath(g, -29, -3, { topCurve: (g, xb, xf) => { g.quadraticCurveTo(-1, -32, 3, -28); g.quadraticCurveTo(7, -31, xf, -27.5); } }),
      fill: (g) => hGrad(g, topCol),
      detail: (g) => {
        g.strokeStyle = '#ffd23f'; g.lineWidth = 1.3; g.beginPath(); g.moveTo(-9.5, -28); g.quadraticCurveTo(-1, -31.5, 3, -27.5); g.quadraticCurveTo(7, -30.5, 13, -27); g.stroke();
        g.fillStyle = 'rgba(255,255,255,0.85)'; for (const [sx, sy, r] of [[-5, -22, 1.8], [4, -17, 1.5], [-2, -10, 1.6], [7, -23, 1.3], [1, -6, 1.2]]) star(g, sx, sy, r);
        g.fillStyle = '#e0458f'; g.fillRect(-11, -15.5, 24, 3);
        g.fillStyle = '#ffd23f'; g.beginPath(); g.arc(-7, -14, 2, 0, 7); g.fill();
      },
    });
  } else {
    const ripp = top === 'ripp', mat = top === 'matrose', green = top === 'green';
    P.push({
      path: (g) => bodyPath(g, -36, hemY, { botCurve: green ? 0.8 : 0 }),
      fill: (g) => hGrad(g, topCol),
      detail: (g) => {
        if (ripp) {
          for (let x = -11; x < 13; x += 1.7) { g.fillStyle = 'rgba(0,0,0,0.11)'; g.fillRect(x, -37, 0.7, 40); g.fillStyle = 'rgba(255,255,255,0.07)'; g.fillRect(x + 0.8, -37, 0.5, 40); }
          g.fillStyle = 'rgba(0,0,0,0.10)'; g.fillRect(-12, hemY - 3, 26, 3);
          g.fillStyle = shade(topCol, 0.82); g.beginPath(); g.ellipse(1.5, -36, 6.5, 2.4, 0, 0, 7); g.fill();
        }
        if (top === 'pyjama') { // Reverskragen + Knopfleiste mit weißer Paspel
          g.fillStyle = SKIN; g.beginPath(); g.moveTo(1, -36.5); g.lineTo(10, -36.5); g.lineTo(5.5, -27); g.closePath(); g.fill();
          g.strokeStyle = '#ffffff'; g.lineWidth = 1.2; g.beginPath(); g.moveTo(-1, -36.5); g.lineTo(5.5, -27); g.lineTo(11, -36.5); g.stroke();
          g.beginPath(); g.moveTo(5.5, -27); g.lineTo(5.5, hemY); g.stroke();
          g.fillStyle = '#ffffff'; for (const by of [-22, -15, -8]) { g.beginPath(); g.arc(7, by, 0.95, 0, 7); g.fill(); }
          g.fillStyle = 'rgba(255,255,255,0.35)'; for (const [sx, sy] of [[-6, -30], [-2, -18], [-8, -10], [9, -14]]) { g.beginPath(); g.arc(sx, sy, 1, 0, 7); g.fill(); }
          g.strokeStyle = '#ffffff'; g.lineWidth = 1; g.beginPath(); g.moveTo(-12, hemY - 1); g.lineTo(13, hemY - 1); g.stroke();
        }
        if (top === 'vans') { // schwarzes Shirt mit Schachbrett-Band
          for (let x = -12, i = 0; x < 13; x += 2.4, i++) for (let r = 0; r < 2; r++) { g.fillStyle = (i + r) % 2 ? '#f4f1ea' : '#16161a'; g.fillRect(x, -23 + r * 2.4, 2.4, 2.4); }
          g.fillStyle = shade(topCol, 1.3); g.beginPath(); g.ellipse(1.5, -36, 6, 2.2, 0, 0, 7); g.fill();
        }
        if (green) {
          g.fillStyle = 'rgba(0,0,0,0.12)'; g.fillRect(-12, hemY - 2.5, 26, 1);
          g.fillStyle = 'rgba(255,255,255,0.3)'; g.font = '900 5px sans-serif'; g.textAlign = 'center'; g.fillText('IIH', 2, -18);
          g.fillStyle = shade(topCol, 0.8); g.beginPath(); g.ellipse(1.5, -36, 6, 2.2, 0, 0, 7); g.fill();
        }
        if (mat) {
          g.fillStyle = SKIN; g.beginPath(); g.moveTo(1, -36.5); g.lineTo(9.5, -36.5); g.lineTo(5, -28); g.closePath(); g.fill();
          g.strokeStyle = '#f4f2ee'; g.lineWidth = 1.2; g.beginPath(); g.moveTo(1, -36.5); g.lineTo(5, -28); g.lineTo(9.8, -36.5); g.stroke();
          g.fillStyle = 'rgba(255,255,255,0.08)'; g.fillRect(-11, hemY - 2.5, 26, 2.5);
        }
      },
    });
    if (mat) {
      // Matrosenkragen (Rückseite) + Halstuch
      P.push({
        path: (g) => { g.moveTo(1.5, -37); g.lineTo(-11.6, -37); g.lineTo(-12, -26.5); g.lineTo(-2.5, -27.5); g.closePath(); },
        fill: '#f6f4ef',
        detail: (g) => {
          g.strokeStyle = '#2c3157'; g.lineWidth = 0.8;
          g.beginPath(); g.moveTo(-10.4, -36); g.lineTo(-10.6, -28); g.lineTo(-3, -28.8); g.stroke();
          g.beginPath(); g.moveTo(-9, -36); g.lineTo(-9.2, -29.4); g.lineTo(-3.4, -30.2); g.stroke();
        },
      });
      P.push({
        path: (g) => { g.moveTo(3.5, -30.5); g.lineTo(7.5, -30.5); g.lineTo(9.5, -19); g.lineTo(6.8, -18); g.lineTo(5.5, -26); g.lineTo(3.5, -19.5); g.lineTo(1.5, -20.5); g.closePath(); },
        fill: '#17151c',
        detail: (g) => { g.fillStyle = '#2d2a36'; g.beginPath(); g.ellipse(5.5, -29.5, 2.6, 1.9, 0, 0, 7); g.fill(); },
      });
    }
  }

  // Hosenbund / Becken
  if (tucked) {
    const pc = b === 'jeans' ? DENIM.jeans : b === 'matrose' ? '#2b3158' : b === 'doubleknee' ? DK_BROWN : '#2b2b36';
    const top2 = b === 'culotte' ? -12 : -9;
    P.push({
      path: (g) => bodyPath(g, top2, 5, { botCurve: 1.5 }),
      fill: (g) => hGrad(g, pc),
      detail: (g) => {
        if (b === 'doubleknee') {
          g.fillStyle = 'rgba(0,0,0,0.25)'; g.fillRect(-12, top2, 25, 2.6);
          for (const lx of [-8, -1, 6]) { g.fillStyle = shade(DK_BROWN, 0.8); g.fillRect(lx, top2 - 0.4, 1.4, 3.4); }
          g.strokeStyle = 'rgba(232,184,90,0.6)'; g.lineWidth = 0.55; g.setLineDash([1.2, 1]); g.beginPath(); g.moveTo(9, top2 + 3); g.quadraticCurveTo(8.5, top2 + 9, 7, top2 + 12); g.stroke(); g.setLineDash([]);
          g.fillStyle = '#d8c9a0'; g.fillRect(-11.5, top2 + 4, 1.6, 6); // Hammerschlaufe
        } else if (b === 'jeans') {
          g.fillStyle = '#6b4325'; g.fillRect(-12, top2, 25, 2.6);
          g.fillStyle = '#e2c25a'; g.fillRect(7.5, top2 - 0.2, 3.6, 3); g.fillStyle = '#6b4325'; g.fillRect(8.4, top2 + 0.6, 1.8, 1.4);
          g.fillStyle = shade(DENIM.jeans, 0.8); for (const lx of [-8, -1]) g.fillRect(lx, top2 - 0.4, 1.4, 3.4);
          g.strokeStyle = '#e8b85a'; g.lineWidth = 0.55; g.setLineDash([1.2, 1]);
          g.beginPath(); g.moveTo(4, top2 + 3); g.quadraticCurveTo(5, top2 + 7, 10.5, top2 + 7.5); g.stroke();
          g.strokeRect(-9.8, top2 + 4, 5.5, 5.5);
          g.beginPath(); g.moveTo(9, top2 + 3); g.quadraticCurveTo(8.5, top2 + 9, 7, top2 + 12); g.stroke();
          g.setLineDash([]);
        } else if (b === 'matrose') {
          g.fillStyle = 'rgba(255,255,255,0.08)'; g.fillRect(-12, top2, 25, 2.4);
          g.fillStyle = '#e2c25a'; for (const [bx, by] of [[6, -6], [9, -6], [6, -2], [9, -2]]) { g.beginPath(); g.arc(bx, by, 0.9, 0, 7); g.fill(); }
        } else {
          g.fillStyle = 'rgba(255,255,255,0.10)'; g.fillRect(-12, top2, 25, 3.5);
          g.fillStyle = '#c9b07a'; g.beginPath(); g.arc(8.5, top2 + 1.8, 1.1, 0, 7); g.fill();
          g.strokeStyle = 'rgba(255,255,255,0.12)'; g.lineWidth = 0.7;
          for (const px of [-4, 2, 7]) { g.beginPath(); g.moveTo(px, top2 + 3.5); g.lineTo(px + 0.5, 5); g.stroke(); }
        }
      },
    });
  } else if (b === 'latz') {
    const c = DENIM.latz;
    P.push({
      path: (g) => { g.moveTo(-4, -25); g.lineTo(edgeAt(-25)[1] - 0.6, -25); for (let y = -24; y < 5; y++) g.lineTo(edgeAt(y)[1], y); g.quadraticCurveTo(0, 6.5, edgeAt(5)[0], 5); for (let y = 4; y > -9; y--) g.lineTo(edgeAt(y)[0], y); g.lineTo(-4.5, -9); g.closePath(); },
      fill: (g) => hGrad(g, c),
      detail: (g) => {
        g.strokeStyle = '#e8b85a'; g.lineWidth = 0.55; g.setLineDash([1.2, 1]);
        g.beginPath(); g.moveTo(-3, -24); g.lineTo(edgeAt(-24)[1] - 1.5, -24); g.stroke();
        g.strokeRect(0, -21, 8, 6.5);
        g.beginPath(); g.moveTo(-11, -8); g.lineTo(12, -8); g.stroke();
        g.setLineDash([]);
        g.fillStyle = 'rgba(0,0,0,0.10)'; g.fillRect(0, -21, 8, 1.5);
        g.fillStyle = '#e2c25a'; g.beginPath(); g.arc(10, -6, 1.1, 0, 7); g.fill();
      },
    });
    // Träger + Schnallen
    P.push({ path: (g) => { g.moveTo(-3.5, -25.5); g.lineTo(-0.5, -25.5); g.lineTo(-3, -37); g.lineTo(-6, -37); g.closePath(); }, fill: shade(c, 0.92) });
    P.push({ path: (g) => { g.moveTo(8, -25.5); g.lineTo(11, -25.5); g.lineTo(6.5, -37); g.lineTo(3.5, -37); g.closePath(); }, fill: shade(c, 1.02) });
    for (const bx of [-2.2, 9.4]) P.push({ path: (g) => g.rect(bx - 1.8, -27.5, 3.6, 2.8), fill: '#e2c25a' });
  } else if (b === 'pyshorts') {
    P.push({ path: (g) => bodyPath(g, -7, 5, { botCurve: 1.5 }), fill: (g) => hGrad(g, PJ), detail: (g) => { g.fillStyle = 'rgba(255,255,255,0.75)'; g.fillRect(-12, -6.5, 25, 1.4); } });
  } else if (b === 'tutu') {
    P.push({ path: (g) => bodyPath(g, -8, -3.5), fill: '#e0458f', detail: (g) => { g.fillStyle = 'rgba(255,255,255,0.3)'; g.fillRect(-12, -7.5, 25, 1); } });
  }

  if (b === 'trackpants') P.push({ path: (g) => bodyPath(g, -8, 5, { botCurve: 1.5 }), fill: (g) => hGrad(g, TRACK), detail: (g) => { g.fillStyle = shade(TRACK, 0.75); g.fillRect(-12, -8, 25, 2.5); } });
  if (top === 'track') { // Trainingsjacke: weißer Reißverschluss, Kragen, Schulterstreifen
    P.push({
      path: (g) => bodyPath(g, -37, 2, { botCurve: 1 }),
      fill: (g) => hGrad(g, TRACK),
      detail: (g) => {
        g.fillStyle = '#ffffff'; g.fillRect(5.2, -35, 1.3, 37);
        g.fillStyle = '#ffffff'; g.beginPath(); g.moveTo(-10, -37.5); g.quadraticCurveTo(0, -40, 12, -37); g.lineTo(11, -34.5); g.quadraticCurveTo(0, -37, -9.5, -35); g.closePath(); g.fill();
        g.strokeStyle = '#ffffff'; g.lineWidth = 0.9; for (const off of [0, 1.5, 3]) { g.beginPath(); g.moveTo(-11 + off * 0.3, -33 + off); g.lineTo(-11 + off * 0.3, -6); g.stroke(); }
        g.fillStyle = shade(TRACK, 0.78); g.fillRect(-12, -1, 25, 3);
        g.fillStyle = '#ffffff'; g.beginPath(); g.moveTo(-1, -26); g.lineTo(1, -30); g.lineTo(3, -26); g.closePath(); g.fill();
      },
    });
  }
  if (top === 'carhartt') {
    P.push({
      path: (g) => bodyPath(g, -37, 3, { botCurve: 1 }),
      fill: (g) => hGrad(g, topCol),
      detail: (g) => {
        g.strokeStyle = 'rgba(0,0,0,0.08)'; g.lineWidth = 0.5; for (let y = -36; y < 3; y += 1.6) { g.beginPath(); g.moveTo(-12, y); g.lineTo(13, y + 0.6); g.stroke(); } // Canvas-Struktur
        g.fillStyle = '#c9c4b8'; g.fillRect(5.6, -33, 1, 35); // Reißverschluss
        g.fillStyle = shade(topCol, 0.85); g.fillRect(-1, -24, 6, 6); g.strokeStyle = 'rgba(232,184,90,0.7)'; g.lineWidth = 0.5; g.strokeRect(-1, -24, 6, 6); // Brusttasche
        g.fillStyle = '#16161a'; g.fillRect(0.4, -22.6, 3.2, 2.4);
        g.fillStyle = shade(topCol, 0.78); g.fillRect(-12, 0, 25, 3); // Bund
        g.fillStyle = '#4a3220'; g.beginPath(); g.moveTo(-11, -37.5); g.quadraticCurveTo(0, -40, 12, -37); g.lineTo(9, -32); g.lineTo(5.5, -35); g.lineTo(2, -32); g.lineTo(-10, -33); g.closePath(); g.fill(); // Cordkragen
        g.strokeStyle = 'rgba(255,255,255,0.12)'; g.lineWidth = 0.5; for (let x = -10; x < 11; x += 1.4) { g.beginPath(); g.moveTo(x, -38.5); g.lineTo(x + 0.3, -33.5); g.stroke(); }
      },
    });
  }
  if (extras.has('sash')) {
    P.push({
      path: (g) => capPath(g, [-9.5, -33], [10, -6], 6.2, 6.2),
      fill: (g) => { const gr = g.createLinearGradient(-9, -33, 10, -6); gr.addColorStop(0, '#fff1a6'); gr.addColorStop(0.5, '#ffd23f'); gr.addColorStop(1, '#d9a400'); return gr; },
      detail: (g) => {
        g.save(); g.translate(0.5, -19.5); g.rotate(0.94);
        g.fillStyle = '#b3236b'; g.font = '900 5.2px sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('34', 0, 0.3);
        g.restore();
        g.strokeStyle = 'rgba(160,110,0,0.5)'; g.lineWidth = 0.5;
        g.beginPath(); g.moveTo(-11, -31); g.lineTo(8, -4); g.stroke();
      },
    });
  }
  return P;
}

function apronPiece() {
  return {
    path: (g) => { g.moveTo(-1, -28); g.lineTo(10.5, -28); g.lineTo(12, -12); g.quadraticCurveTo(15, 0, 15.5, 14); g.lineTo(-3.5, 14); g.quadraticCurveTo(-4, 0, -3, -12); g.closePath(); },
    fill: (g) => { const gr = g.createLinearGradient(-4, 0, 16, 0); gr.addColorStop(0, '#3f7a34'); gr.addColorStop(1, '#5fa34f'); return gr; },
    detail: (g) => {
      g.strokeStyle = '#2e5d27'; g.lineWidth = 0.6; g.setLineDash([1.2, 1]);
      g.beginPath(); g.moveTo(-0.5, -26.5); g.lineTo(9.8, -26.5); g.stroke(); g.strokeRect(1.5, -4, 9, 7); g.setLineDash([]);
      g.fillStyle = '#e53935'; g.beginPath(); g.arc(6, -0.5, 2.2, 0, 7); g.fill();
      g.fillStyle = '#2e7d32'; g.fillRect(5.4, -3.4, 1.2, 1.4);
      g.strokeStyle = '#d9c9a3'; g.lineWidth = 1.4; g.beginPath(); g.moveTo(-3, -12); g.lineTo(-11, -11); g.stroke();
    },
  };
}

function drawTote(g, shoulder, hip, lean, t) {
  const sw = Math.sin(t * 9) * 1.5;
  const bx = hip[0] - 15 + sw, by = hip[1] - 6;
  g.strokeStyle = '#c9b48a'; g.lineWidth = 1.6; g.beginPath(); g.moveTo(shoulder[0] + 4, shoulder[1]); g.lineTo(bx + 5, by); g.stroke();
  drawGroup(g, [{
    path: (g) => { g.moveTo(bx, by); g.lineTo(bx + 13, by); g.lineTo(bx + 14, by + 15); g.lineTo(bx - 1, by + 15); g.closePath(); },
    fill: '#eadfc4',
    detail: (g) => { g.fillStyle = '#e8424f'; g.font = '900 7px sans-serif'; g.textAlign = 'center'; g.fillText('♥', bx + 6.5, by + 10); },
  }]);
}

function drawTutu(g, hip, lean, t, front) {
  g.save(); g.translate(hip[0], hip[1] - 4); g.rotate(lean);
  const layers = front ? [['rgba(255,182,214,0.92)', 15, 6], ['rgba(255,210,232,0.9)', 13, 4.5], ['rgba(255,236,246,0.85)', 11, 3]] : [['#e5689f', 17, 8]];
  g.lineJoin = 'round';
  for (const [col, r, h] of layers) {
    g.beginPath(); g.moveTo(-r, 0);
    const n = 9;
    for (let i = 0; i <= n; i++) {
      const x = -r + (2 * r * i) / n, wob = Math.sin(t * 9 + i * 1.7) * 0.6;
      g.quadraticCurveTo(x - r / n, h + 4 + wob, x, h + (i % 2 ? 1.5 : 3) + wob);
    }
    g.lineTo(r - 2, -1); g.quadraticCurveTo(0, -3, -r + 2, -1); g.closePath();
    g.fillStyle = col; g.fill();
    g.strokeStyle = 'rgba(160,40,100,0.55)'; g.lineWidth = 0.7; g.stroke();
  }
  if (front) { g.fillStyle = 'rgba(255,255,255,0.95)'; for (let i = 0; i < 6; i++) star(g, -11 + i * 4.4, 3 + (i % 2) * 2.5, 1.1); }
  g.restore();
}

// ---------------------------------------------------------------------------
// Strickschal
// ---------------------------------------------------------------------------
const SCARF = '#d99a2b', SCARF2 = '#b97a16';
function drawScarfTail(g, neck, t) {
  const pts = [[neck[0] - 1, neck[1] + 3]];
  for (let i = 1; i <= 5; i++) pts.push([neck[0] - 1 - i * 5.2, neck[1] + 3 + i * 1.6 + Math.sin(t * 13 - i * 0.9) * (0.6 + i * 0.55)]);
  const pieces = [];
  for (let i = 0; i < pts.length - 1; i++) pieces.push(cap(pts[i], pts[i + 1], 6.4 - i * 0.2, 6.2 - i * 0.2, SCARF, 0.9, (g) => {
    const a = pts[i], b = pts[i + 1];
    for (const tt of [0.3, 0.7]) lineAcross(g, lerpP(a, b, tt), a, b, 3.5, SCARF2, 0.8);
  }));
  drawGroup(g, pieces);
  const e = pts[pts.length - 1];
  g.strokeStyle = SCARF2; g.lineWidth = 0.9;
  for (let k = -2; k <= 2; k++) { g.beginPath(); g.moveTo(e[0], e[1] + k * 1.2); g.lineTo(e[0] - 3.2, e[1] + k * 1.5 + Math.sin(t * 15 + k) * 0.6); g.stroke(); }
}
function drawScarfWrap(g, neck, lean) {
  g.save(); g.translate(neck[0] + 0.5, neck[1] + 1.5); g.rotate(lean * 0.4);
  drawGroup(g, [{
    path: (g) => { g.moveTo(-9.5, -2); g.quadraticCurveTo(0, -5, 9.5, -2.5); g.quadraticCurveTo(11, 2.5, 8.5, 5); g.quadraticCurveTo(0, 7.5, -8.5, 5); g.quadraticCurveTo(-11, 1.5, -9.5, -2); },
    fill: (g) => { const gr = g.createLinearGradient(0, -4, 0, 6); gr.addColorStop(0, '#f0b54a'); gr.addColorStop(1, SCARF2); return gr; },
    detail: (g) => {
      g.strokeStyle = 'rgba(120,70,0,0.45)'; g.lineWidth = 0.7;
      for (let x = -8; x <= 8; x += 2.6) { g.beginPath(); g.moveTo(x, -2.5); g.lineTo(x + 1.1, 0.8); g.lineTo(x, 4.5); g.stroke(); }
    },
  }]);
  g.restore();
}

function drawHead(g, neck, lean, expr, faceKey, extras, t, opt = {}) {
  const { img, exact, name } = getFace(faceKey, expr);
  const h = 58, w = 40, U = 21; // virtuelle Kopfgröße für Accessoires, U = Augen→Kinn
  const m = faceMeta(name);
  g.save();
  g.translate(neck[0] + 1, neck[1] + 2);
  g.rotate(lean * 0.55 + (expr === 'shock' ? Math.sin(t * 40) * 0.08 : 0));
  // Hals
  g.fillStyle = SKIN; g.fillRect(-4, -6, 8, 9);
  if (opt.headScale) g.scale(opt.headScale, opt.headScale);
  if (opt.swell) { g.translate(0, -U * 0.5); g.scale(1 + opt.swell * 0.3, 1 + opt.swell * 0.22); g.translate(0, U * 0.5); }
  const W = img.width || 200, H = img.height || 240;
  const d = Math.hypot((m.chin[0] - m.eye[0]) * W, (m.chin[1] - m.eye[1]) * H) || H * 0.35;
  const k = U / d;
  if (expr === 'sad' && !exact) g.filter = 'grayscale(0.6) brightness(0.9)';
  g.drawImage(img, -m.chin[0] * W * k, -m.chin[1] * H * k + 2, W * k, H * k);
  g.filter = 'none';
  g.translate(0, -U + 4); // Ursprung ≈ Augenhöhe, wie bei den Platzhaltern
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
    const ly = -h * 0.06;
    for (const lx of [-w * 0.2, w * 0.2]) {
      g.beginPath(); g.ellipse(lx, ly, w * 0.19, h * 0.085, 0, 0, 7);
      g.strokeStyle = OL; g.lineWidth = 2.4; g.stroke();
      const gr = g.createLinearGradient(lx, ly - h * 0.08, lx, ly + h * 0.08);
      gr.addColorStop(0, '#5a3f78'); gr.addColorStop(1, '#120d1c');
      g.fillStyle = gr; g.fill();
      g.fillStyle = 'rgba(255,255,255,0.45)'; g.beginPath(); g.ellipse(lx - w * 0.07, ly - h * 0.03, w * 0.06, h * 0.02, -0.4, 0, 7); g.fill();
    }
    g.strokeStyle = OL; g.lineWidth = 1.6; g.beginPath(); g.moveTo(-w * 0.02, ly - 1); g.quadraticCurveTo(0, ly - 2.4, w * 0.02, ly - 1); g.stroke();
  }
  if (extras.has('afro')) drawAfro(g, w, h, t);
  if (extras.has('starshades')) drawStarShades(g, w, h, t);
  if (extras.has('stache')) drawStache(g, w, h);
  if (extras.has('boa')) drawBoa(g, w, h, t);
  if (extras.has('crown')) drawCrown(g, 0, -h / 2 + 2, w * 0.55);
  if (extras.has('safari')) drawSafari(g, 0, -h / 2 + 6, w);
  if (extras.has('chef')) drawChefHat(g, 0, -h / 2 + 5, w);
  if (extras.has('beanie')) drawBeanie(g, w, h);
  if (extras.has('cowboyhat')) drawCowboyHat(g, w, h);
  if (extras.has('tophat')) drawTopHat(g, w, h);
  if (extras.has('sweep')) drawSweepGear(g, w, h, t);
  g.restore();
}
// Schornsteinfeger-Zylinder (sitzt oberhalb der Stirn, Gesicht bleibt frei)
function drawTopHat(g, w, h) {
  const y = -h * 0.26;
  g.fillStyle = '#16161a'; g.beginPath(); g.ellipse(0, y, w * 0.62, h * 0.07, -0.06, 0, 7); g.fill();
  roundRect(g, -w * 0.34, y - h * 0.5, w * 0.68, h * 0.5, 3); g.fill();
  g.fillStyle = '#2c2c34'; g.fillRect(-w * 0.3, y - h * 0.48, w * 0.1, h * 0.44);
  g.fillStyle = '#8a1c1c'; g.fillRect(-w * 0.34, y - h * 0.12, w * 0.68, h * 0.07);
  g.strokeStyle = OL; g.lineWidth = 1.1; g.beginPath(); g.ellipse(0, y, w * 0.62, h * 0.07, -0.06, 0, 7); g.stroke();
}
// Seil mit Kugel-Kehrbesen über der Schulter + Glücksklee
function drawSweepGear(g, w, h, t) {
  g.strokeStyle = '#3a3a3a'; g.lineWidth = 2;
  g.beginPath(); g.moveTo(-w * 0.35, h * 0.62); g.quadraticCurveTo(w * 0.1, h * 0.5, w * 0.5, h * 0.72); g.stroke();
  g.beginPath(); g.arc(w * 0.42, h * 0.78, 5, 0, 7); g.stroke();
  const bx = w * 0.62, by = h * 0.95 + Math.sin(t * 6) * 1.5;
  g.strokeStyle = '#555'; g.lineWidth = 1.4; g.beginPath(); g.moveTo(w * 0.5, h * 0.72); g.lineTo(bx, by); g.stroke();
  g.strokeStyle = '#111'; g.lineWidth = 1.2; for (let i = 0; i < 16; i++) { const a = i / 16 * Math.PI * 2; g.beginPath(); g.moveTo(bx, by); g.lineTo(bx + Math.cos(a) * 7, by + Math.sin(a) * 7); g.stroke(); }
  g.fillStyle = '#222'; g.beginPath(); g.arc(bx, by, 2.4, 0, 7); g.fill();
  g.fillStyle = '#2e9d48'; for (const [dx, dy] of [[-1.6, -1.6], [1.6, -1.6], [-1.6, 1.6], [1.6, 1.6]]) { g.beginPath(); g.arc(-w * 0.22 + dx, h * 0.8 + dy, 1.9, 0, 7); g.fill(); }
}
// Strickmütze mit Umschlag und kleinem Etikett (Workwear-Style)
function drawBeanie(g, w, h) {
  const y = -h * 0.3;
  g.fillStyle = '#b8652a'; g.beginPath(); g.moveTo(-w * 0.46, y); g.quadraticCurveTo(-w * 0.5, -h * 0.78, 0, -h * 0.8); g.quadraticCurveTo(w * 0.5, -h * 0.78, w * 0.46, y); g.closePath(); g.fill();
  g.strokeStyle = 'rgba(0,0,0,0.18)'; g.lineWidth = 0.8; for (let x = -w * 0.38; x < w * 0.4; x += w * 0.09) { g.beginPath(); g.moveTo(x, y - 2); g.quadraticCurveTo(x * 0.9, -h * 0.6, x * 0.6, -h * 0.74); g.stroke(); }
  g.fillStyle = '#9c5221'; g.beginPath(); g.moveTo(-w * 0.5, y + h * 0.02); g.lineTo(w * 0.5, y + h * 0.02); g.lineTo(w * 0.47, y - h * 0.14); g.lineTo(-w * 0.47, y - h * 0.14); g.closePath(); g.fill();
  g.strokeStyle = 'rgba(0,0,0,0.2)'; for (let x = -w * 0.46; x < w * 0.47; x += w * 0.06) { g.beginPath(); g.moveTo(x, y + h * 0.01); g.lineTo(x, y - h * 0.13); g.stroke(); }
  g.fillStyle = '#16161a'; g.fillRect(-w * 0.07, y - h * 0.115, w * 0.14, h * 0.09);
  g.strokeStyle = OL; g.lineWidth = 1.2; g.beginPath(); g.moveTo(-w * 0.5, y + h * 0.02); g.lineTo(w * 0.5, y + h * 0.02); g.stroke();
}

// Verkleidungs-Accessoires (Ursprung = Augenhöhe)
function drawAfro(g, w, h, t) {
  const cols = ['#ff4fd8', '#ffd23f', '#3ee6b4', '#7cc6ff', '#ff7b39'];
  for (let i = 0; i < 16; i++) {
    const a = Math.PI + (i / 15) * Math.PI, r = w * (0.62 + (i % 3) * 0.06);
    g.fillStyle = cols[i % 5]; g.beginPath(); g.arc(Math.cos(a) * r * 1.05, -h * 0.18 + Math.sin(a) * r * 0.95, w * 0.22, 0, 7); g.fill();
  }
  for (let i = 0; i < 7; i++) { g.fillStyle = cols[(i + 2) % 5]; g.beginPath(); g.arc(-w * 0.45 + i * w * 0.15, -h * 0.62, w * 0.2, 0, 7); g.fill(); }
}
function drawStarShades(g, w, h, t) {
  const ly = -h * 0.06;
  for (const lx of [-w * 0.24, w * 0.24]) {
    g.fillStyle = '#ff2d95'; g.strokeStyle = OL; g.lineWidth = 1.6;
    g.beginPath(); for (let i = 0; i < 10; i++) { const a = -Math.PI / 2 + i * Math.PI / 5, r = i % 2 ? w * 0.11 : w * 0.25; g.lineTo(lx + Math.cos(a) * r, ly + Math.sin(a) * r); } g.closePath(); g.fill(); g.stroke();
    g.fillStyle = 'rgba(255,255,255,0.6)'; g.beginPath(); g.arc(lx - w * 0.05, ly - h * 0.03, w * 0.04, 0, 7); g.fill();
  }
  g.strokeStyle = '#ff2d95'; g.lineWidth = 2; g.beginPath(); g.moveTo(-w * 0.04, ly); g.lineTo(w * 0.04, ly); g.stroke();
}
// Verliebt: Herzaugen + aufsteigende Herzchen
function drawHeartEyes(g, w, h, t) {
  const heart = (x, y, s, c) => { g.fillStyle = c; g.beginPath(); g.moveTo(x, y + s * 0.35); g.bezierCurveTo(x - s, y - s * 0.4, x - s * 0.45, y - s * 1.05, x, y - s * 0.45); g.bezierCurveTo(x + s * 0.45, y - s * 1.05, x + s, y - s * 0.4, x, y + s * 0.35); g.fill(); };
  const pulse = 1 + Math.sin(t * 10) * 0.12;
  heart(-w * 0.2, -h * 0.02, w * 0.17 * pulse, '#e91e63'); heart(w * 0.2, -h * 0.02, w * 0.17 * pulse, '#e91e63');
  for (let i = 0; i < 3; i++) { const k = (t * 0.8 + i / 3) % 1; g.globalAlpha = 1 - k; heart(w * (0.45 + i * 0.08) * (i % 2 ? -1 : 1), -h * (0.45 + k * 0.6), w * 0.1, '#ff4f8a'); }
  g.globalAlpha = 1;
}
function drawCowboyHat(g, w, h) {
  const y = -h * 0.42;
  g.fillStyle = '#8d5a33'; g.beginPath(); g.ellipse(0, y, w * 0.85, h * 0.09, -0.08, 0, 7); g.fill();
  g.beginPath(); g.moveTo(-w * 0.42, y); g.quadraticCurveTo(-w * 0.45, y - h * 0.42, 0, y - h * 0.36); g.quadraticCurveTo(w * 0.45, y - h * 0.42, w * 0.42, y); g.fill();
  g.fillStyle = '#5d3a1f'; g.fillRect(-w * 0.42, y - h * 0.1, w * 0.84, h * 0.07);
  g.strokeStyle = OL; g.lineWidth = 1.2; g.beginPath(); g.ellipse(0, y, w * 0.85, h * 0.09, -0.08, 0, 7); g.stroke();
}
function drawStache(g, w, h) {
  g.fillStyle = '#2a1a10';
  g.beginPath(); g.moveTo(0, h * 0.2); g.quadraticCurveTo(-w * 0.18, h * 0.12, -w * 0.32, h * 0.24); g.quadraticCurveTo(-w * 0.16, h * 0.28, 0, h * 0.23);
  g.quadraticCurveTo(w * 0.16, h * 0.28, w * 0.32, h * 0.24); g.quadraticCurveTo(w * 0.18, h * 0.12, 0, h * 0.2); g.fill();
}
function drawBoa(g, w, h, t) {
  for (let i = 0; i < 14; i++) {
    const x = -w * 0.7 + i * w * 0.1, y = h * 0.62 + Math.sin(i * 1.3 + t * 3) * 3;
    g.fillStyle = i % 2 ? '#ff6fd8' : '#ff9ce6'; g.beginPath(); g.arc(x, y, w * 0.1, 0, 7); g.fill();
  }
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

function outlinedPath(g, path, fill) {
  g.lineJoin = 'round'; path(); g.strokeStyle = OL; g.lineWidth = OLW * 2; g.stroke(); path(); g.fillStyle = fill; g.fill();
}
function drawSafari(g, x, y, w) {
  outlinedPath(g, () => { g.beginPath(); g.ellipse(x, y + 2, w * 0.72, 4, 0, 0, Math.PI * 2); }, '#b39b6b');
  outlinedPath(g, () => { g.beginPath(); g.moveTo(x - w * 0.38, y + 2); g.quadraticCurveTo(x - w * 0.36, y - 13, x, y - 14); g.quadraticCurveTo(x + w * 0.36, y - 13, x + w * 0.38, y + 2); g.closePath(); }, (() => { const gr = g.createLinearGradient(x, y - 14, x, y + 2); gr.addColorStop(0, '#e0cfa2'); gr.addColorStop(1, '#c2aa78'); return gr; })());
  g.fillStyle = '#5d4037'; g.fillRect(x - w * 0.37, y - 3, w * 0.74, 3);
}
function drawChefHat(g, x, y, w) {
  outlinedPath(g, () => { g.beginPath(); g.rect(x - w * 0.3, y - 8, w * 0.6, 9); }, '#f7f7f7');
  outlinedPath(g, () => { g.beginPath(); g.arc(x - w * 0.22, y - 14, 7, 0, Math.PI * 2); g.arc(x + w * 0.22, y - 14, 7, 0, Math.PI * 2); g.arc(x, y - 19, 8.5, 0, Math.PI * 2); g.rect(x - w * 0.3, y - 14, w * 0.6, 8); }, '#ffffff');
  g.strokeStyle = 'rgba(0,0,0,0.12)'; g.lineWidth = 0.7;
  for (const dx of [-0.15, 0, 0.15]) { g.beginPath(); g.moveTo(x + w * dx, y - 1); g.lineTo(x + w * dx, y - 8); g.stroke(); }
}

function drawCrown(g, x, y, w) {
  g.save();
  const path = () => {
    g.beginPath();
    g.moveTo(x - w / 2, y + 1); g.lineTo(x - w / 2 - 1, y - 11); g.lineTo(x - w / 4, y - 4.5); g.lineTo(x, y - 15);
    g.lineTo(x + w / 4, y - 4.5); g.lineTo(x + w / 2 + 1, y - 11); g.lineTo(x + w / 2, y + 1); g.closePath();
  };
  g.lineJoin = 'round'; path(); g.strokeStyle = OL; g.lineWidth = OLW * 2; g.stroke();
  const gr = g.createLinearGradient(x, y - 15, x, y + 1);
  gr.addColorStop(0, '#fff3a0'); gr.addColorStop(0.5, '#ffd23f'); gr.addColorStop(1, '#c98f00');
  path(); g.fillStyle = gr; g.fill();
  g.fillStyle = '#c98f00'; g.fillRect(x - w / 2, y - 2, w, 3);
  for (const [jx, col, r] of [[0, '#ff4fa3', 2.1], [-w / 3, '#3ee6b4', 1.5], [w / 3, '#7cc6ff', 1.5]]) {
    g.fillStyle = col; g.beginPath(); g.arc(x + jx, y - 0.5, r, 0, 7); g.fill();
    g.fillStyle = 'rgba(255,255,255,0.8)'; g.beginPath(); g.arc(x + jx - r * 0.35, y - 0.5 - r * 0.35, r * 0.35, 0, 7); g.fill();
  }
  for (const [px, py] of [[x, y - 15], [x - w / 2 - 1, y - 11], [x + w / 2 + 1, y - 11]]) { g.fillStyle = '#fff'; g.beginPath(); g.arc(px, py, 1.4, 0, 7); g.fill(); }
  g.restore();
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
// Fips-Outfit je Level (z. B. winzige Winterstiefel in New York)
const CAT_STYLE = { boots: false, kitten: false };
export function setCatStyle(o = {}) { CAT_STYLE.boots = !!o.boots; CAT_STYLE.kitten = !!o.kitten; } // kitten: Baby-Fips (klein, großer Kopf)
const catBoot = (g, x, y) => { g.fillStyle = '#c62828'; roundRect(g, x - 3.2, y - 3.5, 7.5, 5, 2); g.fill(); g.fillStyle = '#fafafa'; g.fillRect(x - 3.4, y - 5.2, 6.4, 2.2); };
export function drawCat(g, x, footY, { phase = 0, scale = 1, pose = 'run', flip = false, t = 0, coat = null } = {}) {
  const boots = CAT_STYLE.boots && !coat;
  const { img } = getFace('fips', 'normal');
  const hasPhoto = !coat && img && !(img instanceof HTMLCanvasElement); // fremde Katzen (coat) bekommen einen gezeichneten Kopf
  if (CAT_STYLE.kitten && !coat) scale *= 0.62;
  g.save();
  g.translate(x, footY); g.scale(flip ? -scale : scale, scale);
  const [orange, dark, light] = coat || ['#e8843a', '#b8561c', '#f7c08a'];
  if (pose === 'sit') {
    g.fillStyle = orange;
    g.beginPath(); g.ellipse(0, -16, 13, 17, 0, 0, 7); g.fill();
    g.strokeStyle = orange; g.lineWidth = 5; g.lineCap = 'round';
    g.beginPath(); g.moveTo(-10, -4); g.quadraticCurveTo(-28, -2, -24, -22 + Math.sin(t * 3) * 3); g.stroke();
    g.strokeStyle = dark; g.lineWidth = 2.5;
    for (const yy of [-24, -17, -10]) { g.beginPath(); g.moveTo(-11, yy); g.quadraticCurveTo(-4, yy + 2, -2, yy - 1); g.stroke(); }
    drawCatHead(g, 2, -36, hasPhoto ? img : null, orange, dark, light, true);
    if (boots) { catBoot(g, -3, 1); catBoot(g, 7, 1); }
  } else {
    const b = Math.sin(phase * 2) * 2;
    const legs = [[10, 0], [6, Math.PI], [-10, Math.PI * 0.5], [-14, Math.PI * 1.5]];
    g.strokeStyle = dark; g.lineWidth = 4.5; g.lineCap = 'round';
    for (const [lx, off] of legs) {
      const a = Math.sin(phase * 2 + off) * 0.7;
      g.beginPath(); g.moveTo(lx, -14 + b); g.lineTo(lx + Math.sin(a) * 12, -14 + b + Math.cos(a) * 12); g.stroke();
      if (boots) { catBoot(g, lx + Math.sin(a) * 12, -14 + b + Math.cos(a) * 12 + 1.5); g.strokeStyle = dark; g.lineWidth = 4.5; }
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
    g.save(); g.translate(x, y + 8); if (CAT_STYLE.kitten) { g.translate(0, -3); g.scale(1.35, 1.35); }
    drawFaceOn(g, 'fips', 'normal', 0, 0, 12);
    g.restore();
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
// Twerken – Gleichgewicht verlieren – rückwärts auf den Hintern – liegen mit Sternchen – aufrappeln.
// lt = Zeit seit Beginn der Nummer (Sekunden), Zyklus 6 s (für Gäste am Rand wiederholbar)
export function drawTwerkFall(g, x, footY, lt, o = {}) {
  const T = lt % 6, sc = o.scale || 1, base = { faceKey: o.faceKey, color: o.color, acc: o.acc, scale: sc };
  if (T < 2.2) { drawPerson(g, x, footY, { ...base, t: lt, twerk: true }); return 'twerk'; }
  if (T < 2.75) { // wackelt, rudert mit den Armen, kippt nach hinten
    const k = (T - 2.2) / 0.55, rot = -k * k * 1.45, wob = Math.sin(T * 40) * 0.08 * (1 - k);
    g.save(); g.translate(x, footY); g.rotate(rot + wob); g.translate(-x, -footY);
    drawPerson(g, x, footY, { ...base, t: lt * 3, wave: true, expr: 'shock' }); g.restore();
    return 'tip';
  }
  const lying = T < 4.9, k = lying ? 1 : 1 - (T - 4.9) / 0.6;
  g.save(); g.translate(x, footY); g.rotate(-1.45 * Math.max(0, k)); g.translate(-x, -footY);
  drawPerson(g, x, footY - (T < 2.95 ? Math.sin((T - 2.75) / 0.2 * Math.PI) * 6 : 0), { ...base, t: lt, wave: !lying, expr: lying ? 'sad' : 'happy' });
  g.restore();
  if (lying) { // Sternchen kreisen über dem Kopf
    const hx = x - 70 * sc, hy = footY - 18 * sc;
    for (let i = 0; i < 3; i++) { const a = T * 5 + i * 2.1; emoji(g, '⭐', hx + Math.cos(a) * 16 * sc, hy - 18 * sc + Math.sin(a) * 6 * sc, 12 * sc); }
  }
  return lying ? (T < 3.1 ? 'impact' : 'lie') : 'up';
}

// Kinder in Kindheits-Leveln: kleiner Körper, relativ großer Kopf

// ---------------------------------------------------------------------------
// Karnevalskostüme für Gäste (Tiere, Clowns, Gemüse) – Gesicht bleibt immer frei
// ---------------------------------------------------------------------------
const COSTUME_OF = {};
let GUEST_BOOTS = false; // Line-Dance: alle Gäste in Cowboystiefeln
export function setGuestBoots(on) { GUEST_BOOTS = !!on; }
function bootFoot(g, x, y, w = 13) { // Cowboystiefel: Schaft über den Knöchel, Absatz, Spitze, Ziernaht
  g.fillStyle = '#8b5a2b'; roundRect(g, x + 1, y - 9, 8, 11, 2); g.fill();
  g.fillStyle = '#7a4a22'; g.beginPath(); g.moveTo(x, y - 1); g.lineTo(x + w, y - 1); g.quadraticCurveTo(x + w + 3, y + 2, x + w - 1, y + 3); g.lineTo(x, y + 3); g.fill();
  g.fillStyle = '#3e2410'; g.fillRect(x, y + 1, 4, 3);
  g.strokeStyle = '#e0b060'; g.lineWidth = 0.7; g.beginPath(); g.moveTo(x + 2, y - 7); g.quadraticCurveTo(x + 5, y - 4, x + 8, y - 7); g.stroke();
}
export function setCostumes(map) { for (const k of Object.keys(COSTUME_OF)) delete COSTUME_OF[k]; Object.assign(COSTUME_OF, map || {}); }
export const GUEST_COSTUMES = {
  cow: { body: '#fafafa', legs: '#fafafa' },
  tiger: { body: '#f28c28', legs: '#f28c28' },
  frog: { body: '#5cb85c', legs: '#4a9d4a' },
  bee: { body: '#ffd23f', legs: '#2a2a2a' },
  unicorn: { body: '#f6f0ff', legs: '#d9c8ff' },
  clown: { body: '#ff4f6d', legs: '#3d7bd9' },
  carrot: { body: '#f57c00', legs: '#e06c00' },
  broccoli: { body: '#4caf50', legs: '#2e7d32' },
  banana: { body: '#ffe135', legs: '#f2cf1d' },
  flamingo: { body: '#ff8fb1', legs: '#ff8fb1' },
};
// Muster auf dem Rumpf (Rumpf-Rechteck -13,-74 … 13,-36)
function costumeBody(g, k, t) {
  g.save(); g.beginPath(); roundRect(g, -13, -74, 26, 38, 8); g.clip();
  if (k === 'cow') { g.fillStyle = '#1d1d1d'; for (const [x, y, r] of [[-7, -66, 5], [6, -58, 6], [-4, -45, 4], [9, -70, 3]]) { g.beginPath(); g.ellipse(x, y, r * 1.2, r, 0.4, 0, 7); g.fill(); } }
  if (k === 'tiger') { g.strokeStyle = '#1d1d1d'; g.lineWidth = 2.2; for (let y = -70; y < -38; y += 7) { g.beginPath(); g.moveTo(-13, y); g.quadraticCurveTo(-7, y + 3, -3, y + 1); g.moveTo(13, y + 2); g.quadraticCurveTo(7, y + 5, 3, y + 3); g.stroke(); } }
  if (k === 'frog') { g.fillStyle = '#c8e6a0'; g.beginPath(); g.ellipse(0, -52, 8, 11, 0, 0, 7); g.fill(); }
  if (k === 'bee') { g.fillStyle = '#1d1d1d'; for (let y = -66; y < -36; y += 10) g.fillRect(-13, y, 26, 5); }
  if (k === 'unicorn') { const rb = ['#ff6b6b', '#ffd23f', '#6bd66b', '#6bb5ff', '#b36bff']; rb.forEach((c, i) => { g.fillStyle = c; g.fillRect(-13, -50 + i * 3, 26, 3); }); }
  if (k === 'clown') { const dc = ['#ffd23f', '#3d7bd9', '#4caf50', '#fff']; for (let i = 0; i < 9; i++) { g.fillStyle = dc[i % 4]; g.beginPath(); g.arc(-9 + (i % 3) * 9, -68 + Math.floor(i / 3) * 11, 2.6, 0, 7); g.fill(); } g.fillStyle = '#fff'; for (let i = 0; i < 6; i++) { g.beginPath(); g.arc(-11 + i * 4.4, -73, 3.2, 0, 7); g.fill(); } }
  if (k === 'carrot') { g.strokeStyle = 'rgba(120,50,0,0.45)'; g.lineWidth = 1.2; for (let y = -68; y < -38; y += 6) { g.beginPath(); g.moveTo(-8 + (y % 4), y); g.lineTo(-1 + (y % 4), y + 1); g.stroke(); } }
  if (k === 'broccoli') { g.fillStyle = '#7cc576'; for (let i = 0; i < 6; i++) { g.beginPath(); g.arc(-8 + (i % 3) * 8, -66 + Math.floor(i / 3) * 9, 4, 0, 7); g.fill(); } }
  if (k === 'banana') { g.strokeStyle = 'rgba(140,110,0,0.4)'; g.lineWidth = 1.2; for (const x of [-6, 0, 6]) { g.beginPath(); g.moveTo(x, -74); g.quadraticCurveTo(x + 3, -55, x, -36); g.stroke(); } g.fillStyle = '#7a5a1a'; g.beginPath(); g.arc(4, -48, 1.3, 0, 7); g.arc(-5, -62, 1, 0, 7); g.fill(); }
  if (k === 'flamingo') { g.fillStyle = '#ffb3c9'; for (let i = 0; i < 5; i++) { g.beginPath(); g.ellipse(-8 + i * 4, -50 + (i % 2) * 4, 4, 6, 0.5, 0, 7); g.fill(); } }
  g.restore();
  if (k === 'bee') { g.fillStyle = 'rgba(220,240,255,0.75)'; for (const s of [-1, 1]) { g.beginPath(); g.ellipse(s * 15, -66 + Math.sin(t * 30) * 1.5, 8, 5, s * 0.6, 0, 7); g.fill(); } }
  if (k === 'tiger' || k === 'cow') { g.strokeStyle = k === 'tiger' ? '#f28c28' : '#fafafa'; g.lineWidth = 3; g.beginPath(); g.moveTo(-12, -40); g.quadraticCurveTo(-24, -40 + Math.sin(t * 5) * 4, -22, -54); g.stroke(); g.fillStyle = k === 'tiger' ? '#1d1d1d' : '#1d1d1d'; g.beginPath(); g.arc(-22, -55, 2.4, 0, 7); g.fill(); }
}
// Kopfschmuck: nur oberhalb/seitlich des Gesichts (Ohren, Fühler, Blätter …); Koordinaten wie die acc-Extras (w=40,h=58)
function costumeHead(g, k, t, back = false) {
  const w = 40, h = 58, top = -h * 0.36;
  if (k === 'cow') { g.fillStyle = '#f2e3c6'; for (const s of [-1, 1]) { g.beginPath(); g.moveTo(s * 8, top + 2); g.quadraticCurveTo(s * 13, top - 10, s * 9, top - 13); g.quadraticCurveTo(s * 10, top - 4, s * 4, top + 2); g.fill(); } g.fillStyle = '#fafafa'; for (const s of [-1, 1]) { g.beginPath(); g.ellipse(s * 21, top + 8, 7, 3.6, s * 0.4, 0, 7); g.fill(); g.fillStyle = '#ffb3c1'; g.beginPath(); g.ellipse(s * 21, top + 8, 4, 1.8, s * 0.4, 0, 7); g.fill(); g.fillStyle = '#fafafa'; } }
  if (k === 'tiger') for (const s of [-1, 1]) { g.fillStyle = '#f28c28'; g.beginPath(); g.arc(s * 13, top + 1, 7, 0, 7); g.fill(); g.fillStyle = '#1d1d1d'; g.beginPath(); g.arc(s * 13, top + 1, 3.4, 0, 7); g.fill(); }
  if (k === 'frog') for (const s of [-1, 1]) { g.fillStyle = '#5cb85c'; g.beginPath(); g.arc(s * 9, top - 3, 7.5, 0, 7); g.fill(); g.fillStyle = '#fff'; g.beginPath(); g.arc(s * 9, top - 4, 5, 0, 7); g.fill(); g.fillStyle = '#111'; g.beginPath(); g.arc(s * 9 + 1, top - 4, 2.4, 0, 7); g.fill(); }
  if (k === 'bee') for (const s of [-1, 1]) { g.strokeStyle = '#1d1d1d'; g.lineWidth = 1.6; g.beginPath(); g.moveTo(s * 5, top + 3); g.quadraticCurveTo(s * 8, top - 12, s * 13 + Math.sin(t * 6) * 1.5, top - 16); g.stroke(); g.fillStyle = '#1d1d1d'; g.beginPath(); g.arc(s * 13 + Math.sin(t * 6) * 1.5, top - 16, 2.6, 0, 7); g.fill(); }
  if (k === 'unicorn') { g.fillStyle = '#ffd23f'; g.beginPath(); g.moveTo(-4, top + 2); g.lineTo(0, top - 20); g.lineTo(4, top + 2); g.fill(); g.strokeStyle = '#e0a800'; g.lineWidth = 0.8; for (let i = 0; i < 4; i++) { g.beginPath(); g.moveTo(-3 + i * 0.6, top - i * 5); g.lineTo(3 - i * 0.6, top - 3 - i * 5); g.stroke(); } const rb = ['#ff6b6b', '#ffd23f', '#6bd66b', '#6bb5ff', '#b36bff']; rb.forEach((c, i) => { g.fillStyle = c; g.beginPath(); g.ellipse(14 + i * 1.2, top + 4 + i * 6, 4, 5, 0.5, 0, 7); g.fill(); }); for (const s of [-1, 1]) { g.fillStyle = '#f6f0ff'; g.beginPath(); g.moveTo(s * 10, top + 2); g.lineTo(s * 13, top - 8); g.lineTo(s * 15, top + 3); g.fill(); } }
  if (k === 'clown') { const cs = ['#ff4f6d', '#ffd23f', '#3d7bd9', '#4caf50', '#b36bff']; for (const s of [-1, 1]) for (let i = 0; i < 5; i++) { g.fillStyle = cs[i]; g.beginPath(); g.arc(s * (19 + (i % 2) * 4), top + 2 + i * 5, 5, 0, 7); g.fill(); } if (!back) { g.fillStyle = '#ff1f3d'; g.beginPath(); g.arc(0, h * 0.06, 4.2, 0, 7); g.fill(); g.fillStyle = 'rgba(255,255,255,0.7)'; g.beginPath(); g.arc(-1.3, h * 0.06 - 1.4, 1.2, 0, 7); g.fill(); } g.fillStyle = '#3d7bd9'; g.beginPath(); g.moveTo(-7, top + 1); g.lineTo(0, top - 18); g.lineTo(7, top + 1); g.fill(); g.fillStyle = '#ffd23f'; g.beginPath(); g.arc(0, top - 18, 3, 0, 7); g.fill(); }
  if (k === 'carrot') for (let i = -2; i <= 2; i++) { g.fillStyle = i % 2 ? '#2e7d32' : '#43a047'; g.save(); g.translate(i * 3, top + 1); g.rotate(i * 0.3 + Math.sin(t * 4 + i) * 0.08); g.beginPath(); g.ellipse(0, -9, 3, 10, 0, 0, 7); g.fill(); g.restore(); }
  if (k === 'broccoli') { const cs = ['#2e7d32', '#388e3c', '#43a047']; for (let i = 0; i < 7; i++) { g.fillStyle = cs[i % 3]; g.beginPath(); g.arc(-15 + i * 5, top - 3 - Math.sin(i / 6 * Math.PI) * 9, 6.5, 0, 7); g.fill(); } }
  if (k === 'banana') { g.fillStyle = '#ffe135'; g.beginPath(); g.moveTo(-6, top + 2); g.quadraticCurveTo(0, top - 8, 6, top + 2); g.fill(); g.fillStyle = '#6d4c1a'; g.fillRect(-2, top - 14, 4, 9); }
  if (k === 'flamingo') { g.strokeStyle = '#ff8fb1'; g.lineWidth = 4; g.beginPath(); g.moveTo(6, top + 2); g.bezierCurveTo(18, top - 10, -6, top - 18, 6, top - 30); g.stroke(); g.fillStyle = '#ff8fb1'; g.beginPath(); g.arc(7, top - 31, 5, 0, 7); g.fill(); g.fillStyle = '#fff3e0'; g.beginPath(); g.moveTo(10, top - 32); g.lineTo(17, top - 29); g.lineTo(11, top - 28); g.fill(); g.fillStyle = '#111'; g.beginPath(); g.moveTo(15, top - 30); g.lineTo(18, top - 27); g.lineTo(14, top - 27.5); g.fill(); g.beginPath(); g.arc(7, top - 32.5, 1, 0, 7); g.fill(); }
}
/** Gast von hinten (Rücken zur Kamera), z.B. beim Pinkeln an der Wand. */
export function drawPersonBack(g, x, footY, { scale = 1, color = '#5b7bd5', costume = null, hair = '#5a3d2b', t = 0, pee = false } = {}) {
  const C = GUEST_COSTUMES[costume];
  const body = C?.body || color, legs = C?.legs || '#333a4a';
  g.save(); g.translate(x, footY); g.scale(scale * 1.16, scale);
  seg(g, -6, -40, -7, -4, 9, legs); seg(g, 6, -40, 7, -4, 9, legs);
  g.fillStyle = '#222'; roundRect(g, -14, -6, 12, 6, 3); g.fill(); roundRect(g, 2, -6, 12, 6, 3); g.fill();
  g.fillStyle = body; roundRect(g, -13, -74, 26, 38, 8); g.fill();
  if (costume) costumeBody(g, costume, t);
  seg(g, -12, -68, -6, -46, 8, body); seg(g, 12, -68, 6, -46, 8, body); // Arme nach vorn
  g.scale(1 / 1.16, 1);
  g.fillStyle = hair; g.beginPath(); g.ellipse(0, -90, 13, 15, 0, 0, 7); g.fill();
  g.fillStyle = 'rgba(0,0,0,0.12)'; g.beginPath(); g.ellipse(0, -84, 10, 8, 0, 0, 7); g.fill();
  g.fillStyle = SKIN; for (const s of [-1, 1]) { g.beginPath(); g.ellipse(s * 12.5, -89, 2.6, 4, 0, 0, 7); g.fill(); }
  if (costume) { g.save(); g.translate(0, -88); costumeHead(g, costume, t, true); g.restore(); }
  g.restore();
  if (pee) { // gelber Bogen vor ihm an die Wand + Pfütze
    g.save(); g.translate(x, footY); g.scale(scale, scale);
    g.strokeStyle = 'rgba(255,214,0,0.9)'; g.lineWidth = 2.2; g.setLineDash([5, 3]); g.lineDashOffset = -t * 40;
    g.beginPath(); g.moveTo(2, -42); g.quadraticCurveTo(16, -52, 22, -18); g.stroke(); g.setLineDash([]);
    g.fillStyle = 'rgba(255,214,0,0.45)'; g.beginPath(); g.ellipse(20, -1, 10 + Math.min(8, t * 2), 2.4, 0, 0, 7); g.fill();
    g.restore();
  }
}

const KID_FACES = new Set();
export function setKidFaces(list) { KID_FACES.clear(); for (const f of list || []) KID_FACES.add(f); }
export function drawPerson(g, x, footY, { faceKey, t = 0, color = '#5b7bd5', wave = true, oma = false, scale = 1, expr = 'happy', run = false, pet = false, emojiHead = null, acc = null, twerk = false, suit = null, costume = null }) {
  const fixed = assets.config.guestColors?.[faceKey]; if (fixed) color = fixed; // Lieblingsfarbe einer Person
  costume ||= COSTUME_OF[faceKey] || null; const COS = GUEST_COSTUMES[costume]; if (COS) color = COS.body;
  const kid = !pet && KID_FACES.has(faceKey); if (kid) scale *= 0.76;
  const track = suit === 'track'; if (track) color = '#1f7a3a';
  const tstripe = (x1, y1, x2, y2, side) => { if (!track) return; for (const off of [1.6, 3, 4.4]) { const dx = x2 - x1, dy = y2 - y1, l = Math.hypot(dx, dy) || 1, nx = -dy / l * off * side, ny = dx / l * off * side; g.strokeStyle = '#ffffff'; g.lineWidth = 0.9; g.lineCap = 'butt'; g.beginPath(); g.moveTo(x1 + nx * 0.6, y1 + ny * 0.6); g.lineTo(x2 + nx * 0.6, y2 + ny * 0.6); g.stroke(); } g.lineCap = 'round'; };
  g.save(); g.translate(x, footY); g.scale(scale, scale);
  if (twerk) { // Twerk: tiefe Hocke, Hände auf den Knien, Oberkörper still, Hüfte poppt schnell vor und zurück
    const pop = Math.sin(t * 17), bounce = Math.abs(pop) * 3;
    const H = [-4 - pop * 3, -34 - bounce], S = [12, -62];
    const legC = '#333a4a';
    for (const [kx, fx, a] of [[10, 5, 0.85], [15, 11, 1]]) {
      seg(g, H[0], H[1], kx, -20, 9, legC); seg(g, kx, -20, fx, -3, 8, legC);
      g.fillStyle = '#222'; roundRect(g, fx - 5, -6, 13, 6, 3); g.fill();
    }
    g.fillStyle = legC; g.beginPath(); g.ellipse(H[0] - 6 - pop * 2, H[1] - 1, 11 + Math.abs(pop) * 1.5, 9 - Math.abs(pop), -0.2, 0, 7); g.fill();
    seg(g, H[0], H[1] - 4, S[0], S[1], 22, color);
    seg(g, S[0], S[1] + 2, 12, -42, 8, color); seg(g, 12, -42, 13, -24, 7, SKIN);
    g.fillStyle = SKIN; g.beginPath(); g.arc(13, -23, 5, 0, 7); g.fill();
    if (faceKey) drawFaceOn(g, faceKey, expr, S[0] + 3, S[1] + 2, 21); else if (emojiHead) emoji(g, emojiHead, S[0] + 3, S[1] - 16, 40);
    g.strokeStyle = 'rgba(255,255,255,0.7)'; g.lineWidth = 1.5;
    for (let i = 0; i < 3; i++) { const k = (t * 3 + i / 3) % 1; g.globalAlpha = 1 - k; g.beginPath(); g.arc(H[0] - 8, H[1], 14 + k * 14, Math.PI * 0.6, Math.PI * 1.4); g.stroke(); }
    g.globalAlpha = 1;
    g.restore(); return;
  }
  if (pet) { // kleiner Hund: Körper + Fotokopf (Fellfarbe & Accessoire je Hund aus der Config)
    const ps = assets.config.petStyle?.[faceKey] || {};
    const hop = Math.abs(Math.sin(t * 8)) * 3;
    g.translate(0, -hop);
    g.fillStyle = ps.fur || '#8d6e63'; roundRect(g, -16, -26, 30, 16, 8); g.fill();
    if (ps.fur2) { g.strokeStyle = ps.fur2; g.lineWidth = 1; for (let i = -14; i < 12; i += 3) { g.beginPath(); g.moveTo(i, -12); g.lineTo(i + 1, -6 - Math.abs(Math.sin(t * 8 + i)) * 2); g.stroke(); } g.fillStyle = ps.fur; }
    for (const lx of [-12, -4, 4, 10]) { g.fillRect(lx, -12, 4, 12); }
    g.strokeStyle = ps.fur || '#8d6e63'; g.lineWidth = 4; g.lineCap = 'round'; g.beginPath(); g.moveTo(-15, -22); g.lineTo(-22, -32 + Math.sin(t * 14) * 4); g.stroke();
    drawFaceOn(g, faceKey, 'normal', 12, -14, 15);
    if (ps.acc === 'xmasglasses') { // rote Partybrille mit Weihnachtsmütze (wie auf dem Foto)
      g.save(); g.translate(13, -27);
      g.strokeStyle = '#d32f2f'; g.lineWidth = 2.2; for (const ex of [-5, 5]) { g.beginPath(); g.ellipse(ex, 4, 4.6, 3.6, 0, 0, 7); g.stroke(); } g.beginPath(); g.moveTo(-0.6, 4); g.lineTo(0.6, 4); g.stroke();
      g.fillStyle = '#d32f2f'; roundRect(g, -10, -6, 20, 7, 3); g.fill(); g.fillStyle = '#fff'; roundRect(g, -11, -1, 22, 3.5, 1.5); g.fill(); g.beginPath(); g.arc(9, -7, 2.4, 0, 7); g.fill();
      g.fillStyle = '#2e7d32'; g.beginPath(); g.ellipse(-5, -4, 2.4, 1.4, 0.5, 0, 7); g.fill(); g.fillStyle = '#d32f2f'; g.beginPath(); g.arc(-3, -4, 1.2, 0, 7); g.fill();
      g.restore();
    }
    g.restore(); return;
  }
  // Körper etwas breiter (wie Kimis Comic-Körper), Kopf dabei unverzerrt lassen
  const BW = 1.16;
  const face = (fx, fy) => {
    g.save(); g.translate(fx, 0); g.scale(1 / BW, 1); g.translate(-fx, 0);
    if (faceKey) drawFaceOn(g, faceKey, expr, fx, fy, kid ? 26 : 21); else if (emojiHead) emoji(g, emojiHead, fx, fy - 18, 40);
    if (COS) { g.save(); g.translate(fx, fy - 17); costumeHead(g, costume, t); g.restore(); }
    if (acc?.length) { g.save(); g.translate(fx, fy - 21 + 4); const set = new Set(acc); const w = 40, h = 58; if (set.has('afro')) drawAfro(g, w, h, t); if (set.has('starshades')) drawStarShades(g, w, h, t); if (set.has('stache')) drawStache(g, w, h); if (set.has('boa')) drawBoa(g, w, h, t); if (set.has('cowboyhat')) drawCowboyHat(g, w, h); if (set.has('hearteyes')) drawHeartEyes(g, w, h, t); if (set.has('sequins')) { for (let k = 0; k < 14; k++) { const tw = (Math.sin(t * 6 + k * 1.7) + 1) / 2; g.fillStyle = `rgba(255,255,255,${0.3 + tw * 0.7})`; const sx = ((k * 37) % 26) - 13, sy = 26 + ((k * 23) % 36); g.beginPath(); g.arc(sx, sy, 1 + tw * 1.4, 0, 7); g.fill(); } } if (set.has('choco')) { g.fillStyle = 'rgba(74,42,23,0.92)'; for (let k = 0; k < 6; k++) { g.beginPath(); g.arc(Math.sin(k * 2.3) * w * 0.25, h * 0.05 + Math.cos(k * 1.7) * h * 0.2, w * (0.12 + (k % 2) * 0.06), 0, 7); g.fill(); } } g.restore(); }
    g.restore();
  };
  g.scale(BW, 1);
  const legC = COS ? COS.legs : track ? '#1f7a3a' : oma ? '#6b5b4b' : '#333a4a';
  if (run) {
    const ph = t * 14, bob = Math.abs(Math.sin(ph)) * 3;
    g.translate(0, 3 - bob); g.rotate(0.12); // Füße auf den Boden
    for (const off of [Math.PI, 0]) {
      const a = Math.sin(ph + off) * 0.75;
      const k = pt(0, -40, a, 20), f = pt(k[0], k[1], a - 0.5 - Math.max(0, -Math.sin(ph + off + 0.9)) * 0.9, 20);
      seg(g, 0, -40, k[0], k[1], 9, legC); seg(g, k[0], k[1], f[0], f[1], 8, legC);
      tstripe(0, -40, k[0], k[1], -1); tstripe(k[0], k[1], f[0], f[1], -1);
      if (GUEST_BOOTS) bootFoot(g, f[0] - 5, f[1] - 3); else { g.fillStyle = track ? '#f4f4f4' : '#222'; roundRect(g, f[0] - 5, f[1] - 3, 13, 6, 3); g.fill(); }
    }
    g.fillStyle = color; roundRect(g, -13, -74, 26, 38, 8); g.fill();
    if (COS) costumeBody(g, costume, t);
    if (track) { g.fillStyle = '#ffffff'; g.fillRect(-0.6, -72, 1.4, 34); g.fillRect(-13, -40, 26, 2); g.fillRect(-7, -75, 14, 2.4); }
    for (const off of [0, Math.PI]) {
      const a = -Math.sin(ph + off) * 0.9, e = pt(0, -68, a, 15), h = pt(e[0], e[1], a + 1.4, track ? 11 : 13);
      seg(g, 0, -68, e[0], e[1], 8, color); tstripe(0, -68, e[0], e[1], 1);
      if (track) { const c2 = pt(e[0], e[1], a + 1.4, 9); seg(g, e[0], e[1], c2[0], c2[1], 7.5, color); tstripe(e[0], e[1], c2[0], c2[1], 1); seg(g, c2[0], c2[1], h[0] + (h[0] - c2[0]) * 0.4, h[1] + (h[1] - c2[1]) * 0.4, 7, SKIN); }
      else seg(g, e[0], e[1], h[0], h[1], 7, SKIN);
    }
    face(0, -74);
    g.restore();
    return;
  }
  seg(g, -5, -40, -6, -4, 9, legC); seg(g, 5, -40, 6, -4, 9, legC);
  tstripe(-5, -40, -6, -4, -1); tstripe(5, -40, 6, -4, 1);
  if (GUEST_BOOTS) { bootFoot(g, -13, -4, 12); bootFoot(g, 1, -4, 12); } else { g.fillStyle = '#222'; roundRect(g, -13, -6, 12, 6, 3); g.fill(); roundRect(g, 1, -6, 12, 6, 3); g.fill(); }
  g.fillStyle = oma ? '#8a5aa8' : color;
  if (oma) { g.beginPath(); g.moveTo(-14, -72); g.lineTo(14, -72); g.lineTo(18, -30); g.lineTo(-18, -30); g.closePath(); g.fill(); }
  else { roundRect(g, -13, -74, 26, 38, 8); g.fill(); }
  if (COS) costumeBody(g, costume, t);
  // Arme
  const w = wave ? Math.sin(t * 9) * 0.5 : 0;
  seg(g, -12, -68, -20, -46, 8, oma ? '#8a5aa8' : color);
  g.fillStyle = SKIN; g.beginPath(); g.arc(-20, -45, 5, 0, 7); g.fill();
  const hx = 12 + Math.sin(Math.PI * 0.8 + w) * 22, hy = -70 + Math.cos(Math.PI * 0.8 + w) * 22;
  seg(g, 12, -68, hx, hy, 8, oma ? '#8a5aa8' : color);
  g.fillStyle = SKIN; g.beginPath(); g.arc(hx, hy, 5, 0, 7); g.fill();
  face(0, -74);
  g.restore();
}

/** Zeichnet ein Gesicht so, dass das Kinn auf (x, y) sitzt und Augen–Kinn = unit ist. */
export function drawFaceOn(g, key, expr, x, y, unit) {
  const { img, name } = getFace(key, expr);
  const m = faceMeta(name, img);
  const W = img.width, H = img.height;
  const d = Math.hypot((m.chin[0] - m.eye[0]) * W, (m.chin[1] - m.eye[1]) * H) || H * 0.35;
  const k = unit / d;
  g.drawImage(img, x - m.chin[0] * W * k, y - m.chin[1] * H * k + unit * 0.12, W * k, H * k);
}

// ---------------------------------------------------------------------------
// Super-Christoph (Superheld; im Horror-Modus als Zombie-Superheld)
// ---------------------------------------------------------------------------
const zombieCache = new WeakMap();
function zombieFace(img) {
  if (zombieCache.has(img)) return zombieCache.get(img);
  const c = document.createElement('canvas'); c.width = img.width; c.height = img.height;
  const z = c.getContext('2d');
  z.drawImage(img, 0, 0);
  z.globalCompositeOperation = 'source-atop';
  z.fillStyle = 'rgba(90,170,70,0.5)'; z.fillRect(0, 0, c.width, c.height);
  z.fillStyle = 'rgba(40,20,40,0.25)';
  for (let i = 0; i < 6; i++) { z.beginPath(); z.arc(c.width * (0.25 + (i * 0.37) % 0.5), c.height * (0.35 + (i * 0.23) % 0.4), c.width * 0.05, 0, 7); z.fill(); }
  zombieCache.set(img, c);
  return c;
}

function heroHead(g, x, y, unit, zombie, faceKey) {
  if (faceKey && !zombie) { drawFaceOn(g, faceKey, 'happy', x, y, unit); return; }
  const { img, name } = getFace('him', 'hero');
  const m = faceMeta(name);
  const src = zombie ? zombieFace(img) : img;
  const W = img.width, H = img.height;
  const d = Math.hypot((m.chin[0] - m.eye[0]) * W, (m.chin[1] - m.eye[1]) * H) || H * 0.35;
  const k = unit / d;
  g.drawImage(src, x - m.chin[0] * W * k, y - m.chin[1] * H * k + unit * 0.12, W * k, H * k);
  if (zombie) {
    g.strokeStyle = '#3b2a1e'; g.lineWidth = 0.9;
    g.beginPath(); g.moveTo(x - 6, y - unit * 1.4); g.lineTo(x + 2, y - unit * 1.2);
    for (let i = 0; i < 4; i++) { g.moveTo(x - 5 + i * 2.2, y - unit * 1.45 + i * 0.5); g.lineTo(x - 4.4 + i * 2.2, y - unit * 1.2 + i * 0.5); }
    g.stroke();
  }
}

/**
 * pose: 'fly' (waagrecht, Faust voraus), 'land' (Superhelden-Landung), 'punch', 'hover'
 * (x, y) = Fußpunkt bzw. Körpermitte unten
 */
function absLines(g, x, y) { g.strokeStyle = 'rgba(150,80,50,0.55)'; g.lineWidth = 1.2; g.beginPath(); g.moveTo(x, y - 6); g.lineTo(x, y + 10); for (let i = 0; i < 3; i++) { g.moveTo(x - 6, y - 4 + i * 6); g.lineTo(x + 6, y - 4 + i * 6); } g.moveTo(x - 9, y - 12); g.quadraticCurveTo(x - 3, y - 8, x, y - 11); g.quadraticCurveTo(x + 3, y - 8, x + 9, y - 12); g.stroke(); }

export function drawHero(g, x, y, { pose = 'fly', t = 0, zombie = false, scale = 1, costume = null, faceKey = null } = {}) {
  const C = (!zombie && costume) || {};
  const skinSuit = C.skin ? SKIN : null;
  const suit = zombie ? '#5b6b52' : skinSuit || C.suit || '#1f4fd6', suit2 = zombie ? '#3e4a38' : (C.skin ? SKIN_DARK : C.suit2 || '#163a9e');
  const cape = zombie ? '#6e1f2a' : C.cape || '#d62839', trunk = zombie ? '#4a3a3a' : C.trunk || '#d62839', belt = zombie ? '#7a7a3a' : C.belt || '#ffd23f';
  const noCape = !!C.noCape || !!C.wings;
  g.save(); g.translate(x, y); g.scale(scale, scale);
  const headHook = (hx, hy) => {
    if (C.hat) emoji(g, C.hat, hx, hy - 40, 20);
    if (C.face) emoji(g, C.face, hx + 2, hy - 24, 15);
    C.draw?.(g, hx, hy - 34, t);
    C.drawTop?.(g, hx, hy - 42, t);
  };
  const heldHook = (fx, fy) => { if (C.held) emoji(g, C.held, fx + 4, fy - 4, 16); };
  const wings = (cx, cy) => { if (!C.wings) return; g.fillStyle = C.wingCol || 'rgba(255,255,255,0.92)'; for (const s of [-1, 1]) { g.beginPath(); g.moveTo(cx, cy); g.quadraticCurveTo(cx + s * 30, cy - 34 + Math.sin(t * 10) * 4, cx + s * 40, cy - 6); g.quadraticCurveTo(cx + s * 22, cy - 2, cx, cy + 10); g.fill(); g.strokeStyle = '#cfd8dc'; g.lineWidth = 1; g.stroke(); } };
  const capePiece = (sx, sy, ex, ey, wave) => ({
    path: (g) => {
      g.moveTo(sx - 7, sy);
      g.quadraticCurveTo((sx + ex) / 2 - 12 + wave, (sy + ey) / 2, ex - 12 + wave * 1.5, ey);
      if (zombie) { for (let i = 0; i < 4; i++) g.lineTo(ex - 9 + i * 5 + wave, ey - (i % 2 ? 6 : 0)); }
      else g.lineTo(ex + 8 + wave, ey + 2);
      g.quadraticCurveTo((sx + ex) / 2 + 6 + wave * 0.5, (sy + ey) / 2, sx + 7, sy);
      g.closePath();
    },
    fill: (g) => { const gr = g.createLinearGradient(sx, sy, ex, ey); gr.addColorStop(0, shade(cape, 1.1)); gr.addColorStop(1, shade(cape, 0.75)); return gr; },
  });
  const emblem = (cx, cy) => ({
    path: (g) => { g.moveTo(cx, cy - 6); g.lineTo(cx + 6, cy); g.lineTo(cx, cy + 6); g.lineTo(cx - 6, cy); g.closePath(); },
    fill: zombie ? '#9a9a5a' : C.noCape || C.skin ? 'rgba(0,0,0,0)' : '#ffd23f',
    detail: (g) => { g.fillStyle = zombie ? '#3e4a38' : '#d62839'; g.font = '900 7px sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(C.emblem || 'C', cx, cy + 0.5); },
  });
  const fist = (p) => ({ path: (g) => g.arc(p[0], p[1], 4.8, 0, Math.PI * 2), fill: zombie ? '#8fae7a' : '#e8e8ee' });
  const boot = (a, b) => cap(a, b, 8.6, 8.2, zombie ? '#4a3a3a' : '#d62839', 1);

  if (pose === 'land') {
    const wave = Math.sin(t * 10) * 2;
    const hip = [0, -24], sh = [9, -50];
    wings(sh[0], sh[1] + 6);
    if (!noCape) drawGroup(g, [capePiece(sh[0] - 2, sh[1], -26, -2, wave)]);
    drawGroup(g, [cap(hip, [-10, -4], 11, 9.5, suit2, 0.85), cap([-10, -4], [-24, -2], 9.5, 8, suit2, 0.85), boot([-18, -2], [-26, -1])]);
    drawGroup(g, [cap(sh, [-4, -38], 9.5, 8, suit2, 0.85), cap([-4, -38], [-10, -26], 8, 7, suit2, 0.85), fist([-10, -26])]);
    drawGroup(g, [{ path: (g) => capPath(g, hip, sh, 20, 22), fill: (g) => cylFill(g, hip, sh, 22, suit, 1) }, { path: (g) => capPath(g, [hip[0] - 1, hip[1] - 2], [hip[0] + 1, hip[1] + 3], 18, 18), fill: trunk }, emblem(6, -40)]);
    drawGroup(g, [cap(hip, [12, -14], 12, 10, suit, 1), cap([12, -14], [14, -3], 10, 8.5, suit, 1), boot([13, -6], [16, -1])]);
    drawGroup(g, [cap(sh, [15, -30], 9.5, 8, suit, 1), cap([15, -30], [17, -6], 8, 7, suit, 1), fist([17, -5])]);
    g.fillStyle = belt; g.fillRect(-9, -27, 17, 3);
    if (C.abs) absLines(g, 5, -42);
    heroHead(g, sh[0] + 4, sh[1] - 3, 19, zombie, faceKey);
    headHook(sh[0] + 4, sh[1] - 3);
    heldHook(17, -5);
  } else {
    // aufrecht zeichnen und für den Flug drehen
    const ang = pose === 'fly' ? Math.PI / 2 : pose === 'hover' ? 0.5 : 0.25;
    g.rotate(ang); g.translate(0, 40);
    const wave = Math.sin(t * 16) * 3;
    const hip = [0, -40], sh = [0, -70];
    wings(sh[0], sh[1] + 8);
    if (!noCape) drawGroup(g, [capePiece(sh[0], sh[1] + 2, -2, -8, wave)]);
    const legSwing = pose === 'punch' ? 0.2 : Math.sin(t * 8) * 0.08;
    const kB = pt(hip[0], hip[1], -0.08 - legSwing, 20), fB = pt(kB[0], kB[1], -0.1 - legSwing, 20);
    drawGroup(g, [cap(hip, kB, 11, 9.5, suit2, 0.85), cap(kB, fB, 9.5, 8.2, suit2, 0.85), boot(lerpP(kB, fB, 0.6), fB)]);
    const armBack = pose === 'punch' ? [[sh[0], sh[1]], [-12, -58], [-16, -48]] : [[sh[0], sh[1]], [-6, -54], [-4, -42]];
    drawGroup(g, [cap(armBack[0], armBack[1], 9.5, 8, suit2, 0.85), cap(armBack[1], armBack[2], 8, 7, suit2, 0.85), fist(armBack[2])]);
    drawGroup(g, [{ path: (g) => bodyHero(g), fill: (g) => cylFill(g, hip, sh, 22, suit, 1) }, { path: (g) => { g.moveTo(-10, -46); g.lineTo(10, -46); g.lineTo(9, -38); g.quadraticCurveTo(0, -34, -9, -38); g.closePath(); }, fill: trunk }, emblem(2, -60)]);
    g.fillStyle = belt; g.fillRect(-10, -47.5, 20, 3);
    const kF = pt(hip[0], hip[1], 0.1 + legSwing, 20), fF = pt(kF[0], kF[1], 0.05 + legSwing, 20);
    drawGroup(g, [cap(hip, kF, 11.5, 10, suit, 1), cap(kF, fF, 10, 8.6, suit, 1), boot(lerpP(kF, fF, 0.6), fF)]);
    if (C.abs) absLines(g, 1, -62);
    heroHead(g, 1, sh[1] - 2, 19, zombie, faceKey);
    headHook(1, sh[1] - 2);
    // Schlagarm: im Flug nach vorne (=oben im Körpersystem), beim Punch nach vorne
    const armF = pose === 'fly' ? [[sh[0] + 2, sh[1]], [3, -88], [4, -104]] : pose === 'punch' ? [[sh[0] + 2, sh[1]], [18, -72], [34, -76]] : [[sh[0] + 2, sh[1]], [12, -62], [20, -72]];
    drawGroup(g, [cap(armF[0], armF[1], 9.6, 8.2, suit, 1), cap(armF[1], armF[2], 8.2, 7.2, suit, 1), fist(armF[2])]);
    heldHook(armF[2][0], armF[2][1]);
    if (pose === 'fly' && !zombie) {
      g.strokeStyle = 'rgba(255,255,255,0.6)'; g.lineWidth = 1.5;
      for (let i = 0; i < 3; i++) { const yy = -30 + i * 14; g.beginPath(); g.moveTo(-16 - i * 3, yy + 16); g.lineTo(-16 - i * 3, yy + 34); g.stroke(); }
    }
  }
  g.restore();
}
function bodyHero(g) {
  g.moveTo(-9, -72); g.quadraticCurveTo(0, -75, 10, -72); g.quadraticCurveTo(13, -60, 9, -52); g.quadraticCurveTo(10, -44, 10, -40);
  g.lineTo(-10, -40); g.quadraticCurveTo(-11, -47, -9, -53); g.quadraticCurveTo(-12, -62, -9, -72); g.closePath();
}

// ---------------------------------------------------------------------------
// Hüpfender Fan mit Fahne
// ---------------------------------------------------------------------------
export function drawFan(g, x, footY, { faceKey, t = 0, color = '#d55b8f', scale = 1, flag = 'GO KIMI! ❤️' }) {
  const hop = Math.max(0, Math.sin(t * 7)) * 16;
  g.save(); g.translate(x, footY); g.scale(scale, scale);
  g.fillStyle = 'rgba(0,0,0,0.18)'; g.beginPath(); g.ellipse(0, 0, 14 - hop * 0.3, 3, 0, 0, 7); g.fill();
  g.translate(0, -hop);
  const tuck = hop > 6 ? 0.7 : 0.1;
  drawGroup(g, [cap([-4, -40], [-8 - tuck * 4, -22], 9, 8, '#333a4a', 0.85), cap([-8 - tuck * 4, -22], [-6, -4], 8, 7, '#333a4a', 0.85)]);
  drawGroup(g, [cap([4, -40], [8 + tuck * 4, -22], 9, 8, '#333a4a', 1), cap([8 + tuck * 4, -22], [6, -4], 8, 7, '#333a4a', 1)]);
  g.fillStyle = '#222'; roundRect(g, -12, -6 - (tuck > 0.5 ? 2 : 0), 11, 6, 3); g.fill(); roundRect(g, 2, -6 - (tuck > 0.5 ? 2 : 0), 11, 6, 3); g.fill();
  drawGroup(g, [{ path: (g) => { g.moveTo(-12, -72); g.quadraticCurveTo(0, -76, 12, -72); g.lineTo(14, -38); g.lineTo(-14, -38); g.closePath(); }, fill: (g) => cylFill(g, [0, -74], [0, -38], 26, color, 1) }]);
  // freier Arm jubelt
  const wv = Math.sin(t * 9) * 0.4;
  const e1 = pt(-11, -68, Math.PI * 0.85 + wv, 14), h1 = pt(e1[0], e1[1], Math.PI * 0.95 + wv, 12);
  drawGroup(g, [cap([-11, -68], e1, 8, 7, color, 0.9), cap(e1, h1, 7, 6, SKIN, 0.9), { path: (g) => g.arc(h1[0], h1[1], 4.3, 0, Math.PI * 2), fill: SKIN }]);
  // Fahnenarm
  const fa = Math.sin(t * 4) * 0.25;
  const hx = 15 + Math.sin(fa) * 6, hy = -86;
  drawGroup(g, [cap([11, -68], [16, -78], 8, 7, color, 1), cap([16, -78], [hx, hy], 7, 6, SKIN, 1), { path: (g) => g.arc(hx, hy, 4.3, 0, Math.PI * 2), fill: SKIN }]);
  // Fahnenstange + wehende Fahne
  const top = [hx + 4 + Math.sin(fa) * 10, hy - 48];
  g.strokeStyle = '#8d6e63'; g.lineWidth = 2.2; g.beginPath(); g.moveTo(hx - 1, hy + 10); g.lineTo(top[0], top[1]); g.stroke();
  const fw = 82, fh = 38;
  g.beginPath(); g.moveTo(top[0], top[1]);
  for (let i = 0; i <= 10; i++) { const u = i / 10; g.lineTo(top[0] + u * fw, top[1] + Math.sin(t * 9 - u * 5) * 4 * u); }
  for (let i = 10; i >= 0; i--) { const u = i / 10; g.lineTo(top[0] + u * fw, top[1] + fh + Math.sin(t * 9 - u * 5) * 4 * u); }
  g.closePath();
  g.strokeStyle = OL; g.lineWidth = 2.4; g.stroke();
  const gr = g.createLinearGradient(top[0], 0, top[0] + fw, 0); gr.addColorStop(0, '#ff4fa3'); gr.addColorStop(1, '#ffd23f');
  g.fillStyle = gr; g.fill();
  g.save(); g.translate(top[0] + fw / 2, top[1] + fh / 2 + Math.sin(t * 9 - 2.5) * 2); g.rotate(Math.cos(t * 9 - 2.5) * 0.06);
  g.fillStyle = '#fff'; g.font = '900 14px ui-rounded, system-ui, sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
  g.lineWidth = 3; g.strokeStyle = 'rgba(120,20,70,0.6)'; g.strokeText(flag, 0, 0); g.fillText(flag, 0, 0);
  g.restore();
  drawFaceOn(g, faceKey, 'happy', 0, -74, 20);
  g.restore();
}

// ---------------------------------------------------------------------------
// Oma Inge auf der Rollator-Rakete
// ---------------------------------------------------------------------------
export function drawRollatorOma(g, x, footY, { t = 0, scale = 1 }) {
  g.save(); g.translate(x, footY); g.scale(scale, scale);
  const bob = Math.sin(t * 30) * 0.8;
  // Flamme
  const fl = 14 + Math.sin(t * 50) * 4 + Math.random() * 4;
  const fg = g.createLinearGradient(-30, 0, -30 - fl * 2, 0); fg.addColorStop(0, '#fff3a0'); fg.addColorStop(0.4, '#ff9f1c'); fg.addColorStop(1, 'rgba(255,60,30,0)');
  g.fillStyle = fg; g.beginPath(); g.moveTo(-28, -22 + bob); g.quadraticCurveTo(-28 - fl * 1.6, -18 + bob, -28 - fl * 2.4, -16 + bob); g.quadraticCurveTo(-28 - fl * 1.6, -12 + bob, -28, -10 + bob); g.fill();
  g.translate(0, bob);
  // Rakete
  drawGroup(g, [
    { path: (g) => capPath(g, [-28, -16], [6, -16], 11, 11), fill: (g) => cylFill(g, [-28, -16], [6, -16], 11, '#cfd8dc', 1) },
    { path: (g) => { g.moveTo(6, -21.5); g.quadraticCurveTo(16, -16, 6, -10.5); g.closePath(); }, fill: '#e53935' },
    { path: (g) => { g.moveTo(-26, -21); g.lineTo(-33, -28); g.lineTo(-20, -21); g.closePath(); g.moveTo(-26, -11); g.lineTo(-33, -4); g.lineTo(-20, -11); g.closePath(); }, fill: '#e53935' },
  ]);
  // Rollator-Gestell
  g.strokeStyle = '#7e57c2'; g.lineWidth = 2.6; g.lineCap = 'round';
  g.beginPath(); g.moveTo(-14, -6); g.lineTo(-10, -44); g.lineTo(14, -44); g.lineTo(18, -6); g.moveTo(-12, -24); g.lineTo(16, -24); g.stroke();
  g.fillStyle = '#212121'; for (const wx of [-14, 18]) { g.beginPath(); g.arc(wx, -4, 4.5, 0, 7); g.fill(); g.fillStyle = '#9e9e9e'; g.beginPath(); g.arc(wx, -4, 1.6, 0, 7); g.fill(); g.fillStyle = '#212121'; }
  g.fillStyle = '#5d4037'; roundRect(g, -6, -36, 18, 10, 2); g.fill();
  g.fillStyle = '#ffd54f'; g.fillRect(-4, -38, 4, 3); g.fillStyle = '#e53935'; g.beginPath(); g.arc(6, -37, 2.2, 0, 7); g.fill();
  // Oma (steht hinten auf dem Rollator, beugt sich nach vorne)
  const dress = '#8a5aa8';
  drawGroup(g, [cap([-22, -34], [-26, -6], 9, 8, '#6b5b4b', 0.85), cap([-18, -34], [-20, -6], 9, 8, '#6b5b4b', 1)]);
  g.fillStyle = '#222'; roundRect(g, -31, -7, 11, 6, 3); g.fill(); roundRect(g, -24, -7, 11, 6, 3); g.fill();
  drawGroup(g, [{ path: (g) => { g.moveTo(-30, -36); g.lineTo(-10, -36); g.lineTo(-4, -62); g.quadraticCurveTo(-14, -68, -22, -62); g.closePath(); }, fill: (g) => cylFill(g, [-20, -36], [-12, -64], 24, dress, 1) }]);
  drawGroup(g, [cap([-8, -58], [2, -50], 8, 7, dress, 1), cap([2, -50], [-10, -44], 7, 6, SKIN, 1), { path: (g) => g.arc(-10, -44, 4, 0, Math.PI * 2), fill: SKIN }]);
  // wehender Schal
  g.strokeStyle = '#e53935'; g.lineWidth = 4;
  g.beginPath(); g.moveTo(-10, -64); for (let i = 1; i <= 4; i++) g.lineTo(-10 - i * 7, -64 + Math.sin(t * 20 - i) * 3 - i); g.stroke();
  drawFaceOn(g, 'oma', 'happy', -6, -64, 19);
  g.restore();
}
