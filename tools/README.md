# Blockbench → Blender / web tools

Blender can't open `.bbmodel` files, so these scripts rebuild them in Blender.

- `bb_import_render.py`: imports one `.bbmodel` (cubes, textures, bones, first animation) and then:
  - `stills` renders front and back previews;
  - `anim` renders the animation as PNG frames;
  - `blend` saves a `.blend` and exports a web `.glb` into `glb/`.
- `bb_lineup.py`: merges several per-model `.blend` files into one labeled lineup scene.

```bash
B=/Applications/Blender.app/Contents/MacOS/Blender
"$B" -b --factory-startup -Y --python tools/bb_import_render.py -- path/to/model.bbmodel out/ blend
```

The file name sets the model's name in every output, so copy a source file to a neutral name first if its name shouldn't appear. For example, the hat files with people's names became `lighthouse_hat_colorway1–5`.

## Notes from fixing the imports

- GeckoLib (`animated_entity_model`) animation values are applied as-is. Only Bedrock formats mirror rotation X/Y and position X. Mirroring Cody's dance tore the knees and elbows apart (4.2 px mean gap, vs 0.9 px unmirrored).
- Faces are one-sided, as in Minecraft. With double-sided faces, the zero-thickness cubes in the wings and hat brims z-fight.
- Zero-area faces (the edges of flat cubes) are dropped.
- Face UVs are read in the project's UV resolution (`resolution` in the file). The static lighthouse hats also carry per-texture `uv_width`/`uv_height` values (16 and 32, against a 64 project). Trusting those scrambled the brims and hid the band gems. Read at project resolution, every colorway has the same round brim as the animated hat, just recolored. Set `BB_UV_MODE=texture` to switch back to the old reading.
