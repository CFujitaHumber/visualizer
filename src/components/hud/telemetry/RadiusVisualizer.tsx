/**
 * @file RadiusVisualizer.tsx
 * @description Circular radar/minimap HUD showing nearby obstacles around the ASV.
 *
 * @remarks
 * - Presentational component: obstacle positions are **boat-relative offsets in
 *   meters** (x = east, y = north); the Redux-connected wrapper
 *   {@link RadiusVisualizerPanel} feeds it ZED detections.
 * - The display is heading-up: the environment is rotated by the vessel heading
 *   so the boat marker always points straight up.
 * - Obstacles glide to their new positions with springs, and a looping sonar
 *   ping sweeps outward — both driven by @react-spring/web.
 * - All colors come from the active MUI theme (telemetry/status palette groups),
 *   with graceful fallbacks when a group is not defined by the theme.
 *
 * @author Carson Fujita
 * @license MIT
 *
 * @example
 * <RadiusVisualizer
 *   heading={heading}
 *   latitude={lat}
 *   longitude={lon}
 *   obstacles={[{ id: 'buoy-1', x: 12.5, y: -3.2 }]}
 * />
 */
import React from 'react';
import { Box, Typography, useTheme } from '@mui/material';
import { alpha } from '@mui/material/styles';
import { useSpring, animated } from '@react-spring/web';

/** A single obstacle plotted on the radar, positioned relative to the vessel in meters. */
export interface RadarObstacle {
    /** Stable identity — keys the obstacle's position spring across updates. */
    id: string | number;
    /** Offset east of the vessel in meters. */
    x: number;
    /** Offset north of the vessel in meters. */
    y: number;
}

/** Properties for the {@link RadiusVisualizer} component. */
export interface RadiusVisualizerProps {
    /** Vessel heading in degrees (0° = North, clockwise). */
    heading: number;
    /** Vessel latitude for the readout beneath the radar. */
    latitude?: number;
    /** Vessel longitude for the readout beneath the radar. */
    longitude?: number;
    /** Obstacles relative to the vessel, in meters. */
    obstacles: RadarObstacle[];
    /** Radar range in meters (obstacles beyond it are hidden). Defaults to 40. */
    rangeM?: number;
    /** Diameter of the radar circle in pixels. Defaults to 120. */
    size?: number;
    /** Panel title. Defaults to "MINIMAP". */
    title?: string;
    /** Optional click handler for the whole panel (e.g. to open a full map). */
    onClick?: () => void;
}

const OBSTACLE_SPRING = { tension: 170, friction: 26 };
const PING_DURATION_MS = 2000;

/**
 * Rotates a boat-relative (east, north) offset into heading-up display space.
 * With the vessel facing `heading`, whatever is dead ahead ends up pointing up.
 */
const rotateHeadingUp = (x: number, y: number, headingDeg: number) => {
    const rad = (headingDeg * Math.PI) / 180;
    return {
        x: x * Math.cos(rad) - y * Math.sin(rad),
        y: x * Math.sin(rad) + y * Math.cos(rad),
    };
};

/** One radar dot; its own spring glides it between positions. Keyed by obstacle id. */
const ObstacleDot: React.FC<{ cx: number; cy: number; color: string }> = ({ cx, cy, color }) => {
    const spring = useSpring({ cx, cy, config: OBSTACLE_SPRING });
    return (
        <animated.circle
            cx={spring.cx}
            cy={spring.cy}
            r={3}
            fill={color}
            style={{ filter: `drop-shadow(0 0 3px ${color})` }}
        />
    );
};

/** Expanding, fading sonar ping — loops forever. */
const SonarPing: React.FC<{ center: number; maxR: number; color: string }> = ({ center, maxR, color }) => {
    const spring = useSpring({
        from: { r: 0, opacity: 0.55 },
        to: { r: maxR, opacity: 0 },
        loop: true,
        config: { duration: PING_DURATION_MS },
    });
    return (
        <animated.circle
            cx={center}
            cy={center}
            r={spring.r}
            opacity={spring.opacity}
            fill="none"
            stroke={color}
            strokeWidth={2}
            pointerEvents="none"
        />
    );
};

/**
 * @function RadiusVisualizer
 * @description Heading-up radar showing obstacles within range of the vessel,
 * with a sonar ping animation and a latitude/longitude readout.
 */
