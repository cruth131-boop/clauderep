// Spiellogik: Physik, Hindernisse, Items, Power-ups, Cameos, Hintergründe.
import { drawCharacter, drawCat, drawPerson, drawHero, drawFan, drawRollatorOma, star, roundRect } from './character.js';
import { assets, getFace } from './assets.js';
import { Particles } from './fx.js';
import { sfx } from './audio.js';
import { BIOMES, BIOMES_RT, FIPSLAND, OBS, ITEM_ICONS, drawAnyBiomeBg as drawBiomeBg, drawMonkey, biomeName } from './biomes.js';

export const MODES = {
  birthday: { start: 330, accel: 5, max: 540, theme: 'birthday', obstacles: { shirt: 3, height: 2, alarm: 2, tax: 2, flyshirt: 3 }, items: 0.1, bad: 0.16, collect: 'candle' },
  endless: { start: 340, accel: 6, max: 900, theme: 'day', obstacles: { candles: 2, shirt: 2, height: 2, alarm: 2, tax: 2, flyshirt: 2 }, items: 0.28, bad: 0.2 },
  horror: { start: 380, accel: 7, max: 920, theme: 'horror', obstacles: { shirt: 2, flyshirt: 3, ghost: 2, stink: 3, rille: 2, fish: 2, merz: 2, height: 1 }, items: 0.22, bad: 0.5 },
  roadtrip: { start: 360, accel: 6, max: 900, theme: 'day', obstacles: { cone: 1 }, items: 0.35, bad: 0.15 },
  attract: { start: 230, accel: 0, max: 230, theme: 'birthday', obstacles: {}, items: 0, bad: 0 },
};

const GRAV = 2400, JUMP_V = 760, CHAR_SCALE = 0.78, PLAYER_X = 95;
const STAND_H = 100, DUCK_H = 64;
const rand = (a, b) => a + Math.random() * (b - a);
const pick = (arr) => arr[(Math.random() * arr.length) | 0];
const wrap = (v, m) => ((v % m) + m) % m;
const lerp = (a, b, t) => a + (b - a) * t;
function lerpColor(c1, c2, t) {
  const a = parseInt(c1.slice(1), 16), b = parseInt(c2.slice(1), 16);
  const r = lerp((a >> 16) & 255, (b >> 16) & 255, t), g = lerp((a >> 8) & 255, (b >> 8) & 255, t), bl = lerp(a & 255, b & 255, t);
  return `rgb(${r | 0},${g | 0},${bl | 0})`;
}
function weighted(obj) {
  const entries = Object.entries(obj);
  let total = entries.reduce((s, [, w]) => s + w, 0), r = Math.random() * total;
  for (const [k, w] of entries) { if ((r -= w) <= 0) return k; }
  return entries[0][0];
}

export class Game {
  constructor(mode, { outfit, mercy = 0, events = {}, eggHead = false } = {}) {
    this.mode = mode;
    this.M = MODES[mode];
    this.cfg = assets.config;
    this.outfit = mode === 'horror' ? { ...outfit, top: 'green', topColor: 'a' } : outfit;
    this.events = events;
    this.mercy = mode === 'birthday' ? mercy : 0;
    this.speedFactor = this.mercy >= 1 ? 0.85 : 1;
    this.speed = this.M.start;
    this.t = 0; this.distance = 0; this.bgOffset = 0;
    this.score = this.mercy >= 3 ? 25 : 0; // im Geburtstags-Modus = Anzahl Kerzen
    this.state = mode === 'attract' ? 'idle' : 'run';
    this.baseExpr = mode === 'horror' ? 'skeptic' : 'normal';
    this.p = { y: 0, vy: 0, duck: false, phase: 0, expr: this.baseExpr, exprT: 0, invuln: 0, swell: 0, x: PLAYER_X, holding: false };
    this.hearts = this.mercy >= 2 ? 2 : 0;
    this.obstacles = []; this.items = []; this.cameos = []; this.polaroids = [];
    this.fx = new Particles();
    this.sinceSpawn = 0; this.nextGap = 600;
    this.fips = this.mercy >= 1 ? 7 : 0; this.hammer = 0;
    this.nextPower = this.mercy >= 1 ? rand(10, 16) : rand(18, 28);
    this.nextCameo = rand(8, 13);
    this.cameoIdx = 0;
    this.milestones = mode === 'birthday' ? [9, 17, 26].filter((m) => m > this.score) : [];
    this.bigNum = null;
    this.chase = null; this.nextChase = rand(10, 16);
    this.dash = null; this.nextDash = mode === 'attract' ? 3 : rand(6, 12);
    this.nextEndlessMemory = 75;
    this.memIdx = 0;
    this.shake = 0; this.flash = 0;
    this.deadT = 0; this.finaleT = 0;
    this.V = { w: 700, h: 320, groundY: 250 };
    this.lightning = 0;
    this.worldList = mode === 'roadtrip' ? BIOMES_RT : BIOMES;
    this.biomeIdx = 0; this.biome = mode === 'endless' || mode === 'roadtrip' ? this.worldList[0] : null;
    this.stats = { items: {}, passed: {}, bad: false, worlds: new Set(this.biome ? [this.biome.id] : []), chases: 0 };
    this.eggT = eggHead ? 30 : 0;
    this.green = this.outfit.top === 'green' && mode !== 'horror';
    this.hour = new Date().getHours();
    this.boxSpawned = false; this.fipsT = 0; this.savedBiome = null;
    this.omaRide = null; this.nextOma = ['birthday', 'endless', 'roadtrip'].includes(mode) ? rand(26, 34) : Infinity;
    this.hero = null; this.nextHero = ['birthday', 'endless', 'roadtrip', 'horror'].includes(mode) ? rand(16, 24) : Infinity;
    this.prevBiome = null; this.biomeFade = 1; this.nextBiomeAt = 60;
  }

  get target() { return this.mode === 'birthday' || this.mode === 'attract' ? (this.cfg.birthdayTarget || 34) : Infinity; }

  // ------------------------------------------------------------------ Update
  update(dt, input) {
    this.t += dt;
    const p = this.p;
    this.shake = Math.max(0, this.shake - dt * 30);
    this.flash = Math.max(0, this.flash - dt * 3);

    let dx = 0;
    if (this.state === 'run' || this.state === 'idle') {
      if (this.state === 'run') this.speed = Math.min(this.M.max, this.speed + this.M.accel * dt);
      dx = this.speed * this.speedFactor * dt;
    } else if (this.state === 'finale') {
      this.finaleT += dt;
      this.speed = Math.max(0, this.speed - 380 * dt);
      dx = this.speed * dt;
      p.x = lerp(p.x, this.V.w * 0.32, Math.min(1, dt * 1.6));
    }
    this.distance += dx; this.bgOffset += dx;

    // Spieler
    if (this.state === 'run') {
      if (input.jumpPressed && p.y <= 0.01 && !input.duck) { p.vy = JUMP_V; sfx('jump'); }
      if (!input.jumpHeld && p.vy > 280) p.vy = 280; // kurzer Tipp = kleiner Sprung
      p.duck = input.duck;
      const gMul = p.duck && p.y > 0 ? 3.2 : 1;
      p.vy -= GRAV * gMul * dt;
      p.y += p.vy * dt;
      if (p.y <= 0) { p.y = 0; p.vy = 0; }
      p.phase += dx / 34;
      if (!this.M.collect) this.score += dx / 400;
    } else if (this.state === 'idle') {
      p.phase += dx / 34;
    } else if (this.state === 'dying') {
      this.deadT += dt;
      p.vy -= GRAV * 0.8 * dt; p.y = Math.max(0, p.y + p.vy * dt);
      if (this.deadT > 1.1 && !this.deathSent) { this.deathSent = true; this.events.onDeath?.(this.deathInfo); }
    } else if (this.state === 'finale') {
      p.vy -= GRAV * dt; p.y = Math.max(0, p.y + p.vy * dt);
      if (p.y === 0) p.vy = this.speed <= 5 && this.finaleT > 2 ? 380 : 0; // Freudensprünge
      p.phase += Math.max(dx / 34, this.speed > 5 ? 0 : dt * 3);
      if (this.speed <= 0 && !this.finaleSent) { this.finaleSent = true; this.events.onFinale?.(); }
    }
    this.biomeFade = Math.min(1, this.biomeFade + dt / 1.6);
    p.exprT -= dt; if (p.exprT <= 0) p.expr = this.state === 'dying' ? 'sad' : this.hammer > 0 ? 'hammer' : this.baseExpr;
    p.invuln = Math.max(0, p.invuln - dt);
    p.swell = Math.max(0, p.swell - dt / 4);
    this.fips = Math.max(0, this.fips - dt);
    this.hammer = Math.max(0, this.hammer - dt);

    if (this.state === 'run') {
      this.spawn(dx, dt);
      this.collide();
      this.checkMilestones();
      
      if (this.biome && this.biome !== FIPSLAND && this.score >= this.nextBiomeAt) this.nextBiome();
      if (this.fipsT > 0) { this.fipsT -= dt; if (this.fipsT <= 0) this.leaveFipsland(); }
      this.eggT = Math.max(0, this.eggT - dt);
      if (this.mode === 'horror') {
        this.lightning -= dt;
        if (this.lightning <= 0) { this.lightning = rand(4, 9); this.flash = 0.9; sfx('thunder'); }
      }
    }
    if (this.state === 'idle') this.spawnCameos(dt);

    // Bewegung der Welt
    for (const o of this.obstacles) {
      o.x -= dx + (o.extraV || 0) * dt;
      o.t += dt;
      if (!o.passed && !o.knock && this.state === 'run' && o.x + o.w < this.p.x - 14) {
        o.passed = true; this.stats.passed[o.type] = (this.stats.passed[o.type] || 0) + 1; this.events.onPass?.(o.type);
      }
      if (o.knock) {
        o.knock.vy -= 1400 * dt; o.x += o.knock.vx * dt; o.yOff += o.knock.vy * dt; o.rot += o.knock.vr * dt;
      }
    }
    this.obstacles = this.obstacles.filter((o) => o.x > -120 && o.yOff > -400);
    for (const it of this.items) {
      it.x -= dx; it.t += dt;
      if (it.flying) {
        it.x += it.vx * dt; it.vy -= 900 * dt; it.y += it.vy * dt;
        if (it.vy < 0 && it.y <= it.restY) { it.y = it.restY; it.flying = false; }
      }
    }
    this.items = this.items.filter((it) => it.x > -60 && !it.taken);
    for (const c of this.cameos) { c.x -= dx; c.t += dt; }
    this.cameos = this.cameos.filter((c) => c.x > -80);
    this.updateCameos(dt);
    this.updateSpecials(dt);
    if (this.bigNum) { this.bigNum.t += dt; if (this.bigNum.t > 1.1) this.bigNum = null; }
    for (const pl of this.polaroids) pl.t += dt;
    this.polaroids = this.polaroids.filter((pl) => pl.t < pl.life);
    this.fx.update(dt, dx);
  }

