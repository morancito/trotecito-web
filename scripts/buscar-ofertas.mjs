// Busca en tiendas nuevas los modelos del catálogo y anota precio, cuotas y talles con stock.
// No toca modelos.json: deja los hallazgos en scripts/ofertas-encontradas.json para revisarlos antes de sumarlos.
//   node scripts/buscar-ofertas.mjs                 -> todas las tiendas de la lista
//   node scripts/buscar-ofertas.mjs Moov Gostore    -> solo esas
// Lo corre a mano el workflow "Buscar ofertas" (pestaña Actions).
import { readFileSync, writeFileSync } from "node:fs";
import { leer, dormir } from "./tiendas.mjs";
import { TIENDAS, pausaDe, conReintento, coincide, generoDe, plataforma, buscar, pista } from "./buscar-lib.mjs";

const cat = JSON.parse(readFileSync(new URL("../public/data/modelos.json", import.meta.url), "utf8"));
/* --borradores: busca solo los modelos nuevos (en borrador). Sin nombres de tienda: todas, salvo las que ya están cargadas a mano (Dexter, Sporting) */
const soloBorradores = process.argv.includes("--borradores");
const elegidas = process.argv.slice(2).filter(x => !x.startsWith("--")).map(x => x.toLowerCase());
const modelos = cat.modelos.filter(m => !soloBorradores || m.borrador);

const corridas = TIENDAS.filter(t => elegidas.length ? elegidas.some(x => t.nombre.toLowerCase().startsWith(x)) : soloBorradores || !["Dexter", "Sporting"].includes(t.nombre));
/* se conserva lo encontrado antes en las tiendas que no se corren esta vez */
const ARCH = new URL("./ofertas-encontradas.json", import.meta.url);
let previo = { tiendas: {}, resultados: [] }; try { previo = JSON.parse(readFileSync(ARCH, "utf8")); } catch {}
const nombres = new Set(corridas.map(t => t.nombre));
const nuevos = new Set(modelos.map(m => m.slug));
const salida = { fecha: new Date().toISOString(), tiendas: Object.fromEntries(Object.entries(previo.tiendas).filter(([k]) => !nombres.has(k))), resultados: previo.resultados.filter(r => !nombres.has(r.tienda) || !nuevos.has(r.slug)) };
for (const ti of corridas) {
  let tipo;
  try { tipo = await plataforma(ti.url); } catch (e) { salida.tiendas[ti.nombre] = { error: "no abre: " + e.message }; console.warn(`✗ ${ti.nombre}: ${e.message}`); continue; }
  salida.tiendas[ti.nombre] = { tipo, pista, buscados: 0, encontrados: 0, errores: [] };
  const pausa = pausaDe(ti.url);
  console.log(`\n== ${ti.nombre} (${tipo})`);
  if (tipo === "desconocida") continue;
  for (const m of modelos) {
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
writeFileSync(ARCH, JSON.stringify(salida, null, 1) + "\n");
console.log(`\nListo: ${salida.resultados.length} ofertas encontradas.`);
