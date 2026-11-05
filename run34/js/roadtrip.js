// Roadtrip-Modus: feste Etappen nach dem Ablauf im Geschenk (3 Tage, 2 Länder).
// Ortsnamen sind öffentliche Orte; Heimatort & Schilder kommen aus der privaten Config.
import { roundRect, star } from './character.js';
import { assets } from './assets.js';
import { OBS, ITEM_ICONS, bgRT, sky, ground, clouds } from './biomes.js';

const wrap = (v, m) => ((v % m) + m) % m;
const TAU = Math.PI * 2;
const rtCfg = () => assets.config.roadtrip || {};
const sign = (k, d) => rtCfg().signs?.[k] || d;

// ---------------------------------------------------------------------------
// Etappen (dur = Sekunden reine Laufzeit). day = großer Tages-Banner beim Betreten.
// ---------------------------------------------------------------------------
export const RT_STAGES = [
  { id: 'rt_home', name: 'Abfahrt', dur: 9, day: 'Tag 1', obstacles: { cone: 1, suitcase: 2 }, items: ['coffee'] },
  { id: 'rt_bahn_de', name: 'Auf der Autobahn 🇩🇪', dur: 24, obstacles: { cone: 3, bake: 2, tire: 2, blitzer: 2 }, items: ['salami', 'redbull', 'salami'] },
  { id: 'rt_bahn_nl', name: 'Welkom in Nederland 🇳🇱', dur: 16, obstacles: { cone: 2, bake: 1, klomp: 3, bike: 1 }, items: ['salami', 'redbull', 'stroop'] },
  { id: 'rt_phe', name: 'Piet Hein Eek 🪵', dur: 20, obstacles: { scrapcab: 3, designchair: 2, planks: 2, lamp: 2 }, items: ['coffee', 'appeltaart'] },
  { id: 'rt_strijps', name: 'Strijp-S Eindhoven', dur: 22, obstacles: { bike: 3, plant: 3, tulip: 2, designchair: 1 }, items: ['poffertjes', 'poffertjes', 'stroop'] },
  { id: 'rt_bahn_be', name: 'Weiter nach Belgien 🇧🇪', dur: 16, evening: true, obstacles: { cone: 3, bake: 2, tire: 2 }, items: ['salami', 'redbull'] },
  { id: 'rt_xmas', name: 'Winter in Antwerpen 🎄', dur: 26, obstacles: { xmastree: 2, frietzak: 2, snow: 2, shopbag: 2, hand: 2 }, items: ['fries', 'fries', 'wine'] },
  { id: 'rt_kloster', name: 'Kloosterstraat', dur: 20, day: 'Tag 2', obstacles: { designchair: 3, lamp: 2, scrapcab: 1, shopbag: 2 }, items: ['waffle', 'coffee'] },
  { id: 'rt_concept', name: 'Graanmarkt 13 & St. Vincents', dur: 20, obstacles: { plant: 2, shopbag: 3, designchair: 2, hand: 1 }, items: ['waffle', 'waffle'] },
  { id: 'rt_bahn_nl2', name: 'Zurück nach Holland 🇳🇱', dur: 12, day: 'Tag 3', obstacles: { cone: 2, klomp: 2, bake: 1 }, items: ['salami', 'redbull'] },
  { id: 'rt_ahxl', name: 'Albert Heijn XL 🛒', dur: 22, obstacles: { cart: 4, cans: 3, display: 2, chips: 3 }, items: ['stroop', 'kaas', 'hagelslag', 'poffertjes'] },
  { id: 'rt_bahn_home', name: 'Heimfahrt 🇩🇪', dur: 22, sunset: true, obstacles: { cone: 3, bake: 2, tire: 2, blitzer: 2 }, items: ['salami', 'redbull', 'salami'] },
  { id: 'rt_arrive', name: 'Wieder zuhause 🏡', dur: 6, finish: true, obstacles: { suitcase: 1 }, items: [] },
];
export const RT_TOTAL = RT_STAGES.reduce((s, x) => s + x.dur, 0);
export const RT_TRUNK = ['stroop', 'kaas', 'hagelslag', 'poffertjes'];
export const rtStageName = (st) => assets.config.biomeNames?.[st.id] || st.name;

