/**
 * @file connectionActions.ts
 * @description Redux actions for managing the WebSocket connection to the ASV basestation.
 *
 * @author Carson Fujita
 */

import { getTelemetryConnectionConfig } from '../../connection/config';
import { setConnectionStatus, setConnectionUrl, showToast, setFrameRate, resetFrameRate } from '../slices/connectionSlice';
import { fetchTelemetrySuccess, startMockTelemetryUpdates, stopMockTelemetryUpdates } from './fetchTelemetry';
import { setVideoStreamUrl } from '../slices/videoSlice';
import { resetDiscovery } from '../slices/discoveredGridSlice';
import type { AppDispatch } from '../store';
import type { Status } from '../../types';
import { isBasestationOnline } from '../../utils/basestation';

// Module-level reference so the socket can be cleaned up if needed.
let socket: WebSocket | null = null;

// ---------------------------------------------------------------------------
// Telemetry frame-rate meter
// ---------------------------------------------------------------------------
// Counts frames arriving on the socket and publishes the rate on a timer.
//
// Measured over a sliding window rather than as an instantaneous 1/gap: the
// basestation's send loop sleeps a fixed 0.1s per frame *on top of* however long
// serialising the state took, so the interval jitters frame to frame and an
// instantaneous reading would flicker unreadably.

/** Arrival timestamps (ms) inside the sliding window, oldest first. */
let frameTimes: number[] = [];
/** Frames counted since the socket opened. */
let frameTotal = 0;
let frameRateTimer: ReturnType<typeof setInterval> | null = null;

/** Sliding window the rate is averaged over. Long enough to be steady, short enough to react. */
const RATE_WINDOW_MS = 3000;
/** How often the measurement is published to the store. */
const RATE_PUBLISH_MS = 500;

function stopFrameRateMeter(dispatch: AppDispatch) {
    if (frameRateTimer !== null) {
        clearInterval(frameRateTimer);
        frameRateTimer = null;
    }
    frameTimes = [];
    frameTotal = 0;
    dispatch(resetFrameRate());
}

function startFrameRateMeter(dispatch: AppDispatch) {
    stopFrameRateMeter(dispatch);
    frameRateTimer = setInterval(() => {
        const now = Date.now();
        // Drop anything that has aged out. Done here rather than on arrival so a feed
        // that stops dead still decays instead of freezing at its last good rate.
        while (frameTimes.length > 0 && frameTimes[0] < now - RATE_WINDOW_MS) frameTimes.shift();

        // Measure to NOW, not to the newest frame. Measuring between the first and last
        // arrival would keep reporting the old rate as a dying feed's samples aged out —
        // count and span would shrink together — and then snap to zero when the window
        // finally emptied. Extending to now makes the reading fall off smoothly instead.
        //
        // n arrivals span n-1 intervals, so the count is one less than the sample count.
        const span = frameTimes.length > 0 ? now - frameTimes[0] : 0;
        const rate = frameTimes.length > 1 && span > 0
            ? ((frameTimes.length - 1) / span) * 1000
            : 0;

        // Below two samples there is no interval to measure, so report "unknown" rather
        // than a zero that would read as a dead feed during the first moments of a
        // perfectly healthy connection.
        dispatch(setFrameRate({ rate: frameTotal >= 2 ? rate : null, total: frameTotal }));
    }, RATE_PUBLISH_MS);
}

/** Records one frame arrival. Cheap by design — this runs on every socket message. */
function recordFrame() {
    frameTimes.push(Date.now());
    frameTotal++;
}

function fallbackToMock(dispatch: AppDispatch) {
    dispatch(resetDiscovery());
    stopFrameRateMeter(dispatch);
    dispatch(setConnectionStatus('mock'));
    dispatch(showToast({ message: 'Basestation unreachable — using simulation data', severity: 'warning' }));
    dispatch(startMockTelemetryUpdates());
}

function failedToConnect(dispatch: AppDispatch) {
    stopFrameRateMeter(dispatch);
    dispatch(setConnectionStatus('failed'));
    // Pre-populate the map with simulation data so the visualizer has something to show.
    // retryConnection calls stopMockTelemetryUpdates first, so this is safe to re-run on retry.
    dispatch(startMockTelemetryUpdates());
}

/**
 * Attempts a WebSocket connection to the basestation.
 *
 * @param options.silentFail - When true (auto-retry from mock mode), failures stay in mock
 *   rather than transitioning to 'failed'. This prevents the dashboard from being replaced
 *   by the connection interstitial during background retries.
 *
 * Flow:
 *  1. Health-check the HTTP server.
 *  2. If online, open WebSocket.
 *  3. On first data frame: mark connected and show success toast.
 *  4. On failure: silentFail → stay in mock; else → 'failed' (interstitial in Connect.tsx).
 */