export const RadiusVisualizer: React.FC<RadiusVisualizerProps> = ({
    heading,
    latitude,
    longitude,
    obstacles,
    rangeM = 40,
    size = 120,
    title = 'MINIMAP',
    onClick,
}) => {
    const theme = useTheme();
    const telemetry = theme.palette.telemetry;
    const compass = theme.palette.compass;

    const ringColor = telemetry?.status.online ?? theme.palette.success.main;
    const pingColor = telemetry?.accent ?? theme.palette.primary.light;
    const obstacleColor = telemetry?.status.error ?? theme.palette.error.main;
    const boatColor = telemetry?.accent ?? theme.palette.primary.light;
    const textPrimary = telemetry?.text.primary ?? theme.palette.text.primary;
    const textSecondary = telemetry?.text.secondary ?? theme.palette.text.secondary;
    const borderLight = telemetry?.border.light ?? theme.palette.divider;

    const center = size / 2;
    const scalePx = center / rangeM; // px per meter

    // Instance-unique ids so multiple radars on one page don't cross-reference defs.
    const uid = React.useId();
    const bgId = `radius-bg${uid}`;
    const clipId = `radius-clip${uid}`;

    // Filter to range, then rotate into heading-up display space.
    const visible = React.useMemo(
        () =>
            obstacles
                .filter((obs) => Math.hypot(obs.x, obs.y) < rangeM)
                .map((obs) => {
                    const rotated = rotateHeadingUp(obs.x, obs.y, heading);
                    return {
                        id: obs.id,
                        // SVG y grows downward; our y grows northward/up.
                        cx: center + rotated.x * scalePx,
                        cy: center - rotated.y * scalePx,
                    };
                }),
        [obstacles, heading, rangeM, center, scalePx],
    );

    // Cardinal markers rotate opposite the heading so they stay geographically true.
    const cardinals = React.useMemo(() => {
        const entries = [
            { label: 'N', deg: 0, color: compass?.north },
            { label: 'E', deg: 90, color: compass?.east },
            { label: 'S', deg: 180, color: compass?.south },
            { label: 'W', deg: 270, color: compass?.west },
        ];
        return entries.map(({ label, deg, color }) => {
            const rad = ((deg - heading - 90) * Math.PI) / 180;
            const r = center - 8;
            return {
                label,
                x: center + Math.cos(rad) * r,
                y: center + Math.sin(rad) * r,
                color: color ?? textSecondary,
            };
        });
    }, [heading, center, compass, textSecondary]);

    return (
        <Box
            data-testid="radius-visualizer"
            onClick={onClick}
            sx={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                p: '12px 15px',
                backgroundColor: telemetry?.background.primary,
                border: `1px solid ${borderLight}`,
                borderRadius: 2,
                backdropFilter: 'blur(10px)',
                width: size + 60,
                color: textPrimary,
                fontFamily: 'monospace',
                boxShadow: '0 4px 15px rgba(0, 0, 0, 0.5)',
                cursor: onClick ? 'pointer' : 'default',
                transition: 'border-color 0.2s',
                '&:hover': onClick ? { borderColor: theme.palette.primary.light } : undefined,
            }}
        >
            <Typography
                variant="caption"
                sx={{
                    fontWeight: 700,
                    fontSize: '11px',
                    mb: 1,
                    textTransform: 'uppercase',
                    letterSpacing: '1px',
                    color: textSecondary,
                }}
            >
                {title}
            </Typography>

            {/* Radar circle */}
            <Box
                component="svg"
                viewBox={`0 0 ${size} ${size}`}
                sx={{ width: size, height: size, display: 'block' }}
            >
                <defs>
                    <radialGradient id={bgId}>
                        <stop offset="0%" stopColor={alpha(pingColor, 0.05)} />
                        <stop offset="100%" stopColor="rgba(0,0,0,0.7)" />
                    </radialGradient>
                    <clipPath id={clipId}>
                        <circle cx={center} cy={center} r={center - 1} />
                    </clipPath>
                </defs>

                <circle
                    cx={center}
                    cy={center}
                    r={center - 1}
                    fill={`url(#${bgId})`}
                    stroke={alpha(ringColor, 0.3)}
                    strokeWidth={1}
                />

                <g clipPath={`url(#${clipId})`}>
                    {/* Radar grid: crosshair + dashed range rings at ½ and ¾ range */}
                    <line x1={center} y1={0} x2={center} y2={size} stroke={alpha(ringColor, 0.15)} strokeWidth={1} />
                    <line x1={0} y1={center} x2={size} y2={center} stroke={alpha(ringColor, 0.15)} strokeWidth={1} />
                    <circle cx={center} cy={center} r={center * 0.7} fill="none" stroke={alpha(ringColor, 0.1)} strokeWidth={1} strokeDasharray="3 3" />
                    <circle cx={center} cy={center} r={center * 0.4} fill="none" stroke={alpha(ringColor, 0.15)} strokeWidth={1} strokeDasharray="3 3" />

                    {/* Sonar ping */}
                    <SonarPing center={center} maxR={center} color={pingColor} />

                    {/* Obstacles (heading-up environment rotation) */}
                    {visible.map((obs) => (
                        <ObstacleDot key={obs.id} cx={obs.cx} cy={obs.cy} color={obstacleColor} />
                    ))}

                    {/* Cardinal markers, geographically true */}
                    {cardinals.map(({ label, x, y, color }) => (
                        <text
                            key={label}
                            x={x}
                            y={y}
                            fill={color}
                            fontSize={7}
                            fontWeight={700}
                            textAnchor="middle"
                            dominantBaseline="central"
                            pointerEvents="none"
                        >
                            {label}
                        </text>
                    ))}

                    {/* Center boat indicator pointing straight up */}
                    <g transform={`translate(${center - 5}, ${center - 9})`}>
                        <path
                            d="M5 0 L10 5 L8.4 15 L1.6 15 L0 5 Z"
                            fill={boatColor}
                            stroke={textPrimary}
                            strokeWidth={1}
                        />
                    </g>
                </g>
            </Box>

            <Box sx={{ mt: 1, textAlign: 'center', lineHeight: 1.4 }}>
                <Typography variant="caption" component="div" sx={{ fontSize: '10px', color: textSecondary }}>
                    LAT: {latitude !== undefined ? latitude.toFixed(6) : 'N/A'}
                </Typography>
                <Typography variant="caption" component="div" sx={{ fontSize: '10px', color: textSecondary }}>
                    LON: {longitude !== undefined ? longitude.toFixed(6) : 'N/A'}
                </Typography>
            </Box>
        </Box>
    );
};

export default RadiusVisualizer;
