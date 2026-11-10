/* Panel de administración: lee los eventos de Supabase (solo con tu usuario) y muestra cómo se usa Trotecito. */
import "@fontsource-variable/archivo/wdth.css";
import "@fontsource/kanit/900-italic.css";
import "@fontsource/jetbrains-mono/500.css";
import "./styles.css";
import "./admin.css";
import { SUPABASE_URL as URL_SB, SUPABASE_KEY as KEY } from "./medir.js";
import { PREGUNTAS, opTexto } from "./recomendador.js";

const $ = s => document.querySelector(s);
const app = $("#app");
const esc = s => String(s ?? "").replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
const n0 = n => Math.round(n).toLocaleString("es-AR");
const pct = (a, b) => b ? Math.round(a / b * 100) + "%" : "–";
const dia = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Argentina/Buenos_Aires" });
const diaDe = ts => dia.format(new Date(ts));
const ddmm = iso => iso.slice(8, 10) + "/" + iso.slice(5, 7);
const horaAR = new Intl.DateTimeFormat("en-GB", { timeZone: "America/Argentina/Buenos_Aires", hour: "2-digit", hourCycle: "h23" });
const horaDe = ts => horaAR.format(new Date(ts)).slice(0, 2);
/* períodos: días de calendario de Argentina, contando hoy ("1" es hoy desde las 00:00) */
const RANGOS = [1, 2, 3, 7, 14, 30, 90];
const rangoTxt = () => rango === 1 ? "hoy" : `en los últimos ${rango} días`;
const lee = (k, st = sessionStorage) => { try { return JSON.parse(st.getItem(k)); } catch { return null; } };
const pone = (k, v, st = sessionStorage) => { try { v == null ? st.removeItem(k) : st.setItem(k, JSON.stringify(v)); } catch {} };

let sesion = lee("tt-admin");
let rango = 30, eventos = [], MOD = {}, cargando = false, robots = 0;

/* ---------- acceso ---------- */
function sinConfigurar() {
  app.innerHTML = `<section class="ad-box"><h1 class="cond">Falta conectar la base de datos</h1>
    <p>La medición guarda los eventos en Supabase (gratis). Seguí los pasos de <a href="https://github.com/morancito/trotecito-web/blob/main/docs/medicion.md" target="_blank" rel="noopener">docs/medicion.md</a> y pasale a Claude la <b>URL del proyecto</b> y la <b>anon public key</b>.</p></section>`;
}
function login(error = "") {
  $("#salir").hidden = true;
  app.innerHTML = `<form class="ad-box ad-login" id="flogin"><h1 class="cond">Entrar al panel</h1>
    <label>Email<input type="email" name="email" autocomplete="username" required></label>
    <label>Contraseña<input type="password" name="pass" autocomplete="current-password" required></label>
    ${error ? `<p class="ad-err">${esc(error)}</p>` : ""}
    <button class="btn fuerte" type="submit">Entrar</button>
</form>`;
  $("#flogin").onsubmit = async e => {
    e.preventDefault(); const f = new FormData(e.target);
    const r = await fetch(URL_SB + "/auth/v1/token?grant_type=password", { method: "POST", headers: { apikey: KEY, "Content-Type": "application/json" },
      body: JSON.stringify({ email: f.get("email"), password: f.get("pass") }) }).catch(() => null);
    const j = r && await r.json().catch(() => null);
    if (!r?.ok || !j?.access_token) return login("Email o contraseña incorrectos.");
    sesion = { token: j.access_token, hasta: Date.now() + (j.expires_in - 60) * 1000, email: j.user?.email };
    pone("tt-admin", sesion);
    try { localStorage.setItem("trotecito-nomedir", "1"); } catch {}   // tus visitas al sitio no cuentan
    cargar();
  };
}
$("#salir").onclick = () => { sesion = null; pone("tt-admin", null); login(); };

/* ---------- datos ---------- */
async function traerEventos(desdeISO) {
  const filas = [], paso = 1000;
  for (let i = 0; ; i += paso) {
    const r = await fetch(`${URL_SB}/rest/v1/eventos?select=ts,sesion,tipo,ruta,datos&ts=gte.${desdeISO}&order=ts.asc`, {
      headers: { apikey: KEY, Authorization: "Bearer " + sesion.token, Range: `${i}-${i + paso - 1}`, "Range-Unit": "items" } });
    if (r.status === 401) throw new Error("401");
    if (!r.ok) throw new Error("HTTP " + r.status);
    const lote = await r.json(); filas.push(...lote);
    if (lote.length < paso) break;
  }
  return filas;
}
async function cargar() {
  if (!sesion || Date.now() > sesion.hasta) return login(sesion ? "La sesión venció, entrá de nuevo." : "");
  /* vino desde herramientas sin sesión: entró y vuelve */
  if (new URLSearchParams(location.search).get("volver") === "herramientas") return location.replace("./herramientas.html");
  $("#salir").hidden = false; cargando = true; pintar();
  const desde = new Date(diaDe(Date.now() - (rango - 1) * 864e5) + "T00:00:00-03:00").toISOString();
  try {
    const [ev, cat, robot, rev] = await Promise.all([traerEventos(desde),
      fetch("data/modelos.json", { cache: "no-cache" }).then(r => r.json()).catch(() => null),
      fetch("data/robot.json", { cache: "no-cache" }).then(r => r.ok ? r.json() : null).catch(() => null),
      fetch("data/revisiones.json", { cache: "no-cache" }).then(r => r.ok ? r.json() : null).catch(() => null)]);
    /* robots: un navegador de verdad genera un número al azar distinto cada vez; los que indexan el sitio (Google)
       repiten siempre el mismo comienzo. Si un comienzo aparece en 3 o más números distintos, es un robot. */
    const com = new Map(), suma = (k, id) => { if (id) (com.get(k + id.slice(0, 8)) || com.set(k + id.slice(0, 8), new Set()).get(k + id.slice(0, 8))).add(id); };
    for (const e of ev) { suma("s", e.sesion); suma("v", e.datos?.vis); }
    const esRobot = e => (com.get("s" + String(e.sesion).slice(0, 8))?.size >= 3) || (e.datos?.vis && com.get("v" + e.datos.vis.slice(0, 8))?.size >= 3);
    const limpio = ev.filter(e => !esRobot(e)); robots = new Set(ev.filter(esRobot).map(e => e.sesion)).size;
    ev.length = 0; ev.push(...limpio);
    eventos = ev; MOD = Object.fromEntries((cat?.modelos || []).map(m => [m.slug, m]));
    await cargarOpiniones();
    window.__cat = cat; window.__robot = robot; window.__rev = rev;
  } catch (e) { if (e.message === "401") return login("La sesión venció, entrá de nuevo."); app.innerHTML = `<p class="ad-err">No pude leer los datos (${esc(e.message)}).</p>`; return; }
  cargando = false; pintar();
}