// ---------------------------------------------------------------------------
// Bausteine
// ---------------------------------------------------------------------------
function car(g, x, y, col, s = 1, cat = false) {
  g.save(); g.translate(x, y); g.scale(s, s);
  g.fillStyle = col; roundRect(g, 0, -12, 46, 13, 4); g.fill(); roundRect(g, 9, -21, 26, 11, 4); g.fill();
  g.fillStyle = '#bfe6ff'; g.fillRect(12, -19, 9, 7); g.fillRect(23, -19, 9, 7);
  if (cat) { g.fillStyle = '#e8843a'; g.beginPath(); g.arc(16, -14, 3, 0, TAU); g.fill(); g.beginPath(); g.moveTo(13.5, -16); g.lineTo(14.5, -19.5); g.lineTo(16.5, -16.5); g.moveTo(15.5, -16.5); g.lineTo(17.5, -19.5); g.lineTo(18.5, -16); g.fill(); }
  g.fillStyle = '#ffe082'; g.fillRect(43, -9, 3, 3);
  g.fillStyle = '#111'; g.beginPath(); g.arc(10, 1, 4.5, 0, TAU); g.arc(36, 1, 4.5, 0, TAU); g.fill();
  g.fillStyle = '#9e9e9e'; g.beginPath(); g.arc(10, 1, 1.8, 0, TAU); g.arc(36, 1, 1.8, 0, TAU); g.fill();
  g.restore();
}
function euSign(g, x, y, name) {
  g.fillStyle = '#757575'; g.fillRect(x + 28, y + 56, 5, 70); g.fillRect(x + 77, y + 56, 5, 70);
  g.fillStyle = '#1e4fb4'; roundRect(g, x, y, 110, 58, 5); g.fill();
  g.strokeStyle = '#fff'; g.lineWidth = 2; g.strokeRect(x + 4, y + 4, 102, 50);
  g.fillStyle = '#ffd23f';
  for (let i = 0; i < 12; i++) { const a = (i / 12) * TAU; g.beginPath(); g.arc(x + 55 + Math.cos(a) * 13, y + 22 + Math.sin(a) * 13, 1.8, 0, TAU); g.fill(); }
  g.fillStyle = '#fff'; g.font = '900 12px ui-rounded, system-ui, sans-serif'; g.textAlign = 'center'; g.fillText(name, x + 55, y + 50, 100);
}
function dirSign(g, x, y, lines, route) {
  g.fillStyle = '#757575'; g.fillRect(x + 18, y + 18 * lines.length + 12, 5, 90); g.fillRect(x + 107, y + 18 * lines.length + 12, 5, 90);
  g.fillStyle = '#1565c0'; roundRect(g, x, y, 130, 18 * lines.length + 14, 5); g.fill();
  g.strokeStyle = '#fff'; g.lineWidth = 1.6; g.strokeRect(x + 3, y + 3, 124, 18 * lines.length + 8);
  g.font = '700 12px sans-serif'; g.textAlign = 'left'; g.fillStyle = '#fff';
  lines.forEach((l, i) => g.fillText(l, x + 10, y + 22 + i * 18, 110));
  if (route) { g.fillStyle = route.c; roundRect(g, x + 92, y - 12, 34, 16, 4); g.fill(); g.fillStyle = '#fff'; g.font = '900 10px sans-serif'; g.textAlign = 'center'; g.fillText(route.t, x + 109, y, 30); }
}
function lampPost(g, x, gy, on) {
  g.fillStyle = '#90a4ae'; g.fillRect(x, gy - 120, 3, 108);
  g.fillRect(x, gy - 120, 20, 3);
  g.fillStyle = on ? '#ffe9a8' : '#cfd8dc'; roundRect(g, x + 14, gy - 120, 12, 5, 2); g.fill();
  if (on) { const gr = g.createRadialGradient(x + 20, gy - 112, 2, x + 20, gy - 112, 46); gr.addColorStop(0, 'rgba(255,220,140,0.55)'); gr.addColorStop(1, 'rgba(255,220,140,0)'); g.fillStyle = gr; g.beginPath(); g.arc(x + 20, gy - 112, 46, 0, TAU); g.fill(); }
}
function windmill(g, x, gy, t, s = 1) { // klassische holländische Mühle
  g.save(); g.translate(x, gy); g.scale(s, s);
  g.fillStyle = '#5d4037'; g.beginPath(); g.moveTo(-14, 0); g.lineTo(-9, -62); g.lineTo(9, -62); g.lineTo(14, 0); g.fill();
  g.fillStyle = '#3e2723'; g.beginPath(); g.moveTo(-11, -62); g.quadraticCurveTo(0, -78, 11, -62); g.fill();
  g.fillStyle = '#fff'; g.fillRect(-3, -14, 6, 14);
  g.translate(0, -64); g.rotate(t * 0.8);
  for (let i = 0; i < 4; i++) { g.rotate(TAU / 4); g.fillStyle = '#efe6d8'; g.fillRect(-3, 4, 6, 46); g.strokeStyle = '#8d6e63'; g.lineWidth = 0.8; for (let k = 10; k < 50; k += 6) { g.beginPath(); g.moveTo(-3, k); g.lineTo(3, k); g.stroke(); } }
  g.fillStyle = '#3e2723'; g.beginPath(); g.arc(0, 0, 3, 0, TAU); g.fill();
  g.restore();
}
function turbine(g, x, gy, t, h) {
  g.fillStyle = '#eceff1'; g.beginPath(); g.moveTo(x - 2.5, gy); g.lineTo(x - 1, gy - h); g.lineTo(x + 1, gy - h); g.lineTo(x + 2.5, gy); g.fill();
  g.save(); g.translate(x, gy - h); g.rotate(t * 1.4 + x);
  g.fillStyle = '#fafafa'; for (let i = 0; i < 3; i++) { g.rotate(TAU / 3); g.beginPath(); g.moveTo(-1.5, 0); g.lineTo(0, -h * 0.42); g.lineTo(2, 0); g.fill(); }
  g.restore();
}
function cow(g, x, y) {
  g.fillStyle = '#fafafa'; roundRect(g, x, y - 10, 20, 9, 3); g.fill();
  g.fillStyle = '#212121'; g.beginPath(); g.arc(x + 6, y - 7, 2.6, 0, TAU); g.arc(x + 14, y - 5, 2, 0, TAU); g.fill();
  g.fillRect(x + 2, y - 2, 2, 4); g.fillRect(x + 16, y - 2, 2, 4);
  g.fillStyle = '#fafafa'; roundRect(g, x + 18, y - 12, 7, 6, 2); g.fill();
}
function stall(g, x, gy, w, roof, label, warm) {
  g.fillStyle = '#6d4c41'; g.fillRect(x, gy - 46, w, 46);
  g.fillStyle = '#4e342e'; for (let i = 0; i < w; i += 8) g.fillRect(x + i, gy - 46, 1.2, 46);
  g.fillStyle = '#ffe8b0'; g.fillRect(x + 6, gy - 40, w - 12, 18);
  g.fillStyle = roof; g.beginPath(); g.moveTo(x - 8, gy - 44); g.lineTo(x + w / 2, gy - 70); g.lineTo(x + w + 8, gy - 44); g.fill();
  g.fillStyle = 'rgba(255,255,255,0.85)'; g.beginPath(); g.moveTo(x - 8, gy - 44); g.lineTo(x + w / 2, gy - 70); g.lineTo(x + w / 2, gy - 66); g.lineTo(x - 3, gy - 44); g.fill();
  if (label) { g.fillStyle = '#fff'; roundRect(g, x + w / 2 - 34, gy - 62, 68, 13, 3); g.fill(); g.fillStyle = '#5d2a1a'; g.font = '900 9px ui-rounded, system-ui, sans-serif'; g.textAlign = 'center'; g.fillText(label, x + w / 2, gy - 52, 64); }
  if (warm) { g.fillStyle = '#ffd23f'; for (let i = 0; i < w; i += 9) { g.beginPath(); g.arc(x + i + 4, gy - 44 + Math.sin(i) * 1.5, 1.8, 0, TAU); g.fill(); } }
}
function snow(g, V, off, t, n = 40) {
  g.fillStyle = 'rgba(255,255,255,0.85)';
  for (let i = 0; i < n; i++) { const sx = wrap(i * 53 - off * 0.2 + Math.sin(t + i) * 10, V.w), sy = wrap(i * 37 + t * 30, V.groundY); g.beginPath(); g.arc(sx, sy, 1.4, 0, TAU); g.fill(); }
}
function cobbles(g, V, off, c1, c2, sz = 14) {
  ground(g, V, c1, c2, off, () => { g.strokeStyle = 'rgba(0,0,0,0.15)'; g.lineWidth = 1; for (let i = 0; i < V.w / sz + 2; i++) for (let r = 0; r < 4; r++) g.strokeRect(i * sz - wrap(off, sz) + (r % 2) * sz / 2, V.groundY + 4 + r * 9, sz, 9); });
}
function road(g, V, off) {
  ground(g, V, '#4a4a4f', '#3a3a3f', off, () => { g.fillStyle = '#fff'; for (let i = 0; i < V.w / 60 + 2; i++) g.fillRect(i * 60 - wrap(off, 60), V.groundY + 18, 30, 3); });
}
function fairyLights(g, V, off, t, y0, k = 0.45) {
  g.strokeStyle = 'rgba(0,0,0,0.4)'; g.lineWidth = 1;
  for (let j = -1; j < V.w / 200 + 2; j++) {
    const x = j * 200 - wrap(off * k, 200);
    g.beginPath(); g.moveTo(x, y0); g.quadraticCurveTo(x + 100, y0 + 40, x + 200, y0); g.stroke();
    for (let i = 1; i < 10; i++) { const u = i / 10, lx = x + 200 * u, ly = y0 + 80 * u * (1 - u); g.fillStyle = (i + Math.floor(t * 3)) % 3 ? '#fff59d' : '#ff8a80'; g.beginPath(); g.arc(lx, ly + 2, 2.2, 0, TAU); g.fill(); }
  }
}

