import { describe, it, expect } from 'vitest';
import { Entity } from './Entity';
import { Transform } from './Transform';
import { Velocity } from './Velocity';
import { GameState } from './GameState';
import { CommandDispatcher } from './Command';
import { PhysicsSystem } from './PhysicsSystem';
import {
  PlayerController,
  ActionStateName,
  GROUND_DECEL,
} from './PlayerController';

function setup(opts: { withController?: boolean } = {}) {
  const state = new GameState();
  const dispatcher = new CommandDispatcher(state);
  const system = new PhysicsSystem();

  const entity = new Entity();
  const transform = entity.addComponent(new Transform());
  const velocity = entity.addComponent(new Velocity());

  let controller: PlayerController | undefined;
  if (opts.withController) {
    controller = entity.addComponent(new PlayerController());
  }

  state.addEntity('player', entity);

  return { state, dispatcher, system, entity, transform, velocity, controller };
}

describe('PhysicsSystem', () => {
  // ── Velocity integration ──────────────────────────────────────────

  it('integrates velocity into position via MOVE command', () => {
    const { system, state, dispatcher, transform, velocity } = setup();

    velocity.linear.set(0.3, 0, -0.2);
    system.tick(state, dispatcher);

    expect(transform.position.x).toBeCloseTo(0.3);
    expect(transform.position.z).toBeCloseTo(-0.2);
  });

  it('accumulates position over multiple ticks', () => {
    const { system, state, dispatcher, transform, velocity } = setup();

    velocity.linear.set(0.1, 0, 0);
    system.tick(state, dispatcher);
    system.tick(state, dispatcher);
    system.tick(state, dispatcher);

    expect(transform.position.x).toBeCloseTo(0.3);
  });

  it('does not move entity when velocity is zero', () => {
    const { system, state, dispatcher, transform } = setup();

    system.tick(state, dispatcher);

    expect(transform.position.x).toBe(0);
    expect(transform.position.z).toBe(0);
  });

  it('does not alter Y position', () => {
    const { system, state, dispatcher, transform, velocity } = setup();

    transform.position.y = 5;
    velocity.linear.set(1, 0, 1);
    system.tick(state, dispatcher);

    expect(transform.position.y).toBe(5);
  });

  // ── Friction ──────────────────────────────────────────────────────

  it('applies friction when player is decelerating', () => {
    const { system, state, dispatcher, velocity, controller } = setup({
      withController: true,
    });

    const initialSpeed = 0.3;
    velocity.linear.set(initialSpeed, 0, 0);
    controller!.actionState = ActionStateName.Decelerating;

    system.tick(state, dispatcher);

    const newSpeed = Math.sqrt(
      velocity.linear.x ** 2 + velocity.linear.z ** 2,
    );
    expect(newSpeed).toBeCloseTo(initialSpeed - GROUND_DECEL);
  });

  it('zeroes velocity when speed falls below friction deceleration', () => {
    const { system, state, dispatcher, velocity, controller } = setup({
      withController: true,
    });

    // Speed smaller than GROUND_DECEL
    velocity.linear.set(GROUND_DECEL * 0.5, 0, 0);
    controller!.actionState = ActionStateName.Decelerating;

    system.tick(state, dispatcher);

    expect(velocity.linear.x).toBe(0);
    expect(velocity.linear.z).toBe(0);
  });

  it('decelerates to zero over multiple ticks', () => {
    const { system, state, dispatcher, velocity, controller } = setup({
      withController: true,
    });

    velocity.linear.set(0.06, 0, 0);
    controller!.actionState = ActionStateName.Decelerating;

    // Keep ticking until velocity reaches zero
    for (let i = 0; i < 100; i++) {
      system.tick(state, dispatcher);
      const speed = Math.sqrt(
        velocity.linear.x ** 2 + velocity.linear.z ** 2,
      );
      if (speed === 0) break;
    }

    expect(velocity.linear.x).toBe(0);
    expect(velocity.linear.z).toBe(0);
  });

  it('does not apply friction when player is running', () => {
    const { system, state, dispatcher, velocity, controller } = setup({
      withController: true,
    });

    velocity.linear.set(0.48, 0, 0);
    controller!.actionState = ActionStateName.Running;

    system.tick(state, dispatcher);

    // Velocity unchanged (friction only applies for Decelerating)
    expect(velocity.linear.x).toBe(0.48);
  });

  it('preserves velocity direction during friction', () => {
    const { system, state, dispatcher, velocity, controller } = setup({
      withController: true,
    });

    // Diagonal velocity
    velocity.linear.set(0.3, 0, 0.4);
    controller!.actionState = ActionStateName.Decelerating;

    const origAngle = Math.atan2(velocity.linear.z, velocity.linear.x);
    system.tick(state, dispatcher);
    const newAngle = Math.atan2(velocity.linear.z, velocity.linear.x);

    expect(newAngle).toBeCloseTo(origAngle);
  });
});
