// Background for the hero: voxel badlands terrain plus Borderlands-flavored junk
// (corrugated shack, power lines, water tower, crates, barrels, tires, cable, dust).
import * as THREE from "three";
import { rng, BANDS } from "./voxkit.js";

function hash(x, z) {
  const s = Math.sin(x * 127.1 + z * 311.7) * 43758.5453;
  return s - Math.floor(s);
}
function vnoise(x, z) {
  const xi = Math.floor(x), zi = Math.floor(z), xf = x - xi, zf = z - zi;
  const u = xf * xf * (3 - 2 * xf), v = zf * zf * (3 - 2 * zf);
  const a = hash(xi, zi), b = hash(xi + 1, zi), c = hash(xi, zi + 1), d = hash(xi + 1, zi + 1);
  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
}

export const SHACK = { x: -8.2, z: -10, w: 5, h: 3, d: 3.4, rot: 0.35 };

export function buildScenery(scene, kit, ink) {
  const { pbox, decal, voxelMeshes, glowSprite, unlit, canvasTexture } = kit;
  const updaters = [];
  const add = (m, x, y, z, parent = scene) => { m.position.set(x, y, z); parent.add(m); return m; };

  /* ---------------- terrain ---------------- */
  const blocks = new Map();
  const set = (x, y, z, m) => blocks.set(`${x},${y},${z}`, m);
  const inShack = (x, z) => x >= SHACK.x - 4 && x <= SHACK.x + 4 && z >= SHACK.z - 3 && z <= SHACK.z + 3;
  for (let x = -34; x <= 34; x++) {
    for (let z = -24; z <= 10; z++) {
      set(x, -1, z, "sand");
      if (z < -5 && !inShack(x, z)) {
        const h = Math.floor(vnoise(x * 0.25, z * 0.25) * 2.3);
        for (let y = 0; y < h; y++) set(x, y, z, "sand");
      }
    }
  }
  for (let x = -6; x <= 2; x++) for (let z = -1; z <= 2; z++) set(x, -1, z, "plank"); // deck
  for (let x = -52; x <= 52; x++) {
    for (let z = -46; z <= -26; z++) {
      const n = vnoise(x * 0.08 + 3, z * 0.12) * 0.75 + vnoise(x * 0.3, z * 0.3) * 0.25;
      if (n < 0.5) continue;
      const h = Math.floor(3 + (n - 0.5) * 18);
      for (let y = 0; y < h; y++) set(x, y, z, "terra" + (y % BANDS.length));
    }
  }
  for (const [x, z, h] of [[9, -3, 3], [-13, -3, 2], [15, -6, 3], [-17, -1, 2], [5, -9, 2]]) {
    for (let y = 0; y < h; y++) set(x, y, z, "cactus");
  }
  voxelMeshes(blocks).forEach((m) => scene.add(m));

  /* ---------------- corrugated shack ---------------- */
  const shack = new THREE.Group();
  shack.position.set(SHACK.x, 0, SHACK.z);
  shack.rotation.y = SHACK.rot;
  scene.add(shack);
  const { w, h, d } = SHACK;
  add(pbox(w, h, 0.2, "corrugated", 1), 0, h / 2, -d / 2, shack);
  add(pbox(0.2, h, d, "corrugated", 1), -w / 2, h / 2, 0, shack);
  add(pbox(0.2, h, d, "corrugated", 1), w / 2, h / 2, 0, shack);
  add(pbox(1.5, h, 0.2, "corrugated", 1), -w / 2 + 0.75, h / 2, d / 2, shack);
  add(pbox(2.3, h, 0.2, "corrugated", 1), w / 2 - 1.15, h / 2, d / 2, shack);
  add(pbox(1.2, 0.8, 0.2, "corrugated", 1), -w / 2 + 2.1, h - 0.4, d / 2, shack);
  const doorway = add(unlit(new THREE.PlaneGeometry(1.2, 2.2), 0x120d0a), -w / 2 + 2.1, 1.1, d / 2 - 0.05, shack); // becomes the portal
  const roof = add(pbox(w + 0.8, 0.14, d + 1.0, "roof", 1), 0, h + 0.18, 0.1, shack);
  roof.rotation.x = 0.12;
  const awning = add(pbox(1.9, 0.08, 0.9, "rust", 0.5), -w / 2 + 2.1, 2.45, d / 2 + 0.42, shack);
  awning.rotation.x = 0.35;
  // satellite dish + antenna on the roof
  const dish = add(ink.inkify(new THREE.Mesh(new THREE.CylinderGeometry(0.55, 0.3, 0.12, 10)), { color: 0xc3cad3 }), 1.4, h + 0.95, -0.4, shack);
  dish.rotation.set(0.9, 0.4, 0.2);
  add(pbox(0.1, 0.7, 0.1, "metal"), 1.4, h + 0.5, -0.4, shack);
  add(pbox(0.06, 1.6, 0.06, "metal"), -1.8, h + 0.9, -1.0, shack);
  const blink = add(glowSprite(0xff4040, 0.5, 0.9), -1.8, h + 1.75, -1.0, shack);
  updaters.push((dt, t) => { blink.material.opacity = Math.floor(t * 1.5) % 2 ? 0.95 : 0.1; });
  // scrap sheets leaning on the side
  const s1 = add(pbox(1.4, 1.8, 0.06, "rust", 0.5), w / 2 + 0.45, 0.85, 0.6, shack);
  s1.rotation.set(0, 0.15, -0.22);
  const s2 = add(pbox(1.0, 1.4, 0.06, "corrugated", 1), w / 2 + 0.35, 0.68, -0.6, shack);
  s2.rotation.set(0, -0.1, -0.3);

  // hand-painted sign on the roof edge
  const signTex = canvasTexture(256, 56, (g) => {
    g.fillStyle = "#e8d6a8"; g.fillRect(0, 0, 256, 56);
    g.fillStyle = "#6b4a2a"; g.fillRect(0, 0, 256, 4); g.fillRect(0, 52, 256, 4);
    g.font = '36px "Bangers", Impact, sans-serif';
    g.textAlign = "center"; g.textBaseline = "middle";
    g.lineWidth = 5; g.strokeStyle = "#1a1210"; g.strokeText("CODY'S WORKSHOP", 128, 30);
    g.fillStyle = "#c9332a"; g.fillText("CODY'S WORKSHOP", 128, 30);
  });
  const sign = add(decal(signTex, 3.6, 0.8), 0, h + 0.75, d / 2 + 0.3, shack);
  sign.rotation.set(-0.05, 0, -0.04);

  // "available for hire" poster with Cody's smug face, nailed to the wall
  const poster = add(new THREE.Mesh(new THREE.PlaneGeometry(1.0, 1.32)), w / 2 - 1.1, 1.55, d / 2 + 0.115, shack);
  poster.rotation.z = 0.05;
  const face = new Image();
  face.onload = () => {
    const tex = canvasTexture(150, 198, (g) => {
      g.fillStyle = "#efe2c0"; g.fillRect(0, 0, 150, 198);
      g.fillStyle = "#d8c79c"; for (let i = 0; i < 40; i++) g.fillRect((i * 37) % 150, (i * 53) % 198, 3, 2);
      g.strokeStyle = "#5a3a1a"; g.lineWidth = 4; g.strokeRect(6, 6, 138, 186);
      g.font = '30px "Bangers", Impact, sans-serif'; g.textAlign = "center"; g.fillStyle = "#1a1210";
      g.fillText("AVAILABLE", 75, 38);
      g.drawImage(face, 41, 46, 68, 106); // keeps the drawing's 654×1024 proportions
      g.fillStyle = "#c9332a"; g.font = '28px "Bangers", Impact, sans-serif';
      g.fillText("FOR HIRE", 75, 176);
      g.fillStyle = "#1a1210"; g.font = '11px "Saira Condensed", sans-serif';
      g.fillText("3D · ANIMATION · VIDEO", 75, 190);
    });
    ink.inkify(poster, { map: tex, alphaTest: 0 });
  };
  face.src = "avatar/smug.png";
  for (const [x, y] of [[-0.42, 0.6], [0.42, 0.6]]) add(pbox(0.06, 0.06, 0.06, "metal"), x, y, 0.03, poster);

  /* ---------------- power line ---------------- */
  const poles = [];
  let firstPole = null;
  for (let i = 0; i < 6; i++) {
    const f = i / 5;
    const p = new THREE.Vector3((i === 0 ? 6.3 : 7) + f * 30, 0, -3 - f * 44); // first pole pulled into view for the cable joke
    const g = new THREE.Group();
    g.position.copy(p);
    g.rotation.y = -0.55;
    add(pbox(0.24, 6.2, 0.24, "plank", 1), 0, 3.1, 0, g);
    add(pbox(2.0, 0.16, 0.16, "plank", 1), 0, 5.8, 0, g);
    for (const x of [-0.85, 0.85]) add(pbox(0.1, 0.2, 0.1, "metal"), x, 5.98, 0, g);
    scene.add(g);
    g.updateMatrixWorld();
    if (i === 0) firstPole = g;
    poles.push([-0.85, 0.85].map((x) => new THREE.Vector3(x, 6.06, 0).applyMatrix4(g.matrixWorld)));
  }
  const wireMat = new THREE.MeshBasicMaterial({ color: 0x1a1210 });
  for (let i = 0; i < poles.length - 1; i++) {
    for (let k = 0; k < 2; k++) {
      const a = poles[i][k], b = poles[i + 1][k];
      const mid = a.clone().lerp(b, 0.5); mid.y -= 0.9;
      const curve = new THREE.QuadraticBezierCurve3(a, mid, b);
      const wire = new THREE.Mesh(new THREE.TubeGeometry(curve, 16, 0.03, 4), wireMat);
      wire.userData.noInk = true;
      scene.add(wire);
    }
  }

  /* ---------------- the inside joke: Cody's ethernet, plugged into the power pole ---------------- */
  {
    const P = firstPole;
    const toWorld = (obj, x, y, z) => { obj.updateMatrixWorld(true); return new THREE.Vector3(x, y, z).applyMatrix4(obj.matrixWorld); };
    // junction box with the plug jammed in, duct tape holding the cable to the pole
    add(pbox(0.32, 0.38, 0.12, "metal"), 0, 5.22, 0.18, P);
    add(ink.inkify(new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.1, 0.12)), { color: 0x9fd0ff }), 0, 5.06, 0.28, P); // RJ45 plug
    for (const y of [4.62, 4.86]) add(ink.inkify(new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.08, 0.3)), { color: 0xb9bec4 }), 0, y, 0, P);
    const note = canvasTexture(128, 64, (g) => {
      g.fillStyle = "#c9a26a"; g.fillRect(0, 0, 128, 64);
      g.fillStyle = "#a9824e"; for (let i = 0; i < 14; i++) g.fillRect((i * 29) % 128, (i * 17) % 64, 6, 2);
      g.strokeStyle = "#5a3a1a"; g.lineWidth = 3; g.strokeRect(2, 2, 124, 60);
      g.font = '20px "Bangers", Impact, sans-serif'; g.textAlign = "center"; g.fillStyle = "#c9332a";
      g.fillText("DO NOT UNPLUG", 64, 30);
      g.font = '16px "Bangers", Impact, sans-serif'; g.fillStyle = "#1a1210"; g.fillText("- CODY", 88, 52);
    });
    const sign = add(decal(note, 0.64, 0.32), -0.16, 3.85, 0.125, P);
    sign.rotation.z = 0.07;

    // router on the shack wall, above the poster, with blinking link lights
    add(pbox(0.46, 0.2, 0.12, "metalDark"), 1.95, 2.62, 1.87, shack);
    for (const x of [-0.16, 0.16]) add(pbox(0.03, 0.26, 0.03, "metal"), 1.95 + x, 2.85, 1.86, shack).rotation.z = x * 1.6;
    const leds = [-0.12, -0.04, 0.04, 0.12].map((x, k) => add(unlit(new THREE.BoxGeometry(0.04, 0.03, 0.02), k === 3 ? 0xffb030 : 0x3bff6f), 1.95 + x, 2.6, 1.935, shack));
    updaters.push((dt, t) => leds.forEach((l, k) => (l.visible = k === 3 || Math.sin(t * (7 + k * 5) + k) > -0.2)));

    // the cable: down the pole under the tape, a long sag across to a clip under the roof's front-right
    // corner (roof underside there is y≈2.85, edge z≈2.28 in shack space), then along under the eave
    add(pbox(0.07, 0.1, 0.07, "metal"), 2.86, 2.8, 2.22, shack); // the clip
    const onPole = [[0, 4.98, 0.3], [0, 4.86, 0.17], [0, 4.62, 0.17], [0, 4.42, 0.2]].map(([x, y, z]) => toWorld(P, x, y, z));
    const clip = toWorld(shack, 2.86, 2.73, 2.22);
    const start = onPole[onPole.length - 1];
    const span = [];
    for (let i = 1; i < 28; i++) {
      const t = i / 28, p = start.clone().lerp(clip, t);
      p.y -= 0.75 * 4 * t * (1 - t); // droop: it hangs below the clip and rises into it from outside the roof
      span.push(p);
    }
    const down = [toWorld(shack, 2.62, 2.69, 2.07), toWorld(shack, 2.36, 2.65, 1.96), toWorld(shack, 2.2, 2.63, 1.9)];
    const path = new THREE.CatmullRomCurve3([...onPole, ...span, clip, ...down], false, "centripetal");
    scene.add(ink.inkify(new THREE.Mesh(new THREE.TubeGeometry(path, 160, 0.045, 6)), { color: 0x3b8fe8 }));
  }

  /* ---------------- water tower ---------------- */
  {
    const t = new THREE.Group();
    t.position.set(17, 0, -30);
    scene.add(t);
    for (const [x, z] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) {
      const leg = add(pbox(0.22, 5.2, 0.22, "metal", 1), x * 1.05, 2.6, z * 1.05, t);
      leg.rotation.set(z * 0.05, 0, -x * 0.05);
    }
    add(pbox(2.2, 0.15, 0.15, "metal", 1), 0, 2.4, 1.05, t);
    add(pbox(2.2, 0.15, 0.15, "metal", 1), 0, 2.4, -1.05, t);
    add(pbox(2.8, 2.3, 2.8, "barrel", 1), 0, 6.35, 0, t);
    add(pbox(2.2, 0.4, 2.2, "rust", 1), 0, 7.7, 0, t);
    add(pbox(1.2, 0.35, 1.2, "rust", 1), 0, 8.05, 0, t);
    const label = canvasTexture(128, 48, (g) => {
      g.clearRect(0, 0, 128, 48);
      g.font = '40px "Bangers", Impact, sans-serif'; g.textAlign = "center"; g.textBaseline = "middle";
      g.lineWidth = 6; g.strokeStyle = "#0d2226"; g.strokeText("H2O", 64, 26);
      g.fillStyle = "#f1e6c8"; g.fillText("H2O", 64, 26);
    });
    add(decal(label, 1.8, 0.68), 0, 6.4, 1.42, t);
  }

  /* ---------------- clutter around the deck ---------------- */
  const crate = (s, x, y, z, ry) => { const c = add(pbox(s, s, s, "crate", s), x, y + s / 2, z); c.rotation.y = ry; return c; };
  crate(0.75, 2.75, 0, 0.75, 0.15);
  crate(0.6, 3.5, 0, 1.15, -0.25);
  crate(0.55, 2.8, 0.75, 0.7, 0.4);
  add(pbox(0.62, 0.9, 0.62, "barrel", 0.62), 4.25, 0.45, 0.35).rotation.y = 0.3;
  add(pbox(0.62, 0.9, 0.62, "barrel", 0.62), SHACK.x + 3.4, 0.45, SHACK.z + 2.6).rotation.y = -0.2;
  for (let i = 0; i < 3; i++) { // tire stack
    const tire = ink.inkify(new THREE.Mesh(new THREE.TorusGeometry(0.34, 0.15, 4, 8)), { map: kit.TEX.tire });
    tire.rotation.set(Math.PI / 2, 0, i * 0.4);
    add(tire, -6.3 + (i === 2 ? 0.08 : 0), 0.15 + i * 0.28, 2.3);
  }
  // power cable from the back of the cabinet to the shack, routed over open ground: a shortest path
  // on the block grid that keeps clear of raised sand, cacti, the lamp, the chair and the shack walls
  scene.add(ink.inkify(new THREE.Mesh(new THREE.TubeGeometry(routeGroundCable(blocks, shack), 220, 0.05, 6)), { color: 0x1d1d22 }));

  /* ---------------- drifting dust ---------------- */
  const dust = [];
  const r = rng(7);
  for (let i = 0; i < 46; i++) {
    const s = glowSprite(0xffd2a0, 0.06 + r() * 0.08, 0.35 + r() * 0.3);
    s.position.set(-9 + r() * 18, 0.2 + r() * 4.5, -5 + r() * 8);
    s.userData.speed = 0.15 + r() * 0.35;
    scene.add(s);
    dust.push(s);
  }
  updaters.push((dt, t, motion) => {
    for (const s of dust) {
      s.position.x += dt * s.userData.speed * motion;
      s.position.y += Math.sin(t + s.position.x) * dt * 0.05 * motion;
      if (s.position.x > 9) s.position.x = -9;
    }
  });

  return { doorway, update: (dt, t, motion) => updaters.forEach((f) => f(dt, t, motion)) };
}

