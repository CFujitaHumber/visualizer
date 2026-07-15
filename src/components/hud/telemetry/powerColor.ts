/**
 * @file powerColor.ts
 * @description Shared motor-power → color threshold mapping for the propulsion
 * panels ({@link PowerRudderPanel}, {@link ShipRudderVisualizer}). Colors come
 * from the theme's status palette so the panels stay theme-consistent.
 *
 * @author Carson Fujita
 * @license MIT
 */
import type { Theme } from '@mui/material/styles';

/**
 * Maps a motor power percentage (0–100) to a status color:
 * >75% danger, >50% caution, >25% nominal, otherwise idle/low.
 */
export const getPowerColor = (theme: Theme, power: number): string => {
    const status = theme.palette.status.primary;
    if (power > 75) return status['out of control'];
    if (power > 50) return status.standby;
    if (power > 25) return status.autonomous;
    return status.remote;
};
