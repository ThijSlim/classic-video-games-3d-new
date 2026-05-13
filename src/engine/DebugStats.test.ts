import { describe, it, expect } from 'vitest';
import { DebugStats } from './DebugStats';

describe('DebugStats', () => {
  it('formats position values rounded to integers', () => {
    const stats = new DebugStats();
    const text = stats.formatFrame(0, 1.7, 2.3, -3.8, 0, 'Grounded', 'Idle');
    expect(text).toContain('Pos: 2, 2, -4');
  });

  it('formats action group and state', () => {
    const stats = new DebugStats();
    const text = stats.formatFrame(0, 0, 0, 0, 0, 'Airborne', 'Jumping');
    expect(text).toContain('State: Airborne / Jumping');
  });

  it('formats speed', () => {
    const stats = new DebugStats();
    const text = stats.formatFrame(0, 0, 0, 0, 1.23, 'Grounded', 'Running');
    expect(text).toContain('Speed: 1.23');
  });

  it('includes FPS line in output', () => {
    const stats = new DebugStats();
    const text = stats.formatFrame(0, 0, 0, 0, 0, 'Grounded', 'Idle');
    expect(text).toMatch(/FPS: \d+/);
  });

  it('includes tick rate line in output', () => {
    const stats = new DebugStats();
    const text = stats.formatFrame(0, 0, 0, 0, 0, 'Grounded', 'Idle');
    expect(text).toContain('Tick: 30 Hz');
  });

  it('records tick rate after 1 second worth of ticks', () => {
    const stats = new DebugStats();
    for (let i = 0; i < 30; i++) {
      stats.recordTick(1 / 30);
    }
    expect(stats.measuredTickRate).toBe(30);
  });

  it('does not update measuredTickRate before a full second elapses', () => {
    const stats = new DebugStats();
    for (let i = 0; i < 15; i++) {
      stats.recordTick(1 / 30);
    }
    // Only half a second has passed — measuredTickRate still at default
    expect(stats.measuredTickRate).toBe(30);
  });

  it('smooths FPS across consecutive frames at 60fps', () => {
    const stats = new DebugStats();
    const interval = 1000 / 60;
    // Warm up the exponential smoother
    for (let i = 0; i < 12; i++) {
      stats.formatFrame(i * interval, 0, 0, 0, 0, 'Grounded', 'Idle');
    }
    const text = stats.formatFrame(12 * interval, 0, 0, 0, 0, 'Grounded', 'Idle');
    const match = text.match(/FPS: (\d+)/);
    expect(match).not.toBeNull();
    const fps = parseInt(match![1]);
    expect(fps).toBeGreaterThan(50);
    expect(fps).toBeLessThan(70);
  });
});
