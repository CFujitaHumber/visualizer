/**
 * Unit tests for the telemetry factory programs (mock data generators).
 */
import generateRandomState, { generateMockStateUpdate, generateMockVideoUrl } from '@/utils/telemetry/telemetryFactory';

describe('telemetryFactory', () => {
  it('generateRandomState returns a full status and a fine grid', () => {
    const { status, fineGrid } = generateRandomState();

    expect(status.asv).toBeDefined();
    expect(typeof status.asv.heading).toBe('number');
    expect(typeof status.asv.latitude).toBe('number');
    expect(typeof status.asv.longitude).toBe('number');
    expect(status.map.occupancyGrid).toBeDefined();
    expect(status.map.navigationGrid).toBeDefined();
    expect(status.motors).toBeDefined();
    expect(status.rudder).toBeDefined();
    expect(status.battery).toBeDefined();
    expect(status.zed).toBeDefined();

    expect(Array.isArray(fineGrid)).toBe(true);
    expect(fineGrid.length).toBeGreaterThan(0);
  });

  it('generateMockStateUpdate evolves a status while preserving its shape', () => {
    const { status } = generateRandomState();
    const next = generateMockStateUpdate(status);

    expect(Object.keys(next).sort()).toEqual(Object.keys(status).sort());
    expect(typeof next.asv.heading).toBe('number');
    expect(next.asv.heading).toBeGreaterThanOrEqual(0);
    expect(next.asv.heading).toBeLessThan(360);
    // Thruster power is SIGNED — -100 full astern, 0 stopped, +100 full ahead (see
    // Status.motors). Asserting a 0 lower bound made this test fail roughly half the
    // time, since the factory's random walk is free to cross zero into reverse.
    expect(next.motors.left).toBeGreaterThanOrEqual(-100);
    expect(next.motors.left).toBeLessThanOrEqual(100);
    expect(next.motors.right).toBeGreaterThanOrEqual(-100);
    expect(next.motors.right).toBeLessThanOrEqual(100);
  });

  it('generateMockVideoUrl returns an http(s) URL', () => {
    expect(generateMockVideoUrl()).toMatch(/^https?:\/\//);
  });
});
