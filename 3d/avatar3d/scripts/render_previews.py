"""Render preview stills of the avatar in an approximation of the site's ink look.

    "$B" -b -Y 3d/avatar3d/cody_avatar.blend --python 3d/avatar3d/scripts/render_previews.py -- views
    modes: views | faces | overlay | all     (optional 2nd arg: output prefix)

Look: flat 3-step toon ramp from a fixed light direction (same steps as prototype/ink.js:
70/150/255), screen-space diagonal hatching on the shadow side, Freestyle outlines.
"""
import math
import sys
from pathlib import Path

import bpy
from mathutils import Vector

HERE = Path(__file__).resolve().parent
OUT = HERE.parent
PREV = OUT / "previews"
TEX = OUT / "textures"
args = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
MODE = args[0] if args else "views"
PREFIX = args[1] if len(args) > 1 else ""
LIGHT = Vector((-0.45, 0.75, 0.5)).normalized()   # my frame: from upper left, in front
BG = (0.93, 0.86, 0.74)


def V(x, y, z):
    return Vector((x, -z, y))


def toonify(mat, hatch_px=6.0):
    nt = mat.node_tree
    bsdf = nt.nodes.get("Principled BSDF")
    link = bsdf.inputs["Base Color"].links
    out = nt.nodes["Material Output"]
    N = nt.nodes.new
    geo = N("ShaderNodeNewGeometry")
    dot = N("ShaderNodeVectorMath"); dot.operation = "DOT_PRODUCT"
    dot.inputs[1].default_value = V(*LIGHT)
    nt.links.new(geo.outputs["Normal"], dot.inputs[0])
    # three.js toon: gradient coord = ndl*0.5+0.5, 3 texels -> 70/150/255
    ramp_in = N("ShaderNodeMath"); ramp_in.operation = "MULTIPLY_ADD"
    ramp_in.inputs[1].default_value = 0.5; ramp_in.inputs[2].default_value = 0.5
    nt.links.new(dot.outputs["Value"], ramp_in.inputs[0])
    ramp = N("ShaderNodeValToRGB")
    ramp.color_ramp.interpolation = "CONSTANT"
    els = ramp.color_ramp.elements
    els[0].position = 0.0; els[0].color = (70 / 255,) * 3 + (1,)
    els[1].position = 1 / 3; els[1].color = (150 / 255,) * 3 + (1,)
    e3 = els.new(2 / 3); e3.color = (1, 1, 1, 1)
    nt.links.new(ramp_in.outputs[0], ramp.inputs["Fac"])
    mul = N("ShaderNodeMix"); mul.data_type = "RGBA"; mul.blend_type = "MULTIPLY"
    mul.inputs["Factor"].default_value = 1.0
    if link:
        nt.links.new(link[0].from_socket, mul.inputs[6])
    else:
        mul.inputs[6].default_value = bsdf.inputs["Base Color"].default_value
    nt.links.new(ramp.outputs["Color"], mul.inputs[7])

    # hatching (screen space): h1 on the shadow side, h2 crossing in deep shadow
    win = N("ShaderNodeTexCoord")
    sep = N("ShaderNodeSeparateXYZ")
    nt.links.new(win.outputs["Window"], sep.inputs[0])
    r = bpy.context.scene.render
    W, H = r.resolution_x * r.resolution_percentage / 100, r.resolution_y * r.resolution_percentage / 100

    def m(op, a, b=None, c=None):
        n = N("ShaderNodeMath"); n.operation = op
        for i, v in enumerate((a, b, c)):
            if v is None:
                continue
            if isinstance(v, (int, float)):
                n.inputs[i].default_value = v
            else:
                nt.links.new(v, n.inputs[i])
        return n.outputs[0]

    xs, ys = m("MULTIPLY", sep.outputs[0], W), m("MULTIPLY", sep.outputs[1], H)

    def hatch(sign):
        s = m("ADD", xs, m("MULTIPLY", ys, sign))
        f = m("FRACT", m("MULTIPLY", s, 1 / hatch_px))
        return m("LESS_THAN", f, 0.3)

    ndl = dot.outputs["Value"]

    def smooth(a, b, x):  # glsl smoothstep(a, b, x) with a > b allowed
        t = m("MINIMUM", m("MAXIMUM", m("DIVIDE", m("SUBTRACT", x, a), b - a), 0.0), 1.0)
        return m("MULTIPLY", m("MULTIPLY", t, t), m("SUBTRACT", 3.0, m("MULTIPLY", t, 2.0)))

    shade, deep = smooth(0.1, -0.2, ndl), smooth(-0.35, -0.75, ndl)
    amt = m("MULTIPLY", m("MINIMUM", m("ADD", m("MULTIPLY", hatch(1), shade), m("MULTIPLY", hatch(-1), deep)), 1.0), 0.8)
    darken = N("ShaderNodeMix"); darken.data_type = "RGBA"; darken.blend_type = "MIX"
    nt.links.new(amt, darken.inputs["Factor"])
    nt.links.new(mul.outputs[2], darken.inputs[6])
    dk = N("ShaderNodeMix"); dk.data_type = "RGBA"; dk.blend_type = "MULTIPLY"
    dk.inputs["Factor"].default_value = 1.0
    nt.links.new(mul.outputs[2], dk.inputs[6]); dk.inputs[7].default_value = (0.3, 0.3, 0.3, 1)
    nt.links.new(dk.outputs[2], darken.inputs[7])
    emit = N("ShaderNodeEmission")
    nt.links.new(darken.outputs[2], emit.inputs["Color"])
    nt.links.new(emit.outputs[0], out.inputs["Surface"])


