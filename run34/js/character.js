// Prozedural gezeichnete Spielfigur (Comic-Körper + Foto-Kopf), Katze & Cameo-Figuren.
import { getFace, faceMeta } from './assets.js';
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
  const topCol = top === 'princess' ? '#f58dc2' : top === 'green' ? '#3fae3a' : (OUTFIT_PARTS.topColor.options[o.topColor]?.color || '#2c3157');
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
  drawGroup(g, armPieces(shoulder, P.arms[0], top, topCol, 0.8));
  drawGroup(g, legPieces(hip, legPts[1], o, 0.8));
  if (o.bottom === 'tutu') drawTutu(g, hip, P.lean, t, false);
  g.save(); g.translate(hip[0], hip[1]); g.rotate(P.lean);
  drawGroup(g, torsoPieces(o, topCol, extras));
  g.restore();
  drawGroup(g, legPieces(hip, legPts[0], o, 1));
  if (o.bottom === 'tutu') drawTutu(g, hip, P.lean, t, true);
  drawHead(g, neck, P.lean, expr, faceKey, extras, t, opt);
  if (extras.has('scarf')) drawScarfWrap(g, neck, P.lean);
  drawGroup(g, armPieces(shoulder, P.arms[1], top, topCol, 1));
  g.restore();
}

// ---------------------------------------------------------------------------
// Beine, Socken, Hosen, Schuhe
// ---------------------------------------------------------------------------
const DENIM = { jeans: '#42649e', latz: '#6a8fc8' };

function legPieces(H, L, o, f) {
  const { k: K, a: A, sh } = L;
  const P = [];
  const b = o.bottom;
  const bare = b === 'culotte' || b === 'tutu';
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
  if (top === 'matrose' || top === 'ripp') {
    const c1 = lerpP(E, Hn, 0.7), c2 = lerpP(E, Hn, 0.84);
    const tex = top === 'ripp'
      ? (a, b) => (g) => { for (const off of [-3, -1.5, 0, 1.5, 3]) lineAlong(g, a, b, off, 'rgba(0,0,0,0.13)', 0.55); }
      : (a, b) => (g) => lineAlong(g, a, b, -2.5, 'rgba(255,255,255,0.10)', 1.2);
    P.push(cap(S, E, 11.2, 9.6, topCol, f, tex(S, E)));
    P.push(cap(E, c1, 9.6, 9, topCol, f, tex(E, c1)));
    if (top === 'matrose') {
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
  } else if (top === 'green') {
    const e2 = lerpP(S, E, 0.58);
    P.push(cap(S, e2, 12.4, 12, topCol, f, (g) => lineAcross(g, lerpP(S, e2, 0.86), S, e2, 8, 'rgba(0,0,0,0.2)', 0.8)));
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
  const tucked = b === 'jeans' || b === 'matrose' || b === 'culotte';
  const hemY = tucked ? -6 : top === 'green' ? -1 : -3;
  // Hautbasis (sichtbar bei Ausschnitten)
  P.push({ path: (g) => bodyPath(g, -36, -20), fill: (g) => hGrad(g, SKIN), noOutline: true });

  if (top === 'tank') {
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
    const pc = b === 'jeans' ? DENIM.jeans : b === 'matrose' ? '#2b3158' : '#2b2b36';
    const top2 = b === 'culotte' ? -12 : -9;
    P.push({
      path: (g) => bodyPath(g, top2, 5, { botCurve: 1.5 }),
      fill: (g) => hGrad(g, pc),
      detail: (g) => {
        if (b === 'jeans') {
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
  } else if (b === 'tutu') {
    P.push({ path: (g) => bodyPath(g, -8, -3.5), fill: '#e0458f', detail: (g) => { g.fillStyle = 'rgba(255,255,255,0.3)'; g.fillRect(-12, -7.5, 25, 1); } });
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
    g.save(); g.translate(x, y + 8);
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
export function drawPerson(g, x, footY, { faceKey, t = 0, color = '#5b7bd5', wave = true, oma = false, scale = 1, expr = 'happy', run = false }) {
  g.save(); g.translate(x, footY); g.scale(scale, scale);
  const legC = oma ? '#6b5b4b' : '#333a4a';
  if (run) {
    const ph = t * 14, bob = Math.abs(Math.sin(ph)) * 3;
    g.translate(0, -bob); g.rotate(0.12);
    for (const off of [Math.PI, 0]) {
      const a = Math.sin(ph + off) * 0.75;
      const k = pt(0, -40, a, 20), f = pt(k[0], k[1], a - 0.5 - Math.max(0, -Math.sin(ph + off + 0.9)) * 0.9, 20);
      seg(g, 0, -40, k[0], k[1], 9, legC); seg(g, k[0], k[1], f[0], f[1], 8, legC);
      g.fillStyle = '#222'; roundRect(g, f[0] - 5, f[1] - 3, 13, 6, 3); g.fill();
    }
    g.fillStyle = color; roundRect(g, -13, -74, 26, 38, 8); g.fill();
    for (const off of [0, Math.PI]) {
      const a = -Math.sin(ph + off) * 0.9, e = pt(0, -68, a, 15), h = pt(e[0], e[1], a + 1.4, 13);
      seg(g, 0, -68, e[0], e[1], 8, color); seg(g, e[0], e[1], h[0], h[1], 7, SKIN);
    }
    drawFaceOn(g, faceKey, expr, 0, -74, 21);
    g.restore();
    return;
  }
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
  drawFaceOn(g, faceKey, expr, 0, -74, 21);
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
