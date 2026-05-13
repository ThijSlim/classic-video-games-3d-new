import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import {
  findFloor,
  findCeil,
  findWalls,
  pointInTriangleXZ,
  CollisionSystem,
} from './CollisionSystem';
import {
  Surface,
  SurfaceType,
  SurfaceClass,
  createSurface,
} from './Surface';
import { Entity } from './Entity';
import { Transform } from './Transform';
import { Velocity } from './Velocity';
import { Collider } from './Collider';
import { GameState } from './GameState';
import { CommandDispatcher } from './Command';
import { PlayerController, ActionGroup, ActionStateName } from './PlayerController';
import { WaterVolume } from './WaterVolume';

// ── Helpers ────────────────────────────────────────────────────────────

/** Create a flat floor quad (2 triangles) at the given height. */
function flatFloor(
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

/** Create a vertical wall quad (2 triangles). */
function verticalWall(
  x0: number,
  z0: number,
  x1: number,
  z1: number,
  y0: number,
  y1: number,
): Surface[] {
  const b0 = new THREE.Vector3(x0, y0, z0);
  const b1 = new THREE.Vector3(x1, y0, z1);
  const t0 = new THREE.Vector3(x0, y1, z0);
  const t1 = new THREE.Vector3(x1, y1, z1);
  return [createSurface(b0, t0, b1), createSurface(t0, t1, b1)];
}

// ── pointInTriangleXZ ──────────────────────────────────────────────────

describe('pointInTriangleXZ', () => {
  const v0 = new THREE.Vector3(0, 0, 0);
  const v1 = new THREE.Vector3(4, 0, 0);
  const v2 = new THREE.Vector3(0, 0, 4);

  it('returns true for point inside triangle', () => {
    expect(pointInTriangleXZ(1, 1, v0, v1, v2)).toBe(true);
  });

  it('returns true for point on vertex', () => {
    expect(pointInTriangleXZ(0, 0, v0, v1, v2)).toBe(true);
  });

  it('returns true for point on edge', () => {
    expect(pointInTriangleXZ(2, 0, v0, v1, v2)).toBe(true);
  });

  it('returns false for point outside triangle', () => {
    expect(pointInTriangleXZ(3, 3, v0, v1, v2)).toBe(false);
  });

  it('returns false for point far away', () => {
    expect(pointInTriangleXZ(10, 10, v0, v1, v2)).toBe(false);
  });
});

// ── findFloor ──────────────────────────────────────────────────────────

describe('findFloor', () => {
  it('returns correct Y for point above a flat floor', () => {
    const surfaces = flatFloor(-5, -5, 5, 5, 0);
    const result = findFloor(0, 1, 0, surfaces);
    expect(result).not.toBeNull();
    expect(result!.y).toBeCloseTo(0);
  });

  it('returns correct Y for point on the floor', () => {
    const surfaces = flatFloor(-5, -5, 5, 5, 3);
    const result = findFloor(0, 3, 0, surfaces);
    expect(result).not.toBeNull();
    expect(result!.y).toBeCloseTo(3);
  });

  it('returns null when no floor is below the point', () => {
    const surfaces = flatFloor(-5, -5, 5, 5, 10);
    // Floor is at Y=10, point is at Y=0, floor is above step-up
    const result = findFloor(0, 0, 0, surfaces);
    expect(result).toBeNull();
  });

  it('returns null when point is outside the triangle XZ bounds', () => {
    const surfaces = flatFloor(-5, -5, 5, 5, 0);
    const result = findFloor(20, 1, 20, surfaces);
    expect(result).toBeNull();
  });

  it('returns the highest floor when multiple floors exist', () => {
    const lower = flatFloor(-5, -5, 5, 5, 0);
    const upper = flatFloor(-5, -5, 5, 5, 2);
    const surfaces = [...lower, ...upper];
    const result = findFloor(0, 3, 0, surfaces);
    expect(result).not.toBeNull();
    expect(result!.y).toBeCloseTo(2);
  });

  it('finds floor on a 30° ramp at the correct Y', () => {
    // Ramp from Z=0,Y=0 to Z=6.93,Y=4
    const h = 4;
    const d = h / Math.tan((30 * Math.PI) / 180);
    const surfaces = [
      createSurface(
        new THREE.Vector3(-2.5, 0, 0),
        new THREE.Vector3(-2.5, h, d),
        new THREE.Vector3(2.5, 0, 0),
      ),
      createSurface(
        new THREE.Vector3(-2.5, h, d),
        new THREE.Vector3(2.5, h, d),
        new THREE.Vector3(2.5, 0, 0),
      ),
    ];
    // Midpoint of ramp: Z = d/2, expected Y = 2
    const result = findFloor(0, 5, d / 2, surfaces);
    expect(result).not.toBeNull();
    expect(result!.y).toBeCloseTo(2, 1);
  });

  it('includes SLIPPERY surface type in result', () => {
    const surfaces = flatFloor(-5, -5, 5, 5, 0, SurfaceType.SLIPPERY);
    const result = findFloor(0, 1, 0, surfaces);
    expect(result).not.toBeNull();
    expect(result!.surface.surfaceType).toBe(SurfaceType.SLIPPERY);
  });
});

// ── findCeil ───────────────────────────────────────────────────────────

describe('findCeil', () => {
  it('returns ceiling Y when entity head reaches ceiling', () => {
    // Ceiling at Y=3 (upside-down quad → downward-facing normal)
    const v00 = new THREE.Vector3(-5, 3, -5);
    const v10 = new THREE.Vector3(5, 3, -5);
    const v11 = new THREE.Vector3(5, 3, 5);
    const v01 = new THREE.Vector3(-5, 3, 5);
    // Reverse winding for downward normal
    const surfaces = [
      createSurface(v00, v10, v01),
      createSurface(v10, v11, v01),
    ];
    // Verify ceiling classification
    expect(surfaces[0].surfaceClass).toBe(SurfaceClass.CEILING);

    // Entity at Y=1 with height 2.5 → head at Y=3.5 → hits ceiling at Y=3
    const result = findCeil(0, 1, 0, 2.5, surfaces);
    expect(result).not.toBeNull();
    expect(result!.y).toBeCloseTo(3);
  });

  it('returns null when no ceiling is within range', () => {
    const v00 = new THREE.Vector3(-5, 10, -5);
    const v10 = new THREE.Vector3(5, 10, -5);
    const v01 = new THREE.Vector3(-5, 10, 5);
    const surfaces = [createSurface(v00, v10, v01)];

    // Entity at Y=0 with height 2 → head at Y=2, ceiling at Y=10
    const result = findCeil(0, 0, 0, 2, surfaces);
    expect(result).toBeNull();
  });
});

// ── findWalls (cylinder-triangle intersection) ─────────────────────────

describe('findWalls', () => {
  it('detects wall collision and returns push-out vector', () => {
    // Vertical wall at X=1, facing -X (toward the player)
    const walls = verticalWall(1, 5, 1, -5, 0, 3);
    // Verify wall classification
    expect(walls[0].surfaceClass).toBe(SurfaceClass.WALL);

    // Cylinder at X=0.8, radius 0.37 → penetrates wall from the front (-X side)
    const results = findWalls(0.8, 0, 0, 0.37, 1.6, walls);
    expect(results.length).toBeGreaterThan(0);
    // Push should be in -X direction (away from wall)
    expect(results[0].pushX).toBeLessThan(0);
  });

  it('returns empty when cylinder is far from wall', () => {
    const walls = verticalWall(5, -5, 5, 5, 0, 3);
    const results = findWalls(0, 0, 0, 0.37, 1.6, walls);
    expect(results.length).toBe(0);
  });

  it('returns empty when cylinder is above wall', () => {
    const walls = verticalWall(0.5, -5, 0.5, 5, 0, 1);
    // Cylinder at Y=5, wall goes from Y=0 to Y=1
    const results = findWalls(0.5, 5, 0, 0.37, 1.6, walls);
    expect(results.length).toBe(0);
  });
});

// ── CollisionSystem integration ────────────────────────────────────────

describe('CollisionSystem', () => {
  function setup() {
    const state = new GameState();
    const dispatcher = new CommandDispatcher(state);
    const system = new CollisionSystem();

    const entity = new Entity();
    const transform = entity.addComponent(new Transform());
    entity.addComponent(new Velocity());
    entity.addComponent(Collider.cylinder(0.37, 1.6));
    state.addEntity('player', entity);

    return { state, dispatcher, system, entity, transform };
  }

  it('snaps entity to floor height', () => {
    const { state, dispatcher, system, transform } = setup();

    const surfaces = flatFloor(-10, -10, 10, 10, 0);
    system.setSurfaces(surfaces);

    // Entity starts above floor
    transform.position.set(0, 5, 0);
    system.tick(state, dispatcher);

    expect(transform.position.y).toBeCloseTo(0);
  });

  it('snaps entity to ramp height correctly', () => {
    const { state, dispatcher, system, transform } = setup();

    const h = 4;
    const d = h / Math.tan((30 * Math.PI) / 180);
    const surfaces = [
      createSurface(
        new THREE.Vector3(-5, 0, 0),
        new THREE.Vector3(-5, h, d),
        new THREE.Vector3(5, 0, 0),
      ),
      createSurface(
        new THREE.Vector3(-5, h, d),
        new THREE.Vector3(5, h, d),
        new THREE.Vector3(5, 0, 0),
      ),
    ];
    system.setSurfaces(surfaces);

    // Place entity at midpoint of ramp
    transform.position.set(0, 5, d / 2);
    system.tick(state, dispatcher);

    expect(transform.position.y).toBeCloseTo(2, 1);
  });

  it('sets currentFloor on collider after tick', () => {
    const { state, dispatcher, system, entity, transform } = setup();

    const surfaces = flatFloor(-10, -10, 10, 10, 0, SurfaceType.SLIPPERY);
    system.setSurfaces(surfaces);

    transform.position.set(0, 1, 0);
    system.tick(state, dispatcher);

    const collider = entity.getComponent(Collider);
    expect(collider.currentFloor).not.toBeNull();
    expect(collider.currentFloor!.surfaceType).toBe(SurfaceType.SLIPPERY);
  });

  it('clears currentFloor when no floor is found', () => {
    const { state, dispatcher, system, entity, transform } = setup();

    system.setSurfaces([]);

    transform.position.set(0, 1, 0);
    system.tick(state, dispatcher);

    const collider = entity.getComponent(Collider);
    expect(collider.currentFloor).toBeNull();
  });

  // ── Water volume transitions ─────────────────────────────────────────

  it('transitions player to Submerged when inside water volume', () => {
    const { state, dispatcher, system, entity, transform } = setup();
    const ctrl = entity.addComponent(new PlayerController());

    const waterVolume: WaterVolume = {
      minX: -8, maxX: -2, minY: -2, maxY: 0,
      minZ: -8, maxZ: -2, surfaceY: 0,
    };
    system.setWaterVolumes([waterVolume]);
    system.setSurfaces(flatFloor(-8, -8, -2, -2, -2));

    // Place player inside the water volume
    transform.position.set(-5, -1, -5);
    system.tick(state, dispatcher);

    expect(ctrl.actionGroup).toBe(ActionGroup.Submerged);
    expect(ctrl.actionState).toBe(ActionStateName.WaterIdle);
  });

  it('transitions player out of Submerged when exiting water volume upward', () => {
    const { state, dispatcher, system, entity, transform } = setup();
    const ctrl = entity.addComponent(new PlayerController());
    ctrl.enterWater();

    const waterVolume: WaterVolume = {
      minX: -8, maxX: -2, minY: -2, maxY: 0,
      minZ: -8, maxZ: -2, surfaceY: 0,
    };
    system.setWaterVolumes([waterVolume]);
    system.setSurfaces(flatFloor(-10, -10, 10, 10, 0));

    // Place player above water surface
    transform.position.set(-5, 0.1, -5);
    system.tick(state, dispatcher);

    expect(ctrl.actionGroup).not.toBe(ActionGroup.Submerged);
  });
});
