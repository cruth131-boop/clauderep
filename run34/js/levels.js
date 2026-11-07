// Level-Modus: Szenen (Hintergründe nach echten Orten), Emoji-Hindernisse, Items, Level-Definitionen.
// Namen, Texte und Gäste stehen NICHT hier, sondern verschlüsselt in der privaten Config (config.levels).
import { roundRect, star } from './character.js';
import { OBS, ITEM_ICONS, drawAnyBiomeBg, drawMonkey } from './biomes.js';
import { drawFaceOn } from './character.js';
import { emoji } from './emoji.js';
import { assets } from './assets.js';
export { emoji };

const wrap = (v, m) => ((v % m) + m) % m;
const TAU = Math.PI * 2;

function label(g, text, x, y, size = 8, col = '#fff', bg = '#c0392b') {
  g.font = `900 ${size}px ui-rounded, system-ui, sans-serif`; g.textAlign = 'center';
  const w = g.measureText(text).width + 6;
  g.fillStyle = bg; roundRect(g, x - w / 2, y - size, w, size + 4, 3); g.fill();
  g.fillStyle = col; g.fillText(text, x, y + 1);
}

// ---------------------------------------------------------------------------
// Emoji-Hindernisse: [Zeichen, Größe, Optionen]
//   fly: fliegt (Ducken/Springen), move: Eigengeschwindigkeit, stack: übereinander, lab: Schild, spin: rollt
// ---------------------------------------------------------------------------
const EO = {
  gator: ['🐊', 64, { draw: 'gator', move: 45 }], knee: ['🪵', 34, { draw: 'knee' }], mosquito: ['🦟', 24, { fly: 1 }],
  wool: ['🧶', 28, { spin: 1, move: 40 }], teapot: ['🫖', 30], slipper: ['🩴', 26], couch: ['🛋️', 40], pillows: ['🛏️', 36],
  bobbycar: ['🚗', 32, { move: 70, flip: 1 }], football: ['⚽', 24, { spin: 1, move: 110 }], bucket: ['🪣', 26],
  schoolbag: ['🎒', 32], trafficlight: ['🚦', 34, { tall: 1 }], lift: ['🛗', 36], sale: ['🏷️', 30, { lab: '-50%' }],
  balloon: ['🎈', 30, { fly: 1 }], invoice: ['🧾', 32, { lab: 'MAHNUNG' }], piggy: ['🐷', 32], cash: ['💸', 30, { fly: 1 }],
  car: ['🚙', 40, { move: 120, flip: 1 }], barstool: ['🪑', 32], bottle: ['🍾', 30, { fly: 1 }], trays: ['🍽️', 30, { stack: 2 }],
  log: ['🪵', 32], tp: ['🧻', 28, { stack: 2 }], books: ['📚', 30, { stack: 2 }], exam: ['📝', 28, { fly: 1 }],
  bench: ['🪑', 34], tray: ['🍱', 30], paragraph: ['§', 30, { fly: 1, text: '#c0392b' }], pubtable: ['🍺', 30, { stack: 2 }],
  fog: ['🌫️', 34, { fly: 1 }], bouncer: ['🕴️', 44], gift: ['🎁', 30, { stack: 2 }], winebottle: ['🍾', 30, { rot: 1.4 }],
  maß: ['🍺', 32], carousel: ['🎠', 44], lebkuchen: ['💝', 28, { fly: 1 }], sandcastle: ['🏰', 34], crab: ['🦀', 28, { move: 50 }],
  gull: ['🕊️', 30, { fly: 1 }], wave: ['🌊', 36, { move: 40 }], vespa: ['🛵', 38, { move: 150, flip: 1 }],
  kamelle: ['🍬', 26, { fly: 1 }], confetti: ['🎉', 30], dancer: ['💃', 42], dice: ['🎲', 32], robber: ['♟️', 36], cards: ['🃏', 28, { fly: 1 }],
  jeep: ['🚙', 42, { move: 90, flip: 1 }], zebra: ['🦓', 42, { move: 40, flip: 1 }], taxi: ['🚕', 42, { move: 110, flip: 1 }],
  skater: ['⛸️', 28, { move: 90 }], smalltree: ['🎄', 36], hydrant: ['🧯', 28], logs: ['🪵', 30, { stack: 2 }], smoke: ['💨', 32, { fly: 1 }],
  glitterbomb: ['✨', 30, { fly: 1 }], pizzaboxes: ['📦', 28, { stack: 2 }], hay: ['🌾', 34], dancers: ['🕺', 42], bouquet: ['💐', 28, { fly: 1 }],
  pan: ['🍳', 30], waiter: ['🤵', 44], bubble: ['💬', 30, { fly: 1 }], trumpet: ['🎺', 30], drum: ['🥁', 34], sax: ['🎷', 30, { fly: 1 }],
  guitar: ['🎸', 34], dicecup: ['🥤', 28], slot: ['🎰', 40], cheesewheel: ['🧀', 28, { spin: 1, move: 80 }], winestand: ['🍷', 30, { stack: 2 }],
  flowerpot: ['🪴', 32], weizen: ['🍺', 32], ouzo: ['🥃', 26, { stack: 2 }], teddy: ['🧸', 30], toytrain: ['🚂', 34, { move: 80, flip: 1 }],
  roaster: ['🍗', 30], cactus: ['🌵', 42], bull: ['🐂', 42, { move: 60, flip: 1 }], tumbleweed: ['🟤', 26, { spin: 1, move: 130, draw: 'tumble' }],
  laundry: ['🧺', 30], sheep: ['🐑', 34, { move: 30, flip: 1 }], rain: ['🌧️', 34, { fly: 1 }], nessie: ['🦕', 44], leftcar: ['🚗', 40, { move: 230 }],
  leaf: ['🍃', 28, { fly: 1 }], lavalamp: ['🪔', 30], chipsbag: ['🍟', 28], ghost2: ['👻', 32, { fly: 1 }], candlebig: ['🕯️', 32],
  puddle: ['💧', 30, { draw: 'puddle' }], hayball: ['🌾', 34, { draw: 'hay' }], laser: ['', 40, { fly: 1, draw: 'laser' }], kettle: ['🍲', 30, { draw: 'kettle' }],
  bembel: ['', 30, { draw: 'bembel' }], snowpile: ['', 34, { draw: 'snow' }], wall: ['', 40, { draw: 'wall' }], shirtrack: ['', 40, { draw: 'rack' }],
  facewalk: ['', 32, { draw: 'facewalk', move: 30 }], facefly: ['', 32, { fly: 1, draw: 'facefly' }], umbrella: ['⛱️', 40], pumpkin: ['🎃', 30],
  skull: ['💀', 28], fish2: ['🐟', 28, { move: 60 }], bolt: ['⚡', 30, { fly: 1 }],
  snowman: ['☃️', 36], grade6: ['6', 30, { fly: 1, text: '#c0392b' }], chartfly: ['📉', 30, { fly: 1 }], target: ['🎯', 32], clown: ['🤡', 34],
  flyball: ['🎊', 30, { fly: 1 }], hourfly: ['⏳', 28, { fly: 1 }], rocking: ['🐴', 34], dartboard: ['🎯', 30, { fly: 1 }],
  creuset: ['', 34, { draw: 'creuset' }], ice4: ['', 32, { draw: 'ice4' }], stinklaundry: ['', 34, { draw: 'stinklaundry' }], wheelbarrow: ['', 40, { draw: 'wheelbarrow' }], nutcracker: ['', 30, { draw: 'nutcracker', tall: 1 }], penguin: ['🐧', 30, { move: 35, flip: 1 }], parade: ['', 30, { draw: 'parade', move: 25 }], winebarrel: ['', 34, { draw: 'winebarrel' }], grapecrate: ['', 30, { draw: 'grapecrate' }], minibus: ['🚐', 42, { move: 140, flip: 1 }], boulder: ['🪨', 34], baboon: ['🐒', 32, { move: 70, flip: 1 }], surfboard: ['🏄', 36], smoker: ['', 46, { draw: 'smokerObs' }], pepperbox: ['', 30, { draw: 'pepperbox' }],
  pizzatower: ['', 34, { draw: 'pizzatower' }], griess: ['', 34, { draw: 'griess' }], weedleaf: ['', 32, { fly: 1, draw: 'weedleaf' }], lava: ['', 30, { draw: 'lava' }], couchG: ['🛋️', 40],
};
// Gusseisen-Bräter (rot, Verlauf nach unten dunkler, Griffe & Knauf) – x = Mitte, y = Boden
export function drawCocotte(g, x, y, s = 1, t = 0, steam = true) {
  g.save(); g.translate(x, y); g.scale(s, s);
  const bg = g.createLinearGradient(0, -26, 0, 0); bg.addColorStop(0, '#ff5a3c'); bg.addColorStop(0.55, '#d8261b'); bg.addColorStop(1, '#5e0d0a');
  g.fillStyle = '#2a0a08'; roundRect(g, -20, -4, 40, 4, 2); g.fill();
  g.fillStyle = bg; g.beginPath(); g.moveTo(-19, -22); g.quadraticCurveTo(-21, -2, -14, 0); g.lineTo(14, 0); g.quadraticCurveTo(21, -2, 19, -22); g.closePath(); g.fill();
  for (const sx of [-1, 1]) { g.fillStyle = '#b81f16'; g.beginPath(); g.ellipse(sx * 22, -16, 4.5, 3, 0, 0, TAU); g.fill(); g.fillStyle = '#3a0907'; g.beginPath(); g.ellipse(sx * 22, -16, 2, 1.3, 0, 0, TAU); g.fill(); }
  const lg = g.createLinearGradient(0, -32, 0, -21); lg.addColorStop(0, '#ff6b4a'); lg.addColorStop(1, '#c4231a');
  g.fillStyle = lg; g.beginPath(); g.ellipse(0, -22, 21, 6, 0, Math.PI, 0); g.fill(); g.fillRect(-21, -23, 42, 2.5);
  g.fillStyle = '#c9c9cf'; roundRect(g, -4, -33, 8, 5, 2); g.fill(); g.fillStyle = '#8a8a92'; g.fillRect(-2, -29, 4, 2.5); // Knauf
  g.fillStyle = 'rgba(255,255,255,0.35)'; g.beginPath(); g.ellipse(-10, -14, 2.5, 6, 0.3, 0, TAU); g.fill();
  if (steam) { g.fillStyle = 'rgba(255,255,255,0.45)'; for (let i = 0; i < 3; i++) { const k = (((t * 0.8 + i / 3) % 1) + 1) % 1; g.beginPath(); g.arc(Math.sin(t * 2 + i) * 6, -36 - k * 26, 3 + k * 4, 0, TAU); g.fill(); } }
  g.restore();
}
// Rote Spitzpaprika / Gemüsepaprika
export function drawPaprika(g, x, y, s = 1, col = '#e0281e', rot = 0) {
  g.save(); g.translate(x, y); g.rotate(rot); g.scale(s, s);
  const pg = g.createRadialGradient(-3, -3, 1, 0, 0, 10); pg.addColorStop(0, col === '#e0281e' ? '#ff6b5e' : '#fff3a0'); pg.addColorStop(1, col);
  g.fillStyle = pg; g.beginPath(); g.moveTo(0, -8); g.bezierCurveTo(9, -9, 10, 4, 4, 9); g.quadraticCurveTo(0, 11, -4, 9); g.bezierCurveTo(-10, 4, -9, -9, 0, -8); g.fill();
  g.strokeStyle = 'rgba(0,0,0,0.18)'; g.lineWidth = 0.8; g.beginPath(); g.moveTo(0, -6); g.quadraticCurveTo(1, 2, 0, 9); g.stroke();
  g.fillStyle = '#2e7d32'; g.fillRect(-1.2, -12, 2.4, 5); g.beginPath(); g.ellipse(0, -8, 4, 1.6, 0, 0, TAU); g.fill();
  g.restore();
}
// Offset-Smoker: liegendes Garfass auf Beinen, Brennkammer seitlich, Kamin mit Rauch
export function drawSmoker(g, x, y, s = 1, t = 0) {
  g.save(); g.translate(x, y); g.scale(s, s);
  g.strokeStyle = '#1b1b1e'; g.lineWidth = 3; for (const lx of [-34, 30]) { g.beginPath(); g.moveTo(lx, -26); g.lineTo(lx, 0); g.stroke(); }
  g.fillStyle = '#2b2b30'; g.beginPath(); g.arc(-34, -2, 5, 0, TAU); g.fill(); g.fillStyle = '#777'; g.beginPath(); g.arc(-34, -2, 1.8, 0, TAU); g.fill();
  g.fillStyle = '#5d4037'; g.fillRect(-38, -14, 72, 3); // Ablage
  const bg = g.createLinearGradient(0, -52, 0, -24); bg.addColorStop(0, '#4a4a52'); bg.addColorStop(0.5, '#26262b'); bg.addColorStop(1, '#141417');
  g.fillStyle = bg; roundRect(g, -40, -52, 74, 28, 14); g.fill(); // Garkammer
  g.strokeStyle = '#0c0c0e'; g.lineWidth = 1.2; g.beginPath(); g.moveTo(-38, -39); g.lineTo(32, -39); g.stroke();
  g.strokeStyle = '#b0b0b8'; g.lineWidth = 2; g.beginPath(); g.moveTo(-14, -46); g.lineTo(6, -46); g.stroke(); // Griff
  g.fillStyle = '#e8e8ee'; g.beginPath(); g.arc(18, -45, 3.6, 0, TAU); g.fill(); g.strokeStyle = '#d32f2f'; g.lineWidth = 0.8; g.beginPath(); g.moveTo(18, -45); g.lineTo(19.8, -47.5); g.stroke(); // Thermometer
  g.fillStyle = '#1e1e22'; roundRect(g, 33, -46, 20, 22, 4); g.fill(); // Brennkammer
  g.fillStyle = `rgba(255,${120 + Math.sin(t * 9) * 40},40,0.9)`; g.fillRect(37, -34, 12, 4);
  g.fillStyle = '#1b1b1e'; g.fillRect(-44, -76, 6, 30); g.fillRect(-46, -78, 10, 3); // Kamin
  g.fillStyle = 'rgba(190,190,190,0.5)'; for (let i = 0; i < 5; i++) { const k = (((t * 0.6 + i / 5) % 1) + 1) % 1; g.beginPath(); g.arc(-41 + Math.sin(t * 2 + i) * 6 + k * 10, -82 - k * 46, 4 + k * 7, 0, TAU); g.fill(); }
  g.restore();
}
const CUSTOM = {
  gator(g, x, b, o) { // Alligator kriecht heran und schnappt
    const snap = Math.max(0, Math.sin(o.t * 5)) * 0.45, wig = Math.sin(o.t * 8) * 2;
    g.fillStyle = 'rgba(0,0,0,0.2)'; g.beginPath(); g.ellipse(x + 34, b - 1, 32, 3, 0, 0, TAU); g.fill();
    g.fillStyle = '#4f6b2f'; g.beginPath(); g.moveTo(x + 60, b - 6); g.quadraticCurveTo(x + 76, b - 8 + wig, x + 86, b - 3); g.quadraticCurveTo(x + 72, b - 2, x + 58, b - 2); g.fill(); // Schwanz
    g.beginPath(); g.ellipse(x + 40, b - 8, 22, 7, 0, 0, TAU); g.fill();
    g.fillStyle = '#3e5524'; for (let i = 0; i < 6; i++) { g.beginPath(); g.moveTo(x + 24 + i * 7, b - 14); g.lineTo(x + 27 + i * 7, b - 18); g.lineTo(x + 30 + i * 7, b - 14); g.fill(); } // Rückenzacken
    for (const lx of [26, 50]) { g.fillStyle = '#44602a'; g.fillRect(x + lx, b - 4, 5, 4); }
    g.save(); g.translate(x + 20, b - 8); // Kopf mit Schnappmaul
    g.fillStyle = '#4f6b2f'; g.beginPath(); g.moveTo(0, 0); g.lineTo(-20, 3); g.lineTo(-20, 6); g.lineTo(0, 6); g.fill();
    g.save(); g.rotate(snap); g.beginPath(); g.moveTo(0, 0); g.lineTo(-21, -1); g.lineTo(-21, 3); g.lineTo(0, 4); g.fill();
    g.fillStyle = '#fff'; for (let i = 0; i < 5; i++) { g.beginPath(); g.moveTo(-18 + i * 4, 3); g.lineTo(-16.5 + i * 4, 5.5); g.lineTo(-15 + i * 4, 3); g.fill(); }
    g.fillStyle = '#e8d35a'; g.beginPath(); g.arc(-4, -1, 2.6, 0, TAU); g.fill(); g.fillStyle = '#111'; g.fillRect(-4.4, -2.6, 0.9, 3.4);
    g.restore();
    if (snap > 0.05) { g.fillStyle = '#c94a4a'; g.beginPath(); g.moveTo(0, 3); g.lineTo(-17, 3 - snap * 10); g.lineTo(-17, 4); g.fill(); }
    g.restore();
  },
  knee(g, x, b) { // Zypressen-Knie aus dem Sumpfboden
    for (const [dx, h, w] of [[4, 22, 9], [15, 30, 11], [27, 18, 8]]) { g.fillStyle = '#6d5236'; g.beginPath(); g.moveTo(x + dx - w / 2, b); g.quadraticCurveTo(x + dx - 2, b - h, x + dx, b - h); g.quadraticCurveTo(x + dx + 2, b - h, x + dx + w / 2, b); g.fill(); g.fillStyle = 'rgba(0,0,0,0.15)'; g.fillRect(x + dx, b - h + 4, 1.4, h - 4); }
  },
  ice4(g, x, b, o) { // Eiswürfel mit eingefrorener „4“
    const cx = x + o.w / 2; const ig = g.createLinearGradient(cx - 15, b - 28, cx + 15, b); ig.addColorStop(0, '#e1f5fe'); ig.addColorStop(1, '#81d4fa');
    g.fillStyle = ig; roundRect(g, cx - 15, b - 28, 30, 28, 5); g.fill(); g.strokeStyle = 'rgba(255,255,255,0.9)'; g.lineWidth = 1.5; g.strokeRect(cx - 13, b - 26, 26, 24);
    g.fillStyle = 'rgba(198,40,40,0.85)'; g.font = '900 20px ui-rounded, system-ui, sans-serif'; g.textAlign = 'center'; g.fillText('4', cx, b - 7);
    g.fillStyle = 'rgba(255,255,255,0.8)'; g.fillRect(cx - 10, b - 24, 5, 2);
  },
  creuset(g, x, b, o) { drawCocotte(g, x + o.w / 2, b, 0.95, o.t, true); },
  stinklaundry(g, x, b, o) { // Wäschekorb mit stinkender Wäsche, grüne Mief-Wolken & Fliege
    const cx = x + o.w / 2;
    g.fillStyle = '#d9c7a3'; g.beginPath(); g.moveTo(cx - 16, b - 24); g.lineTo(cx + 16, b - 24); g.lineTo(cx + 13, b); g.lineTo(cx - 13, b); g.closePath(); g.fill();
    g.strokeStyle = '#a88b5c'; g.lineWidth = 1; for (let i = -12; i <= 12; i += 4) { g.beginPath(); g.moveTo(cx + i, b - 23); g.lineTo(cx + i * 0.85, b - 1); g.stroke(); } for (const yy of [-17, -9]) { g.beginPath(); g.moveTo(cx - 15, b + yy); g.lineTo(cx + 15, b + yy); g.stroke(); }
    [['#5c7cfa', -9, -28], ['#e64980', 2, -31], ['#fab005', 10, -27], ['#868e96', -2, -26]].forEach(([c, dx, dy]) => { g.fillStyle = c; g.beginPath(); g.ellipse(cx + dx, b + dy, 7, 4, dx * 0.05, 0, TAU); g.fill(); });
    g.fillStyle = '#e9ecef'; g.fillRect(cx + 9, b - 34, 4, 10); // Socke hängt raus
    g.strokeStyle = 'rgba(120,180,60,0.75)'; g.lineWidth = 2; for (let i = 0; i < 3; i++) { const k = (o.t * 0.8 + i / 3) % 1; g.globalAlpha = 1 - k; g.beginPath(); for (let y = 0; y < 14; y++) g.lineTo(cx - 8 + i * 8 + Math.sin(y * 0.8 + o.t * 4) * 2.5, b - 34 - k * 18 - y); g.stroke(); } g.globalAlpha = 1;
    const fx = cx + Math.sin(o.t * 5) * 12, fy = b - 44 + Math.cos(o.t * 7) * 5; g.fillStyle = '#111'; g.beginPath(); g.arc(fx, fy, 1.6, 0, TAU); g.fill(); g.fillStyle = 'rgba(200,220,255,0.8)'; g.beginPath(); g.ellipse(fx - 1.5, fy - 1.5, 1.6, 1, 0.4, 0, TAU); g.ellipse(fx + 1.5, fy - 1.5, 1.6, 1, -0.4, 0, TAU); g.fill();
  },
  wheelbarrow(g, x, b, o) { // Schubkarre mit Erde
    g.strokeStyle = '#6d4c41'; g.lineWidth = 3; g.beginPath(); g.moveTo(x + 4, b - 22); g.lineTo(x + 34, b - 14); g.stroke(); g.beginPath(); g.moveTo(x + 10, b - 14); g.lineTo(x + 8, b); g.stroke();
    g.fillStyle = '#2e7d32'; g.beginPath(); g.moveTo(x + 12, b - 28); g.lineTo(x + 40, b - 28); g.lineTo(x + 34, b - 12); g.lineTo(x + 16, b - 12); g.closePath(); g.fill();
    g.fillStyle = '#5d4037'; g.beginPath(); g.ellipse(x + 26, b - 28, 13, 4, 0, Math.PI, 0); g.fill();
    g.fillStyle = '#222'; g.beginPath(); g.arc(x + 34, b - 6, 6, 0, TAU); g.fill(); g.fillStyle = '#9e9e9e'; g.beginPath(); g.arc(x + 34, b - 6, 2.2, 0, TAU); g.fill();
  },
  nutcracker(g, x, b, o) { const cx = x + o.w / 2, s = 0.6; g.save(); g.translate(cx, b); g.scale(s, s); g.fillStyle = '#c62828'; g.fillRect(-9, -46, 18, 30); g.fillStyle = '#1a237e'; g.fillRect(-8, -16, 6, 16); g.fillRect(2, -16, 6, 16); g.fillStyle = '#ffccbc'; g.fillRect(-7, -60, 14, 14); g.fillStyle = '#fff'; g.fillRect(-7, -50, 14, 4); g.fillStyle = '#111'; g.fillRect(-8, -80, 16, 20); g.fillStyle = '#ffd740'; g.fillRect(-8, -64, 16, 3); for (const by of [-42, -34, -26]) { g.beginPath(); g.arc(0, by, 1.4, 0, TAU); g.fill(); } g.restore(); },
  parade(g, x, b, o) { for (let i = 0; i < 5; i++) { const w = Math.sin(o.t * 9 + i) * 0.18, bob = Math.abs(Math.sin(o.t * 9 + i)) * 2; emoji(g, '🐧', x + 12 + i * 26, b - 13 - bob, 26, w, true); } },
  winebarrel(g, x, b, o) { const cx = x + o.w / 2; g.fillStyle = '#8d5a33'; g.beginPath(); g.ellipse(cx, b - 16, 15, 16, 0, 0, TAU); g.fill(); g.fillStyle = '#6d4022'; for (const dy of [-26, -6]) g.fillRect(cx - 14, b + dy, 28, 3); g.strokeStyle = 'rgba(0,0,0,0.25)'; g.lineWidth = 1; for (const dx of [-8, 0, 8]) { g.beginPath(); g.moveTo(cx + dx, b - 31); g.lineTo(cx + dx, b - 1); g.stroke(); } g.fillStyle = '#7b1f3a'; g.beginPath(); g.arc(cx, b - 16, 3, 0, TAU); g.fill(); },
  grapecrate(g, x, b, o) { g.fillStyle = '#c69c6d'; g.fillRect(x + 2, b - 16, o.w - 4, 16); g.strokeStyle = '#8d6e63'; g.lineWidth = 1; for (let i = 6; i < o.w - 4; i += 6) { g.beginPath(); g.moveTo(x + i, b - 15); g.lineTo(x + i, b - 1); g.stroke(); } for (let i = 0; i < 9; i++) { g.fillStyle = i % 2 ? '#6a1b9a' : '#7b1fa2'; g.beginPath(); g.arc(x + 7 + (i % 5) * 4.5, b - 18 - Math.floor(i / 5) * 4, 3, 0, TAU); g.fill(); } },
  smokerObs(g, x, b, o) { drawSmoker(g, x + o.w / 2 - 2, b, 0.62, o.t); },
  pepperbox(g, x, b, o) { g.fillStyle = '#a1887f'; roundRect(g, x + 2, b - 16, o.w - 4, 16, 3); g.fill(); g.strokeStyle = '#6d4c41'; g.lineWidth = 1; for (let i = 6; i < o.w - 4; i += 6) { g.beginPath(); g.moveTo(x + i, b - 15); g.lineTo(x + i, b - 1); g.stroke(); } [[8, -18, '#e0281e'], [15, -21, '#ffcf33'], [22, -18, '#e0281e'], [12, -14, '#43a047']].forEach(([dx, dy, c], i) => drawPaprika(g, x + dx, b + dy, 0.75, c, i * 0.4 - 0.4)); },
  puddle(g, x, b, o) { g.fillStyle = 'rgba(80,150,230,0.85)'; g.beginPath(); g.ellipse(x + o.w / 2, b - 3, o.w / 2, 4, 0, 0, TAU); g.fill(); g.fillStyle = 'rgba(255,255,255,0.6)'; g.fillRect(x + 8, b - 5, 8, 1.5); const s = Math.sin(o.t * 6) * 2; g.strokeStyle = 'rgba(255,255,255,0.7)'; g.lineWidth = 1; g.beginPath(); g.ellipse(x + o.w * 0.6, b - 3, 4 + s, 1.5, 0, 0, TAU); g.stroke(); },
  hay(g, x, b, o) { g.fillStyle = '#e9c46a'; roundRect(g, x, b - 30, o.w, 30, 6); g.fill(); g.strokeStyle = '#c9a227'; g.lineWidth = 1.2; for (let i = 6; i < o.w; i += 6) { g.beginPath(); g.moveTo(x + i, b - 29); g.lineTo(x + i - 2, b - 1); g.stroke(); } g.strokeStyle = '#8d6e1f'; g.lineWidth = 2; g.beginPath(); g.moveTo(x, b - 20); g.lineTo(x + o.w, b - 20); g.moveTo(x, b - 10); g.lineTo(x + o.w, b - 10); g.stroke(); },
  laser(g, x, b, o) { const c = ['#ff2d55', '#3ee6b4', '#7cc6ff'][((o.t * 3) | 0) % 3]; g.save(); g.shadowColor = c; g.shadowBlur = 12; g.strokeStyle = c; g.lineWidth = 4; g.beginPath(); g.moveTo(x - 4, b - 12); g.lineTo(x + 42, b - 12); g.stroke(); g.strokeStyle = '#fff'; g.lineWidth = 1.5; g.stroke(); g.restore(); },
  kettle(g, x, b, o) { g.strokeStyle = '#3e2723'; g.lineWidth = 2.5; g.beginPath(); g.moveTo(x + 2, b); g.lineTo(x + 17, b - 46); g.lineTo(x + 32, b); g.stroke(); emoji(g, '🔥', x + 17, b - 8, 18 + Math.sin(o.t * 12) * 2); g.fillStyle = '#263238'; g.beginPath(); g.ellipse(x + 17, b - 24, 14, 10, 0, 0, Math.PI); g.fill(); g.fillRect(x + 3, b - 30, 28, 6); g.fillStyle = '#8d3b1f'; g.beginPath(); g.ellipse(x + 17, b - 30, 13, 3, 0, 0, TAU); g.fill(); g.strokeStyle = '#3e2723'; g.beginPath(); g.moveTo(x + 17, b - 46); g.lineTo(x + 17, b - 33); g.stroke(); },
  bembel(g, x, b) { g.fillStyle = '#9ea7b3'; g.beginPath(); g.moveTo(x + 6, b); g.quadraticCurveTo(x - 2, b - 18, x + 8, b - 30); g.lineTo(x + 22, b - 30); g.quadraticCurveTo(x + 32, b - 18, x + 24, b); g.closePath(); g.fill(); g.strokeStyle = '#1f4fa0'; g.lineWidth = 1.6; for (let i = 0; i < 3; i++) { g.beginPath(); g.arc(x + 15, b - 16, 4 + i * 3, 0.3, 2.8); g.stroke(); } g.lineWidth = 3; g.strokeStyle = '#7d8693'; g.beginPath(); g.arc(x + 26, b - 18, 7, -1.3, 1.3); g.stroke(); },
  snow(g, x, b, o) { g.fillStyle = '#f5f9ff'; g.beginPath(); g.moveTo(x, b); g.quadraticCurveTo(x + 4, b - 22, x + o.w * 0.4, b - 26); g.quadraticCurveTo(x + o.w * 0.8, b - 30, x + o.w, b); g.fill(); g.fillStyle = 'rgba(150,180,220,0.4)'; g.beginPath(); g.ellipse(x + o.w * 0.6, b - 6, o.w * 0.3, 4, 0, 0, TAU); g.fill(); },
  wall(g, x, b, o) { for (let r = 0; r < 3; r++) for (let i = 0; i < 3; i++) { g.fillStyle = ['#8d8d8d', '#a3a3a3', '#777'][(r + i) % 3]; roundRect(g, x + i * 13 + (r % 2) * 4 - 2, b - 11 - r * 10, 14, 10, 3); g.fill(); } g.fillStyle = '#5b8f3a'; g.fillRect(x - 2, b - 33, 44, 3); },
  rack(g, x, b, o) { g.strokeStyle = '#9aa3ad'; g.lineWidth = 3; g.beginPath(); g.moveTo(x + 4, b); g.lineTo(x + 4, b - 50); g.lineTo(x + 36, b - 50); g.lineTo(x + 36, b); g.stroke(); for (let i = 0; i < 3; i++) { g.fillStyle = i === 1 ? '#3fae3a' : ['#e76f51', '#2a9d8f'][i % 2]; roundRect(g, x + 6 + i * 10, b - 47, 9, 28, 2); g.fill(); } emoji(g, '🏷️', x + 30, b - 14, 14); },
  tumble(g, x, b, o) { g.save(); g.translate(x + 13, b - 13); g.rotate(-o.t * 8); g.strokeStyle = '#a1793c'; g.lineWidth = 1.6; for (let i = 0; i < 7; i++) { g.beginPath(); g.ellipse(0, 0, 12, 6, i * 0.45, 0, TAU); g.stroke(); } g.restore(); },
  facewalk(g, x, b, o) {
    g.fillStyle = '#2b2d42'; roundRect(g, x + 4, b - 46, 24, 30, 6); g.fill(); g.fillStyle = '#1b1b2a'; g.fillRect(x + 8, b - 18, 6, 18); g.fillRect(x + 18, b - 18, 6, 18);
    g.fillStyle = '#c0392b'; g.beginPath(); g.moveTo(x + 15, b - 45); g.lineTo(x + 18, b - 45); g.lineTo(x + 19, b - 30); g.lineTo(x + 16, b - 27); g.lineTo(x + 14, b - 30); g.fill();
    if (o.face) drawFaceOn(g, o.face, 'normal', x + 16, b - 46, 17);
    if (o.line && Math.floor(o.t * 1.2) % 2 === 0) { g.font = '800 9px ui-rounded, system-ui, sans-serif'; const w = Math.min(130, g.measureText(o.line).width + 12); g.fillStyle = '#fff'; roundRect(g, x + 16 - w / 2, b - 102, w, 16, 7); g.fill(); g.fillStyle = '#c0392b'; g.textAlign = 'center'; g.fillText(o.line, x + 16, b - 91, w - 8); }
  },
  griess(g, x, b, o) {
    g.fillStyle = '#fafafa'; g.beginPath(); g.moveTo(x, b - 22); g.lineTo(x + 34, b - 22); g.quadraticCurveTo(x + 32, b, x + 17, b); g.quadraticCurveTo(x + 2, b, x, b - 22); g.fill();
    g.fillStyle = '#5b8fd8'; g.fillRect(x + 2, b - 16, 30, 3);
    g.fillStyle = '#f1e0b5'; for (const [dx, dy, r] of [[8, -24, 7], [17, -29, 9], [27, -24, 7], [12, -31, 5], [23, -32, 5]]) { g.beginPath(); g.arc(x + dx, b + dy, r, 0, TAU); g.fill(); }
    g.fillStyle = 'rgba(160,120,60,0.35)'; for (const [dx, dy] of [[10, -27], [20, -33], [26, -26], [15, -24]]) { g.beginPath(); g.arc(x + dx, b + dy, 1.8, 0, TAU); g.fill(); }
    g.save(); g.translate(x + 18, b - 30); g.rotate(Math.sin(o.t * 3) * 0.05); g.fillStyle = '#b0bec5'; roundRect(g, -1.5, -26, 3, 26, 1.5); g.fill(); g.beginPath(); g.ellipse(0, -28, 4, 6, 0, 0, TAU); g.fill(); g.restore();
  },
  pizzatower(g, x, b, o) { for (let i = 0; i < 3; i++) { const y = b - 12 - i * 12; g.fillStyle = '#c8a26a'; roundRect(g, x - 2 + (i % 2) * 3, y, 38, 11, 2); g.fill(); g.strokeStyle = '#8d6e3a'; g.lineWidth = 1; g.stroke(); g.fillStyle = '#c0392b'; g.font = '900 6px sans-serif'; g.textAlign = 'center'; g.fillText('PIZZA', x + 17 + (i % 2) * 3, y + 8); } },
  weedleaf(g, x, b, o) { drawWeedLeaf(g, x + 19, b - 13, 17, Math.sin(o.t * 4) * 0.3); },
  lava(g, x, b, o) { g.fillStyle = '#555'; g.beginPath(); g.moveTo(x + 4, b); g.lineTo(x + 26, b); g.lineTo(x + 21, b - 8); g.lineTo(x + 9, b - 8); g.fill(); g.fillStyle = 'rgba(255,90,160,0.85)'; g.beginPath(); g.moveTo(x + 9, b - 8); g.lineTo(x + 21, b - 8); g.lineTo(x + 18, b - 34); g.lineTo(x + 12, b - 34); g.fill(); g.fillStyle = '#ffd23f'; for (let i = 0; i < 2; i++) { g.beginPath(); g.ellipse(x + 15, b - 12 - ((o.t * 8 + i * 11) % 20), 2.5, 3.5, 0, 0, TAU); g.fill(); } g.fillStyle = '#555'; g.fillRect(x + 11, b - 38, 8, 4); },
  facefly(g, x, b, o) { const y = b - 13; g.fillStyle = 'rgba(255,80,80,0.35)'; g.beginPath(); g.arc(x + 19, y - 6, 18, 0, TAU); g.fill(); if (o.face) drawFaceOn(g, o.face, 'normal', x + 19, y + 6, 15); },
};
for (const [key, [ch, size, op = {}]] of Object.entries(EO)) {
  if (OBS[key]) continue;
  const fly = !!op.fly, stack = op.stack || 1;
  OBS[key] = {
    fly,
    make: (o) => {
      const h = op.tall ? size * 1.6 : size * 0.82 * (stack > 1 ? 1.75 : 1);
      o.w = size; o.rects.push({ x: size * 0.16, w: size * 0.68, y0: 0, y1: h });
      if (op.move) o.extraV = op.move * (0.8 + Math.random() * 0.4);
      if (op.draw === 'hay') { o.w = 44; o.rects[0] = { x: 2, w: 40, y0: 0, y1: 30 }; }
      if (op.draw === 'parade') { o.w = 140; o.rects[0] = { x: 6, w: 126, y0: 0, y1: 22 }; }
      if (op.draw === 'puddle') { o.rects[0] = { x: 6, w: size - 12, y0: 0, y1: 6 }; }
      if (op.draw === 'facewalk') { o.rects[0] = { x: 4, w: 24, y0: 0, y1: 62 }; }
      if (op.draw === 'gator') { o.w = 86; o.rects[0] = { x: 2, w: 66, y0: 0, y1: 15 }; }
      if (op.draw === 'knee') { o.rects[0] = { x: 2, w: 30, y0: 0, y1: 26 }; }
    },
    draw: (g, x, b, o) => {
      if (op.draw && CUSTOM[op.draw]) { CUSTOM[op.draw](g, x, b, o); return; }
      if (fly) {
        const y = b - 13;
        if (op.text) { g.font = `900 ${size}px Georgia, serif`; g.textAlign = 'center'; g.fillStyle = op.text; g.fillText(ch, x + 19, y + size * 0.35); return; }
        emoji(g, ch, x + 19, y, size, Math.sin(o.t * 6) * 0.15); return;
      }
      if (op.tall) { emoji(g, ch, x + size / 2, b - size * 0.8, size * 1.6); return; }
      for (let i = 0; i < stack; i++) {
        const cy = b - size * 0.45 - i * size * 0.75;
        emoji(g, ch, x + size / 2 + (i % 2) * 2, cy, size, op.spin ? -o.t * 7 : op.rot || 0, !!op.flip);
      }
      if (op.lab) label(g, op.lab, x + size / 2, b - size * 0.95, 7);
    },
  };
}

/** Jägermeister: dunkelgrüne, gedrungene Flasche, cremefarbenes Etikett mit Hirschkopf und Kreuz, orange Banderole */
export function drawJaegerBottle(g, x, y, s = 1) {
  g.save(); g.translate(x, y); g.scale(s, s);
  g.fillStyle = '#1f3d1f'; roundRect(g, -8, -30, 16, 30, 3); g.fill(); g.fillRect(-3, -38, 6, 9); g.fillStyle = '#b8860b'; g.fillRect(-3.5, -40, 7, 3);
  g.fillStyle = '#efe3c2'; g.beginPath(); g.arc(0, -17, 6, 0, TAU); g.fill();
  g.strokeStyle = '#5d4037'; g.lineWidth = 1; g.beginPath(); g.moveTo(-3, -20); g.lineTo(-5, -24); g.moveTo(3, -20); g.lineTo(5, -24); g.stroke();
  g.strokeStyle = '#ffd23f'; g.beginPath(); g.moveTo(0, -25); g.lineTo(0, -21); g.moveTo(-1.5, -23.5); g.lineTo(1.5, -23.5); g.stroke();
  g.fillStyle = '#e65100'; g.fillRect(-8, -8, 16, 3);
  g.restore();
}
/** Asbach Uralt: bauchige Flasche mit goldbraunem Inhalt und rotem Etikett */
export function drawAsbachBottle(g, x, y, s = 1) {
  g.save(); g.translate(x, y); g.scale(s, s);
  g.fillStyle = '#9c5a1a'; g.beginPath(); g.moveTo(-7, 0); g.lineTo(-7, -22); g.quadraticCurveTo(-7, -28, -2.5, -30); g.lineTo(-2.5, -38); g.lineTo(2.5, -38); g.lineTo(2.5, -30); g.quadraticCurveTo(7, -28, 7, -22); g.lineTo(7, 0); g.closePath(); g.fill();
  g.fillStyle = '#f5ecd5'; g.fillRect(-6, -19, 12, 11); g.fillStyle = '#b71c1c'; g.font = 'italic 900 4.5px Georgia, serif'; g.textAlign = 'center'; g.fillText('Asbach', 0, -12.5);
  g.fillStyle = '#c9a227'; g.fillRect(-2.5, -40, 5, 3);
  g.restore();
}
/** Asbach-Cola im 0,2-l-Tumbler mit Eiswürfeln, Zitrone und rotem Schriftzug */
export function drawAsbachGlass(g, x, y, s = 1) {
  g.save(); g.translate(x, y); g.scale(s, s);
  g.fillStyle = 'rgba(255,255,255,0.45)'; g.beginPath(); g.moveTo(-8, -26); g.lineTo(8, -26); g.lineTo(7, 0); g.lineTo(-7, 0); g.closePath(); g.fill();
  g.fillStyle = '#3b1f0f'; g.beginPath(); g.moveTo(-7.4, -20); g.lineTo(7.4, -20); g.lineTo(6.6, -1); g.lineTo(-6.6, -1); g.closePath(); g.fill();
  g.fillStyle = 'rgba(220,240,255,0.85)'; roundRect(g, -5, -22, 5, 5, 1); g.fill(); roundRect(g, 1, -20, 5, 5, 1); g.fill();
  g.fillStyle = '#f2d24b'; g.beginPath(); g.arc(6, -24, 4, Math.PI, 0); g.fill();
  g.fillStyle = '#e53935'; g.font = 'italic 900 5px Georgia, serif'; g.textAlign = 'center'; g.fillText('Asbach', 0, -7);
  g.restore();
}

/** Glas in der Hand, Eiswürfel fliegen im Bogen raus (Ursprung = Fußpunkt der Figur, Maßstab 0.88) */
export function drawIceToss(g, x, footY, t) {
  const hx = x + 22, hy = footY - 66, tilt = Math.max(0, Math.sin(t * 4)) * 0.9;
  g.save(); g.translate(hx, hy); g.rotate(tilt); drawAsbachGlass(g, 0, 10, 0.9); g.restore();
  for (let k = 0; k < 3; k++) { const ph = (t * 1.3 + k / 3) % 1; emoji(g, '🧊', hx + 6 + ph * 70, hy - 10 - Math.sin(ph * Math.PI) * 46 + ph * 50, 12, ph * 6); }
}

/** 7-fingriges Hanfblatt */
export function drawWeedLeaf(g, x, y, r, rot = 0, col = '#3fa34d') {
  g.save(); g.translate(x, y); g.rotate(rot);
  g.fillStyle = col; g.strokeStyle = '#1e5b28'; g.lineWidth = 1;
  const fingers = [[-Math.PI / 2, 1], [-Math.PI / 2 - 0.45, 0.85], [-Math.PI / 2 + 0.45, 0.85], [-Math.PI / 2 - 0.95, 0.65], [-Math.PI / 2 + 0.95, 0.65], [-Math.PI / 2 - 1.45, 0.42], [-Math.PI / 2 + 1.45, 0.42]];
  for (const [a, l] of fingers) {
    const L = r * l, w = r * 0.13 * (0.6 + l * 0.4);
    g.save(); g.rotate(a + Math.PI / 2); g.beginPath(); g.moveTo(0, 0);
    for (let i = 0; i <= 6; i++) { const u = i / 6; g.lineTo(w * Math.sin(u * Math.PI) + (i % 2 ? w * 0.25 : 0), -L * u); }
    for (let i = 6; i >= 0; i--) { const u = i / 6; g.lineTo(-w * Math.sin(u * Math.PI) - (i % 2 ? w * 0.25 : 0), -L * u); }
    g.closePath(); g.fill(); g.stroke();
    g.strokeStyle = 'rgba(255,255,255,0.35)'; g.beginPath(); g.moveTo(0, 0); g.lineTo(0, -L * 0.9); g.stroke(); g.strokeStyle = '#1e5b28';
    g.restore();
  }
  g.strokeStyle = '#2d6b2f'; g.lineWidth = 2; g.beginPath(); g.moveTo(0, 0); g.lineTo(0, r * 0.4); g.stroke();
  g.restore();
}

// ---------------------------------------------------------------------------
// Items (Emoji). Einträge mit "draw" sind eigene Zeichnungen.
// ---------------------------------------------------------------------------
export const ITEM_EMO = {
  milchschnitte: '🍫', cookie: '🍪', wassereis: '🍧', brause: '🍭', sweets: '🍬', shopbag2: '🛍️', schokokuss: 'draw', cake: '🍰', partybag: '🎁',
  money: '💶', coin: '🪙', voucher: '⛽', cocktail: '🍹', straw: '🥤', cupid: '💘', coffee: '☕', cheatnote: '📝', redbull: '🥫', koelsch: '🍺',
  akte: '📜', eierlikoer: 'draw', saeftchen: 'draw', glow: 'draw', water: '💧', cookie2: '🍪', brezn: '🥨', lebherz: '💝', gelato: '🍨', mussel: '🦪', kamelle: '🍬', struessjer: '💐',
  wood: '🪵', clay: '🧱', woolres: '🐑', grain: '🌾', ore: '🪨', card: '🃏', psl: 'draw', brezel: '🥨', candycane: '🍭', sausage: '🌭', gulasch: '🥣',
  steak: '🥩', glitter: '✨', mimisoup: '🌶️', ring: '💍', confetti2: '🎊', weddingcake: '🎂', schnitzel: '🍖', onion: '🧅', gerippter: 'draw', winktuch: '🏳️',
  hotdog: '🌭', beignet: '🍩', cowboyhat: '🤠', boots: '👢', asbach: 'draw', jaegi: 'draw', cherry: '🍒', weck: '🥖', cheese2: '🧀', blossom: '🌸', los: '🎟️', blackring: 'draw',
  turkey: '🍗', shortbread: '🍪', whisky: '🥃', snack: '🍿', domsign: 'draw', burger2: '🍔', donut: '🍩', apple: '🍎', fries2: '🍟', wine2: '🍷', cocktail2: '🍸', bluelagoon: 'draw', superdrink: 'draw', paprika: 'draw', protea: 'draw', rooibos: '🍵', grapes: '🍇',
};
const ITEM_DRAW = {
  schokokuss(g) { g.fillStyle = '#e9d8b8'; g.beginPath(); g.ellipse(0, 7, 11, 3, 0, 0, TAU); g.fill(); g.fillStyle = '#4a2a17'; g.beginPath(); g.ellipse(0, 6, 10, 15, 0, Math.PI, 0); g.fill(); g.fillStyle = 'rgba(255,255,255,0.35)'; g.beginPath(); g.ellipse(-4, -3, 2, 5, 0.3, 0, TAU); g.fill(); },
  glow(g, t) { g.save(); g.rotate(Math.sin(t * 3) * 0.6); const c = ['#3eff8b', '#ff4fd8', '#4fd2ff'][Math.floor(t) % 3]; g.shadowColor = c; g.shadowBlur = 14; g.fillStyle = c; roundRect(g, -2.5, -12, 5, 24, 2.5); g.fill(); g.restore(); },
  psl(g) { emoji(g, '☕', 0, 0, 24); emoji(g, '🎃', 8, -8, 12); },
  gerippter(g) { g.fillStyle = 'rgba(255,255,255,0.55)'; g.beginPath(); g.moveTo(-8, -12); g.lineTo(8, -12); g.lineTo(6, 12); g.lineTo(-6, 12); g.closePath(); g.fill(); g.fillStyle = '#e6b54a'; g.beginPath(); g.moveTo(-7.5, -6); g.lineTo(7.5, -6); g.lineTo(6, 11); g.lineTo(-6, 11); g.fill(); g.strokeStyle = 'rgba(255,255,255,0.8)'; g.lineWidth = 0.8; for (let i = -6; i <= 6; i += 2) { g.beginPath(); g.moveTo(i - 1, -11); g.lineTo(i, 11); g.stroke(); } },
  blackring(g, t) { const gl = g.createRadialGradient(0, 0, 2, 0, 0, 22); gl.addColorStop(0, 'rgba(255,240,150,0.8)'); gl.addColorStop(1, 'rgba(255,240,150,0)'); g.fillStyle = gl; g.beginPath(); g.arc(0, 0, 22, 0, TAU); g.fill(); g.strokeStyle = '#111'; g.lineWidth = 4; g.beginPath(); g.ellipse(0, 0, 9, 9 * Math.abs(Math.cos(t * 2)) + 2, 0, 0, TAU); g.stroke(); g.strokeStyle = 'rgba(255,255,255,0.5)'; g.lineWidth = 1; g.stroke(); },
  saeftchen(g, t) { const c = ['#ff4fa3', '#3ee6b4', '#ffd23f', '#b388ff'][Math.floor(t) % 4]; g.fillStyle = 'rgba(255,255,255,0.65)'; g.beginPath(); g.moveTo(-6, -9); g.lineTo(6, -9); g.lineTo(5, 9); g.lineTo(-5, 9); g.closePath(); g.fill(); g.fillStyle = c; g.beginPath(); g.moveTo(-5.5, -3); g.lineTo(5.5, -3); g.lineTo(4.6, 8); g.lineTo(-4.6, 8); g.fill(); g.fillStyle = 'rgba(255,255,255,0.7)'; g.fillRect(-4, -2, 2, 8); },
  asbach(g) { drawAsbachGlass(g, 0, 12, 1); },
  bluelagoon(g, t) { // Blue Lagoon: hohes Glas, leuchtend blau, Eis, Zitronenscheibe, Strohhalm, Schirmchen
    g.fillStyle = 'rgba(255,255,255,0.55)'; g.beginPath(); g.moveTo(-7, -14); g.lineTo(7, -14); g.lineTo(6, 13); g.lineTo(-6, 13); g.closePath(); g.fill();
    const lg = g.createLinearGradient(0, -10, 0, 13); lg.addColorStop(0, '#4fc3f7'); lg.addColorStop(1, '#0d47a1'); g.fillStyle = lg; g.beginPath(); g.moveTo(-6.5, -9); g.lineTo(6.5, -9); g.lineTo(5.6, 12); g.lineTo(-5.6, 12); g.fill();
    g.fillStyle = 'rgba(255,255,255,0.7)'; g.fillRect(-4, -7, 4, 4); g.fillRect(1, -3, 4, 4); g.fillRect(-3, 2, 3.5, 3.5); // Eis
    g.fillStyle = '#fff176'; g.beginPath(); g.arc(7, -11, 5, 0, TAU); g.fill(); g.fillStyle = '#fbc02d'; g.beginPath(); g.arc(7, -11, 3.6, 0, TAU); g.fill(); // Zitrone
    g.strokeStyle = '#ff4fa3'; g.lineWidth = 1.6; g.beginPath(); g.moveTo(-2, 10); g.lineTo(-5, -20); g.stroke();
    g.save(); g.translate(3, -18); g.rotate(-0.4 + Math.sin(t * 3) * 0.08); g.fillStyle = '#ff7043'; g.beginPath(); g.moveTo(-8, 0); g.quadraticCurveTo(0, -8, 8, 0); g.closePath(); g.fill(); g.strokeStyle = '#8d6e63'; g.lineWidth = 1; g.beginPath(); g.moveTo(0, -3); g.lineTo(0, 9); g.stroke(); g.restore();
  },
  paprika(g, t) { drawPaprika(g, 0, 1, 1.25, '#e0281e', Math.sin(t * 2) * 0.15); },
  protea(g, t) { // Königsprotea: rosa Hochblätter um eine helle Mitte
    g.save(); g.rotate(Math.sin(t * 2) * 0.12);
    for (let i = 0; i < 12; i++) { const a = -Math.PI / 2 + (i - 5.5) * 0.26; g.fillStyle = i % 2 ? '#f48fb1' : '#e75480'; g.beginPath(); g.ellipse(Math.cos(a) * 7, Math.sin(a) * 7 + 2, 3.4, 9, a + Math.PI / 2, 0, TAU); g.fill(); }
    g.fillStyle = '#fbe9d0'; g.beginPath(); g.ellipse(0, 0, 6, 7, 0, 0, TAU); g.fill();
    g.fillStyle = 'rgba(200,120,140,0.6)'; for (let i = 0; i < 6; i++) { g.beginPath(); g.arc(-3 + (i % 3) * 3, -3 + Math.floor(i / 3) * 4, 0.9, 0, TAU); g.fill(); }
    g.fillStyle = '#4caf50'; g.fillRect(-1, 8, 2, 7); g.restore();
  },
  superdrink(g, t) { // Superdrink: Longdrink-Glas mit leuchtendem Türkis-Blau, Strohhalm und Etikett
    const gl = g.createRadialGradient(0, 0, 3, 0, 0, 24); gl.addColorStop(0, 'rgba(62,230,180,0.55)'); gl.addColorStop(1, 'rgba(62,230,180,0)');
    g.fillStyle = gl; g.beginPath(); g.arc(0, 0, 24, 0, TAU); g.fill();
    g.fillStyle = 'rgba(255,255,255,0.6)'; g.beginPath(); g.moveTo(-8, -14); g.lineTo(8, -14); g.lineTo(7, 14); g.lineTo(-7, 14); g.closePath(); g.fill();
    const lq = g.createLinearGradient(0, -9, 0, 13); lq.addColorStop(0, '#3ee6b4'); lq.addColorStop(1, '#2a5de1');
    g.fillStyle = lq; g.beginPath(); g.moveTo(-7.4, -9); g.lineTo(7.4, -9); g.lineTo(6.4, 13); g.lineTo(-6.4, 13); g.fill();
    g.fillStyle = 'rgba(255,255,255,0.75)'; for (let i = 0; i < 3; i++) { const by = 10 - ((t * 14 + i * 7) % 18); g.beginPath(); g.arc(-3 + i * 3, by, 1, 0, TAU); g.fill(); }
    g.strokeStyle = '#ff4fa3'; g.lineWidth = 2; g.beginPath(); g.moveTo(3, 10); g.lineTo(6, -20); g.lineTo(11, -22); g.stroke();
    g.fillStyle = '#111'; g.fillRect(-7, -2, 14, 8); g.fillStyle = '#ffd23f'; g.font = '900 6.5px sans-serif'; g.textAlign = 'center'; g.fillText(assets.config.superDrink?.label || 'SUPER', 0, 4.4, 13);
  },
  jaegi(g) { g.fillStyle = 'rgba(255,255,255,0.7)'; g.beginPath(); g.moveTo(-6, -9); g.lineTo(6, -9); g.lineTo(5, 7); g.lineTo(-5, 7); g.closePath(); g.fill(); g.fillStyle = '#3b2210'; g.fillRect(-5, -4, 10, 10); drawJaegerBottle(g, 10, 8, 0.45); },
  eierlikoer(g) { g.fillStyle = 'rgba(255,255,255,0.6)'; g.beginPath(); g.moveTo(-7, -11); g.lineTo(7, -11); g.lineTo(4, 3); g.lineTo(-4, 3); g.closePath(); g.fill(); g.fillStyle = '#f6d64a'; g.beginPath(); g.moveTo(-6, -6); g.lineTo(6, -6); g.lineTo(4, 2); g.lineTo(-4, 2); g.fill(); g.fillStyle = '#fff6b0'; g.beginPath(); g.ellipse(0, -6, 6, 1.6, 0, 0, TAU); g.fill(); g.fillStyle = 'rgba(255,255,255,0.8)'; g.fillRect(-1, 3, 2, 6); g.fillRect(-5, 9, 10, 2); emoji(g, '🥚', 9, -9, 9); },
  domsign(g) { g.fillStyle = '#8d6e63'; g.fillRect(-1.5, -4, 3, 16); g.fillStyle = '#1565c0'; g.beginPath(); g.moveTo(-12, -13); g.lineTo(8, -13); g.lineTo(13, -8); g.lineTo(8, -3); g.lineTo(-12, -3); g.closePath(); g.fill(); g.fillStyle = '#fff'; g.font = '900 6px sans-serif'; g.textAlign = 'center'; g.fillText('DOM →', -1, -6); },
};
for (const [k, ch] of Object.entries(ITEM_EMO)) {
  if (ITEM_ICONS[k]) continue;
  ITEM_ICONS[k] = ch === 'draw' ? ITEM_DRAW[k] : (g) => emoji(g, ch, 0, 0, 24);
}
/** Gesicht als einsammelbares Item (z.B. jemanden einfangen) */
export function faceItem(face) {
  const k = `face_${face}`;
  if (!ITEM_ICONS[k]) ITEM_ICONS[k] = (g, t) => { g.fillStyle = 'rgba(255,210,63,0.4)'; g.beginPath(); g.arc(0, 0, 17, 0, TAU); g.fill(); drawFaceOn(g, face, 'happy', 0, 11, 14 + Math.sin(t * 8)); };
  return k;
}

// ---------------------------------------------------------------------------
// Hintergrund-Bausteine
// ---------------------------------------------------------------------------
function sky(g, V, top, bot) { const gr = g.createLinearGradient(0, 0, 0, V.groundY); gr.addColorStop(0, top); gr.addColorStop(1, bot); g.fillStyle = gr; g.fillRect(0, 0, V.w, V.groundY + 1); }
function floor(g, V, c1, c2, off, deco) { g.fillStyle = c1; g.fillRect(0, V.groundY, V.w, V.h - V.groundY); g.fillStyle = c2; g.fillRect(0, V.groundY - 2, V.w, 5); deco?.(); }
function clouds(g, V, off, a = 0.9, dark) {
  g.fillStyle = dark ? `rgba(120,130,145,${a})` : `rgba(255,255,255,${a})`;
  for (let i = 0; i < 5; i++) { const cx = wrap(i * 220 - off * 0.1, V.w + 220) - 110, cy = V.groundY * 0.16 + (i % 3) * 24; g.beginPath(); g.arc(cx, cy, 15, 0, TAU); g.arc(cx + 17, cy - 8, 19, 0, TAU); g.arc(cx + 36, cy, 14, 0, TAU); g.rect(cx, cy, 36, 13); g.fill(); }
}
/** wiederholt fn(x, k) mit Parallaxe f */
function rep(V, off, f, period, fn, phase = 0) { for (let k = -1; k < V.w / period + 2; k++) fn(k * period - wrap(off * f + phase, period), k); }
/** einzelnes Wahrzeichen, das selten vorbeizieht */
function once(V, off, f, period, start, fn) { const x = wrap(-off * f + start, period) - 260; if (x < V.w + 260) fn(x); }
function planks(g, V, off, c1, c2) { floor(g, V, c1, c2, off, () => { g.fillStyle = 'rgba(0,0,0,0.12)'; rep(V, off, 1, 46, (x) => g.fillRect(x, V.groundY + 3, 2, V.h)); g.fillStyle = 'rgba(255,255,255,0.06)'; for (let r = 0; r < 4; r++) g.fillRect(0, V.groundY + 12 + r * 12, V.w, 1); }); }
function cobble(g, V, off, c1 = '#9e9e9e', c2 = '#757575') { floor(g, V, c1, c2, off, () => { g.strokeStyle = 'rgba(0,0,0,0.18)'; g.lineWidth = 1; rep(V, off, 1, 14, (x) => { for (let r = 0; r < 4; r++) g.strokeRect(x + (r % 2) * 7, V.groundY + 4 + r * 9, 14, 9); }); }); }
function grass(g, V, off, c1 = '#7cb342', c2 = '#558b2f', flowers = true) { floor(g, V, c1, c2, off, () => { if (!flowers) return; for (let i = 0; i < 30; i++) { const x = wrap(i * 41 - off, V.w + 40) - 20; g.fillStyle = ['#ef5350', '#ffeb3b', '#fff'][i % 3]; g.beginPath(); g.arc(x, V.groundY + 10 + (i % 4) * 8, 2, 0, TAU); g.fill(); } }); }
function asphalt(g, V, off) { floor(g, V, '#4a4a4f', '#9e9e9e', off, () => { g.fillStyle = '#fff'; rep(V, off, 1, 60, (x) => g.fillRect(x, V.groundY + 18, 30, 3)); }); }
function wallpaper(g, V, off, base, dot, f = 0.5) {
  g.fillStyle = base; g.fillRect(0, 0, V.w, V.groundY);
  g.fillStyle = dot; rep(V, off, f, 28, (x) => { for (let y = 14; y < V.groundY - 30; y += 28) { g.beginPath(); g.arc(x + ((y / 28) % 2) * 14, y, 3, 0, TAU); g.fill(); } });
  g.fillStyle = 'rgba(0,0,0,0.12)'; g.fillRect(0, V.groundY - 26, V.w, 26);
}
function windowFrame(g, x, y, w, h, glass = '#bfe3f7', frame = '#fff', cross = true) { g.fillStyle = glass; g.fillRect(x, y, w, h); g.strokeStyle = frame; g.lineWidth = 4; g.strokeRect(x, y, w, h); if (cross) { g.beginPath(); g.moveTo(x + w / 2, y); g.lineTo(x + w / 2, y + h); g.moveTo(x, y + h / 2); g.lineTo(x + w, y + h / 2); g.stroke(); } }
function stringLights(g, V, off, f, y0, t, span = 200, sag = 36, cols = ['#fff59d', '#ffcc80', '#ff8a80', '#80deea']) {
  rep(V, off, f, span, (x, k) => {
    g.strokeStyle = 'rgba(40,30,30,0.55)'; g.lineWidth = 1; g.beginPath(); g.moveTo(x, y0); g.quadraticCurveTo(x + span / 2, y0 + sag * 2, x + span, y0); g.stroke();
    for (let i = 1; i < 10; i++) { const u = i / 10, lx = x + span * u, ly = y0 + sag * 4 * u * (1 - u); const on = (i + k + Math.floor(t * 2)) % 5 !== 0; g.fillStyle = on ? cols[i % cols.length] : 'rgba(255,255,255,0.3)'; if (on) { g.shadowColor = cols[i % cols.length]; g.shadowBlur = 8; } g.beginPath(); g.arc(lx, ly + 3, 2.6, 0, TAU); g.fill(); g.shadowBlur = 0; }
  });
}
function crowd(g, V, off, f, t, color = '#2a1830', n = 18, hopAmp = 5, y = 0) {
  for (let i = 0; i < n; i++) { const x = wrap(i * 47 - off * f, V.w + 60) - 30, hop = Math.abs(Math.sin(t * 6 + i)) * hopAmp; g.fillStyle = color; g.beginPath(); g.arc(x, V.groundY - 56 - hop - y, 8, 0, TAU); g.fill(); roundRect(g, x - 9, V.groundY - 48 - hop - y, 18, 40, 7); g.fill(); if (i % 3 === 0) { g.strokeStyle = color; g.lineWidth = 4; g.beginPath(); g.moveTo(x + 6, V.groundY - 44 - hop - y); g.lineTo(x + 12, V.groundY - 68 - hop - y); g.stroke(); } }
}
function snowfall(g, V, t, off, n = 50) { g.fillStyle = 'rgba(255,255,255,0.9)'; for (let i = 0; i < n; i++) { const sx = wrap(i * 53 - off * 0.2 + Math.sin(t + i) * 12, V.w), sy = wrap(i * 37 + t * (25 + (i % 5) * 6), V.groundY + 20); g.beginPath(); g.arc(sx, sy, 1.2 + (i % 3) * 0.6, 0, TAU); g.fill(); } }
function sign(g, text, x, y, { bg = '#263238', fg = '#ffd23f', size = 15, w, neon } = {}) {
  g.font = `900 ${size}px ui-rounded, system-ui, sans-serif`; g.textAlign = 'center';
  const ww = w || g.measureText(text).width + 24;
  if (bg) { g.fillStyle = bg; roundRect(g, x - ww / 2, y - size - 6, ww, size + 14, 6); g.fill(); }
  if (neon) { g.shadowColor = fg; g.shadowBlur = 14; }
  g.fillStyle = fg; g.fillText(text, x, y + 1, ww - 10); g.shadowBlur = 0;
}
function fachwerk(g, x, gy, w, h, col = '#f3e0c0', roof = '#a5402d', beam = '#5d3a22') {
  g.fillStyle = col; g.fillRect(x, gy - h, w, h);
  g.fillStyle = roof; g.beginPath(); g.moveTo(x - 6, gy - h); g.lineTo(x + w / 2, gy - h - w * 0.45); g.lineTo(x + w + 6, gy - h); g.fill();
  g.strokeStyle = beam; g.lineWidth = 3; g.strokeRect(x, gy - h, w, h);
  g.beginPath(); const n = Math.max(2, Math.round(w / 28)); for (let i = 1; i < n; i++) { g.moveTo(x + (i * w) / n, gy - h); g.lineTo(x + (i * w) / n, gy); }
  for (let r = 1; r < 3; r++) { g.moveTo(x, gy - (h * r) / 3); g.lineTo(x + w, gy - (h * r) / 3); }
  g.moveTo(x, gy - h); g.lineTo(x + w / n, gy - (h * 2) / 3); g.moveTo(x + w, gy - h); g.lineTo(x + w - w / n, gy - (h * 2) / 3); g.stroke();
  g.fillStyle = '#90caf9'; for (let i = 0; i < n; i++) g.fillRect(x + (i * w) / n + w / n / 2 - 7, gy - h + h / 3 + 6, 14, h / 3 - 14);
}
function tree(g, x, gy, h = 90, crown = '#2e7d32', trunk = '#6d4c41', r = 30) { g.fillStyle = trunk; g.fillRect(x - 5, gy - h, 10, h); g.fillStyle = crown; for (const [dx, dy, rr] of [[0, h + 10, r], [-r * 0.7, h - 5, r * 0.75], [r * 0.7, h - 5, r * 0.75]]) { g.beginPath(); g.arc(x + dx, gy - dy, rr, 0, TAU); g.fill(); } }
function hillsBand(g, V, off, f, amp, period, color, base = 0) { g.fillStyle = color; g.beginPath(); g.moveTo(0, V.groundY - base); for (let x = 0; x <= V.w + 10; x += 10) { const u = (x + off * f) / period; g.lineTo(x, V.groundY - base - amp * (0.55 + 0.3 * Math.sin(u * 2.1) + 0.15 * Math.sin(u * 5.3))); } g.lineTo(V.w, V.groundY); g.lineTo(0, V.groundY); g.closePath(); g.fill(); }
function xmasTree(g, x, gy, h, t, star = true) {
  g.fillStyle = '#5d4037'; g.fillRect(x - 5, gy - h * 0.15, 10, h * 0.15);
  for (let i = 0; i < 4; i++) { const w = h * (0.42 - i * 0.08), y = gy - h * 0.12 - i * h * 0.2; g.fillStyle = i % 2 ? '#2e7d32' : '#1b5e20'; g.beginPath(); g.moveTo(x - w, y); g.lineTo(x, y - h * 0.32); g.lineTo(x + w, y); g.fill(); }
  for (let i = 0; i < 14; i++) { const u = (i * 0.618) % 1, yy = gy - h * 0.15 - u * h * 0.7, ww = h * 0.38 * (1 - u * 0.9); const on = (i + Math.floor(t * 3)) % 3; g.fillStyle = ['#ffd23f', '#ff4f6d', '#7cc6ff'][on]; g.beginPath(); g.arc(x + Math.sin(i * 2.4) * ww * 0.8, yy, 2.4, 0, TAU); g.fill(); }
  if (star) { g.fillStyle = '#ffd23f'; g.shadowColor = '#ffd23f'; g.shadowBlur = 12; g.beginPath(); for (let i = 0; i < 10; i++) { const a = -Math.PI / 2 + i * Math.PI / 5, r = i % 2 ? h * 0.03 : h * 0.07; g.lineTo(x + Math.cos(a) * r, gy - h * 0.9 + Math.sin(a) * r); } g.fill(); g.shadowBlur = 0; }
}
function sea(g, V, off, t, y, c1 = '#1e88e5', c2 = '#64b5f6') { const gr = g.createLinearGradient(0, y, 0, V.groundY); gr.addColorStop(0, c1); gr.addColorStop(1, c2); g.fillStyle = gr; g.fillRect(0, y, V.w, V.groundY - y); g.strokeStyle = 'rgba(255,255,255,0.5)'; g.lineWidth = 1.5; for (let r = 0; r < 4; r++) { const yy = y + 8 + r * ((V.groundY - y) / 4); g.beginPath(); for (let x = 0; x <= V.w; x += 12) g.lineTo(x, yy + Math.sin((x + off * (0.1 + r * 0.05)) * 0.05 + t * 2) * 2); g.stroke(); } }
function gothicSpire(g, x, gy, w, h, col) { g.fillStyle = col; g.fillRect(x, gy - h * 0.7, w, h * 0.7); g.beginPath(); g.moveTo(x - 2, gy - h * 0.7); g.lineTo(x + w / 2, gy - h); g.lineTo(x + w + 2, gy - h * 0.7); g.fill(); g.fillStyle = 'rgba(0,0,0,0.25)'; for (let i = 0; i < 4; i++) { g.fillRect(x + w * 0.3, gy - h * 0.65 + i * h * 0.15, w * 0.4, h * 0.08); } }
function neon(g, text, x, y, col, size = 13, t = 0, flicker = 0) { if (flicker && Math.sin(t * 17 + x) > 0.93) return; g.font = `900 ${size}px ui-rounded, system-ui, sans-serif`; g.textAlign = 'center'; g.shadowColor = col; g.shadowBlur = 12; g.fillStyle = col; g.fillText(text, x, y); g.shadowBlur = 0; g.fillStyle = 'rgba(255,255,255,0.6)'; g.fillText(text, x, y); }
const S = (lv, k, d) => lv?.signs?.[k] || d;

// ---------------------------------------------------------------------------
// Szenen
// ---------------------------------------------------------------------------
export const SCENES = {
  // Omas Wohnzimmer: Blümchentapete, Schrankwand, Röhrenfernseher, Standuhr, Sofa mit Häkeldeckchen
  omaRoom(g, V, off, t, lv, xmas) {
    const gy = V.groundY;
    wallpaper(g, V, off, '#efe1c6', 'rgba(190,120,110,0.35)');
    rep(V, off, 0.5, 520, (x) => {
      // Schrankwand
      g.fillStyle = '#6b4226'; g.fillRect(x, gy - 190, 170, 190); g.fillStyle = '#4e2f1a'; g.fillRect(x, gy - 196, 170, 8);
      for (let i = 0; i < 3; i++) { g.fillStyle = 'rgba(190,220,240,0.55)'; g.fillRect(x + 10 + i * 53, gy - 180, 45, 70); g.strokeStyle = '#3e2414'; g.lineWidth = 2; g.strokeRect(x + 10 + i * 53, gy - 180, 45, 70); for (let j = 0; j < 3; j++) { g.fillStyle = ['#fff', '#7cc6ff', '#ffd23f'][(i + j) % 3]; g.beginPath(); g.ellipse(x + 22 + i * 53 + j * 10, gy - 128, 4, 6, 0, 0, TAU); g.fill(); } }
      g.fillStyle = '#5a361f'; for (let i = 0; i < 3; i++) g.fillRect(x + 10 + i * 53, gy - 100, 45, 80);
      g.fillStyle = '#c9a66b'; for (let i = 0; i < 3; i++) g.fillRect(x + 50 + i * 53, gy - 62, 3, 10);
      // Röhrenfernseher
      g.fillStyle = '#3b3b3b'; roundRect(g, x + 200, gy - 92, 70, 56, 6); g.fill(); g.fillStyle = '#6fb2a0'; roundRect(g, x + 207, gy - 86, 46, 42, 8); g.fill();
      g.fillStyle = 'rgba(255,255,255,0.25)'; g.fillRect(x + 210, gy - 82, 20, 6); g.fillStyle = '#999'; g.beginPath(); g.arc(x + 262, gy - 76, 3, 0, TAU); g.arc(x + 262, gy - 64, 3, 0, TAU); g.fill();
      g.fillStyle = '#6b4226'; g.fillRect(x + 196, gy - 36, 78, 36);
      // Sofa mit Häkeldeckchen
      g.fillStyle = '#7b5e3b'; roundRect(g, x + 300, gy - 70, 150, 50, 12); g.fill(); g.fillStyle = '#8f6f48'; roundRect(g, x + 296, gy - 40, 158, 32, 10); g.fill();
      g.fillStyle = '#fff'; for (const dx of [330, 400]) { g.beginPath(); for (let i = 0; i < 12; i++) { const a = i / 12 * TAU, r = i % 2 ? 9 : 12; g.lineTo(x + dx + Math.cos(a) * r, gy - 66 + Math.sin(a) * r * 0.6); } g.fill(); }
      // Standuhr
      g.fillStyle = '#5a361f'; g.fillRect(x + 475, gy - 170, 34, 170); g.fillStyle = '#f4ecd8'; g.beginPath(); g.arc(x + 492, gy - 148, 12, 0, TAU); g.fill();
      g.strokeStyle = '#222'; g.lineWidth = 1.5; g.beginPath(); g.moveTo(x + 492, gy - 148); g.lineTo(x + 492, gy - 157); g.moveTo(x + 492, gy - 148); g.lineTo(x + 498, gy - 146); g.stroke();
      const sw = Math.sin(t * 3) * 6; g.strokeStyle = '#c9a227'; g.lineWidth = 2; g.beginPath(); g.moveTo(x + 492, gy - 120); g.lineTo(x + 492 + sw, gy - 70); g.stroke(); g.fillStyle = '#c9a227'; g.beginPath(); g.arc(x + 492 + sw, gy - 68, 5, 0, TAU); g.fill();
      // Bilderrahmen
      g.fillStyle = '#b08850'; g.fillRect(x + 320, gy - 150, 40, 32); g.fillStyle = '#a5d6a7'; g.fillRect(x + 324, gy - 146, 32, 24);
      if (xmas) { xmasTree(g, x + 300 - 18, gy, 120, t); emoji(g, '🎁', x + 270, gy - 14, 22); emoji(g, '🎁', x + 300, gy - 12, 18); }
    });
    if (xmas) stringLights(g, V, off, 0.5, 18, t, 260, 18);
    floor(g, V, '#8e3b46', '#6d2a33', off, () => { g.strokeStyle = 'rgba(255,220,160,0.25)'; g.lineWidth = 2; rep(V, off, 1, 40, (x) => { g.beginPath(); g.moveTo(x, gy + 10); g.lineTo(x + 20, gy + 22); g.lineTo(x + 40, gy + 10); g.stroke(); }); });
  },
  omaXmas(g, V, off, t, lv) { SCENES.omaRoom(g, V, off, t, lv, true); },

  // Kindheit: Reihenhaus-Siedlung mit Garten, Planschbecken, Schaukel
  kidStreet(g, V, off, t) {
    const gy = V.groundY;
    sky(g, V, '#7ec8f0', '#e9f7ff'); clouds(g, V, off);
    rep(V, off, 0.25, 150, (x, k) => { const c = ['#f6efe2', '#f1d9b5', '#e7e0d0', '#dfe9f0'][((k % 4) + 4) % 4]; g.fillStyle = c; g.fillRect(x, gy - 150, 140, 110); g.fillStyle = '#b5442f'; g.beginPath(); g.moveTo(x - 6, gy - 150); g.lineTo(x + 70, gy - 195); g.lineTo(x + 146, gy - 150); g.fill(); for (let i = 0; i < 3; i++) windowFrame(g, x + 12 + i * 44, gy - 135, 28, 26); g.fillStyle = '#795548'; g.fillRect(x + 56, gy - 80, 26, 40); });
    g.fillStyle = '#3e8e41'; g.beginPath(); g.moveTo(0, gy); for (let x = 0; x <= V.w + 20; x += 20) g.lineTo(x, gy - 44 - Math.sin((x + off * 0.45) * 0.06) * 5); g.lineTo(V.w, gy); g.fill();
    rep(V, off, 0.6, 420, (x) => { g.strokeStyle = '#d32f2f'; g.lineWidth = 3; g.beginPath(); g.moveTo(x, gy); g.lineTo(x + 20, gy - 70); g.lineTo(x + 40, gy); g.moveTo(x + 80, gy); g.lineTo(x + 100, gy - 70); g.lineTo(x + 120, gy); g.moveTo(x + 20, gy - 70); g.lineTo(x + 100, gy - 70); g.stroke(); const s = Math.sin(t * 2.5) * 0.5; g.strokeStyle = '#555'; g.lineWidth = 1; g.beginPath(); g.moveTo(x + 60, gy - 70); g.lineTo(x + 60 + Math.sin(s) * 45, gy - 70 + Math.cos(s) * 45); g.stroke(); g.fillStyle = '#ffd23f'; g.fillRect(x + 52 + Math.sin(s) * 45, gy - 72 + Math.cos(s) * 45, 16, 4); g.fillStyle = '#4fc3f7'; g.beginPath(); g.ellipse(x + 220, gy - 6, 40, 8, 0, 0, TAU); g.fill(); g.strokeStyle = '#1e88e5'; g.lineWidth = 3; g.stroke(); emoji(g, '🦆', x + 215, gy - 14, 14); });
    grass(g, V, off);
  },

  // Grundschule: Altbau von 1898 (3 Geschosse, Walmdach) + moderner Erweiterungsbau mit Staffelgeschoss
  school(g, V, off, t, lv) {
    const gy = V.groundY;
    sky(g, V, '#8fd0f3', '#f1f9ff'); clouds(g, V, off);
    once(V, off, 0.3, 1300, 300, (x) => {
      g.fillStyle = '#e9d6b0'; g.fillRect(x, gy - 160, 200, 160);
      g.fillStyle = '#8d4a3a'; g.beginPath(); g.moveTo(x - 10, gy - 160); g.lineTo(x + 30, gy - 205); g.lineTo(x + 170, gy - 205); g.lineTo(x + 210, gy - 160); g.fill();
      g.fillStyle = '#b88a5a'; g.fillRect(x, gy - 112, 200, 5); g.fillRect(x, gy - 62, 200, 5);
      for (let r = 0; r < 3; r++) for (let i = 0; i < 5; i++) { const wx = x + 14 + i * 38, wy = gy - 150 + r * 50; g.fillStyle = '#c9a77a'; g.fillRect(wx - 3, wy - 3, 26, 38); windowFrame(g, wx, wy, 20, 32, '#bfe3f7', '#fff', true); }
      g.fillStyle = '#6d4c41'; g.fillRect(x + 88, gy - 40, 26, 40); g.fillStyle = '#c9a77a'; g.beginPath(); g.arc(x + 101, gy - 40, 15, Math.PI, 0); g.fill();
      sign(g, S(lv, 'school', 'GRUNDSCHULE'), x + 100, gy - 172, { bg: '#fff', fg: '#1b4f8a', size: 11 });
      // Erweiterungsbau
      g.fillStyle = '#f4f4f0'; g.fillRect(x + 230, gy - 120, 190, 120); g.fillStyle = '#e0e0da'; g.fillRect(x + 260, gy - 150, 160, 30);
      g.fillStyle = '#ff8a65'; g.fillRect(x + 230, gy - 120, 8, 120);
      g.fillStyle = '#90caf9'; for (let r = 0; r < 3; r++) g.fillRect(x + 250, gy - 112 + r * 36, 160, 22); g.fillRect(x + 270, gy - 145, 140, 18);
    });
    rep(V, off, 0.55, 380, (x) => { g.strokeStyle = '#1e88e5'; g.lineWidth = 3; g.strokeRect(x, gy - 60, 60, 60); g.beginPath(); g.moveTo(x, gy - 30); g.lineTo(x + 60, gy - 30); g.moveTo(x + 30, gy - 60); g.lineTo(x + 30, gy); g.stroke(); emoji(g, '🎒', x + 150, gy - 10, 18); });
    rep(V, off, 0.45, 260, (x) => { tree(g, x + 120, gy, 80, '#43a047', '#6d4c41', 26); });
    floor(g, V, '#c9b79c', '#a1887f', off, () => { g.fillStyle = '#fff'; rep(V, off, 1, 120, (x) => { g.fillRect(x, gy + 14, 2, 18); g.fillRect(x + 30, gy + 22, 40, 2); }); });
  },

  // Einkaufszentrum von außen (nach Fotos): Granitbau mit roten Buchstaben + gestapelten Ladenschildern,
  // Glas-Rundbau mit Stadtbibliothek oben, Glasbrücke, großer Platanen-Baum, gemustertes Pflaster
  mallOut(g, V, off, t, lv) {
    const gy = V.groundY;
    sky(g, V, '#8fb6d9', '#eef3f7'); clouds(g, V, off, 0.8);
    const name = S(lv, 'mall', 'EINKAUFSZENTRUM'), shops = S(lv, 'mallShops', null) || ['SPIELWAREN', 'SCHUHE', 'MODE', 'DEKO', 'DROGERIE', 'SNEAKER'];
    const seg = 900;
    rep(V, off, 0.3, seg, (x) => {
      // Granit-Kubus
      const bx = x, bw = 300, bh = 200;
      g.fillStyle = '#a7a39c'; g.fillRect(bx, gy - bh, bw, bh);
      g.fillStyle = 'rgba(0,0,0,0.05)'; for (let i = 0; i < 40; i++) g.fillRect(bx + (i * 53) % bw, gy - bh + (i * 31) % bh, 14, 6);
      for (let r = 0; r < 3; r++) for (let c = 0; c < 5; c++) { const wx = bx + 92 + c * 40, wy = gy - bh + 14 + r * 50; g.fillStyle = '#7b6545'; g.fillRect(wx, wy, 26, 40); g.fillStyle = '#2b2a2a'; g.fillRect(wx + 4, wy + 3, 18, 34); g.fillStyle = '#9a8a6a'; g.fillRect(wx + 10, wy + 3, 2, 34); }
      // rote Buchstaben + gestapelte Ladenschilder an der Ecke
      g.save(); g.translate(bx + 46, gy - bh + 24); g.rotate(0.12);
      g.fillStyle = '#d32f2f'; g.font = '900 20px ui-rounded, system-ui, sans-serif'; g.textAlign = 'center';
      name.split(' ').forEach((w, i) => g.fillText(w, 0, i * 20, 84));
      const scol = ['#e53935', '#fafafa', '#ff7043', '#ffd23f', '#e91e63', '#fafafa'];
      shops.slice(0, 6).forEach((sname, i) => { g.font = `900 ${i % 2 ? 9 : 10}px ui-rounded, system-ui, sans-serif`; g.lineWidth = 3; g.strokeStyle = 'rgba(0,0,0,0.5)'; g.strokeText(sname, 0, 50 + i * 15, 80); g.fillStyle = scol[i]; g.fillText(sname, 0, 50 + i * 15, 80); });
      g.restore();
      // Erdgeschoss mit Schaufenstern + Sale
      g.fillStyle = '#5e5446'; g.fillRect(bx, gy - 44, bw, 44);
      for (let i = 0; i < 6; i++) { g.fillStyle = '#f6e7c9'; g.fillRect(bx + 6 + i * 49, gy - 38, 42, 38); g.fillStyle = '#d32f2f'; g.font = '900 10px sans-serif'; g.textAlign = 'center'; if (i % 2) g.fillText('-30%', bx + 27 + i * 49, gy - 22); }
      // Glasbrücke zum Nachbarbau
      g.fillStyle = 'rgba(190,220,240,0.75)'; g.fillRect(bx + bw, gy - 140, 130, 40); g.strokeStyle = '#7a8a96'; g.lineWidth = 2; g.strokeRect(bx + bw, gy - 140, 130, 40);
      for (let i = 1; i < 6; i++) { g.beginPath(); g.moveTo(bx + bw + i * 22, gy - 140); g.lineTo(bx + bw + i * 22, gy - 100); g.stroke(); }
      g.fillStyle = 'rgba(255,240,200,0.8)'; for (let i = 0; i < 5; i++) { g.beginPath(); g.arc(bx + bw + 12 + i * 24, gy - 132, 3, 0, TAU); g.fill(); }
      // Glas-Rundbau mit Stadtbibliothek oben und rotem Schriftzug
      const rx = bx + bw + 130, rw = 170;
      g.fillStyle = '#ece6da'; g.fillRect(rx + rw - 20, gy - 190, 160, 190); // heller Nachbarbau
      g.fillStyle = '#d8d0c0'; for (let i = 0; i < 4; i++) g.fillRect(rx + rw + 10 + i * 34, gy - 170, 6, 80);
      const gr = g.createLinearGradient(rx, 0, rx + rw, 0); gr.addColorStop(0, '#9cb6c8'); gr.addColorStop(0.5, '#dbe8f0'); gr.addColorStop(1, '#7f9aae');
      g.fillStyle = gr; g.beginPath(); g.moveTo(rx, gy); g.lineTo(rx, gy - 196); g.quadraticCurveTo(rx + rw / 2, gy - 212, rx + rw, gy - 196); g.lineTo(rx + rw, gy); g.fill();
      g.strokeStyle = 'rgba(60,80,95,0.6)'; g.lineWidth = 1.4; for (let i = 1; i < 8; i++) { const xx = rx + i * rw / 8; g.beginPath(); g.moveTo(xx, gy - 200 - Math.sin(i / 8 * Math.PI) * 8); g.lineTo(xx, gy); g.stroke(); }
      for (const yy of [gy - 150, gy - 100, gy - 52]) { g.fillStyle = '#4a5560'; g.fillRect(rx, yy, rw, 4); }
      g.fillStyle = '#fff'; g.font = '700 15px ui-rounded, system-ui, sans-serif'; g.textAlign = 'center'; g.fillText(S(lv, 'library', 'Stadtbibliothek'), rx + rw / 2, gy - 168, rw - 16);
      g.fillStyle = '#d32f2f'; g.font = '900 18px ui-rounded, system-ui, sans-serif'; name.split(' ').forEach((w, i) => g.fillText(w, rx + rw / 2, gy - 124 + i * 18, rw - 20));
      g.fillStyle = 'rgba(255,230,170,0.55)'; g.fillRect(rx + 6, gy - 48, rw - 12, 44); // warm erleuchtetes EG
      // große Platane
      const tx = rx + rw + 150;
      g.fillStyle = '#7b6a55'; g.fillRect(tx - 6, gy - 90, 12, 90);
      for (const [dx, dy, r, c] of [[0, -150, 60, '#7d8f3a'], [-40, -120, 44, '#8a9a42'], [42, -118, 46, '#6f8233'], [0, -190, 40, '#94a54c'], [-20, -100, 34, '#a28a3c']]) { g.fillStyle = c; g.beginPath(); g.arc(tx + dx, gy + dy, r, 0, TAU); g.fill(); }
      // rote Sonnenschirme vom Café
      for (let i = 0; i < 2; i++) { const ux = rx - 70 + i * 40; g.fillStyle = '#c62828'; g.beginPath(); g.moveTo(ux - 16, gy - 34); g.lineTo(ux, gy - 48); g.lineTo(ux + 16, gy - 34); g.fill(); g.fillStyle = '#555'; g.fillRect(ux - 1, gy - 34, 2, 34); }
    });
    // gemustertes Pflaster (hell/dunkel versetzt)
    floor(g, V, '#c7c5c0', '#a9a7a2', off, () => { rep(V, off, 1, 24, (x, k) => { for (let r = 0; r < 4; r++) { g.fillStyle = (k + r) % 3 ? 'rgba(0,0,0,0.06)' : 'rgba(0,0,0,0.16)'; g.fillRect(x + (r % 2) * 12, gy + 4 + r * 10, 22, 8); } }); });
  },

  // Einkaufszentrum innen (nach Foto): geschwungene Galerien mit Glasgeländern, runde Deckenlampen mit Goldrand,
  // Rolltreppen in der Mitte, Palmen in hohen weißen Kübeln, unten Food-Court mit runden Gitter-Lampenringen
  mall(g, V, off, t, lv) {
    const gy = V.groundY;
    g.fillStyle = '#efe7d8'; g.fillRect(0, 0, V.w, gy);
    // Decke mit Oberlicht-Öffnung und Ring-Lampen
    const cg = g.createLinearGradient(0, 0, 0, 60); cg.addColorStop(0, '#f6f0e4'); cg.addColorStop(1, '#e4d9c5'); g.fillStyle = cg; g.fillRect(0, 0, V.w, 60);
    rep(V, off, 0.15, 520, (x) => { g.fillStyle = '#cfe4f3'; g.beginPath(); g.ellipse(x + 260, 8, 150, 26, 0, 0, Math.PI); g.fill(); g.strokeStyle = '#d8ccb6'; g.lineWidth = 4; g.beginPath(); g.ellipse(x + 260, 8, 150, 26, 0, 0, Math.PI); g.stroke(); });
    rep(V, off, 0.2, 180, (x) => { g.fillStyle = '#b68a3a'; g.beginPath(); g.ellipse(x + 90, 46, 34, 7, 0, 0, TAU); g.fill(); g.fillStyle = '#fff8e0'; g.beginPath(); g.ellipse(x + 90, 46, 22, 4, 0, 0, TAU); g.fill(); const lg = g.createRadialGradient(x + 90, 50, 2, x + 90, 50, 40); lg.addColorStop(0, 'rgba(255,240,200,0.5)'); lg.addColorStop(1, 'rgba(255,240,200,0)'); g.fillStyle = lg; g.beginPath(); g.arc(x + 90, 50, 40, 0, TAU); g.fill(); });
    g.fillStyle = '#fff6dc'; rep(V, off, 0.2, 36, (x) => { g.beginPath(); g.arc(x + 10, 62, 1.6, 0, TAU); g.fill(); });
    // Obere Galerie: Läden hinter geschwungenem Glasgeländer
    const upShops = S(lv, 'mallShopsIn', null) || ['MODE', 'BÜCHER', 'SCHUHE', 'BEAUTY', 'SPIELZEUG', 'SPORT'];
    const shopCol = ['#3a3a3a', '#7b1fa2', '#c62828', '#00897b', '#f57c00', '#1e88e5'];
    const gy2 = gy - 128;
    rep(V, off, 0.3, 150, (x, k) => {
      const i = ((k % upShops.length) + upShops.length) % upShops.length;
      g.fillStyle = '#f9f6ef'; g.fillRect(x, gy2 - 64, 144, 64);
      g.fillStyle = '#e8e2d4'; g.fillRect(x + 4, gy2 - 64, 136, 12); g.fillStyle = shopCol[i % 6]; g.font = '900 9px ui-rounded, system-ui, sans-serif'; g.textAlign = 'center'; g.fillText(upShops[i], x + 72, gy2 - 55, 130);
      g.fillStyle = 'rgba(200,225,240,0.7)'; g.fillRect(x + 10, gy2 - 48, 124, 48);
      g.fillStyle = shopCol[i % 6]; for (let j = 0; j < 3; j++) { g.beginPath(); g.moveTo(x + 30 + j * 38, gy2 - 40); g.lineTo(x + 40 + j * 38, gy2 - 40); g.lineTo(x + 44 + j * 38, gy2 - 10); g.lineTo(x + 26 + j * 38, gy2 - 10); g.fill(); }
    });
    // geschwungene Galeriebrüstung (hell) mit Glasgeländer
    g.fillStyle = '#f3ecdf'; g.beginPath(); g.moveTo(0, gy2); for (let x = 0; x <= V.w; x += 10) g.lineTo(x, gy2 + 22 + Math.sin((x + off * 0.3) * 0.006) * 10); g.lineTo(V.w, gy2); g.fill();
    g.fillStyle = 'rgba(200,230,245,0.35)'; g.fillRect(0, gy2 - 20, V.w, 20); g.fillStyle = '#9aa3ab'; g.fillRect(0, gy2 - 22, V.w, 3);
    rep(V, off, 0.3, 46, (x) => { g.fillStyle = 'rgba(150,160,170,0.6)'; g.fillRect(x, gy2 - 20, 2, 20); });
    // Ladenzeile unten mit Schaufenstern
    const shops = S(lv, 'mallShopsDown', null) || ['DROGERIE', 'MODE', 'SCHUHE', 'CAFÉ', 'SPIELWAREN', 'SALE %'];
    rep(V, off, 0.55, 260, (x, k) => {
      const i = ((k % shops.length) + shops.length) % shops.length;
      g.fillStyle = '#faf7f0'; g.fillRect(x, gy - 104, 250, 104);
      g.fillStyle = '#2b2b2b'; g.fillRect(x + 8, gy - 102, 234, 18); g.fillStyle = ['#ffffff', '#ffd23f', '#ff6b6b', '#8fd3ff'][i % 4]; g.font = '900 12px ui-rounded, system-ui, sans-serif'; g.textAlign = 'center'; g.fillText(shops[i], x + 125, gy - 88, 220);
      g.fillStyle = 'rgba(200,228,245,0.8)'; g.fillRect(x + 10, gy - 80, 150, 80); g.strokeStyle = '#a9b4bd'; g.lineWidth = 2; g.strokeRect(x + 10, gy - 80, 150, 80);
      const cols = ['#f06292', '#3fae3a', '#ffd54f', '#7e57c2'];
      for (let j = 0; j < 3; j++) { const mx = x + 36 + j * 46; g.fillStyle = '#d7ccc8'; g.beginPath(); g.arc(mx, gy - 66, 5, 0, TAU); g.fill(); g.fillStyle = cols[(j + i) % 4]; g.beginPath(); g.moveTo(mx - 8, gy - 60); g.lineTo(mx + 8, gy - 60); g.lineTo(mx + 13, gy - 22); g.lineTo(mx - 13, gy - 22); g.fill(); }
      if (shops[i].includes('%')) label(g, '-50%', x + 136, gy - 70, 10);
      g.fillStyle = 'rgba(180,210,230,0.8)'; g.fillRect(x + 172, gy - 80, 66, 80); g.strokeStyle = '#8a98a4'; g.strokeRect(x + 172, gy - 80, 66, 80);
    });
    // Rolltreppen (paarweise, mit Glasseiten)
    rep(V, off, 0.6, 760, (x) => {
      for (let j = 0; j < 2; j++) {
        const ex = x + 240 + j * 44;
        g.fillStyle = 'rgba(190,215,235,0.6)'; g.beginPath(); g.moveTo(ex, gy); g.lineTo(ex + 40, gy); g.lineTo(ex + 150, gy2 + 4); g.lineTo(ex + 110, gy2 + 4); g.fill();
        g.fillStyle = '#3c4a57'; g.beginPath(); g.moveTo(ex + 6, gy); g.lineTo(ex + 34, gy); g.lineTo(ex + 144, gy2 + 4); g.lineTo(ex + 116, gy2 + 4); g.fill();
        g.strokeStyle = '#59697a'; g.lineWidth = 1; for (let s2 = 0; s2 < 14; s2++) { const u = ((s2 / 14) + t * 0.15 * (j ? -1 : 1) + 10) % 1; const sx = ex + 6 + u * 110, sy = gy - u * (gy - gy2 - 4); g.beginPath(); g.moveTo(sx, sy); g.lineTo(sx + 28, sy); g.stroke(); }
        g.strokeStyle = '#1d2228'; g.lineWidth = 3; g.beginPath(); g.moveTo(ex, gy - 14); g.lineTo(ex + 110, gy2 - 10); g.moveTo(ex + 40, gy - 14); g.lineTo(ex + 150, gy2 - 10); g.stroke();
      }
    });
    // Food-Court: runde Gitter-Ringe mit Glühbirnen-Pendeln, Holzbänke; Palmen in weißen Kübeln
    rep(V, off, 0.7, 640, (x) => {
      for (let j = 0; j < 2; j++) {
        const cx = x + 80 + j * 110;
        g.strokeStyle = '#222'; g.lineWidth = 1.4; g.beginPath(); g.moveTo(cx, 0); g.lineTo(cx, gy - 120); g.stroke();
        g.fillStyle = 'rgba(40,40,40,0.25)'; g.beginPath(); g.ellipse(cx, gy - 120, 48, 9, 0, 0, TAU); g.fill(); g.strokeStyle = '#1e1e1e'; g.lineWidth = 2; g.stroke();
        for (let b2 = 0; b2 < 5; b2++) { const lx = cx - 32 + b2 * 16, ly = gy - 100 + (b2 % 2) * 12; g.strokeStyle = '#333'; g.lineWidth = 0.8; g.beginPath(); g.moveTo(lx, gy - 118); g.lineTo(lx, ly); g.stroke(); g.fillStyle = 'rgba(255,220,150,0.95)'; g.beginPath(); g.arc(lx, ly + 3, 3, 0, TAU); g.fill(); }
        g.fillStyle = '#c08a4e'; g.fillRect(cx - 40, gy - 30, 80, 6); g.fillStyle = '#a06f3a'; g.fillRect(cx - 44, gy - 24, 88, 24); g.fillStyle = '#c62828'; g.fillRect(cx - 40, gy - 34, 80, 4);
      }
      const px = x + 420;
      g.fillStyle = '#f5f3ee'; g.beginPath(); g.moveTo(px - 14, gy - 70); g.lineTo(px + 14, gy - 70); g.lineTo(px + 9, gy); g.lineTo(px - 9, gy); g.fill(); g.strokeStyle = '#ddd6c8'; g.lineWidth = 1; g.stroke();
      for (let l = 0; l < 7; l++) { g.save(); g.translate(px, gy - 70); g.rotate(-1.4 + l * 0.47); g.fillStyle = l % 2 ? '#2e7d32' : '#43a047'; g.beginPath(); g.ellipse(0, -22, 6, 24, 0, 0, TAU); g.fill(); g.restore(); }
    });
    floor(g, V, '#ece4d4', '#d6ccb8', off, () => { g.strokeStyle = 'rgba(0,0,0,0.07)'; g.lineWidth = 1; rep(V, off, 1, 36, (x) => { g.beginPath(); g.moveTo(x, gy + 2); g.lineTo(x - 16, V.h); g.stroke(); }); for (const yy of [12, 28, 48]) { g.beginPath(); g.moveTo(0, gy + yy); g.lineTo(V.w, gy + yy); g.stroke(); } });
  },

  // Payback: Tresorraum mit Goldbarren und Geldregen
  bank(g, V, off, t) {
    const gy = V.groundY;
    sky(g, V, '#2e3b2f', '#4f6b52');
    rep(V, off, 0.3, 300, (x) => { g.fillStyle = '#9e9e9e'; g.beginPath(); g.arc(x + 100, gy - 110, 70, 0, TAU); g.fill(); g.fillStyle = '#bdbdbd'; g.beginPath(); g.arc(x + 100, gy - 110, 58, 0, TAU); g.fill(); g.strokeStyle = '#616161'; g.lineWidth = 6; for (let i = 0; i < 6; i++) { const a = i / 6 * TAU + t * 0.2; g.beginPath(); g.moveTo(x + 100, gy - 110); g.lineTo(x + 100 + Math.cos(a) * 30, gy - 110 + Math.sin(a) * 30); g.stroke(); } g.fillStyle = '#757575'; g.beginPath(); g.arc(x + 100, gy - 110, 10, 0, TAU); g.fill(); for (let i = 0; i < 4; i++) { g.fillStyle = '#ffd23f'; g.beginPath(); g.moveTo(x + 200 + i * 14, gy - 20); g.lineTo(x + 212 + i * 14, gy - 20); g.lineTo(x + 208 + i * 14, gy - 28); g.lineTo(x + 196 + i * 14, gy - 28); g.fill(); } });
    for (let i = 0; i < 16; i++) emoji(g, '💸', wrap(i * 61 - off * 0.2, V.w + 40) - 20, wrap(i * 47 + t * 40, gy), 14, Math.sin(t * 2 + i));
    sign(g, 'PAYBACK', V.w / 2, 30, { bg: '#1b5e20', fg: '#ffd23f', size: 16 });
    floor(g, V, '#5d6d5f', '#3e4a40', off, () => { g.strokeStyle = 'rgba(0,0,0,0.2)'; rep(V, off, 1, 50, (x) => g.strokeRect(x, gy + 2, 50, 50)); });
  },

  // Fahrschule: Hanauer Stadtstraße mit Ampeln und Fahrschulauto
  driving(g, V, off, t) {
    const gy = V.groundY;
    sky(g, V, '#9fd3f5', '#f2f9ff'); clouds(g, V, off);
    rep(V, off, 0.25, 130, (x, k) => { const h = 120 + ((k * 31) % 50 + 50) % 50; g.fillStyle = ['#e0d6c8', '#cfd8dc', '#f0e4d0', '#d7ccc8'][((k % 4) + 4) % 4]; g.fillRect(x, gy - 40 - h, 120, h); g.fillStyle = '#90caf9'; for (let r = 0; r < 3; r++) for (let i = 0; i < 4; i++) g.fillRect(x + 10 + i * 27, gy - 30 - h + r * 36, 16, 22); });
    g.fillStyle = '#bdbdbd'; g.fillRect(0, gy - 40, V.w, 12);
    rep(V, off, 0.6, 330, (x) => { g.fillStyle = '#333'; g.fillRect(x, gy - 110, 5, 70); roundRect(g, x - 6, gy - 140, 17, 34, 4); g.fill(); const ph = Math.floor(t / 2) % 3; ['#e53935', '#fdd835', '#43a047'].forEach((c, i) => { g.fillStyle = ph === i ? c : '#444'; g.beginPath(); g.arc(x + 2.5, gy - 133 + i * 10, 3.5, 0, TAU); g.fill(); }); });
    rep(V, off, 0.5, 700, (x) => { g.fillStyle = '#fafafa'; roundRect(g, x, gy - 58, 80, 20, 6); g.fill(); roundRect(g, x + 14, gy - 72, 46, 16, 6); g.fill(); g.fillStyle = '#1565c0'; roundRect(g, x + 22, gy - 86, 30, 12, 3); g.fill(); g.fillStyle = '#fff'; g.font = '900 7px sans-serif'; g.textAlign = 'center'; g.fillText('FAHRSCHULE', x + 37, gy - 77); g.fillStyle = '#e53935'; g.fillRect(x + 66, gy - 54, 10, 8); g.fillStyle = '#fff'; g.fillText('L', x + 71, gy - 48); g.fillStyle = '#222'; g.beginPath(); g.arc(x + 18, gy - 38, 7, 0, TAU); g.arc(x + 62, gy - 38, 7, 0, TAU); g.fill(); });
    asphalt(g, V, off);
  },

  // Cocktailbar: Café am Tag, abends Lounge mit Cocktails
  bar(g, V, off, t, lv) {
    const gy = V.groundY;
    sky(g, V, '#2a1520', '#4a2530');
    g.fillStyle = 'rgba(255,170,90,0.08)'; for (let i = 0; i < 5; i++) { g.beginPath(); g.arc(V.w * (0.1 + i * 0.22), 20, 60, 0, TAU); g.fill(); }
    rep(V, off, 0.4, 360, (x) => {
      g.fillStyle = '#3a1f14'; g.fillRect(x, gy - 170, 300, 100);
      for (let r = 0; r < 3; r++) { g.fillStyle = 'rgba(255,190,120,0.25)'; g.fillRect(x + 5, gy - 165 + r * 32, 290, 26); for (let i = 0; i < 12; i++) { g.fillStyle = ['#c62828', '#2e7d32', '#f9a825', '#6a1b9a', '#eeeeee'][(i + r * 2) % 5]; roundRect(g, x + 12 + i * 23, gy - 162 + r * 32, 8, 20, 2); g.fill(); } g.fillStyle = '#5d3a22'; g.fillRect(x + 5, gy - 141 + r * 32, 290, 3); }
      g.fillStyle = '#6d4c41'; g.fillRect(x, gy - 60, 300, 12); g.fillStyle = '#4e342e'; g.fillRect(x + 6, gy - 48, 288, 48); g.fillStyle = 'rgba(255,200,120,0.5)'; g.fillRect(x + 6, gy - 49, 288, 2);
      for (let i = 0; i < 3; i++) { g.strokeStyle = '#ffcc80'; g.lineWidth = 1; g.beginPath(); g.moveTo(x + 60 + i * 90, 0); g.lineTo(x + 60 + i * 90, 40); g.stroke(); g.fillStyle = '#ffb74d'; g.shadowColor = '#ffb74d'; g.shadowBlur = 16; g.beginPath(); g.arc(x + 60 + i * 90, 46, 7, 0, TAU); g.fill(); g.shadowBlur = 0; }
    });
    once(V, off, 0.4, 900, 200, (x) => neon(g, S(lv, 'bar', 'COCKTAILBAR'), x, gy - 186, '#ff6fae', 20, t, 1));
    planks(g, V, off, '#5a3a28', '#3e2416');
  },

  // Fips' Wohnung: Kratzbaum, Fensterbank, Katzenklo
  catFlat(g, V, off, t) {
    const gy = V.groundY;
    wallpaper(g, V, off, '#f4ede4', 'rgba(232,132,58,0.18)');
    rep(V, off, 0.5, 400, (x) => {
      windowFrame(g, x + 30, gy - 190, 90, 80); g.fillStyle = '#e0e0e0'; g.fillRect(x + 24, gy - 110, 102, 8);
      g.fillStyle = '#c8b39b'; g.fillRect(x + 200, gy - 150, 10, 150); g.fillRect(x + 250, gy - 100, 10, 100);
      g.fillStyle = '#a1887f'; roundRect(g, x + 180, gy - 158, 50, 12, 5); g.fill(); roundRect(g, x + 232, gy - 108, 50, 12, 5); g.fill(); roundRect(g, x + 190, gy - 40, 80, 40, 8); g.fill();
      g.fillStyle = '#ff8a65'; g.beginPath(); g.arc(x + 205, gy - 120, 6, 0, TAU); g.fill();
      g.fillStyle = '#90a4ae'; roundRect(g, x + 320, gy - 22, 50, 22, 4); g.fill(); g.fillStyle = '#cfd8dc'; g.fillRect(x + 324, gy - 22, 42, 4);
      g.fillStyle = '#ff7043'; g.beginPath(); g.ellipse(x + 160, gy - 6, 14, 5, 0, 0, TAU); g.fill(); emoji(g, '🐟', x + 160, gy - 12, 12);
    });
    floor(g, V, '#c8a27a', '#a8825a', off, () => { g.fillStyle = 'rgba(0,0,0,0.08)'; rep(V, off, 1, 40, (x) => g.fillRect(x, gy + 3, 2, V.h)); });
  },

  // Gymnasium: moderner Schulbau, davor ein historisches Sandstein-Tor
  hola(g, V, off, t, lv) {
    // Gymnasium: 70er-Jahre-Bau (helle Betonbänder, orange Brüstungen, Flachdach mit Begrünung), freistehendes
    // Renaissance-Sandsteinportal, Inschrift-Stein auf Sockel, Kastanie, Pflasterhof mit Pollern, Teich, Steinkreis
    const gy = V.groundY;
    sky(g, V, '#9fcdf0', '#eef7ff'); clouds(g, V, off);
    // Hauptbau, zwei Geschosse mit zurückgesetztem Obergeschoss
    rep(V, off, 0.25, 420, (x) => {
      g.fillStyle = '#dcdcd6'; g.fillRect(x, gy - 150, 400, 26); g.fillStyle = '#c8c8c2'; g.fillRect(x, gy - 152, 400, 3);
      for (let i = 0; i < 9; i++) { g.fillStyle = '#3d4450'; g.fillRect(x + 8 + i * 44, gy - 144, 36, 14); }
      g.fillStyle = '#5e8f3a'; for (let i = 0; i < 12; i++) { g.beginPath(); g.arc(x + 10 + i * 34, gy - 154, 5, 0, TAU); g.fill(); } // Dachbegrünung
      g.fillStyle = '#e8e8e2'; g.fillRect(x - 10, gy - 124, 420, 124);
      g.fillStyle = '#d6d6cf'; g.fillRect(x - 10, gy - 124, 420, 5); g.fillRect(x - 10, gy - 64, 420, 5); // Betonbänder
      for (const row of [0, 60]) for (let i = 0; i < 10; i++) {
        const wx = x + i * 41, wy = gy - 116 + row;
        g.fillStyle = '#2f3540'; g.fillRect(wx, wy, 36, 30); g.fillStyle = 'rgba(160,200,230,0.35)'; g.fillRect(wx + 2, wy + 2, 15, 26);
        g.fillStyle = '#ff5a1f'; g.fillRect(wx, wy + 30, 36, 14); g.fillStyle = 'rgba(0,0,0,0.12)'; g.fillRect(wx + 17, wy + 30, 2, 14); // orange Brüstung
      }
    });
    // Sandsteinportal (freistehender Torbogen mit Ziergiebel, Obelisken, Maskarons)
    once(V, off, 0.42, 1400, 380, (x) => {
      const sd = '#a5513b', sl = '#b9654c', w = 120, top = gy - 190;
      g.fillStyle = sd; g.fillRect(x, top + 70, 24, 190 - 70); g.fillRect(x + w - 24, top + 70, 24, 190 - 70);
      g.fillRect(x - 6, top + 54, w + 12, 20); g.fillRect(x + 4, top + 74, w - 8, 18);
      // Zwickel über dem offenen Rundbogen (Bogen selbst bleibt durchsichtig)
      g.fillStyle = sd; g.beginPath(); g.moveTo(x + 24, top + 92); g.lineTo(x + w - 24, top + 92); g.lineTo(x + w - 24, top + 132); g.arc(x + w / 2, top + 132, w / 2 - 24, 0, Math.PI, true); g.closePath(); g.fill();
      g.strokeStyle = sl; g.lineWidth = 3; g.beginPath(); g.arc(x + w / 2, top + 132, w / 2 - 25, Math.PI, 0); g.stroke();
      g.fillStyle = sl; g.fillRect(x + 8, top + 8, w - 16, 46); // Aufsatz mit Wappenfeld
      g.beginPath(); g.moveTo(x + 4, top + 10); g.lineTo(x + w / 2, top - 18); g.lineTo(x + w - 4, top + 10); g.closePath(); g.fill(); g.fillRect(x + w / 2 - 2, top - 30, 4, 14);
      g.strokeStyle = 'rgba(80,30,20,0.5)'; g.lineWidth = 1.2; g.strokeRect(x + 22, top + 16, 34, 30); g.strokeRect(x + w - 56, top + 16, 34, 30);
      for (const ox of [x + 39, x + w - 39]) { g.beginPath(); g.arc(ox, top + 31, 9, 0, TAU); g.stroke(); }
      g.fillStyle = sl; for (const ox of [x + 8, x + w - 14]) { g.beginPath(); g.moveTo(ox, top + 54); g.lineTo(ox + 3, top + 14); g.lineTo(ox + 6, top + 54); g.fill(); } // Obelisken
      g.fillStyle = 'rgba(80,30,20,0.55)'; for (const ox of [x + 12, x + w - 12]) { g.beginPath(); g.arc(ox, top + 112, 6, 0, TAU); g.fill(); g.beginPath(); g.arc(ox, top + 170, 6, 0, TAU); g.fill(); } // Fratzen
      g.beginPath(); g.arc(x + w / 2, top + 84, 6, 0, TAU); g.fill();
      g.strokeStyle = 'rgba(60,20,10,0.3)'; for (let r = 0; r < 9; r++) { g.beginPath(); g.moveTo(x, top + 80 + r * 12); g.lineTo(x + 24, top + 80 + r * 12); g.moveTo(x + w - 24, top + 80 + r * 12); g.lineTo(x + w, top + 80 + r * 12); g.stroke(); }
      g.fillStyle = '#fff'; g.font = '900 8px Georgia, serif'; g.textAlign = 'center'; g.fillText(S(lv, 'year', ''), x + w / 2, top + 67);
      sign(g, S(lv, 'jubilee', S(lv, 'school', 'SCHULE')), x + w + 110, gy - 128, { bg: '#fafafa', fg: '#c0392b', size: 11 });
    });
    // Kastanie mit Inschrift-Stein auf Sockel
    rep(V, off, 0.5, 620, (x) => {
      g.fillStyle = '#6d4c41'; g.fillRect(x + 150, gy - 110, 16, 110);
      for (const [dx, dy, r, c] of [[158, -150, 58, '#4f8a2e'], [118, -128, 40, '#5c9a34'], [200, -128, 42, '#5c9a34'], [158, -190, 36, '#6aa83c'], [130, -168, 30, '#c79a2a']]) { g.fillStyle = c; g.beginPath(); g.arc(x + dx, gy + dy, r, 0, TAU); g.fill(); }
      g.fillStyle = '#a07a5e'; g.fillRect(x + 30, gy - 40, 46, 40); g.strokeStyle = 'rgba(70,40,20,0.5)'; g.lineWidth = 2; for (let i = 0; i < 3; i++) { g.beginPath(); g.moveTo(x + 36, gy - 10 - i * 8); g.lineTo(x + 53, gy - 20 - i * 8); g.lineTo(x + 70, gy - 10 - i * 8); g.stroke(); } // Sockel mit Winkelmuster
      g.fillStyle = '#b38a6a'; roundRect(g, x + 26, gy - 92, 54, 50, 6); g.fill();
      g.fillStyle = 'rgba(70,40,20,0.75)'; g.font = '900 8px Georgia, serif'; g.textAlign = 'center'; const ins = S(lv, 'motto', '').split('|'); ins.forEach((ln, i) => g.fillText(ln, x + 53, gy - 76 + i * 10, 50));
      // Poller & Steinsitze
      g.fillStyle = '#9e9e9e'; for (let i = 0; i < 5; i++) g.fillRect(x + 230 + i * 16, gy - 26, 3, 26); g.fillStyle = '#d32f2f'; for (let i = 0; i < 5; i++) g.fillRect(x + 230 + i * 16, gy - 22, 3, 3);
      g.fillStyle = '#cfc8bc'; for (let i = 0; i < 3; i++) roundRect(g, x + 330 + i * 26, gy - 14, 20, 14, 3), g.fill();
    });
    // Schulteich mit Findlingen & Steinkreis (Freiluft-Klassenzimmer)
    once(V, off, 0.55, 1500, 1150, (x) => {
      g.fillStyle = '#6fa83c'; g.beginPath(); g.ellipse(x + 80, gy - 4, 120, 16, 0, Math.PI, 0); g.fill();
      g.fillStyle = '#2e3d3a'; g.beginPath(); g.ellipse(x + 70, gy - 6, 62, 9, 0, 0, TAU); g.fill(); g.fillStyle = 'rgba(255,90,31,0.4)'; g.fillRect(x + 40, gy - 9, 50, 3);
      g.fillStyle = '#7b7b7b'; for (const [dx, r] of [[0, 9], [140, 11], [170, 8]]) { g.beginPath(); g.ellipse(x + dx, gy - 6, r * 1.4, r, 0, Math.PI, 0); g.fill(); }
      for (let i = 0; i < 9; i++) { const a = Math.PI + (i / 8) * Math.PI; g.fillStyle = i % 2 ? '#c8a27a' : '#b98f68'; g.fillRect(x + 300 + Math.cos(a) * 70 - 11, gy - 14 + Math.sin(a) * 6, 22, 14); }
    });
    cobble(g, V, off, '#a9a39a', '#8d877c');
  },

  // Hochschule: 1950er-Bau mit Rasterfassade, dahinter ein roter Sandstein-Dom
  uni(g, V, off, t, lv) {
    const gy = V.groundY;
    sky(g, V, '#9ccff0', '#eef7ff'); clouds(g, V, off);
    once(V, off, 0.12, 1400, 600, (x) => domMainz(g, x, gy - 30, 0.8));
    rep(V, off, 0.3, 380, (x) => { g.fillStyle = '#e7dfcf'; g.fillRect(x, gy - 150, 340, 150); g.fillStyle = '#d6cbb3'; g.fillRect(x, gy - 156, 340, 8); for (let r = 0; r < 4; r++) for (let i = 0; i < 10; i++) { g.fillStyle = '#7fb0d8'; g.fillRect(x + 8 + i * 33, gy - 145 + r * 34, 26, 24); g.strokeStyle = '#efe9dc'; g.lineWidth = 1.5; g.strokeRect(x + 8 + i * 33, gy - 145 + r * 34, 26, 24); } g.fillStyle = '#6d4c41'; g.fillRect(x + 150, gy - 40, 40, 40); });
    once(V, off, 0.3, 1000, 120, (x) => sign(g, S(lv, 'uni', 'HOCHSCHULE'), x, gy - 168, { bg: '#0d47a1', fg: '#fff', size: 12 }));
    rep(V, off, 0.55, 300, (x) => { g.fillStyle = '#795548'; g.fillRect(x, gy - 30, 100, 6); g.fillRect(x + 8, gy - 24, 5, 24); g.fillRect(x + 87, gy - 24, 5, 24); emoji(g, '🍟', x + 30, gy - 38, 14); emoji(g, '☕', x + 70, gy - 38, 12); });
    cobble(g, V, off, '#c2b8a8', '#a0968a');
  },

  // Wiesbaden: Gründerzeit-Häuser mit Stuck, Erkern und Balkonen, das alte Justizgebäude (1893–97, Frührenaissance) und der Kneipeneingang
  wiesbaden(g, V, off, t, lv) {
    const gy = V.groundY;
    sky(g, V, '#8fc7ee', '#f3f8ff'); clouds(g, V, off);
    // Gründerzeit-Häuserzeile
    const fac = ['#f2e6cf', '#e9d3b0', '#f5ede0', '#e6cfa8', '#efe0d0'];
    rep(V, off, 0.3, 132, (x, k) => {
      const c = fac[((k % 5) + 5) % 5], h = 168 + ((k * 13) % 3) * 10;
      g.fillStyle = c; g.fillRect(x, gy - h, 126, h);
      g.fillStyle = '#5d6b78'; g.beginPath(); g.moveTo(x - 4, gy - h); g.lineTo(x + 10, gy - h - 26); g.lineTo(x + 116, gy - h - 26); g.lineTo(x + 130, gy - h); g.fill();
      g.fillStyle = '#4a5763'; for (let i = 0; i < 3; i++) { roundRect(g, x + 22 + i * 34, gy - h - 22, 14, 16, 6); g.fill(); }
      g.fillStyle = 'rgba(0,0,0,0.08)'; g.fillRect(x, gy - h + 6, 126, 4); g.fillRect(x, gy - 64, 126, 5);
      for (let r = 0; r < 3; r++) for (let i = 0; i < 3; i++) {
        const wx = x + 14 + i * 38, wy = gy - h + 18 + r * 36;
        g.fillStyle = '#d8c4a0'; g.beginPath(); g.moveTo(wx - 4, wy); g.lineTo(wx + 12, wy - 8); g.lineTo(wx + 28, wy); g.fill();
        g.fillStyle = '#7fa8c8'; g.fillRect(wx, wy + 2, 24, 26); g.strokeStyle = '#fff'; g.lineWidth = 1.5; g.strokeRect(wx, wy + 2, 24, 26); g.beginPath(); g.moveTo(wx + 12, wy + 2); g.lineTo(wx + 12, wy + 28); g.stroke();
        if (r === 1 && i === 1) { g.strokeStyle = '#2b2b2b'; g.lineWidth = 1.2; g.strokeRect(wx - 6, wy + 22, 36, 10); for (let b = 0; b < 7; b++) { g.beginPath(); g.moveTo(wx - 4 + b * 5, wy + 22); g.lineTo(wx - 4 + b * 5, wy + 32); g.stroke(); } }
      }
      if (k % 2 === 0) { g.fillStyle = c; g.fillRect(x + 44, gy - h + 8, 38, 96); g.strokeStyle = 'rgba(0,0,0,0.12)'; g.lineWidth = 1; g.strokeRect(x + 44, gy - h + 8, 38, 96); }
      g.fillStyle = '#6d4c41'; roundRect(g, x + 50, gy - 46, 26, 46, 10); g.fill();
    });
    // altes Justizgebäude
    once(V, off, 0.3, 1250, 350, (x) => {
      const w = 300, h = 190, c = '#c98a6a', c2 = '#a86a4c';
      g.fillStyle = c; g.fillRect(x, gy - h, w, h);
      for (const [dx, tw, th] of [[0, 54, 250], [w - 54, 54, 250], [w / 2 - 40, 80, 230]]) {
        g.fillStyle = c2; g.fillRect(x + dx, gy - th, tw, th);
        g.beginPath(); g.moveTo(x + dx - 2, gy - th); for (let st = 0; st < 4; st++) { g.lineTo(x + dx + st * tw / 8, gy - th - st * 10); g.lineTo(x + dx + (st + 1) * tw / 8, gy - th - st * 10); } g.lineTo(x + dx + tw / 2, gy - th - 42); for (let st = 3; st >= 0; st--) { g.lineTo(x + dx + tw - (st + 1) * tw / 8, gy - th - st * 10); g.lineTo(x + dx + tw - st * tw / 8, gy - th - st * 10); } g.lineTo(x + dx + tw + 2, gy - th); g.fill();
      }
      g.fillStyle = '#e8d8c0'; g.fillRect(x, gy - h + 60, w, 6); g.fillRect(x, gy - h + 120, w, 6);
      for (let r = 0; r < 3; r++) for (let i = 0; i < 7; i++) { const wx = x + 12 + i * 42, wy = gy - h + 14 + r * 60; g.fillStyle = '#e8d8c0'; g.beginPath(); g.arc(wx + 11, wy + 6, 13, Math.PI, 0); g.fill(); g.fillStyle = '#5a7d9a'; g.beginPath(); g.moveTo(wx, wy + 40); g.lineTo(wx, wy + 6); g.arc(wx + 11, wy + 6, 11, Math.PI, 0); g.lineTo(wx + 22, wy + 40); g.fill(); }
      g.fillStyle = '#4e342e'; g.beginPath(); g.moveTo(x + w / 2 - 22, gy); g.lineTo(x + w / 2 - 22, gy - 52); g.arc(x + w / 2, gy - 52, 22, Math.PI, 0); g.lineTo(x + w / 2 + 22, gy); g.fill();
      for (let st = 0; st < 3; st++) { g.fillStyle = '#d6c4a8'; g.fillRect(x + w / 2 - 40 - st * 6, gy - 6 + st * 2 - 6, 80 + st * 12, 6); }
      emoji(g, '⚖️', x + w / 2, gy - 112, 30);
      g.fillStyle = '#3e2723'; g.font = '900 13px Georgia, serif'; g.textAlign = 'center'; g.fillText(S(lv, 'court', 'GERICHT'), x + w / 2, gy - 82);
    });
    // Kneipeneingang
    once(V, off, 0.5, 900, 650, (x) => {
      g.fillStyle = '#3e2723'; g.fillRect(x, gy - 96, 120, 96);
      g.fillStyle = '#ffcc80'; g.fillRect(x + 8, gy - 80, 34, 34); g.fillRect(x + 78, gy - 80, 34, 34);
      g.fillStyle = '#5d4037'; roundRect(g, x + 46, gy - 62, 28, 62, 4); g.fill(); g.fillStyle = '#ffd23f'; g.beginPath(); g.arc(x + 69, gy - 30, 2, 0, TAU); g.fill();
      g.fillStyle = '#1b1b1b'; roundRect(g, x + 6, gy - 124, 108, 26, 6); g.fill();
      neon(g, S(lv, 'pub', 'KNEIPE'), x + 60, gy - 104, '#ffd23f', 18, t);
      g.strokeStyle = '#3e2723'; g.lineWidth = 2; g.beginPath(); g.moveTo(x + 120, gy - 100); g.lineTo(x + 140, gy - 100); g.stroke(); emoji(g, '🍺', x + 140, gy - 86, 20);
    });
    cobble(g, V, off, '#a8a39a', '#868077');
  },

  // Club mit organischer Lochmembran-Wand (grün/blau angestrahlt, Laser-Projektionen), weißen „Cocoon“-Kapseln mit
  // gelbgrün leuchtenden Sitznischen und einer verkleideten Partymenge (Neon-Stern, Federn, Tütü, Pierrot)
  cocoon(g, V, off, t, lv) {
    const gy = V.groundY;
    sky(g, V, '#04060f', '#0b1028');
    // Membranwand: Grundfläche + unregelmäßige Löcher
    const wg = g.createLinearGradient(0, 0, V.w, gy); wg.addColorStop(0, '#1d5a3a'); wg.addColorStop(0.5, '#2f8f4e'); wg.addColorStop(1, '#203a7a');
    g.fillStyle = wg; g.fillRect(0, 10, V.w, gy - 40);
    rep(V, off, 0.3, 30, (x, k) => {
      for (let r = 0; r < 13; r++) {
        const j = ((((k * 7 + r * 13) % 11) + 11) % 11) / 11, cx = x + (r % 2) * 15 + j * 6, cy = 18 + r * ((gy - 50) / 13) + j * 5, rw = 4 + j * 7, rh = 3.5 + ((((k + r) % 3) + 3) % 3) * 2.2;
        g.fillStyle = '#05070f'; g.beginPath(); g.ellipse(cx, cy, rw, rh, j * 2, 0, TAU); g.fill();
        g.strokeStyle = 'rgba(160,255,120,0.35)'; g.lineWidth = 1.5; g.stroke();
      }
    });
    // Laser-Projektionen (Linienbündel)
    g.save(); g.globalCompositeOperation = 'lighter';
    for (let i = 0; i < 14; i++) { const ph = t * 0.6 + i * 0.45; g.strokeStyle = i % 3 ? 'rgba(80,255,150,0.28)' : 'rgba(80,180,255,0.3)'; g.lineWidth = 1.2; g.beginPath(); g.moveTo(-40 + ((i * 60 + t * 40) % (V.w + 80)), 10); g.lineTo(((i * 60 + t * 40) % (V.w + 80)) + 80 + Math.sin(ph) * 60, gy - 30); g.stroke(); }
    g.restore();
    // weiße Cocoon-Kapseln mit leuchtender Sitznische
    rep(V, off, 0.36, 420, (x) => {
      const cx = x + 160, cy = gy - 110, w = 170, h = 82;
      g.fillStyle = '#f2f4f2'; roundRect(g, cx - w / 2 - 10, cy - h / 2 - 10, w + 20, h + 20, 44); g.fill();
      const ig = g.createRadialGradient(cx, cy - 10, 10, cx, cy, w * 0.6); ig.addColorStop(0, '#f6ff9a'); ig.addColorStop(0.6, '#c6e83a'); ig.addColorStop(1, '#7fae1e');
      g.fillStyle = ig; roundRect(g, cx - w / 2, cy - h / 2, w, h, 38); g.fill();
      g.fillStyle = 'rgba(255,255,255,0.35)'; g.fillRect(cx - w / 2 + 16, cy + 10, w - 32, 6); // Sitzbank
      for (let i = 0; i < 4; i++) { const px = cx - 54 + i * 36; g.fillStyle = 'rgba(40,50,20,0.65)'; g.beginPath(); g.arc(px, cy - 10, 7, 0, TAU); g.fill(); g.fillRect(px - 7, cy - 3, 14, 16); }
      g.fillStyle = 'rgba(255,255,255,0.6)'; g.fillRect(cx - 40, cy - 2, 3, 10); g.fillRect(cx + 22, cy - 2, 3, 10);
      g.strokeStyle = 'rgba(255,255,255,0.8)'; g.lineWidth = 2; g.beginPath(); g.ellipse(cx - w / 2 + 30, cy - h / 2 + 2, 22, 5, -0.2, 0, TAU); g.stroke();
    });
    once(V, off, 0.3, 900, 150, (x) => neon(g, S(lv, 'club', 'CLUB'), x, 30, '#fff', 20, t));
    // verkleidete Partymenge
    rep(V, off, 0.5, 64, (x, k) => {
      const kk = ((k % 6) + 6) % 6, bob = Math.abs(Math.sin(t * 6 + k)) * 5, bx = x + 20, by = gy - 4 - bob;
      g.fillStyle = ['#ff4fd8', '#f5f5f5', '#3ee6b4', '#ffd23f', '#7c4dff', '#ff7043'][kk]; roundRect(g, bx - 9, by - 46, 18, 30, 6); g.fill();
      g.fillStyle = '#111'; g.fillRect(bx - 7, by - 18, 5, 18); g.fillRect(bx + 2, by - 18, 5, 18);
      if (kk === 0) { g.fillStyle = '#ff80df'; g.beginPath(); g.ellipse(bx, by - 18, 16, 6, 0, 0, TAU); g.fill(); } // Tütü
      g.fillStyle = kk === 3 ? '#fafafa' : '#e0b090'; g.beginPath(); g.arc(bx, by - 54, 8, 0, TAU); g.fill();
      if (kk === 0) { g.fillStyle = '#ff4fd8'; star(g, bx, by - 70, 12); } // Neonstern
      if (kk === 1) { for (let i = 0; i < 5; i++) { g.fillStyle = i % 2 ? '#e53935' : '#fff'; g.beginPath(); g.ellipse(bx - 8 + i * 4, by - 66, 2.5, 9, (i - 2) * 0.25, 0, TAU); g.fill(); } } // Federkranz
      if (kk === 3) { g.fillStyle = '#111'; g.fillRect(bx - 4, by - 56, 2, 2); g.fillRect(bx + 2, by - 56, 2, 2); g.fillStyle = '#e53935'; g.beginPath(); g.arc(bx, by - 50, 2.5, 0, TAU); g.fill(); } // Pierrot
      if (kk === 4) { g.fillStyle = '#ba68c8'; for (let i = 0; i < 6; i++) { g.beginPath(); g.arc(bx - 10 + i * 4, by - 62 - (i % 2) * 3, 4, 0, TAU); g.fill(); } } // Federboa
      g.strokeStyle = '#e0b090'; g.lineWidth = 3; g.beginPath(); g.moveTo(bx - 8, by - 42); g.lineTo(bx - 16, by - 56 - Math.sin(t * 6 + k) * 6); g.moveTo(bx + 8, by - 42); g.lineTo(bx + 16, by - 56 - Math.cos(t * 6 + k) * 6); g.stroke();
    });
    const hue = (t * 40) % 360;
    floor(g, V, '#0b0b12', '#2a2a3a', off, () => { rep(V, off, 1, 30, (x, k) => { g.fillStyle = `hsla(${(hue + k * 40) % 360},90%,60%,0.35)`; g.fillRect(x + 1, gy + 3, 28, 6); }); });
  },

  // Weihnachten bei Carola: Wohnzimmer mit Baum, Kamin, Fenster mit Schnee
  // Weihnachten bei Carola (nach Foto): gelbe Wände, orange Blumen-Leinwände, orange gemustertes Sofa, Regal mit
  // Weidenkörben, orange Vorhänge, heller Laminatboden mit Fußmatte – dazu Baum, Lichterkette und Eierlikör auf dem Tisch
  carolaXmas(g, V, off, t) {
    const gy = V.groundY;
    g.fillStyle = '#f2d24a'; g.fillRect(0, 0, V.w, gy);
    g.fillStyle = 'rgba(255,255,255,0.12)'; g.fillRect(0, 0, V.w, 20);
    rep(V, off, 0.45, 620, (x) => {
      // Blumen-Leinwände
      for (let i = 0; i < 2; i++) { const cx = x + 30 + i * 96; g.fillStyle = '#f08a24'; g.fillRect(cx, gy - 230, 88, 56); for (let j = 0; j < 3; j++) { const fx = cx + 16 + j * 28, fy = gy - 202 + (j % 2) * 8; g.fillStyle = '#d9480f'; for (let a = 0; a < 8; a++) { g.beginPath(); g.ellipse(fx + Math.cos(a * 0.785) * 9, fy + Math.sin(a * 0.785) * 9, 7, 3.5, a * 0.785, 0, TAU); g.fill(); } g.fillStyle = '#ffd23f'; g.beginPath(); g.arc(fx, fy, 4, 0, TAU); g.fill(); } g.strokeStyle = 'rgba(0,0,0,0.15)'; g.lineWidth = 2; g.strokeRect(cx, gy - 230, 88, 56); }
      // orange gemustertes Sofa
      const sx = x + 20;
      g.fillStyle = '#c4501f'; roundRect(g, sx, gy - 96, 190, 50, 10); g.fill(); roundRect(g, sx - 8, gy - 74, 22, 70, 8); g.fill(); roundRect(g, sx + 176, gy - 74, 22, 70, 8); g.fill();
      g.fillStyle = '#d9662b'; roundRect(g, sx + 10, gy - 50, 170, 34, 6); g.fill();
      g.fillStyle = 'rgba(255,214,120,0.55)'; for (let i = 0; i < 14; i++) { const px = sx + 14 + (i * 37) % 166, py = gy - 90 + (i * 23) % 64; g.beginPath(); g.moveTo(px, py); g.quadraticCurveTo(px + 5, py - 6, px + 9, py); g.quadraticCurveTo(px + 5, py + 4, px, py); g.fill(); }
      g.fillStyle = '#7a3a14'; g.fillRect(sx + 4, gy - 16, 6, 16); g.fillRect(sx + 180, gy - 16, 6, 16);
      // Regal mit Weidenkörben
      const rx = x + 300;
      g.fillStyle = '#f4f2ec'; g.fillRect(rx, gy - 210, 80, 210); for (let r = 0; r < 5; r++) { g.fillStyle = '#ddd8cc'; g.fillRect(rx, gy - 210 + r * 42, 80, 4); g.fillStyle = '#b58a52'; g.fillRect(rx + 6, gy - 200 + r * 42, 68, 30); g.strokeStyle = 'rgba(90,60,30,0.45)'; g.lineWidth = 1; for (let k = 0; k < 6; k++) { g.beginPath(); g.moveTo(rx + 6, gy - 196 + r * 42 + k * 5); g.lineTo(rx + 74, gy - 196 + r * 42 + k * 5); g.stroke(); } }
      // orange Vorhang + Tür
      g.fillStyle = '#e8601c'; g.beginPath(); g.moveTo(x + 400, 0); g.lineTo(x + 440, 0); g.quadraticCurveTo(x + 430, gy * 0.6, x + 444, gy); g.lineTo(x + 404, gy); g.quadraticCurveTo(x + 392, gy * 0.6, x + 400, 0); g.fill();
      g.fillStyle = 'rgba(0,0,0,0.12)'; for (let i = 0; i < 4; i++) g.fillRect(x + 408 + i * 8, 0, 2, gy);
      g.fillStyle = '#f7f5f0'; g.fillRect(x + 450, gy - 180, 70, 180); g.fillStyle = '#e8e4da'; g.fillRect(x + 456, gy - 174, 58, 174);
      // Weihnachtsbaum & Tisch mit Eierlikör
      xmasTree(g, x + 560, gy, 150, t); emoji(g, '🎁', x + 532, gy - 12, 22); emoji(g, '🎁', x + 592, gy - 12, 20);
      g.fillStyle = '#e9e4da'; g.fillRect(x + 220, gy - 40, 70, 5); g.fillRect(x + 226, gy - 35, 4, 35); g.fillRect(x + 280, gy - 35, 4, 35);
      g.save(); g.translate(x + 238, gy - 52); ITEM_ICONS.eierlikoer(g, 0); g.restore(); emoji(g, '🍪', x + 270, gy - 48, 14);
    });
    stringLights(g, V, off, 0.45, 12, t, 240, 16);
    floor(g, V, '#e2cfa8', '#c9b48a', off, () => { g.fillStyle = 'rgba(120,90,50,0.15)'; rep(V, off, 1, 64, (x, k) => { for (let r = 0; r < 4; r++) g.fillRect(x + (r % 2) * 30, gy + 4 + r * 10, 2, 10); }); for (let r = 0; r < 4; r++) { g.fillStyle = 'rgba(0,0,0,0.06)'; g.fillRect(0, gy + 13 + r * 10, V.w, 1); } rep(V, off, 1, 620, (x) => { g.fillStyle = '#7d7d7d'; g.fillRect(x + 450, gy + 4, 70, 14); }); });
  },
  xmasRoom(g, V, off, t, lv, variant = 0) {
    const gy = V.groundY;
    wallpaper(g, V, off, variant ? '#e8efe6' : '#f1e3d3', variant ? 'rgba(40,120,60,0.15)' : 'rgba(180,40,50,0.15)');
    rep(V, off, 0.5, 480, (x) => {
      windowFrame(g, x + 20, gy - 190, 90, 90, '#3b4a8c'); g.fillStyle = '#fff'; for (let i = 0; i < 8; i++) { g.beginPath(); g.arc(x + 28 + ((i * 23 + t * 10) % 80), gy - 185 + ((i * 37 + t * 20) % 85), 1.5, 0, TAU); g.fill(); }
      g.fillStyle = '#8d6e63'; g.fillRect(x + 160, gy - 100, 110, 100); g.fillStyle = '#3e2723'; g.fillRect(x + 180, gy - 70, 70, 70); emoji(g, '🔥', x + 215, gy - 20, 30 + Math.sin(t * 10) * 2); g.fillStyle = '#6d4c41'; g.fillRect(x + 152, gy - 106, 126, 10);
      for (let i = 0; i < 3; i++) emoji(g, '🧦', x + 180 + i * 30, gy - 86, 16);
      xmasTree(g, x + 360, gy, 150, t); emoji(g, '🎁', x + 330, gy - 12, 22); emoji(g, '🎁', x + 395, gy - 12, 20);
      if (variant) { g.fillStyle = '#795548'; g.fillRect(x + 20, gy - 40, 110, 6); emoji(g, '🍺', x + 40, gy - 54, 18); emoji(g, '🥃', x + 70, gy - 52, 14); emoji(g, '🍗', x + 105, gy - 52, 18); }
      else { g.fillStyle = '#795548'; g.fillRect(x + 20, gy - 40, 110, 6); emoji(g, '🍷', x + 34, gy - 54, 18); emoji(g, '🍪', x + 58, gy - 50, 14); g.save(); g.translate(x + 84, gy - 52); ITEM_ICONS.eierlikoer(g, 0); g.restore(); g.save(); g.translate(x + 108, gy - 52); ITEM_ICONS.eierlikoer(g, 0); g.restore(); }
    });
    stringLights(g, V, off, 0.5, 14, t, 240, 16);
    planks(g, V, off, '#9c6b45', '#7a5032');
  },
  // Weihnachten bei den Rustlers: großes Esszimmer, silber-blauer Baum, Eisenbahn ums Bäumchen, Tafel mit Truthahn, Weizen & Ouzo
  xmasRustler(g, V, off, t, lv) {
    const gy = V.groundY;
    g.fillStyle = '#e9eef4'; g.fillRect(0, 0, V.w, gy);
    g.fillStyle = '#c9d6e3'; rep(V, off, 0.5, 46, (x) => g.fillRect(x, 0, 2, gy));
    g.fillStyle = '#8fa3b8'; g.fillRect(0, gy - 70, V.w, 6);
    rep(V, off, 0.5, 520, (x) => {
      // Panoramafenster mit verschneitem Garten
      g.fillStyle = '#1e2d4a'; g.fillRect(x + 20, gy - 200, 170, 110); g.fillStyle = '#e8f1ff'; g.beginPath(); g.moveTo(x + 20, gy - 100); g.quadraticCurveTo(x + 100, gy - 125, x + 190, gy - 102); g.lineTo(x + 190, gy - 90); g.lineTo(x + 20, gy - 90); g.fill();
      g.fillStyle = '#fff'; for (let i = 0; i < 10; i++) { g.beginPath(); g.arc(x + 26 + ((i * 37 + t * 14) % 160), gy - 196 + ((i * 23 + t * 22) % 100), 1.4, 0, TAU); g.fill(); }
      g.strokeStyle = '#fff'; g.lineWidth = 4; g.strokeRect(x + 20, gy - 200, 170, 110); g.beginPath(); g.moveTo(x + 105, gy - 200); g.lineTo(x + 105, gy - 90); g.stroke();
      // silber-blauer Baum
      const tx = x + 270;
      g.fillStyle = '#5d4037'; g.fillRect(tx - 5, gy - 26, 10, 26);
      for (let i = 0; i < 4; i++) { const w = 66 - i * 13, y = gy - 22 - i * 34; g.fillStyle = '#2f6b4f'; g.beginPath(); g.moveTo(tx - w, y); g.lineTo(tx, y - 50); g.lineTo(tx + w, y); g.fill(); }
      for (let i = 0; i < 14; i++) { const u = (i * 0.618) % 1; g.fillStyle = i % 2 ? '#c0c8d8' : '#3b7dd8'; g.beginPath(); g.arc(tx + Math.sin(i * 2.4) * 50 * (1 - u * 0.8), gy - 30 - u * 120, 3.5, 0, TAU); g.fill(); }
      g.fillStyle = '#e0e6f0'; g.beginPath(); g.arc(tx, gy - 172, 8, 0, TAU); g.fill();
      // Spielzeugeisenbahn
      const tr = (t * 60) % 160; emoji(g, '🚂', tx - 80 + tr, gy - 8, 18); emoji(g, '🧸', tx + 70, gy - 12, 18);
      // Festtafel
      g.fillStyle = '#fff'; g.fillRect(x + 360, gy - 48, 150, 8); g.fillStyle = '#d9e2ec'; g.fillRect(x + 360, gy - 40, 150, 40);
      emoji(g, '🦃', x + 435, gy - 66, 30); emoji(g, '🍺', x + 375, gy - 60, 16); emoji(g, '🥃', x + 398, gy - 58, 14); emoji(g, '🍷', x + 478, gy - 60, 16); emoji(g, '🍺', x + 498, gy - 60, 16);
      for (let i = 0; i < 4; i++) emoji(g, '🕯️', x + 370 + i * 40, gy - 82, 12);
    });
    stringLights(g, V, off, 0.5, 10, t, 260, 14, ['#e0f0ff', '#9fd0ff']);
    planks(g, V, off, '#b9a48a', '#9c8668');
  },


  // Plärrer Augsburg: Riesenrad hinter den Festzelten, Fahrgeschäfte, Augsburger Skyline mit Perlachturm & Rathaus
  plaerrer(g, V, off, t) {
    const gy = V.groundY;
    sky(g, V, '#3b2d6b', '#f6a96b');
    once(V, off, 0.08, 1500, 500, (x) => { g.fillStyle = '#3d2c4a'; g.fillRect(x, gy - 230, 18, 200); g.beginPath(); g.moveTo(x - 2, gy - 230); g.lineTo(x + 9, gy - 262); g.lineTo(x + 20, gy - 230); g.fill(); g.fillRect(x + 30, gy - 150, 110, 120); for (const dx of [40, 118]) { g.beginPath(); g.arc(x + dx, gy - 160, 10, 0, TAU); g.fill(); g.fillRect(x + dx - 7, gy - 160, 14, 14); g.beginPath(); g.moveTo(x + dx, gy - 182); g.lineTo(x + dx - 3, gy - 168); g.lineTo(x + dx + 3, gy - 168); g.fill(); } g.beginPath(); g.moveTo(x + 60, gy - 150); g.lineTo(x + 85, gy - 175); g.lineTo(x + 110, gy - 150); g.fill(); });
    once(V, off, 0.2, 1000, 400, (x) => { const cx = x + 100, cy = gy - 140, R = 105; g.strokeStyle = '#eceff1'; g.lineWidth = 3; g.beginPath(); g.arc(cx, cy, R, 0, TAU); g.stroke(); g.lineWidth = 1.2; for (let i = 0; i < 16; i++) { const a = i / 16 * TAU + t * 0.25; g.beginPath(); g.moveTo(cx, cy); g.lineTo(cx + Math.cos(a) * R, cy + Math.sin(a) * R); g.stroke(); g.fillStyle = ['#e53935', '#fdd835', '#1e88e5', '#43a047'][i % 4]; roundRect(g, cx + Math.cos(a) * R - 6, cy + Math.sin(a) * R, 12, 10, 3); g.fill(); g.fillStyle = '#fff59d'; g.beginPath(); g.arc(cx + Math.cos(a) * R, cy + Math.sin(a) * R, 2, 0, TAU); g.fill(); } g.strokeStyle = '#cfd8dc'; g.lineWidth = 4; g.beginPath(); g.moveTo(cx, cy); g.lineTo(cx - 50, gy); g.moveTo(cx, cy); g.lineTo(cx + 50, gy); g.stroke(); });
    rep(V, off, 0.35, 420, (x, k) => { const names = ['BINSWANGER', 'SCHALLER']; g.fillStyle = '#fafafa'; g.fillRect(x, gy - 100, 260, 100); for (let i = 0; i < 13; i++) { g.fillStyle = i % 2 ? '#1565c0' : '#fff'; g.fillRect(x + i * 20, gy - 100, 20, 12); } g.fillStyle = '#c62828'; g.beginPath(); g.moveTo(x + 80, gy - 100); g.lineTo(x + 130, gy - 140); g.lineTo(x + 180, gy - 100); g.fill(); g.fillStyle = '#fff'; g.font = '900 10px sans-serif'; g.textAlign = 'center'; g.fillText(names[((k % 2) + 2) % 2], x + 130, gy - 108); g.fillStyle = '#ffe082'; for (let i = 0; i < 6; i++) g.fillRect(x + 14 + i * 40, gy - 70, 26, 30); g.fillStyle = '#5d4037'; g.fillRect(x + 110, gy - 40, 40, 40); });
    rep(V, off, 0.55, 300, (x) => { g.fillStyle = '#8d6e63'; g.fillRect(x, gy - 50, 90, 50); g.fillStyle = '#e53935'; for (let i = 0; i < 6; i++) { g.beginPath(); g.moveTo(x + i * 15, gy - 64); g.lineTo(x + i * 15 + 15, gy - 64); g.lineTo(x + i * 15 + 7, gy - 52); g.fill(); } for (let i = 0; i < 4; i++) emoji(g, '💝', x + 14 + i * 20, gy - 40, 14); });
    stringLights(g, V, off, 0.55, 30, t, 220, 20);
    floor(g, V, '#c8b48a', '#a6905f', off, () => { g.fillStyle = 'rgba(0,0,0,0.12)'; for (let i = 0; i < 26; i++) g.fillRect(wrap(i * 53 - off, V.w + 40) - 20, gy + 12 + (i % 4) * 8, 5, 2); });
  },

  // Sizilien: Strand, Ätna mit Rauchfahne, Sonnenschirme
  sicily(g, V, off, t) {
    const gy = V.groundY;
    sky(g, V, '#4fb3f6', '#fff3d6');
    g.fillStyle = '#fff59d'; g.beginPath(); g.arc(V.w * 0.85, gy * 0.2, 24, 0, TAU); g.fill();
    once(V, off, 0.06, 1600, 500, (x) => { g.fillStyle = '#7d6e66'; g.beginPath(); g.moveTo(x - 160, gy - 60); g.lineTo(x - 20, gy - 200); g.lineTo(x + 20, gy - 200); g.lineTo(x + 160, gy - 60); g.fill(); g.fillStyle = '#fafafa'; g.beginPath(); g.moveTo(x - 38, gy - 182); g.lineTo(x - 20, gy - 200); g.lineTo(x + 20, gy - 200); g.lineTo(x + 38, gy - 182); g.quadraticCurveTo(x, gy - 175, x - 38, gy - 182); g.fill(); g.fillStyle = 'rgba(120,120,120,0.5)'; for (let i = 0; i < 6; i++) { g.beginPath(); g.arc(x + i * 18 + Math.sin(t + i) * 4, gy - 210 - i * 14, 10 + i * 3, 0, TAU); g.fill(); } });
    sea(g, V, off, t, gy - 70);
    rep(V, off, 0.6, 260, (x, k) => { g.strokeStyle = '#8d6e63'; g.lineWidth = 2; g.beginPath(); g.moveTo(x + 40, gy); g.lineTo(x + 40, gy - 50); g.stroke(); const c = ['#e53935', '#1e88e5', '#fdd835'][((k % 3) + 3) % 3]; for (let i = 0; i < 6; i++) { g.fillStyle = i % 2 ? '#fff' : c; g.beginPath(); g.moveTo(x + 40, gy - 62); g.lineTo(x + 4 + i * 12, gy - 48); g.lineTo(x + 16 + i * 12, gy - 48); g.fill(); } emoji(g, '🌴', x + 160, gy - 40, 60); });
    floor(g, V, '#f3dca4', '#e9c98a', off, () => { g.fillStyle = 'rgba(160,120,60,0.25)'; for (let i = 0; i < 30; i++) g.fillRect(wrap(i * 37 - off, V.w + 40) - 20, gy + 8 + (i % 5) * 7, 3, 2); });
  },
  // Apulien: Trulli von Alberobello (weiße Rundhäuser mit grauen Kegeldächern) und die Klippen von Polignano a Mare
  apulia(g, V, off, t) {
    const gy = V.groundY;
    sky(g, V, '#5cb8f2', '#fff6e0'); clouds(g, V, off, 0.7);
    once(V, off, 0.12, 1400, 300, (x) => { g.fillStyle = '#d9c7a0'; g.fillRect(x, gy - 130, 240, 130); g.fillStyle = '#f2ead8'; for (let i = 0; i < 6; i++) g.fillRect(x + 10 + i * 38, gy - 170 - (i % 3) * 12, 32, 40 + (i % 3) * 12); sea(g, { ...V, w: V.w }, off, t, gy - 20); });
    rep(V, off, 0.35, 190, (x) => { for (const [dx, s] of [[0, 1], [70, 0.8]]) { const w = 56 * s, h = 46 * s; g.fillStyle = '#fafafa'; g.fillRect(x + dx, gy - h, w, h); g.fillStyle = '#8d8d8d'; g.beginPath(); g.moveTo(x + dx - 4, gy - h); g.lineTo(x + dx + w / 2, gy - h - 52 * s); g.lineTo(x + dx + w + 4, gy - h); g.fill(); g.strokeStyle = 'rgba(0,0,0,0.2)'; g.lineWidth = 1; for (let r = 1; r < 6; r++) { g.beginPath(); g.moveTo(x + dx - 4 + r * w * 0.08, gy - h - r * 8 * s); g.lineTo(x + dx + w + 4 - r * w * 0.08, gy - h - r * 8 * s); g.stroke(); } g.fillStyle = '#fff'; g.beginPath(); g.arc(x + dx + w / 2, gy - h - 54 * s, 4 * s, 0, TAU); g.fill(); g.fillStyle = '#6d4c41'; g.fillRect(x + dx + w / 2 - 6, gy - 22 * s, 12, 22 * s); } });
    rep(V, off, 0.55, 230, (x) => { g.fillStyle = '#6b8e23'; g.beginPath(); g.ellipse(x + 40, gy - 50, 26, 18, 0, 0, TAU); g.fill(); g.fillStyle = '#5d4037'; g.fillRect(x + 37, gy - 40, 6, 40); });
    floor(g, V, '#e2c799', '#c9a66b', off);
  },

  // Köln: Dom mit Doppeltürmen, Hohenzollernbrücke über den Rhein, Karnevalszug
  // Köln, Karnevalsabend: Altstadt-Giebelhäuser (Fischmarkt/Frankenwerft-Stil), Groß St. Martin, Dom,
  // Kneipen mit warmem Licht und Musik aus den Türen, dazwischen ab und zu das Lommerzheim (Lommi, Deutz)
  koeln(g, V, off, t, lv) {
    const gy = V.groundY;
    sky(g, V, '#1d2a5c', '#e58a6a');
    g.fillStyle = 'rgba(255,255,255,0.8)'; for (let i = 0; i < 20; i++) { g.beginPath(); g.arc((i * 97) % V.w, (i * 37) % (gy * 0.4), 0.9, 0, TAU); g.fill(); }
    // Dom (zwei Türme) + Groß St. Martin (Vierungsturm mit vier schlanken Ecktürmchen)
    once(V, off, 0.08, 1700, 520, (x) => {
      const c = '#2f2b3d'; gothicSpire(g, x, gy - 40, 34, 280, c); gothicSpire(g, x + 92, gy - 40, 34, 280, c);
      g.fillStyle = c; g.fillRect(x + 20, gy - 170, 92, 130); g.fillRect(x + 112, gy - 130, 150, 90); g.beginPath(); g.moveTo(x + 112, gy - 130); g.lineTo(x + 186, gy - 178); g.lineTo(x + 262, gy - 130); g.fill();
      g.fillStyle = 'rgba(255,200,110,0.35)'; g.beginPath(); g.arc(x + 66, gy - 125, 16, 0, TAU); g.fill();
    });
    once(V, off, 0.1, 1300, 120, (x) => {
      const c = '#4a3f4f';
      g.fillStyle = c; g.fillRect(x, gy - 200, 60, 200);
      g.beginPath(); g.moveTo(x - 4, gy - 200); g.lineTo(x + 30, gy - 250); g.lineTo(x + 64, gy - 200); g.fill();
      for (const tx of [x - 10, x + 58]) { g.fillRect(tx, gy - 220, 12, 140); g.beginPath(); g.moveTo(tx - 2, gy - 220); g.lineTo(tx + 6, gy - 248); g.lineTo(tx + 14, gy - 220); g.fill(); }
      g.fillStyle = 'rgba(255,214,140,0.5)'; for (let i = 0; i < 3; i++) g.fillRect(x + 12 + i * 14, gy - 180, 7, 18);
    });
    // Reihe schmaler bunter Giebelhäuser mit Licht in den Fenstern
    const cols = ['#e8c35a', '#e48a8a', '#9cc3d8', '#a8c98a', '#f0d9b0', '#d97b57', '#c6a8d6', '#f2a65a'];
    rep(V, off, 0.3, 64, (x, k) => {
      const i = ((k % 8) + 8) % 8, h = 120 + ((k * 37 % 50) + 50) % 50, top = gy - h;
      g.fillStyle = cols[i]; g.fillRect(x, top, 62, h);
      // Giebel: abwechselnd Treppen- und Spitzgiebel
      g.beginPath();
      if (k % 2) { g.moveTo(x, top); for (let st = 0; st < 3; st++) { g.lineTo(x + st * 8, top - st * 9 - 9); g.lineTo(x + st * 8 + 8, top - st * 9 - 9); } g.lineTo(x + 31, top - 34); for (let st = 2; st >= 0; st--) { g.lineTo(x + 62 - st * 8 - 8, top - st * 9 - 9); g.lineTo(x + 62 - st * 8, top - st * 9 - 9); } g.lineTo(x + 62, top); }
      else { g.moveTo(x, top); g.lineTo(x + 31, top - 30); g.lineTo(x + 62, top); }
      g.fill();
      g.fillStyle = 'rgba(0,0,0,0.12)'; g.fillRect(x + 60, top, 2, h);
      for (let r = 0; r < Math.floor((h - 50) / 26); r++) for (let c = 0; c < 2; c++) {
        const on = ((k * 7 + r * 3 + c) % 5) !== 0, wx = x + 12 + c * 24, wy = top + 10 + r * 26;
        g.fillStyle = on ? '#ffd98a' : '#3a3550'; g.fillRect(wx, wy, 14, 18);
        if (on) { g.fillStyle = 'rgba(255,200,110,0.25)'; g.fillRect(wx - 3, wy - 3, 20, 24); }
        g.fillStyle = 'rgba(0,0,0,0.25)'; g.fillRect(wx + 6.5, wy, 1, 18);
      }
      // Karnevalswimpel rot-weiß zwischen den Häusern
      g.fillStyle = k % 2 ? '#d62828' : '#fff'; g.beginPath(); g.moveTo(x, top + 4); g.lineTo(x + 10, top + 4); g.lineTo(x + 5, top + 14); g.fill();
    });
    // Kneipen im Erdgeschoss: warmes Licht, offene Tür, Musiknoten schweben heraus
    const pubs = S(lv, 'pubs', null) || ['BRAUHAUS', 'KÖLSCH', 'ZUM KÖBES', 'EM KÜMPCHE', 'FRÜH'];
    rep(V, off, 0.45, 300, (x, k) => {
      const name = pubs[((k % pubs.length) + pubs.length) % pubs.length];
      g.fillStyle = '#5b3a24'; g.fillRect(x + 10, gy - 70, 170, 70);
      g.fillStyle = '#ffcf7a'; g.fillRect(x + 20, gy - 58, 50, 36); g.fillRect(x + 120, gy - 58, 50, 36);
      g.fillStyle = 'rgba(80,40,10,0.45)'; for (const wx of [x + 20, x + 120]) { g.fillRect(wx + 24, gy - 58, 2, 36); g.fillRect(wx, gy - 42, 50, 2); }
      g.fillStyle = '#ffb347'; g.fillRect(x + 80, gy - 56, 30, 56);
      const gl = g.createRadialGradient(x + 95, gy - 20, 4, x + 95, gy - 20, 70); gl.addColorStop(0, 'rgba(255,200,110,0.5)'); gl.addColorStop(1, 'rgba(255,200,110,0)'); g.fillStyle = gl; g.beginPath(); g.arc(x + 95, gy - 20, 70, 0, TAU); g.fill();
      sign(g, name, x + 95, gy - 82, { bg: '#2a1a10', fg: '#ffd98a', size: 11 });
      g.font = '900 14px ui-rounded, system-ui, sans-serif'; g.textAlign = 'center';
      for (let i = 0; i < 4; i++) { const u = (t * 0.45 + i * 0.25 + k * 0.13) % 1; g.globalAlpha = 1 - u; g.fillStyle = ['#ffd23f', '#ff8fb1', '#fff', '#8fd3ff'][i]; g.fillText(i % 2 ? '♪' : '♫', x + 95 + Math.sin(u * 7 + i) * 16, gy - 50 - u * 90); }
      g.globalAlpha = 1;
    });
    // Lommerzheim: bewusst schäbige alte Fassade, braunes Holz, „Päffgen Kölsch“, Licht brennt noch
    once(V, off, 0.45, 2200, 900, (x) => {
      g.fillStyle = '#b7a58c'; g.fillRect(x, gy - 170, 200, 170);
      g.fillStyle = 'rgba(80,60,40,0.25)'; for (const [px, py, r] of [[30, -150, 14], [150, -130, 18], [90, -110, 10], [170, -160, 8]]) { g.beginPath(); g.ellipse(x + px, gy + py, r * 1.4, r, 0.3, 0, TAU); g.fill(); }
      g.fillStyle = '#c9b89e'; g.fillRect(x - 4, gy - 176, 208, 8);
      for (let c = 0; c < 4; c++) { g.fillStyle = '#ffd98a'; g.fillRect(x + 18 + c * 46, gy - 150, 24, 30); g.fillStyle = 'rgba(255,255,255,0.5)'; g.fillRect(x + 18 + c * 46, gy - 150, 24, 6); }
      g.fillStyle = '#4b2e1a'; g.fillRect(x, gy - 92, 200, 92);
      g.fillStyle = '#3a2213'; for (let i = 0; i < 200; i += 12) g.fillRect(x + i, gy - 92, 2, 92);
      g.fillStyle = '#ffcf7a'; g.fillRect(x + 16, gy - 74, 54, 40); g.fillRect(x + 130, gy - 74, 54, 40);
      g.fillStyle = 'rgba(255,255,255,0.55)'; for (const wx of [x + 16, x + 130]) for (let i = 0; i < 6; i++) { g.beginPath(); g.arc(wx + 5 + i * 9, gy - 74, 4.5, 0, Math.PI); g.fill(); } // Gardinen
      g.fillStyle = '#ffb347'; g.fillRect(x + 84, gy - 70, 32, 70);
      const gl = g.createRadialGradient(x + 100, gy - 40, 4, x + 100, gy - 40, 90); gl.addColorStop(0, 'rgba(255,200,110,0.55)'); gl.addColorStop(1, 'rgba(255,200,110,0)'); g.fillStyle = gl; g.beginPath(); g.arc(x + 100, gy - 40, 90, 0, TAU); g.fill();
      g.fillStyle = '#2a1a10'; roundRect(g, x + 30, gy - 112, 140, 18, 3); g.fill();
      g.fillStyle = '#f2e6c8'; g.font = 'italic 900 13px serif'; g.textAlign = 'center'; g.fillText('Lommerzheim', x + 100, gy - 98);
      g.fillStyle = '#c8102e'; roundRect(g, x + 150, gy - 136, 44, 18, 9); g.fill(); g.fillStyle = '#fff'; g.font = '900 6px sans-serif'; g.fillText('PÄFFGEN', x + 172, gy - 128); g.fillText('KÖLSCH', x + 172, gy - 121);
      g.font = '900 16px ui-rounded, system-ui, sans-serif';
      for (let i = 0; i < 5; i++) { const u = (t * 0.5 + i * 0.2) % 1; g.globalAlpha = 1 - u; g.fillStyle = ['#ffd23f', '#ff8fb1', '#fff', '#8fd3ff', '#b2ff8f'][i]; g.fillText(i % 2 ? '♪' : '♫', x + 100 + Math.sin(u * 6 + i) * 22, gy - 60 - u * 110); }
      g.globalAlpha = 1;
    });
    // Konfetti in Kölner Farben
    for (let i = 0; i < 30; i++) { g.fillStyle = ['#d62828', '#fff', '#ffd23f', '#1e88e5'][i % 4]; g.fillRect(wrap(i * 41 - off * 0.3 + Math.sin(t + i) * 8, V.w), wrap(i * 29 + t * 50, gy), 3, 3); }
    crowd(g, V, off, 0.5, t, '#3a1f35', 10, 4, -6);
    cobble(g, V, off, '#7d7a80', '#5c5960');
  },

  // Spieleabend: Tisch mit Siedler-Spielbrett und Canasta-Karten
  gameNight(g, V, off, t) {
    const gy = V.groundY;
    wallpaper(g, V, off, '#e9dcc6', 'rgba(120,90,60,0.12)');
    g.fillStyle = 'rgba(255,220,150,0.25)'; g.beginPath(); g.moveTo(V.w * 0.5 - 30, 0); g.lineTo(V.w * 0.5 + 30, 0); g.lineTo(V.w * 0.5 + 220, gy); g.lineTo(V.w * 0.5 - 220, gy); g.fill();
    rep(V, off, 0.4, 420, (x) => { g.fillStyle = '#4fc3f7'; g.beginPath(); g.arc(x + 130, gy - 120, 86, 0, TAU); g.fill(); const cols = ['#2e7d32', '#c62828', '#9ccc65', '#fdd835', '#9e9e9e', '#8d6e63']; let n = 0; for (let r = -2; r <= 2; r++) for (let q = -2; q <= 2; q++) { if (Math.abs(q + r) > 2) continue; const hx = x + 130 + (q + r / 2) * 30, hy = gy - 120 + r * 26; g.fillStyle = cols[n++ % 6]; g.beginPath(); for (let i = 0; i < 6; i++) { const a = i / 6 * TAU + Math.PI / 6; g.lineTo(hx + Math.cos(a) * 16, hy + Math.sin(a) * 16); } g.fill(); g.strokeStyle = '#f5e6c8'; g.lineWidth = 1.5; g.stroke(); } emoji(g, '🃏', x + 300, gy - 120, 30, 0.2); emoji(g, '🃏', x + 320, gy - 112, 30, 0.5); emoji(g, '🎲', x + 280, gy - 60, 22); });
    g.fillStyle = '#6d4c41'; g.fillRect(0, gy - 30, V.w, 8);
    planks(g, V, off, '#8d6e63', '#6d4c41');
  },

  // Timeclash: Party durch die Jahrzehnte
  timeclash(g, V, off, t, lv) {
    drawAnyBiomeBg(g, V, 'party', off, t);
    const gy = V.groundY;
    rep(V, off, 0.25, 300, (x, k) => { const dec = ['70s', '80s', '90s', '2000er'][((k % 4) + 4) % 4]; neon(g, dec, x + 60, 70, ['#ff4fa3', '#3ee6b4', '#ffd23f', '#7cc6ff'][((k % 4) + 4) % 4], 22, t, 1); emoji(g, '⏳', x + 150, 64, 24, Math.sin(t + k)); });
    once(V, off, 0.45, 2600, 200, (x) => sign(g, S(lv, 'party', 'TIMECLASH'), x + 120, Math.max(28, gy - 236), { bg: '#ff4fa3', fg: '#fff', size: 16 })); // Schild zieht nur ab und zu vorbei
  },

  // Serengeti-Park Hodenhagen: Savanne mit Akazien, Zebras, Giraffen, Safari-Jeeps und freilaufenden Affen
  serengeti(g, V, off, t) {
    const gy = V.groundY;
    sky(g, V, '#8fd3f7', '#fff1c8'); clouds(g, V, off, 0.7);
    hillsBand(g, V, off, 0.12, 40, 400, '#d6c27a', 30);
    rep(V, off, 0.3, 340, (x) => { g.fillStyle = '#6d4c41'; g.fillRect(x + 40, gy - 110, 8, 80); g.fillStyle = '#558b2f'; g.beginPath(); g.ellipse(x + 44, gy - 116, 60, 14, 0, 0, TAU); g.fill(); emoji(g, '🦒', x + 160, gy - 80, 70, 0, true); emoji(g, '🦓', x + 250, gy - 40, 34); });
    rep(V, off, 0.5, 520, (x) => { g.fillStyle = '#f5f5f0'; roundRect(g, x, gy - 58, 90, 34, 6); g.fill(); g.fillStyle = '#212121'; for (let i = 0; i < 5; i++) g.fillRect(x + 10 + i * 16, gy - 58, 7, 34); g.fillStyle = '#90caf9'; g.fillRect(x + 64, gy - 54, 20, 14); g.fillStyle = '#222'; g.beginPath(); g.arc(x + 20, gy - 24, 9, 0, TAU); g.arc(x + 72, gy - 24, 9, 0, TAU); g.fill(); drawMonkey(g, x + 40, gy - 62, t, 1.1, false); drawMonkey(g, x + 66, gy - 62, t + 1, 1, true); });
    once(V, off, 0.45, 1200, 100, (x) => { g.fillStyle = '#6d4c41'; g.fillRect(x, gy - 130, 10, 130); g.fillRect(x + 170, gy - 130, 10, 130); g.fillStyle = '#ffd23f'; roundRect(g, x - 10, gy - 150, 200, 30, 6); g.fill(); g.fillStyle = '#3e2723'; g.font = '900 13px ui-rounded, system-ui, sans-serif'; g.textAlign = 'center'; g.fillText('SERENGETI-PARK', x + 90, gy - 130); });
    floor(g, V, '#d9b66b', '#b8954a', off, () => { g.fillStyle = 'rgba(120,90,30,0.3)'; for (let i = 0; i < 26; i++) g.fillRect(wrap(i * 53 - off, V.w + 40) - 20, gy + 12 + (i % 4) * 8, 5, 2); });
  },

  // New York im Advent: Rockefeller-Baum mit Stern, Eisbahn mit goldener Prometheus-Statue, Empire State Building, Schnee
  nyc(g, V, off, t, lv) {
    const gy = V.groundY;
    // Nachthimmel wie über Manhattan: Wolken orange von den Stadtlichtern angestrahlt
    sky(g, V, '#161226', '#8a5530');
    for (let i = 0; i < 6; i++) { const cx = wrap(i * 190 - off * 0.04, V.w + 260) - 130, cy = 30 + (i % 3) * 32; g.fillStyle = `rgba(${150 + i * 8},${90 + i * 4},50,0.45)`; g.beginPath(); g.ellipse(cx, cy, 120, 18, 0, 0, TAU); g.ellipse(cx + 60, cy - 10, 70, 14, 0, 0, TAU); g.fill(); }
    // dichte Skyline von Lower Manhattan mit erleuchteten Fenstern
    rep(V, off, 0.12, 70, (x, k) => { const h = 120 + ((k * 61) % 120 + 120) % 120, w = 52 + (k % 3) * 8; g.fillStyle = ['#1e2740', '#26304a', '#1b2238'][((k % 3) + 3) % 3]; g.fillRect(x, gy - h - 40, w, h); g.fillStyle = k % 4 ? '#ffd98a' : '#cfe6ff'; for (let r = 0; r < h / 10 - 1; r++) for (let i = 0; i < Math.floor(w / 9); i++) if ((r * 7 + i * 3 + k) % 5 > 1) g.fillRect(x + 4 + i * 9, gy - h - 34 + r * 10, 4, 5); if (k % 5 === 0) { g.fillStyle = '#ffd98a'; g.fillRect(x + w / 2 - 1, gy - h - 58, 2, 18); } });
    // One World Trade Center mit leuchtender Spitze
    once(V, off, 0.05, 1500, 760, (x) => {
      const top = gy - 232;
      g.fillStyle = '#2a3550'; g.beginPath(); g.moveTo(x, gy); g.lineTo(x + 6, top); g.lineTo(x + 44, top); g.lineTo(x + 50, gy); g.fill();
      g.fillStyle = 'rgba(200,225,255,0.85)'; g.fillRect(x + 23, top, 4, gy - top); g.fillRect(x + 6, top, 2, 120); g.fillRect(x + 42, top, 2, 120);
      g.fillStyle = 'rgba(220,235,255,0.45)'; for (let r = 0; r < 22; r++) for (let c = 0; c < 4; c++) if ((r + c) % 3) g.fillRect(x + 9 + c * 9, top + 6 + r * 10, 5, 4);
      g.fillStyle = '#dfe9ff'; g.fillRect(x + 21, top - 8, 8, 8); g.fillRect(x + 24, top - 44, 2, 36);
      g.fillStyle = `rgba(255,255,255,${0.6 + Math.sin(t * 3) * 0.4})`; g.beginPath(); g.arc(x + 25, top - 45, 2.2, 0, TAU); g.fill();
    });
    // East River mit Lichtspiegelungen
    g.fillStyle = '#141a2e'; g.fillRect(0, gy - 42, V.w, 42);
    for (let i = 0; i < 40; i++) { const rx = wrap(i * 37 - off * 0.2, V.w), ry = gy - 38 + (i % 6) * 6; g.fillStyle = i % 3 ? 'rgba(255,200,120,0.55)' : 'rgba(200,225,255,0.45)'; g.fillRect(rx, ry, 10 + (i % 4) * 4, 1.5); }
    // Freiheitsstatue auf ihrer Insel im Hafen
    once(V, off, 0.28, 1500, 1150, (x) => {
      g.fillStyle = '#16305e'; g.fillRect(x - 120, gy - 52, 360, 34); g.strokeStyle = 'rgba(255,255,255,0.25)'; for (let i = 0; i < 4; i++) { g.beginPath(); g.moveTo(x - 110 + i * 30, gy - 40 + (i % 2) * 8); g.lineTo(x - 90 + i * 30, gy - 40 + (i % 2) * 8); g.stroke(); }
      g.fillStyle = '#3d4a3a'; g.beginPath(); g.ellipse(x + 60, gy - 50, 70, 8, 0, Math.PI, 0); g.fill();
      g.fillStyle = '#b9a98a'; g.fillRect(x + 46, gy - 92, 28, 40); g.fillRect(x + 42, gy - 58, 36, 6); // Sockel
      const gr = '#6fb3a3'; g.fillStyle = gr;
      g.beginPath(); g.moveTo(x + 50, gy - 92); g.lineTo(x + 54, gy - 140); g.lineTo(x + 66, gy - 140); g.lineTo(x + 70, gy - 92); g.closePath(); g.fill(); // Gewand
      g.beginPath(); g.arc(x + 60, gy - 146, 6, 0, TAU); g.fill(); // Kopf
      for (let i = 0; i < 7; i++) { const a = -Math.PI + i * Math.PI / 6; g.beginPath(); g.moveTo(x + 60 + Math.cos(a) * 6, gy - 148 + Math.sin(a) * 6); g.lineTo(x + 60 + Math.cos(a) * 12, gy - 148 + Math.sin(a) * 12); g.lineWidth = 1.6; g.strokeStyle = gr; g.stroke(); } // Krone
      g.fillRect(x + 63, gy - 172, 4, 32); // erhobener Arm
      g.fillRect(x + 44, gy - 128, 8, 12); // Tafel
      const fl = 0.7 + Math.sin(t * 8) * 0.3; const fg = g.createRadialGradient(x + 65, gy - 177, 1, x + 65, gy - 177, 14); fg.addColorStop(0, `rgba(255,220,120,${fl})`); fg.addColorStop(1, 'rgba(255,180,60,0)'); g.fillStyle = fg; g.beginPath(); g.arc(x + 65, gy - 177, 14, 0, TAU); g.fill();
      g.fillStyle = '#ffd23f'; g.beginPath(); g.moveTo(x + 62, gy - 174); g.quadraticCurveTo(x + 65, gy - 186, x + 68, gy - 174); g.fill();
    });
    // Brooklyn Bridge (nach Foto): helle Granittürme mit zwei hohen Spitzbögen, Tragseile + Schrägseile, beleuchtete Fahrbahn
    once(V, off, 0.3, 1400, 420, (x) => {
      const deckY = gy - 60, T1 = x + 110, T2 = x + 470, top = gy - 212;
      g.strokeStyle = 'rgba(210,205,190,0.85)'; g.lineWidth = 1.8;
      const cable = (ax, ay, bx, by, sagY) => { g.beginPath(); g.moveTo(ax, ay); g.quadraticCurveTo((ax + bx) / 2, sagY, bx, by); g.stroke(); };
      cable(T1, top + 14, T2, top + 14, deckY + 60); cable(x - 120, deckY - 4, T1, top + 14, deckY - 20); cable(T2, top + 14, x + 700, deckY - 4, deckY - 20);
      g.lineWidth = 0.6; g.strokeStyle = 'rgba(220,214,200,0.6)';
      for (let i = 1; i < 36; i++) { const u = i / 36, px = T1 + u * (T2 - T1), cy = (1 - u) * (1 - u) * (top + 14) + 2 * (1 - u) * u * (deckY + 60) + u * u * (top + 14); g.beginPath(); g.moveTo(px, cy); g.lineTo(px, deckY); g.stroke(); }
      for (let i = 0; i < 12; i++) { g.beginPath(); g.moveTo(T1, top + 18); g.lineTo(T1 + 16 + i * 13, deckY); g.moveTo(T2, top + 18); g.lineTo(T2 - 16 - i * 13, deckY); g.moveTo(T1, top + 18); g.lineTo(T1 - 16 - i * 10, deckY); g.moveTo(T2, top + 18); g.lineTo(T2 + 16 + i * 10, deckY); g.stroke(); }
      // Fahrbahn mit orangen Lichtern
      g.fillStyle = '#2b2a35'; g.fillRect(x - 120, deckY, 820, 9);
      g.fillStyle = '#ffb35a'; for (let i = 0; i < 60; i++) { g.beginPath(); g.arc(x - 115 + i * 14, deckY + 2, 1.4, 0, TAU); g.fill(); }
      g.fillStyle = 'rgba(255,180,90,0.35)'; for (let i = 0; i < 30; i++) g.fillRect(x - 110 + i * 27, deckY + 14 + (i % 3) * 6, 12, 1.5); // Spiegelung
      for (const tx of [T1, T2]) {
        const tw = 56;
        g.fillStyle = '#b9b2a2'; g.fillRect(tx - tw / 2, top, tw, gy - 18 - top);
        g.fillStyle = '#8f897b'; g.fillRect(tx + tw / 2 - 10, top, 10, gy - 18 - top);
        g.fillStyle = '#d2cbbb'; g.fillRect(tx - tw / 2 - 3, top - 6, tw + 6, 8); g.fillRect(tx - tw / 2 - 2, top + 70, tw + 4, 5);
        g.fillStyle = '#20202e'; for (const ox of [-21, 3]) { g.beginPath(); g.moveTo(tx + ox, top + 150); g.lineTo(tx + ox, top + 98); g.lineTo(tx + ox + 9, top + 80); g.lineTo(tx + ox + 18, top + 98); g.lineTo(tx + ox + 18, top + 150); g.closePath(); g.fill(); }
        g.fillStyle = 'rgba(255,200,130,0.3)'; for (const ox of [-21, 3]) g.fillRect(tx + ox + 2, top + 140, 14, 10);
        g.strokeStyle = 'rgba(0,0,0,0.12)'; g.lineWidth = 1; for (let r = 0; r < 20; r++) { g.beginPath(); g.moveTo(tx - tw / 2, top + 10 + r * 12); g.lineTo(tx + tw / 2, top + 10 + r * 12); g.stroke(); }
        g.fillStyle = 'rgba(255,240,210,0.25)'; g.fillRect(tx - tw / 2, top, 6, gy - 18 - top); // angestrahlt
      }
    });
    once(V, off, 0.35, 1100, 400, (x) => { xmasTree(g, x + 100, gy - 20, 230, t); g.fillStyle = '#cfe8ff'; g.beginPath(); g.ellipse(x + 100, gy - 10, 180, 14, 0, 0, TAU); g.fill(); g.fillStyle = '#d4a017'; g.beginPath(); g.ellipse(x + 250, gy - 50, 22, 10, -0.3, 0, TAU); g.fill(); g.beginPath(); g.arc(x + 262, gy - 62, 6, 0, TAU); g.fill(); g.fillStyle = '#b07d10'; g.fillRect(x + 230, gy - 40, 44, 20); for (let i = 0; i < 4; i++) emoji(g, '⛸️', x + 30 + ((i * 60 + t * 40) % 200), gy - 16, 12); });
    // Alteingesessene Bierkneipe im East Village: Backstein, dunkelgrüne Front mit Goldschrift, warmes Licht
    once(V, off, 0.55, 1700, 1250, (x) => {
      g.fillStyle = '#8b3a2a'; g.fillRect(x, gy - 170, 150, 170);
      g.strokeStyle = 'rgba(0,0,0,0.18)'; g.lineWidth = 1; for (let r = 0; r < 20; r++) { g.beginPath(); g.moveTo(x, gy - 168 + r * 8); g.lineTo(x + 150, gy - 168 + r * 8); g.stroke(); }
      g.fillStyle = '#3a2a22'; g.fillRect(x - 4, gy - 174, 158, 6);
      for (let r = 0; r < 2; r++) for (let i = 0; i < 3; i++) { g.fillStyle = '#ffd98a'; g.fillRect(x + 14 + i * 46, gy - 158 + r * 40, 28, 28); g.fillStyle = '#2b2b2b'; g.fillRect(x + 27 + i * 46, gy - 158 + r * 40, 2, 28); }
      g.fillStyle = '#1f4d2e'; g.fillRect(x - 2, gy - 76, 154, 76); // grüne Ladenfront
      g.fillStyle = '#2c6b40'; g.fillRect(x + 4, gy - 72, 142, 18);
      g.fillStyle = '#e8c45a'; g.font = '900 9px Georgia, serif'; g.textAlign = 'center'; g.fillText(S(lv, 'pubNY', 'OLD ALE HOUSE'), x + 75, gy - 60, 140); g.font = '700 6px Georgia, serif'; g.fillText(S(lv, 'pubNYsub', 'EST. 1854'), x + 75, gy - 55);
      g.fillStyle = '#ffcf7a'; g.fillRect(x + 10, gy - 48, 50, 34); g.fillRect(x + 100, gy - 48, 40, 34); g.fillStyle = '#5d4037'; g.fillRect(x + 68, gy - 48, 24, 48);
      g.fillStyle = 'rgba(120,60,20,0.5)'; for (let i = 0; i < 4; i++) { g.fillRect(x + 14 + i * 12, gy - 30, 6, 10); } // Bierkrüge im Fenster
      g.strokeStyle = '#2e7d32'; g.lineWidth = 4; g.beginPath(); g.arc(x + 80, gy - 60, 7, 0, TAU); g.stroke(); g.fillStyle = '#d32f2f'; g.beginPath(); g.arc(x + 80, gy - 53, 2.5, 0, TAU); g.fill(); // Kranz
    });
    stringLights(g, V, off, 0.45, 20, t, 260, 18, ['#fff', '#ffd23f']);
    snowfall(g, V, t, off);
    floor(g, V, '#dfe8f2', '#ffffff', off, () => { g.fillStyle = 'rgba(150,170,200,0.3)'; for (let i = 0; i < 20; i++) g.fillRect(wrap(i * 67 - off, V.w + 40) - 20, gy + 10 + (i % 4) * 9, 10, 2); });
  },
  // Dyker Heights (nach Foto): Häuser mit Lichterketten an allen Giebeln, Balkon mit leuchtenden Schneeflocken,
  // Nussknacker & Santa auf dem Balkon, Lichterbogen über dem Eingang, leuchtende Büsche, Draht-Rentiere, Zuckerstangen
  dyker(g, V, off, t) {
    const gy = V.groundY;
    sky(g, V, '#070b1c', '#1d2546');
    for (let i = 0; i < 30; i++) { g.fillStyle = `rgba(255,255,255,${0.3 + ((i * 7) % 5) / 8})`; g.fillRect((i * 97) % V.w, (i * 53) % (gy - 180), 2, 2); }
    const bulbs = ['#ff5252', '#ffd740', '#69f0ae', '#40c4ff', '#ff80ab', '#ffffff'];
    const tw = (i) => (Math.floor(t * 3 + i) % 3 ? 1 : 0.4);
    const lightLine = (x1, y1, x2, y2, n, warm, k = 0) => { for (let i = 0; i <= n; i++) { const u = i / n; g.globalAlpha = tw(i + k); g.fillStyle = warm ? (i % 2 ? '#ffe9a8' : '#fff4d0') : bulbs[(i + k) % 6]; g.beginPath(); g.arc(x1 + (x2 - x1) * u, y1 + (y2 - y1) * u, 1.9, 0, TAU); g.fill(); } g.globalAlpha = 1; };
    const glow = (x, y, r, c) => { const gr = g.createRadialGradient(x, y, 2, x, y, r); gr.addColorStop(0, c); gr.addColorStop(1, 'rgba(0,0,0,0)'); g.fillStyle = gr; g.beginPath(); g.arc(x, y, r, 0, TAU); g.fill(); };
    rep(V, off, 0.45, 380, (x, k) => {
      const w = 230, base = gy - 22, h1 = 70, h2 = 60, y1 = base - h1, y2 = y1 - h2;
      glow(x + w / 2, base - 80, 190, 'rgba(255,190,90,0.22)');
      // Haus: unten Stein, oben Backstein + Erker
      g.fillStyle = '#c9bca4'; g.fillRect(x, y1, w, h1);
      g.fillStyle = '#7d6a5c'; g.fillRect(x + 10, y2, w - 20, h2);
      g.fillStyle = '#5d4e44'; g.beginPath(); g.moveTo(x, y2); g.lineTo(x + w * 0.62, y2 - 64); g.lineTo(x + w, y2); g.fill(); // Hauptgiebel
      g.fillStyle = '#6e5e52'; g.beginPath(); g.moveTo(x + 12, y2 + 4); g.lineTo(x + 52, y2 - 40); g.lineTo(x + 92, y2 + 4); g.fill(); // Erkergiebel
      lightLine(x, y2, x + w * 0.62, y2 - 64, 22, true, k); lightLine(x + w * 0.62, y2 - 64, x + w, y2, 14, true, k);
      lightLine(x + 12, y2 + 4, x + 52, y2 - 40, 10, true); lightLine(x + 52, y2 - 40, x + 92, y2 + 4, 10, true);
      // Fenster mit Kränzen und roten Schleifen
      for (const wx of [24, 62, 140, 178]) { g.fillStyle = '#ffd98a'; g.fillRect(x + wx, y2 + 12, 24, 30); g.fillStyle = '#b71c1c'; g.beginPath(); g.moveTo(x + wx + 12, y2 + 20); g.lineTo(x + wx + 6, y2 + 16); g.lineTo(x + wx + 6, y2 + 24); g.closePath(); g.moveTo(x + wx + 12, y2 + 20); g.lineTo(x + wx + 18, y2 + 16); g.lineTo(x + wx + 18, y2 + 24); g.closePath(); g.fill(); lightLine(x + wx, y2 + 11, x + wx + 24, y2 + 11, 6, false, wx); }
      g.strokeStyle = '#2e7d32'; g.lineWidth = 4; g.beginPath(); g.arc(x + w * 0.62, y2 - 24, 10, 0, TAU); g.stroke(); g.fillStyle = '#d32f2f'; g.beginPath(); g.arc(x + w * 0.62, y2 - 15, 3, 0, TAU); g.fill();
      // Neon-Schild
      g.strokeStyle = '#ff3355'; g.lineWidth = 2; g.shadowColor = '#ff3355'; g.shadowBlur = 8; roundRect(g, x + 14, y1 + 48, 60, 14, 7); g.stroke(); g.shadowBlur = 0;
      g.fillStyle = '#7dff9a'; g.font = '900 9px ui-rounded, system-ui, sans-serif'; g.textAlign = 'center'; g.fillText('Christmas', x + 44, y1 + 58);
      // Balkon mit leuchtenden blauen Schneeflocken-Paneelen, Nussknacker & Santa
      g.fillStyle = '#e8e2d6'; g.fillRect(x - 4, y1 - 4, w + 8, 6);
      for (let i = 0; i < 9; i++) { const px = x + 4 + i * 25; g.fillStyle = '#1a237e'; g.fillRect(px, y1 - 24, 20, 20); g.strokeStyle = '#9fe0ff'; g.lineWidth = 1.2; g.shadowColor = '#40c4ff'; g.shadowBlur = 6; for (let a = 0; a < 3; a++) { const an = a * Math.PI / 3; g.beginPath(); g.moveTo(px + 10 - Math.cos(an) * 7, y1 - 14 - Math.sin(an) * 7); g.lineTo(px + 10 + Math.cos(an) * 7, y1 - 14 + Math.sin(an) * 7); g.stroke(); } g.shadowBlur = 0; }
      const nut = (nx, ny, s) => { g.save(); g.translate(nx, ny); g.scale(s, s); g.fillStyle = '#c62828'; g.fillRect(-6, -30, 12, 20); g.fillStyle = '#1a237e'; g.fillRect(-5, -10, 4, 10); g.fillRect(1, -10, 4, 10); g.fillStyle = '#ffccbc'; g.fillRect(-5, -40, 10, 10); g.fillStyle = '#111'; g.fillRect(-6, -54, 12, 14); g.fillStyle = '#ffd740'; g.fillRect(-6, -42, 12, 2); g.restore(); };
      for (const nx of [30, 70, 160, 200]) nut(x + nx, y1 - 24, 0.8);
      emoji(g, '🎅', x + 115, y1 - 40, 30);
      // Erdgeschoss: Fenster + großer Lichterbogen über dem Eingang
      g.fillStyle = '#ffd98a'; g.fillRect(x + 20, y1 + 14, 34, 30); g.fillRect(x + w - 54, y1 + 14, 34, 30);
      g.fillStyle = '#6d4c41'; g.fillRect(x + w / 2 - 14, y1 + 18, 28, h1 - 18);
      for (let i = 0; i <= 30; i++) { const a = Math.PI + (i / 30) * Math.PI, ax = x + w / 2 + Math.cos(a) * 50, ay = base - 6 + Math.sin(a) * 62; g.globalAlpha = tw(i); g.fillStyle = bulbs[i % 6]; g.beginPath(); g.arc(ax, ay, 2.6, 0, TAU); g.fill(); g.fillStyle = '#2e5d32'; g.globalAlpha = 0.6; g.beginPath(); g.arc(ax + 2, ay + 2, 2.4, 0, TAU); g.fill(); }
      g.globalAlpha = 1;
      // leuchtende runde Büsche
      for (const [bx, r] of [[x + 14, 18], [x + w - 14, 20], [x + w + 30, 14]]) { g.fillStyle = '#1f4d2a'; g.beginPath(); g.arc(bx, base - r, r, 0, TAU); g.fill(); for (let i = 0; i < 16; i++) { const a = i * 2.4, rr = r * (0.3 + (i % 4) * 0.2); g.globalAlpha = tw(i); g.fillStyle = bulbs[(i + k) % 6]; g.beginPath(); g.arc(bx + Math.cos(a) * rr, base - r + Math.sin(a) * rr, 1.8, 0, TAU); g.fill(); } g.globalAlpha = 1; }
      // Draht-Rentier
      const rx = x + w + 70, ry = base;
      g.strokeStyle = '#fff6d8'; g.lineWidth = 1.6; g.shadowColor = '#fff6d8'; g.shadowBlur = 6;
      g.beginPath(); g.ellipse(rx, ry - 26, 16, 8, 0, 0, TAU); g.moveTo(rx - 10, ry - 20); g.lineTo(rx - 12, ry); g.moveTo(rx + 10, ry - 20); g.lineTo(rx + 12, ry); g.moveTo(rx + 14, ry - 30); g.lineTo(rx + 20, ry - 46); g.stroke();
      g.beginPath(); g.arc(rx + 22, ry - 48, 4, 0, TAU); g.moveTo(rx + 20, ry - 52); g.lineTo(rx + 16, ry - 62); g.moveTo(rx + 24, ry - 52); g.lineTo(rx + 28, ry - 62); g.stroke(); g.shadowBlur = 0;
      g.fillStyle = '#ff3b3b'; g.beginPath(); g.arc(rx + 26, ry - 48, 1.6, 0, TAU); g.fill();
      // Zaun mit Zuckerstangen
      for (let i = 0; i < 12; i++) { const cx = x - 10 + i * 26; g.strokeStyle = '#fff'; g.lineWidth = 3; g.beginPath(); g.moveTo(cx, base + 2); g.lineTo(cx, base - 16); g.arc(cx + 4, base - 16, 4, Math.PI, 0); g.stroke(); g.strokeStyle = '#e53935'; g.lineWidth = 3; g.setLineDash([2, 3]); g.beginPath(); g.moveTo(cx, base + 2); g.lineTo(cx, base - 16); g.stroke(); g.setLineDash([]); }
    });
    snowfall(g, V, t, off, 40);
    floor(g, V, '#e3ecf5', '#ffffff', off, () => { g.fillStyle = 'rgba(150,170,200,0.3)'; for (let i = 0; i < 20; i++) g.fillRect(wrap(i * 67 - off, V.w + 40) - 20, gy + 10 + (i % 4) * 9, 10, 2); });
  },
  nycDay(g, V, off, t) { // New York bei Tag: Skyline mit One World Trade Center, Brooklyn Bridge über dem East River, Taxis
    const gy = V.groundY;
    sky(g, V, '#7fb8ea', '#eaf4ff'); clouds(g, V, off);
    rep(V, off, 0.12, 70, (x, k) => { const h = 120 + ((k * 61) % 120 + 120) % 120, w = 52 + (k % 3) * 8; g.fillStyle = ['#9fb1c4', '#b4c2d0', '#8fa2b6'][((k % 3) + 3) % 3]; g.fillRect(x, gy - h - 40, w, h); g.fillStyle = 'rgba(230,242,252,0.85)'; for (let r = 0; r < h / 10 - 1; r++) for (let i = 0; i < Math.floor(w / 9); i++) if ((r * 7 + i * 3 + k) % 4) g.fillRect(x + 4 + i * 9, gy - h - 34 + r * 10, 4, 5); });
    once(V, off, 0.05, 1500, 760, (x) => { const top = gy - 232; const gr = g.createLinearGradient(x, 0, x + 50, 0); gr.addColorStop(0, '#9cc3e6'); gr.addColorStop(0.5, '#e6f2fb'); gr.addColorStop(1, '#7ea9cf'); g.fillStyle = gr; g.beginPath(); g.moveTo(x, gy - 40); g.lineTo(x + 6, top); g.lineTo(x + 44, top); g.lineTo(x + 50, gy - 40); g.fill(); g.strokeStyle = 'rgba(80,110,140,0.5)'; g.lineWidth = 1; g.beginPath(); g.moveTo(x, gy - 40); g.lineTo(x + 44, top); g.moveTo(x + 50, gy - 40); g.lineTo(x + 6, top); g.stroke(); g.fillStyle = '#d8e4ee'; g.fillRect(x + 21, top - 8, 8, 8); g.fillRect(x + 24, top - 44, 2, 36); });
    g.fillStyle = '#5b86a8'; g.fillRect(0, gy - 42, V.w, 42); g.strokeStyle = 'rgba(255,255,255,0.4)'; g.lineWidth = 1; for (let r = 0; r < 3; r++) { g.beginPath(); for (let x = 0; x <= V.w; x += 12) g.lineTo(x, gy - 34 + r * 12 + Math.sin((x + off * 0.2) * 0.05 + t * 2) * 1.5); g.stroke(); }
    once(V, off, 0.3, 1400, 420, (x) => {
      const deckY = gy - 60, T1 = x + 110, T2 = x + 470, top = gy - 212;
      g.strokeStyle = 'rgba(90,90,90,0.85)'; g.lineWidth = 1.8;
      const cable = (ax, ay, bx, by, sagY) => { g.beginPath(); g.moveTo(ax, ay); g.quadraticCurveTo((ax + bx) / 2, sagY, bx, by); g.stroke(); };
      cable(T1, top + 14, T2, top + 14, deckY + 60); cable(x - 120, deckY - 4, T1, top + 14, deckY - 20); cable(T2, top + 14, x + 700, deckY - 4, deckY - 20);
      g.lineWidth = 0.6; g.strokeStyle = 'rgba(90,90,90,0.55)';
      for (let i = 1; i < 36; i++) { const u = i / 36, px = T1 + u * (T2 - T1), cy = (1 - u) * (1 - u) * (top + 14) + 2 * (1 - u) * u * (deckY + 60) + u * u * (top + 14); g.beginPath(); g.moveTo(px, cy); g.lineTo(px, deckY); g.stroke(); }
      for (let i = 0; i < 12; i++) { g.beginPath(); g.moveTo(T1, top + 18); g.lineTo(T1 + 16 + i * 13, deckY); g.moveTo(T2, top + 18); g.lineTo(T2 - 16 - i * 13, deckY); g.stroke(); }
      g.fillStyle = '#4a4f5a'; g.fillRect(x - 120, deckY, 820, 9);
      for (const tx of [T1, T2]) { const tw = 56; g.fillStyle = '#c8bfa8'; g.fillRect(tx - tw / 2, top, tw, gy - 18 - top); g.fillStyle = '#a69c86'; g.fillRect(tx + tw / 2 - 10, top, 10, gy - 18 - top); g.fillStyle = '#ddd5c2'; g.fillRect(tx - tw / 2 - 3, top - 6, tw + 6, 8); g.fillStyle = '#6f8aa6'; for (const ox of [-21, 3]) { g.beginPath(); g.moveTo(tx + ox, top + 150); g.lineTo(tx + ox, top + 98); g.lineTo(tx + ox + 9, top + 80); g.lineTo(tx + ox + 18, top + 98); g.lineTo(tx + ox + 18, top + 150); g.closePath(); g.fill(); } }
    });
    rep(V, off, 0.5, 400, (x) => { g.fillStyle = '#fdd835'; roundRect(g, x, gy - 40, 70, 22, 6); g.fill(); roundRect(g, x + 14, gy - 54, 40, 16, 5); g.fill(); g.fillStyle = '#222'; g.fillRect(x + 4, gy - 30, 62, 3); g.beginPath(); g.arc(x + 16, gy - 18, 7, 0, TAU); g.arc(x + 54, gy - 18, 7, 0, TAU); g.fill(); g.fillStyle = '#fff'; g.font = '900 6px sans-serif'; g.textAlign = 'center'; g.fillText('TAXI', x + 34, gy - 57); });
    asphalt(g, V, off);
  },
  // New Orleans French Quarter: pastellfarbene Häuser mit schmiedeeisernen Balkonen, Jazz
  nola(g, V, off, t) { // Bourbon Street in der Abenddämmerung (nach Fotos): Galerien mit Gusseisen-Spitze, Farnkörbe, Neon, Gaslaternen
    const gy = V.groundY;
    sky(g, V, '#3d4a8c', '#f2a36b');
    // Hochhäuser des Central Business District im Hintergrund
    rep(V, off, 0.08, 120, (x, k) => { const h = 130 + ((k * 53) % 110 + 110) % 110; g.fillStyle = '#7f8db0'; g.fillRect(x, gy - h - 60, 46, h); g.fillStyle = 'rgba(255,240,200,0.6)'; for (let r = 0; r < h / 12; r++) for (let i = 0; i < 4; i++) if ((r + i + k) % 3) g.fillRect(x + 5 + i * 10, gy - h - 54 + r * 12, 5, 5); if (k % 4 === 0) { g.fillStyle = '#8f9cbf'; g.fillRect(x + 18, gy - h - 80, 10, 20); g.beginPath(); g.moveTo(x + 16, gy - h - 80); g.lineTo(x + 23, gy - h - 96); g.lineTo(x + 30, gy - h - 80); g.fill(); } });
    const lace = (x, y, w) => { // Gusseisen-Geländer mit Bögen
      g.fillStyle = '#26282c'; g.fillRect(x, y, w, 3); g.fillRect(x, y - 22, w, 2);
      g.strokeStyle = '#2f3237'; g.lineWidth = 1; for (let i = 0; i < w; i += 7) { g.beginPath(); g.moveTo(x + i, y); g.lineTo(x + i, y - 22); g.stroke(); g.beginPath(); g.arc(x + i + 3.5, y - 15, 3, 0, TAU); g.stroke(); }
      g.strokeStyle = '#3a3d42'; g.lineWidth = 1.3; for (let i = 0; i < w; i += 28) { g.beginPath(); g.arc(x + i + 14, y - 22, 14, 0, Math.PI); g.stroke(); }
    };
    const fern = (x, y) => { g.strokeStyle = '#555'; g.lineWidth = 0.8; g.beginPath(); g.moveTo(x, y - 12); g.lineTo(x, y); g.stroke(); g.fillStyle = '#6b4b2a'; g.beginPath(); g.arc(x, y + 3, 5, 0, Math.PI); g.fill(); for (let i = 0; i < 9; i++) { const a = Math.PI * (0.05 + i / 8 * 0.9); g.strokeStyle = i % 2 ? '#3f8f3a' : '#5bb04e'; g.lineWidth = 2.2; g.beginPath(); g.moveTo(x, y + 3); g.quadraticCurveTo(x + Math.cos(a) * 10, y + 2 + Math.sin(a) * 4, x + Math.cos(a) * 14, y + 6 + Math.sin(a) * 14); g.stroke(); } };
    const cols = ['#7d3b2e', '#c9a27c', '#5f7a8c', '#a85a4a', '#d8c4a0', '#6b4a6b'];
    const neons = ['JAZZ', 'BAR', 'OYSTERS', 'BLUES', 'LIVE MUSIC', 'HURRICANES'];
    const ncol = ['#ff4fa3', '#3ee6b4', '#ffd23f', '#7cc6ff', '#ff7a45', '#b388ff'];
    rep(V, off, 0.32, 150, (x, k) => {
      const i = ((k % 6) + 6) % 6, h = 190;
      g.fillStyle = cols[i]; g.fillRect(x, gy - h, 146, h);
      g.fillStyle = 'rgba(0,0,0,0.12)'; for (let r = 0; r < 18; r++) g.fillRect(x, gy - h + r * 11, 146, 1);
      for (const [fy, lit] of [[gy - 128, 1], [gy - 60, 1]]) {
        for (let j = 0; j < 3; j++) { g.fillStyle = lit ? '#ffcf7a' : '#2a2a2a'; g.fillRect(x + 14 + j * 44, fy - 52, 22, 40); g.fillStyle = '#2e5b46'; g.fillRect(x + 10 + j * 44, fy - 52, 4, 40); g.fillRect(x + 36 + j * 44, fy - 52, 4, 40); } // Fensterläden
        g.fillStyle = '#2b2d31'; g.fillRect(x - 6, fy, 158, 4);
        lace(x - 6, fy, 158);
        for (const px of [x - 4, x + 70, x + 146]) g.fillRect(px, fy, 3, 60);
        for (let j = 0; j < 3; j++) fern(x + 20 + j * 52, fy + 6);
      }
      // Neon-Schild + Gaslaterne
      neon(g, neons[i], x + 73, gy - 18, ncol[i], 12, t + k, 1);
      g.fillStyle = '#222'; g.fillRect(x + 140, gy - 70, 3, 70); g.fillStyle = `rgba(255,200,110,${0.75 + Math.sin(t * 9 + k) * 0.15})`; g.beginPath(); g.arc(x + 141.5, gy - 74, 5, 0, TAU); g.fill();
      if (k % 3 === 0) { g.fillStyle = '#ccc'; g.fillRect(x + 6, gy - h + 6, 1.5, 30); g.fillStyle = '#b22234'; g.fillRect(x + 7.5, gy - h + 6, 20, 13); g.fillStyle = '#fff'; for (let r = 0; r < 3; r++) g.fillRect(x + 7.5, gy - h + 8 + r * 4, 20, 1.6); g.fillStyle = '#3c3b6e'; g.fillRect(x + 7.5, gy - h + 6, 8, 7); }
    });
    // das berühmte rote Eckhaus mit drei umlaufenden Galerien voller Farne (zieht ab und zu vorbei)
    once(V, off, 0.45, 1800, 700, (x) => {
      const w = 260, h = 230;
      g.fillStyle = '#b5523b'; g.fillRect(x, gy - h, w, h);
      for (const fy of [gy - 168, gy - 100, gy - 36]) {
        for (let j = 0; j < 5; j++) { g.fillStyle = '#ffe0a8'; g.beginPath(); g.moveTo(x + 14 + j * 50, fy); g.lineTo(x + 14 + j * 50, fy - 44); g.arc(x + 30 + j * 50, fy - 44, 16, Math.PI, 0); g.lineTo(x + 46 + j * 50, fy); g.fill(); g.fillStyle = '#2e5b46'; g.fillRect(x + 10 + j * 50, fy - 44, 4, 44); g.fillRect(x + 46 + j * 50, fy - 44, 4, 44); }
        if (fy < gy - 40) { g.fillStyle = '#d8d4cc'; g.fillRect(x - 12, fy, w + 24, 5); lace(x - 12, fy, w + 24); g.fillStyle = '#d8d4cc'; for (let j = 0; j < 7; j++) g.fillRect(x - 10 + j * 46, fy, 3, 68); for (let j = 0; j < 6; j++) { g.strokeStyle = '#d8d4cc'; g.lineWidth = 1.2; g.beginPath(); g.arc(x + 13 + j * 46, fy + 68, 22, Math.PI * 1.1, Math.PI * 1.9); g.stroke(); } for (let j = 0; j < 6; j++) fern(x + 12 + j * 46, fy + 10); }
      }
      g.fillStyle = '#e8e2d6'; g.fillRect(x - 14, gy - h - 6, w + 28, 8); lace(x - 14, gy - h + 2, w + 28);
    });
    stringLights(g, V, off, 0.45, 26, t, 240, 20, ['#ffd23f', '#ff4fa3', '#3ee6b4', '#fff']);
    rep(V, off, 0.55, 420, (x) => emoji(g, '🎷', x + 40, gy - 96 + Math.sin(t * 4) * 3, 22));
    cobble(g, V, off, '#6f655c', '#544c45');
  },
  // Sumpftour im Bayou (nach Foto): Zypressen mit Spanischem Moos, dunkelgrünes Wasser mit Spiegelungen,
  // Airboat mit großem Käfig-Propeller, Alligatoren, die auftauchen, Seerosen, Reiher – Kimi läuft über den Holzsteg
  swamp(g, V, off, t) {
    const gy = V.groundY;
    sky(g, V, '#a7c7a0', '#e3ecd2');
    // ferner Waldrand
    g.fillStyle = '#5d7a45'; g.beginPath(); g.moveTo(0, gy - 60); for (let x = 0; x <= V.w + 10; x += 12) g.lineTo(x, gy - 120 - Math.sin((x + off * 0.08) * 0.03) * 14 - Math.sin((x + off * 0.08) * 0.11) * 8); g.lineTo(V.w, gy - 60); g.fill();
    // Sumpfwasser mit Spiegelungen
    const wy = gy - 62; const wg = g.createLinearGradient(0, wy, 0, gy); wg.addColorStop(0, '#4b5e3a'); wg.addColorStop(1, '#2f3d27'); g.fillStyle = wg; g.fillRect(0, wy, V.w, gy - wy);
    g.strokeStyle = 'rgba(220,230,200,0.25)'; g.lineWidth = 1; for (let r = 0; r < 5; r++) { g.beginPath(); for (let x = 0; x <= V.w; x += 10) g.lineTo(x, wy + 6 + r * 11 + Math.sin(x * 0.05 + t * 1.5 + r) * 1.5); g.stroke(); }
    // Zypressen mit Spanischem Moos
    rep(V, off, 0.25, 170, (x, k) => {
      const tx = x + 60, th = 170 + (k % 3) * 20;
      g.fillStyle = '#4e3d2c'; g.beginPath(); g.moveTo(tx - 16, wy + 4); g.quadraticCurveTo(tx - 6, wy - 30, tx - 5, wy - th); g.lineTo(tx + 5, wy - th); g.quadraticCurveTo(tx + 6, wy - 30, tx + 16, wy + 4); g.fill();
      g.strokeStyle = '#4e3d2c'; g.lineWidth = 4; for (const [dx, dy] of [[-40, -th + 30], [44, -th + 46], [-30, -th + 80]]) { g.beginPath(); g.moveTo(tx, wy + dy + 10); g.lineTo(tx + dx, wy + dy); g.stroke(); }
      for (const [cx, cy, r] of [[tx, wy - th, 40], [tx - 40, wy - th + 26, 28], [tx + 44, wy - th + 42, 30], [tx - 26, wy - th + 74, 22]]) { g.fillStyle = k % 2 ? '#4f7a38' : '#5f8a44'; g.beginPath(); g.arc(cx, cy, r, 0, TAU); g.fill(); }
      g.strokeStyle = 'rgba(222,228,206,0.9)'; g.lineWidth = 2.6; // Moos-Vorhänge (Spanisches Moos)
      for (let m = 0; m < 22; m++) { const mx = tx - 64 + m * 6, my = wy - th + 16 + (m % 4) * 9, len = 38 + ((m * 13 + k * 7) % 34); g.beginPath(); g.moveTo(mx, my); g.quadraticCurveTo(mx + Math.sin(t + m) * 3, my + len / 2, mx + Math.sin(t * 0.8 + m) * 2, my + len); g.stroke(); }
      g.fillStyle = 'rgba(40,52,32,0.55)'; g.fillRect(tx - 12, wy + 6, 24, 30); // Spiegelung
    });
    // Seerosen
    rep(V, off, 0.4, 90, (x, k) => { g.fillStyle = '#6f9a45'; g.beginPath(); g.ellipse(x + 30, wy + 22 + (k % 3) * 8, 9, 3, 0, 0.3, TAU); g.fill(); if (k % 3 === 0) { g.fillStyle = '#f8d7e6'; g.beginPath(); g.arc(x + 32, wy + 20 + (k % 3) * 8, 2.4, 0, TAU); g.fill(); } });
    // Alligatoren tauchen auf (Augen + Schnauze, ab und zu Maul auf)
    rep(V, off, 0.45, 260, (x, k) => {
      const up = Math.max(0, Math.sin(t * 0.9 + k * 1.7)), ay = wy + 30 + (k % 2) * 10 - up * 4;
      if (up < 0.15) return;
      g.globalAlpha = Math.min(1, up * 1.6);
      g.fillStyle = '#3f5524'; g.beginPath(); g.ellipse(x + 40, ay, 22, 3.5, 0, Math.PI, 0); g.fill();
      g.fillStyle = '#4f6b2f'; for (const ex of [x + 50, x + 58]) { g.beginPath(); g.arc(ex, ay - 3, 3, 0, TAU); g.fill(); } g.fillStyle = '#e8d35a'; for (const ex of [x + 50, x + 58]) { g.beginPath(); g.arc(ex, ay - 3.5, 1.3, 0, TAU); g.fill(); }
      g.fillStyle = '#4f6b2f'; g.beginPath(); g.ellipse(x + 70, ay - 1, 10, 2.4, 0, 0, TAU); g.fill();
      if (up > 0.95) { g.fillStyle = '#c94a4a'; g.beginPath(); g.moveTo(x + 62, ay - 2); g.lineTo(x + 82, ay - 10); g.lineTo(x + 82, ay - 1); g.fill(); g.fillStyle = '#fff'; for (let i = 0; i < 4; i++) g.fillRect(x + 66 + i * 4, ay - 4 - i * 1.5, 1.5, 2); }
      g.strokeStyle = 'rgba(220,230,200,0.35)'; g.beginPath(); g.ellipse(x + 50, ay + 1, 30, 3, 0, 0, TAU); g.stroke();
      g.globalAlpha = 1;
    });
    // Airboat mit Gästen und großem Käfig-Propeller (fährt hin und her)
    once(V, off, 0.35, 1300, 500, (x) => {
      const bx = x + Math.sin(t * 0.6) * 30, by = wy + 26;
      g.fillStyle = '#e8ecef'; g.beginPath(); g.moveTo(bx, by); g.lineTo(bx + 150, by); g.lineTo(bx + 170, by - 8); g.lineTo(bx + 10, by - 10); g.fill();
      g.fillStyle = '#5e6a72'; g.fillRect(bx + 4, by - 3, 160, 3);
      g.fillStyle = '#e8572c'; for (let i = 0; i < 4; i++) g.fillRect(bx + 50 + i * 22, by - 22, 16, 12);
      const heads = ['#f3c4a2', '#dca47f', '#f3c4a2', '#c98a6a']; for (let i = 0; i < 4; i++) { g.fillStyle = ['#4fc3f7', '#ff8a65', '#81c784', '#ba68c8'][i]; g.fillRect(bx + 52 + i * 22, by - 34, 12, 14); g.fillStyle = heads[i]; g.beginPath(); g.arc(bx + 58 + i * 22, by - 39, 5, 0, TAU); g.fill(); if (i % 2) { g.strokeStyle = heads[i]; g.lineWidth = 2.4; g.beginPath(); g.moveTo(bx + 62 + i * 22, by - 32); g.lineTo(bx + 66 + i * 22, by - 46); g.stroke(); } }
      g.strokeStyle = '#b0bec5'; g.lineWidth = 1.5; g.strokeRect(bx + 46, by - 26, 92, 16);
      // Propeller-Käfig
      const px = bx + 22, py = by - 40;
      g.strokeStyle = '#8e9aa3'; g.lineWidth = 1; g.beginPath(); g.arc(px, py, 28, 0, TAU); g.stroke(); for (let i = 0; i < 8; i++) { const a = i / 8 * TAU; g.beginPath(); g.moveTo(px, py); g.lineTo(px + Math.cos(a) * 28, py + Math.sin(a) * 28); g.stroke(); }
      g.strokeStyle = '#8e9aa3'; g.beginPath(); for (let r = 9; r < 28; r += 6) { g.moveTo(px + r, py); g.arc(px, py, r, 0, TAU); } g.stroke();
      g.fillStyle = 'rgba(60,60,60,0.35)'; g.beginPath(); g.ellipse(px, py, 4, 26, t * 30, 0, TAU); g.fill();
      g.fillStyle = '#f57c00'; g.beginPath(); g.arc(px, py + 8, 8, 0, TAU); g.fill(); g.fillStyle = '#fff'; g.beginPath(); g.arc(px, py + 8, 4.5, 0, TAU); g.fill(); // Rettungsring
      g.fillStyle = '#5e6a72'; g.fillRect(px - 2, py + 10, 4, by - py - 12);
      g.fillStyle = 'rgba(240,245,240,0.4)'; for (let i = 0; i < 6; i++) { g.beginPath(); g.arc(bx - 8 - i * 9, by - 2 + Math.sin(t * 6 + i) * 1.5, 3 + i * 0.6, 0, TAU); g.fill(); } // Gischt
      g.fillStyle = 'rgba(232,236,239,0.18)'; g.fillRect(bx + 6, by + 3, 150, 10); // Spiegelung
    });
    // Reiher auf einem Pfahl
    once(V, off, 0.45, 900, 200, (x) => { g.fillStyle = '#6d5236'; g.fillRect(x, wy - 10, 5, 40); g.fillStyle = '#f4f4f0'; g.beginPath(); g.ellipse(x + 3, wy - 18, 9, 6, -0.3, 0, TAU); g.fill(); g.strokeStyle = '#f4f4f0'; g.lineWidth = 2; g.beginPath(); g.moveTo(x + 8, wy - 22); g.quadraticCurveTo(x + 14, wy - 34, x + 9, wy - 40); g.stroke(); g.fillStyle = '#e0a800'; g.beginPath(); g.moveTo(x + 9, wy - 41); g.lineTo(x + 18, wy - 39); g.lineTo(x + 9, wy - 38); g.fill(); });
    // Holzsteg als Boden
    floor(g, V, '#8a6a46', '#5d4530', off, () => { g.fillStyle = 'rgba(0,0,0,0.18)'; rep(V, off, 1, 22, (x) => g.fillRect(x, gy + 3, 2, 60)); g.fillStyle = '#5d4530'; rep(V, off, 1, 120, (x) => g.fillRect(x + 10, gy + 30, 8, 60)); });
  },
  // Nashville Lower Broadway: Honky-Tonks mit Neon-Gitarren, dahinter das „Batman“-Hochhaus
  nashville(g, V, off, t) {
    const gy = V.groundY;
    sky(g, V, '#1b1036', '#5a2d6e');
    once(V, off, 0.08, 1400, 500, (x) => { g.fillStyle = '#2c2f4a'; g.fillRect(x, gy - 300, 70, 300); g.beginPath(); g.moveTo(x, gy - 300); g.lineTo(x + 10, gy - 360); g.lineTo(x + 18, gy - 300); g.moveTo(x + 52, gy - 300); g.lineTo(x + 60, gy - 360); g.lineTo(x + 70, gy - 300); g.fill(); g.fillStyle = '#7fd3ff'; for (let i = 0; i < 30; i++) g.fillRect(x + 6 + (i % 5) * 13, gy - 290 + Math.floor(i / 5) * 40, 6, 8); });
    rep(V, off, 0.3, 160, (x, k) => { g.fillStyle = ['#7a3b2e', '#4a3b5a', '#8a5a3b', '#3b4a5a'][((k % 4) + 4) % 4]; g.fillRect(x, gy - 160, 150, 160); g.fillStyle = '#ffe082'; for (let i = 0; i < 4; i++) g.fillRect(x + 12 + i * 34, gy - 140, 22, 30); g.fillStyle = '#ffcc80'; g.fillRect(x + 20, gy - 70, 110, 50); const names = ['HONKY TONK', 'LIVE MUSIC', 'BOOTS', 'TOOTSIE’S']; neon(g, names[((k % 4) + 4) % 4], x + 75, gy - 88, ['#ff4fa3', '#3ee6b4', '#ffd23f', '#c77dff'][((k % 4) + 4) % 4], 12, t, 1); emoji(g, '🎸', x + 130, gy - 120, 26); });
    asphalt(g, V, off);
  },

  // Marktplatz: barockes Rathaus mit Denkmal davor, Wochenmarkt-Stände
  // Wochenmarkt auf dem Marktplatz (nach Fotos): rotes Sandstein-Rathaus mit Schiefer-Mansarddach, Gauben,
  // goldenem Giebelwappen und Uhrturm-Laterne, davor das Brüder-Denkmal; Häuserzeilen mit orangeroten Dächern,
  // Platanen und dichte, bunte Marktstände mit gestreiften Schirmen, Erdbeeren, Gemüse und Blumen
  hanauMarkt(g, V, off, t) {
    const gy = V.groundY;
    sky(g, V, '#8fc3ea', '#eef4f8'); clouds(g, V, off, 0.85);
    // Häuserzeilen am Platzrand
    rep(V, off, 0.12, 120, (x, k) => {
      const modern = k % 3 === 2, h = modern ? 78 : 66;
      g.fillStyle = modern ? '#c9ced3' : '#f1ece2'; g.fillRect(x, gy - 40 - h, 118, h);
      g.fillStyle = modern ? '#6d7680' : '#c4502e'; g.beginPath(); g.moveTo(x - 2, gy - 40 - h); g.lineTo(x + 12, gy - 64 - h); g.lineTo(x + 106, gy - 64 - h); g.lineTo(x + 120, gy - 40 - h); g.fill();
      g.fillStyle = '#f6f1e8'; for (let i = 0; i < 4; i++) { g.fillRect(x + 12 + i * 26, gy - 62 - h, 12, 12); g.fillStyle = '#555'; g.fillRect(x + 15 + i * 26, gy - 59 - h, 6, 8); g.fillStyle = '#f6f1e8'; } // Gauben
      g.fillStyle = modern ? '#7c8791' : '#4a5560'; for (let r = 0; r < (modern ? 3 : 2); r++) for (let i = 0; i < 6; i++) g.fillRect(x + 8 + i * 18, gy - 32 - h + r * 22, 10, 13);
    });
    g.fillStyle = '#b39079'; g.fillRect(0, gy - 40, V.w, 40); // Platz hinter den Ständen
    // Rathaus (verkleinert, damit Turm & Wetterfahne ins Bild passen)
    const RS = 0.64;
    once(V, off, 0.2, 1500, 560, (x) => {
      const w = 330, h = 150, top = gy - 30 - h, cx = x + w / 2;
      g.save(); g.translate(x, gy - 30); g.scale(RS, RS); g.translate(-x, -(gy - 30));
      // Laterne mit Uhr, Glockenstube, Haube und Wetterfahne
      g.fillStyle = '#3b3d44'; g.fillRect(cx - 18, top - 120, 36, 40);
      g.fillStyle = '#f3efe4'; g.beginPath(); g.arc(cx, top - 100, 11, 0, TAU); g.fill(); g.strokeStyle = '#222'; g.lineWidth = 1.4; g.beginPath(); g.moveTo(cx, top - 100); g.lineTo(cx, top - 108); g.moveTo(cx, top - 100); g.lineTo(cx + 6, top - 97); g.stroke();
      g.fillStyle = '#34363c'; g.fillRect(cx - 14, top - 150, 28, 30); g.fillStyle = '#1b1c20'; for (const dx of [-8, 3]) { g.beginPath(); g.moveTo(cx + dx, top - 124); g.lineTo(cx + dx, top - 140); g.arc(cx + dx + 2.5, top - 140, 2.5, Math.PI, 0); g.lineTo(cx + dx + 5, top - 124); g.fill(); }
      g.fillStyle = '#2f3136'; g.beginPath(); g.moveTo(cx - 16, top - 150); g.quadraticCurveTo(cx, top - 176, cx + 16, top - 150); g.fill();
      g.fillRect(cx - 1.5, top - 196, 3, 24); g.fillStyle = '#d4a017'; g.beginPath(); g.arc(cx, top - 182, 3, 0, TAU); g.fill(); g.beginPath(); g.moveTo(cx, top - 198); g.lineTo(cx + 12, top - 194); g.lineTo(cx, top - 190); g.fill();
      // Schiefer-Mansarddach mit zwei Gaubenreihen
      g.fillStyle = '#4a4d55'; g.beginPath(); g.moveTo(x - 6, top); g.lineTo(x + 18, top - 54); g.lineTo(x + 50, top - 82); g.lineTo(x + w - 50, top - 82); g.lineTo(x + w - 18, top - 54); g.lineTo(x + w + 6, top); g.fill();
      g.strokeStyle = 'rgba(255,255,255,0.08)'; g.lineWidth = 1; for (let i = 0; i < 12; i++) { g.beginPath(); g.moveTo(x + 10, top - 6 - i * 6); g.lineTo(x + w - 10, top - 6 - i * 6); g.stroke(); }
      for (let i = 0; i < 6; i++) { const dx = x + 26 + i * 52 + (i > 2 ? 16 : 0); if (Math.abs(dx + 12 - cx) < 40) continue; g.fillStyle = '#c45a42'; g.fillRect(dx, top - 40, 24, 26); g.beginPath(); g.arc(dx + 12, top - 40, 12, Math.PI, 0); g.fill(); g.fillStyle = '#e8eef2'; g.fillRect(dx + 5, top - 38, 14, 20); }
      for (const dx of [x + 70, x + 130, x + w - 130, x + w - 70]) { g.fillStyle = '#e9e4da'; g.beginPath(); g.ellipse(dx, top - 66, 6, 5, 0, 0, TAU); g.fill(); g.fillStyle = '#3a3c42'; g.beginPath(); g.ellipse(dx, top - 66, 3, 2.5, 0, 0, TAU); g.fill(); } // Ochsenaugen
      // Sandsteinfassade
      g.fillStyle = '#b8614a'; g.fillRect(x, top, w, h);
      g.fillStyle = 'rgba(0,0,0,0.06)'; for (let r = 0; r < 15; r++) g.fillRect(x, top + r * 10, w, 1);
      g.fillStyle = '#a5523d'; g.fillRect(cx - 52, top - 6, 104, h + 6); // Mittelrisalit
      g.fillStyle = '#b8614a'; g.beginPath(); g.moveTo(cx - 60, top); g.lineTo(cx, top - 34); g.lineTo(cx + 60, top); g.fill();
      g.strokeStyle = '#8f4433'; g.lineWidth = 2; g.stroke();
      g.fillStyle = '#d4a017'; g.beginPath(); g.ellipse(cx, top - 13, 13, 9, 0, 0, TAU); g.fill(); g.fillStyle = '#c62828'; g.beginPath(); g.ellipse(cx, top - 13, 6, 5, 0, 0, TAU); g.fill(); // Wappen
      g.strokeStyle = '#d4a017'; g.lineWidth = 1.4; for (const s2 of [-1, 1]) { g.beginPath(); g.moveTo(cx + s2 * 13, top - 13); g.quadraticCurveTo(cx + s2 * 26, top - 20, cx + s2 * 34, top - 8); g.stroke(); }
      g.fillStyle = '#c7735c'; g.fillRect(x, top + h * 0.62, w, 3); g.fillRect(x, top + h * 0.3, w, 2);
      for (let r = 0; r < 2; r++) for (let i = 0; i < 10; i++) { const wx = x + 12 + i * 32, wy = top + 10 + r * 46; g.fillStyle = '#f4efe6'; g.fillRect(wx, wy, 18, 30); g.fillStyle = '#7f9db3'; g.fillRect(wx + 2, wy + 2, 14, 26); g.fillStyle = '#f4efe6'; g.fillRect(wx + 8, wy + 2, 1.5, 26); g.fillRect(wx + 2, wy + 12, 14, 1.5); }
      for (let i = 0; i < 10; i++) { const wx = x + 12 + i * 32, wy = top + h * 0.66; g.fillStyle = '#8f4433'; g.beginPath(); g.moveTo(wx, top + h); g.lineTo(wx, wy + 8); g.arc(wx + 9, wy + 8, 9, Math.PI, 0); g.lineTo(wx + 18, top + h); g.fill(); g.fillStyle = '#5c6b78'; g.fillRect(wx + 2, wy + 9, 14, top + h - wy - 9); }
      g.fillStyle = '#2a2b30'; g.fillRect(cx - 30, top + 48, 60, 3); for (let i = 0; i < 10; i++) g.fillRect(cx - 30 + i * 6.6, top + 40, 1.4, 8); // Balkongitter
      g.restore();
    });
    // Platanen
    rep(V, off, 0.32, 210, (x, k) => { const tx = x + 40; g.fillStyle = '#8a7a62'; g.fillRect(tx - 4, gy - 76, 8, 46); for (const [dx, dy, r, c] of [[0, -100, 34, '#5f9a3c'], [-24, -86, 24, '#6fab46'], [24, -84, 26, '#548c34'], [0, -124, 22, '#79b54e']]) { g.fillStyle = c; g.beginPath(); g.arc(tx + dx, gy + dy, r, 0, TAU); g.fill(); } });
    // Denkmal vor dem Rathaus: hoher Sockel ragt über die Marktschirme, ein Bruder steht, einer sitzt
    once(V, off, 0.2, 1500, 560, (x) => {
      const mx = x + 165 * RS, mb = gy - 58, S2 = 0.78;
      g.save(); g.translate(mx, mb); g.scale(S2, S2); g.translate(-mx, -mb);
      g.fillStyle = '#8f8a80'; g.fillRect(mx - 34, mb - 8, 68, 8); g.fillStyle = '#a39e93'; g.fillRect(mx - 26, mb - 62, 52, 54); g.fillStyle = '#8f8a80'; g.fillRect(mx - 30, mb - 68, 60, 8);
      g.strokeStyle = 'rgba(0,0,0,0.2)'; g.strokeRect(mx - 18, mb - 52, 36, 34);
      const br = '#4f6f5f', br2 = '#3f5a4c';
      g.fillStyle = br; roundRect(g, mx - 20, mb - 128, 18, 60, 6); g.fill(); g.beginPath(); g.arc(mx - 11, mb - 136, 7.5, 0, TAU); g.fill(); // stehend
      g.strokeStyle = br; g.lineWidth = 5; g.beginPath(); g.moveTo(mx - 6, mb - 118); g.lineTo(mx + 6, mb - 102); g.stroke();
      g.fillStyle = br2; roundRect(g, mx + 2, mb - 108, 18, 26, 6); g.fill(); g.fillRect(mx + 2, mb - 86, 22, 10); g.fillRect(mx + 18, mb - 86, 6, 18); g.beginPath(); g.arc(mx + 11, mb - 115, 7, 0, TAU); g.fill(); // sitzend
      g.fillStyle = '#e8e0c8'; g.fillRect(mx + 4, mb - 96, 10, 6); // Buch
      g.restore();
      g.fillStyle = '#a39e93'; g.fillRect(mx - 22, mb, 44, 60); // Sockel nach unten verlängert
    });
    // dichte, bunte Marktstände
    const aw = [['#d32f2f', '#fff'], ['#f57c00', '#f57c00'], ['#00897b', '#e0f2f1'], ['#fbc02d', '#fff8e1'], ['#e53935', '#ffcdd2'], ['#fafafa', '#e0e0e0']];
    rep(V, off, 0.55, 150, (x, k) => {
      const [c1, c2] = aw[((k % 6) + 6) % 6], sx = x + 6;
      g.fillStyle = '#6d4c41'; g.fillRect(sx + 6, gy - 66, 3, 66); g.fillRect(sx + 122, gy - 66, 3, 66);
      if (k % 3 === 0) { // großer gestreifter Marktschirm
        for (let i = 0; i < 10; i++) { g.fillStyle = i % 2 ? c2 : c1; g.beginPath(); g.moveTo(sx + 65, gy - 104); g.lineTo(sx + i * 13, gy - 70); g.lineTo(sx + (i + 1) * 13, gy - 70); g.fill(); }
        g.fillStyle = '#5d4037'; g.fillRect(sx + 64, gy - 104, 2, 104);
      } else {
        g.fillStyle = c1; g.beginPath(); g.moveTo(sx - 2, gy - 66); g.lineTo(sx + 10, gy - 88); g.lineTo(sx + 120, gy - 88); g.lineTo(sx + 132, gy - 66); g.fill();
        g.fillStyle = c2; for (let i = 0; i < 9; i++) if (i % 2) g.fillRect(sx + 6 + i * 13, gy - 86, 13, 18);
        for (let i = 0; i < 9; i++) { g.fillStyle = i % 2 ? c2 : c1; g.beginPath(); g.moveTo(sx + i * 14.6, gy - 66); g.lineTo(sx + (i + 1) * 14.6, gy - 66); g.quadraticCurveTo(sx + i * 14.6 + 7.3, gy - 58, sx + i * 14.6, gy - 66); g.fill(); }
      }
      // Auslage
      g.fillStyle = '#a1887f'; g.fillRect(sx, gy - 34, 132, 6); g.fillStyle = '#8d6e63'; g.fillRect(sx + 4, gy - 28, 124, 28);
      const kind = ((k % 4) + 4) % 4;
      for (let i = 0; i < 6; i++) {
        const bx = sx + 4 + i * 21, by = gy - 46;
        g.fillStyle = '#d7b98a'; g.fillRect(bx, by, 19, 12); // Kiste/Schale
        if (kind === 0) { g.fillStyle = '#e53935'; for (let j = 0; j < 5; j++) { g.beginPath(); g.arc(bx + 3 + j * 3.4, by + 2, 2.4, 0, TAU); g.fill(); } g.fillStyle = '#2e7d32'; for (let j = 0; j < 5; j++) g.fillRect(bx + 2.5 + j * 3.4, by - 1.5, 1.2, 1.4); } // Erdbeeren
        if (kind === 1) { g.fillStyle = ['#43a047', '#fb8c00', '#e53935', '#7cb342', '#fdd835', '#8e24aa'][i]; for (let j = 0; j < 4; j++) { g.beginPath(); g.arc(bx + 4 + j * 4, by + 1, 3.4, 0, TAU); g.fill(); } } // Gemüse
        if (kind === 2) { for (let j = 0; j < 3; j++) { g.fillStyle = ['#e91e63', '#ffd23f', '#ab47bc', '#ff7043', '#fff'][(i + j) % 5]; g.beginPath(); g.arc(bx + 4 + j * 6, by - 4 - (j % 2) * 3, 3.6, 0, TAU); g.fill(); } g.fillStyle = '#558b2f'; g.fillRect(bx + 3, by - 2, 14, 3); } // Blumen
        if (kind === 3) { g.fillStyle = ['#f9a825', '#ffe082', '#d84315'][i % 3]; g.beginPath(); g.arc(bx + 9.5, by + 1, 7, Math.PI, 0); g.fill(); } // Käse/Brot
      }
      g.fillStyle = 'rgba(40,30,40,0.55)'; for (const vx of [sx + 40, sx + 92]) { g.beginPath(); g.arc(vx, gy - 60, 6, 0, TAU); g.fill(); g.fillRect(vx - 7, gy - 54, 14, 20); } // Händler
    });
    // Marktplatz-Pflaster (rötlich)
    floor(g, V, '#a8826c', '#8c6a58', off, () => { g.strokeStyle = 'rgba(0,0,0,0.12)'; g.lineWidth = 1; rep(V, off, 1, 18, (x) => { for (let r = 0; r < 4; r++) g.strokeRect(x + (r % 2) * 9, gy + 4 + r * 9, 18, 9); }); });
  },

  // Gulasch & BBQ: Garten mit Gulaschkessel überm Feuer, Grill und Rauch
  bbq(g, V, off, t) {
    const gy = V.groundY;
    sky(g, V, '#ffcf8a', '#fff1d8'); clouds(g, V, off, 0.6);
    g.fillStyle = '#3e8e41'; g.beginPath(); g.moveTo(0, gy); for (let x = 0; x <= V.w + 20; x += 20) g.lineTo(x, gy - 76 - Math.sin((x + off * 0.3) * 0.05) * 6); g.lineTo(V.w, gy); g.fill();
    rep(V, off, 0.45, 400, (x) => { // Smoker statt Dreibein, daneben Biertisch
      g.fillStyle = '#6d4c41'; for (let i = 0; i < 4; i++) { g.fillRect(x + 100, gy - 10 - i * 8, 40, 7); } // Holzstapel
      drawSmoker(g, x + 60, gy, 1.15, t);
      g.fillStyle = '#795548'; g.fillRect(x + 200, gy - 36, 120, 6); g.fillRect(x + 210, gy - 30, 5, 30); g.fillRect(x + 305, gy - 30, 5, 30);
      emoji(g, '🍺', x + 220, gy - 50, 16); emoji(g, '🌭', x + 250, gy - 48, 16); emoji(g, '🥩', x + 280, gy - 48, 16); drawCocotte(g, x + 305, gy - 36, 0.45, t, false);
    });
    grass(g, V, off);
  },

  // Kapstadt: Tafelberg mit „Tischtuch“-Wolke, Lion's Head, Seilbahn, bunte Bo-Kaap-Häuser
  capetown(g, V, off, t) {
    const gy = V.groundY;
    sky(g, V, '#5fb8f0', '#d9f1ff');
    // Tafelberg (flaches Plateau), links Devil's Peak, rechts Lion's Head
    const mx = V.w * 0.5 - wrap(off * 0.04, V.w * 2) * 0.05, top = gy - 145;
    g.fillStyle = '#9aa58a'; g.beginPath(); g.moveTo(mx - 340, gy - 50); g.lineTo(mx - 285, top + 20); g.lineTo(mx - 262, top - 8); g.lineTo(mx - 236, top + 24);
    g.lineTo(mx - 200, top + 2); g.lineTo(mx + 160, top); g.lineTo(mx + 196, top + 50); g.lineTo(mx + 236, top + 64); g.quadraticCurveTo(mx + 270, top - 10, mx + 300, top + 14); g.lineTo(mx + 360, gy - 50); g.closePath(); g.fill();
    g.fillStyle = 'rgba(60,70,50,0.18)'; for (let i = 0; i < 9; i++) { g.beginPath(); g.moveTo(mx - 180 + i * 38, top + 2); g.lineTo(mx - 172 + i * 38, top + 70); g.lineTo(mx - 164 + i * 38, top + 2); g.fill(); } // Felsrinnen
    // „Tischtuch“: flaches Wolkenband auf dem Plateau, das über die Kante herabfließt
    g.fillStyle = 'rgba(255,255,255,0.93)';
    roundRect(g, mx - 205, top - 9, 375, 13, 6); g.fill();
    for (let i = 0; i < 12; i++) { const cx = mx - 190 + i * 31; g.beginPath(); g.arc(cx, top - 8, 8 + (i % 3) * 2, 0, TAU); g.fill(); }
    for (let i = 0; i < 9; i++) { const cx = mx - 170 + i * 40 + Math.sin(t * 0.7 + i) * 3, len = 8 + ((i * 7) % 10) + Math.sin(t * 0.9 + i) * 3; g.beginPath(); g.ellipse(cx, top + 3 + len / 2, 7, len, 0, 0, TAU); g.fill(); }
    // Seilbahn
    g.strokeStyle = 'rgba(40,40,40,0.55)'; g.lineWidth = 1; g.beginPath(); g.moveTo(mx - 120, gy - 64); g.lineTo(mx - 40, top + 2); g.stroke();
    const ck = (t * 0.08) % 1; g.fillStyle = '#e53935'; roundRect(g, mx - 120 + ck * 80 - 5, gy - 64 - ck * (gy - 64 - top - 2) - 4, 10, 8, 2); g.fill();
    // Bo-Kaap-Häuserzeile
    rep(V, off, 0.45, 300, (x) => {
      ['#ff5c8a', '#ffd23f', '#3ec6e0', '#7ed957', '#b388ff', '#ff8f3f'].forEach((c, i) => {
        const hx = x + i * 48, h = 54 + (i % 2) * 10;
        g.fillStyle = c; g.fillRect(hx, gy - h, 46, h);
        g.fillStyle = 'rgba(255,255,255,0.85)'; g.fillRect(hx - 2, gy - h - 4, 50, 5); // Flachdach-Sims
        g.fillStyle = '#5d4037'; g.fillRect(hx + 18, gy - 24, 10, 24);
        g.fillStyle = '#e3f2fd'; for (const wx of [6, 32]) g.fillRect(hx + wx, gy - h + 12, 9, 12);
      });
    });
    cobble(g, V, off, '#bdb5a6', '#9e9585');
  },
  // Franschhoek: Weinberge, kapholländisches Gutshaus mit Giebel, Eichen, Berge – und die offene Weintram
  franschhoek(g, V, off, t, lv) {
    const gy = V.groundY;
    sky(g, V, '#8ecdf5', '#f4fbff'); clouds(g, V, off, 0.6);
    g.fillStyle = '#7f86a8'; g.beginPath(); g.moveTo(0, gy - 90); for (let x = 0; x <= V.w + 20; x += 20) { const u = (x + off * 0.06) / 70; g.lineTo(x, gy - 150 - Math.abs(Math.sin(u * 1.3)) * 40 - Math.sin(u * 3.1) * 10); } g.lineTo(V.w, gy - 90); g.closePath(); g.fill();
    // Weinberg-Hang mit Rebzeilen
    g.fillStyle = '#9ccc65'; g.fillRect(0, gy - 92, V.w, 92);
    for (let r = 0; r < 7; r++) { g.strokeStyle = r % 2 ? '#558b2f' : '#689f38'; g.lineWidth = 3; g.beginPath(); for (let x = -20; x <= V.w + 20; x += 14) g.lineTo(x, gy - 86 + r * 12 + Math.sin((x + off * 0.3) * 0.08) * 1.5); g.stroke(); }
    // Schienen + Weintram (offener Wagen, fährt gemächlich vorbei)
    g.fillStyle = '#6d6d6d'; g.fillRect(0, gy - 98, V.w, 3);
    const tram = (tx) => {
    g.fillStyle = '#7b1f3a'; roundRect(g, tx, gy - 140, 150, 12, 4); g.fill(); // Dach
    g.fillStyle = '#f3e9d2'; roundRect(g, tx + 4, gy - 128, 142, 6, 2); g.fill();
    for (let i = 0; i < 6; i++) { g.fillStyle = '#7b1f3a'; g.fillRect(tx + 6 + i * 27, gy - 128, 3, 26); g.fillStyle = ['#ff8a65', '#4fc3f7', '#ffd54f', '#ba68c8', '#81c784'][i % 5]; g.beginPath(); g.arc(tx + 20 + i * 27, gy - 116, 5, 0, TAU); g.fill(); g.fillRect(tx + 15 + i * 27, gy - 111, 10, 8); }
    g.fillStyle = '#7b1f3a'; g.fillRect(tx, gy - 104, 150, 6); g.fillStyle = '#222'; for (const wx of [20, 130]) { g.beginPath(); g.arc(tx + wx, gy - 97, 5, 0, TAU); g.fill(); }
    g.fillStyle = '#fff'; g.font = '900 7px ui-rounded, system-ui, sans-serif'; g.textAlign = 'center'; g.fillText(S(lv, 'tram', 'WINE TRAM'), tx + 75, gy - 131);
    };
    const cyc = V.w * 0.9 + 340, tx0 = V.w + 20 - (((t * 30 + off * 0.32) % cyc) + cyc) % cyc;
    tram(tx0); tram(tx0 + 158); // Triebwagen + Beiwagen
    // Gutshaus mit geschwungenem Giebel + Eichen + Weinfässer
    rep(V, off, 0.45, 460, (x) => {
      g.fillStyle = '#5d4037'; g.fillRect(x + 8, gy - 70, 8, 40); g.fillStyle = '#33691e'; for (const [dx, dy, r] of [[12, -86, 26], [-6, -76, 18], [30, -76, 18]]) { g.beginPath(); g.arc(x + dx, gy + dy, r, 0, TAU); g.fill(); }
      const hx = x + 90;
      g.fillStyle = '#c9a66b'; g.beginPath(); g.moveTo(hx - 6, gy - 50); g.lineTo(hx + 50, gy - 82); g.lineTo(hx + 166, gy - 82); g.lineTo(hx + 222, gy - 50); g.closePath(); g.fill(); // Reetdach
      g.fillStyle = '#fafafa'; g.fillRect(hx, gy - 52, 216, 52);
      g.beginPath(); g.moveTo(hx + 80, gy - 52); g.lineTo(hx + 80, gy - 78); g.quadraticCurveTo(hx + 86, gy - 92, hx + 96, gy - 90); g.quadraticCurveTo(hx + 108, gy - 110, hx + 120, gy - 90); g.quadraticCurveTo(hx + 130, gy - 92, hx + 136, gy - 78); g.lineTo(hx + 136, gy - 52); g.closePath(); g.fill(); // Holbol-Giebel
      g.fillStyle = '#2e7d32'; for (const wx of [14, 46, 160, 192]) { g.fillRect(hx + wx, gy - 40, 4, 18); g.fillRect(hx + wx + 18, gy - 40, 4, 18); g.fillStyle = '#e3f2fd'; g.fillRect(hx + wx + 4, gy - 40, 14, 18); g.fillStyle = '#2e7d32'; }
      g.fillStyle = '#5d4037'; g.fillRect(hx + 98, gy - 30, 20, 30);
      for (let i = 0; i < 3; i++) { const bx = hx + 240 + i * 26; g.fillStyle = '#8d5a33'; g.beginPath(); g.ellipse(bx, gy - 12, 11, 12, 0, 0, TAU); g.fill(); g.fillStyle = '#6d4022'; g.fillRect(bx - 10, gy - 20, 20, 2); g.fillRect(bx - 10, gy - 6, 20, 2); }
    });
    grass(g, V, off, '#8bc34a', '#689f38', false);
  },

  // Llandudno: kleine Bucht zwischen Judas Peak und Little Lion's Head, riesige Granitfelsen, Villen am Hang, Sonnenuntergang
  capebeach(g, V, off, t) {
    const gy = V.groundY;
    sky(g, V, '#ff8e5e', '#ffe0a8');
    const sunX = V.w * 0.68; g.fillStyle = 'rgba(255,236,170,0.95)'; g.beginPath(); g.arc(sunX, gy - 92, 26, 0, TAU); g.fill();
    // Little Lion's Head (rechts, Sonne versinkt dahinter) & Judas Peak (links)
    g.fillStyle = '#5b4a6e'; g.beginPath(); g.moveTo(V.w * 0.52, gy - 70); g.quadraticCurveTo(V.w * 0.66, gy - 150, V.w * 0.74, gy - 118); g.quadraticCurveTo(V.w * 0.86, gy - 98, V.w + 10, gy - 80); g.lineTo(V.w + 10, gy - 70); g.closePath(); g.fill();
    g.fillStyle = '#6e5d82'; g.beginPath(); g.moveTo(-10, gy - 70); g.lineTo(-10, gy - 150); g.quadraticCurveTo(V.w * 0.12, gy - 170, V.w * 0.2, gy - 120); g.quadraticCurveTo(V.w * 0.3, gy - 92, V.w * 0.38, gy - 70); g.closePath(); g.fill();
    // Villen am Hang (Lichter)
    for (let i = 0; i < 10; i++) { const u = ((i * 0.37) % 1), hx = V.w * (0.01 + u * 0.3), hy = gy - 150 + u * 70 + ((i * 13) % 14), w = 12 + (i % 3) * 5; g.fillStyle = i % 2 ? '#f5f0e6' : '#e9e2d4'; g.fillRect(hx, hy, w, 8); g.fillStyle = '#6d5f78'; g.fillRect(hx - 1, hy - 2, w + 2, 2); g.fillStyle = 'rgba(255,214,120,0.9)'; g.fillRect(hx + 3, hy + 3, 4, 3); } // Villen verstreut am Hang
    sea(g, V, off, t, gy - 70, '#3b6fa8', '#8fc6e6');
    g.fillStyle = 'rgba(255,220,150,0.55)'; g.fillRect(sunX - 32, gy - 68, 64, 3); g.fillRect(sunX - 20, gy - 60, 40, 2); g.fillRect(sunX - 10, gy - 52, 20, 2);
    // Granitfelsen (rund, groß) im Vordergrund der Bucht
    rep(V, off, 0.55, 380, (x) => {
      const rock = (cx, cy, rx, ry, c) => { g.fillStyle = c; g.beginPath(); g.ellipse(cx, cy, rx, ry, 0, Math.PI, 0); g.fill(); g.fillStyle = 'rgba(255,255,255,0.15)'; g.beginPath(); g.ellipse(cx - rx * 0.3, cy - ry * 0.6, rx * 0.35, ry * 0.18, -0.3, 0, TAU); g.fill(); };
      rock(x + 40, gy - 2, 58, 46, '#a39e98'); rock(x + 100, gy - 2, 36, 28, '#b8b2aa'); rock(x + 6, gy - 2, 30, 22, '#8f8a84');
      emoji(g, '🐧', x + 30, gy - 56, 22); emoji(g, '🐧', x + 52, gy - 52, 18, 0, true); emoji(g, '🐧', x + 104, gy - 36, 18);
    });
    floor(g, V, '#f4e6c8', '#e9d6ad', off, () => { g.fillStyle = 'rgba(180,150,100,0.35)'; for (let i = 0; i < 24; i++) g.fillRect(wrap(i * 47 - off, V.w + 40) - 20, gy + 10 + (i % 4) * 8, 3, 2); });
  },

  // Daheim-Küche: L-Küche mit hellen Fronten & Holzknöpfen, schwarze Arbeitsplatte mit Holzkante, schwarze Spüle & Armatur,
  // offenes Holzregal mit Tassen, Neon-Schriftzug, gerahmtes Poster, Gummibaum, Kaffeevollautomat, Fischgrät-Parkett, Sonnenlicht
  homeKitchen(g, V, off, t) {
    const gy = V.groundY;
    g.fillStyle = '#f2efe9'; g.fillRect(0, 0, V.w, gy);
    rep(V, off, 0.6, 640, (x) => {
      g.save(); g.translate(0, 30); // Wand-Deko etwas tiefer, damit sie nicht unter der Anzeige verschwindet
      // offenes Wandregal (Holz) mit Tassen & Gläsern, rechts schwarzes Regalstück mit Espressokanne
      g.fillStyle = '#d2a36c'; g.fillRect(x, gy - 212, 330, 5); g.fillStyle = '#9e9e9e'; for (const bx of [40, 160, 280]) g.fillRect(x + bx, gy - 207, 3, 14);
      for (let i = 0; i < 16; i++) { const cx = x + 10 + i * 19, c = ['#f1e4d0', '#e8b4a0', '#d1c4e9', '#fff', '#ffe0b2', '#b2dfdb'][i % 6]; if (i % 4 === 3) { g.fillStyle = 'rgba(220,235,245,0.8)'; g.fillRect(cx, gy - 230, 10, 18); } else { g.fillStyle = c; roundRect(g, cx, gy - 226, 13, 14, 3); g.fill(); g.strokeStyle = c; g.lineWidth = 2; g.beginPath(); g.arc(cx + 14, gy - 219, 3, -1.2, 1.2); g.stroke(); } }
      g.fillStyle = '#1b1b1e'; g.fillRect(x + 340, gy - 214, 120, 6); g.fillStyle = '#9e9e9e'; g.beginPath(); g.moveTo(x + 420, gy - 214); g.lineTo(x + 426, gy - 238); g.lineTo(x + 438, gy - 238); g.lineTo(x + 444, gy - 214); g.fill(); g.fillStyle = '#ffd23f'; g.beginPath(); g.ellipse(x + 400, gy - 220, 8, 5, 0.3, 0, TAU); g.fill();
      // Neon „Cheers!“
      g.save(); g.shadowColor = '#ff2d8a'; g.shadowBlur = 8 + Math.sin(t * 3) * 3; g.fillStyle = '#ff4f9a'; g.font = 'italic 700 26px Georgia, serif'; g.textAlign = 'left'; g.fillText('Cheers!', x + 60, gy - 238); g.restore();
      // gerahmtes Poster
      g.fillStyle = '#111'; g.fillRect(x + 500, gy - 250, 64, 84); g.fillStyle = '#e8c6dd'; g.fillRect(x + 504, gy - 246, 56, 76); g.fillStyle = '#111'; g.font = '900 11px ui-rounded, system-ui, sans-serif'; g.textAlign = 'center'; g.fillText('BUON', x + 532, gy - 228); g.fillText('GIOR', x + 532, gy - 212); g.fillText('NO', x + 532, gy - 196);
      g.restore();
      // Unterschränke: helle Fronten, runde Holzknöpfe; schwarze Platte mit Holzkante
      g.fillStyle = '#ddd6c8'; g.fillRect(x, gy - 92, 620, 92);
      g.strokeStyle = 'rgba(0,0,0,0.12)'; g.lineWidth = 1.5; for (let i = 0; i <= 10; i++) { g.beginPath(); g.moveTo(x + i * 62, gy - 92); g.lineTo(x + i * 62, gy); g.stroke(); } g.beginPath(); g.moveTo(x, gy - 48); g.lineTo(x + 620, gy - 48); g.stroke();
      g.fillStyle = '#d2a36c'; for (let i = 0; i < 10; i++) { g.beginPath(); g.arc(x + 31 + i * 62, gy - 82, 3.2, 0, TAU); g.fill(); g.beginPath(); g.arc(x + 31 + i * 62, gy - 40, 3.2, 0, TAU); g.fill(); }
      g.fillStyle = '#1a1a1d'; g.fillRect(x - 4, gy - 100, 628, 8); g.fillStyle = '#d2a36c'; g.fillRect(x - 4, gy - 93, 628, 2);
      // eingebauter Backofen + Kochfeld
      g.fillStyle = '#111'; g.fillRect(x + 312, gy - 88, 58, 52); g.fillStyle = '#2a2a2e'; g.fillRect(x + 316, gy - 78, 50, 36); g.fillStyle = '#bdbdbd'; g.fillRect(x + 320, gy - 82, 42, 2); g.fillStyle = '#ff7043'; g.fillRect(x + 352, gy - 86, 8, 3);
      g.fillStyle = '#0d0d0f'; g.fillRect(x + 300, gy - 101, 84, 2);
      // schwarze Spüle + hohe schwarze Armatur
      g.fillStyle = '#0d0d0f'; g.fillRect(x + 70, gy - 101, 60, 3); g.strokeStyle = '#111'; g.lineWidth = 4; g.lineCap = 'round'; g.beginPath(); g.moveTo(x + 100, gy - 100); g.lineTo(x + 100, gy - 140); g.quadraticCurveTo(x + 100, gy - 156, x + 116, gy - 150); g.lineTo(x + 116, gy - 138); g.stroke(); g.lineCap = 'butt';
      // Schneidebrett, Kaffeevollautomat, Wasserkocher, Bögen-Brett, Mixer, Gummibaum
      g.fillStyle = '#b07a45'; g.fillRect(x + 150, gy - 150, 34, 50);
      g.fillStyle = '#1c1c1f'; g.fillRect(x + 220, gy - 140, 36, 40); g.fillStyle = '#9e9e9e'; g.fillRect(x + 226, gy - 132, 24, 6); g.fillStyle = '#fff'; g.fillRect(x + 232, gy - 112, 10, 9);
      g.fillStyle = '#e8eecf'; g.beginPath(); g.moveTo(x + 280, gy - 101); g.lineTo(x + 284, gy - 126); g.lineTo(x + 302, gy - 126); g.lineTo(x + 306, gy - 101); g.fill();
      g.fillStyle = '#f2a490'; g.beginPath(); g.moveTo(x + 400, gy - 101); g.lineTo(x + 400, gy - 150); g.arc(x + 420, gy - 150, 20, Math.PI, 0); g.lineTo(x + 440, gy - 101); g.fill();
      g.fillStyle = '#ffd23f'; g.beginPath(); g.ellipse(x + 480, gy - 116, 9, 15, 0, 0, TAU); g.fill();
      g.fillStyle = '#9e9e9e'; g.fillRect(x + 520, gy - 128, 24, 28); g.fillStyle = 'rgba(220,235,245,0.85)'; g.fillRect(x + 524, gy - 160, 16, 32);
      g.fillStyle = '#f5f5f5'; roundRect(g, x + 572, gy - 124, 26, 24, 5); g.fill(); g.fillStyle = '#2e4d2b'; for (let i = 0; i < 6; i++) { const a = -Math.PI / 2 + (i - 2.5) * 0.45; g.beginPath(); g.ellipse(x + 585 + Math.cos(a) * 14, gy - 140 + Math.sin(a) * 12, 7, 13, a + Math.PI / 2, 0, TAU); g.fill(); }
    });
    // Sonnenstrahlen
    g.save(); g.globalCompositeOperation = 'lighter'; g.fillStyle = 'rgba(255,214,140,0.12)'; for (let i = 0; i < 3; i++) { const sx = wrap(i * 260 - off * 0.2, V.w + 200) - 100; g.beginPath(); g.moveTo(sx, 0); g.lineTo(sx + 60, 0); g.lineTo(sx + 220, gy); g.lineTo(sx + 120, gy); g.fill(); } g.restore();
    // Fischgrät-Parkett (Eiche)
    g.fillStyle = '#d9b98c'; g.fillRect(0, gy, V.w, V.h - gy);
    rep(V, off, 1, 36, (x) => { g.strokeStyle = 'rgba(140,100,60,0.35)'; g.lineWidth = 1; for (let r = 0; r < 5; r++) { const yy = gy + r * 14; g.beginPath(); g.moveTo(x, yy); g.lineTo(x + 18, yy + 10); g.lineTo(x + 36, yy); g.stroke(); } });
  },
  // Daheim-Garten: Rasen, Beet mit Gladiolen & Tomaten an Stäben, Apfelbaum, Büsche, Zaun
  homeGarden(g, V, off, t) {
    const gy = V.groundY;
    sky(g, V, '#8ecdf5', '#f1faff'); clouds(g, V, off, 0.7);
    rep(V, off, 0.3, 26, (x) => { g.fillStyle = '#a1887f'; g.fillRect(x, gy - 74, 20, 52); g.beginPath(); g.moveTo(x, gy - 74); g.lineTo(x + 10, gy - 82); g.lineTo(x + 20, gy - 74); g.fill(); }); // Holzzaun
    rep(V, off, 0.45, 560, (x) => {
      // Büsche
      for (const [bx, r] of [[0, 26], [34, 30], [70, 22]]) { g.fillStyle = '#4e8f3a'; g.beginPath(); g.arc(x + bx, gy - 30, r, 0, TAU); g.fill(); g.fillStyle = '#5fa848'; g.beginPath(); g.arc(x + bx - 6, gy - 38, r * 0.5, 0, TAU); g.fill(); }
      // Apfelbaum
      g.fillStyle = '#6d4c41'; g.fillRect(x + 140, gy - 110, 12, 90); g.fillStyle = '#4caf50'; for (const [dx, dy, r] of [[146, -130, 42], [118, -110, 28], [176, -112, 30], [146, -160, 26]]) { g.beginPath(); g.arc(x + dx, gy + dy, r, 0, TAU); g.fill(); }
      g.fillStyle = '#e53935'; for (let i = 0; i < 12; i++) { g.beginPath(); g.arc(x + 116 + (i * 23) % 64, gy - 150 + ((i * 17) % 60), 4, 0, TAU); g.fill(); }
      // Hochbeet mit Gladiolen & Tomaten
      const bx = x + 240; g.fillStyle = '#8d6e63'; g.fillRect(bx, gy - 30, 260, 26); g.fillStyle = '#5d4037'; g.fillRect(bx + 4, gy - 34, 252, 6);
      for (let i = 0; i < 7; i++) { const gx = bx + 14 + i * 16, h = 60 + (i % 3) * 12, c = ['#ff4d6d', '#ff9e00', '#c77dff', '#ffd60a', '#ff5d8f'][i % 5]; g.strokeStyle = '#2e7d32'; g.lineWidth = 2; g.beginPath(); g.moveTo(gx, gy - 32); g.lineTo(gx + Math.sin(t + i) * 1.5, gy - 32 - h); g.stroke(); for (let k = 0; k < 6; k++) { g.fillStyle = c; g.beginPath(); g.ellipse(gx + (k % 2 ? 3 : -3) + Math.sin(t + i) * 1.5, gy - 32 - h + 6 + k * 7, 4, 3, 0, 0, TAU); g.fill(); } g.fillStyle = '#43a047'; g.beginPath(); g.ellipse(gx - 4, gy - 44, 2.5, 12, -0.3, 0, TAU); g.fill(); }
      for (let i = 0; i < 4; i++) { const tx = bx + 140 + i * 30; g.fillStyle = '#a1887f'; g.fillRect(tx, gy - 100, 3, 68); g.fillStyle = '#388e3c'; for (let k = 0; k < 5; k++) { g.beginPath(); g.ellipse(tx + (k % 2 ? 7 : -5), gy - 40 - k * 12, 8, 5, k % 2 ? 0.5 : -0.5, 0, TAU); g.fill(); } g.fillStyle = '#e53935'; for (const [dx, dy] of [[6, -52], [-4, -66], [7, -80], [-3, -46]]) { g.beginPath(); g.arc(tx + dx, gy + dy, 4, 0, TAU); g.fill(); } }
    });
    grass(g, V, off);
  },

  // Café-Bar: limettengrüne Polster-Lounge mit gewölbter, waagerecht gesteppter Rückwand, geschwungene Holztische mit
  // Aschenbechern & Karten, Fensterfront mit Milchglas-Schrift und grünen Schirmen draußen, Logo-Schild mit Kaffeebohne
  chococino(g, V, off, t, lv) {
    const gy = V.groundY, lime = '#a7c43a', limeD = '#8aa62c', limeL = '#bcd654';
    g.fillStyle = '#efe6d6'; g.fillRect(0, 0, V.w, gy);
    rep(V, off, 0.45, 760, (x) => {
      // Fensterfront mit Blick nach draußen
      const wx = x + 420; g.fillStyle = '#dfeef7'; g.fillRect(wx, gy - 210, 300, 150);
      g.fillStyle = '#cfc6b8'; g.fillRect(wx + 10, gy - 150, 280, 50); // Häuser gegenüber
      for (const [px, pw] of [[wx + 40, 120], [wx + 170, 120]]) { g.fillStyle = '#4e7d3a'; g.fillRect(px + pw / 2 - 2, gy - 170, 4, 110); g.fillStyle = '#3f8f4a'; g.beginPath(); g.moveTo(px, gy - 160); g.quadraticCurveTo(px + pw / 2, gy - 196, px + pw, gy - 160); g.closePath(); g.fill(); g.fillStyle = '#2f7a3a'; for (let i = 0; i < 5; i++) { g.beginPath(); g.moveTo(px + i * pw / 5, gy - 160); g.quadraticCurveTo(px + i * pw / 5 + pw / 10, gy - 154, px + (i + 1) * pw / 5, gy - 160); g.fill(); } }
      g.fillStyle = 'rgba(255,255,255,0.75)'; g.fillRect(wx, gy - 112, 300, 20); g.fillStyle = '#555'; g.font = '700 10px ui-rounded, system-ui, sans-serif'; g.textAlign = 'center'; g.save(); g.translate(wx + 70, gy - 98); g.scale(-1, 1); g.fillText('LUNCH', 0, 0); g.restore(); g.save(); g.translate(wx + 210, gy - 98); g.scale(-1, 1); g.fillText('TEE SPECIALS', 0, 0); g.restore();
      g.fillStyle = '#e0e0e0'; g.fillRect(wx + 145, gy - 210, 8, 150); g.strokeStyle = '#c8c0b0'; g.lineWidth = 6; g.strokeRect(wx, gy - 210, 300, 150);
      // Logo-Schild
      const lx = wx + 55, ly = gy - 200; g.strokeStyle = '#888'; g.lineWidth = 1; g.beginPath(); g.moveTo(lx + 20, gy - 210); g.lineTo(lx + 20, ly); g.moveTo(lx + 170, gy - 210); g.lineTo(lx + 170, ly); g.stroke(); // hängt im Fenster
      g.fillStyle = '#f3dea0'; roundRect(g, lx, ly, 190, 40, 8); g.fill(); g.strokeStyle = '#7a4a1e'; g.lineWidth = 2; g.stroke();
      g.fillStyle = '#5a2a14'; g.font = 'italic 700 22px Georgia, serif'; g.textAlign = 'right'; g.fillText(S(lv, 'logoL', 'Choc'), lx + 82, ly + 28); g.textAlign = 'left'; g.fillText(S(lv, 'logoR', 'Cino'), lx + 110, ly + 28);
      g.fillStyle = '#4a1f0e'; g.beginPath(); g.ellipse(lx + 96, ly + 20, 9, 14, 0.35, 0, TAU); g.fill(); g.strokeStyle = '#c98a4a'; g.lineWidth = 1.5; g.beginPath(); g.moveTo(lx + 92, ly + 8); g.quadraticCurveTo(lx + 99, ly + 20, lx + 94, ly + 32); g.stroke();
      g.strokeStyle = 'rgba(200,150,80,0.8)'; g.lineWidth = 3; g.beginPath(); g.moveTo(lx + 96, ly - 2); g.bezierCurveTo(lx + 86, ly - 14, lx + 106, ly - 22, lx + 96, ly - 34); g.stroke(); // Dampf
      // Lounge: gewölbte, gesteppte Rückwand + Sitzbank
      g.fillStyle = lime; g.beginPath(); g.moveTo(x, gy - 46); g.lineTo(x, gy - 200); g.quadraticCurveTo(x + 10, gy - 226, x + 60, gy - 226); g.lineTo(x + 380, gy - 226); g.quadraticCurveTo(x + 400, gy - 222, x + 404, gy - 200); g.lineTo(x + 404, gy - 46); g.closePath(); g.fill();
      for (let r = 0; r < 8; r++) { g.fillStyle = r % 2 ? limeL : lime; g.fillRect(x + 2, gy - 214 + r * 20, 400, 18); g.fillStyle = 'rgba(0,0,0,0.12)'; g.fillRect(x + 2, gy - 196 + r * 20, 400, 2); }
      g.fillStyle = 'rgba(0,0,0,0.1)'; g.fillRect(x + 200, gy - 220, 2, 176);
      g.fillStyle = limeD; g.fillRect(x - 4, gy - 52, 412, 22); g.fillStyle = lime; g.fillRect(x - 4, gy - 56, 412, 8); g.fillStyle = 'rgba(0,0,0,0.12)'; for (let i = 1; i < 5; i++) g.fillRect(x - 4 + i * 82, gy - 56, 2, 26);
      // geschwungener Holztisch, Aschenbecher, Karten, Serviette
      g.fillStyle = '#5a3a24'; g.beginPath(); g.ellipse(x + 160, gy - 66, 70, 10, 0, 0, TAU); g.ellipse(x + 240, gy - 66, 50, 10, 0, 0, TAU); g.fill();
      g.fillStyle = '#7a5236'; g.fillRect(x + 120, gy - 64, 20, 64); g.fillRect(x + 250, gy - 64, 20, 64);
      g.fillStyle = '#f4ecc8'; g.fillRect(x + 130, gy - 74, 40, 6);
      for (const ax of [x + 120, x + 250]) { g.fillStyle = '#c9ccd3'; g.beginPath(); g.ellipse(ax, gy - 72, 10, 4, 0, 0, TAU); g.fill(); g.fillStyle = '#333'; g.beginPath(); g.ellipse(ax, gy - 73, 6, 2, 0, 0, TAU); g.fill(); }
      g.fillStyle = '#7cb342'; g.fillRect(x + 186, gy - 100, 16, 26); g.fillStyle = '#ffd23f'; g.fillRect(x + 190, gy - 92, 8, 12);
      // grüne Polsterhocker
      for (const hx of [x + 300, x + 345]) { g.fillStyle = limeD; roundRect(g, hx, gy - 40, 38, 30, 4); g.fill(); g.fillStyle = lime; g.fillRect(hx, gy - 40, 38, 6); g.fillStyle = '#7a5236'; g.fillRect(hx + 4, gy - 10, 5, 10); g.fillRect(hx + 29, gy - 10, 5, 10); }
    });
    // Laminat (Holzoptik)
    g.fillStyle = '#7a5a40'; g.fillRect(0, gy, V.w, V.h - gy);
    rep(V, off, 1, 120, (x) => { g.fillStyle = 'rgba(0,0,0,0.15)'; for (let r = 0; r < 5; r++) g.fillRect(x + (r % 2) * 60, gy + r * 14, 2, 14); g.fillStyle = 'rgba(255,255,255,0.05)'; g.fillRect(x, gy + 4, 120, 2); });
    for (let r = 0; r < 5; r++) { g.fillStyle = 'rgba(0,0,0,0.12)'; g.fillRect(0, gy + r * 14, V.w, 1); }
  },

  // Wohnzimmer der Eltern: Fensterbank voller Pflanzen (Weihnachtsstern), Heizkörper, graubraunes Ecksofa mit Kopfstütze
  // & Recamiere, dunkle Holztruhe als Couchtisch, Vitrinenschrank, Schwingsessel, Laminat & Fliesen – plus Katzensachen
  // Westernstadt (nach Fotos): Holzhäuser mit hohen Fassaden & Schildern, überdachte Holzstege mit Streben,
  // Bank mit ovalem Schild, rote Scheune mit Pony-Express-Bild, Backstein-Hotel mit Balkon, Fässer, Planwagen, Berge
  westernTown(g, V, off, t, lv) {
    const gy = V.groundY;
    sky(g, V, '#4f9ad8', '#e8f2fb'); clouds(g, V, off, 0.9);
    g.fillStyle = '#b9876a'; g.beginPath(); g.moveTo(0, gy - 70); for (let x = 0; x <= V.w + 10; x += 14) g.lineTo(x, gy - 90 - Math.abs(Math.sin((x + off * 0.05) * 0.008)) * 46 - Math.sin((x + off * 0.05) * 0.03) * 8); g.lineTo(V.w, gy - 70); g.fill();
    const signs = S(lv, 'westernSigns', null) || ['GENERAL STORE', 'SALOON', 'SHERIFF', 'OLD WEST PHOTOS', 'BARBER', 'HOTEL'];
    const woods = ['#8a5a3a', '#a46a42', '#6f4a33', '#b07848', '#7d6a58', '#9a4a32'];
    const porch = (x, w, y, col) => { g.fillStyle = col; g.fillRect(x - 4, y, w + 8, 6); for (let i = 0; i <= w; i += 46) { g.fillStyle = '#5d3f2a'; g.fillRect(x + i, y + 6, 5, gy - y - 6); g.strokeStyle = '#5d3f2a'; g.lineWidth = 3; g.beginPath(); g.moveTo(x + i + 2, y + 24); g.lineTo(x + i + 18, y + 6); g.moveTo(x + i + 2, y + 24); g.lineTo(x + i - 14, y + 6); g.stroke(); } };
    rep(V, off, 0.3, 190, (x, k) => {
      const i = ((k % 6) + 6) % 6, w = 180, h = 120 + (k % 3) * 18, top = gy - h;
      g.fillStyle = woods[i]; g.fillRect(x, top, w, h);
      g.fillStyle = 'rgba(0,0,0,0.12)'; for (let r = 0; r < h; r += 7) g.fillRect(x, top + r, w, 1);
      // Falsche Fassade mit Stufen/Bogen
      g.fillStyle = woods[i]; if (k % 2) { g.beginPath(); g.moveTo(x + 20, top); g.lineTo(x + 20, top - 18); g.quadraticCurveTo(x + w / 2, top - 44, x + w - 20, top - 18); g.lineTo(x + w - 20, top); g.fill(); } else { g.fillRect(x + 14, top - 22, w - 28, 22); g.fillRect(x + 50, top - 34, w - 100, 12); }
      g.fillStyle = '#efe3c4'; roundRect(g, x + 24, top + 8, w - 48, 22, 3); g.fill(); g.strokeStyle = '#3e2a1a'; g.lineWidth = 2; g.stroke();
      g.fillStyle = '#5a1f12'; g.font = '900 12px Georgia, serif'; g.textAlign = 'center'; g.fillText(signs[i], x + w / 2, top + 24, w - 56);
      // Fenster oben, Tür + Fenster unten
      for (let j = 0; j < 3; j++) { g.fillStyle = '#3a2a20'; g.fillRect(x + 26 + j * 48, top + 38, 26, 30); g.fillStyle = '#c9dbe6'; g.fillRect(x + 29 + j * 48, top + 41, 20, 24); }
      g.fillStyle = '#4a3020'; g.fillRect(x + 76, gy - 56, 30, 56); g.fillStyle = '#c9dbe6'; g.fillRect(x + 22, gy - 48, 40, 30); g.fillRect(x + 122, gy - 48, 40, 30);
      porch(x, w, gy - 72, '#6d4a30');
      g.fillStyle = '#a0763e'; g.fillRect(x, gy - 8, w, 8); // Holzsteg
      if (k % 3 === 0) { g.fillStyle = '#6d4a2a'; roundRect(g, x + w - 14, gy - 26, 16, 22, 4); g.fill(); g.fillStyle = '#3a2a1a'; g.fillRect(x + w - 14, gy - 20, 16, 2); g.fillRect(x + w - 14, gy - 12, 16, 2); } // Fass
      if (k % 4 === 1) { g.fillStyle = '#d7263d'; g.beginPath(); g.moveTo(x + w / 2, top - 46); g.lineTo(x + w / 2 + 22, top - 40); g.lineTo(x + w / 2, top - 34); g.fill(); g.fillStyle = '#555'; g.fillRect(x + w / 2 - 1, top - 50, 2, 20); } // Fahne
    });
    // Bank mit ovalem Schild „IN GOD WE TRUST“
    once(V, off, 0.3, 1500, 700, (x) => {
      const w = 230, top = gy - 170;
      g.fillStyle = '#c96b3c'; g.fillRect(x, top, w, 170); g.fillStyle = 'rgba(0,0,0,0.1)'; for (let r = 0; r < 34; r++) g.fillRect(x, top + r * 5, w, 0.8);
      g.fillStyle = '#2e6b3a'; g.fillRect(x - 6, top - 14, w + 12, 18); g.fillStyle = '#f2d27a'; g.font = '900 10px Georgia, serif'; g.textAlign = 'center'; g.fillText('IN GOD WE TRUST', x + w / 2, top - 1);
      g.fillStyle = '#e8b04a'; g.beginPath(); g.ellipse(x + w / 2, top + 34, 64, 24, 0, 0, TAU); g.fill(); g.strokeStyle = '#2e6b3a'; g.lineWidth = 4; g.stroke();
      g.fillStyle = '#4a1f0a'; g.font = '900 14px Georgia, serif'; g.fillText('NATIONAL', x + w / 2, top + 32); g.fillText('BANK', x + w / 2, top + 48);
      for (const wx of [20, 180]) { g.fillStyle = '#2e6b3a'; g.fillRect(x + wx, gy - 70, 30, 70); g.fillStyle = '#c9dbe6'; g.fillRect(x + wx + 4, gy - 64, 22, 36); }
      porch(x, w, gy - 82, '#2e6b3a');
    });
    // rote Scheune mit Pony-Express-Bild & Backstein-Hotel mit Balkon
    once(V, off, 0.3, 1900, 1500, (x) => {
      g.fillStyle = '#9e2f24'; g.fillRect(x, gy - 150, 200, 150); g.fillStyle = 'rgba(0,0,0,0.15)'; for (let i = 0; i < 200; i += 9) g.fillRect(x + i, gy - 150, 1.5, 150);
      g.fillStyle = '#9e2f24'; g.beginPath(); g.moveTo(x - 6, gy - 150); g.lineTo(x + 100, gy - 196); g.lineTo(x + 206, gy - 150); g.fill();
      g.fillStyle = '#e8c88a'; g.beginPath(); g.ellipse(x + 100, gy - 158, 50, 22, 0, 0, TAU); g.fill(); g.strokeStyle = '#5a1f12'; g.lineWidth = 2; g.stroke();
      g.fillStyle = '#6b3a1a'; g.beginPath(); g.ellipse(x + 92, gy - 156, 18, 6, 0, 0, TAU); g.fill(); g.fillRect(x + 104, gy - 168, 6, 10); g.fillStyle = '#5a1f12'; g.font = '900 8px Georgia, serif'; g.textAlign = 'center'; g.fillText('PONY EXPRESS', x + 100, gy - 172);
      porch(x, 200, gy - 70, '#7a2a20');
      const hx = x + 240; g.fillStyle = '#a65a3c'; g.fillRect(hx, gy - 200, 170, 200); g.fillStyle = 'rgba(0,0,0,0.12)'; for (let r = 0; r < 40; r++) g.fillRect(hx, gy - 200 + r * 5, 170, 0.8);
      g.fillStyle = '#5d3f2a'; g.fillRect(hx - 6, gy - 206, 182, 8);
      for (let r = 0; r < 2; r++) for (let j = 0; j < 4; j++) { g.fillStyle = '#efe3c4'; g.fillRect(hx + 16 + j * 40, gy - 186 + r * 58, 20, 34); g.fillStyle = '#3a4a5a'; g.fillRect(hx + 19 + j * 40, gy - 183 + r * 58, 14, 28); }
      g.fillStyle = '#2b2b2b'; g.fillRect(hx - 8, gy - 100, 186, 4); for (let i = 0; i < 186; i += 7) g.fillRect(hx - 8 + i, gy - 116, 1.5, 16); g.fillRect(hx - 8, gy - 118, 186, 3); // Balkon
      for (let i = 0; i < 5; i++) { g.fillStyle = '#2b2b2b'; g.fillRect(hx + i * 42, gy - 96, 5, 96); }
    });
    // Planwagen & Tränke vorne
    rep(V, off, 0.55, 640, (x) => {
      g.fillStyle = '#f2ead6'; g.beginPath(); g.moveTo(x + 20, gy - 30); g.quadraticCurveTo(x + 55, gy - 80, x + 90, gy - 30); g.fill(); g.strokeStyle = '#c8bca4'; g.lineWidth = 1.5; for (let i = 1; i < 4; i++) { g.beginPath(); g.moveTo(x + 20 + i * 17.5, gy - 30); g.lineTo(x + 20 + i * 17.5, gy - 54 - (i === 2 ? 6 : 0)); g.stroke(); }
      g.fillStyle = '#7a4a22'; g.fillRect(x + 14, gy - 32, 82, 12);
      for (const wx of [x + 26, x + 84]) { g.strokeStyle = '#3e2410'; g.lineWidth = 2.5; g.beginPath(); g.arc(wx, gy - 12, 12, 0, TAU); g.stroke(); for (let s2 = 0; s2 < 6; s2++) { const a = s2 / 6 * TAU; g.beginPath(); g.moveTo(wx, gy - 12); g.lineTo(wx + Math.cos(a) * 12, gy - 12 + Math.sin(a) * 12); g.stroke(); } }
      g.fillStyle = '#6d4a2a'; g.fillRect(x + 300, gy - 20, 60, 20); g.fillStyle = '#5aa0c8'; g.fillRect(x + 303, gy - 20, 54, 4); // Tränke
      g.strokeStyle = '#5d3f2a'; g.lineWidth = 3; g.beginPath(); g.moveTo(x + 420, gy); g.lineTo(x + 420, gy - 26); g.lineTo(x + 500, gy - 26); g.lineTo(x + 500, gy); g.stroke(); // Pferdestange
    });
    floor(g, V, '#d9b98a', '#c4a273', off, () => { g.fillStyle = 'rgba(120,80,40,0.15)'; for (let i = 0; i < 26; i++) { const x = wrap(i * 53 - off, V.w + 40) - 20; g.beginPath(); g.ellipse(x, gy + 10 + (i % 4) * 9, 14, 2, 0, 0, TAU); g.fill(); } });
  },
  // Saloon innen (nach Foto): Holzwände, Wagenrad-Kronleuchter mit Laternen, Galerie mit Geländer & Treppe,
  // Bartresen mit Flaschenregal & Spiegel, runde Tische mit Holzstühlen, Laternen, Ofenrohr, Steckbriefe
  saloon(g, V, off, t, lv) {
    const gy = V.groundY;
    g.fillStyle = '#4a2f1c'; g.fillRect(0, 0, V.w, gy);
    g.fillStyle = 'rgba(0,0,0,0.18)'; rep(V, off, 0.3, 22, (x) => g.fillRect(x, 0, 2, gy));
    // Galerie oben mit Geländer
    const gY = gy - 150;
    g.fillStyle = '#3a2414'; g.fillRect(0, 0, V.w, gY - 40);
    rep(V, off, 0.3, 120, (x) => { g.fillStyle = '#ffcf7a'; g.fillRect(x + 20, gY - 80, 26, 30); g.fillStyle = '#2a1a10'; g.fillRect(x + 32, gY - 80, 2, 30); g.fillStyle = '#5d3f2a'; g.fillRect(x + 60, gY - 90, 40, 50); g.fillStyle = '#4a2f1c'; g.fillRect(x + 64, gY - 86, 32, 42); }); // Türen oben
    g.fillStyle = '#6d4a30'; g.fillRect(0, gY - 4, V.w, 8); g.fillRect(0, gY - 30, V.w, 4);
    rep(V, off, 0.3, 14, (x) => { g.fillStyle = '#7d5638'; g.fillRect(x, gY - 26, 4, 22); });
    rep(V, off, 0.3, 240, (x) => { g.fillStyle = '#5d3f2a'; g.fillRect(x + 40, gY, 10, gy - gY); }); // Stützpfosten
    // Treppe
    once(V, off, 0.3, 1100, 760, (x) => {
      for (let i = 0; i < 12; i++) { g.fillStyle = i % 2 ? '#7a5234' : '#6d4a30'; g.fillRect(x + i * 14, gy - 12 - i * 12, 40, 12); }
      g.strokeStyle = '#8a6040'; g.lineWidth = 3; g.beginPath(); g.moveTo(x + 6, gy - 40); g.lineTo(x + 176, gy - 182); g.stroke();
      for (let i = 0; i < 12; i++) { g.fillStyle = '#8a6040'; g.fillRect(x + 8 + i * 14, gy - 40 - i * 12, 3, 28); }
    });
    // Wagenrad-Kronleuchter mit Laternen
    rep(V, off, 0.22, 420, (x) => {
      const cx = x + 200, cy = gY - 52 + Math.sin(t * 0.8 + x) * 1;
      g.strokeStyle = '#2a1a10'; g.lineWidth = 2; g.beginPath(); g.moveTo(cx, 0); g.lineTo(cx, cy - 6); g.stroke(); for (const s2 of [-1, 1]) { g.beginPath(); g.moveTo(cx, cy - 26); g.lineTo(cx + s2 * 36, cy); g.stroke(); }
      g.strokeStyle = '#6b4a2a'; g.lineWidth = 4; g.beginPath(); g.ellipse(cx, cy, 44, 9, 0, 0, TAU); g.stroke(); g.lineWidth = 1.5; for (let s2 = 0; s2 < 8; s2++) { const a = s2 / 8 * TAU; g.beginPath(); g.moveTo(cx, cy); g.lineTo(cx + Math.cos(a) * 44, cy + Math.sin(a) * 9); g.stroke(); }
      for (let s2 = 0; s2 < 6; s2++) { const a = s2 / 6 * TAU, lx = cx + Math.cos(a) * 44, ly = cy + Math.sin(a) * 9; g.fillStyle = '#2a1a10'; g.fillRect(lx - 3, ly + 2, 6, 10); const lg = g.createRadialGradient(lx, ly + 7, 1, lx, ly + 7, 22); lg.addColorStop(0, 'rgba(255,210,120,0.95)'); lg.addColorStop(1, 'rgba(255,210,120,0)'); g.fillStyle = lg; g.beginPath(); g.arc(lx, ly + 7, 22, 0, TAU); g.fill(); }
    });
    // Bartresen mit Flaschenregal & Spiegel
    rep(V, off, 0.4, 520, (x) => {
      g.fillStyle = '#3a2414'; g.fillRect(x + 20, gy - 130, 300, 70);
      g.fillStyle = 'rgba(200,220,230,0.25)'; g.fillRect(x + 120, gy - 124, 100, 40); g.strokeStyle = '#c9a24a'; g.lineWidth = 2; g.strokeRect(x + 120, gy - 124, 100, 40);
      for (let r = 0; r < 2; r++) { g.fillStyle = '#5d3f2a'; g.fillRect(x + 24, gy - 98 + r * 20 - 20, 92, 3); g.fillRect(x + 224, gy - 98 + r * 20 - 20, 92, 3); for (let i = 0; i < 8; i++) for (const bx of [x + 28, x + 228]) { g.fillStyle = ['#2e7d32', '#8d6e63', '#c9a24a', '#6a1b1b'][(i + r) % 4]; g.fillRect(bx + i * 11, gy - 112 + r * 20 - 20, 6, 14); } }
      g.fillStyle = '#6d4228'; g.fillRect(x, gy - 50, 340, 50); g.fillStyle = '#8a5a36'; g.fillRect(x - 6, gy - 56, 352, 8);
      g.fillStyle = 'rgba(0,0,0,0.2)'; for (let i = 20; i < 340; i += 56) g.fillRect(x + i, gy - 46, 40, 40);
      g.fillStyle = '#efe3c4'; g.fillRect(x + 360, gy - 120, 30, 38); g.fillStyle = '#5a1f12'; g.font = '900 6px Georgia, serif'; g.textAlign = 'center'; g.fillText('WANTED', x + 375, gy - 112); g.fillStyle = '#8a6a4a'; g.fillRect(x + 366, gy - 108, 18, 16); // Steckbrief
      g.fillStyle = '#222'; g.fillRect(x + 440, 0, 8, gy - 60); g.fillStyle = '#2a2a2a'; roundRect(g, x + 426, gy - 62, 36, 62, 6); g.fill(); g.fillStyle = 'rgba(255,120,40,0.6)'; g.fillRect(x + 434, gy - 36, 20, 12); // Ofen
    });
    // runde Tische mit Holzstühlen
    rep(V, off, 0.6, 300, (x) => {
      const tx = x + 120;
      for (const s2 of [-1, 1]) { g.fillStyle = '#5d3f2a'; g.fillRect(tx + s2 * 38 - 4, gy - 42, 4, 42); g.fillRect(tx + s2 * 38 - 12, gy - 22, 20, 4); g.fillRect(tx + s2 * 38 - 12, gy - 22, 3, 22); g.fillRect(tx + s2 * 38 + 5, gy - 22, 3, 22); for (let j = 0; j < 4; j++) g.fillRect(tx + s2 * 38 - 10 + j * 5, gy - 42, 2, 20); }
      g.fillStyle = '#7a5234'; g.beginPath(); g.ellipse(tx, gy - 30, 30, 6, 0, 0, TAU); g.fill(); g.fillStyle = '#5d3f2a'; g.fillRect(tx - 3, gy - 30, 6, 30); g.fillRect(tx - 14, gy - 3, 28, 3);
      g.fillStyle = '#c9a24a'; g.fillRect(tx - 6, gy - 42, 5, 10); g.fillStyle = 'rgba(255,240,200,0.7)'; g.fillRect(tx + 4, gy - 40, 4, 8);
    });
    floor(g, V, '#7a5234', '#5d3f2a', off, () => { g.fillStyle = 'rgba(0,0,0,0.18)'; rep(V, off, 1, 30, (x) => g.fillRect(x, gy + 3, 2, 60)); for (let r = 0; r < 4; r++) { g.fillStyle = 'rgba(255,255,255,0.05)'; g.fillRect(0, gy + 10 + r * 12, V.w, 1); } });
  },
  // Garten am Abend (nach Fotos & Straßenansicht): Omas Fachwerkhaus aus rotem Backstein, daneben das weiße Haus
  // mit dunkelgrauem Sockel & Vorgarten hinter Backsteinpfeiler-Zaun; dahinter der Garten zwischen Hütte und Hausseite
  // vor der hohen Backsteinwand – Wandlaternen an, Palmen & Lavendel, Gartenstühle mit kariertem Polster
  eveGarden(g, V, off, t) {
    const gy = V.groundY;
    sky(g, V, '#3f4f8a', '#f2b27a');
    g.fillStyle = 'rgba(255,255,255,0.7)'; for (let i = 0; i < 12; i++) { g.beginPath(); g.arc((i * 131) % V.w, (i * 29) % 60 + 8, 0.9, 0, TAU); g.fill(); }
    const lamp = (lx, ly, r = 40) => { g.fillStyle = '#222'; g.fillRect(lx, ly, 8, 14); const lg = g.createRadialGradient(lx + 4, ly + 8, 1, lx + 4, ly + 8, r); lg.addColorStop(0, 'rgba(255,220,140,0.75)'); lg.addColorStop(1, 'rgba(255,220,140,0)'); g.fillStyle = lg; g.beginPath(); g.arc(lx + 4, ly + 8, r, 0, TAU); g.fill(); };
    const brick = (x, y, w, h, c1 = '#a4553c', c2 = 'rgba(0,0,0,0.12)') => { g.fillStyle = c1; g.fillRect(x, y, w, h); g.fillStyle = c2; for (let r = 0; r < h / 5; r++) { g.fillRect(x, y + r * 5, w, 0.8); for (let i = (r % 2) * 6; i < w; i += 12) g.fillRect(x + i, y + r * 5, 0.8, 5); } };
    const SEG = 1180;
    rep(V, off, 0.3, SEG, (x0) => {
      // 1) Omas Haus: Backstein, Fachwerk-Giebel zur Straße, Ziegeldach, Schornstein
      let x = x0;
      g.fillStyle = '#b64a2e'; g.beginPath(); g.moveTo(x - 6, gy - 150); g.lineTo(x + 110, gy - 250); g.lineTo(x + 226, gy - 150); g.fill();
      g.fillStyle = '#8f3a24'; g.fillRect(x + 150, gy - 238, 12, 26);
      brick(x, gy - 150, 220, 150);
      g.save(); g.beginPath(); g.moveTo(x + 4, gy - 152); g.lineTo(x + 110, gy - 244); g.lineTo(x + 216, gy - 152); g.closePath(); g.clip(); brick(x, gy - 250, 220, 100, '#b35d42'); g.restore();
      g.strokeStyle = '#4a2c1e'; g.lineWidth = 4; // Fachwerk
      g.beginPath(); g.moveTo(x + 4, gy - 152); g.lineTo(x + 110, gy - 244); g.lineTo(x + 216, gy - 152); g.moveTo(x + 4, gy - 152); g.lineTo(x + 216, gy - 152);
      for (const fx of [40, 80, 140, 180]) { g.moveTo(x + fx, gy - 152); g.lineTo(x + fx, gy - 152 - (110 - Math.abs(110 - fx)) * 0.85); }
      g.moveTo(x + 40, gy - 152); g.lineTo(x + 80, gy - 200); g.moveTo(x + 180, gy - 152); g.lineTo(x + 140, gy - 200); g.moveTo(x + 60, gy - 186); g.lineTo(x + 160, gy - 186);
      g.moveTo(x + 4, gy - 100); g.lineTo(x + 216, gy - 100); for (const fx of [4, 60, 110, 160, 216]) { g.moveTo(x + fx, gy - 150); g.lineTo(x + fx, gy - 100); } g.moveTo(x + 4, gy - 150); g.lineTo(x + 60, gy - 100); g.moveTo(x + 216, gy - 150); g.lineTo(x + 160, gy - 100);
      g.stroke();
      for (const [wx, wy] of [[100, -228], [100, -140], [172, -90]]) { g.fillStyle = '#f2efe8'; g.fillRect(x + wx - 2, gy + wy - 2, 24, 34); g.fillStyle = '#ffd98a'; g.fillRect(x + wx, gy + wy, 20, 30); }
      g.fillStyle = '#5a6068'; g.fillRect(x + 228, gy - 140, 3, 140); // Fallrohr
      // Straßenlaterne
      g.fillStyle = '#3a3f46'; g.fillRect(x + 236, gy - 190, 4, 190); g.beginPath(); g.moveTo(x + 238, gy - 190); g.quadraticCurveTo(x + 238, gy - 206, x + 222, gy - 204); g.lineTo(x + 222, gy - 200); g.fill();
      g.fillStyle = '#2f3339'; g.beginPath(); g.ellipse(x + 220, gy - 198, 12, 4, 0, 0, TAU); g.fill(); lamp(x + 216, gy - 200, 60);
      // 2) Das weiße Haus von vorn: Rauputz, dunkelgrauer Sockel, Rollläden, langes Satteldach, Glas-Vordach
      x = x0 + 250;
      g.fillStyle = '#5a4a44'; g.beginPath(); g.moveTo(x - 10, gy - 150); g.lineTo(x + 40, gy - 196); g.lineTo(x + 330, gy - 196); g.lineTo(x + 380, gy - 150); g.fill();
      g.fillStyle = '#efebe4'; g.fillRect(x, gy - 150, 370, 150);
      g.fillStyle = 'rgba(0,0,0,0.04)'; for (let i = 0; i < 50; i++) g.fillRect(x + (i * 73) % 368, gy - 148 + (i * 37) % 140, 3, 2);
      g.fillStyle = '#4a4f57'; g.fillRect(x, gy - 30, 370, 30);
      for (const [wx, wy, lit] of [[30, -132, 1], [120, -132, 0], [230, -132, 1], [310, -132, 1], [30, -82, 1], [300, -82, 0]]) { g.fillStyle = '#d7d8d6'; g.fillRect(x + wx, gy + wy, 34, 40); g.fillStyle = lit ? '#ffd98a' : '#5f6b74'; g.fillRect(x + wx + 3, gy + wy + 14, 28, 24); g.fillStyle = '#c9cbc8'; for (let r = 0; r < 4; r++) g.fillRect(x + wx + 3, gy + wy + 2 + r * 3, 28, 1.6); } // Rollläden
      g.fillStyle = '#3a4048'; g.fillRect(x + 140, gy - 104, 34, 104); g.fillStyle = '#ffe3a6'; g.fillRect(x + 145, gy - 98, 24, 56);
      g.fillStyle = 'rgba(200,225,240,0.6)'; g.beginPath(); g.moveTo(x + 124, gy - 116); g.quadraticCurveTo(x + 157, gy - 132, x + 190, gy - 116); g.lineTo(x + 190, gy - 112); g.lineTo(x + 124, gy - 112); g.fill(); lamp(x + 196, gy - 104);
      g.fillStyle = '#b0b6bb'; g.beginPath(); g.ellipse(x + 260, gy - 110, 12, 14, 0.4, 0, TAU); g.fill(); // Sat-Schüssel
      g.fillStyle = '#c45a2f'; g.beginPath(); g.ellipse(x + 260, gy - 110, 9, 11, 0.4, 0, TAU); g.fill();
      // Vorgarten: Baum, Lavendelbusch, Terrasse mit Tischchen & Töpfen
      g.fillStyle = '#6b5a45'; g.fillRect(x + 66, gy - 70, 6, 70); for (const [dx, dy, r, c] of [[0, -96, 30, '#5f9a3c'], [-22, -82, 20, '#6fab46'], [22, -80, 22, '#548c34']]) { g.fillStyle = c; g.beginPath(); g.arc(x + 69 + dx, gy + dy, r, 0, TAU); g.fill(); }
      g.fillStyle = '#8aa58a'; g.beginPath(); g.arc(x + 108, gy - 16, 18, Math.PI, 0); g.fill(); g.fillStyle = '#9a7ad6'; for (let i = 0; i < 10; i++) { g.beginPath(); g.arc(x + 94 + i * 3, gy - 24 - (i % 3) * 5, 1.6, 0, TAU); g.fill(); }
      for (const [tx, c] of [[200, '#c4502e'], [226, '#7a8a6a'], [330, '#c4502e']]) { g.fillStyle = c; g.fillRect(x + tx, gy - 16, 14, 16); g.fillStyle = '#5f9a3c'; g.beginPath(); g.arc(x + tx + 7, gy - 20, 9, 0, TAU); g.fill(); }
      // Zaun: Backsteinpfeiler mit braunen Holzlatten
      for (let i = 0; i < 9; i++) { const zx = x0 + 8 + i * 70; brick(zx, gy - 34, 12, 34, '#b05a3e'); g.fillStyle = '#8a7a6a'; g.fillRect(zx - 1, gy - 36, 14, 3); if (i < 8) { g.fillStyle = '#7a5a46'; for (let j = 0; j < 11; j++) g.fillRect(zx + 15 + j * 5, gy - 28, 3, 26); g.fillStyle = '#c8ccce'; g.fillRect(zx + 12, gy - 30, 58, 2); } }
      // 3) Dahinter der Garten: hohe Backsteinwand, Hütte mit Wellblech & orangeroter Holzblende, Rückseite des weißen Hauses
      x = x0 + 650;
      brick(x, gy - 200, 520, 200, '#9c6b4e', 'rgba(0,0,0,0.1)');
      g.fillStyle = '#efebe4'; g.fillRect(x + 20, gy - 170, 170, 170); g.fillStyle = '#4a4f57'; g.fillRect(x + 20, gy - 30, 170, 30);
      g.fillStyle = '#5a4a44'; g.beginPath(); g.moveTo(x + 10, gy - 170); g.lineTo(x + 60, gy - 196); g.lineTo(x + 200, gy - 196); g.lineTo(x + 200, gy - 170); g.fill();
      g.fillStyle = '#3b4048'; g.fillRect(x + 50, gy - 120, 70, 120); g.fillStyle = '#ffcf7a'; g.fillRect(x + 54, gy - 116, 29, 116); g.fillRect(x + 87, gy - 116, 29, 116);
      for (const wx of [x + 40, x + 130]) { g.fillStyle = '#3b4048'; g.fillRect(wx - 3, gy - 160, 44, 30); g.fillStyle = '#ffd98a'; g.fillRect(wx, gy - 157, 38, 24); }
      lamp(x + 140, gy - 120);
      g.strokeStyle = '#4f7a2c'; g.lineWidth = 2; g.beginPath(); g.moveTo(x + 196, gy - 30); g.quadraticCurveTo(x + 186, gy - 110, x + 200, gy - 180); g.stroke(); for (let i = 0; i < 8; i++) { g.fillStyle = i % 2 ? '#5f9a3c' : '#6fab46'; g.beginPath(); g.arc(x + 190 + (i % 3) * 6, gy - 50 - i * 16, 9, 0, TAU); g.fill(); } // Weinranke
      // Hütte
      const hx = x + 330;
      g.fillStyle = '#f4f2ee'; g.fillRect(hx, gy - 80, 170, 80);
      g.fillStyle = '#c45a2f'; g.fillRect(hx - 8, gy - 92, 186, 12); g.fillStyle = 'rgba(0,0,0,0.18)'; for (let i = 0; i < 186; i += 6) g.fillRect(hx - 8 + i, gy - 92, 1.2, 12);
      g.fillStyle = '#3a3c40'; g.beginPath(); g.moveTo(hx - 14, gy - 90); g.lineTo(hx + 184, gy - 90); g.lineTo(hx + 176, gy - 102); g.lineTo(hx - 6, gy - 102); g.fill(); g.strokeStyle = 'rgba(255,255,255,0.15)'; g.lineWidth = 1; for (let i = 0; i < 190; i += 7) { g.beginPath(); g.moveTo(hx - 10 + i, gy - 101); g.lineTo(hx - 12 + i, gy - 91); g.stroke(); }
      g.fillStyle = '#5c5048'; g.fillRect(hx + 40, gy - 66, 74, 46); g.fillStyle = '#d9b98a'; g.fillRect(hx + 44, gy - 62, 66, 38);
      g.fillStyle = '#7a5a3a'; g.fillRect(hx + 120, gy - 40, 40, 6); g.fillRect(hx + 122, gy - 34, 4, 34); g.fillRect(hx + 154, gy - 34, 4, 34); // Bank
      // Regal mit Töpfen zwischen Haus und Hütte
      g.fillStyle = '#9aa0a5'; for (let r = 0; r < 4; r++) g.fillRect(x + 270, gy - 92 + r * 22, 40, 2); g.fillRect(x + 270, gy - 92, 2, 92); g.fillRect(x + 308, gy - 92, 2, 92);
      for (let r = 0; r < 4; r++) for (let i = 0; i < 3; i++) { g.fillStyle = ['#c4502e', '#e9e4da', '#6d7a80'][(r + i) % 3]; g.fillRect(x + 274 + i * 12, gy - 100 + r * 22, 9, 8); }
    });
    // vorne: Kübelpflanzen, Lavendel, Gartenstühle mit kariertem Polster
    rep(V, off, 0.5, 300, (x, k) => {
      const px = x + 30;
      g.fillStyle = '#3d4248'; g.beginPath(); g.moveTo(px - 14, gy - 26); g.lineTo(px + 14, gy - 26); g.lineTo(px + 10, gy); g.lineTo(px - 10, gy); g.fill();
      for (let l = 0; l < 9; l++) { g.save(); g.translate(px, gy - 26); g.rotate(-1.5 + l * 0.37 + Math.sin(t + l) * 0.03); g.fillStyle = l % 2 ? '#4f8a3a' : '#64a14a'; g.beginPath(); g.ellipse(0, -26, 3.5, 28, 0, 0, TAU); g.fill(); g.restore(); }
      const lx = x + 130; g.fillStyle = '#6d7a80'; g.fillRect(lx - 16, gy - 18, 32, 18);
      for (let i = 0; i < 14; i++) { const a = -2.6 + i * 0.16; g.strokeStyle = '#7d9a6a'; g.lineWidth = 1.2; g.beginPath(); g.moveTo(lx, gy - 18); g.lineTo(lx + Math.cos(a) * 30, gy - 18 + Math.sin(a) * 30); g.stroke(); g.fillStyle = '#9a7ad6'; g.beginPath(); g.arc(lx + Math.cos(a) * 30, gy - 18 + Math.sin(a) * 30, 2.4, 0, TAU); g.fill(); }
      if (k % 2 === 0) { const cx = x + 210;
        g.fillStyle = '#3e2f28'; g.fillRect(cx, gy - 30, 46, 4); g.fillRect(cx + 2, gy - 26, 3, 26); g.fillRect(cx + 41, gy - 26, 3, 26);
        g.fillStyle = '#b5313f'; g.fillRect(cx, gy - 36, 46, 7); g.save(); g.translate(cx + 4, gy - 34); g.rotate(-0.35); g.fillRect(-3, -40, 14, 40); g.fillStyle = 'rgba(70,70,80,0.55)'; for (let j = 4; j < 40; j += 9) g.fillRect(-3, -40 + j, 14, 2.5); g.restore();
        g.fillStyle = 'rgba(70,70,80,0.55)'; for (let i = 4; i < 46; i += 12) g.fillRect(cx + i, gy - 36, 4, 7); }
    });
    floor(g, V, '#5f9a3c', '#4f8a32', off, () => { g.fillStyle = 'rgba(0,0,0,0.08)'; rep(V, off, 1, 26, (x) => g.fillRect(x, gy + 6, 2, 40)); g.fillStyle = 'rgba(255,255,255,0.08)'; for (let r = 0; r < 4; r++) g.fillRect(0, gy + 10 + r * 12, V.w, 1); });
  },
  parentsFlat(g, V, off, t) {
    const gy = V.groundY;
    g.fillStyle = '#f4f1ea'; g.fillRect(0, 0, V.w, gy);
    rep(V, off, 0.45, 720, (x) => {
      // Fenster mit Fensterbank & Pflanzen
      const wx = x + 120; g.fillStyle = '#dff0fb'; g.fillRect(wx, gy - 230, 240, 100); g.strokeStyle = '#fafafa'; g.lineWidth = 7; g.strokeRect(wx, gy - 230, 240, 100); g.beginPath(); g.moveTo(wx + 80, gy - 230); g.lineTo(wx + 80, gy - 130); g.moveTo(wx + 160, gy - 230); g.lineTo(wx + 160, gy - 130); g.stroke();
      g.fillStyle = '#e8dcc8'; g.fillRect(wx - 14, gy - 132, 268, 8);
      const pot = (px, h, c) => { g.fillStyle = c; g.beginPath(); g.moveTo(px - 9, gy - 132); g.lineTo(px - 11, gy - 132 - h); g.lineTo(px + 11, gy - 132 - h); g.lineTo(px + 9, gy - 132); g.fill(); };
      const leaves = (px, py, n, r, c) => { g.fillStyle = c; for (let i = 0; i < n; i++) { const a = -Math.PI / 2 + (i - (n - 1) / 2) * 0.5; g.beginPath(); g.ellipse(px + Math.cos(a) * r, py + Math.sin(a) * r, r * 0.5, r * 0.28, a, 0, TAU); g.fill(); } };
      pot(wx + 20, 22, '#fafafa'); leaves(wx + 20, gy - 170, 7, 22, '#4e8f3a');
      pot(wx + 70, 16, '#fafafa'); leaves(wx + 70, gy - 160, 6, 14, '#2e7d32'); g.fillStyle = '#d32f2f'; for (let i = 0; i < 5; i++) { const a = i * 1.26; g.beginPath(); g.ellipse(wx + 70 + Math.cos(a) * 7, gy - 160 + Math.sin(a) * 5, 6, 3, a, 0, TAU); g.fill(); } g.fillStyle = '#ffd23f'; g.beginPath(); g.arc(wx + 70, gy - 160, 2, 0, TAU); g.fill(); // Weihnachtsstern
      pot(wx + 112, 10, '#b0bec5'); leaves(wx + 112, gy - 148, 5, 8, '#66bb6a');
      pot(wx + 140, 10, '#cfd8dc'); leaves(wx + 140, gy - 148, 5, 8, '#81c784');
      pot(wx + 185, 22, '#e0e0e0'); leaves(wx + 185, gy - 172, 8, 24, '#43a047');
      pot(wx + 222, 14, '#f5f5f5'); leaves(wx + 222, gy - 156, 5, 12, '#558b2f');
      // Heizkörper links
      g.fillStyle = '#f7f7f2'; g.fillRect(x + 20, gy - 120, 60, 70); g.strokeStyle = '#dcdcd4'; g.lineWidth = 1.5; for (let i = 0; i < 9; i++) { g.beginPath(); g.moveTo(x + 24 + i * 6.5, gy - 118); g.lineTo(x + 24 + i * 6.5, gy - 52); g.stroke(); }
      // Ecksofa (graubraun) mit Kopfstütze & Recamiere
      const sc = '#6e655f', scL = '#7f766f', scD = '#5a524d';
      g.fillStyle = scD; g.fillRect(x + 110, gy - 120, 230, 50); // Rückenlehne
      g.fillStyle = scL; for (let i = 0; i < 3; i++) roundRect(g, x + 114 + i * 76, gy - 126, 70, 54, 8), g.fill();
      g.fillStyle = sc; roundRect(g, x + 124, gy - 156, 54, 30, 6); g.fill(); // Kopfstütze
      g.fillStyle = sc; g.fillRect(x + 100, gy - 72, 340, 34); g.fillStyle = scL; g.fillRect(x + 108, gy - 78, 230, 10); g.fillRect(x + 340, gy - 84, 110, 16); // Sitz + Recamiere
      g.fillStyle = scD; roundRect(g, x + 84, gy - 98, 36, 60, 8); g.fill(); // Armlehne
      g.fillStyle = '#d7b98a'; for (const fx of [x + 104, x + 300, x + 432]) g.fillRect(fx, gy - 38, 10, 10);
      g.fillStyle = '#222'; g.beginPath(); g.ellipse(x + 320, gy - 88, 16, 7, 0.2, 0, TAU); g.fill(); // Kissen
      // dunkle Holztruhe (Couchtisch) mit Schubladen & Körben, Kerzen, Wasserflasche
      const tx = x + 230; g.fillStyle = '#3e2a20'; g.fillRect(tx, gy - 58, 120, 54); g.fillStyle = '#4a3328'; g.fillRect(tx - 6, gy - 64, 132, 8);
      g.fillStyle = '#2c1d16'; g.fillRect(tx + 8, gy - 48, 46, 22); g.fillStyle = '#6d5a4d'; for (let i = 0; i < 4; i++) g.fillRect(tx + 64 + i * 12, gy - 48, 9, 40);
      g.fillStyle = '#c9a66b'; g.beginPath(); g.arc(tx + 31, gy - 37, 2, 0, TAU); g.fill();
      g.fillStyle = '#7b1f3a'; g.fillRect(tx + 30, gy - 76, 10, 12); g.fillStyle = '#fff3c4'; g.fillRect(tx + 48, gy - 74, 10, 10); g.fillStyle = 'rgba(160,210,240,0.85)'; g.fillRect(tx + 80, gy - 90, 8, 26); g.fillStyle = '#1976d2'; g.fillRect(tx + 80, gy - 80, 8, 6);
      // Vitrinenschrank (dunkles Holz, Glas)
      g.fillStyle = '#3b2a22'; g.fillRect(x + 470, gy - 230, 70, 230); g.fillStyle = 'rgba(160,190,210,0.35)'; g.fillRect(x + 476, gy - 222, 27, 150); g.fillRect(x + 507, gy - 222, 27, 150);
      g.fillStyle = 'rgba(255,255,255,0.4)'; for (let r = 0; r < 4; r++) g.fillRect(x + 476, gy - 190 + r * 36, 58, 2);
      // Schwingsessel mit hellem Polster
      g.strokeStyle = '#2b1d16'; g.lineWidth = 4; g.beginPath(); g.moveTo(x + 560, gy); g.quadraticCurveTo(x + 600, gy - 6, x + 610, gy - 40); g.moveTo(x + 560, gy - 40); g.lineTo(x + 640, gy - 40); g.stroke();
      g.fillStyle = '#e8dfcc'; g.beginPath(); g.moveTo(x + 570, gy - 40); g.quadraticCurveTo(x + 566, gy - 110, x + 590, gy - 140); g.lineTo(x + 612, gy - 136); g.quadraticCurveTo(x + 600, gy - 80, x + 640, gy - 44); g.closePath(); g.fill();
      // Katzensachen: Kratzbaum, Futternapf, Umzugskarton mit Luftlöchern
      g.fillStyle = '#d7c4a3'; g.fillRect(x + 660, gy - 120, 12, 120); g.fillStyle = '#8d6e63'; roundRect(g, x + 640, gy - 126, 52, 10, 4); g.fill(); roundRect(g, x + 646, gy - 70, 40, 9, 4); g.fill();
      g.fillStyle = '#ef9a9a'; g.beginPath(); g.ellipse(x + 30, gy - 6, 14, 5, 0, 0, TAU); g.fill(); g.fillStyle = '#8d6e63'; g.beginPath(); g.ellipse(x + 30, gy - 8, 9, 2.5, 0, 0, TAU); g.fill();
    });
    // Boden: Laminat (Holz) mit Fliesenstreifen
    g.fillStyle = '#c99a5b'; g.fillRect(0, gy, V.w, V.h - gy);
    rep(V, off, 1, 90, (x) => { g.fillStyle = 'rgba(0,0,0,0.12)'; for (let r = 0; r < 5; r++) g.fillRect(x + (r % 2) * 45, gy + r * 14, 2, 14); });
    for (let r = 0; r < 5; r++) { g.fillStyle = 'rgba(0,0,0,0.1)'; g.fillRect(0, gy + r * 14, V.w, 1); }
    rep(V, off, 1, 900, (x) => { g.fillStyle = '#e9dcc8'; g.fillRect(x, gy, 160, V.h - gy); g.strokeStyle = 'rgba(150,130,100,0.4)'; g.lineWidth = 1; for (let i = 0; i <= 4; i++) { g.beginPath(); g.moveTo(x + i * 40, gy); g.lineTo(x + i * 40, V.h); g.stroke(); } for (let r = 0; r < 3; r++) { g.beginPath(); g.moveTo(x, gy + 10 + r * 24); g.lineTo(x + 160, gy + 10 + r * 24); g.stroke(); } g.fillStyle = '#d4af37'; g.fillRect(x + 160, gy, 3, V.h - gy); });
  },

  // Gulasch-Küche: Fliesen, Holzschränke, Herd mit rotem Gusseisen-Bräter, Paprikaschnüre & Gemüse
  gulaschKitchen(g, V, off, t) {
    const gy = V.groundY;
    g.fillStyle = '#f3ead8'; g.fillRect(0, 0, V.w, gy);
    g.strokeStyle = 'rgba(160,140,110,0.25)'; g.lineWidth = 1;
    rep(V, off, 0.6, 18, (x) => { g.beginPath(); g.moveTo(x, gy - 150); g.lineTo(x, gy - 40); g.stroke(); });
    for (let y = gy - 150; y < gy - 40; y += 18) { g.beginPath(); g.moveTo(0, y); g.lineTo(V.w, y); g.stroke(); }
    rep(V, off, 0.6, 520, (x, k) => {
      // Oberschränke
      g.fillStyle = '#a0703c'; g.fillRect(x, gy - 230, 200, 70); g.strokeStyle = '#6d4c2a'; g.lineWidth = 2; for (let i = 0; i < 4; i++) g.strokeRect(x + 4 + i * 49, gy - 226, 45, 62);
      g.fillStyle = '#d4af37'; for (let i = 0; i < 4; i++) g.fillRect(x + 24 + i * 49, gy - 172, 6, 2);
      // Fenster
      g.fillStyle = '#bfe3ff'; g.fillRect(x + 250, gy - 220, 90, 70); g.strokeStyle = '#fff'; g.lineWidth = 5; g.strokeRect(x + 250, gy - 220, 90, 70); g.beginPath(); g.moveTo(x + 295, gy - 220); g.lineTo(x + 295, gy - 150); g.stroke();
      // Paprikaschnüre am Fenster
      for (const px of [x + 236, x + 354]) { g.strokeStyle = '#8d6e63'; g.lineWidth = 1; g.beginPath(); g.moveTo(px, gy - 226); g.lineTo(px, gy - 140); g.stroke(); for (let i = 0; i < 7; i++) drawPaprika(g, px + (i % 2 ? 3 : -3), gy - 218 + i * 12, 0.55, '#b71c1c', i % 2 ? 0.6 : -0.6); }
      // Arbeitsplatte + Herd
      g.fillStyle = '#7b5232'; g.fillRect(x, gy - 40, 380, 40); g.fillStyle = '#e8dcc6'; g.fillRect(x - 4, gy - 46, 388, 8);
      g.fillStyle = '#2b2b30'; g.fillRect(x + 40, gy - 48, 90, 4); g.fillStyle = '#444'; g.fillRect(x + 50, gy - 36, 70, 30); g.fillStyle = '#ff7043'; g.fillRect(x + 54, gy - 30, 62, 3);
      drawCocotte(g, x + 85, gy - 48, 1.3, t + k, true);
      // Schneidebrett mit Paprika & Zwiebeln, Gewürzdose
      g.fillStyle = '#c69c6d'; roundRect(g, x + 170, gy - 52, 70, 8, 3); g.fill();
      drawPaprika(g, x + 185, gy - 60, 0.9, '#e0281e', 0.3); drawPaprika(g, x + 205, gy - 60, 0.85, '#ffcf33', -0.2); emoji(g, '🧅', x + 228, gy - 60, 14);
      g.fillStyle = '#c62828'; roundRect(g, x + 262, gy - 70, 16, 24, 3); g.fill(); g.fillStyle = '#fff'; g.font = '900 5px sans-serif'; g.textAlign = 'center'; g.fillText('PAPRIKA', x + 270, gy - 56);
      // Schüssel mit Paprika
      g.fillStyle = '#efe6d4'; g.beginPath(); g.ellipse(x + 320, gy - 50, 26, 8, 0, 0, Math.PI); g.fill();
      [[300, -58, '#e0281e'], [314, -62, '#ffcf33'], [328, -59, '#43a047'], [342, -57, '#e0281e']].forEach(([dx, dy, c], i) => drawPaprika(g, x + dx, gy + dy, 0.8, c, i * 0.3 - 0.4));
    });
    // Fliesenboden
    g.fillStyle = '#d9cbb0'; g.fillRect(0, gy, V.w, V.h - gy);
    rep(V, off, 1, 80, (x) => { for (let i = 0; i < 2; i++) for (let r = 0; r < 3; r++) { g.fillStyle = (i + r) % 2 ? '#c8b892' : '#e6d9bd'; g.fillRect(x + i * 40, gy + r * 20, 40, 20); } });
  },

  // 30. Geburtstag „Pizza & Glitzer“
  pizzaGlitter(g, V, off, t) {
    const gy = V.groundY;
    sky(g, V, '#1c0630', '#4a1258');
    // Glitzervorhänge
    rep(V, off, 0.2, 18, (x, k) => {
      const c = ['#d4af37', '#e0e0e0', '#ff7ac8', '#c9a0ff'][((k % 4) + 4) % 4];
      g.strokeStyle = c; g.globalAlpha = 0.55; g.lineWidth = 2;
      g.beginPath(); g.moveTo(x, 0); for (let y = 0; y <= gy; y += 12) g.lineTo(x + Math.sin(t * 2 + y * 0.05 + k) * 2.5, y); g.stroke();
      g.globalAlpha = 1;
      for (let y = 8; y < gy; y += 22) { const tw = (Math.sin(t * 7 + k * 1.3 + y) + 1) / 2; if (tw > 0.75) { g.fillStyle = '#fff'; g.beginPath(); g.arc(x + Math.sin(t * 2 + y * 0.05 + k) * 2.5, y, 1.2 + tw, 0, TAU); g.fill(); } }
    });
    // große Diskokugel mit Spots und Reflexen
    const bx = V.w * 0.55, by = Math.max(60, gy * 0.26), R = Math.min(56, gy * 0.2);
    g.save(); g.globalCompositeOperation = 'lighter';
    for (const [sx, c] of [[0, 'rgba(255,90,200,0.22)'], [V.w, 'rgba(90,200,255,0.22)']]) { g.fillStyle = c; g.beginPath(); g.moveTo(sx, gy); g.lineTo(bx - R * 0.5, by); g.lineTo(bx + R * 0.5, by); g.fill(); }
    for (let i = 0; i < 70; i++) {
      const a = i * 2.39996 + t * 0.6, rr = 60 + (i * 37) % (Math.max(V.w, gy) * 0.9);
      const x = bx + Math.cos(a) * rr * 1.3, y = by + Math.sin(a) * rr * 0.7;
      if (y < 0 || y > V.h) continue;
      g.fillStyle = `hsla(${(i * 47 + t * 40) % 360},100%,80%,0.55)`; g.beginPath(); g.arc(x, y, 2 + (i % 3), 0, TAU); g.fill();
    }
    g.restore();
    g.strokeStyle = '#bbb'; g.lineWidth = 2; g.beginPath(); g.moveTo(bx, 0); g.lineTo(bx, by - R); g.stroke();
    g.save(); g.beginPath(); g.arc(bx, by, R, 0, TAU); g.clip();
    g.fillStyle = '#6d7b88'; g.fillRect(bx - R, by - R, R * 2, R * 2);
    const rows = 10, cols = 16, rot = t * 0.8;
    for (let r = 0; r < rows; r++) {
      const lat = -Math.PI / 2 + (r + 0.5) * Math.PI / rows, yy = by + Math.sin(lat) * R, rw = Math.cos(lat) * R, hh = R * Math.PI / rows;
      for (let c = 0; c < cols; c++) {
        const lon = (c / cols) * TAU + rot, cx = Math.sin(lon) * rw; if (Math.cos(lon) < 0) continue;
        const shine = Math.max(0, Math.cos(lon - 0.6)) * Math.max(0, 1 - Math.abs(lat + 0.3)), tw = (Math.sin(t * 9 + r * 3 + c * 5) + 1) / 2;
        const l = 45 + shine * 45 + tw * 10;
        g.fillStyle = `hsl(${(r * 25 + c * 15 + t * 60) % 360},${20 + tw * 40}%,${l}%)`;
        g.fillRect(bx + cx - rw * Math.cos(lon) * Math.PI / cols, yy - hh / 2, Math.max(1, rw * Math.cos(lon) * TAU / cols - 1), hh - 1);
      }
    }
    const gl = g.createRadialGradient(bx - R * 0.35, by - R * 0.4, 2, bx, by, R); gl.addColorStop(0, 'rgba(255,255,255,0.7)'); gl.addColorStop(0.5, 'rgba(255,255,255,0)'); gl.addColorStop(1, 'rgba(0,0,0,0.35)');
    g.fillStyle = gl; g.fillRect(bx - R, by - R, R * 2, R * 2);
    g.restore();
    for (let i = 0; i < 4; i++) { const a = t * 3 + i * 1.6; const fx = bx + Math.cos(a) * R * 0.8, fy = by + Math.sin(a * 1.3) * R * 0.7; g.fillStyle = 'rgba(255,255,255,0.9)'; g.beginPath(); for (let k = 0; k < 8; k++) { const aa = k * Math.PI / 4, rr2 = k % 2 ? 1.5 : 6; g.lineTo(fx + Math.cos(aa) * rr2, fy + Math.sin(aa) * rr2); } g.fill(); }
    once(V, off, 0.3, 900, 120, (x) => { emoji(g, '3️⃣', x, gy - 150, 56); emoji(g, '0️⃣', x + 52, gy - 150, 56); });
    rep(V, off, 0.4, 340, (x) => { g.fillStyle = '#c8a26a'; for (let i = 0; i < 4; i++) { roundRect(g, x + 250 + (i % 2) * 3, gy - 34 - i * 10, 46, 10, 2); g.fill(); } emoji(g, '🍕', x + 273, gy - 82, 22); });
    crowd(g, V, off, 0.45, t, '#2a0a3a', 18, 7);
    floor(g, V, '#1a0726', '#3a0e4a', off, () => { rep(V, off, 1, 30, (x, k) => { g.fillStyle = ['#ff4fa3', '#ffd23f', '#3ee6b4', '#c77dff'][(k + Math.floor(t * 4)) & 3]; g.globalAlpha = 0.5; g.fillRect(x + 1, gy + 2, 28, 10); g.globalAlpha = 1; }); });
  },

  // Hochzeit in der Scheune: Holzbalken, Lichterketten, Heuballen, Festtafel
  barn(g, V, off, t) {
    const gy = V.groundY;
    sky(g, V, '#3b2414', '#6b4426');
    rep(V, off, 0.3, 90, (x) => { g.fillStyle = '#5a3a22'; g.fillRect(x, 0, 12, gy); g.fillStyle = 'rgba(0,0,0,0.15)'; g.fillRect(x + 12, 0, 3, gy); });
    g.fillStyle = '#4a2f1b'; g.fillRect(0, 30, V.w, 10); g.fillRect(0, 100, V.w, 8);
    for (let i = 0; i < 3; i++) stringLights(g, V, off, 0.35 + i * 0.05, 10 + i * 34, t + i, 180 + i * 30, 22, ['#fff4c2', '#ffe08a']);
    rep(V, off, 0.5, 460, (x) => { g.fillStyle = '#fafafa'; g.fillRect(x, gy - 44, 200, 8); g.fillStyle = '#f0ece4'; g.fillRect(x, gy - 36, 200, 30); for (let i = 0; i < 5; i++) { emoji(g, '🕯️', x + 20 + i * 40, gy - 56, 12); emoji(g, '🥂', x + 40 + i * 40, gy - 54, 12); } emoji(g, '🎂', x + 100, gy - 66, 30); g.fillStyle = '#e9c46a'; roundRect(g, x + 260, gy - 34, 60, 34, 6); g.fill(); g.strokeStyle = '#c9a227'; g.lineWidth = 1; for (let i = 6; i < 60; i += 6) { g.beginPath(); g.moveTo(x + 260 + i, gy - 33); g.lineTo(x + 258 + i, gy - 1); g.stroke(); } });
    once(V, off, 0.35, 900, 300, (x) => sign(g, 'JUST MARRIED 💍', x, 68, { bg: '#fff', fg: '#c2185b', size: 13 }));
    floor(g, V, '#b38b5a', '#8a673e', off, () => { g.fillStyle = 'rgba(233,196,106,0.5)'; for (let i = 0; i < 40; i++) g.fillRect(wrap(i * 29 - off, V.w + 20) - 10, gy + 6 + (i % 6) * 6, 6, 1.5); });
  },

  // Gasthaus: Wirtsstube mit Holzvertäfelung, Stammtisch, Zapfhahn, Schnitzelpfannen
  inn(g, V, off, t, lv) {
    const gy = V.groundY;
    sky(g, V, '#efe2c8', '#e2cfa8');
    g.fillStyle = '#7b5532'; g.fillRect(0, gy - 90, V.w, 90); rep(V, off, 0.5, 50, (x) => { g.strokeStyle = '#5d3e22'; g.lineWidth = 2; g.strokeRect(x + 4, gy - 84, 42, 60); });
    rep(V, off, 0.45, 420, (x) => { windowFrame(g, x + 30, gy - 200, 70, 80, '#cfe6c8', '#6d4c41'); g.fillStyle = '#c62828'; g.fillRect(x + 26, gy - 206, 78, 8); g.fillStyle = '#4e342e'; g.fillRect(x + 160, gy - 160, 120, 70); for (let i = 0; i < 3; i++) { g.fillStyle = '#b0bec5'; g.fillRect(x + 180 + i * 34, gy - 186, 8, 26); g.fillStyle = '#ffd23f'; g.beginPath(); g.arc(x + 184 + i * 34, gy - 190, 6, 0, TAU); g.fill(); } emoji(g, '🍳', x + 320, gy - 150, 26); emoji(g, '🍖', x + 360, gy - 150, 22); g.fillStyle = '#5d4037'; g.fillRect(x + 300, gy - 40, 100, 8); g.fillRect(x + 345, gy - 32, 10, 32); emoji(g, '🍺', x + 320, gy - 52, 14); emoji(g, '🧅', x + 380, gy - 50, 14); });
    once(V, off, 0.45, 900, 200, (x) => { emoji(g, '👑', x, gy - 240, 30); sign(g, S(lv, 'inn', 'GASTHAUS'), x, gy - 212, { bg: '#3e2723', fg: '#ffd23f', size: 13 }); });
    planks(g, V, off, '#8d6e63', '#6d4c41');
  },

  // Kerb im Festzelt: Zeltdach mit Masten, Blaskapelle auf der Bühne, alle stehen auf den Bierbänken, Säftchenbar
  kerb(g, V, off, t, lv) {
    const gy = V.groundY;
    // Zeltdach von innen
    const gr = g.createLinearGradient(0, 0, 0, gy); gr.addColorStop(0, '#f3ead6'); gr.addColorStop(1, '#d9c9a8');
    g.fillStyle = gr; g.fillRect(0, 0, V.w, gy);
    rep(V, off, 0.15, 120, (x, k) => { g.fillStyle = k % 2 ? 'rgba(200,40,40,0.18)' : 'rgba(255,255,255,0.25)'; g.beginPath(); g.moveTo(x, 0); g.lineTo(x + 120, 0); g.lineTo(x + 90, gy * 0.45); g.lineTo(x + 30, gy * 0.45); g.fill(); });
    g.fillStyle = 'rgba(120,90,50,0.25)'; g.fillRect(0, gy * 0.45, V.w, 4);
    // Bühne mit Blaskapelle
    rep(V, off, 0.2, 700, (x) => {
      g.fillStyle = '#7b5532'; g.fillRect(x, gy - 150, 320, 26); g.fillStyle = '#c62828'; g.fillRect(x, gy - 230, 320, 80);
      g.fillStyle = 'rgba(0,0,0,0.25)'; for (let i = 0; i < 8; i++) g.fillRect(x + 6 + i * 40, gy - 230, 3, 80);
      sign(g, S(lv, 'kerb', 'KERB'), x + 160, gy - 238, { bg: '#fff', fg: '#c62828', size: 13 });
      for (let i = 0; i < 6; i++) { const bx = x + 30 + i * 50, hop = Math.abs(Math.sin(t * 5 + i)) * 3; g.fillStyle = '#1b2a4a'; g.beginPath(); g.arc(bx, gy - 186 - hop, 7, 0, TAU); g.fill(); roundRect(g, bx - 8, gy - 178 - hop, 16, 28, 5); g.fill(); emoji(g, ['🎺', '🥁', '🎷', '🎺', '📯', '🥁'][i], bx + 10, gy - 168 - hop, 16); }
    });
    // Zeltmasten & Lichterketten
    rep(V, off, 0.35, 260, (x) => { g.fillStyle = '#8d6e47'; g.fillRect(x, 0, 9, gy); g.fillStyle = '#6d532f'; g.fillRect(x + 7, 0, 2, gy); });
    stringLights(g, V, off, 0.35, 22, t, 260, 30, ['#fff4c2', '#ffd58a', '#ff8a80']);
    // alle stehen auf den Bierbänken
    for (let row = 0; row < 2; row++) {
      const f = 0.45 + row * 0.12, yb = gy - 40 + row * 22, col = row ? '#2a1830' : '#4a3550';
      rep(V, off, f, 240, (x, k) => {
        g.fillStyle = '#8d6e47'; g.fillRect(x + 10, yb - 4, 200, 7); g.fillRect(x + 20, yb + 3, 6, 18); g.fillRect(x + 194, yb + 3, 6, 18);
        g.fillStyle = '#a1825a'; g.fillRect(x + 6, yb - 16, 208, 5);
        for (let i = 0; i < 5; i++) {
          const px = x + 30 + i * 40, sway = Math.sin(t * 3 + i + k) * 4, hop = Math.abs(Math.sin(t * 4 + i * 1.3 + k)) * 5;
          g.fillStyle = col; g.beginPath(); g.arc(px + sway, yb - 52 - hop, 8, 0, TAU); g.fill(); roundRect(g, px - 9 + sway, yb - 44 - hop, 18, 38, 7); g.fill();
          g.strokeStyle = col; g.lineWidth = 4; g.beginPath(); g.moveTo(px + 6 + sway, yb - 40 - hop); g.lineTo(px + 12 + sway * 2, yb - 66 - hop); g.stroke();
          if ((i + k) % 2) { g.fillStyle = '#fff'; g.beginPath(); g.moveTo(px + 12 + sway * 2, yb - 66 - hop); g.lineTo(px + 26 + sway * 3, yb - 72 - hop + Math.sin(t * 9 + i) * 3); g.lineTo(px + 22 + sway * 3, yb - 60 - hop); g.fill(); }
          else emoji(g, '🍺', px + 14 + sway * 2, yb - 70 - hop, 12);
        }
      });
    }
    // Säftchenbar
    once(V, off, 0.45, 1100, 700, (x) => {
      g.fillStyle = '#120a1e'; g.fillRect(x, gy - 150, 210, 150);
      g.save(); g.translate(x + 105, gy - 116); for (let i = 0; i < 28; i++) { const a = i * 0.5 + t * 2, r = 4 + i * 0.9; g.fillStyle = `hsla(${270 + i * 3},80%,${30 + i}%,0.9)`; g.beginPath(); g.arc(Math.cos(a) * r, Math.sin(a) * r * 0.55, 2.6, 0, TAU); g.fill(); } g.fillStyle = '#000'; g.beginPath(); g.ellipse(0, 0, 7, 4, 0, 0, TAU); g.fill(); g.restore();
      neon(g, S(lv, 'bar', 'SÄFTCHENBAR'), x + 105, gy - 80, '#b388ff', 17, t, 1);
      for (let i = 0; i < 9; i++) { g.fillStyle = ['#ff4fa3', '#3ee6b4', '#ffd23f', '#7cc6ff', '#ff7b39'][i % 5]; roundRect(g, x + 14 + i * 21, gy - 68, 8, 20, 2); g.fill(); g.fillStyle = 'rgba(255,255,255,0.5)'; g.fillRect(x + 15 + i * 21, gy - 72, 6, 4); }
      g.fillStyle = '#3e2723'; g.fillRect(x - 6, gy - 44, 222, 10); g.fillStyle = '#2a1a12'; g.fillRect(x, gy - 34, 210, 34);
      for (let i = 0; i < 7; i++) { const c = ['#ff4fa3', '#3ee6b4', '#ffd23f', '#b388ff'][i % 4]; g.fillStyle = 'rgba(255,255,255,0.6)'; g.fillRect(x + 20 + i * 26, gy - 56, 10, 12); g.fillStyle = c; g.fillRect(x + 21, gy - 52, 0, 0); g.fillRect(x + 21 + i * 26, gy - 52, 8, 7); }
    });
    planks(g, V, off, '#9c7b52', '#7a5c38');
  },

  // Piraten-Kneipe: lange Theke mit Messing-Fußleiste, Rückbuffet voller Jägermeister- und Asbach-Flaschen,
  // Asbach-Cola-Tumbler (0,2 l mit Logo) und Jägermeister-Shots auf dem Tresen, Würfeltisch, Spielautomat
  pirateBar(g, V, off, t, lv) {
    const gy = V.groundY;
    sky(g, V, '#2b1a10', '#4a2e1c');
    rep(V, off, 0.3, 70, (x) => { g.fillStyle = 'rgba(0,0,0,0.2)'; g.fillRect(x, 0, 3, gy); });
    // Deko oben: Piratenflagge, Steuerrad, Bullauge
    rep(V, off, 0.3, 520, (x) => {
      g.fillStyle = '#111'; g.fillRect(x + 20, 18, 64, 40); emoji(g, '☠️', x + 52, 38, 24);
      g.fillStyle = '#6d4c41'; g.beginPath(); g.arc(x + 200, 50, 28, 0, TAU); g.fill(); g.fillStyle = '#3e2723'; g.beginPath(); g.arc(x + 200, 50, 19, 0, TAU); g.fill();
      g.strokeStyle = '#a1887f'; g.lineWidth = 3; for (let i = 0; i < 8; i++) { const a = i / 8 * TAU + Math.sin(t) * 0.2; g.beginPath(); g.moveTo(x + 200, 50); g.lineTo(x + 200 + Math.cos(a) * 36, 50 + Math.sin(a) * 36); g.stroke(); }
      g.fillStyle = '#c9a227'; g.beginPath(); g.arc(x + 360, 46, 20, 0, TAU); g.fill(); g.fillStyle = '#5b8fb0'; g.beginPath(); g.arc(x + 360, 46, 14, 0, TAU); g.fill();
    });
    once(V, off, 0.3, 900, 200, (x) => neon(g, S(lv, 'pub', 'KNEIPE'), x, gy - 214, '#ff7043', 18, t, 1));
    // Rückbuffet mit Spiegel und Flaschenregalen (durchgehend)
    const by = gy - 196;
    g.fillStyle = '#3e2414'; g.fillRect(0, by, V.w, 120);
    rep(V, off, 0.45, 240, (x, k) => {
      g.fillStyle = 'rgba(180,200,210,0.18)'; g.fillRect(x + 8, by + 6, 224, 108);
      for (let r = 0; r < 2; r++) {
        const sy = by + 54 + r * 52;
        g.fillStyle = '#6d4c41'; g.fillRect(x, sy, 240, 5);
        for (let i = 0; i < 8; i++) { const bx = x + 14 + i * 28; if ((i + r + k) % 3 === 0) drawAsbachBottle(g, bx, sy, 0.9); else if ((i + r + k) % 3 === 1) drawJaegerBottle(g, bx, sy, 0.9); else { g.fillStyle = ['#c62828', '#fafafa', '#2e7d32', '#ffb300'][(i + k) % 4]; roundRect(g, bx - 4, sy - 30, 8, 30, 2); g.fill(); g.fillRect(bx - 1.5, sy - 38, 3, 9); } }
      }
    });
    // Spielautomat
    once(V, off, 0.45, 1000, 650, (x) => { g.fillStyle = '#7b1fa2'; roundRect(g, x, gy - 150, 56, 110, 6); g.fill(); for (let i = 0; i < 3; i++) { g.fillStyle = '#fff'; g.fillRect(x + 5 + i * 16, gy - 128, 13, 20); emoji(g, ['🍒', '🔔', '7️⃣', '🍋'][(Math.floor(t * 8) + i) % 4], x + 11 + i * 16, gy - 118, 11); } g.fillStyle = (Math.floor(t * 4) % 2) ? '#ffd23f' : '#ff4fa3'; g.fillRect(x, gy - 156, 56, 6); });
    // lange Theke (Vordergrund-Ebene)
    const ty = gy - 62;
    g.fillStyle = '#5a3420'; g.fillRect(0, ty, V.w, 10); g.fillStyle = '#7b4a2b'; g.fillRect(0, ty - 4, V.w, 5);
    g.fillStyle = '#3e2414'; g.fillRect(0, ty + 10, V.w, 52);
    g.fillStyle = 'rgba(255,255,255,0.05)'; rep(V, off, 0.6, 56, (x) => g.fillRect(x, ty + 12, 2, 48));
    g.fillStyle = '#c9a227'; g.fillRect(0, gy - 14, V.w, 4);
    rep(V, off, 0.6, 180, (x, k) => {
      drawAsbachGlass(g, x + 30, ty - 4, 1);
      g.fillStyle = 'rgba(255,255,255,0.75)'; g.fillRect(x + 62, ty - 14, 8, 10); g.fillStyle = '#3b2210'; g.fillRect(x + 63, ty - 10, 6, 5);
      g.fillStyle = 'rgba(255,255,255,0.75)'; g.fillRect(x + 74, ty - 14, 8, 10); g.fillStyle = '#3b2210'; g.fillRect(x + 75, ty - 10, 6, 5);
      if (k % 2) drawJaegerBottle(g, x + 110, ty - 4, 0.8); else { emoji(g, '🎲', x + 108, ty - 10, 12); emoji(g, '🎲', x + 122, ty - 9, 11); g.fillStyle = '#4e342e'; roundRect(g, x + 132, ty - 22, 14, 18, 3); g.fill(); }
      drawAsbachGlass(g, x + 156, ty - 4, 1);
    });
    planks(g, V, off, '#4e342e', '#3e2723');
  },

  // Mainz: Markt mit Renaissance-Marktbrunnen (1526) vor dem roten Sandstein-Dom, Weinstände
  mainzMarkt(g, V, off, t) {
    const gy = V.groundY;
    sky(g, V, '#9ad1f4', '#fff6e4'); clouds(g, V, off, 0.8);
    once(V, off, 0.12, 1400, 500, (x) => domMainz(g, x, gy - 10, 1.15));
    rep(V, off, 0.3, 120, (x, k) => { const h = 110 + ((k * 23) % 30); g.fillStyle = ['#f0d9b5', '#e8c6a0', '#f4e6cf', '#dcc3a4'][((k % 4) + 4) % 4]; g.fillRect(x, gy - h, 112, h); g.fillStyle = '#7a3e2c'; g.beginPath(); g.moveTo(x - 4, gy - h); g.lineTo(x + 56, gy - h - 34); g.lineTo(x + 116, gy - h); g.fill(); g.fillStyle = '#8ab4d6'; for (let r = 0; r < 2; r++) for (let i = 0; i < 3; i++) g.fillRect(x + 14 + i * 32, gy - h + 16 + r * 36, 18, 24); });
    once(V, off, 0.4, 1000, 200, (x) => { g.fillStyle = '#b0a080'; g.fillRect(x - 30, gy - 20, 60, 20); g.fillStyle = '#8a7a5a'; g.fillRect(x - 4, gy - 90, 8, 70); g.fillStyle = '#c62828'; g.beginPath(); g.moveTo(x - 26, gy - 90); g.lineTo(x, gy - 130); g.lineTo(x + 26, gy - 90); g.fill(); g.fillStyle = '#ffd23f'; g.fillRect(x - 26, gy - 92, 52, 5); g.fillStyle = '#2e7d32'; for (const dx of [-20, 20]) g.fillRect(x + dx - 3, gy - 88, 6, 68); g.fillStyle = '#4fc3f7'; g.beginPath(); g.ellipse(x, gy - 22, 28, 4, 0, 0, TAU); g.fill(); });
    rep(V, off, 0.55, 260, (x) => { g.fillStyle = '#fafafa'; g.beginPath(); g.moveTo(x, gy - 70); g.lineTo(x + 50, gy - 92); g.lineTo(x + 100, gy - 70); g.fill(); g.fillStyle = '#795548'; g.fillRect(x + 6, gy - 70, 4, 70); g.fillRect(x + 90, gy - 70, 4, 70); g.fillRect(x, gy - 34, 100, 6); emoji(g, '🍷', x + 25, gy - 44, 14); emoji(g, '🧀', x + 50, gy - 42, 14); emoji(g, '🍷', x + 75, gy - 44, 14); });
    cobble(g, V, off, '#b7a58e', '#94826b');
  },
  // Rheinufer Mainz: Sitzstufen am Wasser mit Blick auf die Theodor-Heuss-Brücke
  rheinufer(g, V, off, t) {
    const gy = V.groundY;
    sky(g, V, '#8fcdf2', '#fff2dc'); clouds(g, V, off, 0.7);
    hillsBand(g, V, off, 0.06, 26, 500, '#8fae7a', 100);
    sea(g, V, off, t, gy - 100, '#4f7f9a', '#7fa9bf');
    once(V, off, 0.15, 1300, 400, (x) => { g.strokeStyle = '#d0c7b0'; g.lineWidth = 6; g.fillStyle = '#d0c7b0'; g.fillRect(x - 40, gy - 132, 460, 8); for (let a = 0; a < 4; a++) { g.beginPath(); g.moveTo(x + a * 110 - 40, gy - 100); g.quadraticCurveTo(x + a * 110 + 15, gy - 136, x + a * 110 + 70, gy - 100); g.stroke(); } });
    rep(V, off, 0.6, 60, (x) => { for (let s = 0; s < 3; s++) { g.fillStyle = ['#cfc6b4', '#bdb39f', '#aaa08b'][s]; g.fillRect(x, gy - 34 + s * 12, 60, 12); } });
    rep(V, off, 0.6, 340, (x) => { emoji(g, '🍷', x + 40, gy - 42, 14); emoji(g, '🧀', x + 62, gy - 40, 14); emoji(g, '🥖', x + 90, gy - 40, 14); });
    floor(g, V, '#9e9686', '#857d6e', off);
  },

  // Blütenfest: Feld mit rot-weiß gestreiftem Zelt, Bierbänken, großen grünen Sonnenschirmen zwischen jungen Apfelbäumen,
  // Äppler-Körbchen und Strohballen
  bluetenfest(g, V, off, t) {
    const gy = V.groundY;
    sky(g, V, '#86c9f2', '#f2fbff'); clouds(g, V, off);
    hillsBand(g, V, off, 0.08, 18, 500, '#b5d88a', 40);
    // Feld
    g.fillStyle = '#a8cf6a'; g.fillRect(0, gy - 70, V.w, 70);
    g.strokeStyle = 'rgba(80,120,40,0.35)'; g.lineWidth = 1; for (let r = 0; r < 6; r++) { g.beginPath(); g.moveTo(0, gy - 66 + r * 11); g.lineTo(V.w, gy - 66 + r * 11); g.stroke(); }
    // rot-weiß gestreiftes Festzelt (rechteckiges Partyzelt mit Satteldach, von der Längsseite)
    once(V, off, 0.2, 1100, 450, (x) => {
      const w = 360, h = 70, top = gy - 70 - h, ridge = top - 34;
      // Abspannseile & Heringe
      g.strokeStyle = 'rgba(90,70,50,0.6)'; g.lineWidth = 1; for (const [sx, ex] of [[x, x - 30], [x + w, x + w + 30]]) { g.beginPath(); g.moveTo(sx, top + 4); g.lineTo(ex, gy - 70); g.stroke(); }
      // Dach: Trapez mit senkrechten Bahnen
      g.save(); g.beginPath(); g.moveTo(x - 10, top); g.lineTo(x + 30, ridge); g.lineTo(x + w - 30, ridge); g.lineTo(x + w + 10, top); g.closePath(); g.clip();
      for (let i = -1; i < 19; i++) { g.fillStyle = i % 2 ? '#fff' : '#d32f2f'; g.fillRect(x - 10 + i * 20.5, ridge, 20.5, top - ridge + 2); }
      g.fillStyle = 'rgba(0,0,0,0.08)'; g.fillRect(x - 10, top - 8, w + 20, 8);
      g.restore();
      g.strokeStyle = '#b71c1c'; g.lineWidth = 2; g.beginPath(); g.moveTo(x + 30, ridge); g.lineTo(x + w - 30, ridge); g.stroke();
      // Wände: senkrechte Streifen
      for (let i = 0; i < 18; i++) { g.fillStyle = i % 2 ? '#fff' : '#d32f2f'; g.fillRect(x + i * 20, top, 20, h); }
      // gezackte Bordüre
      for (let i = 0; i < 18; i++) { g.fillStyle = i % 2 ? '#d32f2f' : '#fff'; g.beginPath(); g.moveTo(x + i * 20, top); g.lineTo(x + i * 20 + 20, top); g.lineTo(x + i * 20 + 10, top + 9); g.fill(); }
      // offener Eingang mit gerafften Seitenteilen, Pfosten
      g.fillStyle = 'rgba(60,25,15,0.6)'; g.fillRect(x + 140, top + 12, 80, h - 12);
      g.fillStyle = '#fff'; g.beginPath(); g.moveTo(x + 140, top + 10); g.quadraticCurveTo(x + 150, top + 40, x + 142, gy - 70); g.lineTo(x + 140, gy - 70); g.fill(); g.beginPath(); g.moveTo(x + 220, top + 10); g.quadraticCurveTo(x + 210, top + 40, x + 218, gy - 70); g.lineTo(x + 220, gy - 70); g.fill();
      g.fillStyle = '#9e9e9e'; for (const px of [x, x + w - 3]) g.fillRect(px, top, 3, h);
      // Wimpel am First
      for (let i = 0; i < 12; i++) { g.fillStyle = ['#ffd23f', '#3ee6b4', '#ff4fa3', '#7cc6ff'][i % 4]; const fx = x + 36 + i * 25; g.beginPath(); g.moveTo(fx, ridge - 1); g.lineTo(fx + 12, ridge - 1); g.lineTo(fx + 6, ridge - 10 + Math.sin(t * 4 + i) * 1.5); g.fill(); }
    });
    // junge Apfelbäume mit Blüten + große grüne Sonnenschirme + Bierbänke
    rep(V, off, 0.42, 230, (x, k) => {
      g.fillStyle = '#7a5a3a'; g.fillRect(x + 28, gy - 74, 5, 50); g.strokeStyle = '#7a5a3a'; g.lineWidth = 2; g.beginPath(); g.moveTo(x + 30, gy - 60); g.lineTo(x + 18, gy - 72); g.moveTo(x + 31, gy - 64); g.lineTo(x + 44, gy - 76); g.stroke();
      for (const [dx, dy, r] of [[30, 88, 16], [18, 78, 11], [43, 79, 11]]) { g.fillStyle = '#7cb342'; g.beginPath(); g.arc(x + dx, gy - dy, r, 0, TAU); g.fill(); }
      for (let i = 0; i < 9; i++) { g.fillStyle = i % 3 ? '#fde4ec' : '#f8bbd0'; g.beginPath(); g.arc(x + 16 + (i * 7) % 30, gy - 96 + ((i * 11) % 24), 2.4, 0, TAU); g.fill(); }
      const ux = x + 130; g.fillStyle = '#9e9e9e'; g.fillRect(ux - 2, gy - 96, 4, 96); g.fillStyle = '#2e7d32'; g.beginPath(); g.moveTo(ux - 62, gy - 90); g.quadraticCurveTo(ux, gy - 128, ux + 62, gy - 90); g.closePath(); g.fill();
      g.fillStyle = '#1b5e20'; for (let i = 0; i < 6; i++) { g.beginPath(); g.moveTo(ux - 62 + i * 20.6, gy - 90); g.quadraticCurveTo(ux - 52 + i * 20.6, gy - 84, ux - 41 + i * 20.6, gy - 90); g.fill(); }
      g.fillStyle = '#a1887f'; g.fillRect(ux - 50, gy - 34, 100, 6); g.fillRect(ux - 44, gy - 28, 4, 28); g.fillRect(ux + 40, gy - 28, 4, 28); g.fillRect(ux - 50, gy - 14, 100, 4);
      g.fillStyle = '#8d6e63'; g.beginPath(); g.moveTo(ux - 20, gy - 34); g.lineTo(ux + 4, gy - 34); g.lineTo(ux + 1, gy - 46); g.lineTo(ux - 17, gy - 46); g.fill(); g.strokeStyle = '#6d4c41'; g.lineWidth = 2; g.beginPath(); g.arc(ux - 8, gy - 46, 8, Math.PI, 0); g.stroke();
      for (let i = 0; i < 3; i++) { g.fillStyle = 'rgba(255,255,255,0.75)'; g.fillRect(ux - 18 + i * 6, gy - 52, 4, 8); g.fillStyle = '#e6b54a'; g.fillRect(ux - 18 + i * 6, gy - 49, 4, 5); }
      if (k % 2 === 0) { g.fillStyle = '#e9c46a'; roundRect(g, x + 200, gy - 26, 34, 24, 5); g.fill(); g.strokeStyle = '#c9a227'; g.lineWidth = 1; for (let i = 4; i < 34; i += 5) { g.beginPath(); g.moveTo(x + 200 + i, gy - 25); g.lineTo(x + 199 + i, gy - 3); g.stroke(); } }
    });
    for (let i = 0; i < 18; i++) { g.fillStyle = 'rgba(255,220,235,0.9)'; g.beginPath(); g.arc(wrap(i * 61 - off * 0.3 + t * 20, V.w), wrap(i * 41 + t * 18, gy), 2, 0, TAU); g.fill(); }
    grass(g, V, off, '#8bc34a', '#689f38');
  },

  // Line Dance: Saloon in der Wüste mit Kakteen und Tafelbergen
  western(g, V, off, t) {
    const gy = V.groundY;
    sky(g, V, '#ff9f5a', '#ffe3b0');
    g.fillStyle = '#c0582f'; rep(V, off, 0.1, 500, (x) => { g.beginPath(); g.moveTo(x, gy - 40); g.lineTo(x + 30, gy - 130); g.lineTo(x + 140, gy - 130); g.lineTo(x + 170, gy - 40); g.fill(); });
    rep(V, off, 0.3, 380, (x) => { g.fillStyle = '#8d5a33'; g.fillRect(x, gy - 140, 220, 140); g.fillStyle = '#6d4022'; g.fillRect(x - 10, gy - 150, 240, 14); g.fillRect(x, gy - 80, 220, 6); g.fillStyle = '#ffd58a'; for (let i = 0; i < 4; i++) g.fillRect(x + 14 + i * 52, gy - 130, 30, 36); g.fillStyle = '#3e2412'; g.fillRect(x + 90, gy - 64, 40, 64); g.fillStyle = '#b08850'; g.fillRect(x + 92, gy - 50, 17, 30); g.fillRect(x + 111, gy - 50, 17, 30); sign(g, 'SALOON', x + 110, gy - 156, { bg: '#3e2412', fg: '#ffd23f', size: 14 }); });
    stringLights(g, V, off, 0.3, gy - 200, t, 220, 10, ['#fff59d', '#ffcc80']);
    rep(V, off, 0.55, 260, (x) => emoji(g, '🌵', x + 30, gy - 30, 54));
    floor(g, V, '#d9a066', '#b97a42', off);
  },

  // Edinburgh: Burg auf dem Castle Rock, Häuser der Royal Mile, Nieselregen
  edinburgh(g, V, off, t) {
    const gy = V.groundY;
    sky(g, V, '#8a9aaa', '#d7dee5'); clouds(g, V, off, 0.8, true);
    once(V, off, 0.1, 1500, 500, (x) => { g.fillStyle = '#5c5a55'; g.beginPath(); g.moveTo(x - 120, gy - 40); g.lineTo(x - 60, gy - 140); g.lineTo(x + 180, gy - 150); g.lineTo(x + 240, gy - 40); g.fill(); g.fillStyle = '#7a756c'; g.fillRect(x - 40, gy - 210, 200, 70); for (let i = 0; i < 10; i++) g.fillRect(x - 40 + i * 20, gy - 218, 12, 8); g.fillRect(x + 20, gy - 250, 40, 40); for (let i = 0; i < 3; i++) g.fillRect(x + 20 + i * 15, gy - 258, 10, 8); g.fillStyle = '#3e3b36'; for (let i = 0; i < 6; i++) g.fillRect(x - 25 + i * 32, gy - 196, 8, 16); g.strokeStyle = '#444'; g.lineWidth = 1.5; g.beginPath(); g.moveTo(x + 40, gy - 250); g.lineTo(x + 40, gy - 285); g.stroke(); g.fillStyle = '#1e5aa8'; g.fillRect(x + 40, gy - 285, 22, 14); g.strokeStyle = '#fff'; g.lineWidth = 2; g.beginPath(); g.moveTo(x + 40, gy - 285); g.lineTo(x + 62, gy - 271); g.moveTo(x + 62, gy - 285); g.lineTo(x + 40, gy - 271); g.stroke(); });
    rep(V, off, 0.3, 100, (x, k) => { const h = 82 + ((k * 29) % 30 + 30) % 30; g.fillStyle = ['#8a8172', '#9a9080', '#7d7466'][((k % 3) + 3) % 3]; g.fillRect(x, gy - h, 94, h); g.fillStyle = '#4a4540'; g.beginPath(); g.moveTo(x, gy - h); g.lineTo(x + 47, gy - h - 30); g.lineTo(x + 94, gy - h); g.fill(); g.fillRect(x + 70, gy - h - 28, 10, 20); g.fillStyle = '#f4e3b0'; for (let r = 0; r < 4; r++) for (let i = 0; i < 3; i++) g.fillRect(x + 12 + i * 28, gy - h + 12 + r * 30, 12, 18); });
    rep(V, off, 0.5, 420, (x) => { g.fillStyle = '#1b3a2a'; g.fillRect(x, gy - 70, 120, 70); g.fillStyle = '#ffd58a'; g.fillRect(x + 10, gy - 60, 40, 30); sign(g, 'PUB', x + 85, gy - 52, { bg: '#5d1f1f', fg: '#ffd23f', size: 11 }); });
    g.strokeStyle = 'rgba(200,215,230,0.5)'; g.lineWidth = 1; for (let i = 0; i < 40; i++) { const rx = wrap(i * 37 - t * 30, V.w), ry = wrap(i * 53 + t * 260, gy); g.beginPath(); g.moveTo(rx, ry); g.lineTo(rx - 3, ry + 9); g.stroke(); }
    cobble(g, V, off, '#77736b', '#5e5a53');
  },
  // Highlands: Glencoe-Berge, Loch Lomond, Glenfinnan-Viadukt mit Dampfzug, Hochlandrinder
  highlands(g, V, off, t) {
    const gy = V.groundY;
    sky(g, V, '#9fb3c2', '#e3eaee'); clouds(g, V, off, 0.75, true);
    g.fillStyle = '#5f6b5e'; rep(V, off, 0.06, 420, (x) => { g.beginPath(); g.moveTo(x - 40, gy - 60); g.lineTo(x + 90, gy - 220); g.lineTo(x + 130, gy - 200); g.lineTo(x + 260, gy - 60); g.fill(); });
    sea(g, V, off, t, gy - 70, '#5b7484', '#86a0ae');
    once(V, off, 0.18, 1300, 300, (x) => { g.fillStyle = '#8a8478'; g.fillRect(x - 20, gy - 130, 560, 12); for (let i = 0; i < 12; i++) { g.fillStyle = '#8a8478'; g.fillRect(x + i * 44, gy - 118, 12, 118); g.fillStyle = '#e3eaee'; g.beginPath(); g.moveTo(x + 12 + i * 44, gy - 118); g.quadraticCurveTo(x + 28 + i * 44, gy - 108, x + 44 + i * 44, gy - 118); g.lineTo(x + 44 + i * 44, gy - 100); g.lineTo(x + 12 + i * 44, gy - 100); g.fill(); } const tx = x - 120 + ((t * 70) % 760); g.fillStyle = '#1b1b1b'; g.fillRect(tx, gy - 152, 46, 22); g.fillRect(tx + 30, gy - 166, 10, 14); g.fillStyle = '#7b1f1f'; for (let i = 1; i < 5; i++) g.fillRect(tx - i * 44, gy - 150, 40, 20); g.fillStyle = 'rgba(240,240,240,0.7)'; for (let i = 0; i < 5; i++) { g.beginPath(); g.arc(tx + 35 - i * 14, gy - 172 - i * 4, 7 + i * 2, 0, TAU); g.fill(); } });
    hillsBand(g, V, off, 0.35, 30, 260, '#7a8f4e', 0);
    rep(V, off, 0.5, 300, (x) => { emoji(g, '🐂', x + 60, gy - 22, 36, 0, true); emoji(g, '🐑', x + 200, gy - 14, 24); g.fillStyle = '#8e5aa8'; for (let i = 0; i < 8; i++) { g.beginPath(); g.arc(x + 120 + i * 6, gy - 6 - (i % 2) * 3, 2.5, 0, TAU); g.fill(); } });
    g.strokeStyle = 'rgba(200,215,230,0.45)'; g.lineWidth = 1; for (let i = 0; i < 30; i++) { const rx = wrap(i * 37 - t * 30, V.w), ry = wrap(i * 53 + t * 240, gy); g.beginPath(); g.moveTo(rx, ry); g.lineTo(rx - 3, ry + 9); g.stroke(); }
    grass(g, V, off, '#6f8f45', '#55733a', false);
  },

  // Geheimes Level: grün, qualmig, Lavalampen
  haze(g, V, off, t) {
    const gy = V.groundY;
    sky(g, V, '#0f3d1e', '#3f8f3a');
    rep(V, off, 0.35, 260, (x) => { for (let i = 0; i < 2; i++) { const lx = x + 60 + i * 110; g.fillStyle = '#555'; g.beginPath(); g.moveTo(lx - 12, gy - 20); g.lineTo(lx + 12, gy - 20); g.lineTo(lx + 8, gy - 80); g.lineTo(lx - 8, gy - 80); g.fill(); g.fillStyle = ['rgba(255,90,160,0.85)', 'rgba(255,200,60,0.85)'][i]; for (let b = 0; b < 3; b++) { g.beginPath(); g.ellipse(lx, gy - 30 - ((t * 10 + b * 17) % 46), 4 + b, 6 + b, 0, 0, TAU); g.fill(); } } emoji(g, '🍟', x + 220, gy - 60, 22); });
    for (let i = 0; i < 22; i++) drawWeedLeaf(g, wrap(i * 59 - off * 0.2 + Math.sin(t + i) * 20, V.w), wrap(i * 37 - t * 15, gy), 16 + (i % 3) * 6, t + i, i % 2 ? '#2e7d32' : '#43a047');
    g.fillStyle = 'rgba(220,255,220,0.18)'; for (let i = 0; i < 10; i++) { g.beginPath(); g.arc(wrap(i * 97 - off * 0.1 + t * 12, V.w + 100) - 50, gy * 0.3 + Math.sin(t * 0.7 + i) * 40 + (i % 3) * 40, 50 + (i % 4) * 14, 0, TAU); g.fill(); }
    floor(g, V, '#2e5e2a', '#4caf50', off);
  },
};
function drawStepper(g, x, y) { g.fillStyle = '#e57373'; g.beginPath(); g.arc(x + 4, y - 30, 5, 0, TAU); g.fill(); g.fillRect(x - 1, y - 25, 10, 18); }
// Mainzer Dom: roter Sandstein, Westturm mit gestuftem Turmhelm, Vierungsturm
function domMainz(g, x, gy, s) {
  g.save(); g.translate(x, gy); g.scale(s, s);
  const c = '#a6493a', c2 = '#8f3b2f';
  g.fillStyle = c; g.fillRect(0, -120, 240, 120);
  g.fillStyle = c2; g.fillRect(40, -200, 50, 80); g.fillRect(48, -240, 34, 40); g.beginPath(); g.moveTo(44, -240); g.lineTo(65, -275); g.lineTo(86, -240); g.fill();
  g.fillStyle = '#4a6a5a'; g.beginPath(); g.moveTo(52, -275); g.lineTo(65, -300); g.lineTo(78, -275); g.fill();
  g.fillStyle = c2; g.fillRect(150, -180, 40, 60); g.beginPath(); g.moveTo(146, -180); g.lineTo(170, -215); g.lineTo(194, -180); g.fill();
  g.fillStyle = '#4a6a5a'; g.beginPath(); g.moveTo(160, -215); g.lineTo(170, -232); g.lineTo(180, -215); g.fill();
  g.fillStyle = 'rgba(40,20,10,0.4)'; for (let i = 0; i < 7; i++) { g.beginPath(); g.moveTo(10 + i * 32, -20); g.lineTo(10 + i * 32, -70); g.arc(20 + i * 32, -70, 10, Math.PI, 0); g.lineTo(30 + i * 32, -20); g.fill(); }
  g.restore();
}

/** Zeichnet die Szene; liefert true, wenn bekannt. */
export function drawScene(g, V, id, off, t, lv) {
  if (SCENES[id]) { SCENES[id](g, V, off, t, lv); return true; }
  return drawAnyBiomeBg(g, V, id, off, t);
}

// ---------------------------------------------------------------------------
// Super-Christoph-Kostüme je Level
// ---------------------------------------------------------------------------
function hatSanta(g, x, y, c = '#d62839') { g.fillStyle = c; g.beginPath(); g.moveTo(x - 11, y); g.quadraticCurveTo(x + 2, y - 26, x + 16, y - 12); g.lineTo(x + 11, y); g.fill(); g.fillStyle = '#fff'; roundRect(g, x - 13, y - 3, 26, 6, 3); g.fill(); g.beginPath(); g.arc(x + 16, y - 12, 4, 0, TAU); g.fill(); }
function hatChef(g, x, y) { g.fillStyle = '#fff'; g.fillRect(x - 9, y - 10, 18, 10); g.beginPath(); g.arc(x - 6, y - 14, 7, 0, TAU); g.arc(x + 6, y - 14, 7, 0, TAU); g.arc(x, y - 18, 8, 0, TAU); g.fill(); }
function hatCowboy(g, x, y) { g.fillStyle = '#8d5a33'; g.beginPath(); g.ellipse(x, y, 20, 4, 0, 0, TAU); g.fill(); roundRect(g, x - 10, y - 14, 20, 14, 5); g.fill(); g.fillStyle = '#5d3a1f'; g.fillRect(x - 10, y - 5, 20, 3); }
function halo(g, x, y, t) { g.strokeStyle = '#ffd23f'; g.lineWidth = 2.5; g.shadowColor = '#ffd23f'; g.shadowBlur = 10; g.beginPath(); g.ellipse(x, y - 6 + Math.sin(t * 3), 12, 3.5, 0, 0, TAU); g.stroke(); g.shadowBlur = 0; }
function flamingoHead(g, x, y, t) { // Flamingohals wächst aus dem Kopf nach oben, Gesicht bleibt frei
  g.strokeStyle = '#ff8fb1'; g.lineWidth = 5; g.lineCap = 'round'; g.beginPath(); g.moveTo(x + 4, y + 2); g.bezierCurveTo(x + 18, y - 10, x - 8, y - 20, x + 6, y - 34 + Math.sin((t || 0) * 4) * 2); g.stroke();
  g.fillStyle = '#ff8fb1'; g.beginPath(); g.arc(x + 7, y - 35, 6, 0, TAU); g.fill();
  g.fillStyle = '#fff3e0'; g.beginPath(); g.moveTo(x + 11, y - 37); g.lineTo(x + 20, y - 33); g.lineTo(x + 12, y - 31); g.fill();
  g.fillStyle = '#111'; g.beginPath(); g.moveTo(x + 17, y - 34.5); g.lineTo(x + 21, y - 31); g.lineTo(x + 16, y - 31.5); g.fill(); g.beginPath(); g.arc(x + 8, y - 37, 1.2, 0, TAU); g.fill();
}
function catEars(g, x, y) { g.fillStyle = '#e8843a'; for (const s of [-1, 1]) { g.beginPath(); g.moveTo(x + s * 4, y + 2); g.lineTo(x + s * 13, y - 12); g.lineTo(x + s * 14, y + 4); g.fill(); } }
export const COSTUMES = {
  classic: {},
  kid: { suit: '#e76f51', suit2: '#c4553a', cape: '#c8a26a', trunk: '#264653', belt: '#e9c46a', held: '🧃' },
  schooltuete: { suit: '#2a9d8f', suit2: '#1f7a6f', cape: '#f4a261', held: '🎒' },
  fan: { suit: '#e85d9b', suit2: '#b8447a', cape: '#ffd23f', trunk: '#e85d9b', belt: '#fff', emblem: '♥', held: '🩹' },
  knight: { suit: '#9aa3ad', suit2: '#7a838d', cape: '#b71c1c', trunk: '#555', belt: '#c9a227', held: '🗡️' },
  banker: { suit: '#2b2d42', suit2: '#1b1c2e', cape: '#2a9d8f', trunk: '#2b2d42', belt: '#ffd23f', emblem: '€', hat: '🎩', held: '💼' },
  racer: { suit: '#fafafa', suit2: '#d6d6d6', cape: '#e53935', trunk: '#e53935', held: '🏁' },
  barkeeper: { suit: '#212121', suit2: '#111', cape: '#7b1fa2', trunk: '#212121', belt: '#fff', held: '🍸' },
  catears: { cape: '#e8843a', draw: catEars, held: '🐟' },
  tutor: { suit: '#5d4037', suit2: '#4e342e', cape: '#1565c0', hat: '🎓', held: '📚' },
  graduate: { suit: '#111', suit2: '#000', cape: '#111', hat: '🎓', held: '🍾' },
  angel: { suit: '#f5f5f5', suit2: '#dcdcdc', cape: '#fffde7', trunk: '#f5f5f5', belt: '#ffd23f', emblem: '✝', drawTop: halo, wings: 1, held: '⚖️' },
  zombie: {},
  raver: { suit: '#ff2d95', suit2: '#c41f73', cape: '#39ff14', trunk: '#111', belt: '#39ff14', face: '🕶️' },
  santa: { suit: '#d62839', suit2: '#a81f2d', cape: '#d62839', trunk: '#d62839', belt: '#111', draw: (g, x, y) => hatSanta(g, x, y), held: '🎁' },
  lederhosen: { suit: '#fafafa', suit2: '#ddd', cape: '#1565c0', trunk: '#6d4c41', belt: '#6d4c41', held: '🍺' },
  baywatch: { skin: 1, trunk: '#e53935', belt: '#e53935', noCape: 1, abs: 1, held: '🛟' },
  prince: { suit: '#fafafa', suit2: '#ddd', cape: '#d62839', trunk: '#d62839', belt: '#ffd23f', hat: '👑', held: '🍬' },
  joker: { suit: '#6a1b9a', suit2: '#4a148c', cape: '#2e7d32', trunk: '#6a1b9a', held: '🃏' },
  dj: { suit: '#263238', suit2: '#1c262b', cape: '#ff4fa3', trunk: '#263238', belt: '#3ee6b4', hat: '🎧', held: '🎚️' },
  tarzan: { skin: 1, trunk: '#c68a2e', belt: '#8d5a33', noCape: 1, held: '🍌' },
  winter: { suit: '#1d3557', suit2: '#14253d', cape: '#c1121f', trunk: '#1d3557', belt: '#c1121f', emblem: '❄', held: '☕' },
  crier: { suit: '#2e7d32', suit2: '#1b5e20', cape: '#fdd835', held: '📣' },
  grill: { suit: '#fafafa', suit2: '#ddd', cape: '#e53935', trunk: '#222', draw: hatChef, held: '🍖' },
  glitter: { suit: '#e9c46a', suit2: '#c9a24a', cape: '#ff4fa3', trunk: '#ff4fa3', belt: '#fff', sparkle: 1, held: '✨' },
  business: { suit: '#546e7a', suit2: '#37474f', cape: '#c62828', trunk: '#37474f', belt: '#111', held: '💼' },
  groom: { suit: '#111', suit2: '#000', cape: '#111', trunk: '#111', belt: '#fff', emblem: '💍', held: '💐' },
  waiter: { suit: '#111', suit2: '#000', cape: '#fafafa', trunk: '#111', belt: '#fff', held: '🍽️' },
  kerb: { suit: '#1565c0', suit2: '#0d47a1', cape: '#fafafa', trunk: '#1565c0', belt: '#ffd23f', held: '🏳️' },
  flamingo: { suit: '#ff8fb1', suit2: '#f06292', cape: '#ff8fb1', trunk: '#f06292', belt: '#fff', wings: 1, wingCol: 'rgba(255,170,200,0.95)', draw: flamingoHead, held: '🍻' },
  stars: { suit: '#1e3a8a', suit2: '#162d6b', cape: '#b22234', trunk: '#b22234', belt: '#fff', emblem: '★', draw: hatCowboy, held: '🗽' },
  pirate: { suit: '#fafafa', suit2: '#d6d6d6', cape: '#111', trunk: '#111', belt: '#c9a227', hat: '🏴‍☠️', held: '🗡️' },
  winzer: { suit: '#6b8e23', suit2: '#556b1f', cape: '#7b1f3a', trunk: '#556b1f', held: '🍷' },
  flowers: { suit: '#81c784', suit2: '#66bb6a', cape: '#f48fb1', drawTop: (g, x, y) => { for (let i = -2; i <= 2; i++) emoji(g, '🌸', x + i * 6, y - 4 - Math.abs(i), 9); }, held: '💐' },
  elf: { suit: '#2e7d32', suit2: '#1b5e20', cape: '#d62839', trunk: '#2e7d32', belt: '#ffd23f', draw: (g, x, y) => hatSanta(g, x, y, '#2e7d32'), held: '🎁' },
  cowboy: { suit: '#8d5a33', suit2: '#6d4022', cape: '#c62828', trunk: '#3e2412', belt: '#c9a227', draw: hatCowboy, held: '🔫' },
  chef: { suit: '#fafafa', suit2: '#ddd', cape: '#43a047', trunk: '#222', draw: hatChef, held: '🍴' },
  kilt: { suit: '#1b5e20', suit2: '#124116', cape: '#0d47a1', trunk: '#c62828', tartan: 1, belt: '#111', held: '🥃' },
  tux: { suit: '#111', suit2: '#000', cape: '#d62839', trunk: '#111', belt: '#fff', emblem: '34', held: '🎂' },
  hippie: { suit: '#ab47bc', suit2: '#8e24aa', cape: '#ffb300', trunk: '#43a047', belt: '#ff7043', rainbow: 1, hat: '☮️', held: '🌿' },
};

// ---------------------------------------------------------------------------
// Level-Definitionen (Spielmechanik). Reihenfolge & Texte: config.levels
// ---------------------------------------------------------------------------
export const LEVELS = {
  L1: { icon: '👵', scene: 'omaRoom', music: 'augustin', len: 60, obstacles: { wool: 3, teapot: 2, slipper: 3, couch: 1, griess: 2 }, items: ['cookie', 'milchschnitte'], quest: { item: 'milchschnitte', n: 12 }, hero: 'classic', speed: 0.92 },
  L2: { icon: '🛝', scene: 'kidStreet', music: 'entchen', len: 60, obstacles: { bobbycar: 3, football: 3, bucket: 2 }, items: ['brause', 'wassereis'], quest: { item: 'wassereis', n: 10 }, hero: 'kid', speed: 0.92 },
  L3: { icon: '🎒', scene: 'school', music: 'haenschen', len: 75, obstacles: { schoolbag: 3, trafficlight: 2, puddle: 3 }, items: ['sweets', 'cookie'], quest: { item: 'sweets', n: 10 }, hero: 'schooltuete', speed: 0.94 },
  L4: { icon: '🛍️', scene: ['mallOut', 'mall'], music: 'elise', len: 90, obstacles: { shirtrack: 3, sale: 2, shopbag: 2, shirt: 2 }, items: ['shopbag2', 'coffee'], quest: { item: 'shopbag2', n: 8 }, hero: 'fan' },
  L5: { icon: '🎈', scene: 'garden', music: 'birthday', len: 75, obstacles: { pot: 3, balloon: 3, gift: 2 }, items: ['schokokuss', 'cake'], quest: { item: 'schokokuss', n: 12 }, hero: 'knight', garlands: 1 },
  L6: { icon: '💸', scene: 'bank', music: 'entertainer', len: 75, obstacles: { invoice: 3, piggy: 2, tax: 2, chartfly: 2 }, items: ['coin', 'money'], quest: { item: 'money', n: 20 }, hero: 'banker', goalRain: '💸' },
  L7: { icon: '🚗', scene: 'driving', music: 'tell', len: 90, obstacles: { cone: 3, blitzer: 2, bike: 2, car: 2 }, items: ['voucher'], quest: { item: 'voucher', n: 8 }, hero: 'racer' },
  L8: { icon: '🍹', scene: 'chococino', music: 'habanera', len: 90, obstacles: { barstool: 3, bottle: 2, trays: 2 }, items: ['bluelagoon', 'bluelagoon', 'cocktail', 'cupid'], quest: { item: 'cupid', n: 10 }, hero: 'barkeeper', goalHearts: 1 },
  L9: { icon: '🐱', scene: ['parentsFlat', 'eveGarden'], music: 'turca', len: 100, obstacles: { log: 3, wool: 3, tp: 2 }, obstacles2: { flowerpot: 3, wool: 2, gnome: 1 }, items: ['treat'], quest: { item: 'treat', n: 15 }, hero: 'catears', fipsBox: 1, kitten: 1 }, // Baby-Fips, Garten am Abend
  L10: { icon: '📚', scene: 'hola', music: 'mountain', len: 150, obstacles: { books: 3, alarm: 2, ice4: 3, grade6: 1 }, items: ['coffee', 'cheatnote'], quest: { survive: 1 }, hero: 'tutor', checkpoint: 1 },
  L11: { icon: '🎓', scene: 'uni', music: 'ode', len: 90, obstacles: { bench: 2, tray: 3, books: 2 }, items: ['fries2', 'coffee'], quest: { item: 'fries2', n: 10 }, hero: 'graduate' },
  L12: { icon: '⚖️', scene: 'wiesbaden', music: 'toccata', len: 105, obstacles: { folders: 2, barstool: 2, paragraph: 3, facewalk: 1 }, items: ['redbull', 'koelsch', 'akte'], quest: { item: 'akte', n: 8 }, hero: 'angel' },
  L13: { icon: '👻', scene: 'horror', music: 'horror', len: 90, horror: 1, obstacles: { shirt: 2, flyshirt: 3, ghost: 2, stink: 3, rille: 2, fish: 2, merz: 2 }, items: ['candle'], bad: 0.45, quest: { survive: 1 }, hero: 'zombie' },
  L14: { icon: '🪩', scene: 'cocoon', music: 'techno', len: 105, obstacles: { speaker: 3, laser: 3, fog: 2, bouncer: 1 }, items: ['glow', 'water'], quest: { item: 'glow', n: 12 }, hero: 'raver', outfit: { top: 'glitter', topColor: 'f', bottom: 'tutu', socks: 'ringel', shoes: 'docs', extra: ['boa'] }, party: 1 }, // Kopf frei lassen, damit man sie erkennt
  L15: { icon: '🎄', scene: ['carolaXmas', 'omaXmas'], music: 'deckhalls', len: 105, obstacles: { gift: 3, snowman: 2, smalltree: 2, candlebig: 2 }, items: ['eierlikoer', 'cookie2', 'wine'], quest: { item: 'cookie2', n: 12 }, hero: 'santa' },
  L16: { icon: '🎡', scene: 'plaerrer', music: 'volksfest', len: 105, obstacles: { 'maß': 3, hayball: 2, carousel: 1, target: 2, dartboard: 2 }, items: ['brezn', 'lebherz', 'domsign'], quest: { item: 'domsign', n: 6 }, hero: 'lederhosen', party: 1, goalRain: '👶' },
  L17: { icon: '🏖️', scene: ['sicily', 'apulia'], music: 'mobile', len: 105, obstacles: { sandcastle: 2, crab: 2, gull: 3, wave: 2, vespa: 2 }, items: ['gelato', 'pizza', 'mussel', 'cocktail'], badItems: ['fig'], bad: 0.3, quest: { avoid: 'fig' }, hero: 'baywatch', figStory: 1 },
  L18: { icon: '🎭', scene: 'koeln', music: 'cancan', len: 105, obstacles: { confetti: 2, dancer: 2, clown: 2, flyball: 3 }, items: ['kamelle', 'struessjer', 'koelsch'], quest: { item: 'kamelle', n: 15 }, hero: 'flamingo', party: 1, outfit: { top: 'blazer', topColor: 'd', bottom: 'matrose', socks: 'none', shoes: 'docs', extra: ['tophat', 'sweep'] } }, // Kim als Schornsteinfegerin, Christoph als Flamingo
  L19: { icon: '🎲', scene: 'gameNight', music: 'tetris', len: 120, obstacles: { dice: 3, robber: 2, hourfly: 3 }, items: ['card'], quest: { set: ['wood', 'clay', 'woolres', 'grain', 'ore'] }, hero: 'joker' },
  L20: { icon: '⏳', scene: 'timeclash', world: 'party', music: 'retro', mp3: 'teenage', len: 150, superDrink: 'superdrink', obstacles: { speaker: 3, crate: 3, hourglass: 2, discoball: 3 }, items: ['cocktail2', 'water'], quest: { survive: 1 }, hero: 'dj', checkpoint: 1, party: 1 },
  L21: { icon: '🐒', scene: 'serengeti', world: 'zoo', music: 'safari', len: 105, obstacles: { banana: 3, fence: 2, jeep: 2, parrot: 3, zebra: 1 }, items: ['monkey'], quest: { item: 'monkey', n: 8 }, hero: 'tarzan' },
  L22: { icon: '🗽', scene: ['nyc', 'dyker'], catBoots: 1, music: 'jinglebells', len: 105, obstacles: { taxi: 2, snowpile: 3, skater: 2, hydrant: 2, smalltree: 1 }, obstacles2: { nutcracker: 3, snowman: 2, gift: 2, snowpile: 1 }, items: ['psl', 'brezel', 'candycane'], quest: { item: 'psl', n: 8 }, hero: 'winter', noFamily: 1, fireworks: 1, goalHearts: 1 },
  L23: { icon: '🥕', scene: 'hanauMarkt', world: 'market', music: 'nachtmusik', len: 105, obstacles: { fruitcrate: 3, flowers: 2, basket: 2, cheese: 2, pigeon: 3 }, items: ['apple', 'sausage'], quest: { item: 'sausage', n: 6 }, hero: 'crier' },
  L24: { icon: '🍲', scene: ['gulaschKitchen', 'bbq'], music: 'hungarian', len: 105, obstacles: { creuset: 3, pepperbox: 2, flour: 2 }, obstacles2: { smoker: 3, logs: 2, smoke: 2 }, items: ['gulasch', 'paprika'], items2: ['gulasch', 'sausage', 'steak'], quest: { item: 'gulasch', n: 10 }, hero: 'grill' },
  L25: { icon: '🍕', scene: 'pizzaGlitter', music: 'bday30', len: 120, obstacles: { pizzatower: 3, speaker: 2, bottle: 3, confetti: 2 }, items: ['pizza', 'glitter'], quest: { item: 'glitter', n: 30 }, hero: 'glitter', party: 1, glitterRush: 1, glitterGuests: 1, outfit: { top: 'glitter', topColor: 'f', bottom: 'tutu', extra: ['party'] } },
  L26: { icon: '💼', scene: 'office', world: 'office', music: 'bumblebee', len: 120, obstacles: { chair: 3, boss: 2, folders: 3, paper: 3 }, items: ['coffee', 'mimisoup'], quest: { survive: 1 }, hero: 'business' },
  L39: { icon: '🦁', scene: ['capetown', 'franschhoek', 'capebeach'], partIntro: [null, 'winebarrel', 'parade'], music: 'kapstadt', len: 130, obstacles: { minibus: 2, baboon: 2, boulder: 2 }, obstacles2: { winebarrel: 3, grapecrate: 2, baboon: 1 }, obstacles3: { parade: 2, boulder: 2, surfboard: 1, penguin: 1 }, items: ['protea', 'rooibos'], items2: ['protea', 'wine2', 'grapes'], items3: ['protea', 'wine2'], quest: { item: 'protea', n: 8 }, hero: 'baywatch', goalHearts: 1, fireworks: 1 },
  L27: { icon: '💍', scene: 'barn', music: 'punk', len: 150, obstacles: { hayball: 3, bench: 2, dancers: 2, bouquet: 3 }, items: ['ring', 'confetti2', 'weddingcake'], quest: { items: ['ring', 'confetti2'], n: 10 }, hero: 'groom', checkpoint: 1, party: 1, fireworks: 1, goalHearts: 1 },
  L28: { icon: '🧅', scene: 'inn', music: 'polka', len: 105, obstacles: { pan: 3, waiter: 2, bubble: 3, pubtable: 1 }, items: ['schnitzel', 'fries2', 'onion'], quest: { item: 'onion', n: 12 }, hero: 'waiter' },
  L29: { icon: '🎺', scene: 'kerb', music: 'kerbmarsch', len: 120, obstacles: { bembel: 3, trumpet: 2, drum: 2, bench: 2 }, items: ['gerippter', 'winktuch', 'saeftchen'], quest: { item: 'gerippter', n: 10 }, hero: 'kerb', party: 1 },
  L30: { icon: '🤠', scene: ['nycDay', 'nola', 'swamp', 'nashville'], music: 'saints', len: 130, obstacles: { taxi: 2, hydrant: 2, skater: 1 }, items: ['hotdog', 'boots'], obstacles2: { sax: 3, hydrant: 1, trumpet: 2 }, items2: ['beignet', 'boots'], obstacles3: { gator: 4, knee: 2, mosquito: 2 }, items3: ['beignet', 'boots'], obstacles4: { guitar: 3, drum: 1, hydrant: 1 }, items4: ['cowboyhat', 'boots'], partIntro: [null, null, 'gator', null], quest: { item: 'boots', n: 6 }, hero: 'stars' },
  L31: { icon: '🏴‍☠️', scene: 'pirateBar', music: 'sailor', len: 105, obstacles: { barstool: 3, slot: 2, bottle: 2, dartboard: 2 }, items: ['asbach', 'jaegi', 'cherry'], quest: { item: 'cherry', n: 3 }, hero: 'pirate', party: 1 },
  L32: { icon: '🍷', scene: ['mainzMarkt', 'rheinufer'], music: 'minuet', len: 120, obstacles: { pigeon: 3, flowerpot: 2, umbrella: 2, bike: 2 }, items: ['wine2', 'cheese2', 'weck'], quest: { items: ['wine2', 'cheese2', 'weck'], n: 10 }, hero: 'winzer' },
  L33: { icon: '🌸', scene: 'bluetenfest', music: 'spring', len: 120, obstacles: { hayball: 3, bench: 2, flowerpot: 2, carousel: 1, bembel: 2 }, items: ['blossom', 'los'], quest: { item: 'gerippter', n: 10 }, hero: 'flowers', party: 1 },
  L34: { icon: '🦃', scene: 'xmasRustler', music: 'wewish', len: 105, obstacles: { teddy: 2, toytrain: 2, gift: 2, rocking: 2, weizen: 1 }, items: ['turkey', 'cookie2', 'wine'], quest: { face: 1, n: 5 }, hero: 'elf' },
  L35: { icon: '🌵', scene: ['westernTown', 'saloon'], music: 'susanna', len: 120, obstacles: { hayball: 2, tumbleweed: 3, cactus: 2, bull: 2, facefly: 2 }, obstacles2: { barstool: 3, bottle: 2, hayball: 1, facefly: 1 }, items: ['cowboyhat', 'burger2', 'hotdog'], quest: { survive: 1 }, hero: 'cowboy', party: 1, guestBoots: 1, outfit: { shoes: 'cowboy', socks: 'none', extra: ['cowboyhat'] } }, // Westernstadt → Saloon, alle in Cowboystiefeln
  L36: { icon: '🏡', scene: ['homeKitchen', 'homeGarden'], world: 'kitchen', world2: 'garden', music: 'run', len: 150, obstacles: { mop: 3, pot: 2, flour: 2, stinklaundry: 3 }, obstacles2: { wheelbarrow: 3, flowerpot: 2, gnome: 2 }, items: ['pizza', 'wine'], quest: { survive: 1 }, hero: 'chef', checkpoint: 1 },
  L37: { icon: '🏰', scene: ['edinburgh', 'highlands'], music: 'auldlang', len: 120, obstacles: { sheep: 3, wall: 2, rain: 2, nessie: 1, leftcar: 3 }, items: ['shortbread', 'whisky'], quest: { item: 'shortbread', n: 10 }, hero: 'kilt' },
  L38: { icon: '🎂', scene: 'birthday', music: 'finaleBday', len: 150, obstacles: { wool: 1, bobbycar: 1, schoolbag: 1, shirtrack: 1, invoice: 1, cone: 1, barstool: 1, books: 1, laser: 1, gift: 1, 'maß': 1, gull: 1, dice: 1, discoball: 1, jeep: 1, taxi: 1, kettle: 1, hayball: 1, pan: 1, bembel: 1, slot: 1, cactus: 1, mop: 1, sheep: 1 }, items: ['candle'], quest: { item: 'candle', n: 34 }, hero: 'tux', checkpoint: 1, party: 1, finale: 1 },
  G: { icon: '🌿', scene: 'haze', music: 'cucaracha', len: 90, obstacles: { smoke: 2, weedleaf: 3, lava: 2, couchG: 1 }, items: ['snack', 'donut', 'fries2'], quest: { item: 'snack', n: 15 }, hero: 'hippie', lowGrav: 1, trip: 1, secret: 1 },
};
// Siedler-Rohstoffe als Items
for (const k of ['wood', 'clay', 'woolres', 'grain', 'ore']) LEVELS.L19.items.push(k);

export const PHASE_ICONS = { Kindheit: '🧸', Schulzeit: '🎒', Jugend: '🛵', Zwanziger: '🎉', Paar: '💑', Heute: '🏡', Extra: '⭐', Finale: '🎂', Geheim: '🌿' };
