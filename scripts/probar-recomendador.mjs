// Banco de pruebas del recomendador: perfiles de corredor y lo que recomiendan las guías especializadas para cada uno
// (RunRepeat, Running Warehouse, Fleet Feet, Believe in the Run, Correr Juntos; noviembre 2026), llevado a los modelos
// de nuestro catálogo. Para cada perfil mira el top 5 del puntaje (sin mirar precio ni stock) y las 3 recomendaciones
// reales (con precio, talle y presupuesto), y marca:
//   ✓ recomendada por las guías   · neutral   ✗ mala para ese perfil
//   node scripts/probar-recomendador.mjs [--detalle]
import { readFileSync } from "node:fs";
import { recomendar, puntaje } from "../src/recomendador.js";

const cat = JSON.parse(readFileSync(new URL("../public/data/modelos.json", import.meta.url), "utf8"));
const DATA = cat.modelos.filter(d => !d.borrador).map(d => ({ ...d, todas: (d.tiendas || []).filter(t => !t.sinStock) }));
const detalle = process.argv.includes("--detalle");

/* buenas: lo que recomiendan las guías (o versiones de esos modelos). malas: lo que no le conviene a ese perfil */
const PERFILES = [
  { n: "Empieza a correr, 70 kg, neutra", r: { gen: "Hombre", talle: "42", terreno: "Asfalto", uso: "Iniciación", ritmo: "r4", kg: 70, pis: "Neutra", tope: 250000 },
    buenas: ["nike-pegasus-41", "nike-pegasus-42", "hoka-clifton-10", "brooks-ghost-15", "asics-gel-cumulus-27", "adidas-supernova-rise-3", "puma-velocity-nitro-4", "puma-velocity-nitro-5", "on-cloudrunner-3", "new-balance-fresh-foam-x-880-v15", "nike-winflo-12", "nike-revolution-8", "asics-gel-nimbus-27", "new-balance-fresh-foam-x-1080-v14", "asics-gel-excite-11", "nike-winflo-11"],
    malas: /competencia|kinvara|hyperion|takumi|adios-pro|vaporfly|metaspeed|sc-elite|endorphin-(pro|elite)/ },
  { n: "Empieza a correr, 95 kg, neutra", r: { gen: "Hombre", talle: "43", terreno: "Asfalto", uso: "Iniciación", ritmo: "r4", kg: 95, pis: "Neutra", tope: 350000 },
    buenas: ["hoka-bondi-9", "saucony-triumph-22", "asics-gel-nimbus-27", "nike-vomero-plus", "brooks-glycerin-20", "new-balance-fresh-foam-x-880-v15", "new-balance-fresh-foam-x-1080-v14", "adidas-supernova-rise-3", "nike-vomero-18", "hoka-clifton-10", "adidas-adistar-5", "puma-magmax-nitro-2"],
    malas: /kinvara|hyperion|takumi|adios-pro|vaporfly|metaspeed|sc-elite|endorphin|revolution|duramo|launch/ },
  { n: "Pronador, 80 kg, entrena todos los días", r: { gen: "Hombre", talle: "42", terreno: "Asfalto", uso: "Rodaje diario", ritmo: "r2", kg: 80, pis: "Pronadora", tope: 400000 },
    buenas: ["brooks-adrenaline-gts-23", "asics-gt-2000-14", "nike-structure-26", "nike-structure-plus", "saucony-guide-18", "hoka-arahi-8", "asics-gel-kayano-32", "saucony-hurricane-25", "adidas-ultraboost-5", "hoka-gaviota-6", "puma-foreverrun-nitro-2", "on-cloudrunner-3"],
    malas: /vaporfly|adios-pro|metaspeed|sc-elite|endorphin|takumi|kinvara|hyperion/ },
  { n: "Neutra, 75 kg, entrena todos los días", r: { gen: "Hombre", talle: "42", terreno: "Asfalto", uso: "Rodaje diario", ritmo: "r2", kg: 75, pis: "Neutra", tope: 400000 },
    buenas: ["brooks-ghost-15", "nike-pegasus-41", "nike-pegasus-42", "asics-novablast-5", "asics-gel-cumulus-27", "hoka-clifton-10", "new-balance-fresh-foam-x-880-v15", "new-balance-fuelcell-rebel-v5", "hoka-mach-7", "nike-vomero-18", "nike-vomero-plus", "adidas-supernova-rise-3", "puma-velocity-nitro-5", "on-cloudsurfer-next", "saucony-triumph-22", "asics-gel-nimbus-27"],
    malas: /structure|kayano|adrenaline|gt-2000|guide|arahi|gaviota|hurricane|vaporfly|adios-pro|metaspeed|sc-elite/ },
  { n: "Fondos largos, 70 kg, neutra", r: { gen: "Hombre", talle: "42", terreno: "Asfalto", uso: "Rodaje largo", ritmo: "r2", kg: 70, pis: "Neutra", tope: 450000 },
    buenas: ["asics-gel-nimbus-27", "nike-vomero-plus", "nike-vomero-18", "new-balance-fresh-foam-x-1080-v14", "saucony-triumph-22", "hoka-bondi-9", "asics-superblast-2", "hoka-clifton-10", "brooks-glycerin-20", "puma-magmax-nitro-2", "adidas-adistar-5", "on-cloudmonster-3", "nike-invincible-3"],
    malas: /vaporfly|adios-pro|metaspeed|sc-elite|takumi|kinvara|hyperion|revolution|duramo/ },
  { n: "Series y ritmos, 65 kg, rápido", r: { gen: "Hombre", talle: "42", terreno: "Asfalto", uso: "Ritmo", ritmo: "r1", kg: 65, pis: "Neutra", tope: 450000 },
    buenas: ["saucony-endorphin-speed-5", "saucony-endorphin-speed-4", "puma-deviate-nitro-4", "adidas-adizero-boston-13", "adidas-adizero-evo-sl", "hoka-mach-7", "new-balance-fuelcell-rebel-v5", "asics-superblast-2", "brooks-launch-10", "nike-zoom-fly-5", "asics-magic-speed-4", "adidas-adizero-sl-2", "nike-pegasus-plus", "hoka-mach-x-3"],
    malas: /bondi|kayano|glycerin|vomero-premium|magmax|revolution|duramo|excite|quest/ },
  { n: "Competir en maratón, 70 kg, rápido", r: { gen: "Hombre", talle: "42", terreno: "Asfalto", uso: "Competencia", ritmo: "r1", kg: 70, pis: "Neutra", tope: 600000 },
    buenas: ["nike-vaporfly-4", "adidas-adizero-adios-pro-5", "saucony-endorphin-elite-2", "saucony-endorphin-pro-5", "asics-metaspeed-sky", "new-balance-fuelcell-sc-elite-v5", "puma-deviate-nitro-4", "saucony-endorphin-speed-5", "asics-magic-speed-4"],
    malas: /bondi|kayano|glycerin|vomero|magmax|revolution|duramo|excite|quest|clifton|nimbus/ },
  { n: "Pronador, 95 kg, fondos tranquilos", r: { gen: "Hombre", talle: "44", terreno: "Asfalto", uso: "Rodaje largo", ritmo: "r3", kg: 95, pis: "Pronadora", tope: 450000 },
    buenas: ["asics-gel-kayano-32", "saucony-hurricane-25", "brooks-adrenaline-gts-23", "hoka-arahi-8", "hoka-gaviota-6", "nike-structure-plus", "adidas-ultraboost-5", "asics-gt-2000-14"],
    malas: /vaporfly|adios-pro|metaspeed|sc-elite|endorphin|takumi|kinvara|hyperion|revolution|duramo/ },
  { n: "Trail, empieza, 75 kg", r: { gen: "Hombre", talle: "42", terreno: "Trail", uso: "Iniciación", ritmo: "r3", kg: 75, pis: "Neutra", tope: 350000 },
    buenas: ["nike-pegasus-trail-5-gtx", "hoka-challenger-atr-8", "hoka-speedgoat-6", "saucony-peregrine-15", "saucony-peregrine-16", "asics-gel-trabuco-13", "salomon-ultra-glide-4", "salomon-genesis-2", "nike-acg-pegasus-trail", "hoka-torrent-4", "adidas-terrex-agravic-4"],
    malas: /slab-pulsar|prodigio-pro|kiger/ },
  { n: "Trail, fondos y ultra, 70 kg", r: { gen: "Hombre", talle: "42", terreno: "Trail", uso: "Rodaje largo", ritmo: "r2", kg: 70, pis: "Neutra", tope: 450000 },
    buenas: ["hoka-speedgoat-6", "salomon-ultra-glide-4", "la-sportiva-prodigio-max", "hoka-mafate-5", "saucony-xodus-ultra-4", "on-cloudultra-3", "nike-zegama-2", "asics-gel-trabuco-13", "hoka-challenger-atr-8"],
    malas: /slab-pulsar|kiger|torrent/ },
  { n: "Pie ancho, 80 kg, neutra, todos los días", r: { gen: "Hombre", talle: "42", terreno: "Asfalto", uso: "Rodaje diario", ritmo: "r2", kg: 80, pis: "Neutra", pie: "ancho", tope: 400000 },
    buenas: ["new-balance-fresh-foam-x-880-v15", "hoka-bondi-9", "brooks-ghost-15", "brooks-glycerin-20", "on-cloudflyer-5", "adidas-ultraboost-5", "nike-winflo-12", "asics-gel-nimbus-27", "saucony-triumph-22", "on-cloudsurfer-next", "hoka-clifton-10"],
    malas: /vaporfly|adios-pro|metaspeed|sc-elite|takumi|kinvara/ },
  { n: "Mujer, empieza, 60 kg, presupuesto ajustado", r: { gen: "Mujer", talle: "38", terreno: "Asfalto", uso: "Iniciación", ritmo: "r4", kg: 60, pis: "Neutra", tope: 160000 },
    buenas: ["nike-revolution-8", "adidas-duramo-sl-2", "nike-winflo-11", "nike-winflo-12", "asics-gel-excite-11", "nike-quest-6", "adidas-supernova-stride-2", "puma-velocity-nitro-4", "puma-velocity-nitro-5", "asics-gt-1000-14", "saucony-surge-3", "brooks-ghost-15", "nike-pegasus-41"],
    malas: /vaporfly|adios-pro|metaspeed|sc-elite|takumi|endorphin|kinvara|hyperion/ },
];

