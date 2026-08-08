/**
 * @file ShipRudderVisualizerPanel.tsx
 * @description Redux-connected wrapper around {@link ShipRudderVisualizer}.
 *
 * @remarks
 * Selects port/starboard motor power from `telemetry.motors` and the rudder
 * angle from `telemetry.rudder`. Follows the same panel pattern as the other
 * hud/telemetry components.
 *
 * @author Carson Fujita
 * @license MIT
 */
import React from 'react';
import { Box, useTheme } from '@mui/material';
import { useSelector } from 'react-redux';
import type { RootState } from '../../../store/store';
import ShipRudderVisualizer from './ShipRudderVisualizer';

/** Properties for the {@link ShipRudderVisualizerPanel} component. */
export interface ShipRudderVisualizerPanelProps {
    /** Maximum rudder deflection in degrees. Defaults to 30. */
    maxRudderDeg?: number;
}

/**
 * @function ShipRudderVisualizerPanel
 * @description Feeds live telemetry (motor power, rudder angle) into the
 * presentational {@link ShipRudderVisualizer}.
 */
export const ShipRudderVisualizerPanel: React.FC<ShipRudderVisualizerPanelProps> = ({ maxRudderDeg }) => {
    const theme = useTheme();
    const telemetry = theme.palette.telemetry;
    const borderLight = telemetry?.border.light ?? theme.palette.divider;
    const portPower = useSelector((state: RootState) => state.telemetry.motors.left);
    const stbdPower = useSelector((state: RootState) => state.telemetry.motors.right);
    const rudderAngle = useSelector((state: RootState) => state.telemetry.rudder.angle);

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
                maxWidth: 230,
                overflow: 'hidden',
                boxShadow: '0 4px 15px rgba(0, 0, 0, 0.5)',
            }}
        >
            <ShipRudderVisualizer
                portPower={portPower}
                stbdPower={stbdPower}
                rudderAngle={rudderAngle}
                maxRudderDeg={maxRudderDeg}
            />
        </Box>
    );
};

export default ShipRudderVisualizerPanel;
