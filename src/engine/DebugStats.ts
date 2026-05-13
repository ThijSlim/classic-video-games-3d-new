const TICK_RATE = 30;
const FPS_SMOOTHING = 0.9;

/**
 * Pure, DOM-free debug statistics tracker.
 *
 * Records tick rate and smoothed FPS, and formats a display string.
 * Accepts `nowMs` as an injected parameter so it is fully testable
 * without a browser environment.
 */
export class DebugStats {
  private lastNowMs = 0;
  private smoothedFps = 60;
  private tickCount = 0;
  private tickRateAccumulator = 0;
  measuredTickRate = TICK_RATE;

  /** Call once per Tick to track tick rate. */
  recordTick(dt: number): void {
    this.tickCount++;
    this.tickRateAccumulator += dt;
    if (this.tickRateAccumulator >= 1) {
      this.measuredTickRate = this.tickCount;
      this.tickCount = 0;
      this.tickRateAccumulator -= 1;
    }
  }

  /**
   * Compute the formatted debug string for one rendered Frame.
   *
   * @param nowMs        Current time in ms — caller-injected for testability.
   * @param posX         Player X position.
   * @param posY         Player Y position.
   * @param posZ         Player Z position.
   * @param speed        Player speed (velocity magnitude).
   * @param actionGroup  Current ActionGroup name.
   * @param actionState  Current ActionState name.
   */
  formatFrame(
    nowMs: number,
    posX: number,
    posY: number,
    posZ: number,
    speed: number,
    actionGroup: string,
    actionState: string,
  ): string {
    if (this.lastNowMs > 0) {
      const delta = (nowMs - this.lastNowMs) / 1000;
      const instantFps = delta > 0 ? 1 / delta : 0;
      this.smoothedFps = FPS_SMOOTHING * this.smoothedFps + (1 - FPS_SMOOTHING) * instantFps;
    }
    this.lastNowMs = nowMs;

    return [
      `FPS: ${Math.round(this.smoothedFps)}`,
      `Tick: ${this.measuredTickRate} Hz`,
      `Pos: ${Math.round(posX)}, ${Math.round(posY)}, ${Math.round(posZ)}`,
      `State: ${actionGroup} / ${actionState}`,
      `Speed: ${speed}`,
    ].join('\n');
  }
}
