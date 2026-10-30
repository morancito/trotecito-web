import "@fontsource-variable/archivo/wdth.css";
import "@fontsource/kanit/900-italic.css";
import "@fontsource/jetbrains-mono/500.css";
import "./styles.css";
import { Viewer, perfil, topY, RM } from "./shoe3d.js";
import { grafico, montarGrafico, variacion } from "./precios.js";

//@@DATOS
const BASE = import.meta.env.BASE_URL;
const [CAT, HIST] = await Promise.all(["modelos", "historial"].map(n => fetch(BASE + `data/${n}.json`, { cache: "no-cache" }).then(r => r.ok ? r.json() : { series: {} })));
//@@FIN

/* ---------- datos ---------- */
const DATA = CAT.modelos.map(d => {
  const tiendas = (d.tiendas || []).filter(t => !t.sinStock).sort((a, b) => a.precio - b.precio);
  const hist = HIST.series?.[d.slug] || {};
  return { ...d, fotos: d.fotos || [], tiendas, min: tiendas[0]?.precio ?? null, hist, var: variacion(hist) };
});
const USOS = ["Iniciación", "Rodaje diario", "Rodaje largo", "Ritmo", "Competencia"];
const UCLS = { "Iniciación": "u-ini", "Rodaje diario": "u-diario", "Rodaje largo": "u-largo", "Ritmo": "u-ritmo", "Competencia": "u-comp" };
const MARCAS = [...new Set(DATA.map(d => d.m))].sort((a, b) => a.localeCompare(b));
const $ = s => document.querySelector(s);
const esc = s => String(s ?? "").replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
const fmt = n => "$" + Math.round(n).toLocaleString("es-AR");
const pad = n => String(n).padStart(3, "0");
const nombre = d => d.mod + (d.ver ? " " + d.ver : "");
const pisada = d => d.tipo === "Estabilidad" ? "Pronadora" : d.tipo === "Neutra" ? "Neutra" : "";
const conPlaca = d => !!d.pl && /carbono|nylon|varilla/i.test(d.pl);
const src = s => /^https?:/.test(s) ? s : BASE + s;
const silCache = {};
function silueta(d) {
  const H = d.talon || 36, F = d.ante || 28, k = H + "/" + F, P = silCache[k] || (silCache[k] = perfil(H, F));
  return `<svg class="sil" viewBox="${P.vb}" aria-hidden="true"><path class="sil-up" d="${P.up}"/><path class="sil-mid" d="${P.mid}"/><path class="sil-sole" d="${P.sole}"/></svg>`;
}

/* ---------- hero y cinta ---------- */
const baratas = DATA.filter(d => d.min).sort((a, b) => a.min - b.min);
const items = baratas.map(d => `<a href="#m-${d.id}"><b>${esc(nombre(d).toUpperCase())}</b>${fmt(d.min)} <span>en ${esc(d.tiendas[0].tienda)}</span></a><i></i>`).join("");
$("#ticker").innerHTML = `<div class="tk-run">${items}</div><div class="tk-run" aria-hidden="true">${items}</div>`;

