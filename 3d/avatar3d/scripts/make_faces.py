"""Cut the eyes, brows and mouth out of Cody's five drawings into face textures.

Each texture is a front view of the face region on flat skin colour, with only the
hand-drawn features kept (no hair, no face outline). The Blender build projects it
straight onto the front of the head, so the features land where the drawing has them.

    python3 3d/avatar3d/scripts/make_faces.py
"""
from pathlib import Path
import numpy as np
from PIL import Image, ImageDraw

ROOT = Path(__file__).resolve().parents[3]
SRC = ROOT / "code char"            # 3500x3500 originals
OUT = ROOT / "3d/avatar3d/textures"
NAMES = ["not_talking", "talking", "smug", "sure", "evil"]

# --- shared mapping (keep in sync with build_avatar.py) -------------------------
# "small" px = the 654x1024 crops in prototype/avatar. Figure spans y 7..1015 there.
FACE_BOX = (90, 200, 490, 600)        # small-px region the face texture covers (x0, y0, x1, y1)
SIZE = 1024
SKIN = np.array([250, 236, 221])
HAIR = np.array([49, 82, 50])
PINK = np.array([242, 186, 171])
FEATURE_ZONE = (150, 285, 434, 540)   # small px: where eyes/brows/mouth live
# hand-picked leftovers to wipe (small px): the bang tip's outline touching the smug brow's peak
ERASE = {"smug": [(344, 318, 362, 336), (344, 336, 357.5, 338.5)]}


def big(x, y):
    """small-crop px -> 3500px original px"""
    return 875 + (x - 7) * 1630 / 638, 457 + (y - 7) * 2575 / 1008


def dilate(m, r):
    out = m.copy()
    H, W = m.shape
    for dy in range(-r, r + 1):
        for dx in range(-r, r + 1):
            if dx * dx + dy * dy > r * r or (dx == 0 and dy == 0):
                continue
            src = m[max(0, -dy):H - max(0, dy), max(0, -dx):W - max(0, dx)]
            out[max(0, dy):H - max(0, -dy), max(0, dx):W - max(0, -dx)] |= src
    return out


def erode(m, r):
    return ~dilate(~m, r)


def fill_holes(m):
    """Fill regions of ~m not connected to the border."""
    im = Image.fromarray(np.where(m, 255, 0).astype(np.uint8), "L")
    im = Image.fromarray(np.pad(np.array(im), 1)).copy()  # copy: floodfill is a no-op on array-backed images
    ImageDraw.floodfill(im, (0, 0), 128)
    a = np.array(im)[1:-1, 1:-1]
    return a != 128


def drop_small(m, min_px):
    """Remove 8-connected blobs smaller than min_px."""
    im = Image.fromarray(np.where(m, 255, 0).astype(np.uint8)).copy()
    keep = np.zeros_like(m)
    ys, xs = np.nonzero(m)
    a = np.array(im)
    for y, x in zip(ys, xs):
        if a[y, x] != 255:
            continue
        ImageDraw.floodfill(im, (int(x), int(y)), 100)
        a = np.array(im)
        blob = a == 100
        if blob.sum() >= min_px:
            keep |= blob
        im.paste(0, mask=Image.fromarray((blob * 255).astype(np.uint8)))
        a = np.array(im)
    return keep


def near(rgb, col, tol):
    return np.abs(rgb.astype(int) - col).max(-1) < tol


def make(name):
    im = Image.open(SRC / f"{name}.png").convert("RGBA")
    x0, y0 = big(FACE_BOX[0], FACE_BOX[1])
    x1, y1 = big(FACE_BOX[2], FACE_BOX[3])
    crop = im.crop((round(x0), round(y0), round(x1), round(y1))).resize((SIZE, SIZE), Image.LANCZOS)
    a = np.array(crop)
    rgb, alpha = a[..., :3], a[..., 3]
    opaque = alpha > 128
    skin = near(rgb, SKIN, 30) & opaque
    g = rgb.astype(int)
    hair = (g[..., 1] - g[..., 0] > 15) & (g[..., 1] - g[..., 2] > 15) & opaque  # green-dominant
    ink = (rgb.max(-1) < 110) & opaque
    pink = near(rgb, PINK, 40) & opaque

    # skin with thin lines closed over (so a brow touching the hair still counts as "inside")
    inside = fill_holes(erode(dilate(skin, 15), 15))
    zone = np.zeros_like(skin)
    s = SIZE / (FACE_BOX[2] - FACE_BOX[0])
    zx0, zy0 = int((FEATURE_ZONE[0] - FACE_BOX[0]) * s), int((FEATURE_ZONE[1] - FACE_BOX[1]) * s)
    zx1, zy1 = int((FEATURE_ZONE[2] - FACE_BOX[0]) * s), int((FEATURE_ZONE[3] - FACE_BOX[1]) * s)
    zone[zy0:zy1, zx0:zx1] = True
    feat = (ink | pink) & inside & zone & ~dilate(hair, 7)
    feat = drop_small(feat, 250)  # stray strand tips / outline crumbs
    # keep anti-aliasing: take the drawing's own pixels in a soft band around the features
    band = dilate(feat, 2) & inside & zone
    out = np.empty((SIZE, SIZE, 3), np.uint8)
    out[:] = SKIN
    out[band] = rgb[band]
    # anything in the band that is hair-green becomes skin (stray strand edges)
    out[band & hair] = SKIN
    for x0, y0, x1, y1 in ERASE.get(name, []):
        X0, Y0 = int((x0 - FACE_BOX[0]) * s), int((y0 - FACE_BOX[1]) * s)
        X1, Y1 = int((x1 - FACE_BOX[0]) * s), int((y1 - FACE_BOX[1]) * s)
        out[Y0:Y1, X0:X1] = SKIN
    Image.fromarray(out, "RGB").save(OUT / f"face_{name}.png", optimize=True)
    return out


if __name__ == "__main__":
    OUT.mkdir(parents=True, exist_ok=True)
    tiles = [make(n) for n in NAMES]
    sheet = Image.new("RGB", (SIZE * 5 // 2, SIZE // 2))
    for i, t in enumerate(tiles):
        sheet.paste(Image.fromarray(t).resize((SIZE // 2, SIZE // 2)), (i * SIZE // 2, 0))
    sheet.save(ROOT / "3d/avatar3d/previews/face_textures.png")
    print("wrote", [f"face_{n}.png" for n in NAMES])
