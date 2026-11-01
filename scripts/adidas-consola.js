// Para pegar en la consola de Chrome (F12 → Console) con www.adidas.com.ar abierto: busca los modelos adidas del
// catálogo en la API de la tienda, con talles disponibles, y baja un adidas-AAAA-MM-DD.json.
// Después: node scripts/importar-adidas.mjs adidas-AAAA-MM-DD.json
(async () => {
  const qs = ["adizero evo sl", "adizero sl2", "adizero boston", "adios pro", "takumi sen", "supernova rise", "supernova stride", "duramo sl", "adistar", "ultraboost 5", "agravic"];
  const items = new Map(), disp = {};
  const espera = ms => new Promise(r => setTimeout(r, ms));
  for (const q of qs) for (const start of [0, 48]) {
    let j = null;
    for (const u of [`/api/plp/content-engine/search?query=${encodeURIComponent(q)}&start=${start}`, `/api/plp/content-engine?query=${encodeURIComponent(q)}&start=${start}`]) {
      try { const r = await fetch(u, { headers: { accept: "application/json" } }); if (r.ok) { j = await r.json(); break; } } catch {}
    }
    const lista = j?.raw?.itemList?.items || j?.itemList?.items || [];
    console.log(`${q} (${start}): ${lista.length} productos${j ? "" : " — la búsqueda no respondió"}`);
    for (const it of lista) items.set(it.productId, it);
    if (lista.length < 48) break;
    await espera(1200);
  }
  /* talles con stock de cada producto */
  let n = 0;
  for (const id of items.keys()) {
    try { const r = await fetch(`/api/products/${id}/availability`, { headers: { accept: "application/json" } }); if (r.ok) disp[id] = await r.json(); } catch {}
    if (++n % 20 === 0) console.log(`talles: ${n} de ${items.size}`);
    await espera(400);
  }
  const blob = new Blob([JSON.stringify({ origen: "adidas.com.ar API", fecha: new Date().toISOString(), items: [...items.values()], disp })], { type: "application/json" });
  const a = Object.assign(document.createElement("a"), { href: URL.createObjectURL(blob), download: `adidas-${new Date().toISOString().slice(0, 10)}.json` });
  document.body.append(a); a.click(); a.remove();
  console.log(`Listo: ${items.size} productos (${Object.keys(disp).length} con talles) en el archivo descargado.`);
})();
