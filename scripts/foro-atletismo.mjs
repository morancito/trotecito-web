// Busca en Foroatletismo.com el análisis de cada modelo del catálogo y guarda lo que dice sobre
// para quién es (peso, pisada, ritmo, uso) y la ficha técnica, para compararlo con nuestras fichas.
// No toca el catálogo: deja todo en scripts/foro-atletismo.json.
//   node scripts/foro-atletismo.mjs
import { readFileSync, writeFileSync } from "node:fs";
import { traer, dormir } from "./tiendas.mjs";

const BASE = "https://www.foroatletismo.com";
const cat = JSON.parse(readFileSync(new URL("../public/data/modelos.json", import.meta.url), "utf8"));
const texto = h => h.replace(/<script[\s\S]*?<\/script>|<style[\s\S]*?<\/style>|<nav[\s\S]*?<\/nav>|<footer[\s\S]*?<\/footer>/g, " ")
  .replace(/<\/(p|li|tr|h\d|div)>/g, "\n").replace(/<[^>]+>/g, " ").replace(/&nbsp;/g, " ").replace(/&amp;/g, "&").replace(/&#8217;|&#039;/g, "'")
  .replace(/&#8211;/g, "–").replace(/&#8220;|&#8221;|&quot;/g, '"').replace(/[ \t]+/g, " ").replace(/\n\s*\n+/g, "\n").trim();
const norm = s => String(s).toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/([a-z])(\d)/g, "$1 $2").replace(/(\d)([a-z])/g, "$1 $2").replace(/[^a-z0-9.]+/g, " ").trim();
const RUIDO = ["gel", "fresh", "foam", "x", "fuelcell", "zoom", "air", "one", "the"];

/* 1) todas las páginas de zapatillas del sitio, desde los sitemaps */
async function urlsZapatillas() {
  const out = new Set(), errores = [];
  for (const idx of ["/sitemap_index.xml", "/sitemap.xml", "/wp-sitemap.xml"]) {
    try {
      const x = await traer(BASE + idx);
      const mapas = [...x.matchAll(/<loc>([^<]+)<\/loc>/g)].map(m => m[1]);
      for (const mp of mapas) {
        if (/\/zapatillas\//.test(mp) && !/\.xml/.test(mp)) { out.add(mp); continue; }
        if (!/\.xml/.test(mp) || /(image|author|tag|category|foro)/i.test(mp)) continue;
        try { const y = await traer(mp); for (const m of y.matchAll(/<loc>([^<]+)<\/loc>/g)) if (/foroatletismo\.com\/zapatillas\/[^/]+\/?$/.test(m[1])) out.add(m[1]); }
        catch (e) { errores.push(`${mp}: ${e.message}`); }
        await dormir(500);
      }
      if (out.size) break;
    } catch (e) { errores.push(`${idx}: ${e.message}`); }
  }
  return { urls: [...out], errores };
}

/* 2) la página que mejor coincide con el modelo (marca + todas las palabras + mismo número de versión) */
function elegir(m, urls) {
  const marca = norm(m.m).split(" ")[0];
  const tok = norm(`${m.mod} ${m.ver}`).split(" ").filter(x => x && !RUIDO.includes(x));
  const num = tok.filter(x => /^\d+(\.\d)?$/.test(x));
  let mejor = null;
  for (const u of urls) {
    const s = ` ${norm(u.split("/zapatillas/")[1] || "")} `;
    if (!s.includes(` ${marca} `)) continue;
    if (!tok.every(k => s.includes(` ${k} `))) continue;
    const nums = (s.match(/ \d+(\.\d)? /g) || []).map(x => x.trim()).filter(x => +x < 100);
    if (num.length ? !num.every(n => nums.includes(n)) || nums.some(n => !num.includes(n)) : nums.length) continue;
    const sobra = s.trim().split(" ").length - tok.length - 1;
    if (!mejor || sobra < mejor.sobra) mejor = { u, sobra };
  }
  return mejor?.u || null;
}

/* 3) de la página: ficha técnica (tablas y listas "Dato: valor") y frases sobre para quién es */
const CLAVES = /(kilos|\bkg\b|peso del corredor|corredores? (ligeros?|pesados?|de peso)|pronador|pronaci|supinad|neutr|estabil|min\/km|ritmo|series|competi|marat[oó]n|media marat|10 ?k|tirada|rodaje|entrenamiento diario|principiante|novato|iniciaci|recomend|ideal para|no es (una )?zapatilla para|no la recomend|perfil|pie ancho|horma)/i;
function extraer(h) {
  const t = texto(h.slice(h.search(/<article|<main|class="entry-content/i) > 0 ? h.search(/<article|<main|class="entry-content/i) : 0));
  const ficha = {};
  for (const m of h.matchAll(/<tr[^>]*>([\s\S]*?)<\/tr>/g)) {
    const c = [...m[1].matchAll(/<t[dh][^>]*>([\s\S]*?)<\/t[dh]>/g)].map(x => texto(x[1]));
    if (c.length >= 2 && c[0].length < 40 && c[1]) ficha[c[0]] = c.slice(1).join(" | ").slice(0, 160);
  }
  for (const l of t.split("\n")) { const mm = l.match(/^\s*([A-ZÁÉÍÓÚa-záéíóúñ][\wáéíóúñ ()/.-]{2,30}):\s*(.{1,140})$/); if (mm && Object.keys(ficha).length < 40) ficha[mm[1].trim()] ??= mm[2].trim(); }
  const frases = [...new Set(t.split(/(?<=[.!?])\s+|\n/).map(x => x.trim()).filter(x => x.length > 25 && x.length < 400 && CLAVES.test(x)))].slice(0, 28);
  const titulo = texto((h.match(/<title>([\s\S]*?)<\/title>/) || [])[1] || "");
  const fecha = (h.match(/"datePublished":"([^"]+)"/) || h.match(/article:published_time" content="([^"]+)"/) || [])[1] || "";
  return { titulo, fecha, ficha, frases };
}

const { urls, errores } = await urlsZapatillas();
console.log(`${urls.length} páginas de zapatillas en Foroatletismo`);
const salida = { fecha: new Date().toISOString(), paginas: urls.length, errores, modelos: {} };
for (const m of cat.modelos) {
  const u = elegir(m, urls);
  if (!u) { salida.modelos[m.slug] = null; console.log(`· ${m.slug}: sin análisis`); continue; }
  try { salida.modelos[m.slug] = { url: u, ...extraer(await traer(u)) }; console.log(`✓ ${m.slug} <- ${u}`); }
  catch (e) { salida.modelos[m.slug] = { url: u, error: e.message }; console.warn(`✗ ${m.slug}: ${e.message}`); }
  await dormir(1500);
}
/* lista de páginas para revisar coincidencias a mano */
salida.urls = urls.filter(u => /(nike|adidas|asics|new-balance|saucony|puma|brooks|on-|hoka|mizuno|under-armour|salomon|topper|la-sportiva)/.test(u));
writeFileSync(new URL("./foro-atletismo.json", import.meta.url), JSON.stringify(salida, null, 1) + "\n");
console.log(`\n${Object.values(salida.modelos).filter(x => x && !x.error).length} de ${cat.modelos.length} modelos con análisis.`);
