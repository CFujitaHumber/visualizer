/**
 * Unit tests for the TacticalMap presentational component.
 */
import { render, screen, fireEvent } from '@testing-library/react';
import { ThemeProvider } from '@mui/material/styles';
import { telemetryTheme } from '@/theme';
import { TacticalMap, type TacticalMapPathPoint, type TacticalMapObstacle } from '@/components/hud/telemetry/TacticalMap';

const renderMap = (onClose: () => void = () => {}) => {
  const pathHistory = { current: [] as TacticalMapPathPoint[] };
  const obstacles = { current: [] as TacticalMapObstacle[] };
  const currentPos = { current: { x: 0, y: 0 } };
  const headingRef = { current: 0 };

  return render(
    <ThemeProvider theme={telemetryTheme}>
      <TacticalMap
        onClose={onClose}
        pathHistory={pathHistory}
        obstacles={obstacles}
        currentPos={currentPos}
        headingRef={headingRef}
      />
    </ThemeProvider>,
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
});
