import { GameState } from './GameState';
import { Transform } from './Transform';
import { Velocity } from './Velocity';
import { PlayerController, ActionGroup, ActionStateName } from './PlayerController';

// ── Command types ──────────────────────────────────────────────────────

export interface MoveCommand {
  type: 'MOVE';
  entityId: string;
  dx: number;
  dy: number;
  dz: number;
}

export interface DefeatEnemyCommand {
  type: 'DEFEAT_ENEMY';
  entityId: string;
}

export interface DamagePlayerCommand {
  type: 'DAMAGE_PLAYER';
  entityId: string;
  knockbackX: number;
  knockbackY: number;
  knockbackZ: number;
}

export interface RespawnCommand {
  type: 'RESPAWN';
  entityId: string;
  spawnX: number;
  spawnY: number;
  spawnZ: number;
}

// Extend this union as new command types are added.
export type Command = MoveCommand | DefeatEnemyCommand | DamagePlayerCommand | RespawnCommand;

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
      case 'DEFEAT_ENEMY':
        this.handleDefeatEnemy(command);
        break;
      case 'DAMAGE_PLAYER':
        this.handleDamagePlayer(command);
        break;
      case 'RESPAWN':
        this.handleRespawn(command);
        break;
    }
  }

  private handleMove(cmd: MoveCommand): void {
    const entity = this.state.getEntity(cmd.entityId);
    if (!entity) return;
    const transform = entity.getComponent(Transform);
    transform.position.x += cmd.dx;
    transform.position.y += cmd.dy;
    transform.position.z += cmd.dz;
  }

  private handleDefeatEnemy(cmd: DefeatEnemyCommand): void {
    this.state.removeEntity(cmd.entityId);
  }

  private handleDamagePlayer(cmd: DamagePlayerCommand): void {
    const entity = this.state.getEntity(cmd.entityId);
    if (!entity) return;

    if (entity.hasComponent(PlayerController) && entity.hasComponent(Velocity)) {
      const ctrl = entity.getComponent(PlayerController);
      const velocity = entity.getComponent(Velocity);
      // Direct field writes — consistent with RESPAWN handler.
      // State machine transitions for the in-game path live in
      // PlayerController.resolveContacts; this handler serves the
      // future multiplayer server → client path.
      ctrl.actionGroup = ActionGroup.Knockback;
      ctrl.actionState = ActionStateName.KnockbackAir;
      ctrl.knockbackTicks = 0;
      ctrl.jumpSequence = 0;
      ctrl.leftGroundPassively = false;
      ctrl.coyoteCounter = 0;
      velocity.linear.x = cmd.knockbackX;
      velocity.linear.y = cmd.knockbackY;
      velocity.linear.z = cmd.knockbackZ;
    }
  }

  private handleRespawn(cmd: RespawnCommand): void {
    const entity = this.state.getEntity(cmd.entityId);
    if (!entity) return;

    const transform = entity.getComponent(Transform);
    transform.position.set(cmd.spawnX, cmd.spawnY, cmd.spawnZ);
    transform.rotation.set(0, 0, 0);

    if (entity.hasComponent(Velocity)) {
      const velocity = entity.getComponent(Velocity);
      velocity.linear.set(0, 0, 0);
    }

    if (entity.hasComponent(PlayerController)) {
      const ctrl = entity.getComponent(PlayerController);
      ctrl.actionGroup = ActionGroup.Grounded;
      ctrl.actionState = ActionStateName.Idle;
      ctrl.jumpSequence = 0;
      ctrl.ticksSinceLanding = 0;
      ctrl.coyoteCounter = 0;
      ctrl.leftGroundPassively = false;
      ctrl.knockbackTicks = 0;
    }
  }
}