  spawn(dx, dt) {
    const V = this.V;
    this.sinceSpawn += dx;
    const obsList = this.biome ? this.biome.obstacles : this.M.obstacles;
    if (this.sinceSpawn >= this.nextGap && this.biome === FIPSLAND) {
      this.sinceSpawn = 0; this.nextGap = 220 + Math.random() * 120;
      for (let i = 0; i < 4; i++) this.items.push(this.makeItem('treat', V.w + 40 + i * 30, 20 + Math.sin(i) * 30 + Math.random() * 60));
    } else if (this.sinceSpawn >= this.nextGap && Object.keys(obsList).length) {
      this.sinceSpawn = 0;
      const sp = this.speed * this.speedFactor;
      const minGap = sp * 0.95 + 80;
      this.nextGap = (minGap + Math.random() * minGap * 0.9) * (this.mercy ? 1.12 : 1);
      let type = weighted(this.biome ? this.biome.obstacles : this.M.obstacles);
      if ((['flyshirt', 'ghost', 'stink'].includes(type) || OBS[type]?.fly) && this.distance < 4000 && this.mode !== 'horror') type = this.mode === 'birthday' ? 'tax' : 'candles';
      if (this.hour === 6 && Math.random() < 0.3) type = 'alarm';
      if (!this.boxSpawned && this.biome && this.t > 25 && Math.random() < 0.05) { this.boxSpawned = true; type = 'fipsbox'; }
      const ob = this.makeObstacle(type, V.w + 40);
      this.obstacles.push(ob);
      if (this.M.collect === 'candle' && this.candleTimer <= 0) this.candleTimer = 1.8 * this.spawnCandles(ob, V.w + 40) - 0.4;
      // Item in der Lücke
      const gapX = V.w + 40 + this.nextGap * 0.5;
      if (Math.random() < this.M.bad) {
        this.items.push(this.makeItem(pick(['fig', 'shrimp']), gapX, pick([12, 12, 70])));
      } else if (Math.random() < this.M.items) {
        const food = this.biome?.items || ['wine', 'pizza', 'burger', 'nachos'];
        const type2 = this.biome?.bonus && Math.random() < 0.55 ? this.biome.bonus : Math.random() < 0.07 ? 'egg' : pick(food);
        this.items.push(this.makeItem(type2, gapX, pick([24, 70, 115])));
      }
    }
    this.candleTimer = (this.candleTimer ?? 1) - dt;
    // Herzen = Extra-Leben (max. 3)
    this.nextHeart = (this.nextHeart ?? (this.mode === 'birthday' ? rand(9, 14) : rand(18, 26))) - dt;
    if (this.nextHeart <= 0) {
      this.nextHeart = this.mode === 'birthday' ? rand(14, 20) : this.mode === 'horror' ? rand(28, 38) : rand(22, 30);
      if (this.hearts < 3) this.items.push(this.makeItem('heart', V.w + 40 + this.nextGap * 0.5, pick([24, 70, 105])));
    }
    this.nextPower -= dt;
    if (this.nextPower <= 0) {
      this.nextPower = this.mercy >= 1 ? rand(12, 18) : rand(22, 34);
      const type = this.mode === 'horror' || this.hero ? 'fips' : (Math.random() < 0.55 ? 'fips' : 'hammer');
      this.items.push(this.makeItem(type, V.w + 40 + this.nextGap * 0.5, 60));
    }
    if (this.mode !== 'horror') this.spawnCameos(dt);
  }

  /** Legt ein Kerzen-Muster an und gibt die Anzahl zurück (ca. 1 Kerze alle 2 s). */
  spawnCandles(ob, x) {
    const add = (cx, cy) => this.items.push(this.makeItem('candle', cx, cy));
    const r = Math.random();
    if (ob.fly === 'mid') { add(x + ob.w / 2, 16); return 1; }
    if (r < 0.2 && !ob.fly) { // Bogen über dem Hindernis -> Springen lohnt sich
      add(x - 34, 62); add(x + ob.w / 2, 104); add(x + ob.w + 34, 62); return 3;
    }
    const gx = x + ob.w + this.nextGap * 0.45;
    if (r < 0.45) { add(gx - 18, 18); add(gx + 18, 18); return 2; }
    if (r < 0.75) { add(gx, 18); return 1; }
    add(gx, 112); return 1; // hoch: springen!
  }

  spawnCameos(dt) {
    const list = (this.biome && this.cfg.biomeCameos?.[this.biome.id]) || this.cfg.cameos || [];
    if (!list.length) return;
    this.nextCameo -= dt;
    if (this.nextCameo <= 0) {
      this.nextCameo = this.state === 'idle' ? rand(6, 9) : rand(16, 26);
      const c = list[this.cameoIdx++ % list.length];
      this.cameos.push({ ...c, x: this.V.w + 60, t: 0, said: false, threw: false, color: pick(['#5b7bd5', '#d55b8f', '#3ea37a', '#d58a3e']) });
    }
  }

  updateCameos() {
    for (const c of this.cameos) {
      if (!c.said && c.x < this.V.w - 90) { c.said = true; c.sayT = 0; sfx('cheer'); }
      if (c.said) c.sayT += 1 / 60;
      if (c.throws && !c.threw && this.state === 'run' && c.x < PLAYER_X + 330) {
        c.threw = true;
        const it = this.makeItem(this.M.collect === 'candle' ? 'candle' : pick(['pizza', 'burger', 'nachos', 'wine']), c.x, 70);
        it.flying = true; it.vx = -90; it.vy = 420; it.restY = 70; it.y = 70;
        this.items.push(it);
      }
    }
  }

  updateSpecials(dt) {
    const p = this.p, V = this.V;
    this.updateHero(dt);
    this.updateOma(dt);
    const active = this.state === 'run' || this.state === 'idle';
    // Hagen läuft Kimi hinterher ("Payback!") – holt sie aber nie ein
    if (this.chase) {
      const c = this.chase; c.t += dt;
      const target = c.t < 4.2 ? p.x - 78 + Math.sin(c.t * 2.2) * 14 : -120;
      c.x += (target - c.x) * Math.min(1, dt * (c.t < 4.2 ? 1.8 : 0.9));
      if (c.t > 4.2 && !c.gaveUp) { c.gaveUp = true; if (this.state === 'run') { this.stats.chases++; this.events.onChase?.(); } this.fx.text(c.x + 10, V.groundY - 95, 'Puh…', { color: '#fff', size: 14 }); }
      if (c.t > 7) this.chase = null;
    } else if (active && this.cfg.chaser && this.mode !== 'horror' && !this.hero && !this.omaRide) {
      this.nextChase -= dt;
      if (this.nextChase <= 0) { this.nextChase = rand(22, 32); this.chase = { x: -60, t: 0, face: this.cfg.chaser.face, line: this.cfg.chaser.line }; }
    }
    // Fips flitzt durchs Bild, überholt und springt wieder raus
    if (this.dash) {
      const d = this.dash; d.t += dt;
      d.x += (this.state === 'idle' ? 330 : 420) * dt;
      if (d.x > V.w * 0.62 && !d.jumped) { d.jumped = true; d.vy = 520; this.fx.text(d.x, V.groundY - 60, this.green ? 'Igitt, grün! 🤢' : pick(this.cfg.catLines || ['Miau!']), { color: '#ffb36b', size: 16 }); sfx('meow'); }
      if (d.jumped) { d.vy -= 1300 * dt; d.y = Math.max(0, d.y + d.vy * dt); }
      if (d.x > V.w + 80) this.dash = null;
    } else if (active && this.mode !== 'horror' && this.fips <= 0 && this.biome !== FIPSLAND) {
      this.nextDash -= dt;
      if (this.nextDash <= 0) { this.nextDash = this.state === 'idle' ? rand(7, 10) : rand(18, 28); this.dash = { x: -50, y: 0, t: 0 }; }
    }
  }

  nextBiome() {
    this.prevBiome = this.biome; this.biomeFade = 0;
    this.biomeIdx = (this.biomeIdx + 1) % this.worldList.length; this.biome = this.worldList[this.biomeIdx];
    this.stats.worlds.add(this.biome.id); this.events.onWorld?.(this.biome.id, this.stats.worlds.size);
    this.nextBiomeAt += 60;
    // Cameos der alten Welt, die noch nicht im Bild sind, nicht mit rübernehmen
    this.cameos = this.cameos.filter((c) => c.x < this.V.w);
    this.nextCameo = Math.max(this.nextCameo, 3);
    this.events.onToast?.(`📍 ${biomeName(this.biome)}`);
    sfx('memory');
  }

  enterFipsland() {
    this.savedBiome = this.biome; this.prevBiome = this.biome; this.biome = FIPSLAND; this.biomeFade = 0;
    this.fipsT = 14; this.obstacles = []; this.items = this.items.filter((i) => !i.bad);
    this.flash = 0.8; sfx('power'); sfx('meow');
    this.events.onToast?.('📦 Fips’ Geheimversteck! Sammle Leckerlis! 🐾');
    this.events.onAchieve?.('fipsbox');
  }

  leaveFipsland() {
    this.prevBiome = this.biome; this.biome = this.savedBiome || this.worldList[this.biomeIdx]; this.biomeFade = 0;
    this.events.onToast?.(`📍 Zurück: ${biomeName(this.biome)}`);
  }

  summonFips() { if (!this.dash && this.fips <= 0 && this.biome !== FIPSLAND) this.dash = { x: -50, y: 0, t: 0 }; }

