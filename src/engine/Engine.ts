const TICK_RATE = 30;
const TICK_DURATION = 1 / TICK_RATE;
const MAX_TICKS_PER_FRAME = 5;

export type TickCallback = (dt: number) => void;
export type RenderCallback = (alpha: number) => void;

export class Engine {
  private accumulator = 0;
  private lastTime = 0;
  private running = false;
  private onTick: TickCallback;
  private onRender: RenderCallback;
  private rafId = 0;

  /** Exposed for testing */
  static readonly TICK_DURATION = TICK_DURATION;
  static readonly MAX_TICKS_PER_FRAME = MAX_TICKS_PER_FRAME;

  constructor(onTick: TickCallback, onRender: RenderCallback) {
    this.onTick = onTick;
    this.onRender = onRender;
  }

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
      this.onTick(TICK_DURATION);
      this.accumulator -= TICK_DURATION;
    }

    const alpha = this.accumulator / TICK_DURATION;
    this.onRender(alpha);
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
      this.onTick(TICK_DURATION);
      this.accumulator -= TICK_DURATION;
      tickCount++;
    }

    const alpha = this.accumulator / TICK_DURATION;
    this.onRender(alpha);
    return tickCount;
  }
}
