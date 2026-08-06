/**
 * @file TacticalMap.tsx
 * @description Full-screen canvas "tactical map": the ASV's accumulated path
 * history, swept field-of-view, detected obstacles, and a heading-rotated
 * boat icon, drawn in a local (meter-based, not lat/lon) Cartesian frame with
 * smooth camera pan/zoom.
 *
 * @remarks
 * - Presentational component: all tracking state (path history, obstacles,
 *   current position, heading) is supplied as refs so the render loop can
 *   read it every animation frame without triggering React re-renders. The
 *   Redux-connected wrapper {@link TacticalMapPanel} owns and updates those
 *   refs from live telemetry.
 * - The canvas render loop runs on `requestAnimationFrame`, independent of
 *   React's render cycle, with exponential smoothing for position/heading
 *   and for camera pan/zoom, plus a "teleport" snap heuristic so an initial
 *   GPS fix (or a large jump) doesn't glide in from the wrong place.
 * - All colors come from the active MUI theme (telemetry palette group),
 *   with graceful fallbacks to the core MUI palette when it isn't defined.
 *
 * @author Carson Fujita
 * @license MIT
 */
import React, { useEffect, useRef } from 'react';
import { Box, Typography, Button } from '@mui/material';
import { alpha, useTheme } from '@mui/material/styles';
import { keyframes } from '@emotion/react';

/** A single recorded path point, in local map meters, with heading at that point. */
export interface TacticalMapPathPoint {
    x: number;
    y: number;
    /** Heading in degrees (0 = North, clockwise) at the time this point was recorded. */
    h: number;
}

/** An obstacle plotted on the tactical map, in local map meters. */
export interface TacticalMapObstacle {
    /** Stable identity for the obstacle. */
    id: string;
    x: number;
    y: number;
    /** Physical radius in meters (not currently used for the on-screen marker size). */
    r: number;
}

/** Properties for the {@link TacticalMap} component. */
export interface TacticalMapProps {
    /** Invoked when the user dismisses the map. */
    onClose: () => void;
    /** Accumulated vessel path, in local map meters. Read every animation frame. */
    pathHistory: React.RefObject<TacticalMapPathPoint[]>;
    /** Accumulated obstacles, in local map meters. Read every animation frame. */
    obstacles: React.RefObject<TacticalMapObstacle[]>;
    /** Current vessel position, in local map meters. Read every animation frame. */
    currentPos: React.RefObject<{ x: number; y: number }>;
    /** Current vessel heading in degrees (0 = North, clockwise). Read every animation frame. */
    headingRef: React.RefObject<number>;
}

// SVG catamaran data URL for drawing the boat icon on the canvas.
const catamaranSvgStr = `
<svg xmlns="http://www.w3.org/2000/svg" width="70" height="95" viewBox="0 0 80 110">
  <path d="M 16 5 C 10 5, 8 20, 8 45 C 8 70, 8 85, 12 90 C 14 93, 18 93, 20 90 C 22 85, 22 75, 22 65 L 22 25 C 22 15, 20 5, 16 5 Z" fill="#00435C" stroke="#B980F1" strokeWidth="1" />
  <path d="M 64 5 C 70 5, 72 20, 72 45 C 72 70, 72 85, 68 90 C 66 93, 62 93, 60 90 C 58 85, 58 75, 58 65 L 58 25 C 58 15, 60 5, 64 5 Z" fill="#00435C" stroke="#B980F1" strokeWidth="1" />
  <rect x="21" y="20" width="38" height="4" fill="#080721" stroke="#D9D9D9" strokeWidth="1" />
  <rect x="21" y="70" width="38" height="4" fill="#080721" stroke="#D9D9D9" strokeWidth="1" />
  <path d="M 26 24 C 23 35, 23 60, 26 70" fill="none" stroke="#D9D9D9" strokeWidth="1.5" />
  <path d="M 54 24 C 57 35, 57 60, 54 70" fill="none" stroke="#D9D9D9" strokeWidth="1.5" />
  <path d="M 28 32 C 26 45, 26 50, 28 62 L 52 62 C 54 50, 54 45, 52 32 Z" fill="#080721" stroke="#D9D9D9" strokeWidth="1.5" />
  <rect x="33" y="38" width="14" height="18" rx="2" fill="none" stroke="#B980F1" strokeWidth="1" />
  <circle cx="35" cy="40" r="1" fill="#D8FA07" />
  <circle cx="45" cy="40" r="1" fill="#D8FA07" />
  <circle cx="35" cy="54" r="1" fill="#D8FA07" />
  <circle cx="45" cy="54" r="1" fill="#D8FA07" />
</svg>
`;

const slideUpExpand = keyframes`
  0% { transform: scale(0.15); opacity: 0; border-radius: 20px; }
  100% { transform: scale(1); opacity: 1; border-radius: 0px; }
`;

