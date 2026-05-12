import { describe, it, expect } from 'vitest';
import { Entity } from './Entity';
import { Transform } from './Transform';
import { GameState } from './GameState';
import { Command, CommandDispatcher, MoveCommand } from './Command';

describe('Command System', () => {
  function setup() {
    const state = new GameState();
    const dispatcher = new CommandDispatcher(state);

    const entity = new Entity();
    entity.addComponent(new Transform());
    state.addEntity('test', entity);

    return { state, dispatcher, entity };
  }

  it('MOVE command updates Transform position', () => {
    const { dispatcher, entity } = setup();

    const cmd: MoveCommand = { type: 'MOVE', entityId: 'test', dx: 3, dz: -2 };
    dispatcher.dispatch(cmd);

    const t = entity.getComponent(Transform);
    expect(t.position.x).toBe(3);
    expect(t.position.z).toBe(-2);
  });

  it('MOVE commands accumulate', () => {
    const { dispatcher, entity } = setup();

    dispatcher.dispatch({ type: 'MOVE', entityId: 'test', dx: 1, dz: 0 });
    dispatcher.dispatch({ type: 'MOVE', entityId: 'test', dx: 1, dz: 2 });

    const t = entity.getComponent(Transform);
    expect(t.position.x).toBe(2);
    expect(t.position.z).toBe(2);
  });

  it('MOVE command for unknown entity is silently ignored', () => {
    const { dispatcher } = setup();

    // Should not throw
    expect(() =>
      dispatcher.dispatch({ type: 'MOVE', entityId: 'nope', dx: 1, dz: 1 }),
    ).not.toThrow();
  });

  it('commands survive JSON round-trip', () => {
    const cmd: Command = { type: 'MOVE', entityId: 'test', dx: 1.5, dz: -0.5 };
    const json = JSON.stringify(cmd);
    const restored: Command = JSON.parse(json);

    expect(restored).toEqual(cmd);
  });

  it('MOVE command does not alter Y position', () => {
    const { dispatcher, entity } = setup();
    entity.getComponent(Transform).position.y = 10;

    dispatcher.dispatch({ type: 'MOVE', entityId: 'test', dx: 1, dz: 1 });

    expect(entity.getComponent(Transform).position.y).toBe(10);
  });
});
