// "Cody's Workshop": a pure-Borderlands interior (hand-painted textures, ink, hatching) where
// his Blockbench models stand on a display turntable. The BL-style holo list, loot card and tabs
// are DOM pinned to 3D points each frame, like the hero.
import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { MODELS, MODEL_VERSION, modelCardHTML } from "./models.js";
import { RARITY } from "./items.js";

const SVG_NS = "http://www.w3.org/2000/svg";
const ease = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
const clamp01 = (v) => Math.max(0, Math.min(1, v));

/* ---------------------------------------------------------------- hand-painted textures */
function drawn(w, h, paint, repeat = true) {
  const c = document.createElement("canvas");
  c.width = w; c.height = h;
  paint(c.getContext("2d"), w, h);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  if (repeat) t.wrapS = t.wrapT = THREE.RepeatWrapping;
  return t;
}
function rand(seed) { let s = seed; return () => ((s = (s * 16807) % 2147483647) - 1) / 2147483646; }
function inkLine(g, pts, width = 2, color = "#1a120c") {
  g.strokeStyle = color; g.lineWidth = width; g.lineCap = "round"; g.lineJoin = "round";
  g.beginPath(); pts.forEach(([x, y], i) => (i ? g.lineTo(x, y) : g.moveTo(x, y))); g.stroke();
}
function hatch(g, x, y, w, h, color = "rgba(20,12,8,0.35)", step = 6) {
  g.save(); g.beginPath(); g.rect(x, y, w, h); g.clip();
  g.strokeStyle = color; g.lineWidth = 1.2;
  for (let i = -h; i < w; i += step) { g.beginPath(); g.moveTo(x + i, y + h); g.lineTo(x + i + h, y); g.stroke(); }
  g.restore();
}
function grime(g, w, h, r, color, n, size) {
  for (let i = 0; i < n; i++) {
    g.fillStyle = color; g.globalAlpha = 0.08 + r() * 0.12;
    g.beginPath(); g.ellipse(r() * w, r() * h, size * (0.5 + r()), size * (0.3 + r() * 0.5), r() * 3, 0, Math.PI * 2); g.fill();
  }
  g.globalAlpha = 1;
}

