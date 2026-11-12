"""Standing Cody with a skeleton (bones + smooth skin weights) and a few pose clips.

    "$B" -b --factory-startup -Y --python 3d/avatar3d/scripts/build_standing.py

Writes 3d/avatar3d/cody_standing.blend and cody_standing.glb.
Same head, hair, face and sweater as the seated build (build_avatar.py / hair.py); the body
below the collar is rebuilt standing in an A-pose (arms 50 degrees down), which is the bind pose.

Bones (".L" = his left = +X): root > hips > spine > chest > neck > head,
chest > shoulder.L > upper_arm.L > forearm.L > hand.L, hips > thigh.L > shin.L > foot.L (and .R).
Every bone's local Z axis points forward (toward +Z / the viewer), so
  rotate about local Z = swing in the front plane (raise/lower arms, tilt head),
  rotate about local X = bend forward/back (elbows, knees, nod).
"""
import math
import sys
from pathlib import Path

import bmesh
import bpy
from mathutils import Matrix, Vector

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE))
import build_avatar as A  # noqa: E402

OUT = HERE.parent
DY = 0.45                      # the seated head/torso sit this much higher when standing
ARM_DOWN = math.radians(50)    # A-pose: arms 50 degrees below horizontal

# ----------------------------------------------------------------------------- skeleton (my frame)
SHOULDER_Y = 0.87 + DY


def arm_points(s):
    S = Vector((s * 0.27, SHOULDER_Y, 0.0))
    d = Vector((s * math.cos(ARM_DOWN), -math.sin(ARM_DOWN), 0.0))
    E = S + d * 0.30
    W = E + d * 0.27
    return S, E, W, d


def leg_points(s):
    H = Vector((s * 0.13, 0.62, 0.0))
    K = Vector((s * 0.135, 0.35, 0.02))
    F = Vector((s * 0.14, 0.11, 0.0))
    T = Vector((s * 0.14, 0.04, 0.19))
    return H, K, F, T


def bone_table():
    b = {
        "root": ((0, 0, 0), (0, 0.25, 0), None),
        "hips": ((0, 0.62, 0), (0, 0.80, 0), "root"),
        "spine": ((0, 0.80, 0), (0, 1.05, 0), "hips"),
        "chest": ((0, 1.05, 0), (0, 1.30, 0), "spine"),
        "neck": ((0, 1.30, 0), (0, 1.47, 0), "chest"),
        "head": ((0, 1.47, 0), (0, 2.25, 0), "neck"),
    }
    for s, side in ((1, "L"), (-1, "R")):
        S, E, W, d = arm_points(s)
        H, K, F, T = leg_points(s)
        b[f"shoulder.{side}"] = ((s * 0.05, 1.29, 0), tuple(S), "chest")
        b[f"upper_arm.{side}"] = (tuple(S), tuple(E), f"shoulder.{side}")
        b[f"forearm.{side}"] = (tuple(E), tuple(W), f"upper_arm.{side}")
        b[f"hand.{side}"] = (tuple(W), tuple(W + d * 0.25), f"forearm.{side}")
        b[f"thigh.{side}"] = (tuple(H), tuple(K), "hips")
        b[f"shin.{side}"] = (tuple(K), tuple(F), f"thigh.{side}")
        b[f"foot.{side}"] = (tuple(F), tuple(T), f"shin.{side}")
    return b


BONES = bone_table()
BONE_NAMES = list(BONES)


def seg_dist(p, a, b):
    a, b = Vector(a), Vector(b)
    ab = b - a
    t = max(0.0, min(1.0, (p - a).dot(ab) / max(ab.length_squared, 1e-9)))
    return (p - (a + ab * t)).length


def weigh(bm, candidates, power=6.0):
    """Smooth distance-based skin weights to the given bones (max 4 influences)."""
    dl = bm.verts.layers.deform.verify()
    for v in bm.verts:
        p = A.mine(v.co)
        ws = {c: 1.0 / (seg_dist(p, BONES[c][0], BONES[c][1]) ** power + 1e-7) for c in candidates}
        top = sorted(ws.items(), key=lambda kv: -kv[1])[:4]
        tot = sum(w for _, w in top)
        top = [(c, w / tot) for c, w in top if w / tot > 0.02]
        tot = sum(w for _, w in top)
        for c, w in top:
            v[dl][BONE_NAMES.index(c)] = w / tot
    return bm


