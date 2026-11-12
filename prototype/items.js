// Skill/software "loot": 16×16 pixel-art sprites extruded one voxel thick (Minecraft-item style),
// each with a loot card. Card facts come from Cody's resume and his Blockbench files.
import * as THREE from "three";

export const RARITY = {
  uncommon: { label: "Uncommon", color: "#5fe35f" },
  rare: { label: "Rare", color: "#4aa8ff" },
  epic: { label: "Epic", color: "#c46bff" },
  legendary: { label: "Legendary", color: "#ff9a1f" },
};

// '.' = empty. Every sprite is 16 rows of 16 characters.
const SPRITES = {
  cube: {
    palette: { k: "#10141c", T: "#a9e1ff", L: "#3d8fd6", R: "#23578f", l: "#d4f1ff" },
    rows: [
      "................",
      ".......kk.......",
      ".....kkTTkk.....",
      "...kkTTTTTTkk...",
      ".kkTTTTTTTTTTkk.",
      ".kLLTTTTTTTTRRk.",
      ".kLLLLTTTTRRRRk.",
      ".kLLLLLkkRRRRRk.",
      ".kLLLLLLlRRRRRk.",
      ".kLLLLLLlRRRRRk.",
      ".kLLLLLLlRRRRRk.",
      ".kLLLLLLlRRRRRk.",
      ".kLLLLLLlRRRRRk.",
      ".kkLLLLLlRRRRkk.",
      "...kkLLLlRRkk...",
      ".....kkkkkk.....",
    ],
  },
  keyframe: {
    palette: { k: "#1a1206", Y: "#ffd23f", W: "#fff6c2", O: "#e08a00" },
    rows: [
      "................",
      ".......kk.......",
      "......kWYk......",
      ".....kWYYYk.....",
      "....kWYYYYYk....",
      "...kWYYYYYYYk...",
      "..kYYYYYYYYYOk..",
      ".kYYYYYYYYYYOOk.",
      ".kYYYYYYYYYOOOk.",
      "..kYYYYYYYOOOk..",
      "...kYYYYYOOOk...",
      "....kYYYOOOk....",
      ".....kYOOOk.....",
      "......kOOk......",
      ".......kk.......",
      "................",
    ],
  },
  clapper: {
    palette: { k: "#111216", W: "#f2f2f2", G: "#3a3f4a", r: "#ff4f4f" },
    rows: [
      "................",
      "................",
      ".kkkkkkkkkkkkkk.",
      ".kWWWkkkWWWkkkk.",
      ".kkWWWkkkWWWkkk.",
      ".kkkkkkkkkkkkkk.",
      ".kGGGGGGGGGGGGk.",
      ".kGWWWWWGWWWWGk.",
      ".kGGGGGGGGGGGGk.",
      ".kGWWWGGGWWWWGk.",
      ".kGGGGGGGGGGGGk.",
      ".kGWWWWWWGGGrGk.",
      ".kGGGGGGGGGGGGk.",
      ".kkkkkkkkkkkkkk.",
      "................",
      "................",
    ],
  },
  brush: {
    palette: { k: "#1a1410", P: "#ff4f8b", S: "#c9d2dc", H: "#b07a3a", D: "#ff4f8b" },
    rows: [
      "................",
      "............kk..",
      "...........kPPk.",
      "..........kPPPk.",
      ".........kSPPk..",
      "........kSSSk...",
      ".......kHSSk....",
      "......kHHk......",
      ".....kHHk.......",
      "....kHHk........",
      "...kHHk.........",
      "..kHHk..........",
      ".kHHk.....DD....",
      ".kkk.....DDDD...",
      "..........DD....",
      "................",
    ],
  },
  clipboard: {
    palette: { k: "#16120e", B: "#8a5a2b", P: "#f4f1e6", L: "#4a7fd6", C: "#3bb54a", M: "#b8c0cc" },
    rows: [
      "................",
      "......kkkk......",
      "..kkkkMMMMkkkk..",
      "..kBBkMMMMkBBk..",
      "..kBPPPPPPPPBk..",
      "..kBPLLLLLPPBk..",
      "..kBPPPPPPPPBk..",
      "..kBPCPLLLLPBk..",
      "..kBPPPPPPPPBk..",
      "..kBPCPLLLLPBk..",
      "..kBPPPPPPPPBk..",
      "..kBPCPLLLPPBk..",
      "..kBPPPPPPPPBk..",
      "..kBBBBBBBBBBk..",
      "..kkkkkkkkkkkk..",
      "................",
    ],
  },
  wrench: {
    palette: { k: "#121418", S: "#aeb8c4", D: "#6e7885", G: "#f0a830" },
    rows: [
      "..........kk.kk.",
      ".........kSSkSSk",
      ".........kSSkSSk",
      "........kSSSSSk.",
      ".......kSSSSSk..",
      "......kSSSSk....",
      ".....kSSSk......",
      "....kSSSk.......",
      "...kSSSk........",
      "..kSSSk.........",
      ".kSDSk..........",
      ".kSSk.....kGGk..",
      "..kk.....kGGGGk.",
      ".........kGkkGk.",
      ".........kGGGGk.",
      "..........kGGk..",
    ],
  },
};

