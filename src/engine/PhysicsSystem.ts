import { GameState } from './GameState';
import { CommandDispatcher } from './Command';
import { Velocity } from './Velocity';
import { Transform } from './Transform';
import {
  PlayerController,
  ActionStateName,
  GROUND_DECEL,
} from './PlayerController';

/**
 * Integrates velocity into position each tick and applies friction
 * when the player character is in the Decelerating state.
 *
 * Runs after PlayerController.tick() so velocity is already set for the
 * current tick's input.  Position updates flow through MOVE Commands to
 * honour the Command pattern (ADR-0002).
 */
export class PhysicsSystem {
  tick(gameState: GameState, dispatcher: CommandDispatcher): void {
    for (const [id, entity] of gameState.allEntities()) {
      if (!entity.hasComponent(Velocity) || !entity.hasComponent(Transform)) {
        continue;
      }

      const velocity = entity.getComponent(Velocity);

      // ── Friction ───────────────────────────────────────────────────────
      if (entity.hasComponent(PlayerController)) {
        const ctrl = entity.getComponent(PlayerController);
        if (ctrl.actionState === ActionStateName.Decelerating) {
          const speed = Math.sqrt(
            velocity.linear.x ** 2 + velocity.linear.z ** 2,
          );
          if (speed > GROUND_DECEL) {
            const factor = (speed - GROUND_DECEL) / speed;
            velocity.linear.x *= factor;
            velocity.linear.z *= factor;
          } else {
            velocity.linear.x = 0;
            velocity.linear.z = 0;
          }
        }
      }

      // ── Position integration via MOVE command ──────────────────────────
      const dx = velocity.linear.x;
      const dz = velocity.linear.z;
      if (dx !== 0 || dz !== 0) {
        dispatcher.dispatch({
          type: 'MOVE',
          entityId: id,
          dx,
          dz,
        });
      }
    }
  }
}
