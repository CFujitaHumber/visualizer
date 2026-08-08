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