// ---------------------------------------------------------------------------
// Autobahn (DE / NL / BE), Tageszeit je Etappe
// ---------------------------------------------------------------------------
function autobahn(g, V, off, t, land) {
  const gy = V.groundY;
  const eve = land === 'be', dusk = land === 'home';
  if (eve) sky(g, V, '#2c2f6b', '#f08a5d'); else if (dusk) sky(g, V, '#5b6fb5', '#ffb36b'); else sky(g, V, land === 'nl' ? '#9fd0ef' : '#8ecdf2', '#eaf6ff');
  if (eve || dusk) { g.fillStyle = eve ? 'rgba(255,200,120,0.9)' : 'rgba(255,170,90,0.95)'; g.beginPath(); g.arc(V.w * 0.78, gy - 70, 26, 0, TAU); g.fill(); }
  clouds(g, V, off, eve ? 0.25 : 0.8);
  // Landschaft
  if (land === 'nl' || land === 'nl2') {
    g.fillStyle = '#9ccc65'; g.fillRect(0, gy - 52, V.w, 14);
    for (let k = -1; k < V.w / 160 + 2; k++) turbine(g, k * 160 - wrap(off * 0.08, 160) + 40, gy - 50, t, 70 + (k % 2) * 16);
    const mx = wrap(-off * 0.15 + 300, 1100) - 100; windmill(g, mx, gy - 44, t, 0.9);
    g.fillStyle = '#4fc3f7'; g.fillRect(0, gy - 44, V.w, 3); // Gracht
    for (let k = -1; k < V.w / 230 + 2; k++) cow(g, k * 230 - wrap(off * 0.2, 230) + 90, gy - 41);
  } else if (eve) { // Anfahrt über den Linkeroever: Skyline über der Schelde im Abendlicht
    antwerpSkyline(g, V, off * 0.6, gy - 46, '#f2cf86', false, 0.55);
    g.fillStyle = '#5b5f86'; g.fillRect(0, gy - 50, V.w, 10);
    g.fillStyle = 'rgba(255,200,130,0.5)'; for (let i = 0; i < 12; i++) g.fillRect(wrap(i * 70 - off * 0.3, V.w), gy - 47 + (i % 3) * 2, 26, 1.5);
  } else {
    g.fillStyle = dusk ? '#6d8a5a' : '#81c784'; g.beginPath(); g.moveTo(0, gy - 40); for (let x = 0; x <= V.w + 10; x += 10) g.lineTo(x, gy - 62 - Math.sin((x + off * 0.15) * 0.01) * 22); g.lineTo(V.w, gy - 40); g.fill();
    g.fillStyle = dusk ? '#3f5c3a' : '#2e7d32';
    for (let k = -1; k < V.w / 24 + 2; k++) { const x = k * 24 - wrap(off * 0.25, 24), h = 16 + ((k * 7) % 3 + 3) % 3 * 5; g.beginPath(); g.moveTo(x, gy - 40); g.lineTo(x + 8, gy - 40 - h); g.lineTo(x + 16, gy - 40); g.fill(); }
  }
  // Gegenfahrbahn
  g.fillStyle = eve ? '#3d3d45' : '#616161'; g.fillRect(0, gy - 40, V.w, 26);
  g.fillStyle = '#fff'; for (let i = 0; i < V.w / 40 + 2; i++) g.fillRect(i * 40 - wrap(off * 0.7, 40), gy - 28, 20, 2);
  const cc = ['#e53935', '#1e88e5', '#fdd835', '#43a047', '#fafafa'];
  for (let i = 0; i < 4; i++) {
    const x = wrap(i * 230 + t * 170 - off * 0.7, V.w + 220) - 110;
    car(g, x, gy - 26, cc[i], 0.75);
    if (eve) { g.fillStyle = 'rgba(255,240,180,0.8)'; g.beginPath(); g.arc(x + 34, gy - 33, 2.2, 0, TAU); g.fill(); }
  }
  // Unser Auto (rot, mit Fips im Fenster) tuckert nebenher
  car(g, 60 + Math.sin(t * 0.7) * 30, gy - 15, '#e8424f', 0.9, true);
  // Belgische Autobahnbeleuchtung
  if (eve) for (let k = -1; k < V.w / 150 + 2; k++) lampPost(g, k * 150 - wrap(off * 0.75, 150), gy - 14, true);
  // Leitplanke
  g.fillStyle = '#b0bec5'; g.fillRect(0, gy - 13, V.w, 4);
  for (let i = 0; i < V.w / 30 + 2; i++) g.fillRect(i * 30 - wrap(off, 30), gy - 13, 2.5, 13);
  // Schilder
  const sx = wrap(-off * 0.7 + 420, 1300) - 200;
  if (land === 'de') dirSign(g, sx, gy - 150, [`${sign('nlCity', 'Venlo')}  ${sign('kmVenlo', '280')}`, `Eindhoven  ${sign('kmEindhoven', '330')}`], { t: 'A3', c: '#1565c0' });
  if (land === 'nl') dirSign(g, sx, gy - 150, ['Eindhoven  42', 'Strijp-S'], { t: 'A67', c: '#d32f2f' });
  if (land === 'nl2') dirSign(g, sx, gy - 150, ['Eindhoven  25', `${sign('nlCity', 'Venlo')}  61`], { t: 'A67', c: '#d32f2f' });
  if (land === 'be') dirSign(g, sx, gy - 150, ['Antwerpen  38', 'Centrum'], { t: 'E34', c: '#2e7d32' });
  if (land === 'home') dirSign(g, sx, gy - 150, [`${sign('home', 'Zuhause')}  ${sign('kmHome', '96')}`, sign('homeVia', 'Ausfahrt')], { t: 'A3', c: '#1565c0' });
  const bx = wrap(-off * 0.7 + 1000, 1300) - 200;
  if (land === 'nl') euSign(g, bx, gy - 140, 'Nederland');
  if (land === 'be') euSign(g, bx, gy - 140, 'België');
  if (land === 'nl2') euSign(g, bx, gy - 140, 'Nederland');
  if (land === 'home') euSign(g, bx, gy - 140, 'Deutschland');
  // Raststätte (nur DE)
  if (land === 'de' || land === 'home') {
    const rx = wrap(-off * 0.5 + 900, 1700) - 300;
    g.fillStyle = '#eceff1'; g.fillRect(rx, gy - 95, 140, 55); g.fillStyle = '#e53935'; g.fillRect(rx - 6, gy - 102, 152, 9);
    g.fillStyle = dusk ? '#ffe082' : '#90caf9'; for (let i = 0; i < 4; i++) g.fillRect(rx + 10 + i * 32, gy - 82, 22, 20);
    g.fillStyle = '#fff'; g.font = '900 9px sans-serif'; g.textAlign = 'center'; g.fillText('RASTSTÄTTE', rx + 70, gy - 95);
  }
  road(g, V, off);
}

// ---------------------------------------------------------------------------
// Szenen
// ---------------------------------------------------------------------------
// Antwerpen-Skyline von der Schelde (nach Foto): Kuppelbauten, Kathedrale, zweite Spitze, Boerentoren
function antwerpSkyline(g, V, off, base, light, glow, sc = 1) {
  g.save(); g.translate(0, base * (1 - sc)); g.scale(sc, sc);
  const gy = base, W = V.w / sc;
  const seg = 1400, x0 = wrap(-off * 0.06 + 200, seg) - 400;
  for (const x of [x0, x0 + seg]) {
    if (x > W + 50 || x < -900) continue;
    const st = light, dk = glow ? '#3a2f4a' : '#9a8a72';
    // Häuserzeile
    const hs = [['#e8d9b8', 60, 70], ['#c8553d', 40, 46], ['#efe6d4', 55, 58], ['#d7c9ad', 45, 64], ['#b8443a', 30, 44], ['#f1ece2', 60, 50], ['#cfc4ae', 50, 60], ['#e0d3b5', 70, 54], ['#b5433a', 36, 48], ['#ece4d2', 60, 56]];
    let hx = x;
    for (const [c, w, h] of hs) { g.fillStyle = glow ? '#4a3d5e' : c; g.fillRect(hx, gy - 60 - h, w, h); if (glow) { g.fillStyle = '#ffd98a'; for (let i = 6; i < w - 6; i += 10) g.fillRect(hx + i, gy - 60 - h + 10, 4, 5); } hx += w; }
    // Kuppeln links
    g.fillStyle = glow ? '#4a3d5e' : '#e3d6bb'; g.fillRect(x + 10, gy - 150, 90, 20);
    for (const d of [30, 70]) { g.beginPath(); g.arc(x + d, gy - 150, 13, Math.PI, 0); g.fill(); g.fillRect(x + d - 1, gy - 172, 2, 9); }
    // Kathedrale
    const cx = x + 300;
    g.fillStyle = glow ? '#5a4b6e' : st; g.fillRect(cx, gy - 270, 34, 210);
    g.fillRect(cx + 4, gy - 300, 26, 30); g.fillRect(cx + 8, gy - 325, 18, 25);
    g.beginPath(); g.moveTo(cx + 10, gy - 325); g.lineTo(cx + 17, gy - 352); g.lineTo(cx + 24, gy - 325); g.fill();
    g.fillStyle = dk; for (let i = 0; i < 5; i++) { g.fillRect(cx + 7, gy - 255 + i * 36, 6, 22); g.fillRect(cx + 21, gy - 255 + i * 36, 6, 22); }
    g.fillStyle = glow ? '#ffe9a8' : '#fff7e0'; g.beginPath(); g.arc(cx + 17, gy - 214, 5, 0, TAU); g.fill();
    // zweite, dunkle Spitze
    g.fillStyle = glow ? '#4f4262' : '#d9c9a6'; g.fillRect(cx + 50, gy - 150, 26, 90);
    g.fillStyle = glow ? '#2e2540' : '#3d3a40'; g.beginPath(); g.moveTo(cx + 54, gy - 150); g.lineTo(cx + 63, gy - 195); g.lineTo(cx + 72, gy - 150); g.fill();
    // Boerentoren
    const bx = x + 640;
    g.fillStyle = glow ? '#5a4b6e' : '#e4cfa2'; g.fillRect(bx, gy - 210, 46, 150); g.fillRect(bx + 6, gy - 226, 34, 16); g.fillRect(bx + 12, gy - 238, 22, 12);
    g.fillStyle = dk; for (let r = 0; r < 12; r++) for (let c = 0; c < 4; c++) g.fillRect(bx + 5 + c * 10, gy - 202 + r * 12, 5, 6);
    // Kai-Promenade mit roten Stützen
    g.fillStyle = glow ? '#3b3350' : '#bdb3a0'; g.fillRect(x - 100, gy - 66, 900, 6);
    g.fillStyle = '#b23a32'; for (let i = 0; i < 40; i++) g.fillRect(x - 100 + i * 22, gy - 60, 3, 14);
  }
  g.restore();
}

