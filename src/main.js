import "@fontsource-variable/archivo/wdth.css";
import "@fontsource/kanit/900-italic.css";
import "@fontsource/jetbrains-mono/500.css";
import "./styles.css";
import { Viewer, perfil, topY, RM } from "./shoe3d.js";
import { grafico, montarGrafico, variacion } from "./precios.js";
import { PREGUNTAS, recomendar } from "./recomendador.js";
import { medir, medirVisita } from "./medir.js";

//@@DATOS
const BASE = import.meta.env.BASE_URL;
const [CAT, HIST] = await Promise.all(["modelos", "historial"].map(n => fetch(BASE + `data/${n}.json`, { cache: "no-cache" }).then(r => r.ok ? r.json() : { series: {} })));
//@@FIN

/* ---------- datos ---------- */
// Un precio que el robot no pudo actualizar en más de 7 días deja de mostrarse.
const aMs = f => { const [d, mo, y] = String(f || "").split("/").map(Number); return y ? Date.UTC(y, mo - 1, d) : 0; };
const vigenteHasta = f => aMs(CAT.actualizado) - aMs(f) <= 7 * 864e5;
const DATA = CAT.modelos.filter(d => !d.borrador).map(d => ({ ...d, fotos: d.fotos || [], todas: (d.tiendas || []).filter(t => !t.sinStock && vigenteHasta(t.fecha)).sort((a, b) => a.precio - b.precio) }));
/* talles: hombre, mujer o todos. Cambia qué precios se ven en todo el sitio. */
const guardado = k => { try { return localStorage.getItem(k); } catch { return null; } };
const guardar = (k, v) => { try { v == null ? localStorage.removeItem(k) : localStorage.setItem(k, v); } catch {} };
let GEN = ["Hombre", "Mujer"].includes(guardado("trotecito-gen")) ? guardado("trotecito-gen") : "";
const claveSerie = t => t.tienda + (t.nota === "Mujer" ? " · Mujer" : "");
const paraGen = (t, g = GEN) => !g || !t.nota || t.nota === "Unisex" || t.nota === g;
/* tu talle (numeración argentina): true = la tienda lo tiene, false = no lo tiene, null = no lo pudimos confirmar */
let TALLE = guardado("trotecito-talle") || "";
const estadoTalle = (t, x = TALLE) => !x ? null : t.sistema === "AR" && t.talles ? t.talles.includes(x) : null;
const TALLES = [...new Set(DATA.flatMap(d => d.todas.filter(t => t.sistema === "AR").flatMap(t => t.talles || [])))].sort((a, b) => a - b);
function aplicarGenero() {
  for (const d of DATA) {
    d.tiendas = d.todas.filter(t => paraGen(t) && estadoTalle(t) !== false)
      .sort((a, b) => (estadoTalle(b) === true) - (estadoTalle(a) === true) || a.precio - b.precio);
    d.sinTalle = !!TALLE && !d.tiendas.length && d.todas.some(t => paraGen(t));
    d.min = d.tiendas[0]?.precio ?? null;
    const todo = HIST.series?.[d.slug] || {}, claves = new Set(d.tiendas.map(claveSerie));
    d.hist = Object.fromEntries(Object.entries(todo).filter(([k]) => claves.has(k)));
    d.var = variacion(d.hist);
    const otro = GEN && d.todas.filter(t => !paraGen(t))[0];
    d.otro = otro ? { gen: otro.nota, precio: otro.precio } : null;
  }
}
aplicarGenero();
const USOS = ["Iniciación", "Rodaje diario", "Rodaje largo", "Ritmo", "Competencia"];
const UCLS = { "Iniciación": "u-ini", "Rodaje diario": "u-diario", "Rodaje largo": "u-largo", "Ritmo": "u-ritmo", "Competencia": "u-comp" };
const MARCAS = [...new Set(DATA.map(d => d.m))].sort((a, b) => a.localeCompare(b));
const $ = s => document.querySelector(s);
const esc = s => String(s ?? "").replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
const fmt = n => "$" + Math.round(n).toLocaleString("es-AR");
const pad = n => String(n).padStart(3, "0");
const nombre = d => d.mod + (d.ver ? " " + d.ver : "");
const pisada = d => d.tipo === "Estabilidad" ? "Pronadora" : d.tipo === "Neutra" ? "Neutra" : "";
const conPlaca = d => !!d.pl && /carbono|nylon|varilla|speedboard/i.test(d.pl);
const placa = d => d.pl && d.pl !== "Sin placa" ? d.pl : "";
const terr = d => d.terreno || "Asfalto";
const pisadaPara = d => d.tipo === "Estabilidad" ? "Pronadora" : "Neutra o supinadora";
const AMORT = [[0, "Mínima", "casi no hay espuma, sentís todo el piso"], [28, "Baja", "poca espuma, se siente el piso"], [33, "Media", "espuma intermedia"], [38, "Alta", "mucha espuma entre tu pie y el piso"], [42, "Máxima", "de las más altas que se fabrican"]];
const amort = d => { if (!d.talon) return null; let n = 0; AMORT.forEach(([mm], i) => { if (d.talon >= mm) n = i; }); return { n: n + 1, t: AMORT[n][1], s: AMORT[n][2] }; };
const medidor = a => `<span class="amort" role="img" aria-label="Amortiguación ${a.t}, ${a.n} de 5"><span class="amort-m">${[1, 2, 3, 4, 5].map(k => `<i${k <= a.n ? ' class="on"' : ""}></i>`).join("")}</span><b>${a.t}</b></span>`;
const kgCorto = d => { const p = d.corredor?.peso || ""; return /cualquier/i.test(p) ? "cualquier peso" : p.toLowerCase(); };
const src = s => /^https?:/.test(s) ? s : BASE + s;
const zurl = d => `${BASE}zapa/${d.slug}/`;
const silCache = {};
function silueta(d) {
  const H = d.talon || 36, F = d.ante || 28, k = H + "/" + F, P = silCache[k] || (silCache[k] = perfil(H, F));
  return `<svg class="sil" viewBox="${P.vb}" aria-hidden="true"><path class="sil-up" d="${P.up}"/><path class="sil-mid" d="${P.mid}"/><path class="sil-sole" d="${P.sole}"/></svg>`;
}