  // Super-Christoph: einfliegen -> landen -> 5 s alles zerstören -> abheben
  updateHero(dt) {
    const p = this.p, V = this.V, H = this.cfg.heroLines || {};
    const zombie = this.mode === 'horror';
    if (!this.hero) {
      if (this.state !== 'run' || this.fipsT > 0 || this.chase || this.omaRide || this.hammer > 0) return;
      this.nextHero -= dt;
      if (this.nextHero <= 0) {
        this.hero = { ph: 'in', t: 0, x: -110, y: 120, punch: 0 };
        this.items = this.items.filter((i) => i.type !== 'hammer');
        sfx('launch'); this.events.onAchieve?.('hero');
      }
      return;
    }
    const h = this.hero; h.t += dt; h.punch = Math.max(0, h.punch - dt);
    if (this.state !== 'run' && h.ph !== 'out') { h.ph = 'out'; h.t = 0; }
    if (h.ph === 'in') {
      const k = Math.min(1, h.t / 1.1), e = k * k * (3 - 2 * k);
      h.x = -110 + (p.x - 70 + 110) * k; h.y = 120 * (1 - e) + Math.sin(k * Math.PI) * 10;
      if (k >= 1) {
        h.ph = 'land'; h.t = 0; h.y = 0; this.shake = 12; sfx('smash'); sfx('boom');
        this.fx.burst(h.x, V.groundY, { n: 26, type: 'smoke', colors: ['#d7ccc8', '#ffffff'], speed: 160, size: 6, gravity: -30, spread: Math.PI, angle: -Math.PI / 2 });
        h.say = zombie ? pick(H.zombieLand || ['BRAAAINS… äh, POW!']) : pick(H.land || ['Keine Angst!']);
      }
    } else if (h.ph === 'land') {
      h.x = p.x - 70;
      if (h.t > 0.8) { h.ph = 'smash'; h.t = 0; sfx('power'); }
    } else if (h.ph === 'smash') {
      const tx = p.x + 150;
      h.x += (tx - h.x) * Math.min(1, dt * 4); h.y = 34 + Math.sin(h.t * 4) * 5;
      for (const o of this.obstacles) {
        if (o.knock || o.secret || o.x > h.x + 170 || o.x < p.x + 5) continue;
        o.knock = { vx: 520, vy: 820, vr: 11 };
        const ox = o.x + o.w / 2, oy = this.screenY(o.yOff + 24);
        this.fx.text(ox, oy - 14, pick(H.pow || ['POW!', 'BAM!', 'KRACH!', 'ZACK!', 'WUMMS!']), { color: pick(['#ffd23f', '#ff4fa3', '#3ee6b4']), size: 24 });
        this.fx.burst(ox, oy, { n: 18, colors: ['#ffd23f', '#ffffff', '#ff7b39'], speed: 280, size: 3.2 });
        h.punch = 0.25; this.shake = Math.max(this.shake, 5); sfx('smash');
      }
      if (h.t > 5) { h.ph = 'out'; h.t = 0; h.say = pick(H.out || ['Bis später!']); }
    } else if (h.ph === 'out') {
      h.x += 560 * dt; h.y += 70 * dt;
      if (h.y > 420 || h.x > V.w + 120) { this.hero = null; this.nextHero = rand(40, 55); }
    }
  }

  // Oma Inge rast auf der Rollator-Rakete vorbei und lässt Graupensuppe (= Herz) fallen
  updateOma(dt) {
    const p = this.p, V = this.V;
    if (!this.omaRide) {
      if (this.state !== 'run' || this.hero || this.chase || this.fipsT > 0) return;
      this.nextOma -= dt;
      if (this.nextOma <= 0) { this.omaRide = { x: -90, t: 0, dropped: false, say: pick(this.cfg.omaRideLines || ['Aus dem Weg, Kind!']) }; sfx('launch'); }
      return;
    }
    const o = this.omaRide; o.t += dt;
    o.x += (o.x < p.x + 40 ? 330 : 420) * dt;
    if (o.t % 0.05 < dt) this.fx.list.push({ x: o.x - 40, y: V.groundY - 22, vx: -60 - Math.random() * 40, vy: -10 + Math.random() * 20, life: 0.7, max: 0.7, color: 'rgba(200,200,200,0.8)', size: 3 + Math.random() * 2, gravity: -20, type: 'smoke', rot: 0, vr: 0, drag: 1 });
    if (!o.dropped && o.x > p.x + 110) {
      o.dropped = true;
      const it = this.makeItem('soup', o.x, 40); it.flying = true; it.vx = -40; it.vy = 260; it.restY = 34;
      this.items.push(it);
      this.fx.text(o.x, V.groundY - 90, pick(this.cfg.omaDropLines || ['Hier, Kind – iss was!']), { color: '#fff', size: 15, life: 1.4 });
    }
    if (o.x > V.w + 120) { this.omaRide = null; this.nextOma = rand(38, 52); }
  }

  drawHeroFx(g) {
    const h = this.hero; if (!h) return;
    const V = this.V, zombie = this.mode === 'horror';
    const pose = h.ph === 'land' ? 'land' : 'fly';
    const yy = V.groundY - h.y;
    if (h.ph !== 'land') { g.fillStyle = 'rgba(0,0,0,0.15)'; g.beginPath(); g.ellipse(h.x, V.groundY + 2, Math.max(4, 22 - h.y * 0.08), 4, 0, 0, 7); g.fill(); }
    drawHero(g, h.x, yy, { pose, t: this.t, zombie, scale: CHAR_SCALE * 1.18 });
    if (h.say && ((h.ph === 'land' && h.t < 0.8) || (h.ph === 'smash' && h.t < 1.2) || (h.ph === 'out' && h.t < 1.0))) speech(g, h.x - 10, yy - 108, h.say);
  }

  makeObstacle(type, x) {
    const o = { type, x, t: 0, yOff: 0, rot: 0, rects: [] };
    const def = OBS[type];
    if (def && !def.fly) { def.make(o); return o; }
    if (def && def.fly) type = 'flyshirt';
    if (type === 'candles') {
      const n = 1 + ((Math.random() * (this.score > 30 ? 3 : 2)) | 0);
      o.candles = [];
      for (let i = 0; i < n; i++) {
        const h = rand(28, 44);
        o.candles.push({ dx: i * 13, h, color: pick(['#ff6fae', '#7cc6ff', '#ffd23f', '#3ee6b4', '#c77dff']) });
        o.rects.push({ x: i * 13, w: 9, y0: 0, y1: h });
      }
      o.w = n * 13;
    } else if (type === 'shirt') {
      o.w = 40; o.rects.push({ x: 4, w: 32, y0: 0, y1: 50 });
    } else if (type === 'height') {
      o.w = 32; o.rects.push({ x: 12, w: 8, y0: 0, y1: 74 }, { x: 0, w: 32, y0: 54, y1: 76 });
    } else if (type === 'alarm') {
      o.w = 30; o.rects.push({ x: 2, w: 26, y0: 0, y1: 30 });
    } else if (type === 'tax') {
      o.h = rand(34, 48); o.w = 34; o.rects.push({ x: 0, w: 34, y0: 0, y1: o.h });
    } else if (type === 'rille') {
      o.w = 66; o.rects.push({ x: 0, w: 66, y0: 0, y1: 26 });
    } else if (type === 'fish') {
      o.w = 42; o.rects.push({ x: 2, w: 38, y0: 0, y1: 20 });
    } else if (type === 'merz') {
      o.w = 46; o.rects.push({ x: 19, w: 8, y0: 0, y1: 42 }, { x: 0, w: 46, y0: 40, y1: 80 });
    } else if (type === 'flyshirt' || type === 'ghost' || type === 'stink') {
      const v = pick(['low', 'mid', 'mid', 'mid', 'high']);
      o.fly = v; o.w = 38; o.extraV = 40;
      const y0 = v === 'low' ? 12 : v === 'mid' ? DUCK_H + 10 : STAND_H + 16;
      o.baseY = y0;
      o.rects.push({ x: 4, w: 30, y0: 0, y1: 26 });
      o.yOff = y0;
    }
    return o;
  }

  makeItem(type, x, y) { return { type, x, y, t: Math.random() * 6, taken: false, bad: !!assets.config.items[type]?.bad }; }

  playerBox() {
    const p = this.p;
    return { x0: p.x - 12, x1: p.x + 14, y0: p.y + 2, y1: p.y + (p.duck && p.y < 1 ? DUCK_H : STAND_H) };
  }

  collide() {
    const P = this.playerBox(), p = this.p;
    for (const o of this.obstacles) {
      if (o.knock) continue;
      if (o.fly) o.yOff = o.baseY + Math.sin(o.t * 5) * 3;
      for (const r of o.rects) {
        const x0 = o.x + r.x + 3, x1 = o.x + r.x + r.w - 3, y0 = o.yOff + r.y0 + 2, y1 = o.yOff + r.y1 - 2;
        if (P.x1 > x0 && P.x0 < x1 && P.y1 > y0 && P.y0 < y1) { this.hit(o); break; }
      }
    }
    for (const it of this.items) {
      if (it.taken) continue;
      const iy = it.y + Math.sin(it.t * 4) * 4;
      if (P.x1 > it.x - 14 && P.x0 < it.x + 14 && P.y1 > iy - 14 && P.y0 < iy + 14) this.collect(it, iy);
    }
  }

  screenY(h) { return this.V.groundY - h; }

  hit(o) {
    const p = this.p;
    if (o.secret) { o.knock = { vx: 0, vy: -2000, vr: 0 }; o.yOff = -500; this.enterFipsland(); return; }
    const ox = o.x + o.w / 2, oy = this.screenY(o.yOff + 20);
    if (this.hammer > 0) {
      o.knock = { vx: 0, vy: -2000, vr: 0 }; o.yOff = -500;
      this.fx.burst(ox, oy, { n: 26, colors: ['#9a8a7a', '#c9b8a5', '#6ab0a8', '#d9d0c4'], speed: 320, type: 'rubble', size: 5, gravity: 900, spread: Math.PI, angle: -Math.PI / 2 });
      this.fx.text(ox, oy - 30, pick(this.cfg.hammerLines || ['ABRISS!']), { color: '#ffd23f', size: 20 });
      this.shake = 10; sfx('smash');
      return;
    }
    if (this.fips > 0) {
      o.knock = { vx: 420, vy: 700, vr: 9 };
      this.fx.text(ox, oy - 30, pick(this.cfg.catLines || ['Miau!']), { color: '#ffb36b', size: 18 });
      this.fx.burst(ox, oy, { n: 10, colors: ['#e8843a', '#fff'], speed: 200 });
      sfx('meow');
      return;
    }
    if (p.invuln > 0) return;
    if (this.hearts > 0) {
      this.hearts--; p.invuln = 1.6; this.shake = 8;
      o.knock = { vx: 380, vy: 600, vr: 7 };
      p.expr = 'sad'; p.exprT = 1.0;
      sfx('hurt'); this.events.onHearts?.(this.hearts);
      return;
    }
    this.die(o.type);
  }

