/**
 * @file TacticalMap.tsx
 * @description Full-screen canvas "tactical map": the ASV's accumulated path
 * history, swept field-of-view, detected obstacles, and a heading-rotated
 * boat icon, drawn in a local (meter-based, not lat/lon) Cartesian frame with
 * smooth camera pan/zoom.
 *
 * @remarks
 * - Reads path history, obstacles, position, and heading directly from Redux
 *   (the same `state.telemetry.*` selectors BigMap uses) rather than via
 *   props/refs. The only remaining Redux-connected wrapper work is building
 *   the course trail itself — see {@link TacticalMapPanel}.
 * - The canvas render loop runs on `requestAnimationFrame`, independent of
 *   React's render cycle. Since the effect that starts it only runs once on
 *   mount, live selector values are mirrored into refs (see the `*Ref`
 *   variables below) so each animation frame reads current state instead of
 *   whatever was captured in the effect's closure at mount time.
 * - Exponential smoothing is applied to position/heading and to camera
 *   pan/zoom, plus a "teleport" snap heuristic so an initial GPS fix (or a
 *   large jump) doesn't glide in from the wrong place.
 * - All colors come from the active MUI theme (telemetry palette group),
 *   with graceful fallbacks to the core MUI palette when it isn't defined.
 *
 * @author Carson Fujita
 * @license MIT
 */
import React, { useEffect, useRef, useState } from 'react';
import { Box, Typography, Button } from '@mui/material';
import { alpha, useTheme } from '@mui/material/styles';
import { keyframes } from '@emotion/react';
import { useAppSelector } from '../../../store';
import type { RootState } from '../../../store';
import type { CourseTrailPoint, DetectedObject } from "../../../types";
import { catamaranSvgStr } from '../../../assets/svgSources';
import {
    ROBOT_LENGTH_M,
    ROBOT_WIDTH_M,
    FOV_RADIUS_M,
    FOV_HALF_ANGLE_RAD,
    OBJECT_COLOR_KEYS,
    DEFAULT_OBJECT_COLOR_KEY,
} from '../../../utils/robot';


/** Properties for the {@link TacticalMap} component. */
export interface TacticalMapProps {
    /** Invoked when the user dismisses the map. */
    onClose: () => void;
}

const slideUpExpand = keyframes`
  0% { transform: scale(0.15); opacity: 0; border-radius: 20px; }
  100% { transform: scale(1); opacity: 1; border-radius: 0px; }
`;

const pulseDot = keyframes`
  0%, 100% { opacity: 1; transform: scale(1); }
  50% { opacity: 0.5; transform: scale(0.8); }
`;

/** Fixed on-screen boat-icon height (px), independent of zoom. Width is derived from the real hull's aspect ratio. */
const BOAT_ICON_H_PX = 88;
const BOAT_ICON_W_PX = BOAT_ICON_H_PX * (ROBOT_WIDTH_M / ROBOT_LENGTH_M);

type CameraMode = 'auto' | 'manual';

/** Manual zoom bounds, in canvas px per world meter. */
const MIN_SCALE = 0.5;
const MAX_SCALE = 200;

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

/**
 * @function TacticalMap
 * @description Full-screen canvas map showing the vessel's accumulated path,
 * swept field-of-view, obstacles, and current position/heading.
 */
