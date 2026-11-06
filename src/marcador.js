/* Marcador "Trotecito": se usa desde la barra de favoritos estando en www.nike.com.ar o www.adidas.com.ar.
   Consulta la API de la tienda desde el navegador (las tiendas bloquean al robot de GitHub), baja un archivo con
   precios, talles y links de los modelos que tenemos, y abre la página para subirlo al repo. Al subirlo, GitHub lo
   importa solo (workflow importar-manual). La página herramientas.html lo convierte en el link para arrastrar. */
(async () => {
  const SUBIR = "https://github.com/morancito/trotecito-web/upload/main/datos-manuales";
  const h = location.hostname, tienda = /nike\.com\.ar$/.test(h) ? "nike" : /adidas\.com\.ar$/.test(h) ? "adidas" : null;
  const caja = document.createElement("div");
  caja.style.cssText = "position:fixed;top:16px;right:16px;z-index:2147483647;width:340px;max-width:calc(100vw - 32px);background:#fff;color:#141A2E;border:3px solid #141A2E;border-radius:16px;box-shadow:6px 6px 0 #1F3F8F;padding:16px 18px;font:15px/1.4 system-ui,sans-serif";
  const pinta = (html) => { caja.innerHTML = `<b style="font-size:17px">Trotecito</b><div style="margin-top:8px">${html}</div>`; };
  document.body.append(caja);
  const btn = (txt, extra = "") => `<a ${extra} style="display:inline-block;margin:10px 8px 0 0;padding:9px 14px;border-radius:999px;background:#D0506E;color:#fff;font-weight:700;text-decoration:none;cursor:pointer">${txt}</a>`;
  const cerrar = () => caja.remove();
  if (!tienda) { pinta(`Este marcador funciona en <b>www.nike.com.ar</b> y <b>www.adidas.com.ar</b>. Abrí una de esas y tocalo de nuevo.${btn("Cerrar", 'id="tt-x"')}`); caja.querySelector("#tt-x").onclick = cerrar; return; }
  const espera = ms => new Promise(r => setTimeout(r, ms));
  const json = async u => { const r = await fetch(u, { headers: { accept: "application/json" }, credentials: "same-origin" }); if (!r.ok) throw new Error("HTTP " + r.status); return r.json(); };
  const log = [];
  const estado = t => { log.push(t); pinta(`Leyendo ${tienda === "nike" ? "Nike" : "adidas"}… no cierres esta pestaña.<div style="margin-top:8px;color:#5B6172;font-size:13px">${log.slice(-4).join("<br>")}</div>`); };

  let datos;
  if (tienda === "nike") {
    const qs = ["pegasus", "vomero", "structure", "winflo", "invincible", "zoom fly", "vaporfly", "alphafly", "quest", "revolution", "kiger", "zegama", "ultrafly", "infinity"];
    const prods = new Map();
    for (const q of qs) for (const f of [0, 50, 100]) {
      let a = [];
      try { a = await json(`/api/catalog_system/pub/products/search?ft=${encodeURIComponent(q)}&_from=${f}&_to=${f + 49}`); } catch (e) { estado(`${q}: ${e.message}`); }
      estado(`${q}: ${a.length} productos`);
      for (const p of a) prods.set(p.productId, {
        productId: p.productId, productName: p.productName, link: p.link, categories: p.categories, "Color PDP": p["Color PDP"],
        imagen: p.items?.[0]?.images?.[0]?.imageUrl, imagenes: (p.items?.[0]?.images || []).slice(0, 5).map(i => i.imageUrl),
        items: (p.items || []).map(i => ({ name: i.name, talle: i.talle || i.Talle, sellers: (i.sellers || []).map(s => ({ commertialOffer: {
          Price: s.commertialOffer.Price, ListPrice: s.commertialOffer.ListPrice, AvailableQuantity: s.commertialOffer.AvailableQuantity,
          Installments: (s.commertialOffer.Installments || []).filter(x => x.InterestRate === 0).map(x => ({ NumberOfInstallments: x.NumberOfInstallments, InterestRate: 0 })) } })) })),
      });
      if (a.length < 50) break;
      await espera(1200);
    }
    datos = { tienda, fecha: new Date().toISOString(), productos: [...prods.values()] };
  } else {
    const qs = ["adizero evo sl", "adizero sl", "adizero boston", "adios pro", "takumi sen", "supernova", "duramo", "adistar", "ultraboost", "agravic", "terrex"];
    const items = new Map(), disp = {};
    /* objetos con pinta de producto dentro de cualquier JSON (la página de búsqueda trae los datos en __NEXT_DATA__) */
    const juntar = (o, prof = 0) => {
      if (!o || typeof o !== "object" || prof > 12) return;
      if (Array.isArray(o)) return o.forEach(x => juntar(x, prof + 1));
      const id = o.productId || o.modelId, nombre = o.displayName || o.name || o.title, precio = o.salePrice ?? o.price ?? o.pricing?.salePrice ?? o.pricing?.price;
      if (id && nombre && (typeof precio === "number" || /^\d/.test(String(precio || "")))) items.set(o.productId || id, { productId: o.productId || id, displayName: nombre, link: o.link || o.url || o.href || "",
        price: +(o.price ?? o.pricing?.standard_price ?? o.pricing?.price ?? precio), salePrice: +(o.salePrice ?? o.pricing?.sale_price ?? o.pricing?.salePrice ?? precio), gender: o.gender || o.genderCode || null });
      for (const v of Object.values(o)) if (v && typeof v === "object") juntar(v, prof + 1);
    };
    /* toda la categoría de running (462 productos en nov 2026), de a 48; después, por si falta alguno, las búsquedas */
    const pagina = async (rutaApi, rutaHtml) => {
      const antes = items.size;
      try { juntar(await json(rutaApi)); } catch {}
      if (items.size === antes) {
        try {
          const html = await (await fetch(rutaHtml, { credentials: "same-origin" })).text();
          const nd = html.match(/<script id="__NEXT_DATA__"[^>]*>([\s\S]*?)<\/script>/);
          if (nd) juntar(JSON.parse(nd[1]));
        } catch {}
      }
      return items.size - antes;
    };
    for (let start = 0; start < 960; start += 48) {
      const nuevos = await pagina(`/api/plp/content-engine?query=calzado-zapatillas-running&start=${start}`, `/calzado-zapatillas-running?start=${start}`);
      estado(`running ${start}: ${nuevos} productos`);
      if (!nuevos) break;
      await espera(900);
    }
    for (const q of qs) {
      const nuevos = await pagina(`/api/plp/content-engine/search?query=${encodeURIComponent(q)}&start=0`, `/search?q=${encodeURIComponent(q)}`);
      estado(`${q}: ${nuevos} productos`);
      await espera(800);
    }
    /* solo zapatillas (la búsqueda trae también ropa) */
    for (const [id, it] of items) if (!/zapatilla|calzado|shoe/i.test(`${it.displayName} ${it.link}`)) items.delete(id);
    let n = 0;
    for (const id of items.keys()) {
      try { disp[id] = await json(`/api/products/${id}/availability`); } catch {}
      if (++n % 15 === 0) estado(`talles: ${n} de ${items.size}`);
      await espera(350);
    }
    datos = { tienda, fecha: new Date().toISOString(), items: [...items.values()], disp };
  }

  const n = tienda === "nike" ? datos.productos.length : datos.items.length;
  if (!n) { pinta(`No pude leer productos de ${tienda}. Puede que la tienda haya cambiado su página: avisale a Claude.${btn("Cerrar", 'id="tt-x"')}`); caja.querySelector("#tt-x").onclick = cerrar; return; }
  const nombre = `${tienda}-${new Date().toISOString().slice(0, 10)}.json`;
  const a = Object.assign(document.createElement("a"), { href: URL.createObjectURL(new Blob([JSON.stringify(datos)], { type: "application/json" })), download: nombre });
  document.body.append(a); a.click(); a.remove();
  pinta(`Listo: <b>${n} productos</b> en el archivo <b>${nombre}</b> (quedó en Descargas).<br><br>Ahora tocá <b>Subir</b>, arrastrá el archivo a la página de GitHub y apretá <b>Commit changes</b>. En un par de minutos los precios están en el sitio.${btn("Subir a Trotecito", `href="${SUBIR}" target="_blank" rel="noopener"`)}${btn("Cerrar", 'id="tt-x" style="background:#5B6172"')}`);
  caja.querySelector("#tt-x").onclick = cerrar;
})();