const PAINT = {
  planks: (g, w, h) => {
    const r = rand(11);
    const cols = ["#7a4a2a", "#6b3f22", "#85522e", "#71452a"];
    for (let i = 0; i < 4; i++) {
      g.fillStyle = cols[i]; g.fillRect(i * 32, 0, 32, h);
      for (let k = 0; k < 5; k++) { // wavy grain
        const x0 = i * 32 + 4 + r() * 24;
        inkLine(g, Array.from({ length: 9 }, (_, j) => [x0 + Math.sin(j * 0.9 + k) * 2.5, j * 16]), 1, "rgba(40,22,10,0.45)");
      }
      inkLine(g, [[i * 32, 0], [i * 32, h]], 3);
      for (const y of [10, h - 10]) { g.fillStyle = "#1a120c"; g.beginPath(); g.arc(i * 32 + 16, y, 2, 0, 7); g.fill(); }
    }
    const grad = g.createLinearGradient(0, h * 0.6, 0, h); grad.addColorStop(0, "rgba(0,0,0,0)"); grad.addColorStop(1, "rgba(20,10,4,0.45)");
    g.fillStyle = grad; g.fillRect(0, 0, w, h);
    hatch(g, 70, 90, 40, 30);
  },
  corrugated: (g, w, h) => {
    const r = rand(5);
    for (let x = 0; x < w; x += 16) {
      const grad = g.createLinearGradient(x, 0, x + 16, 0);
      grad.addColorStop(0, "#5f6a74"); grad.addColorStop(0.45, "#9aa6b0"); grad.addColorStop(1, "#4a545d");
      g.fillStyle = grad; g.fillRect(x, 0, 16, h);
      inkLine(g, [[x, 0], [x, h]], 1.5, "rgba(15,18,22,0.7)");
    }
    for (let i = 0; i < 7; i++) { // rust runs
      const x = r() * w, len = 30 + r() * 80;
      const grad = g.createLinearGradient(0, 0, 0, len); grad.addColorStop(0, "rgba(150,70,30,0.85)"); grad.addColorStop(1, "rgba(150,70,30,0)");
      g.fillStyle = grad; g.fillRect(x, 0, 3 + r() * 4, len);
    }
    grime(g, w, h, r, "#2a1a10", 10, 18);
  },
  concrete: (g, w, h) => {
    const r = rand(3);
    g.fillStyle = "#6f6258"; g.fillRect(0, 0, w, h);
    grime(g, w, h, r, "#4f443c", 30, 14);
    grime(g, w, h, r, "#8a7d70", 18, 10);
    for (let i = 0; i < 3; i++) { // cracks
      let x = r() * w, y = r() * h; const pts = [[x, y]];
      for (let k = 0; k < 6; k++) { x += (r() - 0.5) * 30; y += 8 + r() * 14; pts.push([x, y]); }
      inkLine(g, pts, 2);
    }
    g.fillStyle = "rgba(10,8,6,0.35)"; g.beginPath(); g.ellipse(80, 40, 22, 12, 0.3, 0, 7); g.fill(); // oil stain
    hatch(g, 10, 80, 36, 30, "rgba(20,12,8,0.25)", 5);
  },
  metal: (g, w, h) => {
    const r = rand(9);
    g.fillStyle = "#5d6670"; g.fillRect(0, 0, w, h);
    for (let y = 0; y < h; y += 2) { g.fillStyle = `rgba(255,255,255,${0.02 + r() * 0.05})`; g.fillRect(0, y, w, 1); }
    for (let i = 0; i < 6; i++) inkLine(g, [[r() * w, r() * h], [r() * w, r() * h]], 0.8, "rgba(220,230,240,0.35)");
    grime(g, w, h, r, "#2a2420", 8, 16);
    g.strokeStyle = "#151a20"; g.lineWidth = 4; g.strokeRect(2, 2, w - 4, h - 4);
    for (const [x, y] of [[10, 10], [w - 10, 10], [10, h - 10], [w - 10, h - 10]]) { g.fillStyle = "#c3ccd6"; g.beginPath(); g.arc(x, y, 3, 0, 7); g.fill(); inkLine(g, [[x - 3, y], [x + 3, y]], 1); }
  },
  darkwood: (g, w, h) => {
    const r = rand(21);
    g.fillStyle = "#4a2e1c"; g.fillRect(0, 0, w, h);
    for (let k = 0; k < 10; k++) { const y0 = r() * h; inkLine(g, Array.from({ length: 9 }, (_, j) => [j * 16, y0 + Math.sin(j + k) * 3]), 1, "rgba(15,8,4,0.5)"); }
    g.strokeStyle = "#140a05"; g.lineWidth = 3; g.strokeRect(1, 1, w - 2, h - 2);
  },
  barrel: (g, w, h) => {
    g.fillStyle = "#2f7f8c"; g.fillRect(0, 0, w, h);
    for (let x = 0; x < w; x += 8) { g.fillStyle = "rgba(255,255,255,0.06)"; g.fillRect(x, 0, 3, h); }
    for (const y of [14, h - 26]) { g.fillStyle = "#1a3a40"; g.fillRect(0, y, w, 12); inkLine(g, [[0, y], [w, y]], 2); inkLine(g, [[0, y + 12], [w, y + 12]], 2); }
    g.fillStyle = "#ffd23f"; g.beginPath(); g.moveTo(64, 46); g.lineTo(84, 82); g.lineTo(44, 82); g.closePath(); g.fill(); inkLine(g, [[64, 46], [84, 82], [44, 82], [64, 46]], 3);
  },
  pegboard: (g, w, h) => {
    g.fillStyle = "#b08a5c"; g.fillRect(0, 0, w, h);
    g.fillStyle = "#5a3e22";
    for (let y = 8; y < h; y += 16) for (let x = 8; x < w; x += 16) { g.beginPath(); g.arc(x, y, 2, 0, 7); g.fill(); }
    const tool = (path, fill) => { g.fillStyle = fill; g.beginPath(); path(); g.fill(); g.strokeStyle = "#1a120c"; g.lineWidth = 3; g.stroke(); };
    tool(() => { g.rect(40, 40, 14, 120); g.rect(28, 30, 38, 20); }, "#c9332a"); // hammer
    tool(() => { g.moveTo(110, 40); g.lineTo(130, 40); g.lineTo(126, 150); g.lineTo(114, 150); g.closePath(); }, "#9aa6b0"); // screwdriver
    tool(() => { g.rect(170, 60, 90, 18); g.arc(170, 69, 16, 0, Math.PI * 2); }, "#c3ccd6"); // wrench
    tool(() => { g.moveTo(290, 40); g.lineTo(370, 40); g.lineTo(370, 70); g.lineTo(290, 150); g.closePath(); }, "#d8d2c4"); // saw
    hatch(g, 0, h - 40, w, 40, "rgba(40,22,10,0.3)");
  },
  turntableTop: (g, w, h) => {
    const c = w / 2;
    g.fillStyle = "#4c555f"; g.fillRect(0, 0, w, h);
    for (let i = 0; i < 24; i++) { // hazard band
      g.fillStyle = i % 2 ? "#151a20" : "#ffd23f";
      g.beginPath(); g.moveTo(c, c); g.arc(c, c, c - 2, (i / 24) * Math.PI * 2, ((i + 1) / 24) * Math.PI * 2); g.closePath(); g.fill();
    }
    g.fillStyle = "#5d6670"; g.beginPath(); g.arc(c, c, c * 0.8, 0, 7); g.fill();
    g.strokeStyle = "#151a20"; g.lineWidth = 5;
    for (const rr of [c * 0.8, c - 3, c * 0.3]) { g.beginPath(); g.arc(c, c, rr, 0, 7); g.stroke(); }
    for (let i = 0; i < 8; i++) { const a = (i / 8) * Math.PI * 2; g.fillStyle = "#c3ccd6"; g.beginPath(); g.arc(c + Math.cos(a) * c * 0.7, c + Math.sin(a) * c * 0.7, 5, 0, 7); g.fill(); }
  },
};

