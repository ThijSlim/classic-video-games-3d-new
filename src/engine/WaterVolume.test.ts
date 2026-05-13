import { describe, it, expect } from 'vitest';
import { isInWaterVolume, WaterVolume } from './WaterVolume';

const pool: WaterVolume = {
  minX: -8,
  maxX: -2,
  minY: -2,
  maxY: 0,
  minZ: -8,
  maxZ: -2,
  surfaceY: 0,
};

describe('isInWaterVolume', () => {
  it('returns true for position inside the volume', () => {
    expect(isInWaterVolume(-5, -1, -5, pool)).toBe(true);
  });

  it('returns true at the volume boundary edges (XZ)', () => {
    expect(isInWaterVolume(-8, -1, -8, pool)).toBe(true);
    expect(isInWaterVolume(-2, -1, -2, pool)).toBe(true);
  });

  it('returns false above the water surface', () => {
    expect(isInWaterVolume(-5, 0, -5, pool)).toBe(false);
    expect(isInWaterVolume(-5, 0.1, -5, pool)).toBe(false);
  });

  it('returns false outside the XZ bounds', () => {
    expect(isInWaterVolume(0, -1, 0, pool)).toBe(false);
    expect(isInWaterVolume(-9, -1, -5, pool)).toBe(false);
  });

  it('returns true just below the surface', () => {
    expect(isInWaterVolume(-5, -0.001, -5, pool)).toBe(true);
  });
});
