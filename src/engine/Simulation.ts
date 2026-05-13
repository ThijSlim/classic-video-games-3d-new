import { GameState } from './GameState';
import { CommandDispatcher } from './Command';
import { InputSystem } from './InputSystem';
import { AISystem } from './AISystem';
import { PhysicsSystem } from './PhysicsSystem';
import { CollisionSystem } from './CollisionSystem';
import { DeathPlaneSystem } from './DeathPlaneSystem';
import { PlayerController } from './PlayerController';
import { Velocity } from './Velocity';
import { Transform } from './Transform';

export interface SimulationConfig {
  inputSystem: InputSystem;
  gameState: GameState;
  dispatcher: CommandDispatcher;
  /** The entity ID of the Player Character. */
  playerEntityId: string;
  aiSystem: AISystem;
  physicsSystem: PhysicsSystem;
  collisionSystem: CollisionSystem;
  deathPlaneSystem: DeathPlaneSystem;
}

/**
 * Owns and enforces the System tick-ordering contract for one game Tick.
 *
 * Order:
 *   1. InputSystem         — sample hardware state
 *   2. PlayerController    — input → velocity + ActionState
 *   3. AISystem            — enemy patrol velocities
 *   4. PhysicsSystem       — friction + gravity + position integration
 *   5. CollisionSystem     — geometry contact queries + MOVE commands
 *   6. resolveContacts     — feed collision results into PlayerController
 *   7. DeathPlaneSystem    — respawn players below the kill plane
 */
export class Simulation {
  private readonly config: SimulationConfig;

  constructor(config: SimulationConfig) {
    this.config = config;
  }

  tick(): void {
    const {
      inputSystem,
      gameState,
      dispatcher,
      playerEntityId,
      aiSystem,
      physicsSystem,
      collisionSystem,
      deathPlaneSystem,
    } = this.config;

    inputSystem.tick();

    // Player Character reads input → sets velocity and rotation
    const playerEntity = gameState.getEntity(playerEntityId);
    if (playerEntity?.hasComponent(PlayerController)) {
      playerEntity.getComponent(PlayerController).tick(
        inputSystem,
        playerEntity.getComponent(Velocity),
        playerEntity.getComponent(Transform),
      );
    }

    aiSystem.tick(gameState);
    physicsSystem.tick(gameState, dispatcher);

    const contacts = collisionSystem.tick(gameState, dispatcher);

    // Feed collision contact results back into PlayerController state machines
    for (const [id, contact] of contacts) {
      const entity = gameState.getEntity(id);
      if (!entity) continue;
      if (entity.hasComponent(PlayerController) && entity.hasComponent(Velocity)) {
        entity.getComponent(PlayerController).resolveContacts(
          contact,
          entity.getComponent(Velocity),
        );
      }
    }

    deathPlaneSystem.tick(gameState, dispatcher);
  }
}
