"""Build Cody's seated chibi avatar in Blender from his drawings.

    B=/Applications/Blender.app/Contents/MacOS/Blender
    "$B" -b --factory-startup -Y --python 3d/avatar3d/scripts/build_avatar.py

Writes 3d/avatar3d/cody_avatar.blend and cody_avatar.glb.

Frames: "my" frame is X right, Y up, Z toward the viewer (= three.js / glTF).
Blender is Z-up, -Y forward, so V(x, y, z) -> Blender (x, -z, y). The glTF exporter
turns that back into Y-up with the character facing +Z.
Drawing px ("small", the 654x1024 crops) map to units with P(): 1008 px of figure = 2.3 units.
"""
import json
import math
import sys
from pathlib import Path

import bmesh
import bpy
from mathutils import Matrix, Vector

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE))
OUT = HERE.parent
TEX = OUT / "textures"

U = 2.3 / 1008          # units per drawing px
CX = 288                # drawing px of the face centre line


def P(x, y):
    """drawing px -> (X, Y) units"""
    return (x - CX) * U, (1015 - y) * U


def V(x, y, z):
    return Vector((x, -z, y))


def mine(co):
    """Blender co -> my frame"""
    return Vector((co.x, co.z, -co.y))


def smoothstep(a, b, x):
    t = min(1.0, max(0.0, (x - a) / (b - a)))
    return t * t * (3 - 2 * t)


def lerp(a, b, t):
    return a + (b - a) * t


# ----------------------------------------------------------------------------- scene
def reset():
    bpy.ops.wm.read_factory_settings(use_empty=True)
    sc = bpy.context.scene
    sc.unit_settings.system = "METRIC"
    return sc


def srgb(c):
    c = c / 255
    return c / 12.92 if c <= 0.04045 else ((c + 0.055) / 1.055) ** 2.4


COLORS = {   # sampled from the drawings (sRGB 0-255)
    "cody_skin": (250, 236, 221),
    "cody_hair": (49, 82, 50),
    "cody_sweater": (23, 54, 35),
    "cody_pants": (144, 24, 25),
    "cody_shoes": (144, 83, 24),
}


def make_material(name, rgb=None, image=None):
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    nt = m.node_tree
    bsdf = nt.nodes["Principled BSDF"]
    bsdf.inputs["Roughness"].default_value = 1.0
    bsdf.inputs["Metallic"].default_value = 0.0
    if rgb:
        bsdf.inputs["Base Color"].default_value = (*[srgb(c) for c in rgb], 1.0)
    if image:
        tex = nt.nodes.new("ShaderNodeTexImage")
        tex.image = bpy.data.images.load(str(image))
        tex.extension = "EXTEND"
        tex.location = (-400, 200)
        nt.links.new(tex.outputs["Color"], bsdf.inputs["Base Color"])
    return m


# ----------------------------------------------------------------------------- mesh utils
def to_object(bm, name, material, smooth=True, parent=None):
    me = bpy.data.meshes.new(name)
    bm.normal_update()
    bm.to_mesh(me)
    bm.free()
    ob = bpy.data.objects.new(name, me)
    bpy.context.scene.collection.objects.link(ob)
    me.materials.append(material)
    for p in me.polygons:
        p.use_smooth = smooth
    if parent:
        ob.parent = parent
    return ob


def quadsphere(cuts=8):
    bm = bmesh.new()
    bmesh.ops.create_cube(bm, size=2)
    bmesh.ops.subdivide_edges(bm, edges=bm.edges[:], cuts=cuts, use_grid_fill=True)
    for v in bm.verts:
        v.co = v.co.normalized()
    return bm


def superellipsoid(a, b, c, e, center, cuts=8, warp=None):
    """Rounded-box ellipsoid in my frame; warp(p, n) may reshape each point."""
    bm = quadsphere(cuts)
    cx, cy, cz = center
    for v in bm.verts:
        n = mine(v.co)
        r = (abs(n.x) ** e + abs(n.y) ** e + abs(n.z) ** e) ** (-1 / e)
        p = n * r
        q = Vector((p.x * a, p.y * b, p.z * c))
        if warp:
            q = warp(q, p)
        v.co = V(q.x + cx, q.y + cy, q.z + cz)
    return bm


