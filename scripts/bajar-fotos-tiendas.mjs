// Baja las fotos de producto de los modelos que todavía no tienen, desde las páginas de sus tiendas.
// Las deja en scripts/fotos-nuevas/<modelo>/ para revisarlas y pasarlas a public/fotos (se recortan y convierten aparte).
//   node scripts/bajar-fotos-tiendas.mjs                 -> modelos con tiendas y sin fotos
//   node scripts/bajar-fotos-tiendas.mjs slug1 slug2     -> solo esos (aunque ya tengan fotos)
import { readFileSync, writeFileSync, mkdirSync, existsSync, readdirSync, rmSync } from "node:fs";
import { dormir, UA } from "./tiendas.mjs";
import { imagenes, errores } from "./fotos-lib.mjs";

const cat = JSON.parse(readFileSync(new URL("../public/data/modelos.json", import.meta.url), "utf8"));
const DEST = new URL("./fotos-nuevas/", import.meta.url);
const PREFERIDAS = ["Dexter", "Gostore", "Sporting", "TodoTrail", "Moov"];   // fondos y encuadres más parejos primero
const MAX = 5;
const tieneFotos = m => { const d = new URL(`../public/fotos/${m.slug}/`, import.meta.url); return existsSync(d) && readdirSync(d).some(f => /\.(webp|jpe?g|png|avif)$/i.test(f)); };

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
          let r = await fetch(src, { headers: { "User-Agent": UA }, signal: AbortSignal.timeout(25000) });
          for (let k = 1; r.status === 429 && k <= 3; k++) { await dormir(15000 * k); r = await fetch(src, { headers: { "User-Agent": UA }, signal: AbortSignal.timeout(25000) }); }   // el CDN de VTEX frena si se piden muchas seguidas
          const ct = r.headers.get("content-type") || "", buf = Buffer.from(await r.arrayBuffer());
          if (r.ok && /^image\//.test(ct) && buf.length >= 8000) bajadas.push([/webp/.test(ct) ? "webp" : /png/.test(ct) ? "png" : "jpg", buf]);
          else errores.push(`${src}: HTTP ${r.status} ${ct} ${buf.length} bytes`);
        } catch (e) { errores.push(`${src}: ${e.message}`); }
        await dormir(/vteximg|vtexassets/.test(src) ? 2500 : 400);
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
