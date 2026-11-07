/* Ficha: puntaje de laboratorio (RunRepeat, citado con link) y opiniones de corredores.
   Las opiniones se guardan en Supabase (tabla "opiniones", ver docs/opiniones.md): el sitio solo puede mandarlas como
   pendientes y leer las aprobadas; aprobarlas o rechazarlas se hace desde el panel admin. */
import { SUPABASE_URL as URL_SB, SUPABASE_KEY as KEY, medir } from "./medir.js";

const esc = s => String(s ?? "").replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
const lee = k => { try { return localStorage.getItem(k); } catch { return null; } };
const pone = (k, v) => { try { localStorage.setItem(k, v); } catch {} };
const H = { apikey: KEY, Authorization: "Bearer " + KEY };

export const KM = ["menos de 100", "100 a 300", "300 a 600", "más de 600"];
export const USOS = ["Empezar a correr", "Día a día", "Fondos", "Series y ritmos", "Competir", "Trail"];
export const TALLE = { justo: "Justo", grande: "Viene grande", chico: "Viene chico" };
export const PESO = ["menos de 60", "60 a 75", "75 a 90", "más de 90"];

/* ---------- puntaje de laboratorio ---------- */
const colorDe = n => n >= 85 ? "alto" : n >= 70 ? "medio" : "bajo";
export function bloqueLab(p) {
  if (!p?.n) return "";
  return `<div class="bloque"><h2 class="cond">Lo que mide el laboratorio</h2>
    <div class="lab"><div class="lab-total lab-${colorDe(p.n)}"><b>${p.n}</b><span>de 100</span><em>${esc(p.et)}</em></div>
    ${p.usos?.length ? `<ul class="lab-usos">${p.usos.map(([k, v]) => `<li><span>${esc(k)}</span><i><s class="lab-${colorDe(v)}" style="width:${v}%"></s></i><b>${v}</b></li>`).join("")}</ul>` : ""}</div>
    <p class="lab-nota">Puntajes de <a href="${esc(p.url)}" target="_blank" rel="noopener">RunRepeat ↗</a>, que corta y mide cada zapa en su laboratorio y la prueba corriendo. Son su evaluación, no la nuestra.</p></div>`;
}

/* ---------- opiniones ---------- */
function visitante() {
  let v = lee("tt-v");
  if (!v) { v = Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4); pone("tt-v", v); }
  return v;
}
async function traer(slug) {
  const r = await fetch(`${URL_SB}/rest/v1/opiniones?slug=eq.${encodeURIComponent(slug)}&select=ts,puntaje,km,uso,talle,peso,texto,nombre&order=ts.desc&limit=200`, { headers: H });
  if (r.status === 404) return [];   // la tabla todavía no existe
  if (!r.ok) throw new Error("HTTP " + r.status);
  return r.json();
}
const estrellas = n => `<span class="op-est" aria-label="${n} de 5">${"★".repeat(n)}<span>${"★".repeat(5 - n)}</span></span>`;
const fecha = ts => new Date(ts).toLocaleDateString("es-AR", { month: "short", year: "numeric" });

function resumen(ops) {
  const n = ops.length, prom = ops.reduce((a, o) => a + o.puntaje, 0) / n;
  const conT = ops.filter(o => o.talle), t = k => conT.filter(o => o.talle === k).length;
  const talleTxt = conT.length >= 2 ? (() => { const [k, c] = Object.keys(TALLE).map(k => [k, t(k)]).sort((a, b) => b[1] - a[1])[0];
    return `${k === "justo" ? "Talle justo" : TALLE[k]} para ${c} de ${conT.length}`; })() : "";
  const conKm = ops.filter(o => o.km), largos = conKm.filter(o => o.km === "300 a 600" || o.km === "más de 600").length;
  const kmTxt = conKm.length >= 2 && largos ? `${largos} de ${conKm.length} le hicieron más de 300 km` : "";
  return `<div class="op-res"><div class="op-prom"><b>${prom.toFixed(1)}</b>${estrellas(Math.round(prom))}<span>${n} ${n === 1 ? "opinión" : "opiniones"}</span></div>
    ${talleTxt || kmTxt ? `<ul>${talleTxt ? `<li>${esc(talleTxt)}</li>` : ""}${kmTxt ? `<li>${esc(kmTxt)}</li>` : ""}</ul>` : ""}</div>`;
}
const item = o => `<li class="op-item"><div class="op-cab">${estrellas(o.puntaje)}<b>${esc(o.nombre || "Corredor/a")}</b><span>${fecha(o.ts)}</span></div>
  ${o.texto ? `<p>${esc(o.texto)}</p>` : ""}
  <p class="op-datos">${[o.uso, o.km && `${o.km} km`, o.talle && TALLE[o.talle], o.peso && `${o.peso} kg`].filter(Boolean).map(esc).join(" · ")}</p></li>`;

