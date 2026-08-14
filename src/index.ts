/**
 * @file index.ts
 * @description Main entry point for @humber-asv/visualizer.
 *
 * Exposes the telemetry dashboard and HUD panels, scene components, compass
 * controls, providers, hooks, factory programs, connection configuration and
 * all telemetry data types. The Redux store surface lives under
 * `@humber-asv/visualizer/store`, the MUI themes under
 * `@humber-asv/visualizer/theme`.
 *
 * @author Carson Fujita
 * @license MIT
 */

// ─── Dashboard & HUD panels ──────────────────────────────────────────────────
export { default as TelemetryDashboard, type TelemetryDashboardProps } from './components/TelemetryDashboard';
export * from './components/hud/telemetry';
// The TaskData panel (value) and the TaskData record type (from ./types) share a
// name — the explicit re-export resolves the star-export ambiguity in favor of
// the component; the record type stays importable as part of Status.
export { TaskData } from './components/hud/telemetry';
export * as SceneHUD from './components/hud/SceneHUD';

// ─── Scenes ──────────────────────────────────────────────────────────────────
export { default as MappingScene } from './components/scenes/MappingScene';
export { default as TelemetryScene } from './components/scenes/TelemetryScene';
export { SceneCanvas } from './components/scenes/SceneCanvas';
export { SceneRenderer } from './components/scenes/SceneRenderer';

// ─── Compass & joystick controls ─────────────────────────────────────────────
export {
    CompassRose,
    DirectionalGrid,
    DirectionButtons,
    InteractiveCompass,
    type CompassRoseProps,
    type DirectionalGridProps,
    type InteractiveCompassProps,
} from './components/svg/CompassRose';
export { default as Joystick, type JoyState } from './components/Joystick';

// ─── Control panels ──────────────────────────────────────────────────────────
export { ControlOverlay } from './components/controls/ControlOverlay';
export { ControlsDrawer } from './components/controls/ControlsDrawer';
export { ForceVectorsPanel } from './components/controls/ForceVectorsPanel';
export { InfoPopover } from './components/controls/InfoPopover';
export { Legend } from './components/controls/Legend';
export { MobileBottomNav } from './components/controls/MobileBottomNav';

// ─── Providers & contexts ────────────────────────────────────────────────────
export { default as TelemetryProvider } from './providers/TelemetryProvider';
export { default as TelemetryThemeProvider } from './providers/TelemetryThemeProvider';
export { SceneProvider } from './contexts/SceneContext';

// ─── Hooks ───────────────────────────────────────────────────────────────────
export { useLayoutConfig } from './hooks/useLayoutConfig';
export { useAutoPathAnimation } from './hooks/useAutoPathAnimation';
export { SceneContext, useSceneContext, type SceneContextValue } from './hooks/useSceneContext';

// ─── Connection configuration ────────────────────────────────────────────────
export {
    configureTelemetryConnection,
    getTelemetryConnectionConfig,
    resetTelemetryConnectionConfig,
    type TelemetryConnectionConfig,
} from './connection/config';

// ─── Utilities & factory programs ────────────────────────────────────────────
export { isBasestationOnline } from './utils/basestation';
export { batteryIconFor } from './utils/batteryUtil';
// Mast-light helpers. Exported because the operating mode is derived from the lamp
// rather than reported directly, so an embedder building its own indicator needs the
// same classification the built-in StatusIndicator uses.
export {
    hasLedReading,
    ledCssColor,
    ledStatus,
    ledForStatus,
    LED_FOR_STATUS,
    type LedColor,
} from './utils/led';
export { telemetryFactory } from './utils/telemetry';
export {
    default as generateRandomState,
    generateMockStateUpdate,
    generateMockVideoUrl,
} from './utils/telemetry/telemetryFactory';

// ─── Assets ──────────────────────────────────────────────────────────────────
export { RudderIcon } from './assets/RudderIcon';
export { boatSvgUrl, warningSvgUrl, arrowSvgUrl, connectingSvgUrl } from './assets/svgSources';

// ─── Data types ──────────────────────────────────────────────────────────────
export * from './types';
