import * as THREE from 'three';
import { Engine, Entity, Renderer, Transform } from './engine';

const canvas = document.getElementById('game-canvas') as HTMLCanvasElement;
const renderer = new Renderer(canvas);

// Spawn a cube Entity
const cubeEntity = new Entity();
const transform = cubeEntity.addComponent(new Transform());

const geometry = new THREE.BoxGeometry(1, 1, 1);
const material = new THREE.MeshStandardMaterial({ color: 0xff4444 });
const cubeMesh = new THREE.Mesh(geometry, material);
renderer.scene.add(cubeMesh);

// Track previous rotation for interpolation
let prevRotationY = 0;
let currentRotationY = 0;

const ROTATION_SPEED = Math.PI / 2; // 90° per second

function tick(dt: number): void {
  prevRotationY = currentRotationY;
  currentRotationY += ROTATION_SPEED * dt;
  transform.rotation.y = currentRotationY;
}

function render(alpha: number): void {
  // Interpolate rotation for smooth display
  const displayRotationY = prevRotationY + (currentRotationY - prevRotationY) * alpha;
  cubeMesh.rotation.y = displayRotationY;
  cubeMesh.position.copy(transform.position);

  renderer.render();
}

const engine = new Engine(tick, render);
engine.start();
