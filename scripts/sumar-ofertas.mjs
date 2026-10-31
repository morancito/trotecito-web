// Suma al catálogo las ofertas de scripts/ofertas-encontradas.json (las que arma buscar-ofertas.mjs).
// Solo agrega ofertas con stock que todavía no están (misma tienda y mismo talle de hombre/mujer); no toca las que ya hay.
//   node scripts/sumar-ofertas.mjs            -> muestra qué agregaría
//   node scripts/sumar-ofertas.mjs --guardar  -> lo agrega a modelos.json y al historial
import { readFileSync, writeFileSync } from "node:fs";

const RAIZ = new URL("../public/data/", import.meta.url);
const cat = JSON.parse(readFileSync(new URL("modelos.json", RAIZ), "utf8"));
const hist = JSON.parse(readFileSync(new URL("historial.json", RAIZ), "utf8"));
const enc = JSON.parse(readFileSync(new URL("./ofertas-encontradas.json", import.meta.url), "utf8"));
const guardar = process.argv.includes("--guardar");
/* ofertas revisadas a mano que no corresponden al modelo (el nombre de la tienda no coincide con el producto) */
const DESCARTAR = [/velociti-elite/];
const hoyISO = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Argentina/Buenos_Aires" }).format(new Date());
const hoyAR = hoyISO.split("-").reverse().join("/");

const porSlug = Object.fromEntries(cat.modelos.map(m => [m.slug, m]));
/* sin género en el nombre: si la misma tienda tiene la versión de mujer aparte, esta es la de hombre */
for (const r of enc.resultados) if (!r.nota && enc.resultados.some(x => x.slug === r.slug && x.tienda === r.tienda && x.nota === "Mujer")) r.nota = "Hombre";

let n = 0;
for (const r of enc.resultados) {
  const m = porSlug[r.slug];
  if (!m || r.sinStock || !r.precio || DESCARTAR.some(x => x.test(r.url))) continue;
  const ya = m.tiendas.some(t => t.tienda === r.tienda && (t.nota || "") === (r.nota || "")) || m.tiendas.some(t => t.url === r.url);
  if (ya) continue;
  const t = { tienda: r.tienda, precio: r.precio, cuotas: r.cuotas ? `${r.cuotas} cuotas sin interés` : "Consultar en la tienda", url: r.url, fecha: hoyAR };
  if (r.antes) t.antes = r.antes;
  if (r.nota) t.nota = r.nota;
  if (r.talles?.length) { t.talles = r.talles; t.sistema = r.sistema; }
  console.log(`+ ${r.slug} · ${r.tienda}${r.nota ? " " + r.nota : ""} · $${r.precio}${r.talles?.length ? ` · talles ${r.sistema} ${r.talles.join(",")}` : ""}`);
  n++;
  if (!guardar) continue;
  m.tiendas.push(t);
  const clave = t.tienda + (t.nota === "Mujer" ? " · Mujer" : "");
  const s = ((hist.series[m.slug] ??= {})[clave] ??= []);
  if (!s.length || s[s.length - 1][0] !== hoyISO) s.push([hoyISO, t.precio]);
}
if (guardar) {
  writeFileSync(new URL("modelos.json", RAIZ), JSON.stringify(cat, null, 1) + "\n");
  writeFileSync(new URL("historial.json", RAIZ), JSON.stringify(hist) + "\n");
}
console.log(`\n${n} ofertas ${guardar ? "agregadas" : "para agregar (corré con --guardar)"}.`);
