import { Component } from './Component';
import { Surface } from './Surface';

export enum ColliderShape {
  CYLINDER = 'CYLINDER',
  SPHERE = 'SPHERE',
  AABB = 'AABB',
}

export class Collider extends Component {
  readonly shape: ColliderShape;
  readonly radius: number;
  readonly height: number;
  readonly halfExtents: { x: number; y: number; z: number };

  /** The floor surface the entity is currently standing on (set by CollisionSystem). */
  currentFloor: Surface | null = null;

  /** @internal Use the static factory methods instead. */
  protected constructor(
    shape: ColliderShape,
    radius: number,
    height: number,
    halfExtents: { x: number; y: number; z: number },
  ) {
    super();
    this.shape = shape;
    this.radius = radius;
    this.height = height;
    this.halfExtents = halfExtents;
  }

  static cylinder(radius: number, height: number): Collider {
    return new Collider(ColliderShape.CYLINDER, radius, height, {
      x: 0,
      y: 0,
      z: 0,
    });
  }

  static sphere(radius: number): Collider {
    return new Collider(ColliderShape.SPHERE, radius, 0, {
      x: 0,
      y: 0,
      z: 0,
    });
  }

  static aabb(hx: number, hy: number, hz: number): Collider {
    return new Collider(ColliderShape.AABB, 0, 0, { x: hx, y: hy, z: hz });
  }
}
