// Barrido del recomendador: todas las combinaciones de respuestas cerradas (sin zapa actual) contra el catálogo de hoy.
// Verifica que ninguna zapa lleve un sello de "cumple todo" si no lo cumple:
//   1) "La mejor", "La que más conviene", "Otra muy buena opción", el paso siguiente y "Para entrenar": dentro del peso que la ficha recomienda;
//   2) esas mismas, dentro del presupuesto; las que se pasan solo como "Si estirás el presupuesto";
//   3) si existe alguna que cumple todo dentro del tope, la primera es una de esas;
//   6) ningún sello si la horma choca con el ancho de pie declarado (van como "Sujeta a probar el calce");
//   4) las que no cumplen algo dicen qué les falta; 5) no se describe una placa antirrocas como placa para ir rápido.
//   node scripts/barrer-recomendador.mjs
import { readFileSync } from "node:fs";
import { recomendar, PREGUNTAS, aplica, pesoApto, calceDuda } from "../src/recomendador.js";
const cat = JSON.parse(readFileSync(new URL("../public/data/modelos.json", import.meta.url), "utf8"));
const DATA = cat.modelos.filter(d => !d.borrador).map(d => ({ ...d, todas: (d.tiendas || []).filter(t => !t.sinStock) }));
const SELLOS = /^(La mejor para vos|La que más conviene por precio|Otra muy buena opción|Para dar un paso más|Para el día de la carrera|Para entrenar)$/;
const ops = (q, r) => q.k === "talle" ? ["", "38", "42", "45"] : q.k === "actual" ? [""] : (q.k === "uso" && r.terreno === "Trail" ? q.trail : q.ops).map(o => o[0]);
let n = 0, fallas = {}, ej = {}, sinPlena = 0, conEstirar = 0, conReserva = 0, menos3 = 0;
const falla = (k, r, txt) => { fallas[k] = (fallas[k] || 0) + 1; ej[k] ??= JSON.stringify(r) + " → " + txt; };
(function rec(i, r) {
  if (i === PREGUNTAS.length) {
    n++; const res = recomendar(DATA, r), tope = +r.tope || Infinity;
    if (res.sinPlena) sinPlena++; if (res.picks.length < 3) menos3++;
    if (res.picks.some(p => p.etiqueta === "Si estirás el presupuesto")) conEstirar++;
    if (res.picks.some(p => /reservas|cercana|calce/.test(p.etiqueta))) conReserva++;
    for (const [j, p] of res.picks.entries()) {
      const sello = SELLOS.test(p.etiqueta), nom = `${p.etiqueta}: ${p.d.slug} ${p.t.precio}`;
      if (sello && !pesoApto(p.d, r.kg)) falla("1 sello con peso fuera de rango", r, nom);
      if (sello && calceDuda(p.d, r.pie)) falla("6 sello con horma que choca con el pie", r, nom);
      if (sello && p.t.precio > tope) falla("2 sello fuera de presupuesto", r, nom);
      if (p.t.precio > tope && !/^Si /.test(p.etiqueta) && !res.sinPlena && !res.sinCoincidencia) falla("2b fuera de tope sin marcar", r, nom);
      if (!sello && !res.sinCoincidencia && !p.falta) falla("4 sin decir qué le falta", r, nom);
      if (j === 0 && /^La mejor/.test(p.etiqueta) && p.contras.some(c => /le falta espuma|Poca espuma para tu peso/.test(c))) falla("1b mejor con contra de peso", r, nom);
      if (/roca/i.test(p.d.pl || "") && [...p.pros, ...p.contras].some(t => /placa/i.test(t) && /impuls|rápido|ritmo/i.test(t))) falla("5 antirrocas como velocidad", r, nom);
    }
    if (!res.sinCoincidencia && res.picks.length && !/^La mejor/.test(res.picks[0].etiqueta) && !res.sinPlena) falla("3 primera sin sello y sin aviso", r, res.picks[0].etiqueta);
    if (res.sinPlena && res.picks.some(p => SELLOS.test(p.etiqueta))) falla("3b sin plena pero con sello", r, "");
    if (!res.picks.length) falla("0 sin resultados", r, "");
    return;
  }
  const q = PREGUNTAS[i]; if (!aplica(q, r)) return rec(i + 1, r);
  for (const v of ops(q, r)) rec(i + 1, { ...r, [q.k]: v });
})(0, {});
console.log(`${n} combinaciones · sin ninguna que cumpla todo: ${sinPlena} · con "si estirás": ${conEstirar} · con reservas: ${conReserva} · con menos de 3: ${menos3}`);
console.log(Object.keys(fallas).length ? Object.entries(fallas).sort().map(([k, v]) => `✗ ${k}: ${v}\n    ${ej[k]}`).join("\n") : "✓ sin fallas");
process.exitCode = Object.keys(fallas).length ? 1 : 0;
