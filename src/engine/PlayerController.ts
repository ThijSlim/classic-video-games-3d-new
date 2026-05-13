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

  // Airborne
  Falling = 'Falling',
  Jumping = 'Jumping',
  DoubleJumping = 'DoubleJumping',
  TripleJumping = 'TripleJumping',
  GroundPound = 'GroundPound',

  // Submerged
  WaterIdle = 'WaterIdle',
  WaterMoving = 'WaterMoving',

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

// ── SM64-faithful jump constants ───────────────────────────────────────

/** Normal jump initial velocity (~52 SM64 units/tick). */
export const JUMP_VEL = 52 * SM64_SCALE;

/** Double jump initial velocity (~62 SM64 units/tick). */
export const DOUBLE_JUMP_VEL = 62 * SM64_SCALE;

/** Triple jump initial velocity (~69 SM64 units/tick). */
export const TRIPLE_JUMP_VEL = 69 * SM64_SCALE;

/** Ground pound downward velocity. */
export const GROUND_POUND_VEL = -75 * SM64_SCALE;

/** Number of ticks after landing within which the next jump in the sequence is valid. */
export const JUMP_SEQUENCE_WINDOW = 5;

// ── SM64-faithful submerged constants ──────────────────────────────────

/** Gravity while submerged (units/tick²) — reduced from -4.0 to -1.0 SM64 scale. */
export const WATER_GRAVITY = -1.0 * SM64_SCALE;

/** Movement speed multiplier while submerged (~40% of ground speed). */
export const WATER_SPEED_FACTOR = 0.4;

/** Upward velocity impulse when pressing Jump while submerged (bob). */
export const WATER_BOB_VEL = 30 * SM64_SCALE;

/** Coyote time: ticks after leaving ground where jump is still allowed. */
export const COYOTE_TICKS = 4;

// ── PlayerController component ─────────────────────────────────────────

export class PlayerController extends Component {
  actionGroup: ActionGroup = ActionGroup.Grounded;
  actionState: ActionStateName = ActionStateName.Idle;

  /** Jump sequence counter: 0 = none, 1 = single done, 2 = double done. */
  jumpSequence = 0;

  /** Ticks since last landing — resets when grounded. Used for jump combo window. */
  ticksSinceLanding = 0;

  /** Coyote time counter: ticks since leaving ground without jumping. */
  coyoteCounter = 0;

  /** Whether the player left ground by walking off an edge (not jumping). */
  leftGroundPassively = false;

  /**
   * Run once per tick, after InputSystem.tick().
   * Reads MoveX / MoveZ / Crouch / Jump actions, updates the state machine,
   * sets Velocity, and rotates the Transform to face movement direction.
   */
  tick(input: InputSystem, velocity: Velocity, transform: Transform): void {
    if (this.actionGroup === ActionGroup.Grounded) {
      this.tickGrounded(input, velocity, transform);
    } else if (this.actionGroup === ActionGroup.Airborne) {
      this.tickAirborne(input, velocity, transform);
    } else if (this.actionGroup === ActionGroup.Submerged) {
      this.tickSubmerged(input, velocity, transform);
    }
  }

  // ── Grounded logic ─────────────────────────────────────────────────