function house(g, x, gy, w, h, wall, roof, lit) {
  g.fillStyle = wall; g.fillRect(x, gy - h, w, h);
  g.fillStyle = roof; g.beginPath(); g.moveTo(x - 8, gy - h); g.lineTo(x + w / 2, gy - h - w * 0.45); g.lineTo(x + w + 8, gy - h); g.fill();
  g.fillStyle = lit ? '#ffe082' : '#bfe6ff';
  for (const [wx, wy] of [[0.15, 0.25], [0.6, 0.25], [0.15, 0.62]]) g.fillRect(x + w * wx, gy - h + h * wy, w * 0.25, h * 0.2);
  g.fillStyle = '#6d4c41'; g.fillRect(x + w * 0.62, gy - h * 0.42, w * 0.2, h * 0.42);
}
const PAINT = {
  rt_bahn_de: (g, V, off, t) => autobahn(g, V, off, t, 'de'),
  rt_bahn_nl: (g, V, off, t) => autobahn(g, V, off, t, 'nl'),
  rt_bahn_nl2: (g, V, off, t) => autobahn(g, V, off, t, 'nl2'),
  rt_bahn_be: (g, V, off, t) => autobahn(g, V, off, t, 'be'),
  rt_bahn_home: (g, V, off, t) => autobahn(g, V, off, t, 'home'),

  // Abfahrt frühmorgens: Wohnstraße, Kofferraum offen
  rt_home(g, V, off, t, arrive = false) {
    const gy = V.groundY;
    if (arrive) sky(g, V, '#1d2350', '#7c4f8a'); else sky(g, V, '#7fa6d9', '#ffd6a5');
    if (!arrive) { g.fillStyle = 'rgba(255,214,120,0.9)'; g.beginPath(); g.arc(V.w * 0.2, gy - 40, 22, 0, TAU); g.fill(); clouds(g, V, off, 0.6); }
    else { g.fillStyle = '#fff'; for (let i = 0; i < 30; i++) { g.beginPath(); g.arc((i * 97) % V.w, (i * 41) % (gy - 120), 1 + (i % 3) * 0.4, 0, TAU); g.fill(); } }
    const walls = ['#f5e6c8', '#e8d0c0', '#dfe7ef', '#f2dcb8'], roofs = ['#8d3b2b', '#5d4037', '#6b2e2e', '#455a64'];
    for (let k = -1; k < V.w / 170 + 2; k++) {
      const x = k * 170 - wrap(off * 0.4, 170), i = ((k % 4) + 4) % 4;
      house(g, x + 10, gy - 12, 120, 80 + (i % 2) * 14, walls[i], roofs[i], arrive);
      g.fillStyle = '#4caf50'; g.beginPath(); g.arc(x + 150, gy - 26, 14, 0, TAU); g.fill(); // Hecke
    }
    // unser Auto mit offenem Kofferraum am Anfang
    const cx = 200 - wrap(off, 2400);
    if (cx > -120) {
      car(g, cx, gy - 6, '#e8424f', 1.6, true);
      g.fillStyle = '#c62828'; g.beginPath(); g.moveTo(cx, gy - 26); g.lineTo(cx - 20, gy - 48); g.lineTo(cx - 14, gy - 50); g.lineTo(cx + 6, gy - 30); g.fill();
      g.fillStyle = '#1565c0'; roundRect(g, cx + 2, gy - 34, 16, 12, 2); g.fill(); g.fillStyle = '#ff7043'; roundRect(g, cx + 8, gy - 42, 12, 9, 2); g.fill();
    }
    if (arrive) {
      g.fillStyle = '#ffd23f'; g.font = '900 18px ui-rounded, system-ui, sans-serif'; g.textAlign = 'center';
      const bx = wrap(-off * 0.4 + 520, 900) - 120;
      g.fillStyle = '#ff4fa3'; roundRect(g, bx, gy - 190, 170, 32, 8); g.fill();
      g.fillStyle = '#fff'; g.fillText('Willkommen daheim!', bx + 85, gy - 168, 160);
    }
    cobbles(g, V, off, '#9e9e9e', '#bdbdbd', 20);
  },
  rt_arrive(g, V, off, t) { PAINT.rt_home(g, V, off, t, true); },

  // Piet Hein Eek: alte Philips-Keramikfabrik, Stahlfenster, Sheddach, Schrotholz-Möbel
  rt_phe(g, V, off, t) {
    const gy = V.groundY;
    sky(g, V, '#b7cde0', '#eef2f5'); clouds(g, V, off, 0.6);
    for (let k = -1; k < V.w / 420 + 2; k++) {
      const x = k * 420 - wrap(off * 0.3, 420);
      // Sheddach
      g.fillStyle = '#8d8d8d'; for (let i = 0; i < 6; i++) { g.beginPath(); g.moveTo(x + i * 70, gy - 170); g.lineTo(x + i * 70 + 50, gy - 198); g.lineTo(x + i * 70 + 50, gy - 170); g.fill(); g.fillStyle = '#cfe3f0'; g.fillRect(x + i * 70 + 50, gy - 198, 20, 28); g.fillStyle = '#8d8d8d'; }
      // Backsteinfassade, weiß gestrichen unten
      g.fillStyle = '#a65a3c'; g.fillRect(x, gy - 170, 410, 170);
      g.strokeStyle = 'rgba(0,0,0,0.1)'; g.lineWidth = 1; for (let r = 0; r < 17; r++) { g.beginPath(); g.moveTo(x, gy - 170 + r * 10); g.lineTo(x + 410, gy - 170 + r * 10); g.stroke(); }
      // große Stahlfenster
      for (let i = 0; i < 4; i++) {
        const wx = x + 18 + i * 98;
        g.fillStyle = '#2b3036'; g.fillRect(wx, gy - 150, 84, 112);
        g.fillStyle = '#f3e3c3'; g.fillRect(wx + 3, gy - 147, 78, 106);
        // Blick hinein: Schrotholzschrank & Lampe
        const woods = ['#b07a4a', '#d9a066', '#7f5539', '#e6c79c', '#9c6b43', '#5e8c6a', '#c0504d'];
        for (let r = 0; r < 6; r++) for (let c = 0; c < 4; c++) { g.fillStyle = woods[(r * 3 + c + i) % 7]; g.fillRect(wx + 10 + c * 10, gy - 110 + r * 10, 9, 9); }
        g.strokeStyle = '#333'; g.beginPath(); g.moveTo(wx + 62, gy - 147); g.lineTo(wx + 62, gy - 125); g.stroke();
        g.fillStyle = '#212121'; g.beginPath(); g.moveTo(wx + 52, gy - 115); g.lineTo(wx + 72, gy - 115); g.lineTo(wx + 66, gy - 125); g.lineTo(wx + 58, gy - 125); g.fill();
        g.fillStyle = 'rgba(255,230,150,0.6)'; g.beginPath(); g.arc(wx + 62, gy - 112, 7, 0, TAU); g.fill();
        g.strokeStyle = '#2b3036'; g.lineWidth = 2; for (let c = 1; c < 4; c++) { g.beginPath(); g.moveTo(wx + c * 21, gy - 147); g.lineTo(wx + c * 21, gy - 41); g.stroke(); } for (let r = 1; r < 5; r++) { g.beginPath(); g.moveTo(wx + 3, gy - 147 + r * 21); g.lineTo(wx + 81, gy - 147 + r * 21); g.stroke(); }
      }
      g.fillStyle = '#111'; g.font = '900 15px ui-rounded, system-ui, sans-serif'; g.textAlign = 'center'; g.fillText('PIET HEIN EEK', x + 205, gy - 156);
    }
    // Holzstapel vor der Halle
    for (let k = -1; k < V.w / 300 + 2; k++) {
      const x = k * 300 - wrap(off * 0.6, 300) + 120;
      const woods = ['#b07a4a', '#d9a066', '#7f5539', '#e6c79c', '#9c6b43'];
      for (let r = 0; r < 4; r++) { g.fillStyle = woods[(r + k + 5) % 5]; g.fillRect(x + r * 3, gy - 8 - r * 6, 60 - r * 6, 5); }
    }
    ground(g, V, '#9e9e9e', '#bdbdbd', off, () => { g.fillStyle = 'rgba(0,0,0,0.08)'; for (let i = 0; i < V.w / 50 + 2; i++) g.fillRect(i * 50 - wrap(off, 50), V.groundY + 3, 2, 60); });
  },

  // Strijp-S (nach Fotos): Trudo-Turm mit Bäumen auf versetzten Balkonen, roter Backsteinturm,
  // weiße Philips-Fabriken mit Sprossenfenstern, erhöhte Rohrleitungsbrücke, bunte Container, Ketelhuisplein
  rt_strijps(g, V, off, t) {
    const gy = V.groundY;
    sky(g, V, '#8fbfe6', '#eef3f6'); clouds(g, V, off, 0.75);
    const seg = 900;
    for (let k = -1; k < V.w / seg + 2; k++) {
      const x = k * seg - wrap(off * 0.12, seg);
      // roter Backsteinturm
      g.fillStyle = '#b5523b'; g.fillRect(x + 40, gy - 250, 70, 250);
      g.fillStyle = '#8e3b2a'; for (let r = 0; r < 16; r++) for (let c = 0; c < 5; c++) g.fillRect(x + 46 + c * 13, gy - 242 + r * 14, 7, 8);
      // Schornstein
      g.fillStyle = '#9c4a33'; g.fillRect(x + 330, gy - 230, 10, 230); g.fillStyle = '#fff'; g.fillRect(x + 330, gy - 222, 10, 4);
      // Trudo-Turm: weiß-graue Balkone, versetzt, mit Grün, blaue Fenster
      const tx = x + 200, tw = 90, th = 290;
      g.fillStyle = '#3f6d8f'; g.fillRect(tx, gy - th, tw, th);
      for (let r = 0; r < 26; r++) for (let c = 0; c < 4; c++) {
        const bx = tx - 6 + c * 24 + ((r + c) % 2 ? 8 : 0), by = gy - th + 4 + r * 11;
        if ((r * 3 + c * 5) % 4 === 0) continue;
        g.fillStyle = '#e4e6e4'; g.fillRect(bx, by + 6, 20, 3.5);
        g.fillStyle = ['#4f8a3c', '#6aa84f', '#3b6e2c'][(r + c) % 3]; g.beginPath(); g.arc(bx + 4 + ((r * c) % 3) * 5, by + 5, 3.4, 0, TAU); g.fill();
      }
    }
    // weiße Fabrikgebäude (rechts im Foto) – mittlere Ebene
    for (let k = -1; k < V.w / 330 + 2; k++) {
      const x = k * 330 - wrap(off * 0.3, 330);
      g.fillStyle = '#ecebe6'; g.fillRect(x, gy - 160, 310, 160);
      g.fillStyle = '#d9d7cf'; for (let i = 0; i < 9; i++) g.fillRect(x + 4 + i * 34, gy - 160, 4, 160);
      for (let r = 0; r < 4; r++) for (let i = 0; i < 9; i++) {
        const wx = x + 11 + i * 34, wy = gy - 150 + r * 36;
        g.fillStyle = '#2f3a40'; g.fillRect(wx, wy, 22, 28);
        g.fillStyle = '#a9c0cc'; g.fillRect(wx + 1.5, wy + 1.5, 19, 25);
        g.strokeStyle = '#2f3a40'; g.lineWidth = 1; g.beginPath(); g.moveTo(wx + 11, wy); g.lineTo(wx + 11, wy + 28); g.moveTo(wx, wy + 9); g.lineTo(wx + 22, wy + 9); g.moveTo(wx, wy + 18); g.lineTo(wx + 22, wy + 18); g.stroke();
      }
      g.fillStyle = '#5e7f45'; for (let i = 0; i < 10; i++) { g.beginPath(); g.arc(x + 10 + i * 31, gy - 162, 7, Math.PI, 0); g.fill(); } // Dachgrün
    }
    // Schild auf dem Dach, wie im Foto
    const lx = wrap(-off * 0.3 + 120, 1000) - 200;
    g.fillStyle = '#2b2b2e'; g.fillRect(lx, gy - 176, 150, 16);
    g.fillStyle = '#d0d0d0'; g.font = '900 14px ui-rounded, system-ui, sans-serif'; g.textAlign = 'center'; g.fillText('STRIJP-S', lx + 75, gy - 163);
    // erhöhte Rohrleitungsbrücke (Stahlgerüst mit zwei dicken Rohren) – vordere Ebene
    const py = gy - 96;
    g.fillStyle = '#5b6770';
    for (let k = -1; k < V.w / 90 + 2; k++) { const x = k * 90 - wrap(off * 0.5, 90); g.fillRect(x, py, 5, gy - py); g.fillRect(x + 38, py, 5, gy - py); g.save(); g.strokeStyle = '#5b6770'; g.lineWidth = 2; g.beginPath(); g.moveTo(x, py + 8); g.lineTo(x + 43, py + 40); g.moveTo(x + 43, py + 8); g.lineTo(x, py + 40); g.stroke(); g.restore(); }
    g.fillStyle = '#4a555c'; g.fillRect(0, py - 4, V.w, 6);
    for (const [yy, rr] of [[py - 12, 7], [py - 26, 7]]) {
      const gr = g.createLinearGradient(0, yy - rr, 0, yy + rr); gr.addColorStop(0, '#b9c2c8'); gr.addColorStop(0.5, '#7d878d'); gr.addColorStop(1, '#4b5358');
      g.fillStyle = gr; g.fillRect(0, yy - rr, V.w, rr * 2);
    }
    g.fillStyle = '#4f8a3c'; for (let k = -1; k < V.w / 60 + 2; k++) { const x = k * 60 - wrap(off * 0.5, 60); g.beginPath(); g.arc(x + 20, py - 2, 5, Math.PI, 0); g.fill(); }
    // bunte Container (Läden, Poffertjes) & Ladenschilder
    const ccol = ['#e84f8a', '#ffd23f', '#2bb3a3', '#ff8a3d', '#5c6bc0'];
    for (let k = -1; k < V.w / 420 + 2; k++) {
      const x = k * 420 - wrap(off * 0.55, 420) + 30;
      for (let i = 0; i < 3; i++) { g.fillStyle = ccol[(i + k * 2 + 10) % 5]; g.fillRect(x + i * 52, gy - 40, 50, 40); g.fillStyle = 'rgba(0,0,0,0.15)'; for (let j = 4; j < 50; j += 5) g.fillRect(x + i * 52 + j, gy - 40, 1.2, 40); }
      g.fillStyle = '#111'; roundRect(g, x + 4, gy - 58, 150, 15, 3); g.fill();
      g.fillStyle = '#fff'; g.font = '900 10px ui-rounded, system-ui, sans-serif'; g.textAlign = 'center'; g.fillText(((k % 2) + 2) % 2 ? 'THE SCENERY SHOP 🌿' : 'URBAN SHOPPER', x + 79, gy - 47, 144);
      stall(g, x + 210, gy, 100, '#d32f2f', 'POFFERTJES', true);
      g.fillStyle = '#2e7d32'; g.beginPath(); g.arc(x + 350, gy - 12, 12, Math.PI, 0); g.fill(); g.fillStyle = '#2e7d32'; g.beginPath(); g.moveTo(x + 330, gy - 30); g.lineTo(x + 350, gy - 44); g.lineTo(x + 370, gy - 30); g.fill(); // Sonnenschirm
      g.fillStyle = '#555'; g.fillRect(x + 349, gy - 30, 2, 30);
    }
    // Ketelhuisplein: helle Betonplatten
    ground(g, V, '#d8d2c4', '#bfb8a8', off, () => { g.strokeStyle = 'rgba(0,0,0,0.1)'; g.lineWidth = 1; for (let i = 0; i < V.w / 36 + 2; i++) { const x = i * 36 - wrap(off, 36); g.beginPath(); g.moveTo(x, V.groundY + 3); g.lineTo(x - 14, V.h); g.stroke(); } for (const y of [14, 32, 52]) { g.beginPath(); g.moveTo(0, V.groundY + y); g.lineTo(V.w, V.groundY + y); g.stroke(); } });
  },

  // Antwerpen am Abend: Grote Markt, Stadhuis, Brabo-Brunnen, Kathedrale, Weihnachtsmarkt, Riesenrad, Fritkot
  rt_xmas(g, V, off, t) {
    const gy = V.groundY;
    sky(g, V, '#1b2152', '#6a4f8f');
    antwerpSkyline(g, V, off, gy + 40, '#cfc6b4', true, 0.8);
    // Riesenrad
    const rx = wrap(-off * 0.1 + 1100, 1700) - 300, rr = 70;
    g.strokeStyle = 'rgba(255,255,255,0.7)'; g.lineWidth = 2; g.beginPath(); g.arc(rx, gy - 110, rr, 0, TAU); g.stroke();
    g.beginPath(); g.moveTo(rx - 30, gy - 30); g.lineTo(rx, gy - 110); g.lineTo(rx + 30, gy - 30); g.stroke();
    for (let i = 0; i < 12; i++) { const a = t * 0.3 + i * TAU / 12; g.beginPath(); g.moveTo(rx, gy - 110); g.lineTo(rx + Math.cos(a) * rr, gy - 110 + Math.sin(a) * rr); g.stroke(); g.fillStyle = i % 2 ? '#ff8a80' : '#fff59d'; g.beginPath(); g.arc(rx + Math.cos(a) * rr, gy - 110 + Math.sin(a) * rr, 4, 0, TAU); g.fill(); }
    // Gildehäuser mit Treppengiebeln und goldenen Figuren
    const hc = ['#e8d5b7', '#c9a27c', '#d98f7a', '#f2e6d0', '#9fb3c8', '#bfa58a'];
    for (let k = -1; k < V.w / 70 + 2; k++) {
      const x = k * 70 - wrap(off * 0.3, 70), h = 110 + (((k * 29) % 40) + 40) % 40;
      g.fillStyle = hc[((k % 6) + 6) % 6];
      g.beginPath(); g.moveTo(x, gy); g.lineTo(x, gy - h);
      for (let s = 0; s < 4; s++) { g.lineTo(x + s * 8, gy - h - s * 9); g.lineTo(x + s * 8 + 8, gy - h - s * 9); }
      g.lineTo(x + 35, gy - h - 36); for (let s = 3; s >= 0; s--) { g.lineTo(x + 70 - s * 8 - 8, gy - h - s * 9); g.lineTo(x + 70 - s * 8, gy - h - s * 9); }
      g.lineTo(x + 70, gy); g.fill();
      g.fillStyle = '#ffd23f'; g.beginPath(); g.arc(x + 35, gy - h - 40, 3.5, 0, TAU); g.fill(); g.fillRect(x + 33.5, gy - h - 38, 3, 6);
      g.fillStyle = '#ffe082'; for (let r = 0; r < 3; r++) for (let i = 0; i < 3; i++) g.fillRect(x + 10 + i * 20, gy - h + 10 + r * 30, 10, 16);
    }
    // Brabo-Brunnen: Figur wirft die Hand
    const bx = wrap(-off * 0.45 + 300, 1300) - 200;
    g.fillStyle = '#5f6b72'; g.beginPath(); g.moveTo(bx - 30, gy - 10); g.lineTo(bx - 10, gy - 70); g.lineTo(bx + 10, gy - 70); g.lineTo(bx + 30, gy - 10); g.fill();
    g.fillStyle = '#3e4a50'; g.fillRect(bx - 4, gy - 104, 8, 34); g.beginPath(); g.arc(bx, gy - 110, 6, 0, TAU); g.fill();
    g.strokeStyle = '#3e4a50'; g.lineWidth = 4; g.beginPath(); g.moveTo(bx, gy - 98); g.lineTo(bx + 14, gy - 120); g.stroke();
    g.fillStyle = '#3e4a50'; g.beginPath(); g.arc(bx + 16, gy - 124, 5, 0, TAU); g.fill();
    g.fillStyle = 'rgba(140,200,255,0.6)'; for (let i = 0; i < 6; i++) { g.beginPath(); g.arc(bx - 24 + i * 10, gy - 14 - Math.abs(Math.sin(t * 3 + i)) * 6, 2, 0, TAU); g.fill(); }
    // Weihnachtsmarkt-Hütten + Fritkot
    for (let k = -1; k < V.w / 260 + 2; k++) {
      const x = k * 260 - wrap(off * 0.55, 260) + 40;
      stall(g, x, gy, 100, '#2e7d32', ['GLÜHWEIN', 'FRITKOT', 'SPECULOOS', 'WAFELS'][((k % 4) + 4) % 4], true);
    }
    fairyLights(g, V, off, t, gy - 170);
    snow(g, V, off, t);
    cobbles(g, V, off, '#8d8d99', '#f5f5f5');
  },

  // Kloosterstraat: Altbauten mit Vintage-Möbelläden, Stühle vor der Tür
  rt_kloster(g, V, off, t) {
    const gy = V.groundY;
    sky(g, V, '#6fa3d6', '#f3e6cf'); clouds(g, V, off, 0.75);
    antwerpSkyline(g, V, off, gy + 20, '#efd9a6', false, 0.75);
    const walls = ['#d9cbb4', '#b9a58c', '#e6ddd0', '#8c7d6b', '#cfd6da'];
    const shops = ['VINTAGE', 'ANTIEK', 'DESIGN', 'BROCANTE', 'MID-CENTURY'];
    for (let k = -1; k < V.w / 120 + 2; k++) {
      const x = k * 120 - wrap(off * 0.35, 120), i = ((k % 5) + 5) % 5, h = 170 + (i % 3) * 12;
      g.fillStyle = walls[i]; g.fillRect(x, gy - h, 116, h);
      g.fillStyle = '#5d5248'; g.fillRect(x, gy - h, 116, 6);
      g.fillStyle = '#e6eef3'; for (let r = 0; r < 2; r++) for (let c = 0; c < 3; c++) { g.fillRect(x + 12 + c * 34, gy - h + 18 + r * 40, 22, 28); }
      g.fillStyle = '#2f2a26'; g.fillRect(x + 6, gy - 82, 104, 82);
      g.fillStyle = '#f3e7cf'; g.fillRect(x + 10, gy - 70, 70, 60);
      // Möbel im Schaufenster
      g.fillStyle = '#a0522d'; g.fillRect(x + 16, gy - 34, 26, 4); g.fillRect(x + 18, gy - 30, 3, 18); g.fillRect(x + 37, gy - 30, 3, 18); g.fillRect(x + 18, gy - 52, 3, 20);
      g.fillStyle = '#e0b04a'; g.beginPath(); g.moveTo(x + 52, gy - 58); g.lineTo(x + 70, gy - 58); g.lineTo(x + 64, gy - 66); g.lineTo(x + 58, gy - 66); g.fill(); g.fillStyle = '#555'; g.fillRect(x + 60, gy - 58, 2, 46);
      g.fillStyle = '#8d6e63'; g.fillRect(x + 84, gy - 70, 20, 70);
      g.fillStyle = '#fff'; g.font = '900 9px ui-rounded, system-ui, sans-serif'; g.textAlign = 'center'; g.fillText(shops[i], x + 58, gy - 74, 100);
      g.fillStyle = ['#2e7d32', '#8e2b2b', '#1f3b57'][i % 3]; g.beginPath(); g.moveTo(x + 6, gy - 86); g.lineTo(x + 110, gy - 86); g.lineTo(x + 116, gy - 96); g.lineTo(x, gy - 96); g.fill();
    }
    g.fillStyle = 'rgba(0,0,0,0.75)'; g.font = '900 12px sans-serif'; g.textAlign = 'center';
    const st = wrap(-off * 0.35 + 300, 900) - 100; g.fillStyle = '#1a3c6e'; roundRect(g, st, gy - 210, 96, 18, 3); g.fill(); g.fillStyle = '#fff'; g.fillText('Kloosterstraat', st + 48, gy - 197, 90);
    cobbles(g, V, off, '#77706a', '#a7a29c', 16);
  },

  // Graanmarkt 13 (Stadthaus) + Bourla-Theater + St. Vincents (alte Druckerei) + Waffelstand
  rt_concept(g, V, off, t) {
    const gy = V.groundY;
    sky(g, V, '#6fa3d6', '#f3e6cf'); clouds(g, V, off, 0.7);
    antwerpSkyline(g, V, off, gy + 20, '#efd9a6', false, 0.75);
    const seg = 760;
    for (let k = -1; k < V.w / seg + 2; k++) {
      const x = k * seg - wrap(off * 0.32, seg);
      // Bourla: rundes klassizistisches Theater mit Säulen
      g.fillStyle = '#d8cdb8'; g.fillRect(x, gy - 150, 190, 150);
      g.fillStyle = '#c4b79e'; g.fillRect(x, gy - 160, 190, 12);
      g.fillStyle = '#efe8da'; for (let i = 0; i < 8; i++) g.fillRect(x + 10 + i * 23, gy - 140, 9, 120);
      g.fillStyle = '#7d6a4f'; for (let i = 0; i < 7; i++) g.fillRect(x + 21 + i * 23, gy - 120, 11, 30);
      g.fillStyle = '#5d4b33'; g.font = '900 10px serif'; g.textAlign = 'center'; g.fillText('BOURLA', x + 95, gy - 148);
      // Graanmarkt 13: elegantes weißes Stadthaus, große Fenster, Dachgarten
      const gx = x + 220;
      g.fillStyle = '#f2efe9'; g.fillRect(gx, gy - 200, 150, 200);
      g.fillStyle = '#4caf50'; for (let i = 0; i < 6; i++) { g.beginPath(); g.arc(gx + 12 + i * 25, gy - 204, 11, 0, TAU); g.fill(); }
      g.fillStyle = '#2b2b2b'; for (let r = 0; r < 3; r++) for (let c = 0; c < 3; c++) g.fillRect(gx + 16 + c * 45, gy - 186 + r * 48, 30, 38);
      g.fillStyle = '#cfe0ea'; for (let r = 0; r < 3; r++) for (let c = 0; c < 3; c++) g.fillRect(gx + 19 + c * 45, gy - 183 + r * 48, 24, 32);
      g.fillStyle = '#1d1d1d'; g.fillRect(gx + 10, gy - 52, 130, 52); g.fillStyle = '#e9dcc5'; g.fillRect(gx + 16, gy - 46, 80, 40);
      g.fillStyle = '#1d1d1d'; g.font = '700 10px sans-serif'; g.fillText('GRAANMARKT 13', gx + 75, gy - 56, 130);
      // St. Vincents: alte Druckerei, Backstein, Rundbogenfenster
      const vx = x + 400;
      g.fillStyle = '#9b5a43'; g.fillRect(vx, gy - 170, 170, 170);
      g.fillStyle = '#7d4635'; g.fillRect(vx, gy - 176, 170, 8);
      for (let i = 0; i < 3; i++) {
        const wx = vx + 16 + i * 52;
        g.fillStyle = '#2d2a28'; g.fillRect(wx, gy - 140, 38, 70); g.beginPath(); g.arc(wx + 19, gy - 140, 19, Math.PI, 0); g.fill();
        g.fillStyle = '#f0e2c6'; g.fillRect(wx + 3, gy - 137, 32, 64); g.beginPath(); g.arc(wx + 19, gy - 137, 16, Math.PI, 0); g.fill();
        g.fillStyle = ['#c0504d', '#7f9c78', '#d9a066'][i]; g.fillRect(wx + 8, gy - 100, 22, 26); g.fillStyle = '#333'; g.fillRect(wx + 18, gy - 128, 2, 20); g.beginPath(); g.arc(wx + 19, gy - 106, 6, Math.PI, 0); g.fill();
      }
      g.fillStyle = '#2d2a28'; g.fillRect(vx + 60, gy - 56, 50, 56);
      g.fillStyle = '#fff'; g.font = 'italic 700 12px serif'; g.fillText('st. vincents', vx + 85, gy - 152);
      // Waffelstand
      stall(g, x + 600, gy, 110, '#f9a825', 'WAFELS', false);
    }
    cobbles(g, V, off, '#8f8a83', '#b3ada6', 18);
  },
};
PAINT.rt_ahxl = (g, V, off, t) => bgRT.ahxl(g, V, off, t);
Object.assign(bgRT, PAINT);

