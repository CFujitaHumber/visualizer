
/**
 * @file telemetrySlice.ts
 * @description Redux slice for all ASV telemetry data received from the basestation.
 * Renamed from statusSlice.ts; slice name kept as 'status' to preserve DevTools history.
 *
 * @author Carson Fujita
 * @license MIT
 */
import { createSlice } from '@reduxjs/toolkit';
import { InitialStatus } from '../../types';
import type { Status, Path, Grid, TaskLocation, TaskData, CourseTrailPoint, ZedPosition, ZedOrientation } from '../../types';
import type { PayloadAction } from '@reduxjs/toolkit';
import { FETCH_TELEMETRY_SUCCESS } from '../../types/telemetryInterfaces';
import type { DetectedObject } from '../../types';

/** Structural equality. Used to decide whether a value is worth writing at all. */
const deepEqual = (a: unknown, b: unknown): boolean => {
    if (a === b) return true;
    if (typeof a !== 'object' || typeof b !== 'object' || a === null || b === null) return false;
    if (Array.isArray(a) !== Array.isArray(b)) return false;
    const aKeys = Object.keys(a as object);
    const bKeys = Object.keys(b as object);
    if (aKeys.length !== bKeys.length) return false;
    for (const key of aKeys) {
        if (!deepEqual((a as Record<string, unknown>)[key], (b as Record<string, unknown>)[key])) return false;
    }
    return true;
};

/**
 * Writes `incoming` into `target` leaf by leaf, touching only what actually differs.
 *
 * @remarks
 * This replaced a plain `Object.assign(state, payload)`. The basestation
 * re-broadcasts the *entire* telemetry payload ~7x/second — grids, task data,
 * ZED block and all — even though most of it changes rarely or never. Every
 * message is a fresh `JSON.parse`, so a wholesale assign handed Redux brand new
 * object identities for `asv`, `zed`, `task`, `planning` and `map` seven times a
 * second. Anything selecting a *group* rather than a primitive (MappingScene
 * does `useAppSelector(s => s.telemetry.asv)`) therefore re-rendered on every
 * frame off the wire, rebuilding roughly half the isometric scene's DOM —
 * measured at 638 mutation records/second on a ~190-element scene, with p95
 * frame time of 101 ms against a 14.8 ms median.
 *
 * Because Immer only marks a draft dirty when a write actually occurs, skipping
 * equal leaves preserves the previous identity for every untouched subtree, and
 * those selectors stop firing.
 *
 * Cost is one structural comparison of a payload that was just JSON-parsed —
 * far cheaper than the render work it avoids.
 */
const mergeChangedLeaves = (target: Record<string, unknown>, incoming: Record<string, unknown>): void => {
    for (const key of Object.keys(incoming)) {
        const next = incoming[key];
        const current = target[key];

        if (Array.isArray(next) || next === null || typeof next !== 'object') {
            // Arrays are replaced wholesale (never merged index-wise) but only when
            // their contents actually changed — that is what keeps grid identity stable.
            if (!deepEqual(current, next)) target[key] = next;
            continue;
        }

        if (current && typeof current === 'object' && !Array.isArray(current)) {
            mergeChangedLeaves(current as Record<string, unknown>, next as Record<string, unknown>);
        } else {
            target[key] = next;
        }
    }
};

/**
 * Latches the local-meters frame origin onto the first usable GPS fix.
 *
 * @remarks
 * (0, 0) is rejected deliberately: it is both `InitialStatus`'s placeholder and
 * what the bridge reports before the `phone` topic produces a fix, so accepting
 * it would anchor the whole map frame in the Gulf of Guinea and put the vessel
 * ~5000 km away the moment a real fix arrived.
 */
