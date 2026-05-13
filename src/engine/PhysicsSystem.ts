import { GameState } from './GameState';
import { CommandDispatcher } from './Command';
import { Velocity } from './Velocity';
import { Transform } from './Transform';
import {
  PlayerController,
  ActionGroup,
  ActionStateName,
  GROUND_DECEL,
} from './PlayerController';
import { Collider } from './Collider';
import { SurfaceType } from './Surface';

/** Slippery surfaces reduce friction to this fraction of normal. */
export const SLIPPERY_FRICTION_FACTOR = 0.2;

/** Gravity acceleration applied to airborne entities (units/tick²). */
export const GRAVITY = -4.0 * 0.01;

/** Terminal falling velocity (units/tick). */
export const TERMINAL_VELOCITY = -75.0 * 0.01;

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
          let decel = GROUND_DECEL;

          // Slippery surfaces reduce friction
          if (entity.hasComponent(Collider)) {
            const collider = entity.getComponent(Collider);
            if (
              collider.currentFloor?.surfaceType === SurfaceType.SLIPPERY
            ) {
              decel *= SLIPPERY_FRICTION_FACTOR;
            }
          }

          const speed = Math.sqrt(
            velocity.linear.x ** 2 + velocity.linear.z ** 2,
          );
          if (speed > decel) {
            const factor = (speed - decel) / speed;
            velocity.linear.x *= factor;
            velocity.linear.z *= factor;
          } else {
            velocity.linear.x = 0;
            velocity.linear.z = 0;
          }
        }

        // ── Gravity ──────────────────────────────────────────────────────
        if (ctrl.actionGroup === ActionGroup.Airborne) {
          velocity.linear.y += GRAVITY;
          if (velocity.linear.y < TERMINAL_VELOCITY) {
            velocity.linear.y = TERMINAL_VELOCITY;
          }
        }
      }

      // ── Position integration via MOVE command ──────────────────────────
      const dx = velocity.linear.x;
      const dy = velocity.linear.y;
      const dz = velocity.linear.z;
      if (dx !== 0 || dy !== 0 || dz !== 0) {
        dispatcher.dispatch({
          type: 'MOVE',
          entityId: id,
          dx,
          dy,
          dz,
        });
      }
    }
  }
}