// ---------------------------------------------------------------------------
// Neue Hindernisse
// ---------------------------------------------------------------------------
Object.assign(OBS, {
  suitcase: {
    make: (o) => { o.w = 30; o.rects.push({ x: 2, w: 26, y0: 0, y1: 34 }); },
    draw: (g, x, b) => {
      g.fillStyle = '#1565c0'; roundRect(g, x + 2, b - 34, 26, 32, 4); g.fill();
      g.strokeStyle = '#0d47a1'; g.lineWidth = 1.2; for (let i = 1; i < 4; i++) { g.beginPath(); g.moveTo(x + 2 + i * 6.5, b - 32); g.lineTo(x + 2 + i * 6.5, b - 4); g.stroke(); }
      g.strokeStyle = '#424242'; g.lineWidth = 2; g.beginPath(); g.moveTo(x + 10, b - 34); g.lineTo(x + 10, b - 42); g.lineTo(x + 20, b - 42); g.lineTo(x + 20, b - 34); g.stroke();
      g.fillStyle = '#212121'; g.beginPath(); g.arc(x + 7, b - 1.5, 2, 0, TAU); g.arc(x + 23, b - 1.5, 2, 0, TAU); g.fill();
      g.fillStyle = '#ffd23f'; g.fillRect(x + 6, b - 26, 8, 5);
    },
  },
  klomp: {
    make: (o) => { o.w = 34; o.rects.push({ x: 0, w: 34, y0: 0, y1: 18 }); },
    draw: (g, x, b) => {
      g.fillStyle = '#ffca28'; g.beginPath(); g.moveTo(x, b - 2); g.quadraticCurveTo(x - 2, b - 14, x + 8, b - 16); g.lineTo(x + 26, b - 18); g.quadraticCurveTo(x + 36, b - 16, x + 34, b - 4); g.quadraticCurveTo(x + 18, b + 2, x, b - 2); g.fill();
      g.fillStyle = '#5d4037'; g.beginPath(); g.ellipse(x + 23, b - 15, 7, 3, 0, 0, TAU); g.fill();
      g.strokeStyle = '#e53935'; g.lineWidth = 1.5; g.beginPath(); g.moveTo(x + 4, b - 9); g.quadraticCurveTo(x + 10, b - 13, x + 16, b - 9); g.stroke();
      g.fillStyle = '#e53935'; g.beginPath(); g.arc(x + 10, b - 9, 2, 0, TAU); g.fill();
    },
  },
  scrapcab: { // Schrotholz-Schrank à la Piet Hein Eek
    make: (o) => { o.w = 34; o.rects.push({ x: 1, w: 32, y0: 0, y1: 56 }); },
    draw: (g, x, b) => {
      const woods = ['#b07a4a', '#d9a066', '#7f5539', '#e6c79c', '#9c6b43', '#5e8c6a', '#c0504d', '#8aa1b1'];
      g.fillStyle = '#3e2723'; g.fillRect(x + 1, b - 56, 32, 54);
      for (let r = 0; r < 9; r++) { let cx = x + 2; let c = 0; while (cx < x + 32) { const w = 5 + ((r * 7 + c * 3) % 4) * 2; g.fillStyle = woods[(r * 5 + c * 3) % 8]; g.fillRect(cx, b - 55 + r * 6, Math.min(w, x + 32 - cx), 5); cx += w + 0.6; c++; } }
      g.fillStyle = 'rgba(255,255,255,0.18)'; g.fillRect(x + 2, b - 55, 3, 52);
      g.fillStyle = '#3e2723'; g.fillRect(x + 16.5, b - 56, 1.2, 54); g.fillRect(x + 3, b - 2, 4, 2); g.fillRect(x + 27, b - 2, 4, 2);
    },
  },
  planks: {
    make: (o) => { o.w = 44; o.rects.push({ x: 0, w: 44, y0: 0, y1: 22 }); },
    draw: (g, x, b) => {
      const woods = ['#b07a4a', '#d9a066', '#7f5539', '#e6c79c'];
      for (let r = 0; r < 4; r++) { g.fillStyle = woods[r]; g.fillRect(x + (r % 2) * 3, b - 5 - r * 5.5, 44 - (r % 2) * 5, 5); g.fillStyle = 'rgba(0,0,0,0.2)'; g.fillRect(x + 6 + r * 7, b - 4 - r * 5.5, 2, 2); }
    },
  },
  plant: { // Monstera im Topf (The Scenery Shop)
    make: (o) => { o.w = 34; o.rects.push({ x: 6, w: 22, y0: 0, y1: 46 }); },
    draw: (g, x, b, o) => {
      g.fillStyle = '#c8b29a'; g.beginPath(); g.moveTo(x + 6, b - 18); g.lineTo(x + 28, b - 18); g.lineTo(x + 25, b); g.lineTo(x + 9, b); g.fill();
      const sw = Math.sin((o?.t || 0) * 2) * 0.08;
      for (let i = 0; i < 5; i++) {
        g.save(); g.translate(x + 17, b - 18); g.rotate(-1.1 + i * 0.55 + sw);
        g.fillStyle = i % 2 ? '#2e7d32' : '#43a047'; g.beginPath(); g.ellipse(0, -18, 8, 14, 0, 0, TAU); g.fill();
        g.strokeStyle = '#1b5e20'; g.lineWidth = 1; g.beginPath(); g.moveTo(0, -4); g.lineTo(0, -30); g.stroke();
        g.fillStyle = '#e9e4da'; g.fillRect(-7, -20, 4, 1.5); g.fillRect(3, -16, 4, 1.5);
        g.restore();
      }
    },
  },
  hand: { // Brabo hat die Riesenhand geworfen 🖐️ (fliegt)
    fly: true,
    draw: (g, x, b, o) => {
      const y = b - 16;
      g.save(); g.translate(x + 18, y); g.rotate(o.t * 5);
      g.fillStyle = '#f2c9a0'; roundRect(g, -10, -8, 20, 18, 6); g.fill();
      for (let i = 0; i < 4; i++) { roundRect(g, -9 + i * 5, -20, 4.2, 14, 2); g.fill(); }
      g.beginPath(); g.ellipse(-13, 0, 4, 7, -0.6, 0, TAU); g.fill();
      g.strokeStyle = '#c99a72'; g.lineWidth = 1; g.beginPath(); g.moveTo(-6, 4); g.quadraticCurveTo(0, 7, 6, 4); g.stroke();
      g.restore();
    },
  },
});

