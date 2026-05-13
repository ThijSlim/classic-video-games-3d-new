import * as THREE from 'three';
import { Scene, TickContext } from '../engine/Scene';
import { Entity, Transform, Renderer } from '../engine';
import { InputSystem } from '../engine/InputSystem';
import { GameState } from '../engine/GameState';
import { CommandDispatcher } from '../engine/Command';
import { Velocity } from '../engine/Velocity';
import { PlayerController } from '../engine/PlayerController';
import { PhysicsSystem } from '../engine/PhysicsSystem';
import { CameraState } from '../engine/CameraState';
import { CameraSystem } from '../engine/CameraSystem';
import { Action } from '../engine/Action';
import { Collider } from '../engine/Collider';
import { CollisionSystem } from '../engine/CollisionSystem';
import { AISystem } from '../engine/AISystem';
import { PatrolAI } from '../engine/PatrolAI';
import { EnemyTag } from '../engine/EnemyTag';
import { createTestLevel, TestLevelData, WATER_VOLUMES } from './TestLevel';
import { createGoombaMesh } from './GoombaMesh';

const PLAYER_ENTITY_ID = 'player';
const GOOMBA_ENTITY_ID = 'goomba-1';

export class GameplayScene extends Scene {
  private readonly playerEntity: Entity;
  private readonly transform: Transform;
  private readonly velocity: Velocity;
  private readonly playerController: PlayerController;
  private readonly playerMesh: THREE.Group;
  private readonly testLevel: TestLevelData;
  private readonly renderer: Renderer;
  private readonly inputSystem: InputSystem;
  private readonly gameState: GameState;
  private readonly dispatcher: CommandDispatcher;
  private readonly physicsSystem: PhysicsSystem;
  private readonly collisionSystem: CollisionSystem;
  private readonly aiSystem: AISystem;
  private readonly cameraState: CameraState;
  private readonly cameraSystem: CameraSystem;
  private readonly prevPosition = new THREE.Vector3();
  private prevRotationY = 0;
  private readonly onCanvasClick: () => void;
  private readonly onMouseMove: (e: MouseEvent) => void;
  private readonly onKeyDown: (e: KeyboardEvent) => void;

  // Goomba
  private readonly goombaEntity: Entity;
  private readonly goombaTransform: Transform;
  private readonly goombaMesh: THREE.Group;

