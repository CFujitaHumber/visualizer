/**
 * @file telemetrySelectors.ts
 * @description Derived telemetry views: the vessel's position in a stable
 * local-meters frame, and ZED detections projected into that same frame.
 *
 * @remarks
 * These exist so there is exactly ONE definition of "where things are in
 * meters". Every map surface (BigMap/technical, TacticalMap, the course trail)
 * reads the frame from here rather than deriving its own, which is what
 * previously let the radar and the maps disagree about what `zed.objects`
 * meant.
 *
 * @author Carson Fujita
 * @license MIT
 */
import { createSelector } from '@reduxjs/toolkit';
import type { RootState } from '../store';
import type { DetectedObject } from '../../types';
import { measureLocalMeters, projectBoatRelative } from '../../utils/geo';

/** Local tangent-plane origin latched from the first usable GPS fix. */
export const selectFrame = (state: RootState) => state.telemetry.frame;

const selectLatitude = (state: RootState) => state.telemetry.asv.latitude;
const selectLongitude = (state: RootState) => state.telemetry.asv.longitude;
const selectHeading = (state: RootState) => state.telemetry.asv.heading;
const selectRawZedObjects = (state: RootState) => state.telemetry.zed.objects;

/**
 * The vessel's position in local meters (x = east, y = north) relative to the
 * latched frame origin.
 *
 * @remarks
 * Derived from GPS rather than `zed.odom.position` on purpose: odom is real
 * metres from the ZED on a live ASV but degrees mirrored from GPS in the
 * basestation's factory mode, so nothing downstream could treat it as one unit.
 * Returns the origin (0, 0) until a fix is latched, which keeps the maps
 * centred instead of throwing them 5000 km off on a null island reading.
 */
export const selectVesselLocalMeters = createSelector(
    [selectFrame, selectLatitude, selectLongitude],
    (frame, latitude, longitude) => {
        if (!frame.hasOrigin) return { x: 0, y: 0 };
        return measureLocalMeters(frame.originLatitude, frame.originLongitude, latitude, longitude);
    },
);

/**
 * ZED detections rotated by the vessel's heading and translated into the local-
 * meters frame, ready to draw alongside the boat icon and course trail.
 *
 * @remarks
 * Consumers wanting the boat-relative reading as sent by the basestation should
 * read `state.telemetry.zed.objects` directly — the radar/minimap does, because
 * its display is inherently boat-centric.
 */
export const selectZedObjectsWorld = createSelector(
    [selectRawZedObjects, selectHeading, selectVesselLocalMeters],
    (objects, heading, anchor): DetectedObject[] =>
        objects.map((obj) => ({
            ...obj,
            position: projectBoatRelative(obj.position, heading, anchor),
        })),
);

const selectMapInfo = (state: RootState) => state.telemetry.map.info;
const selectVesselPose = (state: RootState) => state.telemetry.map.vesselPose;
const selectIsConnected = (state: RootState) => state.connection.status === 'connected';

/**
 * How the isometric scene should place the vessel.
 *
 * @remarks
 * `'offline'` — mock or simulation: the scene drives the vessel itself, so no cell here.
 * `'live'` — a real map-frame pose is available and `cell` is where to draw it.
 * `'no-pose'` — connected, but the bridge has no usable `map -> base_link` transform.
 *   The vessel must NOT be drawn: the alternative is dead reckoning from the board's
 *   centre, which is exactly the fiction this replaced, and it is at its most misleading
 *   sitting on top of genuine SLAM obstacles.
 */
export type MapVesselPlacement = {
    /** Position in engine grid cells (centre-origin), or null when there is nothing real to draw. */
    cell: { x: number; y: number } | null;
    /** Compass degrees from the pose, or null — callers fall back to their own heading source. */
    heading: number | null;
    status: 'live' | 'no-pose' | 'offline';
};

/**
 * Converts the bridge's map-frame pose into the engine's grid-cell coordinates.
 *
 * @remarks
 * The conversion lives in exactly one place because it encodes a frame convention that is
 * easy to invert silently: the board is north-up, so `+row` is map `-y` (see
 * {@link MapInfo.origin}). Scene and HUD both read this, so they cannot end up disagreeing
 * about whether a pose is usable.
 *
 * Engine cells are centre-origin — (0,0) is the middle of the board, not a corner — hence
 * the half-span subtraction at the end.
 */
export const selectMapVesselPlacement = createSelector(
    [selectIsConnected, selectVesselPose, selectMapInfo],
    (isConnected, pose, info): MapVesselPlacement => {
        if (!isConnected) return { cell: null, heading: null, status: 'offline' };

        // A zero/absent resolution means the map metadata is unusable, not that the cells
        // are 0 m across — dividing by it would place the vessel at infinity.
        if (!pose || !info || !(info.resolution > 0)) {
            return { cell: null, heading: null, status: 'no-pose' };
        }

        const col = (pose.x - info.origin.x) / info.resolution;
        const row = (info.origin.y - pose.y) / info.resolution;

        if (!Number.isFinite(col) || !Number.isFinite(row)) {
            return { cell: null, heading: null, status: 'no-pose' };
        }

        return {
            cell: { x: col - info.cols / 2, y: row - info.rows / 2 },
            heading: pose.heading,
            status: 'live',
        };
    },
);