  collect(it, iy) {
    const p = this.p, cfg = this.cfg;
    it.taken = true;
    this.stats.items[it.type] = (this.stats.items[it.type] || 0) + 1;
    if (it.bad) this.stats.bad = true;
    this.events.onCollect?.(it.type);
    if (it.type === 'treat') {
      this.score += 3;
      this.fx.text(it.x, this.screenY(iy) - 16, pick(['Leckerli!', '+3 🐾', 'Mjam!']), { color: '#ff6fae', size: 16 });
      sfx('collect'); return;
    }
    if (it.type === 'fips') {
      this.fips = 7; sfx('meow');
      this.fx.text(it.x, this.screenY(iy) - 20, `${cfg.catName || 'Fips'} hilft!`, { color: '#ffb36b', size: 22 });
      this.events.onToast?.(`🐱 ${cfg.catName || 'Fips'} räumt dir den Weg frei!`);
      return;
    }
    if (it.type === 'hammer') {
      this.hammer = 5.5; sfx('power');
      this.fx.text(it.x, this.screenY(iy) - 20, 'STEMMHAMMER!', { color: '#ffd23f', size: 22 });
      this.events.onToast?.('🔨 Abriss-Modus: Alles wird weggestemmt!');
      return;
    }
    if (it.type === 'monkey') {
      this.score += 10; p.expr = 'happy'; p.exprT = 0.9;
      this.fx.text(it.x, this.screenY(iy) - 20, pick(['AFFE! 🐒', 'Uh uh ah ah!', '+10 🐒']), { color: '#ffd23f', size: 22 });
      this.fx.burst(it.x, this.screenY(iy), { n: 14, colors: ['#7b4a26', '#e9c39b', '#ffd23f'], speed: 170 });
      sfx('cheer');
      return;
    }
    if (it.type === 'soup') {
      this.hearts = Math.min(3, this.hearts + 1);
      this.fx.text(it.x, this.screenY(iy) - 20, 'Graupensuppe stärkt! ❤️', { color: '#ffd23f', size: 18 });
      this.fx.burst(it.x, this.screenY(iy), { n: 14, colors: ['#fff', '#ffe0b2', '#ff6b8a'], speed: 160 });
      p.expr = 'happy'; p.exprT = 0.8; sfx('heart'); this.events.onHearts?.(this.hearts); this.events.onAchieve?.('soup');
      return;
    }
    if (it.type === 'heart') {
      this.hearts = Math.min(3, this.hearts + 1);
      if (this.hearts >= 3) this.events.onAchieve?.('hearts');
      this.fx.text(it.x, this.screenY(iy) - 20, '+1 ❤️', { color: '#ff6b8a', size: 22 });
      this.fx.burst(it.x, this.screenY(iy), { n: 16, colors: ['#ff4f6d', '#ffb3c1', '#fff'], speed: 190, size: 2.8 });
      p.expr = 'happy'; p.exprT = 0.7;
      sfx('heart'); this.events.onHearts?.(this.hearts);
      return;
    }
    if (it.type === 'candle') {
      this.score += 1;
      const n = Math.floor(this.score);
      this.bigNum = { n, t: 0 };
      p.expr = 'happy'; p.exprT = 0.5;
      this.fx.burst(it.x, this.screenY(iy), { n: 14, colors: ['#ffd23f', '#ff9f1c', '#fff3a0'], speed: 170, size: 2.6 });
      sfx('candle', n);
      if (n >= this.target) this.startFinale();
      return;
    }
    const def = cfg.items[it.type] || { points: 5 };
    if (it.bad && this.M.collect) {
      this.score = Math.max(0, this.score - 2);
      p.swell = 1; p.expr = 'shock'; p.exprT = 1.2; this.shake = 6;
      this.fx.text(it.x, this.screenY(iy) - 24, def.line || 'ALLERGIE!', { color: '#ff5b5b', size: 20 });
      this.fx.text(it.x, this.screenY(iy), '-2 🕯️', { color: '#ff5b5b', size: 18 });
      sfx('bad');
      return;
    }
    if (this.M.collect) { // Essen im Geburtstags-Modus: nur Spaß, keine Punkte
      p.expr = 'happy'; p.exprT = 0.7;
      this.fx.text(it.x, this.screenY(iy) - 18, pick(['Mmmh!', 'Lecker!', 'Yummy!']), { color: '#ffd23f', size: 18 });
      sfx(it.type === 'wine' ? 'wine' : 'collect');
      return;
    }
    if (it.bad) {
      if (this.mode === 'horror' && this.fips <= 0 && this.hammer <= 0 && p.invuln <= 0) { this.die(it.type); return; }
      this.score = Math.max(0, this.score + def.points);
      p.swell = 1; p.expr = 'shock'; p.exprT = 1.2; this.shake = 6;
      this.fx.text(it.x, this.screenY(iy) - 24, def.line || 'ALLERGIE!', { color: '#ff5b5b', size: 20 });
      this.fx.text(it.x, this.screenY(iy), `${def.points}`, { color: '#ff5b5b', size: 18 });
      this.fx.burst(it.x, this.screenY(iy), { n: 14, colors: ['#ff5b5b', '#ffb3b3'], speed: 180 });
      sfx('bad');
      return;
    }
    this.score += def.points;
    p.expr = 'happy'; p.exprT = 0.7;
    const label = it.type === 'egg' ? 'EIERKOPF!' : `+${def.points}`;
    this.fx.text(it.x, this.screenY(iy) - 18, label, { color: '#ffd23f', size: it.type === 'egg' ? 22 : 18 });
    this.fx.burst(it.x, this.screenY(iy), { n: 12, speed: 160, size: 2.5 });
    sfx(it.type === 'wine' ? 'wine' : 'collect');
  }

  die(cause) {
    const p = this.p;
    this.state = 'dying';
    p.expr = 'shock'; p.exprT = 0.45; p.vy = 520; p.duck = false;
    this.shake = 14; this.flash = 0.5;
    this.deathInfo = { cause, score: Math.floor(this.score), mode: this.mode, stats: this.stats, time: this.t };
    this.polaroids = [];
    sfx('hit'); sfx('no');
  }

  startFinale() {
    this.state = 'finale';
    this.p.expr = 'party'; this.p.exprT = 999; this.p.duck = false;
    for (const o of this.obstacles) {
      this.fx.burst(o.x + o.w / 2, this.screenY(o.yOff + 20), { n: 30, type: 'confetti', speed: 260, size: 4, gravity: 400 });
    }
    this.obstacles = []; this.items = this.items.filter((i) => !i.bad);
    this.flash = 0.8; this.shake = 6;
    sfx('fanfare');
    this.events.onFinaleStart?.();
  }

  checkMilestones() {
    const mems = this.cfg.memories || [];
    if (this.milestones.length && this.score >= this.milestones[0]) {
      const m = this.milestones.shift();
      this.showMemory(mems[this.memIdx++ % Math.max(1, mems.length)], m);
    }
    if (this.mode === 'endless' && this.score >= this.nextEndlessMemory) {
      this.nextEndlessMemory += 75;
      if (mems.length) this.showMemory(mems[this.memIdx++ % mems.length], Math.floor(this.score));
      else this.fx.text(this.V.w / 2, this.V.groundY - 150, `${Math.floor(this.score)}!`, { color: '#ffd23f', size: 40, life: 1.5 });
    }
  }

  showMemory(mem, milestone) {
    this.polaroids.push({ mem: mem || null, t: 0, life: 3.6, rot: rand(-0.12, 0.12), milestone });
    sfx('memory');
  }

  // ------------------------------------------------------------------ Draw
  draw(g) {
    const V = this.V;
    const night = 0;
    g.save();
    if (this.shake > 0) g.translate(rand(-1, 1) * this.shake * 0.5, rand(-1, 1) * this.shake * 0.5);
    if (this.biome) {
      const bg = (b) => { if (!drawBiomeBg(g, V, b.id, this.bgOffset, this.t)) drawBackground(g, V, 'day', this.bgOffset, this.t, 0); };
      if (this.prevBiome && this.biomeFade < 1) { bg(this.prevBiome); g.save(); g.globalAlpha = this.biomeFade; bg(this.biome); g.restore(); }
      else bg(this.biome);
      if (this.biomeFade < 1) {
        const a = Math.sin(this.biomeFade * Math.PI);
        g.save(); g.globalAlpha = a; g.textAlign = 'center'; g.font = `900 ${Math.min(34, V.w / 14)}px ui-rounded, system-ui, sans-serif`;
        g.lineWidth = 6; g.strokeStyle = 'rgba(0,0,0,0.5)'; const ty = V.groundY * 0.35;
        g.strokeText(`📍 ${biomeName(this.biome)}`, V.w / 2, ty, V.w - 30); g.fillStyle = '#fff'; g.fillText(`📍 ${biomeName(this.biome)}`, V.w / 2, ty, V.w - 30);
        g.restore();
      }
    } else drawBackground(g, V, this.M.theme, this.bgOffset, this.t, night);
    for (const c of this.cameos) this.drawCameo(g, c);
    outlined(g, this.mode === 'horror' ? 'rgba(225,255,210,0.95)' : 'rgba(40,14,48,0.95)', (lg) => {
      for (const o of this.obstacles) this.drawObstacle(lg, o);
      for (const it of this.items) this.drawItem(lg, it);
    });
    for (const o of this.obstacles) if (!o.knock && !o.fly) {
      g.fillStyle = 'rgba(0,0,0,0.22)'; g.beginPath(); g.ellipse(o.x + o.w / 2, V.groundY + 2, o.w * 0.6, 4, 0, 0, 7); g.fill();
    }
    if (this.chase) {
      const c = this.chase;
      drawPerson(g, c.x, V.groundY, { faceKey: c.face, t: this.t, color: '#5b7bd5', scale: 0.78, run: true, expr: 'happy' });
      if (c.t > 0.6 && c.t < 4.2) speech(g, c.x - 4, V.groundY - 118, c.line || 'Payback!');
    }

    const p = this.p;
    if (this.fips > 0) {
      const blink = this.fips < 1.5 && Math.floor(this.t * 10) % 2;
      if (!blink) drawCat(g, p.x + 46 + Math.sin(this.t * 3) * 8, V.groundY, { phase: p.phase * 1.4, scale: 0.85, t: this.t });
    }
    const pose = this.state === 'dying' ? 'dead' : this.state === 'finale' ? (this.speed > 5 ? 'run' : 'cheer') : this.state === 'idle' ? 'run' : p.y > 0.5 ? 'jump' : p.duck ? 'duck' : 'run';
    const blink = p.invuln > 0 && Math.floor(this.t * 12) % 2;
    if (!blink) {
      // Schatten
      g.fillStyle = 'rgba(0,0,0,0.18)';
      g.beginPath(); g.ellipse(p.x + 2, V.groundY + 2, Math.max(6, 20 - p.y * 0.08), 4, 0, 0, 7); g.fill();
      drawCharacter(g, p.x, V.groundY - p.y, {
        pose, phase: p.phase, outfit: this.outfit, expr: p.expr, scale: CHAR_SCALE, t: this.t, swell: p.swell, headScale: this.eggT > 0 ? 1.9 : 0,
        rot: this.state === 'dying' ? -Math.min(1.2, this.deadT * 4) : 0,
      });
      if (this.hammer > 0 && this.state === 'run') drawJackhammer(g, p.x + 22, V.groundY - p.y - 28, this.t, this.hammer < 1.5);
    }
    if (this.state === 'finale' && this.speed <= 5) {
      drawCat(g, p.x - 55, V.groundY, { pose: 'sit', scale: 1, t: this.t });
    }
    if (this.dash) drawCat(g, this.dash.x, V.groundY - this.dash.y, { phase: this.t * 16, scale: 0.9, t: this.t });
    if (this.omaRide) {
      const o = this.omaRide;
      drawRollatorOma(g, o.x, V.groundY, { t: this.t, scale: CHAR_SCALE * 1.05 });
      if (o.t < 1.8) speech(g, o.x - 30, V.groundY - 100, o.say);
    }
    this.drawHeroFx(g);
    this.fx.draw(g);
    for (const pl of this.polaroids) this.drawPolaroid(g, pl);
    if (this.bigNum) {
      const k = this.bigNum.t / 1.1, a = Math.sin(Math.min(1, k) * Math.PI);
      const size = Math.min(V.h * 0.42, V.w * 0.3) * (0.85 + k * 0.25);
      g.save(); g.globalAlpha = a * 0.85; g.textAlign = 'center'; g.textBaseline = 'middle';
      g.font = `900 ${size}px ui-rounded, system-ui, sans-serif`;
      const cy = Math.min(V.groundY * 0.5, V.groundY - size * 0.9);
      g.lineWidth = size * 0.08; g.strokeStyle = 'rgba(120,20,70,0.8)'; g.strokeText(String(this.bigNum.n), V.w / 2, cy);
      g.fillStyle = '#ffd23f'; g.fillText(String(this.bigNum.n), V.w / 2, cy);
      g.font = `800 ${size * 0.22}px ui-rounded, system-ui, sans-serif`; g.fillStyle = '#fff';
      g.fillText(`von ${this.target} Kerzen`, V.w / 2, cy + size * 0.62);
      g.restore();
    }
    g.restore();
    if (this.flash > 0) {
      g.fillStyle = this.mode === 'horror' ? `rgba(200,255,200,${this.flash * 0.6})` : `rgba(255,255,255,${this.flash * 0.6})`;
      g.fillRect(0, 0, V.w, V.h);
    }
    if (this.green) { g.fillStyle = 'rgba(70,200,70,0.13)'; g.fillRect(0, 0, V.w, V.h); }
    if (this.mode === 'horror') {
      const gr = g.createRadialGradient(p.x, V.groundY - 50, 80, p.x, V.groundY - 50, Math.max(V.w, V.h));
      gr.addColorStop(0, 'rgba(0,0,0,0)'); gr.addColorStop(1, 'rgba(0,0,0,0.75)');
      g.fillStyle = gr; g.fillRect(0, 0, V.w, V.h);
    }
  }

