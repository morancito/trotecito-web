/* "Encontrá el reemplazo de tus zapas": a partir del modelo con el que corrés hoy (aunque sea una versión vieja),
   busca la versión que se consigue y alternativas parecidas, más amortiguadas, más estables o más baratas. */

export const norm = s => String(s || "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "")
  .replace(/([a-z])(\d)/g, "$1 $2").replace(/(\d)([a-z])/g, "$1 $2").replace(/[^a-z0-9.]+/g, " ").trim();
/* palabras que no definen al modelo (prefijos de línea o de tecnología que la gente a veces omite) */
const RELLENO = new Set(["gel", "fresh", "foam", "air", "zoom", "zoomx", "fuelcell", "v", "the", "de", "zapatillas", "zapatilla", "running", "hombre", "mujer"]);
const ALIAS = { "nb": "new balance", "ua": "under armour", "hoka one one": "hoka", "lasportiva": "la sportiva", "s lab": "s lab" };
/* partes del nombre que la gente suele omitir: "Boston 12" es la Adizero Boston, "Adrenaline 22" es la Adrenaline GTS */
const OMITIBLES = new Set(["adizero", "gts", "terrex", "nitro", "s", "lab", "atr", "cloud", "x"]);
const tokens = s => norm(s).split(" ").filter(t => t && !RELLENO.has(t));
const esNum = t => /^\d+(\.\d+)?$/.test(t);

/* las palabras del nombre del modelo (sin la versión): "Gel-Nimbus" -> [nimbus], "Fresh Foam X 1080" -> [1080] */
const familia = d => tokens(d.mod);
const versionDe = d => { const n = norm(d.ver).match(/\d+/); return n ? +n[0] : null; };

/* Busca el modelo que escribió el usuario. Devuelve { d, tipo, version } o null:
   tipo "exacto" (está en el catálogo), "anterior" (escribió una versión vieja), "posterior" (una que todavía no llegó) */
export function buscarModelo(DATA, q) {
  let txt = ` ${norm(q)} `;
  for (const [a, b] of Object.entries(ALIAS)) txt = txt.replace(` ${a} `, ` ${b} `);
  const tq = tokens(txt);
  if (!tq.length) return null;
  const marcaQ = [...new Set(DATA.map(d => d.m))].find(m => txt.includes(` ${norm(m)} `));
  /* modelos cuya familia completa aparece en lo escrito; gana la familia más larga ("pegasus trail" antes que "pegasus") */
  const enQ = d => { const f = familia(d), nucleo = f.filter(t => !OMITIBLES.has(t));
    return f.length && (f.every(t => tq.includes(t)) || (nucleo.length && nucleo.length < f.length && nucleo.every(t => tq.includes(t)))); };
  const cands = DATA.filter(d => (!marcaQ || d.m === marcaQ) && enQ(d));
  if (!cands.length) return null;
  /* gana la que coincide en más palabras, y a igualdad, la que coincide completa ("Mach 5" es Mach, no Mach X) */
  const coinciden = d => { const f = familia(d), n = f.filter(t => tq.includes(t)).length; return n * 2 + (n === f.length ? 1 : 0); };
  const largo = Math.max(...cands.map(coinciden));
  const fam = cands.filter(d => coinciden(d) === largo);
  /* la versión que escribió: el primer número que no sea parte del nombre (1080, 880, 2000...) */
  const famTok = new Set(familia(fam[0]));
  const vq = tq.filter(t => esNum(t) && !famTok.has(t)).map(Number)[0] ?? null;
  /* si la familia tiene variantes sin número (Pegasus Plus), solo cuentan las que coinciden en todo lo demás */
  const resto = tq.filter(t => !famTok.has(t) && !esNum(t) && !norm(fam[0].m).split(" ").includes(t));
  const exactas = fam.filter(d => resto.every(t => tokens(d.ver).includes(t)));
  const misma = exactas.length ? exactas : fam, otra = !exactas.length;   // "Ultraboost Light": no está esa variante, se usa la de la misma línea
  const conV = misma.filter(d => versionDe(d) != null).sort((a, b) => versionDe(b) - versionDe(a));
  if (vq == null || !conV.length) {
    const d = conV[0] || misma[0];
    return { d, tipo: otra ? "linea" : "exacto", version: null };
  }
  const igual = conV.find(d => versionDe(d) === vq);
  if (igual) return { d: igual, tipo: otra ? "linea" : "exacto", version: vq };
  const nueva = conV[0];   // la versión más nueva que se consigue
  return { d: nueva, tipo: vq < versionDe(nueva) ? "anterior" : "posterior", version: vq };
}

/* parecido entre dos zapas: cuanto más bajo, más parecidas */
const dist = (a, b, ignorar = "") => {
  let s = 0;
  if (ignorar !== "talon" && a.talon && b.talon) s += Math.abs(a.talon - b.talon) / 4;
  if (a.drop != null && b.drop != null) s += Math.abs(a.drop - b.drop) / 3;
  if (ignorar !== "peso" && a.peso && b.peso) s += Math.abs(a.peso - b.peso) / 25;
  if (a.uso !== b.uso) s += 1.5;
  if (ignorar !== "tipo" && a.tipo !== b.tipo) s += 3;
  if (/carbono|nylon|varilla|pebax/i.test(a.pl || "") !== /carbono|nylon|varilla|pebax/i.test(b.pl || "")) s += 1.5;
  return s;
};
const fmt = n => "$" + Math.round(n).toLocaleString("es-AR");
const nom = d => d.mod + (d.ver ? " " + d.ver : "");
const conPlaca = d => /carbono|nylon|varilla|pebax/i.test(d.pl || "");

/* qué cambia respecto de la tuya, en frases cortas */
export function diferencias(d, ref) {
  const out = [];
  if (d.talon && ref.talon) { const x = Math.round((d.talon - ref.talon) * 10) / 10;
    if (Math.abs(x) >= 2) out.push(x > 0 ? `${x} mm más de espuma en el talón` : `${-x} mm menos de espuma en el talón`); else out.push("Misma altura de espuma"); }
  if (d.peso && ref.peso) { const x = d.peso - ref.peso;
    if (Math.abs(x) >= 10) out.push(x < 0 ? `${-x} g más liviana` : `${x} g más pesada`); }
  if (d.drop != null && ref.drop != null && Math.abs(d.drop - ref.drop) >= 2) out.push(`Drop de ${d.drop} mm (la tuya: ${ref.drop} mm)`);
  if (d.tipo !== ref.tipo) out.push(d.tipo === "Estabilidad" ? "Tiene estabilidad para pronadores" : "Es neutra, sin soporte para pronadores");
  if (conPlaca(d) !== conPlaca(ref)) out.push(conPlaca(d) ? `Tiene placa (${d.pl.toLowerCase()})` : "No tiene placa");
  if (d.uso !== ref.uso) out.push(`Pensada para ${d.uso.toLowerCase()}`);
  if (d.min && ref.min) { const x = d.min - ref.min;
    if (Math.abs(x) >= 5000) out.push(x < 0 ? `${fmt(-x)} menos` : `${fmt(x)} más`); }
  return out;
}

/* las alternativas: cada una responde a una necesidad distinta y no se repiten */
export function reemplazos(DATA, hallado) {
  const ref = hallado.d, usadas = new Set([ref.slug]);
  const pool = DATA.filter(d => d.min && (d.terreno || "Asfalto") === (ref.terreno || "Asfalto") && d.slug !== ref.slug && !(d.m === ref.m && familia(d).join() === familia(ref).join()));
  const elegir = (filtro, ignorar) => { const c = pool.filter(d => !usadas.has(d.slug) && filtro(d)).sort((a, b) => dist(a, ref, ignorar) - dist(b, ref, ignorar))[0];
    if (c) usadas.add(c.slug); return c; };
  const out = [];
  if (ref.min) out.push({ k: "actual", t: hallado.tipo === "anterior" || hallado.tipo === "linea" ? "La versión que se consigue hoy" : hallado.tipo === "posterior" ? "La versión que se consigue acá" : "La misma, al mejor precio", d: ref });
  /* si la tuya está en el catálogo pero ya salió una más nueva */
  const nueva = versionDe(ref) != null && DATA.filter(d => d.min && d.m === ref.m && d.mod === ref.mod && versionDe(d) > versionDe(ref)).sort((a, b) => versionDe(b) - versionDe(a))[0];
  if (nueva) { usadas.add(nueva.slug); out.push({ k: "nueva", t: "La versión nueva", d: nueva }); }
  const p = elegir(d => d.tipo === ref.tipo && d.m !== ref.m);
  if (p) out.push({ k: "parecida", t: "La más parecida de otra marca", d: p });
  const am = ref.talon ? elegir(d => d.talon >= ref.talon + 3 && d.tipo === ref.tipo, "talon") : null;
  if (am) out.push({ k: "amortiguada", t: "Más amortiguada", d: am });
  if (ref.tipo !== "Estabilidad") { const e = elegir(d => d.tipo === "Estabilidad", "tipo"); if (e) out.push({ k: "estable", t: "Más estable, si pronás", d: e }); }
  else { const l = ref.peso ? elegir(d => d.peso && d.peso <= ref.peso - 20 && d.tipo === ref.tipo, "peso") : null; if (l) out.push({ k: "liviana", t: "Más liviana", d: l }); }
  const tope = ref.min ? ref.min * 0.8 : null;
  const b = elegir(d => tope ? d.min <= tope : true);
  if (b) out.push({ k: "barata", t: tope ? "Parecida y más barata" : "Una opción económica parecida", d: b });
  return out.map(o => ({ ...o, dif: o.d === ref ? [] : diferencias(o.d, ref) }));
}

/* sugerencias mientras se escribe: modelos del catálogo que contienen todas las palabras */
export function sugerir(DATA, q, n = 6) {
  const tq = norm(q).split(" ").filter(Boolean);
  if (!tq.length) return [];
  return DATA.filter(d => { const s = ` ${norm(`${d.m} ${d.mod} ${d.ver}`)} `; return tq.every((t, i) => i === tq.length - 1 ? s.includes(` ${t}`) : s.includes(` ${t} `)); })
    .sort((a, b) => (b.min ? 1 : 0) - (a.min ? 1 : 0) || nom(a).localeCompare(nom(b))).slice(0, n);
}
