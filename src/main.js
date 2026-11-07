import "@fontsource-variable/archivo/wdth.css";
import "@fontsource/kanit/900-italic.css";
import "@fontsource/jetbrains-mono/500.css";
import "./styles.css";
import { Viewer, perfil, topY, RM } from "./shoe3d.js";
import { grafico, montarGrafico, variacion } from "./precios.js";
import { PREGUNTAS, recomendar, rangoKg, opTexto, aplica, DIST_TXT } from "./recomendador.js";
import { medir, medirVisita } from "./medir.js";
import { buscarModelo, reemplazos, sugerir } from "./reemplazo.js";
import { Pisada } from "./pisada.js";
import { bloqueLab, montarOpiniones } from "./opiniones.js";

//@@DATOS
const BASE = import.meta.env.BASE_URL;
const [CAT, HIST, COLORES, PUNT] = await Promise.all(["modelos", "historial", "colores", "puntajes"].map(n => fetch(BASE + `data/${n}.json`, { cache: "no-cache" }).then(r => r.ok ? r.json() : { series: {} }).catch(() => ({ series: {} }))));
//@@FIN

/* ---------- datos ---------- */
// Un precio que el robot no pudo actualizar en más de 7 días deja de mostrarse.
const aMs = f => { const [d, mo, y] = String(f || "").split("/").map(Number); return y ? Date.UTC(y, mo - 1, d) : 0; };
/* la vigencia se mide contra HOY (no contra la fecha del catálogo): si los robots dejan de correr, los precios viejos se caen solos */
const HOY_AR = new Intl.DateTimeFormat("es-AR", { timeZone: "America/Argentina/Buenos_Aires", day: "2-digit", month: "2-digit", year: "numeric" }).format(new Date());
const HOY_MS = aMs(HOY_AR);
const diasDe = f => Math.max(0, Math.round((HOY_MS - aMs(f)) / 864e5));
/* solo se muestra lo chequeado hoy o ayer: un precio más viejo puede llevar a un link sin producto */
const VIGENCIA_DIAS = 1;
const vigenteHasta = f => !!aMs(f) && diasDe(f) <= VIGENCIA_DIAS;
const hace = f => { if (!aMs(f)) return ""; const n = diasDe(f); return n === 0 ? "hoy" : n === 1 ? "ayer" : `hace ${n} días`; };
const DATA = CAT.modelos.filter(d => !d.borrador).map(d => ({ ...d, fotos: d.fotos || [], variantes: (Array.isArray(COLORES[d.slug]) ? COLORES[d.slug] : []).filter(v => !v.sinStock && vigenteHasta(v.fecha)).map(v => ({ ...v, otras: (v.otras || []).filter(o => vigenteHasta(o.fecha || v.fecha)) })), usos: d.usos?.length ? d.usos : [d.uso], todas: (d.tiendas || []).filter(t => !t.sinStock && vigenteHasta(t.fecha)).sort((a, b) => a.precio - b.precio) }));
{ const n = new Set(DATA.flatMap(d => d.todas.map(t => t.tienda))).size; const el = document.getElementById("nTiendas"); if (el && n) el.textContent = n; }
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
/* sello de marca: el nombre en la tipografía de Trotecito con un color propio (de nuestra paleta, no el de la marca) */
const SELLO_C = { Adidas: ["#1F3F8F"], Asics: ["#0E7C86"], Brooks: ["#8E1F3F"], Hoka: ["#E7B13C", "#141A2E"], "La Sportiva": ["#C2571F"],
  "New Balance": ["#5B6172"], Nike: ["#141A2E"], On: ["#0F7A57"], Puma: ["#B8336A"], Salomon: ["#56602A"], Saucony: ["#6A3FA0"], "Under Armour": ["#A9C9EC", "#141A2E"] };
const sello = (m, cls = "") => { const [bg, fg = "#FFFFFF"] = SELLO_C[m] || ["#141A2E"]; return `<span class="sello ${cls}" style="--sc:${bg};--st:${fg}">${esc(m)}</span>`; };
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

/* video de fondo de la portada: no se carga si pidieron menos movimiento o ahorro de datos; se pausa fuera de pantalla */
(() => {
  const v = $("#heroVid"); if (!v) return;
  const quieto = matchMedia("(prefers-reduced-motion: reduce)").matches || navigator.connection?.saveData;
  if (quieto) return;
  v.src = BASE + (innerWidth < 700 ? "video/portada-540.mp4" : "video/portada-1280.mp4");
  const jugar = () => v.play().catch(() => {});
  new IntersectionObserver(([e]) => e.isIntersecting && !document.hidden ? jugar() : v.pause()).observe(v);
  document.addEventListener("visibilitychange", () => document.hidden ? v.pause() : jugar());
})();

/* ---------- aprendé ---------- */
const VISTAS = { "Costado": 0, "3/4": 0.55, "Atrás": Math.PI / 2 };
const lab = Viewer($("#labStage"), { H: 38, F: 28, auto: false, view: 0.35 });
$("#labViews").innerHTML = Object.keys(VISTAS).map(k => `<button data-v="${k}" aria-pressed="false">${k}</button>`).join("");
function setVista(k) { lab.view(VISTAS[k], false); document.querySelectorAll("#labViews button").forEach(b => b.setAttribute("aria-pressed", b.dataset.v === k)); }
$("#labViews").onclick = e => { const b = e.target.closest("button"); if (b) setVista(b.dataset.v); };
const escala = (id, items) => `<div class="escala" id="${id}">${items.map(([r, t, s]) => `<div data-r="${r}"><b>${t}</b><span>${s}</span></div>`).join("")}</div>`;
const marcar = (id, v) => document.querySelectorAll(`#${id} div`).forEach(x => { const [a, b] = x.dataset.r.split("-").map(Number); x.classList.toggle("on", v >= a && v <= b); });
let pz = null;
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
  { k: "pisada", t: "Pisada", vista: "Atrás", plano: true,
    html: `<h3 class="cond">Pisada</h3><p>Una pierna corriendo, vista desde atrás. <b>Mirá el tobillo cuando el pie apoya</b>: la línea roja va de la pantorrilla al talón y debería quedar derecha.</p>
      <div class="seg" id="pis"><button data-t="neutra" aria-pressed="true">Neutra</button><button data-t="pronadora" aria-pressed="false">Pronadora</button><button data-t="supinadora" aria-pressed="false">Supinadora</button></div>
      <div class="seg pz-zap" id="pisz" hidden><button data-z="neutra" aria-pressed="true">Con zapa neutra</button><button data-z="estable" aria-pressed="false">Con zapa de estabilidad</button></div>
      <p class="resultado" id="pist"></p>`,
    mount() {
      const T = { neutra: "Apoya el talón, rueda apenas hacia adentro y el eje queda casi derecho: así amortigua el pie. Te va cualquier zapa neutra.",
        pronadora: "Con una zapa neutra el tobillo se vence hacia adentro y el eje se quiebra. Se gasta el borde de adentro de la suela. Una zapa de estabilidad lo frena.",
        estable: "La espuma más firme del lado de adentro (en violeta) frena el vencimiento: el eje queda casi derecho, como en una pisada neutra.",
        supinadora: "El pie no llega a rodar: queda apoyado sobre el borde de afuera y absorbe menos el golpe. Se gasta el lado de afuera. Te conviene una neutra bien amortiguada, nunca de estabilidad." };
      pz ??= Pisada($("#pzStage"));
      let tipo = "neutra", zapa = "neutra";
      const u = () => { const k = tipo === "pronadora" && zapa === "estable" ? "estable" : tipo; pz.set(k); $("#pist").textContent = T[k];
        document.querySelectorAll("#pis button").forEach(x => x.setAttribute("aria-pressed", x.dataset.t === tipo));
        document.querySelectorAll("#pisz button").forEach(x => x.setAttribute("aria-pressed", x.dataset.z === zapa)); $("#pisz").style.display = tipo === "pronadora" ? "" : "none"; };
      $("#pis").onclick = e => { const b = e.target.closest("button"); if (b) { tipo = b.dataset.t; zapa = "neutra"; u(); } };
      $("#pisz").onclick = e => { const b = e.target.closest("button"); if (b) { zapa = b.dataset.z; u(); } };
      u(); } },
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
  /* la pisada se explica mejor en plano (animación 2D) que con la zapa 3D */
  $("#pzStage").hidden = !l.plano; $("#labStage").style.visibility = l.plano ? "hidden" : ""; $("#labViews").style.display = l.plano ? "none" : "";
}
$("#lanes").onclick = e => { const b = e.target.closest(".tab"); if (b) abrirLane(b.dataset.k); };
abrirLane("drop");

/* ---------- catálogo ---------- */
/* el rango recomendado de la zapa se superpone con la franja de peso elegida (74: menos de 75, 89: 75 a 90, 91: más de 90) */
const FRANJA = { 74: [0, 75], 89: [75, 90], 91: [90, 999] };
const pesoOk = (d, kg) => { const { min, max } = rangoKg(d), [lo, hi] = FRANJA[kg] || [kg, kg]; return max > lo && min < hi; };
/* una rebaja con 1 o 2 talles sueltos no es una oferta para la mayoría: no se destaca (salvo que sea justo tu talle) */
const pocosTalles = t => !!t && !TALLE && !!t.sistema && Array.isArray(t.talles) && t.talles.length < 3;
const desc = d => { const t = d.tiendas[0]; return t?.antes > t?.precio && !pocosTalles(t) ? 1 - t.precio / t.antes : 0; };
const nivelAm = d => amort(d)?.t || "";
const PASO = 10000;
const P_MIN = Math.floor(Math.min(...DATA.filter(d => d.min).map(d => d.min)) / PASO) * PASO;
const P_MAX = Math.ceil(Math.max(...DATA.filter(d => d.min).map(d => d.min)) / PASO) * PASO;
const VACIO = () => ({ pis: "", uso: new Set(), marcas: new Set(), am: new Set(), kg: 0, pmin: P_MIN, pmax: P_MAX, desc: false, placa: false });
const st = { q: "", terreno: "Asfalto", orden: "precio", cmp: [], ...VACIO() };
const TERRENOS = [["Asfalto", "Calle, pista y cinta"], ["Trail", "Senderos y montaña"], ["Todos", "Asfalto y trail"]];
const PESOS = [[74, "Menos de 75 kg"], [89, "75 a 90 kg"], [91, "Más de 90 kg"]];
const AMS = ["Baja", "Media", "Alta", "Máxima"];
const milK = n => n >= 1e6 ? "$" + (n / 1e6).toLocaleString("es-AR", { maximumFractionDigits: 2 }) + " M" : "$" + Math.round(n / 1000) + " mil";