  drawCameo(g, c) {
    const V = this.V;
    if (c.flag) {
      drawFan(g, c.x, V.groundY - 6, { faceKey: c.face, t: c.t, color: c.color, scale: 0.72, flag: c.flag });
      if (Math.floor(c.t * 7 / Math.PI) !== c.lastHop) { c.lastHop = Math.floor(c.t * 7 / Math.PI); if (c.lastHop % 2 === 0) this.fx.burst(c.x, V.groundY - 90, { n: 6, type: 'confetti', speed: 90, size: 3, gravity: 200 }); }
      if (c.said && c.sayT < 2.6 && c.line) speech(g, c.x + 30, V.groundY - 150, c.line);
      return;
    }
    drawPerson(g, c.x, V.groundY - 6, { faceKey: c.face, t: c.t, color: c.color, oma: c.oma, scale: 0.72, wave: true });
    if (c.said && c.sayT < 2.6 && c.line) speech(g, c.x + 12, V.groundY - 112, c.line);
  }

  drawObstacle(g, o) {
    const V = this.V;
    const x = o.x, base = V.groundY - o.yOff;
    g.save();
    if (o.knock) { g.translate(x + o.w / 2, base - 20); g.rotate(o.rot); g.translate(-(x + o.w / 2), -(base - 20)); }
    if (OBS[o.type]) { OBS[o.type].draw(g, x, base, o); g.restore(); return; }
    if (o.type === 'candles') {
      for (const c of o.candles) {
        const cx = x + c.dx;
        g.fillStyle = c.color; roundRect(g, cx, base - c.h, 9, c.h, 2); g.fill();
        g.fillStyle = 'rgba(255,255,255,0.6)';
        for (let yy = base - c.h + 5; yy < base - 3; yy += 9) { g.save(); g.beginPath(); g.rect(cx, yy, 9, 3); g.clip(); g.fillRect(cx, yy, 9, 3); g.restore(); }
        g.strokeStyle = '#333'; g.lineWidth = 1.2; g.beginPath(); g.moveTo(cx + 4.5, base - c.h); g.lineTo(cx + 4.5, base - c.h - 4); g.stroke();
        const fl = Math.sin(o.t * 18 + c.dx) * 1.2;
        const gl = g.createRadialGradient(cx + 4.5, base - c.h - 9, 1, cx + 4.5, base - c.h - 9, 14);
        gl.addColorStop(0, 'rgba(255,220,120,0.6)'); gl.addColorStop(1, 'rgba(255,220,120,0)');
        g.fillStyle = gl; g.beginPath(); g.arc(cx + 4.5, base - c.h - 9, 14, 0, 7); g.fill();
        g.fillStyle = '#ff9f1c'; g.beginPath(); g.ellipse(cx + 4.5 + fl * 0.3, base - c.h - 9, 3.4, 6 + fl, 0, 0, 7); g.fill();
        g.fillStyle = '#fff3a0'; g.beginPath(); g.ellipse(cx + 4.5, base - c.h - 7.5, 1.6, 3, 0, 0, 7); g.fill();
      }
    } else if (o.type === 'shirt') {
      g.strokeStyle = '#9aa3ad'; g.lineWidth = 3;
      g.beginPath(); g.moveTo(x + 4, base); g.lineTo(x + 20, base - 50); g.lineTo(x + 36, base); g.moveTo(x + 20, base - 50); g.lineTo(x + 20, base - 56); g.stroke();
      drawTee(g, x + 20, base - 46, 34, '#3fae3a', 0, o.t, false);
    } else if (o.type === 'height') {
      for (let i = 0; i < 6; i++) { g.fillStyle = i % 2 ? '#fff' : '#e8424f'; g.fillRect(x + 12, base - 12 * (i + 1), 8, 12); }
      g.fillStyle = '#ffd23f'; roundRect(g, x - 4, base - 78, 40, 24, 5); g.fill();
      g.strokeStyle = '#b8860b'; g.lineWidth = 1.5; g.stroke();
      g.fillStyle = '#3a2a10'; g.font = '900 8px sans-serif'; g.textAlign = 'center';
      g.fillText('MIND.', x + 16, base - 68); g.font = '900 10px sans-serif'; g.fillText('1,70 m', x + 16, base - 58);
    } else if (o.type === 'alarm') {
      const sh = Math.sin(o.t * 50) * 2;
      g.save(); g.translate(x + 15 + sh, base - 15);
      g.fillStyle = '#d93b3b'; g.beginPath(); g.arc(-9, -12, 6, 0, 7); g.arc(9, -12, 6, 0, 7); g.fill();
      g.fillStyle = '#e8424f'; g.beginPath(); g.arc(0, 0, 14, 0, 7); g.fill();
      g.fillStyle = '#fff'; g.beginPath(); g.arc(0, 0, 10.5, 0, 7); g.fill();
      g.fillStyle = '#222'; g.font = '900 7px sans-serif'; g.textAlign = 'center'; g.fillText('6:00', 0, 3);
      g.strokeStyle = '#222'; g.lineWidth = 2; g.beginPath(); g.moveTo(-8, 13); g.lineTo(-11, 17); g.moveTo(8, 13); g.lineTo(11, 17); g.stroke();
      g.restore();
      g.strokeStyle = '#ffd23f'; g.lineWidth = 2;
      if (Math.floor(o.t * 8) % 2) { g.beginPath(); g.moveTo(x - 4, base - 34); g.lineTo(x - 9, base - 38); g.moveTo(x + 34, base - 34); g.lineTo(x + 39, base - 38); g.stroke(); }
    } else if (o.type === 'tax') {
      const wob = Math.sin(o.t * 6) * 0.03;
      g.save(); g.translate(x + 17, base); g.rotate(wob);
      for (let yy = 0; yy < o.h; yy += 4) { g.fillStyle = yy % 8 ? '#f4f1ea' : '#e2ddd2'; g.fillRect(-17 + ((yy * 7) % 5) - 2, -yy - 4, 34, 4); }
      g.fillStyle = '#fff'; g.fillRect(-16, -o.h - 6, 32, 8);
      g.fillStyle = '#c0392b'; g.font = '900 7px sans-serif'; g.textAlign = 'center'; g.fillText('STEUER', 0, -o.h);
      g.fillStyle = '#555'; g.fillRect(-12, -o.h - 8, 4, 5); g.fillRect(8, -o.h - 8, 4, 5);
      g.restore();
    } else if (o.type === 'flyshirt') {
      drawTee(g, x + 19, base - 22, 34, '#3fae3a', Math.sin(o.t * 14), o.t, true);
    } else if (o.type === 'stink') {
      const yy = base - 14;
      g.fillStyle = 'rgba(140,200,60,0.85)';
      for (const [dx, dy, r] of [[0, 0, 11], [12, -5, 13], [25, 0, 10], [12, 5, 10]]) { g.beginPath(); g.arc(x + 6 + dx + Math.sin(o.t * 4 + dx) * 2, yy + dy, r, 0, 7); g.fill(); }
      g.strokeStyle = 'rgba(160,230,70,0.7)'; g.lineWidth = 2;
      for (let i = 0; i < 3; i++) { g.beginPath(); const sx = x + 8 + i * 10; g.moveTo(sx, yy - 16); g.bezierCurveTo(sx + 5, yy - 22, sx - 5, yy - 28, sx, yy - 34 - Math.sin(o.t * 6 + i) * 3); g.stroke(); }
      g.fillStyle = '#243a10'; g.font = '900 9px sans-serif'; g.textAlign = 'center'; g.fillText('PUH!', x + 19, yy + 3);
    } else if (o.type === 'rille') {
      const letters = 'RILLE';
      for (let i = 0; i < 5; i++) {
        const jx = Math.sin(o.t * 22 + i) * 1.2, jy = Math.cos(o.t * 19 + i * 2) * 1.2;
        g.fillStyle = ['#9bff3a', '#ff3b6b', '#9bff3a', '#ff3b6b', '#9bff3a'][i];
        roundRect(g, x + i * 13 + jx, base - 26 + jy, 12, 26, 3); g.fill();
        g.fillStyle = '#111'; g.font = '900 16px sans-serif'; g.textAlign = 'center'; g.fillText(letters[i], x + i * 13 + 6 + jx, base - 7 + jy);
      }
    } else if (o.type === 'fish') {
      g.fillStyle = '#7f8c9a';
      g.beginPath(); g.ellipse(x + 18, base - 9, 16, 8, 0, 0, 7); g.fill();
      g.beginPath(); g.moveTo(x + 32, base - 9); g.lineTo(x + 42, base - 17); g.lineTo(x + 42, base - 1); g.closePath(); g.fill();
      g.strokeStyle = '#4d5866'; g.lineWidth = 1.2;
      for (let i = 0; i < 4; i++) { g.beginPath(); g.moveTo(x + 12 + i * 5, base - 15); g.lineTo(x + 12 + i * 5, base - 3); g.stroke(); }
      g.strokeStyle = '#111'; g.lineWidth = 1.5; g.beginPath(); g.moveTo(x + 5, base - 12); g.lineTo(x + 9, base - 8); g.moveTo(x + 9, base - 12); g.lineTo(x + 5, base - 8); g.stroke();
      g.strokeStyle = 'rgba(160,230,70,0.75)'; g.lineWidth = 2;
      for (let i = 0; i < 3; i++) { const sx = x + 10 + i * 9; g.beginPath(); g.moveTo(sx, base - 20); g.bezierCurveTo(sx + 5, base - 26, sx - 5, base - 32, sx, base - 38 - Math.sin(o.t * 6 + i) * 3); g.stroke(); }
    } else if (o.type === 'merz') {
      g.fillStyle = '#6b4a2b'; g.fillRect(x + 20, base - 42, 6, 42);
      g.fillStyle = '#f4f1ea'; roundRect(g, x, base - 82, 46, 42, 3); g.fill();
      g.strokeStyle = '#1b2b5a'; g.lineWidth = 2; g.stroke();
      const mimg = assets.images.merz;
      if (mimg) { g.save(); g.beginPath(); g.rect(x + 3, base - 79, 40, 24); g.clip(); const sc = Math.max(40 / mimg.width, 24 / mimg.height); g.drawImage(mimg, x + 23 - mimg.width * sc / 2, base - 67 - mimg.height * sc / 2, mimg.width * sc, mimg.height * sc); g.restore(); }
      else { g.fillStyle = '#1b2b5a'; g.beginPath(); g.arc(x + 23, base - 69, 8, 0, 7); g.fill(); g.fillRect(x + 13, base - 61, 20, 6); }
      g.fillStyle = '#1b2b5a'; g.font = '900 9px sans-serif'; g.textAlign = 'center'; g.fillText('MERZ', x + 23, base - 45);
    } else if (o.type === 'ghost') {
      const yy = base - 26;
      g.fillStyle = 'rgba(230,255,230,0.92)';
      g.beginPath(); g.moveTo(x + 4, yy + 26);
      g.arc(x + 19, yy + 10, 15, Math.PI, 0);
      for (let i = 0; i <= 4; i++) g.lineTo(x + 34 - i * 7.5, yy + 26 + (i % 2 ? -4 : 2) + Math.sin(o.t * 10 + i) * 2);
      g.closePath(); g.fill();
      g.fillStyle = '#123'; g.beginPath(); g.ellipse(x + 14, yy + 8, 3, 4.5, 0, 0, 7); g.ellipse(x + 24, yy + 8, 3, 4.5, 0, 0, 7); g.fill();
      g.beginPath(); g.ellipse(x + 19, yy + 17, 3, 4, 0, 0, 7); g.fill();
    }
    g.restore();
  }

