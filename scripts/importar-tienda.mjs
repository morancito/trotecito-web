// Carga los precios de una tienda que bloquea al robot (ej. Digital Sport) a partir del archivo que baja el marcador
// desde el navegador. Tres formatos:
//   { tienda, plataforma: "vtex", productos }  -> respuesta de la API de catálogo VTEX
//   { tienda, plataforma: "html", paginas: [{ url, nombre, html }] } -> páginas de producto, se leen como las lee el robot
//   { tienda, plataforma: "lista", productos: [{ nombre, url, precio, antes, cuotas, nota, talles }] } -> ya leído en el navegador
//   node scripts/importar-tienda.mjs archivo.json
import { readFileSync, writeFileSync } from "node:fs";
import { coincide, generoDe } from "./buscar-lib.mjs";
import { leerHtml, talleAR, ordenar } from "./tiendas.mjs";

const RAIZ = new URL("../public/data/", import.meta.url);
const cat = JSON.parse(readFileSync(new URL("modelos.json", RAIZ), "utf8"));
const hist = JSON.parse(readFileSync(new URL("historial.json", RAIZ), "utf8"));
const hoyISO = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Argentina/Buenos_Aires" }).format(new Date());
const hoyAR = hoyISO.split("-").reverse().join("/");
const j = JSON.parse(readFileSync(process.argv[2], "utf8"));
const TIENDA = j.tienda;
if (!TIENDA) { console.error("El archivo no dice de qué tienda es."); process.exit(1); }

/* ofertas: { nombre, url, precio, antes, cuotas, talles, sistema, nota } */
let ofertas = [];
if (j.plataforma === "vtex") {
  const generoCat = p => { const c = (p.categories || []).join(" "), h = /\/hombre\//i.test(c), w = /\/mujer\//i.test(c); return h && w ? "Unisex" : w ? "Mujer" : h ? "Hombre" : ""; };
  for (const p of j.productos || []) {
    const its = (p.items || []).filter(i => i.sellers.some(s => s.commertialOffer.AvailableQuantity > 0 && s.commertialOffer.Price > 0));
    if (!its.length) continue;
    const o = its.flatMap(i => i.sellers.map(s => s.commertialOffer)).filter(o => o.AvailableQuantity > 0 && o.Price > 0).sort((a, b) => a.Price - b.Price)[0];
    const talle = i => [...(Array.isArray(i.talle) ? i.talle : [i.talle]), i.name].filter(Boolean).flatMap(x => talleAR(String(x).replace(/^.*?talle:?\s*/i, "").split(/\s/)[0]))[0];
    const talles = ordenar(its.map(talle).filter(Boolean));
    ofertas.push({ nombre: p.productName, url: p.link, precio: Math.round(o.Price), antes: o.ListPrice > o.Price * 1.01 ? Math.round(o.ListPrice) : null,
      cuotas: Math.max(0, ...(o.Installments || []).map(x => x.NumberOfInstallments)), talles, sistema: talles.length ? "AR" : null, nota: generoCat(p) || generoDe(p.productName + " " + p.link) });
  }
} else if (j.plataforma === "html") {
  for (const p of j.paginas || []) {
    let r; try { r = leerHtml(p.html); } catch { continue; }
    if (!r || r.sinStock || !r.precio) continue;
    ofertas.push({ nombre: p.nombre, url: p.url, ...r, nota: generoDe(p.nombre + " " + p.url) });
  }
} else if (j.plataforma === "lista") {
  /* ya leído en el navegador (Digital Sport): nombre, url, precio, antes, cuotas, nota (género), talles AR */
  for (const p of j.productos || []) if (p.precio > 0 && p.url) ofertas.push({ ...p, nota: p.nota || generoDe(p.nombre + " " + p.url), talles: p.talles || [], sistema: p.talles?.length ? "AR" : null });
} else { console.error("Formato desconocido."); process.exit(1); }
console.log(`${TIENDA}: ${ofertas.length} productos con stock.`);

let n = 0;
for (const m of cat.modelos) {
  const ofs = ofertas.filter(o => o.url && coincide(m, o.nombre, o.url));
  if (!ofs.length) continue;
  const elegidas = ["Hombre", "Mujer"].map(g => ofs.filter(o => o.nota === g || o.nota === "Unisex" || !o.nota).sort((a, b) => a.precio - b.precio)[0]).filter(Boolean);
  m.tiendas = (m.tiendas || []).filter(t => t.tienda !== TIENDA);
  for (const o of new Map(elegidas.map(o => [o.url, o])).values()) {
    const t = { tienda: TIENDA, precio: o.precio, ...(o.antes ? { antes: o.antes } : {}), cuotas: o.cuotas ? `${o.cuotas} cuotas sin interés` : "Consultar en la tienda",
      ...(o.nota && o.nota !== "Unisex" ? { nota: o.nota } : {}), url: o.url, fecha: hoyAR, ...(o.talles?.length ? { talles: o.talles, sistema: o.sistema || "AR" } : {}) };
    m.tiendas.push(t);
    const clave = TIENDA + (t.nota === "Mujer" ? " · Mujer" : "");
    const serie = ((hist.series[m.slug] ??= {})[clave] ??= []);
    const ult = serie[serie.length - 1];
    if (ult && ult[0] === hoyISO) ult[1] = o.precio; else serie.push([hoyISO, o.precio]);
    n++; console.log(`✓ ${m.slug} · ${t.nota || "—"}: $${o.precio.toLocaleString("es-AR")}${o.talles?.length ? ` · ${o.talles.length} talles` : ""}`);
  }
  m.tiendas.sort((a, b) => a.precio - b.precio);
}
writeFileSync(new URL("modelos.json", RAIZ), JSON.stringify(cat, null, 1) + "\n");
writeFileSync(new URL("historial.json", RAIZ), JSON.stringify(hist) + "\n");
console.log(`\n${n} precios de ${TIENDA} cargados con fecha ${hoyAR}.`);