def rigid(bm, bone):
    return weigh(bm, [bone])


def shifted(bm, dy):
    bmesh.ops.transform(bm, matrix=Matrix.Translation(A.V(0, dy, 0)), verts=bm.verts[:])
    return bm


def bm_of(ob):
    """Take an object's mesh into a bmesh in world space and delete the object."""
    bm = bmesh.new()
    bm.from_mesh(ob.data)
    bmesh.ops.transform(bm, matrix=ob.matrix_world, verts=bm.verts[:])
    bpy.data.objects.remove(ob)
    return bm


# ----------------------------------------------------------------------------- body parts
def sleeve(s):
    S, E, W, d = arm_points(s)
    start = S - d * 0.06 + Vector((0, 0.03, 0))
    path = A.catmull([start, S, E, W], per=6)
    radii = A.interp([0.11, 0.118, 0.125, 0.13], len(path))
    return A.tube(path, radii, sides=12)


def cuff(s):
    S, E, W, d = arm_points(s)
    return A.tube([W - d * 0.05, W + d * 0.035], [0.14, 0.137], sides=12)


def hand(s):
    S, E, W, d = arm_points(s)
    bm = A.superellipsoid(0.095, 0.12, 0.08, 2.2, (0, 0, 0), cuts=5)   # ~1.3x the first draft
    ang = math.atan2(d.x, -d.y)   # rotate the mitten's long (Y) axis onto the arm direction
    m = Matrix.Translation(A.V(*(W + d * 0.13))) @ Matrix.Rotation(-ang, 4, "Y")
    bmesh.ops.transform(bm, matrix=m, verts=bm.verts[:])
    return bm


def leg(s):
    H, K, F, T = leg_points(s)
    path = A.catmull([Vector((s * 0.12, 0.74, 0.0)), H, K, F], per=6)
    radii = A.interp([0.15, 0.16, 0.15, 0.13], len(path))
    return A.tube(path, radii, sides=14)


def pelvis():
    return A.superellipsoid(0.27, 0.15, 0.2, 2.4, (0, 0.67, 0.0), cuts=5)


def shoe(s):
    H, K, F, T = leg_points(s)
    return A.superellipsoid(0.095, 0.07, 0.15, 2.4, (s * 0.14, 0.07, 0.07), cuts=5)


def build():
    A.reset()
    mats = {n: A.make_material(n, rgb) for n, rgb in A.COLORS.items()}
    mats["cody_face"] = A.make_material("cody_face", image=A.TEX / "face_not_talking.png")

    # head group from the seated build, lifted
    head = rigid(shifted(bm_of(A.build_head(mats, None)), DY), "head")
    ears = rigid(shifted(bm_of(A.build_ears(mats, None)), DY), "head")
    hair = rigid(shifted(bm_of(A.build_hair(mats, None)), DY), "head")
    neck = weigh(shifted(bm_of(A.build_neck(mats, None)), DY), ["neck", "head"])

    torso = weigh(shifted(A.torso(), DY), ["hips", "spine", "chest"])
    collar = weigh(shifted(A.collar_ring(), DY), ["chest", "neck"])
    parts_sweater = [torso, collar]
    parts_skin = []
    parts_pants = [weigh(pelvis(), ["hips", "thigh.L", "thigh.R"])]
    parts_shoes = []
    for s, side in ((1, "L"), (-1, "R")):
        parts_sweater.append(weigh(sleeve(s), [f"shoulder.{side}", f"upper_arm.{side}", f"forearm.{side}"]))
        parts_sweater.append(weigh(cuff(s), [f"forearm.{side}", f"hand.{side}"]))
        parts_skin.append(rigid(hand(s), f"hand.{side}"))
        parts_pants.append(weigh(leg(s), ["hips", f"thigh.{side}", f"shin.{side}"]))
        parts_shoes.append(weigh(shoe(s), [f"foot.{side}", f"shin.{side}"], power=8))

    arm_ob = make_armature()
    meshes = [
        ("Head", [head], "cody_face"), ("Ears", [ears], "cody_skin"), ("Hair", [hair], "cody_hair"),
        ("Neck", [neck], "cody_skin"), ("Sweater", parts_sweater, "cody_sweater"),
        ("Hands", parts_skin, "cody_skin"), ("Pants", parts_pants, "cody_pants"), ("Shoes", parts_shoes, "cody_shoes"),
    ]
    for name, bms, mat in meshes:
        bm = A.merge_bms(bms) if len(bms) > 1 else bms[0]
        smooth_flags = None
        ob = A.to_object(bm, name, mats[mat])
        for bn in BONE_NAMES:
            ob.vertex_groups.new(name=bn)
        ob.parent = arm_ob
        mod = ob.modifiers.new("Armature", "ARMATURE")
        mod.object = arm_ob
    make_poses(arm_ob)
    return arm_ob


