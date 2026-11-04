// Emoji als gecachte Sprites zeichnen.
// ---------------------------------------------------------------------------
// Emoji-Sprites (gecacht, damit nicht jedes Frame Text gerendert wird)
// ---------------------------------------------------------------------------
const EMO_FONT = '"Apple Color Emoji","Segoe UI Emoji","Noto Color Emoji",sans-serif';
const spriteCache = new Map();
function sprite(ch, size) {
  const key = ch + '|' + size;
  let c = spriteCache.get(key);
  if (c) return c;
  const k = 3, pad = Math.ceil(size * 0.25);
  c = document.createElement('canvas'); c.width = c.height = (size + pad * 2) * k;
  const x = c.getContext('2d'); x.scale(k, k);
  x.font = `${size}px ${EMO_FONT}`; x.textAlign = 'center'; x.textBaseline = 'middle';
  x.fillText(ch, size / 2 + pad, size / 2 + pad + size * 0.06);
  c.pad = pad; c.size = size;
  spriteCache.set(key, c);
  return c;
}
/** Zeichnet ein Emoji zentriert bei (x, y). */
export function emoji(g, ch, x, y, size, rot = 0, flip = false) {
  const s = sprite(ch, Math.max(8, Math.round(size / 4) * 4));
  const f = size / s.size, full = (s.size + s.pad * 2) * f;
  if (rot || flip) { g.save(); g.translate(x, y); if (rot) g.rotate(rot); if (flip) g.scale(-1, 1); g.drawImage(s, -full / 2, -full / 2, full, full); g.restore(); }
  else g.drawImage(s, x - full / 2, y - full / 2, full, full);
}
