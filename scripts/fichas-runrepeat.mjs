// Trae de RunRepeat la ficha de los modelos en borrador (scripts/rr-candidatos.json: modelo -> páginas posibles)
// y la deja en scripts/fichas-rr.json para revisarla y cargarla. No toca el catálogo.
import { readFileSync, writeFileSync } from "node:fs";
import { traer, dormir } from "./tiendas.mjs";

const cand = JSON.parse(readFileSync(new URL("./rr-candidatos.json", import.meta.url), "utf8"));
const ESPUMAS = ["PEBA", "Helion HF", "Helion", "ZoomX", "ReactX", "Lightstrike Pro", "Lightstrike", "FF Turbo", "FF Blast", "PWRRUN PB", "PWRRUN HG", "PWRRUN+", "PWRRUN", "Nitro Elite", "Nitro",
  "FuelCell", "Fresh Foam X", "DNA Loft", "DNA Flash", "Supercritical", "Energy Foam", "Optifoam", "Phantom Fuse", "SmartFoam", "EVA", "TPU", "Profly", "Ultra Bounce", "Dreamstrike", "Boost",
  "Energy Surge", "PEBA-based", "Nitrogen-infused"];
const texto = h => h.replace(/<script[\s\S]*?<\/script>|<style[\s\S]*?<\/style>/g, " ").replace(/<[^>]+>/g, " ").replace(/&amp;/g, "&").replace(/&#39;/g, "'").replace(/\s+/g, " ");
const salida = {};
for (const [slug, urls] of Object.entries(cand)) {
  for (const u of urls) {
    try {
      const h = await traer(`https://runrepeat.com/${u}`);
      const f = {};
      for (const m of h.matchAll(/<tr[^>]*>([\s\S]*?)<\/tr>/g)) {
        const celdas = [...m[1].matchAll(/<t[dh][^>]*>([\s\S]*?)<\/t[dh]>/g)].map(x => texto(x[1]).trim());
        if (celdas.length >= 2 && /rr_facts__name/.test(m[1])) f[celdas[0]] = celdas.slice(1).join(" | ");
      }
      const t = texto(h);
      const espumas = Object.fromEntries(ESPUMAS.map(e => [e, (t.match(new RegExp(e.replace(/[+]/g, "\\+"), "gi")) || []).length]).filter(([, n]) => n));
      const placa = (t.match(/[^.]{0,80}\b(carbon|nylon|TPU|plastic|rock)\s*(fiber\s*)?plate[^.]{0,80}/i) || [])[0] || "";
      const titulo = (h.match(/<title>([^<]+)/) || [])[1] || "";
      salida[slug] = { rr: u, titulo, f, espumas, placa };
      console.log(`✓ ${slug} <- ${u} (${Object.keys(f).length} datos)`);
      break;
    } catch (e) { console.warn(`· ${slug} ${u}: ${e.message}`); }
    await dormir(1200);
  }
  if (!salida[slug]) salida[slug] = null;
  await dormir(1200);
}
writeFileSync(new URL("./fichas-rr.json", import.meta.url), JSON.stringify(salida, null, 1) + "\n");
console.log(`\n${Object.values(salida).filter(Boolean).length} de ${Object.keys(salida).length} fichas.`);
