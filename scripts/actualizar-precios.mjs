// Actualiza los precios de cada tienda cargada en modelos.json y suma un punto por día al historial.
// Lo corre GitHub Actions todos los días (ver .github/workflows/deploy.yml). También se puede correr a mano:
//   node scripts/actualizar-precios.mjs
//
// Soporta tiendas VTEX (URL que termina en /p: Nike, Asics, Sporting, Dash...), Salesforce Commerce Cloud
// (Dexter, New Balance) y, como respaldo, cualquier página con datos de producto estándar (JSON-LD).
// Si una tienda no responde, se conserva el último precio y no se agrega punto ese día.

import { readFileSync, writeFileSync } from "node:fs";

const RAIZ = new URL("../public/data/", import.meta.url);
const cat = JSON.parse(readFileSync(new URL("modelos.json", RAIZ), "utf8"));
const hist = JSON.parse(readFileSync(new URL("historial.json", RAIZ), "utf8"));
const UA = "Mozilla/5.0 (compatible; TrotecitoBot/1.0; +https://morancito.github.io/trotecito-web/)";
const PAUSA_MS = 1500;
const MESES_HISTORIAL = 7;

const hoyISO = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Argentina/Buenos_Aires" }).format(new Date());
const hoyAR = hoyISO.split("-").reverse().join("/");
const dormir = ms => new Promise(r => setTimeout(r, ms));

async function traer(url, json = false) {
  const r = await fetch(url, { headers: { "User-Agent": UA, "Accept-Language": "es-AR,es;q=0.9", Accept: json ? "application/json" : "text/html" },
    redirect: "follow", signal: AbortSignal.timeout(25000) });
  if (!r.ok) throw new Error(`HTTP ${r.status}`);
  return json ? r.json() : r.text();
}
const num = v => (v == null || v === "" ? null : Math.round(parseFloat(String(v).replace(/[^\d.]/g, ""))));

async function vtex(url) {
  const u = new URL(url);
  const prods = await traer(`${u.origin}/api/catalog_system/pub/products/search${u.pathname}`, true);
  const p = prods[0];
  if (!p) throw new Error("producto no encontrado");
  const ofertas = p.items.flatMap(i => i.sellers.map(s => s.commertialOffer)).filter(o => o.AvailableQuantity > 0 && o.Price > 0);
  if (!ofertas.length) return { sinStock: true };
  const o = ofertas.sort((a, b) => a.Price - b.Price)[0];
  const cuotas = Math.max(0, ...(o.Installments || []).filter(x => x.InterestRate === 0).map(x => x.NumberOfInstallments));
  return { precio: num(o.Price), antes: o.ListPrice > o.Price * 1.01 ? num(o.ListPrice) : null, cuotas };
}

function html(h) {
  const texto = h.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ");
  if (/demandware/i.test(h)) {
    const precio = num((h.match(/class="sales"[\s\S]{0,300}?content="([\d.]+)"/) || [])[1]);
    if (precio) {
      const lista = num((h.match(/strike-through[\s\S]{0,300}?content="([\d.]+)"/) || [])[1]);
      const cuotas = +((texto.match(/Cuotas habituales\s*(\d+)\s*Cuotas sin inter/i) || texto.match(/(\d+)\s*cuotas sin inter[eé]s/i) || [])[1] || 0);
      const sinStock = /sin stock|producto agotado/i.test(texto) && !/agregar al carrito/i.test(texto);
      return { precio, antes: lista > precio * 1.01 ? lista : null, cuotas, sinStock };
    }
  }
  for (const m of h.matchAll(/<script[^>]+ld\+json[^>]*>([\s\S]*?)<\/script>/gi)) {
    try {
      let precio = null, stock = true;
      const walk = o => { if (!o || typeof o !== "object") return; if (Array.isArray(o)) return o.forEach(walk);
        if (o.offers) [].concat(o.offers).forEach(of => { const v = num(of.price ?? of.lowPrice); if (v && (!precio || v < precio)) precio = v; if (/OutOfStock/i.test(of.availability || "")) stock = false; });
        Object.values(o).forEach(walk); };
      walk(JSON.parse(m[1].trim()));
      if (precio) return { precio, antes: null, cuotas: +((texto.match(/(\d+)\s*cuotas sin inter[eé]s/i) || [])[1] || 0), sinStock: !stock };
    } catch {}
  }
  const meta = num((h.match(/(?:product:price:amount|og:price:amount)["'][^>]*content=["']([\d.,]+)/i) || [])[1]);
  if (meta) return { precio: meta, antes: null, cuotas: 0 };
  throw new Error("no encontré el precio en la página");
}

async function leer(url) {
  if (/\/p\/?$/.test(new URL(url).pathname)) { try { return await vtex(url); } catch (e) { if (!/404/.test(e.message)) throw e; } }
  return html(await traer(url));
}

let ok = 0, fallas = 0, cambios = 0;
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
        const serie = ((hist.series[m.slug] ??= {})[t.tienda] ??= []);
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
writeFileSync(new URL("robot.json", RAIZ), JSON.stringify({ fecha: hoyAR, hora, leidos: ok, cambiaron: cambios, fallaron: fallas, errores, sinStock: sinStockL }, null, 1) + "\n");
console.log(`\n${ok} precios leídos (${cambios} cambiaron), ${fallas} con error. Fecha: ${hoyAR}.`);
if (ok === 0) process.exit(1);
