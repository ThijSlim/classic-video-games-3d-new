import { Action, isAnalogAction } from './Action';
import { InputMap, DEFAULT_INPUT_MAP } from './InputMap';

export interface ActionState {
  /** Current analog value in -1..+1 range. For digital actions, 0 or 1. */
  value: number;
  /** True during the first tick the action became active. */
  justPressed: boolean;
  /** True during the first tick the action became inactive. */
  justReleased: boolean;
}

const DEAD_ZONE = 0.15;

function clamp(v: number, min: number, max: number): number {
  return v < min ? min : v > max ? max : v;
}

export class InputSystem {
  private readonly inputMap: InputMap;
  private readonly keysDown = new Set<string>();

  /** Current-tick state per action. */
  private readonly states = new Map<Action, ActionState>();
  /** Previous-tick held status for edge detection. */
  private readonly prevHeld = new Map<Action, boolean>();

  /** Accumulated mouse movement since last consumeMouseDelta() call. */
  private _mouseDeltaX = 0;
  private _mouseDeltaY = 0;

  /** For testability: override for navigator.getGamepads */
  getGamepads: () => (Gamepad | null)[] = () =>
    navigator.getGamepads ? [...navigator.getGamepads()] : [];

  constructor(inputMap: InputMap = DEFAULT_INPUT_MAP) {
    this.inputMap = inputMap;
    for (const action of Object.values(Action)) {
      this.states.set(action, { value: 0, justPressed: false, justReleased: false });
      this.prevHeld.set(action, false);
    }
  }

  /** Call once to start listening to keyboard events. */
  attach(target: EventTarget = window): void {
    target.addEventListener('keydown', this.onKeyDown as EventListener);
    target.addEventListener('keyup', this.onKeyUp as EventListener);
  }

  detach(target: EventTarget = window): void {
    target.removeEventListener('keydown', this.onKeyDown as EventListener);
    target.removeEventListener('keyup', this.onKeyUp as EventListener);
  }

  /** Must be called once per tick, before game logic reads actions. */
  tick(): void {
    // Accumulate raw values per action from all sources.
    const raw = new Map<Action, number>();
    for (const action of Object.values(Action)) {
      raw.set(action, 0);
    }

    // Keyboard contributions
    for (const code of this.keysDown) {
      const binding = this.inputMap.keys[code];
      if (!binding) continue;
      const cur = raw.get(binding.action) ?? 0;
      raw.set(binding.action, clamp(cur + binding.value, -1, 1));
    }

    // Gamepad contributions
    const gamepads = this.getGamepads();
    for (const gp of gamepads) {
      if (!gp) continue;

      // Axes
      for (const [axisStr, binding] of Object.entries(this.inputMap.gamepadAxes)) {
        const axisIndex = Number(axisStr);
        if (axisIndex < gp.axes.length) {
          let axisValue = gp.axes[axisIndex] * binding.scale;
          if (Math.abs(axisValue) < DEAD_ZONE) axisValue = 0;
          const cur = raw.get(binding.action) ?? 0;
          raw.set(binding.action, clamp(cur + axisValue, -1, 1));
        }
      }

      // Buttons
      for (const [btnStr, binding] of Object.entries(this.inputMap.gamepadButtons)) {
        const btnIndex = Number(btnStr);
        if (btnIndex < gp.buttons.length && gp.buttons[btnIndex].pressed) {
          raw.set(binding.action, 1);
        }
      }
    }

    // Update states with edge detection
    for (const action of Object.values(Action)) {
      const value = raw.get(action)!;
      const held = isAnalogAction(action) ? value !== 0 : value > 0;
      const wasHeld = this.prevHeld.get(action)!;

      this.states.set(action, {
        value,
        justPressed: held && !wasHeld,
        justReleased: !held && wasHeld,
      });

      this.prevHeld.set(action, held);
    }
  }

  getAction(action: Action): ActionState {
    return this.states.get(action)!;
  }

  private onKeyDown = (e: KeyboardEvent): void => {
    this.keysDown.add(e.code);
  };

  private onKeyUp = (e: KeyboardEvent): void => {
    this.keysDown.delete(e.code);
  };

  /** Accumulate raw mouse movement (called from pointerlocked mousemove). */
  accumulateMouseDelta(dx: number, dy: number): void {
    this._mouseDeltaX += dx;
    this._mouseDeltaY += dy;
  }

  /** Return and reset accumulated mouse delta. Called by CameraSystem each tick. */
  consumeMouseDelta(): { x: number; y: number } {
    const result = { x: this._mouseDeltaX, y: this._mouseDeltaY };
    this._mouseDeltaX = 0;
    this._mouseDeltaY = 0;
    return result;
  }

  /** Simulate a key press (for testing). */
  simulateKeyDown(code: string): void {
    this.keysDown.add(code);
  }

  /** Simulate a key release (for testing). */
  simulateKeyUp(code: string): void {
    this.keysDown.delete(code);
  }
}
