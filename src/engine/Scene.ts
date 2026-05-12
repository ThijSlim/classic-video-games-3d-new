export interface TickContext {
  dt: number;
}

export abstract class Scene {
  onEnter(): void {}
  onExit(): void {}
  onTick(_tickContext: TickContext): void {}
  onRender(_alpha: number): void {}
  onAction(_action: string, _pressed: boolean): void {}
}
