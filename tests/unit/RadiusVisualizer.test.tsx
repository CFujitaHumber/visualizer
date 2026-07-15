/**
 * Unit tests for the RadiusVisualizer presentational component.
 */
import { render, screen } from '@testing-library/react';
import { ThemeProvider } from '@mui/material/styles';
import { telemetryTheme } from '@/theme';
import { RadiusVisualizer } from '@/components/hud/telemetry/RadiusVisualizer';

const renderRadar = (props: Partial<React.ComponentProps<typeof RadiusVisualizer>> = {}) =>
  render(
    <ThemeProvider theme={telemetryTheme}>
      <RadiusVisualizer heading={0} obstacles={[]} {...props} />
    </ThemeProvider>,
  );

/** Obstacle dots are the only r=3 circles in the SVG. */
const obstacleDots = (container: HTMLElement) => container.querySelectorAll('circle[r="3"]');

describe('RadiusVisualizer', () => {
  it('renders the title and N/A coordinates when GPS is missing', () => {
    renderRadar();

    expect(screen.getByTestId('radius-visualizer')).toBeInTheDocument();
    expect(screen.getByText('MINIMAP')).toBeInTheDocument();
    expect(screen.getByText('LAT: N/A')).toBeInTheDocument();
    expect(screen.getByText('LON: N/A')).toBeInTheDocument();
  });

  it('formats latitude/longitude to six decimals', () => {
    renderRadar({ latitude: 43.7315, longitude: -79.7624 });
    expect(screen.getByText('LAT: 43.731500')).toBeInTheDocument();
    expect(screen.getByText('LON: -79.762400')).toBeInTheDocument();
  });

  it('plots obstacles within range and hides those beyond it', () => {
    const { container } = renderRadar({
      rangeM: 40,
      obstacles: [
        { id: 'near-1', x: 10, y: 5 },
        { id: 'near-2', x: -20, y: 15 },
        { id: 'far', x: 45, y: 45 }, // hypot ≈ 63.6 m — outside the 40 m range
      ],
    });

    expect(obstacleDots(container)).toHaveLength(2);
  });

  it('rotates obstacles into heading-up space', () => {
    // Heading 90° (facing east); obstacle 10 m east must render straight up.
    const { container } = renderRadar({
      heading: 90,
      rangeM: 40,
      size: 120,
      obstacles: [{ id: 'ahead', x: 10, y: 0 }],
    });

    const dot = obstacleDots(container)[0]!;
    const cx = Number(dot.getAttribute('cx'));
    const cy = Number(dot.getAttribute('cy'));

    // center = 60 px, 10 m at 1.5 px/m = 15 px above center
    expect(cx).toBeCloseTo(60, 3);
    expect(cy).toBeCloseTo(45, 3);
  });

  it('renders the four cardinal markers', () => {
    renderRadar();
    for (const label of ['N', 'E', 'S', 'W']) {
      expect(screen.getByText(label)).toBeInTheDocument();
    }
  });
});