/* ---------- cálculos ---------- */
const nombre = slug => { const m = MOD[slug]; return m ? `${m.m} ${m.mod}${m.ver ? " " + m.ver : ""}` : slug || "–"; };
const cuenta = (arr, f) => { const c = new Map(); for (const x of arr) { const k = f(x); if (k == null || k === "") continue; c.set(k, (c.get(k) || 0) + 1); } return [...c].sort((a, b) => b[1] - a[1]); };
const sesionesCon = (tipo, f = () => true) => new Set(eventos.filter(e => e.tipo === tipo && f(e)).map(e => e.sesion));

function calcular() {
  const E = eventos, ses = new Set(E.map(e => e.sesion)), vis = new Set(E.map(e => e.datos?.vis).filter(Boolean));
  const clics = E.filter(e => e.tipo === "tienda_clic"), sesClic = new Set(clics.map(e => e.sesion));
  const fichas = E.filter(e => e.tipo === "vista" && e.datos?.pag === "ficha");
  const recoIni = sesionesCon("reco_inicio"), recoFin = sesionesCon("reco_fin");
  /* conversión del recomendador: después de ver sus zapas, el mismo visitante hizo clic a la tienda de una de las
     recomendadas, desde cualquier parte del sitio (resultado, ficha o comparador), en esa visita o en otra */
  const recos = E.filter(e => e.tipo === "reco_fin" && e.datos?.picks?.length);
  const clicsPorVis = new Map(); for (const c of clics) { const v = c.datos?.vis; if (v) (clicsPorVis.get(v) || clicsPorVis.set(v, []).get(v)).push(c); }
  const recoClic = new Set(), recoClicOrigen = [];
  for (const r of recos) {
    const c = (clicsPorVis.get(r.datos.vis) || []).find(c => c.ts >= r.ts && r.datos.picks.includes(c.datos?.slug));
    if (c && !recoClic.has(r.sesion)) { recoClic.add(r.sesion); recoClicOrigen.push(c); }
  }
  /* por día */
  /* con un solo día, la serie va por hora */
  const porHora = rango === 1, tramo = porHora ? horaDe : diaDe;
  const dias = []; if (porHora) for (let h = 0; h <= +horaDe(Date.now()); h++) dias.push(String(h).padStart(2, "0")); else for (let i = rango - 1; i >= 0; i--) dias.push(diaDe(Date.now() - i * 864e5));
  const primerDia = new Map(); for (const e of E) if (!primerDia.has(e.sesion)) primerDia.set(e.sesion, tramo(e.ts));
  const sesDia = Object.fromEntries(dias.map(d => [d, 0])), clicDia = Object.fromEntries(dias.map(d => [d, 0]));
  for (const d of primerDia.values()) if (d in sesDia) sesDia[d]++;
  for (const e of clics) { const d = tramo(e.ts); if (d in clicDia) clicDia[d]++; }
  /* embudo del recomendador */
  const pasos = PREGUNTAS.map((q, i) => [`${i + 1}. ${q.t.replace(/^¿|\?$/g, "")}`, sesionesCon("reco_paso", e => e.datos?.n === i + 1).size]);
  const embudoReco = [["Entraron al recomendador", recoIni.size], ...pasos, ["Vieron sus 3 zapas", recoFin.size], ["Fueron a la tienda de una recomendada", recoClic.size]];
  const recoFicha = sesionesCon("reco_ficha").size;
  /* embudo general */
  const vieronZapas = new Set(E.filter(e => e.tipo === "vista" && /catalogo|ficha|tu-zapa|comparar/.test(e.datos?.pag || "")).map(e => e.sesion));
  const embudo = [["Visitas", ses.size], ["Miraron zapas", vieronZapas.size], ["Abrieron una ficha", new Set(fichas.map(e => e.sesion)).size], ["Fueron a una tienda", sesClic.size]];
  /* perfiles del recomendador (última respuesta de cada visita) */
  const ultimo = new Map(); for (const e of E) if (e.tipo === "reco_fin") ultimo.set(e.sesion, e.datos);
  const perfiles = PREGUNTAS.map(q => [q.t, cuenta([...ultimo.values()], r => { const o = [...q.ops, ...(q.trail || [])].find(([v]) => String(v) === String(r[q.k])); return o ? opTexto(o[1]) : null; })]);
  const recomendadas = cuenta([...ultimo.values()].flatMap(r => r.picks || []), s => s);
  /* origen */
  const visitas = E.filter(e => e.tipo === "visita");
  const origen = cuenta(visitas, e => e.datos?.utm || e.datos?.ref || "Directo o sin dato");
  const disp = cuenta(visitas, e => e.datos?.disp);
  /* personas, no eventos: un visitante es nuevo si su primera entrada cayó en el período. Antes se contaba cada
     aviso de "primera vez" y podía dar más nuevos que visitantes. */
  const nuevos = new Set(visitas.filter(e => e.datos?.nuevo && e.datos?.vis).map(e => e.datos.vis)).size;
  /* búsquedas: la última de cada visita con el mismo comienzo, para no contar cada letra */
  const busq = E.filter(e => e.tipo === "busqueda");
  const porQ = new Map(); for (const e of busq) { const q = (e.datos?.q || "").trim(); const x = porQ.get(q) || { n: 0, res: e.datos?.n ?? 0 }; x.n++; x.res = e.datos?.n ?? x.res; porQ.set(q, x); }
  const busquedas = [...porQ].sort((a, b) => b[1].n - a[1].n);
  /* ¿le sirvió el recomendador? (última respuesta de cada visita) */
  const util = new Map(); for (const e of E) if (e.tipo === "reco_util") util.set(e.sesion, e.datos || {});
  const utilSi = [...util.values()].filter(u => u.v === "si").length;
  const utilMotivos = cuenta([...util.values()].filter(u => u.v === "no"), u => u.motivo || "Sin motivo");
  /* reemplazos: qué modelos buscan reemplazar y cuáles no encontramos */
  const reemp = E.filter(e => e.tipo === "reemplazo");
  const reempBuscados = cuenta(reemp, e => e.datos?.ref ? e.datos.ref : `“${e.datos?.q || ""}” (no la tenemos)`);
  return {
    util, utilSi, utilMotivos, reempBuscados, reemp,
    recoClicOrigen: cuenta(recoClicOrigen, e => ({ ficha: "Desde la ficha", recomendador: "Desde el resultado", comparar: "Desde el comparador" })[e.datos?.origen] || "Desde otro lado"), recoFicha, porHora, etq: porHora ? (h => h + " h") : ddmm, ses, vis, clics, sesClic, fichas, recoIni, recoFin, recoClic, dias, sesDia, clicDia, embudo, embudoReco, perfiles, recomendadas, origen, disp, nuevos, visitas, busquedas,
    topFichas: cuenta(fichas, e => e.datos?.slug), clicZapa: cuenta(clics, e => e.datos?.slug), clicTienda: cuenta(clics, e => e.datos?.tienda),
    clicOrigen: cuenta(clics, e => ({ ficha: "Ficha", recomendador: "Recomendador", comparar: "Comparador", otro: "Otro" })[e.datos?.origen] || "Otro"),
    filtros: cuenta(E.filter(e => e.tipo === "filtro"), e => `${({ gen: "Talles", uso: "Uso", pis: "Pisada", kg: "Peso", am: "Amortiguación", marca: "Marca", desc: "Con descuento", placa: "Con placa", precio: "Precio", talle: "Talle" })[e.datos?.k] || e.datos?.k}: ${e.datos?.k === "kg" ? ({ 74: "menos de 75", 89: "75 a 90", 91: "más de 90", 0: "no filtrar" })[e.datos?.v] || e.datos?.v : e.datos?.k === "desc" || e.datos?.k === "placa" ? "sí" : e.datos?.k === "precio" && /^\d+-\d+$/.test(e.datos?.v) ? e.datos.v.split("-").map(x => "$" + Math.round(x / 1000) + " mil").join(" a ") : e.datos?.v || "todos"}`),
    atajos: cuenta(E.filter(e => e.tipo === "atajo"), e => e.datos?.t),
    comparadas: cuenta(E.filter(e => e.tipo === "vista" && e.datos?.pag === "comparar").flatMap(e => e.datos?.slugs || []), s => s),
  };
}

