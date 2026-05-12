import * as THREE from 'three';
import { Component } from './Component';

export class Transform extends Component {
  readonly position = new THREE.Vector3();
  readonly rotation = new THREE.Euler();
}
