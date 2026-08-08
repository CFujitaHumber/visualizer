/**
 * Unit tests for the TaskData presentational component.
 */
import { render, screen } from '@testing-library/react';
import { ThemeProvider } from '@mui/material/styles';
import { Provider } from 'react-redux';
import { telemetryTheme } from '@/theme';
import store from '@/store/store';
import { setSystemTopics } from '@/store/slices/telemetrySlice';
import TaskData from '@/components/hud/telemetry/TaskData';

const renderTaskData = () =>
  render(
    <Provider store={store}>
      <ThemeProvider theme={telemetryTheme}>
        <TaskData />
      </ThemeProvider>
    </Provider>,
  );

describe('TaskData', () => {
  it('shows "None" for services/topics when the list is empty', () => {
    renderTaskData();
    expect(screen.getByText('Services / Topics (0)')).toBeInTheDocument();
  });

  it('lists each topic once populated', () => {
    store.dispatch(setSystemTopics(['phone', 'zed/zed_node/odom']));
    renderTaskData();

    expect(screen.getByText('Services / Topics (2)')).toBeInTheDocument();
    expect(screen.getByText('phone')).toBeInTheDocument();
    expect(screen.getByText('zed/zed_node/odom')).toBeInTheDocument();
  });
});
