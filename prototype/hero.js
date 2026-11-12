// Hero: Cody's hand-drawn avatar in an armchair beside a physical item cabinet, in a voxel
// badlands (Minecraft) drawn with ink + hatching (Borderlands). The holo menu (tabs, loot card,
// projector beam) is pinned to 3D points every frame, so the menu lives inside the scene.
import * as THREE from "three";
import { Ink } from "./ink.js";
import { createKit } from "./voxkit.js";
import { buildScenery, SHACK } from "./scenery.js";
import { createShop } from "./shop.js";
import { buildAvatar } from "./avatar.js";
import { ITEMS, RARITY, spriteGeometry, cardHTML } from "./items.js";

const params = new URLSearchParams(location.search);
const START = Math.max(0, ITEMS.findIndex((i) => i.id === params.get("item")));
const REDUCED = matchMedia("(prefers-reduced-motion: reduce)").matches;
const isDocked = () => matchMedia("(max-width: 860px)").matches;
// ?p=0..1 pins the scroll transition at one point (test frames) instead of reading the scroll
const FORCE_P = params.has("p") ? Math.max(0, Math.min(1, Number(params.get("p")) || 0)) : null;

/* ---------------------------------------------------------------- renderer */
const heroEl = document.getElementById("hero");
const host = document.getElementById("world");
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, matchMedia("(pointer: coarse)").matches ? 1.5 : 2));
host.append(renderer.domElement);
const ink = new Ink(renderer, { thickness: 1.8, fadeNear: 22, fadeFar: 52 });
const kit = createKit(ink);
const { pbox, decal, glowSprite, unlit, canvasTexture } = kit;

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(32, 1, 0.1, 220);

/* --------------------------------------------------------------- sky + light */
scene.background = canvasTexture(4, 256, (g) => {
  const grad = g.createLinearGradient(0, 0, 0, 256);
  grad.addColorStop(0, "#14234a");
  grad.addColorStop(0.35, "#43407e");
  grad.addColorStop(0.6, "#b9607c");
  grad.addColorStop(0.78, "#f0935f");
  grad.addColorStop(1, "#f6c37c");
  g.fillStyle = grad;
  g.fillRect(0, 0, 4, 256);
});
scene.fog = new THREE.Fog(0xe8956c, 26, 78);
scene.add(new THREE.HemisphereLight(0xffdcc4, 0x5a2f2a, 1.25));
// low dusk sun from the front-left: right-hand faces fall into hatched shadow
const sun = new THREE.DirectionalLight(0xffe2b8, 2.6);
sun.position.set(-6, 8, 7);
scene.add(sun);

const sunDisc = unlit(new THREE.PlaneGeometry(5, 5), 0xffe8a8, { fog: false });
sunDisc.position.set(30, 13, -78);
scene.add(sunDisc);
const sunHalo = glowSprite(0xffa060, 26, 0.6);
sunHalo.position.set(30, 13, -79);
scene.add(sunHalo);
const clouds = [];
for (let i = 0; i < 9; i++) {
  const r = Math.sin(i * 91.7) * 0.5 + 0.5, q = Math.sin(i * 37.3) * 0.5 + 0.5;
  const c = unlit(new THREE.BoxGeometry(5 + r * 7, 0.9, 3 + q * 4), 0xffe2d4, { transparent: true, opacity: 0.9 });
  c.position.set(-50 + ((i * 23) % 100), 15 + q * 4, -32 - r * 26);
  scene.add(c);
  clouds.push(c);
}

const scenery = buildScenery(scene, kit, ink);

