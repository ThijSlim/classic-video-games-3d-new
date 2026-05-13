import { LevelDescriptor } from './LevelDescriptor';

export const CASTLE_LEVEL_DESCRIPTOR: LevelDescriptor = {
  geometrySource: { type: 'glb', url: '/models/peach-castle-exterior.glb' },
  spawnPosition: { x: 0, y: 10, z: 0 },
  deathPlaneY: -50,
};