$("#terreno").innerHTML = TERRENOS.map(([t, s]) => `<button data-t="${t}" aria-pressed="${t === st.terreno}"><b class="cond">${t}</b><span>${s}</span><i>${DATA.filter(d => t === "Todos" || terr(d) === t).length}</i></button>`).join("");
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
    + `<label class="op-talle"><span>Tu talle</span><select class="pill" name="talle" id="fTalle" aria-label="Tu talle"><option value="">Cualquiera</option>${TALLES.map(x => `<option>${x}</option>`).join("")}</select></label>
    <p class="fg-nota">Muestra solo las tiendas que tienen tu talle o que no pudimos chequear. Talles argentinos.</p>`)}
  ${grupo("Precio", `<div class="rango"><div class="rango-v"><b id="pMinV"></b><span>a</span><b id="pMaxV"></b></div>
    <div class="rango-s"><div class="rango-f" id="pFill"></div>
      <input type="range" id="pMin" min="${P_MIN}" max="${P_MAX}" step="${PASO}" value="${P_MIN}" aria-label="Precio mínimo">
      <input type="range" id="pMax" min="${P_MIN}" max="${P_MAX}" step="${PASO}" value="${P_MAX}" aria-label="Precio máximo"></div>
    <div class="atajos-p">${[[0, 100000, "Hasta $100 mil"], [100000, 200000, "$100 a 200 mil"], [200000, 300000, "$200 a 300 mil"], [300000, 0, "Más de $300 mil"]]
      .map(([a, b, t]) => `<button type="button" data-pa="${a}" data-pb="${b}">${t}</button>`).join("")}</div></div>`)}
  ${grupo("¿Para qué la vas a usar?", USOS.map(u => opc("uso", u, u, "checkbox", UCLS[u])).join(""))}
  ${grupo("¿Cómo pisás?", [["", "Me da igual"], ["Neutra", "Neutra o supinadora"], ["Estabilidad", "Pronador"]].map(([v, t]) => opc("pis", v, t, "radio")).join(""))}
  ${grupo("¿Cuánto pesás?", [[0, "No filtrar"], ...PESOS].map(([v, t]) => opc("kg", v, t, "radio")).join(""))}
  ${grupo("Amortiguación", AMS.map(a => opc("am", a, a)).join(""))}
  ${grupo("Marca", MARCAS.map(m => opc("marca", m, sello(m))).join(""), ' id="fgMarca"')}
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
/* limpia todos los filtros, incluidos los de talle (que quedan guardados entre visitas) y la búsqueda */
function limpiarTodo() {
  Object.assign(st, VACIO(), { q: "" }); $("#q").value = "";
  GEN = ""; TALLE = ""; guardar("trotecito-gen", null); guardar("trotecito-talle", null);
  aplicarGenero(); pintarOfertas(); render();
}
$("#fpLimpiar").onclick = () => { medir("filtro", { k: "limpiar", v: "panel" }); limpiarTodo(); };
/* en celu el panel ocupa toda la pantalla: es un diálogo. El foco entra, lo de atrás queda inactivo, Escape cierra
   y al cerrar el foco vuelve al botón "Filtros" */
let fondoInerte = [];
const abrirF = v => {
  fp.classList.toggle("open", v); document.body.classList.toggle("fp-on", v);
  const modal = v && getComputedStyle(fp).position === "fixed";
  fondoInerte.forEach(el => el.inert = false); fondoInerte = [];
  if (modal) {
    fp.setAttribute("role", "dialog"); fp.setAttribute("aria-modal", "true");
    for (let n = fp; n && n !== document.body; n = n.parentElement)
      for (const h of n.parentElement.children) if (h !== n && !h.inert && h.tagName !== "SCRIPT") { h.inert = true; fondoInerte.push(h); }
    requestAnimationFrame(() => $("#fpCerrar").focus());
  } else { fp.removeAttribute("role"); fp.removeAttribute("aria-modal"); if (!v && document.activeElement && fp.contains(document.activeElement)) $("#fAbrir").focus(); }
};
document.addEventListener("keydown", e => { if (e.key === "Escape" && fp.classList.contains("open")) { abrirF(false); $("#fAbrir").focus(); } });
$("#fpCerrar").onclick = $("#fpVer").onclick = () => abrirF(false);
$("#fAbrir").onclick = () => abrirF(true);
$("#fAbrir").setAttribute("aria-controls", "fpanel");
$("#fOrden").onchange = e => { st.orden = e.target.value; render(); };
let busqT; const medirBusqueda = (desde) => { if (st.q.length >= 3) medir("busqueda", { q: st.q, n: lista().length, desde }); };
/* al buscar un modelo se busca en todos los terrenos (y el selector lo muestra); si después elegís uno, se respeta */
const buscarTodos = () => { if (st.q && st.terreno !== "Todos" && !st._busco) { st._busco = true; setTerreno("Todos"); } if (!st.q) st._busco = false; };
$("#q").oninput = e => { st.q = e.target.value.trim().toLowerCase(); buscarTodos(); render(); clearTimeout(busqT); busqT = setTimeout(() => medirBusqueda("catalogo"), 1500); };

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
const pasa = (d, sin) => (!st.q || `${d.m} ${d.mod} ${d.ver} ${d.esp} ${terr(d)}`.toLowerCase().includes(st.q)) && (st.terreno === "Todos" || terr(d) === st.terreno)
  && (sin === "pis" || !st.pis || d.tipo === st.pis) && (sin === "uso" || !st.uso.size || d.usos.some(u => st.uso.has(u)))
  && (sin === "marca" || !st.marcas.size || st.marcas.has(d.m)) && (sin === "am" || !st.am.size || st.am.has(nivelAm(d)))
  && (sin === "kg" || !st.kg || pesoOk(d, st.kg)) && (sin === "desc" || !st.desc || desc(d) > 0.01) && (sin === "placa" || !st.placa || conPlaca(d))
  && (st.pmin <= P_MIN && st.pmax >= P_MAX || d.min && d.min >= st.pmin && (st.pmax >= P_MAX || d.min <= st.pmax));