/* ------------------------------------------------------------- item cabinet */
const CAB = { w: 3.2, h: 3.2, d: 1.2, x: 0, z: 0 };
const INNER_H = CAB.h - 0.6;
const CELL_H = INNER_H / 3;
const FRONT = CAB.d / 2;
const cabinet = new THREE.Group();
cabinet.position.set(CAB.x, 0, CAB.z);
scene.add(cabinet);
const cadd = (m, x, y, z) => { m.position.set(x, y, z); cabinet.add(m); return m; };
let beacon = null;
{
  cadd(pbox(CAB.w, 0.3, CAB.d, "metal"), 0, 0.15, 0);
  cadd(pbox(CAB.w, 0.3, CAB.d, "metal"), 0, CAB.h - 0.15, 0);
  cadd(pbox(0.3, INNER_H, CAB.d, "metal"), -(CAB.w / 2 - 0.15), CAB.h / 2, 0);
  cadd(pbox(0.3, INNER_H, CAB.d, "metal"), CAB.w / 2 - 0.15, CAB.h / 2, 0);
  cadd(pbox(CAB.w - 0.6, INNER_H, 0.15, "metalDark"), 0, CAB.h / 2, -FRONT + 0.075);
  cadd(pbox(0.1, INNER_H, CAB.d - 0.3, "metal"), 0, CAB.h / 2, -0.1);
  for (const k of [1, 2]) cadd(pbox(CAB.w - 0.6, 0.08, CAB.d - 0.25, "metal"), 0, 0.3 + CELL_H * k, -0.05);
  cadd(pbox(CAB.w, 0.16, 0.06, "hazard", 0.32), 0, 0.38, FRONT + 0.03);
  // rusty trim on every front edge, the scuffed-up look
  for (const s of [-1, 1]) cadd(pbox(0.09, CAB.h, 0.09, "rust"), s * (CAB.w / 2 - 0.03), CAB.h / 2, FRONT - 0.03);
  cadd(pbox(CAB.w, 0.09, 0.09, "rust"), 0, CAB.h - 0.03, FRONT - 0.03);
  // sign posts, board, bolts and a spinning beacon
  for (const x of [-1.1, 1.1]) cadd(pbox(0.14, 0.32, 0.14, "metal"), x, CAB.h + 0.16, 0);
  cadd(pbox(CAB.w + 0.3, 0.78, 0.16, "metal"), 0, CAB.h + 0.7, 0);
  for (const [x, y] of [[-1.66, 0.36], [1.66, 0.36], [-1.66, -0.3], [1.66, -0.3]]) cadd(pbox(0.08, 0.08, 0.05, "rust"), x, CAB.h + 0.7 + y, 0.1);
  cadd(pbox(0.22, 0.2, 0.22, "metal"), 1.5, CAB.h + 1.19, 0);
  cadd(unlit(new THREE.BoxGeometry(0.16, 0.16, 0.16), 0xff8a2a), 1.5, CAB.h + 1.37, 0);
  beacon = cadd(glowSprite(0xff8a2a, 1.4, 0.8), 1.5, CAB.h + 1.37, 0.05);
  // interior light strip + holo emitter on the right pillar
  cadd(unlit(new THREE.BoxGeometry(CAB.w - 0.7, 0.05, 0.05), 0x9ff0ff), 0, CAB.h - 0.33, FRONT - 0.15);
  cadd(unlit(new THREE.BoxGeometry(0.12, 0.34, 0.04), 0x9ff0ff), CAB.w / 2 - 0.15, 2.45, FRONT + 0.02);
  cadd(glowSprite(0x5fd4ff, 0.9, 0.7), CAB.w / 2 - 0.15, 2.45, FRONT + 0.07);

  // keypad under the emitter
  const keypad = canvasTexture(16, 24, (g) => {
    g.fillStyle = "#151a21"; g.fillRect(0, 0, 16, 24);
    g.fillStyle = "#3bd16f"; g.fillRect(2, 2, 12, 4);
    for (let r = 0; r < 4; r++) for (let c = 0; c < 3; c++) {
      g.fillStyle = r === 3 && c === 2 ? "#ff5a4a" : "#9aa8ba";
      g.fillRect(2 + c * 4, 8 + r * 4, 3, 3);
    }
  });
  cadd(decal(keypad, 0.22, 0.33), CAB.w / 2 - 0.15, 1.85, FRONT + 0.006);
  // stickers and spray-paint on the left pillar
  const star = canvasTexture(32, 32, (g) => {
    g.translate(16, 16); g.beginPath();
    for (let i = 0; i < 10; i++) { const a = (i * Math.PI) / 5 - Math.PI / 2, r = i % 2 ? 6 : 14; g.lineTo(Math.cos(a) * r, Math.sin(a) * r); }
    g.closePath(); g.fillStyle = "#ffd23f"; g.fill(); g.lineWidth = 3; g.strokeStyle = "#05080c"; g.stroke();
  });
  cadd(decal(star, 0.3, 0.3), -(CAB.w / 2 - 0.15), 2.35, FRONT + 0.006).rotation.z = 0.3;
  const smiley = canvasTexture(32, 32, (g) => {
    g.strokeStyle = "#5fe35f"; g.lineWidth = 3; g.beginPath(); g.arc(16, 16, 12, 0, Math.PI * 2); g.stroke();
    g.fillStyle = "#5fe35f"; g.fillRect(11, 11, 3, 4); g.fillRect(18, 11, 3, 4);
    g.beginPath(); g.arc(16, 17, 7, 0.2, Math.PI - 0.2); g.stroke();
    g.fillRect(14, 29, 2, 3); // drip
  });
  cadd(decal(smiley, 0.3, 0.3), -(CAB.w / 2 - 0.15), 1.25, FRONT + 0.006).rotation.z = -0.2;
  // "featured" sash across the top-left corner
  const sash = canvasTexture(160, 28, (g) => {
    g.fillStyle = "#05080c"; g.fillRect(0, 0, 160, 28);
    g.fillStyle = "#ffd23f"; g.fillRect(0, 3, 160, 22);
    g.font = '22px "Bangers", Impact, sans-serif'; g.textAlign = "center"; g.textBaseline = "middle";
    g.fillStyle = "#05080c"; g.fillText("★ FEATURED ★", 80, 15);
  });
  const sashMesh = cadd(decal(sash, 1.3, 0.23), -1.18, CAB.h - 0.42, FRONT + 0.05);
  sashMesh.rotation.z = 0.62;
}
const EMITTER = new THREE.Vector3(CAB.x + CAB.w / 2 - 0.15, 2.45, CAB.z + FRONT + 0.05);
{
  const sh = unlit(new THREE.CircleGeometry(0.5, 32), 0x1a0d08, { transparent: true, opacity: 0.38, depthWrite: false });
  sh.rotation.x = -Math.PI / 2; sh.scale.set(4.4, 2.0, 1); sh.position.set(CAB.x, 0.015, CAB.z + 0.1);
  scene.add(sh);
}

