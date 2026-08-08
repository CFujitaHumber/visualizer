/**
 * Unit tests for the Speedometer presentational component.
 */
import { render, screen } from '@testing-library/react';
import { ThemeProvider } from '@mui/material/styles';
import { Provider } from 'react-redux';
import { telemetryTheme } from '@/theme';
import store from '@/store/store';
import Speedometer from '@/components/hud/telemetry/Speedometer';

const renderSpeedometer = () =>
  render(
    <Provider store={store}>
      <ThemeProvider theme={telemetryTheme}>
        <Speedometer />
      </ThemeProvider>
    </Provider>,
  );

describe('Speedometer', () => {
  it('renders the current speed and units', () => {
    renderSpeedometer();
    expect(screen.getByText('0.00')).toBeInTheDocument();
    expect(screen.getByText('m/s')).toBeInTheDocument();
  });

  it('owns its aspect ratio instead of stretching to a fixed pixel width', () => {
    const { container } = renderSpeedometer();
    const tile = container.firstElementChild as HTMLElement;
    const computed = window.getComputedStyle(tile);

    // The old layout hardcoded `width: 8rem` against a parent-driven `height: 100%`,
    // which stretched the tile into whatever aspect ratio the consumer's grid cell
    // happened to have. It should now own a stable aspect ratio and a flexible width instead.
    expect(computed.aspectRatio).toBe('1/1');
    expect(computed.width).not.toBe('8rem');
  });
});
