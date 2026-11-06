"""Centra verticalmente la zapatilla en las fotos de fondo liso (si quedó muy abajo o muy arriba, en la tarjeta
del catálogo se corta: la tarjeta es 4:3 y recorta arriba y abajo).
   python3 scripts/centrar-fotos.py [modelo ...]     (sin modelos: todos)"""
import os, sys
from PIL import Image, ImageChops

RAIZ = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
FOTOS = f"{RAIZ}/public/fotos"
pedidos = sys.argv[1:] or sorted(os.listdir(FOTOS))
n = 0
for slug in pedidos:
    d = f"{FOTOS}/{slug}"
    if not os.path.isdir(d): continue
    for f in sorted(os.listdir(d)):
        if not f.endswith(".webp"): continue
        ruta = f"{d}/{f}"; im = Image.open(ruta).convert("RGB"); w, h = im.size
        esquinas = [im.getpixel(p) for p in [(2, 2), (w - 3, 2), (2, h - 3), (w - 3, h - 3)]]
        bg = tuple(sorted(c[i] for c in esquinas)[1] for i in range(3))
        if max(abs(c[i] - bg[i]) for c in esquinas for i in range(3)) > 10: continue   # fondo con degradé: no se toca
        dif = ImageChops.difference(im, Image.new("RGB", im.size, bg)).convert("L").point(lambda v: 255 if v > 18 else 0)
        bb = dif.getbbox()
        if not bb or bb[3] - bb[1] > h * 0.8: continue
        dy = round(h / 2 - (bb[1] + bb[3]) / 2)
        if abs(dy) < h * 0.02: continue
        nuevo = Image.new("RGB", im.size, bg); nuevo.paste(im, (0, dy))
        # lo que entra desde el borde se rellena con el fondo (la foto se corrió)
        nuevo.save(ruta, quality=82, method=6); n += 1
        print(f"{slug}/{f}: {'subió' if dy < 0 else 'bajó'} {abs(dy)} px")
print(f"{n} fotos centradas")
