/**
 * @file TacticalMapPanel.tsx
 * @description Redux-connected wrapper around {@link TacticalMap}.
 *
 * @remarks
 * Owns the tracking refs {@link TacticalMap} reads every animation frame —
 * path history, obstacles, current position, and heading — and keeps them
 * updated from live telemetry regardless of `open`, so history isn't lost
 * each time the map is toggled shut. Position tracking converts
 * `telemetry.asv.{latitude,longitude}` into local map meters anchored at the
 * first GPS fix; obstacle tracking projects `telemetry.zed.objects` (ZED
 * detections, boat-relative) into that same world frame. Follows the same
 * panel pattern as the other hud/telemetry components.
 *
 * @author Carson Fujita
 * @license MIT
 */
import React, { useEffect, useRef } from 'react';
import { useSelector } from 'react-redux';
import type { RootState } from '../../../store/store';
import TacticalMap, { type TacticalMapPathPoint, type TacticalMapObstacle } from './TacticalMap';

/** Properties for the {@link TacticalMapPanel} component. */
export interface TacticalMapPanelProps {
    /** Whether the map overlay is visible. Tracking continues even when closed. */
    open: boolean;
    /** Invoked when the user dismisses the map. */
    onClose: () => void;
}

const MOVE_THRESHOLD_M = 1;
const HEADING_THRESHOLD_DEG = 5;
const TELEPORT_THRESHOLD_M = 100;
const PATH_HISTORY_LIMIT = 1000;
const OBSTACLE_LIMIT = 200;
const OBSTACLE_DEDUPE_RADIUS_M = 2;
const EARTH_RADIUS_M = 6378137;

/** Converts a lat/lon offset from a local origin into approximate meters (equirectangular). */
const measureLocalMeters = (lat1: number, lon1: number, lat2: number, lon2: number) => {
    const dLat = ((lat2 - lat1) * Math.PI) / 180;
    const dLon = ((lon2 - lon1) * Math.PI) / 180;
    const x = dLon * Math.cos((lat1 * Math.PI) / 180) * EARTH_RADIUS_M;
    const y = dLat * EARTH_RADIUS_M;
    return { x, y };
};

/**
 * @function TacticalMapPanel
 * @description Feeds live telemetry (GPS position, heading, ZED detections)
 * into the presentational {@link TacticalMap}.
 */
export const TacticalMapPanel: React.FC<TacticalMapPanelProps> = ({ open, onClose }) => {
    const latitude = useSelector((state: RootState) => state.telemetry.asv.latitude);
    const longitude = useSelector((state: RootState) => state.telemetry.asv.longitude);
    const heading = useSelector((state: RootState) => state.telemetry.asv.heading);
    const detectedObjects = useSelector((state: RootState) => state.telemetry.zed.objects);

    const headingRef = useRef(heading);
    const currentPos = useRef({ x: 0, y: 0 });
    const startCoords = useRef<{ lat: number; lon: number } | null>(null);
    const pathHistory = useRef<TacticalMapPathPoint[]>([]);
    const obstacles = useRef<TacticalMapObstacle[]>([]);

    useEffect(() => {
        headingRef.current = heading;
    }, [heading]);

    // Path tracking: convert lat/lon into local map meters anchored at the first fix,
    // and accumulate path history whenever the vessel moves or turns meaningfully.
    useEffect(() => {
        if (latitude === undefined || longitude === undefined || (latitude === 0 && longitude === 0)) return;
        if (!startCoords.current) startCoords.current = { lat: latitude, lon: longitude };

        const loc = measureLocalMeters(startCoords.current.lat, startCoords.current.lon, latitude, longitude);
        currentPos.current = loc;

        const lastPoint = pathHistory.current[pathHistory.current.length - 1];

        // A large jump (e.g. reconnect with a stale/new fix) resets tracking entirely.
        if (lastPoint && Math.hypot(lastPoint.x - loc.x, lastPoint.y - loc.y) > TELEPORT_THRESHOLD_M) {
            pathHistory.current = [];
            obstacles.current = [];
            startCoords.current = { lat: latitude, lon: longitude };
            currentPos.current = { x: 0, y: 0 };
            return;
        }

        if (
            !lastPoint ||
            Math.hypot(lastPoint.x - loc.x, lastPoint.y - loc.y) > MOVE_THRESHOLD_M ||
            Math.abs(lastPoint.h - heading) > HEADING_THRESHOLD_DEG
        ) {
            pathHistory.current.push({ x: loc.x, y: loc.y, h: heading });
            if (pathHistory.current.length > PATH_HISTORY_LIMIT) pathHistory.current.shift();
        }
    }, [latitude, longitude, heading]);

    // Obstacle projection: ZED detections are boat-relative (x = right, y = forward).
    // Rotate each detection into the world frame by the current heading and anchor it
    // at the vessel's current world position, deduping against already-recorded
    // obstacles so a single physical object isn't re-added on every re-detection.
    useEffect(() => {
        if (!detectedObjects || detectedObjects.length === 0) return;

        const headingRad = (heading * Math.PI) / 180;
        const cos = Math.cos(headingRad);
        const sin = Math.sin(headingRad);

        detectedObjects.forEach((obj, index) => {
            const worldX = currentPos.current.x + (obj.position.x * cos + obj.position.y * sin);
            const worldY = currentPos.current.y + (-obj.position.x * sin + obj.position.y * cos);

            const isDuplicate = obstacles.current.some(
                existing => Math.hypot(existing.x - worldX, existing.y - worldY) < OBSTACLE_DEDUPE_RADIUS_M,
            );
            if (isDuplicate) return;

            obstacles.current.push({
                id: `${obj.label}-${obj.label_id}-${index}-${Date.now()}`,
                x: worldX,
                y: worldY,
                r: 1.5,
            });
            if (obstacles.current.length > OBSTACLE_LIMIT) obstacles.current.shift();
        });
    }, [detectedObjects, heading]);

    if (!open) return null;

    return (
        <TacticalMap
            onClose={onClose}
            pathHistory={pathHistory}
            obstacles={obstacles}
            currentPos={currentPos}
            headingRef={headingRef}
        />
    );
};

export default TacticalMapPanel;