def tube(points, radii, sides=12, flat=None, caps=True, up=Vector((0, 1, 0))):
    """Sweep a circle along a polyline (my frame); radii per point. Rounded caps."""
    bm = bmesh.new()
    pts = [Vector(p) for p in points]
    rings = []
    prev_side = None
    for i, p in enumerate(pts):
        t = (pts[min(i + 1, len(pts) - 1)] - pts[max(i - 1, 0)]).normalized()
        ref = up if abs(t.dot(up)) < 0.95 else Vector((0, 0, 1))
        side = t.cross(ref).normalized()
        if prev_side is not None and side.dot(prev_side) < 0:
            side = -side
        prev_side = side
        w = side.cross(t).normalized()
        f = flat[i] if flat else 1.0
        ring = []
        for k in range(sides):
            a = 2 * math.pi * k / sides
            q = p + side * math.cos(a) * radii[i] + w * math.sin(a) * radii[i] * f
            ring.append(bm.verts.new(V(*q)))
        rings.append(ring)
    for r0, r1 in zip(rings, rings[1:]):
        for k in range(sides):
            bm.faces.new((r0[k], r0[(k + 1) % sides], r1[(k + 1) % sides], r1[k]))
    if caps:
        for ring, pt, nb, sgn in ((rings[0], pts[0], pts[1], -1), (rings[-1], pts[-1], pts[-2], 1)):
            d = (pt - nb).normalized()
            r = radii[0] if sgn < 0 else radii[-1]
            # two extra rings that round the end off
            c1 = [bm.verts.new(V(*(pt + (mine(v.co) - pt) * 0.75 + d * r * 0.55))) for v in ring]
            tip = bm.verts.new(V(*(pt + d * r * 0.8)))
            for k in range(sides):
                a, b = ring[k], ring[(k + 1) % sides]
                c, e = c1[(k + 1) % sides], c1[k]
                bm.faces.new((a, b, c, e) if sgn > 0 else (e, c, b, a))
                bm.faces.new((e, c, tip) if sgn > 0 else (tip, c, e))
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces[:])
    return bm


def bezier(p0, p1, p2, n):
    p0, p1, p2 = Vector(p0), Vector(p1), Vector(p2)
    return [p0 * (1 - t) ** 2 + p1 * 2 * t * (1 - t) + p2 * t * t for t in (i / (n - 1) for i in range(n))]


def catmull(points, per=4):
    """Smooth polyline through points (my frame)."""
    pts = [Vector(p) for p in points]
    pts = [pts[0] * 2 - pts[1]] + pts + [pts[-1] * 2 - pts[-2]]
    out = []
    for i in range(1, len(pts) - 2):
        p0, p1, p2, p3 = pts[i - 1:i + 3]
        for k in range(per):
            t = k / per
            out.append(0.5 * ((2 * p1) + (-p0 + p2) * t + (2 * p0 - 5 * p1 + 4 * p2 - p3) * t * t
                              + (-p0 + 3 * p1 - 3 * p2 + p3) * t ** 3))
    out.append(pts[-2])
    return out


def interp(vals, n):
    """Resample a list of values to n entries (linear)."""
    out = []
    for i in range(n):
        x = i / (n - 1) * (len(vals) - 1)
        k = min(int(x), len(vals) - 2)
        out.append(lerp(vals[k], vals[k + 1], x - k))
    return out


