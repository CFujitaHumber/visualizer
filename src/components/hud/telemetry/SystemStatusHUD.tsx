/**
 * @file SystemStatusHUD.tsx
 * @description Top-right overlay strip: motor + primary battery levels,
 * connection/signal strength, and autonomy mode.
 *
 * @author Carson Fujita
 * @license MIT
 */
/*
MIT License

Copyright (c) 2026 HumberASV
Copyright (c) 2026 Carson Fujita

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
*/

import React from 'react';
import { useSelector } from 'react-redux';
import type { RootState } from '../../../store/store';
import { Box, Typography } from '@mui/material';
import { batteryIconFor } from '../../../utils/batteryUtil';

const BatteryReadout: React.FC<{ label: string; level: number }> = ({ label, level }) => {
    const Icon = batteryIconFor(level);
    return (
        <Box sx={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
            <Typography sx={{ color: '#D9D9D9', fontSize: '11px' }}>{label}:</Typography>
            <Icon sx={{ fontSize: '16px', color: level < 20 ? '#ef4444' : '#D8FA07' }} />
            <Typography sx={{ display: 'inline-block', minWidth: '4ch', textAlign: 'right', fontWeight: 'bold', fontSize: '13px', color: level < 20 ? '#ef4444' : '#D8FA07' }}>
                {Math.round(level)}%
            </Typography>
        </Box>
    );
};

export default function SystemStatusHUD() {
    const signalStrength = useSelector((state: RootState) => state.telemetry.signal.strength);
    const motorsBattery = useSelector((state: RootState) => state.telemetry.battery.motors);
    const primaryBattery = useSelector((state: RootState) => state.telemetry.battery.primary);
    const autonomyMode = useSelector((state: RootState) => state.telemetry.planning.status === 'autonomous');
    const connectionStatus = signalStrength > 0 ? 'connected' : 'disconnected';

    return (
        <Box sx={{
            display: 'flex', alignItems: 'center', gap: '15px', p: '10px 15px',
            background: 'rgba(8, 7, 33, 0.75)', border: '1px solid rgba(255, 255, 255, 0.15)', borderRadius: '8px',
            backdropFilter: 'blur(10px)', color: '#F2F2F2', fontFamily: 'monospace', boxShadow: '0 4px 15px rgba(0, 0, 0, 0.5)',
        }}>
            <BatteryReadout label="MOTORS" level={motorsBattery} />
            <Box sx={{ width: '1px', height: '16px', background: 'rgba(255,255,255,0.2)' }} />
            <BatteryReadout label="PWR" level={primaryBattery} />
            <Box sx={{ width: '1px', height: '16px', background: 'rgba(255,255,255,0.2)' }} />
            <Box sx={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <Typography sx={{ fontWeight: 'bold', fontSize: '13px', color: connectionStatus === 'connected' ? '#F2F2F2' : '#ef4444' }}>
                    {Math.round(signalStrength)}%
                </Typography>
                <svg width="18" height="18" viewBox="0 0 24 24" style={{ filter: connectionStatus === 'connected' ? 'drop-shadow(0 0 4px rgba(216, 250, 7, 0.4))' : 'drop-shadow(0 0 4px rgba(239, 68, 68, 0.4))' }}>
                    <defs>
                        <clipPath id="wifiFillClip">
                            <rect x="0" y={24 - (signalStrength / 100) * 24} width="24" height="24" />
                        </clipPath>
                    </defs>
                    <path d="M12 21.5 L1.5 6 C6 2 18 2 22.5 6 L12 21.5 Z" fill="none" stroke="rgba(255,255,255,0.3)" strokeWidth="2" strokeLinejoin="round" />
                    <path d="M12 21.5 L1.5 6 C6 2 18 2 22.5 6 L12 21.5 Z" fill={connectionStatus === 'connected' ? '#D8FA07' : '#ef4444'} clipPath="url(#wifiFillClip)" />
                </svg>
            </Box>
            <Box sx={{ width: '1px', height: '16px', background: 'rgba(255,255,255,0.2)' }} />
            <Box sx={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Typography sx={{ color: '#D9D9D9', fontSize: '11px' }}>MODE:</Typography>
                <Typography sx={{
                    fontWeight: 'bold', px: '8px', py: '2px', borderRadius: '4px', fontSize: '11px',
                    background: autonomyMode ? 'rgba(185,128,241,0.2)' : 'rgba(245,158,11,0.2)',
                    color: autonomyMode ? '#B980F1' : '#f59e0b',
                    border: autonomyMode ? '1px solid rgba(185,128,241,0.4)' : '1px solid rgba(245,158,11,0.4)',
                }}>
                    {autonomyMode ? 'AUTONOMOUS' : 'MANUAL'}
                </Typography>
                <svg width="12" height="20" viewBox="0 0 12 20" style={{ filter: autonomyMode ? 'drop-shadow(0 0 4px #B980F1)' : 'drop-shadow(0 0 4px #f59e0b)', transition: 'all 0.3s ease' }}>
                    <path d="M6 0 L12 6 L10 18 L2 18 L0 6 Z" fill={autonomyMode ? '#B980F1' : '#f59e0b'} />
                </svg>
            </Box>
        </Box>
    );
}
