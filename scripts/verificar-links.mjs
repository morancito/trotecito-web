// Abre cada link de tienda tal como lo ve la gente (la página del producto, no la API) y anota los que no sirven:
// no cargan, mandan a otra página, dicen que el producto no existe o muestran otro producto.
// Deja scripts/links.json con el detalle. No cambia el catálogo: es para auditar.
//   node scripts/verificar-links.mjs [tienda...]
import { readFileSync, writeFileSync } from "node:fs";
import { verPagina, dormir } from "./tiendas.mjs";

const cat = JSON.parse(readFileSync(new URL("../public/data/modelos.json", import.meta.url), "utf8"));
const colores = JSON.parse(readFileSync(new URL("../public/data/colores.json", import.meta.url), "utf8"));
const solo = process.argv.slice(2).map(x => x.toLowerCase());
const links = new Map();   // url -> { tienda, modelo, donde }
for (const m of cat.modelos.filter(m => !m.borrador)) {
  for (const t of m.tiendas || []) if (!t.sinStock && t.url) links.set(t.url, { tienda: t.tienda, slug: m.slug, m, donde: "precio" });
  for (const c of colores[m.slug] || []) for (const x of [c, ...(c.otras || [])]) if (x.url && !x.sinStock && !links.has(x.url)) links.set(x.url, { tienda: x.tienda, slug: m.slug, m, donde: "color" });
}
const porHost = new Map();
for (const [url, x] of links) { if (solo.length && !solo.some(s => x.tienda.toLowerCase().startsWith(s))) continue; let h; try { h = new URL(url).host; } catch { continue; } (porHost.get(h) || porHost.set(h, []).get(h)).push([url, x]); }
const malos = [], resumen = {};
await Promise.all([...porHost].map(async ([host, lista]) => {
  for (const [url, x] of lista) {
    const r = await verPagina(url, x.m);
    const s = resumen[x.tienda] ??= { total: 0, mal: 0 }; s.total++;
    if (!r.ok) { s.mal++; malos.push({ tienda: x.tienda, slug: x.slug, donde: x.donde, url, motivo: r.motivo, titulo: r.titulo }); console.log(`✗ ${x.tienda} · ${x.slug} (${x.donde}): ${r.motivo}`); }
    await dormir(700);
  }
}));
writeFileSync(new URL("./links.json", import.meta.url), JSON.stringify({ fecha: new Date().toISOString(), resumen, malos }, null, 1) + "\n");
console.log(`\n${[...porHost.values()].flat().length} links, ${malos.length} con problemas.`);
for (const [t, s] of Object.entries(resumen).sort((a, b) => b[1].mal - a[1].mal)) console.log(`${t}: ${s.mal} de ${s.total}`);
