import { describe, it, expect } from 'vitest';
import { Entity } from './Entity';
import { Transform } from './Transform';
import { Velocity } from './Velocity';
import { PlayerController, ActionGroup, ActionStateName } from './PlayerController';
import { GameState } from './GameState';
import { Command, CommandDispatcher, MoveCommand, DefeatEnemyCommand, DamagePlayerCommand, RespawnCommand } from './Command';

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

    const cmd: MoveCommand = { type: 'MOVE', entityId: 'test', dx: 3, dy: 0, dz: -2 };
    dispatcher.dispatch(cmd);

    const t = entity.getComponent(Transform);
    expect(t.position.x).toBe(3);
    expect(t.position.z).toBe(-2);
  });

  it('MOVE commands accumulate', () => {
    const { dispatcher, entity } = setup();

    dispatcher.dispatch({ type: 'MOVE', entityId: 'test', dx: 1, dy: 0, dz: 0 });
    dispatcher.dispatch({ type: 'MOVE', entityId: 'test', dx: 1, dy: 0, dz: 2 });

    const t = entity.getComponent(Transform);
    expect(t.position.x).toBe(2);
    expect(t.position.z).toBe(2);
  });

  it('MOVE command for unknown entity is silently ignored', () => {
    const { dispatcher } = setup();

    // Should not throw
    expect(() =>
      dispatcher.dispatch({ type: 'MOVE', entityId: 'nope', dx: 1, dy: 0, dz: 1 }),
    ).not.toThrow();
  });

  it('commands survive JSON round-trip', () => {
    const cmd: Command = { type: 'MOVE', entityId: 'test', dx: 1.5, dy: 0, dz: -0.5 };
    const json = JSON.stringify(cmd);
    const restored: Command = JSON.parse(json);

    expect(restored).toEqual(cmd);
  });

  it('MOVE command applies dy to Y position', () => {
    const { dispatcher, entity } = setup();
    entity.getComponent(Transform).position.y = 10;

    dispatcher.dispatch({ type: 'MOVE', entityId: 'test', dx: 0, dy: 2, dz: 0 });

    expect(entity.getComponent(Transform).position.y).toBe(12);
  });

  it('MOVE command with dy=0 does not alter Y position', () => {
    const { dispatcher, entity } = setup();
    entity.getComponent(Transform).position.y = 10;

    dispatcher.dispatch({ type: 'MOVE', entityId: 'test', dx: 1, dy: 0, dz: 1 });

    expect(entity.getComponent(Transform).position.y).toBe(10);
  });

  // ── DEFEAT_ENEMY ──────────────────────────────────────────────────

  it('DEFEAT_ENEMY removes the entity from GameState', () => {
    const { state, dispatcher } = setup();
    expect(state.getEntity('test')).toBeDefined();

    dispatcher.dispatch({ type: 'DEFEAT_ENEMY', entityId: 'test' });

    expect(state.getEntity('test')).toBeUndefined();
  });

  it('DEFEAT_ENEMY for unknown entity does not throw', () => {
    const { dispatcher } = setup();
    expect(() =>
      dispatcher.dispatch({ type: 'DEFEAT_ENEMY', entityId: 'nonexistent' }),
    ).not.toThrow();
  });

  it('DEFEAT_ENEMY command survives JSON round-trip', () => {
    const cmd: DefeatEnemyCommand = { type: 'DEFEAT_ENEMY', entityId: 'enemy-1' };
    const json = JSON.stringify(cmd);
    const restored = JSON.parse(json);
    expect(restored).toEqual(cmd);
  });

  // ── DAMAGE_PLAYER ─────────────────────────────────────────────────

  it('DAMAGE_PLAYER applies knockback velocity and enters knockback state', () => {
    const state = new GameState();
    const dispatcher = new CommandDispatcher(state);

    const entity = new Entity();
    entity.addComponent(new Transform());
    const velocity = entity.addComponent(new Velocity());
    const ctrl = entity.addComponent(new PlayerController());
    state.addEntity('player', entity);

    dispatcher.dispatch({
      type: 'DAMAGE_PLAYER',
      entityId: 'player',
      knockbackX: 0.5,
      knockbackY: 0.3,
      knockbackZ: -0.2,
    });

    expect(ctrl.actionGroup).toBe('Knockback');
    expect(ctrl.actionState).toBe('KnockbackAir');
    expect(velocity.linear.x).toBe(0.5);
    expect(velocity.linear.y).toBe(0.3);
    expect(velocity.linear.z).toBe(-0.2);
  });

  it('DAMAGE_PLAYER command survives JSON round-trip', () => {
    const cmd: DamagePlayerCommand = {
      type: 'DAMAGE_PLAYER',
      entityId: 'player',
      knockbackX: 1,
      knockbackY: 0.5,
      knockbackZ: -1,
    };
    const json = JSON.stringify(cmd);
    const restored = JSON.parse(json);
    expect(restored).toEqual(cmd);
  });

  // ── RESPAWN ───────────────────────────────────────────────────────

  it('RESPAWN resets position to spawn point', () => {
    const state = new GameState();
    const dispatcher = new CommandDispatcher(state);

    const entity = new Entity();
    const transform = entity.addComponent(new Transform());
    transform.position.set(100, -600, 50);
    entity.addComponent(new Velocity());
    entity.addComponent(new PlayerController());
    state.addEntity('player', entity);

    dispatcher.dispatch({
      type: 'RESPAWN',
      entityId: 'player',
      spawnX: 0,
      spawnY: 0.8,
      spawnZ: 0,
    });

    expect(transform.position.x).toBe(0);
    expect(transform.position.y).toBe(0.8);
    expect(transform.position.z).toBe(0);
  });

  it('RESPAWN zeroes velocity and resets to Idle', () => {
    const state = new GameState();
    const dispatcher = new CommandDispatcher(state);

    const entity = new Entity();
    entity.addComponent(new Transform());
    const velocity = entity.addComponent(new Velocity());
    velocity.linear.set(5, -10, 3);
    const ctrl = entity.addComponent(new PlayerController());
    ctrl.actionGroup = ActionGroup.Airborne;
    ctrl.actionState = ActionStateName.Falling;
    state.addEntity('player', entity);

    dispatcher.dispatch({
      type: 'RESPAWN',
      entityId: 'player',
      spawnX: 0,
      spawnY: 0.8,
      spawnZ: 0,
    });

    expect(velocity.linear.x).toBe(0);
    expect(velocity.linear.y).toBe(0);
    expect(velocity.linear.z).toBe(0);
    expect(ctrl.actionGroup).toBe(ActionGroup.Grounded);
    expect(ctrl.actionState).toBe(ActionStateName.Idle);
  });

  it('RESPAWN for unknown entity does not throw', () => {
    const { dispatcher } = setup();
    expect(() =>
      dispatcher.dispatch({ type: 'RESPAWN', entityId: 'nonexistent', spawnX: 0, spawnY: 0, spawnZ: 0 }),
    ).not.toThrow();
  });

  it('RESPAWN command survives JSON round-trip', () => {
    const cmd: RespawnCommand = { type: 'RESPAWN', entityId: 'player', spawnX: 0, spawnY: 0.8, spawnZ: 0 };
    const json = JSON.stringify(cmd);
    const restored = JSON.parse(json);
    expect(restored).toEqual(cmd);
  });
});
