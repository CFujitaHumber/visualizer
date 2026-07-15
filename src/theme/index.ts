/**
 * @file theme/index.ts
 * @description Barrel for the visualizer's MUI themes. Importing this module
 * (or anything from `@humber-asv/visualizer/theme`) also activates the MUI
 * palette module augmentations (`accent`, `status`, `gui`, `sim`, `map`,
 * `compass`, `water`, `scene`, `telemetry`, `occupancyMap`) in the consumer's
 * TypeScript program.
 *
 * @author Carson Fujita
 * @license MIT
 */

export { lightTheme, theme, statusColors, setColors } from './lightTheme';
export { telemetryTheme } from './telemetryTheme';
