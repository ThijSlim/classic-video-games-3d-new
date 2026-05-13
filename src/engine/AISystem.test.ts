import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import { Entity } from './Entity';
import { Transform } from './Transform';
import { Velocity } from './Velocity';
import { PatrolAI } from './PatrolAI';
import { AISystem } from './AISystem';
import { GameState } from './GameState';

describe('AISystem', () => {
  function setup(waypointA?: THREE.Vector3, waypointB?: THREE.Vector3) {
    const state = new GameState();
    const ai = new AISystem();

    const entity = new Entity();
    const transform = entity.addComponent(new Transform());
    const velocity = entity.addComponent(new Velocity());
    const patrol = entity.addComponent(
      new PatrolAI(
        waypointA ?? new THREE.Vector3(0, 0, 0),
        waypointB ?? new THREE.Vector3(4, 0, 0),
        0.1,
        0.5,
      ),
    );
    state.addEntity('enemy', entity);

    return { state, ai, entity, transform, velocity, patrol };
  }

  it('moves entity toward current waypoint', () => {
    const { state, ai, transform, velocity } = setup();
    transform.position.set(0, 0, 0);

    ai.tick(state);

    // Should move toward waypoint B (4, 0, 0)
    expect(velocity.linear.x).toBeCloseTo(0.1);
    expect(velocity.linear.z).toBeCloseTo(0);
  });

  it('flips direction when reaching waypoint', () => {
    const { state, ai, transform, velocity, patrol } = setup();
    // Set target to waypoint B (index 1, at x=4)
    patrol.currentTargetIndex = 1;
    // Place entity very close to waypoint B
    transform.position.set(3.8, 0, 0);

    ai.tick(state);

    // Should have flipped to target index 0 (waypoint A at 0,0,0) since
    // dist ≈ 0.2 < threshold 0.5
    expect(patrol.currentTargetIndex).toBe(0);
    // Velocity should aim toward waypoint A
    expect(velocity.linear.x).toBeLessThan(0);
  });

  it('ignores entities without PatrolAI', () => {
    const state = new GameState();
    const ai = new AISystem();

    const entity = new Entity();
    entity.addComponent(new Transform());
    entity.addComponent(new Velocity());
    // No PatrolAI
    state.addEntity('noAI', entity);

    // Should not throw
    ai.tick(state);
  });

  it('ignores entities without required components', () => {
    const state = new GameState();
    const ai = new AISystem();

    const entity = new Entity();
    entity.addComponent(
      new PatrolAI(
        new THREE.Vector3(0, 0, 0),
        new THREE.Vector3(4, 0, 0),
        0.1,
      ),
    );
    // Missing Transform and Velocity
    state.addEntity('partialAI', entity);

    // Should not throw
    ai.tick(state);
  });

  it('patrols along Z axis', () => {
    const { state, ai, transform, velocity } = setup(
      new THREE.Vector3(5, 0, 0),
      new THREE.Vector3(5, 0, 4),
    );
    transform.position.set(5, 0, 0);

    ai.tick(state);

    expect(velocity.linear.x).toBeCloseTo(0);
    expect(velocity.linear.z).toBeCloseTo(0.1);
  });
});
