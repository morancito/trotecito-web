// Baja las fotos de producto de los modelos que todavía no tienen, desde las páginas de sus tiendas.
// Las deja en scripts/fotos-nuevas/<modelo>/ para revisarlas y pasarlas a public/fotos (se recortan y convierten aparte).
//   node scripts/bajar-fotos-tiendas.mjs
import { readFileSync, writeFileSync, mkdirSync, existsSync, readdirSync } from "node:fs";
import { traer, dormir, UA } from "./tiendas.mjs";

const cat = JSON.parse(readFileSync(new URL("../public/data/modelos.json", import.meta.url), "utf8"));
const DEST = new URL("./fotos-nuevas/", import.meta.url);
const PREFERIDAS = ["Dexter", "Sporting", "Gostore", "TodoTrail", "Moov"];   // fondos y encuadres más parejos primero
const MAX = 5;
const tieneFotos = m => { const d = new URL(`../public/fotos/${m.slug}/`, import.meta.url); return existsSync(d) && readdirSync(d).some(f => /\.(webp|jpe?g|png|avif)$/i.test(f)); };

async function imagenes(url) {
  const u = new URL(url);
  if (/\/p\/?$/.test(u.pathname)) {                       // VTEX
    const p = (await traer(`${u.origin}/api/catalog_system/pub/products/search${u.pathname}`, true))[0];
    return (p?.items?.[0]?.images || []).map(i => i.imageUrl);
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

const informe = {};
for (const m of cat.modelos.filter(m => m.tiendas?.length && !tieneFotos(m))) {
  const ts = [...m.tiendas].sort((a, b) => (PREFERIDAS.indexOf(a.tienda) + 1 || 99) - (PREFERIDAS.indexOf(b.tienda) + 1 || 99));
  for (const t of ts) {
    try {
      const urls = (await imagenes(t.url)).slice(0, MAX);
      if (!urls.length) continue;
      const dir = new URL(`${m.slug}/`, DEST); mkdirSync(dir, { recursive: true });
      let n = 0;
      for (const src of urls) {
        try {
          const r = await fetch(src, { headers: { "User-Agent": UA }, signal: AbortSignal.timeout(25000) });
          if (!r.ok) continue;
          const ct = r.headers.get("content-type") || "", buf = Buffer.from(await r.arrayBuffer());
          if (!/^image\//.test(ct) || buf.length < 8000) continue;
          const ext = /webp/.test(ct) ? "webp" : /png/.test(ct) ? "png" : "jpg";
          writeFileSync(new URL(`${++n}.${ext}`, dir), buf);
        } catch {}
        await dormir(400);
      }
      if (n) { informe[m.slug] = { tienda: t.tienda, url: t.url, fotos: n }; console.log(`✓ ${m.slug}: ${n} fotos de ${t.tienda}`); break; }
    } catch (e) { console.warn(`· ${m.slug} ${t.tienda}: ${e.message}`); }
    await dormir(800);
  }
  if (!informe[m.slug]) { informe[m.slug] = null; console.warn(`✗ ${m.slug}: sin fotos`); }
}
mkdirSync(DEST, { recursive: true });
writeFileSync(new URL("informe.json", DEST), JSON.stringify(informe, null, 1) + "\n");