def spike(root, tip, r0, flat=0.55, bend=(0, 0, 0), normal=None, segs=7, sides=6):
    """A tapered, slightly flattened, curved hair lock from root to tip (my frame)."""
    root, tip = Vector(root), Vector(tip)
    ctrl = (root + tip) / 2 + Vector(bend)
    path = bezier(root, ctrl, tip, segs + 1)
    normal = Vector(normal) if normal else (root - Vector((0, 1.55, 0))).normalized()
    bm = bmesh.new()
    rings = []
    for i, p in enumerate(path[:-1]):
        t = (path[i + 1] - path[max(i - 1, 0)]).normalized()
        side = t.cross(normal)
        if side.length < 1e-4:
            side = t.cross(Vector((0, 0, 1)))
        side.normalize()
        w = side.cross(t).normalized()
        s = i / segs
        r = r0 * (1 - s) ** 0.9 * (1 + 0.25 * math.sin(math.pi * min(1, s * 1.6)))
        rings.append([bm.verts.new(V(*(p + side * math.cos(2 * math.pi * k / sides) * r
                                         + w * math.sin(2 * math.pi * k / sides) * r * flat)))
                      for k in range(sides)])
    tipv = bm.verts.new(V(*path[-1]))
    for r_a, r_b in zip(rings, rings[1:]):
        for k in range(sides):
            bm.faces.new((r_a[k], r_a[(k + 1) % sides], r_b[(k + 1) % sides], r_b[k]))
    for k in range(sides):
        bm.faces.new((rings[-1][k], rings[-1][(k + 1) % sides], tipv))
    bm.faces.new(list(reversed(rings[0])))
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces[:])
    return bm


def merge_bms(bms):
    out = bmesh.new()
    me = bpy.data.meshes.new("tmp")
    for bm in bms:
        bm.to_mesh(me)
        out.from_mesh(me)
        bm.free()
    bpy.data.meshes.remove(me)
    return out


def apply_boolean(ob, cutter, op="DIFFERENCE"):
    mod = ob.modifiers.new("bool", "BOOLEAN")
    mod.operation = op
    mod.solver = "EXACT"
    mod.object = cutter
    bpy.context.view_layer.objects.active = ob
    bpy.ops.object.modifier_apply(modifier=mod.name)


def prism(poly_xy, z0, z1, name):
    """Extrude a 2D polygon (my X,Y) between depths z0..z1 into a closed mesh object."""
    bm = bmesh.new()
    front = [bm.verts.new(V(x, y, z1)) for x, y in poly_xy]
    back = [bm.verts.new(V(x, y, z0)) for x, y in poly_xy]
    n = len(poly_xy)
    bm.faces.new(front)
    bm.faces.new(list(reversed(back)))
    for i in range(n):
        j = (i + 1) % n
        bm.faces.new((front[i], back[i], back[j], front[j]))
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces[:])
    me = bpy.data.meshes.new(name)
    bm.to_mesh(me)
    bm.free()
    ob = bpy.data.objects.new(name, me)
    bpy.context.scene.collection.objects.link(ob)
    return ob


def box_cutter(name, center, size, rot_x=0.0):
    bm = bmesh.new()
    bmesh.ops.create_cube(bm, size=1)
    for v in bm.verts:
        v.co = Vector((v.co.x * size[0], v.co.y * size[1], v.co.z * size[2]))
    me = bpy.data.meshes.new(name)
    bm.to_mesh(me)
    bm.free()
    ob = bpy.data.objects.new(name, me)
    bpy.context.scene.collection.objects.link(ob)
    ob.location = center
    ob.rotation_euler = (rot_x, 0, 0)
    bpy.context.view_layer.update()
    return ob


# ----------------------------------------------------------------------------- parts
HEAD_C = (0.0, 1.53, 0.03)
HEAD_ABC = (0.37, 0.50, 0.40)


# half-width of the face by height, read off the drawing's face outline
HEAD_PROFILE = [(1.03, 0.10), (1.06, 0.17), (1.12, 0.26), (1.19, 0.335), (1.30, 0.365),
                (1.50, 0.372), (1.70, 0.36), (1.85, 0.32), (1.97, 0.22), (2.03, 0.0)]


def profile(y, table):
    if y <= table[0][0]:
        return table[0][1]
    for (y0, w0), (y1, w1) in zip(table, table[1:]):
        if y <= y1:
            return lerp(w0, w1, (y - y0) / (y1 - y0))
    return table[-1][1]


