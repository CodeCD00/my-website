"""Import a Blockbench .bbmodel into Blender and render previews.

Usage (Blender):
  Blender -b --factory-startup -Y --python bb_import_render.py -- <file.bbmodel> <outdir> [stills|anim|blend] [extra]

The .bbmodel is parsed as JSON data only; nothing in it is executed.
"""
import base64
import json
import math
import os
import sys

import bpy
from mathutils import Euler, Matrix, Vector

argv = sys.argv[sys.argv.index("--") + 1:]
SRC, OUTDIR = argv[0], argv[1]
MODE = argv[2] if len(argv) > 2 else "stills"
os.makedirs(OUTDIR, exist_ok=True)
NAME = os.path.splitext(os.path.basename(SRC))[0]
FPS = 24

bpy.ops.wm.read_factory_settings(use_empty=True)
scene = bpy.context.scene

with open(SRC, encoding="utf-8") as f:
    data = json.load(f)

res = data.get("resolution") or {"width": 16, "height": 16}

# ---------- textures -> materials ----------
texdir = os.path.join(OUTDIR, "_tex", NAME)
os.makedirs(texdir, exist_ok=True)
materials, uv_sizes = [], []
for i, t in enumerate(data.get("textures", [])):
    img = None
    src = t.get("source") or ""
    if src.startswith("data:image/png;base64,"):
        p = os.path.join(texdir, f"tex{i}.png")
        with open(p, "wb") as fh:
            fh.write(base64.b64decode(src.split(",", 1)[1]))
        img = bpy.data.images.load(p)
        img.pack()
    # Face UVs are in the project's UV resolution. The static hats also carry stale
    # per-texture uv_width/uv_height (16 and 32 against a 64 project); trusting those
    # scrambled their brims and hid the band gems. BB_UV_MODE=texture restores the old reading.
    if os.environ.get("BB_UV_MODE") == "texture":
        uv_sizes.append((t.get("uv_width") or res["width"], t.get("uv_height") or res["height"]))
    else:
        uv_sizes.append((res["width"], res["height"]))
    mat = bpy.data.materials.new(f"{NAME}_tex{i}")
    mat.use_nodes = True
    # Minecraft draws cube faces one-sided; double-sided rendering makes the two faces
    # of zero-thickness cubes (wing membranes, hat brims) z-fight.
    mat.use_backface_culling = True
    nt = mat.node_tree
    bsdf = nt.nodes["Principled BSDF"]
    bsdf.inputs["Roughness"].default_value = 0.85
    if img:
        tn = nt.nodes.new("ShaderNodeTexImage")
        tn.image = img
        tn.interpolation = "Closest"
        nt.links.new(tn.outputs["Color"], bsdf.inputs["Base Color"])
        nt.links.new(tn.outputs["Alpha"], bsdf.inputs["Alpha"])
    materials.append(mat)

if not materials:  # untextured fallback
    mat = bpy.data.materials.new(f"{NAME}_plain")
    materials.append(mat)
    uv_sizes.append((res["width"], res["height"]))

# ---------- geometry helpers (all in Blockbench space: Y up, units = pixels) ----------
def rot_matrix(deg):
    rx, ry, rz = (math.radians(a) for a in (deg or [0, 0, 0]))
    # three.js 'ZYX' order == Blender 'XYZ' (R = Rz @ Ry @ Rx)
    return Euler((rx, ry, rz), "XYZ").to_matrix().to_4x4()


def face_corners(x1, y1, z1, x2, y2, z2):
    """Each face's corners as seen from outside: TL, TR, BR, BL (Minecraft UV convention)."""
    return {
        "north": [(x2, y2, z1), (x1, y2, z1), (x1, y1, z1), (x2, y1, z1)],
        "south": [(x1, y2, z2), (x2, y2, z2), (x2, y1, z2), (x1, y1, z2)],
        "east": [(x2, y2, z2), (x2, y2, z1), (x2, y1, z1), (x2, y1, z2)],
        "west": [(x1, y2, z1), (x1, y2, z2), (x1, y1, z2), (x1, y1, z1)],
        "up": [(x1, y2, z1), (x2, y2, z1), (x2, y2, z2), (x1, y2, z2)],
        "down": [(x1, y1, z2), (x2, y1, z2), (x2, y1, z1), (x1, y1, z1)],
    }


elements = {e["uuid"]: e for e in data.get("elements", [])}
groups = {g["uuid"]: g for g in data.get("groups", [])}  # format v5 stores groups here


