import { assets, fetchBundle, unlockWithPassword, unlockWithStoredKey } from './assets.js';
import { OUTFIT_PARTS, PRESETS } from './config.js';
import { Game } from './world.js';
import { LoseScene, FinaleScene, animateMap } from './scenes.js';
import { drawCharacter } from './character.js';
import { MOTIFS } from './motifs.js';
import { initAudio, sfx, playMusic, stopMusic, setMuted, isMuted, suspendAudio, resumeAudio } from './audio.js';

const $ = (id) => document.getElementById(id);
const canvas = $('game');
const g = canvas.getContext('2d');
const DEV = new URLSearchParams(location.search).has('dev');

// ----------------------------------------------------------------- Speicher
const SAVE_KEY = 'br.save.v1';
const save = {
  best: { birthday: 0, endless: 0, horror: 0 }, fails: 0, won: false, outfit: { ...PRESETS.matrose }, muted: false, horrorSeen: false,
};
try { Object.assign(save, JSON.parse(localStorage.getItem(SAVE_KEY) || '{}')); } catch {}
const persist = () => { try { localStorage.setItem(SAVE_KEY, JSON.stringify(save)); } catch {} };
const unlocked = (what) => DEV || (what === 'birthday' ? save.won : true);
const mercyLevel = () => (save.won ? 0 : save.fails >= 10 ? 3 : save.fails >= 6 ? 2 : save.fails >= 3 ? 1 : 0);
setMuted(save.muted);

// ----------------------------------------------------------------- Ansicht
const V = { w: 600, h: 320, groundY: 250, scale: 1, dpr: 1 };
function resize() {
  const cw = innerWidth, ch = innerHeight;
  V.dpr = Math.min(2, devicePixelRatio || 1);
  canvas.width = Math.round(cw * V.dpr); canvas.height = Math.round(ch * V.dpr);
  const portrait = ch > cw;
  V.scale = portrait ? cw / 480 : Math.min(cw / 600, ch / 320);
  V.w = cw / V.scale; V.h = ch / V.scale;
  V.groundY = portrait ? V.h * 0.68 : V.h * 0.8;
}
addEventListener('resize', resize); resize();

// ----------------------------------------------------------------- Zustand
let screen = 'boot';
let game = null, scene = null, paused = false;
const input = { jumpHeld: false, jumpPressed: false, duck: false };

function show(id) {
  for (const s of document.querySelectorAll('.screen')) s.classList.add('hidden');
  if (id) $(id).classList.remove('hidden');
}
function setHud(on) {
  $('hud').classList.toggle('hidden', !on);
  $('btn-duck').classList.toggle('hidden', !on);
}
let toastTimer;
function toast(text, ms = 2200) {
  const el = $('toast'); el.textContent = text; el.classList.remove('hidden');
  el.style.animation = 'none'; void el.offsetWidth; el.style.animation = '';
  clearTimeout(toastTimer); toastTimer = setTimeout(() => el.classList.add('hidden'), ms);
}
let hintTimer;
function tapHint(text, ms) {
  const el = $('tap-hint'); el.textContent = text; el.classList.remove('hidden');
  clearTimeout(hintTimer); if (ms) hintTimer = setTimeout(() => el.classList.add('hidden'), ms);
}

// ----------------------------------------------------------------- Menü
function toMenu() {
  scene = null; paused = false;
  screen = 'menu'; setHud(false); $('tap-hint').classList.add('hidden');
  game = new Game('attract', { outfit: save.outfit });
  const cfg = assets.config;
  document.title = cfg.title;
  $('menu-title').textContent = cfg.title;
  $('menu-sub').textContent = cfg.menuSubtitle;
  const hb = $('btn-horror');
  hb.classList.toggle('locked', !unlocked('birthday'));
  hb.textContent = unlocked('birthday') ? '👻 Horror-Modus' : '🔒 Horror-Modus';
  const bests = [];
  if (save.best.birthday) bests.push(`🕯️ ${Math.min(save.best.birthday, assets.config.birthdayTarget || 34)}`);
  if (save.best.endless) bests.push(`♾️ ${save.best.endless}`);
  if (save.best.horror) bests.push(`👻 ${save.best.horror}`);
  $('menu-hint').textContent = (bests.length ? `Rekorde: ${bests.join('  ·  ')}` : '') + (innerHeight > innerWidth ? '\nTipp: Quer halten = mehr Überblick' : '');
  $('btn-mute').textContent = isMuted() ? '🔇' : '🔊';
  show('scr-menu');
  playMusic('menu');
}

