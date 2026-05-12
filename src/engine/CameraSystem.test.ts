import { describe, it, expect } from 'vitest';
import { Action } from './Action';
import { InputSystem } from './InputSystem';
import { Transform } from './Transform';
import { CameraState } from './CameraState';
import {
  CameraSystem,
  ORBIT_SPEED,
  PITCH_SPEED,
  MOUSE_SENSITIVITY,
  MIN_PITCH,
  MAX_PITCH,
  LAZY_FOLLOW_RATE,
  GRACE_TICKS,
  IDLE_DRIFT_TICKS,
} from './CameraSystem';

// ── Helpers ─────────────────────────────────────────────────────────────

function mockInput(
  values: Partial<Record<Action, number>> = {},
  mouseDelta?: { x: number; y: number },
): InputSystem {
  let _mouseDelta = mouseDelta ?? { x: 0, y: 0 };
  return {
    getAction(action: Action) {
      return {
        value: values[action] ?? 0,
        justPressed: false,
        justReleased: false,
      };
    },
    consumeMouseDelta() {
      const d = _mouseDelta;
      _mouseDelta = { x: 0, y: 0 };
      return d;
    },
  } as unknown as InputSystem;
}

function setup() {
  const system = new CameraSystem();
  const state = new CameraState();
  const transform = new Transform();
  return { system, state, transform };
}

// ── Tests ────────────────────────────────────────────────────────────────