def head_warp(q, p):
    """Superellipsoid -> head whose front outline follows the drawing (wide cheeks, short jaw)."""
    a, b, c = HEAD_ABC
    e = 2.6
    y = q.y + HEAD_C[1]
    yn = max(-0.999, min(0.999, p.y))
    w_se = a * (1 - abs(yn) ** e) ** (1 / e)
    w = profile(y, HEAD_PROFILE)
    x = q.x * (w / w_se) if w_se > 1e-3 else 0.0
    k = smoothstep(-0.55, -1.0, p.y)          # chin: pull the back in, push the front out a touch
    z = q.z * (1 - 0.25 * k) + 0.07 * k
    return Vector((x, q.y, z))


FACE_BOX = (90, 200, 490, 600)   # drawing px covered by the face textures (make_faces.py)


def face_uv(x, y):
    px, py = x / U + CX, 1015 - y / U
    u = (px - FACE_BOX[0]) / (FACE_BOX[2] - FACE_BOX[0])
    v = 1 - (py - FACE_BOX[1]) / (FACE_BOX[3] - FACE_BOX[1])
    return min(max(u, 0.002), 0.998), min(max(v, 0.002), 0.998)


def build_head(mats, parent):
    bm = superellipsoid(*HEAD_ABC, 2.6, HEAD_C, cuts=10, warp=head_warp)
    uv = bm.loops.layers.uv.new("UVMap")
    for f in bm.faces:
        c = mine(f.calc_center_median())
        front = c.z > HEAD_C[2] - 0.02
        for l in f.loops:
            if front:
                q = mine(l.vert.co)
                l[uv].uv = face_uv(q.x, q.y)
            else:
                l[uv].uv = (0.01, 0.01)       # plain skin corner of the texture
    return to_object(bm, "Head", mats["cody_face"], parent=parent)


def build_ears(mats, parent):
    bms = []
    for s in (-1, 1):
        bm = superellipsoid(0.03, 0.10, 0.07, 2.2, (0, 0, 0), cuts=4)
        m = Matrix.Translation(V(s * 0.37, 1.28, -0.04)) @ Matrix.Rotation(-s * 0.3, 4, "Z")
        bmesh.ops.transform(bm, matrix=m, verts=bm.verts[:])
        bms.append(bm)
    return to_object(merge_bms(bms), "Ears", mats["cody_skin"], parent=parent)


HAIR_C = (0.04, 1.60, -0.01)
HAIR_ABC = (0.47, 0.55, 0.49)
HAIR_E = 2.6


def hair_point(theta, y, out=0.0):
    """Point on the hair cap at angle theta (0 = front, + toward his left/+X) and height y."""
    a, b, c = HAIR_ABC
    e = HAIR_E
    yn = max(-0.999, min(0.999, (y - HAIR_C[1]) / b))
    rr = (1 - abs(yn) ** e) ** (1 / e)
    dx, dz = math.sin(theta), math.cos(theta)
    k = (abs(dx) ** e + abs(dz) ** e) ** (-1 / e)
    p = Vector((dx * k * a * rr, y, dz * k * c * rr + HAIR_C[2]))
    radial = Vector((p.x, 0, p.z - HAIR_C[2])).normalized()
    return p + radial * out, radial


def head_front_z(X, Y):
    a, b, c = HEAD_ABC
    e = 2.6
    py = max(-0.999, min(0.999, (Y - HEAD_C[1]) / b))
    sx = (1 - abs(py) ** e) ** (1 / e)
    pxx = min(0.999, abs(X) / max(profile(Y, HEAD_PROFILE), 1e-3) * sx)
    pz = max(0.0, 1 - pxx ** e - abs(py) ** e) ** (1 / e)
    k = smoothstep(-0.55, -1.0, py)
    return c * pz * (1 - 0.25 * k) + 0.07 * k + HEAD_C[2]


def cap_front_z(X, Y):
    a, b, c = HAIR_ABC
    e = HAIR_E
    v = 1 - abs((X - HAIR_C[0]) / a) ** e - abs((Y - HAIR_C[1]) / b) ** e
    return c * max(v, 0.0) ** (1 / e) + HAIR_C[2]


def px(x, y, z):
    X, Y = P(x, y)
    return (X, Y, z)


