import * as THREE from 'three';
import { Surface, SurfaceClass, SurfaceType } from './Surface';
import { GameState } from './GameState';
import { CommandDispatcher } from './Command';
import { Collider, ColliderShape } from './Collider';
import { Transform } from './Transform';
import { Velocity } from './Velocity';
import { PlayerController, ActionGroup, KNOCKBACK_UP_VEL, KNOCKBACK_HORIZONTAL_SPEED, ContactResult } from './PlayerController';
import { WaterVolume, isInWaterVolume } from './WaterVolume';
import { EnemyTag } from './EnemyTag';

// ── Geometry helpers ───────────────────────────────────────────────────

/**
 * Check whether (px, pz) lies inside triangle (v0, v1, v2)
 * projected onto the XZ plane using barycentric coordinates.
 */
export function pointInTriangleXZ(
  px: number,
  pz: number,
  v0: THREE.Vector3,
  v1: THREE.Vector3,
  v2: THREE.Vector3,
): boolean {
  const d0x = v1.x - v0.x,
    d0z = v1.z - v0.z;
  const d1x = v2.x - v0.x,
    d1z = v2.z - v0.z;
  const d2x = px - v0.x,
    d2z = pz - v0.z;

  const dot00 = d0x * d0x + d0z * d0z;
  const dot01 = d0x * d1x + d0z * d1z;
  const dot02 = d0x * d2x + d0z * d2z;
  const dot11 = d1x * d1x + d1z * d1z;
  const dot12 = d1x * d2x + d1z * d2z;

  const denom = dot00 * dot11 - dot01 * dot01;
  if (Math.abs(denom) < 1e-10) return false;

  const inv = 1 / denom;
  const u = (dot11 * dot02 - dot01 * dot12) * inv;
  const v = (dot00 * dot12 - dot01 * dot02) * inv;

  return u >= -1e-6 && v >= -1e-6 && u + v <= 1 + 1e-6;
}

/**
 * Compute Y on a surface's plane at (px, pz).
 * Uses the plane equation: n·(P − v0) = 0.
 */
function computeYOnSurface(
  surface: Surface,
  px: number,
  pz: number,
): number {
  const { normal, v0 } = surface;
  if (Math.abs(normal.y) < 1e-10) return NaN;
  const d = -(normal.x * v0.x + normal.y * v0.y + normal.z * v0.z);
  return -(normal.x * px + normal.z * pz + d) / normal.y;
}

/** Distance from point (px, pz) to line segment (ax,az)-(bx,bz) in XZ. */
function distToSegmentXZ(
  px: number,
  pz: number,
  ax: number,
  az: number,
  bx: number,
  bz: number,
): number {
  const dx = bx - ax,
    dz = bz - az;
  const len2 = dx * dx + dz * dz;
  if (len2 < 1e-10) {
    const ex = px - ax,
      ez = pz - az;
    return Math.sqrt(ex * ex + ez * ez);
  }
  let t = ((px - ax) * dx + (pz - az) * dz) / len2;
  t = Math.max(0, Math.min(1, t));
  const cx = ax + t * dx - px;
  const cz = az + t * dz - pz;
  return Math.sqrt(cx * cx + cz * cz);
}

function distToTriangleEdgeXZ(
  px: number,
  pz: number,
  surface: Surface,
): number {
  const edges = [
    [surface.v0, surface.v1],
    [surface.v1, surface.v2],
    [surface.v2, surface.v0],
  ] as const;

  let minDist = Infinity;
  for (const [a, b] of edges) {
    const dist = distToSegmentXZ(px, pz, a.x, a.z, b.x, b.z);
    if (dist < minDist) minDist = dist;
  }
  return minDist;
}

// ── Query functions ────────────────────────────────────────────────────

export interface FloorResult {
  y: number;
  surface: Surface;
}

export interface CeilResult {
  y: number;
  surface: Surface;
}

export interface WallResult {
  pushX: number;
  pushZ: number;
  surface: Surface;
}

/** Step-up tolerance: player can step onto floors up to 1 unit above feet. */
const STEP_UP = 1;

/**
 * Find the highest floor surface at (x, z) that is at or below y + STEP_UP.
 */
