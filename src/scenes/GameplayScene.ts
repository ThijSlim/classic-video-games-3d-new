import * as THREE from 'three';
import { Scene, TickContext } from '../engine/Scene';
import { Entity, Transform, Renderer } from '../engine';
import { InputSystem } from '../engine/InputSystem';
import { GameState } from '../engine/GameState';
import { CommandDispatcher } from '../engine/Command';
import { Velocity } from '../engine/Velocity';
import { PlayerController } from '../engine/PlayerController';
import { PhysicsSystem } from '../engine/PhysicsSystem';

const PLAYER_ENTITY_ID = 'player';

export class GameplayScene extends Scene {
  private readonly playerEntity: Entity;
  private readonly transform: Transform;
  private readonly velocity: Velocity;
  private readonly playerController: PlayerController;
  private readonly playerMesh: THREE.Group;
  private readonly groundMesh: THREE.Mesh;
  private readonly renderer: Renderer;
  private readonly inputSystem: InputSystem;
  private readonly gameState: GameState;
  private readonly dispatcher: CommandDispatcher;
  private readonly physicsSystem: PhysicsSystem;
  private readonly prevPosition = new THREE.Vector3();
  private prevRotationY = 0;

  constructor(renderer: Renderer, inputSystem?: InputSystem) {
    super();
    this.renderer = renderer;
    this.inputSystem = inputSystem ?? new InputSystem();

    this.gameState = new GameState();
    this.dispatcher = new CommandDispatcher(this.gameState);
    this.physicsSystem = new PhysicsSystem();

    this.playerEntity = new Entity();
    this.transform = this.playerEntity.addComponent(new Transform());
    this.velocity = this.playerEntity.addComponent(new Velocity());
    this.playerController = this.playerEntity.addComponent(
      new PlayerController(),
    );
    this.gameState.addEntity(PLAYER_ENTITY_ID, this.playerEntity);

    this.playerMesh = GameplayScene.createPlayerMesh();
    this.groundMesh = GameplayScene.createGroundMesh();
  }

  // ── Placeholder Mario model ────────────────────────────────────────

  private static createPlayerMesh(): THREE.Group {
    const group = new THREE.Group();

    // Body: red cylinder (SM64: radius 37, height 100 → ×0.01)
    const bodyGeom = new THREE.CylinderGeometry(0.37, 0.37, 1.0, 16);
    const bodyMat = new THREE.MeshStandardMaterial({ color: 0xff0000 });
    const body = new THREE.Mesh(bodyGeom, bodyMat);
    body.position.y = 0.5;
    group.add(body);

    // Head: peach sphere (SM64: radius 40 → ×0.01), offset forward
    const headGeom = new THREE.SphereGeometry(0.4, 16, 16);
    const headMat = new THREE.MeshStandardMaterial({ color: 0xffccaa });
    const head = new THREE.Mesh(headGeom, headMat);
    head.position.set(0, 1.2, -0.1);
    group.add(head);

    // Cap: red flattened hemisphere on top of head
    const capGeom = new THREE.SphereGeometry(
      0.42,
      16,
      8,
      0,
      Math.PI * 2,
      0,
      Math.PI / 2,
    );
    const capMat = new THREE.MeshStandardMaterial({ color: 0xff0000 });
    const cap = new THREE.Mesh(capGeom, capMat);
    cap.position.set(0, 1.45, -0.1);
    cap.scale.y = 0.45;
    group.add(cap);

    return group;
  }

  private static createGroundMesh(): THREE.Mesh {
    const geom = new THREE.PlaneGeometry(200, 200);
    const mat = new THREE.MeshStandardMaterial({ color: 0x44aa44 });
    const mesh = new THREE.Mesh(geom, mat);
    mesh.rotation.x = -Math.PI / 2;
    return mesh;
  }

  // ── Scene lifecycle ────────────────────────────────────────────────

  override onEnter(): void {
    this.inputSystem.attach();
    this.renderer.scene.add(this.playerMesh);
    this.renderer.scene.add(this.groundMesh);

    // Pull camera back so the flat plane and character are visible
    this.renderer.camera.position.set(0, 10, 15);
    this.renderer.camera.lookAt(0, 0, 0);
  }

  override onExit(): void {
    this.inputSystem.detach();
    this.renderer.scene.remove(this.playerMesh);
    this.renderer.scene.remove(this.groundMesh);
  }

  override onTick(_tickContext: TickContext): void {
    this.inputSystem.tick();

    // Snapshot for render interpolation
    this.prevPosition.copy(this.transform.position);
    this.prevRotationY = this.transform.rotation.y;

    // Player state machine → sets velocity + rotation
    this.playerController.tick(
      this.inputSystem,
      this.velocity,
      this.transform,
    );

    // Physics: friction + position integration via MOVE commands
    this.physicsSystem.tick(this.gameState, this.dispatcher);
  }

  override onRender(alpha: number): void {
    // Interpolate position
    this.playerMesh.position.lerpVectors(
      this.prevPosition,
      this.transform.position,
      alpha,
    );

    // Interpolate rotation (handle angle wrapping)
    let angleDiff = this.transform.rotation.y - this.prevRotationY;
    while (angleDiff > Math.PI) angleDiff -= 2 * Math.PI;
    while (angleDiff < -Math.PI) angleDiff += 2 * Math.PI;
    this.playerMesh.rotation.y = this.prevRotationY + angleDiff * alpha;

    this.renderer.render();
  }
}