async function signTexture() {
  try { await Promise.race([document.fonts.load('40px "Bangers"'), new Promise((r) => setTimeout(r, 1500))]); } catch { /* fall back */ }
  return canvasTexture(256, 60, (g) => {
    g.fillStyle = "#151a21"; g.fillRect(0, 0, 256, 60);
    g.fillStyle = "#ffd23f"; g.fillRect(3, 3, 250, 54);
    g.fillStyle = "#151a21"; g.fillRect(7, 7, 242, 46);
    g.fillStyle = "#ffd23f";
    for (const x of [18, 238]) { g.fillRect(x - 1, 22, 3, 15); g.fillRect(x - 7, 28, 15, 3); } // sparkle marks
    g.font = '38px "Bangers", Impact, sans-serif';
    g.textAlign = "center"; g.textBaseline = "middle"; g.lineJoin = "round";
    g.lineWidth = 7; g.strokeStyle = "#05080c"; g.strokeText("CODY'S LOADOUT", 128, 32);
    g.fillStyle = "#ffd23f"; g.fillText("CODY'S LOADOUT", 128, 32);
  });
}
const sign = cadd(new THREE.Mesh(new THREE.PlaneGeometry(CAB.w + 0.1, 0.7)), 0, CAB.h + 0.7, 0.085);
signTexture().then((t) => ink.inkify(sign, { map: t, alphaTest: 0 }));

// skill items on the shelves
const items = ITEMS.map((it, i) => {
  const col = i % 2, row = Math.floor(i / 2); // row 0 = top shelf
  const holder = new THREE.Group();
  holder.position.set(col === 0 ? -0.675 : 0.675, 0.3 + CELL_H * (2 - row + 0.5), 0.12);
  const mesh = ink.inkify(new THREE.Mesh(spriteGeometry(it.sprite)), { vertexColors: true });
  holder.add(mesh);
  const glow = glowSprite(RARITY[it.rarity].color, 1.1, 0.35);
  glow.position.set(0, 0, -0.3);
  holder.add(glow);
  const hit = new THREE.Mesh(new THREE.BoxGeometry(1.2, CELL_H * 0.95, 1.0), new THREE.MeshBasicMaterial({ visible: false }));
  hit.userData = { noInk: true, index: i };
  holder.add(hit);
  cabinet.add(holder);
  return { holder, mesh, glow, hit, phase: i * 1.7 };
});

// selection frame around the chosen shelf slot
const frameGroup = new THREE.Group();
frameGroup.userData.noInk = true;
const frameMat = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.95, blending: THREE.AdditiveBlending, depthWrite: false });
const fillMat = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.1, blending: THREE.AdditiveBlending, depthWrite: false });
{
  const fw = 1.18, fh = CELL_H * 0.9, t = 0.04;
  for (const [w, h, x, y] of [[fw, t, 0, fh / 2], [fw, t, 0, -fh / 2], [t, fh, -fw / 2, 0], [t, fh, fw / 2, 0]]) {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), frameMat);
    m.position.set(x, y, 0);
    frameGroup.add(m);
  }
  frameGroup.add(new THREE.Mesh(new THREE.PlaneGeometry(fw, fh), fillMat));
}
frameGroup.position.z = FRONT - 0.02;
cabinet.add(frameGroup);

// lamp post beside the chair
{
  const post = pbox(0.16, 1.4, 0.16, "plank");
  post.position.set(-5.2, 0.7, -0.4);
  scene.add(post);
  const lamp = pbox(0.4, 0.4, 0.4, "metal");
  lamp.position.set(-5.2, 1.55, -0.4);
  scene.add(lamp);
  const bulb = unlit(new THREE.BoxGeometry(0.42, 0.22, 0.42), 0xffd98a);
  bulb.position.set(-5.2, 1.52, -0.4);
  scene.add(bulb);
  const lg = glowSprite(0xffb050, 2.4, 0.6);
  lg.position.set(-5.2, 1.52, -0.2);
  scene.add(lg);
  const pl = new THREE.PointLight(0xffb36b, 6, 6, 1.6);
  pl.position.set(-4.8, 1.6, 0.4);
  scene.add(pl);
}

/* ----------------------------------------------------------------- avatar */
let avatar = null;
const AVATAR_POS = new THREE.Vector3(-2.75, 0, 1.45);

/* ------------------------------------------------------ holo card + tabs */
const cardEl = document.getElementById("holoCard");
const panelEl = document.getElementById("cardPanel");
const countEl = document.getElementById("itemCount");
const tabsEl = document.getElementById("holoTabs");
const beamPoly = document.getElementById("beamPoly");
const CARD_ANCHOR = new THREE.Vector3(CAB.x + CAB.w / 2 + 0.45, 3.15, CAB.z + 0.45);
const TABS_ANCHOR = new THREE.Vector3(CAB.x, CAB.h + 1.32, CAB.z + 0.2);

