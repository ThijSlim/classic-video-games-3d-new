import { describe, it, expect } from 'vitest';
import { Action } from './Action';
import { InputSystem } from './InputSystem';
import { DEFAULT_INPUT_MAP } from './InputMap';

describe('InputSystem', () => {
  function createSystem() {
    const sys = new InputSystem(DEFAULT_INPUT_MAP);
    // Override getGamepads so tests don't touch the browser API
    sys.getGamepads = () => [];
    return sys;
  }

  // ── Keyboard ──────────────────────────────────────────────────────

  it('produces MoveZ = -1 when W is held', () => {
    const sys = createSystem();
    sys.simulateKeyDown('KeyW');
    sys.tick();

    expect(sys.getAction(Action.MoveZ).value).toBe(-1);
  });

  it('produces MoveZ = +1 when S is held', () => {
    const sys = createSystem();
    sys.simulateKeyDown('KeyS');
    sys.tick();

    expect(sys.getAction(Action.MoveZ).value).toBe(1);
  });

  it('produces MoveX = -1 when A is held', () => {
    const sys = createSystem();
    sys.simulateKeyDown('KeyA');
    sys.tick();

    expect(sys.getAction(Action.MoveX).value).toBe(-1);
  });

  it('produces MoveX = +1 when D is held', () => {
    const sys = createSystem();
    sys.simulateKeyDown('KeyD');
    sys.tick();

    expect(sys.getAction(Action.MoveX).value).toBe(1);
  });

  it('opposing keys cancel to 0', () => {
    const sys = createSystem();
    sys.simulateKeyDown('KeyW');
    sys.simulateKeyDown('KeyS');
    sys.tick();

    expect(sys.getAction(Action.MoveZ).value).toBe(0);
  });

  it('returns 0 after key release', () => {
    const sys = createSystem();
    sys.simulateKeyDown('KeyW');
    sys.tick();
    expect(sys.getAction(Action.MoveZ).value).toBe(-1);

    sys.simulateKeyUp('KeyW');
    sys.tick();
    expect(sys.getAction(Action.MoveZ).value).toBe(0);
  });

  // ── Edge detection ────────────────────────────────────────────────

  it('detects justPressed on the tick a key is first pressed', () => {
    const sys = createSystem();
    sys.simulateKeyDown('Space');
    sys.tick();

    const state = sys.getAction(Action.Jump);
    expect(state.justPressed).toBe(true);
    expect(state.justReleased).toBe(false);
  });

  it('clears justPressed on the following tick if key stays held', () => {
    const sys = createSystem();
    sys.simulateKeyDown('Space');
    sys.tick();
    sys.tick(); // second tick, still held

    const state = sys.getAction(Action.Jump);
    expect(state.justPressed).toBe(false);
    expect(state.value).toBe(1);
  });

  it('detects justReleased on the tick after key release', () => {
    const sys = createSystem();
    sys.simulateKeyDown('Space');
    sys.tick();

    sys.simulateKeyUp('Space');
    sys.tick();

    const state = sys.getAction(Action.Jump);
    expect(state.justReleased).toBe(true);
    expect(state.justPressed).toBe(false);
    expect(state.value).toBe(0);
  });

  it('clears justReleased on the tick after release tick', () => {
    const sys = createSystem();
    sys.simulateKeyDown('Space');
    sys.tick();
    sys.simulateKeyUp('Space');
    sys.tick();
    sys.tick(); // third tick

    expect(sys.getAction(Action.Jump).justReleased).toBe(false);
  });

  // ── Analog mapping ───────────────────────────────────────────────

  it('maps keyboard to snap values (-1/0/+1) for analog actions', () => {
    const sys = createSystem();
    sys.simulateKeyDown('KeyD');
    sys.tick();

    // D maps to MoveX = +1 (snap, not fractional)
    expect(sys.getAction(Action.MoveX).value).toBe(1);
  });

  // ── Digital actions via keyboard ──────────────────────────────────

  it('maps Space to Jump digital action', () => {
    const sys = createSystem();
    sys.simulateKeyDown('Space');
    sys.tick();

    expect(sys.getAction(Action.Jump).value).toBe(1);
  });

  it('maps KeyK to Punch digital action', () => {
    const sys = createSystem();
    sys.simulateKeyDown('KeyK');
    sys.tick();

    expect(sys.getAction(Action.Punch).value).toBe(1);
  });

  it('maps ShiftLeft to Crouch digital action', () => {
    const sys = createSystem();
    sys.simulateKeyDown('ShiftLeft');
    sys.tick();

    expect(sys.getAction(Action.Crouch).value).toBe(1);
  });

  // ── Gamepad ───────────────────────────────────────────────────────

  it('reads gamepad left stick for MoveX/MoveZ with analog precision', () => {
    const sys = createSystem();
    sys.getGamepads = () => [
      {
        axes: [0.5, -0.7, 0, 0],
        buttons: Array.from({ length: 17 }, () => ({ pressed: false, touched: false, value: 0 })),
      } as unknown as Gamepad,
    ];
    sys.tick();

    expect(sys.getAction(Action.MoveX).value).toBeCloseTo(0.5, 1);
    expect(sys.getAction(Action.MoveZ).value).toBeCloseTo(-0.7, 1);
  });

  it('applies dead zone to small gamepad values', () => {
    const sys = createSystem();
    sys.getGamepads = () => [
      {
        axes: [0.05, -0.1, 0, 0],
        buttons: Array.from({ length: 17 }, () => ({ pressed: false, touched: false, value: 0 })),
      } as unknown as Gamepad,
    ];
    sys.tick();

    expect(sys.getAction(Action.MoveX).value).toBe(0);
    expect(sys.getAction(Action.MoveZ).value).toBe(0);
  });

  it('reads gamepad button 0 as Jump', () => {
    const sys = createSystem();
    const buttons = Array.from({ length: 17 }, () => ({
      pressed: false,
      touched: false,
      value: 0,
    }));
    buttons[0] = { pressed: true, touched: true, value: 1 };
    sys.getGamepads = () => [
      { axes: [0, 0, 0, 0], buttons } as unknown as Gamepad,
    ];
    sys.tick();

    expect(sys.getAction(Action.Jump).value).toBe(1);
    expect(sys.getAction(Action.Jump).justPressed).toBe(true);
  });

  // ── Simultaneous keyboard + gamepad ───────────────────────────────

  it('combines keyboard and gamepad without conflict', () => {
    const sys = createSystem();
    sys.simulateKeyDown('KeyD'); // MoveX +1

    sys.getGamepads = () => [
      {
        axes: [0, -0.5, 0, 0], // MoveZ = -0.5
        buttons: Array.from({ length: 17 }, () => ({ pressed: false, touched: false, value: 0 })),
      } as unknown as Gamepad,
    ];
    sys.tick();

    expect(sys.getAction(Action.MoveX).value).toBe(1); // keyboard
    expect(sys.getAction(Action.MoveZ).value).toBeCloseTo(-0.5, 1); // gamepad
  });
});