  drawItem(g, it) {
    const x = it.x, y = this.screenY(it.y + Math.sin(it.t * 4) * 4);
    g.save(); g.translate(x, y);
    if (it.bad) {
      const pulse = 0.5 + Math.sin(it.t * 10) * 0.5;
      g.strokeStyle = `rgba(255,60,60,${0.4 + pulse * 0.5})`; g.lineWidth = 3;
      g.beginPath(); g.arc(0, 0, 17 + pulse * 2, 0, 7); g.stroke();
    } else if (it.type === 'fips' || it.type === 'hammer') {
      const gl = g.createRadialGradient(0, 0, 2, 0, 0, 22);
      gl.addColorStop(0, 'rgba(255,255,255,0.9)'); gl.addColorStop(1, 'rgba(255,210,63,0)');
      g.fillStyle = gl; g.beginPath(); g.arc(0, 0, 22, 0, 7); g.fill();
    }
    drawItemIcon(g, it.type, it.t);
    g.restore();
  }

  drawPolaroid(g, pl) {
    const V = this.V;
    const k = pl.t < 0.4 ? 1 - (pl.t / 0.4) : pl.t > pl.life - 0.4 ? -((pl.t - (pl.life - 0.4)) / 0.4) : 0;
    const W = Math.min(150, V.w * 0.3), H = W * 1.15;
    const cx = V.w * 0.62 + k * V.w * 0.6, cy = Math.max(H / 2 + 50, V.groundY - 170) + Math.sin(pl.t * 2) * 4;
    g.save(); g.translate(cx, cy); g.rotate(pl.rot + k * 0.5);
    g.shadowColor = 'rgba(0,0,0,0.35)'; g.shadowBlur = 12; g.shadowOffsetY = 4;
    g.fillStyle = '#fffdf7'; g.fillRect(-W / 2, -H / 2, W, H);
    g.shadowColor = 'transparent';
    const iw = W - 14, ih = iw * 0.85;
    const img = pl.mem && assets.images[pl.mem.img];
    if (img) {
      const s = Math.max(iw / img.width, ih / img.height);
      g.save(); g.beginPath(); g.rect(-iw / 2, -H / 2 + 7, iw, ih); g.clip();
      g.drawImage(img, -img.width * s / 2, -H / 2 + 7 + ih / 2 - img.height * s / 2, img.width * s, img.height * s);
      g.restore();
    } else {
      g.fillStyle = '#d8d2e6'; g.fillRect(-iw / 2, -H / 2 + 7, iw, ih);
      g.font = '28px sans-serif'; g.textAlign = 'center'; g.fillText('📸', 0, -H / 2 + 7 + ih / 2 + 8);
    }
    g.fillStyle = '#333'; g.textAlign = 'center';
    g.font = '700 10px ui-rounded, system-ui, sans-serif';
    g.fillText(pl.mem?.caption || 'Erinnerung freigeschaltet!', 0, H / 2 - 16, W - 10);
    g.fillStyle = '#ff4fa3'; g.font = '900 9px ui-rounded, system-ui, sans-serif';
    g.fillText(`★ ${pl.milestone} ${this.M.collect ? 'Kerzen' : 'Punkte'} ★`, 0, H / 2 - 5);
    g.restore();
  }
}

// --------------------------------------------------------------------------
// Zeichnet etwas mit einer kräftigen Kontur, damit es sich vom Hintergrund abhebt.
const layerA = document.createElement('canvas'), layerB = document.createElement('canvas');
function outlined(g, color, fn) {
  const c = g.canvas;
  for (const L of [layerA, layerB]) if (L.width !== c.width || L.height !== c.height) { L.width = c.width; L.height = c.height; }
  const a = layerA.getContext('2d'), b = layerB.getContext('2d');
  a.setTransform(1, 0, 0, 1, 0, 0); a.clearRect(0, 0, c.width, c.height);
  a.setTransform(g.getTransform()); fn(a);
  b.setTransform(1, 0, 0, 1, 0, 0); b.clearRect(0, 0, c.width, c.height);
  b.globalCompositeOperation = 'source-over';
  const o = Math.max(2, Math.round(c.height / 260));
  for (const [dx, dy] of [[-1, 0], [1, 0], [0, -1], [0, 1], [-0.7, -0.7], [0.7, -0.7], [-0.7, 0.7], [0.7, 0.7]]) b.drawImage(layerA, dx * o, dy * o);
  b.globalCompositeOperation = 'source-in'; b.fillStyle = color; b.fillRect(0, 0, c.width, c.height);
  b.globalCompositeOperation = 'source-over';
  g.save(); g.setTransform(1, 0, 0, 1, 0, 0); g.drawImage(layerB, 0, 0); g.drawImage(layerA, 0, 0); g.restore();
}

function speech(g, x, y, text) {
  g.font = '800 11px ui-rounded, system-ui, sans-serif';
  const w = Math.min(160, g.measureText(text).width + 16);
  g.fillStyle = '#fff'; roundRect(g, x - 8, y - 18, w, 24, 10); g.fill();
  g.beginPath(); g.moveTo(x, y + 5); g.lineTo(x - 6, y + 14); g.lineTo(x + 8, y + 5); g.fill();
  g.fillStyle = '#222'; g.textAlign = 'left'; g.fillText(text, x, y - 2, w - 14);
}

function drawTee(g, cx, cy, w, color, flap, t, angry) {
  const h = w * 0.82, f = flap * 6;
  g.fillStyle = color;
  g.beginPath();
  g.moveTo(cx - w * 0.28, cy - h / 2);
  g.lineTo(cx - w * 0.5, cy - h * 0.3 + f); g.lineTo(cx - w * 0.38, cy - h * 0.08 + f);
  g.lineTo(cx - w * 0.28, cy - h * 0.2);
  g.lineTo(cx - w * 0.28, cy + h / 2); g.lineTo(cx + w * 0.28, cy + h / 2); g.lineTo(cx + w * 0.28, cy - h * 0.2);
  g.lineTo(cx + w * 0.38, cy - h * 0.08 + f); g.lineTo(cx + w * 0.5, cy - h * 0.3 + f);
  g.lineTo(cx + w * 0.28, cy - h / 2);
  g.quadraticCurveTo(cx, cy - h * 0.3, cx - w * 0.28, cy - h / 2);
  g.fill();
  g.fillStyle = 'rgba(0,0,0,0.15)'; g.fillRect(cx - w * 0.28, cy + h * 0.35, w * 0.56, 2);
  if (angry) {
    g.fillStyle = '#fff'; g.beginPath(); g.arc(cx - 5, cy - 1, 3.5, 0, 7); g.arc(cx + 5, cy - 1, 3.5, 0, 7); g.fill();
    g.fillStyle = '#111'; g.beginPath(); g.arc(cx - 4, cy, 1.7, 0, 7); g.arc(cx + 4, cy, 1.7, 0, 7); g.fill();
    g.strokeStyle = '#111'; g.lineWidth = 1.6;
    g.beginPath(); g.moveTo(cx - 9, cy - 6); g.lineTo(cx - 2, cy - 4); g.moveTo(cx + 9, cy - 6); g.lineTo(cx + 2, cy - 4); g.stroke();
    g.beginPath(); g.arc(cx, cy + 8, 3, Math.PI * 1.1, Math.PI * 1.9); g.stroke();
  }
}