const pulseDot = keyframes`
  0%, 100% { opacity: 1; transform: scale(1); }
  50% { opacity: 0.5; transform: scale(0.8); }
`;

/**
 * @function TacticalMap
 * @description Full-screen canvas map showing the vessel's accumulated path,
 * swept field-of-view, obstacles, and current position/heading.
 */
export const TacticalMap: React.FC<TacticalMapProps> = ({ onClose, pathHistory, obstacles, currentPos, headingRef }) => {
    const theme = useTheme();
    const telemetry = theme.palette.telemetry;

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

    useEffect(() => {
        const img = new Image();
        img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(catamaranSvgStr);
        img.onload = () => { boatImgRef.current = img; };
    }, []);

    // Render loop
    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        let animationFrameId: number;

        let smoothX = currentPos.current.x;
        let smoothY = currentPos.current.y;
        let smoothHeading = headingRef.current;

        let smoothScale = 0;
        let smoothCX = 0;
        let smoothCY = 0;

        const render = () => {
            const rect = canvas.parentElement?.getBoundingClientRect();
            if (rect && (canvas.width !== rect.width || canvas.height !== rect.height)) {
                canvas.width = rect.width;
                canvas.height = rect.height;
            }

            if (canvas.width === 0 || canvas.height === 0) {
                animationFrameId = requestAnimationFrame(render);
                return;
            }

            const targetX = currentPos.current.x;
            const targetY = currentPos.current.y;
            const targetH = headingRef.current;

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

            pathHistory.current.forEach(pt => {
                minX = Math.min(minX, pt.x - 40); // 40m cone radius padding
                maxX = Math.max(maxX, pt.x + 40);
                minY = Math.min(minY, pt.y - 40);
                maxY = Math.max(maxY, pt.y + 40);
            });
            obstacles.current.forEach(obs => {
                minX = Math.min(minX, obs.x - obs.r);
                maxX = Math.max(maxX, obs.x + obs.r);
                minY = Math.min(minY, obs.y - obs.r);
                maxY = Math.max(maxY, obs.y + obs.r);
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

            if (smoothScale === 0) {
                smoothScale = targetScale;
                smoothCX = targetCX;
                smoothCY = targetCY;
            } else {
                smoothScale += (targetScale - smoothScale) * 0.1;
                smoothCX += (targetCX - smoothCX) * 0.1;
                smoothCY += (targetCY - smoothCY) * 0.1;
            }

            const scale = smoothScale;
            const centerX = smoothCX;
            const centerY = smoothCY;

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
            pathHistory.current.forEach(pt => {
                const sweptConeAngle = Math.PI / 2 - (pt.h * Math.PI) / 180;
                ctx.moveTo(pt.x, pt.y);
                ctx.arc(pt.x, pt.y, 40, sweptConeAngle - Math.PI / 6, sweptConeAngle + Math.PI / 6);
            });
            // Also draw the wedge at the current smooth position so it connects to the boat.
            const currentConeAngle = Math.PI / 2 - (smoothHeading * Math.PI) / 180;
            ctx.moveTo(smoothX, smoothY);
            ctx.arc(smoothX, smoothY, 40, currentConeAngle - Math.PI / 6, currentConeAngle + Math.PI / 6);
            ctx.fill();

            // Mapped obstacles (uniform circles)
            ctx.fillStyle = 'rgba(239, 68, 68, 0.2)';
            ctx.strokeStyle = '#ef4444';
            ctx.lineWidth = 1 / scale;
            obstacles.current.forEach(obs => {
                ctx.beginPath();
                // Fixed 8px diameter visually regardless of zoom scale.
                ctx.arc(obs.x, obs.y, 4 / scale, 0, Math.PI * 2);
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
            ctx.arc(0, 0, 40, coneAngle - Math.PI / 6, coneAngle + Math.PI / 6);
            ctx.lineTo(0, 0);
            ctx.fill();
            ctx.restore();

            // Boat icon (always rendered at a fixed screen size, aligned with heading)
            if (boatImgRef.current) {
                ctx.save();
                ctx.translate(currentX, currentY);
                // Revert camera scale back to 1:1 pixels for the icon (X right, Y down).
                ctx.scale(1 / scale, -1 / scale);
                // Standard canvas rotation is clockwise; heading is clockwise.
                ctx.rotate((heading * Math.PI) / 180);
                const boatW = 64;
                const boatH = 88;
                ctx.drawImage(boatImgRef.current, -boatW / 2, -boatH / 2, boatW, boatH);
                ctx.restore();
            }

            ctx.restore();

            animationFrameId = requestAnimationFrame(render);
        };

        render();

        return () => {
            cancelAnimationFrame(animationFrameId);
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
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

            {/* 2D canvas */}
            <Box sx={{ flex: 1, position: 'relative', cursor: 'crosshair', overflow: 'hidden' }}>
                <canvas ref={canvasRef} style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', display: 'block' }} />

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