  private tickGrounded(input: InputSystem, velocity: Velocity, transform: Transform): void {
    this.ticksSinceLanding++;

    const moveX = input.getAction(Action.MoveX).value;
    const moveZ = input.getAction(Action.MoveZ).value;
    const crouch: ActionState = input.getAction(Action.Crouch);
    const jump: ActionState = input.getAction(Action.Jump);

    // ── Jump ────────────────────────────────────────────────────────────
    if (jump.justPressed) {
      this.initiateJump(velocity);
      return;
    }

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

  // ── Airborne logic ─────────────────────────────────────────────────

  private tickAirborne(input: InputSystem, velocity: Velocity, _transform: Transform): void {
    const crouch: ActionState = input.getAction(Action.Crouch);
    const jump: ActionState = input.getAction(Action.Jump);

    // ── Coyote time jump ──────────────────────────────────────────────
    if (this.leftGroundPassively) {
      this.coyoteCounter++;
      if (jump.justPressed && this.coyoteCounter <= COYOTE_TICKS) {
        this.leftGroundPassively = false;
        this.coyoteCounter = 0;
        this.jumpSequence = 1;
        this.actionState = ActionStateName.Jumping;
        velocity.linear.y = JUMP_VEL;
        return;
      }
      if (this.coyoteCounter > COYOTE_TICKS) {
        this.leftGroundPassively = false;
      }
    }

    // ── Ground pound ──────────────────────────────────────────────────
    if (crouch.justPressed && this.actionState !== ActionStateName.GroundPound) {
      this.actionState = ActionStateName.GroundPound;
      velocity.linear.x = 0;
      velocity.linear.z = 0;
      velocity.linear.y = GROUND_POUND_VEL;
      return;
    }
  }

  // ── Jump initiation ────────────────────────────────────────────────

  private initiateJump(velocity: Velocity): void {
    const isMoving = Math.sqrt(velocity.linear.x ** 2 + velocity.linear.z ** 2) > IDLE_THRESHOLD;

    if (
      this.jumpSequence === 1 &&
      this.ticksSinceLanding <= JUMP_SEQUENCE_WINDOW &&
      isMoving
    ) {
      // Double jump
      this.jumpSequence = 2;
      this.actionState = ActionStateName.DoubleJumping;
      velocity.linear.y = DOUBLE_JUMP_VEL;
    } else if (
      this.jumpSequence === 2 &&
      this.ticksSinceLanding <= JUMP_SEQUENCE_WINDOW &&
      isMoving
    ) {
      // Triple jump
      this.jumpSequence = 0;
      this.actionState = ActionStateName.TripleJumping;
      velocity.linear.y = TRIPLE_JUMP_VEL;
    } else {
      // Normal jump
      this.jumpSequence = 1;
      this.actionState = ActionStateName.Jumping;
      velocity.linear.y = JUMP_VEL;
    }

    this.actionGroup = ActionGroup.Airborne;
    this.leftGroundPassively = false;
    this.coyoteCounter = 0;
  }

  // ── Landing ────────────────────────────────────────────────────────

  /** Called by CollisionSystem when the player lands on a floor. */
  land(): void {
    if (this.actionState === ActionStateName.GroundPound) {
      this.actionState = ActionStateName.Crouching;
      this.jumpSequence = 0;
    } else {
      this.actionState = ActionStateName.Idle;
    }
    this.actionGroup = ActionGroup.Grounded;
    this.ticksSinceLanding = 0;
  }

  /** Called by CollisionSystem when no floor is detected while grounded. */
  startFalling(): void {
    this.actionGroup = ActionGroup.Airborne;
    this.actionState = ActionStateName.Falling;
    this.leftGroundPassively = true;
    this.coyoteCounter = 0;
  }

  // ── Submerged logic ────────────────────────────────────────────────

  private tickSubmerged(input: InputSystem, velocity: Velocity, transform: Transform): void {
    const moveX = input.getAction(Action.MoveX).value;
    const moveZ = input.getAction(Action.MoveZ).value;
    const jump: ActionState = input.getAction(Action.Jump);

    // ── Bob (jump while submerged) ──────────────────────────────────
    if (jump.justPressed) {
      velocity.linear.y = WATER_BOB_VEL;
    }

    const inputMag = Math.min(1, Math.sqrt(moveX * moveX + moveZ * moveZ));
    const hasInput = inputMag > 0;

    if (hasInput) {
      this.actionState = ActionStateName.WaterMoving;
      const targetSpeed = inputMag * MAX_RUN_SPEED * WATER_SPEED_FACTOR;
      const targetAngle = Math.atan2(moveX, -moveZ);

      velocity.linear.x = Math.sin(targetAngle) * targetSpeed;
      velocity.linear.z = -Math.cos(targetAngle) * targetSpeed;

      // Smooth rotation toward movement direction
      let angleDiff = targetAngle - transform.rotation.y;
      while (angleDiff > Math.PI) angleDiff -= 2 * Math.PI;
      while (angleDiff < -Math.PI) angleDiff += 2 * Math.PI;

      if (Math.abs(angleDiff) <= TURN_SPEED) {
        transform.rotation.y = targetAngle;
      } else {
        transform.rotation.y += Math.sign(angleDiff) * TURN_SPEED;
      }
    } else {
      this.actionState = ActionStateName.WaterIdle;
      // Slow horizontal deceleration in water
      velocity.linear.x *= 0.8;
      velocity.linear.z *= 0.8;
      if (Math.abs(velocity.linear.x) < IDLE_THRESHOLD) velocity.linear.x = 0;
      if (Math.abs(velocity.linear.z) < IDLE_THRESHOLD) velocity.linear.z = 0;
    }
  }

  /** Called when the player enters a water volume. */
  enterWater(): void {
    this.actionGroup = ActionGroup.Submerged;
    this.actionState = ActionStateName.WaterIdle;
    this.jumpSequence = 0;
    this.leftGroundPassively = false;
    this.coyoteCounter = 0;
  }

  /** Called when the player exits a water volume upward. */
  exitWater(hasFloor: boolean): void {
    if (hasFloor) {
      this.actionGroup = ActionGroup.Grounded;
      this.actionState = ActionStateName.Idle;
      this.ticksSinceLanding = 0;
    } else {
      this.actionGroup = ActionGroup.Airborne;
      this.actionState = ActionStateName.Falling;
      this.leftGroundPassively = false;
      this.coyoteCounter = 0;
    }
  }
}
