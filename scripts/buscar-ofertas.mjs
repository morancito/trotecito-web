// Busca en tiendas nuevas los modelos del catálogo y anota precio, cuotas y talles con stock.
// No toca modelos.json: deja los hallazgos en scripts/ofertas-encontradas.json para revisarlos antes de sumarlos.
//   node scripts/buscar-ofertas.mjs                 -> todas las tiendas de la lista
//   node scripts/buscar-ofertas.mjs Moov Gostore    -> solo esas
// Lo corre a mano el workflow "Buscar ofertas" (pestaña Actions).
import { readFileSync, writeFileSync } from "node:fs";
import { leer, traer, dormir } from "./tiendas.mjs";

const TIENDAS = [
  { nombre: "Moov", url: "https://www.moov.com.ar" },
  { nombre: "Gostore", url: "https://gostore.com.ar" },
  { nombre: "TodoTrail", url: "https://todotrail.com.ar" },
  { nombre: "Naka Outdoors", url: "https://www.nakaoutdoors.com.ar" },
];
const PAUSA = 800, PAUSA_LENTA = 2500;   // algunas tiendas frenan si se consulta rápido
async function conReintento(f) { try { return await f(); } catch (e) { if (!/429|503/.test(e.message)) throw e; await dormir(20000); return f(); } }
const cat = JSON.parse(readFileSync(new URL("../public/data/modelos.json", import.meta.url), "utf8"));
const elegidas = process.argv.slice(2).map(x => x.toLowerCase());