/* ---------- hero y cinta ---------- */
const baratas = DATA.filter(d => d.min).sort((a, b) => a.min - b.min);
const items = baratas.map(d => `<a href="${zurl(d)}"><b>${esc(nombre(d).toUpperCase())}</b>${fmt(d.min)} <span>en ${esc(d.tiendas[0].tienda)}</span></a><i></i>`).join("");
$("#ticker").innerHTML = `<div class="tk-run">${items}</div><div class="tk-run" aria-hidden="true">${items}</div>`;
/* velocidad fija (~40 px por segundo) sin importar cuántas zapas haya */
requestAnimationFrame(() => { const w = $("#ticker .tk-run").scrollWidth; $("#ticker").style.animationDuration = Math.round(w / 40) + "s"; });

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
const KG = d => { const p = d.corredor?.peso || ""; return /cualquier/i.test(p) ? 999 : +(p.match(/\d+/) || [999])[0]; };
const desc = d => { const t = d.tiendas[0]; return t?.antes > t?.precio ? 1 - t.precio / t.antes : 0; };
const nivelAm = d => amort(d)?.t || "";
const PASO = 10000;
const P_MIN = Math.floor(Math.min(...DATA.filter(d => d.min).map(d => d.min)) / PASO) * PASO;
const P_MAX = Math.ceil(Math.max(...DATA.filter(d => d.min).map(d => d.min)) / PASO) * PASO;
const VACIO = () => ({ pis: "", uso: new Set(), marcas: new Set(), am: new Set(), kg: 0, pmin: P_MIN, pmax: P_MAX, desc: false, placa: false });
const st = { q: "", terreno: "Asfalto", orden: "precio", cmp: [], ...VACIO() };
const TERRENOS = [["Asfalto", "Calle, pista y cinta"], ["Trail", "Senderos y montaña"]];
const PESOS = [[74, "Menos de 75 kg"], [89, "75 a 90 kg"], [91, "Más de 90 kg"]];
const AMS = ["Baja", "Media", "Alta", "Máxima"];
const milK = n => n >= 1e6 ? "$" + (n / 1e6).toLocaleString("es-AR", { maximumFractionDigits: 2 }) + " M" : "$" + Math.round(n / 1000) + " mil";

$("#terreno").innerHTML = TERRENOS.map(([t, s]) => `<button data-t="${t}" aria-pressed="${t === st.terreno}"><b class="cond">${t}</b><span>${s}</span><i>${DATA.filter(d => terr(d) === t).length}</i></button>`).join("");
$("#terreno").onclick = e => { const b = e.target.closest("button"); if (b) setTerreno(b.dataset.t); };
function setTalle(x) { TALLE = x; guardar("trotecito-talle", x || null); aplicarGenero(); pintarOfertas(); render(); }
function setGen(g) { GEN = g; guardar("trotecito-gen", g || null); aplicarGenero(); pintarOfertas(); render(); }
function setTerreno(t) { st.terreno = t; document.querySelectorAll("#terreno button").forEach(x => x.setAttribute("aria-pressed", x.dataset.t === t)); render(); }

const grupo = (t, html, extra = "") => `<fieldset class="fg"${extra}><legend>${t}</legend>${html}</fieldset>`;
const opc = (k, v, t, tipo = "checkbox", cls = "") => `<label class="op ${cls}"><input type="${tipo}" name="${k}" value="${esc(v)}"><span>${t}</span><em data-n="${k}|${esc(v)}"></em></label>`;
$("#fpanel").innerHTML = `
  <div class="fp-head"><b class="cond">Filtros</b><button type="button" class="fp-x" id="fpCerrar" aria-label="Cerrar filtros">✕</button></div>
  <div class="fp-body">
  ${grupo("Talles", [["", "Todos"], ["Hombre", "Hombre"], ["Mujer", "Mujer"]].map(([v, t]) => opc("gen", v, t, "radio")).join("")
    + `<label class="op-talle"><span>Tu talle</span><select class="pill" name="talle" id="fTalle"><option value="">Cualquiera</option>${TALLES.map(x => `<option>${x}</option>`).join("")}</select></label>
    <p class="fg-nota">Muestra solo las tiendas que tienen tu talle o que no pudimos chequear. Talles argentinos.</p>`)}
  ${grupo("Precio", `<div class="rango"><div class="rango-v"><b id="pMinV"></b><span>a</span><b id="pMaxV"></b></div>
    <div class="rango-s"><div class="rango-f" id="pFill"></div>
      <input type="range" id="pMin" min="${P_MIN}" max="${P_MAX}" step="${PASO}" value="${P_MIN}" aria-label="Precio mínimo">
      <input type="range" id="pMax" min="${P_MIN}" max="${P_MAX}" step="${PASO}" value="${P_MAX}" aria-label="Precio máximo"></div>
    <div class="atajos-p">${[[0, 100000, "Hasta $100 mil"], [100000, 200000, "$100 a 200 mil"], [200000, 300000, "$200 a 300 mil"], [300000, 0, "Más de $300 mil"]]
      .map(([a, b, t]) => `<button type="button" data-pa="${a}" data-pb="${b}">${t}</button>`).join("")}</div></div>`)}
  ${grupo("¿Para qué la querés?", USOS.map(u => opc("uso", u, u, "checkbox", UCLS[u])).join(""))}
  ${grupo("¿Cómo pisás?", [["", "Me da igual"], ["Neutra", "Neutra o supinadora"], ["Estabilidad", "Pronador"]].map(([v, t]) => opc("pis", v, t, "radio")).join(""))}
  ${grupo("¿Cuánto pesás?", [[0, "No filtrar"], ...PESOS].map(([v, t]) => opc("kg", v, t, "radio")).join(""))}
  ${grupo("Amortiguación", AMS.map(a => opc("am", a, a)).join(""))}
  ${grupo("Marca", MARCAS.map(m => opc("marca", m, esc(m))).join(""), ' id="fgMarca"')}
  ${grupo("Más", opc("desc", "1", "Con descuento") + opc("placa", "1", "Con placa"))}
  </div>
  <div class="fp-foot"><button type="button" class="fp-limpiar" id="fpLimpiar">Limpiar</button><button type="button" class="fp-ver" id="fpVer">Ver zapas</button></div>`;

