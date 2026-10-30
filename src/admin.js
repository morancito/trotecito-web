/* Panel de administración: lee los eventos de Supabase (solo con tu usuario) y muestra cómo se usa Trotecito. */
import "@fontsource-variable/archivo/wdth.css";
import "@fontsource/kanit/900-italic.css";
import "@fontsource/jetbrains-mono/500.css";
import "./styles.css";
import "./admin.css";
import { SUPABASE_URL as URL_SB, SUPABASE_KEY as KEY } from "./medir.js";
import { PREGUNTAS } from "./recomendador.js";

const $ = s => document.querySelector(s);
const app = $("#app");
const esc = s => String(s ?? "").replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
const n0 = n => Math.round(n).toLocaleString("es-AR");
const pct = (a, b) => b ? Math.round(a / b * 100) + "%" : "–";
const dia = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Argentina/Buenos_Aires" });
const diaDe = ts => dia.format(new Date(ts));
const ddmm = iso => iso.slice(8, 10) + "/" + iso.slice(5, 7);
const lee = (k, st = sessionStorage) => { try { return JSON.parse(st.getItem(k)); } catch { return null; } };
const pone = (k, v, st = sessionStorage) => { try { v == null ? st.removeItem(k) : st.setItem(k, JSON.stringify(v)); } catch {} };

