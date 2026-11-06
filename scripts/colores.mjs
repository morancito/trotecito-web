// Busca en las tiendas todas las variantes de color de cada modelo (cada color suele ser un producto aparte),
// con su foto principal, precio, stock y el nombre del color si la tienda lo dice.
// Deja la lista en scripts/colores.json y la foto de cada color en scripts/colores-fotos/<modelo>/<n>.<ext>
// (después colores-fotos.py las recorta, les saca el color dominante y arma public/fotos/<modelo>/c<n>.webp).
//   node scripts/colores.mjs                 -> todos los modelos
//   node scripts/colores.mjs slug1 slug2     -> solo esos
import { readFileSync, writeFileSync, mkdirSync, rmSync } from "node:fs";
import { leer, traer, dormir, UA } from "./tiendas.mjs";
import { TIENDAS, vendeMarca, pausaDe, conReintento, coincide, generoDe, plataforma, buscar } from "./buscar-lib.mjs";
import { imagenes } from "./fotos-lib.mjs";

const cat = JSON.parse(readFileSync(new URL("../public/data/modelos.json", import.meta.url), "utf8"));
const pedidos = process.argv.slice(2);
const modelos = cat.modelos.filter(m => !pedidos.length || pedidos.includes(m.slug));
const DEST = new URL("./colores-fotos/", import.meta.url);
const MAX_POR_MODELO = 10;

/* el color, si la tienda lo dice: atributo de producto, JSON-LD o la última parte del nombre ("… - Negra/Blanca") */
const PALABRAS = /(negr|blanc|gris|azul|celeste|roj|rosa|fucsia|violeta|lila|verde|amarill|naranja|marr|beige|crema|bord|plata|dorad|black|white|grey|gray|blue|red|pink|purple|green|yellow|orange|brown|navy|silver|gold|cream|coral|aqua|lima|lime|mint|menta|arena|sand|turquesa)/i;
async function colorDe(url, nombre) {
  try {
    const u = new URL(url);
    if (/\/p\/?$/.test(u.pathname)) {
      const p = (await traer(`${u.origin}/api/catalog_system/pub/products/search${u.pathname}`, true))[0] || {};
      for (const k of Object.keys(p)) if (/^colou?r$/i.test(k) && p[k]?.[0]) return String(p[k][0]);
      for (const it of p.items || []) for (const k of Object.keys(it)) if (/^colou?r$/i.test(k) && it[k]?.[0]) return String(it[k][0]);
    }
    const h = await traer(url);
    const ld = (h.match(/"color"\s*:\s*"([^"]{3,60})"/i) || [])[1];
    if (ld && PALABRAS.test(ld)) return ld;
    const txt = h.replace(/<script[\s\S]*?<\/script>/g, " ").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ");
    const c = (txt.match(/\bColou?r(?:es)?\s*:\s*([A-Za-zÁÉÍÓÚáéíóúñ][A-Za-zÁÉÍÓÚáéíóúñ ]{2,25}(?:\s*\/\s*[A-Za-zÁÉÍÓÚáéíóúñ ]{3,25}){0,2})/) || [])[1];
    if (c && PALABRAS.test(c)) return c.trim();
  } catch {}
  const suf = (nombre.split(/\s[-–]\s/).pop() || "").trim();
  return suf && suf !== nombre && PALABRAS.test(suf) ? suf : null;
}

