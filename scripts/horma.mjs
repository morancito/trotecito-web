// Pasa el ancho de horma medido por RunRepeat (scripts/segunda-fuente.json) al catálogo: d.horma = ancha | normal | angosta | punta (angosta solo en los dedos).
// Usa la palabra de su tabla (Narrow/Medium/Wide) y la medida contra el promedio; si las fuentes se contradicen, no pone nada.
//   node scripts/horma.mjs
import { readFileSync, writeFileSync } from "node:fs";
const P = new URL("../public/data/modelos.json", import.meta.url);
const cat = JSON.parse(readFileSync(P, "utf8")), s = JSON.parse(readFileSync(new URL("./segunda-fuente.json", import.meta.url), "utf8"));
/* RunRepeat dice una cosa y su propia review u otra fuente dice otra */
const DUDA = new Set(["on-cloudflyer-5", "brooks-ghost-15"]);
const cuenta = {};
for (const m of cat.modelos) {
  delete m.horma;
  const r = s[m.slug]?.runrepeat;
  if (!r?.calce || r.calce === "-" || DUDA.has(m.slug)) continue;
  const dif = r.medio ? r.medio.mm - r.medio.prom : null, difP = r.punta ? r.punta.mm - r.punta.prom : null;
  let h = "normal";
  if ((r.calce === "Wide" && r.calcePunta !== "Narrow") || (r.calcePunta === "Wide" && r.calce !== "Narrow")) h = "ancha";
  else if (r.calce === "Narrow" && (dif == null || dif <= -1.5)) h = "angosta";
  else if (r.calcePunta === "Narrow" && difP != null && difP <= -2.5) h = "punta";   // normal pero angosta en los dedos
  m.horma = h; (cuenta[h] ??= []).push(m.slug);
}
writeFileSync(P, JSON.stringify(cat, null, 1) + "\n");
for (const [k, v] of Object.entries(cuenta)) console.log(k, v.length, k === "normal" ? "" : v.join(" "));
