/**
 * @file connectionSlice.ts
 * @description Manages the connection state for the ASV.
 *
 * @author Carson Fujita
 * @license MIT
 *
 * @remarks
 * - The connection state includes the current status of the connection (idle, connecting, connected, mock) and the WebSocket URL.
 */
import { createSlice, type PayloadAction } from '@reduxjs/toolkit';

export type ConnectionStatus = 'idle' | 'connecting' | 'connected' | 'mock' | 'failed';

export interface ToastState {
    open: boolean;
    message: string;
    severity: 'success' | 'error' | 'info' | 'warning';
}

export interface ConnectionState {
    status: ConnectionStatus;
    url: string;
    toast: ToastState;
}

const initialState: ConnectionState = {
    // Populated by initConnection() with the URL resolved from the runtime
    // connection config (see connection/config.ts) at connect time.
    status: 'idle',
    url: '',
    toast: { open: false, message: '', severity: 'info' },
};

const connectionSlice = createSlice({
    name: 'connection',
    initialState,
    reducers: {
        setConnectionStatus(state, action: PayloadAction<ConnectionStatus>) {
            state.status = action.payload;
        },
        setConnectionUrl(state, action: PayloadAction<string>) {
            state.url = action.payload;
        },
        showToast(state, action: PayloadAction<Pick<ToastState, 'message' | 'severity'>>) {
            state.toast = { open: true, ...action.payload };
        },
        dismissToast(state) {
            state.toast.open = false;
        },
    },
});

export const { setConnectionStatus, setConnectionUrl, showToast, dismissToast } = connectionSlice.actions;
export default connectionSlice.reducer;