const fp = $("#fpanel");
fp.addEventListener("change", e => {
  const i = e.target, k = i.name; if (!k) return;
  if (i.checked || i.type === "radio" || i.tagName === "SELECT") medir("filtro", { k, v: i.value, terreno: st.terreno });
  if (k === "uso" || k === "am") st[k][i.checked ? "add" : "delete"](i.value);
  else if (k === "marca") st.marcas[i.checked ? "add" : "delete"](i.value);
  else if (k === "gen") { setGen(i.value); return; }
  else if (k === "talle") { setTalle(i.value); return; }
  else if (k === "pis") st.pis = i.value;
  else if (k === "kg") st.kg = +i.value;
  else if (k === "desc" || k === "placa") st[k] = i.checked;
  render();
});
const pMin = $("#pMin"), pMax = $("#pMax");
function pintarRango() {
  $("#pMinV").textContent = milK(st.pmin); $("#pMaxV").textContent = st.pmax >= P_MAX ? milK(P_MAX) + "+" : milK(st.pmax);
  const a = (st.pmin - P_MIN) / (P_MAX - P_MIN) * 100, b = (st.pmax - P_MIN) / (P_MAX - P_MIN) * 100;
  $("#pFill").style.left = a + "%"; $("#pFill").style.right = (100 - b) + "%";
  pMin.value = st.pmin; pMax.value = st.pmax;
}
pMin.oninput = () => { st.pmin = Math.min(+pMin.value, st.pmax - PASO); render(); };
pMax.oninput = () => { st.pmax = Math.max(+pMax.value, st.pmin + PASO); render(); };
[pMin, pMax].forEach(x => x.addEventListener("change", () => medir("filtro", { k: "precio", v: `${st.pmin}-${st.pmax}`, terreno: st.terreno })));
fp.querySelector(".atajos-p").onclick = e => { const b = e.target.closest("button"); if (!b) return; medir("filtro", { k: "precio", v: b.textContent, terreno: st.terreno });
  st.pmin = Math.max(P_MIN, +b.dataset.pa); st.pmax = +b.dataset.pb || P_MAX; render(); };
$("#fpLimpiar").onclick = () => { Object.assign(st, VACIO()); render(); };
const abrirF = v => { fp.classList.toggle("open", v); document.body.classList.toggle("fp-on", v); };
$("#fpCerrar").onclick = $("#fpVer").onclick = () => abrirF(false);
$("#fAbrir").onclick = () => abrirF(true);
$("#fOrden").onchange = e => { st.orden = e.target.value; render(); };
let busqT; const medirBusqueda = (desde) => { if (st.q.length >= 3) medir("busqueda", { q: st.q, n: lista().length, desde }); };
$("#q").oninput = e => { st.q = e.target.value.trim().toLowerCase(); render(); clearTimeout(busqT); busqT = setTimeout(() => medirBusqueda("catalogo"), 1500); };

/* sincroniza los controles del panel con el estado */
function pintarPanel() {
  $("#fTalle").value = TALLE;
  fp.querySelectorAll("input[name]").forEach(i => {
    const k = i.name, v = i.value;
    i.checked = k === "gen" ? GEN === v : k === "uso" || k === "am" ? st[k].has(v) : k === "marca" ? st.marcas.has(v) : k === "pis" ? st.pis === v : k === "kg" ? st.kg === +v : k === "desc" || k === "placa" ? st[k] : false;
  });
  fp.querySelectorAll(".atajos-p button").forEach(b => b.setAttribute("aria-pressed", st.pmin === Math.max(P_MIN, +b.dataset.pa) && st.pmax === (+b.dataset.pb || P_MAX)));
  pintarRango();
}
const pasa = (d, sin) => (st.q ? `${d.m} ${d.mod} ${d.ver} ${d.esp} ${terr(d)}`.toLowerCase().includes(st.q) : terr(d) === st.terreno)
  && (sin === "pis" || !st.pis || d.tipo === st.pis) && (sin === "uso" || !st.uso.size || st.uso.has(d.uso))
  && (sin === "marca" || !st.marcas.size || st.marcas.has(d.m)) && (sin === "am" || !st.am.size || st.am.has(nivelAm(d)))
  && (sin === "kg" || !st.kg || KG(d) >= st.kg) && (sin === "desc" || !st.desc || desc(d) > 0.01) && (sin === "placa" || !st.placa || conPlaca(d))
  && (st.pmin <= P_MIN && st.pmax >= P_MAX || d.min && d.min >= st.pmin && (st.pmax >= P_MAX || d.min <= st.pmax));
/* cuántas zapas quedarían al tocar cada opción */
function contarOpciones() {
  fp.querySelectorAll("em[data-n]").forEach(em => {
    const [k, v] = em.dataset.n.split("|");
    const f = { gen: d => d.todas.some(t => paraGen(t, v)), uso: d => d.uso === v, am: d => nivelAm(d) === v, marca: d => d.m === v, pis: d => !v || d.tipo === v, kg: d => !+v || KG(d) >= +v, desc: d => desc(d) > 0.01, placa: d => conPlaca(d) }[k];
    const n = DATA.filter(d => pasa(d, k) && f(d)).length;
    em.textContent = n; em.closest(".op").classList.toggle("cero", n === 0);
  });
}
function chipsActivos() {
  const c = [];
  if (GEN) c.push(["gen", "Talles de " + GEN.toLowerCase()]);
  if (TALLE) c.push(["talle", "Talle " + TALLE]);
  if (st.pmin > P_MIN || st.pmax < P_MAX) c.push(["precio", `${milK(st.pmin)} a ${st.pmax >= P_MAX ? "más" : milK(st.pmax)}`]);
  st.uso.forEach(u => c.push(["uso:" + u, u]));
  if (st.pis) c.push(["pis", st.pis === "Estabilidad" ? "Pronador" : "Neutra"]);
  if (st.kg) c.push(["kg", PESOS.find(p => p[0] === st.kg)[1]]);
  st.am.forEach(a => c.push(["am:" + a, "Amortiguación " + a.toLowerCase()]));
  st.marcas.forEach(m => c.push(["marca:" + m, m]));
  if (st.desc) c.push(["desc", "Con descuento"]); if (st.placa) c.push(["placa", "Con placa"]);
  return c;
}
$("#activos").onclick = e => { const b = e.target.closest("button[data-x]"); if (!b) return; const [k, v] = b.dataset.x.split(":");
  if (k === "precio") { st.pmin = P_MIN; st.pmax = P_MAX; } else if (k === "uso" || k === "am") st[k].delete(v); else if (k === "marca") st.marcas.delete(v);
  else if (k === "pis") st.pis = ""; else if (k === "kg") st.kg = 0; else if (k === "gen") { setGen(""); return; } else if (k === "talle") { setTalle(""); return; } else st[k] = false;
  if (k === "todo") Object.assign(st, VACIO());
  render(); };

