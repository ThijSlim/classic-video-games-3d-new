import { Scene, TickContext } from './Scene';

export class SceneStack {
  private readonly stack: Scene[] = [];

  get top(): Scene | undefined {
    return this.stack[this.stack.length - 1];
  }

  get size(): number {
    return this.stack.length;
  }

  push(scene: Scene): void {
    const previous = this.top;
    if (previous) {
      previous.onExit();
    }
    this.stack.push(scene);
    scene.onEnter();
  }

  pop(): Scene | undefined {
    const removed = this.stack.pop();
    if (removed) {
      removed.onExit();
    }
    const uncovered = this.top;
    if (uncovered) {
      uncovered.onEnter();
    }
    return removed;
  }

  replace(scene: Scene): void {
    const removed = this.stack.pop();
    if (removed) {
      removed.onExit();
    }
    this.stack.push(scene);
    scene.onEnter();
  }

  tick(tickContext: TickContext): void {
    for (const scene of this.stack) {
      scene.onTick(tickContext);
    }
  }

  render(alpha: number): void {
    for (const scene of this.stack) {
      scene.onRender(alpha);
    }
  }

  action(action: string, pressed: boolean): void {
    const topScene = this.top;
    if (topScene) {
      topScene.onAction(action, pressed);
    }
  }
}
