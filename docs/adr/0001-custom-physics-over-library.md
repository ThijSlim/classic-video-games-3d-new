# Custom physics engine instead of a physics library

SM64's movement feel is defined by highly specific, unrealistic physics — asymmetric gravity, quirky slope interactions, speed preservation through jumps, and frame-specific coyote time windows. We chose to implement all physics (gravity, velocity integration, friction, collision detection and response) from scratch rather than using a general-purpose library like Cannon.js or Rapier.

## Considered Options

- **General-purpose physics library (Cannon.js / Rapier / Ammo.js)**: Would provide rigid body simulation and collision out of the box, but defaults assume realistic physics. SM64's movement is intentionally unrealistic — we'd spend more time fighting the library's assumptions than benefiting from it.
- **Hybrid (library for collision detection, custom movement)**: Tempting, but SM64's collision system (floor/wall/ceiling classification, surface types) is tightly coupled to its movement code. Splitting them across custom and library code would create a leaky abstraction.
- **Fully custom (chosen)**: Full control over every physics parameter. The SM64 decomp community has documented the original constants and algorithms extensively, making faithful recreation feasible.
