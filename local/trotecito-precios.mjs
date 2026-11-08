// Trotecito · precios desde tu compu
// Lee Nike, adidas y Digital Sport (las tiendas que bloquean al robot de GitHub) desde tu conexión, presentándose
// honestamente como el robot de Trotecito, y sube los archivos a datos-manuales/ del repo en un solo envío. Al llegar,
// GitHub los importa solo (workflow "Importar datos manuales"), igual que con el marcador.
// Si una tienda no responde o bloquea, se saltea: esa sigue con el marcador.
//
// Lo corre la tarea programada que crea instalar.ps1. A mano:  node trotecito-precios.mjs [--probar] [nike adidas digitalsport]
//   --probar: lee las tiendas y guarda los archivos en esta carpeta, sin subir nada.
// Necesita Node 18 o más nuevo y la variable TROTECITO_TOKEN (token de GitHub con permiso Contents: lectura y escritura
// solo sobre morancito/trotecito-web). correr.ps1 la carga desde el archivo cifrado con tu usuario de Windows.
import { writeFileSync } from "node:fs";

const REPO = "morancito/trotecito-web", CARPETA = "datos-manuales";
const UA = "Mozilla/5.0 (compatible; TrotecitoBot/1.0; +https://trotecito.com.ar/)";
const args = process.argv.slice(2), PROBAR = args.includes("--probar");
const PEDIDAS = args.filter(a => !a.startsWith("--")).map(a => a.toLowerCase());
const quiero = t => !PEDIDAS.length || PEDIDAS.includes(t);
const espera = ms => new Promise(r => setTimeout(r, ms));
const hoy = new Date().toISOString().slice(0, 10);
const log = (...x) => console.log(new Date().toLocaleTimeString("es-AR"), ...x);