def setup(res=(900, 1000)):
    sc = bpy.context.scene
    sc.render.engine = "BLENDER_EEVEE_NEXT"
    sc.eevee.taa_render_samples = 16
    sc.render.resolution_x, sc.render.resolution_y = res
    sc.render.resolution_percentage = 100
    sc.view_settings.view_transform = "Standard"
    sc.view_settings.look = "None"
    sc.render.film_transparent = False
    world = bpy.data.worlds.new("bg") if not sc.world else sc.world
    sc.world = world
    world.use_nodes = True
    world.node_tree.nodes["Background"].inputs["Color"].default_value = (*[c ** 2.2 for c in BG], 1)
    world.node_tree.nodes["Background"].inputs["Strength"].default_value = 1.0
    # outlines
    sc.render.use_freestyle = True
    sc.render.line_thickness_mode = "ABSOLUTE"
    sc.render.line_thickness = 1.0
    vl = sc.view_layers[0]
    vl.use_freestyle = True
    fs = vl.freestyle_settings
    fs.crease_angle = math.radians(128)
    ls = fs.linesets[0] if fs.linesets else fs.linesets.new("ink")
    ls.select_by_visibility = True
    ls.select_silhouette = ls.select_border = ls.select_crease = True
    ls.select_external_contour = True
    ls.select_contour = True
    ls.select_material_boundary = False
    st = ls.linestyle or bpy.data.linestyles.new("ink")
    ls.linestyle = st
    st.color = (0.02, 0.03, 0.05)
    st.thickness = 4.0 * res[1] / 1000
    st.thickness_position = "CENTER"
    for mat in bpy.data.materials:
        if mat.use_nodes and "Principled BSDF" in mat.node_tree.nodes:
            toonify(mat)


def camera(name, eye, target, lens=50, ortho=None):
    cam = bpy.data.cameras.new(name)
    cam.lens = lens
    cam.clip_start, cam.clip_end = 0.05, 100
    if ortho:
        cam.type = "ORTHO"
        cam.ortho_scale = ortho
    ob = bpy.data.objects.new(name, cam)
    bpy.context.scene.collection.objects.link(ob)
    ob.location = eye
    d = (target - eye)
    ob.rotation_euler = d.to_track_quat("-Z", "Y").to_euler()
    return ob


def shoot(cam, path):
    sc = bpy.context.scene
    sc.camera = cam
    sc.render.filepath = str(path)
    bpy.ops.render.render(write_still=True)
    print("WROTE", path)


def set_face(name):
    for mat in bpy.data.materials:
        if mat.name == "cody_face":
            for n in mat.node_tree.nodes:
                if n.type == "TEX_IMAGE":
                    n.image = bpy.data.images.load(str(TEX / f"face_{name}.png"), check_existing=True)


def orbit(angle_deg, dist, height, target):
    a = math.radians(angle_deg)
    return target + V(math.sin(a) * dist, height, math.cos(a) * dist) - V(0, 0, 0)


def main():
    PREV.mkdir(exist_ok=True)
    if MODE in ("views", "all"):
        setup((900, 1000))
        tgt = V(0, 1.12, 0)
        for label, ang in (("front", 0), ("three_quarter", 38), ("side", 90), ("back", 180)):
            eye = tgt + V(math.sin(math.radians(ang)) * 5.2, 0.75, math.cos(math.radians(ang)) * 5.2)
            shoot(camera(label, eye, tgt, lens=55), PREV / f"{PREFIX}{label}.png")
    if MODE in ("faces", "all"):
        setup((700, 700))
        tgt = V(0, 1.55, 0.1)
        eye = tgt + V(math.sin(math.radians(18)) * 4.2, 0.35, math.cos(math.radians(18)) * 4.2)
        cam = camera("face", eye, tgt, lens=60)
        for name in ("not_talking", "talking", "smug", "sure", "evil"):
            set_face(name)
            shoot(cam, PREV / f"{PREFIX}expr_{name}.png")
        set_face("not_talking")
    if MODE == "overlay":
        # orthographic front view framed exactly like the 654x1024 drawing crop
        U = 2.3 / 1008
        setup((654, 1024))
        c = V((327 - 288) * U, (1015 - 512) * U, 0)
        cam = camera("ortho", c + V(0, 0, 10), c, ortho=1024 * U)
        shoot(cam, PREV / f"{PREFIX}overlay_raw.png")


if __name__ == "__main__":
    main()
