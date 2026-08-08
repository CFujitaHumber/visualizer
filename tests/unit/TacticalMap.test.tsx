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

  it('renders the legend entry for the course-over-ground track', () => {
    renderMap();
    expect(screen.getByText('Course Over Ground')).toBeInTheDocument();
  });

  // The header controls are icon buttons (matching the System Visualizer's HUD
  // toolbar), so they are addressed by accessible name rather than visible text.
  it('invokes onClose when the close button is clicked', () => {
    const onClose = jest.fn();
    renderMap(onClose);

    fireEvent.click(screen.getByRole('button', { name: 'Close map' }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('starts with the reset-view button disabled (camera is auto-fitting)', () => {
    renderMap();
    expect(screen.getByRole('button', { name: 'Reset view' })).toBeDisabled();
  });

  it('toggles follow-vessel mode, which also enables reset view', () => {
    renderMap();

    const follow = screen.getByRole('button', { name: 'Follow vessel' });
    fireEvent.click(follow);

    // Label flips to the "stop" affordance, and leaving 'auto' makes reset meaningful.
    expect(screen.getByRole('button', { name: 'Stop following vessel' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Reset view' })).toBeEnabled();

    // Toggling back off drops to a frozen manual view, NOT back to auto — so reset
    // stays available rather than silently snapping the user's view away.
    fireEvent.click(screen.getByRole('button', { name: 'Stop following vessel' }));
    expect(screen.getByRole('button', { name: 'Follow vessel' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Reset view' })).toBeEnabled();
  });

  it('resets back to the auto-fit camera', () => {
    renderMap();

    fireEvent.click(screen.getByRole('button', { name: 'Follow vessel' }));
    fireEvent.click(screen.getByRole('button', { name: 'Reset view' }));

    expect(screen.getByRole('button', { name: 'Reset view' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Follow vessel' })).toBeInTheDocument();
  });
});
