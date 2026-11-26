# Junta las variantes que son el mismo color aunque la foto de cada tienda sea distinta (otro fondo, otra luz):
#  - mismo código de color del fabricante en la dirección (SAS20998-166 en Dexter = s20998166-000 en Sporting);
#  - o mismo nombre y los mismos dos tonos en la foto, en cualquier orden.
# Queda la más barata como principal y las demás pasan a "otras" (otras tiendas con ese color).
# Si después quedan dos colores distintos con el mismo nombre, se los distingue: "Gris claro" / "Gris oscuro".
# También se puede correr sola sobre public/data/colores.json:  python3 scripts/colores_fusion.py
import re, json, os
from urllib.parse import urlparse, unquote

NO_SUFIJO = {"m", "w", "p", "de", "men", "man", "html", "hot", "sat", "gtx", "wide", "kids", "run", "trail"}


def codigos(url):
    """Claves del código de modelo+color que trae la dirección: los dígitos (7 o más, con el sufijo de letras si lo hay,
    como 101162031-GRTM de Hoka) y los códigos de letras y números (JQ0814 de adidas)."""
    ruta = unquote(urlparse(url or "").path).lower()
    ruta = re.sub(r"\.html?$|/p/?$", "", ruta)
    out = set()
    for m in re.finditer(r"(?<![a-z0-9])([a-z]{0,4}\d[\da-z]*(?:-\d{2,4})*)(?:-([a-z]{2,4})(?![a-z0-9]))?", ruta):
        tok, suf = m.group(1).replace("-", ""), m.group(2)
        d = re.sub(r"\D", "", tok)
        if len(d) >= 7: out.add(d + (suf.upper() if suf and suf not in NO_SUFIJO else ""))
        if len(d) >= 4 and len(tok) >= 6 and re.search(r"[a-z]", tok): out.add(tok.upper())
    return out


def _igual(a, b):
    if a == b: return True
    if len(a) > len(b): a, b = b, a          # a es el corto
    if len(a) < 6: return False
    if b.endswith(a) and len(b) - len(a) <= 2: return True          # ADKI9873 = KI9873, 101162031 = 1162031
    if b.startswith(a) and set(b[len(a):]) == {"0"}: return True     # 20998166000 = 20998166
    return False


def mismo_codigo(ca, cb):
    return any(_igual(a, b) for a in ca for b in cb)


def _rgb(h):
    h = h.lstrip("#"); return tuple(int(h[i:i + 2], 16) for i in (0, 2, 4))


_dist = lambda a, b: sum((a[i] - b[i]) ** 2 for i in range(3)) ** .5
_base = lambda n: re.sub(r"\s*\((claro|oscuro|medio|\d+)\)$|\s+(claro|oscuro|medio)$", "", n or "")
_luz = lambda v: sum(sum(_rgb(h)) for h in v["hex"]) / (3 * len(v["hex"])) if v.get("hex") else 0
_host = lambda v: urlparse(v.get("url") or "").netloc


def _todos(v):
    c = set(codigos(v.get("url")))
    for o in v.get("otras", []): c |= codigos(o.get("url"))
    return c


def misma_foto(a, b, tol=55):
    """los mismos tonos dominantes, en el mismo orden o cruzados (cada tienda saca la foto con otro fondo)"""
    ha, hb = [_rgb(x) for x in a.get("hex") or []], [_rgb(x) for x in b.get("hex") or []]
    if not ha or not hb: return False
    if len(ha) < 2 or len(hb) < 2: return _dist(ha[0], hb[0]) < tol
    return (_dist(ha[0], hb[0]) < tol and _dist(ha[1], hb[1]) < tol) or (_dist(ha[0], hb[1]) < tol and _dist(ha[1], hb[0]) < tol)


def _distintos(a, b):
    """el fabricante dice que son colores distintos: las dos tienen código y no coinciden"""
    ca, cb = _todos(a), _todos(b)
    return bool(ca and cb) and not mismo_codigo(ca, cb)


def _juntar(rep, v):
    # mismo color: si la foto del más barato es casera y la de la otra tienda es de estudio, queda la de estudio
    if rep.get("limpia") is False and v.get("limpia"):
        rep["foto"], rep["hex"], rep["limpia"] = v["foto"], v["hex"], True
    vistas = {rep.get("url")} | {o.get("url") for o in rep["otras"]}
    for o in [{k: v.get(k) for k in ("tienda", "url", "precio", "nota")}] + v.get("otras", []):
        if o.get("url") not in vistas: rep["otras"].append(o); vistas.add(o.get("url"))


def fusionar(lista):
    """lista: variantes ya armadas (n, hex, url, precio, otras...). Devuelve la lista sin colores repetidos."""
    out = []
    for v in sorted(lista, key=lambda v: v.get("precio") or 10 ** 12):
        v["n"] = _base(v.get("n")); v.setdefault("otras", [])
        rep = next((e for e in out if mismo_codigo(_todos(v), _todos(e))), None)
        # mismo nombre y mismos tonos: en otra tienda se acepta más diferencia (otra cámara, otro fondo)
        rep = rep or next((e for e in out if e["n"] == v["n"] and not _distintos(e, v)
                           and misma_foto(e, v, 55 if _host(e) == _host(v) else 85)), None)
        # mismo nombre y a la vista iguales: para quien mira es el mismo color
        rep = rep or next((e for e in out if e["n"] == v["n"] and not _distintos(e, v)
                           and abs(_luz(e) - _luz(v)) < 15 and misma_foto(e, v, 70)), None)
        if rep: _juntar(rep, v)
        else: out.append(v)
    # mismo nombre para colores que no son el mismo: se aclara cuál es el claro y cuál el oscuro
    por = {}
    for v in out: por.setdefault(v["n"], []).append(v)
    for n, g in por.items():
        if len(g) < 2: continue
        g = sorted(g, key=_luz)
        pon = (lambda s, n=n: f"{n} ({s})") if " y " in n else (lambda s, n=n: f"{n} {s}")
        g[0]["n"], g[-1]["n"] = pon("oscuro"), pon("claro")
        for i, x in enumerate(g[1:-1]): x["n"] = pon("medio") if len(g) == 3 else f"{n} ({i + 2})"
    return out


if __name__ == "__main__":
    arch = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "public", "data", "colores.json")
    datos = json.load(open(arch)); cambios = 0
    for slug, vs in datos.items():
        if not isinstance(vs, list): continue
        nuevo = fusionar(vs)
        if len(nuevo) != len(vs):
            usadas = {v["foto"] for v in nuevo}
            for v in vs:
                f = os.path.join(os.path.dirname(arch), "..", v["foto"].split("?")[0])
                if v["foto"] not in usadas and os.path.exists(f): os.remove(f)
            print(slug, len(vs), "->", len(nuevo), [v["n"] for v in nuevo]); cambios += 1
        datos[slug] = nuevo
    json.dump(datos, open(arch, "w"), ensure_ascii=False, separators=(",", ":"))
    print(cambios, "modelos con colores repetidos")
