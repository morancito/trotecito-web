"""Procesa las fotos de cada color que bajó colores.mjs:
   - las cuadra en 600x600 (fondo del color del borde; en fondo blanco borra logos o carteles de arriba),
   - saca los dos colores dominantes de la zapatilla y les pone nombre (o usa el que dice la tienda),
   - descarta colores repetidos (mismo color en otra tienda: queda el más barato),
   y deja public/fotos/<modelo>/c<n>.webp y scripts/colores-final.json.
   python3 scripts/colores-fotos.py"""
import json, os, re, colorsys
from PIL import Image, ImageStat, ImageDraw

RAIZ = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC = f"{RAIZ}/scripts/colores-fotos"
DST = f"{RAIZ}/public/fotos"

def fondo(im):
    w, h = im.size; tiras = [im.crop((0, 0, w, 4)), im.crop((0, h - 4, w, h)), im.crop((0, 0, 4, h)), im.crop((w - 4, 0, w, h))]
    return tuple(int(sum(ImageStat.Stat(t).median[i] for t in tiras) / 4) for i in range(3))

def sin_logo(im):
    g = im.convert("L").point(lambda v: 255 if v < 238 else 0)
    w, h = im.size
    filas = [g.crop((0, y, w, y + 1)).getbbox() is not None for y in range(h)]
    y, bloques = 0, []
    while y < h:
        if filas[y]:
            y0 = y
            while y < h and filas[y]: y += 1
            bloques.append([y0, y])
        y += 1
    if len(bloques) >= 2 and bloques[0][1] < h * 0.25 and bloques[1][0] - bloques[0][1] >= 15:
        ImageDraw.Draw(im).rectangle([0, 0, w, bloques[0][1] + 2], fill=(255, 255, 255))
        g = im.convert("L").point(lambda v: 255 if v < 238 else 0)
    bb = g.getbbox()
    if not bb: return im
    m = int(max(bb[2] - bb[0], bb[3] - bb[1]) * 0.08)
    return im.crop((max(0, bb[0] - m), max(0, bb[1] - m), min(w, bb[2] + m), min(h, bb[3] + m)))

