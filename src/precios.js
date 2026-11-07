/* Historial de precios: gráfico escalonado por tienda (un precio vale hasta que cambia). */

const DIA = 864e5;
const VENTANA_DIAS = 183; // seis meses
const MAX_SERIES = 4;
const fmt = n => "$" + Math.round(n).toLocaleString("es-AR");
const corto = n => n >= 1e6 ? "$" + (n / 1e6).toLocaleString("es-AR", { maximumFractionDigits: 1 }) + " M" : "$" + Math.round(n / 1e3) + " mil";
const esc = s => String(s ?? "").replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
const t = iso => Date.parse(iso + "T12:00:00");
const dm = ms => { const d = new Date(ms); return `${String(d.getUTCDate()).padStart(2, "0")}/${String(d.getUTCMonth() + 1).padStart(2, "0")}`; };
const MES = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];

/* Precio vigente de una serie en una fecha (el último observado hasta ese día). */
function vigente(serie, ms) { let v = null; for (const [d, p] of serie) { if (t(d) <= ms) v = p; else break; } return v; }

/* Elige hasta 4 tiendas: entre las que tienen dato reciente, las más baratas hoy (así el historial incluye el precio que
   se muestra arriba de la ficha), y les asigna color en orden alfabético estable. */
function preparar(series) {
  const todas = Object.entries(series || {}).filter(([, s]) => s.length);
  const ultima = ([, s]) => s[s.length - 1], reciente = todas.reduce((m, x) => ultima(x)[0] > m ? ultima(x)[0] : m, "");
  const corte = reciente ? new Date(t(reciente) - 2 * DIA).toISOString().slice(0, 10) : "";
  const elegidas = todas.sort((a, b) => (ultima(b)[0] >= corte) - (ultima(a)[0] >= corte) || ultima(a)[1] - ultima(b)[1]).slice(0, MAX_SERIES)
    .sort((a, b) => a[0].localeCompare(b[0]));
  const fechas = [...new Set(elegidas.flatMap(([, s]) => s.map(x => x[0])))].sort();
  return { elegidas, fechas };
}

/* Variación del precio más bajo entre las dos últimas fechas con datos (para la etiqueta "Bajó"). */
export function variacion(series) {
  const { elegidas, fechas } = preparar(series);
  if (fechas.length < 2) return null;
  const minEn = iso => Math.min(...elegidas.map(([, s]) => vigente(s, t(iso))).filter(v => v != null));
  const ahora = minEn(fechas[fechas.length - 1]), antes = minEn(fechas[fechas.length - 2]);
  return isFinite(ahora) && isFinite(antes) && antes > 0 ? (ahora - antes) / antes : null;
}

function ticksY(lo, hi) {
  const paso = [1e3, 2e3, 5e3, 1e4, 2e4, 25e3, 5e4, 1e5, 2e5, 25e4, 5e5, 1e6].find(p => (hi - lo) / p <= 4) || 1e6;
  const out = []; for (let v = Math.ceil(lo / paso) * paso; v <= hi; v += paso) out.push(v); return out;
}

