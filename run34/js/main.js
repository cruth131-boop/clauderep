import { assets, fetchBundle, unlockWithPassword, unlockWithStoredKey } from './assets.js';
import { OUTFIT_PARTS, PRESETS, ACHIEVEMENTS, CHALLENGES, FAIL_TITLES } from './config.js';
import { Game } from './world.js';
import { LoseScene, FinaleScene, animateMap } from './scenes.js';
import { drawCharacter } from './character.js';
import { MOTIFS } from './motifs.js';
import { initAudio, sfx, playMusic, stopMusic, setMuted, isMuted, suspendAudio, resumeAudio } from './audio.js';
import { LEVELS, PHASE_ICONS } from './levels.js';

const $ = (id) => document.getElementById(id);
const canvas = $('game');
const g = canvas.getContext('2d');
const DEV = new URLSearchParams(location.search).has('dev');

// ----------------------------------------------------------------- Speicher
const SAVE_KEY = 'br.save.v1';
const save = {
  best: { birthday: 0, endless: 0, horror: 0, roadtrip: 0 }, fails: 0, won: false, outfit: { ...PRESETS.matrose }, muted: false, horrorSeen: false,
  levels: {}, secretFound: false, lastLevel: null,
  album: [], totalFails: 0, ach: {}, worlds: [], stats: { monkeys: 0, mops: 0, chases: 0 }, challengeDone: {}, greenTaps: 0, greenUnlocked: false, eggNext: false,
};
if (new URLSearchParams(location.search).has('reset')) {
  try { localStorage.removeItem(SAVE_KEY); } catch {}
  const u = new URL(location.href); u.searchParams.delete('reset'); history.replaceState(null, '', u);
}
try { Object.assign(save, JSON.parse(localStorage.getItem(SAVE_KEY) || '{}')); } catch {}
const persist = () => { try { localStorage.setItem(SAVE_KEY, JSON.stringify(save)); } catch {} };
save.album ??= []; save.levels ??= {}; save.best.level ??= 0; save.best.roadtrip ??= 0; save.stats ??= { monkeys: 0, mops: 0, chases: 0 }; save.ach ??= {}; save.worlds ??= []; save.challengeDone ??= {};
const unlocked = (what) => DEV || (what === 'birthday' ? save.won : what?.startsWith('world:') ? save.worlds.includes(what.slice(6)) : true);
const ROADTRIP_START = new Date(2026, 11, 4);
const roadtripOpen = () => DEV || Date.now() >= ROADTRIP_START.getTime();
const todayKey = () => { const d = new Date(); return `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`; };
const todaysChallenge = () => { const d = new Date(); const n = Math.floor(new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime() / 864e5); return CHALLENGES[n % CHALLENGES.length]; };
const failTitle = () => FAIL_TITLES.filter(([n]) => save.totalFails >= n).pop()[1];
function unlockAch(id) {
  if (!ACHIEVEMENTS[id] || save.ach[id]) return;
  save.ach[id] = Date.now(); persist();
  const [title, , emo] = ACHIEVEMENTS[id];
  setTimeout(() => toast(`🏆 Erfolg: ${emo} ${title}`, 2600), 300);
  sfx('power');
}
// ----------------------------------------------------------------- Level-Fortschritt
const lvList = () => (assets.config.levels || []).filter((l) => LEVELS[l.id]);
const lvOrder = () => lvList().filter((l) => l.id !== 'G');
const lvDone = (id) => !!save.levels[id]?.done;
function lvUnlocked(id) {
  if (DEV) return true;
  if (id === 'G') return save.secretFound;
  const order = lvOrder(), i = order.findIndex((l) => l.id === id);
  return i === 0 || (i > 0 && lvDone(order[i - 1].id));
}
const lvNext = () => lvOrder().find((l) => !lvDone(l.id) && lvUnlocked(l.id)) || null;
const lvNum = (id) => (id === 'G' ? '★' : String(lvOrder().findIndex((l) => l.id === id) + 1));
const horrorOpen = () => DEV || lvDone('L13');
const endlessOpen = () => DEV || lvDone('L38');
const stars = (n, of = 3) => '<i>⭐</i>'.repeat(n) + '<i class="off">⭐</i>'.repeat(of - n);

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
const input = { jumpHeld: false, jumpPressed: false, duck: false, left: false, right: false, fire: false };

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
  const rb = $('btn-roadtrip');
  rb.classList.toggle('locked', !roadtripOpen());
  rb.textContent = roadtripOpen() ? '🚗 Roadtrip' : '🔒 Roadtrip (ab 4.12.)';
  rb.classList.toggle('hidden', !save.won);
  $('btn-gift').classList.toggle('hidden', !save.won);
  const hb = $('btn-horror');
  hb.classList.toggle('hidden', !horrorOpen());
  $('btn-levels').classList.toggle('hidden', !(save.won || DEV));
  $('btn-endless').classList.toggle('hidden', !endlessOpen());
  const doneN = lvOrder().filter((l) => lvDone(l.id)).length;
  $('btn-levels').textContent = `🗺️ Level-Modus${doneN ? ` (${doneN}/${lvOrder().length})` : ''}`;
  const bests = [];
  if (save.best.birthday) bests.push(`🕯️ ${Math.min(save.best.birthday, assets.config.birthdayTarget || 34)}`);
  if (save.best.endless) bests.push(`♾️ ${save.best.endless}`);
  if (save.best.horror) bests.push(`👻 ${save.best.horror}`);
  if (save.best.roadtrip) bests.push(`🚗 ${save.best.roadtrip}`);
  const lines = [];
  if (bests.length) lines.push(`Rekorde: ${bests.join('  ·  ')}`);
  if (save.won) {
    const days = Math.ceil((ROADTRIP_START.getTime() - Date.now()) / 864e5);
    const end = new Date(2026, 11, 7).getTime();
    lines.push(days > 0 ? `🚗 Noch ${days} ${days === 1 ? 'Tag' : 'Tage'} bis Eindhoven! 🇳🇱` : Date.now() < end ? '🚗 Roadtrip läuft – gute Fahrt! 🇳🇱🇧🇪' : '🚗 Roadtrip-Modus freigeschaltet');
  }
  const ch = todaysChallenge();
  lines.push(`🎯 Heute: ${ch.text}${save.challengeDone[todayKey()] ? ' ✓' : ''}`);
  if (save.totalFails) lines.push(`🤕 „Das hab ich mir so nicht vorgestellt!“ ×${save.totalFails} · ${failTitle()}`);
  if (innerHeight > innerWidth) lines.push('Tipp: Quer halten = mehr Überblick');
  $('menu-hint').textContent = lines.join('\n');
  $('btn-mute').textContent = isMuted() ? '🔇' : '🔊';
  show('scr-menu');
  playMusic('menu');
}

