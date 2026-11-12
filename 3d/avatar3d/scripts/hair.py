"""Cody's hair, built the way stylized anime hair is usually modelled: overlapping leaf-shaped
clumps (locks) that start near the crown, hug the scalp, then lift off into sharp tips.

Every lock visible in the drawing is traced from it (root, optional bend, tip in drawing px);
the locks behind the head are laid out in tiers around the crown. A thin inner scalp, trimmed
by the drawing's face outline, fills the gaps so no skin shows between locks.
"""
import math

import bmesh
from mathutils import Vector

import build_avatar as A

SCALP_C = Vector((0.02, 1.57, -0.01))
SCALP_ABC = (0.42, 0.52, 0.47)
SCALP_E = 2.4
Z = Vector((0, 0, 1))


def scalp_r(d):
    a, b, c = SCALP_ABC
    e = SCALP_E
    return (abs(d.x / a) ** e + abs(d.y / b) ** e + abs(d.z / c) ** e) ** (-1 / e)


def scalp_point_px(x, y, out=0.0):
    """Front-most scalp point whose front projection is drawing px (x, y)."""
    X, Y = A.P(x, y)
    a, b, c = SCALP_ABC
    e = SCALP_E
    v = 1 - abs((X - SCALP_C.x) / a) ** e - abs((Y - SCALP_C.y) / b) ** e
    z = SCALP_C.z + (c * max(v, 0.0) ** (1 / e))
    p = Vector((X, Y, z))
    return p + (p - SCALP_C).normalized() * out


def sph(theta_deg, phi_deg):
    """Direction from the scalp centre: theta around Y (0 = front, 90 = his left/+X), phi elevation."""
    t, f = math.radians(theta_deg), math.radians(phi_deg)
    return Vector((math.sin(t) * math.cos(f), math.sin(f), math.cos(t) * math.cos(f)))


def slerp(a, b, s):
    a, b = a.normalized(), b.normalized()
    dot = max(-1.0, min(1.0, a.dot(b)))
    om = math.acos(dot)
    if om < 1e-4:
        return a
    return (a * math.sin((1 - s) * om) + b * math.sin(s * om)) / math.sin(om)


def hug_path(root, tip, mid=None, segs=12, off=0.03, lift_start=0.45):
    """Follow the scalp from root toward tip's direction, then leave it for the tip."""
    C = SCALP_C
    d0, d1 = (root - C).normalized(), (tip - C).normalized()
    dm = (mid - C).normalized() if mid is not None else None
    r0, r1 = (root - C).length, (tip - C).length
    pts = []
    for i in range(segs + 1):
        s = i / segs
        if dm is not None:
            d = (d0 * (1 - s) ** 2 + dm * 2 * s * (1 - s) + d1 * s * s).normalized()
        else:
            d = slerp(d0, d1, s)
        rs = scalp_r(d) + off
        r = A.lerp(A.lerp(r0, rs, A.smoothstep(0, 0.2, s)), r1, A.smoothstep(lift_start, 1, s))
        pts.append(C + d * r)
    return pts


def free_path(root, mid, tip, segs=12):
    return [root * (1 - s) ** 2 + mid * 2 * s * (1 - s) + tip * s * s for s in (i / segs for i in range(segs + 1))]