export function grafico(series) {
  const { elegidas, fechas } = preparar(series);
  if (!fechas.length) return "";
  if (fechas.length < 2) {
    const hoy = Math.min(...elegidas.map(([, s]) => s[s.length - 1][1])), f = t(fechas[0]);
    return `<div class="hist hist-nuevo"><div class="hist-sum"><div><span>Hoy desde</span><b>${fmt(hoy)}</b></div></div>
      <p>Empezamos a seguir este precio el <b>${dm(f)}</b>. Lo revisamos todos los días en ${elegidas.length === 1 ? "la tienda" : `las ${elegidas.length} tiendas`}: desde el <b>${dm(f + DIA)}</b> vas a ver acá cómo sube o baja.</p></div>`;
  }
  const fin = t(fechas[fechas.length - 1]), ini = Math.max(t(fechas[0]), fin - VENTANA_DIAS * DIA);
  const visibles = elegidas.map(([n, s]) => [n, s.filter(([d]) => t(d) >= ini - 400 * DIA)]);
  const valores = visibles.flatMap(([, s]) => s.filter(([d]) => t(d) >= ini).map(x => x[1])).concat(visibles.map(([, s]) => vigente(s, ini)).filter(v => v != null));
  const vmin = Math.min(...valores), vmax = Math.max(...valores);
  const lo = Math.max(0, vmin - (vmax - vmin || vmax) * 0.15), hi = vmax + (vmax - vmin || vmax) * 0.1;
  const W = 640, H = 230, M = { l: 62, r: 104, t: 14, b: 28 }, iw = W - M.l - M.r, ih = H - M.t - M.b;
  const X = ms => M.l + (fin === ini ? iw : (ms - ini) / (fin - ini) * iw), Y = v => M.t + ih - (v - lo) / (hi - lo) * ih;
  const ty = ticksY(lo, hi);
  const nx = Math.min(5, fechas.length), tx = [];
  if (fin - ini > 60 * DIA) { const d = new Date(ini); d.setUTCDate(1); d.setUTCMonth(d.getUTCMonth() + 1); for (; d.getTime() <= fin; d.setUTCMonth(d.getUTCMonth() + 1)) tx.push([d.getTime(), MES[d.getUTCMonth()]]); }
  else for (let i = 0; i < nx; i++) { const ms = ini + (fin - ini) * i / (nx - 1); tx.push([ms, dm(ms)]); }

  const lineas = visibles.map(([n, s], i) => {
    let d = "", prev = null, pts = "";
    const desde = vigente(s, ini);
    if (desde != null) { d = `M${X(ini).toFixed(1)},${Y(desde).toFixed(1)}`; prev = desde; }
    for (const [f, p] of s) { const ms = t(f); if (ms < ini) continue;
      d += d ? ` H${X(ms).toFixed(1)} V${Y(p).toFixed(1)}` : `M${X(ms).toFixed(1)},${Y(p).toFixed(1)}`; prev = p;
      if (s.length <= 40) pts += `<circle cx="${X(ms).toFixed(1)}" cy="${Y(p).toFixed(1)}" r="4" fill="var(--s${i + 1})" stroke="var(--surface)" stroke-width="2"/>`; }
    const ultFecha = s.length ? t(s[s.length - 1][0]) : ini;
    if (prev != null && fin - ultFecha <= 2 * DIA) d += ` H${X(fin).toFixed(1)}`;
    return { n, i, d, pts, ult: prev };
  });
  /* etiquetas directas a la derecha, separadas para que no se pisen */
  const lab = lineas.filter(l => l.ult != null).map(l => ({ ...l, y: Y(l.ult) })).sort((a, b) => a.y - b.y);
  for (let k = 1; k < lab.length; k++) if (lab[k].y - lab[k - 1].y < 15) lab[k].y = lab[k - 1].y + 15;

  let minimo = null;
  for (const [n, s] of visibles) for (const [f, p] of s) if (t(f) >= ini && (!minimo || p < minimo.p)) minimo = { n, p, f };
  const hoy = Math.min(...lineas.map(l => l.ult).filter(v => v != null));
  const tabla = fechas.filter(f => t(f) >= ini).slice(-60);

  return `<div class="hist" data-ini="${ini}" data-fin="${fin}">
    <div class="hist-sum"><div><span>Hoy desde</span><b>${fmt(hoy)}</b></div>${minimo ? `<div><span>Más bajo registrado</span><b>${fmt(minimo.p)}</b><small>${esc(minimo.n)} · ${dm(t(minimo.f))}</small></div>` : ""}</div>
    ${lineas.length > 1 ? `<div class="hist-leg">${lineas.map(l => `<span><i style="background:var(--s${l.i + 1})"></i>${esc(l.n)}</span>`).join("")}</div>` : ""}
    <div class="hist-plot">
      <svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Precio por tienda entre el ${dm(ini)} y el ${dm(fin)}">
        ${ty.map(v => `<line x1="${M.l}" x2="${W - M.r}" y1="${Y(v).toFixed(1)}" y2="${Y(v).toFixed(1)}" class="hg"/><text x="${M.l - 8}" y="${(Y(v) + 4).toFixed(1)}" text-anchor="end" class="ht">${corto(v)}</text>`).join("")}
        ${tx.map(([ms, l], k) => `<text x="${X(ms).toFixed(1)}" y="${H - 8}" text-anchor="${k === 0 && ms === ini ? "start" : ms === fin ? "end" : "middle"}" class="ht">${l}</text>`).join("")}
        ${lineas.map(l => `<path d="${l.d}" fill="none" stroke="var(--s${l.i + 1})" stroke-width="2" stroke-linejoin="round"/>${l.pts}`).join("")}
        ${lab.map(l => `<text x="${W - M.r + 8}" y="${(l.y + 4).toFixed(1)}" class="hl">${esc(l.n)}</text>`).join("")}
        <line class="hx" x1="0" x2="0" y1="${M.t}" y2="${M.t + ih}" visibility="hidden"/>
        <rect class="hit" x="${M.l}" y="${M.t}" width="${iw}" height="${ih}" fill="transparent"/>
      </svg>
      <div class="hist-tip" hidden></div>
    </div>
    <details class="hist-tabla"><summary>Ver como tabla</summary><div class="tblwrap"><table class="cmpt"><thead><tr><th>Fecha</th>${lineas.map(l => `<th>${esc(l.n)}</th>`).join("")}</tr></thead>
      <tbody>${tabla.slice().reverse().map(f => `<tr><th>${dm(t(f))}</th>${visibles.map(([, s]) => { const p = s.find(x => x[0] === f); return `<td>${p ? fmt(p[1]) : "–"}</td>`; }).join("")}</tr>`).join("")}</tbody></table></div></details>
  </div>`;
}

