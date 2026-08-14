# visualizer-components

Telemetry visualizer for the Humber ASV (Autonomous Surface Vehicle) — React
components, Redux slices, MUI themes, factory programs, and basestation
connection utilities. Built on **@react-spring/web**, **@use-gesture/react**,
**MUI**, and **Redux Toolkit**.

Data flow: `visualizer ← Redux ← WebSocket ← basestation ← ROS 2 (DDS) ← ASV`.
The basestation bridges ROS message shapes to the library's `Status` wire
format; image streams bypass Redux (only the stream URL is stored).


## Status

review [statusTypes.ts](src/types/statusTypes.ts) for the current list of supported telemetry types. The library is under active development; breaking changes may occur in minor versions.

## Install

```sh
npm install @humber-asv/visualizer-components
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
} from "visualizer-components";
import { initConnection } from "visualizer-components/store";

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
| `visualizer-components` | Components (dashboard, HUD panels, scenes, compasses, `RadiusVisualizer`, `ShipRudderVisualizer`, joystick, controls), providers, hooks, factory programs, connection config, types |
| `visualizer-components/store` | Redux store, typed hooks, all slice actions/selectors, connection thunks |
| `visualizer-components/theme` | `lightTheme`, `telemetryTheme`, `statusColors`, `setColors` (+ MUI palette augmentations) |

## Notes

- The published `dist/` is ESM-only and extensionless — intended for bundler
  consumers (Vite, Bun, webpack). Node-native ESM/SSR without a bundler is not
  supported.
- The Redux store and the WebSocket handle are module-level singletons; avoid
  loading two copies of the package in one app.
