# Opiniones de corredores

Cada ficha tiene un formulario "¿La usaste? Contá cómo te fue". Las opiniones se guardan en Supabase,
en la tabla `opiniones`, y **no se publican hasta que las aprobás** desde el panel (`/admin.html`,
bloque "Opiniones para revisar").

## Crear la tabla (una sola vez)

Lo más fácil: entrá al panel. Si la tabla no existe, te muestra el SQL listo con tu email; lo copiás en
**Supabase › SQL Editor › New query** y tocás **Run**.

Qué hace ese SQL:
- El sitio (anon key) solo puede **agregar** opiniones, y siempre como `pendiente`.
- El sitio solo puede **leer** las `aprobada`, y sin la columna `visitante` (el número al azar que evita que
  alguien opine dos veces sobre la misma zapa desde el mismo navegador).
- Aprobar, rechazar o borrar solo lo puede hacer tu usuario (el email de la regla).

## Qué se pide

Puntaje (1 a 5), km que le hizo, para qué la usa y, opcional: cómo le quedó el talle, rango de peso,
nombre o apodo y un texto de hasta 600 caracteres sin links. No se piden emails ni datos personales.

## Puntaje de laboratorio

Aparte de las opiniones, la ficha muestra el puntaje de RunRepeat (general y por uso), con link a la reseña.
Lo trae `scripts/puntajes.mjs` (workflow "Puntajes de laboratorio", el primer domingo de cada mes) y queda en
`public/data/puntajes.json`. Solo se guardan los números, no textos de la reseña.
