/**
 * @file led.ts
 * @description Reads the vessel's physical status light (`led`, std_msgs/ColorRGBA
 * on the wire) and turns it into something the dashboard can theme with.
 *
 * @remarks
 * The mast light is the signal the safety judges actually read, and the ASV
 * drives it straight off two GPIO lines rather than off the autonomy pipeline
 * (Loon-E's `motor.py` `set_led`: e-stop line low => red only, autonomy line
 * high => green only, otherwise both => amber). That makes it a more honest
 * report of what the boat is doing than `planning.status`, which is derived
 * from the `task` topic and can still say "autonomous" while the e-stop is
 * pulled.
 *
 * Everything here tolerates the light being absent — `led.alpha === 0` is the
 * "nothing reported yet" sentinel (see {@link Status.led}) — and returns null so
 * callers fall back to the status-string palette instead of rendering black.
 *
 * @author Carson Fujita
 * @license MIT
 */
import { TaskValues, type TaskStatus } from '../types/taskTypes';

/** The `led` block of {@link Status}. Channels are 0..1 floats, not 0..255. */
export type LedColor = {
    red: number;
    green: number;
    blue: number;
    alpha: number;
};

/**
 * A channel at or below this is treated as off.
 *
 * @remarks
 * The light is driven by a PWM duty cycle rather than a clean digital level, so
 * an "off" channel can arrive as a small non-zero float. Classifying strictly
 * against 0 would read every amber as some third colour.
 */
const CHANNEL_ON_THRESHOLD = 0.25;

/** True when a real ColorRGBA has been received. See {@link Status.led}. */
export const hasLedReading = (led: LedColor | undefined): led is LedColor =>
    !!led && led.alpha > 0;

/**
 * The light's colour as a CSS string, or null when nothing has been reported.
 *
 * @remarks
 * Returns the measured colour rather than a palette entry on purpose: the point
 * of theming off the light is that the dot on the dashboard and the lamp on the
 * mast are the same colour, including the blink — a palette lookup would
 * quantise that away.
 *
 * `alpha` is deliberately not applied to the output. It is a has-data flag here,
 * not an opacity, and honouring it would fade the indicator out.
 */
export const ledCssColor = (led: LedColor | undefined): string | null => {
    if (!hasLedReading(led)) return null;
    const channel = (value: number) => Math.round(Math.min(Math.max(value, 0), 1) * 255);
    return `rgb(${channel(led.red)}, ${channel(led.green)}, ${channel(led.blue)})`;
};

/**
 * Thruster power (percent) at or below which a propeller counts as at rest.
 *
 * @remarks
 * Wide enough to absorb ESC jitter around neutral: the bridge derives the signed
 * percentage from a servo fraction recentred on 0.5 (`_on_motor_state`), so a
 * stopped propeller lands near zero rather than exactly on it.
 */
const THRUSTER_REST_DEADBAND = 2;

/**
 * Classifies the mast light into the mode it is signalling, or null when nothing
 * has been reported.
 *
 * @remarks
 * The lamp has two channels and the e-stop line dominates, so its four possible
 * inputs collapse to three colours:
 *
 * - green alone -> autonomous
 * - red alone   -> out of control (the e-stop is pulled)
 * - red + green -> amber: e-stop clear, autonomy disengaged
 * - red + green + blue -> simulator
 *
 * Amber covers BOTH "remote control" and "standby" and the boat cannot separate
 * them — there is no third channel and no third switch. `thrusters` breaks the tie:
 * a boat under RC is being driven, an idle one is not. Callers that would rather
 * not infer can omit it, which reports amber as `remote` — the safer default, since
 * it says a human is in the loop.
 *
 * A dark lamp maps to `standby`, not to an error. The light BLINKS, so dark frames
 * are ordinary; the basestation drops them before they reach the client (`_on_led`)
 * and clears `alpha` only once the topic itself goes stale. Reaching this branch
 * therefore means a lamp reporting a colour with neither mast channel lit.
 *
 * Blue has no wiring on the mast (`motor.py` only owns PCA9685 channels 4 and 5)
 * so it is ignored — a blue-carrying frame would be a bench rig, not the boat.
 *
 * @param led - The `led` block of {@link Status}.
 * @param thrusters - Signed motor power percentages, used only to split amber.
 */
export const ledStatus = (
    led: LedColor | undefined,
    thrusters?: { left: number; right: number },
): TaskStatus | null => {
    if (!hasLedReading(led)) return null;
    const red = led.red > CHANNEL_ON_THRESHOLD;
    const green = led.green > CHANNEL_ON_THRESHOLD;
    const blue = led.blue > CHANNEL_ON_THRESHOLD;
    if (red && green && blue) return TaskValues.simulator;
    if (red && green) {
        if (!thrusters) return TaskValues.remote;
        const driving = Math.abs(thrusters.left) > THRUSTER_REST_DEADBAND
            || Math.abs(thrusters.right) > THRUSTER_REST_DEADBAND;
        return driving ? TaskValues.remote : TaskValues.standby;
    }
    if (green) return TaskValues.autonomous;
    if (red) return TaskValues.outOfControl;
    return TaskValues.standby;
};

/**
 * The LED colours the ASV can emit, keyed by the mode each one signals. Lets the
 * simulators drive a plausible light off the status they already compute, so the
 * LED-themed indicators are exercised without a basestation.
 * 
 * @remarks
 * unless we lost connection in which case we choose dark.
 * and simulator is white because there is no boat but we are pretending there is
 */
export const LED_FOR_STATUS: Record<TaskStatus, LedColor> = {
    [TaskValues.autonomous]: { red: 0, green: 1, blue: 0, alpha: 1 },
    [TaskValues.remote]: { red: 1, green: 1, blue: 0, alpha: 1 },
    [TaskValues.standby]: { red: 1, green: 1, blue: 0, alpha: 1 },
    [TaskValues.outOfControl]: { red: 1, green: 0, blue: 0, alpha: 1 },
    [TaskValues.lostConnection]: { red: 0, green: 0, blue: 0, alpha: 1 },
    [TaskValues.simulator]: { red: 1, green: 1, blue: 1, alpha: 1 },
};

/**
 * The light a vessel in `status` would be showing. Simulator-facing.
 *
 * @remarks
 * Returns a fresh object each call: the simulators drop this straight into a
 * `Status` that Redux then owns, and handing out the shared table entry would let
 * a reducer mutate the table.
 *
 * @see {@link ledStatus} for the live-facing inverse — classifying a real lamp
 * back into a mode. That direction is lossy (standby and remote both show amber,
 * because the mast has no third colour to tell them apart) which is why it is not
 * a table lookup.
 */
export const ledForStatus = (status: TaskStatus): LedColor =>
    ({ ...(LED_FOR_STATUS[status] ?? LED_FOR_STATUS[TaskValues.lostConnection]) });