def build_element(e, parent_obj, parent_origin):
    if e.get("visibility") is False or e.get("type", "cube") != "cube":
        return None
    inf = float(e.get("inflate") or 0)
    f, t = Vector(e["from"]), Vector(e["to"])
    x1, y1, z1 = (min(a, b) - inf for a, b in zip(f, t))
    x2, y2, z2 = (max(a, b) + inf for a, b in zip(f, t))
    o = Vector(e.get("origin") or (0, 0, 0))
    m = Matrix.Translation(o) @ rot_matrix(e.get("rotation")) @ Matrix.Translation(-o)
    corners = face_corners(x1, y1, z1, x2, y2, z2)

    verts, faces, uvs, mat_idx = [], [], [], []
    for fname, fdata in (e.get("faces") or {}).items():
        if fname not in corners or fdata.get("texture") is None:
            continue
        ti = fdata["texture"] if isinstance(fdata["texture"], int) else 0
        ti = ti if ti < len(materials) else 0
        uw, uh = uv_sizes[ti]
        u1, v1, u2, v2 = fdata.get("uv", [0, 0, 0, 0])
        tex_c = [(u1, v1), (u2, v1), (u2, v2), (u1, v2)]  # TL, TR, BR, BL
        k = int(round((fdata.get("rotation") or 0) / 90)) % 4
        vert_uv = [tex_c[(i - k) % 4] for i in range(4)]
        quad = [m @ Vector(corners[fname][ci]) for ci in range(4)]
        if ((quad[1] - quad[0]).cross(quad[3] - quad[0])).length < 1e-6:
            continue  # zero-area side of a flat cube: invisible, drop it
        base = len(verts)
        # reverse (TL, BL, BR, TR) so the face winds counter-clockwise from outside
        for ci in (0, 3, 2, 1):
            verts.append((m @ Vector(corners[fname][ci])) - parent_origin)
            u, v = vert_uv[ci]
            uvs.append((u / uw, 1 - v / uh))
        faces.append((base, base + 1, base + 2, base + 3))
        mat_idx.append(ti)
    if not faces:
        return None
    me = bpy.data.meshes.new(e.get("name", "cube"))
    me.from_pydata([tuple(v) for v in verts], [], faces)
    uvl = me.uv_layers.new(name="UVMap")
    for li, loop in enumerate(me.loops):
        uvl.data[li].uv = uvs[loop.vertex_index]
    for mt in materials:
        me.materials.append(mt)
    for p, mi in zip(me.polygons, mat_idx):
        p.material_index = mi
    ob = bpy.data.objects.new(e.get("name", "cube"), me)
    scene.collection.objects.link(ob)
    ob.parent = parent_obj
    return ob


bone_empties = {}  # group uuid -> (empty, base_rot_deg, base_loc)


def walk(node, parent_obj, parent_origin):
    if isinstance(node, str):
        if node in elements:
            build_element(elements[node], parent_obj, parent_origin)
        return
    g = dict(groups.get(node.get("uuid"), {}))
    g.update({k: v for k, v in node.items() if k in ("name", "origin", "rotation", "visibility")})
    if g.get("visibility") is False:
        return
    origin = Vector(g.get("origin") or (0, 0, 0))
    emp = bpy.data.objects.new(g.get("name", "group"), None)
    emp.empty_display_size = 1
    scene.collection.objects.link(emp)
    emp.parent = parent_obj
    emp.rotation_mode = "XYZ"
    emp.location = origin - parent_origin
    rot = [float(a) for a in (g.get("rotation") or [0, 0, 0])]
    emp.rotation_euler = [math.radians(a) for a in rot]
    bone_empties[node.get("uuid")] = (emp, rot, Vector(emp.location))
    for c in node.get("children", []):
        walk(c, emp, origin)


root = bpy.data.objects.new(f"{NAME}_root", None)
scene.collection.objects.link(root)
root.rotation_euler = (math.radians(90), 0, 0)  # Blockbench Y-up -> Blender Z-up
root.scale = (1 / 16,) * 3  # pixels -> blocks
for node in data.get("outliner", []):
    walk(node, root, Vector((0, 0, 0)))

# ---------- animation ----------
anims = data.get("animations") or []
anim_len = 0
if anims and MODE in ("anim", "blend"):
    a = anims[0]
    anim_len = float(a.get("length") or 0)

    def num(v):
        try:
            return float(v)
        except (TypeError, ValueError):
            return 0.0  # Molang expressions are not evaluated

    # Bedrock formats store animation with X/Y rotation and X position mirrored.
    # GeckoLib ("animated_entity_model") does not: tested on Cody's split-limb rig,
    # unmirrored values keep knees and elbows joined (0.9 px mean gap vs 4.2 px).
    fmt = (data.get("meta") or {}).get("model_format", "")
    mirror = fmt.startswith("bedrock")
    sx, sy = (-1, -1) if mirror else (1, 1)
    px = -1 if mirror else 1

    for uuid, an in (a.get("animators") or {}).items():
        if uuid not in bone_empties:
            continue
        emp, base_rot, base_loc = bone_empties[uuid]
        for kf in an.get("keyframes") or []:
            dp = (kf.get("data_points") or [{}])[0]
            x, y, z = num(dp.get("x")), num(dp.get("y")), num(dp.get("z"))
            frame = 1 + float(kf.get("time", 0)) * FPS
            ch = kf.get("channel")
            if ch == "rotation":
                emp.rotation_euler = [math.radians(base_rot[0] + sx * x), math.radians(base_rot[1] + sy * y), math.radians(base_rot[2] + z)]
                emp.keyframe_insert("rotation_euler", frame=frame)
            elif ch == "position":
                emp.location = base_loc + Vector((px * x, y, z))
                emp.keyframe_insert("location", frame=frame)
            elif ch == "scale":
                emp.scale = (x or 1, y or 1, z or 1)
                emp.keyframe_insert("scale", frame=frame)
        if emp.animation_data and emp.animation_data.action:
            for fc in emp.animation_data.action.fcurves:
                for kp in fc.keyframe_points:
                    kp.interpolation = "LINEAR"
                if MODE == "blend" and a.get("loop") == "loop":
                    fc.modifiers.new("CYCLES")

