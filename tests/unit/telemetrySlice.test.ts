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
  setZedObjects,
  setSystemTopics,
} from '@/store/slices/telemetrySlice';
import { InitialStatus } from '@/types/statusTypes';
import { FETCH_TELEMETRY_SUCCESS } from '@/types/telemetryInterfaces';
import type { Status, DetectedObject } from '@/types';

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
      state = reducer(state, appendCourseTrailPoint({ x: i, y: i, heading: 0 }));
    }
    expect(state.map.courseTrail).toHaveLength(500);
    // oldest points were shifted out
    expect(state.map.courseTrail[0]).toEqual({ x: 5, y: 5, heading: 0 });
  });

  const boatRelativeObject: DetectedObject = {
    label: 'Nav Green',
    label_id: 1,
    confidence: 0.9,
    position: { x: 5, y: 0, z: 0 }, // 5m to the vessel's right
  };

  it('setZedObjects projects boat-relative positions into world frame (identity heading)', () => {
    let state = reducer(undefined, { type: '@@INIT' });
    state = reducer(state, SET_STATUS({ zed: { ...state.zed, odom: { ...state.zed.odom, position: { x: 10, y: 20, z: 0 } } } }));
    // heading 0 — rotation is identity, projection is a plain translate by the anchor
    state = reducer(state, setZedObjects([boatRelativeObject]));

    expect(state.zed.objects[0]!.position).toEqual({ x: 15, y: 20, z: 0 });
    expect(state.zed.objects[0]!.label).toBe('Nav Green');
  });

  it('setZedObjects rotates boat-relative positions by the current heading', () => {
    let state = reducer(undefined, { type: '@@INIT' });
    state = reducer(state, setASVHeading(90)); // facing east
    state = reducer(state, SET_STATUS({ zed: { ...state.zed, odom: { ...state.zed.odom, position: { x: 10, y: 20, z: 0 } } } }));
    state = reducer(state, setZedObjects([boatRelativeObject]));

    // 5m to the right of a boat facing east lands south of it: x unchanged, y - 5
    expect(state.zed.objects[0]!.position).toEqual({ x: 10, y: 15, z: 0 });
  });

  it('FETCH_TELEMETRY_SUCCESS projects incoming zed.objects using that same frame', () => {
    const incoming: Status = {
      ...InitialStatus,
      asv: { ...InitialStatus.asv, heading: 90 },
      zed: {
        ...InitialStatus.zed,
        odom: { ...InitialStatus.zed.odom, position: { x: 10, y: 20, z: 0 } },
        objects: [boatRelativeObject],
      },
    };
    const state = reducer(undefined, { type: FETCH_TELEMETRY_SUCCESS, payload: incoming });

    expect(state.zed.objects[0]!.position).toEqual({ x: 10, y: 15, z: 0 });
  });

  it('setSystemTopics replaces the topic list', () => {
    let state = reducer(undefined, { type: '@@INIT' });
    expect(state.system.topics).toEqual([]);

    state = reducer(state, setSystemTopics(['phone', 'task']));
    expect(state.system.topics).toEqual(['phone', 'task']);
  });

  it('FETCH_TELEMETRY_SUCCESS merges the incoming system.topics list', () => {
    const incoming: Status = {
      ...InitialStatus,
      system: { topics: ['phone', 'zed/zed_node/odom'] },
    };
    const state = reducer(undefined, { type: FETCH_TELEMETRY_SUCCESS, payload: incoming });

    expect(state.system.topics).toEqual(['phone', 'zed/zed_node/odom']);
  });
});
