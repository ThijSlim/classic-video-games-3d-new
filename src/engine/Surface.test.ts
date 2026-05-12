import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import {
  Surface,
  SurfaceType,
  SurfaceClass,
  classifySurface,
  createSurface,
  FLOOR_THRESHOLD,
} from './Surface';

describe('Surface', () => {
  // ── classifySurface ────────────────────────────────────────────────

  describe('classifySurface', () => {
    it('classifies upward-facing normals above threshold as FLOOR', () => {
      expect(classifySurface(1.0)).toBe(SurfaceClass.FLOOR);
      expect(classifySurface(0.866)).toBe(SurfaceClass.FLOOR); // 30° ramp
    });

    it('classifies steep normals below threshold as WALL', () => {
      expect(classifySurface(0.5)).toBe(SurfaceClass.WALL); // 60° ramp
      expect(classifySurface(0.0)).toBe(SurfaceClass.WALL); // vertical
      expect(classifySurface(FLOOR_THRESHOLD - 0.01)).toBe(SurfaceClass.WALL);
    });

    it('classifies downward-facing normals as CEILING', () => {
      expect(classifySurface(-1.0)).toBe(SurfaceClass.CEILING);
      expect(classifySurface(-0.5)).toBe(SurfaceClass.CEILING);
      expect(classifySurface(-0.02)).toBe(SurfaceClass.CEILING);
    });

    it('classifies near-zero negative normals as CEILING', () => {
      expect(classifySurface(-0.011)).toBe(SurfaceClass.CEILING);
    });

    it('classifies near-zero normals between thresholds as WALL', () => {
      expect(classifySurface(-0.005)).toBe(SurfaceClass.WALL);
      expect(classifySurface(0.01)).toBe(SurfaceClass.WALL);
    });
  });

  // ── createSurface ──────────────────────────────────────────────────

  describe('createSurface', () => {
    it('computes upward normal for a flat horizontal triangle', () => {
      const s = createSurface(
        new THREE.Vector3(0, 0, 0),
        new THREE.Vector3(0, 0, 1),
        new THREE.Vector3(1, 0, 0),
      );
      expect(s.normal.x).toBeCloseTo(0);
      expect(s.normal.y).toBeCloseTo(1);
      expect(s.normal.z).toBeCloseTo(0);
      expect(s.surfaceClass).toBe(SurfaceClass.FLOOR);
    });

    it('computes correct normal for a 30° ramp (classified as FLOOR)', () => {
      // Ramp along Z: bottom (0,0,0), top (0,4,6.93), width along X
      const h = 4;
      const d = h / Math.tan((30 * Math.PI) / 180);
      const s = createSurface(
        new THREE.Vector3(0, 0, 0),
        new THREE.Vector3(0, h, d),
        new THREE.Vector3(5, 0, 0),
      );
      expect(s.normal.y).toBeCloseTo(Math.cos((30 * Math.PI) / 180), 2);
      expect(s.surfaceClass).toBe(SurfaceClass.FLOOR);
    });

    it('computes correct normal for a 60° ramp (classified as WALL)', () => {
      const h = 4;
      const d = h / Math.tan((60 * Math.PI) / 180);
      const s = createSurface(
        new THREE.Vector3(0, 0, 0),
        new THREE.Vector3(0, h, d),
        new THREE.Vector3(5, 0, 0),
      );
      expect(s.normal.y).toBeCloseTo(Math.cos((60 * Math.PI) / 180), 2);
      expect(s.surfaceClass).toBe(SurfaceClass.WALL);
    });

    it('assigns surface type correctly', () => {
      const s = createSurface(
        new THREE.Vector3(0, 0, 0),
        new THREE.Vector3(0, 0, 1),
        new THREE.Vector3(1, 0, 0),
        SurfaceType.SLIPPERY,
      );
      expect(s.surfaceType).toBe(SurfaceType.SLIPPERY);
    });

    it('defaults to DEFAULT surface type', () => {
      const s = createSurface(
        new THREE.Vector3(0, 0, 0),
        new THREE.Vector3(0, 0, 1),
        new THREE.Vector3(1, 0, 0),
      );
      expect(s.surfaceType).toBe(SurfaceType.DEFAULT);
    });

    it('clones input vertices (mutation-safe)', () => {
      const v0 = new THREE.Vector3(0, 0, 0);
      const v1 = new THREE.Vector3(0, 0, 1);
      const v2 = new THREE.Vector3(1, 0, 0);
      const s = createSurface(v0, v1, v2);

      v0.set(99, 99, 99);
      expect(s.v0.x).toBe(0);
    });
  });
});