document.getElementById("srItems").innerHTML = ITEMS
  .map((it) => `<li>${it.name}: ${it.tool}, ${it.kind}. ${it.stats.map(([k, v]) => `${k}: ${v}`).join("; ")}.</li>`)
  .join("");

let current = -1;
function select(i, { fromUser = true } = {}) {
  i = (i + ITEMS.length) % ITEMS.length;
  if (i === current) return;
  current = i;
  const it = ITEMS[i];
  const color = RARITY[it.rarity].color;
  cardEl.style.setProperty("--r", color);
  panelEl.innerHTML = cardHTML(it);
  panelEl.classList.remove("is-swapping");
  void panelEl.offsetWidth;
  panelEl.classList.add("is-swapping");
  countEl.textContent = `${i + 1} / ${ITEMS.length}`;
  frameMat.color.set(color);
  fillMat.color.set(color);
  frameGroup.position.x = items[i].holder.position.x;
  frameGroup.position.y = items[i].holder.position.y;
  items.forEach((o, k) => (o.glow.material.opacity = k === i ? 0.95 : 0.3));
  if (fromUser) avatar?.talk(); // Cody "narrates" each pick
}

const tmpV = new THREE.Vector3();
function toScreen(v, w, h) {
  tmpV.copy(v).project(camera);
  return { x: ((tmpV.x + 1) / 2) * w, y: ((1 - tmpV.y) / 2) * h };
}
function placeHolo() {
  if (isDocked()) { beamPoly.setAttribute("points", "0,0 0,0 0,0"); return; }
  const w = host.clientWidth, h = host.clientHeight;
  const c = toScreen(CARD_ANCHOR, w, h);
  cardEl.style.transform = `translate(${c.x.toFixed(1)}px, ${c.y.toFixed(1)}px)`;
  const t = toScreen(TABS_ANCHOR, w, h);
  tabsEl.style.transform = `translate(${(t.x - tabsEl.offsetWidth / 2).toFixed(1)}px, ${(t.y - tabsEl.offsetHeight).toFixed(1)}px)`;
  const e = toScreen(EMITTER, w, h);
  const r = panelEl.getBoundingClientRect(), base = heroEl.getBoundingClientRect();
  const x = r.left - base.left + 3, y0 = r.top - base.top + 10, y1 = r.bottom - base.top - 10;
  beamPoly.setAttribute("points", `${e.x.toFixed(1)},${(e.y - 6).toFixed(1)} ${e.x.toFixed(1)},${(e.y + 6).toFixed(1)} ${x.toFixed(1)},${y1.toFixed(1)} ${x.toFixed(1)},${y0.toFixed(1)}`);
}

/* ----------------------------------------------------------------- workshop */
const $ = (id) => document.getElementById(id);
const shop = createShop({
  renderer, ink, host, isDocked,
  dom: { list: $("shopList"), listPanel: $("shopListPanel"), card: $("shopCard"), cardPanel: $("shopCardPanel"), tabs: $("shopTabs"), status: $("shopStatus") },
});

/* ----------------------------------------------------------------- camera */
const FRAME_WIDE = { x0: -6.8, x1: 5.6, y0: -0.7, y1: 5.0 };
const FRAME_DOCKED = { x0: -4.55, x1: 2.0, y0: -6.6, y1: 6.9 }; // centred low: the scene sits above the docked card
const camBase = { pos: new THREE.Vector3(), target: new THREE.Vector3() };
function fitCamera() {
  const f = isDocked() ? FRAME_DOCKED : FRAME_WIDE;
  const w = f.x1 - f.x0, h = f.y1 - f.y0;
  const t = Math.tan(THREE.MathUtils.degToRad(camera.fov / 2));
  const d = Math.max(h / 2 / t, w / 2 / (t * camera.aspect));
  camBase.target.set((f.x0 + f.x1) / 2, (f.y0 + f.y1) / 2, 0);
  camBase.pos.set(camBase.target.x, camBase.target.y + d * 0.12, d);
}
function resize() {
  const w = Math.max(1, host.clientWidth), h = Math.max(1, host.clientHeight);
  renderer.setSize(w, h, false);
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
  ink.setSize(w, h);
  fitCamera();
  shop?.resize(w, h);
  if (shop) {
    const size = renderer.getDrawingBufferSize(new THREE.Vector2());
    portalRT.setSize(size.x, size.y);
    portalMat.uniforms.uRes.value.copy(size);
    // the camera comes in far enough before the settled shot that its climb to the shot's height
    // stays a gentle slope (tall windows put the shot high)
    D_S.z = shop.shot.pos.z + Math.max(4.5, 2.6 * (shop.shot.pos.y - 3.1));
    buildFlight();
  }
}

