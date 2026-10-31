// Baja las fotos de producto de los modelos que todavía no tienen, desde las páginas de sus tiendas.
// Las deja en scripts/fotos-nuevas/<modelo>/ para revisarlas y pasarlas a public/fotos (se recortan y convierten aparte).
//   node scripts/bajar-fotos-tiendas.mjs                 -> modelos con tiendas y sin fotos
//   node scripts/bajar-fotos-tiendas.mjs slug1 slug2     -> solo esos (aunque ya tengan fotos)
import { readFileSync, writeFileSync, mkdirSync, existsSync, readdirSync, rmSync } from "node:fs";
import { traer, dormir, UA } from "./tiendas.mjs";

const cat = JSON.parse(readFileSync(new URL("../public/data/modelos.json", import.meta.url), "utf8"));
const DEST = new URL("./fotos-nuevas/", import.meta.url);
const PREFERIDAS = ["Dexter", "Gostore", "Sporting", "TodoTrail", "Moov"];   // fondos y encuadres más parejos primero
const MAX = 5;
const tieneFotos = m => { const d = new URL(`../public/fotos/${m.slug}/`, import.meta.url); return existsSync(d) && readdirSync(d).some(f => /\.(webp|jpe?g|png|avif)$/i.test(f)); };

const errores = [];
async function imagenes(url) {
  const u = new URL(url);
  if (/\/p\/?$/.test(u.pathname)) {                       // VTEX (si la API no da fotos, sigue con la página)
    try {
      const p = (await traer(`${u.origin}/api/catalog_system/pub/products/search${u.pathname}`, true))[0];
      const vistas = new Map();
      for (const it of p?.items || []) for (const i of it.images || []) if (!vistas.has(i.imageId)) vistas.set(i.imageId, i.imageUrl);
      if (vistas.size) return [...vistas.values()];
    } catch (e) { errores.push(`${url}: API ${e.message}`); }
  }
  const h = await traer(url), out = [];
  for (const m of h.matchAll(/\/on\/demandware\.static\/[^"'\s]+?\/products\/([A-Z0-9_-]+)\/\1-(\d+)\.(?:JPG|jpg|jpeg|png)/g))   // Salesforce (Dexter, Moov)
    out.push([+m[2], u.origin + m[0].replace(/\/dw\/image\/v2\/[A-Z_]+/, "")]);
  if (out.length) { const orden = [1, 2, 6, 5, 3, 4]; return [...new Map(out.map(x => [x[0], x[1]]))].sort((a, b) => (orden.indexOf(a[0]) + 1 || 99) - (orden.indexOf(b[0]) + 1 || 99)).map(x => x[1]); }
  const full = [...h.matchAll(/"full":"([^"]+)"/g)].map(m => m[1].replace(/\\\//g, "/"));            // Magento (Gostore)
  if (full.length) return [...new Set(full)];
  const nube = [...h.matchAll(/((?:https?:)?\/\/[^"'\s,]*mitiendanube\.com\/stores\/[^"'\s,]+\/products\/[^"'\s,]+?)-(?:\d+)-(?:\d+)\.(webp|jpe?g|png)/g)]
    .map(m => (m[1].startsWith("//") ? "https:" + m[1] : m[1]) + "-1024-1024." + m[2]);                  // Tiendanube
  if (nube.length) return [...new Set(nube)];
  const og = [...h.matchAll(/<meta[^>]+property="og:image"[^>]+content="([^"]+)"/g)].map(m => m[1]);
  return [...new Set(og)];
}

const pedidos = process.argv.slice(2);
const informe = {};
for (const m of cat.modelos.filter(m => m.tiendas?.length && (pedidos.length ? pedidos.includes(m.slug) : !tieneFotos(m)))) {
  /* prueba las tiendas en orden y se queda con la que da más fotos (alcanza con 3) */
  const ts = [...m.tiendas].sort((a, b) => (PREFERIDAS.indexOf(a.tienda) + 1 || 99) - (PREFERIDAS.indexOf(b.tienda) + 1 || 99));
  let mejor = null;
  for (const t of ts) {
    try {
      const urls = (await imagenes(t.url)).slice(0, MAX), bajadas = [];
      for (const src of urls) {
        try {
          const r = await fetch(src, { headers: { "User-Agent": UA }, signal: AbortSignal.timeout(25000) });
          const ct = r.headers.get("content-type") || "", buf = Buffer.from(await r.arrayBuffer());
          if (r.ok && /^image\//.test(ct) && buf.length >= 8000) bajadas.push([/webp/.test(ct) ? "webp" : /png/.test(ct) ? "png" : "jpg", buf]);
          else errores.push(`${src}: HTTP ${r.status} ${ct} ${buf.length} bytes`);
        } catch (e) { errores.push(`${src}: ${e.message}`); }
        await dormir(400);
      }
      if (bajadas.length > (mejor?.fotos.length || 0)) mejor = { tienda: t.tienda, url: t.url, fotos: bajadas };
      if (!urls.length) errores.push(`${m.slug} ${t.tienda}: la página no tiene fotos reconocibles`);
    } catch (e) { errores.push(`${m.slug} ${t.tienda}: ${e.message}`); console.warn(`· ${m.slug} ${t.tienda}: ${e.message}`); }
    if (mejor?.fotos.length >= 3) break;
    await dormir(800);
  }
  if (!mejor) { informe[m.slug] = null; console.warn(`✗ ${m.slug}: sin fotos`); continue; }
  const dir = new URL(`${m.slug}/`, DEST); rmSync(dir, { recursive: true, force: true }); mkdirSync(dir, { recursive: true });
  mejor.fotos.forEach(([ext, buf], i) => writeFileSync(new URL(`${i + 1}.${ext}`, dir), buf));
  informe[m.slug] = { tienda: mejor.tienda, url: mejor.url, fotos: mejor.fotos.length };
  console.log(`✓ ${m.slug}: ${mejor.fotos.length} fotos de ${mejor.tienda}`);
}
mkdirSync(DEST, { recursive: true });
const ARCH = new URL("informe.json", DEST);
let previo = {}; try { previo = JSON.parse(readFileSync(ARCH, "utf8")); } catch {}
writeFileSync(ARCH, JSON.stringify({ ...previo, ...informe, _errores: errores.slice(0, 60) }, null, 1) + "\n");
