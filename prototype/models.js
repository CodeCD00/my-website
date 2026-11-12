// Cody's Blockbench models for the workshop. Facts (cube counts, texture sizes, animation
// lengths) come from his .bbmodel files; display names are neutral (no names from the files).
import { RARITY } from "./items.js";

export const MODEL_VERSION = "3";
const ROMAN = ["I", "II", "III", "IV", "V", "VI"];

export const MODELS = [
  { group: "Character", id: "codester_character", short: "Codester", name: "Codester", rarity: "legendary",
    cubes: 16, texture: "64 × 64", anim: "Dance, 10.0 s", format: "GeckoLib", animated: true },
  { group: "Lighthouse hat", id: "lighthouse_hat_animated", short: "Animated", name: "Lighthouse Hat", rarity: "epic",
    cubes: 65, texture: "256 × 256", anim: "Idle loop, 1.3 s", format: "GeckoLib", animated: true },
  ...[1, 2, 3, 4, 5].map((n) => ({
    group: "Lighthouse hat", id: `lighthouse_hat_colorway${n}`, short: `Colorway ${n}`, name: `Lighthouse Hat ${n}`,
    rarity: "rare", cubes: 65, texture: "256 × 256", anim: "None", format: "Java block",
  })),
  { group: "Halloween wings", id: "halloween_wings_1", short: "Wings I", name: "Wings I", rarity: "epic",
    cubes: 126, texture: "256 × 256", anim: "None", format: "Java block" },
  { group: "Halloween wings", id: "halloween_wings_2", short: "Wings II", name: "Wings II", rarity: "rare",
    cubes: 48, texture: "256 × 256", anim: "None", format: "Java block" },
  { group: "Halloween wings", id: "halloween_wings_3", short: "Wings III", name: "Wings III", rarity: "legendary",
    cubes: 284, texture: "512 × 512", anim: "None", format: "Java block" },
  ...[
    [1, 6, "128 × 128", "uncommon"], [2, 8, "128 × 128", "uncommon"], [3, 16, "256 × 256", "uncommon"],
    [4, 36, "256 × 256", "rare"], [5, 36, "256 × 256", "rare"], [6, 34, "128 × 128", "rare"],
  ].map(([n, cubes, texture, rarity]) => ({
    group: "Halloween horns", id: `halloween_horns_${n}`, short: `Horns ${ROMAN[n - 1]}`, name: `Horns ${ROMAN[n - 1]}`,
    rarity, cubes, texture, anim: "None", format: "Java block",
  })),
];

export function modelCardHTML(m) {
  const r = RARITY[m.rarity];
  const rows = [["Texture", m.texture], ["Animation", m.anim], ["Format", m.format]]
    .map(([k, v]) => `<div class="hc-row"><span>${v}</span><span>${k}</span></div>`).join("");
  return `
    <div class="hc-head">
      <span class="hc-score">${m.cubes}</span>
      <span class="hc-score-label">Cubes</span>
      <span class="hc-rarity">${r.label}</span>
    </div>
    <h2 class="hc-name">${m.name}</h2>
    <p class="hc-kind">${m.group} · built in Blockbench</p>
    <div class="hc-stats">${rows}</div>
    <p class="hc-maker">Blockbench</p>`;
}