document.querySelectorAll('[data-mode]').forEach((b) => b.addEventListener('click', async () => {
  await initAudio();
  const mode = b.dataset.mode;
  if (mode === 'horror' && !unlocked('birthday')) {
    toast('🔒 Erst den Geburtstags-Modus schaffen!'); sfx('bad'); return;
  }
  startGame(mode);
}));
$('btn-mute').addEventListener('click', async () => {
  await initAudio();
  save.muted = !isMuted(); setMuted(save.muted); persist();
  $('btn-mute').textContent = save.muted ? '🔇' : '🔊';
  if (!save.muted) playMusic('menu');
});

// ----------------------------------------------------------------- Spiel
function startGame(mode) {
  show(null); screen = 'play'; scene = null; paused = false;
  const mercy = mode === 'birthday' ? mercyLevel() : 0;
  game = new Game(mode, {
    outfit: save.outfit, mercy,
    events: {
      onDeath: onDeath,
      onFinale: onFinale,
      onToast: (t) => toast(t),
      onHearts: updateHearts,
    },
  });
  setHud(true);
  if (DEV) window.__game = game;
  $('progress').classList.toggle('hidden', mode !== 'birthday');
  $('best').textContent = mode === 'birthday' ? `von ${game.target} 🕯️` : `HI ${save.best[mode] || 0}`;
  updateHearts(game.hearts);
  playMusic(mode === 'horror' ? 'horror' : 'run');
  if (mode === 'horror') toast(`👻 ${assets.config.horror?.intro || ''}`, 3200);
  else if (mercy) toast(['', '🐱 Gnadenmodus: Fips hilft & alles etwas langsamer', '❤️❤️ Gnadenmodus: 2 Extra-Leben', '🤫 Schummel-Modus: Start mit 25 Kerzen'][mercy], 3000);
  tapHint('Tippen = Springen  ·  ⬇ = Ducken', 2600);
}

function updateHearts(n) { n = Math.max(0, Math.min(3, n)); $('hearts').textContent = '❤️'.repeat(n) + '🤍'.repeat(3 - n); }

function onDeath(info) {
  $('tap-hint').classList.add('hidden');
  const mode = info.mode;
  if (info.score > (save.best[mode] || 0)) { info.newBest = (save.best[mode] || 0) > 0; save.best[mode] = info.score; }
  let mercyMsg = '';
  if (mode === 'birthday' && !save.won) {
    const before = mercyLevel();
    save.fails++;
    const after = mercyLevel();
    if (after > before) mercyMsg = assets.config.mercyLines?.[after - 1] || '';
  }
  persist();
  setHud(false);
  screen = 'lose';
  scene = new LoseScene(info, () => showGameOver(info, mercyMsg));
}

function showGameOver(info, mercyMsg) {
  scene = null; screen = 'over';
  const cfg = assets.config;
  const pickL = (a) => a[(Math.random() * a.length) | 0];
  $('over-title').textContent = info.newBest ? '🏆 Neuer Rekord!' : pickL(cfg.titleLines || ['Autsch!']);
  const specific = cfg.obstacleLines?.[info.cause];
  const pool = specific && Math.random() < 0.6 ? specific : cfg.loseLines;
  $('over-line').textContent = `„${pickL(pool)}"`;
  $('over-score').textContent = info.score;
  $('over-best').textContent = info.mode === 'birthday' ? `von ${cfg.birthdayTarget || 34} Kerzen 🕯️ – noch ${Math.max(0, (cfg.birthdayTarget || 34) - info.score)}!` : `Rekord: ${save.best[info.mode]}`;
  $('over-mercy').textContent = mercyMsg;
  $('over-mercy').classList.toggle('hidden', !mercyMsg);
  show('scr-over');
}
$('btn-again').addEventListener('click', () => startGame(game?.mode || 'birthday'));
$('btn-over-menu').addEventListener('click', toMenu);

function onFinale() {
  stopMusic();
  setHud(false); screen = 'finale';
  scene = new FinaleScene(game, { outfit: save.outfit, onReveal: showReveal });
}

