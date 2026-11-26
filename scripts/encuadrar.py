"""Encuadra las fotos de zapatillas igual en todo el sitio.
Las fotos son cuadradas, pero las tarjetas, la ficha y las ofertas las muestran en 4:3 recortando arriba y abajo:
si la zapa está corrida o es muy alta, se corta. Acá se recorta la zapa del fondo, se la centra y se la escala para
que entre en la franja que se ve en 4:3 (hasta 86 % del ancho y 62 % del alto), con el fondo de la propia foto.
Si la foto original ya venía cortada contra un borde, ese lado queda pegado al borde (no queda un corte flotando).
   python3 scripts/encuadrar.py [modelo ...]     (sin modelos: todas las fotos de public/fotos)
   python3 scripts/encuadrar.py --ver [modelo ...]  (solo dice qué cambiaría)"""
import os, sys
from PIL import Image, ImageStat, ImageChops, ImageFilter, ImageDraw

ANCHO, ALTO, MAX_ESCALA = 0.9, 0.66, 1.8


def fondo(im):
    w, h = im.size
    tiras = [im.crop((0, 0, w, 6)), im.crop((0, h - 6, w, h)), im.crop((0, 0, 6, h)), im.crop((w - 6, 0, w, h))]
    meds = [tuple(ImageStat.Stat(t).median) for t in tiras]
    bg = tuple(int(sum(m[i] for m in meds) / 4) for i in range(3))
    parejo = max(max(ImageStat.Stat(t).stddev) for t in tiras) < 12 and \
        max(max(abs(m[i] - bg[i]) for i in range(3)) for m in meds) < 14
    return bg, parejo


def caja(im, bg, tol=12):
    """caja de la zapa (sin el fondo ni motas sueltas), en píxeles de la foto"""
    w, h = im.size; k = 300 / max(w, h)
    sm = im.resize((round(w * k), round(h * k)))
    m = ImageChops.difference(sm, Image.new("RGB", sm.size, bg)).convert("L")
    m = m.point(lambda v: 255 if v > tol else 0).filter(ImageFilter.MedianFilter(5))
    bb = m.getbbox()
    return tuple(round(v / k) for v in bb) if bb else None


def caja_segura(im, bg):
    """Umbral bajo para no perder una zapa blanca sobre fondo gris claro; si con ese umbral el fondo mismo
    (una viñeta, un degradé suave) llega a los bordes, se usa un umbral más alto."""
    W, H = im.size; b = max(2, round(W * 0.01))
    for tol in (12, 26, 40):
        bb = caja(im, bg, tol)
        if not bb: return None
        if bb[0] > b and bb[1] > b and bb[2] < W - b and bb[3] < H - b: return bb
    return bb


def encuadrar(im):
    """devuelve (foto nueva, motivo) o (None, motivo) si no hace falta o no conviene tocarla.
    Se escala y se mueve la foto ENTERA (no se recorta nada): lo que queda al descubierto se pinta con el fondo."""
    im = im.convert("RGB"); W, H = im.size
    bg, parejo = fondo(im)
    if not parejo: return None, "fondo con degradé o ambiente: queda como está"
    bb = caja_segura(im, bg)
    if not bb: return None, "sin zapa"
    x0, y0, x1, y1 = bb; bw, bh = x1 - x0, y1 - y0
    borde = max(2, round(W * 0.01))
    toca = {"izq": x0 <= borde, "der": x1 >= W - borde, "arr": y0 <= borde, "aba": y1 >= H - borde}
    if bw < W * 0.08 or bh < H * 0.08: return None, "zapa demasiado chica para medir"
    if (toca["izq"] and toca["der"]) or (toca["arr"] and toca["aba"]): return None, "cortada de lado a lado: queda como está"
    s = min(ANCHO * W / bw, ALTO * H / bh, MAX_ESCALA)
    ccx, ccy = (x0 + x1) / 2, (y0 + y1) / 2
    okx = toca["izq"] or toca["der"] or abs(ccx - W / 2) < W * 0.03   # pegada a un borde: ese eje no se centra
    oky = toca["arr"] or toca["aba"] or abs(ccy - H / 2) < H * 0.03
    if abs(s - 1) < 0.08 and okx and oky:
        return None, "ya encuadrada"
    nw, nh = round(W * s), round(H * s)
    px, py = round(W / 2 - ccx * s), round(H / 2 - ccy * s)
    # si la foto original venía cortada contra un borde, ese borde sigue pegado al borde
    if toca["izq"]: px = 0
    if toca["der"]: px = W - nw
    if toca["arr"]: py = 0
    if toca["aba"]: py = H - nh
    # que la zapa no se salga del cuadro (ni por el centrado ni por la escala)
    px = min(max(px, -round(x0 * s)), W - round(x1 * s)); py = min(max(py, -round(y0 * s)), H - round(y1 * s))
    pieza = im.resize((nw, nh), Image.LANCZOS)
    nuevo = Image.new("RGB", (W, H), bg)
    # los bordes de la foto vieja se funden con el fondo para que no se vea el corte
    mascara = Image.new("L", (nw, nh), 255); d = ImageDraw.Draw(mascara); f = max(4, round(min(nw, nh) * 0.04))
    for i in range(f):
        a = round(255 * (i + 1) / (f + 1))
        if not toca["izq"]: d.line([(i, 0), (i, nh)], fill=a)
        if not toca["der"]: d.line([(nw - 1 - i, 0), (nw - 1 - i, nh)], fill=a)
        if not toca["arr"]: d.line([(0, i), (nw, i)], fill=a)
        if not toca["aba"]: d.line([(0, nh - 1 - i), (nw, nh - 1 - i)], fill=a)
    nuevo.paste(pieza, (px, py), mascara)
    return nuevo, f"escala {s:.2f}" + (f", pegada a {'/'.join(k for k, v in toca.items() if v)}" if any(toca.values()) else "")


if __name__ == "__main__":
    raiz = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    fotos = f"{raiz}/public/fotos"
    ver = "--ver" in sys.argv
    pedidos = [a for a in sys.argv[1:] if not a.startswith("--")] or sorted(os.listdir(fotos))
    n = 0
    for slug in pedidos:
        d = f"{fotos}/{slug}"
        if not os.path.isdir(d): continue
        for f in sorted(os.listdir(d)):
            if not f.endswith(".webp"): continue
            nuevo, motivo = encuadrar(Image.open(f"{d}/{f}"))
            if nuevo is None: continue
            n += 1; print(f"{slug}/{f}: {motivo}")
            if not ver: nuevo.save(f"{d}/{f}", quality=82, method=6)
    print(f"{n} fotos {'para encuadrar' if ver else 'encuadradas'}")
