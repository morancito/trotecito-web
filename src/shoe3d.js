import * as THREE from "three";

/* Zapatilla 3D paramétrica de Trotecito. Todas las medidas en milímetros.
   La altura de talón (H) y de antepié (F) salen de la ficha de cada modelo. */

export const RM = matchMedia("(prefers-reduced-motion: reduce)").matches;
export const PALETA = {
  upperA: "#2F5DB8", upperB: "#EAF1FA", overlay: "#141A2E", midsole: "#F7F6F2",
  sole: "#1C1D21", sol: "#A9C9EC", rojo: "#8E1F3F", lengua: "#EEF2F6",
};
const L = 290;
const sstep = t => (t <= 0 ? 0 : t >= 1 ? 1 : t * t * (3 - 2 * t));
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

export function shoeSurf(H, F) {
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
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
    g.setAttribute("uv", new THREE.Float32BufferAttribute(uv, 2));
    if (col) g.setAttribute("color", new THREE.Float32BufferAttribute(cols, 3));
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

/* Estudio fotográfico virtual: da reflejos suaves y luz pareja. */
function studio() {
  const s = new THREE.Scene();
  const room = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshBasicMaterial({ color: 0x2c2d33, side: THREE.BackSide }));
  room.scale.set(40, 22, 40); room.position.y = 9; s.add(room);
  const lamp = (w, h, x, y, z, i) => { const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ color: new THREE.Color(i, i, i), side: THREE.DoubleSide })); m.position.set(x, y, z); m.lookAt(0, 0, 0); s.add(m); };
  lamp(16, 7, 0, 18, 2, 5); lamp(10, 9, -19, 7, 8, 2.6); lamp(10, 9, 19, 7, -6, 2); lamp(34, 3, 0, 2.5, 19.5, 1.4); lamp(8, 8, 6, 5, -19, 1.2);
  return s;
}
function canvasTex(size, draw, rep) {
  const c = document.createElement("canvas"); c.width = c.height = size; draw(c.getContext("2d"), size);
  const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(...rep); t.anisotropy = 4; return t;
}

