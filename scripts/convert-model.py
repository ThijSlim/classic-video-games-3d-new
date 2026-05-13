"""
Blender script to import multiple GLB model parts and export as a single
combined GLB with all textures properly embedded.

Usage:
    /Applications/Blender.app/Contents/MacOS/Blender --background --python scripts/convert-model.py -- \
        --source "/path/to/source/folder" \
        --output "public/models/output-name.glb" \
        --files "Part1.glb,Part2.glb,Part3.glb"

Requirements:
    - Blender 5.x (uses import_scene.gltf, not wm.collada_import)
    - Source GLB files must already exist (convert DAE->GLB first if needed)

Notes:
    - Blender 5.x removed COLLADA (DAE) import support
    - If you only have DAE files, first convert them to GLB using Blender 4.x
      or an online converter, then use this script to merge and fix textures
    - The script ensures all images are packed (embedded) in the output GLB
"""
import bpy
import os
import sys

def get_args():
    """Parse arguments after the -- separator."""
    argv = sys.argv
    if "--" not in argv:
        return None, None, None
    argv = argv[argv.index("--") + 1:]

    source_dir = None
    output_path = None
    files = None

    i = 0
    while i < len(argv):
        if argv[i] == "--source" and i + 1 < len(argv):
            source_dir = argv[i + 1]
            i += 2
        elif argv[i] == "--output" and i + 1 < len(argv):
            output_path = argv[i + 1]
            i += 2
        elif argv[i] == "--files" and i + 1 < len(argv):
            files = [f.strip() for f in argv[i + 1].split(",")]
            i += 2
        else:
            i += 1

    return source_dir, output_path, files


def main():
    source_dir, output_path, glb_files = get_args()

    if not source_dir or not output_path or not glb_files:
        print("Error: Missing required arguments.")
        print("Usage: blender --background --python convert-model.py -- \\")
        print('    --source "/path/to/source" --output "output.glb" --files "A.glb,B.glb"')
        sys.exit(1)

    # Make output path absolute if relative
    if not os.path.isabs(output_path):
        # Assume relative to workspace root (parent of scripts/)
        workspace = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
        output_path = os.path.join(workspace, output_path)

    # Clear default scene
    bpy.ops.wm.read_factory_settings(use_empty=True)

    # Import all GLB files
    for glb_file in glb_files:
        filepath = os.path.join(source_dir, glb_file)
        if os.path.exists(filepath):
            print(f"Importing: {glb_file}")
            bpy.ops.import_scene.gltf(filepath=filepath)
        else:
            print(f"WARNING: Skipping (not found): {filepath}")

    # Report what was loaded
    print(f"\nLoaded: {len(bpy.data.objects)} objects, "
          f"{len(bpy.data.materials)} materials, "
          f"{len(bpy.data.images)} images")

    # Ensure all images are packed (embedded in GLB)
    for img in bpy.data.images:
        if not img.packed_file and img.filepath:
            try:
                img.pack()
                print(f"  Packed image: {img.name}")
            except Exception as e:
                print(f"  WARNING: Could not pack {img.name}: {e}")

    # Report image status
    for img in bpy.data.images:
        status = "embedded" if img.packed_file else "NOT EMBEDDED"
        print(f"  {img.name}: {img.size[0]}x{img.size[1]} [{status}]")

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
