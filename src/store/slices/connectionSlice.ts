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
    /**
     * Telemetry frames arriving from the basestation, in frames per second.
     *
     * @remarks
     * `null` means "not measurable" — no live socket, or not enough frames seen yet to
     * form an estimate. That is deliberately distinct from `0`, which means the socket is
     * open but nothing is coming through it. Conflating the two would make a dead feed
     * look like simulation mode.
     *
     * Only the WebSocket path feeds this. Mock/simulation updates are generated in-process
     * and are not frames "from the basestation", so counting them would report a healthy
     * rate for a basestation that isn't there.
     */
    frameRate: number | null;
    /** Total frames received on the current socket. Resets whenever a new one opens. */
    framesReceived: number;
}

const initialState: ConnectionState = {
    // Populated by initConnection() with the URL resolved from the runtime
    // connection config (see connection/config.ts) at connect time.
    status: 'idle',
    url: '',
    toast: { open: false, message: '', severity: 'info' },
    frameRate: null,
    framesReceived: 0,
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
        /**
         * Publishes a newly measured frame rate.
         *
         * @remarks
         * Dispatched on a timer rather than per frame. The rate is measured where the
         * frames land (`connectionActions`), not derived here, because a reducer has no
         * clock — and pushing every arrival through the store just to count it would put
         * an action on the wire ~10x/second for a number that only needs to move once.
         */
        setFrameRate(state, action: PayloadAction<{ rate: number | null; total: number }>) {
            state.frameRate = action.payload.rate;
            state.framesReceived = action.payload.total;
        },
        /** Clears the frame-rate measurement. Called whenever a socket opens or closes. */
        resetFrameRate(state) {
            state.frameRate = null;
            state.framesReceived = 0;
        },
    },
});

export const {
    setConnectionStatus,
    setConnectionUrl,
    showToast,
    dismissToast,
    setFrameRate,
    resetFrameRate,
} = connectionSlice.actions;
export default connectionSlice.reducer;
