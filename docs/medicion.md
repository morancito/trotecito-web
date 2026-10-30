# Medición y panel de administración

Trotecito mide de forma anónima cómo se usa el sitio y lo muestra en `admin.html`:
visitas, fichas vistas, búsquedas (incluidas las que no encuentran nada), filtros, cada paso
del recomendador y los clics que llegan a las tiendas.

- Sin cookies ni datos personales: cada navegador guarda un número al azar y cada visita, otro.
- Tus propias visitas no cuentan: al entrar al panel, ese navegador queda excluido.
- Los robots (navegadores automatizados) tampoco cuentan.

Los eventos se guardan en **Supabase** (base de datos gratis). GitHub Pages solo sirve
páginas y no puede guardar nada, por eso hace falta.

## 1. Crear el proyecto (5 minutos)

1. Entrá a <https://supabase.com>, creá una cuenta y un proyecto nuevo (región: São Paulo).
   Guardá la contraseña de la base en un lugar seguro, aunque no se usa acá.
2. En el proyecto, andá a **SQL Editor → New query**, pegá todo el bloque de abajo,
   **cambiá `TU_EMAIL` por tu email** y tocá **Run**.

```sql
-- Tabla de eventos
create table public.eventos (
  id bigint generated always as identity primary key,
  ts timestamptz not null default now(),
  sesion text not null check (length(sesion) <= 40),
  tipo text not null check (length(tipo) <= 40),
  ruta text check (length(ruta) <= 80),
  datos jsonb not null default '{}'::jsonb check (pg_column_size(datos) < 4000)
);
create index eventos_ts on public.eventos (ts);
create index eventos_tipo_ts on public.eventos (tipo, ts);

-- Seguridad: el sitio solo puede AGREGAR eventos; leerlos, solo vos.
alter table public.eventos enable row level security;
create policy "el sitio agrega eventos" on public.eventos
  for insert to anon with check (true);
create policy "solo el admin lee" on public.eventos
  for select to authenticated using ((auth.jwt() ->> 'email') = 'TU_EMAIL');
```

3. Andá a **Authentication → Users → Add user → Create new user**: poné tu email (el mismo
   del SQL) y una contraseña. Tildá **Auto Confirm User**. Con eso entrás al panel.
4. Andá a **Project Settings → API** y copiá:
   - **Project URL** (algo como `https://abcdefgh.supabase.co`)
   - **anon public** key (empieza con `eyJ...`)

   La anon key es pública por diseño: solo permite agregar eventos, no leerlos.
   **No compartas la `service_role` key con nadie.**

## 2. Conectarlo

Pasale a Claude la URL y la anon key, o pegalas vos en `src/medir.js`:

```js
export const SUPABASE_URL = import.meta.env.VITE_SB_URL || "https://abcdefgh.supabase.co";
export const SUPABASE_KEY = import.meta.env.VITE_SB_KEY || "eyJ...";
```

Hacé push. Desde ese momento el sitio empieza a medir.

## 3. Usar el panel

Entrá a `https://morancito.github.io/trotecito-web/admin.html` con el email y la contraseña
del paso 1.3. Podés ver 7, 30 o 90 días y bajar todos los eventos en CSV.

## Qué se mide

| Evento | Cuándo | Datos |
|---|---|---|
| `visita` | Al abrir el sitio | De dónde vino (sitio o `utm_source`), celular o compu, si es la primera vez |
| `vista` | Cada pantalla | Inicio, catálogo, ficha (qué zapa), comparador (qué zapas), recomendador |
| `busqueda` | Al dejar de escribir 1,5 s | Qué buscó y cuántos resultados hubo |
| `filtro` | Al tocar un filtro | Cuál y con qué valor |
| `atajo` | Atajos del inicio | Cuál |
| `reco_inicio`, `reco_paso`, `reco_fin` | Recomendador | Cada respuesta, el perfil completo y qué zapas le recomendó |
| `reco_ficha`, `reco_comparar`, `reco_vertodas` | Botones del resultado | Qué zapa |
| `tienda_clic` | Clic a una tienda | Zapa, tienda, precio, talle, desde dónde y si era el más barato |

Para medir campañas, compartí links con `?utm_source=instagram` (o el nombre que quieras):
el panel los muestra en "De dónde llegan".

## Límites a tener en cuenta

- El plan gratis de Supabase aguanta 500 MB, que alcanzan para millones de eventos.
  Si un proyecto pasa una semana sin uso, Supabase lo pausa; se reactiva desde su panel.
- Cualquiera puede agregar eventos falsos (así funciona cualquier medición web). Si aparece
  basura, se borra desde Supabase y se puede sumar un límite por visita.
