/**
 * @file fetchTelemetry.ts
 * 
 * @description
 * This file contains Redux action creators for fetching telemetry data from the basestation. 
 * It includes actions for handling successful data retrieval as well as error handling for failed attempts.
 * Additionally, it provides utility functions for starting and stopping mock telemetry updates, 
 * which can be used for testing purposes without needing a live WebSocket connection.
 * 
 * @author Carson Fujita
 * @license MIT
 */
import {
    FETCH_TELEMETRY_SUCCESS,
    FETCH_TELEMETRY_FAILURE,
} from '../../types/telemetryInterfaces';

import generateRandomState, { generateMockStateUpdate, generateMockVideoUrl } from '../../utils/telemetry/telemetryFactory';
import type { TelemetryActionTypes } from '../../types/telemetryInterfaces';
import type { Status as TelemetryState } from '../../types';
import type { AppDispatch } from '../store';
import { SET_STATUS } from '../slices/telemetrySlice';
import { setFineGrid } from '../slices/simulationSlice';
import { setVideoStreamUrl } from '../slices/videoSlice';
/**
 * This action creator is dispatched when telemetry data is successfully received from the basestation.
 * @param data data - The telemetry data received, which includes various parameters such as speed, heading, battery levels, etc.
 * @returns An action object indicating successful telemetry fetch.
 */
export const fetchTelemetrySuccess = (data: TelemetryState): TelemetryActionTypes => ({
    type: FETCH_TELEMETRY_SUCCESS,
    payload: data
});

/**
 * This action creator is dispatched when there is an error in fetching telemetry data from the basestation.
 * @param error error - A string describing the error that occurred during the telemetry data fetch attempt.
 * @returns An action object indicating failed telemetry fetch, containing the error message.
 */
export const fetchTelemetryFailure = (error: string): TelemetryActionTypes => ({
    type: FETCH_TELEMETRY_FAILURE,
    payload: error
});

// Additional action creators for starting and stopping mock telemetry updates can be added here,
let mockTelemetryInterval: ReturnType<typeof setInterval> | null = null;
let mockTelemetryState: TelemetryState | null = null;

/**
 * @description
 * This function generates mock telemetry data for testing purposes without needing a WebSocket connection. 
 * It can be used in development or testing environments to simulate receiving telemetry data.
 * 
 * @author Carson Fujita
 * @returns A thunk action that dispatches the generated mock telemetry data to the Redux store.
 * @remarks
 * - Optional utility function to generate random telemetry data for testing purposes without needing a WebSocket connection. 
 * - This can be used in development or testing environments to simulate receiving telemetry data.
 */
export const getMockStatus = () => {
    return (dispatch: AppDispatch) => {
        console.log("Generating mock telemetry data...");
        const { status, fineGrid } = generateRandomState();
        mockTelemetryState = status;
        dispatch(fetchTelemetrySuccess(status));
        dispatch(setFineGrid(fineGrid));
        dispatch(setVideoStreamUrl(generateMockVideoUrl()));
    };
};

/**
 * Starts generating mock telemetry updates at regular intervals.
 * @returns A thunk action that initiates the mock telemetry updates.
 */
export const startMockTelemetryUpdates = () => {
    return (dispatch: AppDispatch) => {
        if (mockTelemetryInterval) {
            return;
        }

        // Narrow through a local — TS cannot narrow the module-level `let` inside closures.
        let current = mockTelemetryState;
        if (!current) {
            const { status, fineGrid } = generateRandomState();
            current = status;
            mockTelemetryState = status;
            dispatch(setFineGrid(fineGrid));
            dispatch(setVideoStreamUrl(generateMockVideoUrl()));
        }
        dispatch(fetchTelemetrySuccess(current));

        mockTelemetryInterval = setInterval(() => {
            if (!mockTelemetryState) {
                return;
            }

            const next = generateMockStateUpdate(mockTelemetryState);
            mockTelemetryState = next;
            const { asv: _asv, ...statusUpdate } = next;
            dispatch(SET_STATUS(statusUpdate));
        }, 1000);
    };
};

/**
 * Stops generating mock telemetry updates.
 * @returns A thunk action that stops the mock telemetry updates.
 */
export const stopMockTelemetryUpdates = () => {
    return () => {
        if (mockTelemetryInterval) {
            clearInterval(mockTelemetryInterval);
            mockTelemetryInterval = null;
        }
    };
};

/**
 * Generates a fresh random telemetry state, replacing any existing mock state and
 * restarting the update interval. Useful for getting a new map layout on demand.
 */
export const regenerateMockTelemetry = () => {
    return (dispatch: AppDispatch) => {
        if (mockTelemetryInterval) {
            clearInterval(mockTelemetryInterval);
            mockTelemetryInterval = null;
        }

        const { status, fineGrid } = generateRandomState();
        mockTelemetryState = status;
        dispatch(fetchTelemetrySuccess(status));
        dispatch(setFineGrid(fineGrid));
        dispatch(setVideoStreamUrl(generateMockVideoUrl()));

        mockTelemetryInterval = setInterval(() => {
            if (!mockTelemetryState) return;
            const next = generateMockStateUpdate(mockTelemetryState);
            mockTelemetryState = next;
            const { asv: _asv, ...statusUpdate } = next;
            dispatch(SET_STATUS(statusUpdate));
        }, 1000);
    };
};

export const TelemetryActions = {
    fetchTelemetrySuccess,
    fetchTelemetryFailure,
    getMockStatus,
    startMockTelemetryUpdates,
    stopMockTelemetryUpdates,
    regenerateMockTelemetry,
};