export function findFloor(
  x: number,
  y: number,
  z: number,
  surfaces: readonly Surface[],
): FloorResult | null {
  let best: FloorResult | null = null;

  for (const surface of surfaces) {
    if (surface.surfaceClass !== SurfaceClass.FLOOR) continue;
    if (!pointInTriangleXZ(x, z, surface.v0, surface.v1, surface.v2)) continue;

    const surfaceY = computeYOnSurface(surface, x, z);
    if (isNaN(surfaceY)) continue;
    if (surfaceY > y + STEP_UP) continue;

    if (best === null || surfaceY > best.y) {
      best = { y: surfaceY, surface };
    }
  }

  return best;
}

/**
 * Find the lowest ceiling surface above the entity head (y + height).
 */
export function findCeil(
  x: number,
  y: number,
  z: number,
  height: number,
  surfaces: readonly Surface[],
): CeilResult | null {
  let best: CeilResult | null = null;

  for (const surface of surfaces) {
    if (surface.surfaceClass !== SurfaceClass.CEILING) continue;
    if (!pointInTriangleXZ(x, z, surface.v0, surface.v1, surface.v2)) continue;

    const surfaceY = computeYOnSurface(surface, x, z);
    if (isNaN(surfaceY)) continue;

    if (surfaceY >= y && surfaceY <= y + height) {
      if (best === null || surfaceY < best.y) {
        best = { y: surfaceY, surface };
      }
    }
  }

  return best;
}

/**
 * Find wall push-out vectors for a cylinder at (x, y, z) with given
 * radius and height.
 */
export function findWalls(
  x: number,
  y: number,
  z: number,
  radius: number,
  height: number,
  surfaces: readonly Surface[],
): WallResult[] {
  const results: WallResult[] = [];

  for (const surface of surfaces) {
    if (surface.surfaceClass !== SurfaceClass.WALL) continue;

    // Check vertical overlap
    const triMinY = Math.min(surface.v0.y, surface.v1.y, surface.v2.y);
    const triMaxY = Math.max(surface.v0.y, surface.v1.y, surface.v2.y);
    if (y + height <= triMinY || y >= triMaxY) continue;

    // Signed distance from cylinder center to wall plane
    const dist =
      surface.normal.x * (x - surface.v0.x) +
      surface.normal.y * (y + height / 2 - surface.v0.y) +
      surface.normal.z * (z - surface.v0.z);

    // Only handle penetration from the front side
    if (dist >= radius || dist < -radius * 0.5) continue;

    // Check proximity to triangle in XZ
    const projX = x - surface.normal.x * dist;
    const projZ = z - surface.normal.z * dist;

    const inTriangle = pointInTriangleXZ(
      projX,
      projZ,
      surface.v0,
      surface.v1,
      surface.v2,
    );
    const nearEdge =
      !inTriangle && distToTriangleEdgeXZ(x, z, surface) < radius;

    if (inTriangle || nearEdge) {
      const pushDist = radius - dist;
      // Push along wall normal's XZ projection
      const nx = surface.normal.x;
      const nz = surface.normal.z;
      const nxzLen = Math.sqrt(nx * nx + nz * nz);
      if (nxzLen < 1e-6) continue;

      results.push({
        pushX: (nx / nxzLen) * pushDist,
        pushZ: (nz / nxzLen) * pushDist,
        surface,
      });
    }
  }

  return results;
}

// ── CollisionSystem ────────────────────────────────────────────────────

export class CollisionSystem {
  private surfaces: Surface[] = [];
  private waterVolumes: WaterVolume[] = [];

  setSurfaces(surfaces: Surface[]): void {
    this.surfaces = surfaces;
  }

  setWaterVolumes(volumes: WaterVolume[]): void {
    this.waterVolumes = volumes;
  }

  getSurfaces(): readonly Surface[] {
    return this.surfaces;
  }