async function pedir(url, json = false) {
  const r = await fetch(url, { headers: { "User-Agent": UA, "Accept-Language": "es-AR,es;q=0.9", Accept: json ? "application/json" : "text/html" }, signal: AbortSignal.timeout(30000) });
  if (!r.ok) throw new Error(`HTTP ${r.status}`);
  return json ? r.json() : r.text();
}
const texto = h => String(h || "").replace(/<script[\s\S]*?<\/script>|<style[\s\S]*?<\/style>/gi, " ").replace(/<[^>]+>/g, " ").replace(/&nbsp;/g, " ").replace(/&amp;/g, "&").replace(/\s+/g, " ").trim();
const norm = x => String(x || "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]+/g, " ").trim();
const num = s => Number(String(s || "").replace(/\./g, "").replace(",", ".")) || 0;

/* ---------- Nike (API de catálogo VTEX) ---------- */
async function nike() {
  const B = "https://www.nike.com.ar";
  const qs = ["pegasus", "vomero", "structure", "winflo", "invincible", "zoom fly", "vaporfly", "alphafly", "quest", "revolution", "kiger", "zegama", "ultrafly", "infinity"];
  const prods = new Map();
  for (const q of qs) for (const f of [0, 50, 100]) {
    let a = [];
    try { a = await pedir(`${B}/api/catalog_system/pub/products/search?ft=${encodeURIComponent(q)}&_from=${f}&_to=${f + 49}`, true); }
    catch (e) { if (!prods.size) throw e; log(`  nike · ${q}: ${e.message}`); }
    for (const p of a) prods.set(p.productId, {
      productId: p.productId, productName: p.productName, link: p.link, categories: p.categories, "Color PDP": p["Color PDP"],
      imagen: p.items?.[0]?.images?.[0]?.imageUrl, imagenes: (p.items?.[0]?.images || []).slice(0, 5).map(i => i.imageUrl),
      items: (p.items || []).map(i => ({ name: i.name, talle: i.talle || i.Talle, sellers: (i.sellers || []).map(s => ({ commertialOffer: {
        Price: s.commertialOffer.Price, ListPrice: s.commertialOffer.ListPrice, AvailableQuantity: s.commertialOffer.AvailableQuantity,
        Installments: (s.commertialOffer.Installments || []).filter(x => x.InterestRate === 0).map(x => ({ NumberOfInstallments: x.NumberOfInstallments, InterestRate: 0 })) } })) })),
    });
    log(`  nike · ${q} (${f}): ${a.length}`);
    if (a.length < 50) break;
    await espera(1500);
  }
  return { tienda: "nike", fecha: new Date().toISOString(), productos: [...prods.values()] };
}

/* ---------- adidas (su API de listados y de stock por talle) ---------- */
async function adidas() {
  const B = "https://www.adidas.com.ar";
  const qs = ["adizero evo sl", "adizero sl", "adizero boston", "adios pro", "takumi sen", "supernova", "duramo", "adistar", "ultraboost", "agravic", "terrex"];
  const items = new Map(), disp = {};
  const juntar = (o, prof = 0) => {
    if (!o || typeof o !== "object" || prof > 12) return;
    if (Array.isArray(o)) return o.forEach(x => juntar(x, prof + 1));
    const id = o.productId || o.modelId, nombre = o.displayName || o.name || o.title, precio = o.salePrice ?? o.price ?? o.pricing?.salePrice ?? o.pricing?.price;
    if (id && nombre && (typeof precio === "number" || /^\d/.test(String(precio || "")))) items.set(o.productId || id, { productId: o.productId || id, displayName: nombre, link: o.link || o.url || o.href || "",
      price: +(o.price ?? o.pricing?.standard_price ?? o.pricing?.price ?? precio), salePrice: +(o.salePrice ?? o.pricing?.sale_price ?? o.pricing?.salePrice ?? precio), gender: o.gender || o.genderCode || null });
    for (const v of Object.values(o)) if (v && typeof v === "object") juntar(v, prof + 1);
  };
  /* su API de listados y, si no contesta, los datos que trae la página (__NEXT_DATA__) */
  let primerError = null;
  const pagina = async (api, html) => {
    const antes = items.size;
    try { juntar(await pedir(B + api, true)); } catch (e) { primerError ??= e; }
    if (items.size === antes) try {
      const nd = (await pedir(B + html)).match(/<script id="__NEXT_DATA__"[^>]*>([\s\S]*?)<\/script>/);
      if (nd) juntar(JSON.parse(nd[1]));
    } catch (e) { primerError ??= e; }
    return items.size - antes;
  };
  for (let start = 0; start < 960; start += 48) {
    const n = await pagina(`/api/plp/content-engine?query=calzado-zapatillas-running&start=${start}`, `/calzado-zapatillas-running?start=${start}`);
    log(`  adidas · running ${start}: ${n}`);
    if (!n) break;
    await espera(1200);
  }
  if (!items.size && primerError) throw primerError;
  for (const q of qs) { await pagina(`/api/plp/content-engine/search?query=${encodeURIComponent(q)}&start=0`, `/search?q=${encodeURIComponent(q)}`); await espera(1000); }
  for (const [id, it] of items) if (!/zapatilla|calzado|shoe/i.test(`${it.displayName} ${it.link}`)) items.delete(id);
  for (const id of items.keys()) { try { disp[id] = await pedir(`${B}/api/products/${id}/availability`, true); } catch {} await espera(500); }
  log(`  adidas · ${items.size} zapatillas, ${Object.keys(disp).length} con talles`);
  return { tienda: "adidas", fecha: new Date().toISOString(), items: [...items.values()], disp };
}

/* ---------- Digital Sport (listado de running de Sport 78 y página de cada modelo nuestro) ---------- */
async function digitalSport(cat) {
  const B = "https://www.digitalsport.com.ar";
  const claves = [...new Set(cat.modelos.filter(m => !m.borrador).map(m => norm(`${m.mod} ${m.ver || ""}`)))].map(k => k.split(" ").filter(Boolean));
  const lista = new Map();
  for (const [dis, nom] of [[12, "running"], [10, "trail"]]) for (let p = 1; p <= 40; p++) {
    let html = "";
    try { html = await pedir(`${B}/sport78/prods/?category[1]=1&discipline=${dis}&page=${p}`); }
    catch (e) { if (!lista.size) throw e; log(`  digital sport · ${nom} página ${p}: ${e.message}`); break; }
    let nuevos = 0;
    for (const [, href, cont] of html.matchAll(/<a\b[^>]*href="([^"]*\/prod\/[^"]*)"[^>]*>([\s\S]*?)<\/a>/gi)) {
      let u; try { u = new URL(href, B); } catch { continue; }
      const k = u.origin + u.pathname, t = texto(cont);
      if (!t) continue;
      if (!lista.has(k)) nuevos++;
      lista.set(k, ((lista.get(k) || "") + " " + t).trim());
    }
    log(`  digital sport · ${nom} página ${p}: ${lista.size} zapas`);
    if (!nuevos) break;
    await espera(1200);
  }
  const nuestros = [...lista].filter(([u, t]) => { const n = ` ${norm(t + " " + decodeURIComponent(u))} `; return claves.some(k => k.every(w => n.includes(` ${w} `))); });
  const productos = [];
  for (const [url, txt] of nuestros) {
    try {
      const h = await pedir(url);
      const nombre = texto((h.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i) || [])[1]) || txt;
      const precio = num((h.match(/class="price"[^>]*>[^<]*<span[^>]*>([^<]+)</i) || [])[1]) || num((txt.match(/\$\s*([\d.]+)/) || [])[1]);
      const pr = txt.match(/\$\s*([\d.]+)\s*\|\s*\$\s*([\d.]+)/), antes = pr ? num(pr[2]) : 0;
      const bc = texto((h.match(/class="breadcrumb"[^>]*>([\s\S]*?)<\/div>/i) || [])[1]).toUpperCase();
      const talles = [...new Set([...h.matchAll(/<input\b[^>]*name="size"[^>]*>/gi)].filter(([i]) => !/\bdisabled\b/i.test(i)).map(([i]) => {
        const id = (i.match(/\bid="([^"]+)"/) || [])[1]; if (!id) return null;
        const lab = texto((h.match(new RegExp(`<label[^>]*for="${id}"[^>]*>([\\s\\S]*?)</label>`, "i")) || [])[1]);
        return (lab.match(/(\d{2}(?:[.,]5)?)\s*ARG/i) || [])[1]?.replace(",", ".");
      }).filter(Boolean))].sort((a, b) => a - b);
      if (precio) productos.push({ nombre, url, precio, antes: antes > precio * 1.01 ? antes : null, cuotas: Number((txt.match(/(\d+)\s*CUOTAS/i) || [])[1]) || 0,
        nota: /PARA MUJER/.test(bc) ? "Mujer" : /PARA HOMBRE/.test(bc) ? "Hombre" : /UNISEX/.test(bc) ? "Unisex" : "", talles, sistema: "AR" });
    } catch (e) { log(`  digital sport · ${url}: ${e.message}`); }
    await espera(1200);
  }
  log(`  digital sport · ${productos.length} de nuestros modelos`);
  return { tienda: "Digital Sport", plataforma: "lista", fecha: new Date().toISOString(), listado: lista.size, productos };
}

