// Prueba: ¿se pueden leer opiniones de compradores de Mercado Libre por ficha de catálogo? Solo lectura.
//   node scripts/ml-opiniones.mjs
const API = "https://api.mercadolibre.com";
const { ML_CLIENT_ID: id, ML_CLIENT_SECRET: secreto } = process.env;
const t = await fetch(`${API}/oauth/token`, { method: "POST", headers: { "content-type": "application/x-www-form-urlencoded", accept: "application/json" },
  body: new URLSearchParams({ grant_type: "client_credentials", client_id: id, client_secret: secreto }) });
const { access_token: tok } = await t.json();
if (!tok) { console.error("Sin token"); process.exit(1); }
const espera = ms => new Promise(r => setTimeout(r, ms));
const api = async ruta => { const r = await fetch(API + ruta, { headers: { authorization: `Bearer ${tok}`, accept: "application/json" } }); const j = await r.json().catch(() => null); await espera(400); return { s: r.status, j }; };
const norm = x => String(x || "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]+/g, " ").trim();
const corto = j => JSON.stringify(j)?.slice(0, 220);

for (const q of ["Asics Gel Kayano 32", "Asics Novablast 5", "Nike Pegasus 41", "Hoka Clifton 10"]) {
  console.log(`## ${q}`);
  const pal = norm(q).split(" ").slice(1), fichas = [];
  for (let off = 0; off < 100; off += 10) {
    const c = await api(`/products/search?status=active&site_id=MLA&q=${encodeURIComponent(q)}&limit=10&offset=${off}`);
    if (c.s !== 200) { console.log(`  catálogo off ${off}: HTTP ${c.s}`); break; }
    for (const f of c.j?.results || []) { const n = ` ${norm(f.name)} `; if (pal.every(w => n.includes(` ${w} `)) && !/ trail /.test(n)) fichas.push(f); }
    if (fichas.length >= 6 || !(c.j?.results || []).length) break;
  }
  console.log(`  fichas: ${fichas.map(f => f.id).join(" ") || "ninguna"}`);
  for (const f of fichas.slice(0, 3)) {
    const p = await api(`/products/${f.id}`);
    const padre = p.j?.parent_id;
    for (const ruta of [`/reviews/item/${f.id}`, `/reviews/item/${f.id}?catalog_product_id=${f.id}`, `/reviews/product/${f.id}`, padre && `/reviews/product/${padre}`, padre && `/products/${padre}`].filter(Boolean)) {
      const r = await api(ruta);
      const res = r.j?.rating_average != null ? `promedio ${r.j.rating_average} · ${r.j.paging?.total ?? r.j.reviews?.length} opiniones · ej: "${(r.j.reviews?.[0]?.content || "").slice(0, 90)}"` : corto(r.j);
      console.log(`  ${ruta}: HTTP ${r.s} · ${res}`);
    }
  }
  console.log("");
}
