// Tabla de equivalencias de talles US -> AR por marca y género, sacada de las tiendas que publican los dos:
// Dexter y Stock Center (Salesforce) muestran el talle argentino y en el código interno de cada talle guardan el de
// EE. UU. ("SAS20964-135_11.5_1" = US 11.5, que la tienda vende como AR 45). Así la conversión es la que usa el
// mercado argentino para cada marca, no una tabla genérica.
// Deja public/data/talles.json: { "Saucony": { "Hombre": { "11.5": "45", ... }, "Mujer": {...} }, ... }
//   node scripts/tabla-talles.mjs
import { readFileSync, writeFileSync } from "node:fs";
import { traer, dormir } from "./tiendas.mjs";

const cat = JSON.parse(readFileSync(new URL("../public/data/modelos.json", import.meta.url), "utf8"));
const ARCH = new URL("../public/data/talles.json", import.meta.url);
const votos = {};   // marca -> género -> us -> { ar: cuenta }
let paginas = 0;
const yaVisto = new Set();
for (const m of cat.modelos.filter(m => !m.borrador)) {
  for (const t of (m.tiendas || []).filter(t => /dexter\.com\.ar|stockcenter\.com\.ar/.test(t.url || ""))) {
    const gen = t.nota === "Mujer" ? "Mujer" : t.nota === "Hombre" ? "Hombre" : null;
    if (!gen || yaVisto.has(t.url)) continue;
    yaVisto.add(t.url);
    try {
      const u = new URL(t.url), h = (await traer(t.url)).replace(/&quot;/g, "\"");
      const ruta = (h.match(/\/on\/demandware\.store\/(Sites-[^/"']+\/[^/"']+)\/Product-Variation/) || [])[1];
      const pid = (h.match(/data-pid="([^"]+)"/) || [])[1] || (u.pathname.match(/([A-Z0-9][A-Z0-9_-]+)\.html$/) || [])[1];
      if (!ruta || !pid) continue;
      const j = await traer(`${u.origin}/on/demandware.store/${ruta}/Product-Variation?pid=${encodeURIComponent(pid)}&quantity=1`, true);
      const a = (j.product?.variationAttributes || []).find(x => x.id === "size");
      const sku = s => (String(s || "").match(/_(\d{1,2}(?:\.5)?)_\d+$/) || [])[1];
      /* el código de cada talle está en la página (los no seleccionables también) */
      for (const v of a?.values || []) {
        const ar = String(v.value ?? v.displayValue).replace(",", ".");
        const us = sku(v.sku) || sku((h.match(new RegExp(`"id":"${ar.replace(".", "\\.")}"[^}]*?"sku":"([^"]+)"`)) || [])[1]);
        if (!/^\d{2}(\.5)?$/.test(ar) || !us) continue;
        const k = ((votos[m.m] ??= {})[gen] ??= {})[us] ??= {};
        k[ar] = (k[ar] || 0) + 1;
      }
      paginas++;
    } catch (e) { console.log(`✗ ${m.slug} · ${t.tienda}: ${e.message}`); }
    await dormir(1200);
  }
}
/* por cada talle US, el AR que más veces aparece. adidas y Puma guardan el talle UK (no el US) en el código: no sirven */
const NO_US = ["Adidas", "Puma"];
const tabla = {};
for (const [marca, gs] of Object.entries(votos)) for (const [gen, uss] of Object.entries(gs)) {
  if (NO_US.includes(marca)) continue;
  const fila = Object.fromEntries(Object.entries(uss).map(([us, ars]) => [us, Object.entries(ars).sort((a, b) => b[1] - a[1])[0][0]]).sort((a, b) => a[0] - b[0]));
  if (Object.keys(fila).length >= 3) (tabla[marca] ??= {})[gen] = fila;
}
writeFileSync(ARCH, JSON.stringify(tabla, null, 1) + "\n");
console.log(`${paginas} páginas leídas.`);
for (const [marca, gs] of Object.entries(tabla)) for (const [gen, f] of Object.entries(gs)) console.log(`${marca} ${gen}: ${Object.entries(f).map(([u, a]) => `US ${u}=${a}`).join(" · ")}`);
