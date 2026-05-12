import { describe, it, expect } from 'vitest';
import { Action } from './Action';
import { InputSystem } from './InputSystem';
import { Transform } from './Transform';
import { Velocity } from './Velocity';
import {
  PlayerController,
  ActionStateName,
  MAX_WALK_SPEED,
  MAX_RUN_SPEED,
} from './PlayerController';

// ── Helpers ─────────────────────────────────────────────────────────────

/** Create a mock InputSystem that returns preset action values. */
function mockInput(
  values: Partial<Record<Action, number>> = {},
): InputSystem {
  return {
    getAction(action: Action) {
      return {
        value: values[action] ?? 0,
        justPressed: false,
        justReleased: false,
      };
    },
  } as unknown as InputSystem;
}

function createController() {
  const ctrl = new PlayerController();
  const velocity = new Velocity();
  const transform = new Transform();
  return { ctrl, velocity, transform };
}

// ── Tests ────────────────────────────────────────────────────────────────

describe('PlayerController', () => {
  it('starts in Idle state', () => {
    const { ctrl } = createController();
    expect(ctrl.actionState).toBe(ActionStateName.Idle);
  });

  // ── Idle → Walking ─────────────────────────────────────────────────

  it('transitions to Walking when input magnitude is below walk threshold', () => {
    const { ctrl, velocity, transform } = createController();

    // Small analog input → speed < MAX_WALK_SPEED
    const smallMag = (MAX_WALK_SPEED / MAX_RUN_SPEED) * 0.5; // half-way to walk threshold
    const input = mockInput({ [Action.MoveX]: smallMag });

    ctrl.tick(input, velocity, transform);

    expect(ctrl.actionState).toBe(ActionStateName.Walking);
  });

  // ── Walking → Running ─────────────────────────────────────────────

  it('transitions to Running when input magnitude exceeds walk threshold', () => {
    const { ctrl, velocity, transform } = createController();

    // Full digital input → speed = MAX_RUN_SPEED ≥ MAX_WALK_SPEED
    const input = mockInput({ [Action.MoveZ]: -1 });

    ctrl.tick(input, velocity, transform);

    expect(ctrl.actionState).toBe(ActionStateName.Running);
  });

  // ── Any → Decelerating on input release ────────────────────────────

  it('transitions to Decelerating when input is released while moving', () => {
    const { ctrl, velocity, transform } = createController();

    // First, get into Running
    ctrl.tick(mockInput({ [Action.MoveZ]: -1 }), velocity, transform);
    expect(ctrl.actionState).toBe(ActionStateName.Running);

    // Release input — velocity is still non-zero from the previous tick
    ctrl.tick(mockInput(), velocity, transform);

    expect(ctrl.actionState).toBe(ActionStateName.Decelerating);
  });

  // ── Decelerating → Idle when stopped ───────────────────────────────

  it('transitions to Idle when velocity reaches zero with no input', () => {
    const { ctrl, velocity, transform } = createController();

    // Simulate: was Running, now decelerating, velocity has been
    // reduced to zero by PhysicsSystem.
    ctrl.actionState = ActionStateName.Decelerating;
    velocity.linear.set(0, 0, 0);

    ctrl.tick(mockInput(), velocity, transform);

    expect(ctrl.actionState).toBe(ActionStateName.Idle);
  });

  // ── Any → Crouching ───────────────────────────────────────────────

  it('transitions to Crouching when crouch input is held', () => {
    const { ctrl, velocity, transform } = createController();

    // Get moving first
    ctrl.tick(mockInput({ [Action.MoveZ]: -1 }), velocity, transform);
    expect(ctrl.actionState).toBe(ActionStateName.Running);

    // Hold crouch
    ctrl.tick(
      mockInput({ [Action.Crouch]: 1 }),
      velocity,
      transform,
    );

    expect(ctrl.actionState).toBe(ActionStateName.Crouching);
    expect(velocity.linear.x).toBe(0);
    expect(velocity.linear.z).toBe(0);
  });

  it('returns to Idle from Crouching when crouch is released with no input', () => {
    const { ctrl, velocity, transform } = createController();

    ctrl.tick(mockInput({ [Action.Crouch]: 1 }), velocity, transform);
    expect(ctrl.actionState).toBe(ActionStateName.Crouching);

    ctrl.tick(mockInput(), velocity, transform);
    expect(ctrl.actionState).toBe(ActionStateName.Idle);
  });

  // ── Velocity magnitude ────────────────────────────────────────────

  it('sets velocity proportional to analog input magnitude', () => {
    const { ctrl, velocity, transform } = createController();

    const inputMag = 0.5;
    ctrl.tick(mockInput({ [Action.MoveX]: inputMag }), velocity, transform);

    const speed = Math.sqrt(velocity.linear.x ** 2 + velocity.linear.z ** 2);
    expect(speed).toBeCloseTo(inputMag * MAX_RUN_SPEED);
  });

  it('clamps input magnitude to 1 for diagonal digital input', () => {
    const { ctrl, velocity, transform } = createController();

    ctrl.tick(
      mockInput({ [Action.MoveX]: 1, [Action.MoveZ]: -1 }),
      velocity,
      transform,
    );

    const speed = Math.sqrt(velocity.linear.x ** 2 + velocity.linear.z ** 2);
    // sqrt(1^2 + 1^2) > 1, but clamped to 1 → speed = MAX_RUN_SPEED
    expect(speed).toBeCloseTo(MAX_RUN_SPEED);
  });

  // ── Rotation ──────────────────────────────────────────────────────

  it('rotates to face the movement direction', () => {
    const { ctrl, velocity, transform } = createController();

    const input = mockInput({ [Action.MoveX]: 1 });

    // Tick enough times for smooth rotation to converge to target (π/2)
    for (let i = 0; i < 20; i++) {
      ctrl.tick(input, velocity, transform);
    }

    // Facing right → rotation.y ≈ π/2
    expect(transform.rotation.y).toBeCloseTo(Math.PI / 2, 1);
  });

  it('rotates smoothly toward new direction', () => {
    const { ctrl, velocity, transform } = createController();

    // Face forward first (rotation = 0)
    transform.rotation.y = 0;

    // Now move to the right (target angle ≈ π/2)
    ctrl.tick(mockInput({ [Action.MoveX]: 1 }), velocity, transform);

    // Should NOT snap to π/2 instantly — should increment by turn speed
    expect(transform.rotation.y).toBeGreaterThan(0);
    expect(transform.rotation.y).toBeLessThan(Math.PI / 2);
  });
});
