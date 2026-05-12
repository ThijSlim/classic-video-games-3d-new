import * as THREE from 'three';

/**
 * Local-only camera state for the Lakitu Camera.
 * NOT part of the serializable GameState — camera is a client-side concern.
 */
export class CameraState {
  /** Horizontal orbit angle in radians. 0 = camera at +Z from player. */
  yaw = 0;
  /** Vertical orbit angle in radians. Positive = above horizontal. */
  pitch = Math.asin(3 / 8); // ~22° → height ≈ 3 at distance 8
  /** Distance from look-at point in engine units (800 SM64 units). */
  distance = 8;
  /** Height above player feet for look-at point (80 SM64 units = chest). */
  readonly lookAtHeight = 0.8;

  /** Ticks remaining before auto-follow resumes after manual camera input. */
  graceTimer = 0;
  /** How many consecutive ticks the player has been idle (no movement input). */
  playerIdleTicks = 0;

  // ── Render interpolation ───────────────────────────────────────────

  readonly prevPosition = new THREE.Vector3();
  readonly prevLookAt = new THREE.Vector3();
  readonly currentPosition = new THREE.Vector3();
  readonly currentLookAt = new THREE.Vector3();

  constructor(playerPosition?: THREE.Vector3) {
    this.computePositions(playerPosition ?? new THREE.Vector3());
    this.prevPosition.copy(this.currentPosition);
    this.prevLookAt.copy(this.currentLookAt);
  }

  /** Recompute currentPosition and currentLookAt from yaw/pitch/distance. */
  computePositions(playerPosition: THREE.Vector3): void {
    this.currentLookAt.set(
      playerPosition.x,
      playerPosition.y + this.lookAtHeight,
      playerPosition.z,
    );
    this.currentPosition.set(
      this.currentLookAt.x +
        this.distance * Math.sin(this.yaw) * Math.cos(this.pitch),
      this.currentLookAt.y + this.distance * Math.sin(this.pitch),
      this.currentLookAt.z +
        this.distance * Math.cos(this.yaw) * Math.cos(this.pitch),
    );
  }
}