/* ---------- aprendé ---------- */
const VISTAS = { "Costado": 0, "3/4": 0.55, "Atrás": Math.PI / 2 };
const lab = Viewer($("#labStage"), { H: 38, F: 28, auto: false, view: 0.35 });
$("#labViews").innerHTML = Object.keys(VISTAS).map(k => `<button data-v="${k}" aria-pressed="false">${k}</button>`).join("");
function setVista(k) { lab.view(VISTAS[k], false); document.querySelectorAll("#labViews button").forEach(b => b.setAttribute("aria-pressed", b.dataset.v === k)); }
$("#labViews").onclick = e => { const b = e.target.closest("button"); if (b) setVista(b.dataset.v); };
const escala = (id, items) => `<div class="escala" id="${id}">${items.map(([r, t, s]) => `<div data-r="${r}"><b>${t}</b><span>${s}</span></div>`).join("")}</div>`;
const marcar = (id, v) => document.querySelectorAll(`#${id} div`).forEach(x => { const [a, b] = x.dataset.r.split("-").map(Number); x.classList.toggle("on", v >= a && v <= b); });
const LANES = [
  { k: "drop", t: "Drop", vista: "Costado",
    html: `<h3 class="cond">Drop</h3><p>La diferencia de altura entre el talón y la punta.</p><div class="big" id="dropv">10 mm</div>
      <input type="range" id="dropr" min="0" max="12" value="10" aria-label="Drop en milímetros">
      ${escala("dropE", [["0-4", "0 a 4 mm", "Más natural"], ["5-8", "5 a 8 mm", "El más común"], ["9-12", "9 a 12 mm", "Clásico, para talonar"]])}`,
    mount() { const r = $("#dropr"), u = () => { const d = +r.value; $("#dropv").textContent = d + " mm"; lab.set({ H: 26 + d, F: 26, plate: false, leg: false, tilt: 0, hl: null, dims: true }); marcar("dropE", d); }; r.oninput = u; u(); } },
  { k: "amortiguacion", t: "Amortiguación", vista: "3/4",
    html: `<h3 class="cond">Amortiguación</h3><p>Cuánta espuma hay entre tu pie y el piso.</p><div class="big" id="stackv">38 mm</div>
      <input type="range" id="stackr" min="20" max="48" value="38" aria-label="Altura del talón en milímetros">
      ${escala("stackE", [["20-29", "Menos de 30", "Firme y rápida"], ["30-39", "30 a 39", "Para todo"], ["40-48", "40 o más", "Fondos largos"]])}`,
    mount() { const r = $("#stackr"), u = () => { const h = +r.value; $("#stackv").textContent = h + " mm"; lab.set({ H: h, F: h - 8, plate: false, leg: false, tilt: 0, hl: "mid", dims: true }); marcar("stackE", h); }; r.oninput = u; u(); } },
  { k: "pisada", t: "Pisada", vista: "Atrás",
    html: `<h3 class="cond">Pisada</h3><p>Cómo apoya tu pie, mirado desde atrás.</p>
      <div class="seg" id="pis"><button data-t="0" aria-pressed="true">Neutra</button><button data-t="0.16" aria-pressed="false">Pronadora</button><button data-t="-0.16" aria-pressed="false">Supinadora</button></div>
      <p class="resultado" id="pist"></p>`,
    mount() {
      const T = { "0": "Talón alineado con la pierna. Te va cualquier zapa neutra.", "0.16": "El pie se vence hacia adentro. Buscá zapas de estabilidad.", "-0.16": "El pie se va hacia afuera. Te conviene una neutra bien amortiguada." };
      const u = t => { lab.set({ H: 36, F: 28, plate: false, leg: true, tilt: +t, hl: null, dims: false }); $("#pist").textContent = T[t]; document.querySelectorAll("#pis button").forEach(x => x.setAttribute("aria-pressed", x.dataset.t === t)); };
      $("#pis").onclick = e => { const b = e.target.closest("button"); if (b) u(b.dataset.t); }; u("0"); } },
  { k: "placa", t: "Placa", vista: "3/4",
    html: `<h3 class="cond">Placa</h3><p>Una lámina rígida dentro de la espuma que te empuja hacia adelante. Rinde más cuanto más rápido corrés.</p>
      <div class="seg" id="pl"><button data-p="1" aria-pressed="true">Con placa</button><button data-p="0" aria-pressed="false">Sin placa</button></div>`,
    mount() { const u = v => { lab.set({ H: 38, F: 30, plate: v === "1", leg: false, tilt: 0, hl: null, dims: false }); document.querySelectorAll("#pl button").forEach(x => x.setAttribute("aria-pressed", x.dataset.p === v)); };
      $("#pl").onclick = e => { const b = e.target.closest("button"); if (b) u(b.dataset.p); }; u("1"); } },
  { k: "espuma", t: "Espuma", vista: "Costado",
    html: `<h3 class="cond">Espuma</h3><p>El material de la mediasuela. Define cuánto rebota cada paso.</p>
      <div class="escala"><div><b>EVA</b><span>Clásica y firme</span></div><div><b>TPU</b><span>Rebota y dura</span></div><div class="on"><b>PEBA</b><span>Liviana y explosiva</span></div></div>`,
    mount() { lab.set({ H: 38, F: 30, plate: false, leg: false, tilt: 0, hl: "mid", dims: false }); } },
];
$("#lanes").innerHTML = LANES.map(l => `<button class="tab" role="tab" aria-selected="false" data-k="${l.k}">${l.t}</button>`).join("");
function abrirLane(k) {
  const l = LANES.find(x => x.k === k) || LANES[0];
  document.querySelectorAll(".tab").forEach(b => b.setAttribute("aria-selected", b.dataset.k === l.k));
  $("#labtext").innerHTML = l.html; l.mount(); setVista(l.vista);
}
$("#lanes").onclick = e => { const b = e.target.closest(".tab"); if (b) abrirLane(b.dataset.k); };
abrirLane("drop");

