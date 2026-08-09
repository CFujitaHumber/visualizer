/**
 * @file sceneTrailSlice.ts
 * @description The isometric scene's course trail, in GRID CELLS.
 *
 * @remarks
 * This exists to end a unit collision. `telemetry.map.courseTrail` had two writers in two
 * different units — `TacticalMapPanel` appending metres in the GPS-derived local frame,
 * `MappingScene` appending engine grid cells — and three readers that each assumed one or
 * the other. `TacticalMap`/`BigMap` plot it as metres; the isometric engine's
 * `CourseTrailArrows` multiplies it by `GLOBAL_CELL_SIZE` and plots it as cells. Whichever
 * component had moved most recently decided what the shared array meant, so enabling both
 * at once drew one of them a scale factor of ~40 out.
 *
 * The split follows ownership rather than convenience: `map.courseTrail` is part of the
 * wire `Status` and stays with the tactical maps in metres; this is pure client render
 * state in the scene's own coordinate system, so it lives in its own slice alongside
 * `discoveredGridSlice`.
 *
 * @author Carson Fujita
 * @license MIT
 */
import { createSlice, type PayloadAction } from '@reduxjs/toolkit';

/** A sampled vessel position in engine grid cells (centre-origin). */
export type SceneTrailPoint = { x: number; y: number };

export interface SceneTrailState {
    points: SceneTrailPoint[];
}

/**
 * Matches the cap `telemetrySlice.appendCourseTrailPoint` applies to the metres trail —
 * the two are different frames but the same "keep the recent track, drop the rest"
 * intent, and a mismatch would just be an unexplained inconsistency.
 */
const MAX_POINTS = 500;

const initialState: SceneTrailState = {
    points: [],
};

export const sceneTrailSlice = createSlice({
    name: 'sceneTrail',
    initialState,
    reducers: {
        appendSceneTrailPoint(state, action: PayloadAction<SceneTrailPoint>) {
            if (state.points.length >= MAX_POINTS) state.points.shift();
            state.points.push(action.payload);
        },
        clearSceneTrail(state) {
            // Assigning a fresh array rather than mutating gives consumers a new identity
            // exactly once per clear, instead of on every append.
            state.points = [];
        },
    },
});

export const { appendSceneTrailPoint, clearSceneTrail } = sceneTrailSlice.actions;

// Structural type to avoid a circular import with store.ts, matching discoveredGridSlice.
type WithSceneTrail = { sceneTrail: SceneTrailState };
export const selectSceneTrail = (state: WithSceneTrail) => state.sceneTrail.points;

export default sceneTrailSlice.reducer;
