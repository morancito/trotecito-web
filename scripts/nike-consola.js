// Para pegar en la consola de Chrome (F12 → Console) con www.nike.com.ar abierto: consulta la API de Nike y baja
// un nike-AAAA-MM-DD.json con lo necesario. Después: node scripts/importar-nike.mjs nike-AAAA-MM-DD.json
(async () => {
  const qs = ["pegasus", "vomero", "structure", "winflo", "invincible", "zoom fly", "vaporfly", "quest", "revolution", "kiger", "zegama"];
  const prods = new Map();
  for (const q of qs) for (const f of [0, 50, 100]) {
    const r = await fetch(`/api/catalog_system/pub/products/search?ft=${encodeURIComponent(q)}&_from=${f}&_to=${f + 49}`);
    const a = r.ok ? await r.json() : [];
    console.log(`${q} ${f}-${f + 49}: ${a.length} productos`);
    for (const p of a) prods.set(p.productId, {
      productId: p.productId, productName: p.productName, link: p.link, categories: p.categories, "Color PDP": p["Color PDP"],
      imagen: p.items?.[0]?.images?.[0]?.imageUrl,
      items: (p.items || []).map(i => ({ name: i.name, talle: i.talle || i.Talle, sellers: (i.sellers || []).map(s => ({ commertialOffer: {
        Price: s.commertialOffer.Price, ListPrice: s.commertialOffer.ListPrice, AvailableQuantity: s.commertialOffer.AvailableQuantity,
        Installments: (s.commertialOffer.Installments || []).filter(x => x.InterestRate === 0).map(x => ({ NumberOfInstallments: x.NumberOfInstallments, InterestRate: 0 })) } })) }))
    });
    if (a.length < 50) break;
    await new Promise(r => setTimeout(r, 1500));
  }
  const blob = new Blob([JSON.stringify([...prods.values()])], { type: "application/json" });
  const a = Object.assign(document.createElement("a"), { href: URL.createObjectURL(blob), download: `nike-${new Date().toISOString().slice(0, 10)}.json` });
  document.body.append(a); a.click(); a.remove();
  console.log(`Listo: ${prods.size} productos en el archivo descargado.`);
})();