async function bajar(src, archivo) {
  let r = await fetch(src, { headers: { "User-Agent": UA }, signal: AbortSignal.timeout(25000) });
  for (let k = 1; r.status === 429 && k <= 3; k++) { await dormir(15000 * k); r = await fetch(src, { headers: { "User-Agent": UA }, signal: AbortSignal.timeout(25000) }); }
  const ct = r.headers.get("content-type") || "", buf = Buffer.from(await r.arrayBuffer());
  if (!r.ok || !/^image\//.test(ct) || buf.length < 8000) return null;
  const ext = /webp/.test(ct) ? "webp" : /png/.test(ct) ? "png" : "jpg";
  writeFileSync(new URL(`${archivo}.${ext}`, DEST), buf); return `${archivo}.${ext}`;
}

const tiposTienda = {};
for (const ti of TIENDAS) { try { tiposTienda[ti.nombre] = await plataforma(ti.url); } catch { tiposTienda[ti.nombre] = "desconocida"; } }
console.log(tiposTienda);

const ARCH = new URL("./colores.json", import.meta.url);
let salida = {}; try { salida = JSON.parse(readFileSync(ARCH, "utf8")); } catch {}
/* para correr en tandas: con FALTANTES=1 salta los modelos que ya tienen colores; con MINUTOS=n deja de empezar modelos nuevos a los n minutos */
const FALTANTES = process.env.FALTANTES === "1", MINUTOS = +process.env.MINUTOS || 0, t0 = Date.now();
const hecho = new Set();
const host = u => new URL(u).hostname;
/* cada tienda va en paralelo con las otras, pero de a una consulta por tienda y con su pausa */
const porTienda = async (items, clave, f) => {
  const g = new Map(); for (const it of items) { const k = clave(it); if (!g.has(k)) g.set(k, []); g.get(k).push(it); }
  const out = [];
  await Promise.all([...g.values()].map(async lista => { for (const it of lista) { const r = await f(it); if (r) out.push(r); } }));
  return out;
};
for (const m of modelos) {
  if (FALTANTES && !pedidos.length && salida[m.slug]?.length) continue;
  if (MINUTOS && (Date.now() - t0) / 60000 > MINUTOS) { writeFileSync(new URL("./colores-faltan.txt", import.meta.url), "1"); console.log(`\nCorte por tiempo (${MINUTOS} min): faltan modelos, volver a correr con FALTANTES=1.`); break; }
  /* candidatos: las URLs que ya tenemos cargadas y lo que devuelven los buscadores de cada tienda */
  const cands = new Map((m.tiendas || []).map(t => [t.url, { tienda: t.tienda, url: t.url, nombre: `${m.m} ${m.mod} ${m.ver}`, nota: t.nota || "" }]));
  const q = `${m.mod} ${m.ver}`.replace(/^(Gel-|Fresh Foam X |FuelCell )/, "").trim();
  await Promise.all(TIENDAS.filter(ti => vendeMarca(ti, m)).map(async ti => {
    const tipo = tiposTienda[ti.nombre]; if (tipo === "desconocida") return;
    try {
      const res = await conReintento(() => buscar(tipo, ti.url, q));
      for (const c of res) if (coincide(m, c.nombre, c.url) && !cands.has(c.url)) cands.set(c.url, { tienda: ti.nombre, url: c.url, nombre: c.nombre, nota: generoDe(c.nombre + " " + c.url) });
    } catch (e) { console.warn(`· ${m.slug} ${ti.nombre}: ${e.message}`); }
    await dormir(pausaDe(ti.url));
  }));
  const dir = `${m.slug}/`; rmSync(new URL(dir, DEST), { recursive: true, force: true }); mkdirSync(new URL(dir, DEST), { recursive: true });
  let n = 0;
  const leidas = await porTienda([...cands.values()].slice(0, 30), c => host(c.url), async c => {
    try {
      const r = await conReintento(() => leer(c.url));
      if (r.sinStock || !r.precio) return null;
      const fotos = await imagenes(c.url);
      const archivo = fotos.length ? await bajar(fotos[0], `${dir}${++n}`) : null;
      if (!archivo) return null;
      const v = { ...c, color: await colorDe(c.url, c.nombre), foto: archivo, precio: r.precio, antes: r.antes || null, talles: r.talles || [], sistema: r.sistema || null };
      console.log(`✓ ${m.slug} · ${c.tienda} · ${v.color || "?"} · $${r.precio}`);
      return v;
    } catch (e) { console.warn(`· ${m.slug} ${c.url}: ${e.message}`); return null; }
    finally { await dormir(pausaDe(c.url)); }
  });
  salida[m.slug] = leidas.sort((a, b) => a.precio - b.precio).slice(0, MAX_POR_MODELO * 2);
  hecho.add(m.slug);
  writeFileSync(ARCH, JSON.stringify(salida, null, 1) + "\n");   // se guarda a medida que avanza
}
writeFileSync(new URL("./colores-hechos.txt", import.meta.url), [...hecho].join("\n") + "\n");   // colores-fotos.py procesa solo estos
console.log(`\nListo: ${Object.values(salida).reduce((a, v) => a + v.length, 0)} variantes en ${Object.keys(salida).length} modelos (${hecho.size} en esta corrida).`);