let stopMap = null;
function showReveal() {
  const gift = assets.config.gift || {};
  const firstWin = !save.won;
  save.won = true;
  save.best.birthday = Math.max(save.best.birthday || 0, Math.floor(game.score));
  persist();
  $('reveal-kicker').textContent = gift.kicker || 'Dein Geschenk';
  $('reveal-title').textContent = gift.title || '';
  $('reveal-date').textContent = gift.date || '';
  $('reveal-text').textContent = gift.text || '';
  $('reveal-motto').textContent = gift.motto || '';
  $('reveal-motifs').innerHTML = (gift.motifs || []).map((m) => MOTIFS[m] || '').join('');
  const esc = (t) => String(t).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  $('reveal-days').innerHTML = (gift.days || []).map((d, i) => `
    <div class="day" style="animation-delay:${1.2 + i * 0.6}s">${MOTIFS[d.icon] || ''}
      <div><h3><small>${esc(d.label || '')}</small>${esc(d.title || '')}</h3>
      <ul>${(d.items || []).map((it) => `<li>${esc(it)}</li>`).join('')}</ul></div></div>`).join('');
  $('reveal-unlock').textContent = firstWin ? '🔓 Freigeschaltet: Birthday-Princess-Outfit & Horror-Modus 👻' : '';
  show('scr-reveal');
  stopMap?.(); stopMap = animateMap($('map'), gift.stops || []);
}
$('btn-reveal-menu').addEventListener('click', () => { stopMap?.(); toMenu(); });
$('btn-replay-finale').addEventListener('click', () => {
  stopMap?.(); show(null);
  game = new Game('birthday', { outfit: save.outfit, events: { onFinale } });
  game.score = game.target; game.startFinale();
  screen = 'play'; setHud(false);
});

// Pause
$('btn-pause').addEventListener('click', (e) => { e.stopPropagation(); pause(); });
function pause() { if (screen === 'play' && game?.state === 'run') { paused = true; show('scr-pause'); suspendAudio(); } }
$('btn-resume').addEventListener('click', () => { paused = false; show(null); resumeAudio(); last = performance.now(); });
$('btn-quit').addEventListener('click', () => { resumeAudio(); toMenu(); });
document.addEventListener('visibilitychange', () => { if (document.hidden) pause(); });

// ----------------------------------------------------------------- Eingabe
function worldPos(e) { return [e.clientX / V.scale, e.clientY / V.scale]; }
canvas.addEventListener('pointerdown', (e) => {
  e.preventDefault();
  initAudio();
  if (scene) { scene.tap?.(...worldPos(e), V); return; }
  if (screen === 'play' && !paused) {
    input.jumpHeld = true; input.jumpPressed = true;
    $('tap-hint').classList.add('hidden');
  }
});
const release = () => { input.jumpHeld = false; };
canvas.addEventListener('pointerup', release);
canvas.addEventListener('pointercancel', release);
const duckBtn = $('btn-duck');
duckBtn.addEventListener('pointerdown', (e) => { e.preventDefault(); input.duck = true; duckBtn.classList.add('active'); });
for (const ev of ['pointerup', 'pointercancel', 'pointerleave']) duckBtn.addEventListener(ev, () => { input.duck = false; duckBtn.classList.remove('active'); });
addEventListener('keydown', (e) => {
  if (e.repeat) return;
  if (['Space', 'ArrowUp', 'KeyW'].includes(e.code)) {
    e.preventDefault(); initAudio();
    if (scene) scene.tap?.(V.w / 2, V.h / 2, V);
    else { input.jumpHeld = true; input.jumpPressed = true; }
  }
  if (['ArrowDown', 'KeyS'].includes(e.code)) input.duck = true;
  if (e.code === 'Escape') pause();
  if (DEV && e.code === 'KeyF' && game && screen === 'play') { game.score = game.target; }
});
addEventListener('keyup', (e) => {
  if (['Space', 'ArrowUp', 'KeyW'].includes(e.code)) input.jumpHeld = false;
  if (['ArrowDown', 'KeyS'].includes(e.code)) input.duck = false;
});
// iOS: Doppeltipp-Zoom & Kontextmenü verhindern
document.addEventListener('gesturestart', (e) => e.preventDefault());
document.addEventListener('contextmenu', (e) => e.preventDefault());

