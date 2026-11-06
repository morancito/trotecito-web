// Arma public/data/revisiones.json para el tablero del panel: con qué fuentes se armó y revisó la ficha de cada modelo.
//   - ficha: la fuente principal (d.fuente) y la segunda (d.fuente2), que se ven en la ficha
//   - Foroatletismo: la review con la que se revisaron peso, ritmo y "no te conviene" (scripts/foro-atletismo.json)
//   - Correr una Maratón y RunRepeat: segunda fuente y ancho de horma (scripts/segunda-fuente.json)
//   node scripts/revisiones.mjs
import { readFileSync, writeFileSync } from "node:fs";
const lee = f => { try { return JSON.parse(readFileSync(new URL(f, import.meta.url), "utf8")); } catch { return {}; } };
const cat = lee("../public/data/modelos.json"), foro = lee("./foro-atletismo.json"), seg = lee("./segunda-fuente.json");
/* reviews de Foroatletismo que resultaron ser de otro modelo (revisado a mano) */
const FORO_MAL = new Set(["adidas-adistar-5", "under-armour-velociti-3", "asics-gel-trabuco-13", "brooks-hyperion"]);
/* fuentes que son fichas de tiendas o marcas, no reviews */
const NO_REVIEW = /^(adidas|nike|asics|hoka|saucony|puma|brooks|on|salomon|blacks\.co\.uk|i-run|runnea\.co\.uk)$/i;
const fecha = s => (s || "").slice(0, 10) || null;
const out = { fecha: new Date().toISOString(), fechas: { foro: fecha(foro.fecha), segunda: null }, modelos: {} };
for (const m of cat.modelos || []) {
  const f = foro.modelos?.[m.slug], s = seg[m.slug] || {};
  const fuentes = [];
  if (m.fuente) fuentes.push({ n: m.fuente[0].replace(/^Foro Atletismo$/, "Foroatletismo"), url: m.fuente[1], uso: "ficha", review: !NO_REVIEW.test(m.fuente[0]) });
  if (m.fuente2) fuentes.push({ n: m.fuente2[0], url: m.fuente2[1], uso: "ficha", review: true });
  if (f && !f.error && f.url && !FORO_MAL.has(m.slug) && !fuentes.some(x => x.url === f.url)) fuentes.push({ n: "Foroatletismo", url: f.url, uso: "revisión", review: true, fecha: fecha(f.fecha) });
  if (s.correrUnaMaraton?.url && !fuentes.some(x => x.url === s.correrUnaMaraton.url)) fuentes.push({ n: "Correr una Maratón", url: s.correrUnaMaraton.url, uso: "revisión", review: true });
  if (s.runrepeat?.url && !fuentes.some(x => x.url === s.runrepeat.url)) fuentes.push({ n: "RunRepeat", url: s.runrepeat.url, uso: m.horma ? "horma" : "revisión", review: true });
  out.modelos[m.slug] = { nombre: `${m.m} ${m.mod}${m.ver ? " " + m.ver : ""}`, fuentes, horma: m.horma || null };
}
writeFileSync(new URL("../public/data/revisiones.json", import.meta.url), JSON.stringify(out) + "\n");
const n = Object.values(out.modelos), r = n.map(x => x.fuentes.filter(f => f.review).length);
console.log(`${n.length} modelos: ${r.filter(x => x >= 2).length} con 2+ reviews, ${r.filter(x => x === 1).length} con 1, ${r.filter(x => !x).length} sin review.`);
