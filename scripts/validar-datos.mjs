// Revisa public/data/modelos.json antes de publicar. Si encuentra un error, corta el build.
import { readFileSync } from "node:fs";

const PISADAS = ["Neutra", "Estabilidad", ""];
const USOS = ["Iniciación", "Rodaje diario", "Rodaje largo", "Ritmo", "Competencia"];
const errores = [];
let cat;
try {
  cat = JSON.parse(readFileSync(new URL("../public/data/modelos.json", import.meta.url), "utf8"));
} catch (e) {
  console.error("modelos.json no es un JSON válido:", e.message);
  process.exit(1);
}
const ids = new Set();
for (const m of cat.modelos) {
  const n = `#${m.id} ${m.m} ${m.mod} ${m.ver}`.trim();
  if (!Number.isInteger(m.id) || ids.has(m.id)) errores.push(`${n}: id repetido o inválido`);
  ids.add(m.id);
  if (!m.m || !m.mod) errores.push(`${n}: falta marca o modelo`);
  if (!PISADAS.includes(m.tipo)) errores.push(`${n}: tipo "${m.tipo}" no válido (Neutra, Estabilidad o vacío)`);
  if (!USOS.includes(m.uso)) errores.push(`${n}: uso "${m.uso}" no válido`);
  for (const k of ["peso", "drop", "talon", "ante"])
    if (m[k] != null && (typeof m[k] !== "number" || m[k] < 0)) errores.push(`${n}: ${k} tiene que ser un número`);
  if (m.talon && m.ante && Math.abs(m.talon - m.ante - (m.drop ?? m.talon - m.ante)) > 1)
    errores.push(`${n}: talón − antepié no coincide con el drop`);
  for (const t of m.tiendas || []) {
    if (!t.tienda) errores.push(`${n}: tienda sin nombre`);
    if (typeof t.precio !== "number" || t.precio <= 0) errores.push(`${n} / ${t.tienda}: precio inválido`);
    if (!/^https:\/\//.test(t.url || "")) errores.push(`${n} / ${t.tienda}: falta el link https a la tienda`);
    if (!/^\d{2}\/\d{2}\/\d{4}$/.test(t.fecha || "")) errores.push(`${n} / ${t.tienda}: fecha con formato dd/mm/aaaa`);
  }
}
if (errores.length) {
  console.error(`Encontré ${errores.length} problema(s) en modelos.json:\n- ` + errores.join("\n- "));
  process.exit(1);
}
console.log(`modelos.json OK: ${cat.modelos.length} modelos, ${cat.modelos.reduce((a, m) => a + (m.tiendas?.length || 0), 0)} precios.`);
