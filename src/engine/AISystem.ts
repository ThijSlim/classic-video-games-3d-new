import { GameState } from './GameState';
import { PatrolAI } from './PatrolAI';
import { Transform } from './Transform';
import { Velocity } from './Velocity';

/**
 * AISystem iterates all entities with PatrolAI + Transform + Velocity
 * components and updates their velocity to move toward the current waypoint.
 * Flips direction when within threshold distance of the target.
 */
export class AISystem {
  tick(gameState: GameState): void {
    for (const [_id, entity] of gameState.allEntities()) {
      if (
        !entity.hasComponent(PatrolAI) ||
        !entity.hasComponent(Transform) ||
        !entity.hasComponent(Velocity)
      ) {
        continue;
      }

      const patrol = entity.getComponent(PatrolAI);
      const transform = entity.getComponent(Transform);
      const velocity = entity.getComponent(Velocity);

      const target = patrol.currentTarget;
      const dx = target.x - transform.position.x;
      const dz = target.z - transform.position.z;
      const dist = Math.sqrt(dx * dx + dz * dz);

      if (dist <= patrol.arrivalThreshold) {
        patrol.flipDirection();
        // Immediately aim toward new target
        const newTarget = patrol.currentTarget;
        const ndx = newTarget.x - transform.position.x;
        const ndz = newTarget.z - transform.position.z;
        const nDist = Math.sqrt(ndx * ndx + ndz * ndz);
        if (nDist > 1e-6) {
          velocity.linear.x = (ndx / nDist) * patrol.speed;
          velocity.linear.z = (ndz / nDist) * patrol.speed;
        }
      } else {
        velocity.linear.x = (dx / dist) * patrol.speed;
        velocity.linear.z = (dz / dist) * patrol.speed;
      }
    }
  }
}
