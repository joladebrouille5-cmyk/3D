"""Découpe les planches de portraits générés (art/faces-src/planche-NN.jpg) en vignettes
assets/faces/fNNN.webp (128 px) et écrit src/data/faces.js. Usage : python3 tools/split-faces.py
Les gouttières blanches entre les portraits sont détectées automatiquement."""
import glob, json, os
from PIL import Image, ImageFilter

ROOT = os.path.join(os.path.dirname(__file__), '..')
OUT = os.path.join(ROOT, 'assets/faces')
os.makedirs(OUT, exist_ok=True)

def runs(flags, min_len=1):
    """Plages consécutives où flags est faux (contenu), séparées par des gouttières."""
    out, start = [], None
    for i, f in enumerate(flags + [True]):
        if not f and start is None: start = i
        if f and start is not None:
            if i - start >= min_len: out.append((start, i))
            start = None
    return out

def is_white(px):
    return px[0] > 225 and px[1] > 225 and px[2] > 225

def split(path):
    im = Image.open(path).convert('RGB')
    W, H = im.size
    px = im.load()
    step = 2
    row_sep = []
    for y in range(H):
        wcount = sum(1 for x in range(0, W, step) if is_white(px[x, y]))
        row_sep.append(wcount / (W / step) > 0.55)
    cells = []
    for (y0, y1) in runs(row_sep, 60):
        col_sep = []
        for x in range(W):
            wcount = sum(1 for y in range(y0, y1, step) if is_white(px[x, y]))
            col_sep.append(wcount / ((y1 - y0) / step) > 0.7)
        for (x0, x1) in runs(col_sep, 60):
            cells.append((x0, y0, x1, y1))
    if len(cells) < 20:
        # planche sans gouttières blanches : grille 8 × 5 recalée sur les fines lignes de séparation
        # (on cherche, près de chaque limite théorique, la ligne où l'image change le plus brusquement)
        g = im.convert('L')
        gp = g.load()
        def row_mean(y): return sum(gp[x, y] for x in range(0, W, 3)) / (W / 3)
        def col_mean(x, y0, y1): return sum(gp[x, y] for y in range(y0, y1, 3)) / ((y1 - y0) / 3)
        def snap(k, n, size, mean):
            c = round(k * size / n)
            if k in (0, n): return c
            best, by = -1, c
            for y in range(max(1, c - 18), min(size - 2, c + 18)):
                d = abs(mean(y) - mean(y - 1)) + abs(mean(y + 1) - mean(y))
                if d > best: best, by = d, y
            return by
        rows_b = [snap(k, 5, H, row_mean) for k in range(6)]
        cells = []
        for r in range(5):
            y0, y1 = rows_b[r], rows_b[r + 1]
            cols_b = [snap(k, 8, W, lambda x: col_mean(x, y0, y1)) for k in range(9)]
            for c in range(8):
                cells.append((cols_b[c] + 4, y0 + 4, cols_b[c + 1] - 4, y1 - 4))
    return im, cells

faces = []
for n, path in enumerate(sorted(glob.glob(os.path.join(ROOT, 'art/faces-src/planche-*.jpg'))), start=1):
    im, cells = split(path)
    numbered = n == 12  # planche avec des numéros dans le coin supérieur gauche
    for (x0, y0, x1, y1) in cells:
        cell = im.crop((x0, y0, x1, y1))
        w, h = cell.size
        if numbered:
            # efface le numéro : copie miroir du coin supérieur droit (arrière-plan du stade)
            pw, ph = min(44, w // 3), min(30, h // 4)
            patch = cell.crop((w - pw, 0, w, ph)).transpose(Image.FLIP_LEFT_RIGHT).filter(ImageFilter.GaussianBlur(2))
            cell.paste(patch, (0, 0))
        side = min(w, h)
        left = (w - side) // 2
        sq = cell.crop((left, 0, left + side, side)).resize((128, 128), Image.LANCZOS)
        idx = len(faces)
        name = f'f{idx:03d}.webp'
        sq.save(os.path.join(OUT, name), 'WEBP', quality=80, method=6)
        faces.append({'f': name, 'p': n})
    print(f'planche {n:02d} : {len(cells)} portraits')

with open(os.path.join(ROOT, 'src/data/faces.js'), 'w') as fh:
    fh.write('// Généré par tools/split-faces.py — portraits générés (personnes fictives), fournis par l\'utilisateur.\n')
    fh.write('// p = numéro de planche (chaque planche regroupe des profils proches).\n')
    fh.write('export const FACES = ' + json.dumps(faces, separators=(',', ':')) + ';\n')
print(len(faces), 'portraits')