// ----------------------------------------------------------------- Kleiderschrank
let previewT = 0, previewRaf = null;
function buildWardrobe() {
  const wrap = $('wardrobe-cats'); wrap.innerHTML = '';
  for (const [cat, def] of Object.entries(OUTFIT_PARTS)) {
    if (cat === 'topColor' && ['princess', 'green'].includes(save.outfit.top)) continue;
    const box = document.createElement('div'); box.className = 'cat';
    box.innerHTML = `<h3>${def.label}</h3>`;
    const chips = document.createElement('div'); chips.className = 'chips';
    for (const [key, opt] of Object.entries(def.options)) {
      const b = document.createElement('button'); b.className = 'chip';
      const locked = opt.unlock && !unlocked(opt.unlock);
      const on = def.multi ? (save.outfit.extra || []).includes(key) : save.outfit[cat] === key;
      if (on) b.classList.add('on');
      if (locked) b.classList.add('locked');
      if (opt.color) { b.style.borderColor = opt.color; b.innerHTML = `<span style="display:inline-block;width:12px;height:12px;border-radius:50%;background:${opt.color};vertical-align:-1px"></span> ${opt.label}`; }
      else b.textContent = (locked ? '🔒 ' : '') + opt.label;
      b.addEventListener('click', () => {
        initAudio();
        if (locked) { $('wardrobe-msg').textContent = '🔒 Wird im Geburtstags-Modus freigeschaltet!'; sfx('bad'); return; }
        if (opt.refuse) {
          $('wardrobe-msg').textContent = `„${assets.config.loseLines?.[0] || 'Nein.'}" Grün kommt hier nicht rein. (Außer im Horror-Modus… 👻)`;
          sfx('no'); b.animate([{ transform: 'translateX(-6px)' }, { transform: 'translateX(6px)' }, { transform: 'none' }], { duration: 250, iterations: 2 });
          return;
        }
        if (def.multi) {
          const set = new Set(save.outfit.extra || []);
          set.has(key) ? set.delete(key) : set.add(key);
          if (key === 'party' && set.has('party')) set.delete('shades');
          if (key === 'shades' && set.has('shades')) set.delete('party');
          save.outfit.extra = [...set];
        } else save.outfit[cat] = key;
        $('wardrobe-msg').textContent = '';
        sfx('collect'); persist(); buildWardrobe();
      });
      chips.appendChild(b);
    }
    box.appendChild(chips); wrap.appendChild(box);
  }
}
document.querySelectorAll('[data-preset]').forEach((b) => b.addEventListener('click', () => {
  const p = b.dataset.preset;
  if (p === 'princess' && !unlocked('birthday')) { $('wardrobe-msg').textContent = '🔒 Die Krone muss man sich verdienen! (Geburtstags-Modus)'; sfx('bad'); return; }
  save.outfit = structuredClone(PRESETS[p]); persist(); buildWardrobe(); sfx('power');
}));
$('btn-wardrobe').addEventListener('click', () => {
  initAudio(); screen = 'wardrobe'; buildWardrobe(); show('scr-wardrobe');
  const pc = $('preview'), pg = pc.getContext('2d');
  const loop = () => {
    if (screen !== 'wardrobe') return;
    previewT += 1 / 60;
    pg.setTransform(1, 0, 0, 1, 0, 0); pg.clearRect(0, 0, pc.width, pc.height);
    pg.setTransform(2.1, 0, 0, 2.1, 0, 0);
    drawCharacter(pg, 70, 128, { pose: 'run', phase: previewT * 7, outfit: save.outfit, scale: 0.95, t: previewT });
    previewRaf = requestAnimationFrame(loop);
  };
  cancelAnimationFrame(previewRaf); loop();
});
$('btn-wardrobe-done').addEventListener('click', toMenu);

// ----------------------------------------------------------------- Loop
let last = performance.now();
function frame(now) {
  const dt = Math.min(0.05, (now - last) / 1000); last = now;
  g.setTransform(V.dpr * V.scale, 0, 0, V.dpr * V.scale, 0, 0);
  if (game) {
    game.V = V;
    if (!paused) {
      const steps = dt > 1 / 50 ? 2 : 1;
      for (let i = 0; i < steps; i++) { game.update(dt / steps, input); input.jumpPressed = false; }
    }
    game.draw(g);
  } else {
    g.fillStyle = '#1b1035'; g.fillRect(0, 0, V.w, V.h);
  }
  if (scene && !paused) scene.update(dt, V);
  if (scene) scene.draw(g, V);
  if (screen === 'play' && game && game.state !== 'idle') {
    const s = Math.floor(game.score);
    $('score').textContent = s;
    if (game.mode === 'birthday') $('progress-bar').style.width = `${Math.min(100, (game.score / game.target) * 100)}%`;
  }
  requestAnimationFrame(frame);
}

// ----------------------------------------------------------------- Start
async function boot() {
  requestAnimationFrame(frame);
  const hasBundle = await fetchBundle();
  if (hasBundle && !(await unlockWithStoredKey())) {
    screen = 'lock'; show('scr-lock');
    $('lock-input').focus();
    return;
  }
  toMenu();
}
$('lock-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  initAudio();
  const btn = e.submitter || $('lock-form').querySelector('button');
  btn.disabled = true;
  try {
    const ok = await unlockWithPassword($('lock-input').value);
    if (ok) { $('lock-input').blur(); toMenu(); sfx('power'); }
    else { $('lock-error').classList.remove('hidden'); sfx('no'); $('lock-input').select(); }
  } catch (err) {
    $('lock-error').textContent = `Fehler: ${err.message}`; $('lock-error').classList.remove('hidden');
  } finally { btn.disabled = false; }
});

if ('serviceWorker' in navigator && location.protocol === 'https:') navigator.serviceWorker.register('sw.js').catch(() => {});
boot();
