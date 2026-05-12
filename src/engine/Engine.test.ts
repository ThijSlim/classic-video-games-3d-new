import { describe, it, expect, vi } from 'vitest';
import { Engine } from './Engine';
import { Scene } from './Scene';

class TestScene extends Scene {
  tickFn = vi.fn();
  renderFn = vi.fn();

  override onTick(ctx: { dt: number }): void {
    this.tickFn(ctx.dt);
  }

  override onRender(alpha: number): void {
    this.renderFn(alpha);
  }
}

describe('Engine accumulator', () => {
  it('runs the correct number of ticks for a given elapsed time', () => {
    const scene = new TestScene();
    const engine = new Engine();
    engine.sceneStack.push(scene);

    // 30Hz = 1/30 ≈ 0.0333s per tick
    // 0.1s elapsed should produce 3 ticks (3 * 1/30 = 0.1)
    const ticks = engine.simulateFrame(0.1);

    expect(ticks).toBe(3);
    expect(scene.tickFn).toHaveBeenCalledTimes(3);
    expect(scene.renderFn).toHaveBeenCalledTimes(1);
  });

  it('accumulates partial frames across calls', () => {
    const scene = new TestScene();
    const engine = new Engine();
    engine.sceneStack.push(scene);

    // 0.02s each — first call: 0 ticks (< 1/30), second call: 1 tick (0.04s > 1/30)
    const ticks1 = engine.simulateFrame(0.02);
    expect(ticks1).toBe(0);

    const ticks2 = engine.simulateFrame(0.02);
    expect(ticks2).toBe(1);
    expect(scene.tickFn).toHaveBeenCalledTimes(1);
  });

  it('caps at MAX_TICKS_PER_FRAME to prevent spiral of death', () => {
    const scene = new TestScene();
    const engine = new Engine();
    engine.sceneStack.push(scene);

    // Simulate a huge lag spike: 10 seconds
    const ticks = engine.simulateFrame(10);

    expect(ticks).toBe(Engine.MAX_TICKS_PER_FRAME);
    expect(scene.tickFn).toHaveBeenCalledTimes(Engine.MAX_TICKS_PER_FRAME);
  });

  it('passes fixed tick duration to tick callback', () => {
    const scene = new TestScene();
    const engine = new Engine();
    engine.sceneStack.push(scene);

    engine.simulateFrame(0.05);

    expect(scene.tickFn).toHaveBeenCalledWith(Engine.TICK_DURATION);
  });

  it('passes interpolation alpha between 0 and 1 to render callback', () => {
    const scene = new TestScene();
    const engine = new Engine();
    engine.sceneStack.push(scene);

    engine.simulateFrame(0.05);

    const alpha = scene.renderFn.mock.calls[0][0] as number;
    expect(alpha).toBeGreaterThanOrEqual(0);
    expect(alpha).toBeLessThan(1);
  });
});