export const ITEMS = [
  {
    id: "blockbench", sprite: "cube", rarity: "legendary",
    name: "Builder's Cube", tool: "Blockbench", kind: "3D modeling & texturing",
    score: "16", scoreLabel: "Models built",
    stats: [["Largest model", "284 cubes"], ["Formats", "Java block, GeckoLib"], ["Textures", "64–512 px"]],
    bonus: ["Every model on this site was built with it"],
    flavor: "Every cube in its place.", maker: "Blockbench",
  },
  {
    id: "geckolib", sprite: "keyframe", rarity: "epic",
    name: "Keyframe of Motion", tool: "GeckoLib", kind: "Rigging & animation",
    score: "15", scoreLabel: "Bones rigged",
    stats: [["Longest clip", "10 s dance"], ["Loop", "1.3 s hat idle"], ["Limbs", "Split for bends"]],
    bonus: ["Animated character and hat on this site"],
    flavor: "Bones that know how to party.", maker: "GeckoLib",
  },
  {
    id: "premiere", sprite: "clapper", rarity: "epic",
    name: "Cutter's Clapper", tool: "Adobe Premiere Pro", kind: "Video editing",
    score: "2", scoreLabel: "Years editing",
    stats: [["Video production", "2 years"], ["Editor", "Premiere Pro"]],
    bonus: [],
    flavor: "Cut. Print. Ship it.", maker: "Adobe",
  },
  {
    id: "texturing", sprite: "brush", rarity: "rare",
    name: "Pixel-Painter's Brush", tool: "Hand-painted textures", kind: "Pixel-art texturing",
    score: "5", scoreLabel: "Colorways",
    stats: [["Texture sizes", "64–512 px"], ["Style", "Pixel by pixel"]],
    bonus: ["Five colorways of one hat, one model"],
    flavor: "Sixty-four pixels is plenty.", maker: "Blockbench",
  },
  {
    id: "handson", sprite: "wrench", rarity: "rare",
    name: "Gearhead's Wrench", tool: "Engineering design", kind: "Hands-on building",
    score: "6", scoreLabel: "Months on engines",
    stats: [["Small engines", "6 months"], ["Program", "Cascadia Tech"], ["Also", "Framing, layouts"]],
    bonus: [],
    flavor: "Measure twice, cut once.", maker: "Hands-on",
  },
  {
    id: "office", sprite: "clipboard", rarity: "uncommon",
    name: "Paperwork Clipboard", tool: "Microsoft Office 365", kind: "Productivity",
    score: "365", scoreLabel: "Office suite",
    stats: [["Apps", "Office 365 suite"]],
    bonus: [],
    flavor: "Paperwork? Handled.", maker: "Microsoft",
  },
];

/** Extrude a sprite into a one-voxel-thick mesh geometry with vertex colors, centered on the origin. */
export function spriteGeometry(spriteId, px = 0.034) {
  const { palette, rows } = SPRITES[spriteId];
  if (rows.length !== 16 || rows.some((r) => r.length !== 16)) console.warn("sprite is not 16×16:", spriteId);
  const solid = (x, y) => x >= 0 && y >= 0 && x < 16 && y < 16 && rows[y][x] !== ".";
  const pos = [], nrm = [], col = [];
  const c = new THREE.Color();
  const t = px / 2;
  const quad = (a, b, cc, d, n) => {
    for (const v of [a, b, cc, a, cc, d]) { pos.push(...v); nrm.push(...n); col.push(c.r, c.g, c.b); }
  };
  for (let y = 0; y < 16; y++) {
    for (let x = 0; x < 16; x++) {
      const ch = rows[y][x];
      if (ch === ".") continue;
      c.setStyle(palette[ch] || "#ff00ff");
      const x0 = (x - 8) * px, x1 = x0 + px;
      const y1 = (8 - y) * px, y0 = y1 - px;
      quad([x0, y0, t], [x1, y0, t], [x1, y1, t], [x0, y1, t], [0, 0, 1]);        // front
      quad([x1, y0, -t], [x0, y0, -t], [x0, y1, -t], [x1, y1, -t], [0, 0, -1]);   // back
      if (!solid(x - 1, y)) quad([x0, y0, -t], [x0, y0, t], [x0, y1, t], [x0, y1, -t], [-1, 0, 0]);
      if (!solid(x + 1, y)) quad([x1, y0, t], [x1, y0, -t], [x1, y1, -t], [x1, y1, t], [1, 0, 0]);
      if (!solid(x, y - 1)) quad([x0, y1, t], [x1, y1, t], [x1, y1, -t], [x0, y1, -t], [0, 1, 0]);
      if (!solid(x, y + 1)) quad([x0, y0, -t], [x1, y0, -t], [x1, y0, t], [x0, y0, t], [0, -1, 0]);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute("normal", new THREE.Float32BufferAttribute(nrm, 3));
  g.setAttribute("color", new THREE.Float32BufferAttribute(col, 3));
  return g;
}

export function cardHTML(item) {
  const r = RARITY[item.rarity];
  const stats = item.stats.map(([k, v]) => `<div class="hc-row"><span>${v}</span><span>${k}</span></div>`).join("");
  const bonus = item.bonus.map((b) => `<li>${b}</li>`).join("");
  return `
    <div class="hc-head">
      <span class="hc-score">${item.score}</span>
      <span class="hc-score-label">${item.scoreLabel}</span>
      <span class="hc-rarity">${r.label}</span>
    </div>
    <h2 class="hc-name">${item.name}</h2>
    <p class="hc-kind">${item.tool} · ${item.kind}</p>
    <div class="hc-stats">${stats}</div>
    ${bonus ? `<ul class="hc-bonus">${bonus}</ul>` : ""}
    <p class="hc-flavor">${item.flavor}</p>
    <p class="hc-maker">${item.maker}</p>`;
}
