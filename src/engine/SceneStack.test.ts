import { describe, it, expect, vi } from 'vitest';
import { SceneStack } from './SceneStack';
import { Scene } from './Scene';

class SpyScene extends Scene {
  readonly calls: string[] = [];

  override onEnter(): void {
    this.calls.push('onEnter');
  }
  override onExit(): void {
    this.calls.push('onExit');
  }
  override onTick(): void {
    this.calls.push('onTick');
  }
  override onRender(): void {
    this.calls.push('onRender');
  }
  override onAction(action: string, pressed: boolean): void {
    this.calls.push(`onAction:${action}:${pressed}`);
  }
}

describe('SceneStack', () => {
  it('push fires onEnter on the pushed scene', () => {
    const stack = new SceneStack();
    const scene = new SpyScene();

    stack.push(scene);

    expect(scene.calls).toEqual(['onEnter']);
    expect(stack.top).toBe(scene);
    expect(stack.size).toBe(1);
  });

  it('push fires onExit on the previous top scene', () => {
    const stack = new SceneStack();
    const sceneA = new SpyScene();
    const sceneB = new SpyScene();

    stack.push(sceneA);
    sceneA.calls.length = 0;

    stack.push(sceneB);

    expect(sceneA.calls).toEqual(['onExit']);
    expect(sceneB.calls).toEqual(['onEnter']);
    expect(stack.top).toBe(sceneB);
    expect(stack.size).toBe(2);
  });

  it('pop fires onExit on the popped scene then onEnter on the uncovered scene', () => {
    const stack = new SceneStack();
    const sceneA = new SpyScene();
    const sceneB = new SpyScene();

    stack.push(sceneA);
    stack.push(sceneB);
    sceneA.calls.length = 0;
    sceneB.calls.length = 0;

    const popped = stack.pop();

    expect(popped).toBe(sceneB);
    expect(sceneB.calls).toEqual(['onExit']);
    expect(sceneA.calls).toEqual(['onEnter']);
    expect(stack.top).toBe(sceneA);
    expect(stack.size).toBe(1);
  });

  it('pop on a single-scene stack fires onExit and leaves empty stack', () => {
    const stack = new SceneStack();
    const scene = new SpyScene();

    stack.push(scene);
    scene.calls.length = 0;

    const popped = stack.pop();

    expect(popped).toBe(scene);
    expect(scene.calls).toEqual(['onExit']);
    expect(stack.top).toBeUndefined();
    expect(stack.size).toBe(0);
  });

  it('pop on empty stack returns undefined', () => {
    const stack = new SceneStack();

    const popped = stack.pop();

    expect(popped).toBeUndefined();
  });

  it('replace fires onExit on old scene then onEnter on new scene', () => {
    const stack = new SceneStack();
    const sceneA = new SpyScene();
    const sceneB = new SpyScene();

    stack.push(sceneA);
    sceneA.calls.length = 0;

    stack.replace(sceneB);

    expect(sceneA.calls).toEqual(['onExit']);
    expect(sceneB.calls).toEqual(['onEnter']);
    expect(stack.top).toBe(sceneB);
    expect(stack.size).toBe(1);
  });

  it('replace preserves scenes below the top', () => {
    const stack = new SceneStack();
    const sceneA = new SpyScene();
    const sceneB = new SpyScene();
    const sceneC = new SpyScene();

    stack.push(sceneA);
    stack.push(sceneB);
    sceneA.calls.length = 0;
    sceneB.calls.length = 0;

    stack.replace(sceneC);

    expect(sceneB.calls).toEqual(['onExit']);
    expect(sceneC.calls).toEqual(['onEnter']);
    expect(stack.size).toBe(2);
    // Pop sceneC to reveal sceneA
    stack.pop();
    expect(stack.top).toBe(sceneA);
  });

  it('only the top scene receives onAction', () => {
    const stack = new SceneStack();
    const sceneA = new SpyScene();
    const sceneB = new SpyScene();

    stack.push(sceneA);
    stack.push(sceneB);
    sceneA.calls.length = 0;
    sceneB.calls.length = 0;

    stack.action('Jump', true);

    expect(sceneB.calls).toEqual(['onAction:Jump:true']);
    expect(sceneA.calls).toEqual([]);
  });

  it('all scenes on the stack receive onTick', () => {
    const stack = new SceneStack();
    const sceneA = new SpyScene();
    const sceneB = new SpyScene();

    stack.push(sceneA);
    stack.push(sceneB);
    sceneA.calls.length = 0;
    sceneB.calls.length = 0;

    stack.tick({ dt: 1 / 30 });

    expect(sceneA.calls).toContain('onTick');
    expect(sceneB.calls).toContain('onTick');
  });

  it('all scenes on the stack receive onRender', () => {
    const stack = new SceneStack();
    const sceneA = new SpyScene();
    const sceneB = new SpyScene();

    stack.push(sceneA);
    stack.push(sceneB);
    sceneA.calls.length = 0;
    sceneB.calls.length = 0;

    stack.render(0.5);

    expect(sceneA.calls).toContain('onRender');
    expect(sceneB.calls).toContain('onRender');
  });

  it('lifecycle hook ordering on push: onExit(old) then onEnter(new)', () => {
    const stack = new SceneStack();
    const globalOrder: string[] = [];
    const sceneA = new SpyScene();
    const sceneB = new SpyScene();

    const origAExit = sceneA.onExit.bind(sceneA);
    sceneA.onExit = () => {
      origAExit();
      globalOrder.push('A:onExit');
    };
    sceneB.onEnter = () => {
      globalOrder.push('B:onEnter');
    };

    stack.push(sceneA);
    stack.push(sceneB);

    expect(globalOrder).toEqual(['A:onExit', 'B:onEnter']);
  });

  it('lifecycle hook ordering on pop: onExit(popped) then onEnter(uncovered)', () => {
    const stack = new SceneStack();
    const globalOrder: string[] = [];
    const sceneA = new SpyScene();
    const sceneB = new SpyScene();

    stack.push(sceneA);
    stack.push(sceneB);

    sceneB.onExit = () => {
      globalOrder.push('B:onExit');
    };
    sceneA.onEnter = () => {
      globalOrder.push('A:onEnter');
    };

    stack.pop();

    expect(globalOrder).toEqual(['B:onExit', 'A:onEnter']);
  });

  it('lifecycle hook ordering on replace: onExit(old) then onEnter(new)', () => {
    const stack = new SceneStack();
    const globalOrder: string[] = [];
    const sceneA = new SpyScene();
    const sceneB = new SpyScene();

    stack.push(sceneA);

    sceneA.onExit = () => {
      globalOrder.push('A:onExit');
    };
    sceneB.onEnter = () => {
      globalOrder.push('B:onEnter');
    };

    stack.replace(sceneB);

    expect(globalOrder).toEqual(['A:onExit', 'B:onEnter']);
  });
});