let sesion = lee("tt-admin");
let rango = 30, eventos = [], MOD = {}, cargando = false;

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
    <p class="ad-mini">Es el usuario que creaste en Supabase (Authentication → Users).</p></form>`;
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
  $("#salir").hidden = false; cargando = true; pintar();
  const desde = new Date(Date.now() - rango * 864e5).toISOString();
  try {
    const [ev, cat, robot] = await Promise.all([traerEventos(desde),
      fetch("data/modelos.json", { cache: "no-cache" }).then(r => r.json()).catch(() => null),
      fetch("data/robot.json", { cache: "no-cache" }).then(r => r.ok ? r.json() : null).catch(() => null)]);
    eventos = ev; MOD = Object.fromEntries((cat?.modelos || []).map(m => [m.slug, m]));
    window.__cat = cat; window.__robot = robot;
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
  const recoIni = sesionesCon("reco_inicio"), recoFin = sesionesCon("reco_fin"), recoClic = sesionesCon("tienda_clic", e => e.datos?.origen === "recomendador");
  /* por día */
  const dias = []; for (let i = rango - 1; i >= 0; i--) dias.push(diaDe(Date.now() - i * 864e5));
  const primerDia = new Map(); for (const e of E) if (!primerDia.has(e.sesion)) primerDia.set(e.sesion, diaDe(e.ts));
  const sesDia = Object.fromEntries(dias.map(d => [d, 0])), clicDia = Object.fromEntries(dias.map(d => [d, 0]));
  for (const d of primerDia.values()) if (d in sesDia) sesDia[d]++;
  for (const e of clics) { const d = diaDe(e.ts); if (d in clicDia) clicDia[d]++; }
  /* embudo del recomendador */
  const pasos = PREGUNTAS.map((q, i) => [`${i + 1}. ${q.t.replace(/^¿|\?$/g, "")}`, sesionesCon("reco_paso", e => e.datos?.n === i + 1).size]);
  const embudoReco = [["Entraron al recomendador", recoIni.size], ...pasos, ["Vieron sus 3 zapas", recoFin.size], ["Fueron a una tienda", recoClic.size]];
  const recoFicha = sesionesCon("reco_ficha").size;
  /* embudo general */
  const vieronZapas = new Set(E.filter(e => e.tipo === "vista" && /catalogo|ficha|tu-zapa|comparar/.test(e.datos?.pag || "")).map(e => e.sesion));
  const embudo = [["Visitas", ses.size], ["Miraron zapas", vieronZapas.size], ["Abrieron una ficha", new Set(fichas.map(e => e.sesion)).size], ["Fueron a una tienda", sesClic.size]];
  /* perfiles del recomendador (última respuesta de cada visita) */
  const ultimo = new Map(); for (const e of E) if (e.tipo === "reco_fin") ultimo.set(e.sesion, e.datos);
  const perfiles = PREGUNTAS.map(q => [q.t, cuenta([...ultimo.values()], r => { const o = [...q.ops, ...(q.trail || [])].find(([v]) => String(v) === String(r[q.k])); return o ? o[1] : null; })]);
  const recomendadas = cuenta([...ultimo.values()].flatMap(r => r.picks || []), s => s);
  /* origen */
  const visitas = E.filter(e => e.tipo === "visita");
  const origen = cuenta(visitas, e => e.datos?.utm || e.datos?.ref || "Directo o sin dato");
  const disp = cuenta(visitas, e => e.datos?.disp);
  const nuevos = visitas.filter(e => e.datos?.nuevo).length;
  /* búsquedas: la última de cada visita con el mismo comienzo, para no contar cada letra */
  const busq = E.filter(e => e.tipo === "busqueda");
  const porQ = new Map(); for (const e of busq) { const q = (e.datos?.q || "").trim(); const x = porQ.get(q) || { n: 0, res: e.datos?.n ?? 0 }; x.n++; x.res = e.datos?.n ?? x.res; porQ.set(q, x); }
  const busquedas = [...porQ].sort((a, b) => b[1].n - a[1].n);
  return {
    recoFicha, ses, vis, clics, sesClic, fichas, recoIni, recoFin, recoClic, dias, sesDia, clicDia, embudo, embudoReco, perfiles, recomendadas, origen, disp, nuevos, visitas, busquedas,
    topFichas: cuenta(fichas, e => e.datos?.slug), clicZapa: cuenta(clics, e => e.datos?.slug), clicTienda: cuenta(clics, e => e.datos?.tienda),
    clicOrigen: cuenta(clics, e => ({ ficha: "Ficha", recomendador: "Recomendador", comparar: "Comparador", otro: "Otro" })[e.datos?.origen] || "Otro"),
    filtros: cuenta(E.filter(e => e.tipo === "filtro"), e => `${({ gen: "Talles", uso: "Uso", pis: "Pisada", kg: "Peso", am: "Amortiguación", marca: "Marca", desc: "Con descuento", placa: "Con placa", precio: "Precio" })[e.datos?.k] || e.datos?.k}: ${e.datos?.k === "kg" ? ({ 74: "menos de 75", 89: "75 a 90", 91: "más de 90", 0: "no filtrar" })[e.datos?.v] || e.datos?.v : e.datos?.k === "desc" || e.datos?.k === "placa" ? "sí" : e.datos?.k === "precio" && /^\d+-\d+$/.test(e.datos?.v) ? e.datos.v.split("-").map(x => "$" + Math.round(x / 1000) + " mil").join(" a ") : e.datos?.v || "todos"}`),
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
  return `<div class="hist ad-serie" data-dias='${JSON.stringify(c.dias)}' data-s='${JSON.stringify(S.map(s => [s.n, s.v, s.k]))}'>
    <div class="hist-leg">${S.map(s => `<span><i style="background:var(--${s.k})"></i>${s.n}</span>`).join("")}</div>
    <div class="hist-plot"><svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Visitas y clics a tiendas por día, últimos ${rango} días">
      ${ty.map(v => `<line x1="${M.l}" x2="${W - M.r}" y1="${Y(v)}" y2="${Y(v)}" class="hg"/><text x="${M.l - 8}" y="${Y(v) + 4}" text-anchor="end" class="ht">${n0(v)}</text>`).join("")}
      ${c.dias.map((d, i) => i % cada === 0 || i === c.dias.length - 1 ? `<text x="${X(i)}" y="${H - 6}" text-anchor="middle" class="ht">${ddmm(d)}</text>` : "").join("")}
      ${S.map(s => `<polyline points="${s.v.map((v, i) => `${X(i).toFixed(1)},${Y(v).toFixed(1)}`).join(" ")}" fill="none" stroke="var(--${s.k})" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"/>`).join("")}
      ${lab.map(s => `<text x="${W - M.r + 8}" y="${s.y + 4}" class="hl">${s.n}: ${n0(s.v[s.v.length - 1])}</text>`).join("")}
      <line class="hx" x1="0" x2="0" y1="${M.t}" y2="${M.t + ih}" visibility="hidden"/>
      <rect class="hit" x="${M.l}" y="${M.t}" width="${iw}" height="${ih}" fill="transparent"/></svg><div class="hist-tip" hidden></div></div>
    <details class="hist-tabla"><summary>Ver como tabla</summary><div class="tblwrap"><table class="cmpt"><thead><tr><th>Día</th>${S.map(s => `<th>${s.n}</th>`).join("")}</tr></thead>
      <tbody>${c.dias.slice().reverse().map((d, j) => { const i = c.dias.length - 1 - j; return `<tr><th>${ddmm(d)}</th>${S.map(s => `<td>${n0(s.v[i])}</td>`).join("")}</tr>`; }).join("")}</tbody></table></div></details></div>`;
}
function montarSerie() {
  const box = $(".ad-serie"); if (!box) return;
  const dias = JSON.parse(box.dataset.dias), S = JSON.parse(box.dataset.s), svg = box.querySelector("svg"), hit = svg.querySelector(".hit"), hx = svg.querySelector(".hx"), tip = box.querySelector(".hist-tip");
  const x0 = +hit.getAttribute("x"), w = +hit.getAttribute("width");
  const mover = e => { const r = svg.getBoundingClientRect(), vx = (e.clientX - r.left) / r.width * svg.viewBox.baseVal.width;
    const i = Math.round(Math.max(0, Math.min(1, (vx - x0) / w)) * (dias.length - 1)), px = x0 + (dias.length > 1 ? i / (dias.length - 1) * w : w / 2);
    hx.setAttribute("x1", px); hx.setAttribute("x2", px); hx.setAttribute("visibility", "visible");
    tip.innerHTML = `<b>${ddmm(dias[i])}</b>` + S.map(([n, v, k]) => `<span><i style="background:var(--${k})"></i>${n}<em>${n0(v[i])}</em></span>`).join("");
    tip.hidden = false; tip.style.left = Math.min(Math.max(px / svg.viewBox.baseVal.width * r.width, 70), r.width - 70) + "px"; };
  hit.addEventListener("pointermove", mover); hit.addEventListener("pointerdown", mover);
  hit.addEventListener("pointerleave", () => { hx.setAttribute("visibility", "hidden"); tip.hidden = true; });
}
const bloque = (t, html, sub = "", cls = "") => `<section class="ad-b ${cls}"><h2 class="cond">${t}</h2>${sub ? `<p class="ad-sub">${sub}</p>` : ""}${html}</section>`;

/* ---------- pantalla ---------- */
function pintar() {
  const cab = `<div class="ad-head"><div><h1 class="cond">Cómo se usa <em>Trotecito</em></h1><p class="ad-sub">${sesion?.email ? esc(sesion.email) + " · " : ""}${cargando ? "Cargando…" : `${n0(eventos.length)} eventos en los últimos ${rango} días`}</p></div>
    <div class="ad-ctl"><div class="seg" id="rango">${[7, 30, 90].map(d => `<button data-d="${d}" aria-pressed="${d === rango}">${d} días</button>`).join("")}</div>
    <button class="pill" id="recargar" type="button">Actualizar</button><button class="pill" id="csv" type="button">Bajar CSV</button></div></div>`;
  if (cargando) { app.innerHTML = cab + `<p class="ad-vacio">Leyendo los datos…</p>`; return eventosCab(); }
  const c = calcular(), cat = window.__cat, rb = window.__robot;
  const precios = cat ? cat.modelos.reduce((a, m) => a + (m.tiendas?.length || 0), 0) : 0;
  app.innerHTML = cab + `
  <div class="kpis">
    ${kpi("Visitantes", n0(c.vis.size), `${n0(c.nuevos)} nuevos`)}
    ${kpi("Visitas", n0(c.ses.size), c.vis.size ? `${(c.ses.size / c.vis.size).toFixed(1)} por visitante` : "")}
    ${kpi("Fichas vistas", n0(c.fichas.length), c.ses.size ? `${(c.fichas.length / c.ses.size).toFixed(1)} por visita` : "")}
    ${kpi("Clics a tiendas", n0(c.clics.length), `${pct(c.sesClic.size, c.ses.size)} de las visitas`)}
    ${kpi("Recomendador", pct(c.recoFin.size, c.recoIni.size), `terminaron ${n0(c.recoFin.size)} de ${n0(c.recoIni.size)}`)}
    ${kpi("Del recomendador a la tienda", pct(c.recoClic.size, c.recoFin.size), `${n0(c.recoClic.size)} visitas`)}
  </div>
  ${bloque("Visitas y clics por día", serieDiaria(c), "Una visita es cada vez que alguien abre el sitio. Pasá el mouse para ver cada día.")}
  <div class="ad-2">
    ${bloque("Embudo general", embudo(c.embudo), "De todas las visitas, cuántas llegan a una tienda.")}
    ${bloque("Embudo del recomendador", embudo(c.embudoReco), `Dónde se van los que empiezan las preguntas. Además, ${n0(c.recoFicha)} visitas abrieron la ficha de una zapa recomendada.`)}
  </div>
  <div class="ad-2">
    ${bloque("Zapas más vistas", barras(c.topFichas, { fmtL: s => `<a href="./#m-${MOD[s]?.id}" target="_blank" rel="noopener">${esc(nombre(s))}</a>` }))}
    ${bloque("Clics a tiendas por zapa", barras(c.clicZapa, { fmtL: s => esc(nombre(s)) }), "Lo más cercano a una venta.")}
    ${bloque("Clics por tienda", barras(c.clicTienda) + `<h3>Desde dónde</h3>` + barras(c.clicOrigen))}
    ${bloque("Qué buscan", c.busquedas.length ? `<ol class="barras">${c.busquedas.slice(0, 12).map(([q, x]) => `<li><span class="b-l">${esc(q)}${x.res === 0 ? ` <em class="sin">sin resultados</em>` : ""}</span><span class="b-t"><i style="width:${x.n / c.busquedas[0][1].n * 100}%"></i></span><b>${n0(x.n)}</b></li>`).join("")}</ol>` : `<p class="ad-vacio">Todavía sin datos.</p>`, "Las que dicen \"sin resultados\" son modelos que la gente quiere y no tenemos.")}
    ${bloque("Filtros más usados", barras(c.filtros, { max: 12 }))}
    ${bloque("Atajos del inicio", barras(c.atajos))}
  </div>
  ${bloque("Quiénes usan el recomendador", `<div class="ad-3">${c.perfiles.map(([t, filas]) => `<div><h3>${esc(t)}</h3>${barras(filas, { max: 6 })}</div>`).join("")}</div>`, "Última respuesta de cada visita que terminó las preguntas.")}
  <div class="ad-2">
    ${bloque("Las que más recomienda", barras(c.recomendadas, { fmtL: s => esc(nombre(s)) }), "Si siempre salen las mismas, conviene revisar los criterios.")}
    ${bloque("Más comparadas", barras(c.comparadas, { fmtL: s => esc(nombre(s)) }))}
    ${bloque("De dónde llegan", barras(c.origen) + `<h3>Dispositivo</h3>` + barras(c.disp))}
    ${bloque("Estado del catálogo", `<dl class="ad-dl">
      <div><dt>Modelos</dt><dd>${cat ? n0(cat.modelos.length) : "–"}</dd></div><div><dt>Precios cargados</dt><dd>${n0(precios)}</dd></div>
      <div><dt>Última pasada del robot</dt><dd>${rb ? `${esc(rb.fecha)} ${esc(rb.hora || "")}` : "–"}</dd></div>
      <div><dt>Leyó bien</dt><dd>${rb ? `${n0(rb.leidos)} (${n0(rb.cambiaron)} cambiaron)` : "–"}</dd></div></dl>
      ${rb?.errores?.length ? `<h3>Fallaron (${rb.errores.length})</h3><ul class="ad-err-l">${rb.errores.map(x => `<li>${esc(x)}</li>`).join("")}</ul>` : ""}`)}
  </div>
  ${bloque("Últimos eventos", `<div class="tblwrap"><table class="cmpt ad-ev"><thead><tr><th>Hora</th><th>Evento</th><th>Dónde</th><th>Detalle</th></tr></thead><tbody>
    ${eventos.slice(-40).reverse().map(e => `<tr><td>${new Date(e.ts).toLocaleString("es-AR", { timeZone: "America/Argentina/Buenos_Aires", day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })}</td><td>${esc(e.tipo)}</td><td>${esc(e.ruta)}</td><td><code>${esc(JSON.stringify(Object.fromEntries(Object.entries(e.datos || {}).filter(([k]) => k !== "vis"))))}</code></td></tr>`).join("") || `<tr><td colspan="4">Todavía no hay eventos.</td></tr>`}
    </tbody></table></div>`, "Para chequear que la medición funciona.")}`;
  eventosCab(); montarSerie();
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
