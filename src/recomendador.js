/* Recomendador: puntúa cada zapa según el perfil del corredor y elige tres, con el porqué.
   Es una función pura (no toca el DOM) para poder probarla con los datos reales. */
import { dist, familia, versionDe } from "./reemplazo.js";

export const PREGUNTAS = [
  { k: "gen", t: "¿Qué talles buscás?", ops: [["Hombre", "Hombre"], ["Mujer", "Mujer"]] },
  { k: "talle", t: "¿Qué talle usás?", sub: "El de tus zapatillas de correr, que suele ser medio o un número más que el de calle. Lo usamos para mostrarte solo tiendas con ese talle; no te recomendamos otro.", grid: true, ops: [...Array.from({ length: 27 }, (_, i) => String(34 + i / 2).replace(/\.0$/, "")).map(x => [x, x]), ["", "No sé, mostrame todo"]] },
  { k: "terreno", t: "¿Dónde corrés?", ops: [["Asfalto", "Calle, pista o cinta"], ["Trail", "Senderos y montaña"]] },
  { k: "uso", t: "¿Para qué la vas a usar más?", ops: [["Iniciación", "Estoy empezando"], ["Rodaje diario", "Entrenar casi todos los días"], ["Rodaje largo", "Fondos largos"], ["Ritmo", "Series y ritmos rápidos"], ["Competencia", "Competir"]],
    trail: [["Rodaje diario", "Salidas cortas y medias"], ["Rodaje largo", "Fondos largos y ultras"], ["Ritmo", "Carreras rápidas"]] },
  { k: "ritmo", t: "¿A qué ritmo corrés normalmente?", ops: [["r1", "Más rápido que 5:00 min/km"], ["r2", "Entre 5:00 y 6:00 min/km"], ["r3", "Entre 6:00 y 7:00 min/km"], ["r4", "Más lento, o no sé"]] },
  { k: "kg", t: "¿Cuánto pesás?", ops: [[60, "Menos de 65 kg"], [70, "65 a 75 kg"], [82, "75 a 90 kg"], [95, "Más de 90 kg"]] },
  { k: "pis", t: "¿Cómo pisás?", ops: [["Neutra", "Neutra"], ["Pronadora", "Pronadora: el pie se va hacia adentro"], ["Supinadora", "Supinadora: el pie se va hacia afuera"], ["nose", "No sé"]] },
  { k: "pie", t: "¿Cómo es tu pie?", sub: "Hablamos del ancho, no del largo: con esto elegimos hormas que te calcen, sin tocar el talle que pusiste.", ops: [["normal", "Normal"], ["ancho", "Ancho: las zapas suelen apretarme a los costados"], ["angosto", "Angosto: me suelen quedar flojas"], ["nose", "No sé"]] },
  /* "slug|gusto|cómo la escribió": la zapa que usa hoy y qué le parece; vacío si no usa o no quiere decir */
  { k: "actual", t: "¿Con qué zapas corrés hoy?", tipo: "modelo", ops: [] },
  { k: "tope", t: "¿Hasta cuánto querés gastar?", ops: [[150000, "Hasta $150 mil"], [250000, "Hasta $250 mil"], [350000, "Hasta $350 mil"], [0, "Sin límite"]] },
];