  constructor(renderer: Renderer, inputSystem?: InputSystem) {
    super();
    this.renderer = renderer;
    this.inputSystem = inputSystem ?? new InputSystem();

    this.gameState = new GameState();
    this.dispatcher = new CommandDispatcher(this.gameState);
    this.physicsSystem = new PhysicsSystem();
    this.collisionSystem = new CollisionSystem();
    this.aiSystem = new AISystem();
    this.cameraState = new CameraState();
    this.cameraSystem = new CameraSystem();

    this.playerEntity = new Entity();
    this.transform = this.playerEntity.addComponent(new Transform());
    this.velocity = this.playerEntity.addComponent(new Velocity());
    this.playerController = this.playerEntity.addComponent(
      new PlayerController(),
    );
    // Cylinder collider: SM64 radius 37 → 0.37, height 160 → 1.6
    this.playerEntity.addComponent(Collider.cylinder(0.37, 1.6));
    this.gameState.addEntity(PLAYER_ENTITY_ID, this.playerEntity);

    this.playerMesh = GameplayScene.createPlayerMesh();
    this.testLevel = createTestLevel();
    this.collisionSystem.setSurfaces(this.testLevel.surfaces);
    this.collisionSystem.setWaterVolumes(WATER_VOLUMES);

    // ── Goomba entity ──────────────────────────────────────────────────
    this.goombaEntity = new Entity();
    this.goombaTransform = this.goombaEntity.addComponent(new Transform());
    // Spawn near gap platforms D & E (X=14..23, Z=-2..2)
    this.goombaTransform.position.set(14, 0, 0);
    this.goombaEntity.addComponent(new Velocity());
    // Sphere collider with radius matching the bottom sphere (0.30)
    this.goombaEntity.addComponent(Collider.sphere(0.30));
    this.goombaEntity.addComponent(new EnemyTag());
    // Patrol between two waypoints ~4 units apart near gap platforms
    this.goombaEntity.addComponent(
      new PatrolAI(
        new THREE.Vector3(14, 0, 0),
        new THREE.Vector3(18, 0, 0),
        0.06, // movement speed (units/tick)
      ),
    );
    this.gameState.addEntity(GOOMBA_ENTITY_ID, this.goombaEntity);
    this.goombaMesh = createGoombaMesh();

    // Pointer-lock handlers — bound once so they can be removed in onExit
    const canvas = this.renderer.renderer.domElement;
    this.onCanvasClick = () => {
      canvas.requestPointerLock();
    };
    this.onMouseMove = (e: MouseEvent) => {
      if (document.pointerLockElement === canvas) {
        this.inputSystem.accumulateMouseDelta(e.movementX, e.movementY);
      }
    };

    // Grid toggle (G key)
    this.onKeyDown = (e: KeyboardEvent) => {
      if (e.code === 'KeyG') {
        this.testLevel.gridOverlay.visible =
          !this.testLevel.gridOverlay.visible;
      }
    };
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

  // ── Scene lifecycle ────────────────────────────────────────────────

  override onEnter(): void {
    this.inputSystem.attach();
    this.renderer.scene.add(this.playerMesh);
    this.renderer.scene.add(this.testLevel.group);
    this.renderer.scene.add(this.goombaMesh);

    // Pointer lock
    const canvas = this.renderer.renderer.domElement;
    canvas.addEventListener('click', this.onCanvasClick);
    document.addEventListener('mousemove', this.onMouseMove);
    document.addEventListener('keydown', this.onKeyDown);
  }

  override onExit(): void {
    this.inputSystem.detach();
    this.renderer.scene.remove(this.playerMesh);
    this.renderer.scene.remove(this.testLevel.group);
    this.renderer.scene.remove(this.goombaMesh);

    const canvas = this.renderer.renderer.domElement;
    canvas.removeEventListener('click', this.onCanvasClick);
    document.removeEventListener('mousemove', this.onMouseMove);
    document.removeEventListener('keydown', this.onKeyDown);

    if (document.pointerLockElement === canvas) {
      document.exitPointerLock();
    }
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

    // AI: update enemy patrol velocities
    this.aiSystem.tick(this.gameState);

    // Physics: friction + position integration via MOVE commands
    this.physicsSystem.tick(this.gameState, this.dispatcher);

    // Collision: floor snap, wall push-out, ceiling stop, entity-vs-entity
    this.collisionSystem.tick(this.gameState, this.dispatcher);

    // Camera: orbit follow + player override
    const moveX = this.inputSystem.getAction(Action.MoveX).value;
    const moveZ = this.inputSystem.getAction(Action.MoveZ).value;
    const playerIsMoving = moveX !== 0 || moveZ !== 0;
    this.cameraSystem.tick(
      this.cameraState,
      this.inputSystem,
      this.transform,
      playerIsMoving,
    );
  }

  override onRender(alpha: number): void {
    // Interpolate player mesh position
    this.playerMesh.position.lerpVectors(
      this.prevPosition,
      this.transform.position,
      alpha,
    );

    // Interpolate player mesh rotation (handle angle wrapping)
    let angleDiff = this.transform.rotation.y - this.prevRotationY;
    while (angleDiff > Math.PI) angleDiff -= 2 * Math.PI;
    while (angleDiff < -Math.PI) angleDiff += 2 * Math.PI;
    this.playerMesh.rotation.y = this.prevRotationY + angleDiff * alpha;

    // Sync Goomba mesh (or hide if defeated)
    if (this.gameState.getEntity(GOOMBA_ENTITY_ID)) {
      this.goombaMesh.visible = true;
      this.goombaMesh.position.copy(this.goombaTransform.position);
    } else {
      this.goombaMesh.visible = false;
    }

    // Interpolate camera between ticks for smooth visuals
    const cam = this.renderer.camera;
    cam.position.lerpVectors(
      this.cameraState.prevPosition,
      this.cameraState.currentPosition,
      alpha,
    );

    const lookAt = new THREE.Vector3().lerpVectors(
      this.cameraState.prevLookAt,
      this.cameraState.currentLookAt,
      alpha,
    );
    cam.lookAt(lookAt);

    this.renderer.render();
  }
}
