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
 * This is the one map surface that genuinely wants the raw boat-relative
 * reading — the radar is boat-centric by construction, so it reads
 * `zed.objects` directly rather than going through `selectZedObjectsWorld`.
 * It previously produced an empty radar because the slice rewrote that field
 * into world coordinates at ingestion, putting every detection thousands of
 * units outside the 40 m range ring.
 *
 * @author Carson Fujita
 * @license MIT
 */
import React from 'react';
import { Box, useTheme } from '@mui/material';
import { useSelector } from 'react-redux';
import type { RootState } from '../../../store/store';
import RadiusVisualizer, { type RadarObstacle } from './RadiusVisualizer';

// TODO:the localgrid in the visualizer system is like the radius visualizer

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
    // const latitude = useSelector((state: RootState) => state.telemetry.asv.latitude);
    // const longitude = useSelector((state: RootState) => state.telemetry.asv.longitude);
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

    const theme = useTheme();
    const telemetry = theme.palette.telemetry;
    const actualSize = size ?? 100;
    const borderLight = telemetry?.border.light ?? theme.palette.divider;

    return (
        <Box
            sx={{
                display: 'flex',
                flexDirection: 'column',
                height: '100%',
                backgroundColor: telemetry?.background.primary,
                border: `1px solid ${borderLight}`,
                borderRadius: 2,
                backdropFilter: 'blur(10px)',
                width: '100%',
                maxWidth: actualSize + 50,
                overflow: 'hidden',
                boxShadow: '0 4px 15px rgba(0, 0, 0, 0.5)',
            }}
        >
            <RadiusVisualizer
                heading={heading}
                /// disabled for room.
                // latitude={latitude}
                // longitude={longitude}
                obstacles={obstacles}
                rangeM={rangeM}
                size={size}
                onClick={onClick}
            />
        </Box>
    );
};

export default RadiusVisualizerPanel;
