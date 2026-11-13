/* Zapatilla 3D paramétrica de Trotecito. Todas las medidas en milímetros.
   La altura de talón (H) y de antepié (F) salen de la ficha de cada modelo. */

export const RM = matchMedia("(prefers-reduced-motion: reduce)").matches;
export const PALETA = {
  upperA: "#2F5DB8", upperB: "#EAF1FA", overlay: "#141A2E", midsole: "#F7F6F2",
  sole: "#1C1D21", sol: "#A9C9EC", rojo: "#8E1F3F", lengua: "#EEF2F6",
};
export const L = 290;
export const sstep = t => (t <= 0 ? 0 : t >= 1 ? 1 : t * t * (3 - 2 * t));
function seg(x, P) {
  if (x <= P[0][0]) return P[0][1];
  for (let i = 1; i < P.length; i++) {
    const [a, va] = P[i - 1], [b, vb] = P[i];
    if (x <= b) return va + (vb - va) * sstep((x - a) / (b - a));
  }
  return P[P.length - 1][1];
}
export function topY(x, H, F) { return x < 25 ? H : x < 195 ? H + (F - H) * (x - 25) / 170 : F * (1 - 0.3 * (x - 195) / 95); }
function botY(x) { return x < 30 ? Math.pow((30 - x) / 30, 2) * 9 : x < 205 ? 0 : Math.pow((x - 205) / 85, 2) * 22; }
function halfW(x, side) {
  const R = 34;
  if (x <= R) return Math.sqrt(Math.max(0, R * R - (R - x) * (R - x)));
  if (side > 0) { if (x <= 210) return seg(x, [[R, 34], [140, 38], [210, 44]]); const t = (x - 210) / 80; return 44 * Math.pow(Math.max(0, 1 - t * t * t), 0.5); }
  if (x <= 200) return seg(x, [[R, 34], [90, 29], [150, 29], [200, 44]]);
  const t = (x - 200) / 90; return 44 * Math.pow(Math.max(0, 1 - t * t * t), 0.5);
}
const spw = (v, n) => Math.sign(v) * Math.pow(Math.abs(v), 2 / n);