def lock_mesh(path, w0, th0, face_bias=0.0, curl=0.16, across=4):
    """Leaf-shaped clump along path: domed top, flatter underside, sharp side edges, pointed tip."""
    n = len(path)
    bm = bmesh.new()
    rings = []
    for i, p in enumerate(path):
        s = i / (n - 1)
        if i == n - 1:
            rings.append([bm.verts.new(A.V(*p))])
            continue
        t = (path[min(i + 1, n - 1)] - path[max(i - 1, 0)]).normalized()
        radial = (p - SCALP_C).normalized()
        nr = (radial * (1 - face_bias) + Z * face_bias).normalized()
        side = t.cross(nr)
        if side.length < 1e-5:
            side = t.cross(Vector((0, 1, 0)))
        side.normalize()
        nn = side.cross(t).normalized()
        if nn.dot(nr) < 0:
            nn = -nn
        shape = math.sin(math.pi * (0.2 + 0.8 * s))        # wide near the root third, sharp tip
        w = w0 * shape
        th = th0 * max(shape, 0.0) ** 0.7
        top, bot = [], []
        for j in range(across + 1):
            u = -1 + 2 * j / across
            bulge = (1 - u * u) ** 0.6
            base = p + side * (u * w / 2) - nn * (curl * w * u * u)
            top.append(base + nn * th * bulge)
            bot.append(base - nn * th * 0.3 * bulge)
        loop = top + bot[-2:0:-1]
        rings.append([bm.verts.new(A.V(*q)) for q in loop])
    m = len(rings[0])
    for ra, rb in zip(rings[:-2], rings[1:-1]):
        for k in range(m):
            bm.faces.new((ra[k], ra[(k + 1) % m], rb[(k + 1) % m], rb[k]))
    tipv, last = rings[-1][0], rings[-2]
    for k in range(m):
        bm.faces.new((last[k], last[(k + 1) % m], tipv))
    bm.faces.new(list(reversed(rings[0])))
    bm.edges.ensure_lookup_table()
    # sharp side edges -> the toon/ink pass draws them like the drawing's strand lines
    for ra, rb in zip(rings[:-2], rings[1:-1]):
        for k in (0, across):
            e = bm.edges.get((ra[k], rb[k]))
            if e:
                e.smooth = False
    for k in (0, across):
        e = bm.edges.get((rings[-2][k], tipv))
        if e:
            e.smooth = False
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces[:])
    return bm


def px3(x, y, z):
    X, Y = A.P(x, y)
    return Vector((X, Y, z))


# ------------------------------------------------------------------------------------------
# Locks traced from the drawing (drawing px). tip z: number, or "face" = lying on his face.
#   name, root px, bend px (or None), tip px, tip z, width, thickness, face_bias, mode
FRONT_LOCKS = [
    # the big up-flick on top
    ("top_spike", (250, 128), (262, 52), (340, 10), -0.06, 0.18, 0.07, 0.55, "free"),
    # crown locks sweeping to his left (viewer's right)
    ("top_right", (300, 105), None, (503, 90), -0.06, 0.22, 0.08, 0.45, "hug"),
    ("right_small", (390, 140), None, (531, 183), -0.03, 0.15, 0.07, 0.45, "hug"),
    ("swoop", (390, 175), (540, 228), (645, 272), -0.06, 0.19, 0.08, 0.5, "hug"),
    ("right_flick", (460, 230), None, (582, 318), -0.02, 0.10, 0.06, 0.5, "hug"),
    ("right_long", (430, 215), (535, 300), (578, 405), -0.02, 0.15, 0.07, 0.45, "hug"),
    ("by_ear", (440, 250), None, (522, 470), 0.08, 0.12, 0.06, 0.45, "hug"),
    # fringe over the right eye and between the brows
    ("fringe_eye_out", (420, 205), None, (478, 428), 0.20, 0.12, 0.05, 0.6, "hug"),
    ("fringe_eye", (375, 175), None, (448, 415), 0.27, 0.17, 0.055, 0.65, "hug"),
    ("fringe_center", (305, 150), None, (352, 335), "face", 0.17, 0.05, 0.7, "hug"),
    ("fringe_small", (255, 165), None, (222, 262), "face", 0.09, 0.045, 0.7, "hug"),
    # locks fanning down his right side (viewer's left)
    ("left_cheek", (232, 150), (165, 250), (138, 400), 0.12, 0.13, 0.06, 0.5, "hug"),
    ("left_high", (232, 128), (150, 190), (75, 292), -0.10, 0.15, 0.07, 0.5, "hug"),
    ("left_low", (210, 185), (140, 260), (80, 358), -0.06, 0.13, 0.065, 0.5, "hug"),
]

