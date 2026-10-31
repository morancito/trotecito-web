// Lectura de tiendas: precio, precio de lista, cuotas, stock y talles de una página de producto.
// La usan el robot diario (actualizar-precios.mjs) y el buscador de ofertas (buscar-ofertas.mjs).
//
// Plataformas: VTEX (Sporting, Asics, Topper, Dash...), Salesforce (Dexter, Moov, New Balance), Magento (Gostore),
// Tiendanube (TodoTrail...), Shopify y WooCommerce. Si no reconoce la plataforma, usa los datos estándar de
// producto (JSON-LD) o las etiquetas de precio de la página.

export const UA = "Mozilla/5.0 (compatible; TrotecitoBot/1.0; +https://trotecito.com.ar/)";
export const dormir = ms => new Promise(r => setTimeout(r, ms));

export async function traer(url, json = false) {
  const r = await fetch(url, { headers: { "User-Agent": UA, "Accept-Language": "es-AR,es;q=0.9", Accept: json ? "application/json" : "text/html" },
    redirect: "follow", signal: AbortSignal.timeout(25000) });
  if (!r.ok) throw new Error(`HTTP ${r.status}`);
  return json ? r.json() : r.text();
}

/* Talles: se guardan solo los que tienen stock. "38-38.5" (Dexter) vale por los dos. AR = numeración argentina;
   US = numeración de EE. UU. (New Balance), que no se convierte porque la equivalencia cambia según la marca. */
