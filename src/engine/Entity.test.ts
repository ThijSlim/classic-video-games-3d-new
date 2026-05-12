import { describe, it, expect } from 'vitest';
import { Entity } from './Entity';
import { Component } from './Component';

class HealthComponent extends Component {
  hp = 100;
}

class SpeedComponent extends Component {
  speed = 10;
}

describe('Entity-Component', () => {
  it('can add and get a component', () => {
    const entity = new Entity();
    const health = entity.addComponent(new HealthComponent());

    const retrieved = entity.getComponent(HealthComponent);
    expect(retrieved).toBe(health);
    expect(retrieved.hp).toBe(100);
  });

  it('hasComponent returns true for added components', () => {
    const entity = new Entity();
    entity.addComponent(new HealthComponent());

    expect(entity.hasComponent(HealthComponent)).toBe(true);
  });

  it('hasComponent returns false for missing components', () => {
    const entity = new Entity();

    expect(entity.hasComponent(HealthComponent)).toBe(false);
  });

  it('getComponent throws for missing component', () => {
    const entity = new Entity();

    expect(() => entity.getComponent(HealthComponent)).toThrow(
      'Entity does not have component: HealthComponent',
    );
  });

  it('can hold multiple different components', () => {
    const entity = new Entity();
    entity.addComponent(new HealthComponent());
    entity.addComponent(new SpeedComponent());

    expect(entity.hasComponent(HealthComponent)).toBe(true);
    expect(entity.hasComponent(SpeedComponent)).toBe(true);
    expect(entity.getComponent(SpeedComponent).speed).toBe(10);
  });

  it('sets entity reference on component', () => {
    const entity = new Entity();
    const health = entity.addComponent(new HealthComponent());

    expect(health.entity).toBe(entity);
  });
});
