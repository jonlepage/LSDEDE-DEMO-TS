# LSDE Playground — Dialog Engine Demos

Interactive demos showcasing the **[LSDE Dialog Engine](https://lepasoft.com/fr/software/ls-dialog-editor)** (`@lsde/dialog-engine`) through PixiJS scenes with colored bunny sprites as characters.

Each demo loads an LSDE blueprint and renders it in real-time — walk your character, trigger dialogues, make choices, and watch the engine in action.

**[▶ Live Demo](https://jonlepage.github.io/LSDEDE-DEMO-TS/)**

## Demos

| Demo                   | What it teaches                                                         |
| ---------------------- | ----------------------------------------------------------------------- |
| **simple-dialog-flow** | Linear dialogue — walk to an NPC, press Enter, read speech bubbles      |
| **simple-choices**     | CHOICE blocks — pick a moral option, watch the flow branch and converge |
| **simple-condition**   | CONDITION blocks — inventory-based branching (pick up a carrot!)        |
| **simple-action**      | ACTION blocks — camera shake, camera pan, character movement            |
| **multi-tracks**       | Parallel dialogue tracks firing simultaneously                          |
| **condition-dispatch** | Dispatcher mode + party recruitment + follower AI                       |

## Stack

- **[LSDE Dialog Engine Runtime](https://lepasoft.com/fr/software/ls-dialog-editor)** — runtime engine to execute LSDE blueprints data.
- **[PixiJS](https://pixijs.com)** — 2D rendering (simulate custom game engine and rendering)

## demo code

Your can find all demo in [`src/demos/`](src/demos/) folder:

- [simple-dialog-flow](src/demos/simple-dialog-flow)
- [simple-choices](src/demos/simple-choices)
- [simple-condition](src/demos/simple-condition)
- [simple-action](src/demos/simple-action)
- [multi-tracks](src/demos/multi-tracks)
- [condition-dispatch](src/demos/condition-dispatch)

They are only for demonstration purposes and not meant to be production-quality code or best practices for your game engine.
All engine need specific optimizations and architecture decisions, so treat them as educational reference material to understand how to integrate LSDEDE with your custom rendering/game engine

## Getting Started

```bash
npm install
npm run dev       # Vite dev server on port 8080
```

## Commands

| Command         | Description                                      |
| --------------- | ------------------------------------------------ |
| `npm run dev`   | Start dev server (port 8080, auto-opens browser) |
| `npm run lint`  | ESLint (TypeScript + Prettier)                   |
| `npm run build` | Lint → type-check → Vite production build        |

## Architecture

```
src/
├── engine/      → LSDE logic & dispatch (knows nothing about PixiJS)
├── renderer/    → PixiJS rendering (knows nothing about LSDE)
├── game/        → Game state: characters, variables, inventory
├── demos/       → Composition layer — connects engine + game + renderer
├── analytics/   → PostHog telemetry
├── app/         → App shell (sidebar navigation + canvas layout)
├── debug/       → Tweakpane debug panel
└── shared/      → Cross-layer types and constants
```

Strict layer separation: `engine/`, `renderer/`, and `game/` never import from each other. Only `demos/` composes them together.

## Links

- **LSDE Editor** — [lsde.lepa-dialog.com](https://lsde.lepa-dialog.com)
- **LEPA Dialog** — [lepa-dialog.com](https://lepa-dialog.com)
- **npm package** — [@lsde/dialog-engine](https://www.npmjs.com/package/@lsde/dialog-engine)

## License

**Proprietary** — All rights reserved. This code is provided as educational reference material for LSDE Dialog Engine integration patterns. No permission is granted to use, copy, modify, or distribute this software without explicit written consent from the author.