/** Shortest path on the block grid from behind the cabinet to the shack wall, avoiding anything that
 *  sits above ground level, then string-pulled and smoothed into a lying cable. */
function routeGroundCable(blocks, shack) {
  const X0 = -18, X1 = 4, Z0 = -15, Z1 = 3, W = X1 - X0 + 1, H = Z1 - Z0 + 1;
  const blocked = new Uint8Array(W * H);
  const idx = (x, z) => (z - Z0) * W + (x - X0);
  const inGrid = (x, z) => x >= X0 && x <= X1 && z >= Z0 && z <= Z1;
  for (let z = Z0; z <= Z1; z++) for (let x = X0; x <= X1; x++) if (blocks.has(`${x},0,${z}`)) blocked[idx(x, z)] = 1;
  const block = (x0, z0, x1, z1) => { for (let z = Math.floor(z0); z <= Math.floor(z1); z++) for (let x = Math.floor(x0); x <= Math.floor(x1); x++) if (inGrid(x, z)) blocked[idx(x, z)] = 1; };
  block(-1.7, -0.7, 1.7, 0.7);    // the cabinet
  block(-3.9, 0.7, -1.6, 2.2);    // the armchair
  block(-5.4, -0.6, -5.0, -0.2);  // the lamp post
  block(-6.8, 1.8, -5.8, 2.8);    // the tyre stack
  shack.updateMatrixWorld(true);   // the shack's footprint (rotated), plus a little margin
  const inv = shack.matrixWorld.clone().invert(), v = new THREE.Vector3();
  for (let z = Z0; z <= Z1; z++) for (let x = X0; x <= X1; x++) {
    v.set(x + 0.5, 0, z + 0.5).applyMatrix4(inv);
    if (Math.abs(v.x) < SHACK.w / 2 + 0.6 && Math.abs(v.z) < SHACK.d / 2 + 0.4) blocked[idx(x, z)] = 1;
  }
  const free = (px, pz, r) => { // a disc of radius r around (px, pz) touches no blocked cell
    for (const [dx, dz] of [[-r, -r], [r, -r], [-r, r], [r, r], [0, 0]]) {
      const x = Math.floor(px + dx), z = Math.floor(pz + dz);
      if (!inGrid(x, z) || blocked[idx(x, z)]) return false;
    }
    return true;
  };
  const start = new THREE.Vector3(-1.2, 0.05, -1.4);
  const wallOut = new THREE.Vector3(0.58, 0.05, 2.45).applyMatrix4(shack.matrixWorld); // just in front of the wall
  const wallIn = new THREE.Vector3(0.58, 0.05, 1.82).applyMatrix4(shack.matrixWorld);  // where it plugs in
  const sx = Math.floor(start.x), sz = Math.floor(start.z), gx = Math.floor(wallOut.x), gz = Math.floor(wallOut.z);
  // Dijkstra, 8-connected; cells next to an obstacle cost more so the cable keeps some clearance
  const dist = new Float32Array(W * H).fill(Infinity), prev = new Int32Array(W * H).fill(-1), done = new Uint8Array(W * H);
  const near = (x, z) => { for (let dz = -1; dz <= 1; dz++) for (let dx = -1; dx <= 1; dx++) if (inGrid(x + dx, z + dz) && blocked[idx(x + dx, z + dz)]) return 1; return 0; };
  dist[idx(sx, sz)] = 0;
  for (;;) {
    let best = -1;
    for (let i = 0; i < W * H; i++) if (!done[i] && dist[i] < Infinity && (best < 0 || dist[i] < dist[best])) best = i;
    if (best < 0 || best === idx(gx, gz)) break;
    done[best] = 1;
    const bx = (best % W) + X0, bz = Math.floor(best / W) + Z0;
    for (let dz = -1; dz <= 1; dz++) for (let dx = -1; dx <= 1; dx++) {
      if (!dx && !dz) continue;
      const nx = bx + dx, nz = bz + dz;
      if (!inGrid(nx, nz) || blocked[idx(nx, nz)]) continue;
      if (dx && dz && (blocked[idx(bx + dx, bz)] || blocked[idx(bx, bz + dz)])) continue; // no corner cutting
      const c = dist[best] + Math.hypot(dx, dz) * (1 + 2 * near(nx, nz));
      if (c < dist[idx(nx, nz)]) { dist[idx(nx, nz)] = c; prev[idx(nx, nz)] = best; }
    }
  }
  const cells = [];
  for (let i = idx(gx, gz); i >= 0; i = prev[i]) cells.unshift(new THREE.Vector3((i % W) + X0 + 0.5, 0.05, Math.floor(i / W) + Z0 + 0.5));
  if (cells.length < 2) console.warn("cable route not found; using a straight run");
  // string-pull: keep only the points needed to stay clear of obstacles
  const pts = [start, ...cells.slice(1, -1), wallOut];
  const clear = (a, b) => { const n = Math.ceil(a.distanceTo(b) / 0.1); for (let k = 0; k <= n; k++) { const t = k / n; if (!free(a.x + (b.x - a.x) * t, a.z + (b.z - a.z) * t, 0.3)) return false; } return true; };
  const pulled = [pts[0]];
  for (let i = 0; i < pts.length - 1;) {
    let j = pts.length - 1;
    while (j > i + 1 && !clear(pts[i], pts[j])) j--;
    pulled.push(pts[j]);
    i = j;
  }
  const out = [new THREE.Vector3(-1.2, 0.05, -0.6), ...pulled, wallIn];
  return new THREE.CatmullRomCurve3(out, false, "centripetal");
}