/* Puntero: línea vertical y tooltip con el precio vigente de cada tienda ese día. */
export function montarGrafico(root, series) {
  const box = root?.querySelector(".hist"); if (!box) return;
  const { elegidas, fechas } = preparar(series);
  const svg = box.querySelector("svg"); if (!svg) return;
  const hit = svg.querySelector(".hit"), hx = svg.querySelector(".hx"), tip = box.querySelector(".hist-tip");
  const ini = +box.dataset.ini, fin = +box.dataset.fin;
  const puntos = [...new Set([ini, ...fechas.map(t).filter(ms => ms >= ini), fin])].sort((a, b) => a - b);
  const x0 = +hit.getAttribute("x"), w = +hit.getAttribute("width");
  const mover = e => {
    const r = svg.getBoundingClientRect(), vx = (e.clientX - r.left) / r.width * svg.viewBox.baseVal.width;
    const ms = ini + Math.max(0, Math.min(1, (vx - x0) / w)) * (fin - ini);
    const cerca = puntos.reduce((a, b) => Math.abs(b - ms) < Math.abs(a - ms) ? b : a);
    const px = x0 + (fin === ini ? w : (cerca - ini) / (fin - ini) * w);
    hx.setAttribute("x1", px); hx.setAttribute("x2", px); hx.setAttribute("visibility", "visible");
    tip.innerHTML = `<b>${dm(cerca)}</b>` + elegidas.map(([n, s], i) => { const v = vigente(s, cerca); return v == null ? "" : `<span><i style="background:var(--s${i + 1})"></i>${esc(n)}<em>${fmt(v)}</em></span>`; }).join("");
    tip.hidden = false;
    const left = px / svg.viewBox.baseVal.width * r.width;
    tip.style.left = Math.min(Math.max(left, 70), r.width - 70) + "px";
  };
  const salir = () => { hx.setAttribute("visibility", "hidden"); tip.hidden = true; };
  hit.addEventListener("pointermove", mover); hit.addEventListener("pointerdown", mover); hit.addEventListener("pointerleave", salir);
}
