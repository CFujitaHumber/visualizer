/**
 * Unit tests for the battery-level → MUI icon mapping.
 */
import { batteryIconFor } from '@/utils/batteryUtil';
import Battery0BarIcon from '@mui/icons-material/Battery0Bar';
import Battery3BarIcon from '@mui/icons-material/Battery3Bar';
import BatteryFullIcon from '@mui/icons-material/BatteryFull';

describe('batteryIconFor', () => {
  it('returns the full icon at ≥95%', () => {
    expect(batteryIconFor(100)).toBe(BatteryFullIcon);
    expect(batteryIconFor(95)).toBe(BatteryFullIcon);
  });

  it('returns mid-level icons in the middle of the range', () => {
    expect(batteryIconFor(50)).toBe(Battery3BarIcon);
  });

  it('returns the empty icon below 15%', () => {
    expect(batteryIconFor(10)).toBe(Battery0BarIcon);
    expect(batteryIconFor(0)).toBe(Battery0BarIcon);
  });
});
