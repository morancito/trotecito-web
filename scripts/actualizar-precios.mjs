// Actualiza los precios de cada tienda cargada en modelos.json y suma un punto por día al historial.
// Lo corre GitHub Actions todos los días (ver .github/workflows/precios.yml). También se puede correr a mano:
//   node scripts/actualizar-precios.mjs
//   node scripts/actualizar-precios.mjs --tiendas=Nike     -> solo esas tiendas (para correr desde una compu donde la tienda sí responde)
//
// La lectura de cada tienda (precio, cuotas, stock y talles) está en tiendas.mjs.
// Si una tienda no responde, se conserva el último precio con su fecha vieja (el sitio solo muestra los de hoy o ayer).
// Si el producto ya no existe (404, la tienda redirige a otra página o dice que no existe), se borra de la ficha.
// Una vez por día también rechequea precio, stock y talles de cada color (public/data/colores.json).

import { readFileSync, writeFileSync } from "node:fs";
import { leer, dormir } from "./tiendas.mjs";

const RAIZ = new URL("../public/data/", import.meta.url);
const cat = JSON.parse(readFileSync(new URL("modelos.json", RAIZ), "utf8"));
const hist = JSON.parse(readFileSync(new URL("historial.json", RAIZ), "utf8"));
const PAUSA_MS = 1500;
const SOLO = (process.argv.find(a => a.startsWith("--tiendas=")) || "").slice(10).split(",").map(x => x.trim().toLowerCase()).filter(Boolean);
/* estas tiendas bloquean al robot: sus precios los carga el marcador desde tu navegador (datos-manuales/) */
const MANUALES = ["nike", "adidas.com.ar", "digital sport"];
const toca = t => SOLO.length ? SOLO.includes(t.tienda.toLowerCase()) : !MANUALES.includes(t.tienda.toLowerCase());
const MESES_HISTORIAL = 7;

const hoyISO = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Argentina/Buenos_Aires" }).format(new Date());
const hoyAR = hoyISO.split("-").reverse().join("/");

let ok = 0, fallas = 0, cambios = 0, conTalles = 0;
const errores = [], sinStockL = [], pendientes = [], borrados = [];
const muerto = e => /^HTTP (404|410)\b/.test(e.message);
async function procesar(m, t, ultimoIntento) {
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
    /* las tiendas a veces frenan si se les pide mucho seguido: lo que falla se reintenta al final, más despacio */
    if (muerto(e)) { t._borrar = true; borrados.push(`${m.slug} · ${t.tienda}${t.nota ? " " + t.nota : ""}: ${e.message}`); console.warn(`✗ ${m.slug} · ${t.tienda}: ya no existe (${e.message})`); return; }
    if (!ultimoIntento) { pendientes.push([m, t]); return; }
    fallas++; errores.push(`${m.slug} · ${t.tienda}: ${e.message}`); console.warn(`✗ ${m.slug} · ${t.tienda}: ${e.message}`);
  }
}
for (const m of cat.modelos) {
  for (const t of m.tiendas || []) {
    if (!t.url || !toca(t)) continue;
    await procesar(m, t, false);
    await dormir(PAUSA_MS);
  }
}
if (pendientes.length) {
  console.log(`\nReintentando ${pendientes.length} que fallaron…`);
  await dormir(30000);
  for (const [m, t] of pendientes) { await procesar(m, t, true); await dormir(PAUSA_MS * 3); }
}

/* fuera de la ficha: lo que ya no existe y lo que hace más de 2 semanas que no se puede chequear */
const aMs = f => { const [d, mo, y] = String(f || "").split("/").map(Number); return y ? Date.UTC(y, mo - 1, d) : 0; };
const HOY_MS = aMs(hoyAR);
for (const m of cat.modelos) if (m.tiendas) m.tiendas = m.tiendas.filter(t => !t._borrar && !(t.fecha && HOY_MS - aMs(t.fecha) > 14 * 864e5 && !t.sinStock));

/* colores: una vez por día se rechequea cada color (precio, stock, talles) y se borra el que ya no existe */
const ARCH_COL = new URL("colores.json", RAIZ), ARCH_ROBOT = new URL("robot.json", RAIZ);
let robotPrev = {}; try { robotPrev = JSON.parse(readFileSync(ARCH_ROBOT, "utf8")); } catch {}
let col = { leidos: 0, borrados: 0, sinStock: 0, fallaron: 0 };
if (!SOLO.length && robotPrev.coloresFecha !== hoyAR) {
  const colores = JSON.parse(readFileSync(ARCH_COL, "utf8"));
  console.log("\nColores:");
  for (const [slug, vs] of Object.entries(colores)) {
    if (!Array.isArray(vs)) continue;
    for (const v of vs) {
      if (!v.url) continue;
      try {
        const r = await leer(v.url);
        if (r.sinStock) { v.sinStock = true; col.sinStock++; }
        else { delete v.sinStock; v.precio = r.precio; v.fecha = hoyAR; if (r.antes) v.antes = r.antes; else delete v.antes;
          if (r.talles?.length) { v.talles = r.talles; v.sistema = r.sistema; } else { delete v.talles; delete v.sistema; } col.leidos++; }
      } catch (e) {
        if (muerto(e)) { v._borrar = true; col.borrados++; console.warn(`✗ color ${slug} · ${v.n} · ${v.tienda}: ya no existe`); }
        else { col.fallaron++; console.warn(`✗ color ${slug} · ${v.n} · ${v.tienda}: ${e.message}`); }
      }
      await dormir(PAUSA_MS);
    }
    colores[slug] = vs.filter(v => !v._borrar);
  }
  writeFileSync(ARCH_COL, JSON.stringify(colores, null, 1) + "\n");
  col.fecha = hoyAR;
  console.log(`Colores: ${col.leidos} al día, ${col.sinStock} sin stock, ${col.borrados} borrados, ${col.fallaron} con error.`);
}

// Recorta el historial a los últimos meses para que el archivo no crezca sin límite.
const corte = new Date(hoyISO); corte.setMonth(corte.getMonth() - MESES_HISTORIAL);
const corteISO = corte.toISOString().slice(0, 10);
for (const s of Object.values(hist.series)) for (const k of Object.keys(s)) s[k] = s[k].filter(([d]) => d >= corteISO);

cat.actualizado = hoyAR;
writeFileSync(new URL("modelos.json", RAIZ), JSON.stringify(cat, null, 1) + "\n");
writeFileSync(new URL("historial.json", RAIZ), JSON.stringify(hist) + "\n");
const hora = new Intl.DateTimeFormat("es-AR", { timeZone: "America/Argentina/Buenos_Aires", hour: "2-digit", minute: "2-digit" }).format(new Date());
if (!SOLO.length) writeFileSync(ARCH_ROBOT, JSON.stringify({ fecha: hoyAR, hora, leidos: ok, cambiaron: cambios, conTalles, fallaron: fallas, borrados: borrados.length,
  coloresFecha: col.fecha || robotPrev.coloresFecha || null, colores: col.fecha ? col : robotPrev.colores || null, errores, borradosL: borrados, sinStock: sinStockL }, null, 1) + "\n");
console.log(`\n${ok} precios leídos (${cambios} cambiaron), ${fallas} con error, ${borrados.length} ya no existen y se borraron. Fecha: ${hoyAR}.`);
if (borrados.length) console.log(borrados.map(x => "  " + x).join("\n"));
if (ok === 0) process.exit(1);