# Front-silhouette locks traced from the drawing: (root px, root z, tip px, tip z, r0, flat, bend)
FRONT_SPIKES = [
    ((262, 118), 0.00, (340, 12), -0.06, 0.11, 0.45, (-0.05, 0.03, 0)),    # top spike
    ((400, 104), 0.02, (503, 88), -0.04, 0.085, 0.45, (0.0, 0.035, 0)),    # top right
    ((465, 170), 0.06, (531, 184), 0.00, 0.06, 0.45, (0, 0.01, 0)),        # right, small
    ((455, 236), 0.10, (645, 272), 0.00, 0.13, 0.40, (0.0, 0.05, 0)),      # the big swoop
    ((480, 262), 0.10, (582, 322), 0.02, 0.08, 0.45, (0.0, 0.02, 0)),
    ((470, 290), 0.10, (578, 405), 0.02, 0.09, 0.45, (0.03, 0.02, 0)),
    ((462, 330), 0.18, (522, 470), 0.12, 0.06, 0.50, (0.02, 0.0, 0)),      # strand over the ear
    ((170, 205), 0.02, (75, 292), -0.04, 0.10, 0.45, (0, 0.03, 0)),        # left
    ((160, 262), 0.06, (80, 358), -0.02, 0.08, 0.45, (0, 0.01, 0)),
    ((150, 300), 0.18, (130, 402), 0.17, 0.045, 0.55, (-0.01, 0, 0)),      # left strand by the cheek
]


def build_hair(mats, parent):
    """Clump-based hair (see hair.py)."""
    import hair
    return hair.build(mats, json.load(open(HERE / "hairline.json"))["face_visible"])


def build_hair_v1(mats, parent):
    # cap: a rounded shell over the skull, trimmed by the drawing's face outline (front half)
    cap = to_object(superellipsoid(*HAIR_ABC, HAIR_E, HAIR_C, cuts=14), "Hair", mats["cody_hair"], parent=parent)
    poly = json.load(open(HERE / "hairline.json"))["face_visible"]
    face_cut = prism([P(x, y) for x, y in poly], 0.06, 1.5, "cut_face")
    apply_boolean(cap, face_cut)
    # lower edge: slopes from just under the temples at the front to the nape at the back
    low = box_cutter("cut_low", V(0, 1.36 - 0.6, 0), (3, 3, 1.2))
    low.rotation_euler = (math.radians(-12), 0, 0)   # tilt: lower at the back
    bpy.context.view_layer.update()
    apply_boolean(cap, low)
    for ob in (face_cut, low):
        bpy.data.objects.remove(ob)

    locks = []
    for (rp, rz, tp, tz, r0, flat, bend) in FRONT_SPIKES:
        locks.append(spike(px(*rp, rz), px(*tp, tz), r0, flat, bend, normal=(0.0, 0.15, 1.0)))
    # bang strands lying on the forehead, ending on the drawing's bang tips
    for (rx, ry), (tx, ty), r0 in (((300, 252), (352, 335), 0.065), ((228, 245), (222, 262), 0.04),
                                    ((420, 318), (448, 415), 0.055), ((452, 334), (478, 428), 0.05)):
        RX, RY = P(rx, ry)
        TX, TY = P(tx, ty)
        root = (RX, RY, cap_front_z(RX, RY) - 0.03)
        tip = (TX, TY, head_front_z(TX, TY) + 0.012)
        locks.append(spike(root, tip, r0, 0.35, (0, 0, 0.03), normal=(0, 0.1, 1)))
    # fringe of locks hanging from the cap's lower edge around the sides and back
    for th in (78, 100, 122, 146, 170, 194, 218, 242, 264, 284):
        th_r = math.radians(th)
        y_edge = 1.36 - 0.17 * max(0.0, -math.cos(th_r))     # the cut is lower at the back
        root, radial = hair_point(th_r, y_edge + 0.16, -0.05)
        tip = root + radial * 0.10 + Vector((0, -0.30, 0)) + Vector((0, 0, -0.04))
        locks.append(spike(root, tip, 0.085, 0.40, radial * 0.05, normal=radial))
    # 3D-only locks around the sides and back (not visible in the drawing)
    rows = [  # (height, thetas in degrees, length, up, back, r0)
        (2.00, [150, 205], 0.30, 0.65, 0.55, 0.10),
        (1.85, [105, 140, 180, 220, 255], 0.30, 0.05, 0.75, 0.115),
        (1.62, [120, 160, 200, 240], 0.28, -0.70, 0.55, 0.11),
        (1.42, [150, 180, 210], 0.20, -0.95, 0.30, 0.085),
    ]
    for y, thetas, length, up, back, r0 in rows:
        for th in thetas:
            th_r = math.radians(th)
            root, radial = hair_point(th_r, y, -0.06)
            d = (radial * 0.55 + Vector((0, up, 0)) + Vector((0, 0, -back))).normalized()
            tip = root + d * (length + 0.06)
            bend = radial * 0.04
            locks.append(spike(root, tip, r0, 0.45, bend, normal=radial))
    locks_ob = to_object(merge_bms(locks), "HairLocks", mats["cody_hair"])
    # join into one Hair mesh
    bpy.ops.object.select_all(action="DESELECT")
    locks_ob.select_set(True)
    cap.select_set(True)
    bpy.context.view_layer.objects.active = cap
    bpy.ops.object.join()
    return cap