/* ---------- catálogo ---------- */
const st = { q: "", pis: "", uso: new Set(), marca: "", precio: false, orden: "precio", cmp: [] };
$("#filtros").innerHTML = `
  <div class="seg" id="fPis"><button data-p="" aria-pressed="true">Todas</button><button data-p="Neutra" aria-pressed="false">Neutras</button><button data-p="Estabilidad" aria-pressed="false">Pronador</button></div>
  ${USOS.map(u => `<button class="chip ${UCLS[u]}" data-uso="${u}" aria-pressed="false">${u}</button>`).join("")}
  <select class="pill" id="fMarca" aria-label="Marca"><option value="">Todas las marcas</option>${MARCAS.map(m => `<option>${esc(m)}</option>`).join("")}</select>
  <select class="pill" id="fOrden" aria-label="Ordenar"><option value="precio">Más baratas</option><option value="peso">Más livianas</option><option value="stack">Más amortiguadas</option><option value="az">A a Z</option></select>`;
$("#fPis").onclick = e => { const b = e.target.closest("button"); if (!b) return; st.pis = b.dataset.p; document.querySelectorAll("#fPis button").forEach(x => x.setAttribute("aria-pressed", x === b)); render(); };
document.querySelectorAll(".chip[data-uso]").forEach(b => b.onclick = () => { const u = b.dataset.uso; st.uso.has(u) ? st.uso.delete(u) : st.uso.add(u); b.setAttribute("aria-pressed", st.uso.has(u)); render(); });
$("#fMarca").onchange = e => { st.marca = e.target.value; render(); };
$("#fOrden").onchange = e => { st.orden = e.target.value; render(); };
$("#q").oninput = e => { st.q = e.target.value.trim().toLowerCase(); render(); };

