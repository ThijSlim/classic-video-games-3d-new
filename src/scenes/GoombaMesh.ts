import * as THREE from 'three';

/**
 * Create a placeholder Goomba mesh: two stacked brown spheres with eyes.
 * - Bottom sphere: radius ~0.30 (30 SM64 units × 0.01)
 * - Top sphere: radius ~0.20 (20 SM64 units × 0.01)
 * - Eyes: small white spheres with black pupil spheres on front of top sphere.
 */
export function createGoombaMesh(): THREE.Group {
  const group = new THREE.Group();

  const brownMat = new THREE.MeshStandardMaterial({ color: 0x8B4513 });

  // Bottom sphere (body)
  const bodyGeom = new THREE.SphereGeometry(0.30, 16, 16);
  const body = new THREE.Mesh(bodyGeom, brownMat);
  body.position.y = 0.30;
  group.add(body);

  // Top sphere (head)
  const headGeom = new THREE.SphereGeometry(0.20, 16, 16);
  const head = new THREE.Mesh(headGeom, brownMat);
  head.position.y = 0.70;
  group.add(head);

  // Eyes
  const whiteMat = new THREE.MeshStandardMaterial({ color: 0xffffff });
  const blackMat = new THREE.MeshStandardMaterial({ color: 0x000000 });

  // Left eye
  const leftEyeGeom = new THREE.SphereGeometry(0.06, 8, 8);
  const leftEye = new THREE.Mesh(leftEyeGeom, whiteMat);
  leftEye.position.set(-0.08, 0.75, -0.16);
  group.add(leftEye);

  const leftPupilGeom = new THREE.SphereGeometry(0.03, 8, 8);
  const leftPupil = new THREE.Mesh(leftPupilGeom, blackMat);
  leftPupil.position.set(-0.08, 0.75, -0.20);
  group.add(leftPupil);

  // Right eye
  const rightEyeGeom = new THREE.SphereGeometry(0.06, 8, 8);
  const rightEye = new THREE.Mesh(rightEyeGeom, whiteMat);
  rightEye.position.set(0.08, 0.75, -0.16);
  group.add(rightEye);

  const rightPupilGeom = new THREE.SphereGeometry(0.03, 8, 8);
  const rightPupil = new THREE.Mesh(rightPupilGeom, blackMat);
  rightPupil.position.set(0.08, 0.75, -0.20);
  group.add(rightPupil);

  return group;
}