/* ---------------------------------------------------------------- holo panel frames */
function framePath(w, h, c, i = 0) {
  return `M${c + i},${i} L${w - i},${i} L${w - i},${h - c - i} L${w - c - i},${h - i} L${i},${h - i} L${i},${c + i} Z`;
}
function decorate(el) {
  const svg = document.createElementNS(SVG_NS, "svg");
  svg.classList.add("bl-frame");
  svg.setAttribute("aria-hidden", "true");
  el.prepend(svg);
  const draw = () => {
    const w = el.clientWidth, h = el.clientHeight, c = 18;
    svg.setAttribute("viewBox", `0 0 ${w} ${h}`);
    svg.innerHTML = `
      <path d="${framePath(w, h, c)}" fill="url(#blFill)"/>
      <path d="${framePath(w, h, c)}" fill="url(#blScan)"/>
      <path d="${framePath(w, h, c, 5)}" fill="none" stroke="#5fd4ff" stroke-opacity="0.3"/>
      <path d="${framePath(w, h, c)}" fill="none" stroke="#5fd4ff" stroke-width="2"/>
      <path d="M1,${c + 22} L1,${c} L${c},1 L${c + 22},1" fill="none" stroke="#b8f4ff" stroke-width="4"/>
      <path d="M${w - 1},${h - c - 22} L${w - 1},${h - c} L${w - c},${h - 1} L${w - c - 22},${h - 1}" fill="none" stroke="#b8f4ff" stroke-width="4"/>`;
  };
  new ResizeObserver(draw).observe(el);
  draw();
}

