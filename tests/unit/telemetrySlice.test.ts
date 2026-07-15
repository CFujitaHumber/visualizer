/**
 * Unit tests for the telemetry slice: direct reducers, SET_STATUS partial
 * merge, and the FETCH_TELEMETRY_SUCCESS extraReducer.
 */
import reducer, {
  SET_STATUS,
  setASVHeading,
  setLeftPower,
  setRudderAngle,
  appendCourseTrailPoint,
} from '@/store/slices/telemetrySlice';
import { InitialStatus } from '@/types/statusTypes';
import { FETCH_TELEMETRY_SUCCESS } from '@/types/telemetryInterfaces';
import type { Status } from '@/types';

describe('telemetrySlice', () => {
  it('returns the initial status by default', () => {
    const state = reducer(undefined, { type: '@@INIT' });
    expect(state).toEqual(InitialStatus);
  });

  it('updates heading, motor power and rudder angle via direct reducers', () => {
    let state = reducer(undefined, setASVHeading(123));
    state = reducer(state, setLeftPower(42));
    state = reducer(state, setRudderAngle(-12));

    expect(state.asv.heading).toBe(123);
    expect(state.motors.left).toBe(42);
    expect(state.rudder.angle).toBe(-12);
  });

  it('SET_STATUS merges partial updates without clobbering the map grids', () => {
    const before = reducer(undefined, { type: '@@INIT' });
    const state = reducer(before, SET_STATUS({ signal: { strength: 77 } }));

    expect(state.signal.strength).toBe(77);
    // untouched groups survive the merge
    expect(state.map.occupancyGrid).toEqual(before.map.occupancyGrid);
    expect(state.asv).toEqual(before.asv);
  });

  it('handles FETCH_TELEMETRY_SUCCESS as a full status merge', () => {
    const incoming: Status = {
      ...InitialStatus,
      asv: { ...InitialStatus.asv, heading: 270, speed: 3.2 },
      signal: { strength: 55 },
    };
    const state = reducer(undefined, { type: FETCH_TELEMETRY_SUCCESS, payload: incoming });

    expect(state.asv.heading).toBe(270);
    expect(state.asv.speed).toBe(3.2);
    expect(state.signal.strength).toBe(55);
    expect(Array.isArray(state.map.courseTrail)).toBe(true);
  });

  it('caps the course trail at 500 points', () => {
    let state = reducer(undefined, { type: '@@INIT' });
    for (let i = 0; i < 505; i++) {
      state = reducer(state, appendCourseTrailPoint({ x: i, y: i }));
    }
    expect(state.map.courseTrail).toHaveLength(500);
    // oldest points were shifted out
    expect(state.map.courseTrail[0]).toEqual({ x: 5, y: 5 });
  });
});
