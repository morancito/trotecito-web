// Baja las fotos de producto de cada modelo desde las páginas de las tiendas cargadas en modelos.json
// y las guarda en public/fotos/<modelo>/1.jpg, 2.jpg...
//
// Uso (en tu compu, con internet):
//   npm run bajar-fotos                     -> todos los modelos que todavía no tienen fotos
//   npm run bajar-fotos -- nike-vomero-18   -> solo ese modelo (pisa las fotos que tenga)
//
// Si querés usar otras páginas o fotos directas (por ejemplo, el kit de prensa de una marca),
// agregalas en scripts/fotos-urls.json:  { "nike-vomero-18": ["https://...jpg", "https://pagina-del-producto"] }

import { readFileSync, writeFileSync, mkdirSync, readdirSync, existsSync, rmSync } from "node:fs";
import { UA } from "./tiendas.mjs";

const MAX_FOTOS = 4;
const raiz = new URL("../public/", import.meta.url);
const cat = JSON.parse(readFileSync(new URL("data/modelos.json", raiz), "utf8"));
const extraUrl = new URL("./fotos-urls.json", import.meta.url);
const extra = existsSync(extraUrl) ? JSON.parse(readFileSync(extraUrl, "utf8")) : {};
const soloUno = process.argv[2];
// se identifica como TrotecitoBot, igual que el resto de los robots (no se hace pasar por un navegador)
const esImagen = u => /\.(jpe?g|png|webp|avif)(\?|$)/i.test(u);

async function traer(url, tipo = "text") {
  const r = await fetch(url, { headers: { "User-Agent": UA, "Accept-Language": "es-AR,es;q=0.9" }, redirect: "follow", signal: AbortSignal.timeout(20000) });
  if (!r.ok) throw new Error(`HTTP ${r.status}`);
  return tipo === "text" ? r.text() : { buf: Buffer.from(await r.arrayBuffer()), ct: r.headers.get("content-type") || "" };
}

// Saca las imágenes de producto de una página: datos estructurados (JSON-LD), og:image y galerías comunes.
function imagenesDePagina(html, base) {
  const out = [];
  const abs = u => { try { return new URL(u.replace(/&amp;/g, "&"), base).href; } catch { return null; } };
  for (const m of html.matchAll(/<script[^>]+application\/ld\+json[^>]*>([\s\S]*?)<\/script>/gi)) {
    try {
      const walk = o => { if (!o || typeof o !== "object") return; if (Array.isArray(o)) return o.forEach(walk);
        if (/product/i.test(o["@type"] || "") && o.image) [].concat(o.image).forEach(i => out.push(typeof i === "string" ? i : i?.url));
        Object.values(o).forEach(walk); };
      walk(JSON.parse(m[1].trim()));
    } catch {}
  }
  for (const m of html.matchAll(/<meta[^>]+(?:property|name)=["'](?:og:image(?::secure_url)?|twitter:image)["'][^>]*>/gi)) {
    const c = m[0].match(/content=["']([^"']+)["']/i); if (c) out.push(c[1]);
  }
  for (const m of html.matchAll(/(?:data-zoom-image|data-large|data-src|href)=["']([^"']+\.(?:jpe?g|png|webp)(?:\?[^"']*)?)["']/gi)) out.push(m[1]);
  return [...new Set(out.filter(Boolean).map(abs).filter(Boolean))]
    .filter(u => !/logo|icon|sprite|banner|placeholder|payment|tarjeta/i.test(u));
}

function extension(ct, url) {
  if (/webp/.test(ct)) return "webp"; if (/png/.test(ct)) return "png"; if (/avif/.test(ct)) return "avif";
  const m = url.match(/\.(jpe?g|png|webp|avif)(\?|$)/i); return m ? m[1].toLowerCase().replace("jpeg", "jpg") : "jpg";
}

let total = 0;
for (const m of cat.modelos) {
  if (soloUno && m.slug !== soloUno) continue;
  const dir = new URL(`fotos/${m.slug}/`, raiz);
  const yaTiene = existsSync(dir) && readdirSync(dir).some(f => /\.(jpe?g|png|webp|avif)$/i.test(f));
  if (yaTiene && !soloUno) continue;
  const fuentes = [...(extra[m.slug] || []), ...(m.tiendas || []).map(t => t.url)];
  if (!fuentes.length) continue;

  const candidatas = [];
  for (const f of fuentes) {
    if (esImagen(f)) { candidatas.push(f); continue; }
    try { candidatas.push(...imagenesDePagina(await traer(f), f)); }
    catch (e) { console.warn(`  ${m.slug}: no pude abrir ${new URL(f).hostname} (${e.message})`); }
    if (candidatas.length >= MAX_FOTOS * 2) break;
  }

  const guardadas = [], vistas = new Set();
  for (const u of candidatas) {
    if (guardadas.length >= MAX_FOTOS) break;
    try {
      const { buf, ct } = await traer(u, "bin");
      if (!/^image\//.test(ct) || buf.length < 15000) continue; // descarta miniaturas e íconos
      const huella = buf.length + ":" + buf.subarray(0, 64).toString("hex");
      if (vistas.has(huella)) continue; vistas.add(huella);
      guardadas.push({ buf, ext: extension(ct, u) });
    } catch {}
  }
  if (!guardadas.length) { console.warn(`✗ ${m.slug}: no encontré fotos`); continue; }
  if (existsSync(dir)) rmSync(dir, { recursive: true });
  mkdirSync(dir, { recursive: true });
  guardadas.forEach((g, i) => writeFileSync(new URL(`${i + 1}.${g.ext}`, dir), g.buf));
  total += guardadas.length;
  console.log(`✓ ${m.slug}: ${guardadas.length} foto(s)`);
}
console.log(`\nListo: ${total} foto(s) nuevas. Revisalas en public/fotos/ y después subí los cambios a GitHub.`);
