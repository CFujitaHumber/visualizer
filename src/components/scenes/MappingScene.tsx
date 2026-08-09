/**
 * @file MappingScene.tsx
 * @description Animation orchestrator for the mapping visualizer scene.
 * Renamed from MappingVisualizer.tsx. Uses useEnginePhysics and dispatches
 * scene events for objective reached and map regeneration.
 */
import React from 'react';
import { Box, Container, Stack, Grid, useMediaQuery, useTheme } from '@mui/material';
import { useEnginePhysics } from 'react-isometric-engine';
import { useAutoPathAnimation } from '../../hooks/useAutoPathAnimation';
import { useAppSelector, useAppDispatch, type RootState } from '../../store';

import { setASVSpeed, setASVHeading } from '../../store/slices/telemetrySlice';
import { appendSceneTrailPoint, clearSceneTrail } from '../../store/slices/sceneTrailSlice';
import { regenerateMockTelemetry } from '../../store/actions/fetchTelemetry';
import { dispatchSceneEvent, selectActiveScene } from '../../store/slices/sceneSlice';
import { selectMapVesselPlacement } from '../../store/selectors/telemetrySelectors';
import {
    revealGlobalAroundPosition,
    resetDiscovery,
    resizeDiscoveryGrid,
    bulkPromoteObstacles,
    revealAllKnownCells,
} from '../../store/slices/discoveredGridSlice';
import {
    CellTypes,
    GLOBAL_CELL_SIZE,
    LOCAL_CELL_SIZE,
    LOCAL_GRID_WORLD_SIZE,
    gridMetrics,
    dimsOfGrid,
    type Grid as OccupancyGridType,
} from '../../types';

/** Stable empty grid, so the "no terrain while live" path doesn't churn identity each render. */
const EMPTY_FINE_GRID: OccupancyGridType = [];

import { SceneCanvas } from './SceneCanvas';
import { Legend } from '../controls/Legend';
import { MobileBottomNav } from '../controls/MobileBottomNav';
import * as SceneHUD from '../hud/SceneHUD';

/**
 * @component MappingScene
 * @description The main mapping visualizer scene component. 
 *  It orchestrates the animation loop, handles user input, and renders the map, ASV, and HUD.
 * @remarks
 * This component uses the `useEnginePhysics` hook to simulate the ASV's movement based on speed and heading.
 * It dispatches scene events for objective reached and map regeneration, and manages the course trail.
 * 
 * @returns a React element representing the mapping visualizer scene.
 */
