"""Trace the outline of Cody's visible face (skin, not hair) in the front drawing.

Writes scripts/hairline.json: a polygon in "small" drawing px (654x1024 crop).
build_avatar.py extrudes it into a cutter that trims the hair cap, so the 3D fringe
matches the drawing exactly when seen from the front.

    python3 3d/avatar3d/scripts/trace_hairline.py
"""
import json
from pathlib import Path
import numpy as np
from PIL import Image
from make_faces import FEATURE_ZONE, NAMES, ROOT, SKIN, dilate, erode, fill_holes, near

SRC = ROOT / "prototype/avatar"   # read-only small crops


def features(name):
    """Eyes/brows/mouth of one expression (small px), so the hair never covers them.
    A brow that touches the fringe would otherwise count as 'not face' and leave a sliver of hair."""
    a = np.array(Image.open(SRC / f"{name}.png").convert("RGBA"))
    rgb, op = a[..., :3], a[..., 3] > 128
    g = rgb.astype(int)
    skin = near(rgb, SKIN, 30) & op
    hair = (g[..., 1] - g[..., 0] > 15) & (g[..., 1] - g[..., 2] > 15) & op
    ink = (rgb.max(-1) < 110) & op
    pink = near(rgb, np.array([242, 186, 171]), 40) & op
    inside = fill_holes(erode(dilate(skin, 6), 6))
    zone = np.zeros_like(skin)
    x0, y0, x1, y1 = FEATURE_ZONE
    zone[y0:y1, x0:x1] = True
    return (ink | pink) & inside & zone & ~dilate(hair, 2)


def marching_squares(m):
    """Return closed loops (lists of (x, y)) around True regions of m."""
    H, W = m.shape
    p = np.pad(m, 1).astype(np.uint8)
    tl, tr, br, bl = p[:-1, :-1], p[:-1, 1:], p[1:, 1:], p[1:, :-1]
    case = tl * 8 + tr * 4 + br * 2 + bl
    # edge midpoints for cell (i, j): top, right, bottom, left (in padded coords - 1)
    segs = {1: [("l", "b")], 2: [("b", "r")], 3: [("l", "r")], 4: [("r", "t")], 5: [("l", "t"), ("r", "b")],
            6: [("b", "t")], 7: [("l", "t")], 8: [("t", "l")], 9: [("t", "b")], 10: [("t", "r"), ("b", "l")],
            11: [("t", "r")], 12: [("r", "l")], 13: [("r", "b")], 14: [("b", "l")]}
    off = {"t": (0.5, 0.0), "r": (1.0, 0.5), "b": (0.5, 1.0), "l": (0.0, 0.5)}
    nxt = {}
    ys, xs = np.nonzero((case > 0) & (case < 15))
    for i, j in zip(ys, xs):
        for a, b in segs[int(case[i, j])]:
            pa = (j - 1 + off[a][0] + 0.5, i - 1 + off[a][1] + 0.5)
            pb = (j - 1 + off[b][0] + 0.5, i - 1 + off[b][1] + 0.5)
            nxt[pa] = pb
    loops, seen = [], set()
    for start in list(nxt):
        if start in seen:
            continue
        loop, p = [], start
        while p not in seen and p in nxt:
            seen.add(p)
            loop.append(p)
            p = nxt[p]
        if len(loop) > 20:
            loops.append(loop)
    return loops


def rdp(pts, eps):
    pts = np.asarray(pts, float)
    if len(pts) < 3:
        return pts
    a, b = pts[0], pts[-1]
    ab, ap = b - a, pts - a
    d = np.abs(ab[0] * ap[:, 1] - ab[1] * ap[:, 0]) / (np.linalg.norm(ab) + 1e-9)
    i = int(np.argmax(d))
    if d[i] > eps:
        return np.vstack([rdp(pts[: i + 1], eps)[:-1], rdp(pts[i:], eps)])
    return np.vstack([a, b])


if __name__ == "__main__":
    a = np.array(Image.open(SRC / "not_talking.png").convert("RGBA"))
    rgb, op = a[..., :3], a[..., 3] > 128
    skin = near(rgb, SKIN, 30) & op
    for n in NAMES:                       # every expression's features count as face
        skin |= features(n)
    skin[575:] = False                    # head only (hands are skin too)
    face = fill_holes(erode(dilate(skin, 3), 3))   # bridge the eyes/brows/mouth and thin lines
    face = dilate(face, 2)                # reach the middle of the ink outline
    loops = marching_squares(face)
    loop = max(loops, key=len)
    # make it start somewhere stable and simplify
    L = np.asarray(loop)
    k = int(np.argmax(((L - L[0]) ** 2).sum(1)))   # split the closed loop in two open halves
    poly = np.vstack([rdp(L[: k + 1], 0.8)[:-1], rdp(np.vstack([L[k:], L[:1]]), 0.8)[:-1]])
    json.dump({"space": "small drawing px (654x1024 crop)", "face_visible": poly.round(2).tolist()},
              open(Path(__file__).with_name("hairline.json"), "w"))
    print(len(loop), "->", len(poly), "points; bbox", poly.min(0), poly.max(0))
