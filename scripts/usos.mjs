// Para qué sirve cada zapa: además del uso principal (d.uso), los otros usos en los que rinde bien (d.usos).
// Una zapa puede servir para varias cosas: una Kayano es de fondos largos pero también se usa para entrenar todos los días.
// Las reglas parten de los datos de la ficha; lo que se ajusta a mano va en A_MANO y gana sobre las reglas.
//   node scripts/usos.mjs            -> muestra cómo quedaría
//   node scripts/usos.mjs --guardar  -> lo guarda en modelos.json
import { readFileSync, writeFileSync } from "node:fs";
const P = new URL("../public/data/modelos.json", import.meta.url);
const cat = JSON.parse(readFileSync(P, "utf8"));
const carbono = d => /carbono|varilla|pebax|energyrod/i.test(d.pl || "");
const placa = d => carbono(d) || /nylon|speedboard|placa/i.test(d.pl || "") && !/sin placa/i.test(d.pl || "");
const principiante = d => /principiante|todos/i.test(d.corredor?.nivel || "");
/* ajustes a mano: slug -> usos completos (el primero es el principal) */
const A_MANO = {
  "saucony-kinvara-14": ["Ritmo", "Rodaje diario"],   // liviana pero muy usada para entrenar todos los días
};
function usosDe(d) {
  if (A_MANO[d.slug]) return A_MANO[d.slug];
  const u = new Set([d.uso]);
  if (d.uso === "Iniciación") u.add("Rodaje diario");
  if (d.uso === "Rodaje diario") {
    if (d.talon >= 36) u.add("Rodaje largo");
    if (!placa(d) && d.talon >= 32 && principiante(d)) u.add("Iniciación");
    if (d.peso && d.peso <= 245) u.add("Ritmo");
  }
  if (d.uso === "Rodaje largo") {
    if (!d.peso || d.peso <= 330) u.add("Rodaje diario");
    if (!placa(d) && principiante(d) && (!d.peso || d.peso <= 320)) u.add("Iniciación");
  }
  if (d.uso === "Ritmo") {
    if (placa(d)) u.add("Competencia");
    if (!carbono(d) && (d.talon || 0) >= 32) u.add("Rodaje diario");
  }
  if (d.uso === "Competencia") u.add("Ritmo");
  return [...u];
}
for (const d of cat.modelos) {
  const u = usosDe(d);
  console.log(`${d.slug.padEnd(38)} ${u.join(" · ")}${d.peso ? ` (${d.peso} g, ${d.talon} mm${d.pl ? ", " + d.pl : ""})` : ""}`);
  if (process.argv.includes("--guardar")) d.usos = u;
}
if (process.argv.includes("--guardar")) writeFileSync(P, JSON.stringify(cat, null, 1) + "\n");
