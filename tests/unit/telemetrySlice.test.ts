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

  // The slice deliberately does NOT project any more — it stores exactly what the
  // basestation sent. World-frame projection lives in selectZedObjectsWorld, which is
  // covered in telemetrySelectors.test.ts. See the frame note in statusTypes.ts.
  it('setZedObjects stores boat-relative positions unchanged', () => {
    let state = reducer(undefined, { type: '@@INIT' });
    state = reducer(state, setASVHeading(90));
    state = reducer(state, SET_STATUS({ zed: { ...state.zed, odom: { ...state.zed.odom, position: { x: 10, y: 20, z: 0 } } } }));
    state = reducer(state, setZedObjects([boatRelativeObject]));

    expect(state.zed.objects[0]!.position).toEqual({ x: 5, y: 0, z: 0 });
    expect(state.zed.objects[0]!.label).toBe('Nav Green');
  });

  it('FETCH_TELEMETRY_SUCCESS stores incoming zed.objects unchanged', () => {
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

    expect(state.zed.objects[0]!.position).toEqual({ x: 5, y: 0, z: 0 });
  });

  it('latches the frame origin on the first non-zero fix and then holds it', () => {
    let state = reducer(undefined, { type: '@@INIT' });
    expect(state.frame.hasOrigin).toBe(false);

    // (0,0) is the pre-fix placeholder and must not anchor the frame.
    state = reducer(state, SET_STATUS({ asv: { ...state.asv, latitude: 0, longitude: 0 } }));
    expect(state.frame.hasOrigin).toBe(false);

    state = reducer(state, SET_STATUS({ asv: { ...state.asv, latitude: 43.66, longitude: -79.53 } }));
    expect(state.frame).toEqual({ originLatitude: 43.66, originLongitude: -79.53, hasOrigin: true });

    // Subsequent fixes move the vessel, not the origin.
    state = reducer(state, SET_STATUS({ asv: { ...state.asv, latitude: 43.67, longitude: -79.54 } }));
    expect(state.frame.originLatitude).toBe(43.66);
  });

  it('does not let the wire wipe the client-built course trail', () => {
    let state = reducer(undefined, { type: '@@INIT' });
    state = reducer(state, appendCourseTrailPoint({ x: 1, y: 2, heading: 30 }));
    state = reducer(state, appendCourseTrailPoint({ x: 3, y: 4, heading: 35 }));

    // Every basestation payload carries `courseTrail: []` because its default state
    // declares the key — honouring that used to clear the trail ~7x/second.
    state = reducer(state, { type: FETCH_TELEMETRY_SUCCESS, payload: InitialStatus });
    expect(state.map.courseTrail).toHaveLength(2);

    state = reducer(state, SET_STATUS({ map: { ...InitialStatus.map, courseTrail: [] } }));
    expect(state.map.courseTrail).toHaveLength(2);
  });

  it('preserves sub-object identity when a payload re-broadcasts unchanged values', () => {
    let state = reducer(undefined, { type: FETCH_TELEMETRY_SUCCESS, payload: InitialStatus });
    const asvBefore = state.asv;
    const zedBefore = state.zed;

    // Same content, fresh objects — what every re-parsed websocket frame looks like.
    const reparsed = JSON.parse(JSON.stringify(InitialStatus)) as Status;
    state = reducer(state, { type: FETCH_TELEMETRY_SUCCESS, payload: reparsed });

    expect(state.asv).toBe(asvBefore);
    expect(state.zed).toBe(zedBefore);

    // A real change still lands, and only on the group that changed.
    state = reducer(state, { type: FETCH_TELEMETRY_SUCCESS, payload: { ...reparsed, asv: { ...reparsed.asv, speed: 2.5 } } });
    expect(state.asv).not.toBe(asvBefore);
    expect(state.asv.speed).toBe(2.5);
    expect(state.zed).toBe(zedBefore);
  });

  it('keeps grid array identity when an unchanged grid is re-broadcast', () => {
    const grid = [[{ type: 1, x: 0, y: 0, z: 0 }], [{ type: 0, x: 0, y: 1, z: 0 }]] as Status['map']['occupancyGrid'];
    const payload: Status = { ...InitialStatus, map: { ...InitialStatus.map, occupancyGrid: grid } };

    let state = reducer(undefined, { type: FETCH_TELEMETRY_SUCCESS, payload });
    const first = state.map.occupancyGrid;

    // Same content, fresh objects — exactly what a re-parsed websocket frame looks like.
    const reparsed = JSON.parse(JSON.stringify(grid)) as Status['map']['occupancyGrid'];
    state = reducer(state, { type: FETCH_TELEMETRY_SUCCESS, payload: { ...payload, map: { ...payload.map, occupancyGrid: reparsed } } });
    expect(state.map.occupancyGrid).toBe(first);

    // A real change must still land.
    const changed = JSON.parse(JSON.stringify(grid)) as Status['map']['occupancyGrid'];
    changed[0]![0]!.type = 4;
    state = reducer(state, { type: FETCH_TELEMETRY_SUCCESS, payload: { ...payload, map: { ...payload.map, occupancyGrid: changed } } });
    expect(state.map.occupancyGrid).not.toBe(first);
    expect(state.map.occupancyGrid[0]![0]!.type).toBe(4);
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
