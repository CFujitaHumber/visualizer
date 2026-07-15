# @humber-asv/visualizer

Telemetry visualizer for the Humber ASV (Autonomous Surface Vehicle) — React
components, Redux slices, MUI themes, factory programs, and basestation
connection utilities. Built on **@react-spring/web**, **@use-gesture/react**,
**MUI**, and **Redux Toolkit**.

Data flow: `visualizer ← Redux ← WebSocket ← basestation ← ROS 2 (DDS) ← ASV`.
The basestation bridges ROS message shapes to the library's `Status` wire
format; image streams bypass Redux (only the stream URL is stored).

## Install

```sh
npm install @humber-asv/visualizer
```

Peer dependencies: `react@^19`, `react-dom@^19`, `@mui/material` (v7–v9),
`@mui/icons-material`, `@emotion/react`, `@emotion/styled`,
`@reduxjs/toolkit@^2`, `react-redux@^9`, `react-isometric-engine`,
`isometric-physics`.

## Usage

```tsx
import {
  TelemetryProvider,
  TelemetryThemeProvider,
  TelemetryDashboard,
  configureTelemetryConnection,
} from "@humber-asv/visualizer";
import { initConnection } from "@humber-asv/visualizer/store";

configureTelemetryConnection({
  httpBase: "http://localhost:8080",
  wsUrl: "ws://localhost:8080/telemetry",
});

export function App() {
  return (
    <TelemetryProvider>
      <TelemetryThemeProvider>
        <TelemetryDashboard />
      </TelemetryThemeProvider>
    </TelemetryProvider>
  );
}
```

### Entry points

| Import | Contents |
| --- | --- |
| `@humber-asv/visualizer` | Components (dashboard, HUD panels, scenes, compasses, `RadiusVisualizer`, `ShipRudderVisualizer`, joystick, controls), providers, hooks, factory programs, connection config, types |
| `@humber-asv/visualizer/store` | Redux store, typed hooks, all slice actions/selectors, connection thunks |
| `@humber-asv/visualizer/theme` | `lightTheme`, `telemetryTheme`, `statusColors`, `setColors` (+ MUI palette augmentations) |

## Development

This repo uses **Bun** for development and publishes to npm.

```sh
bun install         # install (engine packages resolve via link: to sibling repos)
bun run dev         # demo harness at http://localhost:3000
bun run typecheck   # tsc --noEmit
bun run lint        # eslint
bun run test        # jest unit tests (runs jest under Node — do not use `bun test`)
bun run test:e2e    # selenium-webdriver smoke tests against the demo server
bun run build       # emit ESM + d.ts to dist/
bun run docs        # typedoc → docs/
```

The unpublished `react-isometric-engine` / `isometric-physics` packages are
resolved from sibling checkouts (`../Github/…`) via `link:` devDependencies.
They must be published to npm before this package can be published.

### Branches / CI

- `dev` — active development; push/PR runs lint + typecheck + jest (+ selenium job).
- `master` — stable integration.
- `public` — release branch; pushing a version bump publishes to npm and deploys
  typedoc to GitHub Pages.

### Consuming from the HumberASV website before publish

The website links this package locally via `pnpm-workspace.yaml`:

```yaml
overrides:
  "@humber-asv/visualizer": "link:../../visualizer-components"
```

Run `bun run build:watch` here while developing against the site — the site
resolves the package through `dist/`.

## Notes

- The published `dist/` is ESM-only and extensionless — intended for bundler
  consumers (Vite, Bun, webpack). Node-native ESM/SSR without a bundler is not
  supported.
- The Redux store and the WebSocket handle are module-level singletons; avoid
  loading two copies of the package in one app.
