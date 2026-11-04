// Level-Modus: Szenen (Hintergründe nach echten Orten), Emoji-Hindernisse, Items, Level-Definitionen.
// Namen, Texte und Gäste stehen NICHT hier, sondern verschlüsselt in der privaten Config (config.levels).
import { roundRect } from './character.js';
import { OBS, ITEM_ICONS, drawAnyBiomeBg, drawMonkey } from './biomes.js';
import { drawFaceOn } from './character.js';
import { emoji } from './emoji.js';
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
  pizzatower: ['', 34, { draw: 'pizzatower' }], griess: ['', 34, { draw: 'griess' }], weedleaf: ['', 32, { fly: 1, draw: 'weedleaf' }], lava: ['', 30, { draw: 'lava' }], couchG: ['🛋️', 40],
};
const CUSTOM = {
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
      if (op.draw === 'puddle') { o.rects[0] = { x: 6, w: size - 12, y0: 0, y1: 6 }; }
      if (op.draw === 'facewalk') { o.rects[0] = { x: 4, w: 24, y0: 0, y1: 62 }; }
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
  hotdog: '🌭', beignet: '🍩', cowboyhat: '🤠', boots: '👢', asbach: '🥃', cherry: '🍒', weck: '🥖', cheese2: '🧀', blossom: '🌸', los: '🎟️', blackring: 'draw',
  turkey: '🍗', shortbread: '🍪', whisky: '🥃', snack: '🍿', domsign: 'draw', burger2: '🍔', donut: '🍩', apple: '🍎', fries2: '🍟', wine2: '🍷', cocktail2: '🍸',
};
const ITEM_DRAW = {
  schokokuss(g) { g.fillStyle = '#e9d8b8'; g.beginPath(); g.ellipse(0, 7, 11, 3, 0, 0, TAU); g.fill(); g.fillStyle = '#4a2a17'; g.beginPath(); g.ellipse(0, 6, 10, 15, 0, Math.PI, 0); g.fill(); g.fillStyle = 'rgba(255,255,255,0.35)'; g.beginPath(); g.ellipse(-4, -3, 2, 5, 0.3, 0, TAU); g.fill(); },
  glow(g, t) { g.save(); g.rotate(Math.sin(t * 3) * 0.6); const c = ['#3eff8b', '#ff4fd8', '#4fd2ff'][Math.floor(t) % 3]; g.shadowColor = c; g.shadowBlur = 14; g.fillStyle = c; roundRect(g, -2.5, -12, 5, 24, 2.5); g.fill(); g.restore(); },
  psl(g) { emoji(g, '☕', 0, 0, 24); emoji(g, '🎃', 8, -8, 12); },
  gerippter(g) { g.fillStyle = 'rgba(255,255,255,0.55)'; g.beginPath(); g.moveTo(-8, -12); g.lineTo(8, -12); g.lineTo(6, 12); g.lineTo(-6, 12); g.closePath(); g.fill(); g.fillStyle = '#e6b54a'; g.beginPath(); g.moveTo(-7.5, -6); g.lineTo(7.5, -6); g.lineTo(6, 11); g.lineTo(-6, 11); g.fill(); g.strokeStyle = 'rgba(255,255,255,0.8)'; g.lineWidth = 0.8; for (let i = -6; i <= 6; i += 2) { g.beginPath(); g.moveTo(i - 1, -11); g.lineTo(i, 11); g.stroke(); } },
  blackring(g, t) { const gl = g.createRadialGradient(0, 0, 2, 0, 0, 22); gl.addColorStop(0, 'rgba(255,240,150,0.8)'); gl.addColorStop(1, 'rgba(255,240,150,0)'); g.fillStyle = gl; g.beginPath(); g.arc(0, 0, 22, 0, TAU); g.fill(); g.strokeStyle = '#111'; g.lineWidth = 4; g.beginPath(); g.ellipse(0, 0, 9, 9 * Math.abs(Math.cos(t * 2)) + 2, 0, 0, TAU); g.stroke(); g.strokeStyle = 'rgba(255,255,255,0.5)'; g.lineWidth = 1; g.stroke(); },
  saeftchen(g, t) { const c = ['#ff4fa3', '#3ee6b4', '#ffd23f', '#b388ff'][Math.floor(t) % 4]; g.fillStyle = 'rgba(255,255,255,0.65)'; g.beginPath(); g.moveTo(-6, -9); g.lineTo(6, -9); g.lineTo(5, 9); g.lineTo(-5, 9); g.closePath(); g.fill(); g.fillStyle = c; g.beginPath(); g.moveTo(-5.5, -3); g.lineTo(5.5, -3); g.lineTo(4.6, 8); g.lineTo(-4.6, 8); g.fill(); g.fillStyle = 'rgba(255,255,255,0.7)'; g.fillRect(-4, -2, 2, 8); },
  eierlikoer(g) { g.fillStyle = 'rgba(255,255,255,0.6)'; g.beginPath(); g.moveTo(-7, -11); g.lineTo(7, -11); g.lineTo(4, 3); g.lineTo(-4, 3); g.closePath(); g.fill(); g.fillStyle = '#f6d64a'; g.beginPath(); g.moveTo(-6, -6); g.lineTo(6, -6); g.lineTo(4, 2); g.lineTo(-4, 2); g.fill(); g.fillStyle = '#fff6b0'; g.beginPath(); g.ellipse(0, -6, 6, 1.6, 0, 0, TAU); g.fill(); g.fillStyle = 'rgba(255,255,255,0.8)'; g.fillRect(-1, 3, 2, 6); g.fillRect(-5, 9, 10, 2); emoji(g, '🥚', 9, -9, 9); },
  domsign(g) { g.fillStyle = '#8d6e63'; g.fillRect(-1.5, -4, 3, 16); g.fillStyle = '#1565c0'; g.beginPath(); g.moveTo(-12, -13); g.lineTo(8, -13); g.lineTo(13, -8); g.lineTo(8, -3); g.lineTo(-12, -3); g.closePath(); g.fill(); g.fillStyle = '#fff'; g.font = '900 6px sans-serif'; g.textAlign = 'center'; g.fillText('DOM →', -1, -6); },
};
for (const [k, ch] of Object.entries(ITEM_EMO)) {
  if (ITEM_ICONS[k]) continue;
  ITEM_ICONS[k] = ch === 'draw' ? ITEM_DRAW[k] : (g, t) => emoji(g, ch, 0, 0, 24, Math.sin(t * 3) * 0.08);
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

  // Einkaufen in der Stadt: Ladenzeile mit großen Schaufenstern, oben eine Galerie mit weiteren Läden
  mall(g, V, off, t, lv) {
    const gy = V.groundY;
    sky(g, V, '#f3f6fa', '#e6ebf2');
    // Glasdach
    g.strokeStyle = 'rgba(140,170,200,0.45)'; g.lineWidth = 2; rep(V, off, 0.12, 70, (x) => { g.beginPath(); g.moveTo(x, 0); g.lineTo(x + 35, 34); g.lineTo(x + 70, 0); g.stroke(); });
    g.fillStyle = '#cfd8e2'; g.fillRect(0, 34, V.w, 5);
    // obere Galerie (klein, hinten)
    const up = [['#7b1fa2', 'BEAUTY', ['💄', '🧴', '💅']], ['#00897b', 'BÜCHER', ['📚', '📖', '📕']], ['#f57c00', 'SPIELWAREN', ['🧸', '🪀', '🎲']], ['#c62828', 'SCHMUCK', ['💍', '📿', '⌚']], ['#3949ab', 'ELEKTRO', ['📺', '📻', '🎧']]];
    const gy2 = gy - 150;
    rep(V, off, 0.32, 150, (x, k) => {
      const [c, n, it] = up[((k % 5) + 5) % 5];
      g.fillStyle = '#fafafa'; g.fillRect(x, gy2 - 70, 142, 74);
      g.fillStyle = c; g.fillRect(x + 4, gy2 - 70, 134, 14); g.fillStyle = '#fff'; g.font = '900 9px sans-serif'; g.textAlign = 'center'; g.fillText(n, x + 71, gy2 - 60);
      g.fillStyle = 'rgba(170,210,240,0.55)'; g.fillRect(x + 8, gy2 - 52, 126, 52);
      it.forEach((e, i) => emoji(g, e, x + 30 + i * 40, gy2 - 24, 18));
    });
    g.fillStyle = 'rgba(200,230,250,0.5)'; g.fillRect(0, gy2 + 4, V.w, 16); g.fillStyle = '#90a4ae'; g.fillRect(0, gy2 + 2, V.w, 3); g.fillRect(0, gy2 + 20, V.w, 6);
    rep(V, off, 0.32, 40, (x) => { g.fillStyle = '#b0bec5'; g.fillRect(x, gy2 + 4, 2, 16); });
    // Ladenzeile unten: große Schaufenster
    const shops = [
      ['#e91e63', 'MODE', 'dress'], ['#5d4037', 'SCHUHE', ['👠', '👟', '👢', '🥿']], ['#43a047', 'SPORT', ['⚽', '🏸', '🎾', '👕']], ['#6d4c41', 'CAFÉ', ['☕', '🍰', '🥐', '🧁']],
      ['#1e88e5', 'DROGERIE', ['🧴', '🧼', '🪥', '💄']], ['#8e24aa', 'SPIELZEUG', ['🧸', '🪁', '🚂', '🎈']], ['#f4511e', 'SALE %', 'dress'],
    ];
    rep(V, off, 0.55, 230, (x, k) => {
      const [c, n, it] = shops[((k % 7) + 7) % 7];
      g.fillStyle = '#eceff1'; g.fillRect(x, gy - 128, 222, 128);
      g.fillStyle = c; g.fillRect(x, gy - 128, 222, 26);
      g.fillStyle = '#fff'; g.font = '900 14px ui-rounded, system-ui, sans-serif'; g.textAlign = 'center'; g.fillText(n, x + 111, gy - 109);
      // Markise
      for (let i = 0; i < 11; i++) { g.fillStyle = i % 2 ? '#fff' : c; g.beginPath(); g.moveTo(x + i * 20, gy - 102); g.lineTo(x + i * 20 + 20, gy - 102); g.lineTo(x + i * 20 + 20, gy - 92); g.quadraticCurveTo(x + i * 20 + 10, gy - 86, x + i * 20, gy - 92); g.fill(); }
      // Schaufenster
      g.fillStyle = 'rgba(190,225,250,0.75)'; g.fillRect(x + 8, gy - 86, 140, 80); g.strokeStyle = '#90a4ae'; g.lineWidth = 3; g.strokeRect(x + 8, gy - 86, 140, 80);
      g.fillStyle = 'rgba(255,255,255,0.5)'; g.beginPath(); g.moveTo(x + 14, gy - 82); g.lineTo(x + 34, gy - 82); g.lineTo(x + 18, gy - 30); g.lineTo(x + 12, gy - 30); g.fill();
      if (it === 'dress') {
        const cols = ['#f06292', '#3fae3a', '#ffd54f'];
        for (let i = 0; i < 3; i++) { const mx = x + 34 + i * 44; g.fillStyle = '#d7ccc8'; g.beginPath(); g.arc(mx, gy - 72, 5, 0, TAU); g.fill(); g.fillStyle = cols[i]; g.beginPath(); g.moveTo(mx - 8, gy - 66); g.lineTo(mx + 8, gy - 66); g.lineTo(mx + 14, gy - 26); g.lineTo(mx - 14, gy - 26); g.fill(); g.fillStyle = '#795548'; g.fillRect(mx - 1, gy - 26, 2, 18); g.fillRect(mx - 8, gy - 9, 16, 3); }
        if (n.startsWith('SALE')) label(g, '-50%', x + 120, gy - 74, 10);
      } else it.forEach((e, i) => { emoji(g, e, x + 30 + (i % 2) * 62 + (i > 1 ? 30 : 0), gy - (i > 1 ? 24 : 58), 24); });
      // Tür
      g.fillStyle = 'rgba(160,200,230,0.8)'; g.fillRect(x + 158, gy - 86, 56, 86); g.strokeStyle = '#78909c'; g.strokeRect(x + 158, gy - 86, 56, 86); g.beginPath(); g.moveTo(x + 186, gy - 86); g.lineTo(x + 186, gy); g.stroke();
      g.fillStyle = '#78909c'; g.fillRect(x + 180, gy - 46, 3, 12); g.fillRect(x + 189, gy - 46, 3, 12);
    });
    // Pflanzkübel & Bänke
    rep(V, off, 0.75, 520, (x) => { g.fillStyle = '#8d6e63'; g.fillRect(x, gy - 22, 30, 22); emoji(g, '🌿', x + 15, gy - 38, 34); g.fillStyle = '#a1887f'; g.fillRect(x + 60, gy - 20, 70, 5); g.fillRect(x + 64, gy - 15, 4, 15); g.fillRect(x + 122, gy - 15, 4, 15); });
    floor(g, V, '#e8e4dc', '#c8c2b6', off, () => { g.strokeStyle = 'rgba(0,0,0,0.06)'; rep(V, off, 1, 40, (x) => g.strokeRect(x, gy + 2, 40, 40)); });
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
    const gy = V.groundY;
    sky(g, V, '#a4d4f2', '#eef8ff'); clouds(g, V, off);
    rep(V, off, 0.25, 360, (x) => { g.fillStyle = '#e8e8e4'; g.fillRect(x, gy - 140, 340, 140); g.fillStyle = '#c0392b'; g.fillRect(x, gy - 146, 340, 8); for (let r = 0; r < 3; r++) { g.fillStyle = '#90caf9'; g.fillRect(x + 8, gy - 132 + r * 44, 324, 26); g.strokeStyle = '#fff'; g.lineWidth = 2; for (let i = 1; i < 9; i++) { g.beginPath(); g.moveTo(x + 8 + i * 36, gy - 132 + r * 44); g.lineTo(x + 8 + i * 36, gy - 106 + r * 44); g.stroke(); } } });
    once(V, off, 0.45, 1000, 350, (x) => { g.fillStyle = '#c9a27c'; g.fillRect(x, gy - 120, 90, 120); g.fillStyle = '#b08a64'; g.fillRect(x - 6, gy - 128, 102, 12); g.beginPath(); g.moveTo(x - 6, gy - 128); g.lineTo(x + 45, gy - 160); g.lineTo(x + 96, gy - 128); g.fill(); g.fillStyle = '#3e2723'; g.beginPath(); g.moveTo(x + 22, gy); g.lineTo(x + 22, gy - 70); g.arc(x + 45, gy - 70, 23, Math.PI, 0); g.lineTo(x + 68, gy); g.fill(); g.fillStyle = '#fff'; g.font = '900 9px Georgia, serif'; g.textAlign = 'center'; g.fillText(S(lv, 'year', ''), x + 45, gy - 106); sign(g, S(lv, 'school', 'SCHULE'), x + 45, gy - 170, { bg: '#c0392b', fg: '#fff', size: 12 }); });
    rep(V, off, 0.6, 240, (x) => { g.fillStyle = '#1b5e20'; g.fillRect(x, gy - 74, 90, 54); g.strokeStyle = '#8d6e63'; g.lineWidth = 4; g.strokeRect(x, gy - 74, 90, 54); g.fillStyle = 'rgba(255,255,255,0.8)'; g.font = '700 8px sans-serif'; g.textAlign = 'left'; g.fillText('a² + b² = c²', x + 8, gy - 56); g.fillText('ABI!!!', x + 8, gy - 40); });
    cobble(g, V, off, '#b0aaa0', '#8d877c');
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

  // Cocoon Club Frankfurt (3deluxe): weiße Waben-Membranwand mit Projektionen und eingelassenen „Cocoons“
  cocoon(g, V, off, t, lv) {
    const gy = V.groundY;
    sky(g, V, '#05040a', '#120a1f');
    const hue = (t * 40) % 360;
    rep(V, off, 0.3, 36, (x, k) => {
      for (let r = 0; r < 8; r++) {
        const cx = x + (r % 2) * 18, cy = 18 + r * ((gy - 40) / 8);
        g.fillStyle = `hsla(${(hue + k * 12 + r * 20) % 360},80%,${55 + Math.sin(t * 2 + k + r) * 15}%,0.85)`;
        g.beginPath(); for (let i = 0; i < 6; i++) { const a = i / 6 * TAU + Math.PI / 6; g.lineTo(cx + Math.cos(a) * 15, cy + Math.sin(a) * 15); } g.fill();
        g.strokeStyle = 'rgba(255,255,255,0.85)'; g.lineWidth = 2; g.stroke();
      }
    });
    rep(V, off, 0.35, 300, (x) => { g.fillStyle = '#f5f5f5'; g.beginPath(); g.ellipse(x + 100, gy - 110, 44, 32, 0, 0, TAU); g.fill(); g.fillStyle = `hsl(${(hue + 180) % 360},70%,45%)`; g.beginPath(); g.ellipse(x + 100, gy - 108, 34, 24, 0, 0, TAU); g.fill(); g.fillStyle = '#111'; g.beginPath(); g.arc(x + 90, gy - 112, 5, 0, TAU); g.arc(x + 110, gy - 110, 5, 0, TAU); g.fill(); });
    g.save(); g.globalCompositeOperation = 'lighter'; for (let i = 0; i < 6; i++) { const a = Math.sin(t * (1 + i * 0.3) + i) * 0.8; g.strokeStyle = ['rgba(255,40,90,0.5)', 'rgba(60,255,160,0.5)', 'rgba(90,160,255,0.5)'][i % 3]; g.lineWidth = 2; g.beginPath(); g.moveTo(V.w * (i / 5), 0); g.lineTo(V.w * (i / 5) + Math.sin(a) * gy, gy); g.stroke(); } g.restore();
    crowd(g, V, off, 0.5, t, '#000', 18, 8);
    once(V, off, 0.3, 900, 150, (x) => neon(g, S(lv, 'club', 'COCOON'), x, 30, '#fff', 20, t));
    floor(g, V, '#0b0b12', '#2a2a3a', off, () => { rep(V, off, 1, 30, (x, k) => { g.fillStyle = `hsla(${(hue + k * 40) % 360},90%,60%,0.35)`; g.fillRect(x + 1, gy + 3, 28, 6); }); });
  },

  // Weihnachten bei Carola: Wohnzimmer mit Baum, Kamin, Fenster mit Schnee
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
  koeln(g, V, off, t) {
    const gy = V.groundY;
    sky(g, V, '#88c4ec', '#eef6ff'); clouds(g, V, off);
    once(V, off, 0.1, 1500, 400, (x) => { const c = '#4a4a52'; gothicSpire(g, x, gy - 40, 34, 270, c); gothicSpire(g, x + 90, gy - 40, 34, 270, c); g.fillStyle = c; g.fillRect(x + 20, gy - 160, 90, 120); g.fillRect(x + 110, gy - 130, 140, 90); g.beginPath(); g.moveTo(x + 110, gy - 130); g.lineTo(x + 180, gy - 175); g.lineTo(x + 250, gy - 130); g.fill(); g.fillStyle = 'rgba(255,210,120,0.4)'; g.beginPath(); g.arc(x + 62, gy - 120, 18, 0, TAU); g.fill(); });
    sea(g, V, off, t, gy - 40, '#5b7d8c', '#8fb0bd');
    rep(V, off, 0.22, 600, (x) => { g.strokeStyle = '#6f8f86'; g.lineWidth = 3; for (let a = 0; a < 3; a++) { g.beginPath(); g.moveTo(x + a * 120, gy - 40); g.quadraticCurveTo(x + a * 120 + 60, gy - 110, x + a * 120 + 120, gy - 40); g.stroke(); for (let i = 1; i < 6; i++) { const u = i / 6; g.beginPath(); g.moveTo(x + a * 120 + u * 120, gy - 40); g.lineTo(x + a * 120 + u * 120, gy - 40 - 280 * u * (1 - u) * 0.85 * 0.85); g.stroke(); } } g.fillStyle = '#6f8f86'; g.fillRect(x, gy - 44, 360, 5); });
    rep(V, off, 0.55, 500, (x) => { g.fillStyle = '#e53935'; roundRect(g, x, gy - 70, 150, 46, 6); g.fill(); g.fillStyle = '#fff'; for (let i = 0; i < 5; i++) g.fillRect(x + 10 + i * 28, gy - 66, 14, 38); emoji(g, '🤡', x + 75, gy - 92, 34); g.fillStyle = '#222'; g.beginPath(); g.arc(x + 30, gy - 22, 10, 0, TAU); g.arc(x + 120, gy - 22, 10, 0, TAU); g.fill(); });
    for (let i = 0; i < 30; i++) { g.fillStyle = ['#e53935', '#fff', '#ffd23f', '#1e88e5'][i % 4]; g.fillRect(wrap(i * 41 - off * 0.3 + Math.sin(t + i) * 8, V.w), wrap(i * 29 + t * 50, gy), 3, 3); }
    crowd(g, V, off, 0.5, t, '#5a2a3a', 10, 4, -6);
    cobble(g, V, off);
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
    sign(g, S(lv, 'party', 'TIMECLASH'), V.w / 2, Math.max(28, gy - 236), { bg: '#ff4fa3', fg: '#fff', size: 16 });
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
  nyc(g, V, off, t) {
    const gy = V.groundY;
    sky(g, V, '#0d1b3d', '#3a4f8c');
    once(V, off, 0.06, 1600, 600, (x) => { g.fillStyle = '#1c2541'; g.fillRect(x, gy - 300, 40, 300); g.fillRect(x + 8, gy - 330, 24, 30); g.fillRect(x + 16, gy - 370, 8, 40); g.fillStyle = '#ffd23f'; for (let i = 0; i < 20; i++) g.fillRect(x + 5 + (i % 4) * 9, gy - 290 + Math.floor(i / 4) * 30, 4, 6); });
    rep(V, off, 0.2, 110, (x, k) => { const h = 150 + ((k * 47) % 90 + 90) % 90; g.fillStyle = '#1f2a4d'; g.fillRect(x, gy - h, 100, h); g.fillStyle = '#ffe28a'; for (let r = 0; r < h / 18; r++) for (let i = 0; i < 6; i++) if ((r * 7 + i * 3 + k) % 4) g.fillRect(x + 6 + i * 16, gy - h + 8 + r * 18, 6, 8); });
    once(V, off, 0.35, 1100, 400, (x) => { xmasTree(g, x + 100, gy - 20, 230, t); g.fillStyle = '#cfe8ff'; g.beginPath(); g.ellipse(x + 100, gy - 10, 180, 14, 0, 0, TAU); g.fill(); g.fillStyle = '#d4a017'; g.beginPath(); g.ellipse(x + 250, gy - 50, 22, 10, -0.3, 0, TAU); g.fill(); g.beginPath(); g.arc(x + 262, gy - 62, 6, 0, TAU); g.fill(); g.fillStyle = '#b07d10'; g.fillRect(x + 230, gy - 40, 44, 20); for (let i = 0; i < 4; i++) emoji(g, '⛸️', x + 30 + ((i * 60 + t * 40) % 200), gy - 16, 12); });
    stringLights(g, V, off, 0.45, 20, t, 260, 18, ['#fff', '#ffd23f']);
    snowfall(g, V, t, off);
    floor(g, V, '#dfe8f2', '#ffffff', off, () => { g.fillStyle = 'rgba(150,170,200,0.3)'; for (let i = 0; i < 20; i++) g.fillRect(wrap(i * 67 - off, V.w + 40) - 20, gy + 10 + (i % 4) * 9, 10, 2); });
  },
  nycDay(g, V, off, t) {
    const gy = V.groundY;
    sky(g, V, '#8ec8f2', '#eaf4ff'); clouds(g, V, off);
    once(V, off, 0.08, 1500, 300, (x) => { g.fillStyle = '#8a9bb0'; g.fillRect(x, gy - 280, 40, 280); g.fillRect(x + 8, gy - 310, 24, 30); g.fillRect(x + 17, gy - 350, 6, 40); g.fillStyle = '#9fb0c4'; g.fillRect(x + 200, gy - 240, 36, 240); g.beginPath(); g.moveTo(x + 200, gy - 240); g.lineTo(x + 218, gy - 300); g.lineTo(x + 236, gy - 240); g.fill(); });
    rep(V, off, 0.2, 110, (x, k) => { const h = 140 + ((k * 47) % 90 + 90) % 90; g.fillStyle = ['#b0bec5', '#a1887f', '#cfd8dc', '#90a4ae'][((k % 4) + 4) % 4]; g.fillRect(x, gy - h, 100, h); g.fillStyle = '#e3f2fd'; for (let r = 0; r < h / 18; r++) for (let i = 0; i < 6; i++) g.fillRect(x + 6 + i * 16, gy - h + 8 + r * 18, 6, 8); });
    rep(V, off, 0.5, 400, (x) => { g.fillStyle = '#fdd835'; roundRect(g, x, gy - 40, 70, 22, 6); g.fill(); roundRect(g, x + 14, gy - 54, 40, 16, 5); g.fill(); g.fillStyle = '#222'; g.fillRect(x + 4, gy - 30, 62, 3); g.beginPath(); g.arc(x + 16, gy - 18, 7, 0, TAU); g.arc(x + 54, gy - 18, 7, 0, TAU); g.fill(); g.fillStyle = '#fff'; g.font = '900 6px sans-serif'; g.textAlign = 'center'; g.fillText('TAXI', x + 34, gy - 57); });
    asphalt(g, V, off);
  },
  // New Orleans French Quarter: pastellfarbene Häuser mit schmiedeeisernen Balkonen, Jazz
  nola(g, V, off, t) {
    const gy = V.groundY;
    sky(g, V, '#ffb38a', '#ffe9c4');
    rep(V, off, 0.3, 140, (x, k) => { const c = ['#f7c6c7', '#bde0d6', '#f9e3a3', '#c9c2f0', '#a8d8f0'][((k % 5) + 5) % 5]; g.fillStyle = c; g.fillRect(x, gy - 190, 132, 190); for (const fy of [gy - 130, gy - 60]) { g.fillStyle = '#2b2b2b'; g.fillRect(x - 4, fy, 140, 4); g.strokeStyle = '#2b2b2b'; g.lineWidth = 1.2; for (let i = 0; i < 18; i++) { g.beginPath(); g.moveTo(x - 2 + i * 8, fy); g.lineTo(x - 2 + i * 8, fy - 20); g.stroke(); g.beginPath(); g.arc(x + 2 + i * 8, fy - 14, 3, 0, TAU); g.stroke(); } g.fillRect(x - 4, fy - 22, 140, 2); } g.fillStyle = '#4e6b5b'; for (let r = 0; r < 3; r++) for (let i = 0; i < 3; i++) g.fillRect(x + 14 + i * 40, gy - 180 + r * 66, 18, 36); emoji(g, '🌿', x + 20, gy - 140, 16); });
    rep(V, off, 0.55, 380, (x) => emoji(g, '🎷', x + 40, gy - 70 + Math.sin(t * 4) * 3, 28));
    neon(g, 'BOURBON ST', V.w * 0.25, 28, '#ff4fa3', 14, t, 1);
    cobble(g, V, off, '#8d8173', '#6d6357');
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
  hanauMarkt(g, V, off, t) {
    const gy = V.groundY;
    sky(g, V, '#9fd3f5', '#fff3de'); clouds(g, V, off, 0.8);
    once(V, off, 0.2, 1300, 500, (x) => {
      g.fillStyle = '#e9dcc5'; g.fillRect(x, gy - 170, 280, 170); g.fillStyle = '#b35a3c'; g.fillRect(x, gy - 170, 280, 6);
      g.fillStyle = '#7a4a3a'; g.beginPath(); g.moveTo(x - 8, gy - 170); g.lineTo(x + 30, gy - 210); g.lineTo(x + 250, gy - 210); g.lineTo(x + 288, gy - 170); g.fill();
      g.fillStyle = '#d4b890'; g.fillRect(x + 110, gy - 250, 60, 80); g.beginPath(); g.moveTo(x + 104, gy - 250); g.quadraticCurveTo(x + 140, gy - 300, x + 176, gy - 250); g.fill(); g.fillStyle = '#2e4a3a'; g.beginPath(); g.moveTo(x + 128, gy - 282); g.lineTo(x + 140, gy - 315); g.lineTo(x + 152, gy - 282); g.fill();
      g.fillStyle = '#fff'; g.beginPath(); g.arc(x + 140, gy - 225, 12, 0, TAU); g.fill(); g.strokeStyle = '#222'; g.lineWidth = 1.5; g.beginPath(); g.moveTo(x + 140, gy - 225); g.lineTo(x + 140, gy - 233); g.moveTo(x + 140, gy - 225); g.lineTo(x + 146, gy - 222); g.stroke();
      for (let r = 0; r < 2; r++) for (let i = 0; i < 7; i++) { g.fillStyle = '#b8956a'; g.fillRect(x + 14 + i * 38, gy - 156 + r * 56, 24, 40); g.fillStyle = '#8ab4d6'; g.fillRect(x + 17 + i * 38, gy - 153 + r * 56, 18, 34); }
      g.fillStyle = '#6d4c41'; g.beginPath(); g.moveTo(x + 125, gy); g.lineTo(x + 125, gy - 40); g.arc(x + 140, gy - 40, 15, Math.PI, 0); g.lineTo(x + 155, gy); g.fill();
      // Brüder-Grimm-Denkmal
      const mx = x + 140; g.fillStyle = '#b0a89a'; g.fillRect(mx - 26, gy - 70, 52, 70); g.fillRect(mx - 32, gy - 76, 64, 8); g.fillRect(mx - 34, gy - 8, 68, 8);
      g.fillStyle = '#4d6b5a'; for (const dx of [-11, 11]) { roundRect(g, mx + dx - 8, gy - 124, 16, 48, 5); g.fill(); g.beginPath(); g.arc(mx + dx, gy - 132, 8, 0, TAU); g.fill(); }
      g.fillRect(mx - 3, gy - 112, 6, 20);
    });
    rep(V, off, 0.55, 170, (x, k) => { const [c1, c2] = [['#e53935', '#fff'], ['#43a047', '#fff'], ['#1e88e5', '#fff'], ['#fb8c00', '#fff']][((k % 4) + 4) % 4]; g.fillStyle = '#795548'; g.fillRect(x + 4, gy - 62, 4, 62); g.fillRect(x + 112, gy - 62, 4, 62); for (let i = 0; i < 8; i++) { g.fillStyle = i % 2 ? c2 : c1; g.beginPath(); g.moveTo(x + i * 15, gy - 78); g.lineTo(x + (i + 1) * 15, gy - 78); g.lineTo(x + (i + 1) * 15, gy - 62); g.quadraticCurveTo(x + i * 15 + 7.5, gy - 56, x + i * 15, gy - 62); g.fill(); } g.fillStyle = '#a1887f'; g.fillRect(x, gy - 30, 120, 6); for (let i = 0; i < 9; i++) { g.fillStyle = ['#e53935', '#fdd835', '#43a047', '#fb8c00', '#8e24aa'][(i + k) % 5]; g.beginPath(); g.arc(x + 8 + i * 13, gy - 34, 5, 0, TAU); g.fill(); } });
    cobble(g, V, off);
  },

  // Gulasch & BBQ: Garten mit Gulaschkessel überm Feuer, Grill und Rauch
  bbq(g, V, off, t) {
    const gy = V.groundY;
    sky(g, V, '#ffcf8a', '#fff1d8'); clouds(g, V, off, 0.6);
    g.fillStyle = '#3e8e41'; g.beginPath(); g.moveTo(0, gy); for (let x = 0; x <= V.w + 20; x += 20) g.lineTo(x, gy - 76 - Math.sin((x + off * 0.3) * 0.05) * 6); g.lineTo(V.w, gy); g.fill();
    rep(V, off, 0.45, 400, (x) => { g.strokeStyle = '#3e2723'; g.lineWidth = 4; g.beginPath(); g.moveTo(x + 20, gy); g.lineTo(x + 60, gy - 100); g.lineTo(x + 100, gy); g.stroke(); g.lineWidth = 2; g.beginPath(); g.moveTo(x + 60, gy - 100); g.lineTo(x + 60, gy - 64); g.stroke(); g.fillStyle = '#263238'; g.beginPath(); g.ellipse(x + 60, gy - 46, 30, 20, 0, 0, Math.PI); g.fill(); g.fillRect(x + 30, gy - 62, 60, 16); emoji(g, '🔥', x + 60, gy - 14, 30 + Math.sin(t * 9) * 3); g.fillStyle = 'rgba(200,200,200,0.5)'; for (let i = 0; i < 5; i++) { g.beginPath(); g.arc(x + 60 + Math.sin(t + i) * 10, gy - 80 - ((t * 30 + i * 20) % 100), 8 + i, 0, TAU); g.fill(); } g.fillStyle = '#795548'; g.fillRect(x + 200, gy - 36, 120, 6); emoji(g, '🍺', x + 220, gy - 50, 16); emoji(g, '🌭', x + 260, gy - 48, 16); emoji(g, '🥩', x + 300, gy - 48, 16); });
    grass(g, V, off);
  },

  // 30. Geburtstag „Pizza & Glitzer“
  pizzaGlitter(g, V, off, t) {
    const gy = V.groundY;
    sky(g, V, '#2a0b3d', '#6a1b6a');
    for (let i = 0; i < 40; i++) { g.fillStyle = `hsla(${(i * 37 + t * 60) % 360},90%,70%,${0.5 + Math.sin(t * 5 + i) * 0.4})`; const x = wrap(i * 47 - off * 0.15, V.w), y = (i * 53) % (gy - 20); g.beginPath(); g.arc(x, y, 1.8, 0, TAU); g.fill(); }
    rep(V, off, 0.3, 240, (x) => { g.strokeStyle = '#ccc'; g.lineWidth = 1; g.beginPath(); g.moveTo(x + 60, 0); g.lineTo(x + 60, 40); g.stroke(); const r = 22; const gr = g.createRadialGradient(x + 55, 56, 4, x + 60, 62, r); gr.addColorStop(0, '#fff'); gr.addColorStop(1, '#9aa'); g.fillStyle = gr; g.beginPath(); g.arc(x + 60, 62, r, 0, TAU); g.fill(); g.fillStyle = 'rgba(255,255,255,0.8)'; for (let i = 0; i < 8; i++) { const a = i / 8 * TAU + t * 2; g.fillRect(x + 60 + Math.cos(a) * 12, 62 + Math.sin(a) * 12, 4, 4); } emoji(g, '🍕', x + 160, gy - 120, 30, Math.sin(t + x)); });
    once(V, off, 0.3, 900, 200, (x) => { emoji(g, '3️⃣', x, gy - 150, 60); emoji(g, '0️⃣', x + 56, gy - 150, 60); });
    crowd(g, V, off, 0.45, t, '#140320', 18, 7);
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

  // Piraten-Kneipe: Würfeltisch, Asbach-Regal und blinkender Spielautomat
  pirateBar(g, V, off, t, lv) {
    const gy = V.groundY;
    sky(g, V, '#2b1a10', '#4a2e1c');
    rep(V, off, 0.3, 70, (x) => { g.fillStyle = 'rgba(0,0,0,0.2)'; g.fillRect(x, 0, 3, gy); });
    rep(V, off, 0.45, 460, (x) => { g.fillStyle = '#111'; g.fillRect(x + 20, 30, 70, 46); emoji(g, '☠️', x + 55, 53, 26); g.fillStyle = '#6d4c41'; g.beginPath(); g.arc(x + 180, 90, 34, 0, TAU); g.fill(); g.fillStyle = '#3e2723'; g.beginPath(); g.arc(x + 180, 90, 24, 0, TAU); g.fill(); g.strokeStyle = '#a1887f'; g.lineWidth = 4; for (let i = 0; i < 8; i++) { const a = i / 8 * TAU + Math.sin(t) * 0.2; g.beginPath(); g.moveTo(x + 180, 90); g.lineTo(x + 180 + Math.cos(a) * 42, 90 + Math.sin(a) * 42); g.stroke(); } g.fillStyle = '#4e342e'; g.fillRect(x + 260, gy - 150, 120, 70); for (let i = 0; i < 6; i++) { g.fillStyle = '#c68a2e'; roundRect(g, x + 270 + i * 18, gy - 176, 10, 26, 3); g.fill(); g.fillStyle = '#fff'; g.fillRect(x + 271 + i * 18, gy - 166, 8, 6); } g.fillStyle = '#7b1fa2'; roundRect(g, x + 400, gy - 120, 50, 100, 6); g.fill(); for (let i = 0; i < 3; i++) { g.fillStyle = '#fff'; g.fillRect(x + 405 + i * 14, gy - 100, 12, 18); emoji(g, ['🍒', '🔔', '7️⃣', '🍋'][(Math.floor(t * 8) + i) % 4], x + 411 + i * 14, gy - 91, 10); } g.fillStyle = (Math.floor(t * 4) % 2) ? '#ffd23f' : '#ff4fa3'; g.fillRect(x + 400, gy - 128, 50, 6); });
    once(V, off, 0.45, 900, 200, (x) => neon(g, S(lv, 'pub', 'KNEIPE'), x, 24, '#ff7043', 18, t, 1));
    g.fillStyle = '#5d4037'; g.fillRect(0, gy - 40, V.w, 10);
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
    // rot-weiß gestreiftes Festzelt
    once(V, off, 0.2, 1100, 450, (x) => {
      const w = 300, h = 90, top = gy - 70 - h;
      for (let i = 0; i < 15; i++) { g.fillStyle = i % 2 ? '#fff' : '#d32f2f'; g.fillRect(x + i * 20, top, 20, h); }
      for (let i = 0; i < 15; i++) { g.fillStyle = i % 2 ? '#fff' : '#d32f2f'; g.beginPath(); g.moveTo(x + i * 20, top); g.lineTo(x + w / 2 + (i - 7) * 4, top - 60); g.lineTo(x + w / 2 + (i - 6) * 4, top - 60); g.lineTo(x + i * 20 + 20, top); g.fill(); }
      for (let i = 0; i < 15; i++) { g.fillStyle = i % 2 ? '#d32f2f' : '#fff'; g.beginPath(); g.moveTo(x + i * 20, top); g.lineTo(x + i * 20 + 20, top); g.lineTo(x + i * 20 + 10, top + 10); g.fill(); }
      g.fillStyle = 'rgba(60,20,10,0.55)'; g.fillRect(x + 110, top + 30, 80, h - 30);
      g.strokeStyle = '#8d6e63'; g.lineWidth = 2; g.beginPath(); g.moveTo(x + w / 2, top - 60); g.lineTo(x + w / 2, top - 80); g.stroke(); g.fillStyle = '#d32f2f'; g.beginPath(); g.moveTo(x + w / 2, top - 80); g.lineTo(x + w / 2 + 18, top - 74 + Math.sin(t * 5) * 2); g.lineTo(x + w / 2, top - 68); g.fill();
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
  L4: { icon: '🛍️', scene: 'mall', music: 'elise', len: 90, obstacles: { shirtrack: 3, sale: 2, shopbag: 2, shirt: 2 }, items: ['shopbag2', 'coffee'], quest: { item: 'shopbag2', n: 8 }, hero: 'fan' },
  L5: { icon: '🎈', scene: 'garden', music: 'birthday', len: 75, obstacles: { pot: 3, balloon: 3, gift: 2 }, items: ['schokokuss', 'cake'], quest: { item: 'schokokuss', n: 12 }, hero: 'knight', garlands: 1 },
  L6: { icon: '💸', scene: 'bank', music: 'entertainer', len: 75, obstacles: { invoice: 3, piggy: 2, tax: 2, chartfly: 2 }, items: ['coin', 'money'], quest: { item: 'money', n: 20 }, hero: 'banker', goalRain: '💸' },
  L7: { icon: '🚗', scene: 'driving', music: 'tell', len: 90, obstacles: { cone: 3, blitzer: 2, bike: 2, car: 2 }, items: ['voucher'], quest: { item: 'voucher', n: 8 }, hero: 'racer' },
  L8: { icon: '🍹', scene: 'bar', music: 'habanera', len: 90, obstacles: { barstool: 3, bottle: 2, trays: 2 }, items: ['cocktail', 'straw', 'cupid'], quest: { item: 'cupid', n: 10 }, hero: 'barkeeper', goalHearts: 1 },
  L9: { icon: '🐱', scene: 'catFlat', music: 'turca', len: 90, obstacles: { log: 3, wool: 3, tp: 2 }, items: ['treat'], quest: { item: 'treat', n: 15 }, hero: 'catears', fipsBox: 1 },
  L10: { icon: '📚', scene: 'hola', music: 'mountain', len: 150, obstacles: { books: 3, alarm: 2, grade6: 3 }, items: ['coffee', 'cheatnote'], quest: { survive: 1 }, hero: 'tutor', checkpoint: 1 },
  L11: { icon: '🎓', scene: 'uni', music: 'ode', len: 90, obstacles: { bench: 2, tray: 3, books: 2 }, items: ['fries2', 'coffee'], quest: { item: 'fries2', n: 10 }, hero: 'graduate' },
  L12: { icon: '⚖️', scene: 'wiesbaden', music: 'toccata', len: 105, obstacles: { folders: 2, barstool: 2, paragraph: 3, facewalk: 1 }, items: ['redbull', 'koelsch', 'akte'], quest: { item: 'akte', n: 8 }, hero: 'angel' },
  L13: { icon: '👻', scene: 'horror', music: 'horror', len: 90, horror: 1, obstacles: { shirt: 2, flyshirt: 3, ghost: 2, stink: 3, rille: 2, fish: 2, merz: 2 }, items: ['candle'], bad: 0.45, quest: { survive: 1 }, hero: 'zombie' },
  L14: { icon: '🪩', scene: 'cocoon', music: 'techno', len: 105, obstacles: { speaker: 3, laser: 3, fog: 2, bouncer: 1 }, items: ['glow', 'water'], quest: { item: 'glow', n: 12 }, hero: 'raver', outfit: { top: 'glitter', topColor: 'f', bottom: 'tutu', socks: 'ringel', shoes: 'docs', extra: ['afro', 'starshades', 'boa'] }, party: 1 },
  L15: { icon: '🎄', scene: ['xmasRoom', 'omaXmas'], music: 'deckhalls', len: 105, obstacles: { gift: 3, snowman: 2, smalltree: 2, candlebig: 2 }, items: ['eierlikoer', 'cookie2', 'wine'], quest: { item: 'cookie2', n: 12 }, hero: 'santa' },
  L16: { icon: '🎡', scene: 'plaerrer', music: 'volksfest', len: 105, obstacles: { 'maß': 3, hayball: 2, carousel: 1, target: 2, dartboard: 2 }, items: ['brezn', 'lebherz', 'domsign'], quest: { item: 'domsign', n: 6 }, hero: 'lederhosen', party: 1, goalRain: '👶' },
  L17: { icon: '🏖️', scene: ['sicily', 'apulia'], music: 'mobile', len: 105, obstacles: { sandcastle: 2, crab: 2, gull: 3, wave: 2, vespa: 2 }, items: ['gelato', 'pizza', 'mussel', 'cocktail'], badItems: ['fig'], bad: 0.3, quest: { avoid: 'fig' }, hero: 'baywatch', figStory: 1 },
  L18: { icon: '🎭', scene: 'koeln', music: 'cancan', len: 105, obstacles: { confetti: 2, dancer: 2, clown: 2, flyball: 3 }, items: ['kamelle', 'struessjer', 'koelsch'], quest: { item: 'kamelle', n: 15 }, hero: 'prince', party: 1 },
  L19: { icon: '🎲', scene: 'gameNight', music: 'tetris', len: 120, obstacles: { dice: 3, robber: 2, hourfly: 3 }, items: ['card'], quest: { set: ['wood', 'clay', 'woolres', 'grain', 'ore'] }, hero: 'joker' },
  L20: { icon: '⏳', scene: 'timeclash', world: 'party', music: 'retro', len: 150, obstacles: { speaker: 3, crate: 3, hourglass: 2, discoball: 3 }, items: ['cocktail2', 'water'], quest: { survive: 1 }, hero: 'dj', checkpoint: 1, party: 1 },
  L21: { icon: '🐒', scene: 'serengeti', world: 'zoo', music: 'safari', len: 105, obstacles: { banana: 3, fence: 2, jeep: 2, parrot: 3, zebra: 1 }, items: ['monkey'], quest: { item: 'monkey', n: 8 }, hero: 'tarzan' },
  L22: { icon: '🗽', scene: 'nyc', music: 'jinglebells', len: 105, obstacles: { taxi: 2, snowpile: 3, skater: 2, hydrant: 2, smalltree: 1 }, items: ['psl', 'brezel', 'candycane'], quest: { item: 'psl', n: 8 }, hero: 'winter', noFamily: 1, fireworks: 1, goalHearts: 1 },
  L23: { icon: '🥕', scene: 'hanauMarkt', world: 'market', music: 'nachtmusik', len: 105, obstacles: { fruitcrate: 3, flowers: 2, basket: 2, cheese: 2, pigeon: 3 }, items: ['apple', 'sausage'], quest: { item: 'sausage', n: 6 }, hero: 'crier' },
  L24: { icon: '🍲', scene: 'bbq', music: 'hungarian', len: 105, obstacles: { kettle: 2, grill: 3, logs: 2, smoke: 2 }, items: ['gulasch', 'sausage', 'steak'], quest: { item: 'gulasch', n: 10 }, hero: 'grill' },
  L25: { icon: '🍕', scene: 'pizzaGlitter', music: 'bday30', len: 120, obstacles: { pizzatower: 3, speaker: 2, bottle: 3, confetti: 2 }, items: ['pizza', 'glitter'], quest: { item: 'glitter', n: 30 }, hero: 'glitter', party: 1, glitterRush: 1 },
  L26: { icon: '💼', scene: 'office', world: 'office', music: 'bumblebee', len: 120, obstacles: { chair: 3, boss: 2, folders: 3, paper: 3 }, items: ['coffee', 'mimisoup'], quest: { survive: 1 }, hero: 'business' },
  L27: { icon: '💍', scene: 'barn', music: 'punk', len: 150, obstacles: { hayball: 3, bench: 2, dancers: 2, bouquet: 3 }, items: ['ring', 'confetti2', 'weddingcake'], quest: { items: ['ring', 'confetti2'], n: 10 }, hero: 'groom', checkpoint: 1, party: 1, fireworks: 1, goalHearts: 1 },
  L28: { icon: '🧅', scene: 'inn', music: 'polka', len: 105, obstacles: { pan: 3, waiter: 2, bubble: 3, pubtable: 1 }, items: ['schnitzel', 'fries2', 'onion'], quest: { item: 'onion', n: 12 }, hero: 'waiter' },
  L29: { icon: '🎺', scene: 'kerb', music: 'kerbmarsch', len: 120, obstacles: { bembel: 3, trumpet: 2, drum: 2, bench: 2 }, items: ['gerippter', 'winktuch', 'saeftchen'], quest: { item: 'gerippter', n: 10 }, hero: 'kerb', party: 1 },
  L30: { icon: '🤠', scene: ['nycDay', 'nola', 'nashville'], music: 'saints', len: 105, obstacles: { taxi: 2, hydrant: 2, sax: 3, guitar: 2 }, items: ['hotdog', 'beignet', 'cowboyhat', 'boots'], quest: { item: 'boots', n: 6 }, hero: 'stars' },
  L31: { icon: '🏴‍☠️', scene: 'pirateBar', music: 'sailor', len: 105, obstacles: { barstool: 3, slot: 2, bottle: 2, dartboard: 2 }, items: ['asbach', 'dice', 'cherry'], quest: { item: 'cherry', n: 3 }, hero: 'pirate', party: 1 },
  L32: { icon: '🍷', scene: ['mainzMarkt', 'rheinufer'], music: 'minuet', len: 120, obstacles: { pigeon: 3, flowerpot: 2, umbrella: 2, bike: 2 }, items: ['wine2', 'cheese2', 'weck'], quest: { items: ['wine2', 'cheese2', 'weck'], n: 10 }, hero: 'winzer' },
  L33: { icon: '🌸', scene: 'bluetenfest', music: 'spring', len: 120, obstacles: { hayball: 3, bench: 2, flowerpot: 2, carousel: 1, bembel: 2 }, items: ['blossom', 'los', 'gerippter'], quest: { item: 'blackring', n: 1, hidden: 1 }, hero: 'flowers', party: 1 },
  L34: { icon: '🦃', scene: 'xmasRustler', music: 'wewish', len: 105, obstacles: { teddy: 2, toytrain: 2, gift: 2, rocking: 2, weizen: 1 }, items: ['turkey', 'cookie2', 'wine'], quest: { face: 1, n: 5 }, hero: 'elf' },
  L35: { icon: '🌵', scene: 'western', music: 'susanna', len: 120, obstacles: { hayball: 2, tumbleweed: 3, cactus: 2, bull: 2, facefly: 2 }, items: ['cowboyhat', 'burger2', 'hotdog'], quest: { survive: 1 }, hero: 'cowboy', party: 1 },
  L36: { icon: '🏡', scene: ['kitchen', 'garden'], world: 'kitchen', world2: 'garden', music: 'run', len: 150, obstacles: { mop: 4, pot: 2, flour: 2, laundry: 2, tomato: 2, grill: 2 }, items: ['pizza', 'wine'], quest: { survive: 1 }, hero: 'chef', checkpoint: 1 },
  L37: { icon: '🏰', scene: ['edinburgh', 'highlands'], music: 'auldlang', len: 120, obstacles: { sheep: 3, wall: 2, rain: 2, nessie: 1, leftcar: 3 }, items: ['shortbread', 'whisky'], quest: { item: 'shortbread', n: 10 }, hero: 'kilt' },
  L38: { icon: '🎂', scene: 'birthday', music: 'finaleBday', len: 150, obstacles: { wool: 1, bobbycar: 1, schoolbag: 1, shirtrack: 1, invoice: 1, cone: 1, barstool: 1, books: 1, laser: 1, gift: 1, 'maß': 1, gull: 1, dice: 1, discoball: 1, jeep: 1, taxi: 1, kettle: 1, hayball: 1, pan: 1, bembel: 1, slot: 1, cactus: 1, mop: 1, sheep: 1 }, items: ['candle'], quest: { item: 'candle', n: 34 }, hero: 'tux', checkpoint: 1, party: 1, finale: 1 },
  G: { icon: '🌿', scene: 'haze', music: 'cucaracha', len: 90, obstacles: { smoke: 2, weedleaf: 3, lava: 2, couchG: 1 }, items: ['snack', 'donut', 'fries2'], quest: { item: 'snack', n: 15 }, hero: 'hippie', lowGrav: 1, trip: 1, secret: 1 },
};
// Siedler-Rohstoffe als Items
for (const k of ['wood', 'clay', 'woolres', 'grain', 'ore']) LEVELS.L19.items.push(k);

export const PHASE_ICONS = { Kindheit: '🧸', Schulzeit: '🎒', Jugend: '🛵', Zwanziger: '🎉', Paar: '💑', Heute: '🏡', Extra: '⭐', Finale: '🎂', Geheim: '🌿' };
