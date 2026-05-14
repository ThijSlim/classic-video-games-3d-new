# Super Mario 64 Web Recreation

A faithful recreation of Super Mario 64 for the web browser, built as a custom game engine on top of Three.js. Placeholder 3D models are used for characters; level geometry is imported from .glb files converted from original SM64 COLLADA rips. Multiplayer support via SpacetimeDB is planned as a second phase after single-player is working.

## Language

**Engine**:
The custom TypeScript layer that owns the game loop, physics, collision, input, camera, and entity management. Three.js is used only as the rendering backend.
_Avoid_: Framework, library

**Renderer**:
The Three.js-based subsystem responsible for drawing the scene. It knows about meshes, materials, lights, and shaders — but nothing about gameplay.
_Avoid_: Graphics engine, display layer

**Level**:
A self-contained 3D environment the player can explore, containing terrain, objects, and enemies. Equivalent to a "course" in the original SM64.
_Avoid_: Map, stage, world (which means a group of levels)

**World**:
A group of related levels accessed from a shared hub area.
_Avoid_: Zone, area

**Player Character**:
The entity the player controls directly. Faithful to Mario's movement set from SM64.
_Avoid_: Avatar, hero, protagonist

**Entity**:
A game object in the world, represented as a class instance that holds a collection of Components. Has no behavior of its own.
_Avoid_: GameObject, Node, Actor

**Component**:
A self-contained data-and-behavior unit attached to an Entity (e.g., Transform, Collider, Renderer). Entities are composed by mixing Components.
_Avoid_: Module, trait, mixin

**System**:
A global process that runs each frame and operates on Entities or engine-wide concerns (e.g., PhysicsSystem, InputSystem). Systems contain logic that cuts across many Entities.
_Avoid_: Manager, service, controller

**Collision**:
The detection and response when two geometric shapes overlap or contact. Handled entirely by custom engine code — no external physics library.
_Avoid_: Hit detection, contact

**Surface**:
A triangle in the level geometry classified by type (floor, wall, ceiling) and material properties (slippery, burning, etc.). Determines how the Player Character interacts with terrain.
_Avoid_: Face, polygon, tile

**Tick**:
A single fixed-timestep physics update (30Hz, matching the original SM64). All game logic and physics run at this fixed rate regardless of display framerate.
_Avoid_: Frame, step, update

**Frame**:
A single rendered image sent to the display. Runs at the monitor's refresh rate (60/120/144Hz). Rendering interpolates between Ticks for smooth visuals.
_Avoid_: Tick (which refers to the fixed logic update)

**Action**:
An abstract input intent (e.g., "Jump", "Punch", "CameraLeft") that game logic reacts to. Decoupled from physical inputs — mapped to keyboard keys and gamepad buttons via an InputMap.
_Avoid_: Command, event, keybind

**InputMap**:
The configuration that binds physical inputs (keys, buttons, stick axes) to Actions. Allows the same game logic to work with keyboard and gamepad.
_Avoid_: Key bindings, control scheme

**Lakitu Camera**:
The automatic camera system that follows the Player Character with context-sensitive behavior (pulls back in open areas, tightens in corridors). Named after the original SM64 camera operator. Can be freely overridden by the player via right stick or mouse.
_Avoid_: Auto-camera, follow camera

**LevelDescriptor**:
A code-defined configuration that describes everything needed to set up a Level: geometry source (procedural or .glb), player spawn position, death plane Y, water volumes, and enemy placements.
_Avoid_: Level config, level data, map data

**TestLevel**:
A procedurally-defined Level with simple geometry (flat plane, platforms, ramps, gaps) used for engine development and debugging. Always available without external assets.
_Avoid_: Debug level, sandbox

**GameState**:
The complete authoritative state of the game at any point in time: all Entity positions, Component data, and global variables. Designed to be serializable so it can be shared across a network for multiplayer.
_Avoid_: World state, snapshot

**Command**:
A discrete, serializable intent to mutate GameState (e.g., `{ type: 'MOVE', entityId, delta }`). All state changes go through Commands. In single-player, Commands are applied immediately. In multiplayer, Commands become SpacetimeDB reducer calls.
_Avoid_: Event, message, action (which means input intent)

**Scene**:
A self-contained game mode with its own setup, teardown, input handling, and update logic (e.g., TitleScene, FileSelectScene, GameplayScene, PauseScene, StarCollectScene). Only the top Scene on the stack receives input.
_Avoid_: Screen, state, mode

**SceneStack**:
An ordered stack of Scenes managed by the Engine. The topmost Scene is active. Scenes can be pushed (overlays like pause) or popped (returning to previous Scene). Enables the hub level to stay loaded while a course level is pushed on top.
_Avoid_: Scene manager, screen manager

**ActionGroup**:
A superstate in the Player Character's hierarchical state machine, grouping related movement states that share physics behavior. Groups: Grounded, Airborne, Submerged, Climbing.
_Avoid_: Category, mode, movement type

**ActionState**:
A specific movement state within an ActionGroup (e.g., "TripleJumping" within Airborne, "Crouching" within Grounded). Defines allowed transitions, animations, and physics overrides.
_Avoid_: Move, animation state, behavior

## Relationships

- The **Engine** drives the **Renderer** — it updates game state each frame and tells the **Renderer** what to draw
- A **World** contains one or more **Levels**
- The **Player Character** exists within a **Level**
- An **Entity** is composed of one or more **Components**
- A **System** operates on **Entities** that have specific **Components**
- The **Player Character** is always in exactly one **ActionGroup**, which contains the current **ActionState**
- An **ActionGroup** defines shared physics (e.g., gravity, air control); **ActionStates** within it override specifics
- A **Level** is configured by a **LevelDescriptor** (geometry source + metadata)
- All **GameState** mutations flow through **Commands** — enabling future multiplayer via SpacetimeDB
- The **Engine** maintains a **SceneStack**; only the top **Scene** is active
- A **GameplayScene** contains a **Level** with **Entities**

## Example dialogue

> **Dev:** "When the **Player Character** enters a painting, do we unload the current **Level**?"
> **Domain expert:** "No — we push a new **GameplayScene** onto the **SceneStack**. The hub **Level** stays loaded underneath. When the player collects a star, we pop back to the hub **Scene**."

> **Dev:** "Does the **Renderer** know about **ActionStates**?"
> **Domain expert:** "Never. The **ActionState** calls `playAnimation('tripleJump')`. The animation system tells the **Renderer** what to draw. The **Renderer** only knows about meshes and transforms."

> **Dev:** "If I move the **Player Character**, do I just set `position.x` directly?"
> **Domain expert:** "No — you dispatch a **Command**. In single-player it's applied immediately, but the **Command** boundary is where SpacetimeDB hooks in for multiplayer."

## Flagged ambiguities

_(none yet)_
