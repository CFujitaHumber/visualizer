/**
 * @file TaskManagementHUD.tsx
 * @description Top-left overlay panel showing the ASV's current task id/name.
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

import { useSelector } from 'react-redux';
import type { RootState } from '../../../store/store';
import { Box, Typography } from '@mui/material';

export default function TaskManagementHUD() {
    const task = useSelector((state: RootState) => state.telemetry.task.data);

    return (
        <Box sx={{
            display: 'flex',
            flexDirection: 'column',
            p: '10px 15px',
            background: 'rgba(8, 7, 33, 0.75)',
            border: '1px solid rgba(255, 255, 255, 0.15)',
            borderRadius: '8px',
            backdropFilter: 'blur(10px)',
            color: '#F2F2F2',
            fontFamily: 'monospace',
            minWidth: '180px',
            boxShadow: '0 4px 15px rgba(0, 0, 0, 0.5)',
        }}>
            <Typography sx={{ fontSize: '18px', fontWeight: 'bold', color: '#B980F1' }}>
                Task: {task?.id !== undefined ? task.id : 'N/A'}
            </Typography>
            <Typography sx={{ fontSize: '11px', color: '#D9D9D9', mt: '2px' }}>
                {task?.name || 'No active task detail'}
            </Typography>
        </Box>
    );
}
