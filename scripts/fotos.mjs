// Busca fotos en public/fotos/<slug-del-modelo>/ y las suma a modelos.json.
// Corre solo antes de cada build. Formatos: jpg, png, webp, avif. Se ordenan por nombre (1.jpg, 2.jpg...).
import { readFileSync, writeFileSync, readdirSync, existsSync, statSync } from "node:fs";

const raiz = new URL("../public/", import.meta.url);
const archivo = new URL("data/modelos.json", raiz);
const cat = JSON.parse(readFileSync(archivo, "utf8"));
const IMG = /\.(jpe?g|png|webp|avif)$/i;
let total = 0;
const slugs = new Set(cat.modelos.map(m => m.slug));
for (const m of cat.modelos) {
  const dir = new URL(`fotos/${m.slug}/`, raiz);
  m.fotos = existsSync(dir)
    ? readdirSync(dir).filter(f => IMG.test(f)).sort((a, b) => a.localeCompare(b, undefined, { numeric: true })).map(f => `fotos/${m.slug}/${f}`)
    : [];
  total += m.fotos.length;
}
const fotosDir = new URL("fotos/", raiz);
if (existsSync(fotosDir)) for (const d of readdirSync(fotosDir))
  if (statSync(new URL(d, fotosDir)).isDirectory() && !slugs.has(d)) console.warn(`Ojo: la carpeta fotos/${d} no coincide con ningún modelo.`);
writeFileSync(archivo, JSON.stringify(cat, null, 1) + "\n");
console.log(`Fotos: ${total} en ${cat.modelos.filter(m => m.fotos.length).length} modelos.`);