export const TacticalMap: React.FC<TacticalMapProps> = ({ onClose}) => {
    const theme = useTheme();
    const telemetry = theme.palette.telemetry;
    const RADIUS = 0.5; // Fixed radius for detected obstacles in meters

    // occupancyGrid isn't read here: Map.tsx's MapComponent already renders it
    // elsewhere, and the basestation has no live publisher for it yet (see the
    // `map` group in statusTypes.ts).
    const ZedObjects = useAppSelector((state: RootState) => state.telemetry.zed.objects);
    const odom = useAppSelector((state: RootState) => state.telemetry.zed.odom.position);
    // zed.odom.orientation isn't used for the boat icon's rotation — asv.heading
    // (compass heading) is used instead, consistently with BigMap and the course trail.
    const headingASV = useAppSelector((state:RootState) => state.telemetry.asv.heading);
    const pathASV = useAppSelector((state: RootState) => state.telemetry.map.courseTrail);

    //  Colors
    const bgDefault = theme.palette.background.default;
    const headerBg = alpha(theme.palette.background.paper, 0.95);
    const borderLight = telemetry?.border.light ?? theme.palette.divider;
    const borderLighter = telemetry?.border.lighter ?? theme.palette.divider;
    const accent = telemetry?.accent ?? theme.palette.primary.light;
    const textPrimary = telemetry?.text.primary ?? theme.palette.text.primary;
    const textSecondary = telemetry?.text.secondary ?? theme.palette.text.secondary;
    const badgeBg = telemetry?.background.tertiary ?? alpha(textPrimary, 0.05);
    const legendBg = telemetry?.background.primary ?? alpha(theme.palette.background.paper, 0.85);
    const mappedAreaColor = theme.palette.info.main;
    const obstacleColor = telemetry?.status.error ?? theme.palette.error.main;

    const canvasRef = useRef<HTMLCanvasElement>(null);
    const boatImgRef = useRef<HTMLImageElement | null>(null);

    // Camera: 'auto' continuously re-fits to the trail/obstacle extent (the
    // existing lerp-toward-bbox behavior below); 'manual' is driven directly by
    // the pinch/pan/wheel handlers further down. Both read/write the same
    // cameraRef, so the render loop doesn't care which is currently steering —
    // it either lerps cameraRef toward the auto-fit target, or leaves it alone
    // for gestures to have mutated directly.
    const cameraRef = useRef({ scale: 0, centerX: 0, centerY: 0 });
    const [cameraMode, setCameraMode] = useState<CameraMode>('auto');
    const cameraModeRef = useRef(cameraMode);
    useEffect(() => { cameraModeRef.current = cameraMode; }, [cameraMode]);

    // Active pointers for pinch-to-zoom (2) vs. drag-to-pan (1).
    const pointersRef = useRef(new Map<number, { x: number; y: number }>());
    const dragStartRef = useRef<{ x: number; y: number; centerX: number; centerY: number } | null>(null);
    const pinchStartRef = useRef<{ distance: number; scale: number; midX: number; midY: number; worldX: number; worldY: number } | null>(null);

    const recenter = () => setCameraMode('auto');

    const handlePointerDown = (event: React.PointerEvent<HTMLCanvasElement>) => {
        event.currentTarget.setPointerCapture(event.pointerId);
        pointersRef.current.set(event.pointerId, { x: event.clientX, y: event.clientY });
        setCameraMode('manual');

        if (pointersRef.current.size === 2) {
            dragStartRef.current = null;
            const [a, b] = Array.from(pointersRef.current.values());
            const distance = Math.hypot(b.x - a.x, b.y - a.y);
            const midX = (a.x + b.x) / 2;
            const midY = (a.y + b.y) / 2;
            const rect = event.currentTarget.getBoundingClientRect();
            const { scale, centerX, centerY } = cameraRef.current;
            const worldX = centerX + (midX - rect.left - rect.width / 2) / scale;
            const worldY = centerY - (midY - rect.top - rect.height / 2) / scale;
            pinchStartRef.current = { distance, scale, midX, midY, worldX, worldY };
        } else if (pointersRef.current.size === 1) {
            pinchStartRef.current = null;
            dragStartRef.current = {
                x: event.clientX,
                y: event.clientY,
                centerX: cameraRef.current.centerX,
                centerY: cameraRef.current.centerY,
            };
        }
    };

    const handlePointerMove = (event: React.PointerEvent<HTMLCanvasElement>) => {
        if (!pointersRef.current.has(event.pointerId)) return;
        pointersRef.current.set(event.pointerId, { x: event.clientX, y: event.clientY });

        if (pointersRef.current.size === 2) {
            const pinchStart = pinchStartRef.current;
            if (!pinchStart || pinchStart.distance < 1) return;
            const [a, b] = Array.from(pointersRef.current.values());
            const distance = Math.hypot(b.x - a.x, b.y - a.y);
            const nextScale = clamp(pinchStart.scale * (distance / pinchStart.distance), MIN_SCALE, MAX_SCALE);
            const rect = event.currentTarget.getBoundingClientRect();
            cameraRef.current.scale = nextScale;
            cameraRef.current.centerX = pinchStart.worldX - (pinchStart.midX - rect.left - rect.width / 2) / nextScale;
            cameraRef.current.centerY = pinchStart.worldY + (pinchStart.midY - rect.top - rect.height / 2) / nextScale;
            return;
        }

        const dragStart = dragStartRef.current;
        if (!dragStart) return;
        const dxPx = event.clientX - dragStart.x;
        const dyPx = event.clientY - dragStart.y;
        const { scale } = cameraRef.current;
        cameraRef.current.centerX = dragStart.centerX - dxPx / scale;
        cameraRef.current.centerY = dragStart.centerY + dyPx / scale;
    };

    const endPointer = (event: React.PointerEvent<HTMLCanvasElement>) => {
        pointersRef.current.delete(event.pointerId);
        if (event.currentTarget.hasPointerCapture(event.pointerId)) {
            event.currentTarget.releasePointerCapture(event.pointerId);
        }
        pinchStartRef.current = null;
        if (pointersRef.current.size === 1) {
            const [[, pos]] = Array.from(pointersRef.current.entries());
            dragStartRef.current = {
                x: pos.x,
                y: pos.y,
                centerX: cameraRef.current.centerX,
                centerY: cameraRef.current.centerY,
            };
        } else {
            dragStartRef.current = null;
        }
    };

    const handleWheel = (event: React.WheelEvent<HTMLCanvasElement>) => {
        event.preventDefault();
        setCameraMode('manual');
        const rect = event.currentTarget.getBoundingClientRect();
        const { scale, centerX, centerY } = cameraRef.current;
        const px = event.clientX - rect.left - rect.width / 2;
        const py = event.clientY - rect.top - rect.height / 2;
        const worldX = centerX + px / scale;
        const worldY = centerY - py / scale;
        const nextScale = clamp(scale * Math.exp(-event.deltaY * 0.001), MIN_SCALE, MAX_SCALE);
        cameraRef.current.scale = nextScale;
        cameraRef.current.centerX = worldX - px / nextScale;
        cameraRef.current.centerY = worldY + py / nextScale;
    };

    // Mirrored into refs so the rAF render loop below (started once on mount)
    // always reads live Redux state and the live theme instead of the values
    // captured in its closure at first render.
    const zedObjectsRef = useRef(ZedObjects);
    const odomRef = useRef(odom);
    const headingRef = useRef(headingASV);
    const pathRef = useRef(pathASV);
    const themeRef = useRef(theme);
    useEffect(() => {
        zedObjectsRef.current = ZedObjects;
        odomRef.current = odom;
        headingRef.current = headingASV;
        pathRef.current = pathASV;
        themeRef.current = theme;
    }, [ZedObjects, odom, headingASV, pathASV, theme]);

    useEffect(() => {
        const img = new Image();
        img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(catamaranSvgStr);
        img.onload = () => { boatImgRef.current = img; };
    }, []);

    // Render loop. This is very similar to BigMap's render loop — both read live
    // state via refs and share the same lerp/teleport-snap approach — but this
    // one uses a bbox-fit camera (pans+zooms to keep the whole trail/obstacle
    // extent in frame) instead of BigMap's deadzone-pan/max-zoom camera, so
    // they aren't easily unified into one hook.
    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        let animationFrameId: number;

        let smoothX = odomRef.current.x;
        let smoothY = odomRef.current.y;
        let smoothHeading = headingRef.current;

        const render = () => {
            const ZedObjects = zedObjectsRef.current;
            const odom = odomRef.current;
            const headingASV = headingRef.current;
            const pathASV = pathRef.current;
            const objectColors = themeRef.current.palette.telemetry?.objects;

            const rect = canvas.parentElement?.getBoundingClientRect();
            if (rect && (canvas.width !== rect.width || canvas.height !== rect.height)) {
                canvas.width = rect.width;
                canvas.height = rect.height;
            }

            if (canvas.width === 0 || canvas.height === 0) {
                animationFrameId = requestAnimationFrame(render);
                return;
            }

            const targetX = odom.x;
            const targetY = odom.y;
            const targetH = headingASV;

            // Detect teleport (e.g. initial connection) and snap instead of lerping
            if (Math.hypot(targetX - smoothX, targetY - smoothY) > 50) {
                smoothX = targetX;
                smoothY = targetY;
                smoothHeading = targetH;
            } else {
                // Fast lerp to track the live Redux state perfectly
                smoothX += (targetX - smoothX) * 0.3;
                smoothY += (targetY - smoothY) * 0.3;

                let diff = targetH - smoothHeading;
                while (diff < -180) diff += 360;
                while (diff > 180) diff -= 360;
                smoothHeading += diff * 0.3;
            }

            const currentX = smoothX;
            const currentY = smoothY;
            const heading = smoothHeading;

            if (Number.isNaN(currentX) || Number.isNaN(currentY) || Number.isNaN(heading)) {
                animationFrameId = requestAnimationFrame(render);
                return;
            }

            ctx.clearRect(0, 0, canvas.width, canvas.height);

            let minX = currentX;
            let maxX = currentX;
            let minY = currentY;
            let maxY = currentY;

            pathASV.forEach((pt: CourseTrailPoint) => {
                minX = Math.min(minX, pt.x - FOV_RADIUS_M);
                maxX = Math.max(maxX, pt.x + FOV_RADIUS_M);
                minY = Math.min(minY, pt.y - FOV_RADIUS_M);
                maxY = Math.max(maxY, pt.y + FOV_RADIUS_M);
            });
            ZedObjects.forEach((obs: DetectedObject) => {
                minX = Math.min(minX, obs.position.x - RADIUS);
                maxX = Math.max(maxX, obs.position.x + RADIUS);
                minY = Math.min(minY, obs.position.y - RADIUS);
                maxY = Math.max(maxY, obs.position.y + RADIUS);
            });

            // Lazy scaling: allow moving inside a minimum 50x50m viewport.
            // If the bounding box is smaller than 50m, pad it from its center,
            // so the camera only pans/scales once the boat exceeds the 50m box.
            const bbW = maxX - minX;
            const bbH = maxY - minY;
            if (bbW < 50) {
                const cx = (minX + maxX) / 2;
                minX = cx - 25;
                maxX = cx + 25;
            }
            if (bbH < 50) {
                const cy = (minY + maxY) / 2;
                minY = cy - 25;
                maxY = cy + 25;
            }

            const pad = 10;
            minX -= pad; maxX += pad;
            minY -= pad; maxY += pad;

            const mapWidth = maxX - minX;
            const mapHeight = maxY - minY;
            const targetScale = Math.min(canvas.width / mapWidth, canvas.height / mapHeight);
            const targetCX = (minX + maxX) / 2;
            const targetCY = (minY + maxY) / 2;

            // 'auto' continuously lerps toward the bbox-fit target computed above.
            // 'manual' leaves the camera alone — pointer/wheel handlers already
            // wrote directly into cameraRef in response to the user's gesture.
            if (cameraModeRef.current === 'auto') {
                const camera = cameraRef.current;
                if (camera.scale === 0) {
                    camera.scale = targetScale;
                    camera.centerX = targetCX;
                    camera.centerY = targetCY;
                } else {
                    camera.scale += (targetScale - camera.scale) * 0.1;
                    camera.centerX += (targetCX - camera.centerX) * 0.1;
                    camera.centerY += (targetCY - camera.centerY) * 0.1;
                }
            }

            const scale = cameraRef.current.scale || 1;
            const centerX = cameraRef.current.centerX;
            const centerY = cameraRef.current.centerY;

            ctx.save();
            ctx.translate(canvas.width / 2, canvas.height / 2);
            ctx.scale(scale, -scale);
            ctx.translate(-centerX, -centerY);

            // Determine visible grid bounds from actual screen size so the grid fills the screen.
            const viewWidthMeters = canvas.width / scale;
            const viewHeightMeters = canvas.height / scale;
            const visibleMinX = centerX - viewWidthMeters / 2;
            const visibleMaxX = centerX + viewWidthMeters / 2;
            const visibleMinY = centerY - viewHeightMeters / 2;
            const visibleMaxY = centerY + viewHeightMeters / 2;

            // Dynamic grid size to prevent millions of lines when zoomed out far.
            let gridSize = 10;
            while (viewWidthMeters / gridSize > 150 || viewHeightMeters / gridSize > 150) {
                gridSize *= 10;
            }

            // Grid
            ctx.strokeStyle = 'rgba(255, 255, 255, 0.05)';
            ctx.lineWidth = Math.max(1 / scale, 0.5); // At least visible physical thickness
            const startGridX = Math.floor(visibleMinX / gridSize) * gridSize;
            const startGridY = Math.floor(visibleMinY / gridSize) * gridSize;

            ctx.beginPath();
            for (let x = startGridX; x <= visibleMaxX; x += gridSize) {
                ctx.moveTo(x, visibleMinY);
                ctx.lineTo(x, visibleMaxY);
            }
            for (let y = startGridY; y <= visibleMaxY; y += gridSize) {
                ctx.moveTo(visibleMinX, y);
                ctx.lineTo(visibleMaxX, y);
            }
            ctx.stroke();

            // Mapped area: the exact area swept by the FOV cone over time, as a single-path wedge fill.
            ctx.fillStyle = 'rgba(59, 130, 246, 0.15)';
            ctx.beginPath();
            pathASV.forEach((pt: CourseTrailPoint) => {
                const sweptConeAngle = Math.PI / 2 - (pt.heading * Math.PI) / 180;
                ctx.moveTo(pt.x, pt.y);
                ctx.arc(pt.x, pt.y, FOV_RADIUS_M, sweptConeAngle - FOV_HALF_ANGLE_RAD, sweptConeAngle + FOV_HALF_ANGLE_RAD);
                ctx.lineTo(pt.x, pt.y);
            });
            // Also draw the wedge at the current smooth position so it connects to the boat.
            const currentConeAngle = Math.PI / 2 - (smoothHeading * Math.PI) / 180;
            ctx.moveTo(smoothX, smoothY);
            ctx.arc(smoothX, smoothY, FOV_RADIUS_M, currentConeAngle - FOV_HALF_ANGLE_RAD, currentConeAngle + FOV_HALF_ANGLE_RAD);
            ctx.lineTo(smoothX, smoothY);
            ctx.fill();

            // Mapped obstacles, colored per label (same mapping as BigMap).
            ctx.lineWidth = 1 / scale;
            ZedObjects.forEach((obs: DetectedObject) => {
                const colorKey = OBJECT_COLOR_KEYS[obs.label] ?? DEFAULT_OBJECT_COLOR_KEY;
                const stroke = objectColors?.[colorKey as keyof typeof objectColors] ?? '#ef4444';
                ctx.fillStyle = alpha(stroke, 0.2);
                ctx.strokeStyle = stroke;
                ctx.beginPath();
                // Fixed 8px diameter visually regardless of zoom scale.
                ctx.arc(obs.position.x, obs.position.y, 4 / scale, 0, Math.PI * 2);
                ctx.fill();
                ctx.stroke();
            });

            // Vision cone
            ctx.save();
            ctx.translate(currentX, currentY);

            // In this coordinate system, +X is Right, +Y is Up.
            // Standard maritime heading is 0 = North (Up), 90 = East (Right).
            // Angle 0 in Canvas is +X (Right); Math.PI/2 is +Y (Up).
            const coneAngle = Math.PI / 2 - (heading * Math.PI) / 180;

            ctx.fillStyle = 'rgba(16, 185, 129, 0.1)';
            ctx.beginPath();
            ctx.moveTo(0, 0);
            ctx.arc(0, 0, FOV_RADIUS_M, coneAngle - FOV_HALF_ANGLE_RAD, coneAngle + FOV_HALF_ANGLE_RAD);
            ctx.lineTo(0, 0);
            ctx.fill();
            ctx.restore();

            // Boat icon (always rendered at a fixed screen size — see BOAT_ICON_*_PX
            // above, matching the real hull's aspect ratio — aligned with heading)
            if (boatImgRef.current) {
                ctx.save();
                ctx.translate(currentX, currentY);
                // Revert camera scale back to 1:1 pixels for the icon (X right, Y down).
                ctx.scale(1 / scale, -1 / scale);
                // Standard canvas rotation is clockwise; heading is clockwise.
                ctx.rotate((heading * Math.PI) / 180);
                ctx.drawImage(boatImgRef.current, -BOAT_ICON_W_PX / 2, -BOAT_ICON_H_PX / 2, BOAT_ICON_W_PX, BOAT_ICON_H_PX);
                ctx.restore();
            }

            ctx.restore();

            animationFrameId = requestAnimationFrame(render);
        };

        render();

        return () => {
            cancelAnimationFrame(animationFrameId);
        };
        // Live state comes from the refs mirrored above — the render loop only needs to (re)start on mount.
    }, []);

    return (
        <Box
            data-testid="tactical-map"
            sx={{
                position: 'absolute',
                top: 0,
                left: 0,
                right: 0,
                bottom: 0,
                zIndex: 50,
                backgroundColor: bgDefault,
                display: 'flex',
                flexDirection: 'column',
                animation: `${slideUpExpand} 0.4s cubic-bezier(0.16, 1, 0.3, 1) forwards`,
                transformOrigin: '5% 95%',
                fontFamily: 'monospace',
            }}
        >
            {/* Header bar */}
            <Box
                sx={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    padding: '16px 24px',
                    backgroundColor: headerBg,
                    borderBottom: `1px solid ${borderLight}`,
                    boxShadow: '0 4px 15px rgba(0, 0, 0, 0.5)',
                }}
            >
                <Box sx={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <Typography
                        component="h1"
                        sx={{
                            fontSize: '18px',
                            fontWeight: 'bold',
                            color: textPrimary,
                            textTransform: 'uppercase',
                            letterSpacing: '2px',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '8px',
                            margin: 0,
                        }}
                    >
                        <Box
                            component="span"
                            sx={{
                                width: '12px',
                                height: '12px',
                                backgroundColor: accent,
                                borderRadius: '50%',
                                animation: `${pulseDot} 2s infinite`,
                            }}
                        />
                        Tactical Map (2D)
                    </Typography>
                    <Box
                        component="span"
                        sx={{
                            padding: '4px 8px',
                            fontSize: '11px',
                            color: textSecondary,
                            backgroundColor: badgeBg,
                            borderRadius: '4px',
                            border: `1px solid ${borderLighter}`,
                        }}
                    >
                        LOCAL SLAM COORDINATES
                    </Box>
                </Box>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <Button
                        onClick={recenter}
                        disabled={cameraMode === 'auto'}
                        sx={{
                            color: textSecondary,
                            backgroundColor: badgeBg,
                            border: `1px solid ${borderLight}`,
                            padding: '8px 16px',
                            borderRadius: '6px',
                            fontWeight: 'bold',
                            '&:hover': {
                                backgroundColor: accent,
                                color: bgDefault,
                            },
                            '&.Mui-disabled': {
                                color: textSecondary,
                                opacity: 0.4,
                            },
                        }}
                    >
                        Recenter
                    </Button>
                    <Button
                        onClick={onClose}
                        sx={{
                            color: textSecondary,
                            backgroundColor: badgeBg,
                            border: `1px solid ${borderLight}`,
                            padding: '8px 16px',
                            borderRadius: '6px',
                            fontWeight: 'bold',
                            '&:hover': {
                                backgroundColor: accent,
                                color: bgDefault,
                            },
                        }}
                    >
                        Close Map
                    </Button>
                </Box>
            </Box>

            {/* 2D canvas */}
            <Box sx={{ flex: 1, position: 'relative', cursor: 'grab', overflow: 'hidden' }}>
                <canvas
                    ref={canvasRef}
                    onPointerDown={handlePointerDown}
                    onPointerMove={handlePointerMove}
                    onPointerUp={endPointer}
                    onPointerCancel={endPointer}
                    onPointerLeave={endPointer}
                    onWheel={handleWheel}
                    style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', display: 'block', touchAction: 'none' }}
                />

                {/* Legend */}
                <Box
                    sx={{
                        position: 'absolute',
                        bottom: '24px',
                        left: '24px',
                        backgroundColor: legendBg,
                        padding: '12px 16px',
                        borderRadius: '8px',
                        border: `1px solid ${borderLight}`,
                        fontSize: '11px',
                        color: textPrimary,
                        pointerEvents: 'none',
                        backdropFilter: 'blur(10px)',
                        boxShadow: '0 4px 15px rgba(0,0,0,0.5)',
                    }}
                >
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: '8px', mb: '8px' }}>
                        <Box sx={{ width: '12px', height: '12px', border: `1px solid ${accent}`, backgroundColor: alpha(accent, 0.2) }} />
                        <Typography component="span" sx={{ fontSize: 'inherit' }}>ASV Position</Typography>
                    </Box>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: '8px', mb: '8px' }}>
                        <Box sx={{ width: '12px', height: '12px', backgroundColor: alpha(mappedAreaColor, 0.2), border: `1px solid ${alpha(mappedAreaColor, 0.5)}` }} />
                        <Typography component="span" sx={{ fontSize: 'inherit' }}>Mapped Area</Typography>
                    </Box>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <Box sx={{ width: '12px', height: '12px', backgroundColor: alpha(obstacleColor, 0.2), border: `1px solid ${obstacleColor}`, borderRadius: '50%' }} />
                        <Typography component="span" sx={{ fontSize: 'inherit' }}>Mapped Obstacle</Typography>
                    </Box>
                </Box>
            </Box>
        </Box>
    );
};

export default TacticalMap;
