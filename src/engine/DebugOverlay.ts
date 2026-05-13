import { Transform } from './Transform';
import { Velocity } from './Velocity';
import { PlayerController, ActionGroup, ActionStateName } from './PlayerController';

const TICK_RATE = 30;
const FPS_SMOOTHING = 0.9;

export class DebugOverlay {
  private readonly el: HTMLDivElement;
  private visible = false;

  // FPS tracking
  private lastFrameTime = 0;
  private smoothedFps = 60;

  // Tick rate tracking
  private tickCount = 0;
  private tickRateAccumulator = 0;
  private measuredTickRate = TICK_RATE;

  constructor() {
    this.el = document.createElement('div');
    this.el.style.cssText = [
      'position: absolute',
      'top: 8px',
      'left: 8px',
      'padding: 8px 12px',
      'background: rgba(0, 0, 0, 0.7)',
      'color: #0f0',
      'font-family: monospace',
      'font-size: 13px',
      'line-height: 1.5',
      'pointer-events: none',
      'z-index: 9999',
      'display: none',
      'white-space: pre',
    ].join(';');
    document.body.appendChild(this.el);
  }

  toggle(): void {
    this.visible = !this.visible;
    this.el.style.display = this.visible ? 'block' : 'none';
  }

  get isVisible(): boolean {
    return this.visible;
  }

  /** Call once per tick to track tick rate. */
  recordTick(dt: number): void {
    this.tickCount++;
    this.tickRateAccumulator += dt;
    if (this.tickRateAccumulator >= 1) {
      this.measuredTickRate = this.tickCount;
      this.tickCount = 0;
      this.tickRateAccumulator -= 1;
    }
  }

  /** Call once per rendered frame to update the display. */
  update(transform: Transform, velocity: Velocity, ctrl: PlayerController): void {
    if (!this.visible) return;

    const now = performance.now();
    if (this.lastFrameTime > 0) {
      const delta = (now - this.lastFrameTime) / 1000;
      const instantFps = delta > 0 ? 1 / delta : 0;
      this.smoothedFps = FPS_SMOOTHING * this.smoothedFps + (1 - FPS_SMOOTHING) * instantFps;
    }
    this.lastFrameTime = now;

    const pos = transform.position;
    const speed = Math.round(
      Math.sqrt(velocity.linear.x ** 2 + velocity.linear.y ** 2 + velocity.linear.z ** 2) * 100,
    ) / 100;

    const lines = [
      `FPS: ${Math.round(this.smoothedFps)}`,
      `Tick: ${this.measuredTickRate} Hz`,
      `Pos: ${Math.round(pos.x)}, ${Math.round(pos.y)}, ${Math.round(pos.z)}`,
      `State: ${ctrl.actionGroup} / ${ctrl.actionState}`,
      `Speed: ${speed}`,
    ];

    this.el.textContent = lines.join('\n');
  }

  dispose(): void {
    this.el.remove();
  }
}