function tarjeta(d) {
  const on = st.cmp.includes(d.id);
  const img = d.fotos.length ? `<img src="${esc(src(d.fotos[0]))}" alt="${esc(d.m + " " + nombre(d))}" loading="lazy">` : silueta(d);
  return `<a class="bib ${UCLS[d.uso] || "u-diario"}" href="#m-${d.id}">
    <div class="bib-band"><span>${esc(d.m)}</span><span>N° ${pad(d.id)}</span></div>
    <div class="bib-img">${img}</div>
    <div class="bib-body"><h3 class="cond">${esc(nombre(d))}</h3>
      <div class="bib-foot"><span class="bib-uso">${d.var != null && d.var <= -0.05 ? `<span class="baja">▼ ${Math.round(-d.var * 100)}%</span>` : esc(d.uso)}</span>${d.min ? `<span class="bib-p"><small>desde</small>${fmt(d.min)}</span>` : `<span class="pronto">Pronto</span>`}</div></div>
    <button class="cmp" aria-pressed="${on}" aria-label="Comparar ${esc(nombre(d))}" data-c="${d.id}">${on ? "✓" : "+"}</button></a>`;
}
function lista() {
  const l = DATA.filter(d => (!st.q || `${d.m} ${d.mod} ${d.ver} ${d.esp}`.toLowerCase().includes(st.q)) && (!st.pis || d.tipo === st.pis)
    && (!st.uso.size || st.uso.has(d.uso)) && (!st.marca || d.m === st.marca));
  const X = 1e12, o = st.orden;
  return l.sort(o === "peso" ? (a, b) => (a.peso ?? X) - (b.peso ?? X) : o === "stack" ? (a, b) => (b.talon ?? -1) - (a.talon ?? -1)
    : o === "az" ? (a, b) => a.m.localeCompare(b.m) || a.mod.localeCompare(b.mod) : (a, b) => (a.min ?? X) - (b.min ?? X) || a.id - b.id);
}
function render() { const l = lista(); $("#grid").innerHTML = l.map(tarjeta).join(""); $("#empty").hidden = l.length > 0; bandeja(); }
function bandeja() { const n = st.cmp.length; $("#tray").hidden = n === 0 || location.hash === "#comparar"; $("#traytxt").textContent = `${n} de 3 para comparar`; $("#traygo").disabled = n < 2; }
document.addEventListener("click", e => {
  const c = e.target.closest("[data-c]"); if (!c) return; e.preventDefault(); e.stopPropagation();
  const id = +c.dataset.c, i = st.cmp.indexOf(id); if (i >= 0) st.cmp.splice(i, 1); else if (st.cmp.length < 3) st.cmp.push(id);
  const on = st.cmp.includes(id);
  document.querySelectorAll(`[data-c="${id}"]`).forEach(b => { b.setAttribute("aria-pressed", on); b.textContent = b.classList.contains("cmp") ? (on ? "✓" : "+") : (on ? "✓ Comparando" : "+ Comparar"); });
  bandeja();
});
$("#trayclear").onclick = () => { st.cmp = []; render(); route(); };
$("#traygo").onclick = () => { location.hash = "comparar"; };

/* ---------- buscador del dorsal ---------- */
const FINDER = {
  uso: [["Arrancar", "Iniciación"], ["Todos los días", "Rodaje diario"], ["Fondos largos", "Rodaje largo"], ["Ir rápido", "Ritmo"], ["Competir", "Competencia"]],
  pis: [["Neutra", "Neutra"], ["Pronador", "Estabilidad"], ["No sé", ""]],
  orden: [["Precio", "precio"], ["Liviandad", "peso"], ["Amortiguación", "stack"]],
};
const fsel = { uso: "", pis: "", orden: "" };
document.querySelectorAll(".dh-ops").forEach(box => {
  const k = box.dataset.k;
  box.innerHTML = FINDER[k].map(([t, v]) => `<button type="button" data-v="${v}" aria-pressed="false">${t}</button>`).join("");
  box.onclick = e => { const b = e.target.closest("button"); if (!b) return;
    fsel[k] = b.getAttribute("aria-pressed") === "true" ? "" : b.dataset.v;
    box.querySelectorAll("button").forEach(x => x.setAttribute("aria-pressed", x === b && fsel[k] === b.dataset.v));
    contar(); };
});
let numActual = DATA.length, numAnim;
function contar() {
  const n = DATA.filter(d => (!fsel.uso || d.uso === fsel.uso) && (!fsel.pis || d.tipo === fsel.pis)).length;
  $("#fNumL").innerHTML = n === 1 ? "zapa<br>te va" : "zapas<br>te van";
  cancelAnimationFrame(numAnim);
  const desde = numActual, t0 = performance.now(), dur = RM ? 0 : 450;
  const paso = t => { const k = dur ? Math.min(1, (t - t0) / dur) : 1; numActual = Math.round(desde + (n - desde) * (1 - Math.pow(1 - k, 3)));
    $("#fNum").textContent = String(numActual).padStart(2, "0"); if (k < 1) numAnim = requestAnimationFrame(paso); };
  numAnim = requestAnimationFrame(paso);
  $("#finder").classList.remove("pop"); void $("#finder").offsetWidth; $("#finder").classList.add("pop");
}
$("#finder").onsubmit = e => {
  e.preventDefault();
  st.uso.clear(); if (fsel.uso) st.uso.add(fsel.uso);
  document.querySelectorAll(".chip[data-uso]").forEach(b => b.setAttribute("aria-pressed", st.uso.has(b.dataset.uso)));
  st.pis = fsel.pis; document.querySelectorAll("#fPis button").forEach(x => x.setAttribute("aria-pressed", x.dataset.p === st.pis));
  st.orden = fsel.orden || "precio"; $("#fOrden").value = st.orden;
  render();
  if (location.hash === "#catalogo") document.getElementById("catalogo").scrollIntoView(); else location.hash = "catalogo";
};