/* ------------------------------------------------------------------ input */
const pointer = { x: 0, y: 0, active: false };
const raycaster = new THREE.Raycaster();
const ndc = new THREE.Vector2();
function rayAt(clientX, clientY) {
  const r = host.getBoundingClientRect();
  ndc.set(((clientX - r.left) / r.width) * 2 - 1, -((clientY - r.top) / r.height) * 2 + 1);
  raycaster.setFromCamera(ndc, camera);
}
function pickItem() {
  const hit = raycaster.intersectObjects(items.map((o) => o.hit), false)[0];
  return hit ? hit.object.userData.index : -1;
}
const overAvatar = () => !!avatar && raycaster.intersectObject(avatar.mesh, false).length > 0;
let heroActive = true;
heroEl.addEventListener("pointermove", (e) => {
  if (!heroActive) { host.style.cursor = shop.active ? "grab" : ""; return; }
  const r = host.getBoundingClientRect();
  pointer.x = ((e.clientX - r.left) / r.width) * 2 - 1;
  pointer.y = -(((e.clientY - r.top) / r.height) * 2 - 1);
  pointer.active = true;
  if (e.target.closest(".holo-card, .hero__title, .hints, .holo-tabs")) { avatar?.setHover(false); return; }
  rayAt(e.clientX, e.clientY);
  const i = pickItem();
  const onAvatar = i < 0 && overAvatar();
  avatar?.setHover(onAvatar);
  host.style.cursor = i >= 0 || onAvatar ? "pointer" : "";
  if (i >= 0 && e.pointerType === "mouse") select(i);
});
host.addEventListener("pointerdown", (e) => {
  if (!heroActive) return;
  rayAt(e.clientX, e.clientY);
  const i = pickItem();
  if (i >= 0) select(i);
  else if (overAvatar()) avatar.emote();
});
document.getElementById("prevItem").addEventListener("click", () => select(current - 1));
document.getElementById("nextItem").addEventListener("click", () => select(current + 1));
document.getElementById("emoteBtn").addEventListener("click", () => avatar?.emote());
const goto = (id) => startGlide(id === "workshop" ? 1 : 0);
window.addEventListener("keydown", (e) => {
  if (e.target.closest && e.target.closest("input, textarea")) return;
  if (heroActive) {
    if (e.key === "ArrowRight") { e.preventDefault(); select(current + 1); }
    else if (e.key === "ArrowLeft") { e.preventDefault(); select(current - 1); }
    else if (e.key === "e" || e.key === "E") avatar?.emote();
    else if (e.key === "Enter" && e.target === document.body) goto("workshop");
  } else if (shop.active) {
    if (e.key === "ArrowDown" || e.key === "ArrowRight") { e.preventDefault(); shop.next(); }
    else if (e.key === "ArrowUp" || e.key === "ArrowLeft") { e.preventDefault(); shop.prev(); }
    else if (e.key === " " && e.target === document.body) { e.preventDefault(); shop.toggleSpin(); }
  }
});
let toastTimer;
document.querySelectorAll("[data-soon]").forEach((b) => b.addEventListener("click", () => {
  const t = $("toast"); t.textContent = `${b.title}: coming soon`; t.hidden = false;
  clearTimeout(toastTimer); toastTimer = setTimeout(() => (t.hidden = true), 1800);
}));

/* ------------------------------- scroll: one camera path, through the shack door into the workshop */
const clamp01 = (v) => Math.max(0, Math.min(1, v));
const smooth = (a, b, x) => { const t = clamp01((x - a) / (b - a)); return t * t * (3 - 2 * t); };
const easeSine = (t) => (1 - Math.cos(Math.PI * t)) / 2; // zero speed at both ends, same feel in reverse
const UP = new THREE.Vector3(0, 1, 0);
const DOOR = new THREE.Vector3(-SHACK.w / 2 + 2.1, 1.1, SHACK.d / 2).applyAxisAngle(UP, SHACK.rot).add(new THREE.Vector3(SHACK.x, 0, SHACK.z));
const DOOR_N = new THREE.Vector3(0, 0, 1).applyAxisAngle(UP, SHACK.rot);
const along = (k, dy = 0) => DOOR.clone().addScaledVector(DOOR_N, k).add(new THREE.Vector3(0, dy, 0));
const LAMP_Z = -0.4; // the deck lamp the camera flies over; the door starts glowing after it

// Portal mapping, outdoor space -> workshop space. The shack's 1.2 x 2.2 door is the workshop's
// front door at 2.5x scale (bigger on the inside), so one camera can fly straight through.
const K = 2.5;
const D_S = new THREE.Vector3(0, 1.1 * K, 0); // z set on resize: just in front of the workshop shot
const Q_HS = new THREE.Quaternion().setFromAxisAngle(UP, -SHACK.rot);
const Q_SH = Q_HS.clone().invert();
const toShop = (v, out = new THREE.Vector3()) => out.copy(v).sub(DOOR).applyQuaternion(Q_HS).multiplyScalar(K).add(D_S);
const toHero = (v, out = new THREE.Vector3()) => out.copy(v).sub(D_S).multiplyScalar(1 / K).applyQuaternion(Q_SH).add(DOOR);

