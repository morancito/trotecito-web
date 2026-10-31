/* Medición anónima de uso: qué se mira, qué se busca, cómo va el recomendador y cuántos clics llegan a las tiendas.
   Sin cookies ni datos personales: un número al azar por visitante y otro por visita.
   Los eventos se guardan en Supabase (ver docs/medicion.md). Mientras SUPABASE_URL esté vacío, no se mide nada. */

export const SUPABASE_URL = import.meta.env.VITE_SB_URL || "https://qnyqaqklsgzfojnaetal.supabase.co";   // ej. https://abcdefgh.supabase.co
export const SUPABASE_KEY = import.meta.env.VITE_SB_KEY || "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFueXFhcWtsc2d6Zm9qbmFldGFsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTMzODg5MjIsImV4cCI6MjEwODk2NDkyMn0.s1DdIYXgy1SGm1yebj6GtgaTy8O5-KiGrrqTWZhKTD4";   // la "anon public key" del proyecto (es pública por diseño)

const lee = (st, k) => { try { return st.getItem(k); } catch { return null; } };
const pone = (st, k, v) => { try { st.setItem(k, v); } catch {} };
const azar = () => Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4);

const local = !import.meta.env.VITE_SB_TEST && /^(localhost|127\.|\[::1\])/.test(location.hostname) || location.protocol === "file:";
export const activo = () => !!(SUPABASE_URL && SUPABASE_KEY) && !local && (import.meta.env.VITE_SB_TEST || !navigator.webdriver) && lee(localStorage, "trotecito-nomedir") !== "1";

let vis = lee(localStorage, "tt-v"); const nuevo = !vis; if (!vis) { vis = azar(); pone(localStorage, "tt-v", vis); }
let ses = lee(sessionStorage, "tt-s"); if (!ses) { ses = azar(); pone(sessionStorage, "tt-s", ses); }

export function medir(tipo, datos = {}) {
  if (!activo()) return;
  const cuerpo = { sesion: ses, tipo, ruta: (location.pathname.match(/\/zapa\/([^/]+)/) || [])[1] ? "zapa/" + location.pathname.match(/\/zapa\/([^/]+)/)[1] : location.hash.slice(1).split("?")[0] || "inicio", datos: { vis, ...datos } };
  fetch(SUPABASE_URL + "/rest/v1/eventos", {
    method: "POST", keepalive: true,
    headers: { apikey: SUPABASE_KEY, Authorization: "Bearer " + SUPABASE_KEY, "Content-Type": "application/json", Prefer: "return=minimal" },
    body: JSON.stringify(cuerpo),
  }).catch(() => {});
}

/* una vez por visita: de dónde llegó y con qué dispositivo */
export function medirVisita() {
  const q = new URLSearchParams(location.search);
  let ref = ""; try { const h = new URL(document.referrer).hostname; if (h && h !== location.hostname) ref = h.replace(/^www\./, ""); } catch {}
  medir("visita", { ref, utm: q.get("utm_source") || "", disp: matchMedia("(max-width: 700px)").matches ? "Celular" : "Compu", nuevo });
}