const marca = (p, s) => p.buenas.includes(s) ? "✓" : p.malas.test(s) ? "✗" : "·";
let totTop = 0, okTop = 0, malasTop = 0, okPicks = 0, malasPicks = 0, totPicks = 0;
for (const p of PERFILES) {
  const conPrecio = DATA.filter(d => (d.terreno || "Asfalto") === p.r.terreno && d.todas.length);
  const top = conPrecio.map(d => ({ d, s: puntaje(d, p.r).s })).sort((a, b) => b.s - a.s).slice(0, 5);
  const picks = recomendar(DATA, p.r).picks;
  totTop += top.length; okTop += top.filter(x => p.buenas.includes(x.d.slug)).length; malasTop += top.filter(x => p.malas.test(x.d.slug)).length;
  totPicks += picks.length; okPicks += picks.filter(x => p.buenas.includes(x.d.slug)).length; malasPicks += picks.filter(x => p.malas.test(x.d.slug)).length;
  console.log(`\n## ${p.n}`);
  console.log(`  top 5:  ${top.map(x => `${marca(p, x.d.slug)} ${x.d.slug} (${Math.round(x.s)})`).join("  ")}`);
  console.log(`  elige:  ${picks.map(x => `${marca(p, x.d.slug)} ${x.d.slug}`).join("  ")}`);
  if (detalle) for (const x of picks) console.log(`     ${x.d.slug}: + ${x.pros.slice(0, 3).join(" / ")}  − ${x.contras.slice(0, 2).join(" / ")}`);
}
console.log(`\nTop 5 (sin precio): ${okTop}/${totTop} recomendadas por las guías, ${malasTop} malas.`);
console.log(`Elegidas (con precio y stock): ${okPicks}/${totPicks} recomendadas por las guías, ${malasPicks} malas.`);
