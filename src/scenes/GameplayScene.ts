import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
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
import { DebugOverlay } from '../engine/DebugOverlay';
import { DeathPlaneSystem } from '../engine/DeathPlaneSystem';
import { Simulation } from '../engine/Simulation';
import { Surface, SurfaceType, createSurface } from '../engine/Surface';
import { TestLevelData } from './TestLevel';
import { createGoombaMesh } from './GoombaMesh';
import { LevelDescriptor } from './LevelDescriptor';

const PLAYER_ENTITY_ID = 'player';

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
  private readonly debugOverlay: DebugOverlay;
  private readonly deathPlaneSystem: DeathPlaneSystem;
  private readonly simulation: Simulation;
  private readonly descriptor: LevelDescriptor;

  // Enemies
  private readonly enemyMeshes: Map<string, THREE.Group> = new Map();
  private readonly enemyTransforms: Map<string, Transform> = new Map();

  // GLB loading state
  private loading = false;
  private loadingOverlay: HTMLDivElement | null = null;

  constructor(renderer: Renderer, descriptor: LevelDescriptor, inputSystem?: InputSystem) {
    super();
    this.renderer = renderer;
    this.descriptor = descriptor;
    this.inputSystem = inputSystem ?? new InputSystem();

    this.gameState = new GameState();
    this.dispatcher = new CommandDispatcher(this.gameState);
    this.physicsSystem = new PhysicsSystem();
    this.collisionSystem = new CollisionSystem();
    this.aiSystem = new AISystem();
    this.cameraState = new CameraState();
    this.cameraSystem = new CameraSystem();

    const spawnPoint = descriptor.spawnPosition;
    this.deathPlaneSystem = new DeathPlaneSystem(descriptor.deathPlaneY, spawnPoint);
    this.simulation = new Simulation({
      inputSystem: this.inputSystem,
      gameState: this.gameState,
      dispatcher: this.dispatcher,
      playerEntityId: PLAYER_ENTITY_ID,
      aiSystem: this.aiSystem,
      physicsSystem: this.physicsSystem,
      collisionSystem: this.collisionSystem,
      deathPlaneSystem: this.deathPlaneSystem,
    });

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

    // Build level geometry from descriptor
    if (descriptor.geometrySource.type === 'procedural') {
      this.testLevel = descriptor.geometrySource.create();
      this.collisionSystem.setSurfaces(this.testLevel.surfaces);
    } else {
      // GLB placeholder until async load completes
      this.testLevel = { surfaces: [], group: new THREE.Group(), gridOverlay: new THREE.GridHelper(1, 1), waterVolumes: [] };
      this.loading = true;
    }
    this.collisionSystem.setWaterVolumes(descriptor.waterVolumes ?? []);

    // ── Enemy entities from descriptor ───────────────────────────────────
    for (const enemy of descriptor.enemies ?? []) {
      const entity = new Entity();
      const transform = entity.addComponent(new Transform());
      transform.position.copy(enemy.spawnPosition);
      entity.addComponent(new Velocity());
      entity.addComponent(Collider.sphere(enemy.colliderRadius));
      entity.addComponent(new EnemyTag());
      entity.addComponent(
        new PatrolAI(
          enemy.patrol.pointA,
          enemy.patrol.pointB,
          enemy.patrol.speed,
        ),
      );
      this.gameState.addEntity(enemy.id, entity);
      this.enemyTransforms.set(enemy.id, transform);

      const mesh = createGoombaMesh();
      this.enemyMeshes.set(enemy.id, mesh);
    }

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
      if (e.code === 'F3') {
        e.preventDefault();
        this.debugOverlay.toggle();
      }
    };

    this.debugOverlay = new DebugOverlay();
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
    for (const mesh of this.enemyMeshes.values()) {
      this.renderer.scene.add(mesh);
    }

    // Pointer lock
    const canvas = this.renderer.renderer.domElement;
    canvas.addEventListener('click', this.onCanvasClick);
    document.addEventListener('mousemove', this.onMouseMove);
    document.addEventListener('keydown', this.onKeyDown);

    // If GLB-based, start async load
    if (this.loading && this.descriptor.geometrySource.type === 'glb') {
      this.showLoadingOverlay();
      this.loadGlb(this.descriptor.geometrySource.url);
    }

    // Always load the real Mario mesh; placeholder stays until it arrives
    this.loadPlayerMesh();
  }

  override onExit(): void {
    this.inputSystem.detach();
    this.renderer.scene.remove(this.playerMesh);
    this.renderer.scene.remove(this.testLevel.group);
    for (const mesh of this.enemyMeshes.values()) {
      this.renderer.scene.remove(mesh);
    }

    const canvas = this.renderer.renderer.domElement;
    canvas.removeEventListener('click', this.onCanvasClick);
    document.removeEventListener('mousemove', this.onMouseMove);
    document.removeEventListener('keydown', this.onKeyDown);

    if (document.pointerLockElement === canvas) {
      document.exitPointerLock();
    }

    this.hideLoadingOverlay();
    this.debugOverlay.dispose();
  }

  override onTick(_tickContext: TickContext): void {
    // Skip simulation while loading GLB
    if (this.loading) return;

    // Snapshot for render interpolation — must precede Simulation.tick() which moves entities
    this.prevPosition.copy(this.transform.position);
    this.prevRotationY = this.transform.rotation.y;

    // Simulation: Input → PlayerController → AI → Physics → Collision → resolveContacts → DeathPlane
    this.simulation.tick();

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

    // Debug overlay tick rate tracking
    this.debugOverlay.recordTick(_tickContext.dt);
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

    // Sync enemy meshes (or hide if defeated)
    for (const [id, mesh] of this.enemyMeshes) {
      if (this.gameState.getEntity(id)) {
        mesh.visible = true;
        const transform = this.enemyTransforms.get(id)!;
        mesh.position.copy(transform.position);
      } else {
        mesh.visible = false;
      }
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

    // Debug overlay render-time update
    this.debugOverlay.update(this.transform, this.velocity, this.playerController);

    this.renderer.render();
  }

  // ── GLB loading ────────────────────────────────────────────────────

  private loadGlb(url: string): void {
    const loader = new GLTFLoader();
    loader.load(
      url,
      (gltf) => {
        const surfaces = GameplayScene.extractSurfaces(gltf.scene);
        this.collisionSystem.setSurfaces(surfaces);

        // Store surfaces in testLevel for potential later use
        (this.testLevel as { surfaces: Surface[] }).surfaces = surfaces;

        // Add loaded model to the scene group
        this.testLevel.group.add(gltf.scene);
        this.renderer.scene.add(this.testLevel.group);

        // Place player at spawn
        const sp = this.descriptor.spawnPosition;
        this.transform.position.set(sp.x, sp.y, sp.z);

        this.loading = false;
        this.hideLoadingOverlay();
      },
      undefined,
      (error) => {
        console.error('Failed to load GLB:', error);
        this.loading = false;
        this.hideLoadingOverlay();
      },
    );
  }

  /** Replace placeholder player mesh children with the loaded Mario GLB. */
  private loadPlayerMesh(): void {
    const loader = new GLTFLoader();
    loader.load(
      '/models/mario.glb',
      (gltf) => {
        // Remove placeholder geometry, keep the Group anchor in place
        while (this.playerMesh.children.length > 0) {
          this.playerMesh.remove(this.playerMesh.children[0]);
        }
        this.playerMesh.add(gltf.scene);
      },
      undefined,
      (error) => {
        console.error('Failed to load Mario model:', error);
        // Placeholder remains visible on failure
      },
    );
  }

  /** Extract all triangles from a loaded GLTF scene into Surface[]. */
  static extractSurfaces(root: THREE.Object3D): Surface[] {
    const surfaces: Surface[] = [];
    root.traverse((child) => {
      if (!(child instanceof THREE.Mesh)) return;
      const mesh = child as THREE.Mesh;
      const geometry = mesh.geometry;
      if (!geometry) return;

      // Ensure world matrix is up to date
      mesh.updateWorldMatrix(true, false);
      const matrix = mesh.matrixWorld;

      const position = geometry.getAttribute('position');
      if (!position) return;

      const index = geometry.getIndex();
      const v0 = new THREE.Vector3();
      const v1 = new THREE.Vector3();
      const v2 = new THREE.Vector3();

      if (index) {
        for (let i = 0; i < index.count; i += 3) {
          v0.fromBufferAttribute(position, index.getX(i)).applyMatrix4(matrix);
          v1.fromBufferAttribute(position, index.getX(i + 1)).applyMatrix4(matrix);
          v2.fromBufferAttribute(position, index.getX(i + 2)).applyMatrix4(matrix);
          surfaces.push(createSurface(v0.clone(), v1.clone(), v2.clone(), SurfaceType.DEFAULT));
        }
      } else {
        for (let i = 0; i < position.count; i += 3) {
          v0.fromBufferAttribute(position, i).applyMatrix4(matrix);
          v1.fromBufferAttribute(position, i + 1).applyMatrix4(matrix);
          v2.fromBufferAttribute(position, i + 2).applyMatrix4(matrix);
          surfaces.push(createSurface(v0.clone(), v1.clone(), v2.clone(), SurfaceType.DEFAULT));
        }
      }
    });
    return surfaces;
  }

  // ── Loading overlay ────────────────────────────────────────────────

  private showLoadingOverlay(): void {
    if (this.loadingOverlay) return;
    const overlay = document.createElement('div');
    overlay.style.cssText =
      'position:fixed;inset:0;display:flex;align-items:center;justify-content:center;' +
      'background:rgba(0,0,0,0.7);color:#fff;font:bold 24px sans-serif;z-index:9999;';
    overlay.textContent = 'Loading level…';
    document.body.appendChild(overlay);
    this.loadingOverlay = overlay;
  }

  private hideLoadingOverlay(): void {
    if (this.loadingOverlay) {
      this.loadingOverlay.remove();
      this.loadingOverlay = null;
    }
  }
}
