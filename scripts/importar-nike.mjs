// Carga los precios de Nike a partir de respuestas guardadas de su API (VTEX), para cuando el robot no puede
// consultarla desde GitHub. Cada archivo es la respuesta tal cual de:
//   https://www.nike.com.ar/api/catalog_system/pub/products/search?ft=<búsqueda>&_from=0&_to=49
// (también sirve un archivo con varias respuestas pegadas una atrás de otra).
//
//   node scripts/importar-nike.mjs nike/*.json
//
// Para cada modelo Nike del catálogo busca los productos que son ese modelo (todos los colores), y deja en la ficha
// la opción más barata con stock de hombre y la de mujer, con talles (numeración de EE. UU.), cuotas y fecha de hoy.
// También suma el punto del día al historial de precios.
import { readFileSync, writeFileSync } from "node:fs";
import { coincide } from "./buscar-lib.mjs";

const RAIZ = new URL("../public/data/", import.meta.url);
const cat = JSON.parse(readFileSync(new URL("modelos.json", RAIZ), "utf8"));
const hist = JSON.parse(readFileSync(new URL("historial.json", RAIZ), "utf8"));
const hoyISO = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Argentina/Buenos_Aires" }).format(new Date());
const hoyAR = hoyISO.split("-").reverse().join("/");

/* lee uno o varios arrays JSON pegados en un mismo archivo */
function arrays(txt) {
  const out = []; let d = 0, ini = -1, str = false, esc = false;
  for (let i = 0; i < txt.length; i++) {
    const c = txt[i];
    if (str) { if (esc) esc = false; else if (c === "\\") esc = true; else if (c === '"') str = false; continue; }
    if (c === '"') str = true;
    else if (c === "[") { if (d++ === 0) ini = i; }
    else if (c === "]" && --d === 0) { try { const a = JSON.parse(txt.slice(ini, i + 1)); if (Array.isArray(a)) out.push(...a.filter(p => p?.productId && p.items)); } catch {} }
  }
  return out;
}
const archivos = process.argv.slice(2);
if (!archivos.length) { console.error("Uso: node scripts/importar-nike.mjs <archivo.json> [...]"); process.exit(1); }
const productos = [...new Map(archivos.flatMap(f => arrays(readFileSync(f, "utf8"))).map(p => [p.productId, p])).values()];
console.log(`${productos.length} productos distintos en ${archivos.length} archivo(s).`);

/* las unisex suelen estar también en las categorías de hombre y de mujer: si dice Unisex (o las dos), es unisex */
const generoDe = p => { const c = (p.categories || []).join(" "), h = /\/Hombre\//i.test(c), w = /\/Mujer\//i.test(c); return /\/Unisex\//i.test(c) || (h && w) ? "Unisex" : w ? "Mujer" : h ? "Hombre" : "Unisex"; };
/* talles: "9.5" (EE. UU.) o, en las unisex, "H 7 / M 8.5" (se toma el de hombre) */
const talle = it => { const v = String((it.talle || it.Talle || [String(it.name || "").replace(/^Talle:\s*/i, "").replace(/\s*Color:.*$/i, "")])[0] || ""); const h = v.match(/H\s*(\d{1,2}(?:\.5)?)/i); return h ? h[1] : (v.match(/^\s*(\d{1,2}(?:\.5)?)\s*$/) || [])[1] || null; };
function oferta(p) {
  const its = p.items.filter(i => i.sellers.some(s => s.commertialOffer.AvailableQuantity > 0 && s.commertialOffer.Price > 0));
  if (!its.length) return null;
  const o = its.flatMap(i => i.sellers.map(s => s.commertialOffer)).filter(o => o.AvailableQuantity > 0 && o.Price > 0).sort((a, b) => a.Price - b.Price)[0];
  const cuotas = Math.max(0, ...(o.Installments || []).filter(x => x.InterestRate === 0).map(x => x.NumberOfInstallments));
  const talles = [...new Set(its.map(talle).filter(Boolean))].sort((a, b) => a - b);
  return { precio: Math.round(o.Price), antes: o.ListPrice > o.Price * 1.01 ? Math.round(o.ListPrice) : null, cuotas, talles, url: p.link, color: (p["Color PDP"] || [])[0] || "", nota: generoDe(p) };
}

let n = 0;
for (const m of cat.modelos.filter(m => m.m === "Nike")) {
  const ofs = productos.filter(p => coincide(m, p.productName.replace(/GORE-TEX/i, "GTX"), p.link.replace(/gore-tex/i, "gtx"))).map(oferta).filter(Boolean);
  if (!ofs.length) { console.log(`– ${m.slug}: no está en lo que pasaste (o sin stock)`); continue; }
  /* la más barata de cada género; las unisex valen para los dos */
  const elegidas = ["Hombre", "Mujer"].map(g => ofs.filter(o => o.nota === g || o.nota === "Unisex").sort((a, b) => a.precio - b.precio)[0]).filter(Boolean);
  const unicas = [...new Map(elegidas.map(o => [o.url, o])).values()];
  m.tiendas = (m.tiendas || []).filter(t => t.tienda !== "Nike");
  for (const o of unicas) {
    const t = { tienda: "Nike", precio: o.precio, ...(o.antes ? { antes: o.antes } : {}), cuotas: o.cuotas ? `${o.cuotas} cuotas sin interés` : "Consultar en la tienda",
      ...(o.nota !== "Unisex" ? { nota: o.nota } : {}), url: o.url, fecha: hoyAR, ...(o.talles.length ? { talles: o.talles, sistema: "US" } : {}) };
    m.tiendas.push(t);
    const clave = "Nike" + (t.nota === "Mujer" ? " · Mujer" : "");
    const serie = ((hist.series[m.slug] ??= {})[clave] ??= []);
    const ult = serie[serie.length - 1];
    if (ult && ult[0] === hoyISO) ult[1] = o.precio; else serie.push([hoyISO, o.precio]);
    n++;
    console.log(`✓ ${m.slug} · ${o.nota}: $${o.precio.toLocaleString("es-AR")}${o.antes ? ` (antes $${o.antes.toLocaleString("es-AR")})` : ""} · ${o.talles.length} talles · ${o.color}`);
  }
  m.tiendas.sort((a, b) => a.precio - b.precio);
}
writeFileSync(new URL("modelos.json", RAIZ), JSON.stringify(cat, null, 1) + "\n");
writeFileSync(new URL("historial.json", RAIZ), JSON.stringify(hist) + "\n");
console.log(`\n${n} precios de Nike cargados con fecha ${hoyAR}.`);