const USO_TXT = { "Iniciación": "empezar a correr", "Rodaje diario": "entrenar todos los días", "Rodaje largo": "fondos largos", "Ritmo": "series y ritmos rápidos", "Competencia": "competir" };
/* afinidad entre lo que busca el corredor (fila) y para qué está hecha la zapa (columna) */
const AF = {
  "Iniciación": { "Iniciación": 30, "Rodaje diario": 24, "Rodaje largo": 14, "Ritmo": 0, "Competencia": -30 },
  "Rodaje diario": { "Rodaje diario": 30, "Rodaje largo": 20, "Iniciación": 16, "Ritmo": 10, "Competencia": -20 },
  "Rodaje largo": { "Rodaje largo": 30, "Rodaje diario": 20, "Ritmo": 6, "Iniciación": 4, "Competencia": -15 },
  "Ritmo": { "Ritmo": 30, "Competencia": 16, "Rodaje diario": 8, "Rodaje largo": 0, "Iniciación": -10 },
  "Competencia": { "Competencia": 30, "Ritmo": 18, "Rodaje diario": -10, "Rodaje largo": -10, "Iniciación": -20 },
};
/* el paso siguiente según lo que busca */
const SIGUE = { "Iniciación": ["Rodaje diario", "Para dar un paso más", "Para cuando corras más seguido"], "Rodaje diario": ["Ritmo", "Para dar un paso más", "Para sumar series y ritmos"],
  "Rodaje largo": ["Ritmo", "Para dar un paso más", "Para sumar ritmos en la semana"], "Ritmo": ["Competencia", "Para el día de la carrera", "Cuando quieras ir por tu mejor marca"],
  "Competencia": ["Ritmo", "Para entrenar", "La compañera para las series y los ritmos"] };
const ORDEN = ["La mejor para vos", "La que más conviene por precio", "Otra muy buena opción"];

const fmt = n => "$" + Math.round(n).toLocaleString("es-AR");
/* rango de peso del corredor para el que se recomienda: "Hasta 85 kg", "Más de 70 kg", "Entre 70 y 100 kg", "Cualquier peso..." */
export const rangoKg = d => {
  const p = d.corredor?.peso || "", n = (p.match(/\d+/g) || []).map(Number);
  if (/^cualquier/i.test(p) || !n.length) return { min: 0, max: 999 };
  if (/^entre/i.test(p)) return { min: n[0], max: n[1] ?? 999 };
  if (/^m[aá]s de/i.test(p)) return { min: n[0], max: 999 };
  return { min: 0, max: n[0] };
};
export const capacidadKg = d => rangoKg(d).max;
const placa = d => !!d.pl && /carbono|nylon|varilla|speedboard/i.test(d.pl);

/* precio más bajo para el género pedido (Unisex y sin dato valen para los dos) */
/* talle: true = la tienda lo tiene, false = no, null = no lo pudimos confirmar */
export const tieneTalle = (t, talle) => !talle ? null : t.sistema === "AR" && t.talles ? t.talles.includes(talle) : null;
export function precioPara(d, gen, talle = "") {
  const t = (d.todas || d.tiendas || []).filter(x => (!gen || !x.nota || x.nota === "Unisex" || x.nota === gen) && tieneTalle(x, talle) !== false)
    .sort((a, b) => (tieneTalle(b, talle) === true) - (tieneTalle(a, talle) === true) || a.precio - b.precio)[0];
  return t || null;
}