export const talleAR = v => String(v).trim().replace(",", ".").replace(/\s*(ar|arg)$/i, "").split(/\s*-\s*/).filter(x => /^\d{2}(\.5)?$/.test(x) && +x >= 30 && +x <= 50);
export const ordenar = arr => [...new Set(arr)].sort((a, b) => parseFloat(a) - parseFloat(b));
export const num = v => (v == null || v === "" ? null : Math.round(parseFloat(String(v).replace(/[^\d.]/g, ""))));
const desescapar = s => s.replace(/&quot;/g, '"').replace(/&#34;/g, '"').replace(/&amp;/g, "&").replace(/&#39;/g, "'");
const cuotasDe = texto => +((texto.match(/Cuotas habituales\s*(\d+)\s*Cuotas sin inter/i) || texto.match(/(\d+)\s*cuotas sin inter[eé]s/i) || [])[1] || 0);
/* primero numeración argentina; si la tienda usa la de EE. UU. ("US 9 - 27cm"), se guarda como US */
const talleUS = v => { const m = String(v).match(/\bUS\s*(\d{1,2}(?:[.,]5)?)\b/i); return m ? [m[1].replace(",", ".")] : []; };
const conTalles = (lista) => {
  const t = ordenar(lista.flatMap(talleAR)); if (t.length) return { talles: t, sistema: "AR" };
  const u = ordenar(lista.flatMap(talleUS)); return u.length ? { talles: u, sistema: "US" } : {};
};

/* ---------- VTEX ---------- */
async function vtex(url) {
  const u = new URL(url);
  const prods = await traer(`${u.origin}/api/catalog_system/pub/products/search${u.pathname}`, true);
  const p = prods[0];
  if (!p) throw new Error("producto no encontrado");
  const ofertas = p.items.flatMap(i => i.sellers.map(s => s.commertialOffer)).filter(o => o.AvailableQuantity > 0 && o.Price > 0);
  if (!ofertas.length) return { sinStock: true };
  const o = ofertas.sort((a, b) => a.Price - b.Price)[0];
  const cuotas = Math.max(0, ...(o.Installments || []).filter(x => x.InterestRate === 0).map(x => x.NumberOfInstallments));
  const talles = p.items.filter(i => i.sellers.some(s => s.commertialOffer.AvailableQuantity > 0)).map(i => {
    const k = (i.variations || []).find(v => /talle|size|tama/i.test(v)); return k ? (i[k] || [])[0] || "" : ""; });
  return { precio: num(o.Price), antes: o.ListPrice > o.Price * 1.01 ? num(o.ListPrice) : null, cuotas, ...conTalles(talles) };
}

/* ---------- Salesforce: el stock por talle llega por Product-Variation ---------- */
async function tallesSfcc(url, h) {
  const ruta = (h.match(/\/on\/demandware\.store\/(Sites-[^/"']+\/[^/"']+)\/Product-Variation/) || [])[1];
  const pid = (h.match(/data-pid="([^"]+)"/) || [])[1] || (new URL(url).pathname.match(/([A-Z0-9][A-Z0-9_-]+)\.html$/) || [])[1];
  if (!ruta || !pid) return {};
  try {
    const j = await traer(`${new URL(url).origin}/on/demandware.store/${ruta}/Product-Variation?pid=${encodeURIComponent(pid)}&quantity=1`, true);
    const a = (j.product?.variationAttributes || []).find(x => x.id === "size");
    if (!a) return {};
    const disp = a.values.filter(v => v.selectable).map(v => String(v.value ?? v.displayValue));
    const ar = ordenar(disp.flatMap(talleAR));
    if (ar.length && ar.length >= disp.length * 0.8) return { talles: ar, sistema: "AR" };
    const us = ordenar(disp.filter(x => /^\d{1,2}(\.5)?$/.test(x)));
    return us.length ? { talles: us, sistema: "US" } : { talles: [], sistema: "AR" };
  } catch { return {}; }
}

/* ---------- Magento: talles en el jsonConfig del producto configurable ---------- */
function magento(h, texto) {
  const precio = num((h.match(/data-price-type="finalPrice"[^>]*data-price-amount="([\d.]+)"/) || h.match(/product:price:amount"\s+content="([\d.]+)"/) || [])[1]);
  if (!precio) return null;
  const lista = num((h.match(/data-price-type="oldPrice"[^>]*data-price-amount="([\d.]+)"/) || [])[1]);
  let tall = {};
  const i = h.indexOf('"jsonConfig"');
  if (i > 0) {
    const s = h.slice(h.indexOf("{", i)); let d = 0, j = 0;
    for (; j < s.length; j++) { if (s[j] === "{") d++; else if (s[j] === "}" && --d === 0) break; }
    try {
      const cfg = JSON.parse(s.slice(0, j + 1));
      const a = Object.values(cfg.attributes || {}).find(x => /size|talle/i.test(x.code + " " + x.label));
      if (a) { const disp = a.options.filter(o => o.products?.length).map(o => o.label); tall = conTalles(disp); if (!disp.length) tall = { talles: [], sistema: "AR" }; }
    } catch {}
  }
  const r = { precio, antes: lista > precio * 1.01 ? lista : null, cuotas: cuotasDe(texto), ...tall };
  if (r.talles && !r.talles.length) r.sinStock = true;
  return r;
}

/* ---------- Tiendanube: variantes en data-variants ---------- */
function tiendanube(h, texto) {
  const m = h.match(/data-variants="([^"]+)"/) || h.match(/data-variants='([^']+)'/);
  if (!m) return null;
  let vs; try { vs = JSON.parse(desescapar(m[1])); } catch { return null; }
  const disp = vs.filter(v => v.available !== false && (v.stock == null || v.stock > 0));
  if (!disp.length) return { sinStock: true };
  const o = disp.sort((a, b) => a.price_number - b.price_number)[0];
  const talle = v => [v.option0, v.option1, v.option2].find(x => x != null && (talleAR(x).length || talleUS(x).length)) || "";
  const antes = num(o.compare_at_price_number);
  const tall = conTalles(disp.map(talle));
  /* si no reconocemos los talles, dejamos una muestra de cómo los nombra la tienda (solo la usa el buscador para revisar) */
  if (!tall.talles) tall._muestra = disp.slice(0, 4).map(v => [v.option0, v.option1, v.option2].filter(x => x != null).join(" / "));
  return { precio: num(o.price_number), antes: antes > o.price_number * 1.01 ? antes : null, cuotas: cuotasDe(texto), ...tall };
}

/* ---------- Shopify: el producto en JSON en <url>.js ---------- */
async function shopify(url) {
  const p = await traer(url.replace(/[?#].*$/, "").replace(/\/$/, "") + ".js", true);
  const disp = (p.variants || []).filter(v => v.available);
  if (!disp.length) return { sinStock: true };
  const o = disp.sort((a, b) => a.price - b.price)[0];
  const talle = v => [v.option1, v.option2, v.option3].find(x => x != null && talleAR(x).length) || "";
  return { precio: Math.round(o.price / 100), antes: o.compare_at_price > o.price * 1.01 ? Math.round(o.compare_at_price / 100) : null, cuotas: 0, ...conTalles(disp.map(talle)) };
}

/* ---------- WooCommerce: variaciones en data-product_variations ---------- */
function woo(h, texto) {
  const m = h.match(/data-product_variations="([^"]+)"/);
  if (!m) return null;
  let vs; try { vs = JSON.parse(desescapar(m[1])); } catch { return null; }
  if (!Array.isArray(vs)) return null;
  const disp = vs.filter(v => v.is_in_stock && v.is_purchasable !== false);
  if (!disp.length) return { sinStock: true };
  const o = disp.sort((a, b) => a.display_price - b.display_price)[0];
  const talle = v => Object.entries(v.attributes || {}).find(([k]) => /talle|size|numero/i.test(k))?.[1] || "";
  return { precio: num(o.display_price), antes: o.display_regular_price > o.display_price * 1.01 ? num(o.display_regular_price) : null, cuotas: cuotasDe(texto), ...conTalles(disp.map(talle)) };
}

/* ---------- respaldo: Salesforce sin talles, JSON-LD o etiquetas de precio ---------- */
function generico(h, texto) {
  if (/demandware/i.test(h)) {
    const precio = num((h.match(/class="sales"[\s\S]{0,300}?content="([\d.]+)"/) || [])[1]);
    if (precio) {
      const lista = num((h.match(/strike-through[\s\S]{0,300}?content="([\d.]+)"/) || [])[1]);
      const sinStock = /sin stock|producto agotado/i.test(texto) && !/agregar al carrito/i.test(texto);
      return { precio, antes: lista > precio * 1.01 ? lista : null, cuotas: cuotasDe(texto), sinStock };
    }
  }
  for (const m of h.matchAll(/<script[^>]+ld\+json[^>]*>([\s\S]*?)<\/script>/gi)) {
    try {
      let precio = null, stock = true;
      const walk = o => { if (!o || typeof o !== "object") return; if (Array.isArray(o)) return o.forEach(walk);
        if (o.offers) [].concat(o.offers).forEach(of => { const v = num(of.price ?? of.lowPrice); if (v && (!precio || v < precio)) precio = v; if (/OutOfStock/i.test(of.availability || "")) stock = false; });
        Object.values(o).forEach(walk); };
      walk(JSON.parse(m[1].trim()));
      if (precio) return { precio, antes: null, cuotas: cuotasDe(texto), sinStock: !stock };
    } catch {}
  }
  const meta = num((h.match(/(?:product:price:amount|og:price:amount)["'][^>]*content=["']([\d.,]+)/i) || [])[1]);
  if (meta) return { precio: meta, antes: null, cuotas: cuotasDe(texto) };
  throw new Error("no encontré el precio en la página");
}

export async function leer(url) {
  if (/\/p\/?$/.test(new URL(url).pathname)) { try { return await vtex(url); } catch (e) { if (!/404/.test(e.message)) throw e; } }
  const h = await traer(url), texto = h.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ");
  if (/cdn\.shopify\.com|Shopify\.theme/.test(h)) { try { return await shopify(url); } catch {} }
  if (/x-magento-init|Magento_/.test(h)) { const r = magento(h, texto); if (r) return r; }
  if (/data-variants=/.test(h)) { const r = tiendanube(h, texto); if (r) return r; }
  if (/data-product_variations=/.test(h)) { const r = woo(h, texto); if (r) return r; }
  const r = generico(h, texto);
  if (/demandware/i.test(h) && !r.sinStock) { Object.assign(r, await tallesSfcc(url, h)); if (r.talles && !r.talles.length) r.sinStock = true; }
  return r;
}
