// Fotos de producto desde la página de una tienda (VTEX, Salesforce, Magento, Tiendanube u og:image).
import { traer } from "./tiendas.mjs";

export const errores = [];
export async function imagenes(url) {
  const u = new URL(url);
  if (/\/p\/?$/.test(u.pathname)) {                       // VTEX (si la API no da fotos, sigue con la página)
    try {
      const p = (await traer(`${u.origin}/api/catalog_system/pub/products/search${u.pathname}`, true))[0];
      const vistas = new Map();
      for (const it of p?.items || []) for (const i of it.images || []) if (!vistas.has(i.imageId)) vistas.set(i.imageId, i.imageUrl);
      if (vistas.size) return [...vistas.values()];
    } catch (e) { errores.push(`${url}: API ${e.message}`); }
  }
  const h = await traer(url), out = [];
  for (const m of h.matchAll(/\/on\/demandware\.static\/[^"'\s]+?\/products\/([A-Z0-9_-]+)\/\1-(\d+)\.(?:JPG|jpg|jpeg|png)/g))   // Salesforce (Dexter, Moov)
    out.push([+m[2], u.origin + m[0].replace(/\/dw\/image\/v2\/[A-Z_]+/, "")]);
  if (out.length) { const orden = [1, 2, 6, 5, 3, 4]; return [...new Map(out.map(x => [x[0], x[1]]))].sort((a, b) => (orden.indexOf(a[0]) + 1 || 99) - (orden.indexOf(b[0]) + 1 || 99)).map(x => x[1]); }
  const full = [...h.matchAll(/"full":"([^"]+)"/g)].map(m => m[1].replace(/\\\//g, "/"));            // Magento (Gostore)
  if (full.length) return [...new Set(full)];
  const nube = [...h.matchAll(/((?:https?:)?\/\/[^"'\s,]*mitiendanube\.com\/stores\/[^"'\s,]+\/products\/[^"'\s,]+?)-(?:\d+)-(?:\d+)\.(webp|jpe?g|png)/g)]
    .map(m => (m[1].startsWith("//") ? "https:" + m[1] : m[1]) + "-1024-1024." + m[2]);                  // Tiendanube
  if (nube.length) return [...new Set(nube)];
  const og = [...h.matchAll(/<meta[^>]+property="og:image"[^>]+content="([^"]+)"/g)].map(m => m[1]);
  return [...new Set(og)];
}

