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
 * Maps a motor power percentage to a status color:
 * >75% danger, >50% caution, >25% nominal, otherwise idle/low.
 *
 * @remarks
 * Thresholds are applied to the MAGNITUDE. Thruster power is signed (-100 full
 * astern, 0 stopped, +100 full ahead — see `Status.motors` and the basestation's
 * _on_motor_state), so comparing the raw value coloured the whole astern half of
 * the range as idle and made full reverse indistinguishable from stopped.
 *
 * Direction is deliberately not encoded in the colour: these thresholds mean "how
 * hard is this thruster working", which is the same question ahead or astern. The
 * panels show direction through the bar itself.
 */
export const getPowerColor = (theme: Theme, power: number): string => {
    const status = theme.palette.status.primary;
    const magnitude = Math.abs(power);
    if (magnitude > 75) return status['out of control'];
    if (magnitude > 50) return status.standby;
    if (magnitude > 25) return status.autonomous;
    return status.remote;
};
