/**
 * @file ShipRudderVisualizer.tsx
 * @description Propulsion HUD: port/starboard thruster power bars flanking a
 * top-down catamaran with animated twin rudders, plus a rudder position track.
 *
 * @remarks
 * - Presentational component; the Redux-connected wrapper
 *   {@link ShipRudderVisualizerPanel} feeds it motor power and rudder angle.
 * - Power-bar heights, bar colors and rudder rotation are driven by
 *   @react-spring/web springs.
 * - Thruster power is SIGNED: the bars fill from a centre detent, upward for
 *   ahead and downward for astern, so reverse is distinguishable from idle.
 * - The rudder angle is clamped to ±`maxRudderDeg` (30° by default).
 * - Bar colors reuse the shared {@link getPowerColor} thresholds, applied to the
 *   power's MAGNITUDE, so this panel matches {@link PowerRudderPanel}; chrome
 *   colors come from the telemetry palette with graceful fallbacks.
 *
 * @author Carson Fujita
 * @license MIT
 *
 * @example
 * <ShipRudderVisualizer portPower={45} stbdPower={-52} rudderAngle={-12} />
 */
import React from 'react';
import { Box, Typography, Tooltip, useTheme } from '@mui/material';
import { alpha } from '@mui/material/styles';
import { useSpring, animated } from '@react-spring/web';
import { getPowerColor } from './powerColor';

/** Properties for the {@link ShipRudderVisualizer} component. */
export interface ShipRudderVisualizerProps {
    /** Port (left) thruster power, -100–100% (negative = astern). */
    portPower: number;
    /** Starboard (right) thruster power, -100–100% (negative = astern). */
    stbdPower: number;
    /** Rudder angle in degrees; positive = starboard. Clamped to ±maxRudderDeg. */
    rudderAngle: number;
    /** Maximum rudder deflection in degrees. Defaults to 30. */
    maxRudderDeg?: number;
    /** Panel title. Defaults to "PROPULSION". */
    title?: string;
}

const RUDDER_SPRING = { tension: 300, friction: 30 };
const BAR_SPRING = { tension: 210, friction: 24 };

const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));

/**
 * Vertical thruster power bar with a sprung centre-zero fill and threshold color.
 *
 * `power` is signed: 0 sits on the centre detent, ahead fills upward from it and
 * astern fills downward, so a stopped thruster and a reversing one never look alike.
 */
const ThrusterBar: React.FC<{ label: string; power: number }> = ({ label, power }) => {
    const theme = useTheme();
    const telemetry = theme.palette.telemetry;
    const textPrimary = telemetry?.text.primary ?? theme.palette.text.primary;
    const clamped = clamp(power, -100, 100);
    // getPowerColor's thresholds are magnitude-based, so full astern and full ahead
    // share a color — the fill direction is what tells them apart.
    const color = getPowerColor(theme, Math.abs(clamped));
    const spring = useSpring({ v: clamped, config: BAR_SPRING });

    return (
        <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
            <Typography
                variant="caption"
                sx={{ minWidth: '5ch', textAlign: 'center', fontSize: '10px', color, fontWeight: 700, mb: '3px' }}
            >
                {Math.round(clamped)}%
            </Typography>
            <Box
                sx={{
                    width: 10,
                    height: 70,
                    backgroundColor: telemetry?.background.tertiary ?? alpha(theme.palette.common.white, 0.1),
                    border: `1px solid ${telemetry?.border.lighter ?? theme.palette.divider}`,
                    borderRadius: '2px',
                    position: 'relative',
                    overflow: 'hidden',
                }}
            >
                {/* Zero detent — the line both fills grow away from. */}
                <Box
                    sx={{
                        position: 'absolute',
                        top: '50%',
                        left: 0,
                        width: '100%',
                        height: '1.5px',
                        backgroundColor: alpha(textPrimary, 0.4),
                        transform: 'translateY(-50%)',
                    }}
                />
                <animated.div
                    style={{
                        position: 'absolute',
                        left: 0,
                        width: '100%',
                        // Anchored to the 50% centreline: ahead grows up from it, astern
                        // down. Half-magnitude because each direction owns half the track.
                        bottom: spring.v.to((v) => (v >= 0 ? '50%' : `${50 - Math.abs(v) / 2}%`)),
                        height: spring.v.to((v) => `${Math.abs(v) / 2}%`),
                        backgroundColor: color,
                        transition: 'background-color 0.3s ease',
                    }}
                />
            </Box>
            <Typography
                variant="caption"
                sx={{ fontSize: '8px', color: telemetry?.text.secondary ?? theme.palette.text.secondary, mt: '3px' }}
            >
                {label}
            </Typography>
        </Box>
    );
};