def cuadrar(ruta, lado_final=600):
    im = Image.open(ruta)
    if im.mode in ("RGBA", "LA", "P"):
        im = im.convert("RGBA"); b = Image.new("RGBA", im.size, (255, 255, 255, 255)); b.alpha_composite(im); im = b
    im = im.convert("RGB")
    if fondo(im) == (255, 255, 255): im = sin_logo(im)
    w, h = im.size; lado = max(w, h)
    c = Image.new("RGB", (lado, lado), fondo(im)); c.paste(im, ((lado - w) // 2, (lado - h) // 2))
    return c.resize((lado_final, lado_final), Image.LANCZOS)

def dominantes(im):
    """los dos colores que más ocupan en la zapatilla (sin el fondo), con su proporción"""
    bg = fondo(im)
    chico = im.resize((120, 120))
    px = [p for p in chico.getdata() if sum(abs(p[i] - bg[i]) for i in range(3)) > 45]
    if len(px) < 200: px = list(chico.getdata())
    q = Image.new("RGB", (len(px), 1)); q.putdata(px)
    pal = q.quantize(colors=6, method=Image.Quantize.MEDIANCUT)
    cuentas = sorted(pal.getcolors(), reverse=True)
    paleta = pal.getpalette()
    out = []
    for n, i in cuentas:
        rgb = tuple(paleta[i * 3:i * 3 + 3])
        if any(sum(abs(rgb[k] - o[0][k]) for k in range(3)) < 70 for o in out): continue
        out.append((rgb, n / len(px)))
    return out[:2]

NOMBRES_ES = [("negr|black|core black|carbon", "Negro"), ("blanc|white|cloud", "Blanco"), ("gris|grey|gray|silver|plata|graphite|grafito", "Gris"),
    ("marino|navy|indigo", "Azul marino"), ("celeste|sky|light blue|cielo", "Celeste"), ("turquesa|aqua|teal|agua|mint|menta", "Verde agua"), ("azul|blue|cobalt|royal", "Azul"),
    ("bord|burgundy|maroon|vino", "Bordó"), ("rosa|pink|fucsia|fuchsia|magenta|coral", "Rosa"), ("roj|red", "Rojo"), ("naranja|orange", "Naranja"),
    ("amarill|yellow|lima|lime|volt|fluo", "Amarillo"), ("verde|green|olive|oliva", "Verde"), ("violeta|lila|purple|lavand|morad|uva", "Violeta"),
    ("beige|crema|cream|arena|sand|natural|hueso|off white|ivory|marfil", "Beige"), ("marr|brown|tierra|camel", "Marrón"), ("dorad|gold", "Dorado")]

def nombre_texto(t):
    """'Negra/Blanca', 'Core Black / Cloud White' -> 'Negro y blanco'"""
    if not t: return None
    partes = [p.strip() for p in re.split(r"[/,]| y | and | - ", t.lower()) if p.strip()]
    vistos = []
    for p in partes:
        for rx, n in NOMBRES_ES:
            if re.search(rx, p):
                if n not in vistos: vistos.append(n)
                break
    if not vistos: return None
    vistos = vistos[:2]
    return vistos[0] if len(vistos) == 1 else f"{vistos[0]} y {vistos[1].lower()}"

def nombre_rgb(rgb):
    r, g, b = (x / 255 for x in rgb)
    h, l, s = colorsys.rgb_to_hls(r, g, b); h *= 360
    if l < 0.16: return "Negro"
    if l > 0.88 and s < 0.35: return "Blanco"
    if s < 0.16: return "Gris" if l < 0.8 else "Blanco"
    if (h < 50 or h > 330) and l > 0.62 and s < 0.6 and 20 < h < 50: return "Beige"
    if h < 12 or h >= 345: return "Bordó" if l < 0.3 else "Rosa" if l > 0.65 else "Rojo"
    if h < 40: return "Marrón" if l < 0.35 else "Beige" if s < 0.45 and l > 0.6 else "Naranja"
    if h < 70: return "Amarillo" if l > 0.35 else "Verde"
    if h < 160: return "Verde"
    if h < 190: return "Verde agua"
    if h < 215: return "Celeste" if l > 0.55 else "Azul"
    if h < 255: return "Azul marino" if l < 0.3 else "Celeste" if l > 0.7 else "Azul"
    if h < 300: return "Violeta"
    return "Rosa"

def nombre_de(dom):
    ns = []
    for rgb, _ in dom:
        n = nombre_rgb(rgb)
        if n not in ns: ns.append(n)
    return ns[0] if len(ns) == 1 else f"{ns[0]} y {ns[1].lower()}"

hexd = lambda rgb: "#%02X%02X%02X" % rgb
dist = lambda a, b: sum((a[i] - b[i]) ** 2 for i in range(3)) ** .5

datos = json.load(open(f"{RAIZ}/scripts/colores.json"))
# solo los modelos que se buscaron en esta corrida (las fotos crudas no se guardan); el resto queda como estaba
try: final = json.load(open(f"{RAIZ}/scripts/colores-final.json"))
except Exception: final = {}
try: hechos = set(x.strip() for x in open(f"{RAIZ}/scripts/colores-hechos.txt") if x.strip())
except Exception: hechos = set(datos)
for slug, vs in datos.items():
    if slug not in hechos or not os.path.isdir(f"{SRC}/{slug}"): continue
    os.makedirs(f"{DST}/{slug}", exist_ok=True)
    for f in os.listdir(f"{DST}/{slug}"):
        if re.match(r"c\d+\.webp$", f): os.remove(f"{DST}/{slug}/{f}")
    elegidas = []
    for v in sorted(vs, key=lambda v: v["precio"]):
        ruta = f"{SRC}/{v['foto']}"
        if not os.path.exists(ruta): continue
        try: im = cuadrar(ruta)
        except Exception as e: print("·", slug, v["url"], e); continue
        dom = dominantes(im)
        if not dom: continue
        # mismo color que uno ya elegido (otra tienda o el otro género): queda el más barato, que es el primero
        if len(elegidas) >= 10: break
        rep = next((e for e in elegidas if dist(e["_d"][0][0], dom[0][0]) < 48 and (len(dom) < 2 or len(e["_d"]) < 2 or dist(e["_d"][1][0], dom[1][0]) < 70)), None)
        if rep:
            rep["otras"].append({k: v[k] for k in ("tienda", "url", "precio", "nota")}); continue
        n = len(elegidas) + 1
        im.save(f"{DST}/{slug}/c{n}.webp", quality=80, method=6)
        elegidas.append({"n": nombre_texto(v.get("color")) or nombre_de(dom), "hex": [hexd(c) for c, _ in dom], "foto": f"fotos/{slug}/c{n}.webp",
                         "tienda": v["tienda"], "url": v["url"], "precio": v["precio"], "antes": v.get("antes"), "nota": v.get("nota", ""),
                         "talles": v.get("talles", []), "sistema": v.get("sistema"), "otras": [], "_d": dom, "_txt": v.get("color")})
    for e in elegidas: e.pop("_d")
    final[slug] = elegidas
    print(slug, len(vs), "->", len(elegidas), [e["n"] for e in elegidas])
json.dump(final, open(f"{RAIZ}/scripts/colores-final.json", "w"), ensure_ascii=False, indent=1)
