/**
 * @file demo/DemoApp.tsx
 * @description Demo harness application for @humber-asv/visualizer.
 *
 * Boots straight into simulation mode (no basestation required) and renders the
 * TelemetryDashboard with the RadiusVisualizer / ShipRudderVisualizer panels
 * overlaid, plus sim controls. Stable data-testids are exposed for the
 * selenium-webdriver e2e suite.
 *
 * Not shipped to npm — the published package contains only `dist/`.
 */
import { useEffect } from "react";
import { Box, Button, Stack } from "@mui/material";
import {
  TelemetryProvider,
  TelemetryThemeProvider,
  TelemetryDashboard,
  RadiusVisualizerPanel,
  ShipRudderVisualizerPanel,
} from "../src";
import { useAppDispatch, startSimulation, regenerateMockTelemetry } from "../src/store";

function DemoInner() {
  const dispatch = useAppDispatch();

  // Boot straight into simulation mode — the demo has no basestation.
  useEffect(() => {
    dispatch(startSimulation());
  }, [dispatch]);

  return (
    <Box sx={{ position: "relative", width: "100%", minHeight: "100vh" }}>
      <Box data-testid="dashboard-root">
        <TelemetryDashboard title="Demo Log" />
      </Box>

      {/* Overlay column: new panels + sim controls */}
      <Stack
        spacing={1.5}
        sx={{
          position: "absolute",
          top: 96,
          right: 16,
          zIndex: 10,
          alignItems: "flex-end",
        }}
      >
        <RadiusVisualizerPanel />
        <ShipRudderVisualizerPanel />
        <Stack direction="row" spacing={1}>
          <Button
            data-testid="start-sim"
            size="small"
            variant="contained"
            onClick={() => dispatch(startSimulation())}
          >
            Start Sim
          </Button>
          <Button
            data-testid="regenerate-map"
            size="small"
            variant="outlined"
            onClick={() => dispatch(regenerateMockTelemetry())}
          >
            Regenerate
          </Button>
        </Stack>
      </Stack>
    </Box>
  );
}

export function DemoApp() {
  return (
    <TelemetryProvider>
      <TelemetryThemeProvider>
        <DemoInner />
      </TelemetryThemeProvider>
    </TelemetryProvider>
  );
}
