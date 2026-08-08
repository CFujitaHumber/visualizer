
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
import { projectBoatRelative } from '../../utils/geo';

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
            const { map: incomingMap, ...rest } = action.payload;
            Object.assign(state, rest);
            if (incomingMap) {
                if ('occupancyGrid'  in incomingMap) state.map.occupancyGrid  = incomingMap.occupancyGrid!;
                if ('navigationGrid' in incomingMap) state.map.navigationGrid = incomingMap.navigationGrid!;
                if ('courseTrail' in incomingMap) state.map.courseTrail = incomingMap.courseTrail!;
            }
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
        // The basestation computes this itself: 100 while its `phone` GPS/heading topic is
        // fresh, 0 once it's gone stale (>5s) — a connection-freshness proxy, not real RSSI.
        setSignalStrength: (state, action: PayloadAction<number>) => { state.signal.strength = action.payload; },
        setZedOdomPosition: (state, action: PayloadAction<ZedPosition>) => { state.zed.odom.position = action.payload; },
        setZedOdomOrientation: (state, action: PayloadAction<ZedOrientation>) => { state.zed.odom.orientation = action.payload; },
        // ZED object positions arrive boat-relative (x = right, y = forward). Project
        // them into the same world frame `zed.odom.position` is expressed in — using
        // the vessel's current heading/position as the anchor — so BigMap/TacticalMap
        // can draw obstacles directly alongside the boat icon and course trail without
        // each needing its own rotation math.
        setZedObjects: (state, action: PayloadAction<DetectedObject[]>) => {
            const heading = state.asv.heading;
            const anchor = state.zed.odom.position;
            state.zed.objects = action.payload.map((obj) => ({
                ...obj,
                position: projectBoatRelative(obj.position, heading, anchor),
            }));
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
        setSystemTopics: (state, action: PayloadAction<string[]>) => { state.system.topics = action.payload; },
    },
    extraReducers: (builder) => {
        builder.addCase(FETCH_TELEMETRY_SUCCESS, (state, action) => {
            const payload = (action as PayloadAction<Status>).payload;
            const { map: incomingMap, ...rest } = payload;
            Object.assign(state, rest);
            if (incomingMap) {
                if ('occupancyGrid'  in incomingMap) state.map.occupancyGrid  = incomingMap.occupancyGrid;
                if ('navigationGrid' in incomingMap) state.map.navigationGrid = incomingMap.navigationGrid;
                if ('courseTrail' in incomingMap) state.map.courseTrail = incomingMap.courseTrail;
            }
            if (!state.map.courseTrail) state.map.courseTrail = [];

            // `rest` includes the full incoming `zed`, so `state.zed.objects` was just
            // overwritten with boat-relative positions by the Object.assign above —
            // project them into world frame now that state.asv.heading/zed.odom.position
            // reflect this same telemetry frame. See setZedObjects for why.
            const heading = state.asv.heading;
            const anchor = state.zed.odom.position;
            state.zed.objects = state.zed.objects.map((obj) => ({
                ...obj,
                position: projectBoatRelative(obj.position, heading, anchor),
            }));
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
    setSignalStrength,
    appendCourseTrailPoint,
    clearCourseTrail,
    setZedOdomPosition,
    setZedOdomOrientation,
    setZedObjects,
    setZedCameraActive,
    setZedCameraInfo,
    setSystemTopics,
} = telemetrySlice.actions;

export default telemetrySlice.reducer;
