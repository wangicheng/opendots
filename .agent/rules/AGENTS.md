# Project Overview
Brain Dots is a web-based physics puzzle game where players draw lines to guide balls to a destination or make them meet. Built with **TypeScript**, **PixiJS** (rendering), and **Rapier2D** (physics), typically served via **Vite**.

## Repository Structure
- `src/` - Source code root.
  - `game/` - Core game logic.
    - `Game.ts` - Main game controller and loop.
    - `config.ts` - Game scaling and physics constants.
    - `objects/` - Game entities (Ball, Line, Obstacle, etc.).
    - `levels/` - Level definitions and loading logic.
    - `ui/` - User interface layers (menus, HUD).
    - `physics/` - Rapier2D integration and helpers.
    - `input/` - Input handling (mouse/touch drawing).
  - `main.ts` - Application entry point; bootstraps the Game.
  - `style.css` - Global CSS reset and canvas sizing.
- `public/` - Static assets (images, icons).
- `docs/` - Documentation files.

## Build & Development Commands
Use `npm` (or `pnpm`/`yarn`) to run these commands from the root:

```bash
# Install dependencies
npm install

# Start local development server (with --host)
npm run dev

# Build for production (type-check + vite build)
npm run build

# Preview production build locally
npm run preview
```

## Code Style & Conventions
- **TypeScript**: Strict mode enabled. Use explicit types.
- **Naming**: PascalCase for classes/files (`Game.ts`), camelCase for methods/variables.
- **Async/Await**: Preferred over raw promises for initialization strings.
- **Imports**: verification of types via `import type` is encouraged where applicable.
- **Formatting**: (Implicit) Follow existing brace styles and indentation (2 spaces).

## Architecture Notes
The application follows a standard game loop architecture:
1. **Entry**: `main.ts` dynamic-imports `Game.ts` and calls `init()`.
2. **Core**: `Game` class initializes:
   - **Pixi.Application**: For WebGL rendering.
   - **PhysicsWorld** (Rapier): For simulation steps.
3. **Loop**: A `ticker` updates the physics world, then synchronizes graphical objects (`Pixi.Container`) to their physical bodies.
4. **Drawing**: User input creates static or dynamic bodies in the physics world, visualized by Pixi Graphics.

## Testing Strategy
> TODO: Implement automated testing.
- **Current**: Manual verification via `npm run dev`.
- **Future**: Unit tests for physics logic (e.g., Vitest), E2E tests for game flow.

## Security & Compliance
- **Dependencies**: Regular `npm audit`.
- **Secrets**: No secrets should be committed. The app is client-side static.
- **Input Sanitization**: Minimal concern as it's a client-side game, but level data processing should be robust.

## Agent Guardrails
- **Performance**: Do not introduce heavy computations in the render loop (`ticker`).
- **Physics**: Ensure Rapier bodies are properly disposed of when levels reset to prevent memory leaks.
- **Files**:
  - Avoid modifying `package-lock.json` unless adding dependencies.
  - Keep `main.ts` minimal.

## Extensibility Hooks
- **New Levels**: Add new level configurations in `src/game/levels/` and register them in the level manager.
- **New Objects**: Create classes in `src/game/objects/` extending the base game object structure.

## Further Reading
- [PixiJS Documentation](https://pixijs.com/)
- [Rapier2D Documentation](https://rapier.rs/docs/user_guides/javascript/getting_started_js)
