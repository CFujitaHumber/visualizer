/**
 * Unit tests for the ShipRudderVisualizer presentational component.
 */
import { render, screen } from '@testing-library/react';
import { ThemeProvider } from '@mui/material/styles';
import { telemetryTheme } from '@/theme';
import { ShipRudderVisualizer } from '@/components/hud/telemetry/ShipRudderVisualizer';

const renderPanel = (props: Partial<React.ComponentProps<typeof ShipRudderVisualizer>> = {}) =>
  render(
    <ThemeProvider theme={telemetryTheme}>
      <ShipRudderVisualizer portPower={40} stbdPower={60} rudderAngle={10} {...props} />
    </ThemeProvider>,
  );

describe('ShipRudderVisualizer', () => {
  it('renders the title and thruster labels with power readouts', () => {
    renderPanel();

    expect(screen.getByTestId('rudder-visualizer')).toBeInTheDocument();
    expect(screen.getByText('PROPULSION')).toBeInTheDocument();
    // PORT/STBD appear on both the thruster bars and the rudder track
    expect(screen.getAllByText('PORT')).toHaveLength(2);
    expect(screen.getAllByText('STBD')).toHaveLength(2);
    expect(screen.getByText('40%')).toBeInTheDocument();
    expect(screen.getByText('60%')).toBeInTheDocument();
  });

  it('shows the rudder angle readout', () => {
    renderPanel({ rudderAngle: 12 });
    expect(screen.getByText('RUDDER: 12°')).toBeInTheDocument();
  });

  it('clamps the rudder angle to ±30° by default', () => {
    renderPanel({ rudderAngle: 75 });
    expect(screen.getByText('RUDDER: 30°')).toBeInTheDocument();
  });

  it('respects a custom maxRudderDeg clamp', () => {
    renderPanel({ rudderAngle: -90, maxRudderDeg: 45 });
    expect(screen.getByText('RUDDER: -45°')).toBeInTheDocument();
  });

  it('clamps power readouts to ±100%', () => {
    renderPanel({ portPower: 140, stbdPower: -140 });
    expect(screen.getByText('100%')).toBeInTheDocument();
    expect(screen.getByText('-100%')).toBeInTheDocument();
  });

  it('reports astern power as negative rather than flooring it at zero', () => {
    renderPanel({ portPower: -40, stbdPower: 60 });
    expect(screen.getByText('-40%')).toBeInTheDocument();
    expect(screen.getByText('60%')).toBeInTheDocument();
  });

  it('shows a stopped thruster as 0%', () => {
    renderPanel({ portPower: 0, stbdPower: 60 });
    expect(screen.getByText('0%')).toBeInTheDocument();
  });
});