/* ---------- ficha ---------- */
let visor = null;
function media(d) {
  const stage = `<div class="media-box" id="m3d"${d.fotos.length ? " hidden" : ""}><div class="stage" id="dStage"><div class="lbls"></div></div></div>`;
  if (!d.fotos.length) return stage;
  return `<div><div class="seg" id="mtabs"><button data-mt="fotos" aria-pressed="true">Fotos</button><button data-mt="3d" aria-pressed="false">3D</button></div></div>
    <div class="media-box" id="mfotos"><img class="main" id="fotoMain" src="${esc(src(d.fotos[0]))}" alt="${esc(d.m + " " + nombre(d))}"></div>${stage}
    ${d.fotos.length > 1 ? `<div class="thumbs">${d.fotos.map((s, i) => `<button data-foto="${i}" aria-pressed="${i === 0}" aria-label="Foto ${i + 1}"><img src="${esc(src(s))}" alt="" loading="lazy"></button>`).join("")}</div>` : ""}`;
}
function ficha(d) {
  const t = d.tiendas, best = t[0], resto = t.slice(1), ahorro = t.length > 1 ? t[t.length - 1].precio - best.precio : 0;
  const datos = [["Peso", d.peso && `${d.peso} g`], ["Drop", d.drop != null && `${d.drop} mm`], ["Talón", d.talon && `${d.talon} mm`], ["Antepié", d.ante && `${d.ante} mm`],
    ["Espuma", d.esp, 1], ["Placa", conPlaca(d) && d.pl, 1]].filter(x => x[1]);
  const c = d.corredor;
  return `<a class="back" href="#catalogo">← Todas las zapas</a>
  <div class="det-grid"><div class="media">${media(d)}</div>
  <div class="info">
    <p class="kicker">${esc(d.m)} · N° ${pad(d.id)}</p>
    <h1 class="cond">${esc(nombre(d))}</h1>
    <div class="tags"><span class="tag uso ${UCLS[d.uso] || ""}">${esc(d.uso)}</span>${pisada(d) ? `<span class="tag">${pisada(d)}</span>` : ""}${conPlaca(d) ? `<span class="tag">Con placa</span>` : ""}</div>
    ${best ? `<div class="buy"><span class="kicker">Mejor precio</span><b class="buy-p">${fmt(best.precio)}</b>
      <span class="buy-s">en ${esc(best.tienda)}${best.cuotas && !/consultar/i.test(best.cuotas) ? " · " + esc(best.cuotas) : ""}</span>
      <a class="btn" href="${esc(best.url)}" target="_blank" rel="noopener">Comprar en ${esc(best.tienda)} ↗</a>
      ${ahorro > 0 ? `<p class="ahorro">Ahorrás ${fmt(ahorro)} contra la más cara.</p>` : ""}</div>` : `<div class="buy"><b class="buy-p cond" style="font-size:48px">Precio pronto</b></div>`}
    ${resto.length ? `<ul class="tiendas">${resto.map(s => `<li><a href="${esc(s.url)}" target="_blank" rel="noopener"><span class="t-n">${esc(s.tienda)} ↗</span><span class="t-c">${esc(s.nota || "")}</span><span class="t-p">${fmt(s.precio)}</span></a></li>`).join("")}</ul>` : ""}
    ${grafico(d.hist) ? `<div class="bloque" id="histBox"><h2 class="cond">Cómo varió el precio</h2>${grafico(d.hist)}</div>` : ""}
    ${c ? `<div class="bloque"><h2 class="cond">¿Para quién?</h2><dl class="para">
      <div><dt>Pisada</dt><dd>${d.tipo === "Estabilidad" ? "Pronadora" : "Neutra o supinadora"}</dd></div>
      <div><dt>Ritmo</dt><dd>${esc(c.ritmo)}</dd></div><div><dt>Distancias</dt><dd>${esc(c.distancia)}</dd></div>
      <div><dt>Corredor</dt><dd>${esc(c.peso)}</dd></div>${d.evitar ? `<div><dt>Mejor no si</dt><dd>${esc(d.evitar)}</dd></div>` : ""}</dl></div>` : ""}
    ${datos.length ? `<div class="bloque"><h2 class="cond">Ficha</h2><dl class="ficha">${datos.map(([k, v, txt]) => `<div><dt>${k}</dt><dd${txt ? ' class="txt"' : ""}>${esc(v)}</dd></div>`).join("")}</dl></div>` : ""}
    <div class="acciones"><button class="btn" data-c="${d.id}" aria-pressed="${st.cmp.includes(d.id)}">${st.cmp.includes(d.id) ? "✓ Comparando" : "+ Comparar"}</button>
      ${d.fuente ? `<a class="review" href="${esc(d.fuente[1])}" target="_blank" rel="noopener">Review en ${esc(d.fuente[0])} ↗</a>` : ""}</div>
  </div></div>`;
}
function montarFicha(d) {
  montarGrafico(document.getElementById("histBox"), d.hist);
  const crear = () => { if (!visor) visor = Viewer($("#dStage"), { H: d.talon || 36, F: d.ante || 28, plate: conPlaca(d), dims: !!(d.talon && d.ante), view: 0.3 }); };
  if (!d.fotos.length) { crear(); return; }
  $("#mtabs").onclick = e => { const b = e.target.closest("button"); if (!b) return; const tres = b.dataset.mt === "3d";
    $("#m3d").hidden = !tres; $("#mfotos").hidden = tres; document.querySelectorAll("#mtabs button").forEach(x => x.setAttribute("aria-pressed", x === b)); if (tres) crear(); };
  const th = document.querySelector(".thumbs");
  if (th) th.onclick = e => { const b = e.target.closest("button"); if (!b) return; $("#fotoMain").src = src(d.fotos[+b.dataset.foto]);
    th.querySelectorAll("button").forEach(x => x.setAttribute("aria-pressed", x === b)); $("#m3d").hidden = true; $("#mfotos").hidden = false;
    document.querySelectorAll("#mtabs button").forEach(x => x.setAttribute("aria-pressed", x.dataset.mt === "fotos")); };
}