let flight = null;
const MID_WP = new THREE.Vector3(-3.2, 3.3, 5.2); // mid-flight point (smoothest of the candidates tested)
function buildFlight() { // arc-length curves, so speed only changes where the easing says
  const endPos = toHero(shop.shot.pos), endLook = toHero(shop.shot.target);
  const endDir = endLook.clone().sub(endPos).normalize();
  flight = {
    // level through the doorway (no dip-then-climb), easing up to the shot height inside
    path: new THREE.CatmullRomCurve3([camBase.pos.clone(), MID_WP.clone(), along(4.6, 0.55),
      along(1.6, 0.45), along(0, 0.5), endPos]),
    // the last gaze points sit on the final sight line, so the settle tilt is spread over the approach
    look: new THREE.CatmullRomCurve3([camBase.target.clone(), new THREE.Vector3(-5, 1.8, -3), along(-2, 0.45),
      endPos.clone().addScaledVector(endDir, 4), endLook]),
  };
  // fine arc-length tables: the default 200 steps leave one-frame speed blips
  for (const c of [flight.path, flight.look]) { c.arcLengthDivisions = 4000; c.updateArcLengths(); }
  // gaze table: the look curve, gaussian-smoothed over u (sigma 0.045) with odd-mirrored ends so the
  // first and last framings stay exact; looked up linearly at runtime
  const LN = 1000, R = 135, SIG = 45, raw = [];
  for (let i = 0; i <= LN; i++) raw.push(flight.look.getPointAt(i / LN, new THREE.Vector3()));
  const sample = (j) => (j < 0 ? raw[0].clone().multiplyScalar(2).sub(raw[-j])
    : j > LN ? raw[LN].clone().multiplyScalar(2).sub(raw[2 * LN - j]) : raw[j]);
  const wts = Array.from({ length: 2 * R + 1 }, (_, k) => Math.exp(-((k - R) ** 2) / (2 * SIG * SIG)));
  const wsum = wts.reduce((a, b) => a + b, 0);
  flight.gaze = raw.map((_, i) => {
    const acc = new THREE.Vector3();
    for (let k = -R; k <= R; k++) acc.addScaledVector(sample(i + k), wts[k + R]);
    return acc.multiplyScalar(1 / wsum);
  });
  // smoothing shifts the very ends slightly (enough to crop the cabinet on a narrow phone), so blend
  // the corrections back in near each end: exact framing at rest, same smoothness in between
  const e0 = raw[0].clone().sub(flight.gaze[0]), e1 = raw[LN].clone().sub(flight.gaze[LN]);
  flight.gaze.forEach((g, i) => {
    const u = i / LN;
    g.addScaledVector(e0, 1 - smooth(0, 0.2, u)).addScaledVector(e1, smooth(0.8, 1, u));
  });
}
const ptmp = new THREE.Vector3();
function pose(u, outPos, outLook, parallax = null) {
  flight.path.getPointAt(u, outPos);
  // gaze from the smoothed table: a pure function of u, so going out mirrors coming in exactly
  const g = flight.gaze, x = Math.min(1, Math.max(0, u)) * (g.length - 1), i0 = Math.floor(x), i1 = Math.min(g.length - 1, i0 + 1);
  outLook.lerpVectors(g[i0], g[i1], x - i0);
  if (parallax) outPos.addScaledVector(parallax, 1 - smooth(0, 0.06, u));
  return outPos.clone().sub(DOOR).dot(DOOR_N); // signed distance to the door plane (outside > 0)
}

// the doorway: shows the workshop (rendered from the mapped camera) once the camera passes the lamp
const portalRT = new THREE.WebGLRenderTarget(1, 1, { samples: 4 });
const portalMat = new THREE.ShaderMaterial({
  uniforms: { tPortal: { value: portalRT.texture }, uRes: { value: new THREE.Vector2(1, 1) }, uReveal: { value: 0 } },
  vertexShader: "void main() { gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }",
  fragmentShader: `uniform sampler2D tPortal; uniform vec2 uRes; uniform float uReveal;
    void main() {
      vec3 inside = texture2D(tPortal, gl_FragCoord.xy / uRes).rgb;
      gl_FragColor = vec4(mix(vec3(0.0067, 0.0042, 0.0030), inside, uReveal), 1.0);
      #include <colorspace_fragment>
    }`,
});
{
  const d = scenery.doorway;
  d.material = portalMat;
  d.userData.noInk = false; // draw the door frame's ink edge, nothing behind it
  d.userData.toon = portalMat;
  d.userData.inkNormal = ink.normalMaterial();
}
// warm light spilling out onto the sand: a decal, not a point light (toon shading would light the
// wall around the door too, even from behind, and leave a visible ring where the light's range ends)
const spill = new THREE.Mesh(new THREE.PlaneGeometry(1.7, 2.6), new THREE.MeshBasicMaterial({
  map: canvasTexture(64, 64, (g) => {
    const gr = g.createLinearGradient(0, 0, 0, 64);
    gr.addColorStop(0, "rgba(255,190,110,0.9)"); gr.addColorStop(1, "rgba(255,190,110,0)");
    g.fillStyle = gr; g.beginPath(); g.moveTo(18, 0); g.lineTo(46, 0); g.lineTo(62, 64); g.lineTo(2, 64); g.closePath(); g.fill();
  }),
  transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false,
}));
spill.userData.noInk = true;
spill.position.copy(along(1.3, -1.08));
spill.rotation.set(-Math.PI / 2, 0, SHACK.rot, "YXZ");
scene.add(spill);