export default function MappingScene() {
    const theme = useTheme();
    const dispatch = useAppDispatch();
    const isMobile = useMediaQuery(theme.breakpoints.down('md'));
    const isLandscape = useMediaQuery('(orientation: landscape)');

    const [isFullscreen, setIsFullscreen] = React.useState(false);

    // Determine if the app is in desktop mode (not mobile or in fullscreen landscape)
    const isDesktopMode = !isMobile || (isFullscreen && isLandscape);

    // Redux state selectors
    const activeSceneId = useAppSelector(selectActiveScene);
    const simMode = useAppSelector((state: RootState) => state.simulation.simMode);
    const showLegend = useAppSelector((state: RootState) => state.visualization.showLegend);
    const { speed, heading } = useAppSelector((state: RootState) => state.telemetry.asv);
    const connectionStatus = useAppSelector((state: RootState) => state.connection.status);
    const isConnected = connectionStatus === 'connected';
    const rawFineGrid = useAppSelector((state: RootState) => state.simulation.fineGrid);
    const occupancyGrid = useAppSelector((state: RootState) => state.telemetry.map.occupancyGrid);
    const mapInfo = useAppSelector((state: RootState) => state.telemetry.map.info);
    const autoSimActive = !isConnected && simMode === 'automatic';


    const [_,setIsToroidal] = React.useState(false);

    React.useEffect(() => {
        setIsToroidal(isConnected);
    }, [isConnected]);

    // The board is whatever the basestation actually sent, not a hardcoded 20x20.
    // `gridMetrics` guards the empty-grid case so these stay sane before the first payload.
    const gridDims = React.useMemo(() => dimsOfGrid(occupancyGrid), [occupancyGrid]);
    const { cols: gridCols, rows: gridRows, halfSpanX, halfSpanY } = React.useMemo(
        () => gridMetrics(gridDims),
        [gridDims],
    );

    /**
     * Where the vessel actually is on the SLAM map, converted to engine cells. Null in
     * mock/sim (the scene drives itself) and null while connected without a usable TF
     * pose, which is what `status === 'no-pose'` reports.
     */
    const placement = useAppSelector(selectMapVesselPlacement);
    const poseCell = placement.cell;

    /**
     * `fineGrid` is produced only by the client-side mock factory — the basestation has
     * never sent one. Reusing it while connected drew fabricated terrain under a live
     * vessel and, worse, permanently promoted those invented obstacles into
     * `obstacleOverrides`, which the overlay ORs into the real occupancy map. Live
     * sessions therefore get no local terrain at all until there is a real source for it.
     */
    const fineGrid = isConnected ? EMPTY_FINE_GRID : rawFineGrid;

    // Joystick state — only active in manual sim mode
    const VELOCITY_MAX = 2.0;
    const TURN_RATE = 90; // deg/s at full x deflection
    const [joyState, setJoyState] = React.useState({ x: 0, y: 0 });
    const joyRef = React.useRef({ x: 0, y: 0 });

    const handleJoyChange = React.useCallback((j: { x: number; y: number }) => {
        joyRef.current = j;
        setJoyState(j);
        dispatch(setASVSpeed(j.y * VELOCITY_MAX));
    }, [dispatch]);

    const headingRef = React.useRef(heading);
    const lastDispatchedHeadingRef = React.useRef(-1);
    React.useEffect(() => { headingRef.current = heading; }, [heading]);

    // Animation loop for heading updates based on joystick input
    React.useEffect(() => {
        if (isConnected || autoSimActive) return;
        let lastTime: number | null = null;
        let rafId: number;
        const loop = (now: number) => {
            if (lastTime !== null) {
                const dt = (now - lastTime) / 1000;
                const x = joyRef.current.x;
                if (Math.abs(x) > 0.05) {
                    const next = ((headingRef.current + x * TURN_RATE * dt) + 360) % 360;
                    headingRef.current = next;
                    const rounded = Math.round(next);
                    if (rounded !== lastDispatchedHeadingRef.current) {
                        lastDispatchedHeadingRef.current = rounded;
                        dispatch(setASVHeading(rounded));
                    }
                }
            }
            lastTime = now;
            rafId = requestAnimationFrame(loop);
        };
        rafId = requestAnimationFrame(loop);
        return () => cancelAnimationFrame(rafId);
    }, [isConnected, autoSimActive, dispatch]);

    const joyLw = Math.max(-1, Math.min(1, joyState.y + joyState.x));
    const joyRw = Math.max(-1, Math.min(1, joyState.y - joyState.x));

    const mappingPaused = !isConnected && !autoSimActive && activeSceneId !== 'mapping';

    // Dead reckoning is now a SIMULATION-ONLY concern. While connected the vessel comes
    // from the bridge's map-frame TF pose, so the physics loop is fed zero velocity and
    // stops stepping entirely (`useEnginePhysics` early-returns on zero).
    //
    // This is also why the old metres-per-second to cells-per-second conversion is gone:
    // it existed purely to make live dead reckoning less wrong, and live no longer dead
    // reckons at all. In sim, `speed` is already in cells and always was.
    const { globalX: manualX, globalY: manualY, setGlobalX, setGlobalY } = useEnginePhysics(
        isConnected || autoSimActive || mappingPaused ? 0 : speed,
        heading,
        gridDims,
        !isConnected,
    );
    const { autoX, autoY, autoHeading } = useAutoPathAnimation(autoSimActive, 2.0);

    const globalX = poseCell ? poseCell.x : autoSimActive ? autoX : manualX;
    const globalY = poseCell ? poseCell.y : autoSimActive ? autoY : manualY;

    // Heading likewise: the pose's heading is the one expressed in the map's own frame,
    // so it is what keeps the bow consistent with the obstacles around it. `asv.heading`
    // is the GPS/compass bearing, which is a different frame and only used off-map.
    const headingOverride = placement.heading ?? (autoSimActive ? autoHeading : undefined);

    // Sync manual position to auto position when leaving auto mode so there's no jump.
    const prevAutoSimRef = React.useRef(autoSimActive);
    React.useEffect(() => {
        const was = prevAutoSimRef.current;
        prevAutoSimRef.current = autoSimActive;
        if (was && !autoSimActive) {
            setGlobalX(autoX);
            setGlobalY(autoY);
        }
    }, [autoSimActive]); // eslint-disable-line react-hooks/exhaustive-deps

    const plan = useAppSelector((state: RootState) => state.telemetry.planning.plan);

    const lastPointRef = React.useRef<{ x: number; y: number } | null>(null);
    const pendingAutoClearRef = React.useRef(false);
    const pendingAutoClearPosRef = React.useRef<{ x: number; y: number } | null>(null);

    // Regenerate mock telemetry when the basestation drops mid-session.
    const prevStatusRef = React.useRef(connectionStatus);
    React.useEffect(() => {
        const prev = prevStatusRef.current;
        prevStatusRef.current = connectionStatus;
        if (prev === 'connected' && connectionStatus === 'mock') {
            pendingAutoClearRef.current = false;
            pendingAutoClearPosRef.current = null;
            lastPointRef.current = null;
            dispatch(clearSceneTrail());
            dispatch(regenerateMockTelemetry());
        }
    }, [connectionStatus, dispatch]);

    // Clear the course trail when the sim mode changes (e.g., from manual to auto).
    React.useEffect(() => {
        pendingAutoClearRef.current = false;
        pendingAutoClearPosRef.current = null;
        lastPointRef.current = null;
        dispatch(clearSceneTrail());
    }, [dispatch, simMode]);

    // Sample the vessel's position into the scene's own cell-space trail as it moves, and
    // break the line rather than draw across the map when it jumps.
    //
    // This used to bail out entirely while connected, because the only position available
    // then was dead-reckoned fiction not worth recording. Now that live mode has a real
    // map-frame pose, the trail is the vessel's actual track over the survey.
    React.useEffect(() => {
        if (isConnected && !poseCell) return;
        if (autoSimActive && plan.length === 0) return;

        if (pendingAutoClearRef.current) {
            const obj = pendingAutoClearPosRef.current!;
            if (Math.hypot(globalX - obj.x, globalY - obj.y) > 1.0) {
                pendingAutoClearRef.current = false;
                pendingAutoClearPosRef.current = null;
                lastPointRef.current = { x: globalX, y: globalY };
                dispatch(clearSceneTrail());
                dispatch(appendSceneTrailPoint({ x: globalX, y: globalY }));
            }
            return;
        }

        const prev = lastPointRef.current;
        const SAMPLE_DIST = 0.3;
        // Originally a toroidal-wrap detector. Live mode does not wrap, but the threshold
        // still earns its place: SLAM loop closure re-localises the vessel in one step,
        // and that discontinuity should break the trail rather than be drawn as a stroke
        // straight across the map.
        const TELEPORT_DIST = 5.0;
        const dist = prev !== null ? Math.hypot(globalX - prev.x, globalY - prev.y) : 0;

        if (prev !== null && dist >= TELEPORT_DIST) {
            lastPointRef.current = { x: globalX, y: globalY };
            dispatch(clearSceneTrail());
            dispatch(appendSceneTrailPoint({ x: globalX, y: globalY }));
        } else if (prev === null || dist >= SAMPLE_DIST) {
            lastPointRef.current = { x: globalX, y: globalY };
            dispatch(appendSceneTrailPoint({ x: globalX, y: globalY }));
        }
    }, [globalX, globalY]); // eslint-disable-line react-hooks/exhaustive-deps

    const atObjectiveRef = React.useRef(false);

    // Dispatch an OBJECTIVE_REACHED event when the vessel reaches the objective cell. 
    // If in auto mode, clear the course trail and regenerate mock telemetry.
    React.useEffect(() => {
        const objectiveCell = plan[plan.length - 1];
        if (!objectiveCell) return;
        const col = Math.floor(globalX + gridCols / 2);
        const row = Math.floor(globalY + gridRows / 2);
        if (col === objectiveCell.x && row === objectiveCell.y) {
            if (!atObjectiveRef.current) {
                atObjectiveRef.current = true;
                dispatch(dispatchSceneEvent({ type: 'OBJECTIVE_REACHED', sceneId: 'mapping', payload: { x: globalX, y: globalY } }));
                if (autoSimActive) {
                    pendingAutoClearRef.current = true;
                    pendingAutoClearPosRef.current = { x: globalX, y: globalY };
                } else {
                    lastPointRef.current = null;
                    dispatch(clearSceneTrail());
                    dispatch(regenerateMockTelemetry());
                }
            }
        } else {
            atObjectiveRef.current = false;
        }
    }, [globalX, globalY, plan]); // eslint-disable-line react-hooks/exhaustive-deps

    // When the map loads or regenerates, record the vessel's current position as baseline
    // WITHOUT revealing it. This prevents the default (0,0) position from uncovering the
    // map center before the vessel has actually traveled there. React runs effects in
    // definition order, so this fires before the reveal effect below when fineGrid changes.
    const lastFogCellRef = React.useRef<{ col: number; row: number } | null>(null);

    // Keep the fog grid the same shape as the map, and drop the trail with it. Dispatching
    // every payload is safe — the reducer no-ops unless the dimensions actually changed.
    //
    // The trail is cleared for the same reason discovery state is: its points are cell
    // coordinates, and a differently-sized board puts those cells over a different piece
    // of the world. Carrying them across would draw a track the vessel never took.
    React.useEffect(() => {
        dispatch(resizeDiscoveryGrid({ cols: gridCols, rows: gridRows }));
        lastPointRef.current = null;
        dispatch(clearSceneTrail());
    }, [gridCols, gridRows, dispatch]);

    React.useEffect(() => {
        if (fineGrid.length === 0) return;
        lastFogCellRef.current = {
            col: Math.floor(globalX + gridCols / 2),
            row: Math.floor(globalY + gridRows / 2),
        };
    }, [fineGrid]); // eslint-disable-line react-hooks/exhaustive-deps

    // Reveal global cells and promote fineGrid obstacles only when the vessel actually moves.
    React.useEffect(() => {
        if (fineGrid.length === 0) return;

        const gCol = Math.floor(globalX + gridCols / 2);
        const gRow = Math.floor(globalY + gridRows / 2);
        const last = lastFogCellRef.current;

        // Skip if position hasn't changed (includes the initial load position captured above).
        if (last === null || (last.col === gCol && last.row === gRow)) return;

        lastFogCellRef.current = { col: gCol, row: gRow };
        dispatch(revealGlobalAroundPosition({ col: gCol, row: gRow }));

        // Promote only the global cells that overlap the LocalGrid's actual visible area.
        // LocalGrid covers ±LOCAL_GRID_WORLD_SIZE/2 px from the vessel center — compute the
        // exact global cell range instead of a fixed radius to avoid over-marking.
        const worldCX = globalX * GLOBAL_CELL_SIZE;
        const worldCY = globalY * GLOBAL_CELL_SIZE;
        const half = LOCAL_GRID_WORLD_SIZE / 2; // 60 px
        const cMin = Math.max(0, Math.floor((worldCX - half + halfSpanX) / GLOBAL_CELL_SIZE));
        const cMax = Math.min(gridCols - 1, Math.floor((worldCX + half + halfSpanX) / GLOBAL_CELL_SIZE));
        const rMin = Math.max(0, Math.floor((worldCY - half + halfSpanY) / GLOBAL_CELL_SIZE));
        const rMax = Math.min(gridRows - 1, Math.floor((worldCY + half + halfSpanY) / GLOBAL_CELL_SIZE));

        const promoteCols: number[] = [];
        const promoteRows: number[] = [];
        for (let nr = rMin; nr <= rMax; nr++) {
            for (let nc = cMin; nc <= cMax; nc++) {
                const worldXMin = (nc - gridCols / 2) * GLOBAL_CELL_SIZE;
                const worldYMin = (nr - gridRows / 2) * GLOBAL_CELL_SIZE;
                const fColStart = Math.max(0, Math.floor((worldXMin + halfSpanX) / LOCAL_CELL_SIZE));
                const fRowStart = Math.max(0, Math.floor((worldYMin + halfSpanY) / LOCAL_CELL_SIZE));
                const fColEnd   = Math.min(fineGrid[0]?.length ?? 0, Math.ceil((worldXMin + GLOBAL_CELL_SIZE + halfSpanX) / LOCAL_CELL_SIZE));
                const fRowEnd   = Math.min(fineGrid.length,           Math.ceil((worldYMin + GLOBAL_CELL_SIZE + halfSpanY) / LOCAL_CELL_SIZE));

                let hasObstacle = false;
                outer: for (let fi = fRowStart; fi < fRowEnd; fi++) {
                    for (let fj = fColStart; fj < fColEnd; fj++) {
                        if (fineGrid[fi]?.[fj]?.type === CellTypes.occupied) {
                            hasObstacle = true;
                            break outer;
                        }
                    }
                }
                if (hasObstacle) {
                    promoteCols.push(nc);
                    promoteRows.push(nr);
                }
            }
        }
        if (promoteCols.length > 0) {
            dispatch(bulkPromoteObstacles({ cols: promoteCols, rows: promoteRows }));
        }
    }, [globalX, globalY, fineGrid, dispatch]); // eslint-disable-line react-hooks/exhaustive-deps

    // Live mode: reveal every cell the basestation has actually surveyed.
    //
    // This used to submit only cells with `type !== empty` — i.e. obstacles alone — so
    // known-clear water was never revealed and a live map rendered as a black field with a
    // few red tiles floating in it. A cell present in the occupancy grid is *surveyed*
    // whether or not something is in it; "empty" means known-and-clear, not unknown. The
    // bridge deliberately leaves genuinely-unknown source cells (OccupancyGrid's -1) out of
    // the occupied set, so honouring every present cell here is what makes fog mean
    // "not yet mapped" rather than "no obstacle".
    React.useEffect(() => {
        if (!isConnected) return;
        const cols: number[] = [];
        const rows: number[] = [];
        const knownMask = mapInfo?.known;
        occupancyGrid.forEach((gridRow, ri) => {
            gridRow.forEach((cell, ci) => {
                if (!cell) return;
                // With a mask, reveal only what SLAM has observed. Without one the
                // producer has no notion of unknown (the factory's map is wholly
                // surveyed), so every cell present counts as seen.
                if (knownMask && !knownMask[ri * gridCols + ci]) return;
                cols.push(ci);
                rows.push(ri);
            });
        });
        if (cols.length > 0) dispatch(revealAllKnownCells({ cols, rows }));
    }, [occupancyGrid, mapInfo, gridCols, isConnected, dispatch]);

    /**
     * @constant handleRegenerateMap
     * @description Callback to regenerate the mock telemetry map.
     * @remarks
     * This function resets the auto-clear state, clears the course trail, and dispatches actions to regenerate the map and reset discovery.
     * It also dispatches a scene event indicating that the map has been regenerated.
     */
    const handleRegenerateMap = React.useCallback(() => {
        pendingAutoClearRef.current = false;
        pendingAutoClearPosRef.current = null;
        lastPointRef.current = null;
        dispatch(regenerateMockTelemetry());
        dispatch(clearSceneTrail());
        dispatch(resetDiscovery());
        dispatch(dispatchSceneEvent({ type: 'MAP_REGENERATED', sceneId: 'mapping' }));
    }, [dispatch]);

    // You know what this does. It exits fullscreen mode and unlocks the screen orientation if supported.
    const exitFullscreen = () => {
        setIsFullscreen(false);
        try { screen.orientation.unlock(); } catch { /* not supported */ }
    };

    const toggleFullscreen = async () => {
        if (!isFullscreen) {
            setIsFullscreen(true);
            // `lock` is missing from some ScreenOrientation typings (still experimental in the spec).
            try { await (screen.orientation as ScreenOrientation & { lock?: (orientation: string) => Promise<void> }).lock?.('landscape'); } catch { /* not supported (e.g. iOS) */ }
        } else {
            exitFullscreen();
        }
    };

    React.useEffect(() => {
        document.body.style.overflow = isFullscreen ? 'hidden' : '';
        return () => { document.body.style.overflow = ''; };
    }, [isFullscreen]);

    React.useEffect(() => {
        const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') exitFullscreen(); };
        document.addEventListener('keydown', handler);
        return () => document.removeEventListener('keydown', handler);
    }, []);

    const joystickProps = !isConnected && !autoSimActive ? {
        joy: joyState,
        lw: joyLw,
        rw: joyRw,
        onJoyChange: handleJoyChange,
    } : undefined;

    return (
        <Box
            sx={{
                bgcolor: theme.palette.scene.skyDark,
                ...(isFullscreen ? {
                    position: 'fixed',
                    inset: 0,
                    zIndex: 1150,
                    overflow: 'hidden',
                    display: 'flex',
                    flexDirection: 'column',
                    pt: 'env(safe-area-inset-top)',
                    pb: !isDesktopMode ? 'calc(56px + env(safe-area-inset-bottom))' : 'env(safe-area-inset-bottom)',
                    pl: 'env(safe-area-inset-left)',
                    pr: 'env(safe-area-inset-right)',
                } : {
                    minHeight: '100vh',
                    display: 'flex',
                    flexDirection: 'column',
                    py: { xs: 2, md: 3 },
                    px: { xs: 0, sm: 2, md: 4 },
                    pb: { xs: '56px', md: 6 },
                })
            }}
        >
            <Container
                maxWidth={false}
                sx={{
                    px: { xs: 0, sm: 4 },
                    maxWidth: '1800px',
                    flex: 1,
                    ...(isFullscreen && { minHeight: 0, display: 'flex', flexDirection: 'column', px: 0 }),
                }}
            >
                <Stack
                    spacing={isFullscreen ? 1 : 2}
                    sx={isFullscreen ? { flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column' } : {}}
                >
                    <SceneCanvas
                        globalX={globalX}
                        globalY={globalY}
                        setGlobalX={setGlobalX}
                        setGlobalY={setGlobalY}
                        headingOverride={headingOverride}
                        showVessel={placement.status !== 'no-pose'}
                        isDesktopMode={isDesktopMode}
                        isFullscreen={isFullscreen}
                        isMobile={isMobile}
                        onToggleFullscreen={toggleFullscreen}
                        onRegenerateMap={handleRegenerateMap}
                        joystickProps={joystickProps}
                        toroidal={isTorodial}
                    >
                        <SceneHUD.Tabs />
                        <SceneHUD.StatusBadges />
                        <SceneHUD.Toolbar />
                        <SceneHUD.Title />
                        {joystickProps && <SceneHUD.JoystickHUD {...joystickProps} />}
                        <SceneHUD.LegendPanel />
                        <SceneHUD.ConnectingOverlay />
                    </SceneCanvas>

                    {!isFullscreen && (
                        <Stack spacing={3} sx={{ px: { xs: 2, sm: 0 } }}>
                            <Grid container spacing={3} alignItems="stretch">
                                <Grid size={{ xs: 12, md: 6, lg: 4 }} sx={{ display: { xs: 'block', md: 'none' } }}>
                                    {showLegend && <Legend variant={activeSceneId === 'forces' ? 'forces' : 'mapping'} />}
                                </Grid>
                            </Grid>
                        </Stack>
                    )}
                </Stack>
            </Container>

            {!isDesktopMode && (
                <MobileBottomNav />
            )}
        </Box>
    );
}