/**
 * Applies a (possibly partial) incoming Status onto the draft.
 *
 * @remarks
 * Two fields are deliberately never taken from the wire:
 *
 * - `frame` is client-only (see {@link Frame}); a stray one must not clobber a
 *   latched origin mid-session.
 * - `map.courseTrail` is built client-side by TacticalMapPanel, in METRES. The
 *   basestation sends `courseTrail: []` in every payload because its default state
 *   declares the key, so honouring it wiped the accumulated trail ~7x/second and the
 *   course line could never survive longer than one socket frame. The isometric
 *   scene keeps its own trail in grid cells — see `sceneTrailSlice` for why the two
 *   cannot share this array.
 */
const applyIncomingStatus = (state: Status, payload: Partial<Status>): void => {
    const { frame: _frame, map: incomingMap, ...rest } = payload;

    mergeChangedLeaves(state as unknown as Record<string, unknown>, rest as Record<string, unknown>);

    if (incomingMap) {
        const { courseTrail: _courseTrail, ...mapRest } = incomingMap;
        mergeChangedLeaves(state.map as unknown as Record<string, unknown>, mapRest as Record<string, unknown>);
    }

    if (!state.map.courseTrail) state.map.courseTrail = [];
    captureFrameOrigin(state);
};

const captureFrameOrigin = (state: Status): void => {
    if (state.frame.hasOrigin) return;
    const { latitude, longitude } = state.asv;
    if (latitude === 0 && longitude === 0) return;
    if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return;
    state.frame.originLatitude = latitude;
    state.frame.originLongitude = longitude;
    state.frame.hasOrigin = true;
};

/**
 * @constant telemetrySlice
 * @description Redux slice for managing ASV telemetry data.
 * @see {@link Status} for the structure of the state.
 * @remarks
 * This slice provides actions and reducers to manage various telemetry data points, including map grids, planning status, task information, rudder angle, power levels, ASV speed and heading, signal strength, and ZED camera data. 
 * It includes actions to update individual telemetry fields and an extra reducer to handle telemetry data fetched from the basestation. 
 * The slice also includes selectors to access the current telemetry state from the Redux store.
 */
