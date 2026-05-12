import * as THREE from 'three';
import {
  Surface,
  SurfaceType,
  createSurface,
} from '../engine/Surface';

// ── Geometry helpers ───────────────────────────────────────────────────

/** Create 2 floor-triangle Surfaces for a horizontal quad at height y. */
function floorQuad(
  x0: number,
  z0: number,
  x1: number,
  z1: number,
  y: number,
  type: SurfaceType = SurfaceType.DEFAULT,
): Surface[] {
  const v00 = new THREE.Vector3(x0, y, z0);
  const v10 = new THREE.Vector3(x1, y, z0);
  const v11 = new THREE.Vector3(x1, y, z1);
  const v01 = new THREE.Vector3(x0, y, z1);
  return [
    createSurface(v00, v01, v10, type),
    createSurface(v01, v11, v10, type),
  ];
}

/**
 * Create 2 Surfaces for a ramp quad going along +Z.
 * Bottom edge at (x0..x1, y0, z0), top edge at (x0..x1, y1, z1).
 * Winding produces an upward-facing normal.
 */
function rampQuad(
  x0: number,
  x1: number,
  z0: number,
  y0: number,
  z1: number,
  y1: number,
  type: SurfaceType = SurfaceType.DEFAULT,
): Surface[] {
  const bl = new THREE.Vector3(x0, y0, z0);
  const br = new THREE.Vector3(x1, y0, z0);
  const tl = new THREE.Vector3(x0, y1, z1);
  const tr = new THREE.Vector3(x1, y1, z1);
  return [createSurface(bl, tl, br, type), createSurface(tl, tr, br, type)];
}

/**
 * Create 2 Surfaces for a ramp quad going along +X.
 * Bottom edge at (x0, y0, z0..z1), top edge at (x1, y1, z0..z1).
 */
function rampQuadX(
  x0: number,
  y0: number,
  x1: number,
  y1: number,
  z0: number,
  z1: number,
  type: SurfaceType = SurfaceType.DEFAULT,
): Surface[] {
  const bl = new THREE.Vector3(x0, y0, z0);
  const br = new THREE.Vector3(x0, y0, z1);
  const tl = new THREE.Vector3(x1, y1, z0);
  const tr = new THREE.Vector3(x1, y1, z1);
  // Winding for upward-facing normal: bl, br, tl
  return [createSurface(bl, br, tl, type), createSurface(br, tr, tl, type)];
}

/**
 * Create a vertical wall quad (2 triangles) facing a given direction.
 * Corners defined by two XZ segments at y0 and y1.
 */
function wallQuad(
  x0: number, z0: number,
  x1: number, z1: number,
  y0: number, y1: number,
): Surface[] {
  const b0 = new THREE.Vector3(x0, y0, z0);
  const b1 = new THREE.Vector3(x1, y0, z1);
  const t0 = new THREE.Vector3(x0, y1, z0);
  const t1 = new THREE.Vector3(x1, y1, z1);
  return [createSurface(b0, t0, b1), createSurface(t0, t1, b1)];
}

// ── Color palette ──────────────────────────────────────────────────────

const COL_DEFAULT = 0x888888;       // gray
const COL_RAMP = 0x44aa44;          // green
const COL_SLIPPERY = 0x88ccff;      // light-blue
const COL_STEEP = 0xaa2222;         // dark-red
const COL_WATER_SURFACE = 0x4488ff; // semi-transparent blue
const COL_WATER_FLOOR = 0x223388;   // dark-blue
const COL_PLATFORM = 0x888888;      // gray

// ── Mesh builders ──────────────────────────────────────────────────────

function meshFromSurfaces(
  surfaces: Surface[],
  color: number,
  opts?: { transparent?: boolean; opacity?: number },
): THREE.Mesh {
  const geom = new THREE.BufferGeometry();
  const verts: number[] = [];
  for (const s of surfaces) {
    verts.push(s.v0.x, s.v0.y, s.v0.z);
    verts.push(s.v1.x, s.v1.y, s.v1.z);
    verts.push(s.v2.x, s.v2.y, s.v2.z);
  }
  geom.setAttribute('position', new THREE.Float32BufferAttribute(verts, 3));
  geom.computeVertexNormals();

  const mat = new THREE.MeshLambertMaterial({
    color,
    transparent: opts?.transparent ?? false,
    opacity: opts?.opacity ?? 1,
    side: opts?.transparent ? THREE.DoubleSide : THREE.FrontSide,
  });
  return new THREE.Mesh(geom, mat);
}

// ── TestLevel data ─────────────────────────────────────────────────────

export interface TestLevelData {
  surfaces: Surface[];
  group: THREE.Group;
  gridOverlay: THREE.GridHelper;
}

