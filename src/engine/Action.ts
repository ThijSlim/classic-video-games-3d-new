export enum Action {
  // Analog actions (-1 to +1)
  MoveX = 'MoveX',
  MoveZ = 'MoveZ',
  CameraX = 'CameraX',
  CameraZ = 'CameraZ',

  // Digital actions (boolean)
  Jump = 'Jump',
  Punch = 'Punch',
  Crouch = 'Crouch',
}

export type AnalogAction =
  | Action.MoveX
  | Action.MoveZ
  | Action.CameraX
  | Action.CameraZ;

export type DigitalAction = Action.Jump | Action.Punch | Action.Crouch;

const analogActions = new Set<Action>([
  Action.MoveX,
  Action.MoveZ,
  Action.CameraX,
  Action.CameraZ,
]);

export function isAnalogAction(action: Action): action is AnalogAction {
  return analogActions.has(action);
}
