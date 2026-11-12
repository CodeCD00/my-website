// Cody's hand-drawn avatar as a flat "paper" cutout sitting cross-legged in a voxel armchair.
// Behaves like a streaming avatar: mouth flaps while talking, breathes, pulls faces, hops on emote.
import * as THREE from "three";

const EXPRESSIONS = ["not_talking", "talking", "smug", "sure", "evil"];
const EMOTE_CYCLE = ["evil", "sure", "smug"];
const ASPECT = 654 / 1024; // cropped drawing size

export async function buildAvatar(scene, kit, ink, { position, yaw = 0, height = 1.9 }) {
  const { pbox } = kit;

  /* ---------- the chair: chunky voxel armchair, patched and duct-taped ---------- */
  const chair = new THREE.Group();
  chair.position.copy(position);
  chair.rotation.y = yaw;
  scene.add(chair);
  const add = (m, x, y, z) => { m.position.set(x, y, z); chair.add(m); return m; };
  for (const [x, z] of [[-0.76, -0.42], [0.76, -0.42], [-0.76, 0.42], [0.76, 0.42]]) add(pbox(0.14, 0.3, 0.14, "metal"), x, 0.15, z);
  add(pbox(1.8, 0.3, 1.0, "plank"), 0, 0.45, 0);
  add(pbox(1.36, 0.2, 0.86, "fabric", 1), 0, 0.7, 0.06);
  add(pbox(1.8, 1.3, 0.26, "fabric", 1), 0, 1.25, -0.37);
  add(pbox(1.86, 0.12, 0.32, "rust"), 0, 1.95, -0.37);
  for (const s of [-1, 1]) {
    add(pbox(0.2, 0.45, 1.0, "rust"), s * 0.8, 0.82, 0);
    add(pbox(0.24, 0.08, 1.04, "metal"), s * 0.8, 1.08, 0);
  }
  const shadow = new THREE.Mesh(new THREE.CircleGeometry(0.5, 32),
    new THREE.MeshBasicMaterial({ color: 0x1a0d08, transparent: true, opacity: 0.38, depthWrite: false }));
  shadow.rotation.x = -Math.PI / 2;
  shadow.scale.set(2.3, 1.4, 1);
  shadow.position.set(position.x, 0.016, position.z);
  shadow.userData.noInk = true;
  scene.add(shadow);

  /* ---------- the drawing ---------- */
  // each drawing gets a few tries; a face that still fails borrows one that loaded, so a flaky
  // connection never leaves the chair empty
  const loader = new THREE.TextureLoader();
  const loadTex = async (name) => {
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        const t = await loader.loadAsync(`avatar/${name}.png`);
        t.colorSpace = THREE.SRGBColorSpace;
        t.anisotropy = 4;
        return t;
      } catch (err) {
        if (attempt === 2) { console.warn(`avatar: ${name} failed to load`, err); return null; }
        await new Promise((r) => setTimeout(r, 400 * (attempt + 1)));
      }
    }
  };
  const loaded = await Promise.all(EXPRESSIONS.map(loadTex));
  const fallback = loaded[0] || loaded.find(Boolean);
  if (!fallback) throw new Error("no avatar drawings could be loaded");
  const tex = Object.fromEntries(EXPRESSIONS.map((name, i) => [name, loaded[i] || fallback]));
  const width = height * ASPECT;
  const geo = new THREE.PlaneGeometry(width, height);
  geo.translate(0, height / 2, 0); // pivot at the bottom so he squashes into the seat
  const mat = new THREE.MeshBasicMaterial({ map: tex.not_talking, alphaTest: 0.5, toneMapped: false });
  const cutout = ink.inkify(new THREE.Mesh(geo, mat), { material: mat });
  chair.updateMatrixWorld();
  const seat = new THREE.Vector3(0, 0.79, 0.12).applyMatrix4(chair.matrixWorld);
  cutout.position.copy(seat);
  scene.add(cutout);

  /* ---------- behavior ---------- */
  let talkUntil = 0, exprName = null, exprUntil = 0, hopStart = -10, nextIdle = 7, hovered = false;
  let forced = null, emoteIndex = 0, now = 0;

  return {
    mesh: cutout,
    talk() { talkUntil = now + 1.3; },
    emote() {
      exprName = EMOTE_CYCLE[emoteIndex++ % EMOTE_CYCLE.length];
      exprUntil = now + 1.6;
      hopStart = now;
    },
    setHover(on) { hovered = on; },
    force(name) { forced = EXPRESSIONS.includes(name) ? name : null; },
    update(dt, t, camera, motion) {
      now = t;
      // face the camera (turn around Y only, like a paper cutout)
      cutout.rotation.y = Math.atan2(camera.position.x - cutout.position.x, camera.position.z - cutout.position.z);

      let name = "not_talking", flap = 0;
      if (forced) name = forced;
      else if (t < exprUntil) name = exprName;
      else if (t < talkUntil) {
        name = Math.floor(t * 9) % 2 ? "talking" : "not_talking";
        flap = Math.abs(Math.sin(t * 18)) * 0.035;
      } else if (hovered) name = "evil";
      else if (t > nextIdle) { // an occasional idle face
        exprName = Math.random() < 0.5 ? "smug" : "sure";
        exprUntil = t + 1.8;
        nextIdle = t + 8 + Math.random() * 6;
      }
      if (mat.map !== tex[name]) mat.map = tex[name];

      const hopT = (t - hopStart) / 0.45;
      const hop = hopT >= 0 && hopT <= 1 ? Math.sin(hopT * Math.PI) * 0.28 : 0;
      const breathe = Math.sin(t * 2.2) * 0.014 * motion;
      const squash = hopT >= 1 && hopT < 1.4 ? (1.4 - hopT) * 0.12 : 0; // land with a little squash
      cutout.scale.set(1 - breathe * 0.6 + squash * 0.6, 1 + breathe + flap - squash, 1);
      cutout.position.y = seat.y + hop * motion;
    },
  };
}