/**
 * Build the TestLevel procedurally.
 *
 * All dimensions in engine units (SM64 units × 0.01):
 *  - Flat plane 20×20 at Y=0
 *  - Gentle ramp 30° to Platform C (Y=4, 5×5)
 *  - Gap platforms D & E (4×4 each, 3-unit gap) at Y=0
 *  - Steep ramp 60° (classified as wall)
 *  - Slippery patch 3×3 at Y=0.001
 *  - Water pool recess 6×6 (floor Y=−2, surface Y=0, visual only)
 *  - Death plane at Y=−5 (invisible)
 */
export function createTestLevel(): TestLevelData {
  const surfaces: Surface[] = [];
  const group = new THREE.Group();

  // ── 1. Flat plane ───────────────────────────────────────────────────
  const flatSurfaces = floorQuad(-10, -10, 10, 10, 0);
  surfaces.push(...flatSurfaces);
  group.add(meshFromSurfaces(flatSurfaces, COL_DEFAULT));

  // ── 2. Gentle ramp (30°) along +Z ──────────────────────────────────
  const rampHeight = 4;
  const gentleHoriz = rampHeight / Math.tan((30 * Math.PI) / 180); // ≈ 6.93
  const gentleZ0 = 10;
  const gentleZ1 = 10 + gentleHoriz;
  const gentleSurfaces = rampQuad(-2.5, 2.5, gentleZ0, 0, gentleZ1, rampHeight);
  surfaces.push(...gentleSurfaces);
  group.add(meshFromSurfaces(gentleSurfaces, COL_RAMP));

  // ── 3. Platform C ──────────────────────────────────────────────────
  const platCSurfaces = floorQuad(-2.5, gentleZ1, 2.5, gentleZ1 + 5, rampHeight);
  surfaces.push(...platCSurfaces);
  group.add(meshFromSurfaces(platCSurfaces, COL_PLATFORM));

  // ── 4. Gap platforms D & E along +X ────────────────────────────────
  const platDSurfaces = floorQuad(12, -2, 16, 2, 0);
  surfaces.push(...platDSurfaces);
  group.add(meshFromSurfaces(platDSurfaces, COL_PLATFORM));

  const platESurfaces = floorQuad(19, -2, 23, 2, 0);
  surfaces.push(...platESurfaces);
  group.add(meshFromSurfaces(platESurfaces, COL_PLATFORM));

  // ── 5. Steep ramp (60°) along −X ──────────────────────────────────
  const steepHoriz = rampHeight / Math.tan((60 * Math.PI) / 180); // ≈ 2.31
  // Ramp going from X=−10 outward to X=−10−steepHoriz, rising to Y=4
  const steepSurfaces = rampQuadX(-10, 0, -10 - steepHoriz, rampHeight, -2, 2);
  surfaces.push(...steepSurfaces);
  group.add(meshFromSurfaces(steepSurfaces, COL_STEEP));

  // ── 6. Slippery patch ─────────────────────────────────────────────
  const slipSurfaces = floorQuad(4, 4, 7, 7, 0.001, SurfaceType.SLIPPERY);
  surfaces.push(...slipSurfaces);
  group.add(meshFromSurfaces(slipSurfaces, COL_SLIPPERY));

  // ── 7. Water pool recess (visual only) ─────────────────────────────
  //   Floor at Y=−2, 6×6 at X=−8..−2, Z=−8..−2
  const poolFloorSurfaces = floorQuad(-8, -8, -2, -2, -2);
  // Pool walls (vertical, visual / collision)
  const poolWalls = [
    ...wallQuad(-8, -8, -2, -8, -2, 0), // south wall
    ...wallQuad(-2, -8, -2, -2, -2, 0), // east wall
    ...wallQuad(-2, -2, -8, -2, -2, 0), // north wall
    ...wallQuad(-8, -2, -8, -8, -2, 0), // west wall
  ];
  // Pool floor is below the flat plane, so collision-wise the flat plane wins.
  // Add pool floor surfaces for future water behavior.
  surfaces.push(...poolFloorSurfaces);
  surfaces.push(...poolWalls);
  group.add(meshFromSurfaces(poolFloorSurfaces, COL_WATER_FLOOR));
  group.add(meshFromSurfaces(poolWalls, COL_WATER_FLOOR));
  // Water surface (transparent, visual only → no collision surface)
  const waterSurfaceVerts = floorQuad(-8, -8, -2, -2, 0);
  group.add(
    meshFromSurfaces(waterSurfaceVerts, COL_WATER_SURFACE, {
      transparent: true,
      opacity: 0.4,
    }),
  );

  // ── 8. Death plane (invisible) ─────────────────────────────────────
  const deathSurfaces = floorQuad(-100, -100, 100, 100, -5);
  surfaces.push(...deathSurfaces);
  // No mesh — invisible

  // ── Grid overlay ───────────────────────────────────────────────────
  //   Covers 20×20 flat plane, lines every 2 units (200 SM64 units)
  const gridOverlay = new THREE.GridHelper(20, 10, 0x444444, 0x444444);
  gridOverlay.position.y = 0.01; // Slight offset to avoid z-fighting
  gridOverlay.visible = false; // Hidden by default, toggleable

  group.add(gridOverlay);

  return { surfaces, group, gridOverlay };
}
