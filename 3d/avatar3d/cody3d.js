// Loader for Cody's 3D chibi avatar (cody_avatar.glb) with swappable hand-drawn faces.
// Works with plain three.js materials, or pass the site's Ink instance to get toon + outlines.
import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";

export const EXPRESSIONS = ["not_talking", "talking", "smug", "sure", "evil"];

/**
 * @param {object} o
 * @param {string} o.url       path to cody_avatar.glb
 * @param {string} o.textures  folder holding face_<expression>.png (trailing slash)
 * @param {object} [o.ink]     an Ink instance from prototype/ink.js (optional)
 */
export async function loadCody3D({ url = "cody_avatar.glb", textures = "textures/", ink = null } = {}) {
  const loader = new THREE.TextureLoader();
  const [gltf, faces] = await Promise.all([
    new GLTFLoader().loadAsync(url),
    Promise.all(EXPRESSIONS.map(async (name) => {
      const t = await loader.loadAsync(`${textures}face_${name}.png`);
      t.flipY = false;                       // glTF UV convention: must match the embedded texture
      t.colorSpace = THREE.SRGBColorSpace;
      t.anisotropy = 4;
      return [name, t];
    })).then(Object.fromEntries),
  ]);

  const root = gltf.scene;
  let face = null;
  root.traverse((o) => {
    if (!o.isMesh) return;
    const src = o.material;
    if (ink) {
      // pixel:false keeps the drawn face smooth (ink.toon defaults to crisp Minecraft texels)
      ink.inkify(o, src.map ? { map: src.map, pixel: false } : { color: src.color.getHex() });
      // ink's normal-pass shader has no skinning; MeshNormalMaterial writes the same packed
      // view-space normals and follows the bones (standing model only)
      if (o.isSkinnedMesh) o.userData.inkNormal = new THREE.MeshNormalMaterial();
    }
    if (src.name === "cody_face") face = o.material;
  });

  const head = root.getObjectByName("HeadPivot") || root.getObjectByName("head"); // seated: pivot, standing: bone
  const body = root.getObjectByName("Body") || null;                               // seated only
  const mixer = gltf.animations.length ? new THREE.AnimationMixer(root) : null;
  let action = null;
  let current = "not_talking";

  return {
    root,
    head,          // rotate for nods/tilts (pivot at the neck)
    body,          // scale for breathing (pivot at the hips)
    faces,
    clips: gltf.animations,   // seated: "Idle" 4 s breathing loop; standing: Idle, Wave, Cheer, Shrug (held poses)
    mixer,
    /** Play/blend to a clip by name (loops). null stops it (seated: still, standing: A-pose rest). */
    setPose(name, fade = 0.25) {
      if (!mixer) return;
      const clip = name && THREE.AnimationClip.findByName(gltf.animations, name);
      const next = clip ? mixer.clipAction(clip) : null;
      if (next === action) return;
      if (next) next.reset().play();
      if (action && next) action.crossFadeTo(next, fade, false);
      else if (action) action.fadeOut(fade);
      action = next;
    },
    get expression() { return current; },
    setExpression(name) {
      if (!faces[name] || name === current) return;
      face.map = faces[name];                // same program, no recompile
      current = name;
    },
  };
}
