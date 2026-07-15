/**
 * Unit tests for the runtime-configurable connection settings.
 */
import {
  configureTelemetryConnection,
  getTelemetryConnectionConfig,
  resetTelemetryConnectionConfig,
} from '@/connection/config';

describe('connection config', () => {
  afterEach(() => {
    resetTelemetryConnectionConfig();
  });

  it('defaults to the localhost basestation endpoints', () => {
    const config = getTelemetryConnectionConfig();
    expect(config).toEqual({
      httpBase: 'http://localhost:8080',
      wsUrl: 'ws://localhost:8080/telemetry',
      timeoutMs: 5000,
    });
  });

  it('merges partial overrides, keeping unspecified fields', () => {
    configureTelemetryConnection({ wsUrl: 'ws://asv.local:9000/telemetry' });
    const config = getTelemetryConnectionConfig();

    expect(config.wsUrl).toBe('ws://asv.local:9000/telemetry');
    expect(config.httpBase).toBe('http://localhost:8080');
    expect(config.timeoutMs).toBe(5000);
  });

  it('applies successive overrides cumulatively', () => {
    configureTelemetryConnection({ httpBase: 'http://10.0.0.5:8080' });
    configureTelemetryConnection({ timeoutMs: 1000 });
    const config = getTelemetryConnectionConfig();

    expect(config.httpBase).toBe('http://10.0.0.5:8080');
    expect(config.timeoutMs).toBe(1000);
  });

  it('returns a copy — mutating the result does not affect the config', () => {
    const config = getTelemetryConnectionConfig();
    config.httpBase = 'http://mutated';
    expect(getTelemetryConnectionConfig().httpBase).toBe('http://localhost:8080');
  });

  it('resets to defaults', () => {
    configureTelemetryConnection({ httpBase: 'http://elsewhere', timeoutMs: 1 });
    resetTelemetryConnectionConfig();
    expect(getTelemetryConnectionConfig().httpBase).toBe('http://localhost:8080');
  });
});
