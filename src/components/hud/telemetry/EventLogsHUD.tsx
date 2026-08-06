/**
 * @file EventLogsHUD.tsx
 * @description Collapsible drawer showing the most recent task log entries.
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

import { useState } from 'react';
import { useSelector } from 'react-redux';
import type { RootState } from '../../../store/store';
import { Box, Typography } from '@mui/material';

export interface EventLogsHUDProps {
    /** Drawer header label. Defaults to "Live Log Laugh". */
    title?: string;
}

export default function EventLogsHUD({ title = 'Live Log Laugh' }: EventLogsHUDProps) {
    const [collapsed, setCollapsed] = useState(false);

    const logs = useSelector((state: RootState) => state.telemetry.task.log.map((message) => {
        const match = message.match(/\[(.*?)\]$/);
        const timestamp = match ? match[1] : new Date().toLocaleTimeString('en-US', { hour12: false });
        const cleanMessage = match ? message.replace(/ \[(.*?)\]$/, '') : message;
        return { message: cleanMessage, timestamp };
    }));
    const displayLogs = logs.slice(-3);

    return (
        <Box sx={{
            display: 'flex', flexDirection: 'column', p: '10px 15px', background: 'rgba(8, 7, 33, 0.75)',
            border: '1px solid rgba(255, 255, 255, 0.15)', borderRadius: '8px', backdropFilter: 'blur(10px)',
            width: '700px', minHeight: collapsed ? '45px' : '75px', color: '#F2F2F2', fontFamily: 'monospace', boxSizing: 'border-box', boxShadow: '0 4px 15px rgba(0, 0, 0, 0.5)',
            transition: 'min-height 0.2s ease-out',
        }}>
            <Box
                onClick={() => setCollapsed(!collapsed)}
                sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer', userSelect: 'none', mb: collapsed ? '0px' : '6px' }}
            >
                <Typography sx={{ fontWeight: 'bold', fontSize: '10px', color: '#888', textTransform: 'uppercase', letterSpacing: '0.5px' }}>{title}</Typography>
                <Typography sx={{ fontSize: '10px', color: '#B980F1', fontWeight: 'bold' }}>{collapsed ? 'Expand' : 'Collapse'}</Typography>
            </Box>
            {!collapsed && (
                <Box sx={{ display: 'flex', flexDirection: 'column', gap: '3px', flex: 1, justifyContent: 'center' }}>
                    {displayLogs.length > 0 ? (
                        displayLogs.map((log, idx) => (
                            <Box key={idx} sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                <Typography sx={{ fontSize: '11px', color: '#e5e7eb', textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' }}>• {log.message}</Typography>
                                <Typography sx={{ fontSize: '10px', color: '#B980F1', opacity: 0.8, whiteSpace: 'nowrap' }}>[{log.timestamp}]</Typography>
                            </Box>
                        ))
                    ) : (
                        <Typography sx={{ fontSize: '11px', color: '#6b7280', fontStyle: 'italic' }}>No log entries available</Typography>
                    )}
                </Box>
            )}
        </Box>
    );
}
