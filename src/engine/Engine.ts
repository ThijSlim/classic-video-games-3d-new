import { SceneStack } from './SceneStack';

const TICK_RATE = 30;
const TICK_DURATION = 1 / TICK_RATE;
const MAX_TICKS_PER_FRAME = 5;

export class Engine {
  private accumulator = 0;
  private lastTime = 0;
  private running = false;
  private rafId = 0;
  readonly sceneStack = new SceneStack();

  /** Exposed for testing */
  static readonly TICK_DURATION = TICK_DURATION;
  static readonly MAX_TICKS_PER_FRAME = MAX_TICKS_PER_FRAME;

  start(): void {
    if (this.running) return;
    this.running = true;
    this.lastTime = performance.now() / 1000;
    this.rafId = requestAnimationFrame(this.loop);
  }

  stop(): void {
    this.running = false;
    cancelAnimationFrame(this.rafId);
  }

  private loop = (nowMs: number): void => {
    if (!this.running) return;
    this.rafId = requestAnimationFrame(this.loop);

    const now = nowMs / 1000;
    const frameTime = now - this.lastTime;
    this.lastTime = now;

    this.accumulator += frameTime;

    // Spiral-of-death cap
    const maxAccumulator = MAX_TICKS_PER_FRAME * TICK_DURATION;
    if (this.accumulator > maxAccumulator) {
      this.accumulator = maxAccumulator;
    }

    while (this.accumulator >= TICK_DURATION) {
      this.sceneStack.tick({ dt: TICK_DURATION });
      this.accumulator -= TICK_DURATION;
    }

    const alpha = this.accumulator / TICK_DURATION;
    this.sceneStack.render(alpha);
  };

  /**
   * Simulate time advancing for testing purposes.
   * Returns the number of ticks executed.
   */
  simulateFrame(elapsedSeconds: number): number {
    this.accumulator += elapsedSeconds;

    const maxAccumulator = MAX_TICKS_PER_FRAME * TICK_DURATION;
    if (this.accumulator > maxAccumulator) {
      this.accumulator = maxAccumulator;
    }

    let tickCount = 0;
    while (this.accumulator >= TICK_DURATION) {
      this.sceneStack.tick({ dt: TICK_DURATION });
      this.accumulator -= TICK_DURATION;
      tickCount++;
    }

    const alpha = this.accumulator / TICK_DURATION;
    this.sceneStack.render(alpha);
    return tickCount;
  }
}
