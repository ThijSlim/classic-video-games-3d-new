import { describe, it, expect } from 'vitest';
import { Entity } from './Entity';
import { Transform } from './Transform';
import { Velocity } from './Velocity';
import { PlayerController, ActionGroup } from './PlayerController';
import { GameState } from './GameState';
import { CommandDispatcher } from './Command';
import { DeathPlaneSystem } from './DeathPlaneSystem';

const SPAWN = { x: 0, y: 1, z: 0 };

function setup() {
  const state = new GameState();
  const dispatcher = new CommandDispatcher(state);
  const system = new DeathPlaneSystem(-10, SPAWN);

  const entity = new Entity();
  const transform = entity.addComponent(new Transform());
  entity.addComponent(new Velocity());
  entity.addComponent(new PlayerController());
  state.addEntity('player', entity);

  return { state, dispatcher, system, transform };
}

describe('DeathPlaneSystem', () => {
  it('respawns player when below death plane', () => {
    const { dispatcher, system, transform } = setup();
    transform.position.set(0, -15, 0);

    system.tick(setup().state, setup().dispatcher);
    // Use the same state/dispatcher from setup
    const { state, dispatcher: d, system: s, transform: t } = setup();
    t.position.set(0, -15, 0);
    s.tick(state, d);

    expect(t.position.y).toBe(SPAWN.y);
  });

  it('respawns to the configured spawn point', () => {
    const { state, dispatcher, system, transform } = setup();
    transform.position.set(5, -20, 3);

    system.tick(state, dispatcher);

    expect(transform.position.x).toBe(SPAWN.x);
    expect(transform.position.y).toBe(SPAWN.y);
    expect(transform.position.z).toBe(SPAWN.z);
  });

  it('does not respawn player when above death plane', () => {
    const { state, dispatcher, system, transform } = setup();
    transform.position.set(5, 0, 5);

    system.tick(state, dispatcher);

    expect(transform.position.y).toBe(0);
  });

  it('does not respawn player at exactly the death plane threshold', () => {
    const { state, dispatcher, system, transform } = setup();
    transform.position.set(0, -10, 0);

    system.tick(state, dispatcher);

    // -10 is not < -10, so no respawn
    expect(transform.position.y).toBe(-10);
  });

  it('ignores entities without PlayerController', () => {
    const state = new GameState();
    const dispatcher = new CommandDispatcher(state);
    const system = new DeathPlaneSystem(-10, SPAWN);

    const entity = new Entity();
    const transform = entity.addComponent(new Transform());
    transform.position.set(0, -50, 0);
    // No PlayerController
    state.addEntity('noCtrl', entity);

    expect(() => system.tick(state, dispatcher)).not.toThrow();
    expect(transform.position.y).toBe(-50);
  });

  it('resets ActionState to Grounded Idle on respawn', () => {
    const { state, dispatcher, system, transform } = setup();
    const entity = state.getEntity('player')!;
    const ctrl = entity.getComponent(PlayerController);
    ctrl.actionGroup = ActionGroup.Airborne;
    transform.position.set(0, -25, 0);

    system.tick(state, dispatcher);

    expect(ctrl.actionGroup).toBe(ActionGroup.Grounded);
  });
});
