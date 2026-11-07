// Worker del sitio: sirve los archivos de dist tal cual (como antes) y, además, hace de reloj puntual.
// GitHub atrasa horas las corridas programadas; Cloudflare no. A las horas de "triggers.crons" (wrangler.jsonc)
// le pide a GitHub que corra "Actualizar precios" en ese momento.
// Necesita el secreto GH_TOKEN (token de GitHub con permiso "Actions: lectura y escritura" solo sobre trotecito-web),
// cargado en Cloudflare › Workers › trotecito-web › Settings › Variables and Secrets.
const REPO = "morancito/trotecito-web";
const FLUJO = "precios.yml";

export default {
  fetch(request, env) {
    return env.ASSETS.fetch(request);
  },
  async scheduled(evento, env, ctx) {
    if (!env.GH_TOKEN) { console.log("Falta el secreto GH_TOKEN: no puedo lanzar la actualización de precios."); return; }
    const r = await fetch(`https://api.github.com/repos/${REPO}/actions/workflows/${FLUJO}/dispatches`, {
      method: "POST",
      headers: { Authorization: `Bearer ${env.GH_TOKEN}`, Accept: "application/vnd.github+json", "User-Agent": "trotecito-reloj", "X-GitHub-Api-Version": "2022-11-28" },
      body: JSON.stringify({ ref: "main", inputs: { origen: "reloj" } }),
    });
    console.log(`Actualizar precios (${evento.cron}): GitHub respondió ${r.status}`);
    if (!r.ok) console.log(await r.text());
  },
};
