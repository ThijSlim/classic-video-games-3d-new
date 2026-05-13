# Model Conversion Guide

How to convert N64 model rips (DAE + texture PNGs) into a single GLB file with
embedded textures for use in this project.

## Prerequisites

- **Blender 5.x** installed at `/Applications/Blender.app` (macOS)
- Source model files (typically DAE/GLB + PNG textures from a model rip)

## Problem

N64 model rips (e.g. from SM64) come as COLLADA (.dae) files that reference
external PNG textures. When converting to GLB naively, textures are either:
- Not embedded (model appears grey/white)
- Referenced as external files that don't ship with the GLB

Blender 5.x also **removed COLLADA import**, so you can't directly import .dae files.

## Solution: Two-Step Process

### Step 1: Convert DAE to GLB (if you only have DAE files)

Use an online COLLADA-to-GLB converter (e.g. https://products.aspose.app/3d/conversion/dae-to-glb
or similar) to convert each `.dae` file to `.glb`. Make sure the DAE and PNG
textures are in the **same directory** so the converter can resolve texture references.

> **Note:** Blender 5.x removed COLLADA import support, so you cannot use it for
> this step. Use an external conversion tool instead.

### Step 2: Merge GLB parts into a single file with embedded textures

```bash
/Applications/Blender.app/Contents/MacOS/Blender --background --python scripts/convert-model.py -- \
    --source "/path/to/source/folder" \
    --output "public/models/model-name.glb" \
    --files "Part1.glb,Part2.glb,Part3.glb"
```

## Example: Peach's Castle Exterior

Source: `/Users/thijslimmen/Downloads/Peach's Castle Exterior/`

The source files include both `.dae` and pre-converted `.glb` variants:
- `Area1_bake.glb` — Main castle grounds (70 meshes, 24 textures)
- `Tower_bake.glb` — Castle towers
- `Tree.glb` — Trees around the grounds
- `Flag.glb` — Castle flags
- `CannonGrate.glb` — Cannon hole grates
- `MoatGrates.glb` — Moat water grates

### Command used:

```bash
/Applications/Blender.app/Contents/MacOS/Blender --background --python scripts/convert-model.py -- \
    --source "/Users/thijslimmen/Downloads/Peach's Castle Exterior" \
    --output "public/models/peach-castle-exterior.glb" \
    --files "Area1_bake.glb,Tower_bake.glb,Tree.glb,Flag.glb,CannonGrate.glb,MoatGrates.glb"
```

### Result:
- 89 meshes, 33 materials, 28 embedded textures
- All materials have `baseColorTexture` assigned
- File size: ~277 KB

## Tips

- Use `_bake` variants when available — they have baked lighting/vertex colors
- The `_fix` texture variants are corrected versions; the script uses the filenames
  referenced in the original DAE
- `vertexColors_*.png` are vertex color lookup textures used by the baked models
- If the model still looks grey in your engine, check that your renderer supports
  the texture filtering mode (these N64 textures are very small: 32x32, 64x32, etc.)
  and that `nearest` filtering is used for the classic pixelated look

## Verifying the output

```bash
python3 -c "
import struct, json, os
path = 'public/models/peach-castle-exterior.glb'
with open(path, 'rb') as f:
    magic, version, length = struct.unpack('<III', f.read(12))
    json_len, json_type = struct.unpack('<II', f.read(8))
    data = json.loads(f.read(json_len))
print(f'Size: {os.path.getsize(path)/1024:.0f}KB')
print(f'Meshes: {len(data.get(\"meshes\", []))}')
print(f'Materials: {len(data.get(\"materials\", []))}')
print(f'Images: {len(data.get(\"images\", []))}')
embedded = sum(1 for i in data.get('images',[]) if 'bufferView' in i)
print(f'Embedded: {embedded}/{len(data.get(\"images\", []))}')
"
```

All images should show `bufferView` (embedded) rather than `uri` (external reference).