document.querySelectorAll('[data-mode]').forEach((b) => b.addEventListener('click', async () => {
  await initAudio();
  const mode = b.dataset.mode;
  if (mode === 'horror' && !horrorOpen()) {
    toast('🔒 Erst Level 13 schaffen!'); sfx('bad'); return;
  }
  if (mode === 'roadtrip' && !roadtripOpen()) {
    const days = Math.ceil((ROADTRIP_START.getTime() - Date.now()) / 864e5);
    toast(`🔒 Geduld! Noch ${days} ${days === 1 ? 'Tag' : 'Tage'} bis zum Roadtrip 🚗`); sfx('bad'); return;
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
function startGame(mode, { level = null, startAt = 0 } = {}) {
  show(null); screen = 'play'; scene = null; paused = false;
  const mercy = mode === 'birthday' ? mercyLevel() : 0;
  const eggHead = save.eggNext; save.eggNext = false; persist();
  const endlessLevels = mode === 'endless' ? lvOrder().map((l) => l.id).filter((id) => id !== 'L13').concat(save.secretFound ? ['G'] : []) : null;
  input.left = input.right = input.fire = false;
  game = new Game(mode, {
    outfit: save.outfit, mercy, eggHead, album: save.album, level, startAt, endlessLevels,
    events: {
      onLevelDone,
      onGod: (on) => { $('god-ctl').classList.toggle('hidden', !on); toast(on ? '⚡ GODMODE AN! ◀ ▶ laufen · 🚀 schießen' : 'Godmode aus', 2600); if (on) unlockAch('god'); },
      onSecret: () => { if (!save.secretFound) { save.secretFound = true; persist(); unlockAch('secret'); toast('🌿 Psst… Geheimes Level freigeschaltet!', 3200); } },
      onGoal: () => { $('god-ctl').classList.add('hidden'); setHud(false); },
      onDeath: onDeath,
      onFinale: onFinale,
      onToast: (t) => toast(t),
      onHearts: updateHearts,
      onAchieve: unlockAch,
      onWorld: (id, count, biome) => {
        if (biome?.music) playMusic(biome.music);
        if (!save.worlds.includes(id)) {
          save.worlds.push(id); persist();
          const unl = Object.entries(OUTFIT_PARTS).flatMap(([, d]) => Object.values(d.options)).filter((o) => o.unlock === `world:${id}`);
          if (unl.length) setTimeout(() => toast(`👗 Neues Outfit freigeschaltet: ${unl.map((o) => o.label).join(', ')}`, 2800), 2600);
        }
        if (count >= 7 && mode !== 'level') unlockAch('worlds');
      },
      onPass: (type) => { if (type === 'mop' && ++save.stats.mops >= 10) unlockAch('mop'); checkChallengeLive(); },
      onCollect: (type) => { if (type === 'monkey' && ++save.stats.monkeys >= 10) unlockAch('monkeys'); checkChallengeLive(); },
      onChase: () => { if (++save.stats.chases >= 3) unlockAch('payback'); },
      onPhoto: (id) => {
        if (save.album.includes(id)) return;
        save.album.push(id); persist();
        const total = (assets.config.memories || []).length;
        if (total && save.album.length >= total) unlockAch('album');
      },
    },
  });
  if (mode === 'roadtrip') unlockAch('roadtrip');
  if (save.outfit.top === 'green') unlockAch('green');
  if (eggHead) setTimeout(() => toast('🥚 Eierkopf-Modus! 30 Sekunden Riesenkopf'), 200);
  const hr = new Date().getHours();
  if (hr >= 23 || hr < 4) { setTimeout(() => toast('Kimi, geh ins Bett! 😴', 2600), 900); unlockAch('nightowl'); }
  if (hr === 6) setTimeout(() => toast('⏰ 6 Uhr! Die Wecker sind los…', 2600), 900);
  setHud(true);
  if (DEV) window.__game = game;
  $('progress').classList.toggle('hidden', mode !== 'birthday' && mode !== 'level');
  $('progress-cake').textContent = mode === 'level' ? '🏁' : '🎂';
  $('quest').classList.toggle('hidden', mode !== 'level');
  $('god-ctl').classList.add('hidden');
  const lvP = level && lvList().find((l) => l.id === level);
  $('best').textContent = mode === 'birthday' ? `von ${game.target} 🕯️` : mode === 'level' ? `Level ${lvNum(level)}` : `HI ${save.best[mode] || 0}`;
  updateHearts(game.hearts);
  playMusic(mode === 'level' ? LEVELS[level].music : mode === 'horror' ? 'horror' : mode === 'endless' && game.biome?.music ? game.biome.music : 'run');
  if (level) { save.lastLevel = level; persist(); }
  challengeShown = false;
  if (mode === 'level') { toast(`${LEVELS[level].icon} ${lvP?.title || ''}${startAt ? ' · ab Checkpoint 🚩' : ''}`, 2600); }
  else if (mode === 'horror') toast(`👻 ${assets.config.horror?.intro || ''}`, 3200);
  else if (mercy) toast(['', '🐱 Gnadenmodus: Fips hilft & alles etwas langsamer', '❤️❤️ Gnadenmodus: 2 Extra-Leben', '🤫 Schummel-Modus: Start mit 25 Kerzen'][mercy], 3000);
  tapHint('Tippen = Springen  ·  ⬇ = Ducken', 2600);
}

function updateHearts(n) { n = Math.max(0, Math.min(3, n)); $('hearts').textContent = '❤️'.repeat(n) + '🤍'.repeat(3 - n); }

let challengeShown = false;
function challengeMet(st, score, mode) {
  const c = todaysChallenge();
  if (c.mode && c.mode !== mode) return false;
  if (c.item) return (st.items[c.item] || 0) >= c.n;
  if (c.pass) return (st.passed[c.pass] || 0) >= c.n;
  if (c.score) return score >= c.score && (!c.noBad || !st.bad) && (mode === 'endless' || mode === 'roadtrip' || mode === 'horror');
  return false;
}
function checkChallengeLive() {
  if (!game || challengeShown || save.challengeDone[todayKey()]) return;
  if (challengeMet(game.stats, Math.floor(game.score), game.mode)) {
    challengeShown = true; save.challengeDone[todayKey()] = true; persist();
    toast(`🎯 Tages-Challenge geschafft: ${todaysChallenge().text}!`, 2800); unlockAch('challenge');
    game.fx.burst(game.V.w / 2, game.V.groundY * 0.4, { n: 40, type: 'confetti', speed: 260, size: 4, gravity: 300 });
  }
}
function runEnded(st, score, mode, time) {
  if (time >= 45 && !st.bad) unlockAch('allergy');
  if ((mode === 'endless' || mode === 'roadtrip') && score >= 500) unlockAch('score500');
  checkChallengeLive();
  persist();
}

function onDeath(info) {
  $('tap-hint').classList.add('hidden');
  const mode = info.mode;
  save.totalFails = (save.totalFails || 0) + 1;
  if (save.totalFails >= 10) unlockAch('stumble');
  runEnded(info.stats, info.score, mode, info.time);
  if (mode !== 'level' && info.score > (save.best[mode] || 0)) { info.newBest = (save.best[mode] || 0) > 0; save.best[mode] = info.score; }
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
  const cp = info.mode === 'level' && LEVELS[info.level]?.checkpoint && info.progress >= 0.5;
  $('btn-checkpoint').classList.toggle('hidden', !cp);
  $('btn-over-menu').textContent = info.mode === 'level' ? '🗺️ Levels' : 'Menü';
  if (info.mode === 'level') $('over-best').textContent = `${Math.round(info.progress * 100)}% geschafft – fast!`;
  lastDeath = info;
  show('scr-over');
}
let lastDeath = null;
$('btn-again').addEventListener('click', () => (lastDeath?.mode === 'level' ? startGame('level', { level: lastDeath.level }) : startGame(game?.mode || 'birthday')));
$('btn-checkpoint').addEventListener('click', () => startGame('level', { level: lastDeath.level, startAt: 0.5 }));
$('btn-over-menu').addEventListener('click', () => (lastDeath?.mode === 'level' ? showLevels() : toMenu()));

function onFinale() {
  stopMusic();
  setHud(false); screen = 'finale';
  scene = new FinaleScene(game, { outfit: save.outfit, onReveal: showReveal });
}

let stopMap = null;
function showReveal(fromMenu = false) {
  const gift = assets.config.gift || {};
  const firstWin = !fromMenu && !save.won;
  if (!fromMenu) {
    save.won = true;
    unlockAch('birthday');
    runEnded(game.stats, Math.floor(game.score), 'birthday', game.t);
  }
  if (!fromMenu) save.best.birthday = Math.max(save.best.birthday || 0, Math.floor(game.score));
  persist();
  $('reveal-kicker').textContent = gift.kicker || '';
  $('reveal-kicker').classList.toggle('hidden', !gift.kicker);
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
  $('reveal-unlock').textContent = firstWin ? '🔓 Freigeschaltet: Birthday-Princess-Outfit, Horror-Modus 👻 & Roadtrip-Countdown 🚗' : '';
  screen = 'reveal';
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
function pause() { if (screen === 'play' && ['run', 'goal', 'story'].includes(game?.state)) { paused = true; show('scr-pause'); suspendAudio(); } }
$('btn-resume').addEventListener('click', () => { paused = false; show(null); resumeAudio(); last = performance.now(); });
$('btn-quit').addEventListener('click', () => { resumeAudio(); if (game?.mode === 'level') showLevels(); else toMenu(); });
document.addEventListener('visibilitychange', () => { if (document.hidden) pause(); });

// ----------------------------------------------------------------- Eingabe
function worldPos(e) { return [e.clientX / V.scale, e.clientY / V.scale]; }
canvas.addEventListener('pointerdown', (e) => {
  e.preventDefault();
  initAudio();
  if (scene) { scene.tap?.(...worldPos(e), V); return; }
  if (screen === 'play' && !paused && game?.state === 'story') { game.storyInput('down', ...worldPos(e)); return; }
  if (screen === 'play' && !paused && game?.tryTap?.(...worldPos(e))) return;
  if (screen === 'play' && !paused) {
    input.jumpHeld = true; input.jumpPressed = true;
    $('tap-hint').classList.add('hidden');
  }
});
const release = () => { input.jumpHeld = false; };
canvas.addEventListener('pointermove', (e) => { if (screen === 'play' && !paused && game?.state === 'story') game.storyInput('move', ...worldPos(e)); });
canvas.addEventListener('pointerup', release);
canvas.addEventListener('pointercancel', release);
const duckBtn = $('btn-duck');
duckBtn.addEventListener('pointerdown', (e) => { e.preventDefault(); input.duck = true; duckBtn.classList.add('active'); });
for (const ev of ['pointerup', 'pointercancel', 'pointerleave']) duckBtn.addEventListener(ev, () => { input.duck = false; duckBtn.classList.remove('active'); });
for (const [id, key] of [['btn-left', 'left'], ['btn-right', 'right'], ['btn-fire', 'fire']]) {
  const b = $(id);
  b.addEventListener('pointerdown', (e) => { e.preventDefault(); input[key] = true; b.classList.add('active'); });
  for (const ev of ['pointerup', 'pointercancel', 'pointerleave']) b.addEventListener(ev, () => { input[key] = false; b.classList.remove('active'); });
}
addEventListener('keydown', (e) => {
  if (e.repeat) return;
  if (['Space', 'ArrowUp', 'KeyW'].includes(e.code)) {
    e.preventDefault(); initAudio();
    if (scene) scene.tap?.(V.w / 2, V.h / 2, V);
    else if (game?.state === 'story') game.storyInput('down', V.w / 2, V.h / 2);
    else { input.jumpHeld = true; input.jumpPressed = true; }
  }
  if (['ArrowDown', 'KeyS'].includes(e.code)) input.duck = true;
  if (['ArrowLeft', 'KeyA'].includes(e.code)) input.left = true;
  if (['ArrowRight', 'KeyD'].includes(e.code)) input.right = true;
  if (['KeyX', 'Enter'].includes(e.code)) input.fire = true;
  if (e.code === 'Escape') pause();
  if (DEV && e.code === 'KeyG' && game?.lv) { game.god = !game.god; game.events.onGod?.(game.god); }
  if (DEV && e.code === 'KeyL' && game?.lv) { game.distance = game.lvTarget - 5; }
  if (DEV && e.code === 'KeyF' && game && screen === 'play') { game.score = game.target; }
});
addEventListener('keyup', (e) => {
  if (['Space', 'ArrowUp', 'KeyW'].includes(e.code)) input.jumpHeld = false;
  if (['ArrowDown', 'KeyS'].includes(e.code)) input.duck = false;
  if (['ArrowLeft', 'KeyA'].includes(e.code)) input.left = false;
  if (['ArrowRight', 'KeyD'].includes(e.code)) input.right = false;
  if (['KeyX', 'Enter'].includes(e.code)) input.fire = false;
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
        if (locked) {
          const wl = { office: 'L26', garden: 'L36', party: 'L20', zoo: 'L21', market: 'L23', kitchen: 'L36' }[opt.unlock?.slice(6)];
          const wt = wl && lvList().find((l) => l.id === wl);
          $('wardrobe-msg').textContent = wt ? `🔒 Wird in Level ${lvNum(wl)} „${wt.title}“ freigeschaltet!` : '🔒 Wird im Geburtstags-Modus freigeschaltet!';
          sfx('bad'); return;
        }
        if (opt.refuse && !save.greenUnlocked) {
          save.greenTaps = (save.greenTaps || 0) + 1; persist();
          if (save.greenTaps >= 10) {
            save.greenUnlocked = true; persist();
            $('wardrobe-msg').textContent = 'Na gut… 🤢 Du hast es so gewollt. Grün ist jetzt erlaubt.';
            sfx('power'); buildWardrobe(); return;
          }
          $('wardrobe-msg').textContent = save.greenTaps >= 6 ? `Du bist ganz schön hartnäckig… (${10 - save.greenTaps})` : `„${assets.config.loseLines?.[0] || 'Nein.'}" Grün kommt hier nicht rein. (Außer im Horror-Modus… 👻)`;
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
    if (game.lv) {
      $('progress-bar').style.width = `${game.progress * 100}%`;
      const q = game.questStatus();
      const txt = q ? (q.text || `${q.icon} ${q.cur}/${q.n}`) : '';
      const qe = $('quest'); if (qe.textContent !== txt) qe.textContent = txt;
      qe.classList.toggle('done', !!(q && (q.done || game.questDone) && !q.fail && !game.quest.survive));
    }
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

// ----------------------------------------------------------------- Easter Eggs
// 5× schnell auf den Titel tippen -> Eierkopf-Modus in der nächsten Runde
let titleTaps = [];
$('menu-title').addEventListener('click', () => {
  initAudio();
  const now = performance.now(); titleTaps = titleTaps.filter((x) => now - x < 2500); titleTaps.push(now);
  sfx('tap', titleTaps.length);
  if (titleTaps.length >= 5) {
    titleTaps = []; save.eggNext = true; persist(); unlockAch('egghead');
    toast('🥚 Geheimer Eierkopf-Modus! Die nächste Runde startet mit Riesenkopf.', 3000);
  }
});

// Schütteln ruft Fips
let shakeOn = false, lastShake = 0;
function onMotion(e) {
  const a = e.accelerationIncludingGravity || e.acceleration; if (!a) return;
  const m = Math.hypot(a.x || 0, a.y || 0, a.z || 0);
  if (m > 28 && performance.now() - lastShake > 1500) {
    lastShake = performance.now();
    if (game) { game.summonFips(); unlockAch('shake'); if (screen === 'menu') toast('🐱 Miau!'); }
  }
}
$('btn-shake').addEventListener('click', async () => {
  initAudio();
  try {
    if (typeof DeviceMotionEvent !== 'undefined' && DeviceMotionEvent.requestPermission) {
      const r = await DeviceMotionEvent.requestPermission(); if (r !== 'granted') { toast('Ohne Erlaubnis kein Schütteln 🤷‍♀️'); return; }
    }
    if (!shakeOn) { addEventListener('devicemotion', onMotion); shakeOn = true; }
    $('btn-shake').textContent = '📳✓';
    toast('📳 Schüttel dein Handy… 🐱', 2400);
    game?.summonFips();
  } catch { toast('Schütteln geht auf diesem Gerät leider nicht.'); }
});

// Erfolge
function showAchievements() {
  screen = 'ach';
  const ids = Object.keys(ACHIEVEMENTS);
  const prog = { monkeys: `${Math.min(10, save.stats.monkeys)}/10`, mop: `${Math.min(10, save.stats.mops)}/10`, payback: `${Math.min(3, save.stats.chases)}/3`, stumble: `${Math.min(10, save.totalFails || 0)}/10`, worlds: `${Math.min(7, save.worlds.length + 1)}/7` };
  $('ach-count').textContent = `${ids.filter((i) => save.ach[i]).length}/${ids.length}`;
  $('ach-list').innerHTML = ids.map((id) => {
    const [t, d, e] = ACHIEVEMENTS[id], on = !!save.ach[id];
    const secret = !on && ['egghead', 'green', 'shake', 'fipsbox', 'nightowl', 'secret', 'god'].includes(id);
    return `<div class="ach-item ${on ? 'on' : ''}"><div class="e">${secret ? '❓' : e}</div><div><b>${secret ? 'Geheim' : t}</b><span>${secret ? 'Ein Easter Egg wartet…' : d}${!on && prog[id] ? ` · ${prog[id]}` : ''}</span></div></div>`;
  }).join('');
  show('scr-ach');
}
$('btn-ach').addEventListener('click', () => { initAudio(); showAchievements(); });
$('btn-ach-done').addEventListener('click', toMenu);

$('btn-gift').addEventListener('click', () => { initAudio(); sfx('memory'); showReveal(true); });

// ----------------------------------------------------------------- Album
// Alte Schnappschüsse aus früheren Versionen entfernen
try { localStorage.removeItem('br.snaps.v1'); } catch {}

function showAlbum() {
  screen = 'album';
  const mems = assets.config.memories || [];
  const esc = (t) => String(t).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  $('album-count').textContent = `${mems.filter((m) => save.album.includes(m.img)).length}/${mems.length} Fotos`;
  $('album-mem').innerHTML = mems.map((m, i) => {
    const on = save.album.includes(m.img) && assets.images[m.img];
    return on ? `<div class="pol" style="--r:${(i % 2 ? 2 : -2.5)}deg" data-src="mem:${esc(m.img)}" data-cap="${esc(m.caption || '')}"><img src="${assets.images[m.img].src}" alt=""><span>${esc(m.caption || '')}</span></div>`
      : `<div class="pol" style="--r:${(i % 2 ? 2 : -2.5)}deg"><div class="q">?</div><span>Noch nicht gefunden</span></div>`;
  }).join('');
  show('scr-album');
}
$('scr-album').addEventListener('click', (e) => {
  const big = $('album-big');
  if (!big.classList.contains('hidden')) { if (e.target === big) big.classList.add('hidden'); return; }
  const pol = e.target.closest('.pol[data-src]'); if (!pol) return;
  const [kind, id] = pol.dataset.src.split(':');
  if (kind !== 'mem') return;
  $('album-big-img').src = assets.images[id].src;
  $('album-big-cap').textContent = pol.dataset.cap;
  big.classList.remove('hidden');
});
// Album vorerst ausgeblendet
$('btn-album-done').addEventListener('click', () => { $('album-big').classList.add('hidden'); toMenu(); });

// ----------------------------------------------------------------- Level-Modus: Auswahl, Intro, Ergebnis
const escH = (t) => String(t ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
function showLevels() {
  scene = null; game = new Game('attract', { outfit: save.outfit }); setHud(false); $('god-ctl').classList.add('hidden');
  screen = 'levels';
  const list = lvList(), order = lvOrder();
  const total = order.reduce((s, l) => s + (save.levels[l.id]?.stars || 0), 0);
  $('lv-count').textContent = `${order.filter((l) => lvDone(l.id)).length}/${order.length} · ⭐ ${total}/${order.length * 3}`;
  const next = lvNext();
  const cont = $('btn-lv-continue');
  cont.classList.toggle('hidden', !next);
  if (next) cont.textContent = `▶ Weiter: Level ${lvNum(next.id)} – ${next.title}`;
  // Extra-Level der Lebensphase davor zuordnen, damit die Reihenfolge stimmt
  const phaseOf = {}; let lastPh = list[0]?.phase;
  for (const l of list) { if (l.phase !== 'Extra') lastPh = l.phase; phaseOf[l.id] = l.phase === 'Extra' ? lastPh : l.phase; }
  const phases = [];
  for (const l of list) { if (!phases.includes(phaseOf[l.id])) phases.push(phaseOf[l.id]); }
  let html = '';
  for (const ph of phases) {
    const items = list.filter((l) => phaseOf[l.id] === ph);
    html += `<h3 class="phase">${PHASE_ICONS[ph] || (ph.includes('&') ? '💑' : '•')} ${escH(ph)}</h3><div class="lv-grid">`;
    for (const l of items) {
      const open = lvUnlocked(l.id), st = save.levels[l.id]?.stars || 0, def = LEVELS[l.id];
      const isNext = next && next.id === l.id;
      if (l.id === 'G' && !open) { html += `<button class="lv-tile locked secret" data-lv="G"><span class="n">★</span><span class="i">❓</span><span class="t">Geheim…</span><span class="s">🔒</span></button>`; continue; }
      html += `<button class="lv-tile ${open ? '' : 'locked'} ${lvDone(l.id) ? 'done' : ''} ${isNext ? 'next' : ''} ${l.id === 'G' ? 'secret' : ''}" data-lv="${l.id}">
        <span class="n">${l.id === 'G' ? '★' : 'Level ' + lvNum(l.id)}</span><span class="i">${open ? def.icon : '🔒'}</span>
        <span class="t">${open ? escH(l.title) : '???'}</span><span class="s">${open ? stars(st) : ''}</span></button>`;
    }
    html += '</div>';
  }
  $('lv-list').innerHTML = html;
  show('scr-levels');
  playMusic('menu');
  setTimeout(() => $('lv-list').querySelector('.lv-tile.next')?.scrollIntoView({ block: 'center' }), 50);
}
$('btn-levels').addEventListener('click', async () => { await initAudio(); showLevels(); });
$('btn-levels-done').addEventListener('click', toMenu);
$('btn-lv-continue').addEventListener('click', () => { const n = lvNext(); if (n) showIntro(n.id); });
$('lv-list').addEventListener('click', (e) => {
  const t = e.target.closest('.lv-tile'); if (!t) return;
  initAudio();
  const id = t.dataset.lv;
  if (!lvUnlocked(id)) { sfx('bad'); toast(id === 'G' ? '🌿 Irgendwo versteckt sich ein Geheimnis… (Weihnachten!)' : '🔒 Erst das Level davor schaffen!'); return; }
  showIntro(id);
});
let introId = null;
function showIntro(id) {
  introId = id; screen = 'lvintro';
  const l = lvList().find((x) => x.id === id), def = LEVELS[id];
  $('lvi-icon').textContent = def.icon;
  $('lvi-num').textContent = id === 'G' ? 'Geheimes Level' : `Level ${lvNum(id)} · ${l.phase}`;
  $('lvi-title').textContent = l.title;
  $('lvi-ctx').textContent = l.ctx || '';
  $('lvi-quest').textContent = `🎯 ${l.quest || 'Komm ins Ziel!'}`;
  const faces = l.guests === 'all' ? (assets.config.allGuests || []).slice(0, 18) : (l.guests || []).map((c) => c.face).filter(Boolean);
  $('lvi-faces').innerHTML = [...new Set(faces)].map((f) => {
    const nm = assets.config.faceMap?.[f]?.normal || f; const img = assets.images[nm] || assets.images[f];
    return img ? `<img src="${img.src}" alt="">` : '';
  }).join('');
  const st = save.levels[id]?.stars || 0;
  $('lvi-stars').innerHTML = lvDone(id) ? `${stars(st)} <small>Bestwert ${save.levels[id].best || 0}</small>` : '<small>⭐ Ziel · ⭐ Quest · ⭐ ohne Treffer</small>';
  show('scr-lvintro');
}
$('btn-lvi-go').addEventListener('click', () => { initAudio(); startGame('level', { level: introId }); });
$('btn-lvi-back').addEventListener('click', showLevels);

let doneId = null;
function onLevelDone(res) {
  const id = res.id, prev = save.levels[id] || { stars: 0, best: 0 };
  const first = !prev.done;
  save.levels[id] = { done: true, stars: Math.max(prev.stars || 0, res.stars), best: Math.max(prev.best || 0, res.score), quest: prev.quest || res.questDone };
  const unl = [];
  if (id === 'L13' && first) { unl.push('👻 Horror-Modus freigeschaltet!'); unlockAch('horrorlv'); }
  if (id === 'L38' && first) unl.push('♾️ Endlos-Modus freigeschaltet – alle Level in zufälliger Reihenfolge!');
  if (id === 'G') unlockAch('secret');
  if (lvOrder().every((l) => lvDone(l.id))) unlockAch('levels');
  if (lvOrder().every((l) => (save.levels[l.id]?.stars || 0) >= 3)) unlockAch('allstars');
  runEnded(res.stats, res.score, 'level', res.time);
  persist();
  doneId = id; screen = 'lvdone'; setHud(false);
  const l = lvList().find((x) => x.id === id);
  $('lvd-title').textContent = `${LEVELS[id].icon} ${l.title}`;
  $('lvd-stars').innerHTML = [0, 1, 2].map((i) => `<span class="${i < res.stars ? '' : 'off'}" style="animation-delay:${0.3 + i * 0.35}s">⭐</span>`).join('');
  [0, 1, 2].forEach((i) => { if (i < res.stars) setTimeout(() => sfx('candle', i * 4), 300 + i * 350); });
  $('lvd-list').innerHTML = [
    '✅ Ziel erreicht',
    `${res.questDone ? '✅' : '❌'} Quest: ${escH(l.quest || '')}`,
    `${res.noDamage && !res.god ? '✅' : '❌'} Ohne Treffer${res.god ? ' (Godmode zählt nicht 😉)' : ''}`,
  ].map((x) => `<li>${x}</li>`).join('');
  $('lvd-score').textContent = res.score;
  $('lvd-best').textContent = `Bestwert: ${save.levels[id].best}`;
  $('lvd-unlock').textContent = unl.join('  ·  ');
  const fin = id === 'L38';
  $('lvd-credits').classList.toggle('hidden', !fin);
  if (fin) {
    const N = assets.config.guestNames || {};
    const names = [...new Set(Object.values(N))];
    const head = assets.config.creditsHead || [];
    $('lvd-roll').innerHTML = `<h4>🎬 ${escH(assets.config.title)}</h4>${head.map((n) => `<div>${escH(n)}</div>`).join('')}<h4>Mit</h4>${names.map((n) => `<div>${escH(n)}</div>`).join('')}${(assets.config.creditsExtra || []).map((n) => `<div>${escH(n)}</div>`).join('')}<h4>❤️</h4><div>Happy Birthday!</div>`;
  }
  const next = lvOrder()[lvOrder().findIndex((x) => x.id === id) + 1];
  $('btn-lvd-next').classList.toggle('hidden', !next || id === 'G');
  if (next) $('btn-lvd-next').textContent = `Level ${lvNum(next.id)}: ${next.title} ▶`;
  show('scr-lvdone');
  playMusic(fin ? 'finale' : 'menu');
}
$('btn-lvd-next').addEventListener('click', () => { const order = lvOrder(); const n = order[order.findIndex((x) => x.id === doneId) + 1]; if (n) showIntro(n.id); });
$('btn-lvd-again').addEventListener('click', () => startGame('level', { level: doneId }));
$('btn-lvd-levels').addEventListener('click', showLevels);
