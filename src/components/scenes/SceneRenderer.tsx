/**
 * @file SceneRenderer.tsx
 * @description Thin connected wrapper around `react-isometric-engine`'s `SceneRenderer`.
 * Reads Redux state and the MUI theme, then hands both to the portable, prop-driven engine
 * component as `sceneState` / `colors`. Keeps the same external prop contract as before so
 * `SceneCanvas.tsx` needs no changes.
 */
import React from 'react';
import { useTheme } from '@mui/material';
import {
    SceneRenderer as IsometricSceneRenderer,
    dimsOfGrid,
    type SceneRendererProps as IsometricSceneRendererProps,
} from 'react-isometric-engine';

import { useAppSelector } from '../../store';
import type { RootState } from '../../store';
import { selectActiveScene } from '../../store/slices/sceneSlice';
import { selectDiscoveredCells, selectObstacleOverrides } from '../../store/slices/discoveredGridSlice';
import { selectSceneTrail } from '../../store/slices/sceneTrailSlice';

export type SceneRendererProps = Pick<
    IsometricSceneRendererProps,
    'width' | 'height' | 'scale' | 'offset' | 'interactionProps' | 'preserveAspectRatio' | 'mappingData' | 'forcesData'
> & {
    /**
     * Whether the vessel is drawn. Lifted out of `sceneState` because it is a decision the
     * scene makes from the pose, not something readable from the store on its own.
     */
    showVessel?: boolean;
};

/**
 * Unified isometric SVG engine for mapping and force visualization scenes, connected to Redux
 * and the MUI theme.
 */
export const SceneRenderer: React.FC<SceneRendererProps> = ({ showVessel = true, ...props }) => {
    const theme = useTheme();

    const {
        showGlobalGrid,
        showGlobalAxes,
        showLocalAxes,
        showLocalGrid,
        showCourseTrail,
        showFogOfWar,
    } = useAppSelector((state: RootState) => state.visualization);

    const {
        currentHeading,
        currentSpeed,
        fineGrid,
    } = useAppSelector((state: RootState) => state.simulation);

    const { speed: effectiveSpeed, heading: effectiveHeading } = useAppSelector(
        (state: RootState) => state.telemetry.asv
    );
    const occupancyGrid = useAppSelector((state: RootState) => state.telemetry.map.occupancyGrid);
    const navigationGrid = useAppSelector((state: RootState) => state.telemetry.map.navigationGrid);
    // The SCENE's trail, in grid cells — not `telemetry.map.courseTrail`, which is the
    // tactical maps' trail in metres. See sceneTrailSlice for why those are separate.
    const courseTrail = useAppSelector(selectSceneTrail);

    const discoveredCells = useAppSelector(selectDiscoveredCells);
    const obstacleOverrides = useAppSelector(selectObstacleOverrides);

    const activeSceneId = useAppSelector(selectActiveScene);
    const isConnected = useAppSelector((state: RootState) => state.connection.status === 'connected');

    // The board is the size of the map we were actually sent, not a hardcoded 20x20.
    // Falls back to the engine's default square only while the grid is still empty.
    const gridDims = React.useMemo(() => dimsOfGrid(occupancyGrid), [occupancyGrid]);

    // A real SLAM map has edges; only the synthetic world is endless. Wrapping a live map
    // would teleport the vessel to the far side rather than showing it leave the survey.
    const toroidal = !isConnected;

    return (
        <IsometricSceneRenderer
            {...props}
            sceneState={{
                activeSceneId,
                showGlobalGrid,
                showGlobalAxes,
                showLocalAxes,
                showLocalGrid,
                currentHeading,
                currentSpeed,
                effectiveSpeed,
                effectiveHeading,
                fineGrid,
                courseTrail,
                showCourseTrail,
                occupancyGrid,
                navigationGrid,
                discoveredCells,
                obstacleOverrides,
                showFogOfWar,
                gridDims,
                toroidal,
                showVessel,
            }}
            colors={{
                map: theme.palette.map,
                water: theme.palette.water,
                scene: theme.palette.scene,
                error: theme.palette.error,
                warning: theme.palette.warning,
                success: theme.palette.success,
                info: theme.palette.info,
                common: theme.palette.common,
                textPrimary: theme.palette.text.primary,
            }}
        />
    );
};
