/**
 * Unit tests for the mast-light helpers.
 *
 * These cover the classification the Status Indicator is built on: the lamp has
 * only two channels, so several of these cases exist specifically to pin down what
 * happens where the hardware cannot express a distinction.
 */
import {
  hasLedReading,
  ledCssColor,
  ledStatus,
  ledForStatus,
  LED_FOR_STATUS,
  type LedColor,
} from '@/utils/led';
import { TaskValues } from '@/types/taskTypes';

/** Convenience builder — alpha defaults to 1 (a real reading). */
const lamp = (red: number, green: number, alpha = 1): LedColor =>
  ({ red, green, blue: 0, alpha });

const AT_REST = { left: 0, right: 0 };
const DRIVING = { left: 60, right: 58 };

describe('hasLedReading', () => {
  it('treats alpha 0 as "never reported" rather than a transparent lamp', () => {
    expect(hasLedReading(lamp(1, 1, 0))).toBe(false);
  });

  it('accepts any positive alpha', () => {
    expect(hasLedReading(lamp(0, 0, 1))).toBe(true);
  });

  it('tolerates an absent led block', () => {
    expect(hasLedReading(undefined)).toBe(false);
  });
});

describe('ledStatus', () => {
  it('returns null when nothing has been reported, so callers can fall back', () => {
    expect(ledStatus(lamp(0, 1, 0), AT_REST)).toBeNull();
    expect(ledStatus(undefined, AT_REST)).toBeNull();
  });

  it('reads green alone as autonomous', () => {
    expect(ledStatus(lamp(0, 1), AT_REST)).toBe(TaskValues.autonomous);
  });

  it('reads red alone as out of control — the e-stop is pulled', () => {
    expect(ledStatus(lamp(1, 0), DRIVING)).toBe(TaskValues.outOfControl);
  });

  it('lets the e-stop win over a driving boat', () => {
    // Red alone must not be softened by thruster activity: a boat still coasting
    // under a pulled e-stop is exactly when this reading matters most.
    expect(ledStatus(lamp(1, 0), DRIVING)).toBe(TaskValues.outOfControl);
  });

  describe('amber, which the lamp cannot disambiguate on its own', () => {
    it('is remote control when a thruster is driving', () => {
      expect(ledStatus(lamp(1, 1), DRIVING)).toBe(TaskValues.remote);
    });

    it('is standby when both thrusters are at rest', () => {
      expect(ledStatus(lamp(1, 1), AT_REST)).toBe(TaskValues.standby);
    });

    it('counts astern thrust as driving, not as rest', () => {
      expect(ledStatus(lamp(1, 1), { left: -75, right: -75 })).toBe(TaskValues.remote);
    });

    it('treats jitter inside the deadband as rest', () => {
      expect(ledStatus(lamp(1, 1), { left: 1.5, right: -1.2 })).toBe(TaskValues.standby);
    });

    it('counts a single driving thruster — the boat is turning on the spot', () => {
      expect(ledStatus(lamp(1, 1), { left: 40, right: 0 })).toBe(TaskValues.remote);
    });

    it('reports remote when no thruster data is supplied, the safer default', () => {
      expect(ledStatus(lamp(1, 1))).toBe(TaskValues.remote);
    });
  });

  it('treats a dark-but-reporting lamp as standby, not as an error', () => {
    expect(ledStatus(lamp(0, 0), AT_REST)).toBe(TaskValues.standby);
  });

  it('ignores a small non-zero channel, which is PWM jitter rather than a colour', () => {
    // A duty-cycle-driven "off" channel does not arrive as exactly 0.0; without the
    // threshold this would read as amber instead of green.
    expect(ledStatus(lamp(0.1, 1), AT_REST)).toBe(TaskValues.autonomous);
  });

  it('ignores blue, which has no channel on the mast', () => {
    expect(ledStatus({ red: 0, green: 1, blue: 1, alpha: 1 }, AT_REST))
      .toBe(TaskValues.autonomous);
  });
});

describe('ledCssColor', () => {
  it('returns null when nothing has been reported', () => {
    expect(ledCssColor(lamp(1, 1, 0))).toBeNull();
  });

  it('scales 0..1 channels to 0..255', () => {
    expect(ledCssColor(lamp(1, 1))).toBe('rgb(255, 255, 0)');
    expect(ledCssColor(lamp(0, 1))).toBe('rgb(0, 255, 0)');
  });

  it('does not apply alpha, which is a has-data flag rather than an opacity', () => {
    expect(ledCssColor({ red: 1, green: 0, blue: 0, alpha: 0.25 })).toBe('rgb(255, 0, 0)');
  });

  it('clamps out-of-range channels rather than emitting invalid CSS', () => {
    expect(ledCssColor({ red: 1.5, green: -0.2, blue: 0, alpha: 1 })).toBe('rgb(255, 0, 0)');
  });
});

describe('ledForStatus', () => {
  it('returns a fresh object so a reducer cannot mutate the shared table', () => {
    const first = ledForStatus(TaskValues.autonomous);
    first.red = 0.9;
    expect(ledForStatus(TaskValues.autonomous).red).toBe(0);
    expect(LED_FOR_STATUS[TaskValues.autonomous].red).toBe(0);
  });

  it('round-trips the states the lamp can express', () => {
    expect(ledStatus(ledForStatus(TaskValues.autonomous), AT_REST))
      .toBe(TaskValues.autonomous);
    expect(ledStatus(ledForStatus(TaskValues.outOfControl), AT_REST))
      .toBe(TaskValues.outOfControl);
    expect(ledStatus(ledForStatus(TaskValues.remote), DRIVING))
      .toBe(TaskValues.remote);
    expect(ledStatus(ledForStatus(TaskValues.standby), AT_REST))
      .toBe(TaskValues.standby);
  });

  it('emits the same amber for standby and remote, because the mast does', () => {
    // Not a defect to fix — it is the hardware limitation the thruster split exists
    // to work around. Pinned so a future edit does not silently invent a colour.
    expect(ledForStatus(TaskValues.standby)).toEqual(ledForStatus(TaskValues.remote));
  });

  it('leaves lost connection at the no-reading sentinel', () => {
    // A boat that has lost the link is not driving its lamp at all, so this must
    // classify as "no reading" rather than as a dark lamp.
    expect(ledStatus(ledForStatus(TaskValues.lostConnection), AT_REST)).toBeNull();
  });

  it('covers every TaskValues entry, so a new mode cannot slip through untyped', () => {
    for (const status of Object.values(TaskValues)) {
      expect(LED_FOR_STATUS[status]).toBeDefined();
    }
  });
});
