import * as THREE from 'three';
import { Component } from './Component';

export class Velocity extends Component {
  /** Linear velocity in engine units per tick (30 Hz). */
  readonly linear = new THREE.Vector3();
}
