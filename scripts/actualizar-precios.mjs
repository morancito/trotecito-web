// Actualiza los precios de cada tienda cargada en modelos.json y suma un punto por día al historial.
// Lo corre GitHub Actions todos los días (ver .github/workflows/precios.yml). También se puede correr a mano:
//   node scripts/actualizar-precios.mjs
//
// La lectura de cada tienda (precio, cuotas, stock y talles) está en tiendas.mjs.
// Si una tienda no responde, se conserva el último precio y no se agrega punto ese día.

import { readFileSync, writeFileSync } from "node:fs";
import { leer, dormir } from "./tiendas.mjs";

const RAIZ = new URL("../public/data/", import.meta.url);
const cat = JSON.parse(readFileSync(new URL("modelos.json", RAIZ), "utf8"));
const hist = JSON.parse(readFileSync(new URL("historial.json", RAIZ), "utf8"));
const PAUSA_MS = 1500;
const MESES_HISTORIAL = 7;

const hoyISO = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Argentina/Buenos_Aires" }).format(new Date());
const hoyAR = hoyISO.split("-").reverse().join("/");

let ok = 0, fallas = 0, cambios = 0, conTalles = 0;
const errores = [], sinStockL = [];
for (const m of cat.modelos) {
  for (const t of m.tiendas || []) {
    if (!t.url) continue;
    try {
      const r = await leer(t.url);
      if (r.sinStock) { t.sinStock = true; sinStockL.push(`${m.slug} · ${t.tienda}`); console.log(`– ${m.slug} · ${t.tienda}: sin stock`); }
      else {
        delete t.sinStock;
        if (r.precio !== t.precio) cambios++;
        t.precio = r.precio; t.fecha = hoyAR;
        if (r.antes) t.antes = r.antes; else delete t.antes;
        if (r.cuotas) t.cuotas = `${r.cuotas} cuotas sin interés`;
        if (r.talles?.length) { t.talles = r.talles; t.sistema = r.sistema; conTalles++; } else { delete t.talles; delete t.sistema; }
        const clave = t.tienda + (t.nota === "Mujer" ? " · Mujer" : "");   // hombre y mujer llevan historial separado
        const serie = ((hist.series[m.slug] ??= {})[clave] ??= []);
        const ult = serie[serie.length - 1];
        if (ult && ult[0] === hoyISO) ult[1] = r.precio; else serie.push([hoyISO, r.precio]);
        console.log(`✓ ${m.slug} · ${t.tienda}: $${r.precio.toLocaleString("es-AR")}`);
      }
      ok++;
    } catch (e) {
      fallas++; errores.push(`${m.slug} · ${t.tienda}: ${e.message}`); console.warn(`✗ ${m.slug} · ${t.tienda}: ${e.message}`);
    }
    await dormir(PAUSA_MS);
  }
}

// Recorta el historial a los últimos meses para que el archivo no crezca sin límite.
const corte = new Date(hoyISO); corte.setMonth(corte.getMonth() - MESES_HISTORIAL);
const corteISO = corte.toISOString().slice(0, 10);
for (const s of Object.values(hist.series)) for (const k of Object.keys(s)) s[k] = s[k].filter(([d]) => d >= corteISO);

cat.actualizado = hoyAR;
writeFileSync(new URL("modelos.json", RAIZ), JSON.stringify(cat, null, 1) + "\n");
writeFileSync(new URL("historial.json", RAIZ), JSON.stringify(hist) + "\n");
const hora = new Intl.DateTimeFormat("es-AR", { timeZone: "America/Argentina/Buenos_Aires", hour: "2-digit", minute: "2-digit" }).format(new Date());
writeFileSync(new URL("robot.json", RAIZ), JSON.stringify({ fecha: hoyAR, hora, leidos: ok, cambiaron: cambios, conTalles, fallaron: fallas, errores, sinStock: sinStockL }, null, 1) + "\n");
console.log(`\n${ok} precios leídos (${cambios} cambiaron), ${fallas} con error. Fecha: ${hoyAR}.`);
if (ok === 0) process.exit(1);