function precioTarjeta(d) {
  if (d.sinTalle) return `<span class="pronto">Sin talle ${TALLE}</span>`;
  if (d.min) { const t = d.tiendas[0], n = t.nota, e = estadoTalle(t);
    return `<span class="bib-p"><small>${TALLE ? (e ? `<em class="t-si">✓ talle ${TALLE}</em> · ` : `<em class="t-nd">talle ${TALLE} sin confirmar</em> · `) : !GEN && (n === "Hombre" || n === "Mujer") ? n.toLowerCase() + " · " : ""}desde</small>${fmt(d.min)}</span>`; }
  return d.otro ? `<span class="pronto">Solo talles de ${d.otro.gen.toLowerCase()}</span>` : `<span class="pronto">Pronto</span>`;
}
function tarjeta(d) {
  const on = st.cmp.includes(d.id), dc = desc(d);
  const img = d.fotos.length ? `<img src="${esc(src(d.fotos[0]))}" alt="${esc(d.m + " " + nombre(d))}" loading="lazy">` : silueta(d);
  return `<a class="bib ${UCLS[d.uso] || "u-diario"}" href="${zurl(d)}">
    <div class="bib-band"><span>${esc(d.m)}</span><span>${terr(d) === "Trail" ? "Trail · " : ""}N° ${pad(d.id)}</span></div>
    <div class="bib-img">${img}${dc >= 0.05 ? `<span class="off">−${Math.round(dc * 100)}%</span>` : ""}</div>
    <div class="bib-body"><h3 class="cond">${esc(nombre(d))}</h3>${d.corredor ? `<p class="bib-perfil">${d.tipo === "Estabilidad" ? "Pronador" : "Neutra"} · ${esc(kgCorto(d))}</p>` : ""}
      <div class="bib-foot"><span class="bib-uso">${d.var != null && d.var <= -0.05 ? `<span class="baja">▼ ${Math.round(-d.var * 100)}%</span>` : esc(d.uso)}</span>${precioTarjeta(d)}</div></div>
    <button class="cmp" aria-pressed="${on}" aria-label="Comparar ${esc(nombre(d))}" data-c="${d.id}">${on ? "✓" : "+"}</button></a>`;
}
function lista() {
  const l = DATA.filter(d => pasa(d));
  const X = 1e12, o = st.orden;
  return l.sort(o === "peso" ? (a, b) => (a.peso ?? X) - (b.peso ?? X) : o === "stack" ? (a, b) => (b.talon ?? -1) - (a.talon ?? -1)
    : o === "desc" ? (a, b) => desc(b) - desc(a) : o === "az" ? (a, b) => a.m.localeCompare(b.m) || a.mod.localeCompare(b.mod) : (a, b) => (a.min ?? X) - (b.min ?? X) || a.id - b.id);
}
function render() {
  const l = lista(), act = chipsActivos();
  $("#grid").innerHTML = l.map(tarjeta).join(""); $("#empty").hidden = l.length > 0;
  $("#cuenta").textContent = `${l.length} ${l.length === 1 ? "zapa" : "zapas"}`;
  $("#fpVer").textContent = `Ver ${l.length} ${l.length === 1 ? "zapa" : "zapas"}`;
  $("#fAbrir").innerHTML = `Filtros${act.length ? ` <i>${act.length}</i>` : ""}`;
  $("#activos").innerHTML = act.map(([k, t]) => `<button type="button" data-x="${esc(k)}" aria-label="Quitar ${esc(t)}">${esc(t)} <span aria-hidden="true">✕</span></button>`).join("")
    + (act.length > 1 ? `<button type="button" class="todo" data-x="todo">Limpiar todo</button>` : "");
  pintarPanel(); contarOpciones(); bandeja();
}
function bandeja() { const n = st.cmp.length; $("#tray").hidden = n === 0 || location.hash === "#comparar"; $("#traytxt").textContent = `${n} de 3 para comparar`; $("#traygo").disabled = n < 2; }
document.addEventListener("click", e => {
  const c = e.target.closest("[data-c]"); if (!c) return; e.preventDefault(); e.stopPropagation();
  const id = +c.dataset.c, i = st.cmp.indexOf(id); if (i >= 0) st.cmp.splice(i, 1); else if (st.cmp.length < 3) st.cmp.push(id);
  const on = st.cmp.includes(id);
  document.querySelectorAll(`[data-c="${id}"]`).forEach(b => { b.setAttribute("aria-pressed", on); b.textContent = b.classList.contains("cmp") ? (on ? "✓" : "+") : (on ? "✓ Comparando" : "+ Comparar"); });
  bandeja();
});
$("#trayclear").onclick = () => { st.cmp = []; render(); route(); };
$("#traygo").onclick = () => ir(BASE + "#comparar");

/* ---------- inicio: búsqueda, atajos y ofertas ---------- */
const irCatalogo = () => { if (location.hash === "#catalogo" && !esFicha()) document.getElementById("catalogo").scrollIntoView(); else ir(BASE + "#catalogo"); };
const ATAJOS = [
  ["Para arrancar", { uso: ["Iniciación"] }], ["Todos los días", { uso: ["Rodaje diario"] }], ["Fondos largos", { uso: ["Rodaje largo"] }],
  ["Para ir rápido", { uso: ["Ritmo"] }], ["Para competir", { uso: ["Competencia"] }], ["Pronadores", { pis: "Estabilidad" }],
  ["Menos de $100 mil", { pmax: 100000 }], ["Trail", { terreno: "Trail" }],
];
const aplicaAtajo = a => d => terr(d) === (a.terreno || "Asfalto") && (!a.uso || a.uso.includes(d.uso)) && (!a.pis || d.tipo === a.pis) && (!a.pmax || d.min && d.min <= a.pmax);
$("#atajos").innerHTML = ATAJOS.map(([t, a], i) => `<button type="button" data-a="${i}"><span>${t}</span><b>${DATA.filter(aplicaAtajo(a)).length}</b></button>`).join("");
$("#atajos").onclick = e => { const b = e.target.closest("button"); if (!b) return; const a = ATAJOS[+b.dataset.a][1]; medir("atajo", { t: ATAJOS[+b.dataset.a][0] });
  Object.assign(st, VACIO(), { q: "" }); $("#q").value = "";
  if (a.uso) a.uso.forEach(u => st.uso.add(u)); if (a.pis) st.pis = a.pis; if (a.pmax) st.pmax = a.pmax;
  st.terreno = a.terreno || "Asfalto"; setTerreno(st.terreno); irCatalogo(); };
