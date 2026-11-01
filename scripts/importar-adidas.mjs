// Carga los precios de adidas.com.ar a partir de lo que se bajó desde el navegador, para cuando el robot no puede
// consultar la tienda desde GitHub. Acepta dos formatos:
//   - el archivo que baja scripts/adidas-consola.js ({ items, disp }: búsqueda de la tienda + talles con stock)
//   - un resumen con { productos: [{ nombre, url, precio, precio_lista, genero, disponible }] } (sin talles)
//
//   node scripts/importar-adidas.mjs adidas-AAAA-MM-DD.json
//
// Para cada modelo adidas del catálogo deja la opción más barata con stock de hombre y la de mujer, con fecha de hoy,
// y suma el punto del día al historial de precios.
import { readFileSync, writeFileSync } from "node:fs";
import { coincide } from "./buscar-lib.mjs";
import { talleAR } from "./tiendas.mjs";

const TIENDA = "adidas.com.ar", BASE = "https://www.adidas.com.ar";
const RAIZ = new URL("../public/data/", import.meta.url);
const cat = JSON.parse(readFileSync(new URL("modelos.json", RAIZ), "utf8"));
const hist = JSON.parse(readFileSync(new URL("historial.json", RAIZ), "utf8"));
const hoyISO = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Argentina/Buenos_Aires" }).format(new Date());
const hoyAR = hoyISO.split("-").reverse().join("/");

const genero = s => { const t = ` ${String(s || "").toLowerCase()} `; return /\b(mujer|women|w)\b|^ ?w ?$/.test(t) ? "Mujer" : /\b(hombre|men|m)\b/.test(t) ? "Hombre" : /ni[ñn]o|kids|beb[eé]|junior/.test(t) ? "Niño" : "Unisex"; };
const abs = u => !u ? "" : /^https?:/.test(u) ? u : BASE + (u.startsWith("/") ? u : "/" + u);

function ofertas(j) {
  /* formato del script de consola */
  if (Array.isArray(j.items)) return j.items.map(it => {
    const d = j.disp?.[it.productId], vars = d?.variation_list || [];
    const conStock = vars.filter(v => /IN_STOCK|LOW/i.test(v.availability_status || "") || v.availability > 0);
    const talles = [...new Set(conStock.flatMap(v => talleAR(String(v.size || ""))))].sort((a, b) => a - b);
    const precio = Math.round(it.salePrice || it.price), lista = Math.round(it.price || 0);
    const disponible = d ? (/IN_STOCK|LOW/i.test(d.availability_status || "") || conStock.length > 0) : true;
    const g = it.gender ? ({ M: "Hombre", W: "Mujer", U: "Unisex", K: "Niño" }[String(it.gender).toUpperCase()] || genero(it.gender)) : genero(it.displayName);
    return { nombre: it.displayName || it.name || "", url: abs(it.link), precio, antes: lista > precio * 1.01 ? lista : null, nota: g, talles, disponible };
  });
  /* resumen sin talles */
  if (Array.isArray(j.productos)) return j.productos.map(p => ({ nombre: p.nombre, url: abs(p.url), precio: Math.round(p.precio), antes: p.precio_lista > p.precio * 1.01 ? Math.round(p.precio_lista) : null,
    nota: p.genero ? genero(p.genero) : genero(p.nombre), talles: [], disponible: p.disponible !== false }));
  throw new Error("No reconozco el formato del archivo");
}

const archivos = process.argv.slice(2);
if (!archivos.length) { console.error("Uso: node scripts/importar-adidas.mjs <archivo.json> [...]"); process.exit(1); }
const todas = archivos.flatMap(f => ofertas(JSON.parse(readFileSync(f, "utf8")))).filter(o => o.disponible && o.precio > 0 && o.url && o.nota !== "Niño");
console.log(`${todas.length} productos con stock en ${archivos.length} archivo(s).`);

let n = 0;
for (const m of cat.modelos.filter(m => m.m === "Adidas")) {
  const ofs = todas.filter(o => coincide(m, o.nombre, o.url));
  if (!ofs.length) { console.log(`– ${m.slug}: no está en lo que pasaste`); continue; }
  const elegidas = ["Hombre", "Mujer"].map(g => ofs.filter(o => o.nota === g || o.nota === "Unisex").sort((a, b) => a.precio - b.precio)[0]).filter(Boolean);
  const unicas = [...new Map(elegidas.map(o => [o.url, o])).values()];
  m.tiendas = (m.tiendas || []).filter(t => t.tienda !== TIENDA);
  for (const o of unicas) {
    const t = { tienda: TIENDA, precio: o.precio, ...(o.antes ? { antes: o.antes } : {}), cuotas: "Consultar en la tienda",
      ...(o.nota !== "Unisex" ? { nota: o.nota } : {}), url: o.url, fecha: hoyAR, ...(o.talles.length ? { talles: o.talles, sistema: "AR" } : {}) };
    m.tiendas.push(t);
    const clave = TIENDA + (t.nota === "Mujer" ? " · Mujer" : "");
    const serie = ((hist.series[m.slug] ??= {})[clave] ??= []);
    const ult = serie[serie.length - 1];
    if (ult && ult[0] === hoyISO) ult[1] = o.precio; else serie.push([hoyISO, o.precio]);
    n++;
    console.log(`✓ ${m.slug} · ${o.nota}: $${o.precio.toLocaleString("es-AR")}${o.antes ? ` (antes $${o.antes.toLocaleString("es-AR")})` : ""}${o.talles.length ? ` · ${o.talles.length} talles` : ""}`);
  }
  m.tiendas.sort((a, b) => a.precio - b.precio);
}
writeFileSync(new URL("modelos.json", RAIZ), JSON.stringify(cat, null, 1) + "\n");
writeFileSync(new URL("historial.json", RAIZ), JSON.stringify(hist) + "\n");
console.log(`\n${n} precios de ${TIENDA} cargados con fecha ${hoyAR}.`);