  tick(gameState: GameState, dispatcher: CommandDispatcher): Map<string, ContactResult> {
    const contactMap = new Map<string, ContactResult>();
    for (const [id, entity] of gameState.allEntities()) {
      if (!entity.hasComponent(Collider) || !entity.hasComponent(Transform))
        continue;

      const collider = entity.getComponent(Collider);
      const transform = entity.getComponent(Transform);
      const pos = transform.position;

      // ── Floor collision ──────────────────────────────────────────────
      const floor = findFloor(pos.x, pos.y, pos.z, this.surfaces);
      collider.currentFloor = floor?.surface ?? null;

      const hasCtrl = entity.hasComponent(PlayerController);
      const ctrl = hasCtrl ? entity.getComponent(PlayerController) : null;

      let contact: ContactResult | null = ctrl
        ? { landed: false, landedFromKnockback: false, lostGround: false, enteredWater: false, exitedWater: false, exitedWaterWithFloor: false, damage: null }
        : null;

      if (floor !== null) {
        // Landing detection: airborne player with downward velocity hits floor
        if (ctrl && ctrl.actionGroup === ActionGroup.Airborne) {
          const vel = entity.hasComponent(Velocity)
            ? entity.getComponent(Velocity)
            : null;
          if (vel && vel.linear.y <= 0 && pos.y <= floor.y + 1e-3) {
            vel.linear.y = 0;
            if (contact) contact.landed = true;
            // Snap to floor
            const dy = floor.y - pos.y;
            if (Math.abs(dy) > 1e-6) {
              dispatcher.dispatch({
                type: 'MOVE',
                entityId: id,
                dx: 0,
                dy,
                dz: 0,
              });
            }
          } else {
            // Still airborne above the floor — don't snap
          }
        } else if (ctrl && ctrl.actionGroup === ActionGroup.Knockback) {
          // Knockback landing
          const vel = entity.hasComponent(Velocity)
            ? entity.getComponent(Velocity)
            : null;
          if (vel && vel.linear.y <= 0 && pos.y <= floor.y + 1e-3) {
            vel.linear.y = 0;
            vel.linear.x = 0;
            vel.linear.z = 0;
            if (contact) contact.landedFromKnockback = true;
            const dy = floor.y - pos.y;
            if (Math.abs(dy) > 1e-6) {
              dispatcher.dispatch({
                type: 'MOVE',
                entityId: id,
                dx: 0,
                dy,
                dz: 0,
              });
            }
          }
        } else if (ctrl && ctrl.actionGroup === ActionGroup.Submerged) {
          // Submerged: snap to pool floor if sinking below it
          const vel = entity.hasComponent(Velocity)
            ? entity.getComponent(Velocity)
            : null;
          if (vel && vel.linear.y <= 0 && pos.y <= floor.y + 1e-3) {
            vel.linear.y = 0;
            const dy = floor.y - pos.y;
            if (Math.abs(dy) > 1e-6) {
              dispatcher.dispatch({
                type: 'MOVE',
                entityId: id,
                dx: 0,
                dy,
                dz: 0,
              });
            }
          }
        } else {
          // Grounded snapping
          const dy = floor.y - pos.y;
          if (Math.abs(dy) > 1e-6) {
            dispatcher.dispatch({
              type: 'MOVE',
              entityId: id,
              dx: 0,
              dy,
              dz: 0,
            });
          }
        }
      } else {
        // No floor detected
        if (ctrl && ctrl.actionGroup === ActionGroup.Grounded) {
          if (contact) contact.lostGround = true;
        }
      }

      // ── Wall collision ───────────────────────────────────────────────
      const walls = findWalls(
        pos.x,
        pos.y,
        pos.z,
        collider.radius,
        collider.height,
        this.surfaces,
      );
      for (const wall of walls) {
        if (Math.abs(wall.pushX) > 1e-6 || Math.abs(wall.pushZ) > 1e-6) {
          dispatcher.dispatch({
            type: 'MOVE',
            entityId: id,
            dx: wall.pushX,
            dy: 0,
            dz: wall.pushZ,
          });
        }
      }

      // ── Ceiling collision ────────────────────────────────────────────
      if (entity.hasComponent(Velocity)) {
        const ceil = findCeil(
          pos.x,
          pos.y,
          pos.z,
          collider.height,
          this.surfaces,
        );
        if (ceil !== null) {
          const vel = entity.getComponent(Velocity);
          if (vel.linear.y > 0) {
            vel.linear.y = 0;
          }
          const maxY = ceil.y - collider.height;
          if (pos.y > maxY) {
            dispatcher.dispatch({
              type: 'MOVE',
              entityId: id,
              dx: 0,
              dy: maxY - pos.y,
              dz: 0,
            });
          }
        }
      }

      // ── Water volume transition ────────────────────────────────────
      if (ctrl && contact) {
        const inWater = this.waterVolumes.some(v =>
          isInWaterVolume(pos.x, pos.y, pos.z, v),
        );

        if (inWater && ctrl.actionGroup !== ActionGroup.Submerged) {
          contact.enteredWater = true;
        } else if (!inWater && ctrl.actionGroup === ActionGroup.Submerged) {
          contact.exitedWater = true;
          contact.exitedWaterWithFloor = floor !== null;
        }
      }

      if (contact) {
        contactMap.set(id, contact);
      }
    }

    // ── Entity-vs-entity collision (player vs enemies) ───────────────
    this.checkEntityCollisions(gameState, dispatcher, contactMap);

    return contactMap;
  }

