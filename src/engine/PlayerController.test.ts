import { describe, it, expect } from 'vitest';
import { Action } from './Action';
import { InputSystem } from './InputSystem';
import { Transform } from './Transform';
import { Velocity } from './Velocity';
import {
  PlayerController,
  ActionGroup,
  ActionStateName,
  MAX_WALK_SPEED,
  MAX_RUN_SPEED,
  JUMP_VEL,
  DOUBLE_JUMP_VEL,
  TRIPLE_JUMP_VEL,
  GROUND_POUND_VEL,
  JUMP_SEQUENCE_WINDOW,
  COYOTE_TICKS,
  WATER_BOB_VEL,
  WATER_SPEED_FACTOR,
  KNOCKBACK_MAX_TICKS,
} from './PlayerController';

// ── Helpers ─────────────────────────────────────────────────────────────

/** Create a mock InputSystem that returns preset action values. */
function mockInput(
  values: Partial<Record<Action, number>> = {},
  justPressed: Partial<Record<Action, boolean>> = {},
): InputSystem {
  return {
    getAction(action: Action) {
      return {
        value: values[action] ?? 0,
        justPressed: justPressed[action] ?? false,
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

  // ── Jumping ──────────────────────────────────────────────────────────

  it('transitions from Grounded to Jumping on Jump press', () => {
    const { ctrl, velocity, transform } = createController();

    ctrl.tick(
      mockInput({ [Action.Jump]: 1 }, { [Action.Jump]: true }),
      velocity,
      transform,
    );

    expect(ctrl.actionGroup).toBe(ActionGroup.Airborne);
    expect(ctrl.actionState).toBe(ActionStateName.Jumping);
    expect(velocity.linear.y).toBe(JUMP_VEL);
  });

  it('sets correct jump velocity for normal jump', () => {
    const { ctrl, velocity, transform } = createController();

    ctrl.tick(
      mockInput({ [Action.Jump]: 1 }, { [Action.Jump]: true }),
      velocity,
      transform,
    );

    expect(velocity.linear.y).toBeCloseTo(JUMP_VEL);
  });

  // ── Double Jump ──────────────────────────────────────────────────────

  it('transitions to DoubleJumping on second jump within window while moving', () => {
    const { ctrl, velocity, transform } = createController();

    // First jump
    ctrl.tick(
      mockInput({ [Action.Jump]: 1 }, { [Action.Jump]: true }),
      velocity,
      transform,
    );
    expect(ctrl.actionState).toBe(ActionStateName.Jumping);

    // Simulate landing
    ctrl.land();
    expect(ctrl.actionGroup).toBe(ActionGroup.Grounded);

    // Give horizontal velocity (moving)
    velocity.linear.x = 0.2;

    // Jump again within window (ticksSinceLanding starts at 0 after land)
    ctrl.tick(
      mockInput({ [Action.MoveX]: 1, [Action.Jump]: 1 }, { [Action.Jump]: true }),
      velocity,
      transform,
    );

    expect(ctrl.actionGroup).toBe(ActionGroup.Airborne);
    expect(ctrl.actionState).toBe(ActionStateName.DoubleJumping);
    expect(velocity.linear.y).toBe(DOUBLE_JUMP_VEL);
  });

  // ── Triple Jump ──────────────────────────────────────────────────────

  it('transitions to TripleJumping on third sequential jump while moving', () => {
    const { ctrl, velocity, transform } = createController();

    // First jump
    velocity.linear.x = 0.2;
    ctrl.tick(
      mockInput({ [Action.MoveX]: 1, [Action.Jump]: 1 }, { [Action.Jump]: true }),
      velocity,
      transform,
    );
    expect(ctrl.actionState).toBe(ActionStateName.Jumping);

    // Land
    ctrl.land();
    velocity.linear.x = 0.2;

    // Second jump
    ctrl.tick(
      mockInput({ [Action.MoveX]: 1, [Action.Jump]: 1 }, { [Action.Jump]: true }),
      velocity,
      transform,
    );
    expect(ctrl.actionState).toBe(ActionStateName.DoubleJumping);

    // Land
    ctrl.land();
    velocity.linear.x = 0.2;

    // Third jump
    ctrl.tick(
      mockInput({ [Action.MoveX]: 1, [Action.Jump]: 1 }, { [Action.Jump]: true }),
      velocity,
      transform,
    );

    expect(ctrl.actionGroup).toBe(ActionGroup.Airborne);
    expect(ctrl.actionState).toBe(ActionStateName.TripleJumping);
    expect(velocity.linear.y).toBe(TRIPLE_JUMP_VEL);
  });

  it('resets jump sequence when window expires', () => {
    const { ctrl, velocity, transform } = createController();

    // First jump
    ctrl.tick(
      mockInput({ [Action.Jump]: 1 }, { [Action.Jump]: true }),
      velocity,
      transform,
    );

    // Land
    ctrl.land();
    velocity.linear.x = 0.2;

    // Wait beyond the sequence window
    for (let i = 0; i <= JUMP_SEQUENCE_WINDOW; i++) {
      ctrl.tick(mockInput({ [Action.MoveX]: 1 }), velocity, transform);
    }

    // Jump again — should be normal jump, not double
    ctrl.tick(
      mockInput({ [Action.MoveX]: 1, [Action.Jump]: 1 }, { [Action.Jump]: true }),
      velocity,
      transform,
    );

    expect(ctrl.actionState).toBe(ActionStateName.Jumping);
    expect(velocity.linear.y).toBe(JUMP_VEL);
  });

  it('resets to normal jump if not moving on second jump', () => {
    const { ctrl, velocity, transform } = createController();

    // First jump
    ctrl.tick(
      mockInput({ [Action.Jump]: 1 }, { [Action.Jump]: true }),
      velocity,
      transform,
    );

    // Land
    ctrl.land();
    // No horizontal velocity (standing still)
    velocity.linear.x = 0;
    velocity.linear.z = 0;

    // Jump again — not moving so should reset to normal jump
    ctrl.tick(
      mockInput({ [Action.Jump]: 1 }, { [Action.Jump]: true }),
      velocity,
      transform,
    );

    expect(ctrl.actionState).toBe(ActionStateName.Jumping);
    expect(velocity.linear.y).toBe(JUMP_VEL);
  });

  // ── Falling / Edge detection ─────────────────────────────────────────

  it('transitions to Falling when startFalling is called', () => {
    const { ctrl } = createController();

    ctrl.startFalling();

    expect(ctrl.actionGroup).toBe(ActionGroup.Airborne);
    expect(ctrl.actionState).toBe(ActionStateName.Falling);
    expect(ctrl.leftGroundPassively).toBe(true);
  });

  // ── Coyote time ──────────────────────────────────────────────────────

  it('allows jump within coyote time after walking off an edge', () => {
    const { ctrl, velocity, transform } = createController();

    // Walk off edge
    ctrl.startFalling();
    expect(ctrl.actionGroup).toBe(ActionGroup.Airborne);
    expect(ctrl.actionState).toBe(ActionStateName.Falling);

    // Jump within coyote time (tick 1)
    ctrl.tick(
      mockInput({ [Action.Jump]: 1 }, { [Action.Jump]: true }),
      velocity,
      transform,
    );

    expect(ctrl.actionState).toBe(ActionStateName.Jumping);
    expect(velocity.linear.y).toBe(JUMP_VEL);
  });

  it('does not allow jump after coyote time expires', () => {
    const { ctrl, velocity, transform } = createController();

    // Walk off edge
    ctrl.startFalling();

    // Tick past coyote window
    for (let i = 0; i <= COYOTE_TICKS; i++) {
      ctrl.tick(mockInput(), velocity, transform);
    }

    // Try to jump — should fail
    ctrl.tick(
      mockInput({ [Action.Jump]: 1 }, { [Action.Jump]: true }),
      velocity,
      transform,
    );

    // Still falling, no jump
    expect(ctrl.actionState).toBe(ActionStateName.Falling);
    expect(velocity.linear.y).toBe(0);
  });

  // ── Ground Pound ─────────────────────────────────────────────────────

  it('transitions to GroundPound when Crouch is pressed while airborne', () => {
    const { ctrl, velocity, transform } = createController();

    // Jump first
    ctrl.tick(
      mockInput({ [Action.Jump]: 1 }, { [Action.Jump]: true }),
      velocity,
      transform,
    );
    expect(ctrl.actionGroup).toBe(ActionGroup.Airborne);

    // Give some horizontal velocity
    velocity.linear.x = 0.3;
    velocity.linear.z = 0.2;

    // Press crouch while airborne
    ctrl.tick(
      mockInput({ [Action.Crouch]: 1 }, { [Action.Crouch]: true }),
      velocity,
      transform,
    );

    expect(ctrl.actionState).toBe(ActionStateName.GroundPound);
    expect(velocity.linear.x).toBe(0);
    expect(velocity.linear.z).toBe(0);
    expect(velocity.linear.y).toBe(GROUND_POUND_VEL);
  });

  it('transitions to Crouching on landing after ground pound', () => {
    const { ctrl, velocity, transform } = createController();

    // Setup: airborne in ground pound state
    ctrl.actionGroup = ActionGroup.Airborne;
    ctrl.actionState = ActionStateName.GroundPound;

    // Land
    ctrl.land();

    expect(ctrl.actionGroup).toBe(ActionGroup.Grounded);
    expect(ctrl.actionState).toBe(ActionStateName.Crouching);
  });

  // ── Landing ──────────────────────────────────────────────────────────

  it('transitions back to Grounded Idle on landing from normal jump', () => {
    const { ctrl } = createController();

    ctrl.actionGroup = ActionGroup.Airborne;
    ctrl.actionState = ActionStateName.Jumping;

    ctrl.land();

    expect(ctrl.actionGroup).toBe(ActionGroup.Grounded);
    expect(ctrl.actionState).toBe(ActionStateName.Idle);
  });

  // ── Submerged ────────────────────────────────────────────────────────

  it('enterWater transitions to Submerged WaterIdle', () => {
    const { ctrl } = createController();

    ctrl.enterWater();

    expect(ctrl.actionGroup).toBe(ActionGroup.Submerged);
    expect(ctrl.actionState).toBe(ActionStateName.WaterIdle);
  });

  it('remains in WaterIdle when no input is held while Submerged', () => {
    const { ctrl, velocity, transform } = createController();

    ctrl.enterWater();
    ctrl.tick(mockInput(), velocity, transform);

    expect(ctrl.actionState).toBe(ActionStateName.WaterIdle);
  });

  it('transitions to WaterMoving when movement input is held while Submerged', () => {
    const { ctrl, velocity, transform } = createController();

    ctrl.enterWater();
    ctrl.tick(mockInput({ [Action.MoveX]: 1 }), velocity, transform);

    expect(ctrl.actionState).toBe(ActionStateName.WaterMoving);
  });

  it('moves at ~40% of ground speed while Submerged', () => {
    const { ctrl, velocity, transform } = createController();

    ctrl.enterWater();
    ctrl.tick(mockInput({ [Action.MoveZ]: -1 }), velocity, transform);

    const speed = Math.sqrt(velocity.linear.x ** 2 + velocity.linear.z ** 2);
    expect(speed).toBeCloseTo(MAX_RUN_SPEED * WATER_SPEED_FACTOR);
  });

  it('applies upward bob velocity when Jump pressed while Submerged', () => {
    const { ctrl, velocity, transform } = createController();

    ctrl.enterWater();
    ctrl.tick(
      mockInput({ [Action.Jump]: 1 }, { [Action.Jump]: true }),
      velocity,
      transform,
    );

    expect(velocity.linear.y).toBe(WATER_BOB_VEL);
  });

  it('exitWater transitions to Grounded when floor exists', () => {
    const { ctrl } = createController();

    ctrl.enterWater();
    ctrl.exitWater(true);

    expect(ctrl.actionGroup).toBe(ActionGroup.Grounded);
    expect(ctrl.actionState).toBe(ActionStateName.Idle);
  });

  it('exitWater transitions to Airborne Falling when no floor', () => {
    const { ctrl } = createController();

    ctrl.enterWater();
    ctrl.exitWater(false);

    expect(ctrl.actionGroup).toBe(ActionGroup.Airborne);
    expect(ctrl.actionState).toBe(ActionStateName.Falling);
  });

  it('decelerates horizontally when idle in water', () => {
    const { ctrl, velocity, transform } = createController();

    ctrl.enterWater();
    velocity.linear.x = 0.1;
    velocity.linear.z = 0.1;

    ctrl.tick(mockInput(), velocity, transform);

    // Should be reduced by 0.8 factor
    expect(velocity.linear.x).toBeCloseTo(0.08);
    expect(velocity.linear.z).toBeCloseTo(0.08);
  });

  // ── Knockback ─────────────────────────────────────────────────────────

  it('enterKnockback transitions to Knockback group + KnockbackAir', () => {
    const { ctrl } = createController();

    ctrl.enterKnockback();

    expect(ctrl.actionGroup).toBe(ActionGroup.Knockback);
    expect(ctrl.actionState).toBe(ActionStateName.KnockbackAir);
    expect(ctrl.knockbackTicks).toBe(0);
  });

  it('knockback increments tick counter each tick', () => {
    const { ctrl, velocity, transform } = createController();

    ctrl.enterKnockback();
    ctrl.tick(mockInput(), velocity, transform);

    expect(ctrl.knockbackTicks).toBe(1);
  });

  it('knockback transitions to Falling after max ticks', () => {
    const { ctrl, velocity, transform } = createController();

    ctrl.enterKnockback();
    for (let i = 0; i < KNOCKBACK_MAX_TICKS; i++) {
      ctrl.tick(mockInput(), velocity, transform);
    }

    expect(ctrl.actionGroup).toBe(ActionGroup.Airborne);
    expect(ctrl.actionState).toBe(ActionStateName.Falling);
  });

  it('landFromKnockback transitions to Grounded Idle', () => {
    const { ctrl } = createController();

    ctrl.enterKnockback();
    ctrl.landFromKnockback();

    expect(ctrl.actionGroup).toBe(ActionGroup.Grounded);
    expect(ctrl.actionState).toBe(ActionStateName.Idle);
    expect(ctrl.knockbackTicks).toBe(0);
  });

  it('knockback ignores player input', () => {
    const { ctrl, velocity, transform } = createController();

    ctrl.enterKnockback();
    velocity.linear.x = 0.5;
    velocity.linear.y = 0.3;

    // Even with jump input, nothing changes
    ctrl.tick(mockInput({ [Action.MoveX]: 1 }, { [Action.Jump]: true }), velocity, transform);

    // Velocity unchanged by player input during knockback
    expect(velocity.linear.x).toBe(0.5);
    expect(velocity.linear.y).toBe(0.3);
  });
});