/* ---------- piezas visuales ---------- */
const kpi = (t, v, sub = "") => `<div class="kpi"><span>${t}</span><b>${v}</b>${sub ? `<small>${sub}</small>` : ""}</div>`;
function barras(filas, { max = 10, fmtL = x => esc(x), vacio = "Todavía sin datos.", extra } = {}) {
  const f = filas.slice(0, max); if (!f.length) return `<p class="ad-vacio">${vacio}</p>`;
  const tope = Math.max(...f.map(x => x[1]));
  return `<ol class="barras">${f.map(([k, n], i) => `<li><span class="b-l">${fmtL(k)}${extra ? extra(k, n, i) : ""}</span><span class="b-t"><i style="width:${Math.max(2, n / tope * 100)}%"></i></span><b>${n0(n)}</b></li>`).join("")}</ol>`;
}
function embudo(pasos) {
  const base = pasos[0][1] || 0;
  return `<ol class="embudo">${pasos.map(([t, n], i) => { const prev = i ? pasos[i - 1][1] : n;
    return `<li><span class="e-l">${esc(t)}</span><span class="e-t"><i style="width:${base ? Math.max(1.5, n / base * 100) : 0}%"></i></span><b>${n0(n)}</b><small>${i ? (prev ? `${pct(n, prev)} del paso anterior` : "–") : ""}</small></li>`; }).join("")}</ol>`;
}
function serieDiaria(c) {
  const S = [{ n: "Visitas", v: c.dias.map(d => c.sesDia[d]), k: "s2" }, { n: "Clics a tiendas", v: c.dias.map(d => c.clicDia[d]), k: "s1" }];
  const W = 760, H = 240, M = { l: 40, r: 120, t: 14, b: 26 }, iw = W - M.l - M.r, ih = H - M.t - M.b;
  const max = Math.max(4, ...S.flatMap(s => s.v)), paso = [1, 2, 5, 10, 20, 25, 50, 100, 200, 250, 500, 1000, 2000, 5000].find(p => max / p <= 4) || 10000, top = Math.ceil(max / paso) * paso;
  const X = i => M.l + (c.dias.length > 1 ? i / (c.dias.length - 1) * iw : iw / 2), Y = v => M.t + ih - v / top * ih;
  const ty = []; for (let v = 0; v <= top; v += paso) ty.push(v);
  const cada = Math.ceil(c.dias.length / 6);
  const lab = S.map(s => ({ ...s, y: Y(s.v[s.v.length - 1]) })).sort((a, b) => a.y - b.y); if (lab[1] && lab[1].y - lab[0].y < 16) lab[1].y = lab[0].y + 16;
  return `<div class="hist ad-serie" data-dias='${JSON.stringify(c.dias.map(c.etq))}' data-s='${JSON.stringify(S.map(s => [s.n, s.v, s.k]))}'>
    <div class="hist-leg">${S.map(s => `<span><i style="background:var(--${s.k})"></i>${s.n}</span>`).join("")}</div>
    <div class="hist-plot"><svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Visitas y clics a tiendas ${c.porHora ? "por hora, hoy" : `por día, últimos ${rango} días`}">
      ${ty.map(v => `<line x1="${M.l}" x2="${W - M.r}" y1="${Y(v)}" y2="${Y(v)}" class="hg"/><text x="${M.l - 8}" y="${Y(v) + 4}" text-anchor="end" class="ht">${n0(v)}</text>`).join("")}
      ${c.dias.map((d, i) => i % cada === 0 || i === c.dias.length - 1 ? `<text x="${X(i)}" y="${H - 6}" text-anchor="middle" class="ht">${c.etq(d)}</text>` : "").join("")}
      ${S.map(s => `<polyline points="${s.v.map((v, i) => `${X(i).toFixed(1)},${Y(v).toFixed(1)}`).join(" ")}" fill="none" stroke="var(--${s.k})" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"/>`).join("")}
      ${lab.map(s => `<text x="${W - M.r + 8}" y="${s.y + 4}" class="hl">${s.n}: ${n0(s.v[s.v.length - 1])}</text>`).join("")}
      <line class="hx" x1="0" x2="0" y1="${M.t}" y2="${M.t + ih}" visibility="hidden"/>
      <rect class="hit" x="${M.l}" y="${M.t}" width="${iw}" height="${ih}" fill="transparent"/></svg><div class="hist-tip" hidden></div></div>
    <details class="hist-tabla"><summary>Ver como tabla</summary><div class="tblwrap"><table class="cmpt"><thead><tr><th>${c.porHora ? "Hora" : "Día"}</th>${S.map(s => `<th>${s.n}</th>`).join("")}</tr></thead>
      <tbody>${c.dias.slice().reverse().map((d, j) => { const i = c.dias.length - 1 - j; return `<tr><th>${c.etq(d)}</th>${S.map(s => `<td>${n0(s.v[i])}</td>`).join("")}</tr>`; }).join("")}</tbody></table></div></details></div>`;
}
function montarSerie() {
  const box = $(".ad-serie"); if (!box) return;
  const dias = JSON.parse(box.dataset.dias), S = JSON.parse(box.dataset.s), svg = box.querySelector("svg"), hit = svg.querySelector(".hit"), hx = svg.querySelector(".hx"), tip = box.querySelector(".hist-tip");
  const x0 = +hit.getAttribute("x"), w = +hit.getAttribute("width");
  const mover = e => { const r = svg.getBoundingClientRect(), vx = (e.clientX - r.left) / r.width * svg.viewBox.baseVal.width;
    const i = Math.round(Math.max(0, Math.min(1, (vx - x0) / w)) * (dias.length - 1)), px = x0 + (dias.length > 1 ? i / (dias.length - 1) * w : w / 2);
    hx.setAttribute("x1", px); hx.setAttribute("x2", px); hx.setAttribute("visibility", "visible");
    tip.innerHTML = `<b>${dias[i]}</b>` + S.map(([n, v, k]) => `<span><i style="background:var(--${k})"></i>${n}<em>${n0(v[i])}</em></span>`).join("");
    tip.hidden = false; tip.style.left = Math.min(Math.max(px / svg.viewBox.baseVal.width * r.width, 70), r.width - 70) + "px"; };
  hit.addEventListener("pointermove", mover); hit.addEventListener("pointerdown", mover);
  hit.addEventListener("pointerleave", () => { hx.setAttribute("visibility", "hidden"); tip.hidden = true; });
}
const bloque = (t, html, sub = "", cls = "") => `<section class="ad-b ${cls}"><h2 class="cond">${t}</h2>${sub ? `<p class="ad-sub">${sub}</p>` : ""}${html}</section>`;

/* ---------- pantalla ---------- */
function pintar() {
  const cab = `<div class="ad-head"><div><h1 class="cond">Cómo se usa <em>Trotecito</em></h1><p class="ad-sub">${sesion?.email ? esc(sesion.email) + " · " : ""}${cargando ? "Cargando…" : `${n0(eventos.length)} eventos ${rangoTxt()}${robots ? ` · ${n0(robots)} visitas de robots de buscadores sin contar` : ""}`}</p></div>
    <div class="ad-ctl"><div class="seg" id="rango">${RANGOS.map(d => `<button data-d="${d}" aria-pressed="${d === rango}" aria-label="${d === 1 ? "Hoy" : d + " días"}">${d === 1 ? "Hoy" : d + "<span> días</span><i>d</i>"}</button>`).join("")}</div>
    <button class="pill" id="recargar" type="button">Actualizar</button><button class="pill" id="csv" type="button">Bajar CSV</button></div></div>`;
  if (cargando) { app.innerHTML = cab + `<p class="ad-vacio">Leyendo los datos…</p>`; return eventosCab(); }
  if (!eventos.length) { app.innerHTML = cab + `<section class="ad-box ad-diag"><h2 class="cond">La base no te devuelve eventos</h2>
    <p>Entraste bien como <b>${esc(sesion.email)}</b>, pero no llegó ningún evento ${rangoTxt()}. Si en Supabase sí ves filas en la tabla <code>eventos</code>, es la regla de lectura: el email de la regla no coincide con el tuyo.</p>
    <p>En Supabase, andá a <b>SQL Editor</b>, pegá esto y tocá <b>Run</b>:</p>
    <pre><code>drop policy if exists "solo el admin lee" on public.eventos;
create policy "solo el admin lee" on public.eventos
  for select to authenticated
  using (lower(auth.jwt() ->> 'email') = '${esc(String(sesion.email || "").toLowerCase())}');</code></pre>
    <p>Después tocá <b>Actualizar</b>.</p></section>` + bloqueOpiniones() + tablero(); eventosCab(); return montarOpinionesAdmin(); }
  const c = calcular(), cat = window.__cat, rb = window.__robot;
  const precios = cat ? cat.modelos.reduce((a, m) => a + (m.tiendas?.length || 0), 0) : 0;
  app.innerHTML = cab + `
  <div class="kpis">
    ${kpi("Visitantes", n0(c.vis.size), `${n0(c.nuevos)} nuevos · ${n0(Math.max(0, c.vis.size - c.nuevos))} ya habían venido`)}
    ${kpi("Visitas", n0(c.ses.size), c.vis.size ? `${(c.ses.size / c.vis.size).toFixed(1)} por visitante` : "")}
    ${kpi("Fichas vistas", n0(c.fichas.length), c.ses.size ? `${(c.fichas.length / c.ses.size).toFixed(1)} por visita` : "")}
    ${kpi("Clics a tiendas", n0(c.clics.length), `${pct(c.sesClic.size, c.ses.size)} de las visitas`)}
    ${kpi("Recomendador", pct(c.recoFin.size, c.recoIni.size), `terminaron ${n0(c.recoFin.size)} de ${n0(c.recoIni.size)}`)}
    ${kpi("Del recomendador a la tienda", pct(c.recoClic.size, c.recoFin.size), `${n0(c.recoClic.size)} fueron a la tienda de una recomendada`)}
    ${kpi("Les sirvió la recomendación", c.util.size ? pct(c.utilSi, c.util.size) : "–", c.util.size ? `${n0(c.utilSi)} de ${n0(c.util.size)} que respondieron` : "Todavía nadie respondió")}
  </div>
  ${bloqueOpiniones()}
  ${bloque("Dónde mejorar", mejoras(c), `Lo que más pesa según lo que hizo la gente ${rangoTxt()}, ordenado por cuántas visitas afecta. Se calcula solo con los datos del período.`, "ad-mej")}
  ${bloque(c.porHora ? "Visitas y clics por hora" : "Visitas y clics por día", serieDiaria(c), `Una visita es cada vez que alguien abre el sitio; un visitante es una persona (puede hacer varias visitas). Pasá el mouse para ver cada ${c.porHora ? "hora" : "día"}.`)}
  <div class="ad-2">
    ${bloque("Embudo general", embudo(c.embudo), "De todas las visitas, cuántas llegan a una tienda.")}
    ${bloque("Embudo del recomendador", embudo(c.embudoReco) + `<h3>Cómo llegaron a la tienda</h3>` + barras(c.recoClicOrigen, { vacio: "Todavía nadie fue a la tienda de una recomendada." }),
      `Dónde se van los que empiezan las preguntas. El último paso cuenta el clic a la tienda de una de sus zapas recomendadas desde cualquier parte del sitio, aunque vuelva otro día. ${n0(c.recoFicha)} visitas abrieron la ficha de una recomendada.`)}
  </div>
  <div class="ad-2">
    ${bloque("Zapas más vistas", barras(c.topFichas, { fmtL: s => `<a href="./#m-${MOD[s]?.id}" target="_blank" rel="noopener">${esc(nombre(s))}</a>` }))}
    ${bloque("Clics a tiendas por zapa", barras(c.clicZapa, { fmtL: s => esc(nombre(s)) }), "Lo más cercano a una venta.")}
    ${bloque("Clics por tienda", barras(c.clicTienda) + `<h3>Desde dónde</h3>` + barras(c.clicOrigen))}
    ${bloque("Qué buscan", c.busquedas.length ? `<ol class="barras">${c.busquedas.slice(0, 12).map(([q, x]) => `<li><span class="b-l">${esc(q)}${x.res === 0 ? ` <em class="sin">sin resultados</em>` : ""}</span><span class="b-t"><i style="width:${x.n / c.busquedas[0][1].n * 100}%"></i></span><b>${n0(x.n)}</b></li>`).join("")}</ol>` : `<p class="ad-vacio">Todavía sin datos.</p>`, "Las que dicen \"sin resultados\" son modelos que la gente quiere y no tenemos.")}
    ${bloque("Por qué no les sirvió el recomendador", barras(c.utilMotivos, { vacio: "Nadie respondió que no." }), "Lo que eligieron los que dijeron que las recomendaciones no los ayudaron.")}
    ${bloque("Reemplazos buscados", barras(c.reempBuscados, { max: 12, fmtL: s => MOD[s] ? esc(nombre(s)) : esc(s) }), `${n0(c.reemp.length)} búsquedas. Las que dicen "no la tenemos" son modelos para sumar al catálogo.`)}
    ${bloque("Filtros más usados", barras(c.filtros, { max: 12 }))}
    ${bloque("Atajos del inicio", barras(c.atajos))}
  </div>
  ${bloque("Quiénes usan el recomendador", `<div class="ad-3">${c.perfiles.map(([t, filas]) => `<div><h3>${esc(t)}</h3>${barras(filas, { max: 6 })}</div>`).join("")}</div>`, "Última respuesta de cada visita que terminó las preguntas.")}
  <div class="ad-2">
    ${bloque("Las que más recomienda", barras(c.recomendadas, { fmtL: s => esc(nombre(s)) }), "Si siempre salen las mismas, conviene revisar los criterios.")}
    ${bloque("Más comparadas", barras(c.comparadas, { fmtL: s => esc(nombre(s)) }))}
    ${bloque("De dónde llegan", barras(c.origen) + `<h3>Dispositivo</h3>` + barras(c.disp))}
  </div>
  ${tablero()}
  ${bloque("Últimos eventos", `<div class="tblwrap"><table class="cmpt ad-ev"><thead><tr><th>Hora</th><th>Evento</th><th>Dónde</th><th>Detalle</th></tr></thead><tbody>
    ${eventos.slice(-40).reverse().map(e => `<tr><td>${new Date(e.ts).toLocaleString("es-AR", { timeZone: "America/Argentina/Buenos_Aires", day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })}</td><td>${esc(e.tipo)}</td><td>${esc(e.ruta)}</td><td><code>${esc(JSON.stringify(Object.fromEntries(Object.entries(e.datos || {}).filter(([k]) => k !== "vis"))))}</code></td></tr>`).join("") || `<tr><td colspan="4">Todavía no hay eventos.</td></tr>`}
    </tbody></table></div>`, "Para chequear que la medición funciona.")}`;
  eventosCab(); montarSerie(); montarOpinionesAdmin();
}
/* ---------- dónde mejorar: lecturas automáticas de los datos del período ---------- */
function mejoras(c) {
  const E = eventos, S = c.ses.size, out = [];
  const add = (peso, t, dato, accion) => out.push({ peso, t, dato, accion });
  const porSes = new Map(); for (const e of E) (porSes.get(e.sesion) || porSes.set(e.sesion, []).get(e.sesion)).push(e);
  if (S < 20) return `<p class="ad-vacio">Con ${n0(S)} visitas ${rangoTxt()} todavía es poco para sacar conclusiones: elegí un período más largo.</p>`;
  /* 1) se van sin hacer nada: solo la entrada y, como mucho, una pantalla */
  const pasivos = new Set(["visita", "vista"]);
  const rebote = [...porSes].filter(([, ev]) => ev.every(e => pasivos.has(e.tipo)) && ev.filter(e => e.tipo === "vista").length <= 1);
  if (rebote.length / S >= .35) {
    const donde = cuenta(rebote, ([, ev]) => { const r = ev[0].ruta || "inicio"; return r.startsWith("zapa/") || r.startsWith("m-") ? "la ficha de una zapa" : r === "inicio" ? "el inicio" : r === "catalogo" ? "el catálogo" : r === "tu-zapa" ? "el recomendador" : r; });
    const dispR = cuenta(rebote.map(([, ev]) => ev.find(e => e.tipo === "visita")).filter(Boolean), e => e.datos?.disp);
    add(rebote.length, `${pct(rebote.length, S)} de las visitas se va sin tocar nada`, `${n0(rebote.length)} de ${n0(S)} visitas entraron, miraron una pantalla y se fueron. Entraron sobre todo por ${donde.slice(0, 2).map(([k, n]) => `${esc(k)} (${n0(n)})`).join(" y ")}${dispR[0] ? `; ${pct(dispR[0][1], rebote.length)} desde ${esc(String(dispR[0][0]).toLowerCase())}` : ""}.`,
      donde[0]?.[0] === "el inicio" ? "La primera pantalla del inicio no los engancha: probá que lo primero que se vea sean ofertas reales con precio, o la primera pregunta del recomendador ya abierta." : "Fijate qué ve alguien que cae directo en esa pantalla sin conocer el sitio: tiene que quedar claro qué puede hacer ahí y adónde seguir.");
  }
  /* 2) el escalón más caro del embudo general */
  const em = c.embudo; let peor = null;
  for (let i = 1; i < em.length; i++) { const perd = em[i - 1][1] - em[i][1]; if (em[i - 1][1] >= 15 && (!peor || perd > peor.perd)) peor = { i, perd, de: em[i - 1], a: em[i] }; }
  if (peor && peor.perd / peor.de[1] >= .5) add(peor.perd * .8, `El embudo se corta entre "${peor.de[0]}" y "${peor.a[0]}"`, `De ${n0(peor.de[1])} visitas solo ${n0(peor.a[1])} dan el paso (${pct(peor.a[1], peor.de[1])}).`,
    ["", "Hacé más visible la entrada al catálogo y al recomendador desde donde aterrizan.", "En el catálogo, la tarjeta tiene que invitar a entrar: precio más bajo, tienda y descuento a la vista.", "En la ficha, el mejor precio y el botón a la tienda tienen que verse sin bajar, sobre todo en el celular."][peor.i]);
  /* 3) fichas muy vistas que no mandan a nadie a la tienda */
  const clicDe = new Map(c.clicZapa), frias = c.topFichas.filter(([s, n]) => n >= 8 && (clicDe.get(s) || 0) / n < .05).slice(0, 4);
  if (frias.length) add(frias.reduce((a, [, n]) => a + n, 0) * .6, "Zapas que se miran mucho y no generan clics", frias.map(([s, n]) => `${esc(nombre(s))}: ${n0(n)} vistas, ${n0(clicDe.get(s) || 0)} clics`).join(" · ") + ".",
    "Revisá en esas fichas si hay precio vigente, talles y una tienda confiable. Si el precio está fuera de mercado, la gente mira y se va.");
  /* 4) búsquedas sin resultado y reemplazos que no tenemos */
  const sinRes = c.busquedas.filter(([q, x]) => x.res === 0 && q.length >= 3);
  const falt = c.reempBuscados.filter(([k]) => /no la tenemos/.test(k));
  const nFalt = sinRes.reduce((a, [, x]) => a + x.n, 0) + falt.reduce((a, [, n]) => a + n, 0);
  if (nFalt >= 3) add(nFalt * 2, "Buscan modelos que no están", [...sinRes.slice(0, 5).map(([q, x]) => `“${esc(q)}” (${n0(x.n)})`), ...falt.slice(0, 4).map(([k, n]) => `${esc(k.replace(/ \(no la tenemos\)/, ""))} (${n0(n)})`)].join(" · ") + ".",
    "Sumá esos modelos al catálogo, o hacé que el buscador los entienda si ya están con otro nombre.");
  /* 5) recomendador: dónde abandonan y si termina en la tienda */
  const er = c.embudoReco; let corte = null;
  for (let i = 1; i < er.length - 1; i++) { const perd = er[i - 1][1] - er[i][1]; if (er[i - 1][1] >= 10 && perd / er[i - 1][1] >= .25 && (!corte || perd > corte.perd)) corte = { perd, de: er[i - 1], a: er[i] }; }
  if (corte) add(corte.perd, "El recomendador pierde gente en un paso", `Entre "${esc(corte.de[0])}" y "${esc(corte.a[0])}" se van ${n0(corte.perd)} de ${n0(corte.de[1])} (${pct(corte.perd, corte.de[1])}).`,
    "Esa pregunta frena: simplificá el texto, agregá un \"no sé\" o movela más adelante.");
  if (c.recoFin.size >= 10 && c.recoClic.size / c.recoFin.size < .15) add(c.recoFin.size * .5, "Terminan el recomendador pero no van a la tienda", `${n0(c.recoFin.size)} visitas vieron sus zapas y ${n0(c.recoClic.size)} hicieron clic a la tienda de una (${pct(c.recoClic.size, c.recoFin.size)}).`,
    "En el resultado, cada zapa tiene que mostrar el mejor precio y un botón directo a la tienda, sin pasar por la ficha.");
  if (c.util.size >= 5 && c.utilSi / c.util.size < .6) add(c.util.size, "A muchos no les sirve la recomendación", `${n0(c.util.size - c.utilSi)} de ${n0(c.util.size)} dijeron que no${c.utilMotivos[0] ? `; el motivo más elegido: "${esc(c.utilMotivos[0][0])}" (${n0(c.utilMotivos[0][1])})` : ""}.`, "Ajustá los criterios empezando por ese motivo.");
  /* 6) celular contra compu, y de dónde llegan los que sí hacen clic */
  const tasa = f => { const g = new Map(); for (const [s, ev] of porSes) { const v = ev.find(e => e.tipo === "visita"); const k = v && f(v); if (!k) continue; const x = g.get(k) || { n: 0, c: 0 }; x.n++; if (c.sesClic.has(s)) x.c++; g.set(k, x); } return g; };
  const td = tasa(v => v.datos?.disp), cel = td.get("Celular"), pc = td.get("Compu");
  if (cel && pc && cel.n >= 20 && pc.n >= 20) { const a = cel.c / cel.n, b = pc.c / pc.n;
    if (Math.max(a, b) > 0 && Math.min(a, b) / Math.max(a, b) < .6) { const mal = a < b ? ["el celular", cel, "la compu", pc] : ["la compu", pc, "el celular", cel];
      add(mal[1].n * .4, `En ${mal[0]} hacen muchos menos clics a tiendas`, `${pct(mal[1].c, mal[1].n)} de las visitas desde ${mal[0]} (${n0(mal[1].n)}) llega a una tienda, contra ${pct(mal[3].c, mal[3].n)} desde ${mal[2]} (${n0(mal[3].n)}).`, `Recorré una ficha completa en ${mal[0]}: el precio y el botón a la tienda tienen que estar a la vista sin bajar.`); } }
  const to = [...tasa(v => v.datos?.utm || v.datos?.ref || "Directo o sin dato")].filter(([, x]) => x.n >= 10).sort((a, b) => b[1].c / b[1].n - a[1].c / a[1].n);
  if (to.length >= 2) add(S * .15, "Qué origen trae visitas que sirven", to.map(([k, x]) => `${esc(k)}: ${pct(x.c, x.n)} llega a una tienda (${n0(x.n)} visitas)`).join(" · ") + ".", `Poné el esfuerzo en "${esc(to[0][0])}", que es de donde llega la gente que más clics hace.`);
  /* 7) vuelven poco */
  if (c.vis.size >= 30 && (c.vis.size - c.nuevos) / c.vis.size < .1 && rango >= 7) add(c.vis.size * .2, "Casi nadie vuelve", `${n0(c.vis.size - c.nuevos)} de ${n0(c.vis.size)} visitantes ya habían venido antes.`, "Dales un motivo para volver: avisos de baja de precio por modelo o un posteo semanal de ofertas en Instagram.");
  if (!out.length) return `<p class="ad-vacio">Con estos datos no aparece ningún punto flojo claro.</p>`;
  return `<ol class="mej">${out.sort((a, b) => b.peso - a.peso).slice(0, 7).map(m => `<li><b>${m.t}</b><span>${m.dato}</span><em>${esc(m.accion)}</em></li>`).join("")}</ol>`;
}

/* ---------- opiniones de corredores: moderación ---------- */
let OPS = { estado: "", pend: [], aprob: 0 };
async function cargarOpiniones() {
  const h = { apikey: KEY, Authorization: "Bearer " + sesion.token };
  try {
    const r = await fetch(`${URL_SB}/rest/v1/opiniones?estado=eq.pendiente&select=id,ts,slug,puntaje,km,uso,talle,peso,texto,nombre&order=ts.asc&limit=100`, { headers: h });
    if (r.status === 404) { OPS = { estado: "falta", pend: [], aprob: 0 }; return; }
    if (!r.ok) { OPS = { estado: "error " + r.status, pend: [], aprob: 0 }; return; }
    const pend = await r.json();
    const a = await fetch(`${URL_SB}/rest/v1/opiniones?estado=eq.aprobada&select=id`, { headers: { ...h, Prefer: "count=exact", Range: "0-0" } });
    OPS = { estado: "ok", pend, aprob: +((a.headers.get("content-range") || "").split("/")[1] || 0) };
  } catch { OPS = { estado: "error", pend: [], aprob: 0 }; }
}
const SQL_OPINIONES = email => `create table public.opiniones (
  id bigint generated always as identity primary key,
  ts timestamptz not null default now(),
  slug text not null check (slug ~ '^[a-z0-9-]{3,80}$'),
  visitante text not null check (length(visitante) between 6 and 40),
  puntaje smallint not null check (puntaje between 1 and 5),
  km text check (km in ('menos de 100','100 a 300','300 a 600','más de 600')),
  uso text check (length(uso) <= 30),
  talle text check (talle in ('justo','grande','chico')),
  peso text check (peso in ('menos de 60','60 a 75','75 a 90','más de 90')),
  texto text check (length(texto) <= 600),
  nombre text check (length(nombre) <= 30),
  estado text not null default 'pendiente' check (estado in ('pendiente','aprobada','rechazada')),
  unique (slug, visitante)
);
create index opiniones_slug on public.opiniones (slug, estado);
alter table public.opiniones enable row level security;
create policy "el sitio manda opiniones" on public.opiniones
  for insert to anon with check (estado = 'pendiente');
create policy "se ven las aprobadas" on public.opiniones
  for select to anon using (estado = 'aprobada');
create policy "el admin modera" on public.opiniones
  for all to authenticated
  using (lower(auth.jwt() ->> 'email') = '${email}')
  with check (lower(auth.jwt() ->> 'email') = '${email}');
revoke select, update, delete on public.opiniones from anon;
grant select (id, ts, slug, puntaje, km, uso, talle, peso, texto, nombre) on public.opiniones to anon;`;
function bloqueOpiniones() {
  if (OPS.estado === "falta") return bloque("Opiniones de corredores", `<p>Falta crear la tabla en Supabase. Andá a <b>SQL Editor › New query</b>, pegá esto y tocá <b>Run</b>. Después tocá <b>Actualizar</b>.</p>
    <pre><code>${esc(SQL_OPINIONES(String(sesion.email || "").toLowerCase()))}</code></pre>`, "", "ad-op");
  if (OPS.estado !== "ok") return bloque("Opiniones de corredores", `<p class="ad-err">No pude leer las opiniones (${esc(OPS.estado)}).</p>`, "", "ad-op");
  const fila = o => `<li class="ad-op-i" data-id="${o.id}"><div><b>${esc(nombre(o.slug))}</b> · ${"★".repeat(o.puntaje)}${"☆".repeat(5 - o.puntaje)} · ${esc(o.nombre || "sin nombre")} · ${new Date(o.ts).toLocaleDateString("es-AR")}</div>
    <p>${o.texto ? esc(o.texto) : "<em>Sin texto</em>"}</p><small>${[o.uso, o.km && o.km + " km", o.talle && "talle " + o.talle, o.peso && o.peso + " kg"].filter(Boolean).map(esc).join(" · ")}</small>
    <div class="ad-op-b"><button class="pill" data-op="aprobada" type="button">Aprobar</button><button class="pill" data-op="rechazada" type="button">Rechazar</button></div></li>`;
  return bloque(`Opiniones para revisar${OPS.pend.length ? ` <em>${OPS.pend.length}</em>` : ""}`,
    OPS.pend.length ? `<ul class="ad-op-l">${OPS.pend.map(fila).join("")}</ul>` : `<p class="ad-vacio">No hay opiniones pendientes.</p>`,
    `${n0(OPS.aprob)} publicadas en el sitio. Solo se ven las que aprobás. Rechazá las que tengan publicidad, insultos, datos personales o que no hablen de la zapa.`, "ad-op");
}
function montarOpinionesAdmin() {
  document.querySelectorAll(".ad-op-l").forEach(ul => ul.onclick = async e => {
    const b = e.target.closest("[data-op]"); if (!b) return;
    const li = b.closest("[data-id]"); li.querySelectorAll("button").forEach(x => x.disabled = true);
    const r = await fetch(`${URL_SB}/rest/v1/opiniones?id=eq.${li.dataset.id}`, { method: "PATCH",
      headers: { apikey: KEY, Authorization: "Bearer " + sesion.token, "Content-Type": "application/json", Prefer: "return=minimal" },
      body: JSON.stringify({ estado: b.dataset.op }) }).catch(() => null);
    if (r?.ok) { li.outerHTML = `<li class="ad-op-i ad-op-${b.dataset.op}">${b.dataset.op === "aprobada" ? "✓ Aprobada: ya se ve en la ficha." : "✗ Rechazada."}</li>`; OPS.pend = OPS.pend.filter(o => String(o.id) !== li.dataset.id); if (b.dataset.op === "aprobada") OPS.aprob++; }
    else { li.querySelectorAll("button").forEach(x => x.disabled = false); alert("No se pudo guardar. Probá de nuevo."); }
  });
}
/* ---------- tablero: tiendas, precios y fuentes de las fichas ---------- */
const MANUALES = { "Nike": "Marcador (tu navegador)", "adidas.com.ar": "Marcador (tu navegador)", "Digital Sport": "Marcador (tu navegador)" };
const fechaMs = f => { const [d, m, y] = String(f || "").split("/").map(Number); return y ? Date.UTC(y, m - 1, d) : 0; };
const hace = ms => { const d = Math.floor((Date.now() - ms) / 864e5); return d <= 0 ? "hoy" : d === 1 ? "ayer" : `hace ${d} días`; };
function tablero() {
  const cat = window.__cat, rb = window.__robot, rev = window.__rev;
  if (!cat) return "";
  const hoy = Date.now(), T = {};
  for (const m of cat.modelos) for (const t of m.tiendas || []) {
    const x = T[t.tienda] ??= { modelos: new Set(), precios: 0, aldia: 0, viejos: 0, vencidos: 0, sinStock: 0, ult: 0, prim: Infinity, fallas: 0 };
    const ms = fechaMs(t.fecha), dias = (hoy - ms) / 864e5;
    x.modelos.add(m.slug); x.precios++; x.ult = Math.max(x.ult, ms); x.prim = Math.min(x.prim, ms);
    if (t.sinStock) x.sinStock++; else if (dias <= 2.5) x.aldia++; else if (dias <= 7.99) x.viejos++; else x.vencidos++;
  }
  for (const e of rb?.errores || []) { const k = (e.match(/ · ([^:]+):/) || [])[1]; if (k && T[k]) T[k].fallas++; }
  const filas = Object.entries(T).sort((a, b) => b[1].precios - a[1].precios);
  const tot = filas.reduce((a, [, x]) => ({ p: a.p + x.precios, d: a.d + x.aldia, v: a.v + x.vencidos }), { p: 0, d: 0, v: 0 });
  const estado = x => x.vencidos ? `<em class="tb-mal">${x.vencidos} vencidos</em>` : x.viejos > x.aldia ? `<em class="tb-ojo">desactualizada</em>` : `<em class="tb-ok">al día</em>`;
  const tiendas = `<div class="kpis">${kpi("Tiendas", n0(filas.length))}${kpi("Precios al día", pct(tot.d, tot.p), `${n0(tot.d)} de ${n0(tot.p)}, actualizados en los últimos 2 días`)}${kpi("Vencidos", n0(tot.v), "más de 7 días: no se muestran")}${kpi("Robot", rb ? esc(rb.fecha) : "–", rb ? `${n0(rb.leidos)} leídos · ${n0(rb.fallaron)} fallaron` : "")}</div>
    <div class="tblwrap"><table class="cmpt ad-tb"><thead><tr><th>Tienda</th><th>Cómo se lee</th><th>Estado</th><th>Modelos</th><th>Precios</th><th>Al día</th><th>3 a 7 días</th><th>Sin stock</th><th>Última actualización</th><th>Fallaron hoy</th></tr></thead><tbody>
    ${filas.map(([n, x]) => `<tr><td><b>${esc(n)}</b></td><td>${MANUALES[n] || "Robot diario"}</td><td>${estado(x)}</td><td>${x.modelos.size}</td><td>${x.precios}</td><td>${x.aldia}</td><td>${x.viejos || ""}</td><td>${x.sinStock || ""}</td><td>${x.ult ? `${new Date(x.ult).toLocaleDateString("es-AR", { timeZone: "UTC" })} <small>(${hace(x.ult)})</small>` : "–"}</td><td>${x.fallas ? `<em class="tb-mal">${x.fallas}</em>` : ""}</td></tr>`).join("")}
    </tbody></table></div>`;
  let fuentes = "";
  if (rev?.modelos) {
    const F = {}, M = Object.entries(rev.modelos);
    for (const [, m] of M) for (const f of m.fuentes) { const x = F[f.n] ??= { ficha: 0, revision: 0, horma: 0, review: f.review }; x[f.uso === "ficha" ? "ficha" : f.uso === "horma" ? "horma" : "revision"]++; }
    const pocas = M.filter(([, m]) => m.fuentes.filter(f => f.review).length < 2);
    const link = f => `<a href="${esc(f.url)}" target="_blank" rel="noopener">${esc(f.n)}</a>${f.review ? "" : " <em class=\"tb-ojo\">no es review</em>"}`;
    fuentes = `<div class="tblwrap"><table class="cmpt ad-tb"><thead><tr><th>Fuente</th><th>Tipo</th><th>En la ficha</th><th>Para revisar la ficha</th><th>Ancho de horma</th></tr></thead><tbody>
      ${Object.entries(F).sort((a, b) => (b[1].ficha + b[1].revision + b[1].horma) - (a[1].ficha + a[1].revision + a[1].horma)).map(([n, x]) => `<tr><td><b>${esc(n)}</b></td><td>${x.review ? "Review" : "<em class=\"tb-ojo\">Tienda o marca</em>"}</td><td>${x.ficha || ""}</td><td>${x.revision || ""}</td><td>${x.horma || ""}</td></tr>`).join("")}
      </tbody></table></div>
      <h3>Con menos de dos reviews (${pocas.length})</h3>${pocas.length ? `<ul class="tb-l">${pocas.map(([s, m]) => `<li><b>${esc(m.nombre)}</b>: ${m.fuentes.map(link).join(" · ") || "<em class=\"tb-mal\">ninguna</em>"}</li>`).join("")}</ul>` : `<p class="ad-vacio">Todas tienen al menos dos.</p>`}
      <details class="tb-det"><summary>Ver las fuentes de cada modelo (${M.length})</summary><div class="tblwrap"><table class="cmpt ad-tb"><thead><tr><th>Modelo</th><th>En la ficha</th><th>Para revisar</th><th>Horma</th></tr></thead><tbody>
      ${M.sort((a, b) => a[1].nombre.localeCompare(b[1].nombre)).map(([, m]) => `<tr><td>${esc(m.nombre)}</td><td>${m.fuentes.filter(f => f.uso === "ficha").map(link).join(" · ")}</td><td>${m.fuentes.filter(f => f.uso === "revisión").map(link).join(" · ")}</td><td>${m.horma ? esc(m.horma) + " " + m.fuentes.filter(f => f.uso === "horma").map(link).join("") : ""}</td></tr>`).join("")}
      </tbody></table></div></details>`;
  }
  return bloque("Tiendas y precios", tiendas, `Cada precio se muestra solo si se chequeó hoy o ayer. "Al día" es de los últimos 2 días; el robot pasa dos veces por día y Nike, adidas y Digital Sport se cargan con el marcador (<a href="./herramientas.html">Herramientas</a>).`)
    + (fuentes ? bloque("Fuentes de las fichas", fuentes, `Con qué reviews se armó y se revisó cada ficha.${rev.fechas?.foro ? ` Foroatletismo revisado el ${esc(rev.fechas.foro.split("-").reverse().join("/"))}.` : ""}`) : "");
}
function eventosCab() {
  $("#rango")?.addEventListener("click", e => { const b = e.target.closest("button"); if (!b) return; rango = +b.dataset.d; cargar(); });
  $("#recargar")?.addEventListener("click", cargar);
  $("#csv")?.addEventListener("click", () => {
    const filas = [["fecha", "visita", "evento", "ruta", "datos"], ...eventos.map(e => [e.ts, e.sesion, e.tipo, e.ruta, JSON.stringify(e.datos)])];
    const csv = filas.map(f => f.map(x => `"${String(x ?? "").replace(/"/g, '""')}"`).join(",")).join("\n");
    const a = document.createElement("a"); a.href = URL.createObjectURL(new Blob(["﻿" + csv], { type: "text/csv" })); a.download = `trotecito-eventos-${rango}d.csv`; a.click();
  });
}

if (!URL_SB || !KEY) sinConfigurar(); else cargar();
