import { Component } from './Component';
import { Action } from './Action';
import { InputSystem, ActionState } from './InputSystem';
import { Velocity } from './Velocity';
import { Transform } from './Transform';

// ── ActionGroup / ActionState enums ────────────────────────────────────

export enum ActionGroup {
  Grounded = 'Grounded',
  Airborne = 'Airborne',
  Submerged = 'Submerged',
  Knockback = 'Knockback',
}

export enum ActionStateName {
  // Grounded
  Idle = 'Idle',
  Walking = 'Walking',
  Running = 'Running',
  Decelerating = 'Decelerating',
  Crouching = 'Crouching',

  // Airborne (defined, not yet implemented)
  Falling = 'Falling',
  Jumping = 'Jumping',
  DoubleJumping = 'DoubleJumping',
  TripleJumping = 'TripleJumping',

  // Submerged (defined, not yet implemented)
  Swimming = 'Swimming',

  // Knockback (defined, not yet implemented)
  KnockedBack = 'KnockedBack',
}

// ── SM64-faithful movement constants ───────────────────────────────────

/** Scale factor from SM64 units to engine units.  1 engine unit ≈ 100 SM64 units. */
export const SM64_SCALE = 0.01;

/** Walking / running threshold – 16 SM64 units per tick. */
export const MAX_WALK_SPEED = 16 * SM64_SCALE;

/** Maximum running speed – 48 SM64 units per tick. */
export const MAX_RUN_SPEED = 48 * SM64_SCALE;

/** Ground friction deceleration – 2 SM64 units subtracted from speed each tick. */
export const GROUND_DECEL = 2.0 * SM64_SCALE;

/** Rotation speed toward the movement direction (radians per tick). */
const TURN_SPEED = 0.25;

/** Speed below which the character is considered stopped. */
const IDLE_THRESHOLD = 0.001;

// ── PlayerController component ─────────────────────────────────────────

export class PlayerController extends Component {
  actionGroup: ActionGroup = ActionGroup.Grounded;
  actionState: ActionStateName = ActionStateName.Idle;

  /**
   * Run once per tick, after InputSystem.tick().
   * Reads MoveX / MoveZ / Crouch actions, updates the state machine,
   * sets Velocity, and rotates the Transform to face movement direction.
   */
  tick(input: InputSystem, velocity: Velocity, transform: Transform): void {
    if (this.actionGroup !== ActionGroup.Grounded) return;

    const moveX = input.getAction(Action.MoveX).value;
    const moveZ = input.getAction(Action.MoveZ).value;
    const crouch: ActionState = input.getAction(Action.Crouch);

    // ── Crouching ──────────────────────────────────────────────────────
    if (crouch.value > 0) {
      this.actionState = ActionStateName.Crouching;
      velocity.linear.x = 0;
      velocity.linear.z = 0;
      return;
    }

    const inputMag = Math.min(1, Math.sqrt(moveX * moveX + moveZ * moveZ));
    const hasInput = inputMag > 0;

    if (hasInput) {
      // ── Active movement ───────────────────────────────────────────────
      const targetSpeed = inputMag * MAX_RUN_SPEED;
      const targetAngle = Math.atan2(moveX, -moveZ);

      velocity.linear.x = Math.sin(targetAngle) * targetSpeed;
      velocity.linear.z = -Math.cos(targetAngle) * targetSpeed;

      // Smooth rotation toward movement direction
      let angleDiff = targetAngle - transform.rotation.y;
      // Normalize to [-π, π]
      while (angleDiff > Math.PI) angleDiff -= 2 * Math.PI;
      while (angleDiff < -Math.PI) angleDiff += 2 * Math.PI;

      if (Math.abs(angleDiff) <= TURN_SPEED) {
        transform.rotation.y = targetAngle;
      } else {
        transform.rotation.y += Math.sign(angleDiff) * TURN_SPEED;
      }

      this.actionState =
        targetSpeed < MAX_WALK_SPEED
          ? ActionStateName.Walking
          : ActionStateName.Running;
    } else {
      // ── No input ──────────────────────────────────────────────────────
      const speed = Math.sqrt(
        velocity.linear.x ** 2 + velocity.linear.z ** 2,
      );

      if (speed > IDLE_THRESHOLD) {
        this.actionState = ActionStateName.Decelerating;
      } else {
        velocity.linear.x = 0;
        velocity.linear.z = 0;
        this.actionState = ActionStateName.Idle;
      }
    }
  }
}
