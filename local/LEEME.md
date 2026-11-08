# Trotecito · precios desde tu compu (Windows)

Nike, adidas y Digital Sport no dejan entrar al robot de GitHub. Este programa hace lo mismo que el marcador, pero solo:
todos los días a las **08:30 y 12:30** lee esas tres tiendas desde tu conexión y sube los precios a Trotecito.
Se presenta honestamente como el robot de Trotecito (`TrotecitoBot`). Si alguna tienda lo bloquea igual,
el registro lo dice y esa tienda sigue con el marcador.

## Instalar (una vez, 5 minutos)

1. **Sacá un token de GitHub** (es la llave que le permite subir los archivos; solo sirve para este repo):
   - Entrá a github.com/settings/personal-access-tokens/new
   - *Token name*: `Trotecito compu`. *Expiration*: 1 año (GitHub te avisa antes de que venza).
   - *Repository access*: **Only select repositories** → `trotecito-web`.
   - *Permissions* → *Repository permissions* → **Contents: Read and write**. Nada más.
   - *Generate token* y copialo (empieza con `github_pat_`).
   - **No se lo pases a nadie ni lo pegues en un chat**, tampoco a Claude. Va solo en el instalador.
2. **Descomprimí** el zip en cualquier carpeta (no lo abras desde adentro del zip).
3. Doble clic en **instalar.cmd**. Si Windows muestra "Windows protegió su PC": *Más información* → *Ejecutar de todas formas*.
4. Pegá el token cuando lo pida (clic derecho pega; no se ve mientras lo pegás) y Enter.
5. Te ofrece correrlo una vez para probar: decí que sí y fijate que diga ✓ en las tres tiendas.

Listo. La compu tiene que estar prendida con tu sesión abierta; si estaba apagada a la hora, corre apenas la prendés.

## Después

- Lo que pasó en cada corrida: `%LOCALAPPDATA%\Trotecito\registro.txt` (pegá eso en la barra del Explorador).
- Correrlo a mano: Programador de tareas → *Trotecito precios* → *Ejecutar*.
- Cambiar el token: abrí instalar.cmd de nuevo.
- Sacarlo: doble clic en **desinstalar.cmd**, y borrá el token en github.com/settings/personal-access-tokens.

El token queda cifrado con tu usuario de Windows (DPAPI): otro usuario u otra compu no lo pueden leer.