export function puntaje(d, r, usoBuscado = r.uso) {
  let s = 0; const pros = [], contras = [];
  const add = (v, txt, peso = Math.abs(v)) => { s += v; if (txt) (v >= 0 ? pros : contras).push([peso, txt]); };
  /* uso */
  /* una zapa sirve para varias cosas (d.usos): el uso principal suma lo máximo y los otros casi lo mismo */
  const usos = d.usos?.length ? d.usos : [d.uso];
  const af = AF[usoBuscado]?.[d.uso] ?? 0;
  if (d.uso === usoBuscado) add(af, `Está pensada para ${USO_TXT[usoBuscado]}`);
  else if (usos.includes(usoBuscado)) add(27, `También va muy bien para ${USO_TXT[usoBuscado]}`, 21);
  else if (af >= 14) add(af, `También rinde para ${USO_TXT[usoBuscado]}`, af - 6);
  else if (af < 0) add(af, `Está hecha para ${USO_TXT[d.uso]}, no para ${USO_TXT[usoBuscado]}`);
  else add(af);
  /* pisada */
  const est = d.tipo === "Estabilidad";
  if (r.pis === "Pronadora") { if (est) add(22, "Tiene estabilidad para pronadores"); else add(d.talon >= 38 ? -10 : -18, "Es neutra: si pronás mucho, puede faltarte soporte"); }
  else if (r.pis === "Neutra") { if (est) add(-12, "Trae soporte para pronadores que no necesitás"); else add(8, "Es neutra, como tu pisada", 4); }
  else if (r.pis === "Supinadora") { if (est) add(-16, "Trae soporte para pronadores, que no es lo que te conviene"); else if (d.talon >= 36) add(14, "Neutra y con buena espuma, lo que conviene si supinás"); else add(6); }
  else { if (est) add(-4); else add(4, "Es neutra: la opción más segura si no sabés cómo pisás", 4); }
  /* peso del corredor */
  const { min, max } = rangoKg(d), pTxt = (d.corredor?.peso || "").toLowerCase();
  if (r.kg > max) add(-20, `Para tu peso le falta espuma: la recomendamos ${pTxt}`);
  else if (r.kg < min - 3) add(-8, `Está pensada para corredores más pesados: la recomendamos ${pTxt}`);
  else add(0, max >= 999 && !min ? "Sirve para cualquier peso" : `Va bien con tu peso: la recomendamos ${pTxt}`, 2);
  if (r.kg >= 90 && d.talon >= 40) add(10, `${d.talon} mm de espuma en el talón: protege más con tu peso`);
  else if (r.kg >= 90 && d.talon && d.talon < 34) add(-10, "Poca espuma para tu peso");
  if (r.kg <= 70 && d.peso && d.peso <= 240) add(6, `Liviana: ${d.peso} g`);
  /* para entrenar y hacer fondos, a igualdad de lo demás, un poco más de espuma suma (más aún con más peso) */
  if (d.talon && ["Rodaje diario", "Rodaje largo", "Iniciación"].includes(usoBuscado)) {
    add(Math.max(-3, Math.min(4, (d.talon - 36) / 2)));
    if (r.kg >= 78 && r.kg < 90 && d.talon >= 38) add(4, `${d.talon} mm de espuma: buena protección para tu peso`);
  }
  /* ritmo */
  const lento = r.ritmo === "r3" || r.ritmo === "r4";
  if (r.ritmo === "r1") {
    if (d.peso && d.peso <= 240 && !pros.some(p => /Liviana/.test(p[1]))) add(8, `Liviana: ${d.peso} g, ideal para tu ritmo`);
    if (d.peso >= 300) add(-8, `Pesa ${d.peso} g: se siente pesada a ritmos rápidos`);
    if (placa(d) && (usoBuscado === "Ritmo" || usoBuscado === "Competencia")) add(8, `Tiene placa (${d.pl.toLowerCase()}) que te impulsa a tu ritmo`);
  }
  if (lento) {
    if (d.uso === "Competencia") add(-20, "Está hecha para ir muy rápido: a tu ritmo no la vas a aprovechar");
    else if (placa(d)) add(-10, "La placa rinde a ritmos rápidos; a tu ritmo suma poco");
    if (d.talon >= 36) add(6, `${d.talon} mm de espuma: cómoda a ritmo tranquilo`);
  }
  if (r.uso === "Iniciación" && d.talon && d.talon < 32) add(-8, "Poca espuma para alguien que recién empieza");
  if (d.talon && !pros.some(p => /mm de espuma/.test(p[1])) && usoBuscado !== "Competencia" && usoBuscado !== "Ritmo") add(0, `${d.talon} mm de espuma en el talón (${d.talon >= 38 ? "mucha" : d.talon >= 33 ? "intermedia" : "poca"})`, 1);
  /* horma */
  if (r.pie === "ancho") { if (d.horma === "ancha") add(8, "Horma ancha: cómoda si tenés el pie ancho, sin subir de talle"); else if (d.horma === "angosta") add(-10, "Horma angosta: con pie ancho puede apretarte. Probala en tu talle antes de pensar en subir medio número"); else if (d.horma === "punta") add(-7, "Punta angosta: con pie ancho puede apretarte los dedos. Probala antes"); }
  if (r.pie === "angosto") { if (d.horma === "angosta") add(6, "Horma angosta: calza firme en un pie angosto"); else if (d.horma === "ancha") add(-6, "Horma ancha: con pie angosto puede quedarte floja"); }
  /* las zapas que usa hoy */
  const ref = r._ref, gusto = r._gusto, cual = r._cual || (ref && `${ref.mod}`);
  if (ref && gusto) {
    const misma = d.slug === ref.slug, linea = d.m === ref.m && familia(d).join() === familia(ref).join() && d.slug !== ref.slug;
    const nueva = linea && versionDe(d) != null && versionDe(ref) != null && versionDe(d) > versionDe(ref);
    const cerca = dist(d, ref);
    if (gusto === "gusta") {
      if (misma) add(12, r._vieja ? `Es la versión actual de tus ${cual}, que te gustan` : `Son tus ${cual}, que te gustan: acá está el mejor precio`);
      else if (nueva) add(12, `Es la versión nueva de tus ${cual}, que te gustan`);
      else if (cerca < 2.5) add(9, `Muy parecida a tus ${cual}, que te gustan`);
      else if (cerca < 4.5) add(4, `Parecida a tus ${cual}`);
    } else if (gusto === "no") {
      if (misma || linea) add(-16, `Es de la misma línea que tus ${cual}, que no te convencen`);
      else if (cerca < 2.5) add(-8, `Muy parecida a tus ${cual}, que no te convencen`);
      else if (cerca > 5) add(3, `Distinta de tus ${cual}, que no te convencen`, 2);
    } else if (gusto === "ok") {
      if (misma || nueva) add(4, `Es la versión actual de las que ya usás`, 3);
    }
  }
  /* datos faltantes */
  if (!d.peso || !d.talon) add(-8, "La marca no publica peso ni altura de espuma");
  return { s, pros: pros.sort((a, b) => b[0] - a[0]).map(x => x[1]), contras: contras.sort((a, b) => b[0] - a[0]).map(x => x[1]) };
}