def build_neck(mats, parent):
    bm = tube([(0, 0.92, 0.0), (0, 1.12, 0.02)], [0.11, 0.10], sides=12)
    return to_object(bm, "Neck", mats["cody_skin"], parent=parent)


def collar_ring():
    """Chunky folded turtleneck: a ribbed torus that sags at the front."""
    bm = bmesh.new()
    n_major, n_minor = 40, 12
    ribs = 14
    rings = []
    for i in range(n_major):
        th = 2 * math.pi * i / n_major          # 0 = front
        front = (math.cos(th) + 1) / 2          # 1 front, 0 back
        R = 0.20 + 0.02 * front
        top = 1.075 - 0.012 * front
        bot = 0.86 - 0.10 * front ** 2
        yc, ry = (top + bot) / 2, (top - bot) / 2
        rr = 0.095 + 0.03 * front ** 2
        rib = 1 + 0.07 * abs(math.sin(ribs * th / 2))
        c = Vector((math.sin(th) * R, yc, math.cos(th) * R + 0.01))
        radial = Vector((math.sin(th), 0, math.cos(th)))
        ring = []
        for k in range(n_minor):
            a = 2 * math.pi * k / n_minor
            q = c + radial * math.cos(a) * rr * rib + Vector((0, 1, 0)) * math.sin(a) * ry
            ring.append(bm.verts.new(V(*q)))
        rings.append(ring)
    for i in range(n_major):
        r0, r1 = rings[i], rings[(i + 1) % n_major]
        for k in range(n_minor):
            bm.faces.new((r0[k], r0[(k + 1) % n_minor], r1[(k + 1) % n_minor], r1[k]))
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces[:])
    return bm


def torso():
    """Sweater body: lofted rounded-box rings from the lap to the neck."""
    rings = [  # (y, half width, half depth, z offset)
        (0.10, 0.25, 0.21, 0.02),
        (0.18, 0.30, 0.26, 0.03),
        (0.35, 0.31, 0.265, 0.02),
        (0.60, 0.30, 0.23, -0.01),
        (0.80, 0.29, 0.22, -0.02),
        (0.90, 0.27, 0.21, -0.01),
        (0.97, 0.200, 0.160, 0.00),
        (1.00, 0.120, 0.110, 0.00),
    ]
    sides = 24
    e = 2.6
    bm = bmesh.new()
    vr = []
    for y, hw, hd, zo in rings:
        ring = []
        for k in range(sides):
            a = 2 * math.pi * k / sides
            dx, dz = math.sin(a), math.cos(a)
            kk = (abs(dx) ** e + abs(dz) ** e) ** (-1 / e)
            ring.append(bm.verts.new(V(dx * kk * hw, y, dz * kk * hd + zo)))
        vr.append(ring)
    for r0, r1 in zip(vr, vr[1:]):
        for k in range(sides):
            bm.faces.new((r0[k], r0[(k + 1) % sides], r1[(k + 1) % sides], r1[k]))
    bot = bm.verts.new(V(0, 0.08, 0.02))
    top = bm.verts.new(V(0, 1.01, 0.0))
    for k in range(sides):
        bm.faces.new((vr[0][(k + 1) % sides], vr[0][k], bot))
        bm.faces.new((vr[-1][k], vr[-1][(k + 1) % sides], top))
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces[:])
    return bm


