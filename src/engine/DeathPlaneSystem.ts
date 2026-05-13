import { GameState } from './GameState';
import { CommandDispatcher } from './Command';
import { Transform } from './Transform';
import { PlayerController } from './PlayerController';

/**
 * Monitors all PlayerController entities each Tick and respawns any whose
 * Y position has fallen below the configured death plane threshold.
 */
export class DeathPlaneSystem {
  constructor(
    private readonly deathPlaneY: number,
    private readonly spawnPoint: { readonly x: number; readonly y: number; readonly z: number },
  ) {}

  tick(gameState: GameState, dispatcher: CommandDispatcher): void {
    for (const [id, entity] of gameState.allEntities()) {
      if (!entity.hasComponent(PlayerController) || !entity.hasComponent(Transform)) continue;
      const pos = entity.getComponent(Transform).position;
      if (pos.y < this.deathPlaneY) {
        dispatcher.dispatch({
          type: 'RESPAWN',
          entityId: id,
          spawnX: this.spawnPoint.x,
          spawnY: this.spawnPoint.y,
          spawnZ: this.spawnPoint.z,
        });
      }
    }
  }
}