function scrollProgress() {
  if (FORCE_P !== null) return FORCE_P;
  const max = document.documentElement.scrollHeight - window.innerHeight;
  return max > 0 ? clamp01(window.scrollY / max) : 0;
}
const ui = { hero: $("heroUI"), shop: $("shopUI"), zone: $("zoneTitle") };
function setLayer(el, op, interactive) {
  el.style.opacity = op.toFixed(3);
  el.style.visibility = op < 0.01 ? "hidden" : "visible";
  el.inert = !interactive;
}

// scroll intent: stop scrolling mid-journey and it glides on to the end you were heading for (both
// ways). The glide moves the spring's target at a steady pace, so the camera carries its current
// speed straight into it (no stop-and-restart); the scrollbar follows; any input hands control back.
const GLIDE_IDLE = 180, GLIDE_SPEED = 0.42; // ms of stillness before gliding; journey per second
let lastScrollY = window.scrollY, scrollDir = 0, lastScrollAt = 0;
let glide = null; // { end: 0 | 1, p }
window.addEventListener("scroll", () => {
  const y = window.scrollY;
  if (!glide && y !== lastScrollY) { scrollDir = Math.sign(y - lastScrollY); lastScrollAt = performance.now(); }
  lastScrollY = y;
}, { passive: true });
for (const ev of ["wheel", "touchstart", "pointerdown"]) window.addEventListener(ev, () => { glide = null; }, { passive: true });
const SCROLL_KEYS = new Set(["PageUp", "PageDown", "Home", "End", " ", "ArrowUp", "ArrowDown"]);
window.addEventListener("keydown", (e) => { if (SCROLL_KEYS.has(e.key)) glide = null; });
function scrollMax() { return Math.max(1, document.documentElement.scrollHeight - window.innerHeight); }
function startGlide(end) {
  if (FORCE_P !== null) return;
  if (REDUCED) { window.scrollTo({ top: end * scrollMax(), behavior: "instant" }); return; }
  glide = { end, p: clamp01(window.scrollY / scrollMax()) };
}

/* ------------------------------------------------------------------ loop */
const clock = new THREE.Clock();
const look = new THREE.Vector3(), parallax = new THREE.Vector3();
let time = 0, pS = scrollProgress(), pV = 0, prevSd = Infinity, lastZone = -10;
// critically damped spring from scroll position to journey progress: speed stays continuous even
// when a mouse wheel jumps the scroll in notches, and it behaves identically going in or out
const OMEGA = 9;
function springStep(s, v, target, dt) {
  for (let left = dt; left > 1e-6; left -= 1 / 240) {
    const h = Math.min(left, 1 / 240);
    v += (OMEGA * OMEGA * (target - s) - 2 * OMEGA * v) * h;
    s += v * h;
  }
  if (s < 0) { s = 0; v = Math.max(0, v); } else if (s > 1) { s = 1; v = Math.min(0, v); }
  if (Math.abs(target - s) < 1e-5 && Math.abs(v) < 1e-4) { s = target; v = 0; }
  return [s, v];
}

function frameState(dt) {
  let pT = scrollProgress();
  if (glide && dt) { // advance the glide target and keep the real scroll position in step with it
    glide.p += Math.sign(glide.end - glide.p) * Math.min(GLIDE_SPEED * dt, Math.abs(glide.end - glide.p));
    pT = glide.p;
    window.scrollTo({ top: pT * scrollMax(), behavior: "instant" });
    lastScrollY = window.scrollY;
    if (pT === glide.end) glide = null;
  }
  if (FORCE_P !== null || dt === null) { pS = pT; pV = 0; }
  else [pS, pV] = springStep(pS, pV, pT, dt);
  const motion = REDUCED ? 0 : 1;
  const u = motion ? easeSine(pS) : (pS < 0.5 ? 0 : 1);
  parallax.set(pointer.active ? pointer.x * 0.35 * motion : 0, pointer.active ? pointer.y * 0.18 * motion : 0, 0);
  const sd = pose(u, camera.position, look, parallax);
  camera.lookAt(look);
  camera.updateMatrixWorld();
  toShop(camera.position, shop.camera.position);
  shop.camera.quaternion.multiplyQuaternions(Q_HS, camera.quaternion);
  shop.camera.updateMatrixWorld();
  const inside = sd < 0.35; // the door fills the view here, so cutting to the room directly is invisible
  const reveal = inside ? 1 : smooth(LAMP_Z, LAMP_Z - 2.4, camera.position.z);
  return { pT, u, sd, inside, reveal, motion };
}