def make_armature():
    arm = bpy.data.armatures.new("CodyRig")
    ob = bpy.data.objects.new("Cody", arm)
    bpy.context.scene.collection.objects.link(ob)
    bpy.context.view_layer.objects.active = ob
    ob.select_set(True)
    bpy.ops.object.mode_set(mode="EDIT")
    eb = {}
    for name, (h, t, parent) in BONES.items():
        b = arm.edit_bones.new(name)
        b.head, b.tail = A.V(*h), A.V(*t)
        b.align_roll(A.V(0, 1, 0) if name.startswith("foot") else A.V(0, 0, 1))
        eb[name] = b
    for name, (h, t, parent) in BONES.items():
        if parent:
            eb[name].parent = eb[parent]
            eb[name].use_connect = (Vector(eb[parent].tail) - Vector(eb[name].head)).length < 1e-4
        eb[name].use_deform = name != "root"
    bpy.ops.object.mode_set(mode="OBJECT")
    arm.display_type = "STICK"
    return ob


# Pose variations (degrees, local euler X/Y/Z per bone). The A-pose bind pose is the rest pose.
IDLE_ARMS = {"upper_arm.L": (0, 0, -34), "upper_arm.R": (0, 0, 34),
             "forearm.L": (18, 0, 0), "forearm.R": (18, 0, 0)}
POSES = {
    "Idle": {**IDLE_ARMS, "head": (-3, 0, 4), "chest": (0, 0, -1.5)},
    "Wave": {"upper_arm.L": (0, 0, -34), "forearm.L": (18, 0, 0),
             "upper_arm.R": (0, 0, -72), "forearm.R": (0, 0, -38), "hand.R": (0, 0, -12),
             "head": (0, 0, -7), "chest": (0, 0, 2)},
    "Cheer": {"upper_arm.L": (0, 0, 85), "forearm.L": (0, 0, 25), "upper_arm.R": (0, 0, -85),
              "forearm.R": (0, 0, -25), "hand.L": (0, 0, 10), "hand.R": (0, 0, -10),
              "head": (-9, 0, 0), "spine": (-4, 0, 0)},
    "Shrug": {"shoulder.L": (0, 0, 10), "shoulder.R": (0, 0, -10),
              "upper_arm.L": (0, 0, -42), "upper_arm.R": (0, 0, 42),
              "forearm.L": (75, 0, 30), "forearm.R": (75, 0, -30), "head": (0, 0, 9)},
}


def make_poses(arm_ob):
    arm_ob.animation_data_create()
    for pname, rots in POSES.items():
        act = bpy.data.actions.new(pname)
        act.use_fake_user = True
        arm_ob.animation_data.action = act
        for pb in arm_ob.pose.bones:
            pb.rotation_mode = "XYZ"
            r = rots.get(pb.name, (0, 0, 0))
            pb.rotation_euler = [math.radians(a) for a in r]
            for f in (1, 2):
                pb.keyframe_insert("rotation_euler", frame=f)
    arm_ob.animation_data.action = None
    for pb in arm_ob.pose.bones:
        pb.rotation_euler = (0, 0, 0)


def export(path):
    bpy.ops.export_scene.gltf(
        filepath=str(path), export_format="GLB", export_yup=True, export_apply=False,
        export_texcoords=True, export_normals=True, export_materials="EXPORT",
        export_skins=True, export_animations=True, export_animation_mode="ACTIONS",
        export_cameras=False, export_lights=False, export_extras=False)
    print("EXPORTED", path, round(path.stat().st_size / 1024), "KB")


if __name__ == "__main__":
    build()
    bpy.ops.wm.save_as_mainfile(filepath=str(OUT / "cody_standing.blend"))
    export(OUT / "cody_standing.glb")
    tris = sum(sum(len(p.vertices) - 2 for p in o.data.polygons) for o in bpy.data.objects if o.type == "MESH")
    print("BONES", len(BONE_NAMES), "TRIS", tris, "ACTIONS", [a.name for a in bpy.data.actions])
