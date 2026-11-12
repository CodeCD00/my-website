"""Combine per-model .blend files into one lineup scene with name labels.

Usage: Blender -b --factory-startup -Y --python bb_lineup.py -- <out.blend> <in1.blend> <in2.blend> ...
"""
import math
import os
import sys

import bpy
from mathutils import Vector

argv = sys.argv[sys.argv.index("--") + 1:]
OUT, INPUTS = argv[0], argv[1:]

bpy.ops.wm.read_factory_settings(use_empty=True)
scene = bpy.context.scene
PER_ROW, GAP = 5, 1.0
x = y = 0.0
row_depth = 0.0
max_frame = 1

for i, path in enumerate(INPUTS):
    name = os.path.splitext(os.path.basename(path))[0]
    with bpy.data.libraries.load(path, link=False) as (src, dst):
        dst.objects = [n for n in src.objects if n not in ("cam", "sun")]
    coll = bpy.data.collections.new(name)
    scene.collection.children.link(coll)
    root = None
    for ob in dst.objects:
        if ob is None:
            continue
        coll.objects.link(ob)
        if ob.name.endswith("_root"):
            root = ob
        if ob.animation_data and ob.animation_data.action:
            max_frame = max(max_frame, int(ob.animation_data.action.frame_range[1]))
    # turn the model to face -Y, i.e. toward Blender's default Front view
    root.rotation_euler.z = math.pi
    bpy.context.view_layer.update()
    pts = [ob.matrix_world @ Vector(c) for ob in coll.objects if ob.type == "MESH" for c in ob.bound_box]
    lo = Vector((min(p.x for p in pts), min(p.y for p in pts), min(p.z for p in pts)))
    hi = Vector((max(p.x for p in pts), max(p.y for p in pts), max(p.z for p in pts)))
    if i and i % PER_ROW == 0:  # next row goes further back (+Y)
        x, y = 0.0, y + row_depth + GAP * 2
        row_depth = 0.0
    # place this model's bounding box so its min corner sits at (x, y), feet on the ground
    root.location += Vector((x - lo.x, y - lo.y, -lo.z))
    label = bpy.data.objects.new(f"{name}_label", bpy.data.curves.new(f"{name}_label", "FONT"))
    label.data.body = name.replace("_", " ")
    label.data.size = 0.18
    label.rotation_euler = (math.radians(90), 0, 0)  # stand up, readable from Front view
    label.location = (x, y - 0.25, 0.02)
    coll.objects.link(label)
    x += (hi.x - lo.x) + GAP
    row_depth = max(row_depth, hi.y - lo.y)

scene.frame_start, scene.frame_end = 1, max_frame
scene.render.fps = 24
world = bpy.data.worlds.new("bg")
world.use_nodes = True
world.node_tree.nodes["Background"].inputs["Color"].default_value = (0.2, 0.21, 0.23, 1)
scene.world = world
sun = bpy.data.objects.new("sun", bpy.data.lights.new("sun", "SUN"))
sun.data.energy = 2.2
sun.rotation_euler = (math.radians(50), math.radians(10), math.radians(35))
scene.collection.objects.link(sun)
bpy.ops.wm.save_as_mainfile(filepath=OUT, compress=True)
print("LINEUP", OUT, "models:", len(INPUTS), "frames:", max_frame)
