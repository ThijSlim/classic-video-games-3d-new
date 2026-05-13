import * as THREE from 'three';
import { Component } from './Component';

/**
 * PatrolAI component: holds two waypoints and movement speed.
 * The entity moves toward the current target waypoint and flips
 * direction when it arrives within a threshold distance.
 */
export class PatrolAI extends Component {
  readonly waypoints: [THREE.Vector3, THREE.Vector3];
  readonly speed: number;

  /** Index into waypoints array: 0 or 1. */
  currentTargetIndex: 0 | 1 = 0;

  /** Distance threshold to consider waypoint reached. */
  readonly arrivalThreshold: number;

  constructor(
    waypointA: THREE.Vector3,
    waypointB: THREE.Vector3,
    speed: number,
    arrivalThreshold = 0.5,
  ) {
    super();
    this.waypoints = [waypointA, waypointB];
    this.speed = speed;
    this.arrivalThreshold = arrivalThreshold;
  }

  get currentTarget(): THREE.Vector3 {
    return this.waypoints[this.currentTargetIndex];
  }

  flipDirection(): void {
    this.currentTargetIndex = this.currentTargetIndex === 0 ? 1 : 0;
  }
}