/* ---------------------------------------------------------------- the workshop */
export function createShop({ renderer, ink, host, dom, isDocked }) {
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x140d09);
  scene.fog = new THREE.Fog(0x140d09, 16, 32);
  // same lens as the outdoor camera: the doorway portal needs identical projections
  const camera = new THREE.PerspectiveCamera(32, 1, 0.1, 160);
  const DOOR_Z = 70; // how far the room runs toward the camera (the door itself sits just in front of the shot)

  const TEX = Object.fromEntries(Object.entries(PAINT).map(([k, p]) => [k, drawn(k === "pegboard" ? 384 : k === "turntableTop" ? 256 : 128, k === "pegboard" ? 192 : k === "turntableTop" ? 256 : 128, p)]));
  const toon = (tex, extra = {}) => ink.toon({ map: tex, pixel: false, alphaTest: 0, ...extra });

  function tbox(w, h, d, tex, tile = 2) {
    const g = new THREE.BoxGeometry(w, h, d);
    const uv = g.attributes.uv;
    const dims = [[d, h], [d, h], [w, d], [w, d], [w, h], [w, h]];
    for (let f = 0; f < 6; f++) for (let i = 0; i < 4; i++) {
      const k = f * 4 + i;
      uv.setXY(k, (uv.getX(k) * dims[f][0]) / tile, (uv.getY(k) * dims[f][1]) / tile);
    }
    return ink.inkify(new THREE.Mesh(g), { material: toon(TEX[tex]) });
  }
  const add = (m, x, y, z, parent = scene) => { m.position.set(x, y, z); parent.add(m); return m; };
  const unlit = (geo, color, extra = {}) => { const m = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ color, ...extra })); m.userData.noInk = true; return m; };
  const glowTex = drawn(64, 64, (g) => {
    const gr = g.createRadialGradient(32, 32, 0, 32, 32, 32);
    gr.addColorStop(0, "rgba(255,255,255,1)"); gr.addColorStop(0.35, "rgba(255,255,255,0.4)"); gr.addColorStop(1, "rgba(255,255,255,0)");
    g.fillStyle = gr; g.fillRect(0, 0, 64, 64);
  }, false);
  const glow = (color, s, o) => {
    const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex, color, transparent: true, opacity: o, depthWrite: false, blending: THREE.AdditiveBlending }));
    sp.scale.set(s, s, 1); sp.userData.noInk = true; return sp;
  };

  /* ---------- room ---------- */
  {
    const floorGeo = new THREE.PlaneGeometry(18, DOOR_Z + 6);
    floorGeo.attributes.uv.array.forEach((v, i, a) => (a[i] = v * (i % 2 ? (DOOR_Z + 6) / 3 : 18 / 3)));
    const floor = ink.inkify(new THREE.Mesh(floorGeo), { material: toon(TEX.concrete) });
    floor.rotation.x = -Math.PI / 2;
    add(floor, 0, 0, (DOOR_Z - 6) / 2);
    add(tbox(18, 8, 0.3, "planks", 2.5), 0, 4, -5.15);
    add(tbox(0.3, 8, DOOR_Z + 6, "corrugated", 2), -9, 4, (DOOR_Z - 6) / 2);
    add(tbox(0.3, 8, DOOR_Z + 6, "corrugated", 2), 9, 4, (DOOR_Z - 6) / 2);
    for (const z of [-3, 0.5, 4]) add(tbox(18, 0.4, 0.4, "darkwood", 2), 0, 6.9, z);
    // plank ceiling, so looking up through the door reads as a roof, not empty space
    const ceilGeo = new THREE.PlaneGeometry(18, DOOR_Z + 6);
    ceilGeo.attributes.uv.array.forEach((v, i, a) => (a[i] = v * (i % 2 ? (DOOR_Z + 6) / 2.5 : 18 / 2.5)));
    const ceiling = ink.inkify(new THREE.Mesh(ceilGeo), { material: toon(TEX.darkwood) });
    ceiling.rotation.x = Math.PI / 2; // face down
    add(ceiling, 0, 7.25, (DOOR_Z - 6) / 2);
    for (const y of [6.1, 6.45]) { // pipes along the back wall
      const pipe = add(ink.inkify(new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.09, 18, 8)), { material: toon(TEX.metal) }), 0, y, -4.85);
      pipe.rotation.z = Math.PI / 2;
    }
  }

  /* ---------- turntable + projector + lamp ---------- */
  const T = new THREE.Vector3(0, 0, 0.4);
  add(ink.inkify(new THREE.Mesh(new THREE.CylinderGeometry(1.5, 1.68, 0.36, 28)), { material: toon(TEX.metal) }), T.x, 0.18, T.z);
  const top = ink.inkify(new THREE.Mesh(new THREE.CylinderGeometry(1.42, 1.42, 0.08, 28)), {
    material: [toon(TEX.metal), toon(TEX.turntableTop), toon(TEX.metal)],
  });
  add(top, T.x, 0.4, T.z);
  const ring = add(unlit(new THREE.TorusGeometry(1.5, 0.035, 6, 64), 0x5fd4ff, { transparent: true, opacity: 0.9, blending: THREE.AdditiveBlending }), T.x, 0.37, T.z);
  ring.rotation.x = Math.PI / 2;
  add(unlit(new THREE.CylinderGeometry(0.35, 1.45, 5.6, 32, 1, true), 0x5fd4ff,
    { transparent: true, opacity: 0.07, blending: THREE.AdditiveBlending, side: THREE.DoubleSide, depthWrite: false }), T.x, 3.25, T.z);
  add(tbox(0.7, 0.35, 0.7, "metal", 1), T.x, 6.25, T.z);
  add(glow(0x5fd4ff, 1.4, 0.9), T.x, 6.0, T.z + 0.1);
  // hanging work lamp, warm pool of light
  add(tbox(0.04, 1.2, 0.04, "darkwood", 1), T.x - 3.1, 6.1, T.z - 1.4);
  const shade = add(ink.inkify(new THREE.Mesh(new THREE.ConeGeometry(0.5, 0.45, 12, 1, true)), { material: toon(TEX.metal) }), T.x - 3.1, 5.35, T.z - 1.4);
  shade.material.side = THREE.DoubleSide;
  add(unlit(new THREE.SphereGeometry(0.13, 10, 8), 0xffe2a0), T.x - 3.1, 5.15, T.z - 1.4);
  add(glow(0xffb050, 2.6, 0.7), T.x - 3.1, 5.1, T.z - 1.3);
  const lampLight = new THREE.PointLight(0xffc27a, 22, 12, 1.4);
  lampLight.position.set(T.x - 2.6, 5.0, T.z - 1.0);
  scene.add(lampLight);
  const holoLight = new THREE.PointLight(0x5fd4ff, 6, 6, 1.5);
  holoLight.position.set(T.x, 1.4, T.z + 1.2);
  scene.add(holoLight);
  scene.add(new THREE.HemisphereLight(0x9fb4c8, 0x3a2416, 0.85));
  const key = new THREE.DirectionalLight(0xffe2c0, 1.5);
  key.position.set(-4, 7, 6);
  scene.add(key);

  /* ---------- workbench + CRT + pegboard ---------- */
  const B = new THREE.Vector3(-5.6, 0, -3.7);
  add(tbox(3.4, 0.18, 1.3, "darkwood", 1.5), B.x, 1.05, B.z);
  for (const [x, z] of [[-1.55, -0.5], [1.55, -0.5], [-1.55, 0.5], [1.55, 0.5]]) add(tbox(0.16, 1.0, 0.16, "metal", 1), B.x + x, 0.5, B.z + z);
  add(tbox(3.2, 0.08, 1.1, "darkwood", 1.5), B.x, 0.35, B.z);
  add(tbox(1.05, 0.88, 0.9, "metal", 1), B.x - 0.6, 1.58, B.z);
  add(unlit(new THREE.PlaneGeometry(0.82, 0.64), 0x0d2a1c), B.x - 0.6, 1.6, B.z + 0.452);
  const crtMat = new THREE.MeshBasicMaterial({ transparent: true, alphaTest: 0.4, toneMapped: false, visible: false });
  const crtFace = add(new THREE.Mesh(new THREE.PlaneGeometry(0.38, 0.6), crtMat), B.x - 0.6, 1.6, B.z + 0.456);
  crtFace.userData.noInk = true;
  add(glow(0x5fe39a, 1.4, 0.35), B.x - 0.6, 1.6, B.z + 0.6);
  add(tbox(0.5, 0.3, 0.4, "metal", 1), B.x + 1.0, 1.29, B.z + 0.1); // vise
  add(tbox(0.3, 0.12, 0.6, "metal", 1), B.x + 1.0, 1.5, B.z + 0.1);
  for (const [x, c] of [[0.3, 0xc9332a], [0.55, 0xffd23f]]) { // paint cans
    const can = add(ink.inkify(new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, 0.26, 10)), { color: c }), B.x + x, 1.27, B.z + 0.35);
    can.userData.x = x;
  }
  const peg = add(new THREE.Mesh(new THREE.PlaneGeometry(3.4, 1.7)), B.x, 2.9, -4.98);
  ink.inkify(peg, { material: toon(TEX.pegboard, { alphaTest: 0 }) });
  peg.material.map.wrapS = peg.material.map.wrapT = THREE.ClampToEdgeWrapping;

  /* ---------- neon sign ---------- */
  add(tbox(4.6, 1.25, 0.12, "metal", 1.3), 0.3, 5.0, -4.95);
  const neonTex = drawn(512, 128, (g) => {
    g.font = '86px "Bangers", Impact, sans-serif'; g.textAlign = "center"; g.textBaseline = "middle";
    g.shadowColor = "#ff4fa0"; g.shadowBlur = 18; g.lineWidth = 6; g.strokeStyle = "#ff7ab8";
    g.strokeText("WORKSHOP", 256, 68); g.shadowBlur = 0; g.lineWidth = 2.5; g.strokeStyle = "#fff0f8"; g.strokeText("WORKSHOP", 256, 68);
  }, false);
  add(unlit(new THREE.PlaneGeometry(4.2, 1.05), 0xffffff, { map: neonTex, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false }), 0.3, 5.0, -4.87);
  const neonGlow = add(glow(0xff4fa0, 5.0, 0.35), 0.3, 5.0, -4.8);

  /* ---------- shelves, barrels, crates, poster ---------- */
  const S = new THREE.Vector3(7.2, 0, -3.6);
  for (const [x, z] of [[-1, -0.45], [1, -0.45], [-1, 0.45], [1, 0.45]]) add(tbox(0.12, 4.2, 0.12, "metal", 1), S.x + x, 2.1, S.z + z);
  for (const y of [0.5, 1.7, 2.9, 4.0]) add(tbox(2.2, 0.08, 1.0, "metal", 1), S.x, y, S.z);
  for (const [x, y, s] of [[-0.5, 0.54, 0.5], [0.4, 0.54, 0.6], [-0.3, 1.74, 0.45], [0.5, 2.94, 0.5]]) add(tbox(s, s, s, "darkwood", 1), S.x + x, y + s / 2, S.z);
  const barrel = (x, z) => add(ink.inkify(new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.42, 1.1, 14)), { material: toon(TEX.barrel) }), x, 0.55, z);
  barrel(6.4, 1.2); barrel(7.3, 2.0); barrel(-7.4, 1.6);
  add(tbox(0.9, 0.9, 0.9, "darkwood", 1), -6.6, 0.45, 2.6).rotation.y = 0.3;
  add(tbox(0.7, 0.7, 0.7, "darkwood", 1), -6.7, 1.25, 2.55).rotation.y = -0.2;
  const posterMat = new THREE.MeshBasicMaterial({ toneMapped: false });
  const poster = add(new THREE.Mesh(new THREE.PlaneGeometry(1.3, 1.8), posterMat), -2.75, 3.1, -4.98);
  ink.inkify(poster, { material: posterMat });
  poster.rotation.z = -0.04;
  // floor cable from the turntable to the wall
  const cable = new THREE.CatmullRomCurve3([new THREE.Vector3(T.x + 1.2, 0.05, T.z - 0.6), new THREE.Vector3(2.4, 0.05, -2), new THREE.Vector3(3.6, 0.05, -4.9)]);
  scene.add(ink.inkify(new THREE.Mesh(new THREE.TubeGeometry(cable, 30, 0.05, 5)), { color: 0x1d1d22 }));

  /* ---------- avatar faces for the CRT + poster ---------- */
  const faces = {};
  const tl = new THREE.TextureLoader();
  for (const n of ["not_talking", "talking", "smug", "evil"]) {
    faces[n] = tl.load(`avatar/${n}.png`, (t) => { t.colorSpace = THREE.SRGBColorSpace; if (n === "not_talking") { crtMat.map = t; crtMat.visible = true; crtMat.needsUpdate = true; } });
  }
  const face = new Image();
  face.onload = () => {
    posterMat.map = drawn(180, 250, (g) => {
      g.fillStyle = "#efe2c0"; g.fillRect(0, 0, 180, 250);
      g.fillStyle = "#c9332a"; g.fillRect(0, 0, 180, 46);
      g.font = '34px "Bangers", Impact, sans-serif'; g.textAlign = "center"; g.fillStyle = "#fff4dc"; g.fillText("CODY ART", 90, 34);
      g.drawImage(face, 46, 56, 88, 138);
      g.fillStyle = "#1a120c"; g.font = '17px "Saira Condensed", sans-serif'; g.fillText("Original character", 90, 220);
      g.strokeStyle = "#1a120c"; g.lineWidth = 5; g.strokeRect(2, 2, 176, 246);
    }, false);
    posterMat.needsUpdate = true;
  };
  face.src = "avatar/talking.png";

  /* ---------- models on the turntable ---------- */
  const TOP_Y = 0.44;
  const FLOAT_GROUPS = new Set(["Lighthouse hat", "Halloween wings", "Halloween horns"]); // worn items hover
  const holder = new THREE.Group();
  holder.position.set(T.x, TOP_Y, T.z);
  scene.add(holder);
  // hover field under floating items: a soft pulsing disc on the turntable
  const fieldTex = drawn(128, 128, (g) => {
    const gr = g.createRadialGradient(64, 64, 8, 64, 64, 64);
    gr.addColorStop(0, "rgba(160,240,255,0.9)"); gr.addColorStop(0.55, "rgba(95,212,255,0.35)"); gr.addColorStop(1, "rgba(95,212,255,0)");
    g.fillStyle = gr; g.fillRect(0, 0, 128, 128);
    g.strokeStyle = "rgba(200,250,255,0.8)"; g.lineWidth = 3;
    for (const r of [26, 44]) { g.beginPath(); g.arc(64, 64, r, 0, 7); g.stroke(); }
  }, false);
  const field = add(unlit(new THREE.CircleGeometry(1.15, 40), 0xffffff,
    { map: fieldTex, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false }), T.x, TOP_Y + 0.012, T.z);
  field.rotation.x = -Math.PI / 2;
  field.visible = false;
  // materialize flash when a model swaps in
  const flash = add(glow(0x9ff0ff, 3.2, 0), T.x, 1.6, T.z + 0.2);
  let floating = false, swapAt = -10;
  const STILL = new URLSearchParams(location.search).has("p"); // test frames: skip pop-in and easing
  const loader = new GLTFLoader();
  const cache = new Map();
  let mixer = null, spin = 0, autoSpin = true, loadToken = 0, current = -1, talkUntil = 0, time = 0;

  function prepare(gltf) {
    const root = gltf.scene;
    root.traverse((o) => { if (o.isMesh) ink.inkify(o, { map: o.material.map || null, color: o.material.color }); });
    const box = new THREE.Box3().setFromObject(root);
    const size = box.getSize(new THREE.Vector3()), center = box.getCenter(new THREE.Vector3());
    const s = 2.3 / Math.max(size.x, size.y, size.z);
    const wrap = new THREE.Group();
    root.position.set(-center.x, -box.min.y, -center.z);
    wrap.add(root);
    wrap.scale.setScalar(s);
    wrap.rotation.y = Math.PI; // models face -Z; turn them toward the camera
    let clip = null;
    if (gltf.animations.length) {
      const duration = Math.max(...gltf.animations.map((c) => c.duration));
      clip = new THREE.AnimationClip("all", duration, gltf.animations.flatMap((c) => c.tracks));
    }
    return { wrap, root, clip };
  }
  async function show(i) {
    const m = MODELS[i], token = ++loadToken;
    dom.status.hidden = false;
    try {
      if (!cache.has(m.id)) {
        let gltf = null;
        for (let attempt = 0; attempt < 3 && !gltf; attempt++) { // a few tries before giving up
          try { gltf = await loader.loadAsync(`models/${m.id}.glb?v=${MODEL_VERSION}`); }
          catch (err) { if (attempt === 2) throw err; await new Promise((r) => setTimeout(r, 400 * (attempt + 1))); }
        }
        cache.set(m.id, prepare(gltf));
      }
    } catch (e) { console.error(e); dom.status.textContent = "Asset failed to load"; return; }
    if (token !== loadToken) return;
    const entry = cache.get(m.id);
    holder.clear();
    holder.add(entry.wrap);
    floating = FLOAT_GROUPS.has(m.group);
    field.visible = floating;
    swapAt = STILL ? -10 : time; // drives the materialize scale-in + flash
    mixer = null;
    if (entry.clip) { mixer = new THREE.AnimationMixer(entry.root); mixer.clipAction(entry.clip).play(); }
    dom.status.hidden = true;
  }

  /* ---------- DOM: list, card, tabs ---------- */
  decorate(dom.listPanel);
  const items = [];
  let lastGroup = null;
  MODELS.forEach((m, i) => {
    if (m.group !== lastGroup) {
      const g = document.createElement("li");
      g.className = "bl-list__group"; g.textContent = m.group; g.setAttribute("role", "presentation");
      dom.list.append(g); lastGroup = m.group;
    }
    const li = document.createElement("li");
    li.setAttribute("role", "presentation");
    const b = document.createElement("button");
    b.className = "bl-list__item"; b.type = "button"; b.setAttribute("role", "option");
    b.innerHTML = `<span>${m.short}</span>${m.animated ? '<span class="bl-badge">Anim</span>' : ""}`;
    b.addEventListener("click", () => select(i));
    li.append(b); dom.list.append(li); items.push(b);
  });
  function select(i, { fromUser = true } = {}) {
    i = (i + MODELS.length) % MODELS.length;
    if (i === current) return;
    items[current]?.classList.remove("is-selected");
    items[current]?.setAttribute("aria-selected", "false");
    current = i;
    items[i].classList.add("is-selected");
    items[i].setAttribute("aria-selected", "true");
    items[i].scrollIntoView({ block: "nearest", inline: "nearest" });
    const m = MODELS[i];
    dom.card.style.setProperty("--r", RARITY[m.rarity].color);
    dom.cardPanel.innerHTML = modelCardHTML(m);
    dom.cardPanel.classList.remove("is-swapping"); void dom.cardPanel.offsetWidth; dom.cardPanel.classList.add("is-swapping");
    if (fromUser) talkUntil = time + 1.2;
    show(i);
  }

  /* ---------- camera ---------- */
  const shot = { pos: new THREE.Vector3(), target: new THREE.Vector3() };
  function fit() {
    const docked = isDocked();
    const f = docked ? { x0: -2.6, x1: 2.6, y0: -3.2, y1: 6.2 } : { x0: -8.4, x1: 8.4, y0: -0.6, y1: 6.6 };
    const w = f.x1 - f.x0, h = f.y1 - f.y0, t = Math.tan(THREE.MathUtils.degToRad(camera.fov / 2));
    const d = Math.max(h / 2 / t, w / 2 / (t * camera.aspect));
    shot.target.set((f.x0 + f.x1) / 2, (f.y0 + f.y1) / 2, T.z);
    // slight downward look; capped so tall windows don't put the camera (and the walk in) way up high
    shot.pos.set(shot.target.x, shot.target.y + Math.min(d * 0.1, 2.0), T.z + d);
  }
  const anchors = {
    list: new THREE.Vector3(-7.6, 5.5, 0.6),
    card: new THREE.Vector3(2.95, 4.6, 0.8),
    tabs: new THREE.Vector3(0, 6.55, 0.4),
    status: new THREE.Vector3(T.x, 1.6, T.z + 0.6),
  };
  const v = new THREE.Vector3();
  function toScreen(p, w, h) { v.copy(p).project(camera); return [((v.x + 1) / 2) * w, ((1 - v.y) / 2) * h]; }

  // drag to spin the turntable
  let dragging = false, lastX = 0;
  host.addEventListener("pointerdown", (e) => { if (!api.active) return; dragging = true; lastX = e.clientX; });
  window.addEventListener("pointermove", (e) => { if (!dragging) return; spin += (e.clientX - lastX) * 0.01; lastX = e.clientX; });
  window.addEventListener("pointerup", () => (dragging = false));

  const api = {
    scene, camera, active: false, shot, DOOR_Z, T,
    select,
    next: () => select(current + 1),
    prev: () => select(current - 1),
    toggleSpin: () => (autoSpin = !autoSpin),
    resize(w, h) { camera.aspect = w / h; camera.updateProjectionMatrix(); fit(); },
    /** Animations only; the camera is driven from outside (hero.js) so the doorway lines up. */
    update(dt, t, motion) {
      time = t;
      if (autoSpin && !dragging) spin += dt * 0.5 * motion;
      holder.rotation.y = spin;
      // hats, wings and horns hover above the turntable with a slow bob
      const lift = floating ? 0.5 + Math.sin(t * 1.6) * 0.07 * motion : 0;
      holder.position.y = STILL ? TOP_Y + lift : THREE.MathUtils.lerp(holder.position.y, TOP_Y + lift, 0.12);
      if (floating) field.material.opacity = 0.55 + Math.sin(t * 1.6) * 0.2 * motion;
      // materialize: quick scale-in with a little overshoot and a cyan flash
      const k = clamp01((t - swapAt) / 0.4);
      const pop = k >= 1 ? 1 : 1 + Math.sin(k * Math.PI) * 0.12 - (1 - k) * (1 - k) * 0.9;
      holder.scale.setScalar(Math.max(0.05, pop));
      flash.material.opacity = (1 - k) * 0.9 * motion;
      mixer?.update(dt);
      ring.material.opacity = 0.65 + Math.sin(t * 3) * 0.25 * motion;
      neonGlow.material.opacity = Math.random() < 0.02 * motion ? 0.1 : 0.35; // a flickery neon
      const talking = t < talkUntil;
      const want = talking ? (Math.floor(t * 9) % 2 ? faces.talking : faces.not_talking) : faces.not_talking;
      if (want?.image && crtMat.map !== want) { crtMat.map = want; crtMat.needsUpdate = true; }
    },
    render(target = null) {
      // fog + ink fade track the camera's distance, so the room reads the same from the doorway and the shot
      const dist = camera.position.distanceTo(T);
      scene.fog.near = dist + 2; scene.fog.far = dist + 20;
      ink.setFade(dist + 14, dist + 44);
      ink.render(scene, camera, key.position, target);
    },
    placeUI() {
      const w = host.clientWidth, h = host.clientHeight;
      dom.status.style.transform = `translate(${toScreen(anchors.status, w, h).map((n, k) => (n - (k ? 0 : dom.status.offsetWidth / 2)).toFixed(1)).join("px,")}px)`;
      if (isDocked()) { dom.listPanel.style.transform = ""; dom.card.style.transform = ""; dom.tabs.style.transform = ""; return; }
      const [lx, ly] = toScreen(anchors.list, w, h);
      dom.listPanel.style.transform = `translate(${lx.toFixed(1)}px, ${ly.toFixed(1)}px)`;
      const [cx, cy] = toScreen(anchors.card, w, h);
      dom.card.style.transform = `translate(${cx.toFixed(1)}px, ${cy.toFixed(1)}px)`;
      const [tx, ty] = toScreen(anchors.tabs, w, h);
      dom.tabs.style.transform = `translate(${(tx - dom.tabs.offsetWidth / 2).toFixed(1)}px, ${(ty - dom.tabs.offsetHeight).toFixed(1)}px)`;
    },
  };
  const wanted = MODELS.findIndex((m) => m.id === new URLSearchParams(location.search).get("m"));
  select(wanted >= 0 ? wanted : 0, { fromUser: false });
  return api;
}