def arm(s):
    """Sleeve from shoulder down the side and in to the lap (s = -1 his right / viewer's left)."""
    ctrl = [(s * 0.25, 0.87, 0.02), (s * 0.31, 0.68, 0.13), (s * 0.30, 0.47, 0.25),
            (s * 0.23, 0.30, 0.37), (s * 0.11, 0.22, 0.46)]
    path = catmull(ctrl, per=4)
    radii = interp([0.115, 0.12, 0.125, 0.13, 0.135], len(path))
    return tube(path, radii, sides=12)


def cuff(s):
    """Thick rolled cuff at the end of the sleeve."""
    p0, p1 = Vector((s * 0.16, 0.245, 0.43)), Vector((s * 0.09, 0.215, 0.48))
    return tube([p0, p1], [0.145, 0.14], sides=12)


def hands():
    bms = []
    for s, y in ((-1, 0.13), (1, 0.115)):   # ~1.3x the first draft, per Cody's review
        bm = superellipsoid(0.13, 0.105, 0.085, 2.2, (0, 0, 0), cuts=5)
        m = Matrix.Translation(V(s * 0.09, y, 0.55)) @ Matrix.Rotation(s * 0.35, 4, "Y")
        bmesh.ops.transform(bm, matrix=m, verts=bm.verts[:])
        bms.append(bm)
    return merge_bms(bms)


def leg(s):
    """Cross-legged leg: hip -> knee out to the side -> shin back in toward the middle."""
    ctrl = [(s * 0.12, 0.19, -0.04), (s * 0.32, 0.22, 0.08), (s * 0.45, 0.22, 0.20),
            (s * 0.36, 0.17, 0.36), (s * 0.18, 0.12, 0.44)]
    path = catmull(ctrl, per=4)
    radii = interp([0.18, 0.19, 0.20, 0.15, 0.12], len(path))
    return tube(path, radii, sides=14)


def shoe(s):
    """Brown shoe at the end of each shin, toes tucked toward the middle."""
    p0 = Vector((s * 0.20, 0.10, 0.44))
    p1 = Vector((-s * 0.02, 0.08, 0.43 - 0.03 * s))
    return tube([p0, p1], [0.085, 0.075], sides=10, flat=[0.8, 0.75])


def build_body(mats, parent):
    sweater = to_object(merge_bms([torso(), collar_ring(), arm(-1), arm(1), cuff(-1), cuff(1)]),
                        "Sweater", mats["cody_sweater"], parent=parent)
    pants = to_object(merge_bms([leg(-1), leg(1)]), "Pants", mats["cody_pants"], parent=parent)
    shoes = to_object(merge_bms([shoe(-1), shoe(1)]), "Shoes", mats["cody_shoes"], parent=parent)
    hand = to_object(hands(), "Hands", mats["cody_skin"], parent=parent)
    return sweater, pants, shoes, hand


def empty(name, loc, parent=None):
    ob = bpy.data.objects.new(name, None)
    ob.empty_display_size = 0.15
    bpy.context.scene.collection.objects.link(ob)
    ob.location = loc
    if parent:
        ob.parent = parent
    return ob


def clean_parenting():
    """Bake parent-inverse matrices into the mesh data so every node has a clean local transform."""
    bpy.context.view_layer.update()
    for ob in bpy.data.objects:
        if ob.type == "MESH" and ob.parent:
            world = ob.matrix_world.copy()
            ob.data.transform(ob.parent.matrix_world.inverted() @ world)
            ob.matrix_parent_inverse.identity()
            ob.matrix_basis.identity()
    bpy.context.view_layer.update()