scene.render.fps = FPS
scene.frame_start = 1
scene.frame_end = max(1, int(round(1 + anim_len * FPS)))
scene.frame_set(1)

# ---------- look ----------
for eng in ("BLENDER_EEVEE_NEXT", "BLENDER_EEVEE"):
    try:
        scene.render.engine = eng
        break
    except TypeError:
        continue
try:
    scene.eevee.taa_render_samples = 16
except AttributeError:
    pass
scene.view_settings.view_transform = "Standard"
world = bpy.data.worlds.new("bg")
world.use_nodes = True
bg = world.node_tree.nodes["Background"]
bg.inputs["Color"].default_value = (0.20, 0.21, 0.23, 1)
bg.inputs["Strength"].default_value = 1.6
scene.world = world
sun = bpy.data.objects.new("sun", bpy.data.lights.new("sun", "SUN"))
sun.data.energy = 2.2
sun.rotation_euler = (math.radians(50), math.radians(10), math.radians(35))
scene.collection.objects.link(sun)

# ---------- camera auto-frame ----------
def world_bbox():
    bpy.context.view_layer.update()
    deps = bpy.context.evaluated_depsgraph_get()
    pts = []
    for ob in scene.objects:
        if ob.type == "MESH":
            ev = ob.evaluated_get(deps)
            pts += [ev.matrix_world @ Vector(c) for c in ev.bound_box]
    return pts


cam = bpy.data.objects.new("cam", bpy.data.cameras.new("cam"))
cam.data.type = "ORTHO"
scene.collection.objects.link(cam)
scene.camera = cam


def aim(direction, pts, pad=1.18):
    c = sum(pts, Vector()) / len(pts)
    d = Vector(direction).normalized()
    span = max((p - c).length for p in pts)
    cam.location = c + d * (span * 4 + 2)
    cam.rotation_euler = (-d).to_track_quat("-Z", "Y").to_euler()
    bpy.context.view_layer.update()
    inv = cam.matrix_world.inverted()
    local = [inv @ p for p in pts]
    w = max(p.x for p in local) - min(p.x for p in local)
    h = max(p.y for p in local) - min(p.y for p in local)
    cam.data.ortho_scale = max(w, h) * pad
    cam.data.shift_x = ((max(p.x for p in local) + min(p.x for p in local)) / 2) / cam.data.ortho_scale
    cam.data.shift_y = ((max(p.y for p in local) + min(p.y for p in local)) / 2) / cam.data.ortho_scale
    cam.data.clip_end = span * 12 + 10


FRONT = (0.75, 1.0, 0.55)   # model front faces Blockbench north (-Z) == Blender +Y
BACK = (-0.75, -1.0, 0.45)

if MODE == "stills":
    scene.render.resolution_x = scene.render.resolution_y = 560
    pts = world_bbox()
    for tag, d in (("front", FRONT), ("back", BACK)):
        aim(d, pts)
        scene.render.filepath = os.path.join(OUTDIR, f"{NAME}__{tag}.png")
        bpy.ops.render.render(write_still=True)
elif MODE == "anim":
    scene.render.resolution_x = scene.render.resolution_y = int(argv[3]) if len(argv) > 3 else 480
    # frame on the union of a few sampled frames so the motion stays in shot
    pts = []
    for fr in range(scene.frame_start, scene.frame_end + 1, max(1, (scene.frame_end - scene.frame_start) // 12)):
        scene.frame_set(fr)
        pts += world_bbox()
    scene.frame_set(1)
    aim(FRONT, pts, pad=1.1)
    scene.render.image_settings.file_format = "PNG"
    scene.render.filepath = os.path.join(OUTDIR, f"{NAME}_frames", "f_")
    bpy.ops.render.render(animation=True)
elif MODE == "blend":
    pts = world_bbox()
    aim(FRONT, pts)
    bpy.ops.wm.save_as_mainfile(filepath=os.path.join(OUTDIR, f"{NAME}.blend"), compress=True)
    # web copy: model + bone animation only (no camera or light)
    for ob in (cam, sun):
        bpy.data.objects.remove(ob, do_unlink=True)
    os.makedirs(os.path.join(OUTDIR, "glb"), exist_ok=True)
    bpy.ops.export_scene.gltf(
        filepath=os.path.join(OUTDIR, "glb", f"{NAME}.glb"),
        export_format="GLB",
        export_animations=bool(anims),
        export_extras=False,
        export_apply=True,
    )

print(f"DONE {NAME}: meshes={sum(1 for o in scene.objects if o.type == 'MESH')} bones={len(bone_empties)} frames={scene.frame_end}")
