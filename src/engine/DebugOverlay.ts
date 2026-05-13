import { Transform } from './Transform';
import { Velocity } from './Velocity';
import { PlayerController } from './PlayerController';
import { DebugStats } from './DebugStats';

export class DebugOverlay {
  private readonly el: HTMLDivElement;
  private visible = false;
  private readonly stats = new DebugStats();

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

  /** Call once per Tick to track tick rate. */
  recordTick(dt: number): void {
    this.stats.recordTick(dt);
  }

  /** Call once per rendered Frame to update the display. */
  update(transform: Transform, velocity: Velocity, ctrl: PlayerController): void {
    if (!this.visible) return;

    const pos = transform.position;
    const speed =
      Math.round(
        Math.sqrt(velocity.linear.x ** 2 + velocity.linear.y ** 2 + velocity.linear.z ** 2) * 100,
      ) / 100;

    this.el.textContent = this.stats.formatFrame(
      performance.now(),
      pos.x,
      pos.y,
      pos.z,
      speed,
      ctrl.actionGroup,
      ctrl.actionState,
    );
  }

  dispose(): void {
    this.el.remove();
  }
}