def bake_idle(body, head_pivot, frames=96):
    """4 s seamless loop: two slow breaths on Body, one gentle sway/nod on HeadPivot."""
    sc = bpy.context.scene
    sc.render.fps = 24
    sc.frame_start, sc.frame_end = 0, frames
    for ob in (body, head_pivot):
        ob.rotation_mode = "XYZ"
        ob.animation_data_create()
        ob.animation_data.action = bpy.data.actions.new(f"Idle_{ob.name}")
    for f in range(0, frames + 1, 6):
        ph = 2 * math.pi * f / frames
        b = (1 - math.cos(2 * ph)) / 2                       # 0 -> 1 -> 0, twice per loop
        body.scale = (1 - 0.006 * b, 1 - 0.006 * b, 1 + 0.014 * b)   # Blender Z = up
        body.keyframe_insert("scale", frame=f)
        # my-frame tilt (about +Z forward) = Blender -Y; nod (about X) = Blender X
        head_pivot.rotation_euler = (0.025 * math.sin(2 * ph + 1.0), -0.05 * math.sin(ph), 0.0)
        head_pivot.keyframe_insert("rotation_euler", frame=f)
    body.scale = (1, 1, 1)
    head_pivot.rotation_euler = (0, 0, 0)


def rename_glb_animations(path, name):
    """The exporter calls merged active actions "Animation"; give the clip a real name."""
    import struct
    data = path.read_bytes()
    n = struct.unpack("<I", data[12:16])[0]
    doc = json.loads(data[20:20 + n])
    for anim in doc.get("animations", []):
        anim["name"] = name
    js = json.dumps(doc, separators=(",", ":")).encode()
    js += b" " * (-len(js) % 4)
    rest = data[20 + n:]
    out = struct.pack("<III", 0x46546C67, 2, 12 + 8 + len(js) + len(rest)) + struct.pack("<II", len(js), 0x4E4F534A) + js + rest
    path.write_bytes(out)


def export_glb(path, animations=False):
    bpy.ops.export_scene.gltf(
        filepath=str(path), export_format="GLB", export_yup=True, export_apply=True,
        export_texcoords=True, export_normals=True, export_materials="EXPORT",
        export_image_format="AUTO", export_animations=animations,
        export_animation_mode="ACTIVE_ACTIONS", export_cameras=False,
        export_lights=False, export_extras=False)
    print("EXPORTED", path, round(path.stat().st_size / 1024), "KB")


def main():
    reset()
    mats = {n: make_material(n, rgb) for n, rgb in COLORS.items()}
    mats["cody_face"] = make_material("cody_face", image=TEX / "face_not_talking.png")

    root = empty("Cody", (0, 0, 0))
    body = empty("Body", V(0, 0.2, 0), root)
    head_pivot = empty("HeadPivot", V(0, 0.8, 0.0), body)   # world height 1.0 (neck)

    def keep_world(ob, parent):
        ob.parent = parent
        ob.matrix_parent_inverse = parent.matrix_world.inverted()

    bpy.context.view_layer.update()
    for ob in build_body(mats, None):
        keep_world(ob, body)
    keep_world(build_neck(mats, None), body)
    for ob in (build_head(mats, None), build_ears(mats, None), build_hair(mats, None)):
        keep_world(ob, head_pivot)

    clean_parenting()
    bake_idle(body, head_pivot)
    bpy.ops.wm.save_as_mainfile(filepath=str(OUT / "cody_avatar.blend"))
    export_glb(OUT / "cody_avatar.glb", animations=True)
    rename_glb_animations(OUT / "cody_avatar.glb", "Idle")
    stats = {ob.name: len(ob.data.polygons) for ob in bpy.data.objects if ob.type == "MESH"}
    tris = sum(sum(len(p.vertices) - 2 for p in ob.data.polygons) for ob in bpy.data.objects if ob.type == "MESH")
    print("FACES", stats, "TRIS", tris)


if __name__ == "__main__":
    main()
