import { Action } from './Action';

export interface KeyBinding {
  action: Action;
  /** Value produced when the key is held. Typically -1 or +1 for analog axes, ignored for digital. */
  value: number;
}

export interface GamepadButtonBinding {
  action: Action;
}

export interface GamepadAxisBinding {
  action: Action;
  /** Multiplier applied to the raw axis value (use -1 to invert). */
  scale: number;
}

export interface InputMap {
  keys: Record<string, KeyBinding>;
  gamepadButtons: Record<number, GamepadButtonBinding>;
  gamepadAxes: Record<number, GamepadAxisBinding>;
}

export const DEFAULT_INPUT_MAP: InputMap = {
  keys: {
    KeyW: { action: Action.MoveZ, value: -1 },
    KeyS: { action: Action.MoveZ, value: 1 },
    KeyA: { action: Action.MoveX, value: -1 },
    KeyD: { action: Action.MoveX, value: 1 },
    Space: { action: Action.Jump, value: 1 },
    KeyK: { action: Action.Punch, value: 1 },
    ShiftLeft: { action: Action.Crouch, value: 1 },
    ShiftRight: { action: Action.Crouch, value: 1 },
    ArrowLeft: { action: Action.CameraX, value: -1 },
    ArrowRight: { action: Action.CameraX, value: 1 },
    ArrowUp: { action: Action.CameraZ, value: -1 },
    ArrowDown: { action: Action.CameraZ, value: 1 },
  },
  gamepadButtons: {
    0: { action: Action.Jump },
    2: { action: Action.Punch },
    4: { action: Action.Crouch },
  },
  gamepadAxes: {
    0: { action: Action.MoveX, scale: 1 },
    1: { action: Action.MoveZ, scale: 1 },
    2: { action: Action.CameraX, scale: 1 },
    3: { action: Action.CameraZ, scale: 1 },
  },
};
