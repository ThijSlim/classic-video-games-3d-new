# Command pattern for state mutations (multiplayer readiness)

All game state mutations are expressed as serializable Commands rather than direct property writes. In single-player, Commands are applied immediately to local state. This creates a clean seam for future multiplayer with SpacetimeDB: each Command type maps to a SpacetimeDB reducer, and the server becomes the authoritative state owner — without changing game logic.

## Considered Options

- **Direct state mutation**: Simpler for single-player but impossible to retrofit for multiplayer without rewriting all game logic.
- **Centralized state store (ECS tables)**: The "correct" multiplayer-first architecture, but adds significant indirection and complexity that slows down single-player development.
- **Command pattern (chosen)**: Game logic dispatches Commands; a handler applies them. Minimal overhead in single-player, and the Command boundary becomes the network boundary when multiplayer is added.
