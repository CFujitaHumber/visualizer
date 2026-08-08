/**
 * Unit tests for the TacticalMap presentational component.
 */
import { render, screen, fireEvent } from '@testing-library/react';
import { ThemeProvider } from '@mui/material/styles';
import { Provider } from 'react-redux';
import { telemetryTheme } from '@/theme';
import store from '@/store/store';
import { TacticalMap } from '@/components/hud/telemetry/TacticalMap';

const renderMap = (onClose: () => void = () => {}) => {
  return render(
    <Provider store={store}>
      <ThemeProvider theme={telemetryTheme}>
        <TacticalMap onClose={onClose} />
      </ThemeProvider>
    </Provider>,
  );
};

describe('TacticalMap', () => {
  it('renders the header title and coordinate system badge', () => {
    renderMap();

    expect(screen.getByTestId('tactical-map')).toBeInTheDocument();
    expect(screen.getByText('Tactical Map (2D)')).toBeInTheDocument();
    expect(screen.getByText('LOCAL SLAM COORDINATES')).toBeInTheDocument();
  });

  it('renders the legend entries', () => {
    renderMap();

    expect(screen.getByText('ASV Position')).toBeInTheDocument();
    expect(screen.getByText('Mapped Area')).toBeInTheDocument();
    expect(screen.getByText('Mapped Obstacle')).toBeInTheDocument();
  });

  it('renders a canvas element', () => {
    const { container } = renderMap();
    expect(container.querySelector('canvas')).toBeInTheDocument();
  });

  it('invokes onClose when the close button is clicked', () => {
    const onClose = jest.fn();
    renderMap(onClose);

    fireEvent.click(screen.getByText('Close Map'));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('starts with the recenter button disabled (camera is auto-following)', () => {
    renderMap();
    expect(screen.getByText('Recenter')).toBeDisabled();
  });
});