/* T es three.js: solo hace falta para armar la malla 3D (loft); la silueta de las tarjetas no lo usa */
export function shoeSurf(H, F, T) {
  const info = x => {
    const wl = halfW(x, 1), wm = halfW(x, -1), b = botY(x), tp = topY(x, H, F) + (x > 200 ? b * 0.9 : 0);
    return { b, tp, zc: (wl - wm) / 2, hw: (wl + wm) / 2,
      u: seg(x, [[0, 36], [16, 44], [55, 31], [100, 43], [140, 49], [190, 37], [240, 21], [290, 8]]) + 2,
      n: seg(x, [[0, 3.6], [105, 3.6], [150, 2.4]]), hl: Math.max(0, 1 - x / 80) };
  };
  const flare = (I, y) => 1 + (0.05 + 0.09 * I.hl) * (1 - (y - I.b) / (I.tp - I.b || 1));
  const midZ = (I, y) => { const hh = (I.tp - I.b) / 2, yy = Math.min(1, Math.abs((y - I.b - hh) / hh)); return I.zc + I.hw * Math.pow(1 - Math.pow(yy, 4.5), 1 / 4.5) * flare(I, y); };
  const mid = (x, t) => { const I = info(x), a = 2 * Math.PI * t, hh = (I.tp - I.b) / 2, y = I.b + hh + hh * spw(Math.sin(a), 4.5); return [y, I.zc + I.hw * spw(Math.cos(a), 4.5) * flare(I, y)]; };
  const pad = (x0, x1) => (x, t) => { const I = info(x), a = 2 * Math.PI * t, k = Math.min(1, (x - x0) / 8, (x1 - x) / 8), f = 1 + 0.14 * I.hl; return [I.b - 1.6 + 2.4 * Math.max(0.05, k) * spw(Math.sin(a), 6), I.zc + I.hw * f * 0.98 * spw(Math.cos(a), 6)]; };
  const upper = (x, t) => { const I = info(x), a = Math.PI * t; return [I.tp - 2 + I.u * spw(Math.sin(a), I.n), I.zc + 0.88 * I.hw * spw(Math.cos(a), I.n)]; };
  const overlay = (fn, side) => (x, t) => { const I = info(x), h = Math.max(0, Math.min(1, fn(x))), am = Math.asin(Math.pow(h, I.n / 2)), a = side > 0 ? t * am : Math.PI - t * am; return [I.tp - 2.2 + I.u * spw(Math.sin(a), I.n), I.zc + 0.88 * 1.035 * I.hw * spw(Math.cos(a), I.n)]; };
  const plateY = x => { const I = info(x); return I.b + (I.tp - I.b) * 0.42; };
  const plate = (x, t) => { const I = info(x), a = 2 * Math.PI * t; return [plateY(x) + 1.3 * spw(Math.sin(a), 8), I.zc + 0.8 * I.hw * spw(Math.cos(a), 8)]; };
  const surf = (x, z) => { const I = info(x), w = 0.88 * I.hw || 1e-6, r = Math.min(1, Math.abs((z - I.zc) / w)); return I.tp - 2 + I.u * Math.pow(1 - Math.pow(r, I.n), 1 / I.n); };
  const tongue = (x, t) => { const I = info(x), a = 2 * Math.PI * t, y0 = surf(x, I.zc); return [y0 + 1.4 + 1.8 * spw(Math.sin(a), 6), I.zc + 9 * spw(Math.cos(a), 6)]; };
  /* Talón: el contrafuerte se inclina hacia adelante y arriba se abre hacia atrás, como el tirador de una zapa de running. */
  const heel = (x, y) => { const I = info(x), r = Math.max(0, (y - I.tp + 2) / I.u); return x + 12 * r * r * Math.max(0, 1 - x / 70) - 9 * Math.pow(r, 7) * Math.max(0, 1 - x / 40); };
  function loft(ring, K, closed, warp, x0 = 0, x1 = 290, col) {
    const N = 80, pos = [], uv = [], cols = [], idx = [];
    for (let i = 0; i <= N; i++) {
      const x = x0 + (x1 - x0) * (1 - Math.cos(Math.PI * i / N)) / 2;
      for (let j = 0; j < K; j++) {
        const [y, z] = ring(x, j / (closed ? K : K - 1));
        pos.push((warp ? warp(x, y) : x) - 145, y, z); uv.push(x / 290, j / (K - 1));
        if (col) cols.push(...col(x, y));
      }
    }
    for (let i = 0; i < N; i++) for (let j = 0; j < (closed ? K : K - 1); j++) {
      const a = i * K + j, b = i * K + (j + 1) % K, c = a + K, d = b + K; idx.push(a, c, b, b, c, d);
    }
    const g = new T.BufferGeometry();
    g.setAttribute("position", new T.Float32BufferAttribute(pos, 3));
    g.setAttribute("uv", new T.Float32BufferAttribute(uv, 2));
    if (col) g.setAttribute("color", new T.Float32BufferAttribute(cols, 3));
    g.setIndex(idx); g.computeVertexNormals(); return g;
  }
  return { info, midZ, mid, pad, upper, overlay, plate, plateY, surf, tongue, heel, loft };
}

/* Silueta lateral en SVG (para las tarjetas del catálogo). */
export function perfil(H = 36, F = 28) {
  const S = shoeSurf(H, F), N = 72, top = [], bot = [], up = [], base = [];
  for (let i = 0; i <= N; i++) {
    const x = 290 * i / N, I = S.info(x), yt = I.tp - 2 + I.u;
    top.push([x, I.tp]); bot.push([x, I.b]); up.push([S.heel(x, yt), yt]); base.push([x, I.tp - 2]);
  }
  const P = (a, m = "M") => a.map(([x, y], i) => (i ? "L" : m) + x.toFixed(1) + " " + (-y).toFixed(1)).join(" ");
  const maxY = Math.max(...up.map(p => p[1]));
  return {
    vb: `-14 ${(-maxY - 8).toFixed(0)} 320 ${(maxY + 26).toFixed(0)}`,
    up: P(up) + " " + P(base.reverse(), "L") + " Z",
    mid: P(top) + " " + P(bot.slice().reverse(), "L") + " Z",
    sole: P(bot.filter(([x]) => x < 100)) + " " + P(bot.filter(([x]) => x > 150)),
  };
}
