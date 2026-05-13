import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import { Simulation } from './Simulation';
import { Entity } from './Entity';
import { Transform } from './Transform';
import { Velocity } from './Velocity';
import { PlayerController, ActionGroup, ActionStateName } from './PlayerController';
import { Collider } from './Collider';
import { GameState } from './GameState';
import { CommandDispatcher } from './Command';
import { InputSystem } from './InputSystem';
import { AISystem } from './AISystem';
import { PhysicsSystem } from './PhysicsSystem';
import { CollisionSystem } from './CollisionSystem';
import { DeathPlaneSystem } from './DeathPlaneSystem';
import { createSurface } from './Surface';

const SPAWN = { x: 0, y: 0.5, z: 0 };
const DEATH_Y = -20;

function setupSimulation() {
  const state = new GameState();
  const dispatcher = new CommandDispatcher(state);

  const player = new Entity();
  const transform = player.addComponent(new Transform());
  const velocity = player.addComponent(new Velocity());
  const ctrl = player.addComponent(new PlayerController());
  player.addComponent(Collider.cylinder(0.37, 1.6));
  state.addEntity('player', player);

  const inputSystem = new InputSystem();
  const collisionSystem = new CollisionSystem();
  const deathPlaneSystem = new DeathPlaneSystem(DEATH_Y, SPAWN);

  const sim = new Simulation({
    inputSystem,
    gameState: state,
    dispatcher,
    playerEntityId: 'player',
    aiSystem: new AISystem(),
    physicsSystem: new PhysicsSystem(),
    collisionSystem,
    deathPlaneSystem,
  });

  return { sim, state, dispatcher, transform, velocity, ctrl, collisionSystem };
}

function flatFloor(): ReturnType<typeof createSurface>[] {
  return [
    createSurface(
      new THREE.Vector3(-10, 0, -10),
      new THREE.Vector3(-10, 0, 10),
      new THREE.Vector3(10, 0, -10),
    ),
    createSurface(
      new THREE.Vector3(-10, 0, 10),
      new THREE.Vector3(10, 0, 10),
      new THREE.Vector3(10, 0, -10),
    ),
  ];
}

describe('Simulation', () => {
  // ── Tick ordering — Physics before Collision ──────────────────────

  it('integrates velocity into position across one tick', () => {
    const { sim, velocity, transform, ctrl } = setupSimulation();

    // Use Airborne so PhysicsSystem does not apply friction before integration
    ctrl.actionGroup = ActionGroup.Airborne;
    ctrl.actionState = ActionStateName.Falling;
    velocity.linear.set(0.3, 0, -0.2);
    sim.tick();

    expect(transform.position.x).toBeCloseTo(0.3);
    expect(transform.position.z).toBeCloseTo(-0.2);
  });

  it('lands player on floor — CollisionSystem runs after PhysicsSystem', () => {
    const { sim, transform, velocity, ctrl, collisionSystem } = setupSimulation();
    collisionSystem.setSurfaces(flatFloor());

    // Start just above floor, falling
    ctrl.actionGroup = ActionGroup.Airborne;
    ctrl.actionState = ActionStateName.Falling;
    transform.position.set(0, 0.001, 0);
    velocity.linear.y = -0.1;

    sim.tick();

    // CollisionSystem detected the floor, resolveContacts ran, PlayerController landed
    expect(transform.position.y).toBeCloseTo(0, 2);
    expect(ctrl.actionGroup).toBe(ActionGroup.Grounded);
    expect(ctrl.actionState).toBe(ActionStateName.Idle);
  });

  // ── resolveContacts wired correctly ──────────────────────────────

  it('starts falling when no floor is detected while grounded', () => {
    const { sim, ctrl } = setupSimulation();
    // No surfaces — CollisionSystem reports lostGround
    expect(ctrl.actionGroup).toBe(ActionGroup.Grounded);

    sim.tick();

    expect(ctrl.actionGroup).toBe(ActionGroup.Airborne);
    expect(ctrl.actionState).toBe(ActionStateName.Falling);
  });

  // ── DeathPlane wired correctly ────────────────────────────────────

  it('respawns player when below death plane', () => {
    const { sim, transform } = setupSimulation();
    transform.position.set(0, -25, 0);

    sim.tick();

    expect(transform.position.y).toBe(SPAWN.y);
  });

  it('does not respawn player above death plane', () => {
    const { sim, transform } = setupSimulation();
    transform.position.set(0, 5, 0);

    sim.tick();

    expect(transform.position.y).not.toBe(SPAWN.y);
  });
});