$("#hbusca").onsubmit = e => { e.preventDefault(); const v = $("#hq").value.trim(); st.q = v.toLowerCase(); $("#q").value = v; render(); medirBusqueda("inicio"); irCatalogo(); };
function pintarOfertas() {
const ofertas = DATA.filter(d => desc(d) >= 0.1 && d.fotos.length).sort((a, b) => desc(b) - desc(a)).slice(0, 4);
$("#ofertas").innerHTML = ofertas.length ? `<div class="of-h"><span class="kicker">Ofertas de hoy</span><a href="#catalogo" id="ofTodas">Ver todas →</a></div>
  ${ofertas.map(d => `<a class="of" href="${zurl(d)}"><img src="${esc(src(d.fotos[0]))}" alt="" loading="lazy"><span class="of-n"><small>${esc(d.m)}</small><b>${esc(nombre(d))}</b><s>${fmt(d.tiendas[0].antes)}</s></span>
    <span class="of-p"><em>−${Math.round(desc(d) * 100)}%</em><b>${fmt(d.min)}</b><small>en ${esc(d.tiendas[0].tienda)}</small></span></a>`).join("")}` : "";
$("#ofTodas")?.addEventListener("click", e => { e.preventDefault(); medir("atajo", { t: "Ofertas: ver todas" }); Object.assign(st, VACIO(), { desc: true, q: "" }); st.orden = "desc"; $("#fOrden").value = "desc"; $("#q").value = ""; setTerreno("Asfalto"); irCatalogo(); });
}
pintarOfertas();