describe('CameraSystem', () => {
  // ── Default orbit ───────────────────────────────────────────────────

  it('positions camera behind the player at default distance and height', () => {
    const { state } = setup();

    // default yaw=0 → camera at +Z from player
    expect(state.currentPosition.x).toBeCloseTo(0);
    expect(state.currentPosition.y).toBeCloseTo(
      state.lookAtHeight + state.distance * Math.sin(state.pitch),
    );
    expect(state.currentPosition.z).toBeCloseTo(
      state.distance * Math.cos(state.pitch),
    );
  });

  it('looks at chest height above feet', () => {
    const { state } = setup();
    expect(state.currentLookAt.y).toBeCloseTo(0.8);
  });

  // ── Gamepad / keyboard orbit ─────────────────────────────────────────

  it('CameraX rotates yaw via gamepad/keyboard', () => {
    const { system, state, transform } = setup();
    const input = mockInput({ [Action.CameraX]: 1 });

    const yawBefore = state.yaw;
    system.tick(state, input, transform, false);

    expect(state.yaw).toBeCloseTo(yawBefore + ORBIT_SPEED);
  });

  it('CameraZ adjusts pitch via gamepad/keyboard', () => {
    const { system, state, transform } = setup();
    // CameraZ = -1 (up/arrow-up) → pitch should increase
    const input = mockInput({ [Action.CameraZ]: -1 });

    const pitchBefore = state.pitch;
    system.tick(state, input, transform, false);

    expect(state.pitch).toBeCloseTo(pitchBefore + PITCH_SPEED);
  });

  // ── Mouse orbit ──────────────────────────────────────────────────────

  it('mouse delta rotates yaw and pitch', () => {
    const { system, state, transform } = setup();
    const input = mockInput({}, { x: 100, y: -50 });

    const yawBefore = state.yaw;
    const pitchBefore = state.pitch;
    system.tick(state, input, transform, false);

    expect(state.yaw).toBeCloseTo(yawBefore + 100 * MOUSE_SENSITIVITY);
    expect(state.pitch).toBeCloseTo(pitchBefore + 50 * MOUSE_SENSITIVITY);
  });

  // ── Pitch clamping ──────────────────────────────────────────────────

  it('clamps pitch at minimum -10 degrees', () => {
    const { system, state, transform } = setup();
    state.pitch = MIN_PITCH;
    // Push pitch further down
    const input = mockInput({ [Action.CameraZ]: 1 });
    system.tick(state, input, transform, false);

    expect(state.pitch).toBeCloseTo(MIN_PITCH);
  });

  it('clamps pitch at maximum +80 degrees', () => {
    const { system, state, transform } = setup();
    state.pitch = MAX_PITCH;
    // Push pitch further up
    const input = mockInput({ [Action.CameraZ]: -1 });
    system.tick(state, input, transform, false);

    expect(state.pitch).toBeCloseTo(MAX_PITCH);
  });

  // ── Grace period ────────────────────────────────────────────────────

  it('sets grace timer to 60 ticks on manual camera input', () => {
    const { system, state, transform } = setup();
    const input = mockInput({ [Action.CameraX]: 1 });

    system.tick(state, input, transform, false);

    expect(state.graceTimer).toBe(GRACE_TICKS);
  });

  it('decrements grace timer each tick without camera input', () => {
    const { system, state, transform } = setup();
    state.graceTimer = 10;
    const input = mockInput();

    system.tick(state, input, transform, false);

    expect(state.graceTimer).toBe(9);
  });

  it('does not auto-follow during grace period', () => {
    const { system, state, transform } = setup();
    // Set camera yaw far from behind-player target
    state.yaw = 2.0;
    state.graceTimer = 5;
    transform.rotation.y = 0; // target yaw = 0

    const yawBefore = state.yaw;
    const input = mockInput();
    system.tick(state, input, transform, true);

    // Yaw should not change (no auto-follow while grace > 0)
    expect(state.yaw).toBeCloseTo(yawBefore);
  });

  // ── Lazy follow ─────────────────────────────────────────────────────

  it('lazily follows behind the player when moving and grace expired', () => {
    const { system, state, transform } = setup();
    state.graceTimer = 0;
    // Player faces -Z (rotation.y = 0) → camera should be at yaw=0
    transform.rotation.y = 0;
    state.yaw = 1.0; // start offset

    const input = mockInput();
    system.tick(state, input, transform, true);

    // Should move 5% of the angle difference toward target (0)
    const expected = 1.0 + (0 - 1.0) * LAZY_FOLLOW_RATE;
    expect(state.yaw).toBeCloseTo(expected);
  });

  it('does not auto-follow when player is idle and < 30 ticks', () => {
    const { system, state, transform } = setup();
    state.graceTimer = 0;
    state.playerIdleTicks = 0;
    state.yaw = 1.0;
    transform.rotation.y = 0;

    const input = mockInput();
    // Player not moving, idle ticks will go to 1 (< 30)
    system.tick(state, input, transform, false);

    expect(state.yaw).toBeCloseTo(1.0);
  });

  // ── Idle drift ──────────────────────────────────────────────────────

  it('drifts to face behind player after 30+ idle ticks', () => {
    const { system, state, transform } = setup();
    state.graceTimer = 0;
    state.playerIdleTicks = IDLE_DRIFT_TICKS; // At threshold
    state.yaw = 1.0;
    transform.rotation.y = 0;

    const input = mockInput();
    system.tick(state, input, transform, false);

    const expected = 1.0 + (0 - 1.0) * LAZY_FOLLOW_RATE;
    expect(state.yaw).toBeCloseTo(expected);
  });

  // ── Interpolation ──────────────────────────────────────────────────

  it('snapshots previous positions each tick for interpolation', () => {
    const { system, state, transform } = setup();
    transform.position.set(1, 0, 2);
    state.computePositions(transform.position);

    const posBefore = state.currentPosition.clone();
    const lookBefore = state.currentLookAt.clone();

    // Move player and tick
    transform.position.set(3, 0, 4);
    const input = mockInput();
    system.tick(state, input, transform, true);

    expect(state.prevPosition.x).toBeCloseTo(posBefore.x);
    expect(state.prevPosition.z).toBeCloseTo(posBefore.z);
    expect(state.prevLookAt.x).toBeCloseTo(lookBefore.x);
    expect(state.prevLookAt.z).toBeCloseTo(lookBefore.z);

    // Current should have updated
    expect(state.currentLookAt.x).toBeCloseTo(3);
    expect(state.currentLookAt.z).toBeCloseTo(4);
  });

  // ── Camera state is not serializable ────────────────────────────────

  it('CameraState is not a Component (not part of GameState)', () => {
    const state = new CameraState();
    // CameraState should not extend Component
    expect(state).not.toHaveProperty('entity');
  });

  // ── Mouse delta consumed per tick ───────────────────────────────────

  it('consumes mouse delta so it is not double-counted', () => {
    const { system, state, transform } = setup();
    // First tick: mouse moves
    const input = mockInput({}, { x: 100, y: 0 });
    system.tick(state, input, transform, false);
    const yawAfterFirst = state.yaw;

    // Second tick: same input (delta was consumed → returns 0)
    system.tick(state, input, transform, false);

    // Grace timer is still active from tick 1, so no auto-follow.
    // The yaw should remain unchanged since mouse delta was consumed.
    expect(state.yaw).toBeCloseTo(yawAfterFirst);
  });

  // ── Player idle ticks tracked always ────────────────────────────────

  it('tracks player idle ticks independently of grace period', () => {
    const { system, state, transform } = setup();
    state.graceTimer = 100; // grace active
    state.playerIdleTicks = 0;

    const input = mockInput();
    // 5 ticks idle during grace
    for (let i = 0; i < 5; i++) {
      system.tick(state, input, transform, false);
    }
    expect(state.playerIdleTicks).toBe(5);

    // Moving resets
    system.tick(state, input, transform, true);
    expect(state.playerIdleTicks).toBe(0);
  });
});
