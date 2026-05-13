import * as THREE from 'three';
import { WaterVolume } from '../engine/WaterVolume';
import { TestLevelData } from './TestLevel';

/** Spawn position in world coordinates. */
export interface SpawnPosition {
  x: number;
  y: number;
  z: number;
}

/** Enemy definition for placement in a level. */
export interface EnemyDescriptor {
  id: string;
  spawnPosition: THREE.Vector3;
  colliderRadius: number;
  patrol: {
    pointA: THREE.Vector3;
    pointB: THREE.Vector3;
    speed: number;
  };
}

/** Geometry source: procedural TestLevel. */
export interface ProceduralGeometry {
  type: 'procedural';
  create: () => TestLevelData;
}

/** Geometry source: external .glb file. */
export interface GlbGeometry {
  type: 'glb';
  url: string;
}

export type GeometrySource = ProceduralGeometry | GlbGeometry;

/** Full descriptor for a level — everything needed to set up a GameplayScene. */
export interface LevelDescriptor {
  geometrySource: GeometrySource;
  spawnPosition: SpawnPosition;
  deathPlaneY: number;
  waterVolumes?: WaterVolume[];
  enemies?: EnemyDescriptor[];
}
