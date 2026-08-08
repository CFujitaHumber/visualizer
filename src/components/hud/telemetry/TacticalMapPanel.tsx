/**
 * @file TacticalMapPanel.tsx
 * @description Redux-connected wrapper around {@link TacticalMap}.
 *
 * @remarks
 * TacticalMap reads everything it renders (course trail, obstacles,
 * position, heading) directly from Redux, so this wrapper's one remaining
 * job is building the course trail itself: nothing currently appends to
 * `state.telemetry.map.courseTrail` for a live connection (the basestation
 * bridge doesn't send one yet — see the `map` group in statusTypes.ts), so
 * this component tracks the vessel's position and accumulates trail points
 * into Redux whenever it moves or turns meaningfully.
 *
 * The anchor is `selectVesselLocalMeters` — GPS projected into the latched
 * local-meters frame — NOT `zed.odom.position`. Odom is genuine metres on a
 * live ASV but degrees mirrored from GPS in the basestation's factory mode, so
 * the metre thresholds below saw ~1e-5 of movement per tick and the trail never
 * grew past its first point. Every map surface anchors to the same selector, so
 * trail, boat icon and obstacles stay in one frame.
 *
 * @author Carson Fujita
 * @license MIT
 */
import React, { useEffect, useRef } from 'react';
import type { RootState } from '../../../store/store';
import { useAppSelector, useAppDispatch } from '../../../store';
import type { CourseTrailPoint } from '../../../types';
import TacticalMap from './TacticalMap';
import { appendCourseTrailPoint, clearCourseTrail } from '../../../store/slices/telemetrySlice';
import { selectVesselLocalMeters } from '../../../store/selectors/telemetrySelectors';

/** Properties for the {@link TacticalMapPanel} component. */
export interface TacticalMapPanelProps {
    /** Whether the map overlay is visible. Trail tracking continues even when closed. */
    open: boolean;
    /** Invoked when the user dismisses the map. */
    onClose: () => void;
}

const MOVE_THRESHOLD_M = 1;
const HEADING_THRESHOLD_DEG = 5;
const TELEPORT_THRESHOLD_M = 100;

/**
 * @function TacticalMapPanel
 * @description Builds the course trail from live ZED odometry and renders
 * the presentational {@link TacticalMap}, which reads everything else
 * (obstacles, position, heading) from Redux directly.
 */
export const TacticalMapPanel: React.FC<TacticalMapPanelProps> = ({ open, onClose }) => {
    const dispatch = useAppDispatch();
    const vessel = useAppSelector(selectVesselLocalMeters);
    const hasOrigin = useAppSelector((state: RootState) => state.telemetry.frame.hasOrigin);
    const heading = useAppSelector((state: RootState) => state.telemetry.asv.heading);
    const courseTrail = useAppSelector((state: RootState) => state.telemetry.map.courseTrail);
    const odomX = vessel.x;
    const odomY = vessel.y;

    const lastPointRef = useRef<CourseTrailPoint | undefined>(courseTrail[courseTrail.length - 1]);

    useEffect(() => {
        // Before the first fix every sample would be a spurious (0,0) — the frame
        // isn't anchored yet, so there is no meaningful position to record.
        if (!hasOrigin) return;

        const lastPoint = lastPointRef.current;

        // A large jump (e.g. reconnect with a stale/new odometry fix) resets the trail entirely.
        if (lastPoint && Math.hypot(lastPoint.x - odomX, lastPoint.y - odomY) > TELEPORT_THRESHOLD_M) {
            dispatch(clearCourseTrail());
            lastPointRef.current = undefined;
            return;
        }

        if (
            !lastPoint ||
            Math.hypot(lastPoint.x - odomX, lastPoint.y - odomY) > MOVE_THRESHOLD_M ||
            Math.abs(lastPoint.heading - heading) > HEADING_THRESHOLD_DEG
        ) {
            const point = { x: odomX, y: odomY, heading };
            dispatch(appendCourseTrailPoint(point));
            lastPointRef.current = point;
        }
    }, [odomX, odomY, heading, hasOrigin, dispatch]);

    if (!open) return null;

    return <TacticalMap onClose={onClose} />;
};

export default TacticalMapPanel;
