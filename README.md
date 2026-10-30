# Zapada

Comparador de zapatillas de running que se consiguen en Argentina: ficha técnica, perfil de corredor, precios por tienda de menor a mayor y un laboratorio 3D para entender drop, pisada, amortiguación, placa y espuma.

Es un sitio estático: HTML, CSS y JS que se sirven desde una CDN. No hay servidor que mantener, aguanta mucho tráfico y en esta etapa cuesta $0.

## Estructura

```
index.html                  Estructura de la página
src/main.js                 Lógica: catálogo, filtros, ficha, comparador, rutas
src/shoe3d.js               Zapatilla 3D paramétrica (three.js)
src/styles.css              Estilos y colores (modo claro y oscuro)
public/data/modelos.json    EL CATÁLOGO: modelos, specs y precios
public/_headers             Cache: datos 5 min, código 1 año
scripts/validar-datos.mjs   Revisa el catálogo antes de cada publicación
```

## Probarlo en tu compu

Necesitás Node.js 20 o superior (nodejs.org).

```bash
npm install
npm run dev        # abre http://localhost:5173 y recarga al guardar
npm run build      # valida el catálogo y genera la carpeta dist/
npm run preview    # sirve dist/ como en producción
```

## Probarlo gratis en GitHub Pages

El repo ya trae el workflow `.github/workflows/deploy.yml`, que compila y publica solo.

1. Creá un repo **público** en GitHub llamado `zapada-web` (en cuentas gratis, Pages funciona solo con repos públicos).
2. Subí el proyecto:
   ```bash
   git init && git add . && git commit -m "Zapada v0.2"
   git branch -M main
   git remote add origin https://github.com/TU_USUARIO/zapada-web.git
   git push -u origin main
   ```
3. En el repo: **Settings → Pages → Build and deployment → Source: GitHub Actions**.
4. Andá a la pestaña **Actions**. Si el primer intento falló porque Pages todavía no estaba activado, entrá al workflow y tocá **Run workflow**.
5. En uno o dos minutos queda online en `https://TU_USUARIO.github.io/zapada-web/`.

Cada `git push` a main vuelve a publicar. Si cambiás el nombre del repo, la ruta se ajusta sola.

## Publicarlo en Cloudflare Pages (gratis)

1. Creá un repositorio en GitHub y subí esta carpeta:
   ```bash
   git init && git add . && git commit -m "Zapada v0.2"
   git branch -M main
   git remote add origin https://github.com/TU_USUARIO/zapada-web.git
   git push -u origin main
   ```
2. En dash.cloudflare.com: **Workers & Pages → Create → Pages → Connect to Git** y elegí el repo.
3. Configuración del build:
   - Framework preset: `Vite`
   - Build command: `npm run build`
   - Build output directory: `dist`
   - Variable de entorno: `NODE_VERSION` = `20`
4. Deploy. Te da una URL `zapada-web.pages.dev` con HTTPS.

Desde ahí, **cada `git push` a main publica solo**. Cada rama o pull request genera una URL de vista previa para probar sin tocar producción.

Si el catálogo tiene un error (precio vacío, link sin https, id repetido), el build falla y producción queda como estaba.

## Dominio propio

1. Registrá `tudominio.com.ar` en nic.ar (necesitás CUIT o CUIL y clave fiscal nivel 2).
2. En Cloudflare Pages: **Custom domains → Set up a domain**.
3. En NIC Argentina, delegá el dominio a los DNS que te indica Cloudflare. Tarda de minutos a unas horas.

## Fotos de los modelos

1. Pedile a cada marca su material de prensa: las fotos de producto en alta calidad, idealmente con fondo blanco o transparente.
2. Dentro de `public/fotos/`, creá una carpeta con el nombre exacto del modelo. La lista completa de nombres está en `public/fotos/LEEME.txt` (por ejemplo `asics-novablast-5`).
3. Poné las fotos adentro con nombres `1.jpg`, `2.jpg`, etc. La primera es la que aparece en el catálogo.
4. Hacé push. El build encuentra las fotos y las suma solo; no tenés que tocar `modelos.json`.

Si una carpeta tiene un nombre mal escrito, el build te avisa cuál es.
Para que la página cargue rápido, usá fotos de unos 1600 px de ancho en formato `.webp` o `.jpg`.

### Bajar las fotos automáticamente

En tu compu, con el repo clonado:

```bash
git pull
npm install
npm run bajar-fotos
git add public/fotos && git commit -m "Fotos de modelos" && git push
```

El script entra a las páginas de las tiendas cargadas en `modelos.json` y baja hasta 4 fotos de producto por modelo. Solo completa los modelos que todavía no tienen fotos. Para volver a bajar uno: `npm run bajar-fotos -- nike-vomero-18`.
Para usar fotos del kit de prensa de una marca, poné sus links en `scripts/fotos-urls.json`, por ejemplo `{ "nike-vomero-18": ["https://..."] }`.

## Actualizar precios

Editá `public/data/modelos.json` y hacé push. Cada oferta de una tienda tiene esta forma:

```json
{ "tienda": "Dexter", "precio": 169999, "antes": 249999,
  "cuotas": "6 cuotas sin interés", "nota": "Hombre",
  "url": "https://www.dexter.com.ar/...", "fecha": "27/10/2026" }
```

La web ordena sola de la más barata a la más cara y calcula el "desde" de cada modelo.

## Cómo escalar (en orden)

| Etapa | Qué | Cuándo |
|---|---|---|
| 1. Hoy | Sitio estático + JSON editado a mano | Validar que la gente lo use |
| 2. Precios automáticos | Script programado (GitHub Actions, cron diario) que trae precios por API de Mercado Libre y feeds de afiliados, regenera `modelos.json` y hace push | Cuando relevar a mano no alcance |
| 3. Base de datos | Supabase (Postgres) para modelos, historial de precios y reseñas | Cuando sumes reseñas o cuentas de usuario |
| 4. Usuarios | Login, reseñas con moderación, alertas de precio por mail | Con tráfico estable |

Reglas para que escale sin problemas:
- **Precios con permiso.** Usá las APIs y los programas de afiliados oficiales. Hacer scraping sin permiso viola los términos de las tiendas y te puede bloquear.
- **Fotos con permiso.** Las imágenes vienen en los feeds de afiliados. No descargues fotos de las tiendas por tu cuenta.
- **Medí antes de crecer.** Activá Cloudflare Web Analytics (gratis y sin cookies) y mirá qué modelos se buscan y desde dónde se hace clic a las tiendas.
