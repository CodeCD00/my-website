// Voxel toolkit for the hero: pixel-art tiles with hand-inked grime (Minecraft blocks,
// Borderlands surface detail), a block mesher, textured boxes, decals and glow sprites.
import * as THREE from "three";

export function rng(seed) {
  return () => {
    seed |= 0; seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
export function shade(hex, amt) {
  const n = parseInt(hex.slice(1), 16);
  const cl = (v) => Math.max(0, Math.min(255, v));
  const r = cl((n >> 16) + amt), g = cl(((n >> 8) & 255) + amt), b = cl((n & 255) + amt);
  return "#" + ((r << 16) | (g << 8) | b).toString(16).padStart(6, "0");
}
const pick = (r, list) => list[Math.floor(r() * list.length)];

// ---- tile painters (16×16 unless noted) --------------------------------------------
function speckle(g, r, base, specks, amount, w = 16, h = 16) {
  g.fillStyle = base;
  g.fillRect(0, 0, w, h);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    if (r() < amount) { g.fillStyle = pick(r, specks); g.fillRect(x, y, 1, 1); }
  }
}
function crack(g, r, color, x, y, len) { // a wandering inked crack
  g.fillStyle = color;
  for (let i = 0; i < len; i++) {
    g.fillRect(x, y, 1, 1);
    x += r() < 0.5 ? 1 : 0; y += r() < 0.6 ? 1 : -1;
    x = Math.max(0, Math.min(15, x)); y = Math.max(0, Math.min(15, y));
  }
}
function rivets(g, color, spots) { g.fillStyle = color; for (const [x, y] of spots) g.fillRect(x, y, 1, 1); }

const PAINTERS = {
  sand: (g, r) => {
    speckle(g, r, "#c46a3a", ["#b55e31", "#d27c48", "#a8532b", "#d98c56"], 0.45);
    if (r() < 0.7) crack(g, r, "#7a3418", Math.floor(r() * 10), Math.floor(r() * 8), 4 + Math.floor(r() * 4));
    g.fillStyle = "#e3a06a"; g.fillRect(Math.floor(r() * 16), Math.floor(r() * 16), 1, 1); // pebble glint
  },
  plank: (g, r) => {
    speckle(g, r, "#9c6b3c", ["#8d5f33", "#a8774a"], 0.25);
    g.fillStyle = "#4a2f16";
    for (const y of [3, 7, 11, 15]) g.fillRect(0, y, 16, 1);
    for (const [x, y] of [[5, 0], [12, 4], [2, 8], [9, 12]]) g.fillRect(x, y, 1, 3);
    rivets(g, "#c9b08a", [[1, 1], [14, 5], [3, 9], [11, 13]]);
  },
  metal: (g, r) => {
    speckle(g, r, "#3c4757", ["#36404e", "#424e5f", "#2f3844"], 0.35);
    for (let i = 0; i < 3; i++) { // rust blooms
      const x = Math.floor(r() * 14), y = Math.floor(r() * 14);
      g.fillStyle = "#8a4520"; g.fillRect(x, y, 2, 1); g.fillStyle = "#a85a2a"; g.fillRect(x + 1, y + 1, 1, 1);
    }
    g.fillStyle = "#7d8a9b"; g.fillRect(3, 9, 4, 1); g.fillRect(9, 4, 3, 1); // scratches
    g.fillStyle = "#11151b"; g.fillRect(0, 0, 16, 1); g.fillRect(0, 0, 1, 16); // inked panel seam
    g.fillStyle = "#5d6c80"; g.fillRect(1, 1, 14, 1);
    rivets(g, "#9aa8ba", [[2, 2], [13, 2], [2, 13], [13, 13]]);
  },
  metalDark: (g, r) => {
    speckle(g, r, "#1d232c", ["#232a34", "#181d24"], 0.3);
    g.fillStyle = "#2c3541";
    for (let y = 2; y < 16; y += 4) g.fillRect(0, y, 16, 1);
  },
  rust: (g, r) => {
    speckle(g, r, "#a4532a", ["#8a4520", "#c06a34", "#6e3519"], 0.5);
    g.fillStyle = "#3a1c0c";
    for (let i = 0; i < 3; i++) g.fillRect(Math.floor(r() * 16), 0, 1, 4 + Math.floor(r() * 10)); // drip streaks
  },
  corrugated: (g, r) => {
    for (let x = 0; x < 16; x++) {
      g.fillStyle = ["#9aa5b1", "#7d8894", "#5f6a76", "#7d8894"][x % 4];
      g.fillRect(x, 0, 1, 16);
    }
    for (let i = 0; i < 4; i++) { // rust runs from the top
      const x = Math.floor(r() * 16);
      g.fillStyle = "#9b4f25"; g.fillRect(x, 0, 1, 3 + Math.floor(r() * 8));
    }
    g.fillStyle = "#1a1f26"; g.fillRect(0, 15, 16, 1);
  },
  roof: (g, r) => {
    for (let x = 0; x < 16; x++) { g.fillStyle = ["#b8492e", "#93391f", "#6e2a17", "#93391f"][x % 4]; g.fillRect(x, 0, 1, 16); }
    for (let i = 0; i < 18; i++) { g.fillStyle = pick(r, ["#c9a34a", "#5a2212"]); g.fillRect(Math.floor(r() * 16), Math.floor(r() * 16), 1, 1); }
  },
  crate: (g, r) => {
    speckle(g, r, "#a87a45", ["#966a39", "#b88a55"], 0.3);
    g.fillStyle = "#4a2f16";
    g.fillRect(0, 0, 16, 2); g.fillRect(0, 14, 16, 2); g.fillRect(0, 0, 2, 16); g.fillRect(14, 0, 2, 16);
    for (let i = 2; i < 14; i++) g.fillRect(i, i, 1, 1); // diagonal brace
    g.fillStyle = "#1a1f26"; g.fillRect(9, 4, 4, 1); g.fillRect(9, 4, 1, 3); g.fillRect(9, 6, 4, 1); // stencil mark
  },
  barrel: (g, r) => {
    speckle(g, r, "#2f7f8c", ["#2a6f7a", "#3a919f"], 0.3);
    g.fillStyle = "#1a3a40"; g.fillRect(0, 2, 16, 2); g.fillRect(0, 12, 16, 2);
    g.fillStyle = "#ffd23f"; g.fillRect(6, 6, 4, 4); g.fillStyle = "#1a1f26"; g.fillRect(7, 7, 2, 2);
    g.fillStyle = "#8a4520"; g.fillRect(Math.floor(r() * 16), 9, 2, 1);
  },
  tire: (g, r) => {
    speckle(g, r, "#232323", ["#1a1a1a", "#2e2e2e"], 0.3);
    g.fillStyle = "#3a3a3a";
    for (let y = 0; y < 16; y += 3) for (let x = (y / 3) % 2 ? 0 : 2; x < 16; x += 4) g.fillRect(x, y, 2, 1);
  },
  fabric: (g, r) => {
    speckle(g, r, "#9a2a2a", ["#8a2222", "#a83434", "#7a1c1c"], 0.35);
    g.fillStyle = "#c9a35a"; g.fillRect(2, 2, 6, 5); // stitched patch
    g.fillStyle = "#1a1210";
    for (let i = 2; i < 8; i += 2) { g.fillRect(i, 1, 1, 1); g.fillRect(i, 7, 1, 1); }
    for (let i = 3; i < 7; i += 2) { g.fillRect(1, i, 1, 1); g.fillRect(8, i, 1, 1); }
    g.fillStyle = "#b9bec4"; for (let i = 0; i < 6; i++) { g.fillRect(9 + i, 9 + i, 2, 1); g.fillRect(14 - i, 9 + i, 2, 1); } // duct-tape X
  },
  hazard: (g) => {
    for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) {
      g.fillStyle = Math.floor((x + y) / 4) % 2 ? "#1a1f27" : "#ffd23f";
      g.fillRect(x, y, 1, 1);
    }
  },
  cactus: (g, r) => {
    g.fillStyle = "#3f8f3a"; g.fillRect(0, 0, 16, 16);
    g.fillStyle = "#2f6f2b";
    for (const x of [1, 5, 10, 14]) g.fillRect(x, 0, 1, 16);
    g.fillStyle = "#e8e3a8";
    for (let i = 0; i < 10; i++) g.fillRect(Math.floor(r() * 16), Math.floor(r() * 16), 1, 1);
  },
};
export const BANDS = ["#b8632f", "#d3a07a", "#8c4c2c", "#a3402a", "#c99a3c", "#9b6a4f", "#c97b45"];