/* cuántas zapas quedarían al tocar cada opción */
function contarOpciones() {
  fp.querySelectorAll("em[data-n]").forEach(em => {
    const [k, v] = em.dataset.n.split("|");
    const f = { gen: d => d.todas.some(t => paraGen(t, v)), uso: d => d.usos.includes(v), am: d => nivelAm(d) === v, marca: d => d.m === v, pis: d => !v || d.tipo === v, kg: d => !+v || pesoOk(d, +v), desc: d => desc(d) > 0.01, placa: d => conPlaca(d) }[k];
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
  if (k === "todo") { medir("filtro", { k: "limpiar", v: "chips" }); limpiarTodo(); return; }
  if (k === "precio") { st.pmin = P_MIN; st.pmax = P_MAX; } else if (k === "uso" || k === "am") st[k].delete(v); else if (k === "marca") st.marcas.delete(v);
  else if (k === "pis") st.pis = ""; else if (k === "kg") st.kg = 0; else if (k === "gen") { setGen(""); return; } else if (k === "talle") { setTalle(""); return; } else st[k] = false;
  render(); };

function precioTarjeta(d) {
  if (d.sinTalle) return `<span class="pronto">Sin talle ${TALLE}</span>`;
  if (d.min) { const t = d.tiendas[0], n = t.nota, e = estadoTalle(t);
    const meta = TALLE ? (e ? `<em class="t-si">✓ talle ${TALLE}</em>` : `<em class="t-nd">talle ${TALLE} sin confirmar</em>`) : pocosTalles(t) ? `<em class="t-nd">quedan pocos talles</em>` : !GEN && (n === "Hombre" || n === "Mujer") ? n.toLowerCase() : "";
    return `<span class="bib-p">${meta ? `<small>${meta}</small>` : ""}<span class="bib-pp"><i>desde</i>${fmt(d.min)}</span></span>`; }
  return d.otro ? `<span class="pronto">Solo talles de ${d.otro.gen.toLowerCase()}</span>` : `<span class="pronto">Pronto</span>`;
}
/* colores en stock: los del género elegido; con talle elegido, primero los que lo tienen */
const coloresDe = d => d.variantes.filter(v => paraGen(v)).sort((a, b) => (estadoTalle(b) === true) - (estadoTalle(a) === true) || (estadoTalle(a) === false) - (estadoTalle(b) === false) || a.precio - b.precio);
const muestra = v => `<i class="sw" style="--c1:${esc(v.hex[0])};--c2:${esc(v.hex[1] || v.hex[0])}"></i>`;
function puntos(d) {
  const vs = coloresDe(d); if (vs.length < 2) return "";
  return `<span class="bib-cols" title="${vs.length} colores">${vs.slice(0, 4).map(muestra).join("")}${vs.length > 4 ? `<b>+${vs.length - 4}</b>` : ""}</span>`;
}
function tarjeta(d) {
  const on = st.cmp.includes(d.id), dc = desc(d);
  const img = d.fotos.length ? `<img src="${esc(src(d.fotos[0]))}" alt="${esc(d.m + " " + nombre(d))}" loading="lazy">` : silueta(d);
  return `<a class="bib ${UCLS[d.uso] || "u-diario"}" href="${zurl(d)}">
    <div class="bib-band">${sello(d.m)}<span>${terr(d) === "Trail" ? "Trail · " : ""}N° ${pad(d.id)}</span></div>
    <div class="bib-img">${img}${puntos(d)}${dc >= 0.05 ? `<span class="off" title="${Math.round(dc * 100)}% menos que el precio de lista de la tienda">−${Math.round(dc * 100)}% <small>de lista</small></span>` : ""}</div>
    <div class="bib-body"><h3 class="cond">${esc(nombre(d))}</h3>${d.corredor ? `<p class="bib-perfil">${d.tipo === "Estabilidad" ? "Pronador" : "Neutra"} · ${esc(kgCorto(d))}</p>` : ""}
      <div class="bib-foot"><span class="bib-uso">${d.var != null && d.var <= -0.05 ? `<span class="baja" title="El precio más bajo bajó ${Math.round(-d.var * 100)}% desde la última vez que cambió">Bajó ${Math.round(-d.var * 100)}%</span>` : esc(d.uso)}</span>${precioTarjeta(d)}</div></div>
    <button class="cmp" aria-pressed="${on}" aria-label="Comparar ${esc(nombre(d))}" data-c="${d.id}">${on ? "✓" : "+"}</button></a>`;
}
function lista() {
  const l = DATA.filter(d => pasa(d));
  const X = 1e12, o = st.orden;
  return l.sort(o === "peso" ? (a, b) => (a.peso ?? X) - (b.peso ?? X) : o === "stack" ? (a, b) => (b.talon ?? -1) - (a.talon ?? -1)
    : o === "desc" ? (a, b) => desc(b) - desc(a) : o === "az" ? (a, b) => a.m.localeCompare(b.m) || a.mod.localeCompare(b.mod) : (a, b) => (a.min ?? X) - (b.min ?? X) || a.id - b.id);
}
/* filtros en el link (#catalogo?q=…&uso=…): sobreviven a recargar y se pueden compartir */
function filtrosAUrl() {
  const p = new URLSearchParams();
  if (st.q) p.set("q", st.q); if (st.terreno !== "Asfalto") p.set("t", st.terreno);
  if (st.uso.size) p.set("uso", [...st.uso].join(",")); if (st.pis) p.set("pis", st.pis);
  if (st.marcas.size) p.set("m", [...st.marcas].join(",")); if (st.am.size) p.set("am", [...st.am].join(","));
  if (st.kg) p.set("kg", st.kg); if (st.pmin > P_MIN) p.set("pmin", st.pmin); if (st.pmax < P_MAX) p.set("pmax", st.pmax);
  if (st.desc) p.set("desc", "1"); if (st.placa) p.set("placa", "1"); if (st.orden && st.orden !== "precio") p.set("o", st.orden);
  if (GEN) p.set("g", GEN); if (TALLE) p.set("talle", TALLE);
  return p.toString();
}
function filtrosDeUrl(qs) {
  const p = new URLSearchParams(qs), lst = k => new Set((p.get(k) || "").split(",").filter(Boolean));
  Object.assign(st, VACIO(), { q: (p.get("q") || "").toLowerCase(), uso: lst("uso"), marcas: lst("m"), am: lst("am"), pis: p.get("pis") || "",
    kg: +p.get("kg") || 0, pmin: +p.get("pmin") || P_MIN, pmax: +p.get("pmax") || P_MAX, desc: p.get("desc") === "1", placa: p.get("placa") === "1" });
  st.orden = p.get("o") || "precio"; $("#fOrden").value = st.orden; $("#q").value = p.get("q") || ""; st._busco = !!st.q;
  const t = p.get("t"); st.terreno = TERRENOS.some(([x]) => x === t) ? t : "Asfalto";
  document.querySelectorAll("#terreno button").forEach(x => x.setAttribute("aria-pressed", x.dataset.t === st.terreno));
  if (p.has("g") && p.get("g") !== GEN) { GEN = p.get("g"); guardar("trotecito-gen", GEN || null); }
  if (p.has("talle") && p.get("talle") !== TALLE) { TALLE = p.get("talle"); guardar("trotecito-talle", TALLE || null); }
  aplicarGenero(); pintarOfertas();
}
function render() {
  const l = lista(), act = chipsActivos();
  if (!esFicha() && (location.hash === "" || location.hash.startsWith("#catalogo"))) {
    const qs = filtrosAUrl(), nueva = BASE + (qs ? "#catalogo?" + qs : location.hash.startsWith("#catalogo") ? "#catalogo" : "");
    if (nueva !== location.pathname + location.hash) history.replaceState(null, "", nueva);
  }
  $("#grid").innerHTML = l.map(tarjeta).join(""); $("#empty").hidden = l.length > 0;
  $("#cuenta").textContent = `${l.length} ${l.length === 1 ? "zapa" : "zapas"}`;
  $("#fpVer").textContent = `Ver ${l.length} ${l.length === 1 ? "zapa" : "zapas"}`;
  $("#fAbrir").innerHTML = `Filtros${act.length ? ` <i>${act.length}</i>` : ""}`;
  $("#activos").innerHTML = act.map(([k, t]) => `<button type="button" data-x="${esc(k)}" aria-label="Quitar ${esc(t)}">${esc(t)} <span aria-hidden="true">✕</span></button>`).join("")
    + (act.length > 1 ? `<button type="button" class="todo" data-x="todo">Limpiar todo</button>` : "");
  pintarPanel(); contarOpciones(); bandeja();
}
function bandeja() { const n = st.cmp.length; $("#tray").hidden = n === 0 || location.hash.startsWith("#comparar"); $("#traytxt").textContent = `${n} de 3 para comparar`; $("#traygo").disabled = n < 2; }
document.addEventListener("click", e => {
  const c = e.target.closest("[data-c]"); if (!c) return; e.preventDefault(); e.stopPropagation();
  const id = +c.dataset.c, i = st.cmp.indexOf(id);
  if (i >= 0) st.cmp.splice(i, 1);
  else if (st.cmp.length < 3) st.cmp.push(id);
  else { $("#traytxt").textContent = "Ya tenés 3: quitá una para sumar otra"; $("#tray").classList.add("lleno"); setTimeout(() => { $("#tray").classList.remove("lleno"); bandeja(); }, 2600); return; }
  if (location.hash.startsWith("#comparar")) { $("#comparar").innerHTML = comparar(); bandeja(); return; }
  const on = st.cmp.includes(id);
  document.querySelectorAll(`[data-c="${id}"]`).forEach(b => { b.setAttribute("aria-pressed", on); b.textContent = b.classList.contains("cmp") ? (on ? "✓" : "+") : (on ? "✓ Comparando" : "+ Comparar"); });
  bandeja();
});
$("#trayclear").onclick = () => { st.cmp = []; render(); route(); };
$("#traygo").onclick = () => ir(BASE + "#comparar");

/* ---------- inicio: búsqueda, atajos y ofertas ---------- */
const irCatalogo = () => { if (location.hash.startsWith("#catalogo") && !esFicha()) document.getElementById("catalogo").scrollIntoView(); else ir(BASE + "#catalogo"); };
/* buscador con sugerencias: elegir una sugerencia abre la ficha; si no hay coincidencias pero es una versión vieja
   o de otra línea ("Pegasus 39"), lleva al buscador de reemplazos */
function sugerencias(input, lista, alElegir) {
  let act = -1, items = [];
  const cerrar = () => { lista.hidden = true; input.setAttribute("aria-expanded", "false"); act = -1; };
  const pintar = () => {
    items = sugerir(DATA, input.value);
    lista.innerHTML = items.map((d, i) => `<li role="option" id="${lista.id}-${i}" aria-selected="${i === act}" data-i="${i}">${sello(d.m)}<b>${esc(nombre(d))}</b><span>${d.min ? "desde " + fmt(d.min) : "sin precio hoy"}</span></li>`).join("");
    lista.hidden = !items.length || !input.value.trim(); input.setAttribute("aria-expanded", String(!lista.hidden));
    input.setAttribute("aria-activedescendant", act >= 0 ? `${lista.id}-${act}` : ""); };
  input.addEventListener("input", () => { act = -1; pintar(); });
  input.addEventListener("keydown", e => {
    if (lista.hidden || !items.length) return;
    if (e.key === "ArrowDown" || e.key === "ArrowUp") { e.preventDefault(); act = (act + (e.key === "ArrowDown" ? 1 : -1) + items.length) % items.length; pintar(); }
    else if (e.key === "Enter" && act >= 0) { e.preventDefault(); const d = items[act]; cerrar(); alElegir(d); }
    else if (e.key === "Escape") cerrar(); });
  lista.addEventListener("mousedown", e => { const li = e.target.closest("li"); if (!li) return; e.preventDefault(); const d = items[+li.dataset.i]; cerrar(); alElegir(d); });
  input.addEventListener("blur", () => setTimeout(cerrar, 120));
  return { cerrar, hay: () => items.length };
}
const hsug = sugerencias($("#hq"), $("#hsug"), d => { medir("busqueda", { q: $("#hq").value.trim().toLowerCase(), n: 1, desde: "inicio", eligio: d.slug }); ir(zurl(d)); });
$("#hbusca").onsubmit = e => { e.preventDefault(); hsug.cerrar(); const v = $("#hq").value.trim(); if (!v) return;
  st.q = v.toLowerCase(); $("#q").value = v; buscarTodos(); render();
  if (!lista().length && buscarModelo(DATA, v)) { medir("busqueda", { q: st.q, n: 0, desde: "inicio", reemplazo: true }); reemQ = v; ir(BASE + "#reemplazo"); return; }
  medirBusqueda("inicio"); irCatalogo(); };
const verOfertas = () => { Object.assign(st, VACIO(), { desc: true, q: "" }); st.orden = "desc"; $("#fOrden").value = "desc"; $("#q").value = ""; setTerreno("Todos"); irCatalogo(); };
$("#pOfertas").onclick = e => { e.preventDefault(); medir("atajo", { t: "Puerta: ofertas" }); verOfertas(); };
function pintarOfertas() {
  const todas = DATA.filter(d => desc(d) >= 0.1 && d.fotos.length).sort((a, b) => desc(b) - desc(a)), ofertas = todas.slice(0, 4);
  $("#pOfTxt").textContent = todas.length ? `${todas.length} zapas con descuento y talles para elegir` : "Con talles para elegir";
  $("#ofertasSec").hidden = !ofertas.length;
  $("#ofertas").innerHTML = ofertas.map(d => `<a class="of" href="${zurl(d)}"><span class="of-img"><img src="${esc(src(d.fotos[0]))}" alt="" loading="lazy"><em>−${Math.round(desc(d) * 100)}%</em></span>
    <span class="of-n">${sello(d.m)}<b>${esc(nombre(d))}</b></span>
    <span class="of-p"><b>${fmt(d.min)}</b><s>${fmt(d.tiendas[0].antes)}</s><small>en ${esc(d.tiendas[0].tienda)}</small></span></a>`).join("");
}
$("#ofTodas").addEventListener("click", e => { e.preventDefault(); medir("atajo", { t: "Ofertas: ver todas" }); verOfertas(); });
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
function bloqueColores(d) {
  const vs = coloresDe(d); if (!vs.length) return "";
  return `<div class="colores"><p class="col-h">${vs.length === 1 ? "1 color en stock" : `${vs.length} colores en stock`}${GEN ? ` <span>talles de ${GEN.toLowerCase()}</span>` : ""}</p>
    <div class="col-row">${vs.map((v, i) => `<button class="col${estadoTalle(v) === false ? " sin" : ""}" data-col="${i}" aria-pressed="false" aria-label="${esc(v.n)}"><img src="${esc(src(v.foto))}" alt="" loading="lazy"><small>${muestra(v)}${esc(v.n)}</small></button>`).join("")}</div>
    <div class="col-info" id="colInfo" hidden></div></div>`;
}
function infoColor(v) {
  const vigente = vigenteHasta(v.fecha), e = estadoTalle(v);
  const talle = !TALLE ? "" : e ? `<span class="buy-t">✓ Hay talle ${TALLE}</span>` : e === false ? `<span class="buy-t no">No tiene tu talle ${TALLE}</span>` : `<span class="buy-t nd">Talle ${TALLE} sin confirmar</span>`;
  const otras = (v.otras || []).filter(o => paraGen(o));
  return `<p class="ci-n">${muestra(v)}<b>${esc(v.n)}</b>${v.nota ? `<span>talles de ${esc(v.nota.toLowerCase())}</span>` : ""}</p>
    <p class="ci-p"><b>${fmt(v.precio)}</b> en ${esc(v.tienda)}${diasDe(v.fecha) >= 1 ? ` <small>(chequeado ayer)</small>` : ""}</p>${talle}
    <a class="btn" href="${esc(v.url)}" target="_blank" rel="noopener">Ver este color en ${esc(v.tienda)} ↗</a>
    ${otras.length ? `<p class="ci-o">También en ${otras.map(o => `<a href="${esc(o.url)}" target="_blank" rel="noopener">${esc(o.tienda)}</a>${vigente ? ` (${fmt(o.precio)})` : ""}`).join(", ")}</p>` : ""}`;
}
const lineaTalle = t => { const e = estadoTalle(t); return !TALLE ? "" : e ? `<span class="buy-t">✓ Hay talle ${TALLE}</span>` : `<span class="buy-t nd">No pudimos confirmar el talle ${TALLE}: chequealo en la tienda</span>`; };
const chips = t => t.talles?.length ? t.talles.map((x, i) => `<i class="tc${t.sistema === "AR" && x === TALLE ? " on" : ""}"${t.us ? ` title="En la tienda figura como US ${esc(t.us[i] ?? "")}"` : ""}>${t.sistema === "US" ? "US " : ""}${x}</i>`).join("") + (t.us ? `<small class="tc-us">la tienda los publica en US (${esc(t.us.slice(0, 3).join(", "))}…)</small>` : "") : `<span class="tc-nd">No pudimos chequear los talles: consultalos en la tienda</span>`;
function bloqueTalles(d) {
  const ts = d.todas.filter(t => paraGen(t)); if (!ts.length) return "";
  return `<div class="bloque"><h2 class="cond">Talles con stock</h2><p class="ad-sub">${ts.some(t => t.sistema === "US") ? "Talles argentinos; los que dicen US son de EE. UU. (no tenemos la equivalencia de esa marca)" : "Talles argentinos"}${ts.some(t => t.us) ? ", pasados con la tabla de cada marca cuando la tienda publica en EE. UU." : "."} ${TALLE ? `Resaltado, tu talle (${TALLE}).` : `Elegí tu talle en los filtros y te mostramos solo las tiendas que lo tienen.`}</p>
    <ul class="talles">${ts.map(t => `<li><span class="tl-n">${esc(t.tienda)}${t.nota ? ` <small>${esc(t.nota.toLowerCase())}</small>` : ""}${diasDe(t.fecha) >= 1 ? `<small class="fr">${esc(hace(t.fecha))}</small>` : ""}</span><span class="tl-c">${chips(t)}</span></li>`).join("")}</ul></div>`;
}
/* todas las tiendas donde se consigue: primero las que te sirven; después, las que no tienen tu talle y las de otro talle de género */
const filaTienda = (s, extra) => `<li><a href="${esc(s.url)}" target="_blank" rel="noopener"><span class="t-n">${esc(s.tienda)} ↗</span><span class="t-c">${[s.nota, extra !== undefined ? extra : TALLE && (estadoTalle(s) ? `✓ talle ${TALLE}` : `talle ${TALLE} sin confirmar`)].filter(Boolean).map(esc).join(" · ")}</span><span class="t-p">${fmt(s.precio)}${diasDe(s.fecha) >= 1 ? `<small class="fr">${esc(hace(s.fecha))}</small>` : ""}</span></a></li>`;
function todasLasTiendas(d, resto) {
  const sinTu = TALLE ? d.todas.filter(x => paraGen(x) && estadoTalle(x) === false) : [];
  const otroGen = GEN ? d.todas.filter(x => !paraGen(x)) : [];
  if (!resto.length && !sinTu.length && !otroGen.length) return "";
  const total = d.tiendas.length + sinTu.length + otroGen.length;
  return `<div class="tiendas-box"><h3 class="tiendas-h">Todas las opciones para comprar <span>${total} ${total === 1 ? "tienda" : "tiendas"}</span></h3>
    <p class="tiendas-fr">Precios chequeados ${d.todas.every(x => diasDe(x.fecha) === 0) ? "hoy" : "entre hoy y ayer"}. Si una tienda no responde o sacó el producto, no la mostramos.</p>
    ${resto.length ? `<ul class="tiendas">${resto.map(x => filaTienda(x)).join("")}</ul>` : ""}
    ${sinTu.length ? `<p class="tiendas-sub">Sin tu talle ${esc(TALLE)} ahora</p><ul class="tiendas apagadas">${sinTu.map(x => filaTienda(x, `no tiene el ${TALLE}`)).join("")}</ul>` : ""}
    ${otroGen.length ? `<p class="tiendas-sub">En talles de ${otroGen[0].nota === "Mujer" ? "mujer" : "hombre"}</p><ul class="tiendas apagadas">${otroGen.map(x => filaTienda(x, "")).join("")}</ul>` : ""}</div>`;
}
function ficha(d) {
  const t = d.tiendas, best = t[0], resto = t.slice(1), ahorro = t.length > 1 ? t[t.length - 1].precio - best.precio : 0;
  const datos = [["Peso", d.peso && `${d.peso} g`], ["Drop", d.drop != null && `${d.drop} mm`], ["Talón", d.talon && `${d.talon} mm`], ["Antepié", d.ante && `${d.ante} mm`],
    ["Espuma", d.esp, 1], ["Placa", placa(d), 1], ["Terreno", terr(d), 1]].filter(x => x[1]);
  const c = d.corredor;
  return `<a class="back" href="#catalogo">← Todas las zapas</a>
  <div class="det-grid"><div class="media">${media(d)}</div>
  <div class="info">
    <p class="kicker f-marca">${sello(d.m, "grande")}<span>N° ${pad(d.id)}</span></p>
    <h1 class="cond">${esc(nombre(d))}</h1>
    <div class="tags">${terr(d) === "Trail" ? `<span class="tag trail">Trail</span>` : ""}<span class="tag uso ${UCLS[d.uso] || ""}">${esc(d.uso)}</span>${pisada(d) ? `<span class="tag">${pisada(d)}</span>` : ""}${conPlaca(d) ? `<span class="tag">Con placa</span>` : ""}</div>
    ${d.fotos.length ? bloqueColores(d) : ""}
    ${best ? `<div class="buy"><span class="kicker">Mejor precio</span><b class="buy-p">${fmt(best.precio)}</b>
      <span class="buy-s">en ${esc(best.tienda)}${!GEN && (best.nota === "Mujer" || best.nota === "Hombre") ? ` · <b>talles de ${best.nota.toLowerCase()}</b>` : ""}${best.cuotas && !/consultar/i.test(best.cuotas) ? " · " + esc(best.cuotas) : ""}</span>
      <span class="buy-f">Precio chequeado ${esc(hace(best.fecha))}</span>
      ${lineaTalle(best)}<a class="btn" href="${esc(best.url)}" target="_blank" rel="noopener">Comprar en ${esc(best.tienda)} ↗</a>
      ${ahorro > 0 ? `<p class="ahorro">Ahorrás ${fmt(ahorro)} contra la más cara.</p>` : ""}</div>` : d.sinTalle
      ? `<div class="buy"><span class="kicker">Tu talle</span><b class="buy-p cond" style="font-size:40px">Sin talle ${TALLE}</b><span class="buy-s">Ninguna tienda que chequeamos tiene el ${TALLE} ahora. Abajo están los talles que sí hay.</span><button class="btn" type="button" data-talle="">Ver todos los talles</button></div>`
      : d.otro
      ? `<div class="buy"><span class="kicker">Talles de ${GEN.toLowerCase()}</span><b class="buy-p cond" style="font-size:40px">No conseguimos</b><span class="buy-s">Solo la encontramos en talles de ${d.otro.gen.toLowerCase()}, desde ${fmt(d.otro.precio)}.</span><button class="btn" type="button" data-gen="">Ver todos los talles</button></div>`
      : `<div class="buy"><b class="buy-p cond" style="font-size:48px">Precio pronto</b></div>`}
    ${best && GEN && !d.otro ? `<p class="otro-gen">Mostrando precios de talles de ${GEN.toLowerCase()}.</p>` : ""}
    ${todasLasTiendas(d, resto)}
    ${bloqueTalles(d)}
    ${grafico(d.hist) ? `<div class="bloque" id="histBox"><h2 class="cond">Cómo varió el precio</h2>${grafico(d.hist)}</div>` : ""}
    ${c ? `<div class="bloque"><h2 class="cond">¿Para quién?</h2><dl class="para">
      <div><dt>Pisada</dt><dd>${pisadaPara(d)}</dd></div><div><dt>Tu peso</dt><dd>${esc(c.peso)}</dd></div>
      <div><dt>Ritmo</dt><dd>${esc(c.ritmo)}</dd></div><div><dt>Distancias</dt><dd>${esc(c.distancia)}</dd></div>
      <div><dt>Nivel</dt><dd>${esc(c.nivel)}</dd></div>${d.usos.length > 1 ? `<div><dt>También sirve para</dt><dd>${esc(cap(d.usos.slice(1).map(u => USO_FRASE[u] || u.toLowerCase()).join(", ")))}</dd></div>` : ""}${d.horma ? `<div><dt>Horma</dt><dd>${HORMA_TXT[d.horma]}</dd></div>` : ""}</dl>${d.evitar ? `<p class="evitar"><b>No te conviene si</b> ${esc(d.evitar)}</p>` : ""}</div>` : ""}
    ${bloqueLab(PUNT[d.slug])}
    ${datos.length ? `<div class="bloque"><h2 class="cond">Ficha</h2>${amort(d) ? `<div class="amort-box"><span class="amort-k">Amortiguación</span>${medidor(amort(d))}<p><b>${d.talon} mm</b> de espuma en el talón: ${amort(d).s}.</p><small>Mide cuánta espuma tiene, no si se siente blanda o dura ni cuánto rebota.</small></div>` : ""}<dl class="ficha">${datos.map(([k, v, txt]) => `<div><dt>${k}</dt><dd${txt ? ' class="txt"' : ""}>${esc(v)}</dd></div>`).join("")}</dl></div>` : ""}
    <div class="bloque opiniones" id="opBox"></div>
    <div class="acciones"><button class="btn" data-c="${d.id}" aria-pressed="${st.cmp.includes(d.id)}">${st.cmp.includes(d.id) ? "✓ Comparando" : "+ Comparar"}</button>
      <a class="btn" href="#reemplazo/${d.slug}">¿Corrés con estas? Ver reemplazos</a>
      ${d.fuente ? `<span class="review">Reviews: ${[d.fuente, d.fuente2].filter(Boolean).map(f => `<a href="${esc(f[1])}" target="_blank" rel="noopener">${esc(f[0])} ↗</a>`).join(" · ")}</span>` : ""}</div>
  </div></div>`;
}
const USO_FRASE = { "Iniciación": "empezar a correr", "Rodaje diario": "entrenar todos los días", "Rodaje largo": "fondos largos", "Ritmo": "series y ritmos", "Competencia": "competir" };
const cap = t => t.charAt(0).toUpperCase() + t.slice(1);
const HORMA_TXT = { ancha: "Ancha: buena para pie ancho", normal: "Normal", angosta: "Angosta: ajustada a los costados", punta: "Normal, con la punta angosta" };
function montarFicha(d) {
  montarGrafico(document.getElementById("histBox"), d.hist);
  montarOpiniones(document.getElementById("opBox"), d);
  const crear = () => { if (!visor) visor = Viewer($("#dStage"), { H: d.talon || 36, F: d.ante || 28, plate: conPlaca(d), dims: !!(d.talon && d.ante), view: 0.3 }); };
  if (!d.fotos.length) { crear(); return; }
  $("#mtabs").onclick = e => { const b = e.target.closest("button"); if (!b) return; const tres = b.dataset.mt === "3d";
    $("#m3d").hidden = !tres; $("#mfotos").hidden = tres; document.querySelectorAll("#mtabs button").forEach(x => x.setAttribute("aria-pressed", x === b)); if (tres) crear(); };
  const cols = document.querySelector(".col-row"), vs = coloresDe(d);
  if (cols) cols.onclick = e => { const b = e.target.closest("button"); if (!b) return; const v = vs[+b.dataset.col];
    const ya = b.getAttribute("aria-pressed") === "true";
    cols.querySelectorAll("button").forEach(x => x.setAttribute("aria-pressed", !ya && x === b));
    document.querySelectorAll(".thumbs button").forEach((x, i) => x.setAttribute("aria-pressed", ya && i === 0));
    $("#fotoMain").src = src(ya ? d.fotos[0] : v.foto); $("#m3d").hidden = true; $("#mfotos").hidden = false;
    document.querySelectorAll("#mtabs button").forEach(x => x.setAttribute("aria-pressed", x.dataset.mt === "fotos"));
    const info = $("#colInfo"); info.hidden = ya; if (!ya) { info.innerHTML = infoColor(v); medir("color", { slug: d.slug, c: v.n, t: v.tienda }); } };
  const th = document.querySelector(".thumbs");
  if (th) th.onclick = e => { const b = e.target.closest("button"); if (!b) return; $("#fotoMain").src = src(d.fotos[+b.dataset.foto]);
    th.querySelectorAll("button").forEach(x => x.setAttribute("aria-pressed", x === b)); $("#m3d").hidden = true; $("#mfotos").hidden = false;
    document.querySelectorAll(".col-row button").forEach(x => x.setAttribute("aria-pressed", false)); const ci = $("#colInfo"); if (ci) ci.hidden = true;
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
    ["Ficha", [["Amortiguación", d => amort(d) ? medidor(amort(d)) : ""], ["Uso", d => esc(d.usos.join(" · "))], ["Terreno", d => ds.some(x => terr(x) !== terr(d)) ? terr(d) : ""],
      ["Peso de la zapa", d => d.peso ? `<span class="${d.peso === minW ? "win" : ""}">${d.peso} g</span>` : ""],
      ["Drop", d => d.drop != null ? d.drop + " mm" : ""], ["Talón", d => d.talon ? d.talon + " mm" : ""], ["Antepié", d => d.ante ? d.ante + " mm" : ""],
      ["Espuma", d => esc(d.esp)], ["Placa", d => esc(placa(d))]]],
  ].map(([g, fs]) => [g, fs.filter(([, f]) => ds.some(d => f(d)))]);
  /* cada grupo repite los nombres: en el celu, al bajar, siempre sabés qué columna es cuál */
  const filas = grupos.flatMap(([g, fs]) => [`<tr class="grp"><th scope="colgroup">${g}</th>${ds.map((d, i) => `<th class="gn"><i style="background:${CC[i]}"></i>${esc(nombre(d))}</th>`).join("")}</tr>`,
    ...fs.map(([k, f]) => `<tr><th scope="row">${k}</th>${ds.map(d => `<td>${f(d) || "–"}</td>`).join("")}</tr>`)]).join("");
  return `<a class="back" href="#catalogo">← Todas las zapas</a><h1 class="cmp-h cond">Cara a cara</h1>${perfiles(ds)}
    <p class="cmp-acc">${ds.length < 3 ? `<a class="btn" href="#catalogo">+ Sumar otra</a>` : ""}<span>Podés comparar hasta 3. Para cambiar una, quitala y sumá otra.</span></p>
    <div class="tblwrap"><table class="cmpt"><thead><tr><th></th>${ds.map((d, i) => `<th scope="col">${sello(d.m)}<a href="${zurl(d)}" style="border-bottom:4px solid ${CC[i]}">${esc(nombre(d))}</a><button type="button" class="cmp-quitar" data-c="${d.id}" aria-label="Quitar ${esc(nombre(d))} de la comparación">✕ Quitar</button></th>`).join("")}</tr></thead>
    <tbody>${filas}</tbody></table></div>`;
}

/* ---------- recomendador ---------- */
const RESP_K = "trotecito-perfil";
let resp = (() => { try { return JSON.parse(guardado(RESP_K)) || {}; } catch { return {}; } })();
let paso = 0, editando = false;
/* preguntas que corresponden a estas respuestas (la de distancia solo si es para competir) */
const vigentes = () => PREGUNTAS.filter(q => aplica(q, resp));
const completo = () => vigentes().every(q => resp[q.k] !== undefined);
/* la próxima pregunta: la siguiente que corresponde o, si estaba cambiando una sola respuesta, la primera que falte */
function avanzar() {
  if (editando) { const f = PREGUNTAS.findIndex(q => aplica(q, resp) && resp[q.k] === undefined); paso = f < 0 ? PREGUNTAS.length : f; if (f < 0) editando = false; return; }
  do paso++; while (paso < PREGUNTAS.length && !aplica(PREGUNTAS[paso], resp));
}
const opsDe = q => q.k === "uso" && resp.terreno === "Trail" ? q.trail : q.ops;
/* pregunta "¿con qué zapas corrés hoy?": buscador de modelo y, al elegirlo, qué le parecen */
let actualTmp = null;   // { slug, label, nota } o { nada: texto }
function preguntaModelo() {
  const a = actualTmp, d = a?.slug && DATA.find(x => x.slug === a.slug);
  return `<p class="rq-sub">Nos sirve para proponerte algo parecido, o justamente distinto.</p>
    <div class="rq-modelo"><form class="hbusca" id="rqForm" role="search" autocomplete="off"><input type="search" id="rqQ" value="${esc(a?.label || a?.nada || "")}" placeholder="Ej.: Pegasus 40, Nimbus 25, Clifton 9…" aria-label="Modelo con el que corrés" aria-autocomplete="list" aria-controls="rqSug" aria-expanded="false"><button type="submit">Buscar</button></form>
      <ul class="sug" id="rqSug" role="listbox" hidden></ul></div>
    ${d ? `<p class="rq-elegida">${sello(d.m)} <b>${esc(a.label)}</b>${a.nota ? ` <span class="rq-nota">${esc(a.nota)}</span>` : ""}</p><p class="rq-sub"><b>¿Cómo te resultan?</b></p>
      <div class="rq-ops">${[["gusta", "Me encantan: quiero algo parecido"], ["ok", "Están bien"], ["no", "No me convencen: quiero algo distinto"]].map(([g, t]) => `<button type="button" data-v="${esc(`${d.slug}|${g}|${a.label}`)}">${t}</button>`).join("")}</div>`
    : a?.nada ? `<p class="rq-nada">No encontramos «${esc(a.nada)}» entre las que se venden acá. Probá con el nombre y el número, o seguí sin contarnos.</p>` : ""}
    <div class="rq-ops"><button type="button" class="rq-saltar" data-v="">No corro con ninguna o prefiero no decir</button></div>`;
}
function montarPreguntaModelo() {
  const s3 = sugerencias($("#rqQ"), $("#rqSug"), d => { actualTmp = { slug: d.slug, label: `${d.m} ${nombre(d)}` }; pintarReco(); });
  $("#rqForm").onsubmit = e => { e.preventDefault(); s3.cerrar(); const v = $("#rqQ").value.trim(); if (!v) return;
    const h = buscarModelo(DATA, v);
    actualTmp = h ? { slug: h.d.slug, label: `${h.d.m} ${h.d.mod}${h.version != null ? " " + (/^v/i.test(h.d.ver) ? "v" : "") + h.version : h.d.ver ? " " + h.d.ver : ""}`, nota: h.tipo === "anterior" ? `La comparamos con la versión actual, la ${nombre(h.d)}` : h.tipo === "posterior" ? `Acá se consigue la ${nombre(h.d)}` : "" } : { nada: v };
    pintarReco(); };
}
function recoPregunta() {
  const q = PREGUNTAS[paso], vs = vigentes(), total = vs.length, n = Math.max(0, vs.indexOf(q));
  if (q.tipo === "modelo" && !actualTmp && resp.actual) { const [sl, , lab] = String(resp.actual).split("|"); if (sl) actualTmp = { slug: sl, label: lab }; }
  return `<a class="back" href="#">← Volver al inicio</a>
  <div class="rq"><div class="rq-top"><span class="kicker">Tu zapa · ${editando ? "Cambiando una respuesta" : `${n + 1} de ${total}`}</span><div class="rq-bar"><i style="width:${(n + 1) / total * 100}%"></i></div></div>
    <h1 class="cond">${q.t}</h1>${q.sub ? `<p class="rq-sub">${q.sub}</p>` : ""}
    ${q.tipo === "modelo" ? preguntaModelo() : `<div class="rq-ops${q.grid ? " grid" : ""}">${opsDe(q).map(([v, t]) => `<button type="button" data-v="${esc(v)}" aria-pressed="${String(resp[q.k]) === String(v)}">${t}</button>`).join("")}</div>`}
    ${paso > 0 || Object.keys(resp).length ? `<div class="rq-nav">${editando && completo() ? `<button type="button" class="rq-atras" data-volver-res>← Volver a tus zapas</button>` : paso > 0 ? `<button type="button" class="rq-atras" data-atras>← Pregunta anterior</button>` : "<span></span>"}<button type="button" class="rq-reiniciar" data-reiniciar>↺ Reiniciar</button></div>` : ""}</div>`;
}
function porque(lista, cls) { return lista.length ? `<ul class="rr-${cls}">${lista.map(t => `<li>${esc(t)}</li>`).join("")}</ul>` : ""; }
/* resumen en criollo de las 3: qué gana y qué cede cada una frente a la primera */
function resumenPicks(picks) {
  if (picks.length < 2) return "";
  const n = p => `<b>${esc(p.d.m)} ${esc(nombre(p.d))}</b>`, a = picks[0];
  const frases = [`La ${n(a)} es la que mejor encaja con lo que contaste.`];
  for (const p of picks.slice(1)) {
    if (p.etiqueta === "Para entrenar") { frases.push(`La ${n(p)} no es para la carrera: es para entrenar el resto de la semana.`); continue; }
    const d = p.d, r = a.d, dif = a.t.precio - p.t.precio;
    const gana = [], cede = [];
    if (dif >= 10000) gana.push(`sale ${fmt(dif)} menos`); else if (-dif >= 10000) cede.push(`cuesta ${fmt(-dif)} más`);
    if (d.talon && r.talon && d.talon - r.talon >= 3) gana.push("tiene más espuma"); else if (d.talon && r.talon && r.talon - d.talon >= 3) cede.push("tiene menos espuma");
    if (d.peso && r.peso && r.peso - d.peso >= 15) gana.push("es más liviana"); else if (d.peso && r.peso && d.peso - r.peso >= 25) cede.push("es más pesada");
    if (placa(d) && !placa(r)) gana.push("tiene placa, para ir más rápido");
    if (d.tipo === "Estabilidad" && r.tipo !== "Estabilidad") gana.push("te da más estabilidad");
    if (p.s < a.s - 8 && !cede.length) cede.push("encaja un poco menos con tu perfil");
    let f = `La ${n(p)} `;
    if (gana.length) f += gana.join(" y ") + (cede.length ? `, aunque ${cede.join(" y ")}` : "");
    else if (cede.length) f += `es una alternativa ${d.m !== r.m ? "de otra marca " : ""}que ${cede.join(" y ")}`;
    else f += d.m !== r.m ? "es casi tan buena opción, de otra marca" : "es casi tan buena opción";
    frases.push(f + ".");
  }
  return `<p class="rr-resumen"><span class="kicker">En resumen</span>${frases.join(" ")}</p>`;
}
function recoResultado() {
  const { picks, sinPresupuesto, paraElUso } = recomendar(DATA, resp);
  const q = k => PREGUNTAS.find(x => x.k === k), txt = k => opTexto((opsDe(q(k)).find(([v]) => String(v) === String(resp[k])) || [])[1] || "");
  const [, gustoAct, labAct] = String(resp.actual || "").split("|");
  /* cada respuesta se puede cambiar sola, sin rehacer todo */
  const perfil = [["gen", (resp.gen === "Mujer" ? "Talles de mujer" : "Talles de hombre") + (resp.talle ? ` · talle ${resp.talle}` : "")], ["uso", txt("uso")],
    resp.uso === "Competencia" && resp.dist ? ["dist", DIST_TXT[resp.dist]] : null, ["ritmo", txt("ritmo")], ["kg", txt("kg")],
    ["pis", resp.pis === "nose" ? "Pisada: no sé" : "Pisada " + txt("pis").split(":")[0].toLowerCase()],
    ["pie", resp.pie === "ancho" ? "Pie ancho" : resp.pie === "angosto" ? "Pie angosto" : "Pie normal"],
    ["actual", labAct ? `Usás ${labAct} (${({ gusta: "te encantan", ok: "están bien", no: "no te convencen" })[gustoAct] || ""})` : "Sin zapa actual"], ["tope", txt("tope")]].filter(Boolean);
  const card = (p, i) => { const d = p.d, t = p.t;
    return `<article class="rr${i === 0 ? " mejor" : ""}">
      <div class="rr-et"><b>${esc(p.etiqueta)}</b><span>${esc(p.sub)}</span></div>
      <a class="rr-img" href="${zurl(d)}">${d.fotos.length ? `<img src="${esc(src(d.fotos[0]))}" alt="${esc(d.m + " " + nombre(d))}">` : silueta(d)}</a>
      <div class="rr-body">${sello(d.m)}<h2 class="cond"><a href="${zurl(d)}">${esc(nombre(d))}</a></h2>
        <div class="rr-p"><b>${fmt(t.precio)}</b><span>en ${esc(t.tienda)}${t.antes > t.precio ? ` · antes ${fmt(t.antes)}` : ""}</span></div>
        <h3>Por qué te la recomendamos</h3>${porque(p.pros.slice(0, 4), "pro")}
        ${p.contras.length ? `<h3>Tené en cuenta</h3>${porque(p.contras.slice(0, 2), "con")}` : ""}
        <div class="rr-acc"><a class="btn fuerte" href="${esc(t.url)}" target="_blank" rel="noopener">Ver en ${esc(t.tienda)} ↗</a><a class="btn" href="${zurl(d)}">Ficha completa</a></div></div></article>`; };
  return `<a class="back" href="#">← Volver al inicio</a>
  <div class="rr-head"><h1 class="cond">Tus <em>${picks.length}</em> zapas</h1>
    <p class="rr-perfil">${perfil.map(([k, t]) => `<button type="button" class="rr-dato" data-editar="${k}" title="Cambiar esta respuesta">${esc(t)} <span aria-hidden="true">✎</span></button>`).join("")}<button type="button" class="rr-dato rr-reini" data-reiniciar>↺ Empezar de nuevo</button></p>
    <p class="rr-ayuda">Tocá cualquier respuesta para cambiarla sola.</p>
    ${resp.uso === "Competencia" && resp.dist && picks.length && !picks.some(p => p.etiqueta !== "Para entrenar" && (!p.d.dist || p.d.dist.includes(resp.dist))) ? `<p class="rr-aviso">${resp.tope ? "Con ese presupuesto no" : "No"} encontramos zapas de carrera pensadas para ${DIST_TXT[resp.dist]}. La ${esc(nombre(picks[0].d))} es para ${esc(picks[0].d.dist?.map(x => DIST_TXT[x]).join(" y ") || "otras distancias")}: te puede servir, pero ${resp.tope ? "si podés estirar el presupuesto, hay mejores opciones para esa distancia" : "tené en cuenta esa diferencia"}.</p>` : ""}
    ${resp.uso === "Competencia" && paraElUso < picks.length ? `<p class="rr-aviso">${paraElUso === 1 ? "Encontramos una sola opción para competir" : `Encontramos ${paraElUso} opciones para competir`}${resp.tope ? " con ese presupuesto" : ""}; ${picks.length - paraElUso === 1 ? "la otra es para entrenar" : "las otras son para entrenar"}.</p>` : ""}
    ${sinPresupuesto ? `<p class="rr-aviso">Con ese presupuesto encontramos pocas opciones para tu perfil, así que sumamos algunas que se pasan.</p>` : ""}
    ${resp.pis === "nose" ? `<p class="rr-aviso">¿No sabés cómo pisás? Mirá la suela de tus zapas viejas: si se gastan más del lado de adentro, probablemente pronás. Ante la duda, empezá por una neutra.</p>` : ""}</div>
  ${picks.length ? `${resumenPicks(picks)}<div class="rr-grid">${picks.map(card).join("")}</div>
  <div class="rr-pie"><button class="btn" type="button" data-cmp3>Comparar las ${picks.length}</button><a class="btn" href="#catalogo" data-vertodas>Ver todas las que te sirven</a></div>
  <p class="rr-nota">Las elegimos cruzando tus respuestas con la ficha de cada zapa y el precio de hoy. Ninguna tienda paga por aparecer acá.</p>
  <div class="util" id="util">${utilHtml(utilClave(picks))}</div>`
  : `<p class="empty">No encontramos zapas con precio para ese perfil. Probá con otro presupuesto o con otro tipo de terreno.</p>`}`;
}
/* ¿te ayudó? — una respuesta por resultado; si es que no, el motivo */
const MOTIVOS = ["No conozco estos modelos", "Son muy caras", "No hay mi talle", "Esperaba otras marcas", "No me convencen las razones", "Otro motivo"];
const utilClave = picks => "trotecito-util-" + picks.map(p => p.d.slug).join(",");
const UTIL_MEM = {};
const utilLeer = k => { try { return sessionStorage.getItem(k) ?? UTIL_MEM[k] ?? null; } catch { return UTIL_MEM[k] ?? null; } };
const utilHtml = k => { const r = utilLeer(k);
  if (r === "no?") return `<p><b>¿Qué faltó?</b></p><div class="util-ops">${MOTIVOS.map(m => `<button type="button" data-motivo="${esc(m)}">${esc(m)}</button>`).join("")}</div>`;
  if (r) return `<p class="util-ok">¡Gracias! Lo usamos para mejorar las recomendaciones.</p>`;
  return `<p><b>¿Estas recomendaciones te ayudan a decidir?</b></p><div class="util-ops"><button type="button" data-util="si">Sí</button><button type="button" data-util="no">No</button></div>`; };
/* la pantalla de "analizando": cada paso es algo que el recomendador hace de verdad con tus respuestas */
function pensando() {
  const rapido = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const conPrecio = DATA.filter(d => d.todas.length), tiendas = new Set(DATA.flatMap(d => d.todas.map(t => t.tienda))).size;
  const precios = DATA.reduce((a, d) => a + d.todas.length, 0), terreno = resp.terreno === "Trail" ? "de trail" : "de asfalto";
  const pasos = [
    `Leyendo tu perfil: ${[resp.uso?.toLowerCase(), resp.kg ? `${resp.kg} kg` : "", resp.pis === "Pronadora" ? "pisada pronadora" : resp.pis === "Supinadora" ? "pisada supinadora" : "pisada neutra"].filter(Boolean).join(", ")}`,
    `Comparando ${conPrecio.filter(d => (d.terreno || "Asfalto") === resp.terreno).length} zapas ${terreno}: espuma, drop, peso y placa`,
    `Cruzando con lo que dicen las reviews de RunRepeat, Foroatletismo y Correr una Maratón`,
    resp.pie === "ancho" || resp.pie === "angosto" ? `Filtrando por horma para pie ${resp.pie}` : `Midiendo la horma de cada modelo`,
    `Revisando ${precios.toLocaleString("es-AR")} precios en ${tiendas} tiendas${resp.talle ? ` y quién tiene el ${resp.talle}` : ""}`,
    `Eligiendo tus 3`];
  $("#reco").innerHTML = `<div class="pensando" role="status" aria-live="polite"><div class="pz-ico" aria-hidden="true"><span>✦</span></div>
    <h1 class="cond">Analizando <em>tu perfil</em></h1><ol class="pz-pasos">${pasos.map(p => `<li>${esc(p)}</li>`).join("")}</ol></div>`;
  window.scrollTo(0, 0);
  const lis = [...document.querySelectorAll(".pz-pasos li")], t = rapido ? 120 : 620;
  return new Promise(ok => { lis.forEach((li, i) => setTimeout(() => { lis[i - 1]?.classList.replace("on", "ok"); li.classList.add("on"); }, i * t));
    setTimeout(ok, lis.length * t + (rapido ? 100 : 500)); });
}
function pintarReco() {
  const listo = completo();
  $("#reco").innerHTML = listo && paso >= PREGUNTAS.length ? recoResultado() : recoPregunta();
  if (!(listo && paso >= PREGUNTAS.length) && PREGUNTAS[paso].tipo === "modelo") montarPreguntaModelo();
  window.scrollTo(0, 0);
}
$("#reco").addEventListener("click", e => {
  const op = e.target.closest(".rq-ops button");
  if (op) { const q = PREGUNTAS[paso]; resp[q.k] = q.k !== "talle" && /^\d+$/.test(op.dataset.v) ? +op.dataset.v : op.dataset.v;
    medir("reco_paso", { n: paso + 1, k: q.k, v: q.k === "actual" ? String(resp.actual).split("|").slice(0, 2).join("|") : String(resp[q.k]) });
    if (q.k === "terreno" && resp.uso && !opsDe(PREGUNTAS.find(x => x.k === "uso")).some(([v]) => v === resp.uso)) delete resp.uso;
    avanzar(); if (paso >= PREGUNTAS.length) { editando = false; guardar(RESP_K, JSON.stringify(resp));
      medir("reco_fin", { ...resp, picks: recomendar(DATA, resp).picks.map(p => p.d.slug) }); if (resp.gen !== GEN || resp.talle !== TALLE) { GEN = resp.gen; TALLE = resp.talle || ""; guardar("trotecito-gen", GEN); guardar("trotecito-talle", TALLE || null); aplicarGenero(); pintarOfertas(); }
      pensando().then(pintarReco); return; }
    pintarReco(); return; }
  const u = e.target.closest("[data-util],[data-motivo]");
  if (u) { const picks = recomendar(DATA, resp).picks, k = utilClave(picks), sl = picks.map(p => p.d.slug);
    UTIL_MEM[k] = u.dataset.util === "no" ? "no?" : u.dataset.util || "no"; try { sessionStorage.setItem(k, UTIL_MEM[k]); } catch {}
    if (u.dataset.util === "si") medir("reco_util", { v: "si", picks: sl });
    if (u.dataset.motivo) medir("reco_util", { v: "no", motivo: u.dataset.motivo, picks: sl });
    $("#util").innerHTML = utilHtml(k); return; }
  if (e.target.closest("[data-atras]")) { do paso--; while (paso > 0 && !aplica(PREGUNTAS[paso], resp)); paso = Math.max(0, paso); pintarReco(); return; }
  const ed = e.target.closest("[data-editar]");
  if (ed) { const k = ed.dataset.editar === "gen" ? "gen" : ed.dataset.editar; paso = PREGUNTAS.findIndex(q => q.k === k); editando = true; actualTmp = null; medir("reco_editar", { k }); pintarReco(); return; }
  if (e.target.closest("[data-volver-res]")) { editando = false; paso = PREGUNTAS.length; pintarReco(); return; }
  if (e.target.closest("[data-reiniciar]")) { medir("reco_reiniciar", { paso: paso + 1 }); resp = {}; paso = 0; editando = false; actualTmp = null; guardar(RESP_K, null); pintarReco(); return; }
  if (e.target.closest("[data-rehacer]")) { paso = 0; actualTmp = null; medir("reco_inicio", { otra: true }); pintarReco(); return; }
  if (e.target.closest("[data-cmp3]")) { medir("reco_comparar"); st.cmp = recomendar(DATA, resp).picks.map(p => p.d.id).slice(0, 3); ir(BASE + "#comparar"); return; }
  if (e.target.closest("[data-vertodas]")) { e.preventDefault(); medir("reco_vertodas"); Object.assign(st, VACIO(), { q: "" }); $("#q").value = "";
    st.uso.add(resp.uso); if (resp.pis === "Pronadora") st.pis = "Estabilidad"; else if (resp.pis === "Neutra" || resp.pis === "Supinadora") st.pis = "Neutra";
    st.kg = resp.kg >= 90 ? 91 : resp.kg >= 75 ? 89 : 0; if (resp.tope) st.pmax = Math.min(P_MAX, resp.tope);
    st.terreno = resp.terreno; setTerreno(resp.terreno); ir(BASE + "#catalogo"); }
});
document.addEventListener("click", e => { const b = e.target.closest("[data-gen]"); if (!b) return; setGen(b.dataset.gen); route(); });
document.addEventListener("click", e => { const b = e.target.closest("[data-talle]"); if (!b) return; setTalle(b.dataset.talle); route(); });

/* ---------- encontrá el reemplazo ---------- */
let reemQ = "";
const specCorta = d => [d.talon && `${d.talon} mm de espuma`, d.drop != null && `drop ${d.drop} mm`, d.peso && `${d.peso} g`, d.tipo === "Estabilidad" ? "con estabilidad" : "neutra", d.uso.toLowerCase()].filter(Boolean).join(" · ");
const imgDe = d => d.fotos.length ? `<img src="${esc(src(d.fotos[0]))}" alt="${esc(d.m + " " + nombre(d))}" loading="lazy">` : silueta(d);
function reemplazoRes() {
  if (!reemQ) return "";
  const h = buscarModelo(DATA, reemQ);
  if (!h) return `<div class="re-nada"><h2 class="cond">No la encontramos</h2>
    <p>«${esc(reemQ)}» no está entre las zapas que se venden en las tiendas que seguimos. Probá con el nombre y el número, por ejemplo «Pegasus 39» o «Nimbus 25». Si es de una marca que no tenemos, contanos cómo corrés y te recomendamos 3.</p>
    <a class="btn fuerte" href="#tu-zapa">Ir al recomendador</a></div>`;
  const r = h.d, alts = reemplazos(DATA, h);
  const tuya = h.version != null && h.tipo !== "exacto" ? `${r.mod} ${h.version}` : nombre(r);
  const nota = { anterior: `La ${esc(tuya)} ya no se consigue en las tiendas que seguimos. La versión actual es la <b>${esc(nombre(r))}</b>: la usamos para comparar.`,
    posterior: `La ${esc(tuya)} todavía no llegó a las tiendas que seguimos. La que se consigue es la <b>${esc(nombre(r))}</b>.`,
    linea: `No tenemos esa variante. Comparamos con la <b>${esc(nombre(r))}</b>, de la misma línea.`,
    exacto: r.min ? `La tenemos: arriba de todo está su mejor precio y después, alternativas por si querés probar otra.` : `Ahora no la encontramos con stock. Te mostramos alternativas parecidas.` }[h.tipo];
  const filtro = [GEN && `talles de ${GEN.toLowerCase()}`, TALLE && `talle ${TALLE}`].filter(Boolean).join(" · ");
  const card = o => { const d = o.d, t = d.tiendas[0];
    return `<article class="re-c"><div class="re-et">${esc(o.t)}</div>
      <a class="re-img" href="${zurl(d)}">${imgDe(d)}</a>
      <div class="re-b">${sello(d.m)}<h3 class="cond"><a href="${zurl(d)}">${esc(nombre(d))}</a></h3>
        ${t ? `<p class="re-p"><b>${fmt(t.precio)}</b><span>en ${esc(t.tienda)}</span></p>` : ""}
        ${o.dif.length ? `<ul class="re-dif">${o.dif.map(x => `<li>${esc(x)}</li>`).join("")}</ul>` : `<p class="re-spec">${esc(specCorta(d))}</p>`}
        <div class="re-acc"><a class="btn" href="${zurl(d)}">Ver ficha</a>${o.d !== r ? `<button class="btn" type="button" data-recmp="${r.id},${d.id}">Comparar con la tuya</button>` : ""}</div></div></article>`; };
  return `<div class="re-ref"><div class="re-ref-img">${imgDe(r)}</div><div><span class="kicker">Tus zapas</span>
      <h2 class="cond">${sello(r.m)} ${esc(tuya)}</h2><p class="re-spec">${h.tipo === "exacto" ? "" : `Ficha de la ${esc(nombre(r))}: `}${esc(specCorta(r))}</p><p class="re-nota">${nota}</p></div></div>
    ${alts.length ? `<div class="re-grid">${alts.map(card).join("")}</div>` : `<p class="empty">No encontramos alternativas con precio para ${filtro || "este modelo"}.</p>`}
    <p class="rr-nota">Comparamos la ficha técnica: altura de espuma, drop, peso, tipo de pisada y para qué está pensada. ${filtro ? `Precios para ${filtro}.` : ""} Ninguna tienda paga por aparecer acá.</p>`;
}
function pintarReemplazo() {
  $("#reemplazo").innerHTML = `<a class="back" href="#">← Volver al inicio</a>
    <div class="re-head"><h1 class="cond">Encontrá el <em>reemplazo</em></h1>
      <p class="re-lede">Escribí el modelo con el que corrés hoy, aunque sea una versión vieja. Te mostramos la que se consigue ahora y alternativas: parecida, más amortiguada, más estable y más barata.</p>
      <div class="re-busca"><form class="hbusca re-form" id="rform" role="search" autocomplete="off"><input type="search" id="rq" value="${esc(reemQ)}" placeholder="Ej.: Pegasus 39, Nimbus 25, Ghost 15" aria-label="Modelo con el que corrés hoy" aria-autocomplete="list" aria-controls="rsug" aria-expanded="false"><button type="submit">Buscar</button></form>
      <ul class="sug" id="rsug" role="listbox" hidden></ul></div></div>
    <div id="rres">${reemplazoRes()}</div>`;
  const s2 = sugerencias($("#rq"), $("#rsug"), d => buscarReemplazo(`${d.m} ${nombre(d)}`));
  $("#rform").onsubmit = e => { e.preventDefault(); s2.cerrar(); buscarReemplazo($("#rq").value.trim()); };
}
function buscarReemplazo(q) {
  reemQ = q; const h = q ? buscarModelo(DATA, q) : null;
  if (q) medir("reemplazo", { q: q.toLowerCase(), ref: h?.d.slug || null, tipo: h?.tipo || "no" });
  $("#rres").innerHTML = reemplazoRes(); $("#rq").value = q;
}
$("#reemplazo").addEventListener("click", e => { const b = e.target.closest("[data-recmp]"); if (!b) return; st.cmp = b.dataset.recmp.split(",").map(Number); medir("reemplazo_comparar", { slugs: st.cmp.map(id => DATA.find(x => x.id === id)?.slug) }); ir(BASE + "#comparar"); });

/* ---------- rutas ---------- */
/* las fichas viven en /zapa/<modelo>/ (páginas reales que Google indexa); el resto, en la raíz con # */
const esFicha = () => location.pathname.startsWith(BASE + "zapa/");
function rutaActual() {
  if (esFicha()) {
    const slug = location.pathname.slice((BASE + "zapa/").length).split("/")[0], d = DATA.find(x => x.slug === slug);
    if (!d) history.replaceState(null, "", BASE);
    return { d: d || null, h: "" };
  }
  const h = location.hash.slice(1).split("?")[0], m = h.match(/^m-(\d+)$/);
  if (m) { const d = DATA.find(x => x.id === +m[1]); history.replaceState(null, "", d ? zurl(d) : BASE); return { d: d || null, h: "" }; }
  return { d: null, h };
}
function ir(url) { if (url !== location.pathname + location.hash) history.pushState(null, "", url); route(); }
function route() {
  const { d, h } = rutaActual();
  if (visor) { visor.destroy(); visor = null; }
  const reco = h === "tu-zapa", reemp = h === "reemplazo" || h.startsWith("reemplazo/");
  $("#home").hidden = !!(d || h === "comparar" || reco || reemp); $("#detalle").hidden = !d; $("#comparar").hidden = h !== "comparar"; $("#reco").hidden = !reco; $("#reemplazo").hidden = !reemp;
  medir("vista", d ? { pag: "ficha", slug: d.slug } : h === "comparar" ? { pag: "comparar", slugs: st.cmp.map(id => DATA.find(x => x.id === id)?.slug) } : { pag: reco ? "tu-zapa" : reemp ? "reemplazo" : h || "inicio" });
  if (reco && !completo()) medir("reco_inicio");
  if (d) { $("#detalle").innerHTML = ficha(d); montarFicha(d); document.title = `${d.m} ${nombre(d)}: precio en Argentina y ficha técnica · Trotecito`; window.scrollTo(0, 0); }
  else if (reco) { const falta = PREGUNTAS.findIndex(q => aplica(q, resp) && resp[q.k] === undefined); paso = falta < 0 ? PREGUNTAS.length : falta; pintarReco(); document.title = "Tu zapa · Trotecito"; }
  else if (reemp) { const x = h.startsWith("reemplazo/") && DATA.find(z => z.slug === h.split("/")[1]);
    pintarReemplazo(); if (x) buscarReemplazo(`${x.m} ${nombre(x)}`); document.title = "Encontrá el reemplazo de tus zapas · Trotecito"; window.scrollTo(0, 0); }
  else if (h === "comparar") { $("#comparar").innerHTML = comparar(); document.title = "Comparar · Trotecito"; window.scrollTo(0, 0); }
  else { document.title = "Trotecito"; if (h === "catalogo" && location.hash.includes("?")) filtrosDeUrl(location.hash.split("?")[1]); render(); if (h === "catalogo" || h === "aprender") requestAnimationFrame(() => document.getElementById(h)?.scrollIntoView()); }
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
