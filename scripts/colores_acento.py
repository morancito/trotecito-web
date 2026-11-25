# Acento de color: una zapa gris con suela flúor salía "Gris" a secas, porque el flúor ocupa poco de la foto.
# Si los dos colores principales son neutros (negro, blanco, gris) y hay un color vivo que ocupa al menos el 6 %
# de la zapa, ese color pasa a ser el segundo del nombre y de la muestra: "Gris y amarillo".
import colorsys
from PIL import Image, ImageStat

NEUTROS = {"Negro", "Blanco", "Gris"}

def _fondo(im):
    w, h = im.size; tiras = [im.crop((0, 0, w, 4)), im.crop((0, h - 4, w, h)), im.crop((0, 0, 4, h)), im.crop((w - 4, 0, w, h))]
    return tuple(int(sum(ImageStat.Stat(t).median[i] for t in tiras) / 4) for i in range(3))

def acento(im):
    """(rgb, proporción) del color vivo más presente en la zapa, o None"""
    im = im.convert("RGB"); bg = _fondo(im)
    px = [p for p in list(im.resize((120, 120)).getdata()) if sum(abs(p[i] - bg[i]) for i in range(3)) > 45]
    if len(px) < 200: return None
    cajas = {}
    for p in px:
        h, l, s = colorsys.rgb_to_hls(*(x / 255 for x in p))
        if s > 0.45 and 0.22 < l < 0.82: cajas.setdefault(int(h * 12) % 12, []).append(p)
    if not cajas: return None
    k, g = max(cajas.items(), key=lambda kv: len(kv[1]))
    if len(g) / len(px) < 0.06: return None
    return tuple(sum(p[i] for p in g) // len(g) for i in range(3)), len(g) / len(px)

def con_acento(nombre, hexes, im, nombre_rgb):
    """devuelve (nombre, hexes) con el acento sumado si corresponde"""
    partes = [p.strip().capitalize() for p in nombre.split(" y ")]
    if not all(p in NEUTROS for p in partes): return nombre, hexes
    a = acento(im)
    if not a: return nombre, hexes
    n = nombre_rgb(a[0])
    if n in NEUTROS: return nombre, hexes
    hx = "#%02X%02X%02X" % a[0]
    return f"{partes[0]} y {n.lower()}", [hexes[0], hx]

if __name__ == "__main__":
    # pasada sobre los colores ya publicados (con las fotos ya cuadradas de public/fotos)
    import json, os, sys, importlib.util
    raiz = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    src = open(f"{raiz}/scripts/colores-fotos.py").read()
    ns = {"__file__": f"{raiz}/scripts/colores-fotos.py"}; exec(src[:src.index("datos = json.load")], ns)   # solo las funciones (nombre_rgb), sin procesar nada
    arch = f"{raiz}/public/data/colores.json"; d = json.load(open(arch)); n = 0
    for slug, vs in d.items():
        if not isinstance(vs, list): continue
        for v in vs:
            f = f"{raiz}/public/{v['foto'].split('?')[0]}"
            if not os.path.exists(f): continue
            nn, hx = con_acento(v["n"], v["hex"], Image.open(f), ns["nombre_rgb"])
            if nn != v["n"]: print(slug, v["n"], "->", nn); v["n"], v["hex"] = nn, hx; n += 1
    json.dump(d, open(arch, "w"), ensure_ascii=False, separators=(",", ":"))
    print(n, "colores con acento")