const norm = s => String(s || "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/([a-z])(\d)/g, "$1 $2").replace(/(\d)([a-z])/g, "$1 $2").replace(/[^a-z0-9.]+/g, " ").trim();
const MARCAS = ["nike", "adidas", "asics", "new balance", "saucony", "puma", "brooks", "on", "hoka", "mizuno", "under armour", "salomon", "topper", "reebok", "fila", "diadora", "la sportiva", "nnormal", "dynafit", "merrell", "columbia", "altra"];
/* palabras que indican otra versión del modelo: si aparecen en la tienda y no en nuestro modelo, no es el mismo */
const VARIANTES = ["trail", "gtx", "gore", "plus", "premium", "max", "elite", "pro", "tr", "ultra", "mid", "speed", "sl", "lite", "flow", "next", "rise", "stride", "hyper", "prime", "se", "luxe", "boa", "evo", "x", "control", "tempo", "mary", "jane", "shield", "winter", "spike", "spikes", "atr"];
const NO_ZAPA = /\b(buzo|remera|media|medias|short|gorra|gorro|visera|mochila|bolso|duffle|chaleco|bidon|rinonera|cinturon|guantes|polainas|campera|calza|musculosa|ojotas?|sandalia|bota|botin|kids|nino|nina|junior|jr|gs|ps|td|bebe)\b/;
const generoDe = s => { const t = ` ${norm(s)} `; return / (mujer|women|womens|wmns|w|dama) /.test(t) ? "Mujer" : / (hombre|men|mens|m|caballero) /.test(t) ? "Hombre" : / unisex /.test(t) ? "Unisex" : ""; };

function coincide(m, nombre, url) {
  const t = ` ${norm(nombre + " " + decodeURIComponent(new URL(url).pathname))} `;
  if (NO_ZAPA.test(t)) return false;
  const marca = norm(m.m);
  if (MARCAS.some(b => b !== marca && t.includes(` ${b} `)) && !t.includes(` ${marca} `)) return false;
  const tokens = norm(`${m.mod} ${m.ver}`).split(" ").filter(x => x && !["gel", "fresh", "foam", "fuelcell", "adizero", "terrex", "zoom", "air"].includes(x));
  for (const k of tokens) {
    if (/^\d+(\.\d)?$/.test(k)) { if (!new RegExp(`[^0-9.]${k.replace(".", "\\.")}[^0-9]`).test(t)) return false; }
    else if (!t.includes(` ${k} `)) return false;
  }
  if (VARIANTES.some(v => !tokens.includes(v) && t.includes(` ${v} `) && !norm(m.mod).split(" ").includes(v))) return false;
  /* otro número de versión pegado al nombre (ej. Pegasus 40 cuando buscamos 41) */
  const ult = tokens.filter(x => !/^\d/.test(x)).pop();
  if (ult) { const mm = t.match(new RegExp(` ${ult} (v ?)?(\\d+)\\b`)); const ver = tokens.find(x => /^\d+$/.test(x)); if (mm && ver && mm[2] !== ver && !tokens.includes(mm[2])) return false; }
  return true;
}

/* ---------- búsqueda según la plataforma de la tienda ---------- */
let pista = "";
async function plataforma(base) {
  const h = await traer(base + "/");
  pista = [(h.match(/<meta[^>]+name="generator"[^>]+content="([^"]+)"/i) || [])[1], ...new Set([...h.matchAll(/<script[^>]+src="https?:\/\/([^/"]+)/g)].map(x => x[1]))].filter(Boolean).slice(0, 12).join(" | ");
  if (/demandware/i.test(h)) return "sfcc";
  if (/x-magento-init|Magento_/.test(h)) return "magento";
  if (/tiendanube|nuvemshop|LS\.store/i.test(h)) return "tiendanube";
  if (/vteximg|vtexassets|vtex\.com/i.test(h)) return "vtex";
  if (/cdn\.shopify\.com/i.test(h)) return "shopify";
  if (/woocommerce/i.test(h)) return "woo";
  return "desconocida";
}
const abs = (base, u) => new URL(u.replace(/&amp;/g, "&"), base).href;
async function buscar(tipo, base, q) {
  const e = encodeURIComponent(q);
  if (tipo === "sfcc") {
    const h = await traer(`${base}/buscar?q=${e}`);
    return [...new Set([...h.matchAll(/href="(\/[^"]+\/[A-Z0-9][A-Z0-9-]+\.html)"/g)].map(x => x[1]))].map(u => ({ url: abs(base, u), nombre: u.split("/").slice(-2)[0].replace(/-/g, " ") }));
  }
  if (tipo === "magento") {
    const h = await traer(`${base}/catalogsearch/result/?q=${e}`);
    return [...h.matchAll(/<a[^>]*class="[^"]*product-item-link[^"]*"[^>]*>[\s\S]*?<\/a>/g)].map(x => ({ url: abs(base, (x[0].match(/href="([^"]+)"/) || [])[1] || "/"), nombre: x[0].replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim() }));
  }
  if (tipo === "tiendanube") {
    const h = await traer(`${base}/search/?q=${e}`);
    const out = new Map();
    for (const x of h.matchAll(/<a[^>]+href="([^"]*\/productos\/[^"]+)"[^>]*>/g)) { const u = abs(base, x[1]); const tit = (x[0].match(/title="([^"]+)"/) || [])[1]; if (!out.has(u) || tit) out.set(u, tit || u.split("/productos/")[1].replace(/[-/]/g, " ")); }
    return [...out].map(([url, nombre]) => ({ url, nombre }));
  }
  if (tipo === "vtex") {
    const j = await traer(`${base}/api/catalog_system/pub/products/search?ft=${e}&_from=0&_to=19`, true);
    return j.map(p => ({ url: p.link, nombre: p.productName }));
  }
  if (tipo === "shopify") {
    const j = await traer(`${base}/search/suggest.json?q=${e}&resources[type]=product&resources[limit]=10`, true);
    return (j.resources?.results?.products || []).map(p => ({ url: abs(base, p.url), nombre: p.title }));
  }
  if (tipo === "woo") {
    const j = await traer(`${base}/wp-json/wc/store/v1/products?search=${e}&per_page=20`, true);
    return j.map(p => ({ url: p.permalink, nombre: p.name }));
  }
  return [];
}

const salida = { fecha: new Date().toISOString(), tiendas: {}, resultados: [] };
for (const ti of TIENDAS.filter(t => !elegidas.length || elegidas.includes(t.nombre.toLowerCase()))) {
  let tipo;
  try { tipo = await plataforma(ti.url); } catch (e) { salida.tiendas[ti.nombre] = { error: "no abre: " + e.message }; console.warn(`✗ ${ti.nombre}: ${e.message}`); continue; }
  salida.tiendas[ti.nombre] = { tipo, pista, buscados: 0, encontrados: 0, errores: [] };
  const pausa = /gostore/.test(ti.url) ? PAUSA_LENTA : PAUSA;
  console.log(`\n== ${ti.nombre} (${tipo})`);
  if (tipo === "desconocida") continue;
  for (const m of cat.modelos) {
    const q = `${m.mod} ${m.ver}`.replace(/^(Gel-|Fresh Foam X |FuelCell )/, "").trim();
    let cands = [];
    try { cands = await conReintento(() => buscar(tipo, ti.url, q)); salida.tiendas[ti.nombre].buscados++; }
    catch (e) { salida.tiendas[ti.nombre].errores.push(`${m.slug}: búsqueda ${e.message}`); await dormir(pausa); continue; }
    await dormir(pausa);
    const porGenero = new Map();
    for (const c of cands) { if (!coincide(m, c.nombre, c.url)) continue; const g = generoDe(c.nombre + " " + c.url); if (!porGenero.has(g)) porGenero.set(g, c); }
    for (const [g, c] of porGenero) {
      try {
        const r = await conReintento(() => leer(c.url));
        salida.resultados.push({ slug: m.slug, modelo: `${m.m} ${m.mod} ${m.ver}`.trim(), tienda: ti.nombre, nombre: c.nombre, url: c.url, nota: g, ...r });
        salida.tiendas[ti.nombre].encontrados++;
        console.log(`✓ ${m.slug} · ${g || "?"} · ${r.sinStock ? "sin stock" : "$" + r.precio} · ${c.nombre}`);
      } catch (e) { salida.tiendas[ti.nombre].errores.push(`${m.slug}: ${e.message} (${c.url})`); }
      await dormir(pausa);
    }
  }
}
writeFileSync(new URL("./ofertas-encontradas.json", import.meta.url), JSON.stringify(salida, null, 1) + "\n");
console.log(`\nListo: ${salida.resultados.length} ofertas encontradas.`);