/* ---------- ficha ---------- */
let visor = null;
function media(d) {
  const stage = `<div class="media-box" id="m3d"${d.fotos.length ? " hidden" : ""}><div class="stage" id="dStage"><div class="lbls"></div></div></div>`;
  if (!d.fotos.length) return stage;
  return `<div><div class="seg" id="mtabs"><button data-mt="fotos" aria-pressed="true">Fotos</button><button data-mt="3d" aria-pressed="false">3D</button></div></div>
    <div class="media-box" id="mfotos"><img class="main" id="fotoMain" src="${esc(src(d.fotos[0]))}" alt="${esc(d.m + " " + nombre(d))}"></div>${stage}
    ${d.fotos.length > 1 ? `<div class="thumbs">${d.fotos.map((s, i) => `<button data-foto="${i}" aria-pressed="${i === 0}" aria-label="Foto ${i + 1}"><img src="${esc(src(s))}" alt="" loading="lazy"></button>`).join("")}</div>` : ""}`;
}
const lineaTalle = t => { const e = estadoTalle(t); return !TALLE ? "" : e ? `<span class="buy-t">✓ Hay talle ${TALLE}</span>` : `<span class="buy-t nd">No pudimos confirmar el talle ${TALLE}: chequealo en la tienda</span>`; };
const chips = t => t.talles?.length ? t.talles.map(x => `<i class="tc${t.sistema === "AR" && x === TALLE ? " on" : ""}">${t.sistema === "US" ? "US " : ""}${x}</i>`).join("") : `<span class="tc-nd">No pudimos chequear los talles: consultalos en la tienda</span>`;
function bloqueTalles(d) {
  const ts = d.todas.filter(t => paraGen(t)); if (!ts.length) return "";
  return `<div class="bloque"><h2 class="cond">Talles con stock</h2><p class="ad-sub">${ts.every(t => t.sistema === "US") ? "Talles de EE. UU. (así los informa la tienda)" : ts.some(t => t.sistema === "US") ? "Talles argentinos; los que dicen US son de EE. UU., como los informa la tienda" : "Talles argentinos"}, chequeados el ${esc(CAT.actualizado)}. ${TALLE ? `Resaltado, tu talle (${TALLE}).` : `Elegí tu talle en los filtros y te mostramos solo las tiendas que lo tienen.`}</p>
    <ul class="talles">${ts.map(t => `<li><span class="tl-n">${esc(t.tienda)}${t.nota ? ` <small>${esc(t.nota.toLowerCase())}</small>` : ""}</span><span class="tl-c">${chips(t)}</span></li>`).join("")}</ul></div>`;
}
function ficha(d) {
  const t = d.tiendas, best = t[0], resto = t.slice(1), ahorro = t.length > 1 ? t[t.length - 1].precio - best.precio : 0;
  const datos = [["Peso", d.peso && `${d.peso} g`], ["Drop", d.drop != null && `${d.drop} mm`], ["Talón", d.talon && `${d.talon} mm`], ["Antepié", d.ante && `${d.ante} mm`],
    ["Espuma", d.esp, 1], ["Placa", placa(d), 1], ["Terreno", terr(d), 1]].filter(x => x[1]);
  const c = d.corredor;
  return `<a class="back" href="#catalogo">← Todas las zapas</a>
  <div class="det-grid"><div class="media">${media(d)}</div>
  <div class="info">
    <p class="kicker">${esc(d.m)} · N° ${pad(d.id)}</p>
    <h1 class="cond">${esc(nombre(d))}</h1>
    <div class="tags">${terr(d) === "Trail" ? `<span class="tag trail">Trail</span>` : ""}<span class="tag uso ${UCLS[d.uso] || ""}">${esc(d.uso)}</span>${pisada(d) ? `<span class="tag">${pisada(d)}</span>` : ""}${conPlaca(d) ? `<span class="tag">Con placa</span>` : ""}</div>
    ${best ? `<div class="buy"><span class="kicker">Mejor precio</span><b class="buy-p">${fmt(best.precio)}</b>
      <span class="buy-s">en ${esc(best.tienda)}${best.cuotas && !/consultar/i.test(best.cuotas) ? " · " + esc(best.cuotas) : ""}</span>
      ${lineaTalle(best)}<a class="btn" href="${esc(best.url)}" target="_blank" rel="noopener">Comprar en ${esc(best.tienda)} ↗</a>
      ${ahorro > 0 ? `<p class="ahorro">Ahorrás ${fmt(ahorro)} contra la más cara.</p>` : ""}</div>` : d.sinTalle
      ? `<div class="buy"><span class="kicker">Tu talle</span><b class="buy-p cond" style="font-size:40px">Sin talle ${TALLE}</b><span class="buy-s">Ninguna tienda que chequeamos tiene el ${TALLE} ahora. Abajo están los talles que sí hay.</span><button class="btn" type="button" data-talle="">Ver todos los talles</button></div>`
      : d.otro
      ? `<div class="buy"><span class="kicker">Talles de ${GEN.toLowerCase()}</span><b class="buy-p cond" style="font-size:40px">No conseguimos</b><span class="buy-s">Solo la encontramos en talles de ${d.otro.gen.toLowerCase()}, desde ${fmt(d.otro.precio)}.</span><button class="btn" type="button" data-gen="">Ver todos los talles</button></div>`
      : `<div class="buy"><b class="buy-p cond" style="font-size:48px">Precio pronto</b></div>`}
    ${best && d.otro ? `<p class="otro-gen">También en talles de ${d.otro.gen.toLowerCase()} desde ${fmt(d.otro.precio)} · <button type="button" data-gen="">ver todos</button></p>` : ""}
    ${best && GEN && !d.otro ? `<p class="otro-gen">Mostrando precios de talles de ${GEN.toLowerCase()}.</p>` : ""}
    ${resto.length ? `<ul class="tiendas">${resto.map(s => `<li><a href="${esc(s.url)}" target="_blank" rel="noopener"><span class="t-n">${esc(s.tienda)} ↗</span><span class="t-c">${[s.nota, TALLE && (estadoTalle(s) ? `✓ talle ${TALLE}` : `talle ${TALLE} sin confirmar`)].filter(Boolean).map(esc).join(" · ")}</span><span class="t-p">${fmt(s.precio)}</span></a></li>`).join("")}</ul>` : ""}
    ${bloqueTalles(d)}
    ${grafico(d.hist) ? `<div class="bloque" id="histBox"><h2 class="cond">Cómo varió el precio</h2>${grafico(d.hist)}</div>` : ""}
    ${c ? `<div class="bloque"><h2 class="cond">¿Para quién?</h2><dl class="para">
      <div><dt>Pisada</dt><dd>${pisadaPara(d)}</dd></div><div><dt>Tu peso</dt><dd>${esc(c.peso)}</dd></div>
      <div><dt>Ritmo</dt><dd>${esc(c.ritmo)}</dd></div><div><dt>Distancias</dt><dd>${esc(c.distancia)}</dd></div>
      <div><dt>Nivel</dt><dd>${esc(c.nivel)}</dd></div></dl>${d.evitar ? `<p class="evitar"><b>No te conviene si</b> ${esc(d.evitar)}</p>` : ""}</div>` : ""}
    ${datos.length ? `<div class="bloque"><h2 class="cond">Ficha</h2>${amort(d) ? `<div class="amort-box"><span class="amort-k">Amortiguación</span>${medidor(amort(d))}<p><b>${d.talon} mm</b> de espuma en el talón: ${amort(d).s}.</p><small>Mide cuánta espuma tiene, no si se siente blanda o dura ni cuánto rebota.</small></div>` : ""}<dl class="ficha">${datos.map(([k, v, txt]) => `<div><dt>${k}</dt><dd${txt ? ' class="txt"' : ""}>${esc(v)}</dd></div>`).join("")}</dl></div>` : ""}
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
const CC = ["#8E1F3F", "#2F5DB8", "#C08A1E"];
function perfiles(ds) {
  const ok = ds.filter(d => d.talon && d.ante); if (!ok.length) return "";
  const max = Math.max(48, ...ok.map(d => d.talon)), k = 56 / max, B = 66, X0 = 92, X1 = 318;
  const fila = (d, n) => { const i = ds.indexOf(d), yh = B - d.talon * k, yf = B - d.ante * k, VH = n ? 72 : 88;
    return `<div class="alt-row"><div class="alt-n"><i style="background:${CC[i]}"></i><b>${esc(nombre(d))}</b><span>Drop ${d.drop ?? +(d.talon - d.ante).toFixed(1)} mm</span></div>
      <svg viewBox="0 0 420 ${VH}" role="img" aria-label="${esc(nombre(d))}: ${d.talon} mm en el talón y ${d.ante} mm en la punta">
        <line x1="${X0 - 6}" x2="${X1 + 34}" y1="${B}" y2="${B}" class="alt-piso"/>
        <path d="M${X0} ${B} V${(yh + 6).toFixed(1)} Q${X0} ${yh.toFixed(1)} ${X0 + 8} ${yh.toFixed(1)} L${X1} ${yf.toFixed(1)} Q${X1 + 28} ${yf.toFixed(1)} ${X1 + 28} ${B} Z" fill="${CC[i]}"/>
        <text x="${X0 - 10}" y="${(yh + 5).toFixed(1)}" text-anchor="end" class="alt-v">${d.talon}<tspan class="alt-u"> mm</tspan></text>
        <text x="${X1 + 36}" y="${(yf + 5).toFixed(1)}" class="alt-v">${d.ante}<tspan class="alt-u"> mm</tspan></text>
        ${n ? "" : `<text x="${X0}" y="84" class="alt-e">TALÓN</text><text x="${X1 + 28}" y="84" text-anchor="end" class="alt-e">PUNTA</text>`}
      </svg></div>`; };
  return `<div class="overlay"><h2 class="cond">Cuánta suela tiene cada una</h2>
    <p class="alt-sub">Vista de costado, en milímetros. Más alta, más amortiguación (cantidad de espuma, no si es blanda o dura). Más inclinada del talón a la punta, más drop.</p>
    ${ok.map(fila).join("")}</div>`;
}
function comparar() {
  const ds = st.cmp.map(id => DATA.find(x => x.id === id));
  if (ds.length < 2) return `<a class="back" href="#catalogo">← Todas las zapas</a><p class="empty">Elegí al menos dos zapas con el botón +.</p>`;
  const minP = Math.min(...ds.map(d => d.min ?? 1e12)), minW = Math.min(...ds.map(d => d.peso ?? 1e12));
  const grupos = [
    ["Precio", [["Mejor precio", d => d.min ? `<span class="${d.min === minP ? "win" : ""}">${fmt(d.min)}</span>` : ""],
      ["Tienda", d => d.tiendas[0] ? esc(d.tiendas[0].tienda) : ""]]],
    ["Para quién", [["Pisada", d => pisadaPara(d)], ["Tu peso", d => esc(d.corredor?.peso)], ["Ritmo", d => esc(d.corredor?.ritmo)],
      ["Distancias", d => esc(d.corredor?.distancia)], ["Nivel", d => esc(d.corredor?.nivel)], ["No te conviene si", d => esc(d.evitar)]]],
    ["Ficha", [["Amortiguación", d => amort(d) ? medidor(amort(d)) : ""], ["Uso", d => esc(d.uso)], ["Terreno", d => ds.some(x => terr(x) !== terr(d)) ? terr(d) : ""],
      ["Peso de la zapa", d => d.peso ? `<span class="${d.peso === minW ? "win" : ""}">${d.peso} g</span>` : ""],
      ["Drop", d => d.drop != null ? d.drop + " mm" : ""], ["Talón", d => d.talon ? d.talon + " mm" : ""], ["Antepié", d => d.ante ? d.ante + " mm" : ""],
      ["Espuma", d => esc(d.esp)], ["Placa", d => esc(placa(d))]]],
  ].map(([g, fs]) => [g, fs.filter(([, f]) => ds.some(d => f(d)))]);
  const filas = grupos.flatMap(([g, fs]) => [`<tr class="grp"><th colspan="${ds.length + 1}">${g}</th></tr>`,
    ...fs.map(([k, f]) => `<tr><th>${k}</th>${ds.map(d => `<td>${f(d) || "–"}</td>`).join("")}</tr>`)]).join("");
  return `<a class="back" href="#catalogo">← Todas las zapas</a><h1 class="cmp-h cond">Cara a cara</h1>${perfiles(ds)}
    <div class="tblwrap"><table class="cmpt"><thead><tr><th></th>${ds.map((d, i) => `<th><a href="${zurl(d)}" style="border-bottom:4px solid ${CC[i]}">${esc(nombre(d))}</a></th>`).join("")}</tr></thead>
    <tbody>${filas}</tbody></table></div>`;
}

/* ---------- recomendador ---------- */
const RESP_K = "trotecito-perfil";
let resp = (() => { try { return JSON.parse(guardado(RESP_K)) || {}; } catch { return {}; } })();
let paso = 0;
const opsDe = q => q.k === "uso" && resp.terreno === "Trail" ? q.trail : q.ops;
function recoPregunta() {
  const q = PREGUNTAS[paso], total = PREGUNTAS.length;
  return `<a class="back" href="#">← Volver al inicio</a>
  <div class="rq"><div class="rq-top"><span class="kicker">Tu zapa · ${paso + 1} de ${total}</span><div class="rq-bar"><i style="width:${(paso + 1) / total * 100}%"></i></div></div>
    <h1 class="cond">${q.t}</h1>
    <div class="rq-ops${q.grid ? " grid" : ""}">${opsDe(q).map(([v, t]) => `<button type="button" data-v="${esc(v)}" aria-pressed="${String(resp[q.k]) === String(v)}">${t}</button>`).join("")}</div>
    ${paso > 0 ? `<button type="button" class="rq-atras" data-atras>← Pregunta anterior</button>` : ""}</div>`;
}
function porque(lista, cls) { return lista.length ? `<ul class="rr-${cls}">${lista.map(t => `<li>${esc(t)}</li>`).join("")}</ul>` : ""; }
function recoResultado() {
  const { picks, sinPresupuesto } = recomendar(DATA, resp);
  const q = k => PREGUNTAS.find(x => x.k === k), txt = k => (opsDe(q(k)).find(([v]) => String(v) === String(resp[k])) || [])[1] || "";
  const perfilTxt = [(resp.gen === "Mujer" ? "Talles de mujer" : "Talles de hombre") + (resp.talle ? ` · talle ${resp.talle}` : ""), txt("uso"), txt("ritmo"), txt("kg"), resp.pis === "nose" ? "Pisada: no sé" : "Pisada " + txt("pis").split(":")[0].toLowerCase(), txt("tope")].filter(Boolean);
  const card = (p, i) => { const d = p.d, t = p.t;
    return `<article class="rr ${i === 0 ? "top" : ""}">
      <div class="rr-et"><b>${esc(p.etiqueta)}</b><span>${esc(p.sub)}</span></div>
      <a class="rr-img" href="${zurl(d)}">${d.fotos.length ? `<img src="${esc(src(d.fotos[0]))}" alt="${esc(d.m + " " + nombre(d))}">` : silueta(d)}</a>
      <div class="rr-body"><p class="kicker">${esc(d.m)}</p><h2 class="cond"><a href="${zurl(d)}">${esc(nombre(d))}</a></h2>
        <div class="rr-p"><b>${fmt(t.precio)}</b><span>en ${esc(t.tienda)}${t.antes > t.precio ? ` · antes ${fmt(t.antes)}` : ""}</span></div>
        <h3>Por qué te la recomendamos</h3>${porque(p.pros.slice(0, 4), "pro")}
        ${p.contras.length ? `<h3>Tené en cuenta</h3>${porque(p.contras.slice(0, 2), "con")}` : ""}
        <div class="rr-acc"><a class="btn fuerte" href="${esc(t.url)}" target="_blank" rel="noopener">Ver en ${esc(t.tienda)} ↗</a><a class="btn" href="${zurl(d)}">Ficha completa</a></div></div></article>`; };
  return `<a class="back" href="#">← Volver al inicio</a>
  <div class="rr-head"><h1 class="cond">Tus <em>${picks.length}</em> zapas</h1>
    <p class="rr-perfil">${perfilTxt.map(esc).join(" · ")} · <button type="button" data-rehacer>Cambiar respuestas</button></p>
    ${sinPresupuesto ? `<p class="rr-aviso">Con ese presupuesto encontramos pocas opciones para tu perfil, así que sumamos algunas que se pasan.</p>` : ""}
    ${resp.pis === "nose" ? `<p class="rr-aviso">¿No sabés cómo pisás? Mirá la suela de tus zapas viejas: si se gastan más del lado de adentro, probablemente pronás. Ante la duda, empezá por una neutra.</p>` : ""}</div>
  ${picks.length ? `<div class="rr-grid">${picks.map(card).join("")}</div>
  <div class="rr-pie"><button class="btn" type="button" data-cmp3>Comparar las ${picks.length}</button><a class="btn" href="#catalogo" data-vertodas>Ver todas las que te sirven</a></div>
  <p class="rr-nota">Las elegimos cruzando tus respuestas con la ficha de cada zapa y el precio de hoy. Ninguna tienda paga por aparecer acá.</p>`
  : `<p class="empty">No encontramos zapas con precio para ese perfil. Probá con otro presupuesto o con otro tipo de terreno.</p>`}`;
}
function pintarReco() {
  const listo = PREGUNTAS.every(q => resp[q.k] !== undefined);
  $("#reco").innerHTML = listo && paso >= PREGUNTAS.length ? recoResultado() : recoPregunta();
  window.scrollTo(0, 0);
}
$("#reco").addEventListener("click", e => {
  const op = e.target.closest(".rq-ops button");
  if (op) { const q = PREGUNTAS[paso]; resp[q.k] = q.k !== "talle" && /^\d+$/.test(op.dataset.v) ? +op.dataset.v : op.dataset.v;
    medir("reco_paso", { n: paso + 1, k: q.k, v: String(resp[q.k]) });
    if (q.k === "terreno" && resp.uso && !opsDe(PREGUNTAS.find(x => x.k === "uso")).some(([v]) => v === resp.uso)) delete resp.uso;
    paso++; if (paso >= PREGUNTAS.length) { guardar(RESP_K, JSON.stringify(resp));
      medir("reco_fin", { ...resp, picks: recomendar(DATA, resp).picks.map(p => p.d.slug) }); if (resp.gen !== GEN || resp.talle !== TALLE) { GEN = resp.gen; TALLE = resp.talle || ""; guardar("trotecito-gen", GEN); guardar("trotecito-talle", TALLE || null); aplicarGenero(); pintarOfertas(); } }
    pintarReco(); return; }
  if (e.target.closest("[data-atras]")) { paso = Math.max(0, paso - 1); pintarReco(); return; }
  if (e.target.closest("[data-rehacer]")) { paso = 0; medir("reco_inicio", { otra: true }); pintarReco(); return; }
  if (e.target.closest("[data-cmp3]")) { medir("reco_comparar"); st.cmp = recomendar(DATA, resp).picks.map(p => p.d.id).slice(0, 3); ir(BASE + "#comparar"); return; }
  if (e.target.closest("[data-vertodas]")) { e.preventDefault(); medir("reco_vertodas"); Object.assign(st, VACIO(), { q: "" }); $("#q").value = "";
    st.uso.add(resp.uso); if (resp.pis === "Pronadora") st.pis = "Estabilidad"; else if (resp.pis === "Neutra" || resp.pis === "Supinadora") st.pis = "Neutra";
    st.kg = resp.kg >= 90 ? 91 : resp.kg >= 75 ? 89 : 0; if (resp.tope) st.pmax = Math.min(P_MAX, resp.tope);
    st.terreno = resp.terreno; setTerreno(resp.terreno); ir(BASE + "#catalogo"); }
});
document.addEventListener("click", e => { const b = e.target.closest("[data-gen]"); if (!b) return; setGen(b.dataset.gen); route(); });
document.addEventListener("click", e => { const b = e.target.closest("[data-talle]"); if (!b) return; setTalle(b.dataset.talle); route(); });

/* ---------- rutas ---------- */
/* las fichas viven en /zapa/<modelo>/ (páginas reales que Google indexa); el resto, en la raíz con # */
const esFicha = () => location.pathname.startsWith(BASE + "zapa/");
function rutaActual() {
  if (esFicha()) {
    const slug = location.pathname.slice((BASE + "zapa/").length).split("/")[0], d = DATA.find(x => x.slug === slug);
    if (!d) history.replaceState(null, "", BASE);
    return { d: d || null, h: "" };
  }
  const h = location.hash.slice(1), m = h.match(/^m-(\d+)$/);
  if (m) { const d = DATA.find(x => x.id === +m[1]); history.replaceState(null, "", d ? zurl(d) : BASE); return { d: d || null, h: "" }; }
  return { d: null, h };
}
function ir(url) { if (url !== location.pathname + location.hash) history.pushState(null, "", url); route(); }
function route() {
  const { d, h } = rutaActual();
  if (visor) { visor.destroy(); visor = null; }
  const reco = h === "tu-zapa";
  $("#home").hidden = !!(d || h === "comparar" || reco); $("#detalle").hidden = !d; $("#comparar").hidden = h !== "comparar"; $("#reco").hidden = !reco;
  medir("vista", d ? { pag: "ficha", slug: d.slug } : h === "comparar" ? { pag: "comparar", slugs: st.cmp.map(id => DATA.find(x => x.id === id)?.slug) } : { pag: reco ? "tu-zapa" : h || "inicio" });
  if (reco && !PREGUNTAS.every(q => resp[q.k] !== undefined)) medir("reco_inicio");
  if (d) { $("#detalle").innerHTML = ficha(d); montarFicha(d); document.title = `${d.m} ${nombre(d)}: precio en Argentina y ficha técnica · Trotecito`; window.scrollTo(0, 0); }
  else if (reco) { paso = PREGUNTAS.every(q => resp[q.k] !== undefined) ? PREGUNTAS.length : 0; pintarReco(); document.title = "Tu zapa · Trotecito"; }
  else if (h === "comparar") { $("#comparar").innerHTML = comparar(); document.title = "Comparar · Trotecito"; window.scrollTo(0, 0); }
  else { document.title = "Trotecito"; render(); if (h === "catalogo" || h === "aprender") requestAnimationFrame(() => document.getElementById(h)?.scrollIntoView()); }
  bandeja();
}
const URL_TIENDA = new Map(DATA.flatMap(d => d.todas.map(t => [t.url, [d, t]])));
document.addEventListener("click", e => {
  const a = e.target.closest('a[href^="http"]'); if (!a) return;
  const x = URL_TIENDA.get(a.href); if (!x) return;
  const [d, t] = x, h = esFicha() ? "m-" : location.hash.slice(1);
  medir("tienda_clic", { slug: d.slug, tienda: t.tienda, precio: t.precio, nota: t.nota || "", origen: h === "tu-zapa" ? "recomendador" : h === "comparar" ? "comparar" : /^m-/.test(h) ? "ficha" : "otro", mejor: d.tiendas[0]?.url === t.url });
}, true);
document.addEventListener("click", e => { const a = e.target.closest('#reco a[href*="/zapa/"]'); if (a) medir("reco_ficha", { slug: a.getAttribute("href").split("/zapa/")[1].split("/")[0] }); }, true);
medirVisita();
/* links internos: se navega sin recargar la página */
document.addEventListener("click", e => {
  if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
  const a = e.target.closest("a[href]"); if (!a || a.target || a.hasAttribute("download")) return;
  const raw = a.getAttribute("href"), url = raw.startsWith("#") ? BASE + raw : raw;
  if (raw === "#" ) { e.preventDefault(); return ir(BASE); }
  if (!url.startsWith(BASE) || /^(data|fotos|assets)\/|admin\.html/.test(url.slice(BASE.length))) return;
  e.preventDefault(); ir(url);
});
addEventListener("popstate", route);
route();
