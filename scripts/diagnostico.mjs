// Diagnóstico de lectura de tiendas: qué devuelve cada página al robot (estado, título, marcas de plataforma, precio leído).
//   node scripts/diagnostico.mjs <url> [<url> ...]   -> deja el resultado en scripts/diagnostico.json
import { writeFileSync } from "node:fs";
import { UA, leer } from "./tiendas.mjs";
const out = [];
for (const url of process.argv.slice(2)) {
  const x = { url };
  try {
    const r = await fetch(url, { headers: { "User-Agent": UA, "Accept-Language": "es-AR,es;q=0.9", Accept: "text/html" }, redirect: "follow", signal: AbortSignal.timeout(25000) });
    const h = await r.text();
    Object.assign(x, { estado: r.status, urlFinal: r.url, largo: h.length, titulo: (h.match(/<title>([^<]*)/) || [])[1]?.trim(),
      variantes: /data-variants=/.test(h), tiendanube: /tiendanube|nuvemshop|LS\.store/i.test(h), desafio: /captcha|challenge|cf-chl|Just a moment|Access denied/i.test(h),
      jsonld: (h.match(/ld\+json/g) || []).length, precioMeta: (h.match(/(?:product:price:amount|og:price:amount)["'][^>]*content=["']([\d.,]+)/i) || [])[1] || null,
      muestra: h.replace(/<script[\s\S]*?<\/script>|<style[\s\S]*?<\/style>/g, " ").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").slice(0, 600) });
  } catch (e) { x.error = e.message; }
  try { x.leido = await leer(url); } catch (e) { x.leerError = e.message; }
  out.push(x); console.log(JSON.stringify(x).slice(0, 300));
}
writeFileSync(new URL("./diagnostico.json", import.meta.url), JSON.stringify({ fecha: new Date().toISOString(), resultados: out }, null, 1) + "\n");