// ---------------------------------------------------------------------------
// Neue Items: Salamisticks & Red Bull (Autobahn), Kaffee, Appeltaart, Kaas, Hagelslag
// ---------------------------------------------------------------------------
Object.assign(ITEM_ICONS, {
  salami: (g) => {
    g.save(); g.rotate(-0.5);
    for (const [dx, c] of [[-4, '#8e2b2b'], [0, '#a63a32'], [4, '#7b2424']]) {
      g.fillStyle = c; roundRect(g, dx - 2, -13, 4, 24, 2); g.fill();
      g.fillStyle = 'rgba(255,255,255,0.45)'; for (let k = -10; k < 9; k += 4) { g.beginPath(); g.arc(dx - 0.5, k, 0.7, 0, TAU); g.fill(); }
    }
    g.fillStyle = '#e53935'; g.fillRect(-7, 2, 14, 9); g.fillStyle = '#fff'; g.font = '900 4px sans-serif'; g.textAlign = 'center'; g.fillText('SALAMI', 0, 8);
    g.restore();
  },
  redbull: (g, t) => {
    g.save(); g.rotate(Math.sin(t * 3) * 0.15);
    g.fillStyle = '#b0bec5'; roundRect(g, -6, -13, 12, 26, 2.5); g.fill();
    g.fillStyle = '#1a3c8f'; for (let r = 0; r < 4; r++) for (let c = 0; c < 2; c++) if ((r + c) % 2 === 0) g.fillRect(-6 + c * 6, -13 + r * 6.5, 6, 6.5);
    g.fillStyle = '#ffd23f'; g.beginPath(); g.arc(0, -1, 3.2, 0, TAU); g.fill();
    g.fillStyle = '#e53935'; g.beginPath(); g.moveTo(-5, 2); g.lineTo(-1, -2); g.lineTo(-1, 3); g.fill(); g.beginPath(); g.moveTo(5, 2); g.lineTo(1, -2); g.lineTo(1, 3); g.fill();
    g.fillStyle = '#90a4ae'; g.fillRect(-6, -13, 12, 2); g.fillRect(-6, 11, 12, 2);
    g.restore();
  },
  coffee: (g) => {
    g.fillStyle = '#fafafa'; g.beginPath(); g.moveTo(-7, -9); g.lineTo(7, -9); g.lineTo(5, 11); g.lineTo(-5, 11); g.fill();
    g.fillStyle = '#6d4c41'; g.fillRect(-7, -1, 14, 6);
    g.fillStyle = '#424242'; roundRect(g, -8, -13, 16, 5, 2); g.fill();
    g.strokeStyle = 'rgba(255,255,255,0.8)'; g.lineWidth = 1.2; g.beginPath(); g.moveTo(-2, -15); g.quadraticCurveTo(-5, -19, -1, -22); g.moveTo(3, -15); g.quadraticCurveTo(0, -19, 4, -22); g.stroke();
  },
  appeltaart: (g) => {
    g.fillStyle = '#fafafa'; g.beginPath(); g.ellipse(0, 8, 13, 3.5, 0, 0, TAU); g.fill();
    g.fillStyle = '#d4a056'; g.beginPath(); g.moveTo(-11, 6); g.lineTo(11, 6); g.lineTo(9, -6); g.lineTo(-9, -6); g.fill();
    g.fillStyle = '#b7782f'; for (let i = -8; i < 9; i += 4) g.fillRect(i, -6, 2, 12);
    g.fillStyle = '#fff'; g.beginPath(); g.arc(4, -8, 4, 0, TAU); g.arc(8, -7, 3, 0, TAU); g.fill();
  },
  kaas: (g) => {
    g.fillStyle = '#ffca28'; g.beginPath(); g.moveTo(-12, 8); g.lineTo(12, 8); g.lineTo(12, -2); g.lineTo(-12, -8); g.fill();
    g.fillStyle = '#ffb300'; g.fillRect(-12, 4, 24, 4);
    g.fillStyle = '#f9a825'; for (const [cx, cy, r] of [[-5, 0, 2], [3, 2, 1.6], [7, -1, 1.2]]) { g.beginPath(); g.arc(cx, cy, r, 0, TAU); g.fill(); }
    g.fillStyle = '#c62828'; g.fillRect(-12, 6, 24, 2);
  },
  hagelslag: (g) => {
    g.fillStyle = '#fff8e1'; roundRect(g, -8, -12, 16, 24, 2); g.fill();
    g.fillStyle = '#5d4037'; g.fillRect(-8, -12, 16, 7);
    g.fillStyle = '#3e2723'; for (let i = 0; i < 10; i++) g.fillRect(-6 + (i * 5) % 12, -1 + ((i * 7) % 10), 2.6, 1.2);
    g.fillStyle = '#fff'; g.font = '900 3.6px sans-serif'; g.textAlign = 'center'; g.fillText('HAGELSLAG', 0, -7);
  },
});
