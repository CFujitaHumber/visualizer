/**
 * Unit tests for how Batteries reports a failed battery sensor.
 */
import type { ReactElement } from 'react';
import { render, screen } from '@testing-library/react';
import { ThemeProvider } from '@mui/material/styles';
import { Provider } from 'react-redux';
import { telemetryTheme } from '@/theme';
import store from '@/store/store';
import { SET_STATUS } from '@/store/slices/telemetrySlice';
import Batteries from '@/components/hud/telemetry/Batteries';
import BatteryFailure from '@/components/hud/telemetry/BatteryFailure';

const MESSAGE = 'Failed to connect to battery sensor';

const renderWithStore = (ui: ReactElement) =>
  render(
    <Provider store={store}>
      <ThemeProvider theme={telemetryTheme}>{ui}</ThemeProvider>
    </Provider>,
  );

const setBattery = (sensorConnected?: boolean) =>
  store.dispatch(SET_STATUS({ battery: { motors: 70, primary: 50, sensorConnected } }));

describe('BatteryFailure', () => {
  it('puts the crossed-out icon above the message', () => {
    renderWithStore(<BatteryFailure />);

    const strike = screen.getByTestId('battery-failure-strike');
    const message = screen.getByText(MESSAGE);
    expect(strike.compareDocumentPosition(message) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it('announces the failure', () => {
    renderWithStore(<BatteryFailure />);

    expect(screen.getByRole('alert')).toHaveTextContent(MESSAGE);
  });
});

describe('Batteries', () => {
  it('shows the failure instead of the percentages when the sensor is disconnected', () => {
    setBattery(false);
    renderWithStore(<Batteries />);

    expect(screen.getByText(MESSAGE)).toBeInTheDocument();
    expect(screen.queryByText('70%')).not.toBeInTheDocument();
    expect(screen.queryByText('50%')).not.toBeInTheDocument();
  });

  it('shows the percentages when the sensor is connected', () => {
    setBattery(true);
    renderWithStore(<Batteries />);

    expect(screen.getByText('70%')).toBeInTheDocument();
    expect(screen.getByText('50%')).toBeInTheDocument();
    expect(screen.queryByText(MESSAGE)).not.toBeInTheDocument();
  });

  it('shows the percentages for telemetry that has no sensor flag', () => {
    // Simulated telemetry and older basestations don't send it.
    setBattery(undefined);
    renderWithStore(<Batteries />);

    expect(screen.getByText('70%')).toBeInTheDocument();
    expect(screen.queryByText(MESSAGE)).not.toBeInTheDocument();
  });
});
