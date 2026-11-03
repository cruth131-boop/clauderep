// Partikel: Funken, Konfetti, Schutt, Feuerwerk, schwebende Texte.
export class Particles {
  constructor() { this.list = []; this.texts = []; }

  burst(x, y, { n = 12, colors = ['#ffd23f', '#ff4fa3', '#3ee6b4', '#7cc6ff'], speed = 160, life = 0.8, size = 3, gravity = 300, type = 'spark', spread = Math.PI * 2, angle = 0 } = {}) {
    for (let i = 0; i < n; i++) {
      const a = angle + (Math.random() - 0.5) * spread;
      const s = speed * (0.4 + Math.random() * 0.8);
      this.list.push({
        x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, life: life * (0.6 + Math.random() * 0.6), max: life,
        color: colors[(Math.random() * colors.length) | 0], size: size * (0.6 + Math.random() * 0.8), gravity, type,
        rot: Math.random() * 6, vr: (Math.random() - 0.5) * 12, drag: type === 'firework' ? 0.985 : 1,
      });
    }
  }

  text(x, y, text, { color = '#fff', size = 18, life = 1.1, vy = -60 } = {}) {
    this.texts.push({ x, y, text, color, size, life, max: life, vy });
  }

  update(dt, worldDx = 0) {
    for (const p of this.list) {
      p.life -= dt;
      p.vy += p.gravity * dt;
      p.vx *= p.drag; p.vy *= p.drag;
      p.x += p.vx * dt - worldDx; p.y += p.vy * dt;
      p.rot += p.vr * dt;
    }
    this.list = this.list.filter((p) => p.life > 0);
    for (const t of this.texts) { t.life -= dt; t.y += t.vy * dt; t.vy *= 0.97; t.x -= worldDx * 0.3; }
    this.texts = this.texts.filter((t) => t.life > 0);
  }

  draw(g) {
    for (const p of this.list) {
      const a = Math.max(0, Math.min(1, p.life / p.max * 1.5));
      g.globalAlpha = a;
      g.fillStyle = p.color;
      if (p.type === 'confetti') {
        g.save(); g.translate(p.x, p.y); g.rotate(p.rot); g.fillRect(-p.size, -p.size * 0.5, p.size * 2, p.size); g.restore();
      } else if (p.type === 'rubble') {
        g.save(); g.translate(p.x, p.y); g.rotate(p.rot); g.fillRect(-p.size / 2, -p.size / 2, p.size, p.size); g.restore();
      } else if (p.type === 'smoke') {
        g.globalAlpha = a * 0.5;
        g.beginPath(); g.arc(p.x, p.y, p.size * (2 - a), 0, 7); g.fill();
      } else {
        g.beginPath(); g.arc(p.x, p.y, p.size * (p.type === 'firework' ? a : 1), 0, 7); g.fill();
      }
    }
    g.globalAlpha = 1;
    g.textAlign = 'center';
    for (const t of this.texts) {
      const a = Math.min(1, t.life / t.max * 2);
      const pop = 1 + Math.max(0, (t.life - t.max + 0.15) * 4);
      g.globalAlpha = a;
      g.font = `900 ${t.size * pop}px ui-rounded, system-ui, sans-serif`;
      g.lineWidth = 4; g.strokeStyle = 'rgba(0,0,0,0.55)';
      g.strokeText(t.text, t.x, t.y);
      g.fillStyle = t.color; g.fillText(t.text, t.x, t.y);
    }
    g.globalAlpha = 1;
  }
}

/** Feuerwerk mit Raketen, Schweif und verschiedenen Explosionsformen. */
export class Fireworks {
  constructor(particles) { this.p = particles; this.rockets = []; this.flash = 0; }

  launch(x, y0, targetY, { shape = 'ball', colors } = {}) {
    const palette = colors || [
      ['#ff4fa3', '#ffd1e8'], ['#ffd23f', '#fff3b0'], ['#3ee6b4', '#c8fff0'], ['#7cc6ff', '#e0f2ff'], ['#c77dff', '#f0dcff'], ['#ff7b39', '#ffd9c2'],
    ][(Math.random() * 6) | 0];
    const vy = -Math.sqrt(2 * 520 * Math.max(40, y0 - targetY));
    this.rockets.push({ x, y: y0, vx: (Math.random() - 0.5) * 60, vy, shape, colors: palette, trail: 0 });
  }

  update(dt) {
    this.flash = Math.max(0, this.flash - dt * 2.5);
    for (const r of this.rockets) {
      r.vy += 520 * dt; r.x += r.vx * dt; r.y += r.vy * dt;
      r.trail -= dt;
      if (r.trail <= 0) {
        r.trail = 0.016;
        this.p.list.push({ x: r.x, y: r.y, vx: (Math.random() - 0.5) * 20, vy: 20, life: 0.4, max: 0.4, color: '#ffe9a8', size: 2, gravity: 0, type: 'spark', rot: 0, vr: 0, drag: 1 });
      }
      if (r.vy >= -20) { r.dead = true; this.explode(r); }
    }
    this.rockets = this.rockets.filter((r) => !r.dead);
  }

  explode(r) {
    this.flash = Math.min(0.5, this.flash + 0.25);
    const push = (vx, vy, color, life = 1.6, size = 2.6) => this.p.list.push({
      x: r.x, y: r.y, vx, vy, life: life * (0.7 + Math.random() * 0.5), max: life, color, size, gravity: 60, type: 'firework', rot: 0, vr: 0, drag: 0.975,
    });
    if (r.shape === 'heart') {
      for (let i = 0; i < 70; i++) {
        const t = (i / 70) * Math.PI * 2;
        const hx = 16 * Math.sin(t) ** 3;
        const hy = -(13 * Math.cos(t) - 5 * Math.cos(2 * t) - 2 * Math.cos(3 * t) - Math.cos(4 * t));
        push(hx * 9, hy * 9, r.colors[i % 2]);
      }
    } else if (r.shape === 'ring') {
      for (let i = 0; i < 60; i++) { const a = (i / 60) * Math.PI * 2; push(Math.cos(a) * 190, Math.sin(a) * 190, r.colors[i % 2]); }
    } else if (r.shape === 'text') {
      for (const [dx, dy] of r.points) push(dx * 4.2, dy * 4.2, r.colors[(Math.random() * 2) | 0], 2.0, 2.4);
    } else {
      for (let i = 0; i < 90; i++) {
        const a = Math.random() * Math.PI * 2, s = 60 + Math.random() * 200;
        push(Math.cos(a) * s, Math.sin(a) * s, r.colors[(Math.random() * 2) | 0]);
      }
    }
  }

  /** Feuerwerk, das einen Text (z.B. "34") in den Himmel schreibt. */
  launchText(x, y0, targetY, text) {
    const c = document.createElement('canvas'); c.width = 120; c.height = 60;
    const g = c.getContext('2d');
    g.fillStyle = '#fff'; g.font = '900 48px sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
    g.fillText(text, 60, 32);
    const data = g.getImageData(0, 0, 120, 60).data;
    const points = [];
    for (let y = 0; y < 60; y += 3) for (let x = 0; x < 120; x += 3) if (data[(y * 120 + x) * 4 + 3] > 128) points.push([x - 60, y - 30]);
    this.launch(x, y0, targetY, { shape: 'text' });
    this.rockets[this.rockets.length - 1].points = points;
    this.rockets[this.rockets.length - 1].vx = 0;
  }
}