const radios = (name, ops, req) => `<div class="op-pills">${ops.map(([v, t], i) => `<label><input type="radio" name="${name}" value="${esc(v)}"${req && !i ? " required" : ""}><span>${esc(t)}</span></label>`).join("")}</div>`;
function formulario(d) {
  return `<details class="op-form-box"><summary class="btn">¿La usaste? Contá cómo te fue</summary>
    <form class="op-form" novalidate>
      <fieldset><legend>Puntaje *</legend>${radios("puntaje", [5, 4, 3, 2, 1].map(n => [n, "★".repeat(n)]), true)}</fieldset>
      <fieldset><legend>¿Cuántos km le hiciste? *</legend>${radios("km", KM.map(k => [k, k + " km"]), true)}</fieldset>
      <fieldset><legend>¿Para qué la usás? *</legend>${radios("uso", USOS.map(u => [u, u]), true)}</fieldset>
      <fieldset><legend>¿Cómo te quedó el talle?</legend>${radios("talle", Object.entries(TALLE))}</fieldset>
      <div class="op-fila"><label>Tu peso (kg)<select name="peso"><option value="">Prefiero no decir</option>${PESO.map(p => `<option>${p}</option>`).join("")}</select></label>
        <label>Tu nombre o apodo<input name="nombre" maxlength="30" autocomplete="nickname" placeholder="Opcional"></label></div>
      <label class="op-txt">Contanos más<textarea name="texto" maxlength="600" rows="4" placeholder="Qué te gustó, qué no, cómo se siente, cuánto aguantó… (opcional)"></textarea></label>
      <p class="op-aviso">La leemos antes de publicarla. No pongas datos personales ni links.</p>
      <p class="op-err" role="alert" hidden></p>
      <button class="btn fuerte" type="submit">Enviar opinión</button>
    </form></details>`;
}

export function montarOpiniones(box, d) {
  if (!box || !URL_SB || !KEY) return;
  const pinta = (ops, error) => {
    const lista = ops.slice(0, 5), mas = ops.length - lista.length;
    box.innerHTML = `<h2 class="cond">Opiniones de corredores</h2>
      ${error ? `<p class="op-vacio">No pudimos cargar las opiniones ahora.</p>`
        : ops.length ? resumen(ops) + `<ul class="op-lista">${lista.map(item).join("")}</ul>${mas > 0 ? `<button class="pill op-mas" type="button">Ver ${mas} más</button>` : ""}`
        : `<p class="op-vacio">Todavía nadie contó cómo le fue con esta zapa. Si la usaste, sé el primero.</p>`}
      ${lee("tt-op-" + d.slug) ? `<p class="op-ok">Ya nos mandaste tu opinión sobre esta zapa. ¡Gracias!</p>` : formulario(d)}`;
    const btnMas = box.querySelector(".op-mas");
    if (btnMas) btnMas.onclick = () => { box.querySelector(".op-lista").innerHTML = ops.map(item).join(""); btnMas.remove(); };
    const sum = box.querySelector(".op-form-box");
    if (sum) sum.addEventListener("toggle", () => { if (sum.open) medir("opinion_abre", { slug: d.slug }); }, { once: true });
    const f = box.querySelector(".op-form");
    if (f) f.onsubmit = async e => {
      e.preventDefault();
      const fd = new FormData(f), err = f.querySelector(".op-err"), btn = f.querySelector("[type=submit]");
      const falta = ["puntaje", "km", "uso"].find(k => !fd.get(k));
      if (falta) { err.textContent = { puntaje: "Elegí un puntaje.", km: "Contanos cuántos km le hiciste.", uso: "Contanos para qué la usás." }[falta]; err.hidden = false; return; }
      const texto = String(fd.get("texto") || "").trim();
      if (/https?:\/\/|www\.|\.com\b/i.test(texto)) { err.textContent = "Sacá los links del texto, por favor."; err.hidden = false; return; }
      err.hidden = true; btn.disabled = true; btn.textContent = "Enviando…";
      const cuerpo = { slug: d.slug, visitante: visitante(), puntaje: +fd.get("puntaje"), km: fd.get("km"), uso: fd.get("uso"),
        talle: fd.get("talle") || null, peso: fd.get("peso") || null, texto: texto || null, nombre: String(fd.get("nombre") || "").trim() || null };
      const r = await fetch(`${URL_SB}/rest/v1/opiniones`, { method: "POST", headers: { ...H, "Content-Type": "application/json", Prefer: "return=minimal" }, body: JSON.stringify(cuerpo) }).catch(() => null);
      if (r?.ok || r?.status === 409) {
        pone("tt-op-" + d.slug, "1"); medir("opinion", { slug: d.slug, p: cuerpo.puntaje });
        f.closest(".op-form-box").outerHTML = `<p class="op-ok">${r.status === 409 ? "Ya nos habías mandado tu opinión sobre esta zapa." : "¡Gracias! La vamos a leer y en unos días aparece acá."}</p>`;
      } else { btn.disabled = false; btn.textContent = "Enviar opinión"; err.textContent = "No se pudo enviar. Probá de nuevo en un rato."; err.hidden = false; }
    };
  };
  box.innerHTML = `<h2 class="cond">Opiniones de corredores</h2><p class="op-vacio">Cargando…</p>`;
  traer(d.slug).then(ops => pinta(ops)).catch(() => pinta([], true));
}
