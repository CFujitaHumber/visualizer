/**
 * @file RadiusVisualizerPanel.tsx
 * @description Redux-connected wrapper around {@link RadiusVisualizer}.
 *
 * @remarks
 * Selects the vessel heading and GPS position from `telemetry.asv` and maps the
 * ZED camera's detected objects (`telemetry.zed.objects`, boat-relative meters)
 * into radar obstacles. Follows the same panel pattern as the other
 * hud/telemetry components.
 *
 * @author Carson Fujita
 * @license MIT
 */
import React from 'react';
import { useSelector } from 'react-redux';
import type { RootState } from '../../../store/store';
import RadiusVisualizer, { type RadarObstacle } from './RadiusVisualizer';

/** Properties for the {@link RadiusVisualizerPanel} component. */
export interface RadiusVisualizerPanelProps {
    /** Radar range in meters. Defaults to 40. */
    rangeM?: number;
    /** Diameter of the radar circle in pixels. Defaults to 120. */
    size?: number;
    /** Optional click handler passed through to the radar panel. */
    onClick?: () => void;
}

/**
 * @function RadiusVisualizerPanel
 * @description Feeds live telemetry (heading, GPS, ZED detections) into the
 * presentational {@link RadiusVisualizer}.
 */
export const RadiusVisualizerPanel: React.FC<RadiusVisualizerPanelProps> = ({ rangeM, size, onClick }) => {
    const heading = useSelector((state: RootState) => state.telemetry.asv.heading);
    const latitude = useSelector((state: RootState) => state.telemetry.asv.latitude);
    const longitude = useSelector((state: RootState) => state.telemetry.asv.longitude);
    const detectedObjects = useSelector((state: RootState) => state.telemetry.zed.objects);

    // ZED detections are boat-relative (meters): x = right/east-ish, y = forward/north-ish.
    const obstacles = React.useMemo<RadarObstacle[]>(
        () =>
            (detectedObjects ?? []).map((obj, index) => ({
                id: `${obj.label}-${obj.label_id}-${index}`,
                x: obj.position.x,
                y: obj.position.y,
            })),
        [detectedObjects],
    );

    return (
        <RadiusVisualizer
            heading={heading}
            latitude={latitude}
            longitude={longitude}
            obstacles={obstacles}
            rangeM={rangeM}
            size={size}
            onClick={onClick}
        />
    );
};

export default RadiusVisualizerPanel;