/* ---------- subir todo en un solo commit (así el importador corre una vez) ---------- */
async function subir(archivos) {
  const token = process.env.TROTECITO_TOKEN;
  if (!token) throw new Error("Falta TROTECITO_TOKEN (corré instalar.ps1 de nuevo)");
  const gh = async (ruta, metodo = "GET", cuerpo) => {
    const r = await fetch(`https://api.github.com/repos/${REPO}${ruta}`, { method: metodo, body: cuerpo && JSON.stringify(cuerpo),
      headers: { Authorization: `Bearer ${token}`, Accept: "application/vnd.github+json", "User-Agent": "trotecito-local", "X-GitHub-Api-Version": "2022-11-28" } });
    if (!r.ok) throw new Error(`GitHub ${metodo} ${ruta}: HTTP ${r.status} ${(await r.text()).slice(0, 200)}`);
    return r.json();
  };
  for (let intento = 1; intento <= 3; intento++) {
    const ref = await gh("/git/ref/heads/main"), padre = await gh(`/git/commits/${ref.object.sha}`);
    const tree = await gh("/git/trees", "POST", { base_tree: padre.tree.sha, tree: await Promise.all(archivos.map(async ([nombre, datos]) => ({
      path: `${CARPETA}/${nombre}`, mode: "100644", type: "blob", sha: (await gh("/git/blobs", "POST", { content: JSON.stringify(datos), encoding: "utf-8" })).sha }))) });
    const commit = await gh("/git/commits", "POST", { message: `Precios desde la compu: ${archivos.map(([n]) => n.replace(/-\d{4}.*$/, "")).join(", ")}`, tree: tree.sha, parents: [ref.object.sha] });
    try { await gh("/git/refs/heads/main", "PATCH", { sha: commit.sha }); return; }
    catch (e) { if (intento === 3) throw e; log("  main cambió mientras subía, reintento…"); await espera(4000); }
  }
}

/* ---------- principal ---------- */
const cat = await pedir("https://trotecito.com.ar/data/modelos.json", true);
const TIENDAS = [["nike", "Nike", () => nike()], ["adidas", "adidas", () => adidas()], ["digitalsport", "Digital Sport", () => digitalSport(cat)]];
const archivos = [], resumen = [];
for (const [clave, nombre, leer] of TIENDAS) {
  if (!quiero(clave)) continue;
  log(`${nombre}…`);
  try {
    const d = await leer(), n = (d.productos || d.items || []).length;
    if (!n) throw new Error("no trajo productos");
    archivos.push([`${clave}-${hoy}-${Date.now().toString(36)}.json`, d]);
    resumen.push(`✓ ${nombre}: ${n} productos`);
  } catch (e) {
    resumen.push(`✗ ${nombre}: ${e.message}${/HTTP 40[13]|HTTP 429/.test(e.message) ? " (la tienda no deja entrar al robot desde tu conexión: esa sigue con el marcador)" : ""}`);
  }
}
if (archivos.length && PROBAR) for (const [n, d] of archivos) writeFileSync(n, JSON.stringify(d));
else if (archivos.length) { log("Subiendo a GitHub…"); await subir(archivos); resumen.push(`Subido a ${CARPETA}/: en unos minutos los precios están en el sitio.`); }
console.log("\n" + resumen.join("\n"));
if (!archivos.length) process.exitCode = 1;
