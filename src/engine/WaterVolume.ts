/** Axis-aligned box trigger defining a water volume. */
export interface WaterVolume {
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
  minZ: number;
  maxZ: number;
  /** Y coordinate of the water surface. */
  surfaceY: number;
}

/** Check if a position (x, y, z) is inside the water volume. */
export function isInWaterVolume(x: number, y: number, z: number, volume: WaterVolume): boolean {
  return (
    x >= volume.minX && x <= volume.maxX &&
    y < volume.surfaceY &&
    z >= volume.minZ && z <= volume.maxZ
  );
}
