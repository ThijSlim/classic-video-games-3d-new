"""
Blender script to import a single FBX model with external PNG textures
and export as a single GLB with all textures embedded.

Usage:
    /Applications/Blender.app/Contents/MacOS/Blender --background --python scripts/convert-fbx.py -- \
        --source "/path/to/folder" \
        --file "model.fbx" \
        --output "public/models/output-name.glb" \
        [--scale 0.01]

Notes:
    - Textures must be in the same directory as the FBX.
    - --scale applies a uniform scale to all root objects before export.
      Use 0.01 to convert raw SM64 units (1 unit = 1 SM64 unit) to engine
      units (1 unit = 1 metre, SM64 × 0.01).
"""
import bpy
import os
import sys


def get_args():
    argv = sys.argv
    if "--" not in argv:
        return None, None, None, 1.0
    argv = argv[argv.index("--") + 1:]

    source_dir = None
    fbx_file = None
    output_path = None
    scale = 1.0

    i = 0
    while i < len(argv):
        if argv[i] == "--source" and i + 1 < len(argv):
            source_dir = argv[i + 1]
            i += 2
        elif argv[i] == "--file" and i + 1 < len(argv):
            fbx_file = argv[i + 1]
            i += 2
        elif argv[i] == "--output" and i + 1 < len(argv):
            output_path = argv[i + 1]
            i += 2
        elif argv[i] == "--scale" and i + 1 < len(argv):
            scale = float(argv[i + 1])
            i += 2
        else:
            i += 1

    return source_dir, fbx_file, output_path, scale


def main():
    source_dir, fbx_file, output_path, scale = get_args()

    if not source_dir or not fbx_file or not output_path:
        print("Error: Missing required arguments.")
        print("Usage: blender --background --python scripts/convert-fbx.py -- \\")
        print('    --source "/path/to/folder" --file "model.fbx" --output "output.glb" [--scale 0.01]')
        sys.exit(1)

    # Make output path absolute if relative
    if not os.path.isabs(output_path):
        workspace = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
        output_path = os.path.join(workspace, output_path)

    filepath = os.path.join(source_dir, fbx_file)
    if not os.path.exists(filepath):
        print(f"Error: FBX not found: {filepath}")
        sys.exit(1)

    # Clear default scene
    bpy.ops.wm.read_factory_settings(use_empty=True)

    # Import FBX — automatic_bone_orientation helps normalise rigs from N64 rips
    print(f"Importing: {filepath}")
    bpy.ops.import_scene.fbx(
        filepath=filepath,
        automatic_bone_orientation=True,
    )

    print(f"Loaded: {len(bpy.data.objects)} objects, "
          f"{len(bpy.data.materials)} materials, "
          f"{len(bpy.data.images)} images")

    # Apply uniform scale to all root objects
    if scale != 1.0:
        for obj in bpy.data.objects:
            if obj.parent is None:
                obj.scale *= scale
        # Apply scale transforms so the GLB carries correct dimensions
        bpy.ops.object.select_all(action='SELECT')
        bpy.ops.object.transform_apply(scale=True)
        print(f"Applied scale: {scale}")

    # Resolve external textures — textures in the FBX may have absolute paths
    # or just filenames. Re-point them to the source directory and pack them.
    for img in bpy.data.images:
        if img.packed_file:
            continue
        # Try to find the texture in the source directory by basename
        basename = os.path.basename(bpy.path.abspath(img.filepath) if img.filepath else img.name)
        candidate = os.path.join(source_dir, basename)
        if os.path.exists(candidate):
            img.filepath = candidate
            try:
                img.pack()
                print(f"  Packed: {img.name} ({img.size[0]}x{img.size[1]})")
            except Exception as e:
                print(f"  WARNING: Could not pack {img.name}: {e}")
        else:
            print(f"  WARNING: Texture not found in source dir: {basename}")

    # Report final image status
    for img in bpy.data.images:
        status = "embedded" if img.packed_file else "NOT EMBEDDED"
        print(f"  {img.name}: [{status}]")

    # Ensure output directory exists
    os.makedirs(os.path.dirname(output_path), exist_ok=True)

    # Export as GLB
    print(f"\nExporting to: {output_path}")
    bpy.ops.export_scene.gltf(
        filepath=output_path,
        export_format='GLB',
        export_texcoords=True,
        export_normals=True,
        export_materials='EXPORT',
        export_image_format='AUTO',
        export_yup=True,
    )

    size_kb = os.path.getsize(output_path) / 1024
    print(f"\nDone! Output: {output_path} ({size_kb:.1f} KB)")


if __name__ == "__main__":
    main()
