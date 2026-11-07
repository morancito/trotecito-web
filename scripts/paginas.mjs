// Después de `vite build`: arma una página real por modelo en dist/zapa/<modelo>/index.html, con título,
// descripción, imagen para compartir (WhatsApp, Instagram, X), datos estructurados para Google y el contenido
// básico de la ficha en el HTML. También genera sitemap.xml, robots.txt y 404.html.
// Como corre en cada compilación, los precios de estas páginas se renuevan con cada pasada del robot.
import { readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";

const SITIO = (process.env.SITIO_URL || "https://trotecito.com.ar").replace(/\/$/, "");
const BASE = (process.env.BASE_PATH || "/").replace(/\/?$/, "/");
const DIST = new URL("../dist/", import.meta.url);
const cat = JSON.parse(readFileSync(new URL("../public/data/modelos.json", import.meta.url), "utf8"));

/* talles: lo que una tienda publica en numeración de EE. UU. se pasa a argentina con la tabla de esa marca y género
   (public/data/talles.json, armada con lo que publican Dexter y Stock Center). Se aplica a las copias de dist/data,
   así vale para todo lo que llega en US (robot, marcador, colores). Si falta algún talle en la tabla, queda en US. */
const TABLA = existsSync(new URL("../public/data/talles.json", import.meta.url)) ? JSON.parse(readFileSync(new URL("../public/data/talles.json", import.meta.url), "utf8")) : {};
function aAR(marca, x) {
  if (x?.sistema !== "US" || !x.talles?.length) return false;
  const fila = TABLA[marca]?.[x.nota === "Mujer" ? "Mujer" : "Hombre"]; if (!fila) return false;
  const ar = x.talles.map(t => fila[String(t)]);
  if (ar.some(v => !v)) return false;
  x.us = x.talles; x.talles = [...new Set(ar)].sort((a, b) => a - b); x.sistema = "AR"; return true;
}
let convertidos = 0;
for (const m of cat.modelos) for (const t of m.tiendas || []) if (aAR(m.m, t)) convertidos++;
writeFileSync(new URL("data/modelos.json", DIST), JSON.stringify(cat));
const colArch = new URL("data/colores.json", DIST);
if (existsSync(colArch)) { const col = JSON.parse(readFileSync(colArch, "utf8")); const marcaDe = Object.fromEntries(cat.modelos.map(m => [m.slug, m.m]));
  for (const [slug, vs] of Object.entries(col)) if (Array.isArray(vs)) for (const v of vs) if (aAR(marcaDe[slug], v)) convertidos++;
  writeFileSync(colArch, JSON.stringify(col)); }
console.log(`Talles: ${convertidos} listas pasadas de US a numeración argentina.`);
/* índice de todas las zapas en el pie, en el HTML: así Google (y quien no tiene JavaScript) llega a cada ficha desde cualquier página */
const marcas = [...new Set(cat.modelos.filter(m => !m.borrador).map(m => m.m))].sort((a, b) => a.localeCompare(b, "es"));
const indice = `<details class="indice"><summary>Todas las zapas (${cat.modelos.filter(m => !m.borrador).length})</summary><div class="ind-cols">${marcas.map(mc => `<div><h3>${mc}</h3><ul>${cat.modelos.filter(m => !m.borrador && m.m === mc)
  .sort((a, b) => `${a.mod} ${a.ver || ""}`.localeCompare(`${b.mod} ${b.ver || ""}`, "es", { numeric: true })).map(m => `<li><a href="${BASE}zapa/${m.slug}/">${m.mod}${m.ver ? " " + m.ver : ""}</a></li>`).join("")}</ul></div>`).join("")}</div></details>`;
const plantilla = readFileSync(new URL("index.html", DIST), "utf8").replace("<!--indice-->", indice);

const esc = s => String(s ?? "").replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
const fmt = n => "$" + Math.round(n).toLocaleString("es-AR");
const abs = p => SITIO + BASE + p.replace(/^\//, "");
const nombre = m => `${m.mod}${m.ver ? " " + m.ver : ""}`;
const USO = { "Iniciación": "para empezar a correr", "Rodaje diario": "para entrenar todos los días", "Rodaje largo": "para fondos largos", "Ritmo": "para series y ritmos rápidos", "Competencia": "para competir" };
const hoyAR = new Intl.DateTimeFormat("es-AR", { timeZone: "America/Argentina/Buenos_Aires", day: "2-digit", month: "2-digit", year: "numeric" }).format(new Date());
const aMs = f => { const [d, mo, y] = String(f || "").split("/").map(Number); return y ? Date.UTC(y, mo - 1, d) : 0; };
const vigentes = m => (m.tiendas || []).filter(t => !t.sinStock && aMs(t.fecha) && aMs(hoyAR) - aMs(t.fecha) <= 1 * 864e5).sort((a, b) => a.precio - b.precio);

function cabecera(html, { titulo, desc, url, img, ld }) {
  const meta = `
<title>${esc(titulo)}</title>
<meta name="description" content="${esc(desc)}">
<link rel="canonical" href="${esc(url)}">
<meta property="og:site_name" content="Trotecito">
<meta property="og:locale" content="es_AR">
<meta property="og:type" content="${ld?.["@type"] === "Product" ? "product" : "website"}">
<meta property="og:title" content="${esc(titulo)}">
<meta property="og:description" content="${esc(desc)}">
<meta property="og:url" content="${esc(url)}">
<meta property="og:image" content="${esc(img)}">
<meta property="og:image:width" content="1200">
<meta property="og:image:height" content="630">
<meta name="twitter:card" content="summary_large_image">
${ld ? `<script type="application/ld+json">${JSON.stringify(ld).replace(/</g, "\\u003c")}</script>` : ""}`;
  return html
    .replace(/<title>[\s\S]*?<\/title>\s*/, "")
    .replace(/<meta name="description"[^>]*>\s*/, "")
    .replace(/<meta property="og:[^>]*>\s*/g, "")
    .replace("</head>", meta + "\n</head>");
}

/* portada */
const descHome = "Compará las zapatillas de running que se consiguen en Argentina: ficha técnica, para qué corredor es cada una y los precios de cada tienda, de la más barata a la más cara.";
writeFileSync(new URL("index.html", DIST), cabecera(plantilla, {
  titulo: "Trotecito · Zapatillas de running en Argentina, comparadas", desc: descHome, url: SITIO + BASE, img: abs("og/trotecito.jpg"),
  ld: { "@context": "https://schema.org", "@type": "WebSite", name: "Trotecito", url: SITIO + BASE, inLanguage: "es-AR" },
}));
writeFileSync(new URL("404.html", DIST), cabecera(plantilla, { titulo: "No encontramos esa página · Trotecito", desc: descHome, url: SITIO + BASE, img: abs("og/trotecito.jpg") }));

/* una página por modelo */
const urls = [SITIO + BASE];
for (const m of cat.modelos.filter(x => !x.borrador)) {
  const t = vigentes(m), min = t[0]?.precio, max = t[t.length - 1]?.precio, n = nombre(m);
  const url = abs(`zapa/${m.slug}/`);
  const img = existsSync(new URL(`../public/og/${m.slug}.jpg`, import.meta.url)) ? abs(`og/${m.slug}.jpg`) : m.fotos?.[0] ? abs(m.fotos[0]) : abs("og/trotecito.jpg");
  const specs = [m.peso && `${m.peso} g`, m.drop != null && `drop ${m.drop} mm`, m.talon && `${m.talon} mm de espuma en el talón`].filter(Boolean).join(", ");
  const pisada = m.tipo === "Estabilidad" ? "con estabilidad para pronadores" : "neutra";
  const desc = `${m.m} ${n}: zapatilla ${m.terreno === "Trail" ? "de trail " : ""}${pisada}, ${USO[m.uso] || ""}${specs ? `. ${specs[0].toUpperCase() + specs.slice(1)}` : ""}.`
    + (min ? ` Precio en Argentina desde ${fmt(min)}${t.length > 1 ? ` en ${t.length} ofertas` : ` en ${t[0].tienda}`}.` : "");
  const titulo = `${m.m} ${n}: precio en Argentina y ficha técnica · Trotecito`;
  const ld = {
    "@context": "https://schema.org", "@type": "Product", name: `${m.m} ${n}`, brand: { "@type": "Brand", name: m.m },
    image: (m.fotos || []).map(abs), description: desc, category: "Zapatillas de running", url,
    additionalProperty: [["Peso", m.peso && `${m.peso} g`], ["Drop", m.drop != null && `${m.drop} mm`], ["Altura en el talón", m.talon && `${m.talon} mm`],
      ["Altura en el antepié", m.ante && `${m.ante} mm`], ["Espuma", m.esp], ["Pisada", m.tipo === "Estabilidad" ? "Pronadora" : "Neutra"], ["Terreno", m.terreno || "Asfalto"]]
      .filter(([, v]) => v).map(([name, value]) => ({ "@type": "PropertyValue", name, value })),
  };
  if (min) ld.offers = { "@type": "AggregateOffer", priceCurrency: "ARS", lowPrice: min, highPrice: max, offerCount: t.length,
    offers: t.map(x => ({ "@type": "Offer", price: x.precio, priceCurrency: "ARS", url: x.url, availability: "https://schema.org/InStock", seller: { "@type": "Organization", name: x.tienda } })) };

  /* contenido básico de la ficha en el HTML: lo lee Google y lo ve quien no tiene JavaScript; la app lo reemplaza al cargar */
  const c = m.corredor || {};
  const cuerpo = `<article class="seo">
  <a class="back" href="${BASE}#catalogo">← Todas las zapas</a>
  <p class="kicker">${esc(m.m)}</p><h1 class="cond">${esc(n)}</h1>
  ${m.fotos?.[0] ? `<img src="${BASE}${esc(m.fotos[0])}" alt="${esc(m.m + " " + n)}" width="800" height="800">` : ""}
  <p>${esc(desc)}</p>
  ${t.length ? `<h2>Dónde comprarla</h2><ul>${t.map(x => `<li><a href="${esc(x.url)}" rel="nofollow noopener" target="_blank">${esc(x.tienda)}</a>${x.nota ? ` (${esc(x.nota.toLowerCase())})` : ""}: ${fmt(x.precio)}${x.talles?.length ? ` · talles con stock: ${x.sistema === "US" ? "US " : ""}${x.talles.join(", ")}` : ""} · chequeado el ${esc(x.fecha)}</li>`).join("")}</ul>` : ""}
  <h2>Ficha técnica</h2><ul>${[["Peso", m.peso && `${m.peso} g`], ["Drop", m.drop != null && `${m.drop} mm`], ["Talón", m.talon && `${m.talon} mm`], ["Antepié", m.ante && `${m.ante} mm`], ["Espuma", m.esp], ["Placa", m.pl && m.pl !== "Sin placa" ? m.pl : ""]].filter(([, v]) => v).map(([k, v]) => `<li>${k}: ${esc(v)}</li>`).join("")}</ul>
  ${c.peso ? `<h2>¿Para quién?</h2><ul><li>Pisada: ${m.tipo === "Estabilidad" ? "pronadora" : "neutra o supinadora"}</li><li>Tu peso: ${esc(c.peso)}</li><li>Ritmo: ${esc(c.ritmo)}</li><li>Distancias: ${esc(c.distancia)}</li></ul>` : ""}
  ${m.evitar ? `<p><b>No te conviene si</b> ${esc(m.evitar)}</p>` : ""}
</article>`;
  let html = cabecera(plantilla, { titulo, desc, url, img, ld })
    .replace('<div id="home">', '<div id="home" hidden>')
    .replace('<div id="detalle" class="wrap det" hidden></div>', `<div id="detalle" class="wrap det">${cuerpo}</div>`);
  if (!html.includes('<div id="home" hidden>') || !html.includes('class="seo"')) throw new Error("No encontré dónde insertar la ficha en index.html");
  mkdirSync(new URL(`zapa/${m.slug}/`, DIST), { recursive: true });
  writeFileSync(new URL(`zapa/${m.slug}/index.html`, DIST), html);
  urls.push(url);
}

writeFileSync(new URL("sitemap.xml", DIST), `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls.map(u => `  <url><loc>${esc(u)}</loc></url>`).join("\n")}
</urlset>
`);
writeFileSync(new URL("robots.txt", DIST), `User-agent: *\nAllow: /\nDisallow: ${BASE}admin.html\nDisallow: ${BASE}herramientas.html\n\nSitemap: ${SITIO + BASE}sitemap.xml\n`);
console.log(`Páginas: ${urls.length - 1} fichas + portada, sitemap y 404 (${SITIO}).`);
