// Puntajes de laboratorio de RunRepeat para cada modelo: el general ("Our verdict") y el de cada uso
// (día a día, ritmo, competencia, estabilidad...). Son números medidos por ellos; en la ficha se muestran citando
// la fuente, con link. No copia textos de la reseña. Usa las URLs de RunRepeat ya encontradas en segunda-fuente.json
// (o la reseña citada en la ficha). Deja todo en public/data/puntajes.json.
//   node scripts/puntajes.mjs [slug ...]
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { traer, dormir } from "./tiendas.mjs";

const RAIZ = new URL("../public/data/", import.meta.url);
const cat = JSON.parse(readFileSync(new URL("modelos.json", RAIZ), "utf8"));
const SF = JSON.parse(readFileSync(new URL("./segunda-fuente.json", import.meta.url), "utf8"));
const ARCH = new URL("puntajes.json", RAIZ);
const prev = existsSync(ARCH) ? JSON.parse(readFileSync(ARCH, "utf8")) : {};
const pedidos = process.argv.slice(2);
const hoy = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Argentina/Buenos_Aires" }).format(new Date());

const ETIQUETA = { Superb: "Excelente", Great: "Muy buena", Good: "Buena", Decent: "Correcta", Bad: "Floja" };
const USO = { "Daily running": "Día a día", "Tempo": "Ritmo", "Race": "Competencia", "Stability": "Estabilidad", "Long distance": "Fondos largos",
  "Long run": "Fondos largos", "Recovery": "Recuperación", "Trail": "Trail", "Technical trail": "Trail técnico", "Light trail": "Trail liviano",
  "Ultra": "Ultra", "Walking": "Caminar", "Speed": "Velocidad", "Treadmill": "Cinta", "Comfort": "Comodidad", "Durability": "Durabilidad" };
const dec = s => s.replace(/&amp;/g, "&").replace(/&#39;|&rsquo;/g, "'").replace(/<[^>]+>/g, "").trim();

export function leerPuntaje(h) {
  const i = h.indexOf("our-score__value"); if (i < 0) return null;
  const caja = h.slice(i - 400, i + 4000);
  const n = +(caja.match(/our-score__value[^>]*>\s*(\d{1,3})\s*</) || [])[1];
  if (!n || n > 100) return null;
  const et = dec((caja.match(/our-score__label[^>]*>([^<]{2,30})</) || [])[1] || "");
  const usos = [...caja.matchAll(/our-score__sub-name[^>]*>([^<]{2,40})<\/span>\s*<span[^>]*our-score__sub-value[^>]*>\s*(\d{1,3})\s*</g)]
    .map(([, k, v]) => [USO[dec(k)] || dec(k), +v]).filter(([, v]) => v > 0 && v <= 100);
  return { n, et: ETIQUETA[et] || et, usos };
}

const out = { ...prev };
let ok = 0, sin = 0;
for (const m of cat.modelos.filter(m => !m.borrador && (!pedidos.length || pedidos.includes(m.slug)))) {
  const citada = [m.fuente, m.fuente2].find(f => /runrepeat\.com/.test(f?.[1] || ""))?.[1];
  const url = SF[m.slug]?.runrepeat?.url || citada;
  if (!url) { console.log(`– ${m.slug}: sin página de RunRepeat`); sin++; continue; }
  let p = null;
  try { p = leerPuntaje(await traer(url)); } catch (e) { console.log(`✗ ${m.slug}: ${e.message}`); }
  if (p) { out[m.slug] = { ...p, fuente: "RunRepeat", url, fecha: hoy }; ok++; console.log(`✓ ${m.slug}: ${p.n} (${p.et}) · ${p.usos.map(u => u.join(" ")).join(" · ")}`); }
  else { console.log(`– ${m.slug}: la página no trae puntaje (${url})`); sin++; }
  await dormir(1500);
}
writeFileSync(ARCH, JSON.stringify(out, null, 1) + "\n");
console.log(`\n${ok} con puntaje, ${sin} sin puntaje. Guardado en public/data/puntajes.json`);