/* ---------- comparar ---------- */
const CC = ["#E8341C", "#2C5AA0", "#FFAA00"];
function perfiles(ds) {
  const ok = ds.filter(d => d.talon && d.ante); if (!ok.length) return "";
  const k = 3, Hm = Math.max(...ok.map(d => d.talon)) * k + 20;
  const lineas = ok.map(d => { const pts = []; for (let j = 0; j <= 30; j++) { const x = 22 + 260 * j / 30; pts.push(`${x},${(Hm - topY(x, d.talon, d.ante) * k).toFixed(1)}`); }
    return `<polyline points="${pts.join(" ")}" fill="none" stroke="${CC[ds.indexOf(d)]}" stroke-width="4" stroke-linejoin="round"/>`; }).join("");
  return `<div class="overlay"><svg viewBox="0 0 300 ${Hm + 14}" role="img" aria-label="Altura de la mediasuela de cada modelo">
    <line x1="0" y1="${Hm}" x2="300" y2="${Hm}" stroke="currentColor" stroke-width="2"/>
    <text x="4" y="${Hm + 12}" font-size="9" fill="currentColor" font-family="JetBrains Mono, monospace">TALÓN</text>
    <text x="296" y="${Hm + 12}" font-size="9" fill="currentColor" text-anchor="end" font-family="JetBrains Mono, monospace">PUNTA</text>${lineas}</svg>
    <div class="legend">${ok.map(d => `<span><i style="background:${CC[ds.indexOf(d)]}"></i>${esc(nombre(d))} · ${d.talon}/${d.ante} mm</span>`).join("")}</div></div>`;
}
function comparar() {
  const ds = st.cmp.map(id => DATA.find(x => x.id === id));
  if (ds.length < 2) return `<a class="back" href="#catalogo">← Todas las zapas</a><p class="empty">Elegí al menos dos zapas con el botón +.</p>`;
  const minP = Math.min(...ds.map(d => d.min ?? 1e12)), minW = Math.min(...ds.map(d => d.peso ?? 1e12));
  const filas = [
    ["Mejor precio", d => d.min ? `<span class="${d.min === minP ? "win" : ""}">${fmt(d.min)}</span>` : ""],
    ["Tienda", d => d.tiendas[0] ? esc(d.tiendas[0].tienda) : ""],
    ["Peso", d => d.peso ? `<span class="${d.peso === minW ? "win" : ""}">${d.peso} g</span>` : ""],
    ["Pisada", d => pisada(d)], ["Uso", d => esc(d.uso)], ["Drop", d => d.drop != null ? d.drop + " mm" : ""],
    ["Talón", d => d.talon ? d.talon + " mm" : ""], ["Antepié", d => d.ante ? d.ante + " mm" : ""],
    ["Espuma", d => esc(d.esp)], ["Placa", d => conPlaca(d) ? esc(d.pl) : ""], ["Ritmo", d => d.corredor ? esc(d.corredor.ritmo) : ""],
  ].filter(([, f]) => ds.some(d => f(d)));
  return `<a class="back" href="#catalogo">← Todas las zapas</a><h1 class="cmp-h cond">Cara a cara</h1>${perfiles(ds)}
    <div class="tblwrap"><table class="cmpt"><thead><tr><th></th>${ds.map((d, i) => `<th><a href="#m-${d.id}" style="border-bottom:4px solid ${CC[i]}">${esc(nombre(d))}</a></th>`).join("")}</tr></thead>
    <tbody>${filas.map(([k, f]) => `<tr><th>${k}</th>${ds.map(d => `<td>${f(d) || "–"}</td>`).join("")}</tr>`).join("")}</tbody></table></div>`;
}

/* ---------- rutas ---------- */
function route() {
  const h = location.hash.slice(1), m = h.match(/^m-(\d+)$/), d = m && DATA.find(x => x.id === +m[1]);
  if (visor) { visor.destroy(); visor = null; }
  $("#home").hidden = !!(d || h === "comparar"); $("#detalle").hidden = !d; $("#comparar").hidden = h !== "comparar";
  if (d) { $("#detalle").innerHTML = ficha(d); montarFicha(d); document.title = `${nombre(d)} · Trotecito`; window.scrollTo(0, 0); }
  else if (h === "comparar") { $("#comparar").innerHTML = comparar(); document.title = "Comparar · Trotecito"; window.scrollTo(0, 0); }
  else { document.title = "Trotecito"; render(); if (h === "catalogo" || h === "aprender") requestAnimationFrame(() => document.getElementById(h)?.scrollIntoView()); }
  bandeja();
}
addEventListener("hashchange", route);
route();
