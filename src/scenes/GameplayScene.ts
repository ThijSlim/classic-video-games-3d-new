import * as THREE from 'three';
import { Scene, TickContext } from '../engine/Scene';
import { Entity, Transform, Renderer } from '../engine';

const ROTATION_SPEED = Math.PI / 2; // 90° per second

export class GameplayScene extends Scene {
  private readonly cubeEntity: Entity;
  private readonly transform: Transform;
  private readonly cubeMesh: THREE.Mesh;
  private readonly renderer: Renderer;
  private prevRotationY = 0;
  private currentRotationY = 0;

  constructor(renderer: Renderer) {
    super();
    this.renderer = renderer;

    this.cubeEntity = new Entity();
    this.transform = this.cubeEntity.addComponent(new Transform());

    const geometry = new THREE.BoxGeometry(1, 1, 1);
    const material = new THREE.MeshStandardMaterial({ color: 0xff4444 });
    this.cubeMesh = new THREE.Mesh(geometry, material);
  }

  override onEnter(): void {
    this.renderer.scene.add(this.cubeMesh);
  }

  override onExit(): void {
    this.renderer.scene.remove(this.cubeMesh);
  }

  override onTick(tickContext: TickContext): void {
    this.prevRotationY = this.currentRotationY;
    this.currentRotationY += ROTATION_SPEED * tickContext.dt;
    this.transform.rotation.y = this.currentRotationY;
  }

  override onRender(alpha: number): void {
    const displayRotationY =
      this.prevRotationY + (this.currentRotationY - this.prevRotationY) * alpha;
    this.cubeMesh.rotation.y = displayRotationY;
    this.cubeMesh.position.copy(this.transform.position);

    this.renderer.render();
  }
}
