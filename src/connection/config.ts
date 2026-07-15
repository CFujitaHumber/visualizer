/**
 * @file connection/config.ts
 * @description Runtime-configurable connection settings for the ASV basestation.
 *
 * A published library cannot assume the basestation lives at localhost:8080, so
 * instead of hardcoded constants the connection endpoints are held in a mutable
 * module-level config. Call {@link configureTelemetryConnection} once at app
 * startup (before dispatching `initConnection`) to point the visualizer at the
 * right basestation. Thunks and utilities read the config at call time via
 * {@link getTelemetryConnectionConfig}, so overrides applied before a connection
 * attempt are always honored.
 *
 * @author Carson Fujita
 * @license MIT
 *
 * @example
 * configureTelemetryConnection({
 *     httpBase: 'http://192.168.1.50:8080',
 *     wsUrl: 'ws://192.168.1.50:8080/telemetry',
 * });
 * store.dispatch(initConnection());
 */

/** Connection endpoints and timeouts for the ASV basestation. */
export interface TelemetryConnectionConfig {
    /** Base HTTP URL for the ASV basestation REST endpoints (health check, relative stream URLs). */
    httpBase: string;
    /** WebSocket URL for the ASV basestation telemetry stream. */
    wsUrl: string;
    /** Milliseconds to wait for a WebSocket handshake before falling back to simulation. */
    timeoutMs: number;
}

const DEFAULT_CONFIG: TelemetryConnectionConfig = {
    httpBase: 'http://localhost:8080',
    wsUrl: 'ws://localhost:8080/telemetry',
    timeoutMs: 5000,
};

let config: TelemetryConnectionConfig = { ...DEFAULT_CONFIG };

/**
 * Overrides one or more connection settings. Unspecified fields keep their
 * current values.
 */
export function configureTelemetryConnection(overrides: Partial<TelemetryConnectionConfig>): void {
    config = { ...config, ...overrides };
}

/** Returns the current connection settings (read at call time by the thunks). */
export function getTelemetryConnectionConfig(): TelemetryConnectionConfig {
    return { ...config };
}

/** Resets the connection settings to the localhost defaults. Primarily for tests. */
export function resetTelemetryConnectionConfig(): void {
    config = { ...DEFAULT_CONFIG };
}
