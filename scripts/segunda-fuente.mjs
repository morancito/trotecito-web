// Segunda fuente para las fichas y datos de horma:
// - Correr una Maratón (comparador en español): para quién recomienda cada modelo (peso, pisada, uso, ritmo).
// - RunRepeat (laboratorio): ancho de la horma en la punta y en el medio, para saber si es ancha o angosta.
// No toca el catálogo: deja todo en scripts/segunda-fuente.json.
//   node scripts/segunda-fuente.mjs [slug ...]
import { readFileSync, writeFileSync } from "node:fs";
import { traer, dormir } from "./tiendas.mjs";

const cat = JSON.parse(readFileSync(new URL("../public/data/modelos.json", import.meta.url), "utf8"));
const pedidos = process.argv.slice(2);
const texto = h => h.replace(/<script[\s\S]*?<\/script>|<style[\s\S]*?<\/style>/g, " ").replace(/<\/(p|li|tr|h\d|div|dt|dd)>/g, "\n").replace(/<[^>]+>/g, " ")
  .replace(/&nbsp;/g, " ").replace(/&amp;/g, "&").replace(/&#8217;|&#039;/g, "'").replace(/[ \t]+/g, " ").replace(/\n\s*\n+/g, "\n").trim();
const variantes = m => {
  const s = m.slug, base = [s, s.replace(/^new-balance-fresh-foam-x-(\d+)-v(\d+)$/, "new-balance-fresh-foam-x-$1v$2"), s.replace(/^new-balance-fresh-foam-x-(\d+)-v(\d+)$/, "new-balance-$1-v$2"),
    s.replace(/^asics-gel-/, "asics-"), s.replace(/^nike-/, "nike-air-zoom-"), s.replace(/-2-0$/, "-2"), s.replace(/^under-armour-/, "under-armour-hovr-"), s.replace(/^adidas-/, "adidas-adizero-")];
  return [...new Set(base)];
};
async function primera(urls) {
  for (const u of urls) { try { return { u, h: await traer(u) }; } catch {} await dormir(500); }
  return null;
}

/* Correr una Maratón: los bloques "Peso del corredor", "Pisada", "Uso", "Ritmo"... y frases de recomendación */
const CLAVES = /(peso del corredor|corredores? (ligeros|pesados|de)|kilos|\bkg\b|pisada|pronador|supinador|neutr|ritmo|min\/km|uso|distancia|maraton|maratón|media|10 ?k|entrenamiento|competici|rodaje|tirada|recomend|ideal|principiante|amortiguaci)/i;
function correrUnaMaraton(h) {
  const t = texto(h);
  const datos = {};
  for (const m of t.matchAll(/(Peso del corredor|Peso corredor|Pisada|Tipo de pisada|Uso|Uso recomendado|Distancia|Ritmo|Nivel|Superficie|Terreno)\s*:?\s*\n?\s*([^\n]{2,90})/gi)) datos[m[1]] ??= m[2].trim();
  const frases = [...new Set(t.split(/(?<=[.!?])\s+|\n/).map(x => x.trim()).filter(x => x.length > 25 && x.length < 320 && CLAVES.test(x) && !/cookie|newsletter|suscrib/i.test(x)))].slice(0, 14);
  return { datos, frases, titulo: texto((h.match(/<title>([\s\S]*?)<\/title>/) || [])[1] || "") };
}

/* RunRepeat: medidas de laboratorio del ancho (mm) contra el promedio de las zapas que midieron,
   y la palabra de su tabla comparativa (la primera columna es esta zapa) */
function horma(h) {
  const t = texto(h).replace(/\n/g, " ").replace(/\s+/g, " ");
  const medidas = {};
  for (const m of t.matchAll(/Test results .{0,70}? (\d{2,3}(?:\.\d)?) mm Average (\d{2,3}(?:\.\d)?) mm .{0,90}?Number of shoes [\d.]+ mm ([A-Za-z][A-Za-z \/()-]{2,40}?) [\d.]+ mm/g)) {
    const k = m[3].trim().toLowerCase(); medidas[k] ??= { mm: +m[1], prom: +m[2] };
  }
  const palabra = rx => (t.match(rx) || [])[1] || null;
  return {
    medio: medidas["width / fit"] || null,
    punta: medidas["toebox width - widest part"] || medidas["toebox width"] || null,
    calce: palabra(/Width \/ fit (Narrow|Medium|Wide|Very narrow|Very wide|-) /i),
    calcePunta: palabra(/Toebox width (Narrow|Medium|Wide|Very narrow|Very wide|-) /i),
    medidas,
  };
}

const ARCH = new URL("./segunda-fuente.json", import.meta.url);
let salida = {}; try { salida = JSON.parse(readFileSync(ARCH, "utf8")); } catch {}
for (const m of cat.modelos.filter(m => !pedidos.length || pedidos.includes(m.slug))) {
  const x = { };
  const cm = await primera(variantes(m).map(v => `https://www.correrunamaraton.com/comparar/zapatillas-running/${v}/`));
  if (cm) x.correrUnaMaraton = { url: cm.u, ...correrUnaMaraton(cm.h) };
  const rrSlug = m.fuente?.[0] === "RunRepeat" ? m.fuente[1].split("runrepeat.com/")[1] : null;
  const rr = await primera([...(rrSlug ? [rrSlug] : []), ...variantes(m)].map(v => `https://runrepeat.com/${v}`));
  if (rr) x.runrepeat = { url: rr.u, ...horma(rr.h) };
  salida[m.slug] = x;
  console.log(`${m.slug}: CUM ${cm ? "✓" : "–"} · RR ${rr ? `✓ ${x.runrepeat.calce ?? "?"} ${x.runrepeat.medio?.mm ?? "?"}/${x.runrepeat.medio?.prom ?? "?"} mm` : "–"}`);
  writeFileSync(ARCH, JSON.stringify(salida, null, 1) + "\n");
  await dormir(1200);
}