export function Viewer(host, init) {
  const p = Object.assign({ H: 36, F: 28, plate: false, tilt: 0, leg: false, dims: true, hl: null, auto: !RM, view: 0.55 }, init || {});
  let renderer;
  try { renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true }); }
  catch (e) { host.insertAdjacentHTML("afterbegin", '<div class="no3d">Tu navegador no puede mostrar el 3D.</div>'); return { set() {}, view() {}, destroy() {} }; }
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
  renderer.outputEncoding = THREE.sRGBEncoding;
  renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.1;
  host.insertBefore(renderer.domElement, host.firstChild);
  const scene = new THREE.Scene(), cam = new THREE.PerspectiveCamera(26, 1, 1, 5000);
  cam.position.set(0, 170, 650); cam.lookAt(0, 44, 0);
  const pm = new THREE.PMREMGenerator(renderer), st = studio(), env = pm.fromScene(st, 0.04).texture;
  pm.dispose(); st.traverse(o => { o.geometry && o.geometry.dispose(); o.material && o.material.dispose(); });
  scene.environment = env;
  scene.add(new THREE.HemisphereLight(0xffffff, 0x3a3a40, 0.25));
  const key = new THREE.DirectionalLight(0xffffff, 0.9); key.position.set(250, 520, 380); scene.add(key);
  const root = new THREE.Group(), tilt = new THREE.Group(), fixed = new THREE.Group();
  scene.add(root); root.add(tilt); root.add(fixed);
  const lbHost = host.querySelector(".lbls"); let labels = [];
  let rotY = p.view, target = p.view, rotX = 0, drag = null, visible = true, raf, lastT = 0;
  const mats = [];
  const C = h => new THREE.Color(h).convertSRGBToLinear();
  const D = THREE.DoubleSide;
  function M(color, o) { const m = new THREE.MeshStandardMaterial(Object.assign({ color: C(color), roughness: 0.7, metalness: 0, side: D }, o || {})); mats.push(m); return m; }
  const knit = canvasTex(64, (g, s) => { g.fillStyle = "#777"; g.fillRect(0, 0, s, s); g.fillStyle = "#fff";
    for (let y = 0; y < s; y += 8) for (let x = 0; x < s; x += 8) { g.beginPath(); g.ellipse(x + 4, y + 4, 3.2, 2.3, 0, 0, 7); g.fill(); } }, [26, 5]);
  const lugs = canvasTex(64, (g, s) => { g.fillStyle = "#000"; g.fillRect(0, 0, s, s); g.strokeStyle = "#fff"; g.lineWidth = 9;
    for (let y = -16; y < s + 16; y += 16) { g.beginPath(); g.moveTo(0, y); g.lineTo(s / 2, y + 10); g.lineTo(s, y); g.stroke(); } }, [22, 3]);
  const foam = canvasTex(128, (g, s) => { const d = g.createImageData(s, s); for (let i = 0; i < d.data.length; i += 4) { const v = 120 + Math.random() * 60; d.data[i] = d.data[i + 1] = d.data[i + 2] = v; d.data[i + 3] = 255; } g.putImageData(d, 0, 0); }, [8, 2]);
  const shadow = canvasTex(128, (g) => { const r = g.createRadialGradient(64, 64, 4, 64, 64, 64); r.addColorStop(0, "rgba(0,0,0,.5)"); r.addColorStop(1, "rgba(0,0,0,0)"); g.fillStyle = r; g.fillRect(0, 0, 128, 128); }, [1, 1]);
  function clear(g) { while (g.children.length) { const c = g.children.pop(); c.geometry && c.geometry.dispose(); } }
  function add(geo, mat, g) { const m = new THREE.Mesh(geo, mat); (g || tilt).add(m); return m; }
  function rod(x1, y1, z1, x2, y2, z2, r, mat) {
    const a = new THREE.Vector3(x1, y1, z1), b = new THREE.Vector3(x2, y2, z2), len = a.distanceTo(b);
    const m = new THREE.Mesh(new THREE.CylinderGeometry(r, r, len, 12), mat);
    m.position.copy(a).add(b).multiplyScalar(0.5);
    m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), b.clone().sub(a).normalize()); return m;
  }
  function lab(text, x, y, z, acc, g) { const el = document.createElement("div"); el.className = "lbl" + (acc ? " a" : ""); el.textContent = text; lbHost && lbHost.appendChild(el); labels.push({ el, v: new THREE.Vector3(x, y, z), g: g || tilt }); }

  function build() {
    clear(tilt); clear(fixed); mats.forEach(m => m.dispose()); mats.length = 0; labels.forEach(l => l.el.remove()); labels = [];
    const H = p.H, F = p.F, S = shoeSurf(H, F), P = PALETA;
    /* mediasuela */
    add(S.loft(S.mid, 48, true), M(p.hl === "mid" ? P.rojo : P.midsole, { roughness: 0.55, bumpMap: foam, bumpScale: 0.15,
      transparent: p.plate, opacity: p.plate ? 0.32 : 1, depthWrite: !p.plate }));
    /* suela de goma con dibujo, en dos tacos */
    const rub = M(P.sole, { roughness: 0.92, bumpMap: lugs, bumpScale: 1.2 });
    add(S.loft(S.pad(1, 98), 28, true, null, 1, 98), rub);
    add(S.loft(S.pad(150, 289), 28, true, null, 150, 289), rub);
    /* capellada de malla con degradé celeste a blanco */
    const cA = C(P.upperA), cB = C(P.upperB);
    const grad = x => { const t = sstep((x - 40) / 210); return [cA.r + (cB.r - cA.r) * t, cA.g + (cB.g - cA.g) * t, cA.b + (cB.b - cA.b) * t]; };
    add(S.loft(S.upper, 44, false, S.heel, 0, 290, grad), M("#ffffff", { vertexColors: true, roughness: 0.82, bumpMap: knit, bumpScale: 0.6 }));
    /* refuerzos de talón y puntera */
    const ovm = M(P.overlay, { roughness: 0.4, metalness: 0.05 });
    const hw = (x, y) => S.heel(x, y) - 2 * Math.max(0, 1 - x / 22), tw = x => x + 2 * Math.max(0, (x - 268) / 22);
    for (const sd of [1, -1]) {
      add(S.loft(S.overlay(x => 0.6 * Math.min(1, (80 - x) / 34), sd), 16, false, hw, 0, 80), ovm);
      add(S.loft(S.overlay(x => 0.45 * Math.min(1, (x - 222) / 26), sd), 16, false, tw, 222, 290), ovm);
    }
    /* lengüeta, cordones y ojales */
    add(S.loft(S.tongue, 20, true, null, 98, 192), M(P.lengua, { roughness: 0.9, bumpMap: knit, bumpScale: 0.3 }));
    const lace = M(P.sol, { roughness: 0.55 }), eye = M(P.overlay, { roughness: 0.35, metalness: 0.2 });
    for (let k = 0; k < 6; k++) {
      const X = 112 + k * 14, I = S.info(X), sp = 0.3 * 0.88 * I.hw, z1 = I.zc - sp, z2 = I.zc + sp;
      const y1 = S.surf(X, z1) + 3.4, y2 = S.surf(X + 5, z2) + 3.4;
      tilt.add(rod(X - L / 2, y1, z1, X - L / 2 + 5, y2, z2, 1.6, lace));
      for (const [xx, yy, zz] of [[X, y1 - 1.6, z1 - 3], [X + 5, y2 - 1.6, z2 + 3]]) {
        const e = new THREE.Mesh(new THREE.TorusGeometry(2.4, 0.9, 8, 16), eye); e.position.set(xx - L / 2, yy, zz); e.rotation.x = Math.PI / 2; tilt.add(e);
      }
    }
    /* cuello acolchado */
    const cx = 62, rx = 38, rz = 18, cg = new THREE.RingGeometry(0.001, 1, 48, 6), cp = cg.attributes.position;
    for (let i = 0; i < cp.count; i++) { const X = cx + cp.getX(i) * rx, Z = S.info(X).zc + cp.getY(i) * rz, Y = S.surf(X, Z) + 0.6; cp.setXYZ(i, S.heel(X, Y) - L / 2, Y, Z); }
    cg.computeVertexNormals(); add(cg, M("#0E0F12", { roughness: 1 }));
    const rim = []; for (let i = 0; i < 48; i++) { const a = i / 48 * Math.PI * 2, X = cx + Math.cos(a) * rx, Z = S.info(X).zc + Math.sin(a) * rz, Y = S.surf(X, Z) + 1.6; rim.push(new THREE.Vector3(S.heel(X, Y) - L / 2, Y, Z)); }
    add(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(rim, true), 120, 4, 12, true), M(P.overlay, { roughness: 0.7, bumpMap: knit, bumpScale: 0.3 }));
    /* tirador del talón */
    { const I = S.info(4), Y = S.surf(4, I.zc) - 4, X = S.heel(4, Y); const tab = add(new THREE.TorusGeometry(8, 2.4, 12, 28, Math.PI), M(P.sol, { roughness: 0.5 })); tab.rotation.z = Math.PI / 2; tab.position.set(X - L / 2 - 1, Y, I.zc); }
    /* línea lateral de la mediasuela */
    if (!p.plate && !p.dims) { const ln = []; for (let X = 18; X <= 236; X += 6) { const I = S.info(X), Y = I.b + (I.tp - I.b) * 0.42; ln.push(new THREE.Vector3(X - L / 2, Y, S.midZ(I, Y) + 0.2)); }
      add(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(ln), 140, 1.2, 8, false), M(P.rojo, { roughness: 0.45 })); }
    /* sombra */
    const sh = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({ map: shadow, transparent: true, depthWrite: false })); mats.push(sh.material);
    sh.rotation.x = -Math.PI / 2; sh.scale.set(380, 140, 1); sh.position.y = -3; fixed.add(sh);
    if (p.plate) { add(S.loft(S.plate, 24, true), M(P.rojo, { metalness: 0.3, roughness: 0.35 })); lab("Placa", 0, S.plateY(145), 58, true); }
    if (p.dims) {
      const dm = M(P.rojo), zf = 64, hx = -L / 2 + 40, fx = 60;
      tilt.add(rod(hx, 0, zf, hx, H, zf, 1.4, dm)); tilt.add(rod(fx, 0, zf, fx, F, zf, 1.4, dm));
      tilt.add(rod(hx, H, zf, hx + 40, H, zf, 0.8, dm)); tilt.add(rod(fx, F, zf, fx - 40, F, zf, 0.8, dm));
      lab(`Talón ${H} mm`, hx, H + 16, zf, true); lab(`Antepié ${F} mm`, fx, F + 16, zf, true);
      lab(`Drop ${+(H - F).toFixed(1)} mm`, (hx + fx) / 2, Math.max(H, F) + 46, zf, false);
    }
    if (p.leg) {
      const hx = -L / 2 + 40;
      fixed.add(rod(hx, H + 90, 0, hx, H + 330, 0, 5, M("#9AA3AE")));
      tilt.add(rod(hx, -6, 0, hx, H + 62, 0, 3, M(P.rojo)));
      lab("Pierna", hx, H + 300, 0, false, fixed); lab("Talón", hx, -24, 0, true);
    }
    resize();
  }
  function resize() { const w = host.clientWidth, h = host.clientHeight || w * 0.75; if (!w) return; renderer.setSize(w, h, false); cam.aspect = w / h; cam.updateProjectionMatrix(); }
  const ro = new ResizeObserver(resize); ro.observe(host);
  const io = new IntersectionObserver(e => { visible = e[0].isIntersecting; }, { threshold: 0 }); io.observe(host);
  const cv = renderer.domElement;
  cv.addEventListener("pointerdown", e => { drag = { x: e.clientX, y: e.clientY, r: target, rx: rotX }; cv.setPointerCapture(e.pointerId); });
  cv.addEventListener("pointermove", e => { if (!drag) return; target = drag.r + (e.clientX - drag.x) * 0.01; rotX = Math.max(-0.5, Math.min(0.6, drag.rx + (e.clientY - drag.y) * 0.006)); });
  const up = () => { drag = null; }; cv.addEventListener("pointerup", up); cv.addEventListener("pointercancel", up);
  const tmp = new THREE.Vector3();
  function frame(t) {
    raf = requestAnimationFrame(frame); if (!visible) return;
    const dt = Math.min(0.05, (t - lastT) / 1000 || 0); lastT = t;
    if (p.auto && !drag) target += dt * 0.35;
    rotY += (target - rotY) * 0.12; root.rotation.y = rotY; root.rotation.x += (rotX - root.rotation.x) * 0.12;
    tilt.rotation.x += (p.tilt - tilt.rotation.x) * 0.1;
    renderer.render(scene, cam);
    const w = host.clientWidth, h = host.clientHeight;
    for (const l of labels) { tmp.copy(l.v); l.g.localToWorld(tmp); tmp.project(cam);
      l.el.style.transform = `translate(${(tmp.x * 0.5 + 0.5) * w}px,${(-tmp.y * 0.5 + 0.5) * h}px) translate(-50%,-50%)`; l.el.style.opacity = tmp.z < 1 ? 1 : 0; }
  }
  build(); raf = requestAnimationFrame(frame);
  return {
    set(o) { Object.assign(p, o); build(); },
    view(v, auto) { target = rotY + ((v - rotY) % (2 * Math.PI) + 3 * Math.PI) % (2 * Math.PI) - Math.PI; rotX = 0; if (auto !== undefined) p.auto = auto && !RM; },
    destroy() { cancelAnimationFrame(raf); ro.disconnect(); io.disconnect(); clear(tilt); clear(fixed); mats.forEach(m => m.dispose());
      [knit, lugs, foam, shadow, env].forEach(t => t.dispose()); renderer.dispose(); renderer.forceContextLoss && renderer.forceContextLoss(); cv.remove(); labels.forEach(l => l.el.remove()); },
  };
}
