# Cody Molyneux — 3D portfolio

**Live site:** https://cody-molyneux.vercel.app

An interactive portfolio for Cody Molyneux, a 3D modeler, animator and video editor. It mixes a Minecraft-style voxel world with an inked, comic-book look:

- **The deck:** Cody's hand-drawn avatar sits in an armchair next to a "loadout" cabinet. Each skill item on the cabinet opens a loot card.
- **The workshop:** scroll down and the camera flies across the badlands into his shack. Inside, his Blockbench models spin on a display turntable.

## Run it locally

You only need Python 3 and a browser. There's no build step and nothing to install.

```bash
python3 tools/serve.py
```

Then open http://localhost:8765/prototype/

The server turns off browser caching so edits show up on refresh. The page loads three.js and the fonts from CDNs, so you need to be online.

## What's where

| Folder | Contents |
|---|---|
| `prototype/` | The website (this is what's deployed) |
| `prototype/models/` | The web (`.glb`) versions of the models |
| `prototype/avatar/` | The five avatar expressions used on the site |
| `prototype/resume/` | The resume download |
| `3d/source/` | The Blockbench source files (`.bbmodel`) — open these in Blockbench |
| `3d/blender/` | All models together in one Blender file |
| `3d/previews/` | Preview renders and animation videos |
| `3d/avatar3d/` | A real 3D version of the chibi avatar (Blender + `.glb`, with its own README). It isn't on the site yet |
| `code char/` | The full-size avatar drawings (3500 × 3500) |
| `tools/` | The Blockbench → Blender/web converter and the dev server (see `tools/README.md`) |

### Website files

- `index.html`, `hero.js` and `hero.css`: the page, the outdoor scene, and the scroll flight into the workshop.
- `shop.js` and `shop.css`: the workshop interior and its holo menu.
- `scenery.js`: the badlands props (shack, power line, ethernet cable, water tower and so on).
- `avatar.js`: the avatar in the armchair, including the talking and expression swaps.
- `items.js`: the skill items and their card text.
- `models.js`: the model list and its stats.
- `ink.js`: the comic look, meaning toon shading, crosshatching and black outlines.
- `voxkit.js`: the voxel blocks and pixel-art textures.

### Handy URL options

| Option | What it does |
|---|---|
| `?item=premiere` | Opens with a skill item selected |
| `?m=halloween_wings_3` | Picks a model in the workshop |
| `?p=0.6` | Freezes the scroll flight at a point (0 = outside, 1 = inside). Useful for screenshots |
| `?expr=smug` | Holds one avatar expression |

## Updating the models

1. Edit the `.bbmodel` in Blockbench.
2. Re-export it with `tools/bb_import_render.py`. The usage is in `tools/README.md`.
3. Copy the new `.glb` into `prototype/models/`.
4. Bump `MODEL_VERSION` in `prototype/models.js` so browsers fetch the new file.

## Deploying

The site is plain static files in `prototype/`. To host your own copy on [Vercel](https://vercel.com):

```bash
cd prototype
vercel link
vercel deploy --prod
```

## Credits

The models, textures, animations and character art are by Cody Molyneux. The site is built with [three.js](https://threejs.org), with the Bangers and Saira Condensed fonts from Google Fonts.
