import * as THREE from 'three';

// ── Surface types ──────────────────────────────────────────────────────

export enum SurfaceType {
  DEFAULT = 'DEFAULT',
  SLIPPERY = 'SLIPPERY',
}

export enum SurfaceClass {
  FLOOR = 'FLOOR',
  WALL = 'WALL',
  CEILING = 'CEILING',
}

/**
 * Floor/wall threshold on normal.y.
 * cos(60°) = 0.5 falls below this → WALL.
 * cos(30°) ≈ 0.866 exceeds this → FLOOR.
 */
export const FLOOR_THRESHOLD = 0.6;

export function classifySurface(normalY: number): SurfaceClass {
  if (normalY > FLOOR_THRESHOLD) return SurfaceClass.FLOOR;
  if (normalY < -0.01) return SurfaceClass.CEILING;
  return SurfaceClass.WALL;
}

// ── Surface data structure ─────────────────────────────────────────────

export interface Surface {
  readonly v0: THREE.Vector3;
  readonly v1: THREE.Vector3;
  readonly v2: THREE.Vector3;
  readonly normal: THREE.Vector3;
  readonly surfaceType: SurfaceType;
  readonly surfaceClass: SurfaceClass;
}

/**
 * Create a Surface from three vertices.
 * Normal is computed via cross(v1−v0, v2−v0).
 * Choose vertex winding so the normal points outward / upward.
 */
export function createSurface(
  v0: THREE.Vector3,
  v1: THREE.Vector3,
  v2: THREE.Vector3,
  surfaceType: SurfaceType = SurfaceType.DEFAULT,
): Surface {
  const edge1 = new THREE.Vector3().subVectors(v1, v0);
  const edge2 = new THREE.Vector3().subVectors(v2, v0);
  const normal = new THREE.Vector3().crossVectors(edge1, edge2).normalize();

  return {
    v0: v0.clone(),
    v1: v1.clone(),
    v2: v2.clone(),
    normal,
    surfaceType,
    surfaceClass: classifySurface(normal.y),
  };
}
