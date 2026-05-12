import { GameState } from './GameState';
import { Transform } from './Transform';

// ── Command types ──────────────────────────────────────────────────────

export interface MoveCommand {
  type: 'MOVE';
  entityId: string;
  dx: number;
  dz: number;
}

// Extend this union as new command types are added.
export type Command = MoveCommand;

// ── Dispatcher ─────────────────────────────────────────────────────────

export class CommandDispatcher {
  private readonly state: GameState;

  constructor(state: GameState) {
    this.state = state;
  }

  dispatch(command: Command): void {
    switch (command.type) {
      case 'MOVE':
        this.handleMove(command);
        break;
    }
  }

  private handleMove(cmd: MoveCommand): void {
    const entity = this.state.getEntity(cmd.entityId);
    if (!entity) return;
    const transform = entity.getComponent(Transform);
    transform.position.x += cmd.dx;
    transform.position.z += cmd.dz;
  }
}
