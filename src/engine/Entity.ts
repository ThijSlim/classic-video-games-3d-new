import { Component } from './Component';

export class Entity {
  private components = new Map<Function, Component>();

  addComponent<T extends Component>(component: T): T {
    component.entity = this;
    this.components.set(component.constructor, component);
    return component;
  }

  getComponent<T extends Component>(ctor: Function & { prototype: T }): T {
    const c = this.components.get(ctor);
    if (!c) {
      throw new Error(`Entity does not have component: ${ctor.name}`);
    }
    return c as T;
  }

  hasComponent(ctor: Function): boolean {
    return this.components.has(ctor);
  }
}
