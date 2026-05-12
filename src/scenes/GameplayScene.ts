import * as THREE from 'three';
import { Scene, TickContext } from '../engine/Scene';
import { Entity, Transform, Renderer } from '../engine';
import { Action } from '../engine/Action';
import { InputSystem } from '../engine/InputSystem';
import { GameState } from '../engine/GameState';
import { Command, CommandDispatcher } from '../engine/Command';

const MOVE_SPEED = 5; // units per second

const CUBE_ENTITY_ID = 'player-cube';

export class GameplayScene extends Scene {
  private readonly cubeEntity: Entity;
  private readonly transform: Transform;
  private readonly cubeMesh: THREE.Mesh;
  private readonly renderer: Renderer;
  private readonly inputSystem: InputSystem;
  private readonly gameState: GameState;
  private readonly dispatcher: CommandDispatcher;
  private readonly prevPosition = new THREE.Vector3();

  constructor(renderer: Renderer, inputSystem?: InputSystem) {
    super();
    this.renderer = renderer;
    this.inputSystem = inputSystem ?? new InputSystem();

    this.gameState = new GameState();
    this.dispatcher = new CommandDispatcher(this.gameState);

    this.cubeEntity = new Entity();
    this.transform = this.cubeEntity.addComponent(new Transform());
    this.gameState.addEntity(CUBE_ENTITY_ID, this.cubeEntity);

    const geometry = new THREE.BoxGeometry(1, 1, 1);
    const material = new THREE.MeshStandardMaterial({ color: 0xff4444 });
    this.cubeMesh = new THREE.Mesh(geometry, material);
  }

  override onEnter(): void {
    this.inputSystem.attach();
    this.renderer.scene.add(this.cubeMesh);
  }

  override onExit(): void {
    this.inputSystem.detach();
    this.renderer.scene.remove(this.cubeMesh);
  }

  override onTick(tickContext: TickContext): void {
    this.inputSystem.tick();

    this.prevPosition.copy(this.transform.position);

    const moveX = this.inputSystem.getAction(Action.MoveX).value;
    const moveZ = this.inputSystem.getAction(Action.MoveZ).value;

    if (moveX !== 0 || moveZ !== 0) {
      const cmd: Command = {
        type: 'MOVE',
        entityId: CUBE_ENTITY_ID,
        dx: moveX * MOVE_SPEED * tickContext.dt,
        dz: moveZ * MOVE_SPEED * tickContext.dt,
      };
      this.dispatcher.dispatch(cmd);
    }
  }

  override onRender(alpha: number): void {
    // Interpolate position between previous and current tick
    this.cubeMesh.position.lerpVectors(
      this.prevPosition,
      this.transform.position,
      alpha,
    );

    this.renderer.render();
  }
}