export function createKit(ink) {
  function tile(seed, paint) {
    const c = document.createElement("canvas");
    c.width = c.height = 16;
    paint(c.getContext("2d"), rng(seed));
    const t = new THREE.CanvasTexture(c);
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    return t;
  }
  const TEX = {};
  let seed = 1;
  for (const [name, paint] of Object.entries(PAINTERS)) TEX[name] = tile(seed++, paint);
  BANDS.forEach((c, i) => {
    TEX["terra" + i] = tile(40 + i, (g, r) => {
      speckle(g, r, c, [shade(c, -14), shade(c, 10)], 0.35);
      g.fillStyle = shade(c, -45); g.fillRect(0, 15, 16, 1); // inked band edge
    });
  });

  function canvasTexture(w, h, draw) {
    const c = document.createElement("canvas");
    c.width = w; c.height = h;
    draw(c.getContext("2d"), c);
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    return t;
  }

  /** Box whose faces tile `tex` every `tileSize` units (BoxGeometry face order: ±x, ±y, ±z). */
  function pbox(w, h, d, tex, tileSize = 0.5) {
    const g = new THREE.BoxGeometry(w, h, d);
    const uv = g.attributes.uv;
    const dims = [[d, h], [d, h], [w, d], [w, d], [w, h], [w, h]];
    for (let f = 0; f < 6; f++) for (let i = 0; i < 4; i++) {
      const k = f * 4 + i;
      uv.setXY(k, (uv.getX(k) * dims[f][0]) / tileSize, (uv.getY(k) * dims[f][1]) / tileSize);
    }
    return ink.inkify(new THREE.Mesh(g), { map: TEX[tex] });
  }

  /** Flat textured card (sign, poster, sticker), inked and lit like the world. */
  function decal(texture, w, h, { lit = true } = {}) {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h));
    if (lit) return ink.inkify(m, { map: texture, alphaTest: 0.5 });
    texture.magFilter = texture.minFilter = THREE.NearestFilter;
    return ink.inkify(m, { material: new THREE.MeshBasicMaterial({ map: texture, alphaTest: 0.5, toneMapped: false }) });
  }

  const FACES = [
    { d: [1, 0, 0], c: [[1, 0, 1], [1, 0, 0], [1, 1, 0], [1, 1, 1]] },
    { d: [-1, 0, 0], c: [[0, 0, 0], [0, 0, 1], [0, 1, 1], [0, 1, 0]] },
    { d: [0, 1, 0], c: [[0, 1, 1], [1, 1, 1], [1, 1, 0], [0, 1, 0]] },
    { d: [0, -1, 0], c: [[0, 0, 0], [1, 0, 0], [1, 0, 1], [0, 0, 1]] },
    { d: [0, 0, 1], c: [[0, 0, 1], [1, 0, 1], [1, 1, 1], [0, 1, 1]] },
    { d: [0, 0, -1], c: [[1, 0, 0], [0, 0, 0], [0, 1, 0], [1, 1, 0]] },
  ];
  const UVQ = [[0, 0], [1, 0], [1, 1], [0, 1]];
  /** Merge a Map("x,y,z" → tile name) of unit blocks into one mesh per tile, hidden faces culled. */
  function voxelMeshes(blocks, size = 1) {
    const groups = new Map();
    for (const [key, mat] of blocks) {
      const [x, y, z] = key.split(",").map(Number);
      for (const f of FACES) {
        if (blocks.has(`${x + f.d[0]},${y + f.d[1]},${z + f.d[2]}`)) continue;
        let g = groups.get(mat);
        if (!g) groups.set(mat, (g = { pos: [], nrm: [], uv: [] }));
        for (const i of [0, 1, 2, 0, 2, 3]) {
          const c = f.c[i];
          g.pos.push((x + c[0]) * size, (y + c[1]) * size, (z + c[2]) * size);
          g.nrm.push(...f.d);
          g.uv.push(...UVQ[i]);
        }
      }
    }
    const out = [];
    for (const [mat, g] of groups) {
      const geo = new THREE.BufferGeometry();
      geo.setAttribute("position", new THREE.Float32BufferAttribute(g.pos, 3));
      geo.setAttribute("normal", new THREE.Float32BufferAttribute(g.nrm, 3));
      geo.setAttribute("uv", new THREE.Float32BufferAttribute(g.uv, 2));
      out.push(ink.inkify(new THREE.Mesh(geo), { map: TEX[mat] }));
    }
    return out;
  }

  const GLOW = canvasTexture(64, 64, (g) => {
    const grad = g.createRadialGradient(32, 32, 0, 32, 32, 32);
    grad.addColorStop(0, "rgba(255,255,255,1)");
    grad.addColorStop(0.35, "rgba(255,255,255,0.45)");
    grad.addColorStop(1, "rgba(255,255,255,0)");
    g.fillStyle = grad;
    g.fillRect(0, 0, 64, 64);
  });
  function glowSprite(color, scale, opacity) {
    const s = new THREE.Sprite(new THREE.SpriteMaterial({
      map: GLOW, color, transparent: true, opacity, depthWrite: false, blending: THREE.AdditiveBlending, fog: false,
    }));
    s.scale.set(scale, scale, 1);
    s.userData.noInk = true;
    return s;
  }
  function unlit(geometry, color, extra = {}) {
    const m = new THREE.Mesh(geometry, new THREE.MeshBasicMaterial({ color, ...extra }));
    m.userData.noInk = true;
    return m;
  }

  return { TEX, tile, canvasTexture, pbox, decal, voxelMeshes, glowSprite, unlit };
}