function tick() {
  renderFrame(Math.min(clock.getDelta(), 0.05));
  requestAnimationFrame(tick);
}
let lastMode = "";
function renderFrame(dt) {
  time += dt;
  const st = frameState(dt);
  const { motion } = st;
  heroActive = pS < 0.03;
  shop.active = pS > 0.97;

  if (FORCE_P === null && !glide && scrollDir && st.pT > 0.01 && st.pT < 0.99 && performance.now() - lastScrollAt > GLIDE_IDLE) {
    startGlide(scrollDir > 0 ? 1 : 0);
    scrollDir = 0;
  }

  // zone title, stamped once as you cross the threshold going in
  if (prevSd > 0 && st.sd <= 0 && time - lastZone > 3 && FORCE_P === null) {
    lastZone = time;
    ui.zone.classList.remove("is-stamped"); void ui.zone.offsetWidth; ui.zone.classList.add("is-stamped");
  }
  prevSd = st.sd;

  items.forEach((o, i) => {
    const sel = i === current;
    o.mesh.scale.setScalar(THREE.MathUtils.lerp(o.mesh.scale.x, sel ? 1.18 : 1, 0.15));
    if (sel) o.mesh.rotation.y += dt * 1.4 * motion;
    else o.mesh.rotation.y = THREE.MathUtils.lerp(o.mesh.rotation.y % (Math.PI * 2), Math.sin(time * 1.1 + o.phase) * 0.35 * motion, 0.08);
    o.mesh.position.y = Math.sin(time * 2 + o.phase) * 0.025 * motion;
  });
  frameMat.opacity = 0.75 + Math.sin(time * 5) * 0.2 * motion;
  beacon.material.opacity = 0.45 + Math.max(0, Math.sin(time * 6)) * 0.55;
  clouds.forEach((c, i) => { c.position.x += dt * (0.25 + i * 0.03) * motion; if (c.position.x > 60) c.position.x = -60; });
  scenery.update(dt, time, motion);
  avatar?.update(dt, time, camera, motion);
  if (st.reveal > 0.001) shop.update(dt, time, motion);

  lastMode = st.inside ? "shop" : st.reveal > 0.001 ? "hero+portal" : "hero";
  if (st.inside) {
    shop.render();
  } else {
    if (st.reveal > 0.001) shop.render(portalRT);
    portalMat.uniforms.uReveal.value = st.reveal;
    spill.material.opacity = st.reveal * 0.6;
    ink.setFade(22, 52);
    ink.render(scene, camera, sun.position);
  }

  // UI: outside menu fades as you leave the deck; workshop menu fades in as the camera settles
  const heroOp = 1 - smooth(0, 0.05, pS);
  setLayer(ui.hero, heroOp, heroActive);
  if (heroOp > 0.01) placeHolo();
  const shopOp = smooth(0.9, 0.985, pS);
  setLayer(ui.shop, shopOp, shop.active);
  if (shopOp > 0.01) shop.placeUI();
}

// debug hooks for frame-by-frame checks: pose at any progress, and the damping step
window.__flight = {
  at(p) {
    const u = easeSine(clamp01(p)), pos = new THREE.Vector3(), lk = new THREE.Vector3();
    const sd = pose(u, pos, lk);
    const dir = lk.clone().sub(pos).normalize();
    return { p, u, pos: pos.toArray(), dir: dir.toArray(), sd, inside: sd < 0.35, reveal: sd < 0.35 ? 1 : smooth(LAMP_Z, LAMP_Z - 2.4, pos.z) };
  },
  springStep,
  easeSine,
  GLIDE_IDLE, GLIDE_SPEED,
  tryWaypoint(x, y, z) { MID_WP.set(x, y, z); buildFlight(); },
  internals: () => ({ scene, renderer, camera, renderFrame, sunHalo, sunDisc }),
  // render one frame now and read it back (works even when rAF is throttled): mean colour + mode
  snap() {
    renderFrame(1 / 60);
    const c = document.createElement("canvas"); c.width = 64; c.height = 36;
    const g = c.getContext("2d"); g.drawImage(renderer.domElement, 0, 0, 64, 36);
    const d = g.getImageData(0, 0, 64, 36).data; let r = 0, gg = 0, b = 0;
    for (let i = 0; i < d.length; i += 4) { r += d[i]; gg += d[i + 1]; b += d[i + 2]; }
    const n = d.length / 4;
    return { mode: lastMode, mean: [r / n, gg / n, b / n].map(Math.round), cam: camera.position.toArray().map((v) => +v.toFixed(2)), shopCam: shop.camera.position.toArray().map((v) => +v.toFixed(2)) };
  },
};

new ResizeObserver(resize).observe(host);
resize();
document.querySelectorAll('a[href="#workshop"], a[href="#top"]').forEach((link) => link.addEventListener("click", (e) => {
  e.preventDefault();
  startGlide(link.getAttribute("href") === "#workshop" ? 1 : 0);
}));
select(START, { fromUser: false });
requestAnimationFrame(tick);
buildAvatar(scene, kit, ink, { position: AVATAR_POS, yaw: 0.3, height: 2.3 })
  .then((a) => {
    avatar = a;
    if (params.has("expr")) a.force(params.get("expr")); // ?expr=<name> holds one face, for screenshots
    document.getElementById("loading").hidden = true;
  })
  .catch((err) => {
    console.error(err);
    document.getElementById("loading").hidden = true; // never show visitors an error box; the scene still works
  });
