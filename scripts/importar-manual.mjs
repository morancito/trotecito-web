// Importa los archivos subidos a datos-manuales/ (los baja el marcador desde nike.com.ar y adidas.com.ar)
// con el importador de cada tienda, y los borra. Lo corre el workflow importar-manual.yml al subir un archivo.
//   node scripts/importar-manual.mjs
import { readdirSync, readFileSync, unlinkSync } from "node:fs";
import { execFileSync } from "node:child_process";

const DIR = new URL("../datos-manuales/", import.meta.url);
const archivos = readdirSync(DIR).filter(f => /\.json$/i.test(f));
if (!archivos.length) { console.log("No hay archivos para importar."); process.exit(0); }
let ok = 0;
for (const f of archivos) {
  const ruta = new URL(f, DIR).pathname;
  let tipo = null;
  try {
    const j = JSON.parse(readFileSync(ruta, "utf8"));
    if (["vtex", "html", "lista"].includes(j.plataforma)) tipo = "tienda";
    else if (j.tienda === "nike" || (Array.isArray(j) && j[0]?.productId && j[0]?.items)) tipo = "nike";
    else if (j.tienda === "adidas" || j.items || j.productos) tipo = "adidas";
  } catch (e) { console.warn(`✗ ${f}: no es un JSON válido (${e.message})`); }
  if (!tipo) { console.warn(`✗ ${f}: no reconozco de qué tienda es; lo dejo para revisar.`); continue; }
  console.log(`\n== ${f} (${tipo})`);
  execFileSync(process.execPath, [new URL(`./importar-${tipo}.mjs`, import.meta.url).pathname, ruta], { stdio: "inherit" });
  unlinkSync(ruta); ok++;
}
console.log(`\n${ok} archivo(s) importados.`);