function drawJackhammer(g, x, y, t, blink) {
  if (blink && Math.floor(t * 10) % 2) return;
  const v = Math.sin(t * 70) * 1.5;
  g.save(); g.translate(x + v, y); g.rotate(0.5);
  g.fillStyle = '#1f5fa8'; roundRect(g, -6, -14, 14, 22, 3); g.fill();
  g.fillStyle = '#e8424f'; g.fillRect(-6, -14, 14, 4);
  g.fillStyle = '#222'; g.fillRect(-10, -16, 22, 4);
  g.fillStyle = '#9aa3ad'; g.fillRect(-1, 8, 4, 18);
  g.beginPath(); g.moveTo(-3, 26); g.lineTo(5, 26); g.lineTo(1, 32); g.fill();
  g.restore();
  g.fillStyle = 'rgba(200,190,170,0.8)';
  for (let i = 0; i < 3; i++) { g.beginPath(); g.arc(x + 16 + Math.random() * 6, y + 26 + Math.random() * 4, 2 + Math.random() * 2, 0, 7); g.fill(); }
}

export function drawItemIcon(g, type, t = 0) {
  if (ITEM_ICONS[type]) { ITEM_ICONS[type](g, t); return; }
  if (type === 'monkey') { drawMonkey(g, 0, 2, t, 1.25, Math.sin(t * 2) > 0); return; }
  if (type === 'soup') {
    g.fillStyle = 'rgba(255,255,255,0.6)';
    for (let i = 0; i < 3; i++) { const yy = -10 - ((t * 20 + i * 6) % 14); g.beginPath(); g.arc(-5 + i * 5 + Math.sin(t * 4 + i), yy, 2.2, 0, 7); g.fill(); }
    g.fillStyle = '#f4f1ea'; g.beginPath(); g.ellipse(0, 4, 14, 4, 0, 0, 7); g.fill();
    g.fillStyle = '#ffffff'; g.beginPath(); g.moveTo(-11, -3); g.lineTo(11, -3); g.quadraticCurveTo(10, 7, 0, 7); g.quadraticCurveTo(-10, 7, -11, -3); g.fill();
    g.fillStyle = '#d7b47a'; g.beginPath(); g.ellipse(0, -3, 11, 3, 0, 0, 7); g.fill();
    g.fillStyle = '#f3e3c0'; for (const [px, py] of [[-5, -3], [0, -4], [4, -2.5], [-2, -2]]) { g.beginPath(); g.arc(px, py, 1, 0, 7); g.fill(); }
    g.fillStyle = '#ff4f6d'; g.font = '900 7px sans-serif'; g.textAlign = 'center'; g.fillText('♥', 0, 4.5);
    return;
  }
  if (type === 'heart') {
    const s = 1 + Math.sin(t * 7) * 0.08;
    g.save(); g.scale(s, s);
    const hp = () => { g.beginPath(); g.moveTo(0, 10); g.bezierCurveTo(-14, 0, -11, -11, 0, -5); g.bezierCurveTo(11, -11, 14, 0, 0, 10); g.closePath(); };
    const gl = g.createRadialGradient(0, 0, 2, 0, 0, 20); gl.addColorStop(0, 'rgba(255,90,130,0.45)'); gl.addColorStop(1, 'rgba(255,90,130,0)');
    g.fillStyle = gl; g.beginPath(); g.arc(0, 0, 20, 0, 7); g.fill();
    const gr = g.createLinearGradient(0, -10, 0, 10); gr.addColorStop(0, '#ff6f8e'); gr.addColorStop(1, '#d81b45');
    hp(); g.fillStyle = gr; g.fill();
    g.fillStyle = 'rgba(255,255,255,0.65)'; g.beginPath(); g.ellipse(-4.5, -3.5, 2.6, 1.6, -0.6, 0, 7); g.fill();
    g.restore();
    return;
  }
  if (type === 'candle') {
    const gl = g.createRadialGradient(0, -12, 1, 0, -12, 18);
    gl.addColorStop(0, 'rgba(255,220,120,0.8)'); gl.addColorStop(1, 'rgba(255,220,120,0)');
    g.fillStyle = gl; g.beginPath(); g.arc(0, -12, 18, 0, 7); g.fill();
    g.fillStyle = '#ff4fa3'; roundRect(g, -4.5, -6, 9, 20, 2); g.fill();
    g.fillStyle = '#fff'; g.fillRect(-4.5, -1, 9, 3); g.fillRect(-4.5, 6, 9, 3);
    g.strokeStyle = '#333'; g.lineWidth = 1.2; g.beginPath(); g.moveTo(0, -6); g.lineTo(0, -10); g.stroke();
    const fl = Math.sin(t * 18) * 1.2;
    g.fillStyle = '#ff9f1c'; g.beginPath(); g.ellipse(fl * 0.3, -14, 3.6, 6 + fl, 0, 0, 7); g.fill();
    g.fillStyle = '#fff3a0'; g.beginPath(); g.ellipse(0, -12.5, 1.7, 3, 0, 0, 7); g.fill();
    return;
  }
  if (type === 'wine') {
    g.fillStyle = 'rgba(255,255,255,0.65)';
    g.beginPath(); g.moveTo(-8, -12); g.lineTo(8, -12); g.quadraticCurveTo(9, 2, 0, 3); g.quadraticCurveTo(-9, 2, -8, -12); g.fill();
    g.fillStyle = '#8e1b3a';
    g.beginPath(); g.moveTo(-7.5, -6); g.lineTo(7.5, -6); g.quadraticCurveTo(8, 2, 0, 2.5); g.quadraticCurveTo(-8, 2, -7.5, -6); g.fill();
    g.fillStyle = 'rgba(255,255,255,0.85)'; g.fillRect(-1, 3, 2, 8); g.fillRect(-6, 11, 12, 2);
  } else if (type === 'pizza') {
    g.fillStyle = '#f2b64c'; g.beginPath(); g.moveTo(-11, -9); g.lineTo(11, -9); g.lineTo(0, 13); g.closePath(); g.fill();
    g.fillStyle = '#ffd86b'; g.beginPath(); g.moveTo(-9, -6); g.lineTo(9, -6); g.lineTo(0, 10); g.closePath(); g.fill();
    g.fillStyle = '#c0392b'; for (const [px, py] of [[-4, -3], [3, -2], [0, 4]]) { g.beginPath(); g.arc(px, py, 2.4, 0, 7); g.fill(); }
    g.fillStyle = '#c98a2e'; roundRect(g, -12, -12, 24, 5, 2.5); g.fill();
  } else if (type === 'burger') {
    g.fillStyle = '#e0a04a'; g.beginPath(); g.ellipse(0, -5, 12, 7, 0, Math.PI, 0); g.fill();
    g.fillStyle = '#fff'; for (const sx of [-5, 0, 5]) g.fillRect(sx, -9, 1.5, 1.5);
    g.fillStyle = '#5ec04a'; g.fillRect(-12, -5, 24, 3);
    g.fillStyle = '#ffd23f'; g.beginPath(); g.moveTo(-11, -2); g.lineTo(11, -2); g.lineTo(6, 2); g.lineTo(-6, 2); g.fill();
    g.fillStyle = '#6b3a1f'; roundRect(g, -12, 0, 24, 5, 2.5); g.fill();
    g.fillStyle = '#d9913d'; roundRect(g, -11, 5, 22, 5, 2.5); g.fill();
  } else if (type === 'nachos') {
    g.fillStyle = '#f0c040';
    for (const [nx, ny, r] of [[-6, -3, -0.3], [4, -5, 0.4], [0, -9, 0.1]]) {
      g.save(); g.translate(nx, ny); g.rotate(r); g.beginPath(); g.moveTo(-6, 4); g.lineTo(6, 4); g.lineTo(0, -7); g.fill(); g.restore();
    }
    g.fillStyle = '#ffb000'; g.beginPath(); g.arc(-1, -2, 3.5, 0, 7); g.fill();
    g.fillStyle = '#c0392b'; g.beginPath(); g.ellipse(0, 6, 12, 5, 0, 0, Math.PI); g.fill(); g.fillRect(-12, 2, 24, 4);
  } else if (type === 'fig') {
    g.fillStyle = '#6b2d6b'; g.beginPath(); g.moveTo(0, -12); g.quadraticCurveTo(12, 0, 8, 8); g.quadraticCurveTo(0, 14, -8, 8); g.quadraticCurveTo(-12, 0, 0, -12); g.fill();
    g.fillStyle = 'rgba(255,255,255,0.25)'; g.beginPath(); g.ellipse(-4, 0, 2, 4, 0.3, 0, 7); g.fill();
    g.strokeStyle = '#4a7a2a'; g.lineWidth = 2.5; g.beginPath(); g.moveTo(0, -11); g.lineTo(1, -15); g.stroke();
    skull(g, 9, -9);
  } else if (type === 'shrimp') {
    g.strokeStyle = '#ff8a6b'; g.lineWidth = 7; g.lineCap = 'round';
    g.beginPath(); g.arc(0, 0, 7, Math.PI * 0.1, Math.PI * 1.4); g.stroke();
    g.strokeStyle = '#ffb59e'; g.lineWidth = 1.2;
    for (let a = 0.3; a < 1.4; a += 0.25) { g.beginPath(); g.moveTo(Math.cos(a * Math.PI) * 4, Math.sin(a * Math.PI) * 4); g.lineTo(Math.cos(a * Math.PI) * 10, Math.sin(a * Math.PI) * 10); g.stroke(); }
    g.fillStyle = '#ff6b4a'; g.beginPath(); g.moveTo(6, 3); g.lineTo(13, 0); g.lineTo(12, 7); g.fill();
    g.fillStyle = '#111'; g.beginPath(); g.arc(-4, -6, 1.3, 0, 7); g.fill();
    skull(g, 9, -9);
  } else if (type === 'egg') {
    g.fillStyle = '#fbf6ea'; g.beginPath(); g.ellipse(0, 1, 11, 14, 0, 0, 7); g.fill();
    const { img } = getFace('her', 'happy');
    g.save(); g.beginPath(); g.ellipse(0, 1, 11, 14, 0, 0, 7); g.clip();
    g.globalAlpha = 0.95; g.drawImage(img, -10, -12, 20, 24); g.restore();
    g.globalAlpha = 1;
  } else if (type === 'fips') {
    drawCat(g, -2, 12, { pose: 'sit', scale: 0.55, t });
  } else if (type === 'hammer') {
    drawJackhammer(g, -6, -10, t, false);
  }
}

