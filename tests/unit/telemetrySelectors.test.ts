/**
 * Covers the derived local-meters frame. These replaced the projection that used
 * to happen inside telemetrySlice's reducers — see the frame note in statusTypes.ts.
 */
import { InitialStatus } from '../../src/types';
import type { Status, DetectedObject } from '../../src/types';
import { selectVesselLocalMeters, selectZedObjectsWorld } from '../../src/store/selectors/telemetrySelectors';
import type { RootState } from '../../src/store/store';

const ORIGIN_LAT = 43.66;
const ORIGIN_LON = -79.53;

/** Minimal RootState stub — these selectors only ever read `telemetry`. */
const makeState = (telemetry: Status): RootState => ({ telemetry } as unknown as RootState);

const withFrame = (overrides: Partial<Status> = {}): Status => ({
    ...InitialStatus,
    ...overrides,
    frame: { originLatitude: ORIGIN_LAT, originLongitude: ORIGIN_LON, hasOrigin: true },
});

describe('selectVesselLocalMeters', () => {
    it('returns the origin before a fix is latched', () => {
        const state = makeState({ ...InitialStatus, asv: { ...InitialStatus.asv, latitude: 43.7, longitude: -79.5 } });
        expect(selectVesselLocalMeters(state)).toEqual({ x: 0, y: 0 });
    });

    it('reports zero displacement when sitting on the origin', () => {
        const state = makeState(withFrame({ asv: { ...InitialStatus.asv, latitude: ORIGIN_LAT, longitude: ORIGIN_LON } }));
        const { x, y } = selectVesselLocalMeters(state);
        expect(x).toBeCloseTo(0, 6);
        expect(y).toBeCloseTo(0, 6);
    });

    it('converts a northward offset into positive metres of the right magnitude', () => {
        // 0.001 deg latitude ~= 111.3 m north, and no easting.
        const state = makeState(withFrame({ asv: { ...InitialStatus.asv, latitude: ORIGIN_LAT + 0.001, longitude: ORIGIN_LON } }));
        const { x, y } = selectVesselLocalMeters(state);
        expect(y).toBeGreaterThan(100);
        expect(y).toBeLessThan(120);
        expect(x).toBeCloseTo(0, 6);
    });

    it('produces metre-scale movement for a degree-scale fix change', () => {
        // The regression that motivated all of this: a tick of factory movement
        // (~1e-5 deg) has to clear the course trail's 1 m sampling threshold.
        const before = selectVesselLocalMeters(makeState(withFrame({ asv: { ...InitialStatus.asv, latitude: ORIGIN_LAT, longitude: ORIGIN_LON } })));
        const after = selectVesselLocalMeters(makeState(withFrame({ asv: { ...InitialStatus.asv, latitude: ORIGIN_LAT + 0.00005, longitude: ORIGIN_LON } })));
        expect(Math.hypot(after.x - before.x, after.y - before.y)).toBeGreaterThan(1);
    });
});

describe('selectZedObjectsWorld', () => {
    const object: DetectedObject = {
        label: 'Nav Green',
        label_id: 1,
        confidence: 0.9,
        position: { x: 5, y: 0, z: 0 }, // 5 m off the vessel's starboard beam
    };

    const withObject = (heading: number, latitude = ORIGIN_LAT, longitude = ORIGIN_LON) =>
        makeState(withFrame({
            asv: { ...InitialStatus.asv, heading, latitude, longitude },
            zed: { ...InitialStatus.zed, objects: [object] },
        }));

    it('translates by the vessel position with an identity heading', () => {
        const [projected] = selectZedObjectsWorld(withObject(0));
        expect(projected!.position.x).toBeCloseTo(5, 6);
        expect(projected!.position.y).toBeCloseTo(0, 6);
        expect(projected!.label).toBe('Nav Green');
    });

    it('rotates by heading — starboard of an east-facing vessel lies south', () => {
        const [projected] = selectZedObjectsWorld(withObject(90));
        expect(projected!.position.x).toBeCloseTo(0, 6);
        expect(projected!.position.y).toBeCloseTo(-5, 6);
    });

    it('leaves the stored detection boat-relative', () => {
        const state = withObject(90);
        selectZedObjectsWorld(state);
        expect(state.telemetry.zed.objects[0]!.position).toEqual({ x: 5, y: 0, z: 0 });
    });
});
