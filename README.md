# Trotecito

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

## Dónde está publicado

El sitio está en **Cloudflare** (Workers con archivos estáticos), conectado a este repo privado:
cada cambio en `main` se compila con `npm run build` y se publica solo. La configuración está en `wrangler.jsonc`.

## Seguimiento de precios

Todos los días a las 06:17 (hora de Argentina) GitHub Actions corre `scripts/actualizar-precios.mjs`:
lee el precio de cada tienda cargada en `modelos.json`, lo actualiza, suma un punto a `public/data/historial.json`,
guarda el cambio en el repo y Cloudflare vuelve a publicar la web sola. El historial guarda los últimos 7 meses; la ficha muestra 6.

Para correrlo a mano: pestaña **Actions → Actualizar precios → Run workflow**. El resultado de cada pasada queda en `public/data/robot.json` y se ve en el panel.
Si una tienda no responde, se conserva el último precio y ese día no suma punto (queda en el log).

## Sumar tiendas nuevas

1. Agregá la tienda a la lista `TIENDAS` de `scripts/buscar-ofertas.mjs` (nombre y dirección). Reconoce solo
   Salesforce, Magento, Tiendanube, VTEX, Shopify y WooCommerce.
2. Corré **Actions → Buscar ofertas → Run workflow** (podés poner solo el nombre de la tienda nueva).
   Deja lo encontrado en `scripts/ofertas-encontradas.json`, sin tocar el catálogo.
3. Revisá ese archivo y sumá las ofertas con `node scripts/sumar-ofertas.mjs --guardar`.
   Desde ahí el robot diario actualiza su precio, stock y talles como el resto.

## Actualizar precios a mano

Editá `public/data/modelos.json` y hacé push. Cada oferta de una tienda tiene esta forma:

```json
{ "tienda": "Dexter", "precio": 169999, "antes": 249999,
  "cuotas": "6 cuotas sin interés", "nota": "Hombre",
  "url": "https://www.dexter.com.ar/...", "fecha": "27/10/2026" }
```

La web ordena sola de la más barata a la más cara y calcula el "desde" de cada modelo.

Cada modelo lleva `"terreno": "Asfalto"` o `"terreno": "Trail"`. El catálogo los muestra separados con el selector Asfalto / Trail.

## Medición y panel de administración

El sitio mide de forma anónima visitas, búsquedas, filtros, el recomendador y los clics a tiendas.
Los resultados se ven en `admin.html`, con usuario y contraseña. Cómo configurarlo, en [docs/medicion.md](docs/medicion.md).

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
