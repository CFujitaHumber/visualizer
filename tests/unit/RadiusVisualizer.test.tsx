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

  it('plots at 33 cm per pixel by default', () => {
    // size 100 → 50 px radius; 3.3 m north is 10 px up at the default resolution.
    const { container } = renderRadar({ obstacles: [{ id: 'ahead', x: 0, y: 3.3 }] });

    const dot = obstacleDots(container)[0]!;
    expect(Number(dot.getAttribute('cx'))).toBeCloseTo(50, 3);
    expect(Number(dot.getAttribute('cy'))).toBeCloseTo(40, 3);
  });

  it('derives its range from the resolution when rangeM is unset', () => {
    // 50 px radius at 0.33 m/px reaches 16.5 m.
    const { container } = renderRadar({
      obstacles: [
        { id: 'inside', x: 0, y: 16 },
        { id: 'outside', x: 0, y: 17 },
      ],
    });

    expect(obstacleDots(container)).toHaveLength(1);
  });

  it('lets an explicit rangeM stretch the resolution to fit', () => {
    // rangeM 25 over a 50 px radius → 0.5 m/px, so 10 m east is 20 px right of center.
    const { container } = renderRadar({
      rangeM: 25,
      obstacles: [{ id: 'starboard', x: 10, y: 0 }],
    });

    const dot = obstacleDots(container)[0]!;
    expect(Number(dot.getAttribute('cx'))).toBeCloseTo(70, 3);
    expect(Number(dot.getAttribute('cy'))).toBeCloseTo(50, 3);
  });

  it('renders the four cardinal markers', () => {
    renderRadar();
    for (const label of ['N', 'E', 'S', 'W']) {
      expect(screen.getByText(label)).toBeInTheDocument();
    }
  });
});
