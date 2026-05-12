import { CameraState } from './CameraState';
import { InputSystem } from './InputSystem';
import { Transform } from './Transform';
import { Action } from './Action';

/** Orbit speed for gamepad / keyboard in radians per tick at full deflection. */
export const ORBIT_SPEED = 0.05;
/** Pitch speed for gamepad / keyboard in radians per tick at full deflection. */
export const PITCH_SPEED = 0.03;
/** Mouse sensitivity in radians per pixel of pointer-lock movement. */
export const MOUSE_SENSITIVITY = 0.003;

/** Minimum pitch (−10°). */
export const MIN_PITCH = (-10 * Math.PI) / 180;
/** Maximum pitch (+80°). */
export const MAX_PITCH = (80 * Math.PI) / 180;

/** Rate at which auto-follow lerps yaw toward the player's back (5 % per tick). */
export const LAZY_FOLLOW_RATE = 0.05;
/** Ticks before auto-follow resumes after releasing manual camera input (~2 s). */
export const GRACE_TICKS = 60;
/** Ticks of player inactivity before idle-drift starts. */
export const IDLE_DRIFT_TICKS = 30;

function normalizeAngle(a: number): number {
  while (a > Math.PI) a -= 2 * Math.PI;
  while (a < -Math.PI) a += 2 * Math.PI;
  return a;
}

/**
 * Lakitu Camera system.
 *
 * Runs once per tick after PhysicsSystem. Updates a CameraState that the
 * Renderer reads (with interpolation) each frame.
 */
export class CameraSystem {
  tick(
    cameraState: CameraState,
    input: InputSystem,
    playerTransform: Transform,
    playerIsMoving: boolean,
  ): void {
    const cameraX = input.getAction(Action.CameraX).value;
    const cameraZ = input.getAction(Action.CameraZ).value;
    const mouseDelta = input.consumeMouseDelta();

    const hasManualInput =
      cameraX !== 0 ||
      cameraZ !== 0 ||
      mouseDelta.x !== 0 ||
      mouseDelta.y !== 0;

    // ── Snapshot for render interpolation ──────────────────────────────
    cameraState.prevPosition.copy(cameraState.currentPosition);
    cameraState.prevLookAt.copy(cameraState.currentLookAt);

    // ── Track player idle ticks (always, independent of grace) ────────
    if (playerIsMoving) {
      cameraState.playerIdleTicks = 0;
    } else {
      cameraState.playerIdleTicks++;
    }

    // ── Manual override ───────────────────────────────────────────────
    if (hasManualInput) {
      cameraState.yaw += cameraX * ORBIT_SPEED;
      cameraState.pitch -= cameraZ * PITCH_SPEED;
      cameraState.yaw += mouseDelta.x * MOUSE_SENSITIVITY;
      cameraState.pitch -= mouseDelta.y * MOUSE_SENSITIVITY;
      cameraState.graceTimer = GRACE_TICKS;
    } else if (cameraState.graceTimer > 0) {
      // Grace period — no auto-follow yet
      cameraState.graceTimer--;
    } else {
      // ── Auto-follow ─────────────────────────────────────────────────
      // When moving, or idle for 30+ ticks, lazily swing behind player.
      if (playerIsMoving || cameraState.playerIdleTicks >= IDLE_DRIFT_TICKS) {
        // Camera yaw that places the camera behind the player:
        //   Player facing direction uses rotation.y (see PlayerController).
        //   "Behind" in our orbit convention is yaw = -rotation.y.
        const targetYaw = -playerTransform.rotation.y;
        const angleDiff = normalizeAngle(targetYaw - cameraState.yaw);
        cameraState.yaw += angleDiff * LAZY_FOLLOW_RATE;
      }
    }

    // ── Clamp pitch ───────────────────────────────────────────────────
    cameraState.pitch = Math.max(
      MIN_PITCH,
      Math.min(MAX_PITCH, cameraState.pitch),
    );

    // ── Recompute world-space positions ───────────────────────────────
    cameraState.computePositions(playerTransform.position);
  }
}