const telemetrySlice = createSlice({
    name: 'status',
    initialState: InitialStatus as Status,
    reducers: {
        SET_STATUS: (state, action: PayloadAction<Partial<Status>>) => {
            applyIncomingStatus(state, action.payload);
        },
        setMapOccupancyGrid: (state, action: PayloadAction<Grid>) => { state.map.occupancyGrid = action.payload; },
        setMapNavigationGrid: (state, action: PayloadAction<Grid>) => { state.map.navigationGrid = action.payload; },
        setPlanningStatus: (state, action: PayloadAction<string>) => { state.planning.status = action.payload; },
        setPlanningCourse: (state, action: PayloadAction<Path>) => { state.planning.course = action.payload; },
        setPlanningPlan: (state, action: PayloadAction<Path>) => { state.planning.plan = action.payload; },
        setTaskLog: (state, action: PayloadAction<string[]>) => { state.task.log = action.payload; },
        setTaskLocation: (state, action: PayloadAction<TaskLocation>) => { state.task.location = action.payload; },
        setTaskData: (state, action: PayloadAction<TaskData>) => { state.task.data = action.payload; },
        setRudderAngle: (state, action: PayloadAction<number>) => { state.rudder.angle = action.payload; },
        setPowerMotors: (state, action: PayloadAction<number>) => { state.battery.motors = action.payload; },
        setPowerPrimary: (state, action: PayloadAction<number>) => { state.battery.primary = action.payload; },
        setASVSpeed: (state, action: PayloadAction<number>) => { state.asv.speed = action.payload; },
        setLeftPower: (state, action: PayloadAction<number>) => { state.motors.left = action.payload; },
        setRightPower: (state, action: PayloadAction<number>) => { state.motors.right = action.payload; },
        setASVHeading: (state, action: PayloadAction<number>) => { state.asv.heading = action.payload; },
        setASVLongitude: (state, action: PayloadAction<number>) => { state.asv.longitude = action.payload; },
        setASVLatitude: (state, action: PayloadAction<number>) => { state.asv.latitude = action.payload; },
        // Mast light channels, 0..1 (NOT 0..255) — see Status.led. Each setter also
        // raises `alpha`, because alpha is the has-a-reading flag the consumers test
        // against; writing a channel without it would leave the light classified as
        // "never reported" and the indicators stuck on the planning-status fallback.
        setGreen: (state, action: PayloadAction<number>) => { state.led.green = action.payload; state.led.alpha = 1; },
        setRed: (state, action: PayloadAction<number>) => { state.led.red = action.payload; state.led.alpha = 1; },
        setBlue: (state, action: PayloadAction<number>) => { state.led.blue = action.payload; state.led.alpha = 1; },
        // The basestation computes this itself: 100 while its `phone` GPS/heading topic is
        // fresh, 0 once it's gone stale (>5s) — a connection-freshness proxy, not real RSSI.
        setSignalStrength: (state, action: PayloadAction<number>) => { state.signal.strength = action.payload; },
        setZedOdomPosition: (state, action: PayloadAction<ZedPosition>) => { state.zed.odom.position = action.payload; },
        setZedOdomOrientation: (state, action: PayloadAction<ZedOrientation>) => { state.zed.odom.orientation = action.payload; },
        // Stored exactly as received — boat-relative (x = right, y = forward). World-frame
        // consumers go through `selectZedObjectsWorld`; see the frame note in statusTypes.ts
        // for why projecting here was wrong.
        setZedObjects: (state, action: PayloadAction<DetectedObject[]>) => {
            state.zed.objects = action.payload;
        },
        setZedCameraActive: (state, action: PayloadAction<boolean>) => { state.zed.camera.active = action.payload; },
        setZedCameraInfo: (state, action: PayloadAction<{ width: number; height: number; encoding: string }>) => {
            state.zed.camera.width = action.payload.width;
            state.zed.camera.height = action.payload.height;
            state.zed.camera.encoding = action.payload.encoding;
        },
        appendCourseTrailPoint: (state, action: PayloadAction<CourseTrailPoint>) => {
            if (state.map.courseTrail.length >= 500) {
                state.map.courseTrail.shift();
            }
            state.map.courseTrail.push(action.payload);
        },
        clearCourseTrail: (state) => { state.map.courseTrail = []; },
        /**
         * Drops the latched local-meters origin so the next fix re-anchors it.
         * Only meaningful when the world itself changes (mock regeneration) — a
         * plain reconnect should KEEP the origin, otherwise previously-recorded
         * trail points silently shift into a different frame.
         */
        clearFrameOrigin: (state) => {
            state.frame.originLatitude = 0;
            state.frame.originLongitude = 0;
            state.frame.hasOrigin = false;
        },
        setSystemTopics: (state, action: PayloadAction<string[]>) => { state.system.topics = action.payload; },
    },
    extraReducers: (builder) => {
        builder.addCase(FETCH_TELEMETRY_SUCCESS, (state, action) => {
            // zed.objects stays boat-relative, exactly as received. No projection here.
            applyIncomingStatus(state, (action as PayloadAction<Status>).payload);
        });
    },
});

export const {
    SET_STATUS,
    setMapOccupancyGrid,
    setMapNavigationGrid,
    setPlanningStatus,
    setPlanningCourse,
    setPlanningPlan,
    setTaskLog,
    setTaskLocation,
    setTaskData,
    setLeftPower,
    setRightPower,
    setRudderAngle,
    setASVSpeed,
    setPowerMotors,
    setPowerPrimary,
    setASVHeading,
    setASVLongitude,
    setASVLatitude,
    setRed,
    setGreen,
    setBlue,
    setSignalStrength,
    appendCourseTrailPoint,
    clearCourseTrail,
    clearFrameOrigin,
    setZedOdomPosition,
    setZedOdomOrientation,
    setZedObjects,
    setZedCameraActive,
    setZedCameraInfo,
    setSystemTopics,
} = telemetrySlice.actions;

export default telemetrySlice.reducer;
