// Busca fotos en public/fotos/<slug-del-modelo>/ y las suma a modelos.json.
// Corre solo antes de cada build. Formatos: jpg, png, webp, avif. Se ordenan por nombre (1.jpg, 2.jpg...).
import { readFileSync, writeFileSync, readdirSync, existsSync, statSync } from "node:fs";
import { createHash } from "node:crypto";
/* ?v=<huella del archivo>: si una foto se reemplaza, cambia la dirección y el navegador la baja de nuevo;
   si no cambia, sigue usando la que tiene guardada */
const huella = ruta => createHash("md5").update(readFileSync(ruta)).digest("hex").slice(0, 8);

const raiz = new URL("../public/", import.meta.url);
const archivo = new URL("data/modelos.json", raiz);
const cat = JSON.parse(readFileSync(archivo, "utf8"));
const IMG = /\.(jpe?g|png|webp|avif)$/i;
let total = 0;
const slugs = new Set(cat.modelos.map(m => m.slug));
for (const m of cat.modelos) {
  const dir = new URL(`fotos/${m.slug}/`, raiz);
  m.fotos = existsSync(dir)
    ? readdirSync(dir).filter(f => IMG.test(f) && !/^c(\d+|-[0-9a-f]{8})\./.test(f)).sort((a, b) => a.localeCompare(b, undefined, { numeric: true })).map(f => `fotos/${m.slug}/${f}?v=${huella(new URL(f, dir))}`)
    : [];
  total += m.fotos.length;
}
const fotosDir = new URL("fotos/", raiz);
if (existsSync(fotosDir)) for (const d of readdirSync(fotosDir))
  if (statSync(new URL(d, fotosDir)).isDirectory() && !slugs.has(d)) console.warn(`Ojo: la carpeta fotos/${d} no coincide con ningún modelo.`);
writeFileSync(archivo, JSON.stringify(cat, null, 1) + "\n");
/* lo mismo para las fotos de cada color */
const arcCol = new URL("data/colores.json", raiz);
if (existsSync(arcCol)) {
  const col = JSON.parse(readFileSync(arcCol, "utf8"));
  for (const vs of Object.values(col)) for (const v of Array.isArray(vs) ? vs : []) {
    const f = String(v.foto || "").split("?")[0], ruta = new URL(f, raiz);
    if (f && existsSync(ruta)) v.foto = `${f}?v=${huella(ruta)}`;
  }
  writeFileSync(arcCol, JSON.stringify(col) + "\n");
}
console.log(`Fotos: ${total} en ${cat.modelos.filter(m => m.fotos.length).length} modelos.`);
