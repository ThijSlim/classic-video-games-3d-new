import { Entity } from './Entity';

export class GameState {
  private readonly entities = new Map<string, Entity>();

  addEntity(id: string, entity: Entity): void {
    this.entities.set(id, entity);
  }

  getEntity(id: string): Entity | undefined {
    return this.entities.get(id);
  }

  removeEntity(id: string): boolean {
    return this.entities.delete(id);
  }

  allEntities(): IterableIterator<[string, Entity]> {
    return this.entities.entries();
  }
}