  /**
   * Check cylinder (player) vs sphere (enemy) overlap.
   * Stomp: player falling + bottom above enemy midpoint → defeat enemy + bounce.
   * Side: otherwise → knockback player.
   */
  private checkEntityCollisions(gameState: GameState, dispatcher: CommandDispatcher, contactMap: Map<string, ContactResult>): void {
    // Find player entity
    let playerId: string | null = null;
    let playerEntity: import('./Entity').Entity | null = null;

    for (const [id, entity] of gameState.allEntities()) {
      if (entity.hasComponent(PlayerController)) {
        playerId = id;
        playerEntity = entity;
        break;
      }
    }
    if (!playerId || !playerEntity) return;

    const ctrl = playerEntity.getComponent(PlayerController);
    // Don't check collisions while already in knockback
    if (ctrl.actionGroup === ActionGroup.Knockback) return;

    const playerTransform = playerEntity.getComponent(Transform);
    const playerCollider = playerEntity.getComponent(Collider);
    const playerVelocity = playerEntity.hasComponent(Velocity)
      ? playerEntity.getComponent(Velocity)
      : null;
    const playerPos = playerTransform.position;

    // Collect enemy entities to check (iterate a snapshot of IDs to avoid mutation issues)
    const enemies: [string, import('./Entity').Entity][] = [];
    for (const [id, entity] of gameState.allEntities()) {
      if (entity.hasComponent(EnemyTag) && entity.hasComponent(Transform) && entity.hasComponent(Collider)) {
        enemies.push([id, entity]);
      }
    }

    for (const [enemyId, enemyEntity] of enemies) {
      // Entity may have been removed by a prior stomp this tick
      if (!gameState.getEntity(enemyId)) continue;

      const enemyTransform = enemyEntity.getComponent(Transform);
      const enemyCollider = enemyEntity.getComponent(Collider);
      const enemyPos = enemyTransform.position;

      // Cylinder vs sphere overlap check
      const dx = playerPos.x - enemyPos.x;
      const dz = playerPos.z - enemyPos.z;
      const horizontalDist = Math.sqrt(dx * dx + dz * dz);
      const combinedRadius = playerCollider.radius + enemyCollider.radius;

      if (horizontalDist >= combinedRadius) continue;

      // Vertical overlap check: player cylinder is [playerPos.y, playerPos.y + height]
      // Enemy sphere center is at enemyPos.y + enemyCollider.radius (center)
      const enemyCenterY = enemyPos.y + enemyCollider.radius;
      const playerBottom = playerPos.y;
      const playerTop = playerPos.y + playerCollider.height;
      const enemyBottom = enemyCenterY - enemyCollider.radius;
      const enemyTop = enemyCenterY + enemyCollider.radius;

      if (playerBottom > enemyTop || playerTop < enemyBottom) continue;

      // Collision detected — determine stomp vs side
      const isStomp =
        playerVelocity !== null &&
        playerVelocity.linear.y < 0 &&
        playerBottom > enemyCenterY;

      if (isStomp) {
        // Defeat enemy and bounce player
        dispatcher.dispatch({ type: 'DEFEAT_ENEMY', entityId: enemyId });
        if (playerVelocity) {
          playerVelocity.linear.y = KNOCKBACK_UP_VEL;
        }
      } else {
        // Side collision — knockback player
        const dist = horizontalDist > 1e-6 ? horizontalDist : 1;
        const knockX = (dx / dist) * KNOCKBACK_HORIZONTAL_SPEED;
        const knockZ = (dz / dist) * KNOCKBACK_HORIZONTAL_SPEED;
        const playerContact = contactMap.get(playerId);
        if (playerContact) {
          playerContact.damage = { impulseX: knockX, impulseY: KNOCKBACK_UP_VEL, impulseZ: knockZ };
        }
        // Only one damage per tick
        break;
      }
    }
  }
}