# Locks behind and around the head, laid out in tiers from the crown (theta, phi in degrees).
#   root (theta, phi), tip (theta, phi), tip lift (x scalp radius), width, thickness
BACK_LOCKS = []
for th in (125, 152, 180, 208, 235):                          # upper tier: flares into spikes (hidden from the front)
    BACK_LOCKS.append(((th, 58), (th + 5, 6), 1.20, 0.27, 0.085))
for th in (100,):                                             # his left side, behind the swoop
    BACK_LOCKS.append(((th, 55), (th + 8, 0), 1.06, 0.24, 0.075))
BACK_LOCKS.append(((248, 50), (240, 0), 1.03, 0.22, 0.07))   # his right side, tucked behind the face locks
for th in (114, 142, 170, 198, 226, 254):                     # lower tier: hangs to the nape
    BACK_LOCKS.append(((th, 30), (th + 4, -38), 1.10, 0.25, 0.075))
for th in (-50, -15, 20, 55, 90, 130, 230):                   # top cover, crown toward the front, lying flat
    BACK_LOCKS.append(((180, 84), (th, 45), 1.01, 0.27, 0.06))


def resolve_tip(tip_px, tz):
    X, Y = A.P(*tip_px)
    if tz == "face":
        return Vector((X, Y, A.head_front_z(X, Y) + 0.015))
    return Vector((X, Y, tz))


def build(mats, json_poly):
    bms = []
    # inner scalp, trimmed by the drawing's face outline so the hairline matches from the front
    scalp = A.to_object(A.superellipsoid(*SCALP_ABC, SCALP_E, tuple(SCALP_C), cuts=14), "Hair", mats["cody_hair"])
    face_cut = A.prism([A.P(x, y) for x, y in json_poly], 0.06, 1.5, "cut_face")
    A.apply_boolean(scalp, face_cut)
    low = A.box_cutter("cut_low", A.V(0, 1.38 - 0.6, 0), (3, 3, 1.2))
    low.rotation_euler = (math.radians(-14), 0, 0)
    import bpy
    bpy.context.view_layer.update()
    A.apply_boolean(scalp, low)
    bpy.data.objects.remove(low)

    def trim(bm):
        """Cut away any part of a lock that sits where the drawing shows face (front half only)."""
        if max(A.mine(v.co).z for v in bm.verts) < 0.06:
            return bm
        ob = A.to_object(bm, "lock_tmp", mats["cody_hair"])
        A.apply_boolean(ob, face_cut)
        out = bmesh.new()
        out.from_mesh(ob.data)
        me = ob.data
        bpy.data.objects.remove(ob)
        bpy.data.meshes.remove(me)
        return out

    for name, root_px, bend_px, tip_px, tz, w, th, fb, mode in FRONT_LOCKS:
        root = scalp_point_px(*root_px, out=-0.01)
        tip = resolve_tip(tip_px, tz)
        if mode == "free":
            mid = px3(*bend_px, (root.z + tip.z) / 2 + 0.02)
            path = free_path(root, mid, tip)
        else:
            mid = scalp_point_px(*bend_px, out=0.05) if bend_px else None
            path = hug_path(root, tip, mid)
        bms.append(trim(lock_mesh(path, w, th, fb)))

    for (t0, f0), (t1, f1), lift, w, th in BACK_LOCKS:
        d0, d1 = sph(t0, f0), sph(t1, f1)
        root = SCALP_C + d0 * (scalp_r(d0) - 0.01)
        tip = SCALP_C + d1 * (scalp_r(d1) * lift)
        bms.append(trim(lock_mesh(hug_path(root, tip, lift_start=0.5), w, th, 0.0)))
    bpy.data.objects.remove(face_cut)

    locks = A.to_object(A.merge_bms(bms), "HairLocks", mats["cody_hair"])
    bpy.ops.object.select_all(action="DESELECT")
    locks.select_set(True)
    scalp.select_set(True)
    bpy.context.view_layer.objects.active = scalp
    bpy.ops.object.join()
    return scalp
