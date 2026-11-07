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

for (const q of MODELOS) {
  console.log(`## ${q}`);
  const b = await api(`/sites/MLA/search?q=${encodeURIComponent(q)}&limit=3`);
  console.log(`  buscador público: HTTP ${b.s}${b.s === 200 ? ` · ${b.j?.paging?.total} resultados` : ` · ${b.j?.message || b.j?.error || ""}`}`);
  const c = await api(`/products/search?status=active&site_id=MLA&q=${encodeURIComponent(q)}&limit=10`);
  const fichas = c.j?.results || [];
  console.log(`  buscador de catálogo: HTTP ${c.s} · ${c.s === 200 ? `${c.j?.paging?.total ?? fichas.length} fichas` : c.j?.message || c.j?.error || ""}`);
  for (const f of fichas.slice(0, 5)) console.log(`    - ${f.id} · ${f.name}${f.domain_id ? ` · ${f.domain_id}` : ""}`);
  const f = fichas[0];
  if (!f) { console.log(""); continue; }
  const p = await api(`/products/${f.id}`);
  const bb = p.j?.buy_box_winner;
  console.log(`  ficha ${f.id}: HTTP ${p.s}${bb ? ` · gana ${pesos(bb.price)} (vendedor ${bb.seller_id}, tienda oficial ${bb.official_store_id ?? "no"})` : " · sin ganador"}${p.j?.children_ids?.length ? ` · ${p.j.children_ids.length} variantes` : ""}`);
  const it = await api(`/products/${f.id}/items?limit=20`);
  const pubs = it.j?.results || [];
  console.log(`  publicaciones de la ficha: HTTP ${it.s} · ${it.s === 200 ? `${it.j?.paging?.total ?? pubs.length}` : it.j?.message || it.j?.error || ""}`);
  for (const x of pubs.slice(0, 6)) console.log(`    - ${x.item_id || x.id} · ${pesos(x.price)}${x.original_price ? ` (antes ${pesos(x.original_price)})` : ""} · vendedor ${x.seller_id} · tienda oficial ${x.official_store_id ?? "no"} · ${x.condition || ""}`);
  const uno = pubs[0]?.item_id || pubs[0]?.id;
  if (uno) {
    const i = await api(`/items/${uno}`);
    console.log(`  publicación ${uno}: HTTP ${i.s}${i.s === 200 ? ` · ${i.j?.title} · ${pesos(i.j?.price)} · ${i.j?.variations?.length || 0} variaciones (talles)` : ` · ${i.j?.message || ""}`}`);
  }
  console.log("");
}
