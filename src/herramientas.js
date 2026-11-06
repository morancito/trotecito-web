/* Herramientas: el marcador para cargar los precios de Nike y adidas (que bloquean al robot) y cuánto hace que se cargaron. */
import "@fontsource-variable/archivo/wdth.css";
import "@fontsource/kanit/900-italic.css";
import "@fontsource/jetbrains-mono/500.css";
import "./styles.css";
import "./admin.css";
import codigo from "./marcador.js?raw";
import { SUPABASE_URL as URL_SB, SUPABASE_KEY as KEY } from "./medir.js";

const app = document.querySelector("#app");
const esc = s => String(s ?? "").replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
const SUBIR = "https://github.com/morancito/trotecito-web/upload/main/datos-manuales";
const ACCIONES = "https://github.com/morancito/trotecito-web/actions/workflows/importar-manual.yml";
const VERSION = "4 · Digital Sport completo";
const href = "javascript:" + encodeURIComponent(codigo.replace(/^\/\*[\s\S]*?\*\/\s*/, ""));
const aMs = f => { const [d, m, y] = String(f || "").split("/").map(Number); return y ? Date.UTC(y, m - 1, d) : 0; };

async function estado() {
  try {
    const cat = await (await fetch("./data/modelos.json", { cache: "no-store" })).json();
    const hoy = Date.now();
    return [["Nike", "Nike"], ["adidas", "adidas.com.ar"], ["Digital Sport", "Digital Sport"]].map(([nombre, tienda]) => {
      const ts = cat.modelos.flatMap(m => (m.tiendas || []).filter(t => t.tienda === tienda));
      const ult = Math.max(0, ...ts.map(t => aMs(t.fecha)));
      const dias = ult ? Math.floor((hoy - ult) / 864e5) : null;
      return { nombre, n: ts.length, fecha: ult ? new Date(ult).toLocaleDateString("es-AR", { timeZone: "UTC" }) : "nunca", dias };
    });
  } catch { return []; }
}

function pintar(est) {
  app.innerHTML = `<div class="ad-head"><div><h1 class="cond">Precios de <em>Nike, adidas y Digital Sport</em></h1>
    <p class="ad-sub">Esas tiendas bloquean al robot, así que sus precios se cargan desde tu navegador una vez por semana. Los precios se dejan de mostrar a los 7 días.</p></div></div>
  <div class="kpis">${est.map(e => `<div class="kpi${e.dias == null || e.dias >= 6 ? " alerta" : ""}"><span>${esc(e.nombre)}</span><b>${e.dias == null ? "Sin cargar" : e.dias === 0 ? "Hoy" : `Hace ${e.dias} día${e.dias > 1 ? "s" : ""}`}</b><small>${e.n} precios · ${e.dias == null ? "" : e.dias >= 7 ? "ya no se muestran: cargalos de nuevo" : e.dias >= 6 ? "vencen mañana" : `se muestran hasta dentro de ${7 - e.dias} días`}</small></div>`).join("")}</div>
  <section class="ad-box hr-paso"><h2 class="cond">1 · Instalá el marcador <small>(una sola vez, en la compu)</small></h2>
    <p class="hr-aviso">Si ya lo tenías, <b>borralo y arrastralo de nuevo</b> cuando cambie la versión: el marcador guarda el código del día que lo instalaste. Versión actual: <b>${VERSION}</b>.</p>
    <p>Arrastrá este botón a la barra de favoritos de Chrome. Si no la ves, apretá <kbd>Ctrl</kbd>+<kbd>Shift</kbd>+<kbd>B</kbd> (en Mac <kbd>Cmd</kbd>+<kbd>Shift</kbd>+<kbd>B</kbd>).</p>
    <p class="hr-marc"><a class="btn" title="Trotecito v${VERSION.split(" ")[0]}: arrastralo a la barra de favoritos" href="${esc(href)}" onclick="event.preventDefault()">⇣ Trotecito v${VERSION.split(" ")[0]}</a></p>
    <p class="ad-sub">No hace nada en esta página: funciona estando en nike.com.ar, adidas.com.ar o digitalsport.com.ar.</p></section>
  <section class="ad-box hr-paso"><h2 class="cond">2 · Cada semana: bajá los datos</h2>
    <ol><li>Abrí <a href="https://www.nike.com.ar/" target="_blank" rel="noopener">www.nike.com.ar</a> y tocá el marcador <b>⇣ Trotecito</b>. Aparece un cartel arriba a la derecha; en un minuto baja el archivo <code>nike-AAAA-MM-DD.json</code>.</li>
    <li>Lo mismo en <a href="https://www.adidas.com.ar/" target="_blank" rel="noopener">www.adidas.com.ar</a> (baja <code>adidas-AAAA-MM-DD.json</code>).</li>
    <li>Y en <a href="https://www.digitalsport.com.ar/" target="_blank" rel="noopener">www.digitalsport.com.ar</a> (baja <code>digital-sport-AAAA-MM-DD.json</code>). Busca uno por uno los modelos del catálogo, así que tarda unos minutos: dejá la pestaña abierta.</li></ol></section>
  <section class="ad-box hr-paso"><h2 class="cond">3 · Subilos</h2>
    <p>Tocá <b>Subir a Trotecito</b> (está en el cartel del marcador y acá abajo), arrastrá los archivos a la página de GitHub y apretá <b>Commit changes</b>. GitHub los importa solo y en 2 o 3 minutos los precios están en el sitio.</p>
    <p><a class="btn" href="${SUBIR}" target="_blank" rel="noopener">Subir a Trotecito ↗</a> <a class="pill" href="${ACCIONES}" target="_blank" rel="noopener">Ver si se importó ↗</a></p></section>
  <section class="ad-box"><h2 class="cond">Si algo falla</h2>
    <ul><li><b>El cartel dice "No pude leer productos"</b>: la tienda cambió su página. Avisale a Claude.</li>
    <li><b>En "Ver si se importó" hay una cruz roja</b>: el archivo no se pudo cargar (los precios del sitio no se tocan). Avisale a Claude.</li>
    <li>Los datos son los mismos que ves en la tienda: el marcador solo lee precios, talles y links, no toca tu cuenta.</li></ul></section>`;
}
/* solo con la sesión del panel: si no hay, a entrar (y vuelve acá) */
async function acceso() {
  let s = null; try { s = JSON.parse(sessionStorage.getItem("tt-admin")); } catch {}
  const afuera = () => location.replace("./admin.html?volver=herramientas");
  if (!s?.token || Date.now() > s.hasta) return afuera();
  const r = await fetch(URL_SB + "/auth/v1/user", { headers: { apikey: KEY, Authorization: "Bearer " + s.token } }).catch(() => null);
  if (!r?.ok) { try { sessionStorage.removeItem("tt-admin"); } catch {} return afuera(); }
  pintar([]);
  estado().then(pintar);
}
app.innerHTML = `<p class="ad-vacio">Verificando acceso…</p>`;
acceso();