export function recomendar(DATA, r0) {
  /* la zapa que usa hoy: "slug|gusto|cómo la escribió" */
  const [slugAct, gusto, cual] = String(r0.actual || "").split("|");
  const r = { ...r0, _ref: slugAct ? DATA.find(d => d.slug === slugAct) : null, _gusto: gusto || "", _cual: cual || "" };
  r._vieja = !!(r._ref && cual && !new RegExp(`\\b${r._ref.ver || "§"}\\b`, "i").test(cual) && /\d/.test(cual));
  const tope = +r.tope || Infinity;
  const base = DATA.filter(d => (d.terreno || "Asfalto") === r.terreno).map(d => ({ d, t: precioPara(d, r.gen, r.talle) })).filter(x => x.t);
  const dentro = base.filter(x => x.t.precio <= tope);
  const pool = dentro.length >= 3 ? dentro : base;            // si el presupuesto no alcanza para 3, avisamos y usamos todo
  const precios = pool.map(x => x.t.precio), pMin = Math.min(...precios), pMax = Math.max(...precios);
  const evalua = (x, uso) => {
    const p = puntaje(x.d, r, uso);
    p.s += pMax > pMin ? 4 * (1 - (x.t.precio - pMin) / (pMax - pMin)) : 0;   // a igual calidad, mejor más barata (la barata tiene su propio lugar)
    if (r.talle && !tieneTalle(x.t, r.talle)) p.s -= 6;                         // preferimos las que confirmamos que tienen tu talle
    const off = x.t.antes > x.t.precio ? 1 - x.t.precio / x.t.antes : 0;
    if (off >= 0.3) { p.s += 2; p.pros.push(`En oferta: −${Math.round(off * 100)}% en ${x.t.tienda}`); }
    return { ...x, ...p, off };
  };
  const rank = pool.map(x => evalua(x)).sort((a, b) => b.s - a.s);
  if (!rank.length) return { picks: [], sinPresupuesto: false, total: 0 };
  const usados = new Set(), picks = [];
  const tomar = (x, etiqueta, sub) => { usados.add(x.d.id); picks.push({ ...x, etiqueta, sub }); };
  const p1 = rank[0]; tomar(p1, "La mejor para vos", "La que mejor encaja con todo lo que respondiste.");
  /* más barata que cumple: buen puntaje y al menos 10% menos que la primera */
  /* tiene que servir para lo que busca (no vale una de entrenar barata para fondos largos) */
  const sirve = x => (x.d.usos?.length ? x.d.usos : [x.d.uso]).includes(r.uso);
  const p2 = rank.filter(x => !usados.has(x.d.id) && sirve(x) && x.s >= p1.s - 12 && x.t.precio <= p1.t.precio * 0.9).sort((a, b) => a.t.precio - b.t.precio)[0];
  if (p2) tomar(p2, "La que más conviene por precio", `Cumple con lo que buscás y sale ${fmt(p1.t.precio - p2.t.precio)} menos.`);
  /* paso siguiente */
  const [usoSig, etSig, subSig] = SIGUE[r.uso] || [];
  const sig = usoSig && pool.filter(x => !usados.has(x.d.id) && x.d.uso === usoSig).map(x => evalua(x, usoSig)).sort((a, b) => b.s - a.s)[0];
  /* solo si de verdad le sirve (ej. a un pronador no le sugerimos una de ritmo neutra): si no, va otra buena opción */
  if (sig && sig.s >= p1.s - 22 && !(r.uso === "Iniciación" && (r.ritmo === "r4") && usoSig === "Ritmo")) tomar(sig, etSig, subSig + ".");
  /* completar con la siguiente mejor de otra marca */
  for (const x of rank) { if (picks.length >= 3) break; if (usados.has(x.d.id)) continue;
    if (picks.some(p => p.d.m === x.d.m) && rank.some(y => !usados.has(y.d.id) && !picks.some(p => p.d.m === y.d.m) && y.s >= x.s - 6)) continue;
    tomar(x, "Otra muy buena opción", "Muy cerca de la primera, de otra marca o con otro estilo."); }
  picks.sort((a, b) => (ORDEN.indexOf(a.etiqueta) + 1 || 9) - (ORDEN.indexOf(b.etiqueta) + 1 || 9));
  if (r.talle) for (const p of picks) {
    if (tieneTalle(p.t, r.talle)) p.pros.unshift(`Hay talle ${r.talle} en ${p.t.tienda}`);
    else p.contras.unshift(`No pudimos confirmar el talle ${r.talle} en ${p.t.tienda}: chequealo antes de comprar`);
  }
  /* qué la diferencia de la primera */
  const ref = picks[0], nRef = ref.d.mod + (ref.d.ver ? " " + ref.d.ver : "");
  for (const p of picks.slice(1)) {
    const dif = [];
    if (p.d.peso && ref.d.peso && ref.d.peso - p.d.peso >= 15) dif.push(`${ref.d.peso - p.d.peso} g más liviana que la ${nRef}`);
    if (p.d.talon && ref.d.talon && p.d.talon - ref.d.talon >= 3) dif.push(`Más espuma que la ${nRef}: ${p.d.talon} contra ${ref.d.talon} mm`);
    if (ref.t.precio - p.t.precio >= 10000) dif.push(`${fmt(ref.t.precio - p.t.precio)} menos que la ${nRef}`);
    if (placa(p.d) && !placa(ref.d)) dif.push(`A diferencia de la ${nRef}, tiene placa (${p.d.pl.toLowerCase()})`);
    p.pros = [...dif, ...p.pros.filter(x => !/^Va bien con tu peso|^Es neutra, como/.test(x))];
  }
  return { picks, sinPresupuesto: dentro.length < 3 && tope < Infinity, total: rank.filter(x => x.s >= p1.s - 20).length };
}
