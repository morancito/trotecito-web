// Prueba de la API de Mercado Libre: qué se puede consultar con la app de Trotecito (token de la app, sin usuario).
// Para 5 modelos prueba el buscador público, el buscador de catálogo, la ficha de catálogo y sus publicaciones.
// No escribe nada; solo imprime qué responde cada consulta. Usa ML_CLIENT_ID y ML_CLIENT_SECRET (secretos de GitHub).
//   node scripts/ml-prueba.mjs
const API = "https://api.mercadolibre.com";
const { ML_CLIENT_ID: id, ML_CLIENT_SECRET: secreto } = process.env;
if (!id || !secreto) { console.error("Faltan ML_CLIENT_ID / ML_CLIENT_SECRET."); process.exit(1); }

const t = await fetch(`${API}/oauth/token`, { method: "POST", headers: { "content-type": "application/x-www-form-urlencoded", accept: "application/json" },
  body: new URLSearchParams({ grant_type: "client_credentials", client_id: id, client_secret: secreto }) });
const tok = await t.json().catch(() => ({}));
if (!tok.access_token) { console.error(`Token: HTTP ${t.status} ${tok.error || ""} ${tok.message || ""}`); process.exit(1); }
console.log(`Token de la app: OK (vence en ${Math.round((tok.expires_in || 0) / 3600)} h, permisos: ${tok.scope || "—"})\n`);

const espera = ms => new Promise(r => setTimeout(r, ms));
async function api(ruta) {
  const r = await fetch(API + ruta, { headers: { authorization: `Bearer ${tok.access_token}`, accept: "application/json" } });
  const j = await r.json().catch(() => null);
  await espera(400);
  return { s: r.status, j };
}
const pesos = n => n == null ? "—" : "$" + Math.round(n).toLocaleString("es-AR");
const MODELOS = ["Nike Pegasus 41", "Hoka Clifton 10", "Asics Novablast 5", "Asics Gel Kayano 32", "Adidas Supernova Rise 3"];

const norm = x => String(x || "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]+/g, " ").trim();
for (const q of MODELOS) {
  console.log(`## ${q}`);
  const pal = norm(q).split(" ").slice(1);
  const b = await api(`/sites/MLA/search?q=${encodeURIComponent(q)}&limit=3`);
  console.log(`  buscador público: HTTP ${b.s}`);
  /* fichas del catálogo con el nombre exacto (todas las palabras, y sin "trail" si el modelo no lo es) */
  const fichas = new Map();
  for (let off = 0; off < 200; off += 50) {
    const c = await api(`/products/search?status=active&site_id=MLA&domain_id=MLA-SNEAKERS&q=${encodeURIComponent(q)}&limit=50&offset=${off}`);
    if (c.s !== 200) { console.log(`  catálogo: HTTP ${c.s} ${c.j?.message || ""}`); break; }
    for (const f of c.j?.results || []) { const n = ` ${norm(f.name)} `; if (pal.every(w => n.includes(` ${w} `)) && !/ trail | gtx | ninos | nino | kids /.test(n)) fichas.set(f.id, f.name); }
    if (!(c.j?.results || []).length) break;
  }
  console.log(`  fichas del modelo exacto: ${fichas.size}`);
  let conPrecio = 0, oficiales = 0; const precios = [];
  for (const [id, nombre] of [...fichas].slice(0, 25)) {
    const it = await api(`/products/${id}/items?limit=20`);
    const pubs = it.s === 200 ? it.j?.results || [] : [];
    if (!pubs.length) continue;
    conPrecio++;
    for (const x of pubs) { precios.push(x.price); if (x.official_store_id) oficiales++; }
    if (conPrecio <= 4) {
      console.log(`    ${id} · ${nombre}`);
      for (const x of pubs.slice(0, 4)) console.log(`      ${pesos(x.price)}${x.original_price ? ` (antes ${pesos(x.original_price)})` : ""} · ${x.official_store_id ? "tienda oficial " + x.official_store_id : "vendedor " + x.seller_id} · ${x.condition || ""}${x.shipping?.free_shipping ? " · envío gratis" : ""}`);
    }
  }
  console.log(`  revisadas ${Math.min(25, fichas.size)}: ${conPrecio} con publicaciones · ${precios.length} precios (${oficiales} de tiendas oficiales)${precios.length ? ` · de ${pesos(Math.min(...precios))} a ${pesos(Math.max(...precios))}` : ""}`);
  const uno = [...fichas.keys()][0];
  if (uno) { const p = await api(`/products/${uno}`); const a = Object.fromEntries((p.j?.attributes || []).map(x => [x.id, x.value_name])); console.log(`  ejemplo de ficha: talle ${a.SIZE || "—"} · género ${a.GENDER || "—"} · color ${a.COLOR || "—"}`); }
  console.log("");
}