function skull(g, x, y) {
  g.fillStyle = '#fff'; g.beginPath(); g.arc(x, y, 4.5, 0, 7); g.fill(); g.fillRect(x - 2.5, y + 2, 5, 3);
  g.fillStyle = '#c00'; g.beginPath(); g.arc(x - 1.6, y - 0.5, 1.2, 0, 7); g.arc(x + 1.6, y - 0.5, 1.2, 0, 7); g.fill();
}

// --------------------------------------------------------------------------
// Hintergründe
// --------------------------------------------------------------------------
export function drawBackground(g, V, theme, off, t, night = 0) {
  const { w, h, groundY } = V;
  let top, bot;
  if (theme === 'birthday') { top = '#ff9ccf'; bot = '#ffe3b8'; }
  else if (theme === 'horror') { top = '#07040f'; bot = '#2a0f2f'; }
  else { top = lerpColor('#5ec2ff', '#0b1030', night); bot = lerpColor('#fff1c9', '#3a2a5a', night); }
  const sky = g.createLinearGradient(0, 0, 0, groundY);
  sky.addColorStop(0, top); sky.addColorStop(1, bot);
  g.fillStyle = sky; g.fillRect(0, 0, w, groundY + 1);

  if (theme === 'horror') {
    g.fillStyle = '#c0202f'; g.shadowColor = '#ff3040'; g.shadowBlur = 40;
    g.beginPath(); g.arc(w * 0.78, groundY * 0.32, 34, 0, 7); g.fill(); g.shadowBlur = 0;
    g.fillStyle = 'rgba(0,0,0,0.25)'; g.beginPath(); g.arc(w * 0.78 - 10, groundY * 0.32 - 6, 8, 0, 7); g.arc(w * 0.78 + 12, groundY * 0.32 + 10, 5, 0, 7); g.fill();
    // Fledermäuse
    g.fillStyle = '#000';
    for (let i = 0; i < 4; i++) {
      const bx = wrap(i * 260 - off * 0.35 - t * 40, w + 200) - 100, by = groundY * 0.25 + i * 22 + Math.sin(t * 3 + i) * 10, fl = Math.sin(t * 20 + i) * 5;
      g.beginPath(); g.moveTo(bx, by); g.quadraticCurveTo(bx - 8, by - 6 - fl, bx - 14, by + 2); g.quadraticCurveTo(bx - 7, by - 1, bx, by + 3);
      g.quadraticCurveTo(bx + 7, by - 1, bx + 14, by + 2); g.quadraticCurveTo(bx + 8, by - 6 - fl, bx, by); g.fill();
    }
    // tote Bäume
    g.strokeStyle = '#120a14'; g.lineCap = 'round';
    for (let i = 0; i < 5; i++) {
      const tx = wrap(i * 230 - off * 0.4, w + 260) - 130;
      g.lineWidth = 8; g.beginPath(); g.moveTo(tx, groundY); g.lineTo(tx + 4, groundY - 90); g.stroke();
      g.lineWidth = 4; g.beginPath(); g.moveTo(tx + 3, groundY - 60); g.lineTo(tx - 22, groundY - 92); g.moveTo(tx + 4, groundY - 75); g.lineTo(tx + 28, groundY - 105); g.moveTo(tx - 12, groundY - 78); g.lineTo(tx - 20, groundY - 104); g.stroke();
    }
    g.fillStyle = '#1b1220'; g.fillRect(0, groundY, w, h - groundY);
    g.fillStyle = '#2f4f1f'; g.fillRect(0, groundY, w, 4);
    g.fillStyle = 'rgba(155,255,58,0.07)';
    for (let i = 0; i < 3; i++) g.fillRect(0, groundY - 20 - i * 14 + Math.sin(t + i) * 4, w, 10);
    g.fillStyle = '#3a2f3a';
    for (let i = 0; i < 14; i++) { const gx = wrap(i * 73 - off, w + 40) - 20; g.fillRect(gx, groundY + 10 + (i % 3) * 9, 6, 2); }
    return;
  }

  if (theme === 'day') {
    if (night > 0.2) {
      g.fillStyle = `rgba(255,255,255,${(night - 0.2) * 1.2})`;
      for (let i = 0; i < 40; i++) g.fillRect(wrap(i * 97 - off * 0.02, w), (i * 53) % (groundY * 0.8), 2, 2);
      g.fillStyle = `rgba(255,250,220,${night})`; g.beginPath(); g.arc(w * 0.8, groundY * 0.25, 20, 0, 7); g.fill();
    }
    g.fillStyle = `rgba(255,230,120,${1 - night})`; g.beginPath(); g.arc(w * 0.85, groundY * 0.22 + night * 200, 26, 0, 7); g.fill();
  }

  // Wolken / Ballons
  if (theme === 'birthday') {
    const cols = ['#ff4fa3', '#ffd23f', '#3ee6b4', '#7cc6ff', '#c77dff', '#ff7b39'];
    for (let i = 0; i < 8; i++) {
      const bx = wrap(i * 150 - off * 0.2, w + 150) - 60;
      const by = wrap(groundY * 0.9 - t * (12 + (i % 3) * 6) - i * 70, groundY + 120) - 60;
      g.strokeStyle = 'rgba(80,60,80,0.4)'; g.lineWidth = 1;
      g.beginPath(); g.moveTo(bx, by + 16); g.quadraticCurveTo(bx + 5, by + 30, bx, by + 44); g.stroke();
      g.fillStyle = cols[i % cols.length];
      g.beginPath(); g.ellipse(bx, by, 11, 14, 0, 0, 7); g.fill();
      g.fillStyle = 'rgba(255,255,255,0.45)'; g.beginPath(); g.ellipse(bx - 4, by - 5, 3, 4, -0.4, 0, 7); g.fill();
    }
    // Wimpelkette
    const span = 360, y0 = Math.max(16, groundY - 250);
    for (let k = -1; k < w / span + 1; k++) {
      const sx = k * span - wrap(off * 0.5, span);
      g.strokeStyle = '#8a5a7a'; g.lineWidth = 1.5;
      g.beginPath(); g.moveTo(sx, y0); g.quadraticCurveTo(sx + span / 2, y0 + 40, sx + span, y0); g.stroke();
      for (let i = 1; i < 12; i++) {
        const u = i / 12, fx = sx + span * u, fy = y0 + 4 * 40 * u * (1 - u) * 0.5 * 2 * 0.5 + 40 * u * (1 - u) * 2 * 0.5;
        g.fillStyle = cols[i % cols.length];
        g.beginPath(); g.moveTo(fx - 7, fy); g.lineTo(fx + 7, fy); g.lineTo(fx, fy + 14); g.fill();
      }
    }
  } else {
    g.fillStyle = `rgba(255,255,255,${0.9 - night * 0.6})`;
    for (let i = 0; i < 5; i++) {
      const cx = wrap(i * 220 - off * 0.15, w + 220) - 110, cy = groundY * 0.2 + (i % 3) * 30;
      g.beginPath(); g.arc(cx, cy, 16, 0, 7); g.arc(cx + 18, cy - 8, 20, 0, 7); g.arc(cx + 38, cy, 15, 0, 7); g.rect(cx, cy, 38, 14); g.fill();
    }
  }
  // Hügel
  const hill1 = theme === 'birthday' ? '#d9a3e6' : lerpColor('#9ad37a', '#1f2a48', night);
  const hill2 = theme === 'birthday' ? '#f3b5d6' : lerpColor('#6fbf5a', '#18213a', night);
  hills(g, w, groundY, off * 0.25, 60, 340, hill1);
  hills(g, w, groundY, off * 0.5, 34, 210, hill2);

  // Boden
  if (theme === 'birthday') {
    g.fillStyle = '#f6d7a7'; g.fillRect(0, groundY, w, h - groundY);
    g.fillStyle = '#ff8fbf'; g.fillRect(0, groundY + 16, w, 6);
    g.fillStyle = '#f0c890'; g.fillRect(0, groundY + 34, w, h - groundY - 34);
    g.fillStyle = '#ffffff';
    g.beginPath(); g.moveTo(0, groundY - 3);
    for (let x = -wrap(off, 24); x < w + 24; x += 24) { g.quadraticCurveTo(x + 6, groundY + 10, x + 12, groundY + 4); g.quadraticCurveTo(x + 18, groundY + 10, x + 24, groundY + 2); }
    g.lineTo(w, groundY - 3); g.closePath(); g.fill();
    g.fillRect(0, groundY - 3, w, 5);
    const sc = ['#ff4fa3', '#3ee6b4', '#7cc6ff', '#ffd23f'];
    for (let i = 0; i < 40; i++) { const sx = wrap(i * 37 - off, w + 20) - 10; g.fillStyle = sc[i % 4]; g.fillRect(sx, groundY - 2 + (i % 3) * 2, 4, 1.6); }
  } else {
    g.fillStyle = lerpColor('#e3c48a', '#3a3350', night); g.fillRect(0, groundY, w, h - groundY);
    g.fillStyle = lerpColor('#7cc35a', '#2b4a3a', night); g.fillRect(0, groundY - 2, w, 7);
    g.fillStyle = lerpColor('#c9a56a', '#2b2540', night);
    for (let i = 0; i < 26; i++) { const gx = wrap(i * 53 - off, w + 40) - 20; g.fillRect(gx, groundY + 12 + (i % 4) * 8, 4 + (i % 3) * 3, 2); }
  }
}

function hills(g, w, groundY, off, amp, period, color) {
  g.fillStyle = color;
  g.beginPath(); g.moveTo(0, groundY);
  for (let x = 0; x <= w + 10; x += 10) {
    const u = (x + off) / period;
    g.lineTo(x, groundY - amp * (0.55 + 0.3 * Math.sin(u * 2.1) + 0.15 * Math.sin(u * 5.3)));
  }
  g.lineTo(w, groundY); g.closePath(); g.fill();
}