export const initConnection = (options: { silentFail?: boolean } = {}) => async (dispatch: AppDispatch) => {
    const { silentFail = false } = options;
    // Resolve endpoints at call time so configureTelemetryConnection() overrides
    // applied before dispatch are honored.
    const { wsUrl, timeoutMs } = getTelemetryConnectionConfig();

    if (socket && socket.readyState <= WebSocket.OPEN) return;

    // Past the live-socket guard, so this only ever clears a measurement that belongs to a
    // socket already gone. Doing it here covers every way this function can bail out
    // without one of the fallback helpers running — otherwise a stale meter would sit at
    // 0.0 f/s in simulation mode, which reads as a dead basestation rather than no socket.
    stopFrameRateMeter(dispatch);

    dispatch(setConnectionUrl(wsUrl));

    if (!silentFail) {
        dispatch(setConnectionStatus('connecting'));
    }

    const online = await isBasestationOnline();

    if (!online) {
        if (silentFail) {
            // Reset from 'connecting' (set by retryConnection) back to mock.
            dispatch(setConnectionStatus('mock'));
            dispatch(startMockTelemetryUpdates());
        } else {
            failedToConnect(dispatch);
        }
        return;
    }

    socket = new WebSocket(wsUrl);

    const opened = await new Promise<boolean>((resolve) => {
        const timeout = setTimeout(() => {
            socket?.close();
            resolve(false);
        }, timeoutMs);

        socket!.onopen = () => {
            clearTimeout(timeout);
            resolve(true);
        };

        socket!.onerror = () => {
            clearTimeout(timeout);
            resolve(false);
        };
    });

    if (!opened) {
        if (silentFail) fallbackToMock(dispatch);
        else failedToConnect(dispatch);
        return;
    }

    // Started here rather than on the first message so its counter reset cannot discard
    // the very frame that triggered it.
    startFrameRateMeter(dispatch);

    // Defer "connected" toast until the first data frame arrives.
    let connected = false;

    socket!.onmessage = (event) => {
        // Counted before parsing, and for malformed frames too: this measures what the
        // socket delivers, which is the thing you want when diagnosing a feed. A frame
        // that arrived and failed to parse is a different fault from one that never came.
        recordFrame();

        if (!connected) {
            connected = true;
            dispatch(setConnectionStatus('connected'));
            dispatch(showToast({ message: 'Connected to ASV basestation', severity: 'success' }));
        }
        try {
            const rawData = JSON.parse(event.data as string);

            if (rawData.video?.streamUrl) {
                const { httpBase } = getTelemetryConnectionConfig();
                const streamUrl = (rawData.video.streamUrl as string).startsWith('/')
                    ? `${httpBase}${rawData.video.streamUrl}`
                    : rawData.video.streamUrl as string;
                dispatch(setVideoStreamUrl(streamUrl));
            }

            dispatch(fetchTelemetrySuccess(rawData as Status));
        } catch {
            // ignore malformed frames
        }
    };

    socket!.onclose = () => {
        if (!connected) {
            // Socket closed before any data — treat same as failed-to-open.
            if (silentFail) fallbackToMock(dispatch);
            else failedToConnect(dispatch);
            return;
        }
        // Mid-session disconnect: stay on dashboard in mock mode.
        dispatch(showToast({ message: 'Connection lost — switching to simulation', severity: 'warning' }));
        fallbackToMock(dispatch);
    };

    socket!.onerror = () => {
        // onclose fires immediately after onerror, no extra dispatch needed.
    };
};

/**
 * Auto-retry used by Telemetry.tsx while in mock mode. Failures stay in mock
 * so the dashboard remains visible.
 */
export const retryConnection = () => async (dispatch: AppDispatch) => {
    dispatch(stopMockTelemetryUpdates());
    dispatch(setConnectionStatus('connecting'));

    if (socket) {
        socket.onclose = null;
        socket.onerror = null;
        socket.close();
        socket = null;
    }

    await initConnection({ silentFail: true })(dispatch);
};

/**
 * User-initiated reconnect from the 'failed' interstitial. Failures return to
 * 'failed' so the interstitial is shown again.
 */
export const reconnect = () => async (dispatch: AppDispatch) => {
    dispatch(stopMockTelemetryUpdates());

    if (socket) {
        socket.onclose = null;
        socket.onerror = null;
        socket.close();
        socket = null;
    }

    await initConnection()(dispatch);
};

/**
 * Transitions from 'failed' to 'mock', starting simulation data.
 * Called when the user clicks "Use Simulation Data" on the failed interstitial.
 */
export const startSimulation = () => (dispatch: AppDispatch) => {
    stopFrameRateMeter(dispatch);
    dispatch(setConnectionStatus('mock'));
    dispatch(startMockTelemetryUpdates());
};