/**
 * @function ShipRudderVisualizer
 * @description Twin-hull propulsion visualizer: power bars, catamaran with
 * spring-animated rudders, and a ±maxRudderDeg rudder position track.
 */
export const ShipRudderVisualizer: React.FC<ShipRudderVisualizerProps> = ({
    portPower,
    stbdPower,
    rudderAngle,
    maxRudderDeg = 30,
    title = 'PROPULSION',
}) => {
    const theme = useTheme();
    const telemetry = theme.palette.telemetry;

    const hullFill = telemetry?.background.headerAlt ?? 'rgba(0, 0, 0, 0.5)';
    const hullStroke = theme.palette.primary.light;
    const deckStroke = telemetry?.text.secondary ?? theme.palette.text.secondary;
    const cabinFill = telemetry?.background.secondary ?? 'rgba(0, 0, 0, 0.35)';
    const lightColor = telemetry?.accent ?? theme.palette.secondary.main;
    const textPrimary = telemetry?.text.primary ?? theme.palette.text.primary;
    const textSecondary = telemetry?.text.secondary ?? theme.palette.text.secondary;
    const trackBg = telemetry?.background.tertiary ?? alpha(theme.palette.common.white, 0.15);

    const constrained = clamp(rudderAngle, -maxRudderDeg, maxRudderDeg);
    const { rot } = useSpring({ rot: constrained, config: RUDDER_SPRING });

    // Marker position along the track: 0% = full port, 100% = full starboard.
    const markerSpring = useSpring({
        pct: ((constrained + maxRudderDeg) / (2 * maxRudderDeg)) * 100,
        config: RUDDER_SPRING,
    });

    // Rudder pivots (in the 80×110 catamaran viewBox) — one per hull.
    const rudder = (pivotX: number, pivotY: number) => (
        <animated.g transform={rot.to((r) => `translate(${pivotX} ${pivotY}) rotate(${-r}) translate(${-pivotX} ${-pivotY})`)}>
            <rect x={pivotX - 2} y={pivotY - 2} width={4} height={4} fill={deckStroke} stroke={hullStroke} strokeWidth={0.5} />
            <rect x={pivotX - 3} y={pivotY + 2} width={6} height={10} rx={1} fill={hullFill} stroke={hullStroke} strokeWidth={0.5} />
            <line x1={pivotX - 6} y1={pivotY + 10} x2={pivotX + 6} y2={pivotY + 10} stroke={lightColor} strokeWidth={1.5} />
        </animated.g>
    );

    return (
        <Tooltip title="Propulsion overview: thruster power and rudder angle">
            <Box
                data-testid="rudder-visualizer"
                sx={{
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    p: '12px 15px',
                    width: '100%',
                    height: '100%',
                    color: textPrimary,
                }}
            >
                {/* The prop was declared and documented but never destructured or
                    rendered, so every consumer's title silently did nothing. Matches
                    how the sibling RadiusVisualizer presents its own. */}
                <Typography
                    variant="caption"
                    sx={{
                        fontWeight: 'bold',
                        fontSize: '11px',
                        mb: 1,
                        textTransform: 'uppercase',
                        letterSpacing: '1px',
                        color: textSecondary,
                    }}
                >
                    {title}
                </Typography>

                <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%', height: 92, px: '5px' }}>
                <ThrusterBar label="PORT" power={portPower} />

                {/* Top-down catamaran */}
                <Box component="svg" viewBox="0 0 80 110" sx={{ width: 70, height: 78, opacity: 0.85 }}>
                    {/* Hulls */}
                    <path
                        d="M 16 5 C 10 5, 8 20, 8 45 C 8 70, 8 85, 12 90 C 14 93, 18 93, 20 90 C 22 85, 22 75, 22 65 L 22 25 C 22 15, 20 5, 16 5 Z"
                        fill={hullFill}
                        stroke={hullStroke}
                        strokeWidth={1}
                    />
                    <path
                        d="M 64 5 C 70 5, 72 20, 72 45 C 72 70, 72 85, 68 90 C 66 93, 62 93, 60 90 C 58 85, 58 75, 58 65 L 58 25 C 58 15, 60 5, 64 5 Z"
                        fill={hullFill}
                        stroke={hullStroke}
                        strokeWidth={1}
                    />
                    {/* Crossbeams */}
                    <rect x={21} y={20} width={38} height={4} fill={cabinFill} stroke={deckStroke} strokeWidth={1} />
                    <rect x={21} y={70} width={38} height={4} fill={cabinFill} stroke={deckStroke} strokeWidth={1} />
                    {/* Deck outline */}
                    <path d="M 26 24 C 23 35, 23 60, 26 70" fill="none" stroke={deckStroke} strokeWidth={1.5} />
                    <path d="M 54 24 C 57 35, 57 60, 54 70" fill="none" stroke={deckStroke} strokeWidth={1.5} />
                    {/* Cabin */}
                    <path d="M 28 32 C 26 45, 26 50, 28 62 L 52 62 C 54 50, 54 45, 52 32 Z" fill={cabinFill} stroke={deckStroke} strokeWidth={1.5} />
                    <rect x={33} y={38} width={14} height={18} rx={2} fill="none" stroke={hullStroke} strokeWidth={1} />
                    <circle cx={35} cy={40} r={1} fill={lightColor} />
                    <circle cx={45} cy={40} r={1} fill={lightColor} />
                    <circle cx={35} cy={54} r={1} fill={lightColor} />
                    <circle cx={45} cy={54} r={1} fill={lightColor} />
                    {/* Twin rudders, spring-rotated about their pivots */}
                    {rudder(16, 90)}
                    {rudder(64, 90)}
                </Box>

                <ThrusterBar label="STBD" power={stbdPower} />
            </Box>

            {/* Rudder position track */}
            <Box sx={{ width: '100%', mt: 1, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', width: '100%', mb: '2px' }}>
                    <Typography variant="caption" sx={{ fontSize: '9px', color: textSecondary }}>
                        PORT
                    </Typography>
                    <Typography
                        variant="caption"
                        sx={{ minWidth: '12ch', textAlign: 'center', fontSize: '9px', fontWeight: 700, color: theme.palette.text.disabled }}
                    >
                        RUDDER: {Math.round(constrained)}°
                    </Typography>
                    <Typography variant="caption" sx={{ fontSize: '9px', color: textSecondary }}>
                        STBD
                    </Typography>
                </Box>
                <Box sx={{ width: '100%', height: 5, backgroundColor: trackBg, borderRadius: '2px', position: 'relative' }}>
                    {/* Center detent */}
                    <Box
                        sx={{
                            position: 'absolute',
                            left: '50%',
                            top: 0,
                            width: '1.5px',
                            height: '100%',
                            backgroundColor: alpha(textPrimary, 0.4),
                        }}
                    />
                    <animated.div
                        style={{
                            position: 'absolute',
                            left: markerSpring.pct.to((v) => `${v}%`),
                            top: -3.5,
                            width: 4,
                            height: 12,
                            background: textPrimary,
                            borderRadius: 1.5,
                            transform: 'translateX(-50%)',
                        }}
                    />
                </Box>
            </Box>
        </Box>
        </Tooltip>
    );
};

export default ShipRudderVisualizer;
